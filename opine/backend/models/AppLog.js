const mongoose = require('mongoose');

const appLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  appVersion: {
    type: String,
    index: true
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  stackTrace: {
    type: String
  },
  deviceInfo: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
appLogSchema.index({ deviceId: 1, timestamp: -1 });
appLogSchema.index({ category: 1, level: 1, timestamp: -1 });
appLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AppLog', appLogSchema);





