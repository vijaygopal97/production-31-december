const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  // Basic Company Information
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  companyCode: {
    type: String,
    required: [true, 'Company code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Company code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_]+$/, 'Company code can only contain uppercase letters, numbers, and underscores']
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
  },
  companySize: {
    type: String,
    enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
    required: [true, 'Company size is required']
  },

  // Contact Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid website URL']
  },

  // Address Information
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true }
  },

  // Business Information
  businessRegistration: {
    registrationNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    registrationDate: { type: Date }
  },

  // Company Branding
  branding: {
    logo: { type: String, trim: true },
    primaryColor: { type: String, default: '#3B82F6' },
    secondaryColor: { type: String, default: '#8B5CF6' },
    customDomain: { type: String, trim: true }
  },

  // Company Settings
  settings: {
    defaultCurrency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    language: { type: String, default: 'en' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
  },

  // Payment Configuration
  paymentConfig: {
    gateway: {
      type: String,
      enum: ['razorpay', 'cashfree', 'paypal', 'stripe', 'custom'],
      default: 'razorpay'
    },
    gatewayConfig: {
      apiKey: { type: String, trim: true },
      secretKey: { type: String, trim: true },
      webhookSecret: { type: String, trim: true },
      isTestMode: { type: Boolean, default: true }
    },
    payoutSchedule: {
      type: String,
      enum: ['daily', 'weekly', 'bi-weekly', 'monthly'],
      default: 'weekly'
    },
    payoutDay: { type: Number, min: 1, max: 31, default: 1 }
  },

  // Quality and Operational Settings
  qualitySettings: {
    defaultTrustScore: { type: Number, default: 100, min: 0, max: 1000 },
    minimumTrustScore: { type: Number, default: 50, min: 0, max: 1000 },
    autoApprovalThreshold: { type: Number, default: 800, min: 0, max: 1000 },
    callbackVerificationRate: { type: Number, default: 10, min: 0, max: 100 }
  },

  // Company Status and Verification
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive'],
    default: 'pending'
  },
  verificationStatus: {
    email: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
    documents: { type: Boolean, default: false },
    payment: { type: Boolean, default: false }
  },
  verificationNotes: { type: String, trim: true },

  // Subscription and Billing
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free'
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    features: [{
      name: { type: String, required: true },
      enabled: { type: Boolean, default: true },
      limit: { type: Number, default: -1 } // -1 means unlimited
    }]
  },

  // Statistics and Metrics
  stats: {
    totalUsers: { type: Number, default: 0 },
    totalSurveys: { type: Number, default: 0 },
    totalInterviews: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: { type: Date },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// companySchema.index({ companyCode: 1 });
companySchema.index({ email: 1 });
companySchema.index({ status: 1 });
companySchema.index({ createdAt: -1 });

// Virtual for full address
companySchema.virtual('fullAddress').get(function() {
  const addr = this.address;
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

// Virtual for company display name
companySchema.virtual('displayName').get(function() {
  return this.companyName || this.companyCode;
});

// Pre-save middleware
companySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate company code if not provided
  if (!this.companyCode && this.companyName) {
    this.companyCode = this.companyName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase()
      .substring(0, 20);
  }
  
  next();
});

// Static method to get company statistics
companySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        totalUsers: { $sum: '$stats.totalUsers' },
        totalSurveys: { $sum: '$stats.totalSurveys' },
        totalInterviews: { $sum: '$stats.totalInterviews' },
        totalRevenue: { $sum: '$stats.totalRevenue' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0, active: 0, pending: 0, suspended: 0,
    totalUsers: 0, totalSurveys: 0, totalInterviews: 0, totalRevenue: 0
  };
};

// Instance method to update statistics
companySchema.methods.updateStats = async function() {
  const User = mongoose.model('User');
  const Survey = mongoose.model('Survey');
  const Interview = mongoose.model('Interview');
  
  const [userCount, surveyCount, interviewCount] = await Promise.all([
    User.countDocuments({ company: this._id }),
    Survey.countDocuments({ company: this._id }),
    Interview.countDocuments({ company: this._id })
  ]);
  
  this.stats.totalUsers = userCount;
  this.stats.totalSurveys = surveyCount;
  this.stats.totalInterviews = interviewCount;
  this.stats.lastActivity = new Date();
  
  return this.save();
};

// Instance method to check if company is active
companySchema.methods.isActive = function() {
  return this.status === 'active' && this.subscription.isActive;
};

// Instance method to get subscription features
companySchema.methods.getFeature = function(featureName) {
  const feature = this.subscription.features.find(f => f.name === featureName);
  return feature || { name: featureName, enabled: false, limit: 0 };
};

module.exports = mongoose.model('Company', companySchema);
