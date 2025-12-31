/**
 * Compare Development and Production Stats
 * 
 * This script compares:
 * 1. Total response counts
 * 2. System rejection counts
 * 3. Date-filtered counts
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

const SURVEY_ID = '68fd1915d41841da463f0d46';

const SurveyResponseSchema = require('../models/SurveyResponse').schema;

let devConnection, prodConnection, DevSurveyResponse, ProdSurveyResponse;

async function connectDatabases() {
  try {
    console.log('🔌 Connecting to DEVELOPMENT...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    DevSurveyResponse = devConnection.model('SurveyResponse', SurveyResponseSchema);
    console.log('✅ Connected to DEVELOPMENT\n');

    console.log('🔌 Connecting to PRODUCTION...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdSurveyResponse = prodConnection.model('SurveyResponse', SurveyResponseSchema);
    console.log('✅ Connected to PRODUCTION\n');
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    throw error;
  }
}

async function checkSystemRejections(SurveyResponseModel, dbName) {
  const surveyId = new mongoose.Types.ObjectId(SURVEY_ID);
  
  // Get all rejected responses
  const rejectedResponses = await SurveyResponseModel.find({
    survey: surveyId,
    status: 'Rejected'
  }).lean();

  let systemRejections = 0;
  let manualRejections = 0;
  let noFeedback = 0;

  rejectedResponses.forEach(response => {
    const feedback = (response.verificationData?.feedback || '').toLowerCase();
    const metadata = response.metadata || {};
    
    const isAutoRejected = metadata.autoRejected || 
                          metadata.isSystemRejection ||
                          feedback.includes('too short') || 
                          feedback.includes('system') || 
                          feedback.includes('auto') ||
                          feedback.includes('automatic') ||
                          feedback.includes('duration') ||
                          feedback.includes('minimum time');
    
    if (!response.verificationData?.feedback) {
      noFeedback++;
    } else if (isAutoRejected) {
      systemRejections++;
    } else {
      manualRejections++;
    }
  });

  return {
    totalRejected: rejectedResponses.length,
    systemRejections,
    manualRejections,
    noFeedback
  };
}

async function checkDateFiltered(SurveyResponseModel, dbName) {
  const surveyId = new mongoose.Types.ObjectId(SURVEY_ID);
  
  // Get yesterday's date range (IST = UTC+5:30)
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(18, 30, 0, 0); // IST 00:00:00 = UTC 18:30:00 previous day
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setUTCHours(18, 29, 59, 999); // IST 23:59:59 = UTC 18:29:59 same day
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1);

  const total = await SurveyResponseModel.countDocuments({ survey: surveyId });
  const yesterdayCount = await SurveyResponseModel.countDocuments({
    survey: surveyId,
    createdAt: { $gte: yesterday, $lte: yesterdayEnd }
  });

  return { total, yesterdayCount, yesterdayStart: yesterday, yesterdayEnd };
}

async function main() {
  try {
    await connectDatabases();

    console.log('='.repeat(60));
    console.log('📊 COMPARING DEVELOPMENT vs PRODUCTION');
    console.log('='.repeat(60));
    console.log(`Survey ID: ${SURVEY_ID}\n`);

    // Check total counts
    console.log('📈 Total Response Counts:');
    console.log('-'.repeat(60));
    const devCounts = await checkDateFiltered(DevSurveyResponse, 'DEVELOPMENT');
    const prodCounts = await checkDateFiltered(ProdSurveyResponse, 'PRODUCTION');
    
    console.log('DEVELOPMENT:');
    console.log(`  Total (all time): ${devCounts.total}`);
    console.log(`  Yesterday: ${devCounts.yesterdayCount}`);
    console.log(`  Yesterday range: ${devCounts.yesterdayStart.toISOString()} to ${devCounts.yesterdayEnd.toISOString()}`);
    
    console.log('\nPRODUCTION:');
    console.log(`  Total (all time): ${prodCounts.total}`);
    console.log(`  Yesterday: ${prodCounts.yesterdayCount}`);
    console.log(`  Yesterday range: ${prodCounts.yesterdayStart.toISOString()} to ${prodCounts.yesterdayEnd.toISOString()}`);

    // Check system rejections
    console.log('\n\n🔍 System Rejection Analysis:');
    console.log('-'.repeat(60));
    const devRejections = await checkSystemRejections(DevSurveyResponse, 'DEVELOPMENT');
    const prodRejections = await checkSystemRejections(ProdSurveyResponse, 'PRODUCTION');
    
    console.log('DEVELOPMENT:');
    console.log(`  Total Rejected: ${devRejections.totalRejected}`);
    console.log(`  System Rejections: ${devRejections.systemRejections}`);
    console.log(`  Manual Rejections: ${devRejections.manualRejections}`);
    console.log(`  No Feedback: ${devRejections.noFeedback}`);
    
    console.log('\nPRODUCTION:');
    console.log(`  Total Rejected: ${prodRejections.totalRejected}`);
    console.log(`  System Rejections: ${prodRejections.systemRejections}`);
    console.log(`  Manual Rejections: ${prodRejections.manualRejections}`);
    console.log(`  No Feedback: ${prodRejections.noFeedback}`);

    // Sample rejected responses from production
    console.log('\n\n📋 Sample Rejected Responses (PRODUCTION):');
    console.log('-'.repeat(60));
    const sampleRejected = await ProdSurveyResponse.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      status: 'Rejected'
    }).limit(3).lean();
    
    sampleRejected.forEach((r, i) => {
      const feedback = (r.verificationData?.feedback || '').toLowerCase();
      const metadata = r.metadata || {};
      const isAutoRejected = metadata.autoRejected || 
                            metadata.isSystemRejection ||
                            feedback.includes('too short') || 
                            feedback.includes('system') || 
                            feedback.includes('auto');
      
      console.log(`\nResponse ${i+1}:`);
      console.log(`  ID: ${r._id}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Feedback: ${r.verificationData?.feedback || 'N/A'}`);
      console.log(`  Feedback (lowercase): ${feedback}`);
      console.log(`  metadata.autoRejected: ${metadata.autoRejected || 'N/A'}`);
      console.log(`  metadata.isSystemRejection: ${metadata.isSystemRejection || 'N/A'}`);
      console.log(`  Is System Rejection: ${isAutoRejected}`);
    });

    console.log('\n\n✅ Comparison complete!\n');

    await devConnection.close();
    await prodConnection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    if (devConnection) await devConnection.close();
    if (prodConnection) await prodConnection.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };



