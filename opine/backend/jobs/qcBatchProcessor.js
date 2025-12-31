const mongoose = require('mongoose');
const QCBatch = require('../models/QCBatch');
const QCBatchConfig = require('../models/QCBatchConfig');
const SurveyResponse = require('../models/SurveyResponse');

// Helper to convert ObjectId strings to ObjectIds
const toObjectId = (id) => {
  if (typeof id === 'string') {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
};

/**
 * Process a single batch - select sample and send to QC
 * @param {QCBatch} batch - The batch to process
 * @param {Object} config - The QC batch configuration to use
 */
const processBatch = async (batch, config) => {
  try {
    console.log(`\n📋 Processing batch ${batch._id}`);
    console.log(`   Total responses: ${batch.totalResponses}`);
    console.log(`   Using config: Sample ${config.samplePercentage}%`);
    
    if (batch.totalResponses === 0) {
      console.log(`   ⚠️  Batch has no responses, skipping...`);
      return;
    }
    
    // Calculate sample size based on config
    const sampleSize = Math.ceil(batch.totalResponses * (config.samplePercentage / 100));
    console.log(`   📊 Sample size (${config.samplePercentage}%): ${sampleSize}`);
    
    // Randomly select sample responses
    const allResponseIds = batch.responses.map(id => id.toString());
    const shuffled = [...allResponseIds].sort(() => Math.random() - 0.5);
    const sampleResponseIds = shuffled.slice(0, sampleSize);
    const remainingResponseIds = shuffled.slice(sampleSize);
    
    console.log(`   ✅ Selected ${sampleResponseIds.length} responses for QC sample`);
    console.log(`   📝 Remaining responses: ${remainingResponseIds.length}`);
    
    // Convert string IDs to ObjectIds
    const sampleObjectIds = sampleResponseIds.map(id => toObjectId(id));
    const remainingObjectIds = remainingResponseIds.map(id => toObjectId(id));
    
    // Mark sample responses
    await SurveyResponse.updateMany(
      { _id: { $in: sampleObjectIds } },
      { 
        $set: { 
          isSampleResponse: true,
          status: 'Pending_Approval'
        }
      }
    );
    
    // Mark remaining responses (not in QC queue yet)
    await SurveyResponse.updateMany(
      { _id: { $in: remainingObjectIds } },
      { 
        $set: { 
          isSampleResponse: false,
          status: 'Pending_Approval'
        }
      }
    );
    
    // Update batch with sample and config snapshot
    batch.sampleResponses = sampleResponseIds;
    batch.sampleSize = sampleResponseIds.length;
    batch.remainingResponses = remainingResponseIds;
    batch.remainingSize = remainingResponseIds.length;
    batch.status = 'qc_in_progress';
    batch.processingStartedAt = new Date();
    batch.batchConfig = {
      samplePercentage: config.samplePercentage,
      approvalRules: config.approvalRules || [],
      configId: config._id || null
    };
    
    await batch.save();
    
    console.log(`   ✅ Batch ${batch._id} processed successfully`);
    console.log(`   📊 ${sampleSize} responses sent to QC queue`);
    
  } catch (error) {
    console.error(`   ❌ Error processing batch ${batch._id}:`, error);
    throw error;
  }
};

/**
 * Make decision on remaining responses based on approval rate and config rules
 * @param {QCBatch} batch - The batch to process
 */
const makeDecisionOnRemaining = async (batch) => {
  try {
    // Get the config that was used for this batch
    const config = batch.batchConfig || {
      samplePercentage: 40,
      approvalRules: [
        { minRate: 50, maxRate: 100, action: 'auto_approve', description: '50%+ - Auto approve' },
        { minRate: 0, maxRate: 50, action: 'send_to_qc', description: 'Below 50% - Send to QC' }
      ]
    };
    
    // Update QC stats first
    await batch.updateQCStats();
    
    const approvalRate = batch.qcStats.approvalRate;
    const totalQCed = batch.qcStats.approvedCount + batch.qcStats.rejectedCount;
    
    console.log(`\n📊 Batch ${batch._id} Decision Check:`);
    console.log(`   Approval Rate: ${approvalRate}%`);
    console.log(`   Total QCed: ${totalQCed}`);
    console.log(`   Pending: ${batch.qcStats.pendingCount}`);
    
    // If there are still pending responses in the sample, wait
    if (batch.qcStats.pendingCount > 0) {
      console.log(`   ⏳ Waiting for all sample responses to be QCed...`);
      return;
    }
    
    // If no responses have been QCed yet, wait
    if (totalQCed === 0) {
      console.log(`   ⏳ No responses QCed yet, waiting...`);
      return;
    }
    
    // Find matching rule based on approval rate
    let matchedRule = null;
    for (const rule of config.approvalRules || []) {
      if (approvalRate >= rule.minRate && approvalRate <= rule.maxRate) {
        matchedRule = rule;
        break;
      }
    }
    
    if (!matchedRule) {
      console.log(`   ⚠️  No matching rule found for approval rate ${approvalRate}%`);
      // Default: if > 50%, auto-approve; else send to QC
      matchedRule = approvalRate > 50 
        ? { action: 'auto_approve', description: 'Default: Auto approve' }
        : { action: 'send_to_qc', description: 'Default: Send to QC' };
    }
    
    console.log(`   ✅ Matched Rule: ${matchedRule.description || matchedRule.action}`);
    console.log(`   Action: ${matchedRule.action}`);
    
    // Convert remaining response IDs to ObjectIds
    const remainingObjectIds = batch.remainingResponses.map(id => {
      if (typeof id === 'string') {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });
    
    // Execute the action
    if (matchedRule.action === 'auto_approve') {
      // Auto-approve all remaining responses
      await SurveyResponse.updateMany(
        { _id: { $in: remainingObjectIds } },
        { 
          $set: { 
            status: 'Approved',
            autoApproved: true,
            verificationData: {
              reviewer: null,
              reviewedAt: new Date(),
              criteria: {},
              feedback: `Auto-approved based on ${approvalRate.toFixed(2)}% approval rate in ${config.samplePercentage}% sample`,
              autoApproved: true,
              batchId: batch._id
            }
          }
        }
      );
      
      batch.status = 'auto_approved';
      batch.remainingDecision = {
        decision: 'auto_approved',
        decidedAt: new Date(),
        triggerApprovalRate: approvalRate
      };
      
      console.log(`   ✅ Auto-approved ${remainingObjectIds.length} remaining responses`);
      
    } else if (matchedRule.action === 'send_to_qc') {
      // Send remaining responses to QC queue
      await SurveyResponse.updateMany(
        { _id: { $in: remainingObjectIds } },
        { 
          $set: { 
            status: 'Pending_Approval',
            isSampleResponse: false // They're not in the sample, but they're now in QC queue
          }
        }
      );
      
      batch.status = 'queued_for_qc';
      batch.remainingDecision = {
        decision: 'queued_for_qc',
        decidedAt: new Date(),
        triggerApprovalRate: approvalRate
      };
      
      console.log(`   ✅ Sent ${remainingObjectIds.length} remaining responses to QC queue`);
      
    } else if (matchedRule.action === 'reject_all') {
      // Reject all remaining responses
      await SurveyResponse.updateMany(
        { _id: { $in: remainingObjectIds } },
        { 
          $set: { 
            status: 'Rejected',
            verificationData: {
              reviewer: null,
              reviewedAt: new Date(),
              criteria: {},
              feedback: `Auto-rejected based on ${approvalRate.toFixed(2)}% approval rate in ${config.samplePercentage}% sample`,
              autoRejected: true,
              batchId: batch._id
            }
          }
        }
      );
      
      batch.status = 'completed';
      batch.remainingDecision = {
        decision: 'rejected_all',
        decidedAt: new Date(),
        triggerApprovalRate: approvalRate
      };
      
      console.log(`   ❌ Rejected ${remainingObjectIds.length} remaining responses`);
    }
    
    batch.processingCompletedAt = new Date();
    await batch.save();
    
  } catch (error) {
    console.error(`   ❌ Error making decision for batch ${batch._id}:`, error);
    throw error;
  }
};

/**
 * Process batches that need to be processed (called when new batch is created)
 * This processes the previous batch for the same survey
 */
const processPreviousBatch = async (surveyId) => {
  try {
    console.log(`\n🔄 Processing previous batch for survey ${surveyId}`);
    
    // Get active config for this survey
    const Survey = require('../models/Survey');
    const survey = await Survey.findById(surveyId).populate('company');
    if (!survey) {
      console.log(`   ⚠️  Survey not found: ${surveyId}`);
      return;
    }
    
    const config = await QCBatchConfig.getActiveConfig(surveyId, survey.company._id || survey.company);
    console.log(`   📋 Using config: ${config.samplePercentage}% sample`);
    
    // Find the most recent batch in 'collecting' status for this survey
    const previousBatch = await QCBatch.findOne({
      survey: surveyId,
      status: 'collecting',
      totalResponses: { $gt: 0 }
    }).sort({ batchDate: -1 });
    
    if (!previousBatch) {
      console.log(`   ℹ️  No previous batch found to process`);
      return;
    }
    
    console.log(`   📦 Found previous batch: ${previousBatch._id} from ${previousBatch.batchDate.toISOString().split('T')[0]}`);
    
    // Process the previous batch
    await processBatch(previousBatch, config);
    
  } catch (error) {
    console.error(`❌ Error processing previous batch:`, error);
    throw error;
  }
};

/**
 * Check and make decisions on batches in progress
 */
const checkBatchesInProgress = async () => {
  try {
    console.log('\n🔍 Checking batches for decision making...');
    
    const batchesInProgress = await QCBatch.find({
      status: 'qc_in_progress',
      'sampleResponses.0': { $exists: true }
    });
    
    console.log(`📦 Found ${batchesInProgress.length} batches in QC progress`);
    
    for (const batch of batchesInProgress) {
      try {
        await makeDecisionOnRemaining(batch);
      } catch (error) {
        console.error(`   ❌ Error checking batch ${batch._id}:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking batches in progress:', error);
    throw error;
  }
};

/**
 * Main batch processing function (called by cron at midnight)
 */
const processQCBatches = async () => {
  try {
    console.log('🔄 Starting QC Batch Processing Job (Midnight)...');
    
    // This function is called at midnight to:
    // 1. Process batches from previous day that are still collecting
    // 2. Check batches in progress and make decisions
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find batches from before today that are still collecting
    const batchesToProcess = await QCBatch.find({
      batchDate: { $lt: today },
      status: 'collecting',
      totalResponses: { $gt: 0 }
    }).populate('survey').sort({ batchDate: 1 });
    
    console.log(`📦 Found ${batchesToProcess.length} batches to process`);
    
    // Process each batch
    for (const batch of batchesToProcess) {
      try {
        const Survey = require('../models/Survey');
        const survey = await Survey.findById(batch.survey._id || batch.survey).populate('company');
        if (!survey) continue;
        
        const config = await QCBatchConfig.getActiveConfig(
          batch.survey._id || batch.survey,
          survey.company._id || survey.company
        );
        
        await processBatch(batch, config);
      } catch (error) {
        console.error(`   ❌ Error processing batch ${batch._id}:`, error);
      }
    }
    
    // Check batches in progress
    await checkBatchesInProgress();
    
    console.log('\n✅ QC Batch Processing Job completed');
    
  } catch (error) {
    console.error('❌ Error in QC Batch Processing Job:', error);
    throw error;
  }
};

module.exports = {
  processQCBatches,
  processPreviousBatch,
  checkBatchesInProgress,
  processBatch,
  makeDecisionOnRemaining
};
