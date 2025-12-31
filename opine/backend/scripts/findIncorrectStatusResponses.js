const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const { findGenderResponse, getMainText } = require('../utils/genderUtils');
const fs = require('fs').promises;
const path = require('path');

// Survey ID to check
const SURVEY_ID = '68fd1915d41841da463f0d46';

// Batch size for processing (to avoid memory issues)
const BATCH_SIZE = 1000;

// Output directory (save to Report-Generation directory)
const OUTPUT_DIR = '/var/www/Report-Generation/IncorrectStatusCorrection';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

/**
 * Helper function to normalize question text (remove translations, trim, lowercase)
 */
function normalizeQuestionText(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove translation markers like {en: English, hi: Hindi}
  const cleaned = text.replace(/\{[^}]+\}/g, '').trim();
  return cleaned.toLowerCase();
}

/**
 * Check if a response value is empty
 */
function isEmptyResponse(response) {
  if (response === null || response === undefined) return true;
  if (typeof response === 'string' && response.trim() === '') return true;
  if (Array.isArray(response) && response.length === 0) return true;
  if (Array.isArray(response) && response.every(item => !item || (typeof item === 'string' && item.trim() === ''))) return true;
  return false;
}

/**
 * Find response by question text patterns
 */
function findResponseByPatterns(responses, patterns) {
  if (!responses || !Array.isArray(responses)) return null;
  
  for (const response of responses) {
    const questionText = normalizeQuestionText(response.questionText || '');
    for (const pattern of patterns) {
      if (questionText.includes(pattern.toLowerCase())) {
        return response;
      }
    }
  }
  return null;
}

/**
 * Check if a response has all required fields
 */
