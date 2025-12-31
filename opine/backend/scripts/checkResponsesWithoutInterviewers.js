const mongoose = require('mongoose');
require('dotenv').config();
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';

async function checkResponsesWithoutInterviewers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Calculate date range - check both today and yesterday
    const now = new Date();
    console.log(`🕐 Current time: ${now.toISOString()}`);
    console.log(`🕐 Current local time: ${now.toString()}\n`);
    
    // Check today first (since we found 43 responses today)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Use today's date range (since that's where the 43 responses are)
    const dateStart = today;
    const dateEnd = todayEnd;
    
    console.log('📅 Checking responses from TODAY (where 43 responses were found):');
    console.log(`   Start: ${dateStart.toISOString()} (${dateStart.toString()})`);
    console.log(`   End: ${dateEnd.toISOString()} (${dateEnd.toString()})\n`);

    // Convert survey ID to ObjectId
    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Find all CATI responses from today with Approved/Rejected/Pending_Approval status
    const catiResponses = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: 'cati',
      createdAt: {
        $gte: dateStart,
        $lte: dateEnd
      },
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
      .select('_id status createdAt interviewer interviewMode')
      .lean();

    console.log(`📊 Total CATI Responses (Approved/Rejected/Pending_Approval) from yesterday: ${catiResponses.length}\n`);

    // Separate responses with and without interviewers
    const responsesWithInterviewer = [];
    const responsesWithoutInterviewer = [];

    catiResponses.forEach(response => {
      // Check if interviewer field exists and is not null/undefined
      // interviewer can be ObjectId (string) or populated object
      if (response.interviewer) {
        // If it's an object with _id, or if it's a valid ObjectId string
        const hasInterviewer = (typeof response.interviewer === 'object' && response.interviewer._id) ||
                                (typeof response.interviewer === 'string' && mongoose.Types.ObjectId.isValid(response.interviewer));
        if (hasInterviewer) {
          responsesWithInterviewer.push(response);
        } else {
          responsesWithoutInterviewer.push(response);
        }
      } else {
        responsesWithoutInterviewer.push(response);
      }
    });

    console.log(`✅ Responses WITH interviewer: ${responsesWithInterviewer.length}`);
    console.log(`❌ Responses WITHOUT interviewer: ${responsesWithoutInterviewer.length}\n`);

    // Group by status
    const statusBreakdown = {
      Approved: { with: 0, without: 0 },
      Rejected: { with: 0, without: 0 },
      'Pending_Approval': { with: 0, without: 0 }
    };

    responsesWithInterviewer.forEach(r => {
      if (statusBreakdown[r.status]) {
        statusBreakdown[r.status].with++;
      }
    });

    responsesWithoutInterviewer.forEach(r => {
      if (statusBreakdown[r.status]) {
        statusBreakdown[r.status].without++;
      }
    });

    console.log('📈 Status Breakdown:');
    Object.keys(statusBreakdown).forEach(status => {
      const { with: withCount, without: withoutCount } = statusBreakdown[status];
      console.log(`   ${status}:`);
      console.log(`      With interviewer: ${withCount}`);
      console.log(`      Without interviewer: ${withoutCount}`);
    });

    // List ObjectIds of responses without interviewers
    if (responsesWithoutInterviewer.length > 0) {
      console.log('\n🔍 Responses WITHOUT Interviewer (ObjectIds):');
      console.log('='.repeat(60));
      responsesWithoutInterviewer.forEach((response, index) => {
        console.log(`${index + 1}. ObjectId: ${response._id}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Created At: ${response.createdAt} (${new Date(response.createdAt).toISOString()})`);
        console.log(`   Interviewer: ${response.interviewer ? 'null/undefined' : 'missing'}`);
        console.log('');
      });
      console.log('='.repeat(60));
      console.log(`\n📋 Total ObjectIds without interviewer: ${responsesWithoutInterviewer.length}`);
      console.log('\n📝 ObjectIds (comma-separated for easy copy):');
      const objectIds = responsesWithoutInterviewer.map(r => r._id.toString()).join(', ');
      console.log(objectIds);
    } else {
      console.log('\n✅ All responses have interviewers assigned!');
    }

    // If no responses found, check last 3 days to see what dates have responses
    if (catiResponses.length === 0) {
      console.log('\n⚠️  No responses found for yesterday. Checking last 3 days...\n');
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);
      
      const recentResponses = await SurveyResponse.find({
        survey: surveyObjectId,
        interviewMode: 'cati',
        createdAt: { $gte: threeDaysAgo },
        status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
      })
        .select('_id status createdAt interviewer')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      
      if (recentResponses.length > 0) {
        console.log(`📊 Found ${recentResponses.length} responses in last 3 days:\n`);
        const byDate = {};
        recentResponses.forEach(r => {
          const date = new Date(r.createdAt).toISOString().split('T')[0];
          if (!byDate[date]) {
            byDate[date] = { total: 0, withInterviewer: 0, withoutInterviewer: 0 };
          }
          byDate[date].total++;
          if (r.interviewer && r.interviewer._id) {
            byDate[date].withInterviewer++;
          } else {
            byDate[date].withoutInterviewer++;
          }
        });
        
        Object.keys(byDate).sort().reverse().forEach(date => {
          const stats = byDate[date];
          console.log(`   ${date}: ${stats.total} responses (${stats.withInterviewer} with interviewer, ${stats.withoutInterviewer} without)`);
        });
        
        // Show responses without interviewers from last 3 days
        const recentWithoutInterviewer = recentResponses.filter(r => !r.interviewer || !r.interviewer._id);
        if (recentWithoutInterviewer.length > 0) {
          console.log(`\n🔍 Responses WITHOUT Interviewer from last 3 days (ObjectIds):`);
          console.log('='.repeat(60));
          recentWithoutInterviewer.forEach((response, index) => {
            console.log(`${index + 1}. ObjectId: ${response._id}`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Created At: ${response.createdAt} (${new Date(response.createdAt).toISOString()})`);
            console.log('');
          });
          console.log('='.repeat(60));
          console.log('\n📝 ObjectIds (comma-separated):');
          const objectIds = recentWithoutInterviewer.map(r => r._id.toString()).join(', ');
          console.log(objectIds);
        }
      } else {
        console.log('   No responses found in last 3 days either.');
      }
    }

    // Calculate what the "Completed" column should show
    const completedCount = responsesWithInterviewer.length;
    const totalCatiCount = catiResponses.length;
    const difference = totalCatiCount - completedCount;

    console.log('\n📊 Summary:');
    console.log(`   Total CATI Responses (Top Stats): ${totalCatiCount}`);
    console.log(`   Completed Column (Interviewer Performance): ${completedCount}`);
    console.log(`   Difference: ${difference}`);
    
    if (difference > 0) {
      console.log(`\n⚠️  The difference of ${difference} is due to responses without interviewers.`);
    } else {
      console.log('\n✅ Counts match!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkResponsesWithoutInterviewers();



