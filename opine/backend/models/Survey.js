const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  // Basic Survey Information
  surveyName: {
    type: String,
    required: [true, 'Survey name is required'],
    trim: true,
    maxlength: [200, 'Survey name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Survey description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Survey category is required'],
    enum: ['Consumer Research', 'Market Analysis', 'Brand Awareness', 'Product Testing', 'Customer Satisfaction', 'Employee Feedback', 'Healthcare Research', 'Education Research', 'Social Research', 'Political Research', 'Other'],
    default: 'Consumer Research'
  },
  purpose: {
    type: String,
    required: [true, 'Survey purpose is required'],
    trim: true,
    maxlength: [500, 'Purpose cannot exceed 500 characters']
  },

  // Survey Mode and Configuration
  mode: {
    type: String,
    required: [true, 'Survey mode is required'],
    enum: ['online', 'capi', 'cati', 'ai_telephonic', 'online_interview', 'multi_mode'],
    default: 'online'
  },
  // Multi-mode support for CAPI + CATI combination
  modes: [{
    type: String,
    enum: ['capi', 'cati'],
    required: function() {
      return this.mode === 'multi_mode';
    }
  }],
  // Percentage allocation for multi-mode surveys
  modeAllocation: {
    capi: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    cati: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  // Mode-specific quotas for multi-mode surveys
  modeQuotas: {
    capi: {
      type: Number,
      min: 0,
      default: null // null means unlimited
    },
    cati: {
      type: Number,
      min: 0,
      default: null // null means unlimited
    }
  },
  // Gig worker inclusion flags for CAPI and CATI modes
  includeGigWorkers: {
    type: Boolean,
    default: false
  },
  // Mode-specific gig worker inclusion settings
  modeGigWorkers: {
    capi: {
      type: Boolean,
      default: false
    },
    cati: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },

  // AC Assignment Configuration
  assignACs: {
    type: Boolean,
    default: false
  },
  acAssignmentCountry: {
    type: String,
    trim: true
  },
  acAssignmentState: {
    type: String,
    trim: true
  },

  // Timeline and Scheduling
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  actualStartDate: {
    type: Date
  },
  actualEndDate: {
    type: Date
  },

  // Sample and Target Information
  sampleSize: {
    type: Number,
    required: [true, 'Sample size is required'],
    min: [1, 'Sample size must be at least 1'],
    max: [10000000, 'Sample size cannot exceed 10,000,000']
  },
  targetAudience: {
    // Selected categories (boolean flags)
    demographics: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    geographic: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    behavioral: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    psychographic: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    custom: {
      type: String,
      default: ''
    },
    quotaManagement: {
      type: Boolean,
      default: false
    }
  },

  // Cost and Payment Information
  costPerInterview: {
    type: Number,
    required: false,
    min: [0, 'Cost cannot be negative']
  },
  totalBudget: {
    type: Number,
    min: [0, 'Total budget cannot be negative']
  },
  costSlabs: [{
    minInterviews: { type: Number },
    maxInterviews: { type: Number },
    costPerInterview: { type: Number }
  }],
  thresholdInterviewsPerDay: {
    type: Number,
    min: [1, 'Threshold must be at least 1']
  },
  maxInterviewsPerInterviewer: {
    type: Number,
    min: [1, 'Max interviews must be at least 1']
  },

  // Online Survey Configuration
  onlineContactMode: [{
    type: String,
    enum: ['email', 'whatsapp', 'sms', 'phone']
  }],
  contactList: [{
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    whatsapp: { type: String },
    customFields: mongoose.Schema.Types.Mixed
  }],

  // Interviewer Assignment (Legacy - for single mode surveys)
  assignedInterviewers: [{
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Mode-specific assignment (for multi-mode surveys)
    assignedMode: {
      type: String,
      enum: ['capi', 'cati'],
      required: function() {
        return this.parent().mode === 'multi_mode';
      }
    },
    assignedACs: [{
      type: String,
      trim: true
    }],
    selectedState: {
      type: String,
      trim: true
    },
    selectedCountry: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'declined', 'rejected', 'completed'],
      default: 'assigned'
    },
    maxInterviews: {
      type: Number,
      default: 0
    },
    completedInterviews: {
      type: Number,
      default: 0
    }
  }],

  // Mode-Specific Interviewer Assignments (for multi-mode surveys)
  capiInterviewers: [{
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedACs: [{
      type: String,
      trim: true
    }],
    selectedState: {
      type: String,
      trim: true
    },
    selectedCountry: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'declined', 'rejected', 'completed'],
      default: 'assigned'
    },
    maxInterviews: {
      type: Number,
      default: 0
    },
    completedInterviews: {
      type: Number,
      default: 0
    }
  }],

  catiInterviewers: [{
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedACs: [{
      type: String,
      trim: true
    }],
    selectedState: {
      type: String,
      trim: true
    },
    selectedCountry: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'declined', 'rejected', 'completed'],
      default: 'assigned'
    },
    maxInterviews: {
      type: Number,
      default: 0
    },
    completedInterviews: {
      type: Number,
      default: 0
    }
  }],

  // Quality Agent Assignment
  assignedQualityAgents: [{
    qualityAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedACs: [{
      type: String,
      trim: true
    }],
    selectedState: {
      type: String,
      trim: true
    },
    selectedCountry: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['assigned', 'active', 'inactive'],
      default: 'assigned'
    }
  }],

  // Survey Questions and Structure
  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    order: { type: Number, default: 0 },
    questions: [{
      id: { type: String, required: true },
      type: {
        type: String,
        enum: ['text', 'textarea', 'numeric', 'multiple_choice', 'single_choice', 'single_select', 'rating', 'rating_scale', 'yes_no', 'file_upload', 'date', 'dropdown'],
        required: true
      },
      text: { type: String, required: true },
      description: { type: String },
      required: { type: Boolean, default: false },
      order: { type: Number, default: 0 },
      questionNumber: { type: String, default: null }, // Custom question number (e.g., "1", "2", "1.a", "1.b")
      options: [{
        id: { type: String, required: true },
        text: { type: String, required: true },
        value: { type: String, required: true },
        code: { type: String, default: null } // Option code (default: 1,2,3,4...)
      }],
      scale: {
        min: { type: Number },
        max: { type: Number },
        minLabel: { type: String },
        maxLabel: { type: String },
        labels: [{ type: String }] // Array of labels for each point
      },
      conditions: [{
        questionId: { type: String, required: true },
        operator: { 
          type: String, 
          enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty', 'is_selected', 'is_not_selected'] 
        },
        value: { type: String, required: true },
        logic: { type: String, enum: ['AND', 'OR'], default: 'AND' }
      }],
      validation: {
        minLength: { type: Number },
        maxLength: { type: Number },
        minValue: { type: Number },
        maxValue: { type: Number },
        pattern: { type: String }
      },
      settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      isFixed: { type: Boolean, default: false },
      isLocked: { type: Boolean, default: false },
      // CAPI/CATI visibility settings
      enabledForCAPI: { type: Boolean, default: true }, // Default: enabled for CAPI
      enabledForCATI: { type: Boolean, default: true }, // Default: enabled for CATI
      setsForThisQuestion: { type: Boolean, default: false }, // If true, question belongs to a set
      setNumber: { type: Number, default: null } // Set number (1, 2, 3, etc.) - null means question appears in all surveys
    }]
  }],

  // Direct Questions (not in sections)
  questions: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'multiple_choice', 'single_choice', 'single_select', 'rating', 'rating_scale', 'yes_no', 'file_upload', 'date', 'dropdown'],
      required: true
    },
    text: { type: String, required: true },
    description: { type: String },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    options: [{
      id: { type: String, required: true },
      text: { type: String, required: true },
      value: { type: String, required: true }
    }],
    scale: {
      min: { type: Number },
      max: { type: Number },
      minLabel: { type: String },
      maxLabel: { type: String },
      labels: [{ type: String }] // Array of labels for each point
    },
    conditions: [{
      questionId: { type: String, required: true },
      operator: { 
        type: String, 
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty', 'is_selected', 'is_not_selected'] 
      },
      value: { type: String, required: true },
      logic: { type: String, enum: ['AND', 'OR'], default: 'AND' }
    }],
    validation: {
      minLength: { type: Number },
      maxLength: { type: Number },
      minValue: { type: Number },
      maxValue: { type: Number },
      pattern: { type: String }
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],

  // Template Information
  templateUsed: {
    templateId: { type: String },
    templateName: { type: String },
    templateCategory: { type: String }
  },

  // CATI Respondent Contacts (for CATI interviews)
  respondentContacts: {
    type: [{
      name: { type: String, required: true },
      countryCode: { type: String }, // Optional country code (e.g., "91" for India)
      phone: { type: String, required: true },
      email: { type: String },
      address: { type: String },
      city: { type: String },
      ac: { type: String }, // Assembly Constituency
      pc: { type: String }, // Parliamentary Constituency
      ps: { type: String }, // Polling Station
      addedAt: { type: Date, default: Date.now },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    default: []
  },

  // Company and Ownership
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Survey Results and Analytics
  responses: [{
    respondentId: { type: String, required: true },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedAt: { type: Date, default: Date.now },
    responses: [{
      questionId: { type: String, required: true },
      answer: mongoose.Schema.Types.Mixed,
      submittedAt: { type: Date, default: Date.now }
    }],
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress'
    },
    qualityScore: { type: Number, min: 0, max: 100 },
    duration: { type: Number }, // in minutes
    deviceInfo: {
      userAgent: { type: String },
      platform: { type: String },
      browser: { type: String }
    }
  }],

  // Analytics and Metrics
  analytics: {
    totalResponses: { type: Number, default: 0 },
    completedResponses: { type: Number, default: 0 },
    abandonedResponses: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 },
    averageQualityScore: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },

  // Settings and Configuration
  settings: {
    allowAnonymous: { type: Boolean, default: false },
    requireAuthentication: { type: Boolean, default: true },
    allowMultipleResponses: { type: Boolean, default: false },
    showProgress: { type: Boolean, default: true },
    randomizeQuestions: { type: Boolean, default: false },
    randomizeOptions: { type: Boolean, default: false },
    timeLimit: { type: Number }, // in minutes
    maxAttempts: { type: Number, default: 1 }
  },

  // Notifications and Communication
  notifications: {
    emailReminders: { type: Boolean, default: true },
    smsReminders: { type: Boolean, default: false },
    whatsappReminders: { type: Boolean, default: false },
    reminderFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'bi_weekly', 'monthly'],
      default: 'weekly'
    }
  },

  // Sets configuration
  sets: [{ type: String }],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
