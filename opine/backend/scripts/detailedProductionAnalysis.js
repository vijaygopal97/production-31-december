const mongoose = require('mongoose');

const PROD_MONGODB_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function detailedAnalysis() {
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

    // Get all CATI responses from today
    const allCatiResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: today,
        $lte: todayEnd
      }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Total CATI responses (any status): ${allCatiResponses.length}\n`);

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
    let existingUserIds = new Set();
    if (interviewerIds.size > 0) {
      const interviewerIdArray = Array.from(interviewerIds).map(id => new mongoose.Types.ObjectId(id));
      const existingUsers = await User.find({
        _id: { $in: interviewerIdArray }
      }).select('_id').lean();

      existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
    }

    // Simulate backend calculation exactly
    const interviewerStatsMap = new Map();
    
    // First, add all interviewers from responses
    allCatiResponses.forEach(response => {
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

    // Now process responses and count "Completed"
    allCatiResponses.forEach(response => {
      if (!response.interviewer) return;
      
      let interviewerId = null;
      if (typeof response.interviewer === 'object' && response.interviewer._id) {
        interviewerId = response.interviewer._id.toString();
      } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
        interviewerId = response.interviewer;
      }

      if (!interviewerId || !existingUserIds.has(interviewerId)) return;
      if (!interviewerStatsMap.has(interviewerId)) return;

      const stat = interviewerStatsMap.get(interviewerId);
      const responseStatus = response.status ? response.status.trim() : '';
      const normalizedResponseStatus = responseStatus.toLowerCase();

      // Count "Completed" - same logic as backend
      if (normalizedResponseStatus === 'rejected' || 
          normalizedResponseStatus === 'approved' || 
          normalizedResponseStatus === 'pending_approval') {
        stat.completed += 1;
      }
    });

    // Calculate total completed
    let totalCompleted = 0;
    interviewerStatsMap.forEach((stat, interviewerId) => {
      totalCompleted += stat.completed;
    });

    console.log(`📊 Simulated BACKEND "Completed" count: ${totalCompleted}\n`);

    // Get TOP STATS count
    const topStatsResponses = allCatiResponses.filter(r => {
      const status = (r.status || '').trim();
      return status === 'Approved' || status === 'Rejected' || status === 'Pending_Approval';
    });

    console.log(`📊 TOP STATS count: ${topStatsResponses.length}\n`);

    // Find the difference
    console.log('='.repeat(60));
    console.log('📊 COMPARISON:');
    console.log('='.repeat(60));
    console.log(`   Top CATI Responses: ${topStatsResponses.length}`);
    console.log(`   Completed Column: ${totalCompleted}`);
    console.log(`   Difference: ${totalCompleted - topStatsResponses.length}\n`);

    // Check if there are responses with valid interviewers that have the right status
    const responsesWithValidInterviewer = topStatsResponses.filter(r => {
      let interviewerId = null;
      if (r.interviewer) {
        if (typeof r.interviewer === 'object' && r.interviewer._id) {
          interviewerId = r.interviewer._id.toString();
        } else if (typeof r.interviewer === 'string' && mongoose.Types.ObjectId.isValid(r.interviewer)) {
          interviewerId = r.interviewer;
        }
      }
      return interviewerId && existingUserIds.has(interviewerId);
    });

    console.log(`📊 Responses with valid interviewer: ${responsesWithValidInterviewer.length}\n`);

    // Check for responses that might be counted differently
    const statusCounts = {};
    topStatsResponses.forEach(r => {
      const status = (r.status || '').trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Status breakdown (TOP STATS):');
    Object.keys(statusCounts).sort().forEach(status => {
      console.log(`   ${status}: ${statusCounts[status]}`);
    });
    console.log('');

    // Check if there are any responses with status variations
    const statusVariations = {};
    allCatiResponses.forEach(r => {
      const status = (r.status || '').trim();
      const normalized = status.toLowerCase();
      if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending_approval') {
        if (!statusVariations[normalized]) {
          statusVariations[normalized] = new Set();
        }
        statusVariations[normalized].add(status);
      }
    });

    console.log('📊 Status variations found:');
    Object.keys(statusVariations).forEach(normalized => {
      const variations = Array.from(statusVariations[normalized]);
      if (variations.length > 1) {
        console.log(`   ${normalized}: ${variations.join(', ')}`);
      }
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

detailedAnalysis();



