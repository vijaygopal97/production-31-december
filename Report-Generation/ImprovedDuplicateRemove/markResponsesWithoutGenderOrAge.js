#!/usr/bin/env node

/**
 * Mark Responses Without Gender or Age as Abandoned
 * 
 * For survey "68fd1915d41841da463f0d46", finds all CAPI and CATI responses
 * from December 30, 2025 (IST) that have missing/null/empty Gender or Age
 * and marks them as abandoned
 */

const path = require('path');
const fs = require('fs');

// Set up module resolution to use backend's node_modules
const backendPath = path.join(__dirname, '../../opine/backend');

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      const backendNodeModules = path.join(backendPath, 'node_modules');
      try {
        return originalRequire.apply(this, [path.join(backendNodeModules, id)]);
      } catch (e) {
        throw err;
      }
    }
    throw err;
  }
};

require('dotenv').config({ path: path.join(backendPath, '.env') });
const mongoose = require('mongoose');
const SurveyResponse = require(path.join(backendPath, 'models/SurveyResponse'));
const Survey = require(path.join(backendPath, 'models/Survey'));
const { getRespondentInfo } = require(path.join(backendPath, 'utils/respondentInfoUtils'));

const SURVEY_ID = '68fd1915d41841da463f0d46';

/**
 * Extract value from response (handle arrays)
 */
function extractValue(response) {
  if (!response || response === null || response === undefined) return null;
  if (Array.isArray(response)) {
    return response.length > 0 ? response[0] : null;
  }
  return response;
}

/**
 * Get main text (remove translations like "Male_{পুরুষ}")
 */
function getMainText(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove translation part (e.g., "Male_{পুরুষ}" -> "Male")
  return text.split('_{')[0].trim();
}

/**
 * Find response by question text
 */
function findResponseByQuestionText(responses, searchTexts) {
  if (!responses || !Array.isArray(responses)) return null;
  return responses.find(r => {
    if (!r.questionText) return false;
    const mainText = getMainText(r.questionText).toLowerCase();
    return searchTexts.some(text => mainText.includes(text.toLowerCase()));
  });
}

/**
 * Extract gender from responses (same logic as frontend)
 */
function extractGender(responses, survey) {
  // Try to find gender response using multiple strategies
  // Strategy 1: Find by fixed question ID
  let genderResponse = responses.find(r => {
    const questionId = r.questionId || '';
    return questionId.includes('fixed_respondent_gender');
  });
  
  if (genderResponse) {
    const genderValue = extractValue(genderResponse.response);
    if (genderValue && genderValue !== 'N/A' && genderValue !== null && genderValue !== undefined && String(genderValue).trim() !== '') {
      return getMainText(String(genderValue));
    }
  }
  
  // Strategy 2: Find by question text
  genderResponse = findResponseByQuestionText(responses, [
    'what is your gender',
    'please note the respondent\'s gender',
    'note the respondent\'s gender',
    'respondent\'s gender',
    'respondent gender',
    'note the gender',
    'gender'
  ]);
  
  if (genderResponse) {
    const genderValue = extractValue(genderResponse.response);
    if (genderValue && genderValue !== 'N/A' && genderValue !== null && genderValue !== undefined && String(genderValue).trim() !== '') {
      return getMainText(String(genderValue));
    }
  }
  
  // Strategy 3: Find registered voter question (equivalent to gender)
  genderResponse = findResponseByQuestionText(responses, [
    'are you a registered voter',
    'registered voter',
    'নিবন্ধিত ভোটার',
    'বিধানসভা কেন্দ্র'
  ]);
  
  if (genderResponse) {
    const genderValue = extractValue(genderResponse.response);
    if (genderValue && genderValue !== 'N/A' && genderValue !== null && genderValue !== undefined && String(genderValue).trim() !== '') {
      return getMainText(String(genderValue));
    }
  }
  
  return null;
}

/**
 * Extract age from responses (same logic as frontend)
 */
function extractAge(responses) {
  // Find age response
  const ageResponse = findResponseByQuestionText(responses, [
    'could you please tell me your age',
    'your age in complete years',
    'age in complete years',
    'age',
    'year'
  ]);
  
  if (ageResponse) {
    const ageValue = extractValue(ageResponse.response);
    if (ageValue !== null && ageValue !== undefined && ageValue !== 'N/A') {
      const ageStr = String(ageValue).trim();
      if (ageStr !== '') {
        // Try to parse as number
        const ageNum = parseInt(ageStr);
        if (!isNaN(ageNum) && ageNum > 0 && ageNum < 150) {
          return ageNum;
        }
        // If not a valid number, return the string value
        return ageStr;
      }
    }
  }
  
  return null;
}

