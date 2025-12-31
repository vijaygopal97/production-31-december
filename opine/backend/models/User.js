const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },

  // Member ID (for Interviewers and Quality Agents)
  memberId: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but ensure uniqueness when present
    trim: true,
    match: [/^[A-Za-z0-9]+$/, 'Member ID must contain only letters and numbers'], // Allow alphanumeric (e.g., "CATI004", "3585")
    index: true
  },

  // QA IDs (for Quality Agents)
  'QA-capi-ID': {
    type: String,
    trim: true,
    sparse: true
  },
  'QA-cati-ID': {
    type: String,
    trim: true,
    sparse: true
  },

  // Authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  phoneVerificationOTP: {
    type: String,
    select: false
  },
  otpExpires: {
    type: Date,
    select: false
  },

  // User Role and Company
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['super_admin', 'company_admin', 'project_manager', 'interviewer', 'quality_agent', 'Data_Analyst'],
    default: 'interviewer'
  },
  
  // Interview Mode Settings (for Interviewer users only)
  interviewModes: {
    type: String,
    enum: ['CAPI (Face To Face)', 'CATI (Telephonic interview)', 'Both'],
    default: 'Both'
  },
  canSelectMode: {
    type: Boolean,
    default: false
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function() {
      // Company is required for company_admin and project_manager
      // Optional for interviewer, quality_agent, and Data_Analyst (independent workers)
      return ['company_admin', 'project_manager'].includes(this.userType);
    }
  },
  companyCode: {
    type: String,
    required: function() {
      // Company code is required for company_admin and project_manager
      // Optional for interviewer, quality_agent, and Data_Analyst (independent workers)
      return ['company_admin', 'project_manager'].includes(this.userType);
    },
    trim: true,
    uppercase: true
  },

  // Assigned Team Members (for Project Managers)
  assignedTeamMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userType: {
      type: String,
      enum: ['interviewer', 'quality_agent'],
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Profile Information
  profile: {
    avatar: { type: String, trim: true },
    bio: { type: String, maxlength: [500, 'Bio cannot exceed 500 characters'] },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
      }
    },
    languages: [{
      language: { type: String, required: true },
      proficiency: { 
        type: String, 
        enum: ['beginner', 'intermediate', 'advanced', 'native'],
        default: 'intermediate'
      }
    }],
    education: [{
      degree: { type: String, trim: true },
      institution: { type: String, trim: true },
      year: { type: Number },
      field: { type: String, trim: true }
    }],
    experience: [{
      title: { type: String, trim: true },
      company: { type: String, trim: true },
      duration: { type: String, trim: true },
      description: { type: String, trim: true }
    }]
  },

  // KYC and Verification Documents
  documents: {
    aadhaar: {
      number: { type: String, trim: true },
      document: { type: String, trim: true },
      isVerified: { type: Boolean, default: false }
    },
    pan: {
      number: { type: String, trim: true },
      document: { type: String, trim: true },
      isVerified: { type: Boolean, default: false }
    },
    drivingLicense: {
      number: { type: String, trim: true },
      document: { type: String, trim: true },
      isVerified: { type: Boolean, default: false }
    },
    bankDetails: {
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      isVerified: { type: Boolean, default: false }
    }
  },

  // User Status and Permissions
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  gig_availability: {
    type: Boolean,
    default: false
  },
  gig_enabled: {
    type: Boolean,
    default: false,
    description: 'Admin-level flag to enable gig feature for this user. gig_availability can only be true if gig_enabled is true.'
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },

  // Performance Metrics (for Interviewers and Quality Agents)
  performance: {
    trustScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 1000
    },
    totalInterviews: { type: Number, default: 0 },
    approvedInterviews: { type: Number, default: 0 },
    rejectedInterviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalEarnings: { type: Number, default: 0 },
    qualityMetrics: {
      audioQuality: { type: Number, default: 0, min: 0, max: 100 },
      responseAccuracy: { type: Number, default: 0, min: 0, max: 100 },
      timeliness: { type: Number, default: 0, min: 0, max: 100 },
      professionalism: { type: Number, default: 0, min: 0, max: 100 }
    }
  },

  // Preferences and Settings
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      surveyAssignments: { type: Boolean, default: true },
      paymentUpdates: { type: Boolean, default: true },
      qualityFeedback: { type: Boolean, default: true }
    },
    workingHours: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' },
      workingDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
      timezone: { type: String, default: 'Asia/Kolkata' }
    },
    surveyPreferences: {
      maxDistance: { type: Number, default: 50 }, // in kilometers
      preferredLocations: [{ type: String }],
      minPayment: { type: Number, default: 0 },
      maxInterviewsPerDay: { type: Number, default: 10 }
    },
    // Location Control (Booster) - allows interviewer to bypass geofencing
    locationControlBooster: {
      type: Boolean,
      default: false
    }
  },

  // Registration and Approval
  registrationSource: {
    type: String,
    enum: ['direct', 'referral', 'job_portal', 'social_media', 'company_link', 'company_admin'],
    default: 'direct'
  },
  referralCode: { type: String, trim: true },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: { type: Date },
  rejectionReason: { type: String, trim: true },

  // Training and Certification
  training: {
    completedModules: [{
      moduleId: { type: String, required: true },
      moduleName: { type: String, required: true },
      completedAt: { type: Date, default: Date.now },
      score: { type: Number, min: 0, max: 100 }
    }],
    certificationStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'expired'],
      default: 'not_started'
    },
    certificationDate: { type: Date },
    certificationExpiry: { type: Date }
  },

  // Interviewer Profile Details (new section)
  interviewerProfile: {
    // Personal Details
    age: { type: Number, min: 18, max: 100 },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    languagesSpoken: [{ type: String }], // Array of language names
    highestDegree: {
      name: { type: String, trim: true },
      institution: { type: String, trim: true },
      year: { type: Number, min: 1950, max: new Date().getFullYear() }
    },
    
    // Survey Experience
    hasSurveyExperience: { type: Boolean },
    surveyExperienceYears: { type: Number, min: 0, max: 50 },
    surveyExperienceDescription: { type: String, trim: true },
    
    cvUpload: { type: String, trim: true }, // Path to uploaded CV file

    // Survey Requirements
    ownsSmartphone: { type: Boolean },
    smartphoneType: { type: String, enum: ['Android Only', 'IOS Only', 'Both'] },
    androidVersion: { type: String, trim: true },
    iosVersion: { type: String, trim: true },
    willingToTravel: { type: Boolean },
    hasVehicle: { type: Boolean },
    willingToRecordAudio: { type: Boolean },
    agreesToRemuneration: { type: Boolean },

    // Payment Details
    bankAccountNumber: { type: String, trim: true },
    bankAccountHolderName: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankIfscCode: { type: String, trim: true },
    bankDocumentUpload: { type: String, trim: true }, // Path to uploaded bank document

    // Verification Documents
    aadhaarNumber: { type: String, trim: true },
    aadhaarDocument: { type: String, trim: true }, // Path to uploaded Aadhaar document
    panNumber: { type: String, trim: true },
    panDocument: { type: String, trim: true }, // Path to uploaded PAN document
    passportPhoto: { type: String, trim: true }, // Path to uploaded passport photo

    // Agreements
    agreesToShareInfo: { type: Boolean },
    agreesToParticipateInSurvey: { type: Boolean },

    // Approval Status
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested', 'unverified'],
      default: 'pending'
    },
    approvalFeedback: { type: String, trim: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    lastSubmittedAt: { type: Date, default: Date.now }
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ company: 1, userType: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'performance.trustScore': -1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for approval rate
userSchema.virtual('approvalRate').get(function() {
  if (this.performance.totalInterviews === 0) return 0;
  return (this.performance.approvedInterviews / this.performance.totalInterviews) * 100;
});

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  const addr = this.profile.address;
  if (!addr) return '';
  
  const parts = [
    addr.street,
    addr.city,
    addr.state,
    addr.country,
    addr.postalCode
  ].filter(Boolean);
  
  return parts.join(', ');
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to increment login attempts
// DISABLED: Account locking has been removed - users can attempt login unlimited times
userSchema.methods.incLoginAttempts = function() {
  // Account locking disabled - this method now does nothing
  // Keeping method for backward compatibility but it won't lock accounts
  return Promise.resolve();
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Instance method to update trust score
userSchema.methods.updateTrustScore = function(interviewResult) {
  const { approved, quality, timeliness } = interviewResult;
  
  let scoreChange = 0;
  
  if (approved) {
    scoreChange += 10; // Base approval bonus
    if (quality >= 90) scoreChange += 5; // High quality bonus
    if (timeliness >= 90) scoreChange += 5; // Timeliness bonus
  } else {
    scoreChange -= 20; // Rejection penalty
  }
  
  // Update performance metrics
  this.performance.totalInterviews += 1;
  if (approved) {
    this.performance.approvedInterviews += 1;
  } else {
    this.performance.rejectedInterviews += 1;
  }
  
  // Update trust score with bounds
  this.performance.trustScore = Math.max(0, Math.min(1000, this.performance.trustScore + scoreChange));
  
  return this.save();
};

// Instance method to check if user can perform action
userSchema.methods.canPerformAction = function(action, resource) {
  // Super admin can do everything
  if (this.userType === 'super_admin') return true;
  
  // Company admin can manage their company
  if (this.userType === 'company_admin') {
    return ['manage_users', 'manage_surveys', 'view_analytics', 'manage_payments'].includes(action);
  }
  
  // Project manager can manage surveys
  if (this.userType === 'project_manager') {
    return ['create_surveys', 'manage_surveys', 'view_analytics'].includes(action);
  }
  
  // Interviewer can conduct interviews
  if (this.userType === 'interviewer') {
    return ['conduct_interviews', 'view_earnings'].includes(action);
  }
  
  // Quality agent can verify interviews
  if (this.userType === 'quality_agent') {
    return ['verify_interviews', 'view_quality_metrics'].includes(action);
  }
  
  // Data analyst can analyze data
  if (this.userType === 'Data_Analyst') {
    return ['analyze_data', 'view_analytics', 'create_reports'].includes(action);
  }
  
  return false;
};

// Static method to get user statistics
userSchema.statics.getStats = async function(companyId = null) {
  const matchStage = companyId ? { company: mongoose.Types.ObjectId(companyId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        superAdmins: { $sum: { $cond: [{ $eq: ['$userType', 'super_admin'] }, 1, 0] } },
        companyAdmins: { $sum: { $cond: [{ $eq: ['$userType', 'company_admin'] }, 1, 0] } },
        projectManagers: { $sum: { $cond: [{ $eq: ['$userType', 'project_manager'] }, 1, 0] } },
        interviewers: { $sum: { $cond: [{ $eq: ['$userType', 'interviewer'] }, 1, 0] } },
        qualityAgents: { $sum: { $cond: [{ $eq: ['$userType', 'quality_agent'] }, 1, 0] } },
        dataAnalysts: { $sum: { $cond: [{ $eq: ['$userType', 'Data_Analyst'] }, 1, 0] } },
        totalInterviews: { $sum: '$performance.totalInterviews' },
        totalEarnings: { $sum: '$performance.totalEarnings' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0, active: 0, pending: 0, suspended: 0,
    superAdmins: 0, companyAdmins: 0, projectManagers: 0, interviewers: 0, qualityAgents: 0, dataAnalysts: 0,
    totalInterviews: 0, totalEarnings: 0
  };
};

// Static method to find users by company and type
userSchema.statics.findByCompanyAndType = function(companyId, userType) {
  return this.find({ company: companyId, userType: userType, status: 'active' });
};

module.exports = mongoose.model('User', userSchema);
