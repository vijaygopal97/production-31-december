const mongoose = require('mongoose');
const crypto = require('crypto');

const surveyResponseSchema = new mongoose.Schema({
  // Unique Numerical ID for easy reference
  responseId: {
    type: String,
    unique: true,
    required: false, // Changed to false to handle existing documents
    index: true,
    sparse: true // This allows multiple null values
  },
  
  // Survey and Interviewer Information
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: [true, 'Survey reference is required']
  },
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Interviewer reference is required']
  },
  
  // Response Status
  status: {
    type: String,
    enum: ['Pending_Approval', 'Approved', 'Rejected', 'completed', 'abandoned', 'Terminated'],
    required: true,
    default: 'Pending_Approval'
  },
  
  // Interview Session Information
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  totalTimeSpent: {
    type: Number, // in seconds
    required: true
  },
  
  // Complete Response Data - Only saved when interview is finished
  responses: [{
    sectionIndex: {
      type: Number,
      required: true
    },
    questionIndex: {
      type: Number,
      required: true
    },
    questionId: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    questionDescription: {
      type: String
    },
    questionOptions: [{
      type: String
    }],
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    responseCodes: {
      type: mongoose.Schema.Types.Mixed, // Can be string, array, or null
      default: null
    },
    responseWithCodes: {
      type: mongoose.Schema.Types.Mixed, // Structured response with codes, answers, and optionText
      default: null
    },
    responseTime: {
      type: Number, // time taken to answer in seconds
      default: 0
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    isSkipped: {
      type: Boolean,
      default: false
    }
  }],
  
  // Interview Context
  interviewMode: {
    type: String,
    enum: ['capi', 'cati', 'online'],
    required: true
  },
  
  // Set Number (for surveys with sets - only used in CATI interviews)
  setNumber: {
    type: Number,
    default: null,
    required: false,
    index: { sparse: true },
    index: true,
    sparse: true // Allow null values but still index non-null values
  },
  
  // Old Interviewer ID (for survey 68fd1915d41841da463f0d46 - entered by interviewer)
  OldinterviewerID: {
    type: String,
    trim: true,
    default: null
  },
  
  // CATI Call ID (DeepCall callId) - for linking to CatiCall record
  call_id: {
    type: String,
    trim: true,
    index: true
  },
  
  // Known Call Status - Call status selected by interviewer in Call Status question (CATI only)
  // This is separate from metadata.callStatus for accurate stats calculation
  knownCallStatus: {
    type: String,
    trim: true,
    enum: ['call_connected', 'busy', 'switched_off', 'not_reachable', 'did_not_pick_up', 
           'number_does_not_exist', 'didnt_get_call', 'unknown'],
    default: null,
    index: true
  },
  
  // Consent Response - Consent form answer (yes/no) for easy filtering and reporting
  consentResponse: {
    type: String,
    trim: true,
    enum: ['yes', 'no', null],
    default: null,
    index: true
  },
  
  // Abandoned Reason - Reason for abandoning the interview (for both CAPI and CATI)
  abandonedReason: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  
  // Assembly Constituency Selection (for surveys with AC assignment)
  selectedAC: {
    type: String,
    trim: true
  },
  
  // Polling Station Selection (for surveys with AC assignment)
  selectedPollingStation: {
    state: { type: String, trim: true },
    acNo: { type: String, trim: true },
    acName: { type: String, trim: true },
    pcNo: { type: Number },
    pcName: { type: String, trim: true },
    district: { type: String, trim: true },
    groupName: { type: String, trim: true },
    stationName: { type: String, trim: true },
    gpsLocation: { type: String, trim: true }, // "lat,lng" format
    latitude: { type: Number },
    longitude: { type: Number }
  },
  
  // Location Information
  location: {
    latitude: {
      type: Number,
      required: false
    },
    longitude: {
      type: Number,
      required: false
    },
    accuracy: {
      type: Number,
      required: false
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String,
    screenResolution: String,
    timezone: String,
    ipAddress: String
  },
  
  // Completion Statistics
  totalQuestions: {
    type: Number,
    required: true
  },
  answeredQuestions: {
    type: Number,
    required: true
  },
  skippedQuestions: {
    type: Number,
    default: 0
  },
  completionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Quality Metrics
  qualityMetrics: {
    averageResponseTime: Number,
    totalPauses: {
      type: Number,
      default: 0
    },
    totalPauseTime: {
      type: Number,
      default: 0
    },
    backNavigationCount: {
      type: Number,
      default: 0
    },
    dataQualityScore: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  
  // Audio Recording Information
  audioRecording: {
    hasAudio: {
      type: Boolean,
      default: false
    },
    audioUrl: {
      type: String,
      default: null
    },
    recordingDuration: {
      type: Number, // in seconds
      default: 0
    },
    format: {
      type: String,
      default: 'webm'
    },
    codec: {
      type: String,
      default: 'opus'
    },
    bitrate: {
      type: Number,
      default: 32000
    },
    fileSize: {
      type: Number, // in bytes
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: null
    }
  },

  // Review Assignment (Queue-based assignment system)
  reviewAssignment: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    }
  },

  // Last Skipped Timestamp - Used to push skipped responses to end of queue
  lastSkippedAt: {
    type: Date,
    default: null,
    index: true
  },

  // Verification Data (for company admin review)
  verificationData: {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    criteria: {
      // New verification criteria fields
      audioStatus: {
        type: String,
        enum: ['1', '2', '3', '4', '7', '8', '9']
      },
      genderMatching: {
        type: String,
        enum: ['1', '2', '3']
      },
      upcomingElectionsMatching: {
        type: String,
        enum: ['1', '2', '3', '4']
      },
      previousElectionsMatching: {
        type: String,
        enum: ['1', '2', '3', '4']
      },
      previousLoksabhaElectionsMatching: {
        type: String,
        enum: ['1', '2', '3', '4']
      },
      nameMatching: {
        type: String,
        enum: ['1', '2', '3', '4']
      },
      ageMatching: {
        type: String,
        enum: ['1', '2', '3', '4']
      },
      phoneNumberAsked: {
        type: String,
        enum: ['1', '2', '3']
      },
      // Old fields (kept for backward compatibility)
      audioQuality: {
        type: Number,
        min: 1,
        max: 5
      },
      questionAccuracy: {
        type: String,
        enum: ['Yes', 'No']
      },
      dataAccuracy: {
        type: String,
        enum: ['Yes', 'No']
      },
      locationMatch: {
        type: String,
        enum: ['Yes', 'No']
      }
    },
    feedback: {
      type: String,
      default: ''
    },
    // New verification criteria fields
    audioStatus: {
      type: String,
      enum: ['1', '2', '3', '4', '7', '8', '9']
    },
    genderMatching: {
      type: String,
      enum: ['1', '2', '3']
    },
    upcomingElectionsMatching: {
      type: String,
      enum: ['1', '2', '3', '4']
    },
    previousElectionsMatching: {
      type: String,
      enum: ['1', '2', '3', '4']
    },
    previousLoksabhaElectionsMatching: {
      type: String,
      enum: ['1', '2', '3', '4']
    },
    nameMatching: {
      type: String,
      enum: ['1', '2', '3', '4']
    },
    ageMatching: {
      type: String,
      enum: ['1', '2', '3', '4']
    },
    phoneNumberAsked: {
      type: String,
      enum: ['1', '2', '3']
    },
    // Old fields (kept for backward compatibility)
    audioQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    questionAccuracy: {
      type: String,
      enum: ['Yes', 'No']
    },
    dataAccuracy: {
      type: String,
      enum: ['Yes', 'No']
    },
    locationMatch: {
      type: String,
      enum: ['Yes', 'No']
    }
  },

  // QC Batch reference (if response is part of a batch)
  qcBatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QCBatch',
    index: true
  },
  
  // QC Batch sample status (if response is in the 40% sample)
  isSampleResponse: {
    type: Boolean,
    default: false
  },
  
  // Auto-approved flag (for responses approved automatically based on batch approval rate)
  autoApproved: {
    type: Boolean,
    default: false
  },
  
  // Content Hash for duplicate detection (lightweight)
  contentHash: {
    type: String,
    sparse: true
  },
  
  // Metadata
  metadata: {
    surveyVersion: String,
    interviewerNotes: String,
    respondentFeedback: String,
    technicalIssues: [String],
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  // CRITICAL PERFORMANCE INDEXES: Optimize queries for responses-v2 page
  // These indexes prevent full collection scans and enable fast filtering
  indexes: [
    // Compound index for date filtering and pagination (most common query pattern)
    { survey: 1, startTime: -1, status: 1 },
    // Index for interviewer filtering
    { survey: 1, interviewer: 1, startTime: -1 },
    // Index for status filtering
    { survey: 1, status: 1, startTime: -1 },
    // Index on startTime for date range queries
    { startTime: -1 },
    // Index on survey for general queries
    { survey: 1 }
  ]
}, {
  timestamps: true
});

