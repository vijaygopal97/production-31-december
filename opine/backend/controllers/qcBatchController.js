const QCBatch = require('../models/QCBatch');
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const QCBatchConfig = require('../models/QCBatchConfig');
const { processQCBatches, processBatch } = require('../jobs/qcBatchProcessor');

/**
 * @desc    Get all QC batches for a survey
 * @route   GET /api/qc-batches/survey/:surveyId
 * @access  Private (Company Admin, Project Manager)
 */
const getBatchesBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const companyId = req.user.company;
    
    // Verify survey belongs to company
    const survey = await Survey.findOne({
      _id: surveyId,
      company: companyId
    });
    
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    
    // Get all batches for this survey, sorted by date (newest first)
    const batches = await QCBatch.find({ survey: surveyId })
      .populate('survey', 'surveyName')
      .populate('interviewer', 'firstName lastName email')
      .sort({ batchDate: -1 });
    
    // Calculate stats for each batch
    const batchesWithStats = await Promise.all(
      batches.map(async (batch) => {
        // Get response details
        const responses = await SurveyResponse.find({
          _id: { $in: batch.responses }
        }).select('responseId status createdAt interviewMode interviewer');
        
        // Calculate real-time stats
        const sampleResponses = await SurveyResponse.find({
          _id: { $in: batch.sampleResponses }
        }).select('status');
        
        const approvedCount = sampleResponses.filter(r => r.status === 'Approved').length;
        const rejectedCount = sampleResponses.filter(r => r.status === 'Rejected').length;
        const pendingCount = sampleResponses.filter(r => r.status === 'Pending_Approval').length;
        const totalQCed = approvedCount + rejectedCount;
        const approvalRate = totalQCed > 0 ? (approvedCount / totalQCed) * 100 : 0;
        
        return {
          ...batch.toObject(),
          responses: responses,
          realTimeStats: {
            approvedCount,
            rejectedCount,
            pendingCount,
            approvalRate: Math.round(approvalRate * 100) / 100,
            totalQCed
          }
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        batches: batchesWithStats,
        totalBatches: batchesWithStats.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching QC batches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QC batches',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single QC batch with all details
 * @route   GET /api/qc-batches/:batchId
 * @access  Private (Company Admin, Project Manager)
 */
const getBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;
    const companyId = req.user.company;
    
    const batch = await QCBatch.findById(batchId)
      .populate('survey', 'surveyName company')
      .populate('interviewer', 'firstName lastName email');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'QC batch not found'
      });
    }
    
    // Verify batch belongs to company
    if (batch.survey.company.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this batch'
      });
    }
    
    // Get all responses in batch with details
    const allResponses = await SurveyResponse.find({
      _id: { $in: batch.responses }
    })
      .populate('interviewer', 'firstName lastName email')
      .populate('survey', 'surveyName sections questions')
      .select('_id responseId status createdAt interviewMode qcBatch isSampleResponse verificationData responses audioRecording call_id startTime endTime totalTimeSpent location selectedAC qualityMetrics metadata');
    
    // Get sample responses (40%)
    const sampleResponses = allResponses.filter(r => 
      batch.sampleResponses.some(id => id.toString() === r._id.toString())
    );
    
    // Get remaining responses (60%)
    const remainingResponses = allResponses.filter(r => 
      batch.remainingResponses.some(id => id.toString() === r._id.toString())
    );
    
    // Calculate real-time stats
    const approvedCount = sampleResponses.filter(r => r.status === 'Approved').length;
    const rejectedCount = sampleResponses.filter(r => r.status === 'Rejected').length;
    const pendingCount = sampleResponses.filter(r => r.status === 'Pending_Approval').length;
    const totalQCed = approvedCount + rejectedCount;
    const approvalRate = totalQCed > 0 ? (approvedCount / totalQCed) * 100 : 0;
    
    // Update batch stats only if batch has been processed (not in collecting status)
    if (batch.status !== 'collecting') {
      try {
        await batch.updateQCStats();
      } catch (error) {
        console.error('Error updating batch stats (non-critical):', error);
        // Continue even if stats update fails
      }
    }
    
    res.json({
      success: true,
      data: {
        batch: {
          ...batch.toObject(),
          allResponses: allResponses,
          sampleResponses: sampleResponses,
          remainingResponses: remainingResponses,
          realTimeStats: {
            approvedCount,
            rejectedCount,
            pendingCount,
            approvalRate: Math.round(approvalRate * 100) / 100,
            totalQCed
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching QC batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QC batch',
      error: error.message
    });
  }
};

/**
 * @desc    Manually trigger batch processing (for testing/admin use)
 * @route   POST /api/qc-batches/process
 * @access  Private (Company Admin, Super Admin)
 */
const triggerBatchProcessing = async (req, res) => {
  try {
    const userType = req.user.userType;
    
    // Only allow company admin or super admin
    if (userType !== 'company_admin' && userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to trigger batch processing'
      });
    }
    
    console.log('🔄 Manual batch processing triggered by:', req.user.email);
    
    // Process batches
    await processQCBatches();
    
    res.json({
      success: true,
      message: 'Batch processing completed successfully'
    });
    
  } catch (error) {
    console.error('Error in manual batch processing:', error);
    res.status(500).json({
      success: false,
      message: 'Batch processing failed',
      error: error.message
    });
  }
};

/**
 * @desc    Manually send a batch to QC (premature completion)
 * @route   POST /api/qc-batches/:batchId/send-to-qc
 * @access  Private (Company Admin, Project Manager)
 */
const sendBatchToQC = async (req, res) => {
  try {
    const { batchId } = req.params;
    const companyId = req.user.company;
    
    const batch = await QCBatch.findById(batchId)
      .populate('survey', 'surveyName company');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'QC batch not found'
      });
    }
    
    // Verify batch belongs to company
    if (batch.survey.company.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to process this batch'
      });
    }
    
    // Check if batch is in collecting status
    if (batch.status !== 'collecting') {
      return res.status(400).json({
        success: false,
        message: `Batch is already processed. Current status: ${batch.status}`
      });
    }
    
    // Check if batch has responses
    if (batch.totalResponses === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot process batch with no responses'
      });
    }
    
    // Get active config for this survey
    const config = await QCBatchConfig.getActiveConfig(
      batch.survey._id || batch.survey,
      batch.survey.company._id || batch.survey.company
    );
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'No active QC batch configuration found for this survey'
      });
    }
    
    console.log(`🔄 Manually processing batch ${batchId} with ${batch.totalResponses} responses`);
    
    // Process the batch
    await processBatch(batch, config);
    
    // Refresh batch to get updated status
    await batch.populate('interviewer', 'firstName lastName email');
    
    res.json({
      success: true,
      message: `Batch processed successfully. ${batch.sampleSize} responses sent to QC.`,
      data: {
        batch: batch.toObject()
      }
    });
    
  } catch (error) {
    console.error('Error sending batch to QC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch',
      error: error.message
    });
  }
};

module.exports = {
  getBatchesBySurvey,
  getBatchById,
  triggerBatchProcessing,
  sendBatchToQC
};

