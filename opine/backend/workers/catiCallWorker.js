/**
 * CATI Call Worker (BullMQ)
 * 
 * Background worker process that handles DeepCall API calls asynchronously.
 * This prevents blocking the main Node.js event loop when making external API calls.
 * 
 * Pattern used by top-tier companies: Meta (WhatsApp), Amazon (SQS workers), Google (Cloud Tasks)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const axios = require('axios');
const CatiCall = require('../models/CatiCall');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const Survey = require('../models/Survey'); // CRITICAL: Import Survey model to prevent "Schema hasn't been registered" error
const User = require('../models/User'); // Needed for company ID and agent registration
const CatiAgent = require('../models/CatiAgent'); // Needed for CloudTelephony agent registration
const ProviderFactory = require('../services/catiProviders/providerFactory'); // Use ProviderFactory instead of hardcoded DeepCall
const redisOps = require('../utils/redisClient');
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://opine.exypnossolutions.com';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ CATI Call Worker: MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Connect to MongoDB
(async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
    console.log('✅ CATI Call Worker: Connected to MongoDB successfully!');
  } catch (error) {
    console.error('❌ CATI Call Worker: MongoDB connection failed:', error);
    process.exit(1);
  }
})();

// Redis connection configuration (same as queue)
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST || 'redis://localhost:6379';
  
  let connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false
  };
  
  if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('redis://')) {
    try {
      const url = new URL(process.env.REDIS_URL);
      connection.host = url.hostname;
      connection.port = parseInt(url.port || '6379', 10);
      connection.password = url.password || undefined;
      connection.db = parseInt(url.pathname?.slice(1) || '0', 10);
    } catch (error) {
      console.warn('⚠️ Failed to parse REDIS_URL, using default connection settings');
    }
  }
  
  return connection;
};

// Helper function to make call via ProviderFactory (supports both DeepCall and CloudTelephony)
const initiateCall = async (companyId, interviewerId, fromNumber, toNumber, fromType = 'Number', toType = 'Number', fromRingTime = 30, toRingTime = 30) => {
  try {
    const cleanFrom = fromNumber.replace(/[^0-9]/g, '');
    const cleanTo = toNumber.replace(/[^0-9]/g, '');

    // Get provider based on company configuration
    const { provider, providerName } = await ProviderFactory.getProvider(companyId, {
      fromNumber: cleanFrom,
      toNumber: cleanTo,
      selectionKey: `${companyId}_${cleanFrom}_${cleanTo}`
    });

    console.log(`📞 [Worker] Making CATI call via provider=${providerName}: ${fromNumber} -> ${toNumber}`);

    // Ensure agent is registered for providers that require it (CloudTelephony)
    if (providerName === 'cloudtelephony') {
      const agent = await CatiAgent.getOrCreate(interviewerId, cleanFrom);
      if (!agent.isRegistered('cloudtelephony')) {
        const interviewer = await User.findById(interviewerId).select('firstName lastName').lean();
        const agentName = `${interviewer?.firstName || ''} ${interviewer?.lastName || ''}`.trim() || cleanFrom;
        try {
          const regResult = await provider.registerAgent(cleanFrom, agentName);
          // Mark as registered even if provider says "already exists" (idempotent behavior)
          agent.markRegistered('cloudtelephony', regResult?.response?.member_id || regResult?.response?.agentId || null);
          await agent.save();
          console.log(`✅ [Worker] Agent registered for CloudTelephony: ${cleanFrom}`);
        } catch (regErr) {
          // If registration fails, don't attempt call (provider requires it)
          console.error(`❌ [Worker] Failed to register agent for CloudTelephony: ${regErr.message}`);
          return {
            success: false,
            message: 'Failed to register agent for CloudTelephony',
            error: {
              message: regErr.message,
              details: regErr.response?.data || regErr.message
            }
          };
        }
      }
    }

    // Make call using provider
    const callResult = await provider.makeCall({
      fromNumber: cleanFrom,
      toNumber: cleanTo,
      fromType,
      toType,
      fromRingTime,
      toRingTime,
      uid: `worker_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    });

    console.log(`✅ [Worker] Call initiated via ${providerName}, callId: ${callResult.callId}`);

    return {
      success: true,
      callId: callResult.callId,
      provider: providerName,
      data: {
        callId: callResult.callId,
        fromNumber: fromNumber,
        toNumber: toNumber,
        apiResponse: callResult.apiResponse,
        provider: providerName
      }
    };
  } catch (error) {
    console.error(`❌ [Worker] Call initiation failed: ${error.message}`);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to initiate call',
      error: {
        message: error.response?.data?.message || error.message,
        code: error.response?.status,
        details: error.response?.data || error.message
      },
      statusCode: error.response?.status
    };
  }
};

// Create worker
const createWorker = () => {
  try {
    const connection = getRedisConnection();
    
    const worker = new Worker(
      'cati-call',
      async (job) => {
        console.log(`\n🔄 [Worker] Processing job ${job.id}...`);
        console.log(`   Queue ID: ${job.data.queueId}`);
        console.log(`   From: ${job.data.fromNumber} -> To: ${job.data.toNumber}`);
        
        try {
          const { queueId, fromNumber, toNumber, fromType, toType, interviewerId, surveyId } = job.data;
          
          // Get queue entry to find company ID
          const queueEntry = await CatiRespondentQueue.findById(queueId)
            .populate('survey', 'company surveyName');
          
          if (!queueEntry) {
            throw new Error(`Queue entry not found: ${queueId}`);
          }

          // Get company ID from survey
          const companyId = queueEntry.survey?.company || queueEntry.survey?.company?._id;
          if (!companyId) {
            throw new Error(`Company ID not found for survey: ${surveyId}`);
          }
          
          // Update job progress
          await job.updateProgress({ stage: 'calling_api', progress: 25 });
          
          // Make call using ProviderFactory (supports both DeepCall and CloudTelephony)
          const callResult = await initiateCall(
            companyId,
            interviewerId,
            fromNumber,
            toNumber,
            fromType || 'Number',
            toType || 'Number',
            30,
            30
          );
          
          await job.updateProgress({ stage: 'processing_response', progress: 50 });
          
          // Queue entry already fetched above, no need to fetch again
          
          if (!callResult.success) {
            // Update queue entry on failure
            queueEntry.status = 'pending';
            queueEntry.priority = -1;
            queueEntry.assignedTo = null;
            queueEntry.assignedAt = null;
            queueEntry.currentAttemptNumber = (queueEntry.currentAttemptNumber || 0) + 1;
            
            const errorMessage = callResult.message || 'Call initiation failed';
            
            queueEntry.callAttempts = queueEntry.callAttempts || [];
            queueEntry.callAttempts.push({
              attemptNumber: queueEntry.currentAttemptNumber,
              attemptedAt: new Date(),
              attemptedBy: interviewerId,
              status: 'failed',
              reason: errorMessage
            });
            
            queueEntry.createdAt = new Date();
            await queueEntry.save();
            
            await job.updateProgress({ stage: 'failed', progress: 100 });
            
            return {
              success: false,
              message: errorMessage,
              error: callResult.error
            };
          }
          
          // Create call record
          await job.updateProgress({ stage: 'creating_call_record', progress: 75 });
          
          let tempCallRecord = null;
          if (callResult.success && callResult.callId) {
            try {
              const providerName = callResult.provider || 'deepcall';

              tempCallRecord = new CatiCall({
                callId: callResult.callId,
                survey: surveyId || queueEntry.survey._id,
                queueEntry: queueEntry._id,
                company: companyId,
                createdBy: interviewerId,
                fromNumber: fromNumber,
                toNumber: toNumber,
                fromType: fromType || 'Number',
                toType: toType || 'Number',
                callStatus: 'ringing',
                webhookReceived: false,
                apiResponse: callResult.data?.apiResponse || {}
              });
              await tempCallRecord.save();
              
              queueEntry.callRecord = tempCallRecord._id;
              console.log(`✅ [Worker] Call record created: ${tempCallRecord._id}, provider: ${providerName}`);
            } catch (error) {
              console.error('❌ [Worker] Error creating call record:', error.message);
              // Continue without call record - webhook will create it
            }
          }
          
          // Update queue entry
          queueEntry.status = 'calling';
          queueEntry.currentAttemptNumber = (queueEntry.currentAttemptNumber || 0) + 1;
          queueEntry.lastAttemptedAt = new Date();
          
          queueEntry.callAttempts = queueEntry.callAttempts || [];
          queueEntry.callAttempts.push({
            attemptNumber: queueEntry.currentAttemptNumber,
            attemptedAt: new Date(),
            attemptedBy: interviewerId,
            callId: callResult.data?.callId,
            status: 'initiated'
          });
          
          await queueEntry.save();
          
          await job.updateProgress({ stage: 'completed', progress: 100 });
          
          console.log(`✅ [Worker] Job ${job.id} completed successfully`);
          console.log(`   Call ID: ${callResult.callId}`);
          
          return {
            success: true,
            callId: callResult.data?.callId,
            fromNumber,
            toNumber,
            queueId: queueEntry._id,
            callRecordId: tempCallRecord?._id
          };
        } catch (error) {
          console.error(`❌ [Worker] Job ${job.id} failed:`, error.message);
          await job.updateProgress({ stage: 'error', progress: 100 });
          throw error;
        }
      },
      {
        connection,
        concurrency: 20, // Process 20 jobs concurrently
        limiter: {
          max: 100, // Max 100 jobs
          duration: 60000 // Per minute (rate limit DeepCall API)
        }
      }
    );
    
    // Worker event handlers
    worker.on('completed', (job) => {
      console.log(`✅ [Worker] Job ${job.id} completed successfully`);
    });
    
    worker.on('failed', (job, err) => {
      console.error(`❌ [Worker] Job ${job?.id || 'unknown'} failed:`, err.message);
    });
    
    worker.on('error', (error) => {
      console.error('❌ [Worker] Worker error:', error.message);
    });
    
    console.log('✅ CATI Call Worker started successfully');
    console.log('   Concurrency: 20 jobs');
    console.log('   Rate limit: 100 jobs/minute');
    
    return worker;
  } catch (error) {
    console.error('❌ Failed to create CATI Call Worker:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (worker) => {
  console.log('\n🛑 Shutting down CATI Call Worker...');
  await worker.close();
  await mongoose.disconnect();
  console.log('✅ CATI Call Worker shut down gracefully');
  process.exit(0);
};

// Start worker
const worker = createWorker();

// Handle shutdown signals
process.on('SIGTERM', () => shutdown(worker));
process.on('SIGINT', () => shutdown(worker));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown(worker);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  shutdown(worker);
});


