const mongoose = require('mongoose');

const PROD_MONGODB_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function findOrphanedResponses() {
  try {
    console.log('🔌 Connecting to Production Database...\n');
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to Production MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Get all CATI responses with Approved/Rejected/Pending_Approval status
    // We'll check all of them, not just today, to find all orphaned references
    console.log('🔍 Finding all CATI responses with Approved/Rejected/Pending_Approval status...\n');
    
    const allCatiResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Found ${allCatiResponses.length} total CATI responses (Approved/Rejected/Pending_Approval)\n`);

    // Get all unique interviewer IDs from responses
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

    console.log(`🔍 Found ${interviewerIds.size} unique interviewer IDs in responses\n`);

    // Check which interviewer IDs exist in User table
    const interviewerIdArray = Array.from(interviewerIds).map(id => new mongoose.Types.ObjectId(id));
    const existingUsers = await User.find({
      _id: { $in: interviewerIdArray }
    }).select('_id').lean();

    const existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
    console.log(`✅ Found ${existingUserIds.size} interviewers that exist in User table`);
    console.log(`❌ Missing ${interviewerIdArray.length - existingUserIds.size} interviewers from User table\n`);

    // Find responses with orphaned interviewers
    const responsesWithOrphanedInterviewer = [];

    allCatiResponses.forEach(response => {
      let interviewerId = null;
      
      if (response.interviewer) {
        if (typeof response.interviewer === 'object' && response.interviewer._id) {
          interviewerId = response.interviewer._id.toString();
        } else if (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer)) {
          interviewerId = response.interviewer;
        }
      }

      if (interviewerId && !existingUserIds.has(interviewerId)) {
        responsesWithOrphanedInterviewer.push(response);
      }
    });

    console.log('='.repeat(60));
    console.log('📊 RESULTS:');
    console.log('='.repeat(60));
    console.log(`   Total responses checked: ${allCatiResponses.length}`);
    console.log(`   Responses with orphaned interviewers: ${responsesWithOrphanedInterviewer.length}\n`);

    if (responsesWithOrphanedInterviewer.length > 0) {
      console.log('⚠️  Responses WITH Orphaned Interviewer (ObjectId doesn\'t exist in User table):\n');
      
      // Group by orphaned interviewer ID for better visibility
      const byOrphanedInterviewer = {};
      responsesWithOrphanedInterviewer.forEach(r => {
        const interviewerId = typeof r.interviewer === 'object' && r.interviewer._id 
          ? r.interviewer._id.toString() 
          : r.interviewer.toString();
        
        if (!byOrphanedInterviewer[interviewerId]) {
          byOrphanedInterviewer[interviewerId] = [];
        }
        byOrphanedInterviewer[interviewerId].push(r);
      });

      Object.keys(byOrphanedInterviewer).forEach(orphanedInterviewerId => {
        const responses = byOrphanedInterviewer[orphanedInterviewerId];
        console.log(`   Orphaned Interviewer ID: ${orphanedInterviewerId}`);
        console.log(`   Number of responses: ${responses.length}`);
        responses.forEach((r, i) => {
          console.log(`      ${i + 1}. Response ID: ${r._id}, Status: ${r.status}, Created: ${r.createdAt}`);
        });
        console.log('');
      });

      console.log('='.repeat(60));
      console.log('📝 RESPONSE OBJECT IDs (comma-separated for easy copy):');
      console.log('='.repeat(60));
      const responseIds = responsesWithOrphanedInterviewer.map(r => r._id.toString());
      console.log(responseIds.join(', '));
      console.log('');

      console.log('='.repeat(60));
      console.log('📝 RESPONSE OBJECT IDs (one per line):');
      console.log('='.repeat(60));
      responseIds.forEach(id => {
        console.log(id);
      });
      console.log('');

      console.log('='.repeat(60));
      console.log('📝 ORPHANED INTERVIEWER OBJECT IDs:');
      console.log('='.repeat(60));
      const orphanedInterviewerIds = Object.keys(byOrphanedInterviewer);
      console.log(orphanedInterviewerIds.join(', '));
      console.log('');
    } else {
      console.log('✅ No responses with orphaned interviewers found!\n');
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

findOrphanedResponses();



