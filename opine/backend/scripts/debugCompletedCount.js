/**
 * Debug why "Completed" count (36) doesn't match top count (43)
 * This will help identify what's being excluded
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const debugCompletedCount = async () => {
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
    
    // Step 1: Get all responses that match top filter (what frontend shows)
    const topFilterQuery = {
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    };
    
    const topFilterResponses = await SurveyResponse.find(topFilterQuery)
      .select('_id status interviewer')
      .lean();
    
    console.log(`📊 Top Filter Count (Frontend): ${topFilterResponses.length}`);
    console.log(`   This is what the frontend shows as "CATI Responses"\n`);
    
    // Step 2: Simulate backend logic - get responses that would be counted as "Completed"
    // Backend counts: Approved + Rejected + Pending_Approval (regardless of call status)
    const backendCompletedQuery = {
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    };
    
    const backendCompletedResponses = await SurveyResponse.find(backendCompletedQuery)
      .select('_id status interviewer')
      .lean();
    
    console.log(`📊 Backend "Completed" Count: ${backendCompletedResponses.length}`);
    console.log(`   This should match the Interviewer Performance "Completed" total\n`);
    
    // Step 3: Find the difference
    const topFilterIds = new Set(topFilterResponses.map(r => r._id.toString()));
    const backendCompletedIds = new Set(backendCompletedResponses.map(r => r._id.toString()));
    
    const inTopButNotInBackend = topFilterResponses.filter(r => !backendCompletedIds.has(r._id.toString()));
    const inBackendButNotInTop = backendCompletedResponses.filter(r => !topFilterIds.has(r._id.toString()));
    
    console.log(`\n🔍 Difference Analysis:`);
    console.log(`   In Top Filter but NOT in Backend Completed: ${inTopButNotInBackend.length}`);
    console.log(`   In Backend Completed but NOT in Top Filter: ${inBackendButNotInTop.length}\n`);
    
    if (inTopButNotInBackend.length > 0) {
      console.log('❌ Responses in Top Filter but NOT counted in Backend "Completed":');
      inTopButNotInBackend.forEach((resp, index) => {
        console.log(`   ${index + 1}. ID: ${resp._id}, Status: ${resp.status}, Interviewer: ${resp.interviewer || 'N/A'}`);
      });
      console.log(`\n   Object IDs: ${inTopButNotInBackend.map(r => r._id.toString()).join(', ')}\n`);
    }
    
    if (inBackendButNotInTop.length > 0) {
      console.log('⚠️  Responses in Backend "Completed" but NOT in Top Filter:');
      inBackendButNotInTop.forEach((resp, index) => {
        console.log(`   ${index + 1}. ID: ${resp._id}, Status: ${resp.status}, Interviewer: ${resp.interviewer || 'N/A'}`);
      });
    }
    
    // Step 4: Check if there's an interviewer filter issue
    // The backend might be filtering by interviewer if there's a project manager or interviewer filter
    console.log('\n\n🔍 Checking for interviewer filter differences...');
    
    // Group by interviewer
    const byInterviewer = {};
    topFilterResponses.forEach(resp => {
      const interviewerId = resp.interviewer ? 
        (typeof resp.interviewer === 'object' ? resp.interviewer._id || resp.interviewer : resp.interviewer).toString() : 
        'no-interviewer';
      if (!byInterviewer[interviewerId]) {
        byInterviewer[interviewerId] = [];
      }
      byInterviewer[interviewerId].push(resp._id.toString());
    });
    
    console.log(`   Total unique interviewers in top filter: ${Object.keys(byInterviewer).length}`);
    console.log(`   Responses with no interviewer: ${byInterviewer['no-interviewer']?.length || 0}`);
    
    if (byInterviewer['no-interviewer'] && byInterviewer['no-interviewer'].length > 0) {
      console.log(`\n   ⚠️  Found ${byInterviewer['no-interviewer'].length} responses with no interviewer assigned:`);
      console.log(`      IDs: ${byInterviewer['no-interviewer'].join(', ')}`);
      console.log(`      These might be excluded from backend stats if interviewer filter is applied\n`);
    }
    
    // Step 5: Check status breakdown
    const statusBreakdown = {};
    topFilterResponses.forEach(resp => {
      const status = resp.status || 'null';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });
    
    console.log('\n📊 Status Breakdown (Top Filter):');
    Object.keys(statusBreakdown).sort().forEach(status => {
      console.log(`   ${status}: ${statusBreakdown[status]}`);
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
  debugCompletedCount();
}

module.exports = { debugCompletedCount };
