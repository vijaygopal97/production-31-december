const mongoose = require('mongoose');

const setDataSchema = new mongoose.Schema({
  // Survey reference
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    index: true
  },
  
  // Survey Response reference
  surveyResponse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurveyResponse',
    required: true,
    unique: true,
    index: true
  },
  
  // Set Number used in this interview
  setNumber: {
    type: Number,
    required: true,
    index: true
  },
  
  // Interview mode (for future use if needed)
  interviewMode: {
    type: String,
    enum: ['cati', 'capi'],
    default: 'cati'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
setDataSchema.index({ survey: 1, createdAt: -1 });
setDataSchema.index({ survey: 1, setNumber: 1 });

module.exports = mongoose.model('SetData', setDataSchema);

