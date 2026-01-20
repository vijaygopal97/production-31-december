/**
 * Verify that test account cleanup was successful
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');

const TEST_ACCOUNTS = {
  qualityAgent: 'adarshquality123@gmail.com',
  catiInterviewer: 'vishalinterviewer@gmail.com',
  capiInterviewer: 'ajithinterviewer@gmail.com'
};

async function verifyCleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find test user IDs
    const qualityAgent = await User.findOne({ email: TEST_ACCOUNTS.qualityAgent }).select('_id email').lean();
    const catiInterviewer = await User.findOne({ email: TEST_ACCOUNTS.catiInterviewer }).select('_id email').lean();
    const capiInterviewer = await User.findOne({ email: TEST_ACCOUNTS.capiInterviewer }).select('_id email').lean();

    console.log('🔍 Verifying cleanup...\n');

    // Check reviews
    if (qualityAgent) {
      const stillReviewed = await SurveyResponse.countDocuments({
        'verificationData.reviewer': qualityAgent._id,
        status: { $in: ['Approved', 'Rejected'] }
      });
      console.log(`📊 Reviews by test quality agent (Approved/Rejected): ${stillReviewed}`);
      if (stillReviewed === 0) {
        console.log('   ✅ All reviews successfully reverted!\n');
      } else {
        console.log(`   ⚠️  ${stillReviewed} reviews still need reverting\n`);
      }
    }

    // Check responses
    const interviewerIds = [];
    if (catiInterviewer) interviewerIds.push(catiInterviewer._id);
    if (capiInterviewer) interviewerIds.push(capiInterviewer._id);

    if (interviewerIds.length > 0) {
      const remainingResponses = await SurveyResponse.countDocuments({
        interviewer: { $in: interviewerIds }
      });
      console.log(`📊 Responses created by test interviewers: ${remainingResponses}`);
      if (remainingResponses === 0) {
        console.log('   ✅ All test responses successfully deleted!\n');
      } else {
        console.log(`   ⚠️  ${remainingResponses} test responses still exist\n`);
      }
    }

    console.log('✅ Verification complete!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyCleanup();




