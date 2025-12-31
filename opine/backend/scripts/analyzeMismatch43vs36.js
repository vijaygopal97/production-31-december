/**
 * Analyze the mismatch between top count (43) and completed count (36)
 * Check all responses and their statuses to find the 7 missing ones
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const analyzeMismatch = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Calculate yesterday's date range (in local time, then convert to UTC)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log('📅 Date Range (Yesterday - Local Time):');
    console.log(`   Start: ${yesterday.toISOString()}`);
    console.log(`   End: ${yesterdayEnd.toISOString()}`);
    console.log(`   Current time: ${now.toISOString()}\n`);
    
    // Get all CATI responses from yesterday
    const allCatiResponses = await SurveyResponse.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd }
    })
    .select('_id status knownCallStatus metadata.callStatus createdAt interviewer')
    .lean();
    
    console.log(`📊 Total CATI responses from yesterday: ${allCatiResponses.length}\n`);
    
    // Group by status
    const byStatus = {};
    allCatiResponses.forEach(resp => {
      const status = resp.status || 'null';
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status].push(resp);
    });
    
    console.log('📋 Responses by Status:');
    Object.keys(byStatus).sort().forEach(status => {
      console.log(`   ${status}: ${byStatus[status].length}`);
      if (byStatus[status].length <= 10) {
        console.log(`      IDs: ${byStatus[status].map(r => r._id.toString()).join(', ')}`);
      }
    });
    
    // Check top filter count
    const topFilterResponses = allCatiResponses.filter(r => 
      r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Pending_Approval'
    );
    
    console.log(`\n📊 Top Filter Count (Approved + Rejected + Pending_Approval): ${topFilterResponses.length}`);
    console.log(`   Approved: ${byStatus['Approved']?.length || 0}`);
    console.log(`   Rejected: ${byStatus['Rejected']?.length || 0}`);
    console.log(`   Pending_Approval: ${byStatus['Pending_Approval']?.length || 0}`);
    
    // Check each response for call status
    console.log('\n\n🔍 Detailed Analysis of Top Filter Responses:');
    topFilterResponses.forEach((resp, index) => {
      const knownCallStatus = resp.knownCallStatus;
      const metadataCallStatus = resp.metadata?.callStatus;
      const hasCallConnected = 
        knownCallStatus === 'call_connected' || 
        knownCallStatus === 'success' ||
        (metadataCallStatus && (
          String(metadataCallStatus).toLowerCase().trim() === 'call_connected' ||
          String(metadataCallStatus).toLowerCase().trim() === 'success' ||
          String(metadataCallStatus).toLowerCase().trim() === 'connected'
        ));
      
      console.log(`\n${index + 1}. Response ID: ${resp._id}`);
      console.log(`   Status: ${resp.status}`);
      console.log(`   knownCallStatus: ${knownCallStatus || 'null'}`);
      console.log(`   metadata.callStatus: ${metadataCallStatus || 'null'}`);
      console.log(`   Has call_connected: ${hasCallConnected}`);
      console.log(`   Interviewer ID: ${resp.interviewer ? (typeof resp.interviewer === 'object' ? resp.interviewer._id || resp.interviewer : resp.interviewer) : 'N/A'}`);
    });
    
    // If we don't have 43 responses, check if there's a timezone issue
    if (allCatiResponses.length < 43) {
      console.log('\n\n⚠️  Found fewer than 43 responses. Checking broader date range...');
      
      // Check last 48 hours
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);
      
      const last48Hours = await SurveyResponse.find({
        survey: new mongoose.Types.ObjectId(SURVEY_ID),
        interviewMode: { $regex: /CATI/i },
        createdAt: { $gte: twoDaysAgo, $lte: now }
      })
      .select('_id status createdAt')
      .lean();
      
      console.log(`   Total CATI responses in last 48 hours: ${last48Hours.length}`);
      
      const last48ByStatus = {};
      last48Hours.forEach(resp => {
        const status = resp.status || 'null';
        last48ByStatus[status] = (last48ByStatus[status] || 0) + 1;
      });
      
      console.log('   Status breakdown:');
      Object.keys(last48ByStatus).sort().forEach(status => {
        console.log(`      ${status}: ${last48ByStatus[status]}`);
      });
    }
    
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
  analyzeMismatch();
}

module.exports = { analyzeMismatch };
