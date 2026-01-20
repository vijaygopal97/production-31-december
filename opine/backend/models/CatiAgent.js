/**
 * CatiAgent Model
 * Tracks agent registration status with different CATI providers
 */
const mongoose = require('mongoose');

const catiAgentSchema = new mongoose.Schema({
  // User reference (interviewer)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Phone number (FROM number - interviewer's number)
  phone: {
    type: String,
    required: true,
    index: true
  },
  
  // Provider registration status
  providers: {
    deepcall: {
      registered: { type: Boolean, default: false },
      registeredAt: { type: Date },
      lastChecked: { type: Date }
    },
    cloudtelephony: {
      registered: { type: Boolean, default: false },
      registeredAt: { type: Date },
      lastChecked: { type: Date },
      agentId: { type: String } // Provider's agent ID if returned
    }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

// Indexes
catiAgentSchema.index({ user: 1, phone: 1 });
catiAgentSchema.index({ phone: 1 });

// Pre-save middleware
catiAgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create agent
catiAgentSchema.statics.getOrCreate = async function(userId, phoneNumber) {
  const agent = await this.findOne({ user: userId, phone: phoneNumber });
  if (agent) {
    return agent;
  }
  
  return this.create({
    user: userId,
    phone: phoneNumber
  });
};

// Instance method to check if registered with provider
catiAgentSchema.methods.isRegistered = function(providerName) {
  return this.providers[providerName]?.registered === true;
};

// Instance method to mark as registered
catiAgentSchema.methods.markRegistered = function(providerName, agentId = null) {
  if (!this.providers[providerName]) {
    this.providers[providerName] = {};
  }
  
  this.providers[providerName].registered = true;
  this.providers[providerName].registeredAt = new Date();
  this.providers[providerName].lastChecked = new Date();
  
  if (agentId) {
    this.providers[providerName].agentId = agentId;
  }
  
  this.markModified('providers');
};

module.exports = mongoose.model('CatiAgent', catiAgentSchema);