// Indexes for better performance
surveyResponseSchema.index({ survey: 1, interviewer: 1 });
surveyResponseSchema.index({ sessionId: 1 });
surveyResponseSchema.index({ status: 1 });
surveyResponseSchema.index({ responseId: 1 });
surveyResponseSchema.index({ createdAt: -1 });
surveyResponseSchema.index({ survey: 1, status: 1 });
// CRITICAL: Index on contentHash for duplicate detection
// Note: We use unique: true in schema definition, but handle violations gracefully in code
// This prevents race conditions where two requests check simultaneously before either is saved
surveyResponseSchema.index({ contentHash: 1 }, { unique: true, sparse: true }); // For duplicate detection

// Performance indexes for Quality Agent queries
surveyResponseSchema.index({ 'verificationData.reviewer': 1, status: 1 }); // For Quality Agent dashboard
surveyResponseSchema.index({ 'verificationData.reviewer': 1, 'verificationData.reviewedAt': -1 }); // For Quality Agent analytics
// TOP-TIER TECH COMPANY SOLUTION: Optimized compound index for QC Performance queries
surveyResponseSchema.index({ survey: 1, 'verificationData.reviewer': 1, 'verificationData.reviewedAt': 1, status: 1 }); // For QC Performance aggregates

// Performance indexes for getNextReviewAssignment
surveyResponseSchema.index({ status: 1, 'reviewAssignment.assignedTo': 1, 'reviewAssignment.expiresAt': 1 }); // For active assignment check
surveyResponseSchema.index({ status: 1, survey: 1, qcBatch: 1, isSampleResponse: 1, lastSkippedAt: 1, createdAt: 1 }); // For queue query
surveyResponseSchema.index({ status: 1, 'reviewAssignment': 1, qcBatch: 1 }); // Composite for queue filtering
// TOP-TIER TECH COMPANY SOLUTION: Optimized compound indexes for getNextReviewAssignment queries
surveyResponseSchema.index({ status: 1, interviewMode: 1, survey: 1, 'reviewAssignment.assignedTo': 1, 'reviewAssignment.expiresAt': 1 }); // For active assignment with interviewMode
surveyResponseSchema.index({ status: 1, interviewMode: 1, survey: 1, qcBatch: 1, isSampleResponse: 1, 'reviewAssignment.assignedTo': 1, createdAt: 1 }); // For queue query with interviewMode
// PERFORMANCE FIX: Index for interviewMode filtering (critical for CAPI/CATI separation)
surveyResponseSchema.index({ status: 1, interviewMode: 1, survey: 1, 'reviewAssignment.assignedTo': 1, 'reviewAssignment.expiresAt': 1 }); // For interviewMode + active assignment
surveyResponseSchema.index({ status: 1, interviewMode: 1, survey: 1, qcBatch: 1, isSampleResponse: 1, lastSkippedAt: 1, createdAt: 1 }); // For interviewMode + queue query

