/**
 * Check if test accounts are assigned to the survey
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Survey = require('../models/Survey');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const TEST_ACCOUNTS = {
  qualityAgent: 'adarshquality123@gmail.com',
  catiInterviewer: 'vishalinterviewer@gmail.com',
  capiInterviewer: 'ajithinterviewer@gmail.com',
  companyAdmin: 'ajayadarsh@gmail.com'
};

async function checkAssignments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const surveyObjectId = new mongoose.Types.ObjectId(SURVEY_ID);
    
    // Get survey
    const survey = await Survey.findById(surveyObjectId)
      .select('surveyName assignedInterviewers capiInterviewers catiInterviewers assignedQualityAgents company')
      .lean();
    
    if (!survey) {
      console.error('❌ Survey not found!');
      await mongoose.disconnect();
      return;
    }
    
    console.log(`📋 Survey: ${survey.surveyName}`);
    console.log(`   Company: ${survey.company}\n`);
    
    // Get test users
    const users = {};
    for (const [key, email] of Object.entries(TEST_ACCOUNTS)) {
      users[key] = await User.findOne({ email }).select('_id email firstName lastName userType company').lean();
      if (users[key]) {
        console.log(`✅ ${key}: ${users[key].email} (${users[key].userType}) - ID: ${users[key]._id}`);
      } else {
        console.log(`❌ ${key}: ${email} - NOT FOUND`);
      }
    }
    console.log('');
    
    // Check Quality Agent assignment
    console.log('📊 QUALITY AGENT ASSIGNMENT:');
    if (users.qualityAgent) {
      const qaAssigned = survey.assignedQualityAgents?.some(
        a => a.qualityAgent?.toString() === users.qualityAgent._id.toString() && 
             (a.status === 'assigned' || a.status === 'accepted')
      );
      if (qaAssigned) {
        console.log('   ✅ Assigned to survey');
        const assignment = survey.assignedQualityAgents.find(
          a => a.qualityAgent?.toString() === users.qualityAgent._id.toString()
        );
        console.log(`      Status: ${assignment.status}`);
        console.log(`      Assigned ACs: ${assignment.assignedACs?.length || 0}`);
      } else {
        console.log('   ❌ NOT assigned to survey');
      }
    }
    console.log('');
    
    // Check CATI Interviewer assignment
    console.log('📊 CATI INTERVIEWER ASSIGNMENT:');
    if (users.catiInterviewer) {
      const catiAssigned = survey.catiInterviewers?.some(
        a => a.interviewer?.toString() === users.catiInterviewer._id.toString() && 
             (a.status === 'assigned' || a.status === 'accepted')
      );
      if (catiAssigned) {
        console.log('   ✅ Assigned to survey');
        const assignment = survey.catiInterviewers.find(
          a => a.interviewer?.toString() === users.catiInterviewer._id.toString()
        );
        console.log(`      Status: ${assignment.status}`);
        console.log(`      Assigned ACs: ${assignment.assignedACs?.length || 0}`);
      } else {
        console.log('   ❌ NOT assigned to survey');
      }
    }
    console.log('');
    
    // Check CAPI Interviewer assignment
    console.log('📊 CAPI INTERVIEWER ASSIGNMENT:');
    if (users.capiInterviewer) {
      const capiAssigned = survey.capiInterviewers?.some(
        a => a.interviewer?.toString() === users.capiInterviewer._id.toString() && 
             (a.status === 'assigned' || a.status === 'accepted')
      );
      if (capiAssigned) {
        console.log('   ✅ Assigned to survey');
        const assignment = survey.capiInterviewers.find(
          a => a.interviewer?.toString() === users.capiInterviewer._id.toString()
        );
        console.log(`      Status: ${assignment.status}`);
        console.log(`      Assigned ACs: ${assignment.assignedACs?.length || 0}`);
      } else {
        console.log('   ❌ NOT assigned to survey');
      }
    }
    console.log('');
    
    // Check Company Admin
    console.log('📊 COMPANY ADMIN ACCESS:');
    if (users.companyAdmin) {
      const companyMatch = users.companyAdmin.company?.toString() === survey.company?.toString();
      if (companyMatch) {
        console.log('   ✅ Company matches survey company');
      } else {
        console.log('   ❌ Company does NOT match survey company');
        console.log(`      Admin company: ${users.companyAdmin.company}`);
        console.log(`      Survey company: ${survey.company}`);
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkAssignments();




