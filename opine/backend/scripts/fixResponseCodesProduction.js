const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load production .env file
const envPath = '/var/www/opine/backend/.env';
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

// Response IDs to fix
const RESPONSE_IDS_TO_FIX = [
  '4486a185-54a3-4825-a07e-ccf9a56d8bbc',
  'b0bc93dd-4ebc-487e-8f32-8fba5771b8f9',
  '04c935a0-3143-4fdf-b2bd-edd20878651b',
  '3aa2da83-2a3f-4967-baf7-bfbc17e14ca4',
  'f9e19c05-c85f-4fba-8c8c-9276b73e572f',
  '89f3bd48-344d-4d84-8917-455c07ea35e6',
  'd0064ede-911f-45dd-8f30-55247b2464c5',
  '294c94ff-19f0-4b6b-bbe4-2040802f3a21',
  '208ff04f-af06-4503-9349-4e3361bad9d0',
  '99f89a1c-284e-489c-b386-8bf46ac49f82',
  '3f44b37d-60a4-4af1-9e18-237f0543c536',
  '920ff544-136a-4964-97cd-20851bf97a8f',
  '32e1acaf-0fe4-49ba-8f86-a96fc9485e51',
  'b8049594-9d0b-408e-91e4-b6c05a44e32a',
  '149f3615-03c5-444a-a37f-5aed59bb4cfc',
  '53b6546d-0c4f-4384-b33d-5847a5ebf2c8',
  '3fc478d8-4ee0-4ed0-8ce5-fc1f48f7e447'
];

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

async function fixResponses() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const survey = await Survey.findById(SURVEY_ID).lean();
    if (!survey) {
      throw new Error('Survey not found');
    }
    
    // Find thanks_future question
    let thanksFutureQuestion = null;
    if (survey.sections && survey.sections.length > 0) {
      for (const section of survey.sections) {
        if (section.questions) {
          thanksFutureQuestion = section.questions.find(q => {
            const text = (q.text || '').toLowerCase();
            return text.includes('future') || text.includes('contact') || 
                   (q.id && q.id.toLowerCase().includes('future'));
          });
          if (thanksFutureQuestion) break;
        }
      }
    }
    
    if (!thanksFutureQuestion) {
      throw new Error('thanks_future question not found in survey');
    }
    
    console.log('\n=== FIXING RESPONSES IN PRODUCTION ===');
    console.log(`Found thanks_future question: ${thanksFutureQuestion.id}`);
    console.log(`Options:`, thanksFutureQuestion.options.map(opt => ({ text: opt.text, code: opt.code })));
    
    let fixedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const responseId of RESPONSE_IDS_TO_FIX) {
      try {
        const response = await SurveyResponse.findOne({ responseId });
        if (!response) {
          console.log(`⚠️  Response ${responseId} not found`);
          skippedCount++;
          continue;
        }
        
        const thanksFutureIndex = response.responses.findIndex(r => 
          r.questionId === thanksFutureQuestion.id ||
          (r.questionText && r.questionText.toLowerCase().includes('future'))
        );
        
        if (thanksFutureIndex === -1) {
          console.log(`⚠️  thanks_future question not found in response ${responseId}`);
          skippedCount++;
          continue;
        }
        
        const thanksFutureResponse = response.responses[thanksFutureIndex];
        const currentResponse = thanksFutureResponse.response;
        
        // Check if response is already a code (numeric string)
        if (typeof currentResponse === 'string' && /^\d+$/.test(currentResponse.trim())) {
          console.log(`✓ Response ${responseId} already has code: ${currentResponse}`);
          skippedCount++;
          continue;
        }
        
        // Try to use responseCodes if it's already correct
        let correctCode = null;
        if (thanksFutureResponse.responseCodes && /^\d+$/.test(String(thanksFutureResponse.responseCodes).trim())) {
          correctCode = String(thanksFutureResponse.responseCodes).trim();
          console.log(`✓ Using existing responseCodes: ${correctCode} for response ${responseId}`);
        } else {
          // Find matching option
          const matchingOption = findMatchingOption(currentResponse, thanksFutureQuestion.options);
          
          if (!matchingOption) {
            console.log(`⚠️  Could not find matching option for "${currentResponse}" in response ${responseId}`);
            errorCount++;
            continue;
          }
          
          // Get the code from the option
          correctCode = matchingOption.code || matchingOption.value;
          
          if (!correctCode) {
            console.log(`⚠️  Option found but no code available for response ${responseId}`);
            errorCount++;
            continue;
          }
        }
        
        // Update the response field to use the code instead of text
        response.responses[thanksFutureIndex].response = String(correctCode);
        response.responses[thanksFutureIndex].responseCodes = String(correctCode);
        
        // Update responseWithCodes if it exists
        if (response.responses[thanksFutureIndex].responseWithCodes) {
          if (Array.isArray(response.responses[thanksFutureIndex].responseWithCodes)) {
            response.responses[thanksFutureIndex].responseWithCodes = response.responses[thanksFutureIndex].responseWithCodes.map(item => {
              if (typeof item === 'object' && item.code) {
                return { ...item, code: String(correctCode) };
              }
              return item;
            });
          } else if (typeof response.responses[thanksFutureIndex].responseWithCodes === 'object') {
            response.responses[thanksFutureIndex].responseWithCodes.code = String(correctCode);
          }
        }
        
        // Mark responses array as modified
        response.markModified('responses');
        
        try {
          await response.save();
          console.log(`✅ Fixed response ${responseId}: "${currentResponse}" -> "${correctCode}"`);
          fixedCount++;
        } catch (saveError) {
          // If save fails due to validation, use direct MongoDB update to bypass validation
          if (saveError.name === 'ValidationError') {
            console.log(`⚠️  Save failed due to validation, using direct MongoDB update for ${responseId}`);
            await SurveyResponse.updateOne(
              { _id: response._id },
              { 
                $set: { 
                  [`responses.${thanksFutureIndex}.response`]: String(correctCode),
                  [`responses.${thanksFutureIndex}.responseCodes`]: String(correctCode)
                }
              }
            );
            console.log(`✅ Fixed response ${responseId} using direct update: "${currentResponse}" -> "${correctCode}"`);
            fixedCount++;
          } else {
            throw saveError;
          }
        }
      } catch (error) {
        console.error(`❌ Error fixing response ${responseId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped (already correct): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${RESPONSE_IDS_TO_FIX.length}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
fixResponses();

