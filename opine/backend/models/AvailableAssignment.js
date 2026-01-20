/**
 * Materialized View for Available Assignments
 * 
 * Phase 2: Materialized Views Pattern (Meta/Google/Amazon approach)
 * 
 * This collection stores pre-computed "next available responses" for quality agents.
 * Updated every 10 seconds by a background job to keep it fresh.
 * 
 * Benefits:
 * - Query becomes simple: findOne({ available: true })
 * - No complex aggregation at request time
 * - Can be indexed for instant lookups
 * - Shared across all servers via MongoDB
 */

const mongoose = require('mongoose');

const availableAssignmentSchema = new mongoose.Schema({
  responseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurveyResponse',
    required: true,
    unique: true,
    index: true
  },
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    index: true
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'expired'],
    default: 'available',
    index: true
  },
  interviewMode: {
    type: String,
    enum: ['capi', 'cati'],
    index: true
  },
  selectedAC: {
    type: String,
    index: true
  },
  priority: {
    type: Number,
    default: 1, // Lower number = higher priority
    index: true
  },
  lastSkippedAt: {
    type: Date,
    index: true
  },
  createdAt: {
    type: Date,
    index: true
  },
  // Metadata for filtering
  metadata: {
    searchableText: String, // Pre-computed searchable text
    gender: String,
    age: Number
  },
  // When this entry was last updated
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'availableassignments'
});

// Compound indexes for fast queries
availableAssignmentSchema.index({ status: 1, interviewMode: 1, selectedAC: 1, priority: 1, lastSkippedAt: 1, createdAt: 1 });
availableAssignmentSchema.index({ status: 1, surveyId: 1, interviewMode: 1 });
availableAssignmentSchema.index({ status: 1, updatedAt: 1 }); // For cleanup of stale entries

module.exports = mongoose.model('AvailableAssignment', availableAssignmentSchema);







