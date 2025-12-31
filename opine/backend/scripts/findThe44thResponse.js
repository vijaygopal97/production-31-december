const mongoose = require('mongoose');

const PROD_MONGODB_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function findThe44th() {
  try {
    console.log('🔌 Connecting to Production Database...\n');
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to Production MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Check both today and yesterday, and also check a wider range
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

    // Get all CATI responses with Approved/Rejected/Pending_Approval from last 2 days
    const allResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: yesterday,
        $lte: todayEnd
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt interviewer interviewMode')
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Total responses (last 2 days): ${allResponses.length}\n`);

    // Get all unique interviewer IDs
    const interviewerIds = new Set();
    allResponses.forEach(r => {
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

    // Separate by date
    const todayResponses = allResponses.filter(r => {
      const created = new Date(r.createdAt);
      return created >= today && created <= todayEnd;
    });

    const yesterdayResponses = allResponses.filter(r => {
      const created = new Date(r.createdAt);
      return created >= yesterday && created <= yesterdayEnd;
    });

    console.log(`📊 Today's responses: ${todayResponses.length}`);
    console.log(`📊 Yesterday's responses: ${yesterdayResponses.length}\n`);

    // Count responses with valid interviewers for today
    const todayWithValidInterviewer = todayResponses.filter(r => {
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

    console.log(`📊 Today's responses with valid interviewer: ${todayWithValidInterviewer.length}\n`);

    // List all today's responses with valid interviewers
    console.log('='.repeat(60));
    console.log('📋 ALL TODAY\'S RESPONSES WITH VALID INTERVIEWER:');
    console.log('='.repeat(60));
    todayWithValidInterviewer.forEach((r, i) => {
      const interviewerId = r.interviewer 
        ? (typeof r.interviewer === 'object' && r.interviewer._id 
            ? r.interviewer._id.toString() 
            : r.interviewer.toString())
        : 'null';
      console.log(`${i + 1}. Response: ${r._id}`);
      console.log(`   Status: "${r.status}" (length: ${(r.status || '').length})`);
      console.log(`   Created: ${r.createdAt}`);
      console.log(`   Interviewer: ${interviewerId}`);
      console.log('');
    });

    // Check for any responses that might have status with extra whitespace
    const statusVariations = new Map();
    todayWithValidInterviewer.forEach(r => {
      const status = r.status || '';
      const trimmed = status.trim();
      const normalized = trimmed.toLowerCase();
      if (!statusVariations.has(normalized)) {
        statusVariations.set(normalized, []);
      }
      statusVariations.get(normalized).push({ id: r._id, original: status, trimmed: trimmed });
    });

    console.log('📊 Status variations:');
    statusVariations.forEach((variations, normalized) => {
      if (variations.length > 0) {
        const uniqueOriginals = [...new Set(variations.map(v => v.original))];
        if (uniqueOriginals.length > 1) {
          console.log(`   ${normalized}: ${uniqueOriginals.join(', ')}`);
        }
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

findThe44th();



