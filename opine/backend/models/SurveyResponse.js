const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
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
        enum: ['1', '2', '3', '4', '7', '8']
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
      enum: ['1', '2', '3', '4', '7', '8']
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
  timestamps: true
});

// Indexes for better performance
surveyResponseSchema.index({ survey: 1, interviewer: 1 });
surveyResponseSchema.index({ sessionId: 1 });
surveyResponseSchema.index({ status: 1 });
surveyResponseSchema.index({ responseId: 1 });
surveyResponseSchema.index({ createdAt: -1 });
surveyResponseSchema.index({ survey: 1, status: 1 });
surveyResponseSchema.index({ contentHash: 1 }); // For duplicate detection

// Pre-save middleware to update timestamps
surveyResponseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Function to generate unique UUID response ID (same format as CATI)
const generateUniqueResponseId = async function(SurveyResponseModel) {
  // Use UUID format (same as CATI responses) for consistency
  // UUIDs are globally unique, so no need to check for duplicates
  return uuidv4();
};

/**
 * Generate content hash for duplicate detection (lightweight)
 * Hash based on: interviewer + survey + startTime (minute precision) + responses signature
 * This allows fast duplicate detection using indexed MongoDB queries
 */
function generateContentHash(interviewer, survey, startTime, responses) {
  // Normalize startTime to nearest minute (60s window for duplicates)
  const normalizedStartTime = new Date(startTime);
  normalizedStartTime.setSeconds(0, 0);
  normalizedStartTime.setMilliseconds(0);
  
  // Create a simple signature of responses (first 100 chars of sorted questionIds)
  // This is much faster than hashing full responses but still captures uniqueness
  const responseSignature = responses
    ? responses
        .map(r => r.questionId || '')
        .sort()
        .slice(0, 20) // First 20 questionIds should be unique enough
        .join('|')
    : '';
  
  const hashInput = `${interviewer.toString()}|${survey.toString()}|${normalizedStartTime.toISOString()}|${responses?.length || 0}|${responseSignature}`;
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
  
  console.log('createCompleteResponse received audioRecording:', audioRecording); // Debug log
  console.log('Audio file size:', audioRecording?.fileSize, 'bytes'); // Debug file size

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
  const contentHash = generateContentHash(interviewer, survey, startTime, responses);
  
  // Check for existing response with same content hash (fast indexed lookup - <20ms)
  const existingResponse = await this.findOne({ contentHash })
    .select('_id responseId sessionId audioRecording location selectedPollingStation status')
    .lean(); // Fast - only returns minimal fields, uses index
  
  if (existingResponse) {
    console.log(`⚠️ DUPLICATE DETECTED: Found existing response with same content hash: ${existingResponse.responseId}`);
    console.log(`   Existing sessionId: ${existingResponse.sessionId}, New sessionId: ${sessionId}`);
    console.log(`   ℹ️ Returning existing response instead of creating duplicate - app will mark as synced`);
    
    // Update existing response to ensure it has complete data (audio, GPS, etc.)
    const updateFields = {};
    
    // Update audio if new one exists and old one doesn't
    if (audioRecording && audioRecording.audioUrl && (!existingResponse.audioRecording || !existingResponse.audioRecording.audioUrl)) {
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

  const newResponse = new this({
    responseId,
    survey,
    interviewer,
    status: 'Pending_Approval', // Changed from 'completed' to 'Pending_Approval'
    sessionId,
    startTime,
    endTime,
    totalTimeSpent,
    responses,
    interviewMode,
    deviceInfo,
    audioRecording: audioRecording || {},
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
    contentHash // Store hash for future duplicate detection
  });
  
  return newResponse;
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