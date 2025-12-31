const mongoose = require('mongoose');

const qcBatchConfigSchema = new mongoose.Schema({
  // Survey reference (null for global/default config)
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    default: null,
    index: true
  },
  
  // Company reference (for company-specific configs)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  
  // Percentage of responses to send to QC (e.g., 40 for 40%)
  samplePercentage: {
    type: Number,
    required: true,
    default: 40,
    min: 1,
    max: 100
  },
  
  // Approval rate thresholds and actions
  approvalRules: [{
    // Minimum approval rate (inclusive)
    minRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // Maximum approval rate (inclusive)
    maxRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // Action to take: 'auto_approve', 'send_to_qc', 'reject_all'
    action: {
      type: String,
      enum: ['auto_approve', 'send_to_qc', 'reject_all'],
      required: true
    },
    // Description for UI display
    description: {
      type: String
    }
  }],
  
  // Is this the active configuration?
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Notes
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient querying
qcBatchConfigSchema.index({ survey: 1, company: 1, isActive: 1 });
qcBatchConfigSchema.index({ company: 1, isActive: 1 });

// Static method to get active config for a survey
qcBatchConfigSchema.statics.getActiveConfig = async function(surveyId, companyId) {
  // First try to get survey-specific config
  let config = await this.findOne({
    survey: surveyId,
    company: companyId,
    isActive: true
  }).sort({ createdAt: -1 });
  
  // If no survey-specific config, get company default (survey: null)
  if (!config) {
    config = await this.findOne({
      survey: null,
      company: companyId,
      isActive: true
    }).sort({ createdAt: -1 });
  }
  
  // If still no config, return default config object
  if (!config) {
    return {
      samplePercentage: 40,
      approvalRules: [
        {
          minRate: 50,
          maxRate: 100,
          action: 'auto_approve',
          description: '50%+ approval rate - Auto approve remaining'
        },
        {
          minRate: 0,
          maxRate: 50,
          action: 'send_to_qc',
          description: 'Below 50% approval rate - Send to QC'
        }
      ]
    };
  }
  
  return config;
};

module.exports = mongoose.model('QCBatchConfig', qcBatchConfigSchema);

