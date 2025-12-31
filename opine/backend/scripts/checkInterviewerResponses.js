/**
 * Check responses for a specific interviewer to debug filtering issue
 */

const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SURVEY_ID = '68fd1915d41841da463f0d46';
const MEMBER_ID = '186332'; // Biswanath Mahata

const checkInterviewerResponses = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find the interviewer by memberId
    console.log(`🔍 Finding interviewer with memberId: ${MEMBER_ID}...`);
    const interviewer = await User.findOne({
      memberId: MEMBER_ID
    }).lean();

    if (!interviewer) {
      console.log('❌ Interviewer not found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found interviewer: ${interviewer.firstName} ${interviewer.lastName}`);
    console.log(`   User ID: ${interviewer._id}`);
    console.log(`   Member ID: ${interviewer.memberId}`);
    console.log(`   Email: ${interviewer.email}\n`);

    // Find all responses for this interviewer and survey
    console.log(`🔍 Finding all responses for survey ${SURVEY_ID} and interviewer ${interviewer._id}...`);
    const allResponses = await SurveyResponse.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewer: interviewer._id
    })
    .select('_id responseId status createdAt interviewMode')
    .lean();

    console.log(`📊 Total responses found: ${allResponses.length}\n`);

    // Group by status
    const byStatus = {};
    allResponses.forEach(resp => {
      const status = resp.status || 'unknown';
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status].push(resp);
    });

    console.log('📊 Responses by status:');
    Object.keys(byStatus).forEach(status => {
      console.log(`   ${status}: ${byStatus[status].length}`);
    });
    console.log();

    // Check Approved, Rejected, Pending_Approval
    const approvedRejectedPending = allResponses.filter(r => 
      r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Pending_Approval'
    );
    console.log(`📊 Approved + Rejected + Pending_Approval: ${approvedRejectedPending.length}`);

    // Check just Approved
    const approved = allResponses.filter(r => r.status === 'Approved');
    console.log(`📊 Approved only: ${approved.length}\n`);

    // Show sample responses
    if (allResponses.length > 0) {
      console.log('📋 Sample responses (first 10):');
      allResponses.slice(0, 10).forEach((resp, idx) => {
        console.log(`   ${idx + 1}. Response ID: ${resp.responseId || resp._id}, Status: ${resp.status}, Created: ${resp.createdAt}`);
      });
      if (allResponses.length > 10) {
        console.log(`   ... and ${allResponses.length - 10} more\n`);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  checkInterviewerResponses();
}

module.exports = { checkInterviewerResponses };
