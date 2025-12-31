const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

async function testDateFilterMatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    const now = new Date();
    
    // Test both "today" and "yesterday"
    console.log('='.repeat(60));
    console.log('TEST 1: YESTERDAY');
    console.log('='.repeat(60));
    
    // Simulate frontend "yesterday" calculation
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const startDate = yesterday.toISOString().split('T')[0];
    const endDate = yesterday.toISOString().split('T')[0]; // Same date

    console.log('📅 Frontend date calculation (yesterday):');
    console.log(`   startDate: ${startDate}`);
    console.log(`   endDate: ${endDate}\n`);

    // Simulate backend date filter (new logic)
    const startDateUTC = new Date(startDate + 'T00:00:00.000Z');
    const endDateUTC = new Date(endDate + 'T23:59:59.999Z');

    console.log('📅 Backend date filter (UTC):');
    console.log(`   startDateUTC: ${startDateUTC.toISOString()}`);
    console.log(`   endDateUTC: ${endDateUTC.toISOString()}\n`);

    // Query using backend filter
    const backendResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: startDateUTC,
        $lte: endDateUTC
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt')
      .lean();

    console.log(`📊 Backend query result: ${backendResponses.length} responses\n`);

    // Simulate frontend filter
    const frontendResponses = backendResponses.filter(response => {
      const responseDate = new Date(response.createdAt);
      return responseDate >= startDateUTC && responseDate <= endDateUTC;
    });

    console.log(`📊 Frontend filter result: ${frontendResponses.length} responses\n`);

    if (backendResponses.length === frontendResponses.length) {
      console.log('✅ Date filters match for YESTERDAY!\n');
    } else {
      console.log('❌ Date filters do not match for YESTERDAY!');
      console.log(`   Difference: ${Math.abs(backendResponses.length - frontendResponses.length)}\n`);
    }

    // Test "today"
    console.log('='.repeat(60));
    console.log('TEST 2: TODAY');
    console.log('='.repeat(60));
    
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const todayStartDate = today.toISOString().split('T')[0];
    const todayEndDate = today.toISOString().split('T')[0];

    console.log('📅 Frontend date calculation (today):');
    console.log(`   startDate: ${todayStartDate}`);
    console.log(`   endDate: ${todayEndDate}\n`);

    const todayStartDateUTC = new Date(todayStartDate + 'T00:00:00.000Z');
    const todayEndDateUTC = new Date(todayEndDate + 'T23:59:59.999Z');

    console.log('📅 Backend date filter (UTC):');
    console.log(`   startDateUTC: ${todayStartDateUTC.toISOString()}`);
    console.log(`   endDateUTC: ${todayEndDateUTC.toISOString()}\n`);

    const todayBackendResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      createdAt: {
        $gte: todayStartDateUTC,
        $lte: todayEndDateUTC
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt')
      .lean();

    console.log(`📊 Backend query result: ${todayBackendResponses.length} responses\n`);

    const todayFrontendResponses = todayBackendResponses.filter(response => {
      const responseDate = new Date(response.createdAt);
      return responseDate >= todayStartDateUTC && responseDate <= todayEndDateUTC;
    });

    console.log(`📊 Frontend filter result: ${todayFrontendResponses.length} responses\n`);

    if (todayBackendResponses.length === todayFrontendResponses.length) {
      console.log('✅ Date filters match for TODAY!');
    } else {
      console.log('❌ Date filters do not match for TODAY!');
      console.log(`   Difference: ${Math.abs(todayBackendResponses.length - todayFrontendResponses.length)}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testDateFilterMatch();