// CRITICAL PERFORMANCE INDEXES for responses-v2 endpoint
// These indexes dramatically improve query performance for filtered responses
surveyResponseSchema.index({ survey: 1, status: 1, startTime: -1 }); // For date filtering and sorting
surveyResponseSchema.index({ survey: 1, status: 1, interviewMode: 1, startTime: -1 }); // For interview mode + date filtering
surveyResponseSchema.index({ survey: 1, status: 1, interviewer: 1, startTime: -1 }); // For interviewer filtering
surveyResponseSchema.index({ survey: 1, status: 1, selectedAC: 1, startTime: -1 }); // For AC filtering
surveyResponseSchema.index({ survey: 1, status: 1, interviewMode: 1, interviewer: 1, startTime: -1 }); // Composite for common filter combinations

// Helper function to check if abandonedReason is valid and meaningful
const hasValidAbandonedReason = function(abandonedReason) {
  return abandonedReason && 
         typeof abandonedReason === 'string' &&
         abandonedReason.trim() !== '' &&
         abandonedReason !== 'No reason specified' &&
         abandonedReason.toLowerCase() !== 'null' &&
         abandonedReason.toLowerCase() !== 'undefined';
};

// Pre-validate middleware (runs before validation, earliest hook)
surveyResponseSchema.pre('validate', function(next) {
  // LAYER 4: CRITICAL PROTECTION - If abandonedReason exists, status MUST be "abandoned"
  // This runs before validation, ensuring data integrity at the schema level
  // Top tech companies use schema-level constraints for immutable state patterns
  if (hasValidAbandonedReason(this.abandonedReason) && this.status !== 'abandoned') {
    console.error(`🔒🔒🔒 LAYER 4 (PRE-VALIDATE): Response ${this.responseId || this._id} has abandonedReason '${this.abandonedReason}' but status is '${this.status}' - FORCING to 'abandoned'`);
    this.status = 'abandoned';
    
    // Ensure metadata flags are set
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.abandoned = true;
    if (!this.metadata.abandonedReason && this.abandonedReason) {
      this.metadata.abandonedReason = this.abandonedReason;
    }
  }
  
  next();
});

