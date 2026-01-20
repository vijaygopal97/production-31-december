/**
 * Verify that question_1767953047865_319 was successfully removed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SurveyResponse = require('../models/SurveyResponse');

const QUESTION_ID = 'question_1767953047865_319';
const REPORT_FILE = path.join(__dirname, '../../multiselect-responses-report.json');

async function verifyRemoval() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load the original report
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    const responseIds = report.details.map(d => d.responseId);

    console.log(`🔍 Verifying question removal for ${responseIds.length} responses...\n`);

    // Check a sample of responses
    const sampleIds = responseIds.slice(0, 5);
    const responses = await SurveyResponse.find({
      responseId: { $in: sampleIds }
    })
      .select('responseId responses.questionId')
      .lean();

    console.log('Sample verification:\n');
    let allRemoved = true;
    responses.forEach(r => {
      const hasQuestion = r.responses && r.responses.some(resp => resp.questionId === QUESTION_ID);
      if (hasQuestion) {
        allRemoved = false;
        console.log(`  ❌ ${r.responseId}: Question still exists`);
      } else {
        console.log(`  ✅ ${r.responseId}: Question removed successfully`);
      }
    });

    // Check all responses
    console.log(`\n🔍 Checking all ${responseIds.length} responses...\n`);
    const allResponses = await SurveyResponse.find({
      responseId: { $in: responseIds }
    })
      .select('responseId responses.questionId')
      .lean();

    const stillHasQuestion = allResponses.filter(r => {
      return r.responses && r.responses.some(resp => resp.questionId === QUESTION_ID);
    });

    console.log(`📊 Final Verification:`);
    console.log(`   Total responses checked: ${allResponses.length}`);
    console.log(`   ✅ Question removed: ${allResponses.length - stillHasQuestion.length}`);
    console.log(`   ❌ Question still exists: ${stillHasQuestion.length}`);

    if (stillHasQuestion.length > 0) {
      console.log(`\n⚠️  Warning: ${stillHasQuestion.length} responses still have the question:`);
      stillHasQuestion.forEach(r => {
        console.log(`     - ${r.responseId}`);
      });
    } else {
      console.log(`\n✅ All ${allResponses.length} responses verified - question successfully removed!`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyRemoval();




