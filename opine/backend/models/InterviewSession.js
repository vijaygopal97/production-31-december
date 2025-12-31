const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
  // Session Information
  sessionId: {
    type: String,
    required: true
  },
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true
  },
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Session Status
  status: {
    type: String,
    enum: ['active', 'paused', 'abandoned'],
    default: 'active'
  },
  
  // Current Position
  currentSectionIndex: {
    type: Number,
    default: 0
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  
  // Session Timing
  startTime: {
    type: Date,
    default: Date.now
  },
  lastActivityTime: {
    type: Date,
    default: Date.now
  },
  totalTimeSpent: {
    type: Number, // in seconds
    default: 0
  },
  pausedTime: {
    type: Number, // in seconds
    default: 0
  },
  
  // Temporary Response Storage (not saved to database)
  currentResponses: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Progress Tracking
  reachedQuestions: [{
    sectionIndex: Number,
    questionIndex: Number,
    questionId: String,
    reachedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Session Context
  interviewMode: {
    type: String,
    enum: ['capi', 'cati', 'online'],
    required: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String,
    screenResolution: String,
    timezone: String
  },
  
  // Session Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Auto-cleanup: Sessions expire after 24 hours
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}, {
  timestamps: true
});

// Indexes
interviewSessionSchema.index({ sessionId: 1 }, { unique: true });
interviewSessionSchema.index({ survey: 1, interviewer: 1 });
interviewSessionSchema.index({ status: 1 });
interviewSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
interviewSessionSchema.methods.updateCurrentPosition = function(sectionIndex, questionIndex) {
  this.currentSectionIndex = sectionIndex;
  this.currentQuestionIndex = questionIndex;
  this.lastActivityTime = new Date();
  return this;
};

interviewSessionSchema.methods.markQuestionReached = function(sectionIndex, questionIndex, questionId) {
  const existingIndex = this.reachedQuestions.findIndex(
    rq => rq.sectionIndex === sectionIndex && rq.questionIndex === questionIndex
  );
  
  if (existingIndex < 0) {
    this.reachedQuestions.push({
      sectionIndex,
      questionIndex,
      questionId,
      reachedAt: new Date()
    });
  }
  
  this.lastActivityTime = new Date();
  return this;
};

interviewSessionSchema.methods.canNavigateToQuestion = function(sectionIndex, questionIndex) {
  return this.reachedQuestions.some(
    rq => rq.sectionIndex === sectionIndex && rq.questionIndex === questionIndex
  );
};

interviewSessionSchema.methods.updateResponse = function(questionId, response) {
  this.currentResponses[questionId] = response;
  this.lastActivityTime = new Date();
  return this;
};

interviewSessionSchema.methods.pauseSession = function() {
  this.status = 'paused';
  this.lastActivityTime = new Date();
  return this;
};

interviewSessionSchema.methods.resumeSession = function() {
  this.status = 'active';
  this.lastActivityTime = new Date();
  return this;
};

interviewSessionSchema.methods.abandonSession = function() {
  this.status = 'abandoned';
  this.lastActivityTime = new Date();
  return this;
};

// Static method to create a new session
interviewSessionSchema.statics.createSession = function(data) {
  const {
    sessionId,
    survey,
    interviewer,
    interviewMode,
    deviceInfo,
    metadata
  } = data;

  return new this({
    sessionId,
    survey,
    interviewer,
    interviewMode,
    deviceInfo,
    metadata
  });
};

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);