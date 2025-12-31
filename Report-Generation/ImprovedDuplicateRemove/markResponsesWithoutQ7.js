#!/usr/bin/env node

/**
 * Mark Responses Without Q7 (2025 Preference) as Abandoned
 * 
 * For survey "68fd1915d41841da463f0d46", finds all CAPI and CATI responses
 * from December 29-30, 2025 (IST) that have empty/null/missing Q7: 2025 Preference
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
const { getMainText } = require(path.join(backendPath, 'utils/genderUtils'));

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
 * Check if a response value is empty/null
 */
function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === 'N/A' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined';
  }
  if (Array.isArray(value)) {
    return value.length === 0 || (value.length === 1 && isEmptyValue(value[0]));
  }
  return false;
}

/**
 * Find Q7 (2025 Preference) response from responses array
 */
function findQ7Response(responses, survey) {
  if (!responses || !Array.isArray(responses)) return null;
  
  // Strategy 1: Find by questionNumber === '7' or '8' (sometimes Q7 is stored as Q8)
  let q7Response = responses.find(r => {
    const questionNumber = r.questionNumber || '';
    const qNum = String(questionNumber).trim();
    return qNum === '7' || qNum === '8';
  });
  
  if (q7Response) {
    return q7Response;
  }
  
  // Strategy 2: Find by question text containing "2025 Preference"
  q7Response = responses.find(r => {
    if (!r.questionText) return false;
    const mainText = getMainText(r.questionText).toLowerCase();
    return mainText.includes('2025 preference') || 
           mainText.includes('২০২৫ পছন্দ') ||
           (mainText.includes('2025') && mainText.includes('preference'));
  });
  
  if (q7Response) {
    return q7Response;
  }
  
  // Strategy 3: Find by questionId containing "q7" or "2025" or "preference"
  q7Response = responses.find(r => {
    const questionId = (r.questionId || '').toLowerCase();
    return questionId.includes('q7') || 
           questionId.includes('2025') ||
           questionId.includes('preference');
  });
  
  if (q7Response) {
    return q7Response;
  }
  
  // Strategy 4: If survey is provided, find Q7 in survey structure
  if (survey && survey.sections) {
    let q7Question = null;
    for (const section of survey.sections) {
      if (section.questions) {
        q7Question = section.questions.find(q => {
          const qNum = String(q.questionNumber || '').trim();
          if (qNum === '7' || qNum === '8') {
            const qText = getMainText(q.text || '').toLowerCase();
            if (qText.includes('2025 preference') || qText.includes('২০২৫ পছন্দ')) {
              return true;
            }
          }
          return false;
        });
        if (q7Question) break;
      }
    }
    
    if (q7Question && q7Question.id) {
      q7Response = responses.find(r => r.questionId === q7Question.id);
      if (q7Response) {
        return q7Response;
      }
    }
  }
  
  return null;
}

/**
 * Check if Q7 response is empty
 */
function isQ7Empty(q7Response) {
  if (!q7Response) return true; // No Q7 response found = empty
  
  const responseValue = extractValue(q7Response.response);
  return isEmptyValue(responseValue);
}