// Pre-save middleware to update timestamps and protect final statuses
surveyResponseSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  // LAYER 3: CRITICAL PROTECTION - If abandonedReason exists, status MUST be "abandoned"
  // This is a database-level constraint - prevents ANY code path from violating data integrity
  // Top tech companies use database-level constraints for immutable state patterns
  if (hasValidAbandonedReason(this.abandonedReason) && this.status !== 'abandoned') {
    console.error(`🔒🔒🔒 LAYER 3 (PRE-SAVE): Response ${this.responseId || this._id} has abandonedReason '${this.abandonedReason}' but status is '${this.status}' - FORCING to 'abandoned'`);
    this.status = 'abandoned';
    
    // Ensure metadata flags are set
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.abandoned = true;
    if (!this.metadata.abandonedReason && this.abandonedReason) {
      this.metadata.abandonedReason = this.abandonedReason;
    }
  }
  
  // CRITICAL: Database-level protection against final status overwrites
  // This is a last-line defense - prevents ANY code path from changing final statuses
  // Top tech companies use database-level constraints for data integrity
  if (this.isModified('status') && !this.isNew) {
    const finalStatuses = ['Terminated', 'abandoned', 'Rejected', 'Approved'];
    
    try {
      // Get the original status from the database
      const originalDoc = await this.constructor.findById(this._id).select('status abandonedReason').lean();
      
      if (originalDoc) {
        const originalStatus = originalDoc.status;
        const newStatus = this.status;
        const originalHasAbandonedReason = hasValidAbandonedReason(originalDoc.abandonedReason);
        
        // If original status is final and new status is different, PREVENT the change
        if (finalStatuses.includes(originalStatus) && newStatus !== originalStatus) {
          console.error(`🔒🔒🔒 DATABASE-LEVEL PROTECTION: Attempted to change final status '${originalStatus}' to '${newStatus}' - BLOCKED`);
          console.error(`🔒 ResponseId: ${this.responseId || this._id}, Original status: ${originalStatus}, Attempted status: ${newStatus}`);
          console.error(`🔒 This is a CRITICAL security violation - final statuses must NEVER be changed`);
          
          // Revert to original status
          this.status = originalStatus;
          
          // Log stack trace to identify the code path attempting the change
          console.error(`🔒 Stack trace:`, new Error().stack);
        }
        
        // CRITICAL: If original response had abandonedReason, status MUST remain "abandoned"
        if (originalHasAbandonedReason && newStatus !== 'abandoned') {
          console.error(`🔒🔒🔒 DATABASE-LEVEL PROTECTION: Original response has abandonedReason '${originalDoc.abandonedReason}' but new status is '${newStatus}' - FORCING to 'abandoned'`);
          this.status = 'abandoned';
        }
      }
    } catch (error) {
      console.error('Error in pre-save hook status protection:', error);
      // Continue with save even if check fails (don't block the save)
    }
  }
  
  next();
});

