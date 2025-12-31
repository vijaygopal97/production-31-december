/**
 * Transfer Survey Responses from Development to Production Database
 * 
 * This script:
 * 1. Finds all SurveyResponses created today in development database
 * 2. Transfers them to production database
 * 3. Adds them to the appropriate QC batches
 * 
 * Run: node scripts/transferTodayResponses.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Development Database (local)
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Production Database
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

let devConnection = null;
let prodConnection = null;

// Models
let DevSurveyResponse = null;
let ProdSurveyResponse = null;
let ProdQCBatch = null;
let ProdSurvey = null;
let ProdUser = null;

/**
 * Connect to both databases
 */
async function connectDatabases() {
  try {
    console.log('🔌 Connecting to development database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    console.log('✅ Connected to development database');
    
    // Load models for development (register all models needed for populate)
    const SurveyResponseSchema = require('../models/SurveyResponse');
    const SurveySchema = require('../models/Survey');
    const UserSchema = require('../models/User');
    
    DevSurveyResponse = devConnection.model('SurveyResponse', SurveyResponseSchema.schema);
    devConnection.model('Survey', SurveySchema.schema);
    devConnection.model('User', UserSchema.schema);
    
    console.log('🔌 Connecting to production database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    console.log('✅ Connected to production database');
    
    // Load models for production (register all models)
    ProdSurveyResponse = prodConnection.model('SurveyResponse', SurveyResponseSchema.schema);
    ProdSurvey = prodConnection.model('Survey', SurveySchema.schema);
    ProdUser = prodConnection.model('User', UserSchema.schema);
    ProdQCBatch = prodConnection.model('QCBatch', require('../models/QCBatch').schema);
    prodConnection.model('QCBatchConfig', require('../models/QCBatchConfig').schema);
    prodConnection.model('Company', require('../models/Company').schema);
    
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    throw error;
  }
}

/**
 * Get today's date range (start and end of today)
 */
function getTodayDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow
  
  return { start: today, end: tomorrow };
}


/**
 * Check if response already exists in production (by sessionId)
 */
async function responseExistsInProduction(sessionId) {
  try {
    const existing = await ProdSurveyResponse.findOne({ sessionId });
    return !!existing;
  } catch (error) {
    console.error(`❌ Error checking if response exists: ${error.message}`);
    return false;
  }
}

/**
 * Get or create QC batch for production
 */
async function getOrCreateBatch(surveyId, interviewerId) {
  try {
    // Find existing batch for this survey and interviewer that is still collecting
    let batch = await ProdQCBatch.findOne({
      survey: surveyId,
      interviewer: interviewerId,
      status: 'collecting',
      totalResponses: { $lt: 100 }
    }).sort({ batchDate: -1 });
    
    // If no batch exists, create a new one
    if (!batch) {
      // Get active config for this survey
      const survey = await ProdSurvey.findById(surveyId);
      let config = null;
      if (survey) {
        // Get company ID (could be ObjectId or populated object)
        const companyId = survey.company?._id || survey.company;
        const QCBatchConfig = prodConnection.model('QCBatchConfig', require('../models/QCBatchConfig').schema);
        config = await QCBatchConfig.getActiveConfig(surveyId, companyId);
      }
      
      batch = new ProdQCBatch({
        survey: surveyId,
        interviewer: interviewerId,
        batchDate: new Date(),
        status: 'collecting',
        responses: [],
        totalResponses: 0,
        sampleResponses: [],
        sampleSize: 0,
        remainingResponses: [],
        remainingSize: 0,
        qcStats: {
          approvedCount: 0,
          rejectedCount: 0,
          pendingCount: 0,
          approvalRate: 0
        },
        remainingDecision: {
          decision: 'pending'
        },
        batchConfig: config ? {
          samplePercentage: config.samplePercentage,
          approvalRules: config.approvalRules || [],
          configId: config._id || null
        } : {
          samplePercentage: 40,
          approvalRules: [
            { minRate: 50, maxRate: 100, action: 'auto_approve', description: '50%+ - Auto approve' },
            { minRate: 0, maxRate: 50, action: 'send_to_qc', description: 'Below 50% - Send to QC' }
          ]
        }
      });
      
      await batch.save();
      console.log(`✅ Created new QC batch ${batch._id} for survey ${surveyId} and interviewer ${interviewerId}`);
    }
    
    return batch;
  } catch (error) {
    console.error('❌ Error getting/creating batch:', error);
    throw error;
  }
}

/**
 * Add response to batch in production
 */
async function addResponseToBatch(responseId, surveyId, interviewerId) {
  try {
    // Get or create batch
    const batch = await getOrCreateBatch(surveyId, interviewerId);
    
    // Check if response is already in batch
    const responseIdStr = responseId.toString();
    if (batch.responses.some(id => id.toString() === responseIdStr)) {
      console.log(`⏭️  Response ${responseId} already in batch ${batch._id}`);
      return batch;
    }
    
    // Add response to batch
    batch.responses.push(responseId);
    batch.totalResponses = batch.responses.length;
    await batch.save();
    
    // Update response with batch reference
    await ProdSurveyResponse.updateOne(
      { _id: responseId },
      { $set: { qcBatch: batch._id, isSampleResponse: false } }
    );
    
    console.log(`✅ Added response ${responseId} to batch ${batch._id} (${batch.totalResponses}/100)`);
    
    return batch;
  } catch (error) {
    console.error('❌ Error adding response to batch:', error);
    throw error;
  }
}

/**
 * Transfer a single response to production
 */
async function transferResponse(response) {
  try {
    // Check if already exists
    const exists = await responseExistsInProduction(response.sessionId);
    if (exists) {
      console.log(`⏭️  Response with sessionId ${response.sessionId} already exists in production, skipping...`);
      return { transferred: false, reason: 'already_exists' };
    }
    
    // Verify survey and interviewer exist in production
    const survey = await ProdSurvey.findById(response.survey._id || response.survey);
    if (!survey) {
      console.log(`⚠️  Survey ${response.survey._id || response.survey} not found in production, skipping...`);
      return { transferred: false, reason: 'survey_not_found' };
    }
    
    const interviewer = await ProdUser.findById(response.interviewer._id || response.interviewer);
    if (!interviewer) {
      console.log(`⚠️  Interviewer ${response.interviewer._id || response.interviewer} not found in production, skipping...`);
      return { transferred: false, reason: 'interviewer_not_found' };
    }
    
    // Remove _id and other fields that shouldn't be copied
    const responseData = { ...response };
    delete responseData._id;
    delete responseData.__v;
    delete responseData.qcBatch; // Will be set after adding to batch
    
    // Create new response in production
    const newResponse = new ProdSurveyResponse(responseData);
    await newResponse.save();
    
    console.log(`✅ Transferred response ${newResponse._id} (sessionId: ${response.sessionId})`);
    
    // Add to batch if not auto-rejected and not abandoned
    const isAutoRejected = response.status === 'Rejected' && response.autoApproved === false;
    const isAbandoned = response.status === 'abandoned' || response.metadata?.abandoned === true;
    
    if (!isAutoRejected && !isAbandoned) {
      try {
        await addResponseToBatch(
          newResponse._id,
          survey._id,
          interviewer._id.toString()
        );
      } catch (batchError) {
        console.error(`⚠️  Error adding response to batch (non-critical): ${batchError.message}`);
        // Continue even if batch addition fails
      }
    } else {
      console.log(`⏭️  Skipping batch addition for ${isAbandoned ? 'abandoned' : 'auto-rejected'} response ${newResponse._id}`);
    }
    
    return { transferred: true, responseId: newResponse._id };
  } catch (error) {
    console.error(`❌ Error transferring response ${response.sessionId}:`, error.message);
    return { transferred: false, reason: 'error', error: error.message };
  }
}

/**
 * Main transfer function
 */
async function transferTodayResponses() {
  try {
    console.log('🚀 Starting transfer of today\'s responses...\n');
    
    // Connect to databases
    await connectDatabases();
    
    // Find today's responses (without populate first, then populate manually if needed)
    const { start, end } = getTodayDateRange();
    console.log(`\n📅 Looking for responses created between ${start.toISOString()} and ${end.toISOString()}`);
    
    let responses = await DevSurveyResponse.find({
      createdAt: {
        $gte: start,
        $lt: end
      }
    }).lean();
    
    console.log(`✅ Found ${responses.length} responses created today`);
    
    // Manually populate survey and interviewer data if needed
    if (responses.length > 0) {
      const Survey = devConnection.model('Survey');
      const User = devConnection.model('User');
      
      for (const response of responses) {
        if (response.survey && typeof response.survey === 'object' && !response.survey.title) {
          const survey = await Survey.findById(response.survey).select('_id title').lean();
          if (survey) {
            response.survey = survey;
          }
        }
        if (response.interviewer && typeof response.interviewer === 'object' && !response.interviewer.firstName) {
          const interviewer = await User.findById(response.interviewer).select('_id firstName lastName email memberId').lean();
          if (interviewer) {
            response.interviewer = interviewer;
          }
        }
      }
    }
    
    if (responses.length === 0) {
      console.log('✅ No responses found for today. Nothing to transfer.');
      return;
    }
    
    console.log(`\n📊 Transferring ${responses.length} responses...\n`);
    
    const results = {
      total: responses.length,
      transferred: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    // Transfer each response
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const interviewerName = response.interviewer 
        ? `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim() || response.interviewer.email
        : 'Unknown';
      
      console.log(`\n[${i + 1}/${responses.length}] Processing response from ${interviewerName}...`);
      console.log(`   SessionId: ${response.sessionId}`);
      console.log(`   Survey: ${response.survey?.title || response.survey?._id || 'Unknown'}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Created: ${response.createdAt}`);
      
      const result = await transferResponse(response);
      
      if (result.transferred) {
        results.transferred++;
        results.details.push({
          sessionId: response.sessionId,
          status: 'transferred',
          responseId: result.responseId
        });
      } else {
        results.skipped++;
        results.details.push({
          sessionId: response.sessionId,
          status: 'skipped',
          reason: result.reason
        });
      }
      
      if (result.reason === 'error') {
        results.errors++;
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TRANSFER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total responses found: ${results.total}`);
    console.log(`✅ Successfully transferred: ${results.transferred}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log('='.repeat(60));
    
    if (results.details.length > 0) {
      console.log('\n📋 Details:');
      results.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. SessionId: ${detail.sessionId} - ${detail.status}${detail.reason ? ` (${detail.reason})` : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error during transfer:', error);
    throw error;
  } finally {
    // Close connections
    if (devConnection) {
      await devConnection.close();
      console.log('\n🔌 Disconnected from development database');
    }
    if (prodConnection) {
      await prodConnection.close();
      console.log('🔌 Disconnected from production database');
    }
  }
}

// Run the script
if (require.main === module) {
  transferTodayResponses()
    .then(() => {
      console.log('\n✅ Transfer completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Transfer failed:', error);
      process.exit(1);
    });
}

module.exports = { transferTodayResponses };






