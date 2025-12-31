/**
 * Find CATI responses from December 13, 2025 that were rejected with "No Audio"
 * 
 * This script queries the production database to find all CATI responses
 * from Dec 13, 2025 that have status 'Rejected' and feedback containing "No Audio"
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const TARGET_DATE = new Date('2025-12-13T00:00:00.000Z');
const TARGET_DATE_END = new Date('2025-12-13T23:59:59.999Z');

const findRejectedCATINoAudio = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Finding CATI responses from Dec 13, 2025 rejected with "No Audio"...');
    console.log(`   Date range: ${TARGET_DATE.toISOString()} to ${TARGET_DATE_END.toISOString()}\n`);

    // Find all rejected CATI responses from Dec 13, 2025
    const rejectedCATIResponses = await SurveyResponse.find({
      interviewMode: 'cati',
      status: 'Rejected',
      createdAt: {
        $gte: TARGET_DATE,
        $lte: TARGET_DATE_END
      }
    })
    .select('_id responseId sessionId status createdAt interviewMode verificationData.feedback verificationData.reviewer verificationData.reviewedAt survey interviewer')
    .populate('survey', 'surveyName')
    .populate('interviewer', 'firstName lastName email memberId')
    .lean();

    console.log(`📊 Found ${rejectedCATIResponses.length} rejected CATI responses from Dec 13, 2025\n`);

    // Filter for "No Audio" in feedback
    const noAudioResponses = rejectedCATIResponses.filter(response => {
      const feedback = response.verificationData?.feedback || '';
      return feedback.toLowerCase().includes('no audio') || 
             feedback.toLowerCase().includes('noaudio') ||
             feedback.toLowerCase().includes('no-audio');
    });

    console.log(`📊 Found ${noAudioResponses.length} responses rejected with "No Audio" reason\n`);

    if (noAudioResponses.length === 0) {
      console.log('✅ No responses found with "No Audio" rejection reason.\n');
      
      // Show all rejected responses for reference
      if (rejectedCATIResponses.length > 0) {
        console.log('📋 All rejected CATI responses from Dec 13, 2025 (for reference):');
        rejectedCATIResponses.forEach((resp, idx) => {
          const feedback = resp.verificationData?.feedback || 'No feedback';
          console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}`);
          console.log(`      Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`);
        });
        console.log();
      }
      
      await mongoose.disconnect();
      return;
    }

    // Display the list
    console.log('📋 List of CATI responses rejected with "No Audio" on Dec 13, 2025:');
    console.log('================================================================================\n');

    noAudioResponses.forEach((response, idx) => {
      console.log(`${idx + 1}. Response ID: ${response.responseId || response._id}`);
      console.log(`   Session ID: ${response.sessionId}`);
      console.log(`   Created At: ${response.createdAt}`);
      console.log(`   Interview Mode: ${response.interviewMode}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Survey: ${response.survey?.surveyName || 'N/A'} (${response.survey?._id || 'N/A'})`);
      console.log(`   Interviewer: ${response.interviewer?.firstName || ''} ${response.interviewer?.lastName || ''} (${response.interviewer?.memberId || 'N/A'}) - ${response.interviewer?.email || 'N/A'}`);
      console.log(`   Reviewer: ${response.verificationData?.reviewer || 'Auto-rejected'}`);
      console.log(`   Reviewed At: ${response.verificationData?.reviewedAt || 'N/A'}`);
      console.log(`   Feedback: ${response.verificationData?.feedback || 'No feedback'}`);
      console.log();
    });

    // Summary
    console.log('📊 Summary:');
    console.log('================================================================================');
    console.log(`   Total rejected CATI responses (Dec 13, 2025): ${rejectedCATIResponses.length}`);
    console.log(`   Rejected with "No Audio": ${noAudioResponses.length}`);
    console.log('================================================================================\n');

    // Export to CSV format
    console.log('📄 CSV Format (for easy copy-paste):');
    console.log('Response ID,Session ID,Created At,Interviewer Name,Interviewer ID,Interviewer Email,Survey Name,Feedback');
    noAudioResponses.forEach((response) => {
      const interviewerName = `${response.interviewer?.firstName || ''} ${response.interviewer?.lastName || ''}`.trim();
      const interviewerId = response.interviewer?.memberId || 'N/A';
      const interviewerEmail = response.interviewer?.email || 'N/A';
      const surveyName = response.survey?.surveyName || 'N/A';
      const feedback = (response.verificationData?.feedback || 'No feedback').replace(/,/g, ';'); // Replace commas in feedback
      
      console.log(`${response.responseId || response._id},${response.sessionId},${response.createdAt},${interviewerName},${interviewerId},${interviewerEmail},${surveyName},${feedback}`);
    });
    console.log();

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  findRejectedCATINoAudio()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { findRejectedCATINoAudio };
