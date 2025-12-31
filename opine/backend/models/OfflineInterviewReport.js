const mongoose = require('mongoose');

const offlineInterviewReportSchema = new mongoose.Schema({
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  interviewId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'failed', 'syncing'],
    required: true,
    index: true
  },
  syncAttempts: {
    type: Number,
    default: 0
  },
  lastSyncAttempt: {
    type: Date
  },
  error: {
    type: String
  },
  errorDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  reportedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
offlineInterviewReportSchema.index({ interviewerId: 1, status: 1 });
offlineInterviewReportSchema.index({ deviceId: 1, interviewId: 1 }, { unique: true });
offlineInterviewReportSchema.index({ surveyId: 1, status: 1 });
offlineInterviewReportSchema.index({ status: 1, lastSyncAttempt: -1 });

module.exports = mongoose.model('OfflineInterviewReport', offlineInterviewReportSchema);