surveySchema.index({ company: 1, status: 1 });
surveySchema.index({ createdBy: 1, status: 1 });
surveySchema.index({ mode: 1, status: 1 });
surveySchema.index({ startDate: 1, deadline: 1 });
surveySchema.index({ 'assignedInterviewers.interviewer': 1 });
surveySchema.index({ 'assignedQualityAgents.qualityAgent': 1 });
surveySchema.index({ createdAt: -1 });

// Virtual for completion percentage
surveySchema.virtual('completionPercentage').get(function() {
  if (this.analytics.totalResponses === 0) return 0;
  return (this.analytics.completedResponses / this.analytics.totalResponses) * 100;
});

// Virtual for days remaining
surveySchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for total cost
surveySchema.virtual('totalCost').get(function() {
  return this.costPerInterview * this.sampleSize;
});

// Pre-save middleware to update timestamps
surveySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total budget if not set
  if (!this.totalBudget) {
    this.totalBudget = this.costPerInterview * this.sampleSize;
  }
  
  next();
});

// Instance method to add response
surveySchema.methods.addResponse = function(responseData) {
  this.responses.push(responseData);
  this.analytics.totalResponses += 1;
  
  if (responseData.status === 'completed') {
    this.analytics.completedResponses += 1;
  } else if (responseData.status === 'abandoned') {
    this.analytics.abandonedResponses += 1;
  }
  
  // Update completion rate
  this.analytics.completionRate = (this.analytics.completedResponses / this.analytics.totalResponses) * 100;
  
  return this.save();
};