// Function to generate unique UUID response ID (same format as CATI)
const generateUniqueResponseId = async function(SurveyResponseModel) {
  // Use UUID format (same as CATI responses) for consistency
  // UUIDs are globally unique, so no need to check for duplicates
  // Use crypto.randomUUID() which is built into Node.js 14.17.0+ (no external package needed)
  return crypto.randomUUID();
};

/**
 * Generate content hash for duplicate detection (lightweight)
 * Hash based on: survey + startTime (exact) + endTime (exact) + totalTimeSpent + responses signature
 * 
 * CAPI: Also includes GPS coordinates (audio NOT included - audio can be missing or have different file sizes)
 * CATI: Also includes call_id
 * 
 * NOTE: Audio is NOT included in hash because:
 * - Audio fileSize may not be captured reliably during upload
 * - Audio URL can change on re-upload
 * - Audio should not prevent duplicate detection if all other data matches
 * 
 * This matches the duplicate detection rules in findAndMarkDuplicates.js
 */
function generateContentHash(interviewer, survey, startTime, responses, options = {}) {
  const {
    interviewMode = null,
    location = null,
    call_id = null,
    endTime = null,
    totalTimeSpent = null
  } = options;
  
  // CRITICAL: Normalize startTime and endTime to exact milliseconds (no normalization)
  // We want EXACT matches for duplicate detection
  const startTimeMs = startTime ? new Date(startTime).getTime() : 0;
  const endTimeMs = endTime ? new Date(endTime).getTime() : 0;
  const totalTimeSpentValue = totalTimeSpent !== null && totalTimeSpent !== undefined ? Math.floor(totalTimeSpent) : 0;
  
  // Normalize responses by questionId (order doesn't matter)
  // Create a hash of all responses content (not just questionIds)
  let responseSignature = '';
  if (responses && Array.isArray(responses) && responses.length > 0) {
    // Sort by questionId to normalize order
    const normalizedResponses = responses
      .map(r => ({
        questionId: r.questionId || '',
        response: r.response !== null && r.response !== undefined ? JSON.stringify(r.response) : ''
      }))
      .sort((a, b) => a.questionId.localeCompare(b.questionId));
    
    // Create signature from all responses (questionId:response pairs)
    responseSignature = normalizedResponses
      .map(r => `${r.questionId}:${r.response}`)
      .join('|');
  }
  
  // CATI-specific: ONLY use call_id for duplicate detection
  // For CATI, call_id is the unique identifier - same call_id = same interview
  if (interviewMode === 'cati' || interviewMode === 'CATI') {
    const callId = (call_id || '').toString().trim();
    // CATI hash = survey|call_id (only call_id matters for duplicates)
    let hashInput = `${survey.toString()}|call_id:${callId}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }
  
  // CAPI-specific: Use startTime, endTime, duration, and responses (NO GPS)
  // Base hash components (EXCLUDING interviewer - interviewers can be different)
  // Use survey, startTime (exact), endTime (exact), totalTimeSpent (exact), responses (normalized)
  // NOTE: Audio is NOT included - audio fileSize can be unreliable and should not affect duplicate detection
  // NOTE: GPS is NOT included - only startTime, endTime, duration, and responses matter
  // This matches the original hash generation logic used for existing responses
  // CAPI hash = survey|startTime|endTime|duration|responsesCount|responseSignature
  let hashInput = `${survey.toString()}|${startTimeMs}|${endTimeMs}|${totalTimeSpentValue}|${responses?.length || 0}|${responseSignature}`;
  
  return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16); // 16 char hash = fast
}

// Export generateContentHash as static method for use in controllers
surveyResponseSchema.statics.generateContentHash = generateContentHash;

// Static method to create a complete survey response
surveyResponseSchema.statics.createCompleteResponse = async function(data) {
  const {
    survey,
    interviewer,
    sessionId,
    startTime,
    endTime,
    responses,
    interviewMode,
    deviceInfo,
    audioRecording,
    qualityMetrics,
    metadata,
    selectedAC,
    selectedPollingStation,
    location,
    setNumber,
    OldinterviewerID
  } = data;
  
  // CRITICAL FIX: Only create audioRecording object if audio actually exists
  // Prevent creating empty audioRecording objects that cause data loss confusion
  // Top tech companies (Meta, WhatsApp) only store data that actually exists
  let finalAudioRecording = null;
  if (audioRecording && (
    (audioRecording.audioUrl && audioRecording.audioUrl.trim() !== '') ||
    (audioRecording.hasAudio === true && audioRecording.fileSize > 0)
  )) {
    // Audio exists - use it
    finalAudioRecording = audioRecording;
    console.log('createCompleteResponse received audioRecording with audio:', {
      hasAudio: audioRecording.hasAudio,
      audioUrl: audioRecording.audioUrl ? 'SET' : 'MISSING',
      fileSize: audioRecording.fileSize || 0,
      format: audioRecording.format || 'unknown'
    });
  } else {
    // No valid audio - set to null (don't create empty object)
    finalAudioRecording = null;
    console.log('createCompleteResponse: No valid audioRecording provided - setting to null (no empty object)');
  }

  // Calculate statistics
  const totalQuestions = responses.length;
  const answeredQuestions = responses.filter(r => !r.isSkipped && r.response !== null && r.response !== undefined && r.response !== '').length;
  const skippedQuestions = responses.filter(r => r.isSkipped).length;
  const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  
  // CRITICAL: Use totalTimeSpent from data if provided (for offline synced interviews)
  // Otherwise calculate from startTime and endTime (for online interviews)
  let totalTimeSpent;
  if (data.totalTimeSpent !== null && data.totalTimeSpent !== undefined) {
    // Use provided totalTimeSpent (for offline synced interviews)
    totalTimeSpent = Math.round(Number(data.totalTimeSpent));
    console.log(`✅ Using totalTimeSpent from data: ${totalTimeSpent} seconds (${Math.floor(totalTimeSpent / 60)} minutes)`);
  } else {
    // Calculate from timestamps (for online interviews)
    totalTimeSpent = Math.round((endTime - startTime) / 1000); // Convert to seconds
    console.log(`✅ Calculated totalTimeSpent from timestamps: ${totalTimeSpent} seconds (${Math.floor(totalTimeSpent / 60)} minutes)`);
  }

    // LIGHTWEIGHT DUPLICATE DETECTION: Generate content hash
    // Include mode-specific fields: audio/GPS for CAPI, call_id for CATI
    // EXCLUDE interviewer - same interview can be synced by different users
    // Use endTime and totalTimeSpent for exact matching
    // CRITICAL: Use finalAudioRecording (validated) for hash generation
    const contentHash = generateContentHash(interviewer, survey, startTime, responses, {
      interviewMode: interviewMode,
      audioRecording: finalAudioRecording, // Use validated audioRecording
      location: location,
      call_id: null, // CAPI doesn't have call_id (it's passed via createCompleteResponse)
      endTime: endTime,
      totalTimeSpent: data.totalTimeSpent || null
    });
  
  // Check for existing response with same content hash (fast indexed lookup - <20ms)
  const existingResponse = await this.findOne({ contentHash })
    .select('_id responseId sessionId audioRecording location selectedPollingStation status')
    .lean(); // Fast - only returns minimal fields, uses index
  
  if (existingResponse) {
    console.log(`⚠️ DUPLICATE DETECTED: Found existing response with same content hash: ${existingResponse.responseId}`);
    console.log(`   Existing sessionId: ${existingResponse.sessionId}, New sessionId: ${sessionId}`);
    console.log(`   Existing status: ${existingResponse.status}`);
    
    // CRITICAL FIX: Preserve ALL final statuses - don't update or modify if status is final
    // Final statuses: abandoned, Terminated, Approved, Rejected, Pending_Approval
    // These should NEVER be changed by retries from the app
    const existingStatus = existingResponse.status;
    const isFinalStatus = ['abandoned', 'Terminated', 'Approved', 'Rejected', 'Pending_Approval'].includes(existingStatus);
    
    if (isFinalStatus) {
      console.log(`🔒 PRESERVING FINAL STATUS: Existing response has status '${existingStatus}' - returning without ANY modification`);
      // Return existing response without ANY updates - preserve final status completely
      const existingDoc = await this.findById(existingResponse._id);
      if (existingDoc) {
        console.log(`✅ Returning existing response ${existingDoc.responseId} with preserved status '${existingDoc.status}' (NO UPDATES)`);
        return existingDoc;
      }
      throw new Error(`Failed to retrieve existing response ${existingResponse._id} after duplicate detection`);
    }
    
    console.log(`   ℹ️ Returning existing response instead of creating duplicate - app will mark as synced`);
    
    // Update existing response to ensure it has complete data (audio, GPS, etc.)
    // Only update if status is NOT a final status (already checked above)
    const updateFields = {};
    
    // Update audio if new one exists and old one doesn't
    // CRITICAL: Only update if new audio is valid (has audioUrl or hasAudio=true with fileSize>0)
    if (audioRecording && (
      (audioRecording.audioUrl && audioRecording.audioUrl.trim() !== '') ||
      (audioRecording.hasAudio === true && audioRecording.fileSize > 0)
    ) && (!existingResponse.audioRecording || !existingResponse.audioRecording.audioUrl)) {
      updateFields['audioRecording'] = audioRecording;
      console.log(`   ✅ Updating audio recording in existing response`);
    }
    
    // Update location if new one exists and old one doesn't
    if (location && location.latitude && (!existingResponse.location || !existingResponse.location.latitude)) {
      updateFields['location'] = location;
      console.log(`   ✅ Updating location in existing response`);
    }
    
    // Update polling station if new one exists and old one doesn't
    if (selectedPollingStation && (!existingResponse.selectedPollingStation)) {
      updateFields['selectedPollingStation'] = selectedPollingStation;
      console.log(`   ✅ Updating polling station in existing response`);
    }
    
    // Only update if there are fields to update
    if (Object.keys(updateFields).length > 0) {
      await this.findByIdAndUpdate(existingResponse._id, { $set: updateFields });
      console.log(`✅ Updated existing response ${existingResponse.responseId} with missing data`);
    }
    
    // Return existing response (don't create duplicate)
    // CRITICAL: Return a Mongoose document instance with all fields populated
    // The app expects: result.response._id, result.response.responseId, result.response.mongoId
    // Our existing response has all these fields, so it will work correctly
    const existingDoc = await this.findById(existingResponse._id);
    if (existingDoc) {
      // Ensure the document has all required fields for the API response
      // The controller will use: surveyResponse.responseId and surveyResponse._id
      // Both are present on the existing document, so the app will receive:
      // { success: true, data: { responseId: ..., mongoId: ..., ... } }
      // This will make the app think it's a successful new submission and mark as synced
      console.log(`✅ Returning existing response ${existingDoc.responseId} - app will treat as successful sync`);
      return existingDoc;
    }
    
    // Fallback: if findById fails, throw error (shouldn't happen)
    throw new Error(`Failed to retrieve existing response ${existingResponse._id} after duplicate detection`);
  }
  
  // No duplicate found - create new response
  // Generate unique response ID
  const responseId = await generateUniqueResponseId(this);

  // CRITICAL: Detect abandoned interviews from offline sync
  // Check metadata for abandoned indicators BEFORE setting status
  let initialStatus = 'Pending_Approval'; // Default status
  let abandonedReason = null;
  let knownCallStatus = null;
  
  // Check for abandoned indicators in metadata (for offline sync)
  const hasAbandonedReason = metadata?.abandonedReason !== null && 
                              metadata?.abandonedReason !== undefined && 
                              metadata?.abandonedReason !== '';
  const isMetadataAbandoned = metadata?.abandoned === true || 
                              metadata?.abandoned === 'true' ||
                              hasAbandonedReason;
  
  // For CATI: Check call status and abandoned indicators
  if (interviewMode === 'cati' || interviewMode === 'CATI') {
    const callStatus = metadata?.callStatus || metadata?.knownCallStatus;
    const isCatiAbandoned = isMetadataAbandoned ||
                            (callStatus && 
                             callStatus !== 'call_connected' && 
                             callStatus !== 'success' &&
                             callStatus !== null &&
                             callStatus !== undefined);
    
    if (isCatiAbandoned) {
      initialStatus = 'abandoned';
      abandonedReason = metadata?.abandonedReason || null;
      knownCallStatus = callStatus || null;
      console.log(`🚫 CATI Abandon Detected: Setting status to 'abandoned' for sessionId: ${sessionId}`);
      console.log(`   Abandoned reason: ${abandonedReason || 'none'}, Call status: ${knownCallStatus || 'none'}`);
    }
  }
  
  // For CAPI: Check abandoned indicators
  if (interviewMode === 'capi' || interviewMode === 'CAPI') {
    if (isMetadataAbandoned) {
      initialStatus = 'abandoned';
      abandonedReason = metadata?.abandonedReason || null;
      console.log(`🚫 CAPI Abandon Detected: Setting status to 'abandoned' for sessionId: ${sessionId}`);
      console.log(`   Abandoned reason: ${abandonedReason || 'none'}`);
    }
  }

  // CRITICAL: Try to create new response, but catch unique index violation (duplicate contentHash)
  // This handles race conditions where two requests check simultaneously before either is saved
  let newResponse;
  try {
    newResponse = new this({
      responseId,
      survey,
      interviewer,
      status: initialStatus, // Use detected status (abandoned or Pending_Approval)
      sessionId,
      startTime,
      endTime,
      totalTimeSpent,
      responses,
      interviewMode,
      deviceInfo,
      audioRecording: finalAudioRecording, // Use validated audioRecording (null if no valid audio)
      selectedAC: selectedAC || null,
      selectedPollingStation: selectedPollingStation || null,
      location: location || null,
      setNumber: setNumber || null, // Save set number for CATI interviews
      OldinterviewerID: OldinterviewerID || null, // Save old interviewer ID if provided
      totalQuestions,
      answeredQuestions,
      skippedQuestions,
      completionPercentage,
      qualityMetrics,
      metadata,
      contentHash, // Store hash for future duplicate detection
      abandonedReason: abandonedReason, // Store abandonment reason if detected
      knownCallStatus: knownCallStatus // Store call status for CATI if detected
    });
    
    // Try to save - this will throw if contentHash already exists (unique index violation)
    await newResponse.save();
    return newResponse;
  } catch (error) {
    // Check if this is a unique index violation (duplicate contentHash)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.contentHash) {
      console.log(`⚠️ DUPLICATE DETECTED (Unique Index): ContentHash already exists - ${contentHash}`);
      console.log(`   Attempted to create response with sessionId: ${sessionId}`);
      
      // Find the existing response with this contentHash
      const existingResponse = await this.findOne({ contentHash })
        .select('_id responseId sessionId status')
        .lean();
      
      if (existingResponse) {
        console.log(`   Found existing response: ${existingResponse.responseId}, status: ${existingResponse.status}`);
        
        // Return existing response (same logic as earlier duplicate check)
        const existingDoc = await this.findById(existingResponse._id);
        if (existingDoc) {
          console.log(`✅ Returning existing response ${existingDoc.responseId} (prevented duplicate via unique index)`);
          return existingDoc;
        }
      }
      
      // If we can't find the existing response, throw the original error
      throw new Error(`Duplicate contentHash detected but could not retrieve existing response: ${error.message}`);
    }
    
    // If it's not a duplicate error, re-throw it
    throw error;
  }
};

// Instance method to get response summary
surveyResponseSchema.methods.getResponseSummary = function() {
  return {
    responseId: this.responseId,
    sessionId: this.sessionId,
    status: this.status,
    totalQuestions: this.totalQuestions,
    answeredQuestions: this.answeredQuestions,
    skippedQuestions: this.skippedQuestions,
    completionPercentage: this.completionPercentage,
    totalTimeSpent: this.totalTimeSpent,
    startTime: this.startTime,
    endTime: this.endTime,
    interviewMode: this.interviewMode
  };
};

// Instance method to get responses by section
surveyResponseSchema.methods.getResponsesBySection = function() {
  const sections = {};
  this.responses.forEach(response => {
    if (!sections[response.sectionIndex]) {
      sections[response.sectionIndex] = [];
    }
    sections[response.sectionIndex].push(response);
  });
  return sections;
};

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);