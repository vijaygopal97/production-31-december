const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load .env file manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');

const SURVEY_ID = '68fd1915d41841da463f0d46';

// Helper function to normalize text for matching
function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[,_\s-]/g, ' ').trim();
}

// Helper function to find matching option by text
function findMatchingOption(responseText, questionOptions) {
  if (!responseText || !questionOptions || questionOptions.length === 0) {
    return null;
  }
  
  const normalizedResponse = normalizeText(responseText);
  
  // Try exact match first
  for (const option of questionOptions) {
    const optText = typeof option === 'object' ? (option.text || option.value) : option;
    const normalizedOption = normalizeText(optText);
    
    if (normalizedResponse === normalizedOption) {
      return option;
    }
  }
  
  // Try partial match (contains)
  for (const option of questionOptions) {
    const optText = typeof option === 'object' ? (option.text || option.value) : option;
    const normalizedOption = normalizeText(optText);
    
    // Check if response contains key words from option or vice versa
    if (normalizedResponse.includes('yes') && normalizedOption.includes('yes') && 
        (normalizedResponse.includes('you') || normalizedResponse.includes('can') ||
         normalizedOption.includes('you') || normalizedOption.includes('can'))) {
      return option;
    }
    
    // Check if response text matches option text (fuzzy match)
    const responseWords = normalizedResponse.split(/\s+/).filter(w => w.length > 2);
    const optionWords = normalizedOption.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = responseWords.filter(w => optionWords.includes(w));
    
    if (matchingWords.length >= Math.min(responseWords.length, optionWords.length) * 0.7) {
      return option;
    }
  }
  
  return null;
}

async function fixAllResponses() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const survey = await Survey.findById(SURVEY_ID).lean();
    if (!survey) {
      throw new Error('Survey not found');
    }
    
    // Build a map of questionId -> question for quick lookup
    const questionMap = new Map();
    if (survey.sections && survey.sections.length > 0) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.id && question.options && question.options.length > 0) {
              questionMap.set(question.id, question);
            }
          }
        }
      }
    }
    
    console.log(`\n=== FINDING RESPONSES TO FIX ===`);
    console.log(`Found ${questionMap.size} questions with options`);
    
    // Find all responses for this survey
    const allResponses = await SurveyResponse.find({ survey: SURVEY_ID }).lean();
    console.log(`Found ${allResponses.length} total responses`);
    
    let totalFixed = 0;
    let totalErrors = 0;
    const fixedResponseIds = [];
    
    for (const response of allResponses) {
      if (!response.responses || !Array.isArray(response.responses)) {
        continue;
      }
      
      let responseFixed = false;
      const updates = {};
      
      for (let i = 0; i < response.responses.length; i++) {
        const resp = response.responses[i];
        if (!resp.questionId || !resp.response) {
          continue;
        }
        
        const question = questionMap.get(resp.questionId);
        if (!question || !question.options || question.options.length === 0) {
          continue;
        }
        
        const currentResponse = resp.response;
        const currentResponseCodes = resp.responseCodes;
        
        // Skip if response is already a code (numeric string)
        if (typeof currentResponse === 'string' && /^\d+$/.test(currentResponse.trim())) {
          continue;
        }
        
        // Skip if responseCodes is already correct
        if (currentResponseCodes && /^\d+$/.test(String(currentResponseCodes).trim())) {
          // Response field has text but responseCodes has code - fix response field
          const correctCode = String(currentResponseCodes).trim();
          updates[`responses.${i}.response`] = correctCode;
          responseFixed = true;
          continue;
        }
        
        // Find matching option
        const matchingOption = findMatchingOption(currentResponse, question.options);
        
        if (matchingOption) {
          const correctCode = matchingOption.code || matchingOption.value;
          if (correctCode && /^\d+$/.test(String(correctCode).trim())) {
            updates[`responses.${i}.response`] = String(correctCode).trim();
            updates[`responses.${i}.responseCodes`] = String(correctCode).trim();
            responseFixed = true;
          }
        }
      }
      
      if (responseFixed && Object.keys(updates).length > 0) {
        try {
          await SurveyResponse.updateOne(
            { _id: response._id },
            { $set: updates }
          );
          fixedResponseIds.push(response.responseId || response._id.toString());
          totalFixed++;
          if (totalFixed % 100 === 0) {
            console.log(`Fixed ${totalFixed} responses...`);
          }
        } catch (error) {
          console.error(`❌ Error fixing response ${response.responseId || response._id}:`, error.message);
          totalErrors++;
        }
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total responses examined: ${allResponses.length}`);
    console.log(`Responses fixed: ${totalFixed}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`\nFixed response IDs (first 20):`, fixedResponseIds.slice(0, 20));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
fixAllResponses();

