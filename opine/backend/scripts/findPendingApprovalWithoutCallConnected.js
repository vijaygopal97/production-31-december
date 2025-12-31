/**
 * Find Pending_Approval responses without call_connected status
 * This script will help identify responses that are marked as Pending_Approval
 * but don't have call_connected status
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const findPendingApprovalWithoutCallConnected = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Calculate yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log('📅 Date Range (Yesterday):');
    console.log(`   Start: ${yesterday.toISOString()}`);
    console.log(`   End: ${yesterdayEnd.toISOString()}\n`);
    
    // Find all Pending_Approval responses from yesterday
    const pendingApprovalResponses = await SurveyResponse.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: 'Pending_Approval'
    })
    .select('_id status knownCallStatus metadata.callStatus createdAt interviewer')
    .populate('interviewer', 'firstName lastName memberId')
    .lean();
    
    console.log(`📊 Total Pending_Approval responses from yesterday: ${pendingApprovalResponses.length}\n`);
    
    // Check each response for call_connected status
    const withoutCallConnected = [];
    const withCallConnected = [];
    
    pendingApprovalResponses.forEach(response => {
      const knownCallStatus = response.knownCallStatus;
      const metadataCallStatus = response.metadata?.callStatus;
      
      // Check if call_connected
      const isCallConnected = 
        knownCallStatus === 'call_connected' || 
        knownCallStatus === 'success' ||
        (metadataCallStatus && (
          String(metadataCallStatus).toLowerCase().trim() === 'call_connected' ||
          String(metadataCallStatus).toLowerCase().trim() === 'success' ||
          String(metadataCallStatus).toLowerCase().trim() === 'connected'
        ));
      
      if (isCallConnected) {
        withCallConnected.push(response);
      } else {
        withoutCallConnected.push({
          _id: response._id,
          status: response.status,
          knownCallStatus: knownCallStatus || 'null',
          metadataCallStatus: metadataCallStatus || 'null',
          createdAt: response.createdAt,
          interviewer: response.interviewer ? 
            `${response.interviewer.firstName} ${response.interviewer.lastName} (${response.interviewer.memberId || 'N/A'})` : 
            'N/A'
        });
      }
    });
    
    console.log(`✅ Pending_Approval WITH call_connected: ${withCallConnected.length}`);
    console.log(`❌ Pending_Approval WITHOUT call_connected: ${withoutCallConnected.length}\n`);
    
    if (withoutCallConnected.length > 0) {
      console.log('📋 Pending_Approval responses WITHOUT call_connected status:');
      console.log('='.repeat(80));
      withoutCallConnected.forEach((resp, index) => {
        console.log(`\n${index + 1}. Response ID: ${resp._id}`);
        console.log(`   Status: ${resp.status}`);
        console.log(`   knownCallStatus: ${resp.knownCallStatus}`);
        console.log(`   metadata.callStatus: ${resp.metadataCallStatus}`);
        console.log(`   Created At: ${resp.createdAt}`);
        console.log(`   Interviewer: ${resp.interviewer}`);
      });
      console.log('\n' + '='.repeat(80));
      console.log(`\n📝 Object IDs (comma-separated):`);
      console.log(withoutCallConnected.map(r => r._id).join(', '));
    } else {
      console.log('✅ All Pending_Approval responses have call_connected status');
    }
    
    // Also check for any other statuses that might be causing the mismatch
    console.log('\n\n🔍 Checking all CATI responses from yesterday by status:');
    const surveyObjectId = new mongoose.Types.ObjectId(SURVEY_ID);
    const allStatuses = await SurveyResponse.aggregate([
      {
        $match: {
          survey: surveyObjectId,
          interviewMode: { $regex: /CATI/i },
          createdAt: { $gte: yesterday, $lte: yesterdayEnd }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          sampleIds: { $push: '$_id' }
        }
      }
    ]);
    
    allStatuses.forEach(stat => {
      console.log(`\n   ${stat._id || 'null'}: ${stat.count}`);
      if (stat.count <= 10) {
        console.log(`      Sample IDs: ${stat.sampleIds.slice(0, 5).map(id => id.toString()).join(', ')}`);
      }
    });
    
    // Check the exact count that matches the top filter
    const topFilterCount = await SurveyResponse.countDocuments({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    });
    
    console.log(`\n\n📊 Top Filter Count (Approved + Rejected + Pending_Approval): ${topFilterCount}`);
    
    // Get breakdown
    const approvedCount = await SurveyResponse.countDocuments({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: 'Approved'
    });
    
    const rejectedCount = await SurveyResponse.countDocuments({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: 'Rejected'
    });
    
    const pendingApprovalCount = await SurveyResponse.countDocuments({
      survey: new mongoose.Types.ObjectId(SURVEY_ID),
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: yesterday, $lte: yesterdayEnd },
      status: 'Pending_Approval'
    });
    
    console.log(`   Approved: ${approvedCount}`);
    console.log(`   Rejected: ${rejectedCount}`);
    console.log(`   Pending_Approval: ${pendingApprovalCount}`);
    console.log(`   Total: ${approvedCount + rejectedCount + pendingApprovalCount}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  findPendingApprovalWithoutCallConnected();
}

module.exports = { findPendingApprovalWithoutCallConnected };
