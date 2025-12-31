const QCBatchConfig = require('../models/QCBatchConfig');
const Survey = require('../models/Survey');

/**
 * @desc    Get active QC batch configuration for a survey
 * @route   GET /api/qc-batch-config/survey/:surveyId
 * @access  Private (Company Admin, Project Manager)
 */
const getConfigBySurvey = async (req, res) => {
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
    
    // Get active config (survey-specific or company default)
    const config = await QCBatchConfig.getActiveConfig(surveyId, companyId);
    
    res.json({
      success: true,
      data: {
        config: config
      }
    });
    
  } catch (error) {
    console.error('Error fetching QC batch config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QC batch configuration',
      error: error.message
    });
  }
};

/**
 * @desc    Create or update QC batch configuration
 * @route   POST /api/qc-batch-config
 * @access  Private (Company Admin, Super Admin)
 */
const createOrUpdateConfig = async (req, res) => {
  try {
    const { surveyId, samplePercentage, approvalRules, notes } = req.body;
    const companyId = req.user.company;
    const userId = req.user.id;
    const userType = req.user.userType;
    
    // Only allow company admin or super admin
    if (userType !== 'company_admin' && userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create/update QC batch configuration'
      });
    }
    
    // Validate sample percentage
    if (!samplePercentage || samplePercentage < 1 || samplePercentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Sample percentage must be between 1 and 100'
      });
    }
    
    // Validate approval rules - only required if samplePercentage is less than 100
    // When samplePercentage is 100%, all responses go to QC, so no rules are needed for remaining responses
    const rulesArray = approvalRules || [];
    
    if (samplePercentage < 100 && rulesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one approval rule is required when sample percentage is less than 100%'
      });
    }
    
    // Validate each rule (if any)
    for (const rule of rulesArray) {
      if (rule.minRate === undefined || rule.minRate === null || 
          rule.maxRate === undefined || rule.maxRate === null || 
          !rule.action) {
        return res.status(400).json({
          success: false,
          message: 'Each approval rule must have minRate, maxRate, and action'
        });
      }
      
      if (rule.minRate < 0 || rule.minRate > 100 || rule.maxRate < 0 || rule.maxRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Approval rates must be between 0 and 100'
        });
      }
      
      if (rule.minRate > rule.maxRate) {
        return res.status(400).json({
          success: false,
          message: 'minRate cannot be greater than maxRate'
        });
      }
      
      if (!['auto_approve', 'send_to_qc', 'reject_all'].includes(rule.action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be one of: auto_approve, send_to_qc, reject_all'
        });
      }
    }
    
    // Check if survey exists and belongs to company (if surveyId provided)
    if (surveyId) {
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
    }
    
    // Deactivate all existing configs for this survey/company
    await QCBatchConfig.updateMany(
      {
        survey: surveyId || null,
        company: companyId,
        isActive: true
      },
      {
        isActive: false
      }
    );
    
    // Create new active config
    const config = new QCBatchConfig({
      survey: surveyId || null, // null for company default
      company: companyId,
      samplePercentage,
      approvalRules: rulesArray,
      notes,
      isActive: true,
      createdBy: userId
    });
    
    await config.save();
    
    res.json({
      success: true,
      message: surveyId ? 'QC batch configuration created successfully for survey' : 'QC batch configuration created successfully (company default)',
      data: {
        config
      }
    });
    
  } catch (error) {
    console.error('Error creating/updating QC batch config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update QC batch configuration',
      error: error.message
    });
  }
};

/**
 * @desc    Get all configurations for a company
 * @route   GET /api/qc-batch-config/company
 * @access  Private (Company Admin, Project Manager)
 */
const getConfigsByCompany = async (req, res) => {
  try {
    const companyId = req.user.company;
    
    // Get all configs for this company (both survey-specific and default)
    const configs = await QCBatchConfig.find({
      company: companyId
    })
      .populate('survey', 'surveyName')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        configs
      }
    });
    
  } catch (error) {
    console.error('Error fetching QC batch configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QC batch configurations',
      error: error.message
    });
  }
};

module.exports = {
  getConfigBySurvey,
  createOrUpdateConfig,
  getConfigsByCompany
};

