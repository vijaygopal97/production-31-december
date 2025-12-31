const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Personal Information
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

  // Company Information
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  industry: {
    type: String,
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
  },

  // Contact Details
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  inquiryType: {
    type: String,
    required: [true, 'Inquiry type is required'],
    enum: {
      values: ['general', 'partnership', 'support', 'sales', 'media', 'careers'],
      message: 'Invalid inquiry type'
    },
    default: 'general'
  },

  // Status and Priority
  status: {
    type: String,
    enum: ['new', 'in_progress', 'responded', 'closed'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Response Information
  response: {
    type: String,
    trim: true,
    maxlength: [2000, 'Response cannot exceed 2000 characters']
  },
  respondedBy: {
    type: String,
    trim: true
  },
  respondedAt: {
    type: Date
  },

  // Metadata
  source: {
    type: String,
    default: 'website',
    enum: ['website', 'email', 'phone', 'social', 'referral']
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
contactSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for formatted phone
contactSchema.virtual('formattedPhone').get(function() {
  if (!this.phone) return '';
  // Simple formatting for display
  return this.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
});

// Index for better query performance
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ inquiryType: 1 });

// Pre-save middleware to update updatedAt
contactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get contact statistics
contactSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        responded: { $sum: { $cond: [{ $eq: ['$status', 'responded'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || { total: 0, new: 0, inProgress: 0, responded: 0, closed: 0 };
};

// Instance method to mark as responded
contactSchema.methods.markAsResponded = function(response, respondedBy) {
  this.status = 'responded';
  this.response = response;
  this.respondedBy = respondedBy;
  this.respondedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);
