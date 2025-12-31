const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

async function deepAnalysis() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Calculate today's date range (where we found 43 responses)
    // Also check yesterday in case of timezone differences
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

    // Use today since that's where we found 43 responses
    const dateStart = today;
    const dateEnd = todayEnd;

    console.log('📅 Date Range (Today - where 43 responses were found):');
    console.log(`   Start: ${dateStart.toISOString()}`);
    console.log(`   End: ${dateEnd.toISOString()}\n`);

    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID)
      ? new mongoose.Types.ObjectId(SURVEY_ID)
      : SURVEY_ID;

    // Step 1: Get all CATI responses from today with Approved/Rejected/Pending_Approval
    // This matches the TOP STATS calculation
    const allCatiResponses = await SurveyResponse.find({
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

    console.log(`📊 Step 1: TOP STATS - Total CATI Responses: ${allCatiResponses.length}\n`);

    // Step 2: Check interviewer field - could be ObjectId string or populated object
    console.log('🔍 Step 2: Analyzing Interviewer Field...\n');
    
    const responsesWithValidInterviewer = [];
    const responsesWithInvalidInterviewer = [];
    const responsesWithOrphanedInterviewer = [];
    const responsesWithoutInterviewer = [];

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

    console.log(`   Found ${interviewerIds.size} unique interviewer IDs in responses\n`);

    // Check which interviewer IDs exist in User table
    const interviewerIdArray = Array.from(interviewerIds).map(id => new mongoose.Types.ObjectId(id));
    const existingUsers = await User.find({
      _id: { $in: interviewerIdArray }
    }).select('_id').lean();

    const existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
    console.log(`   Found ${existingUserIds.size} interviewers that exist in User table`);
    console.log(`   Missing ${interviewerIdArray.length - existingUserIds.size} interviewers from User table\n`);

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

    console.log('📊 Response Categorization:');
    console.log(`   ✅ With valid interviewer (exists in User table): ${responsesWithValidInterviewer.length}`);
    console.log(`   ❌ Without interviewer field: ${responsesWithoutInterviewer.length}`);
    console.log(`   ⚠️  With orphaned interviewer (ObjectId doesn't exist in User table): ${responsesWithOrphanedInterviewer.length}\n`);

    // Step 3: Simulate BACKEND getCatiStats calculation
    // The backend filters responses and only counts those with valid interviewers
    console.log('🔍 Step 3: Simulating BACKEND getCatiStats Calculation...\n');
    
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

    console.log(`   Backend "Completed" count: ${backendCompletedCount}\n`);

    // Step 4: Summary
    console.log('='.repeat(60));
    console.log('📊 FINAL SUMMARY:');
    console.log('='.repeat(60));
    console.log(`   Top CATI Responses (Frontend): ${allCatiResponses.length}`);
    console.log(`   Completed Column (Backend): ${backendCompletedCount}`);
    console.log(`   Difference: ${allCatiResponses.length - backendCompletedCount}\n`);

    if (responsesWithoutInterviewer.length > 0) {
      console.log('❌ Responses WITHOUT Interviewer Field:');
      responsesWithoutInterviewer.forEach((r, i) => {
        console.log(`   ${i + 1}. ObjectId: ${r._id}, Status: ${r.status}`);
      });
      console.log('');
    }

    if (responsesWithOrphanedInterviewer.length > 0) {
      console.log('⚠️  Responses WITH Orphaned Interviewer (ObjectId doesn\'t exist in User table):');
      responsesWithOrphanedInterviewer.forEach((r, i) => {
        const interviewerId = typeof r.interviewer === 'object' && r.interviewer._id 
          ? r.interviewer._id.toString() 
          : r.interviewer;
        console.log(`   ${i + 1}. Response ObjectId: ${r._id}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Interviewer ObjectId: ${interviewerId}`);
      });
      console.log('');
      console.log('📝 Orphaned Interviewer ObjectIds (comma-separated):');
      const orphanedIds = responsesWithOrphanedInterviewer.map(r => {
        const interviewerId = typeof r.interviewer === 'object' && r.interviewer._id 
          ? r.interviewer._id.toString() 
          : r.interviewer;
        return interviewerId;
      }).filter((id, index, self) => self.indexOf(id) === index).join(', ');
      console.log(orphanedIds);
      console.log('');
    }

    // Check date filter differences
    console.log('🔍 Step 4: Checking Date Filter Application...\n');
    
    // Frontend date filter (from SurveyReportsPage.jsx)
    const frontendFiltered = allCatiResponses.filter(response => {
      const responseDate = new Date(response.createdAt);
      // Frontend checks: responseDate >= dateStart && responseDate <= dateEnd
      return responseDate >= dateStart && responseDate <= dateEnd;
    });

    // Backend date filter (from surveyController.js)
    // Frontend sends date as YYYY-MM-DD string, backend converts to Date
    const backendDateFilter = {
      createdAt: {
        $gte: dateStart,
        $lte: new Date(new Date(dateEnd).setHours(23, 59, 59, 999))
      }
    };

    const backendFiltered = await SurveyResponse.find({
      survey: surveyObjectId,
      interviewMode: { $regex: /CATI/i },
      ...backendDateFilter,
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    }).select('_id createdAt').lean();

    console.log(`   Frontend filtered count: ${frontendFiltered.length}`);
    console.log(`   Backend filtered count: ${backendFiltered.length}`);
    
    if (frontendFiltered.length !== backendFiltered.length) {
      console.log(`   ⚠️  Date filter mismatch detected!`);
    } else {
      console.log(`   ✅ Date filters match`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deepAnalysis();