async function markResponsesWithoutQ7() {
  try {
    console.log('='.repeat(80));
    console.log('MARK RESPONSES WITHOUT Q7 (2025 PREFERENCE) AS ABANDONED');
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
    
    // Calculate date ranges for December 29 and 30, 2025 (IST)
    // IST is UTC+5:30
    
    // December 29, 2025 IST
    const startDate29IST = new Date('2025-12-29T00:00:00+05:30');
    const endDate29IST = new Date('2025-12-29T23:59:59+05:30');
    const startDate29UTC = new Date(startDate29IST.toISOString());
    const endDate29UTC = new Date(endDate29IST.toISOString());
    
    // December 30, 2025 IST
    const startDate30IST = new Date('2025-12-30T00:00:00+05:30');
    const endDate30IST = new Date('2025-12-30T23:59:59+05:30');
    const startDate30UTC = new Date(startDate30IST.toISOString());
    const endDate30UTC = new Date(endDate30IST.toISOString());
    
    console.log('📅 Date Ranges (IST):');
    console.log(`   December 29: ${startDate29IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${endDate29IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   December 30: ${startDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${endDate30IST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('');
    
    // Query all CAPI and CATI responses from December 29-30, 2025
    // Exclude already abandoned responses
    const query = {
      survey: SURVEY_ID,
      interviewMode: { $in: ['capi', 'cati'] },
      status: { $ne: 'abandoned' },
      $or: [
        {
          createdAt: {
            $gte: startDate29UTC,
            $lte: endDate29UTC
          }
        },
        {
          createdAt: {
            $gte: startDate30UTC,
            $lte: endDate30UTC
          }
        }
      ]
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
    
    // Check each response for missing Q7
    const responsesToMark = [];
    let checked = 0;
    let dec29Count = 0;
    let dec30Count = 0;
    
    console.log('🔍 Checking responses for missing Q7 (2025 Preference)...');
    
    for (const response of allResponses) {
      checked++;
      
      if (checked % 100 === 0) {
        console.log(`   Checked ${checked}/${allResponses.length} responses...`);
      }
      
      const responses = response.responses || [];
      const q7Response = findQ7Response(responses, survey);
      const q7IsEmpty = isQ7Empty(q7Response);
      
      // Determine which date this response belongs to
      const responseDate = new Date(response.createdAt);
      const isDec29 = responseDate >= startDate29UTC && responseDate <= endDate29UTC;
      const isDec30 = responseDate >= startDate30UTC && responseDate <= endDate30UTC;
      const dateLabel = isDec29 ? 'December 29, 2025' : (isDec30 ? 'December 30, 2025' : 'Unknown');
      
      if (q7IsEmpty) {
        if (isDec29) dec29Count++;
        if (isDec30) dec30Count++;
        
        responsesToMark.push({
          responseId: response.responseId || response._id.toString(),
          mongoId: response._id.toString(),
          sessionId: response.sessionId,
          interviewMode: response.interviewMode,
          oldStatus: response.status,
          q7Found: !!q7Response,
          q7QuestionId: q7Response?.questionId || null,
          q7QuestionText: q7Response?.questionText ? getMainText(q7Response.questionText) : null,
          q7ResponseValue: q7Response ? extractValue(q7Response.response) : null,
          date: dateLabel,
          createdAt: response.createdAt
        });
      }
    }
    
    console.log(`\n   ✅ Checked ${checked} responses`);
    console.log(`   Found ${responsesToMark.length} responses with missing Q7 (2025 Preference)\n`);
    
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
    console.log(`Responses with missing Q7 (2025 Preference): ${responsesToMark.length}`);
    console.log(`  - December 29: ${dec29Count}`);
    console.log(`  - December 30: ${dec30Count}`);
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
              abandonedReason: 'Missing Q7 (2025 Preference) response'
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
      operation: 'Mark Responses Without Q7 (2025 Preference) as Abandoned',
      surveyId: SURVEY_ID,
      surveyName: survey.surveyName || 'Unknown',
      dateRanges: {
        december29: {
          ist: {
            start: startDate29IST.toISOString(),
            end: endDate29IST.toISOString()
          },
          utc: {
            start: startDate29UTC.toISOString(),
            end: endDate29UTC.toISOString()
          }
        },
        december30: {
          ist: {
            start: startDate30IST.toISOString(),
            end: endDate30IST.toISOString()
          },
          utc: {
            start: startDate30UTC.toISOString(),
            end: endDate30UTC.toISOString()
          }
        }
      },
      criteria: {
        interviewMode: ['capi', 'cati'],
        oldStatus: 'not abandoned',
        question: 'Q7: 2025 Preference',
        missingQ7: true,
        newStatus: 'abandoned',
        abandonedReason: 'Missing Q7 (2025 Preference) response'
      },
      summary: {
        totalChecked: allResponses.length,
        totalFound: responsesToMark.length,
        december29: dec29Count,
        december30: dec30Count,
        totalUpdated: updated,
        success: updated === responsesToMark.length
      },
      updates: responsesToMark.map(r => ({
        ...r,
        updatedAt: new Date()
      }))
    };
    
    // Save JSON report
    const jsonPath = path.join(REPORT_DIR, `mark_responses_without_q7_${TIMESTAMP}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvRows = [
      'Response ID,Mongo ID,Session ID,Interview Mode,Date,Old Status,New Status,Abandoned Reason,Q7 Found,Q7 Question ID,Q7 Question Text,Q7 Response Value,Created At,Updated At'
    ];
    
    responsesToMark.forEach(log => {
      csvRows.push([
        log.responseId,
        log.mongoId,
        log.sessionId,
        log.interviewMode,
        log.date,
        log.oldStatus,
        'abandoned',
        'Missing Q7 (2025 Preference) response',
        log.q7Found ? 'Yes' : 'No',
        log.q7QuestionId || '(not found)',
        log.q7QuestionText || '(not found)',
        log.q7ResponseValue || '(empty/null)',
        new Date(log.createdAt).toISOString(),
        new Date().toISOString()
      ].join(','));
    });
    
    const csvPath = path.join(REPORT_DIR, `mark_responses_without_q7_${TIMESTAMP}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved: ${csvPath}`);
    
    // Save simple response IDs list
    const responseIdsList = responsesToMark.map(u => u.responseId).join('\n');
    const idsPath = path.join(REPORT_DIR, `response_ids_changed_q7_${TIMESTAMP}.txt`);
    fs.writeFileSync(idsPath, responseIdsList);
    console.log(`✅ Response IDs list saved: ${idsPath}`);
    
    // Final summary
    console.log('');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Responses Checked: ${allResponses.length}`);
    console.log(`Responses with Missing Q7 (2025 Preference): ${responsesToMark.length}`);
    console.log(`  - December 29, 2025: ${dec29Count}`);
    console.log(`  - December 30, 2025: ${dec30Count}`);
    console.log(`Total Responses Updated: ${updated}`);
    console.log(`New Status: abandoned`);
    console.log(`Abandoned Reason: Missing Q7 (2025 Preference) response`);
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
    const errorPath = path.join(REPORT_DIR, `mark_responses_q7_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  markResponsesWithoutQ7();
}

module.exports = { markResponsesWithoutQ7 };

