/**
 * Check CATI Respondent Queue and Verification Queue Status
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';

async function checkQueueStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const surveyObjectId = new mongoose.Types.ObjectId(SURVEY_ID);

    // ==================== CATI RESPONDENT QUEUE ====================
    console.log('📊 CATI RESPONDENT QUEUE STATUS:');
    console.log('=' .repeat(60));
    
    const totalCatiQueue = await CatiRespondentQueue.countDocuments({ survey: surveyObjectId });
    console.log(`   Total entries in queue: ${totalCatiQueue}`);
    
    if (totalCatiQueue > 0) {
      // Status breakdown
      const statusBreakdown = await CatiRespondentQueue.aggregate([
        { $match: { survey: surveyObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\n   Status Breakdown:');
      statusBreakdown.forEach(s => {
        const status = s._id || 'null';
        const count = s.count;
        const percentage = ((count / totalCatiQueue) * 100).toFixed(2);
        console.log(`     ${status.padEnd(20)}: ${count.toString().padStart(6)} (${percentage}%)`);
      });
      
      // Pending count (available for assignment)
      const pendingCati = await CatiRespondentQueue.countDocuments({ 
        survey: surveyObjectId, 
        status: 'pending' 
      });
      console.log(`\n   ✅ Available (pending): ${pendingCati}`);
      
      // Check for stuck entries (assigned/calling for >1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const stuckAssigned = await CatiRespondentQueue.countDocuments({
        survey: surveyObjectId,
        status: { $in: ['assigned', 'calling'] },
        updatedAt: { $lt: oneHourAgo }
      });
      
      if (stuckAssigned > 0) {
        console.log(`   ⚠️  Stuck entries (assigned/calling >1 hour): ${stuckAssigned}`);
      }
      
      // Recent activity
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentUpdates = await CatiRespondentQueue.countDocuments({
        survey: surveyObjectId,
        updatedAt: { $gte: tenMinutesAgo }
      });
      console.log(`   📈 Recent updates (last 10 min): ${recentUpdates}`);
    } else {
      console.log('   ⚠️  No entries in CATI queue!');
    }
    
    // ==================== SURVEY RESPONSES (VERIFICATION QUEUE) ====================
    console.log('\n\n📊 SURVEY RESPONSES - VERIFICATION QUEUE STATUS:');
    console.log('=' .repeat(60));
    
    const totalResponses = await SurveyResponse.countDocuments({ survey: surveyObjectId });
    console.log(`   Total responses: ${totalResponses}`);
    
    if (totalResponses > 0) {
      // Status breakdown
      const responseStatusBreakdown = await SurveyResponse.aggregate([
        { $match: { survey: surveyObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\n   Status Breakdown:');
      responseStatusBreakdown.forEach(s => {
        const status = s._id || 'null';
        const count = s.count;
        const percentage = ((count / totalResponses) * 100).toFixed(2);
        console.log(`     ${status.padEnd(20)}: ${count.toString().padStart(6)} (${percentage}%)`);
      });
      
      // Pending Approval details
      const pendingApproval = await SurveyResponse.countDocuments({ 
        survey: surveyObjectId,
        status: 'Pending_Approval'
      });
      console.log(`\n   Pending_Approval total: ${pendingApproval}`);
      
      // Available for assignment (not assigned or expired assignment)
      const now = new Date();
      const unassignedPending = await SurveyResponse.countDocuments({
        survey: surveyObjectId,
        status: 'Pending_Approval',
        $or: [
          { reviewAssignment: { $exists: false } },
          { 'reviewAssignment.assignedTo': null },
          { 'reviewAssignment.expiresAt': { $lt: now } }
        ]
      });
      
      console.log(`   ✅ Available for QC (unassigned/expired): ${unassignedPending}`);
      
      // Currently assigned
      const assignedPending = await SurveyResponse.countDocuments({
        survey: surveyObjectId,
        status: 'Pending_Approval',
        'reviewAssignment.assignedTo': { $ne: null },
        'reviewAssignment.expiresAt': { $gt: now }
      });
      
      console.log(`   🔒 Currently assigned (in review): ${assignedPending}`);
      
      // Stuck assignments (expired but not released)
      const expiredAssignments = await SurveyResponse.countDocuments({
        survey: surveyObjectId,
        status: 'Pending_Approval',
        'reviewAssignment.assignedTo': { $ne: null },
        'reviewAssignment.expiresAt': { $lt: now }
      });
      
      if (expiredAssignments > 0) {
        console.log(`   ⚠️  Expired assignments (should be available): ${expiredAssignments}`);
      }
      
      // Interview mode breakdown for pending
      if (pendingApproval > 0) {
        const modeBreakdown = await SurveyResponse.aggregate([
          { 
            $match: { 
              survey: surveyObjectId,
              status: 'Pending_Approval'
            } 
          },
          { 
            $group: { 
              _id: '$interviewMode', 
              count: { $sum: 1 } 
            } 
          },
          { $sort: { count: -1 } }
        ]);
        
        console.log('\n   Pending_Approval by Interview Mode:');
        modeBreakdown.forEach(m => {
          const mode = m._id || 'null';
          const count = m.count;
          console.log(`     ${mode.padEnd(10)}: ${count}`);
        });
      }
      
      // Recent activity
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentResponseUpdates = await SurveyResponse.countDocuments({
        survey: surveyObjectId,
        updatedAt: { $gte: tenMinutesAgo }
      });
      console.log(`\n   📈 Recent updates (last 10 min): ${recentResponseUpdates}`);
    } else {
      console.log('   ⚠️  No responses found!');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Queue status check complete\n');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkQueueStatus();




