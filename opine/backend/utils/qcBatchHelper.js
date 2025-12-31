const QCBatch = require('../models/QCBatch');
const QCBatchConfig = require('../models/QCBatchConfig');
const SurveyResponse = require('../models/SurveyResponse');
const { processPreviousBatch } = require('../jobs/qcBatchProcessor');

/**
 * Get or create a QC batch for a specific survey and interviewer
 * @param {String} surveyId - Survey ID
 * @param {String} interviewerId - Interviewer ID
 * @returns {Promise<QCBatch>}
 */
const getOrCreateBatch = async (surveyId, interviewerId) => {
  if (!interviewerId) {
    throw new Error('Interviewer ID is required to create a batch');
  }
  
  // Find existing batch for this survey and interviewer that is still collecting
  // Only look for batches with less than 100 responses
  let batch = await QCBatch.findOne({
    survey: surveyId,
    interviewer: interviewerId,
    status: 'collecting',
    totalResponses: { $lt: 100 }
  }).sort({ batchDate: -1 }); // Get the most recent collecting batch
  
  // If no batch exists, create a new one
  if (!batch) {
    // Get active config for this survey to store in batch
    const Survey = require('../models/Survey');
    const survey = await Survey.findById(surveyId).populate('company');
    let config = null;
    if (survey) {
      config = await QCBatchConfig.getActiveConfig(surveyId, survey.company._id || survey.company);
    }
    
    batch = new QCBatch({
      survey: surveyId,
      interviewer: interviewerId,
      batchDate: new Date(),
      status: 'collecting',
      responses: [],
      totalResponses: 0,
      sampleResponses: [],
      sampleSize: 0,
      remainingResponses: [],
      remainingSize: 0,
      qcStats: {
        approvedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        approvalRate: 0
      },
      remainingDecision: {
        decision: 'pending'
      },
      batchConfig: config ? {
        samplePercentage: config.samplePercentage,
        approvalRules: config.approvalRules || [],
        configId: config._id || null
      } : {
        samplePercentage: 40,
        approvalRules: [
          { minRate: 50, maxRate: 100, action: 'auto_approve', description: '50%+ - Auto approve' },
          { minRate: 0, maxRate: 50, action: 'send_to_qc', description: 'Below 50% - Send to QC' }
        ]
      }
    });
    
    await batch.save();
    console.log(`✅ Created new QC batch for survey ${surveyId} and interviewer ${interviewerId}`);
    
    // Check if any batches in progress can have decisions made
    try {
      const { checkBatchesInProgress } = require('../jobs/qcBatchProcessor');
      await checkBatchesInProgress();
    } catch (error) {
      console.error('⚠️  Error checking batches in progress (non-critical):', error);
      // Don't throw - batch creation should succeed even if check fails
    }
  }
  
  return batch;
};

/**
 * Add a response to a batch
 * @param {String} responseId - SurveyResponse ID
 * @param {String} surveyId - Survey ID
 * @param {String} interviewerId - Interviewer ID
 * @returns {Promise<QCBatch>}
 */
const addResponseToBatch = async (responseId, surveyId, interviewerId) => {
  try {
    // CRITICAL: Check if response is auto-rejected or rejected before adding to batch
    const response = await SurveyResponse.findById(responseId).select('status verificationData interviewer');
    if (!response) {
      throw new Error(`Response ${responseId} not found`);
    }
    
    // Skip if response is rejected (auto-rejected or manually rejected)
    if (response.status === 'Rejected' || response.verificationData?.autoRejected === true) {
      console.log(`⏭️  Skipping batch addition for rejected response ${responseId} (status: ${response.status}, autoRejected: ${response.verificationData?.autoRejected})`);
      return; // Don't add rejected responses to batches
    }
    
    if (!interviewerId) {
      // Try to get interviewer from the response
      if (response && response.interviewer) {
        interviewerId = response.interviewer.toString();
      } else {
        throw new Error('Interviewer ID is required to add response to batch');
      }
    }
    
    // Get or create batch for this interviewer
    let batch = await getOrCreateBatch(surveyId, interviewerId);
    
    // Add response to batch if not already added
    if (!batch.responses.includes(responseId)) {
      batch.responses.push(responseId);
      batch.totalResponses = batch.responses.length;
      await batch.save();
      
      // Update response with batch reference - CRITICAL: Use native MongoDB to preserve setNumber
      const mongoose = require('mongoose');
      const collection = mongoose.connection.collection('surveyresponses');
      await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(responseId) },
        { $set: { qcBatch: batch._id, isSampleResponse: false } }
      );
      
      console.log(`✅ Added response ${responseId} to batch ${batch._id} (${batch.totalResponses}/100)`);
      
      // If batch reaches 100 responses, automatically process it
      if (batch.totalResponses >= 100) {
        console.log(`📦 Batch ${batch._id} reached 100 responses, processing automatically...`);
        
        // Get active config for processing
        const Survey = require('../models/Survey');
        const survey = await Survey.findById(surveyId).populate('company');
        const config = survey ? await QCBatchConfig.getActiveConfig(surveyId, survey.company._id || survey.company) : null;
        
        if (config) {
          const { processBatch } = require('../jobs/qcBatchProcessor');
          await processBatch(batch, config);
          console.log(`✅ Batch ${batch._id} processed automatically at 100 responses`);
        } else {
          console.warn(`⚠️  No config found for survey ${surveyId}, batch will be processed later`);
        }
      }
    }
    
    return batch;
  } catch (error) {
    console.error('Error adding response to batch:', error);
    throw error;
  }
};

module.exports = {
  getOrCreateBatch,
  addResponseToBatch
};



