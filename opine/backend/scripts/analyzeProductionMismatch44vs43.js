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

    // Calculate yesterday's date range (matching frontend logic)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Also check today
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    console.log('📅 Date Ranges:');
    console.log(`   Yesterday: ${yesterday.toISOString()} to ${yesterdayEnd.toISOString()}`);
    console.log(`   Today: ${today.toISOString()} to ${todayEnd.toISOString()}\n`);

    // Use TODAY since that's where we see 43 vs 44
    const dateStart = today;
    const dateEnd = todayEnd;

    console.log(`📅 Using date range: ${dateStart.toISOString()} to ${dateEnd.toISOString()}\n`);

    // Step 1: Get CATI responses matching TOP STATS calculation
    // Frontend filters: date range + status (Approved/Rejected/Pending_Approval) + interviewMode = CATI
    const topStatsResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: dateStart,
        $lte: dateEnd
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Step 1: TOP STATS - CATI Responses: ${topStatsResponses.length}\n`);

    // Step 2: Simulate BACKEND getCatiStats calculation
    // Backend gets responses with date filter, then processes them
    // The backend counts "Completed" for responses with status Approved/Rejected/Pending_Approval
    // But it only counts responses that have valid interviewers
    
    // Get all CATI responses (what backend would query)
    const backendResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: dateStart,
        $lte: dateEnd
      }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Step 2: BACKEND - All CATI Responses (any status): ${backendResponses.length}\n`);

    // Get all unique interviewer IDs
    const interviewerIds = new Set();
    backendResponses.forEach(r => {
      if (r.interviewer) {
        if (typeof r.interviewer === 'object' && r.interviewer._id) {
          interviewerIds.add(r.interviewer._id.toString());
        } else if (typeof r.interviewer === 'string' && mongoose.Types.ObjectId.isValid(r.interviewer)) {
          interviewerIds.add(r.interviewer);
        }
      }
    });

    // Check which interviewer IDs exist in User table
    let existingUserIds = new Set();
    if (interviewerIds.size > 0) {
      const interviewerIdArray = Array.from(interviewerIds).map(id => new mongoose.Types.ObjectId(id));
      const existingUsers = await User.find({
        _id: { $in: interviewerIdArray }
      }).select('_id').lean();

      existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
    }

    // Count "Completed" - backend logic
    // Backend counts responses with status Approved/Rejected/Pending_Approval that have valid interviewers
    let backendCompletedCount = 0;
    const completedResponses = [];

    backendResponses.forEach(response => {
      const status = (response.status || '').toLowerCase().trim();
      
      // Check if status is one of the completed statuses
      if (status === 'rejected' || status === 'approved' || status === 'pending_approval') {
        // Check if has valid interviewer
        let interviewerId = null;
        if (response.interviewer) {
          if (typeof response.interviewer === 'object' && response.interviewer._id) {
            interviewerId = response.interviewer._id.toString();
          } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
            interviewerId = response.interviewer;
          }
        }

        if (interviewerId && existingUserIds.has(interviewerId)) {
          backendCompletedCount++;
          completedResponses.push(response);
        }
      }
    });

    console.log(`📊 Step 3: BACKEND "Completed" count: ${backendCompletedCount}\n`);

    // Step 4: Find the difference
    console.log('='.repeat(60));
    console.log('📊 COMPARISON:');
    console.log('='.repeat(60));
    console.log(`   Top CATI Responses (Frontend): ${topStatsResponses.length}`);
    console.log(`   Completed Column (Backend): ${backendCompletedCount}`);
    console.log(`   Difference: ${backendCompletedCount - topStatsResponses.length}\n`);

    // Find responses in Completed but not in Top Stats
    const topStatsIds = new Set(topStatsResponses.map(r => r._id.toString()));
    const completedIds = new Set(completedResponses.map(r => r._id.toString()));

    const inCompletedButNotTopStats = completedResponses.filter(r => !topStatsIds.has(r._id.toString()));
    const inTopStatsButNotCompleted = topStatsResponses.filter(r => !completedIds.has(r._id.toString()));

    if (inCompletedButNotTopStats.length > 0) {
      console.log('⚠️  Responses in COMPLETED but NOT in TOP STATS:');
      console.log('='.repeat(60));
      inCompletedButNotTopStats.forEach((r, i) => {
        console.log(`   ${i + 1}. Response ObjectId: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Created At: ${r.createdAt}`);
        console.log(`      Interview Mode: ${r.interviewMode}`);
        const interviewerId = r.interviewer 
          ? (typeof r.interviewer === 'object' && r.interviewer._id 
              ? r.interviewer._id.toString() 
              : r.interviewer.toString())
          : 'null';
        console.log(`      Interviewer: ${interviewerId}`);
        console.log('');
      });
      console.log('📝 Response ObjectIds (comma-separated):');
      const ids = inCompletedButNotTopStats.map(r => r._id.toString()).join(', ');
      console.log(ids);
      console.log('');
    }

    if (inTopStatsButNotCompleted.length > 0) {
      console.log('⚠️  Responses in TOP STATS but NOT in COMPLETED:');
      console.log('='.repeat(60));
      inTopStatsButNotCompleted.forEach((r, i) => {
        console.log(`   ${i + 1}. Response ObjectId: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Created At: ${r.createdAt}`);
        console.log(`      Interview Mode: ${r.interviewMode}`);
        const interviewerId = r.interviewer 
          ? (typeof r.interviewer === 'object' && r.interviewer._id 
              ? r.interviewer._id.toString() 
              : r.interviewer.toString())
          : 'null';
        console.log(`      Interviewer: ${interviewerId}`);
        console.log('');
      });
      console.log('📝 Response ObjectIds (comma-separated):');
      const ids = inTopStatsButNotCompleted.map(r => r._id.toString()).join(', ');
      console.log(ids);
      console.log('');
    }

    // Check if there are responses with different statuses
    console.log('📊 Status Breakdown:');
    const statusBreakdown = {};
    backendResponses.forEach(r => {
      const status = r.status || 'null';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });
    Object.keys(statusBreakdown).sort().forEach(status => {
      console.log(`   ${status}: ${statusBreakdown[status]}`);
    });
    console.log('');

    // Check if date filter might be the issue
    console.log('🔍 Checking if responses are in different date ranges...');
    const allResponses = [...topStatsResponses, ...completedResponses];
    const uniqueResponses = Array.from(new Map(allResponses.map(r => [r._id.toString(), r])).values());
    
    const byDate = {};
    uniqueResponses.forEach(r => {
      const date = new Date(r.createdAt).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(r);
    });

    Object.keys(byDate).sort().forEach(date => {
      console.log(`   ${date}: ${byDate[date].length} responses`);
    });
    console.log('');

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



