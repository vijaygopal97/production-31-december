/**
 * Find the ACTUAL 7 responses causing the mismatch
 * Compare frontend logic vs backend logic to find exact differences
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const findActualMismatch = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Calculate yesterday's date range (same as frontend)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log('📅 Date Range (Yesterday):');
    console.log(`   Start: ${yesterday.toISOString()}`);
    console.log(`   End: ${yesterdayEnd.toISOString()}\n`);
    
    // FRONTEND LOGIC: What the top count shows (43)
    // Filters: date = yesterday, status = Approved/Rejected/Pending_Approval, mode = CATI
    const frontendQuery = {
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    };
    
    const frontendResponses = await SurveyResponse.find(frontendQuery)
      .select('_id status interviewer createdAt knownCallStatus metadata.callStatus')
      .lean();
    
    console.log(`📊 FRONTEND Top Count: ${frontendResponses.length}`);
    console.log(`   (This is what shows as "CATI Responses - 43")\n`);
    
    // BACKEND LOGIC: What getCatiStats counts as "Completed"
    // It queries with date filter, then processes each response
    // It only counts responses that have an interviewer AND are in interviewerStatsMap
    // Let's simulate the backend logic
    
    // Step 1: Get all CATI responses with date filter (same as backend)
    const backendQuery = {
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd }
    };
    
    const allBackendResponses = await SurveyResponse.find(backendQuery)
      .select('_id status interviewer createdAt knownCallStatus metadata.callStatus')
      .populate('interviewer', 'firstName lastName memberId')
      .lean();
    
    console.log(`📊 BACKEND Total CATI Responses (with date filter): ${allBackendResponses.length}\n`);
    
    // Step 2: Filter to only Approved/Rejected/Pending_Approval (what backend counts as "Completed")
    const backendCompletedResponses = allBackendResponses.filter(r => 
      r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Pending_Approval'
    );
    
    console.log(`📊 BACKEND Completed Responses (Approved/Rejected/Pending_Approval): ${backendCompletedResponses.length}\n`);
    
    // Step 3: Check which ones have interviewer (backend skips ones without)
    const withInterviewer = backendCompletedResponses.filter(r => {
      if (!r.interviewer) return false;
      if (typeof r.interviewer === 'object' && !r.interviewer._id) return false;
      return true;
    });
    
    const withoutInterviewer = backendCompletedResponses.filter(r => {
      if (!r.interviewer) return true;
      if (typeof r.interviewer === 'object' && !r.interviewer._id) return true;
      return false;
    });
    
    console.log(`📊 Backend Completed WITH interviewer: ${withInterviewer.length}`);
    console.log(`📊 Backend Completed WITHOUT interviewer: ${withoutInterviewer.length}\n`);
    
    // Step 4: Compare frontend vs backend
    const frontendIds = new Set(frontendResponses.map(r => r._id.toString()));
    const backendIds = new Set(withInterviewer.map(r => r._id.toString()));
    
    const inFrontendButNotBackend = frontendResponses.filter(r => !backendIds.has(r._id.toString()));
    const inBackendButNotFrontend = withInterviewer.filter(r => !frontendIds.has(r._id.toString()));
    
    console.log(`\n🔍 COMPARISON:`);
    console.log(`   Frontend count: ${frontendResponses.length}`);
    console.log(`   Backend count (with interviewer): ${withInterviewer.length}`);
    console.log(`   Difference: ${frontendResponses.length - withInterviewer.length}\n`);
    
    if (inFrontendButNotBackend.length > 0) {
      console.log(`❌ Responses in FRONTEND but NOT in BACKEND (${inFrontendButNotBackend.length}):`);
      console.log('='.repeat(80));
      inFrontendButNotBackend.forEach((resp, index) => {
        const interviewerInfo = resp.interviewer ? 
          (typeof resp.interviewer === 'object' ? 
            (resp.interviewer._id ? resp.interviewer._id.toString() : 'NO_ID') : 
            resp.interviewer.toString()) : 
          'NULL';
        console.log(`\n${index + 1}. Response ID: ${resp._id}`);
        console.log(`   Status: ${resp.status}`);
        console.log(`   Interviewer: ${interviewerInfo}`);
        console.log(`   Created At: ${resp.createdAt}`);
        console.log(`   knownCallStatus: ${resp.knownCallStatus || 'null'}`);
        console.log(`   metadata.callStatus: ${resp.metadata?.callStatus || 'null'}`);
      });
      console.log('\n' + '='.repeat(80));
      console.log(`\n📝 Object IDs: ${inFrontendButNotBackend.map(r => r._id.toString()).join(', ')}\n`);
    }
    
    if (inBackendButNotFrontend.length > 0) {
      console.log(`⚠️  Responses in BACKEND but NOT in FRONTEND (${inBackendButNotFrontend.length}):`);
      inBackendButNotFrontend.forEach((resp, index) => {
        console.log(`   ${index + 1}. ID: ${resp._id}, Status: ${resp.status}`);
      });
    }
    
    // Step 5: Check if there's an interviewer filter being applied
    console.log('\n\n🔍 Checking for interviewer filter differences...');
    console.log(`   All frontend responses have interviewer: ${frontendResponses.every(r => r.interviewer)}`);
    console.log(`   Frontend responses without interviewer: ${frontendResponses.filter(r => !r.interviewer).length}`);
    
    // Step 6: Check status breakdown
    const frontendStatusBreakdown = {};
    frontendResponses.forEach(r => {
      frontendStatusBreakdown[r.status] = (frontendStatusBreakdown[r.status] || 0) + 1;
    });
    
    const backendStatusBreakdown = {};
    withInterviewer.forEach(r => {
      backendStatusBreakdown[r.status] = (backendStatusBreakdown[r.status] || 0) + 1;
    });
    
    console.log('\n📊 Status Breakdown:');
    console.log('   FRONTEND:');
    Object.keys(frontendStatusBreakdown).sort().forEach(status => {
      console.log(`      ${status}: ${frontendStatusBreakdown[status]}`);
    });
    console.log('   BACKEND (with interviewer):');
    Object.keys(backendStatusBreakdown).sort().forEach(status => {
      console.log(`      ${status}: ${backendStatusBreakdown[status]}`);
    });
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  findActualMismatch();
}

module.exports = { findActualMismatch };
