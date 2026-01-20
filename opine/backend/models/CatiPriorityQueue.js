/**
 * Materialized View for CATI Priority Queue
 * 
 * Phase 2: Materialized Views Pattern (Meta/Google/Amazon approach)
 * 
 * This collection stores pre-computed "next available respondents" for CATI interviews,
 * sorted by AC priority. Updated every 5 seconds by a background job.
 * 
 * Benefits:
 * - Query becomes simple: findOne({ priority: 1, available: true })
 * - No complex AC priority logic at request time
 * - Can be indexed for instant lookups
 * - Shared across all servers via MongoDB
 */

const mongoose = require('mongoose');

const catiPriorityQueueSchema = new mongoose.Schema({
  queueEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CatiRespondentQueue',
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
  acName: {
    type: String,
    required: true,
    index: true
  },
  priority: {
    type: Number,
    required: true,
    index: true // Lower number = higher priority (1 = highest)
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'expired'],
    default: 'available',
    index: true
  },
  createdAt: {
    type: Date,
    index: true // For FIFO ordering within same priority
  },
  // When this entry was last updated
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'catipriorityqueue'
});

// Compound indexes for fast queries
catiPriorityQueueSchema.index({ status: 1, priority: 1, createdAt: 1 }); // Main query index
catiPriorityQueueSchema.index({ status: 1, surveyId: 1, priority: 1 });
catiPriorityQueueSchema.index({ status: 1, updatedAt: 1 }); // For cleanup of stale entries

module.exports = mongoose.model('CatiPriorityQueue', catiPriorityQueueSchema);







