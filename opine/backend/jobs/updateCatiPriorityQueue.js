/**
 * Background Job: Update CATI Priority Queue Materialized View
 * 
 * Phase 2: Materialized Views Pattern
 * 
 * This job runs every 5 seconds to update the materialized view of CATI priority queue.
 * It pre-computes the "next available respondents" sorted by AC priority, eliminating
 * the need for complex priority logic at request time.
 * 
 * Pattern: Meta/Facebook approach - pre-compute expensive queries
 */

const mongoose = require('mongoose');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const CatiPriorityQueue = require('../models/CatiPriorityQueue');
const fs = require('fs');
const path = require('path');

// Load AC priority map
let acPriorityMap = {};
try {
  const priorityFile = path.join(__dirname, '../data/CATI_AC_Priority.json');
  const priorityData = JSON.parse(fs.readFileSync(priorityFile, 'utf8'));
  acPriorityMap = priorityData;
  console.log(`📋 Loaded AC priority map with ${Object.keys(acPriorityMap).length} ACs`);
} catch (error) {
  console.error('❌ Error loading AC priority map:', error);
}

async function updateCatiPriorityQueue() {
  const startTime = Date.now();
  console.log('🔄 Starting updateCatiPriorityQueue job...');
  
  try {
    // Skip if previous job is still running (prevent overlap)
    if (updateCatiPriorityQueue.isRunning) {
      console.log('⏭️  Previous updateCatiPriorityQueue job still running, skipping...');
      return;
    }
    updateCatiPriorityQueue.isRunning = true;
    // CRITICAL OPTIMIZATION: Only get recent pending respondents (last 24 hours)
    // This prevents processing old stale entries
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingRespondents = await CatiRespondentQueue.find({
      status: 'pending',
      createdAt: { $gt: oneDayAgo } // Only recent entries
    })
    .select('_id survey respondentContact createdAt') // Only needed fields
    .read('secondaryPreferred') // Use replica set for reads
    .maxTimeMS(8000) // 8 second timeout - must complete quickly
    .lean() // Critical: Use lean() to prevent Mongoose document overhead
    .hint('status_1_createdAt_1') // Force index usage
    .limit(1500); // Increased to cover more respondents
    
    console.log(`📊 Found ${pendingRespondents.length} pending CATI respondents`);
    
    // CRITICAL OPTIMIZATION: Process in batches to prevent memory issues
    const BATCH_SIZE = 200;
    const bulkOps = [];
    
    // Process all respondents efficiently
    for (const respondent of pendingRespondents) {
      const acName = respondent.respondentContact?.ac;
      if (!acName) {
        continue; // Skip if no AC
      }
      
      const surveyId = respondent.survey.toString();
      
      // Get priority from map (default to 999 if not found)
      const priority = acPriorityMap[acName] || 999;
      
      bulkOps.push({
        updateOne: {
          filter: { queueEntryId: respondent._id },
          update: {
            $set: {
              queueEntryId: respondent._id,
              surveyId: new mongoose.Types.ObjectId(surveyId),
              acName: acName,
              priority: priority,
              status: 'available',
              createdAt: respondent.createdAt || new Date(),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
      
      // Execute batch to prevent memory buildup
      if (bulkOps.length >= BATCH_SIZE) {
        await CatiPriorityQueue.bulkWrite(bulkOps, { ordered: false });
        bulkOps.length = 0; // Clear array efficiently
      }
    }
    
    // Mark assigned respondents as 'assigned' (only for entries in materialized view)
    // CRITICAL: Only update assigned status for recent assignments (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const assignedRespondents = await CatiRespondentQueue.find({
      status: 'assigned',
      assignedAt: { $gt: oneHourAgo } // Only recent assignments
    })
    .select('_id') // Only _id needed
    .read('secondaryPreferred')
    .maxTimeMS(5000) // 5 second timeout - must be fast
    .lean()
    .limit(300); // Reasonable limit
    
    for (const respondent of assignedRespondents) {
      bulkOps.push({
        updateOne: {
          filter: { queueEntryId: respondent._id },
          update: {
            $set: {
              status: 'assigned',
              updatedAt: new Date()
            }
          },
          upsert: false
        }
      });
    }
    
    // Execute remaining bulk operations
    if (bulkOps.length > 0) {
      await CatiPriorityQueue.bulkWrite(bulkOps, { ordered: false });
      bulkOps.length = 0; // Clear for GC
    }
    
    const totalUpdated = pendingRespondents.length;
    console.log(`✅ Updated ${totalUpdated} entries in CatiPriorityQueue materialized view`);
    
    // Clean up stale entries (older than 1 hour) - reuse oneHourAgo from above
    const deleteResult = await CatiPriorityQueue.deleteMany({
      updatedAt: { $lt: oneHourAgo },
      status: { $ne: 'available' }
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deleteResult.deletedCount} stale entries`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ updateCatiPriorityQueue job completed in ${duration}ms`);
    updateCatiPriorityQueue.isRunning = false;
    
  } catch (error) {
    console.error('❌ Error in updateCatiPriorityQueue job:', error.message);
    updateCatiPriorityQueue.isRunning = false;
  }
}

// Initialize running flag
updateCatiPriorityQueue.isRunning = false;

module.exports = updateCatiPriorityQueue;

