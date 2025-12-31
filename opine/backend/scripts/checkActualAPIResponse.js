const mongoose = require('mongoose');

const PROD_MONGODB_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function checkAPIResponse() {
  try {
    console.log('🔌 Connecting to Production Database...\n');
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to Production MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Use TODAY
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    console.log(`📅 Date Range: ${today.toISOString()} to ${todayEnd.toISOString()}\n`);

    // Simulate the exact backend query
    const dateFilter = {
      createdAt: {
        $gte: today,
        $lte: new Date(new Date(todayEnd).setHours(23, 59, 59, 999))
      }
    };

    const catiResponsesQuery = {
      survey: surveyObjectId,
      interviewMode: 'cati',
      ...dateFilter
    };

    let catiResponses = await SurveyResponse.find(catiResponsesQuery)
      .select('_id interviewer metadata callStatus responses totalTimeSpent status createdAt knownCallStatus')
      .lean();

    console.log(`📊 Backend query found ${catiResponses.length} CATI responses\n`);

    // Get all unique interviewer IDs from responses
    const interviewerIds = new Set();
    catiResponses.forEach(r => {
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

    // Build interviewer stats map exactly like backend
    const interviewerStatsMap = new Map();

    // Add all interviewers from responses
    catiResponses.forEach(response => {
      if (!response.interviewer) return;
      
      let interviewerId = null;
      if (typeof response.interviewer === 'object' && response.interviewer._id) {
        interviewerId = response.interviewer._id.toString();
      } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
        interviewerId = response.interviewer;
      }

      if (interviewerId && existingUserIds.has(interviewerId)) {
        if (!interviewerStatsMap.has(interviewerId)) {
          interviewerStatsMap.set(interviewerId, {
            interviewerId: interviewerId,
            completed: 0
          });
        }
      }
    });

    // Process responses exactly like backend
    catiResponses.forEach(response => {
      if (!response.interviewer) return;
      
      let interviewerId = null;
      if (typeof response.interviewer === 'object' && response.interviewer._id) {
        interviewerId = response.interviewer._id.toString();
      } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
        interviewerId = response.interviewer;
      }

      if (!interviewerId || !existingUserIds.has(interviewerId)) return;
      if (!interviewerStatsMap.has(interviewerId)) {
        // Add if missing (like our fix does)
        interviewerStatsMap.set(interviewerId, {
          interviewerId: interviewerId,
          completed: 0
        });
      }

      const stat = interviewerStatsMap.get(interviewerId);
      const responseStatus = response.status ? response.status.trim() : '';
      const normalizedResponseStatus = responseStatus.toLowerCase();

      // Count "Completed" - exact backend logic
      if (normalizedResponseStatus === 'rejected') {
        stat.completed += 1;
      } else if (normalizedResponseStatus === 'approved') {
        stat.completed += 1;
      } else if (normalizedResponseStatus === 'pending_approval') {
        stat.completed += 1;
      }
    });

    // Calculate total
    let totalCompleted = 0;
    const interviewerStats = [];
    interviewerStatsMap.forEach((stat, interviewerId) => {
      totalCompleted += stat.completed;
      interviewerStats.push({
        interviewerId: interviewerId,
        completed: stat.completed
      });
    });

    console.log('='.repeat(60));
    console.log('📊 BACKEND SIMULATION RESULTS:');
    console.log('='.repeat(60));
    console.log(`   Total "Completed" count: ${totalCompleted}`);
    console.log(`   Number of interviewers: ${interviewerStats.length}\n`);

    console.log('📊 Per-interviewer breakdown:');
    interviewerStats.sort((a, b) => b.completed - a.completed).forEach((stat, i) => {
      console.log(`   ${i + 1}. Interviewer ${stat.interviewerId}: ${stat.completed} completed`);
    });
    console.log('');

    // Check for any responses that might be counted multiple times
    const responseCounts = new Map();
    catiResponses.forEach(r => {
      const status = (r.status || '').trim().toLowerCase();
      if (status === 'rejected' || status === 'approved' || status === 'pending_approval') {
        const key = r._id.toString();
        responseCounts.set(key, (responseCounts.get(key) || 0) + 1);
      }
    });

    const duplicates = Array.from(responseCounts.entries()).filter(([id, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  Duplicate responses found:');
      duplicates.forEach(([id, count]) => {
        console.log(`   Response ${id}: counted ${count} times`);
      });
      console.log('');
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

checkAPIResponse();



