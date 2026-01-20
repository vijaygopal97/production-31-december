/**
 * Start Background Jobs for Materialized Views
 * 
 * Phase 2: Materialized Views Pattern
 * 
 * This module starts the background jobs that update materialized views.
 * Jobs run at regular intervals to keep the views fresh.
 */

const updateAvailableAssignments = require('./updateAvailableAssignments');
const updateCatiPriorityQueue = require('./updateCatiPriorityQueue');
const redisOps = require('../utils/redisClient');

let availableAssignmentsInterval = null;
let catiPriorityQueueInterval = null;
let isJobRunner = false;

async function acquireJobLock() {
  try {
    // Try to acquire lock with 60 second TTL
    const lockKey = 'background_jobs_lock';
    const lockValue = `${process.pid}-${Date.now()}`;
    const acquired = await redisOps.set(lockKey, lockValue, 60, 'NX'); // NX = only set if not exists
    
    if (acquired) {
      // Refresh lock every 30 seconds
      const refreshInterval = setInterval(async () => {
        try {
          await redisOps.set(lockKey, lockValue, 60);
        } catch (err) {
          clearInterval(refreshInterval);
          isJobRunner = false;
        }
      }, 30000);
      
      return true;
    }
    return false;
  } catch (error) {
    // If Redis fails, don't run jobs (fail safe)
    console.warn('⚠️  Could not acquire job lock (Redis unavailable), skipping background jobs');
    return false;
  }
}

async function startBackgroundJobs() {
  console.log('🚀 Attempting to start background jobs for materialized views...');
  
  // CRITICAL: Only one instance should run jobs (use Redis lock)
  isJobRunner = await acquireJobLock();
  
  if (!isJobRunner) {
    console.log('⏭️  Another instance is running background jobs, skipping...');
    return;
  }
  
  console.log('✅ This instance will run background jobs');
  
  // CRITICAL OPTIMIZATION: Increase intervals significantly to reduce load
  // Update available assignments every 60 seconds (much reduced frequency)
  availableAssignmentsInterval = setInterval(async () => {
    try {
      await updateAvailableAssignments();
    } catch (error) {
      console.error('❌ Error in availableAssignments job:', error.message);
    }
  }, 60 * 1000); // 60 seconds (increased from 30)
  
  // Update CATI priority queue every 45 seconds (much reduced frequency)
  catiPriorityQueueInterval = setInterval(async () => {
    try {
      await updateCatiPriorityQueue();
    } catch (error) {
      console.error('❌ Error in catiPriorityQueue job:', error.message);
    }
  }, 45 * 1000); // 45 seconds (increased from 20)
  
  // Run immediately on startup (with delay to avoid startup load)
  setTimeout(() => {
    updateAvailableAssignments().catch(err => console.error('Startup error:', err.message));
  }, 10000); // 10 second delay
  
  setTimeout(() => {
    updateCatiPriorityQueue().catch(err => console.error('Startup error:', err.message));
  }, 15000); // 15 second delay
  
  console.log('✅ Background jobs started (60s and 45s intervals, single instance)');
}

async function stopBackgroundJobs() {
  console.log('🛑 Stopping background jobs...');
  
  if (availableAssignmentsInterval) {
    clearInterval(availableAssignmentsInterval);
    availableAssignmentsInterval = null;
  }
  
  if (catiPriorityQueueInterval) {
    clearInterval(catiPriorityQueueInterval);
    catiPriorityQueueInterval = null;
  }
  
  // Release lock
  if (isJobRunner) {
    try {
      await redisOps.del('background_jobs_lock');
    } catch (error) {
      // Ignore errors on shutdown
    }
    isJobRunner = false;
  }
  
  console.log('✅ Background jobs stopped');
}

// Handle graceful shutdown
process.on('SIGTERM', stopBackgroundJobs);
process.on('SIGINT', stopBackgroundJobs);

module.exports = {
  startBackgroundJobs,
  stopBackgroundJobs
};