async function markResponsesWithoutGenderOrAge() {
  try {
    console.log('='.repeat(80));
    console.log('MARK RESPONSES WITHOUT GENDER OR AGE AS ABANDONED');
    console.log('='.repeat(80));
    console.log(`Survey ID: ${SURVEY_ID}`);
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to database\n');
    
    // Get survey
    const survey = await Survey.findById(SURVEY_ID).lean();
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName || 'Unknown'}\n`);
    
    // Calculate December 30, 2025 IST date range
    const startDate30IST = new Date('2025-12-30T00:00:00+05:30');
    const endDate30IST = new Date('2025-12-30T23:59:59+05:30');
    const startDate30UTC = new Date(startDate30IST.toISOString());
    const endDate30UTC = new Date(endDate30IST.toISOString());
    
    console.log('📅 Date Range (IST):');
    console.log(`   Start: ${startDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   End: ${endDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('');
    
    // Query all CAPI and CATI responses from December 30, 2025
    // Exclude already abandoned responses
    const query = {
      survey: SURVEY_ID,
      interviewMode: { $in: ['capi', 'cati'] },
      status: { $ne: 'abandoned' },
      createdAt: {
        $gte: startDate30UTC,
        $lte: endDate30UTC
      }
    };
    
    console.log('🔍 Finding responses to check...');
    const allResponses = await SurveyResponse.find(query)
      .select('_id responseId sessionId status responses interviewMode createdAt')
      .lean();
    
    console.log(`   Found ${allResponses.length} responses to check\n`);
    
    if (allResponses.length === 0) {
      console.log('✅ No responses found to check.');
      await mongoose.disconnect();
      return;
    }
    
    // Check each response for missing gender or age
    const responsesToMark = [];
    let checked = 0;
    
    console.log('🔍 Checking responses for missing Gender or Age...');
    
    for (const response of allResponses) {
      checked++;
      
      if (checked % 100 === 0) {
        console.log(`   Checked ${checked}/${allResponses.length} responses...`);
      }
      
      const responses = response.responses || [];
      const gender = extractGender(responses, survey);
      const age = extractAge(responses);
      
      // Check if gender or age is missing
      const missingGender = !gender || gender === 'N/A' || gender === null || String(gender).trim() === '';
      const missingAge = !age || age === 'N/A' || age === null || String(age).trim() === '';
      
      if (missingGender || missingAge) {
        responsesToMark.push({
          responseId: response.responseId || response._id.toString(),
          mongoId: response._id.toString(),
          sessionId: response.sessionId,
          interviewMode: response.interviewMode,
          oldStatus: response.status,
          gender: gender || 'MISSING',
          age: age || 'MISSING',
          missingGender,
          missingAge,
          createdAt: response.createdAt
        });
      }
    }
    
    console.log(`\n   ✅ Checked ${checked} responses`);
    console.log(`   Found ${responsesToMark.length} responses with missing Gender or Age\n`);
    
    if (responsesToMark.length === 0) {
      console.log('✅ No responses need to be marked as abandoned.');
      await mongoose.disconnect();
      return;
    }
    
    // Display summary
    console.log('='.repeat(80));
    console.log('SUMMARY BEFORE UPDATE');
    console.log('='.repeat(80));
    console.log(`Total responses checked: ${allResponses.length}`);
    console.log(`Responses with missing Gender or Age: ${responsesToMark.length}`);
    console.log(`  - Missing Gender: ${responsesToMark.filter(r => r.missingGender).length}`);
    console.log(`  - Missing Age: ${responsesToMark.filter(r => r.missingAge).length}`);
    console.log(`  - Missing Both: ${responsesToMark.filter(r => r.missingGender && r.missingAge).length}`);
    console.log(`New status: abandoned`);
    console.log('');
    
    // Update in batches
    const BATCH_SIZE = 500;
    const responseIds = responsesToMark.map(r => r.mongoId);
    let updated = 0;
    
    console.log('🔄 Updating responses in batches...');
    
    for (let i = 0; i < responseIds.length; i += BATCH_SIZE) {
      const batch = responseIds.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await SurveyResponse.updateMany(
          { _id: { $in: batch } },
          { 
            $set: { 
              status: 'abandoned',
              abandonedReason: 'Missing Gender or Age information'
            }
          }
        );
        
        updated += result.modifiedCount;
        
        if ((i / BATCH_SIZE + 1) % 5 === 0 || i + BATCH_SIZE >= responseIds.length) {
          console.log(`   Updated ${updated}/${responseIds.length} responses...`);
        }
      } catch (error) {
        console.error(`   ❌ Error updating batch ${i / BATCH_SIZE + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} responses to abandoned status\n`);
    
    // Generate report
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const report = {
      timestamp: new Date().toISOString(),
      operation: 'Mark Responses Without Gender or Age as Abandoned',
      surveyId: SURVEY_ID,
      surveyName: survey.surveyName || 'Unknown',
      dateRange: {
        ist: {
          start: startDate30IST.toISOString(),
          end: endDate30IST.toISOString()
        },
        utc: {
          start: startDate30UTC.toISOString(),
          end: endDate30UTC.toISOString()
        }
      },
      criteria: {
        interviewMode: ['capi', 'cati'],
        oldStatus: 'not abandoned',
        missingGender: true,
        missingAge: true,
        newStatus: 'abandoned',
        abandonedReason: 'Missing Gender or Age information'
      },
      summary: {
        totalChecked: allResponses.length,
        totalFound: responsesToMark.length,
        missingGender: responsesToMark.filter(r => r.missingGender).length,
        missingAge: responsesToMark.filter(r => r.missingAge).length,
        missingBoth: responsesToMark.filter(r => r.missingGender && r.missingAge).length,
        totalUpdated: updated,
        success: updated === responsesToMark.length
      },
      updates: responsesToMark.map(r => ({
        ...r,
        updatedAt: new Date()
      }))
    };
    
    // Save JSON report
    const jsonPath = path.join(REPORT_DIR, `mark_responses_without_gender_age_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvRows = [
      'Response ID,Mongo ID,Session ID,Interview Mode,Old Status,New Status,Abandoned Reason,Gender,Age,Missing Gender,Missing Age,Created At,Updated At'
    ];
    
    responsesToMark.forEach(log => {
      csvRows.push([
        log.responseId,
        log.mongoId,
        log.sessionId,
        log.interviewMode,
        log.oldStatus,
        'abandoned',
        'Missing Gender or Age information',
        log.gender,
        log.age,
        log.missingGender ? 'Yes' : 'No',
        log.missingAge ? 'Yes' : 'No',
        new Date(log.createdAt).toISOString(),
        new Date().toISOString()
      ].join(','));
    });
    
    const csvPath = path.join(REPORT_DIR, `mark_responses_without_gender_age_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    // Save simple response IDs list
    const responseIdsList = responsesToMark.map(u => u.responseId).join('\n');
    const idsPath = path.join(REPORT_DIR, `response_ids_changed_gender_age_${TIMESTAMP}.txt`);
    fs.writeFileSync(idsPath, responseIdsList);
    console.log(`✅ Response IDs list saved: ${idsPath}`);
    
    // Final summary
    console.log('');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Responses Checked: ${allResponses.length}`);
    console.log(`Responses with Missing Gender or Age: ${responsesToMark.length}`);
    console.log(`  - Missing Gender: ${report.summary.missingGender}`);
    console.log(`  - Missing Age: ${report.summary.missingAge}`);
    console.log(`  - Missing Both: ${report.summary.missingBoth}`);
    console.log(`Total Responses Updated: ${updated}`);
    console.log(`New Status: abandoned`);
    console.log(`Abandoned Reason: Missing Gender or Age information`);
    console.log('='.repeat(80));
    
    if (updated !== responsesToMark.length) {
      console.log(`\n⚠️  WARNING: Expected to update ${responsesToMark.length} but only updated ${updated}`);
    } else {
      console.log('\n✅ All responses successfully updated!');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.stack) console.error(error.stack);
    
    // Save error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const REPORT_DIR = path.join(__dirname);
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const errorPath = path.join(REPORT_DIR, `mark_responses_gender_age_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  markResponsesWithoutGenderOrAge();
}

module.exports = { markResponsesWithoutGenderOrAge };






