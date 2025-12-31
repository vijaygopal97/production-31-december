/**
 * Analyze Reports Page Mismatch
 * This script will help identify why there's a mismatch between:
 * - Top CATI Response count (43 for Today)
 * - Interviewer Performance "Completed" count (100s)
 * - "Processing in Batch" count (incorrect numbers)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const analyzeMismatch = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const QCBatch = require('../models/QCBatch');
    
    // Calculate today's date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('📅 Date Range:');
    console.log(`   Today start: ${today.toISOString()}`);
    console.log(`   Today end: ${tomorrow.toISOString()}\n`);
    
    // 1. Top CATI Response Count (what frontend shows)
    const topCatiCount = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: today, $lt: tomorrow },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    });
    console.log('📊 TOP CATI RESPONSE COUNT (Frontend calculation):');
    console.log(`   Filter: Today + Approved+Rejected+Pending`);
    console.log(`   Count: ${topCatiCount}\n`);
    
    // 2. All-time CATI responses (what backend might be counting)
    const allTimeCati = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i }
    });
    console.log('📊 ALL-TIME CATI RESPONSES:');
    console.log(`   Count: ${allTimeCati}\n`);
    
    // 3. Today's CATI responses by status
    const todayByStatus = await SurveyResponse.aggregate([
      {
        $match: {
          survey: mongoose.Types.ObjectId(SURVEY_ID),
          interviewMode: { $regex: /CATI/i },
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('📊 TODAY\'S CATI RESPONSES BY STATUS:');
    todayByStatus.forEach(s => {
      console.log(`   ${s._id || 'null'}: ${s.count}`);
    });
    console.log();
    
    // 4. Check "Completed" calculation logic
    // Completed = Approved + Rejected + Pending_Approval with call_connected
    const todayApproved = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'Approved'
    });
    
    const todayRejected = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'Rejected'
    });
    
    const todayPending = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'Pending_Approval'
    });
    
    const todayCallConnected = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      createdAt: { $gte: today, $lt: tomorrow },
      $or: [
        { knownCallStatus: { $in: ['success', 'call_connected'] } },
        { 'metadata.callStatus': { $in: ['success', 'call_connected', 'connected'] } }
      ]
    });
    
    console.log('📊 "COMPLETED" BREAKDOWN (Backend logic):');
    console.log(`   Today Approved: ${todayApproved}`);
    console.log(`   Today Rejected: ${todayRejected}`);
    console.log(`   Today Pending_Approval: ${todayPending}`);
    console.log(`   Today call_connected: ${todayCallConnected}`);
    console.log(`   Total "Completed" (Approved+Rejected+call_connected): ${todayApproved + todayRejected + todayCallConnected}\n`);
    
    // 5. Check "Processing in Batch" for a specific interviewer (Manti Mondal)
    const mantiUser = await mongoose.model('User', new mongoose.Schema({}, { strict: false }))
      .findOne({ 
        $or: [
          { firstName: 'Manti', lastName: 'Mondal' },
          { firstName: /Manti/i, lastName: /Mondal/i }
        ]
      })
      .select('_id firstName lastName memberId')
      .lean();
    
    if (mantiUser) {
      console.log(`📊 MANTI MONDAL ANALYSIS:`);
      console.log(`   User ID: ${mantiUser._id}`);
      console.log(`   Member ID: ${mantiUser.memberId}\n`);
      
      // All-time responses
      const mantiAllTime = await SurveyResponse.countDocuments({
        survey: SURVEY_ID,
        interviewer: mantiUser._id,
        interviewMode: { $regex: /CATI/i }
      });
      
      // Today's responses
      const mantiToday = await SurveyResponse.countDocuments({
        survey: SURVEY_ID,
        interviewer: mantiUser._id,
        interviewMode: { $regex: /CATI/i },
        createdAt: { $gte: today, $lt: tomorrow }
      });
      
      // Today's Pending_Approval
      const mantiTodayPending = await SurveyResponse.countDocuments({
        survey: SURVEY_ID,
        interviewer: mantiUser._id,
        interviewMode: { $regex: /CATI/i },
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Pending_Approval'
      });
      
      // Today's Pending_Approval with qcBatch
      const mantiTodayPendingWithBatch = await SurveyResponse.countDocuments({
        survey: SURVEY_ID,
        interviewer: mantiUser._id,
        interviewMode: { $regex: /CATI/i },
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Pending_Approval',
        qcBatch: { $exists: true, $ne: null }
      });
      
      // Get actual batch details
      const mantiResponses = await SurveyResponse.find({
        survey: SURVEY_ID,
        interviewer: mantiUser._id,
        interviewMode: { $regex: /CATI/i },
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Pending_Approval',
        qcBatch: { $exists: true, $ne: null }
      })
      .select('_id qcBatch status')
      .lean();
      
      const batchIds = [...new Set(mantiResponses.map(r => {
        if (typeof r.qcBatch === 'object' && r.qcBatch._id) return r.qcBatch._id.toString();
        return r.qcBatch?.toString();
      }).filter(Boolean))];
      
      const batches = await QCBatch.find({ _id: { $in: batchIds } })
        .select('_id status responses')
        .lean();
      
      console.log(`   All-time responses: ${mantiAllTime}`);
      console.log(`   Today's responses: ${mantiToday}`);
      console.log(`   Today's Pending_Approval: ${mantiTodayPending}`);
      console.log(`   Today's Pending_Approval with batch: ${mantiTodayPendingWithBatch}`);
      console.log(`   Batch IDs: ${batchIds.join(', ')}`);
      console.log(`   Batch statuses: ${batches.map(b => `${b._id}: ${b.status} (${b.responses?.length || 0} responses)`).join(', ')}\n`);
      
      // Count responses in "collecting" batches
      const collectingBatches = batches.filter(b => b.status === 'collecting');
      const processingBatches = batches.filter(b => b.status === 'processing');
      const mantiInCollecting = mantiResponses.filter(r => {
        const batchId = typeof r.qcBatch === 'object' && r.qcBatch._id 
          ? r.qcBatch._id.toString() 
          : r.qcBatch?.toString();
        return collectingBatches.some(b => b._id.toString() === batchId);
      }).length;
      
      const mantiInProcessing = mantiResponses.filter(r => {
        const batchId = typeof r.qcBatch === 'object' && r.qcBatch._id 
          ? r.qcBatch._id.toString() 
          : r.qcBatch?.toString();
        return processingBatches.some(b => b._id.toString() === batchId);
      }).length;
      
      console.log(`   Responses in "collecting" batches: ${mantiInCollecting}`);
      console.log(`   Responses in "processing" batches: ${mantiInProcessing}`);
      console.log(`   Expected "Processing in Batch": ${mantiInCollecting + mantiInProcessing}\n`);
    }
    
    // 6. Check if date filter is being applied in backend
    console.log('📊 BACKEND DATE FILTER CHECK:');
    console.log('   The backend getCatiStats API uses:');
    console.log('   - startDate and endDate from query params (catiFilters.startDate/endDate)');
    console.log('   - If these are null/empty, NO date filter is applied');
    console.log('   - This means it returns ALL responses (all time)\n');
    
    // 7. Check all-time "Completed" count
    const allTimeApproved = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      status: 'Approved'
    });
    
    const allTimeRejected = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      status: 'Rejected'
    });
    
    const allTimeCallConnected = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      interviewMode: { $regex: /CATI/i },
      $or: [
        { knownCallStatus: { $in: ['success', 'call_connected'] } },
        { 'metadata.callStatus': { $in: ['success', 'call_connected', 'connected'] } }
      ]
    });
    
    console.log('📊 ALL-TIME "COMPLETED" COUNT (What backend shows if no date filter):');
    console.log(`   All-time Approved: ${allTimeApproved}`);
    console.log(`   All-time Rejected: ${allTimeRejected}`);
    console.log(`   All-time call_connected: ${allTimeCallConnected}`);
    console.log(`   Total "Completed": ${allTimeApproved + allTimeRejected + allTimeCallConnected}\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  analyzeMismatch();
}

module.exports = { analyzeMismatch };
