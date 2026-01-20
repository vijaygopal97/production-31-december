/**
 * Remove question_1767953047865_319 from the 34 responses that have multiple selections
 * This will make it look like the question wasn't there during the interview
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const QUESTION_ID = 'question_1767953047865_319';
const REPORT_FILE = path.join(__dirname, '../../multiselect-responses-report.json');
const REMOVAL_REPORT_FILE = path.join(__dirname, '../../question-removal-report.json');

async function removeQuestionFromResponses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load the report with multiselect responses
    if (!fs.existsSync(REPORT_FILE)) {
      console.error(`❌ Report file not found: ${REPORT_FILE}`);
      console.error('   Please run find-multiselect-responses-correct.js first');
      process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    const responseIds = report.details.map(d => d.responseId);

    console.log(`📋 Loaded report:`);
    console.log(`   Total multiselect responses: ${responseIds.length}\n`);

    if (responseIds.length === 0) {
      console.log('⚠️  No responses to process');
      await mongoose.disconnect();
      return;
    }

    console.log(`🔍 Verifying responses exist in database...\n`);

    // Verify all responses exist
    const existingResponses = await SurveyResponse.find({
      responseId: { $in: responseIds },
      survey: SURVEY_ID
    })
      .select('responseId responses')
      .lean();

    console.log(`   Found ${existingResponses.length}/${responseIds.length} responses in database\n`);

    if (existingResponses.length !== responseIds.length) {
      const foundIds = new Set(existingResponses.map(r => r.responseId));
      const missingIds = responseIds.filter(id => !foundIds.has(id));
      console.warn(`⚠️  Warning: ${missingIds.length} responses not found in database:`);
      missingIds.forEach(id => console.warn(`     - ${id}`));
      console.log('');
    }

    const removalReport = {
      startTime: new Date().toISOString(),
      questionId: QUESTION_ID,
      surveyId: SURVEY_ID,
      totalResponsesToProcess: responseIds.length,
      responsesFound: existingResponses.length,
      successful: 0,
      failed: 0,
      notFound: 0,
      alreadyRemoved: 0,
      details: []
    };

    console.log(`🗑️  Removing question from responses...\n`);

    // Process each response
    for (const response of existingResponses) {
      const responseId = response.responseId;
      const result = {
        responseId: responseId,
        mongoId: response._id.toString(),
        status: 'pending',
        error: null,
        beforeQuestionCount: 0,
        afterQuestionCount: 0,
        questionFound: false
      };

      try {
        // Count questions before removal
        result.beforeQuestionCount = response.responses ? response.responses.length : 0;

        // Check if question exists in responses
        const questionExists = response.responses && response.responses.some(r => r.questionId === QUESTION_ID);
        result.questionFound = questionExists;

        if (!questionExists) {
          result.status = 'already_removed';
          result.afterQuestionCount = result.beforeQuestionCount;
          removalReport.alreadyRemoved++;
          removalReport.details.push(result);
          console.log(`   ✓ ${responseId}: Question already removed`);
          continue;
        }

        // Remove the question from responses array using atomic update
        const updateResult = await SurveyResponse.updateOne(
          { _id: response._id },
          { $pull: { responses: { questionId: QUESTION_ID } } }
        );

        if (updateResult.modifiedCount > 0) {
          // Verify removal
          const updatedResponse = await SurveyResponse.findById(response._id)
            .select('responses')
            .lean();

          result.afterQuestionCount = updatedResponse.responses ? updatedResponse.responses.length : 0;
          result.status = 'success';

          // Verify the question is actually removed
          const questionStillExists = updatedResponse.responses && updatedResponse.responses.some(r => r.questionId === QUESTION_ID);
          if (questionStillExists) {
            result.status = 'verification_failed';
            result.error = 'Question still exists after removal';
            removalReport.failed++;
            console.error(`   ❌ ${responseId}: Verification failed - question still exists`);
          } else {
            removalReport.successful++;
            console.log(`   ✅ ${responseId}: Question removed (${result.beforeQuestionCount} → ${result.afterQuestionCount} questions)`);
          }
        } else {
          result.status = 'not_modified';
          result.error = 'Update did not modify document';
          removalReport.failed++;
          console.error(`   ❌ ${responseId}: Update did not modify document`);
        }

        removalReport.details.push(result);
      } catch (error) {
        result.status = 'error';
        result.error = error.message;
        removalReport.failed++;
        removalReport.details.push(result);
        console.error(`   ❌ ${responseId}: ${error.message}`);
      }
    }

    // Handle responses not found in database
    const foundIds = new Set(existingResponses.map(r => r.responseId));
    const missingIds = responseIds.filter(id => !foundIds.has(id));
    
    for (const responseId of missingIds) {
      removalReport.notFound++;
      removalReport.details.push({
        responseId: responseId,
        status: 'not_found',
        error: 'Response not found in database',
        beforeQuestionCount: 0,
        afterQuestionCount: 0,
        questionFound: false
      });
      console.warn(`   ⚠️  ${responseId}: Response not found in database`);
    }

    removalReport.endTime = new Date().toISOString();
    removalReport.duration = `${((new Date(removalReport.endTime) - new Date(removalReport.startTime)) / 1000).toFixed(2)} seconds`;

    // Save removal report
    fs.writeFileSync(REMOVAL_REPORT_FILE, JSON.stringify(removalReport, null, 2));

    console.log(`\n✅ Removal complete!\n`);
    console.log(`📊 Summary:`);
    console.log(`   Total responses to process: ${removalReport.totalResponsesToProcess}`);
    console.log(`   Responses found: ${removalReport.responsesFound}`);
    console.log(`   ✅ Successful: ${removalReport.successful}`);
    console.log(`   ❌ Failed: ${removalReport.failed}`);
    console.log(`   ⚠️  Not found: ${removalReport.notFound}`);
    console.log(`   ℹ️  Already removed: ${removalReport.alreadyRemoved}`);
    console.log(`\n📄 Detailed report saved to: ${REMOVAL_REPORT_FILE}`);
    console.log(`\n✅ Process completed!`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

removeQuestionFromResponses();




