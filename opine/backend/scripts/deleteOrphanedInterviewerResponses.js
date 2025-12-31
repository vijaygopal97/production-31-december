const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

// Response ObjectIds with orphaned interviewers
const RESPONSES_TO_DELETE = [
  '693d5bc5091c033543075e08',
  '693d578b091c03354305e384',
  '693d55fc091c033543056e54',
  '693d4e78091c03354301a8f1',
  '693d4c35091c033543003650',
  '693d46cad75495bb836f91c9',
  '693d52c0091c0335430415dd'
];

async function deleteOrphanedResponses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));

    // Convert to ObjectIds
    const responseObjectIds = RESPONSES_TO_DELETE
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    console.log(`🔍 Looking for ${responseObjectIds.length} responses to delete...\n`);

    // Find the responses first to show what will be deleted
    const responsesToDelete = await SurveyResponse.find({
      _id: { $in: responseObjectIds }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📋 Found ${responsesToDelete.length} responses:\n`);
    responsesToDelete.forEach((response, index) => {
      const interviewerId = response.interviewer 
        ? (typeof response.interviewer === 'object' && response.interviewer._id 
            ? response.interviewer._id.toString() 
            : response.interviewer.toString())
        : 'null';
      console.log(`   ${index + 1}. ObjectId: ${response._id}`);
      console.log(`      Status: ${response.status}`);
      console.log(`      Created At: ${response.createdAt}`);
      console.log(`      Interviewer: ${interviewerId}`);
      console.log(`      Interview Mode: ${response.interviewMode}`);
      console.log('');
    });

    if (responsesToDelete.length === 0) {
      console.log('⚠️  No responses found to delete. They may have already been deleted.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Delete the responses
    console.log('🗑️  Deleting responses...\n');
    const deleteResult = await SurveyResponse.deleteMany({
      _id: { $in: responseObjectIds }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} responses\n`);

    // Verify deletion
    const remainingResponses = await SurveyResponse.find({
      _id: { $in: responseObjectIds }
    }).select('_id').lean();

    if (remainingResponses.length === 0) {
      console.log('✅ Verification: All responses successfully deleted\n');
    } else {
      console.log(`⚠️  Warning: ${remainingResponses.length} responses still exist:`);
      remainingResponses.forEach(r => {
        console.log(`   - ${r._id}`);
      });
      console.log('');
    }

    // Show updated count
    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const remainingCatiResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: today,
        $lte: todayEnd
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    }).countDocuments();

    console.log('📊 Updated Count:');
    console.log(`   Total CATI Responses (Approved/Rejected/Pending_Approval) for today: ${remainingCatiResponses}`);
    console.log(`   Expected "Completed" count in Interviewer Performance: ${remainingCatiResponses}`);
    console.log('   ✅ Counts should now match!\n');

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

deleteOrphanedResponses();