// Instance method to assign interviewer
surveySchema.methods.assignInterviewer = function(interviewerId, assignedBy, maxInterviews = 0) {
  const assignment = {
    interviewer: interviewerId,
    assignedBy: assignedBy,
    maxInterviews: maxInterviews,
    status: 'assigned'
  };
  
  this.assignedInterviewers.push(assignment);
  return this.save();
};

// Instance method to update interviewer status
surveySchema.methods.updateInterviewerStatus = function(interviewerId, status) {
  const assignment = this.assignedInterviewers.find(a => a.interviewer.toString() === interviewerId.toString());
  if (assignment) {
    assignment.status = status;
    return this.save();
  }
  throw new Error('Interviewer assignment not found');
};

// Static method to get survey statistics
surveySchema.statics.getStats = async function(companyId = null) {
  const matchStage = companyId ? { company: companyId } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalResponses: { $sum: '$analytics.totalResponses' },
        totalBudget: { $sum: '$totalBudget' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0, draft: 0, active: 0, paused: 0, completed: 0, cancelled: 0,
    totalResponses: 0, totalBudget: 0
  };
};

// Static method to find surveys by company
surveySchema.statics.findByCompany = function(companyId, status = null) {
  const query = { company: companyId };
  if (status) {
    query.status = status;
  }
  return this.find(query).populate('createdBy', 'firstName lastName email').sort({ createdAt: -1 });
};

module.exports = mongoose.model('Survey', surveySchema);
