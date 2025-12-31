const mongoose = require('mongoose');

const surveyAnalyticsSchema = new mongoose.Schema({
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    unique: true,
    index: true
  },
  
  // Basic Statistics
  totalResponses: {
    type: Number,
    default: 0
  },
  capiResponses: {
    type: Number,
    default: 0
  },
  catiResponses: {
    type: Number,
    default: 0
  },
  approvedResponses: {
    type: Number,
    default: 0
  },
  rejectedResponses: {
    type: Number,
    default: 0
  },
  pendingResponses: {
    type: Number,
    default: 0
  },
  
  // Geographic Statistics
  acStats: [{
    ac: String,
    count: Number,
    capi: Number,
    cati: Number,
    percentage: Number,
    pcName: String,
    interviewersCount: Number,
    approved: Number,
    rejected: Number,
    underQC: Number
  }],
  
  districtStats: [{
    district: String,
    count: Number,
    percentage: Number
  }],
  
  lokSabhaStats: [{
    lokSabha: String,
    count: Number,
    percentage: Number
  }],
  
  // Interviewer Statistics
  interviewerStats: [{
    interviewer: String,
    interviewerId: mongoose.Schema.Types.ObjectId,
    count: Number,
    approved: Number,
    rejected: Number,
    percentage: Number
  }],
  
  // Demographic Statistics
  genderStats: {
    type: Map,
    of: Number,
    default: {}
  },
  
  ageStats: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Daily Statistics
  dailyStats: [{
    date: Date,
    count: Number
  }],
  
  // Performance Statistics
  capiPerformance: {
    approved: Number,
    rejected: Number,
    total: Number
  },
  
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Version for cache invalidation
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for fast lookups
surveyAnalyticsSchema.index({ survey: 1 });
surveyAnalyticsSchema.index({ lastUpdated: -1 });

// Static method to get or create analytics
surveyAnalyticsSchema.statics.getOrCreate = async function(surveyId) {
  let analytics = await this.findOne({ survey: surveyId });
  if (!analytics) {
    analytics = await this.create({ survey: surveyId });
  }
  return analytics;
};

// Method to update analytics incrementally
surveyAnalyticsSchema.methods.updateFromResponse = function(response, operation = 'add') {
  const multiplier = operation === 'add' ? 1 : -1;
  
  // Update basic counts
  this.totalResponses = Math.max(0, this.totalResponses + (1 * multiplier));
  
  if (response.interviewMode?.toUpperCase() === 'CAPI') {
    this.capiResponses = Math.max(0, this.capiResponses + (1 * multiplier));
  } else if (response.interviewMode?.toUpperCase() === 'CATI') {
    this.catiResponses = Math.max(0, this.catiResponses + (1 * multiplier));
  }
  
  if (response.status === 'Approved') {
    this.approvedResponses = Math.max(0, this.approvedResponses + (1 * multiplier));
  } else if (response.status === 'Rejected') {
    this.rejectedResponses = Math.max(0, this.rejectedResponses + (1 * multiplier));
  } else if (response.status === 'Pending_Approval') {
    this.pendingResponses = Math.max(0, this.pendingResponses + (1 * multiplier));
  }
  
  this.lastUpdated = new Date();
  this.version += 1;
};

module.exports = mongoose.model('SurveyAnalytics', surveyAnalyticsSchema);
