const mongoose = require('mongoose');

const catiRespondentQueueSchema = new mongoose.Schema({
  // Survey reference
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    index: true
  },
  
  // Respondent contact information (from survey.respondentContacts)
  respondentContact: {
    name: { type: String, required: true },
    countryCode: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    ac: { type: String },
    pc: { type: String },
    ps: { type: String }
  },
  
  // Queue status
  status: {
    type: String,
    enum: [
      'pending',           // Waiting to be called
      'assigned',          // Assigned to an interviewer
      'calling',           // Call in progress
      'interview_success', // Interview completed successfully
      'call_failed',       // Call failed (technical issue)
      'busy',              // Number was busy
      'not_interested',    // Respondent not interested
      'call_later',        // Scheduled for later call
      'no_answer',         // No answer
      'switched_off',      // Phone switched off
      'not_reachable',     // Number not reachable
      'does_not_exist',    // Number does not exist
      'rejected'           // Call rejected by respondent
    ],
    default: 'pending',
    index: true
  },
  
  // Interviewer assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Call information
  callRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CatiCall'
  },
  
  // Call attempt tracking
  callAttempts: [{
    attemptNumber: { type: Number, required: true },
    attemptedAt: { type: Date, default: Date.now },
    attemptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    callId: { type: String }, // DeepCall callId
    status: { type: String },
    reason: { type: String }, // Abandonment reason if applicable
    scheduledFor: { type: Date }, // If call_later, when to call again
    notes: { type: String }
  }],
  
  // Current call attempt number
  currentAttemptNumber: {
    type: Number,
    default: 0
  },
  
  // Response reference (if interview completed)
  response: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurveyResponse'
  },
  
  // Abandonment information
  abandonmentReason: {
    type: String,
    enum: [
      'call_later',
      'not_interested',
      'busy',
      'no_answer',
      'switched_off',
      'not_reachable',
      'does_not_exist',
      'rejected',
      'technical_issue',
      'consent_refused',
      'other'
    ]
  },
  abandonmentNotes: {
    type: String
  },
  callLaterDate: {
    type: Date // If abandonmentReason is 'call_later'
  },
  
  // Priority (for queue ordering)
  priority: {
    type: Number,
    default: 0 // Higher number = higher priority
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  assignedAt: {
    type: Date
  },
  lastAttemptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
catiRespondentQueueSchema.index({ survey: 1, status: 1 });
catiRespondentQueueSchema.index({ survey: 1, assignedTo: 1, status: 1 });
catiRespondentQueueSchema.index({ status: 1, priority: -1, createdAt: 1 }); // For queue ordering
catiRespondentQueueSchema.index({ 'respondentContact.phone': 1, survey: 1 }); // Prevent duplicates
// Optimized indexes for priority-based selection
catiRespondentQueueSchema.index({ survey: 1, status: 1, 'respondentContact.ac': 1 }); // For AC-based queries
catiRespondentQueueSchema.index({ survey: 1, status: 1, createdAt: 1 }); // For fallback queries

module.exports = mongoose.model('CatiRespondentQueue', catiRespondentQueueSchema);


