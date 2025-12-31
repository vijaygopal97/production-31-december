const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

async function testISTDateFilter() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    const now = new Date();
    
    // Simulate frontend "yesterday" calculation in IST
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYear = yesterday.getFullYear();
    const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
    const startDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
    const endDate = startDate;

    console.log('📅 Frontend sends (IST date):');
    console.log(`   startDate: ${startDate}`);
    console.log(`   endDate: ${endDate}\n`);

    // Simulate backend conversion (IST to UTC)
    const [year, month, day] = startDate.split('-').map(Number);
    const startDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 30, 0, 0));
    startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 1);
    const endDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));

    console.log('📅 Backend converts to UTC:');
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
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Backend query result: ${backendResponses.length} responses\n`);

    if (backendResponses.length > 0) {
      console.log('📋 Responses found:');
      backendResponses.forEach((r, i) => {
        const created = new Date(r.createdAt);
        console.log(`   ${i + 1}. ID: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Created (UTC): ${created.toISOString()}`);
        console.log(`      Created (IST): ${new Date(created.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', ' IST')}`);
        console.log('');
      });
    }

    // Also test "today"
    console.log('='.repeat(60));
    console.log('TEST: TODAY');
    console.log('='.repeat(60));
    
    const today = new Date(now);
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStartDate = `${todayYear}-${todayMonth}-${todayDay}`;
    const todayEndDate = todayStartDate;

    console.log('📅 Frontend sends (IST date):');
    console.log(`   startDate: ${todayStartDate}`);
    console.log(`   endDate: ${todayEndDate}\n`);

    const [todayYearNum, todayMonthNum, todayDayNum] = todayStartDate.split('-').map(Number);
    const todayStartDateUTC = new Date(Date.UTC(todayYearNum, todayMonthNum - 1, todayDayNum, 18, 30, 0, 0));
    todayStartDateUTC.setUTCDate(todayStartDateUTC.getUTCDate() - 1);
    const todayEndDateUTC = new Date(Date.UTC(todayYearNum, todayMonthNum - 1, todayDayNum, 18, 29, 59, 999));

    console.log('📅 Backend converts to UTC:');
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

    console.log(`📊 Backend query result (today): ${todayBackendResponses.length} responses\n`);

    await mongoose.disconnect();
    console.log('✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testISTDateFilter();



