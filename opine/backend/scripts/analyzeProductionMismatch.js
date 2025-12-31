const mongoose = require('mongoose');

const PROD_MONGODB_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function analyzeMismatch() {
  try {
    console.log('🔌 Connecting to Production Database...\n');
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to Production MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Check both today and yesterday, and also all responses
    const now = new Date();
    
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    console.log('📅 Checking responses from TODAY and YESTERDAY, and ALL responses:\n');
    console.log(`   Today: ${today.toISOString()} to ${todayEnd.toISOString()}`);
    console.log(`   Yesterday: ${yesterday.toISOString()} to ${yesterdayEnd.toISOString()}\n`);

    // Step 1: Get ALL CATI responses with Approved/Rejected/Pending_Approval (no date filter)
    const allCatiResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Step 1: ALL CATI Responses (Approved/Rejected/Pending_Approval): ${allCatiResponses.length}\n`);

    // Also check today and yesterday separately
    const todayResponses = allCatiResponses.filter(r => {
      const created = new Date(r.createdAt);
      return created >= today && created <= todayEnd;
    });

    const yesterdayResponses = allCatiResponses.filter(r => {
      const created = new Date(r.createdAt);
      return created >= yesterday && created <= yesterdayEnd;
    });

    console.log(`   Today's responses: ${todayResponses.length}`);
    console.log(`   Yesterday's responses: ${yesterdayResponses.length}\n`);

    // Step 2: Categorize responses
    const responsesWithValidInterviewer = [];
    const responsesWithoutInterviewer = [];
    const responsesWithOrphanedInterviewer = [];

    // Get all unique interviewer IDs
    const interviewerIds = new Set();
    allCatiResponses.forEach(r => {
      if (r.interviewer) {
        if (typeof r.interviewer === 'object' && r.interviewer._id) {
          interviewerIds.add(r.interviewer._id.toString());
        } else if (typeof r.interviewer === 'string' && mongoose.Types.ObjectId.isValid(r.interviewer)) {
          interviewerIds.add(r.interviewer);
        }
      }
    });

    // Check which interviewer IDs exist in User table
    if (interviewerIds.size > 0) {
      const interviewerIdArray = Array.from(interviewerIds).map(id => new mongoose.Types.ObjectId(id));
      const existingUsers = await User.find({
        _id: { $in: interviewerIdArray }
      }).select('_id').lean();

      const existingUserIds = new Set(existingUsers.map(u => u._id.toString()));

      // Categorize responses
      allCatiResponses.forEach(response => {
        let interviewerId = null;
        
        if (response.interviewer) {
          if (typeof response.interviewer === 'object' && response.interviewer._id) {
            interviewerId = response.interviewer._id.toString();
          } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
            interviewerId = response.interviewer;
          }
        }

        if (!interviewerId) {
          responsesWithoutInterviewer.push(response);
        } else if (!existingUserIds.has(interviewerId)) {
          responsesWithOrphanedInterviewer.push(response);
        } else {
          responsesWithValidInterviewer.push(response);
        }
      });
    } else {
      // All responses have no interviewer
      allCatiResponses.forEach(r => {
        responsesWithoutInterviewer.push(r);
      });
    }

    console.log('📊 Response Categorization:');
    console.log(`   ✅ With valid interviewer (exists in User table): ${responsesWithValidInterviewer.length}`);
    console.log(`   ❌ Without interviewer field: ${responsesWithoutInterviewer.length}`);
    console.log(`   ⚠️  With orphaned interviewer (ObjectId doesn't exist in User table): ${responsesWithOrphanedInterviewer.length}\n`);

    // Step 3: Simulate BACKEND getCatiStats calculation
    // Backend would only process responses with valid interviewers
    const backendProcessableResponses = responsesWithValidInterviewer;
    
    // Count "Completed" - same logic as backend
    let backendCompletedCount = 0;
    backendProcessableResponses.forEach(response => {
      const status = (response.status || '').toLowerCase().trim();
      if (status === 'rejected' || status === 'approved' || status === 'pending_approval') {
        backendCompletedCount++;
      }
    });

    console.log(`🔍 Step 3: BACKEND "Completed" count: ${backendCompletedCount}\n`);

    // Step 4: Summary
    console.log('='.repeat(60));
    console.log('📊 FINAL SUMMARY:');
    console.log('='.repeat(60));
    console.log(`   Top CATI Responses (Frontend): ${allCatiResponses.length}`);
    console.log(`   Completed Column (Backend): ${backendCompletedCount}`);
    console.log(`   Difference: ${allCatiResponses.length - backendCompletedCount}\n`);

    // List problematic responses
    if (responsesWithoutInterviewer.length > 0) {
      console.log('='.repeat(60));
      console.log('❌ Responses WITHOUT Interviewer Field:');
      console.log('='.repeat(60));
      responsesWithoutInterviewer.forEach((r, i) => {
        console.log(`   ${i + 1}. Response ObjectId: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Created At: ${r.createdAt}`);
        console.log('');
      });
      console.log('📝 Response ObjectIds (comma-separated):');
      const ids = responsesWithoutInterviewer.map(r => r._id.toString()).join(', ');
      console.log(ids);
      console.log('');
      console.log('📝 Response ObjectIds (one per line):');
      responsesWithoutInterviewer.forEach(r => {
        console.log(r._id.toString());
      });
      console.log('');
    }

    if (responsesWithOrphanedInterviewer.length > 0) {
      console.log('='.repeat(60));
      console.log('⚠️  Responses WITH Orphaned Interviewer (ObjectId doesn\'t exist in User table):');
      console.log('='.repeat(60));
      responsesWithOrphanedInterviewer.forEach((r, i) => {
        const interviewerId = typeof r.interviewer === 'object' && r.interviewer._id 
          ? r.interviewer._id.toString() 
          : r.interviewer;
        console.log(`   ${i + 1}. Response ObjectId: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Created At: ${r.createdAt}`);
        console.log(`      Interviewer ObjectId: ${interviewerId}`);
        console.log('');
      });
      console.log('📝 Response ObjectIds (comma-separated):');
      const ids = responsesWithOrphanedInterviewer.map(r => r._id.toString()).join(', ');
      console.log(ids);
      console.log('');
      console.log('📝 Response ObjectIds (one per line):');
      responsesWithOrphanedInterviewer.forEach(r => {
        console.log(r._id.toString());
      });
      console.log('');
    }

    if (responsesWithoutInterviewer.length === 0 && responsesWithOrphanedInterviewer.length === 0) {
      console.log('✅ All responses have valid interviewers!');
      console.log('   The mismatch might be due to:');
      console.log('   1. Date filter differences between frontend and backend');
      console.log('   2. Project manager filtering (if user is a project manager)');
      console.log('   3. Other filtering logic in the backend\n');
    }

    await mongoose.disconnect();
    console.log('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

analyzeMismatch();