function checkResponseCompleteness(responseDoc, survey) {
  const issues = [];
  const responses = responseDoc.responses || [];
  const interviewMode = responseDoc.interviewMode || '';
  const isCAPI = interviewMode.toLowerCase() === 'capi';
  
  // 1. Check Age question: "Could you please tell me your age in complete years?"
  const agePatterns = [
    'could you please tell me your age',
    'your age in complete years',
    'age in complete years',
    'tell me your age'
  ];
  const ageResponse = findResponseByPatterns(responses, agePatterns);
  if (!ageResponse || isEmptyResponse(ageResponse.response)) {
    issues.push('MISSING_AGE');
  }
  
  // 2. Check Gender question: Use the same logic as ResponseDetailsModal
  // First try findGenderResponse (checks question ID, question text, registered voter question, and survey questions)
  let genderResponse = findGenderResponse(responses, survey);
  
  // Fallback: if not found, try specific patterns for this survey
  if (!genderResponse) {
    genderResponse = findResponseByPatterns(responses, [
      'please note the respondent\'s gender',
      'note the respondent\'s gender',
      'respondent\'s gender',
      'respondent gender',
      'note the gender',
      'what is your gender',
      'gender'
    ]);
  }
  
  if (!genderResponse || isEmptyResponse(genderResponse.response)) {
    issues.push('MISSING_GENDER');
  }
  
  // 3. Check AC question: "Select Assembly Constituency" (only for CAPI)
  let acResponse = null;
  if (isCAPI) {
    const acPatterns = [
      'select assembly constituency',
      'assembly constituency',
      'select ac'
    ];
    acResponse = findResponseByPatterns(responses, acPatterns);
    if (!acResponse || isEmptyResponse(acResponse.response)) {
      issues.push('MISSING_AC');
    }
  }
  
  // 4. Check 2025 Preference question
  const preferencePatterns = [
    '2025 preference',
    'preference 2025',
    '2025',
    'preference'
  ];
  const preferenceResponse = findResponseByPatterns(responses, preferencePatterns);
  if (!preferenceResponse || isEmptyResponse(preferenceResponse.response)) {
    issues.push('MISSING_2025_PREFERENCE');
  }
  
  return {
    hasIssues: issues.length > 0,
    issues: issues,
    ageFound: !!ageResponse,
    genderFound: !!genderResponse,
    acFound: isCAPI ? !!acResponse : null, // null means not applicable (CATI)
    preferenceFound: !!preferenceResponse
  };
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Main function to find incorrectly marked responses
 */
async function findIncorrectStatusResponses() {
  try {
    await connectDB();
    
    console.log('\n🔍 Starting analysis of survey responses...');
    console.log(`📋 Survey ID: ${SURVEY_ID}`);
    console.log(`📊 Processing in batches of ${BATCH_SIZE} responses\n`);
    
    // Verify survey exists and load full survey data (sections and questions)
    const survey = await Survey.findById(SURVEY_ID)
      .select('surveyName sections questions');
    if (!survey) {
      console.error(`❌ Survey ${SURVEY_ID} not found!`);
      process.exit(1);
    }
    console.log(`✅ Survey found: ${survey.surveyName}\n`);
    
    // Get total count of responses to check
    const totalCount = await SurveyResponse.countDocuments({
      survey: SURVEY_ID,
      status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
    });
    
    console.log(`📊 Total responses to check: ${totalCount}`);
    console.log(`📊 Statuses: Approved, Pending_Approval, Rejected\n`);
    
    // Results storage
    const incorrectResponses = [];
    let processedCount = 0;
    let batchNumber = 0;
    
    // Process in batches using cursor
    const cursor = SurveyResponse.find({
      survey: SURVEY_ID,
      status: { $in: ['Approved', 'Pending_Approval', 'Rejected'] }
    })
      .select('_id responseId status interviewMode responses createdAt')
      .lean()
      .cursor({ batchSize: BATCH_SIZE });
    
    console.log('🔄 Processing responses...\n');
    
    for await (const responseDoc of cursor) {
      processedCount++;
      batchNumber = Math.ceil(processedCount / BATCH_SIZE);
      
      // Check response completeness (pass survey for gender detection)
      const checkResult = checkResponseCompleteness(responseDoc, survey);
      
      if (checkResult.hasIssues) {
        incorrectResponses.push({
          _id: responseDoc._id.toString(),
          responseId: responseDoc.responseId || 'N/A',
          status: responseDoc.status,
          interviewMode: responseDoc.interviewMode || 'unknown',
          issues: checkResult.issues,
          ageFound: checkResult.ageFound,
          genderFound: checkResult.genderFound,
          acFound: checkResult.acFound,
          preferenceFound: checkResult.preferenceFound,
          createdAt: responseDoc.createdAt
        });
      }
      
      // Progress update every 1000 responses
      if (processedCount % 1000 === 0) {
        console.log(`   Processed: ${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%) - Found: ${incorrectResponses.length} incorrect`);
      }
    }
    
    console.log(`\n✅ Processing completed!`);
    console.log(`📊 Total processed: ${processedCount}`);
    console.log(`❌ Incorrect responses found: ${incorrectResponses.length}\n`);
    
    // Generate summary statistics
    const summary = {
      surveyId: SURVEY_ID,
      surveyName: survey.surveyName,
      totalResponsesChecked: processedCount,
      incorrectResponsesCount: incorrectResponses.length,
      timestamp: new Date().toISOString(),
      issuesBreakdown: {
        missingAge: incorrectResponses.filter(r => r.issues.includes('MISSING_AGE')).length,
        missingGender: incorrectResponses.filter(r => r.issues.includes('MISSING_GENDER')).length,
        missingAC: incorrectResponses.filter(r => r.issues.includes('MISSING_AC')).length,
        missingPreference: incorrectResponses.filter(r => r.issues.includes('MISSING_2025_PREFERENCE')).length
      },
      statusBreakdown: {
        Approved: incorrectResponses.filter(r => r.status === 'Approved').length,
        Pending_Approval: incorrectResponses.filter(r => r.status === 'Pending_Approval').length,
        Rejected: incorrectResponses.filter(r => r.status === 'Rejected').length
      },
      modeBreakdown: {
        CAPI: incorrectResponses.filter(r => r.interviewMode === 'capi').length,
        CATI: incorrectResponses.filter(r => r.interviewMode === 'cati').length,
        Online: incorrectResponses.filter(r => r.interviewMode === 'online').length,
        Unknown: incorrectResponses.filter(r => !r.interviewMode || r.interviewMode === 'unknown').length
      }
    };
    
    // Save results to JSON file
    const jsonOutputPath = path.join(OUTPUT_DIR, `incorrect_status_responses_${TIMESTAMP}.json`);
    await fs.writeFile(jsonOutputPath, JSON.stringify({
      summary: summary,
      responses: incorrectResponses
    }, null, 2));
    
    // Save summary to text file
    const summaryOutputPath = path.join(OUTPUT_DIR, `incorrect_status_summary_${TIMESTAMP}.txt`);
    const summaryText = `
INCORRECT STATUS RESPONSES REPORT
==================================

Survey: ${summary.surveyName}
Survey ID: ${summary.surveyId}
Generated: ${summary.timestamp}

TOTAL RESPONSES CHECKED: ${summary.totalResponsesChecked}
INCORRECT RESPONSES FOUND: ${summary.incorrectResponsesCount}

ISSUES BREAKDOWN:
-----------------
Missing Age: ${summary.issuesBreakdown.missingAge}
Missing Gender: ${summary.issuesBreakdown.missingGender}
Missing AC (CAPI only): ${summary.issuesBreakdown.missingAC}
Missing 2025 Preference: ${summary.issuesBreakdown.missingPreference}

STATUS BREAKDOWN:
-----------------
Approved: ${summary.statusBreakdown.Approved}
Pending_Approval: ${summary.statusBreakdown.Pending_Approval}
Rejected: ${summary.statusBreakdown.Rejected}

MODE BREAKDOWN:
---------------
CAPI: ${summary.modeBreakdown.CAPI}
CATI: ${summary.modeBreakdown.CATI}
Online: ${summary.modeBreakdown.Online}
Unknown: ${summary.modeBreakdown.Unknown}

RESPONSE IDs:
-------------
${incorrectResponses.map(r => `- ${r.responseId || r._id} (${r.status}, ${r.interviewMode}) - Issues: ${r.issues.join(', ')}`).join('\n')}

Full details saved to: ${jsonOutputPath}
`;
    
    await fs.writeFile(summaryOutputPath, summaryText);
    
    // Save response IDs only (for easy copy-paste)
    const idsOutputPath = path.join(OUTPUT_DIR, `incorrect_status_response_ids_${TIMESTAMP}.txt`);
    const responseIds = incorrectResponses.map(r => r.responseId || r._id).join('\n');
    await fs.writeFile(idsOutputPath, responseIds);
    
    console.log('📄 Reports saved:');
    console.log(`   - Full report: ${jsonOutputPath}`);
    console.log(`   - Summary: ${summaryOutputPath}`);
    console.log(`   - Response IDs only: ${idsOutputPath}\n`);
    
    // Print summary to console
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total Checked: ${summary.totalResponsesChecked}`);
    console.log(`Incorrect Found: ${summary.incorrectResponsesCount}`);
    console.log(`\nIssues:`);
    console.log(`  - Missing Age: ${summary.issuesBreakdown.missingAge}`);
    console.log(`  - Missing Gender: ${summary.issuesBreakdown.missingGender}`);
    console.log(`  - Missing AC (CAPI): ${summary.issuesBreakdown.missingAC}`);
    console.log(`  - Missing 2025 Preference: ${summary.issuesBreakdown.missingPreference}`);
    console.log(`\nBy Status:`);
    console.log(`  - Approved: ${summary.statusBreakdown.Approved}`);
    console.log(`  - Pending_Approval: ${summary.statusBreakdown.Pending_Approval}`);
    console.log(`  - Rejected: ${summary.statusBreakdown.Rejected}`);
    console.log('='.repeat(60));
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
findIncorrectStatusResponses();

