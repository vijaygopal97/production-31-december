/**
 * Update Available Assignments Materialized View
 * 
 * Phase 2: Materialized Views Pattern
 * 
 * This job updates the AvailableAssignment materialized view with pre-computed
 * "next available responses" for quality agents.
 * 
 * Runs every 60 seconds to keep the view fresh.
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const AvailableAssignment = require('../models/AvailableAssignment');
const Survey = require('../models/Survey');

// Note: This job doesn't need Redis - it only updates MongoDB materialized view

async function updateAvailableAssignments() {
  const startTime = Date.now();
  try {
    console.log('🔄 Starting updateAvailableAssignments job...');
    
    // CRITICAL: Ensure MongoDB is connected (when called from background job, it's already connected)
    // Only wait if not connected (standalone execution)
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, skipping this run (will retry on next interval)');
      return; // Skip this run, will retry on next interval
    }
    
    const now = new Date();
    
    // OPTIMIZATION: Use simpler query structure to avoid timeout
    // Split into two queries: one for CAPI with audio, one for CATI/others
    console.log('📊 Querying available responses...');
    
    // Query 1: CAPI responses with valid audio (proper $and structure)
    const capiQuery = {
      status: 'Pending_Approval',
      interviewMode: 'capi',
      $and: [
        {
          $or: [
            { reviewAssignment: { $exists: false } },
            { 'reviewAssignment.assignedTo': null },
            { 'reviewAssignment.expiresAt': { $lt: now } }
          ]
        }
      ],
      // CRITICAL: QC must ONLY assign responses with playable S3 audio.
      // Require S3 keys like "audio/interviews/...." (not local files).
      'audioRecording.hasAudio': true,
      'audioRecording.fileSize': { $exists: true, $gt: 0 },
      'audioRecording.uploadedAt': { $exists: true, $ne: null },
      'audioRecording.audioUrl': { $exists: true, $type: 'string', $regex: /^audio\/interviews\// },
      'audioRecording.recordingDuration': { $exists: true, $gt: 0 },
      // CAPI must have at least 3 answers (avoid incomplete/corrupt interviews)
      'responses.2': { $exists: true }
    };
    
    // Query 2: CATI and other modes (no audio requirement)
    const otherQuery = {
      status: 'Pending_Approval',
      interviewMode: { $ne: 'capi' },
      $and: [
        {
          $or: [
            { reviewAssignment: { $exists: false } },
            { 'reviewAssignment.assignedTo': null },
            { 'reviewAssignment.expiresAt': { $lt: now } }
          ]
        },
        {
          $or: [
            { qcBatch: { $exists: false } },
            { qcBatch: null },
            { isSampleResponse: true }
          ]
        }
      ]
    };
    
    // Execute queries in parallel
    const [capiResponses, otherResponses] = await Promise.all([
      SurveyResponse.find(capiQuery)
        .select('_id survey interviewer interviewMode selectedAC status createdAt lastSkippedAt audioRecording responses')
        .read('secondaryPreferred')
        .maxTimeMS(30000)
        .lean()
        .limit(5000),
      SurveyResponse.find(otherQuery)
        .select('_id survey interviewer interviewMode selectedAC status createdAt lastSkippedAt audioRecording responses')
        .read('secondaryPreferred')
        .maxTimeMS(30000)
        .lean()
        .limit(5000)
    ]);
    
    const availableResponses = [...capiResponses, ...otherResponses];
    console.log(`📊 Found ${capiResponses.length} CAPI + ${otherResponses.length} other = ${availableResponses.length} total raw responses`);
    
    // CRITICAL: Additional filtering in JavaScript (after MongoDB query)
    // 1. Exclude CAPI responses with < 3 responses in responses array
    // 2. Exclude CAPI responses with unplayable audio (local files that don't exist)
    const fs = require('fs');
    const path = require('path');
    const filteredResponses = [];
    
    for (const response of availableResponses) {
      // Filter 1: Exclude CAPI responses with < 3 responses
      if (response.interviewMode === 'capi') {
        const responsesCount = response.responses ? response.responses.length : 0;
        if (responsesCount < 3) {
          continue; // Skip this response
        }
      }
      
      // Filter 2: Exclude CAPI responses with unplayable audio (local files that don't exist)
      if (response.interviewMode === 'capi' && response.audioRecording?.audioUrl) {
        const audioUrl = response.audioRecording.audioUrl;
        // Check if it's a local file path (starts with /uploads/audio/)
        if (audioUrl.startsWith('/uploads/audio/')) {
          const fullPath = path.join(__dirname, '../../', audioUrl);
          if (!fs.existsSync(fullPath)) {
            continue; // Skip - file doesn't exist (unplayable)
          }
        }
        // For S3 files (audio/interviews/...), we can't check existence without S3 API call
        // These will be caught when streaming returns 404, but we can't pre-filter them
      }
      
      filteredResponses.push(response);
    }
    
    console.log(`📊 Found ${availableResponses.length} raw responses, ${filteredResponses.length} after filtering`);
    
    // Use filtered responses for rest of the function
    const finalResponses = filteredResponses;
    
    // CRITICAL FIX: Check finalResponses.length, not availableResponses.length
    // If no valid responses after filtering, clean up stale entries and return
    if (finalResponses.length === 0) {
      // Clean up stale entries (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const deleted = await AvailableAssignment.deleteMany({
        updatedAt: { $lt: oneHourAgo }
      });
      console.log(`🧹 Cleaned up ${deleted.deletedCount} stale entries (no valid responses found)`);
      return;
    }
    
    // Bulk upsert operations
    const BATCH_SIZE = 200;
    const bulkOps = [];
    
    for (const response of finalResponses) {
      const surveyId = response.survey?.toString() || response.survey;
      const interviewerId = response.interviewer?.toString() || response.interviewer;
      const selectedAC = response.selectedAC || null;
      const interviewMode = response.interviewMode || 'capi';
      
      // Priority: lower number = higher priority
      // Never skipped = priority 1, recently skipped = priority 2, etc.
      const priority = response.lastSkippedAt ? 2 : 1;
      
      bulkOps.push({
        updateOne: {
          filter: { responseId: response._id },
          update: {
            $set: {
              responseId: response._id,
              surveyId: new mongoose.Types.ObjectId(surveyId),
              interviewerId: interviewerId ? new mongoose.Types.ObjectId(interviewerId) : null,
              status: 'available',
              interviewMode: interviewMode,
              selectedAC: selectedAC,
              priority: priority,
              lastSkippedAt: response.lastSkippedAt || null,
              createdAt: response.createdAt || new Date(),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
      
      // Execute batch to prevent memory buildup
      if (bulkOps.length >= BATCH_SIZE) {
        await AvailableAssignment.bulkWrite(bulkOps, { ordered: false });
        bulkOps.length = 0; // Clear array efficiently
      }
    }
    
    // Execute remaining operations
    if (bulkOps.length > 0) {
      await AvailableAssignment.bulkWrite(bulkOps, { ordered: false });
    }
    
    // Mark assigned responses as 'assigned' (only for recent assignments)
    // Define oneHourAgo here so it's available for cleanup later
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const assignedResponses = await SurveyResponse.find({
      status: 'Pending_Approval',
      'reviewAssignment.assignedTo': { $exists: true, $ne: null },
      'reviewAssignment.assignedAt': { $gt: oneHourAgo },
      'reviewAssignment.expiresAt': { $gt: now } // Not expired
    })
    .select('_id')
    .read('secondaryPreferred')
    .maxTimeMS(10000) // 10 second timeout
    .lean()
    .limit(1000);
    
    if (assignedResponses.length > 0) {
      const assignedIds = assignedResponses.map(r => r._id);
      await AvailableAssignment.updateMany(
        { responseId: { $in: assignedIds } },
        { $set: { status: 'assigned', updatedAt: new Date() } }
      );
    }
    
    // Clean up entries for responses that are no longer Pending_Approval
    const nonPendingResponseIds = await SurveyResponse.find({
      status: { $ne: 'Pending_Approval' },
      updatedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .select('_id')
    .read('secondaryPreferred')
    .maxTimeMS(10000)
    .lean()
    .limit(2000);
    
    if (nonPendingResponseIds.length > 0) {
      const idsToRemove = nonPendingResponseIds.map(r => r._id);
      await AvailableAssignment.deleteMany({ responseId: { $in: idsToRemove } });
    }
    
    // Clean up stale entries (older than 1 hour) - reuse oneHourAgo from above
    const deleted = await AvailableAssignment.deleteMany({
      updatedAt: { $lt: oneHourAgo }
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ updateAvailableAssignments completed in ${duration}ms`);
    console.log(`   - Updated ${finalResponses.length} entries`);
    console.log(`   - Marked ${assignedResponses.length} as assigned`);
    console.log(`   - Cleaned up ${deleted.deletedCount} stale entries`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error in updateAvailableAssignments (${duration}ms):`, error.message);
    console.error('Stack:', error.stack);
    // Don't throw - let the job continue running
  }
}

module.exports = updateAvailableAssignments;

