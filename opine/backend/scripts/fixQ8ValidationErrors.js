const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const QUESTION_ID = 'question_1761427016019_4497';

// Response IDs that failed validation
const FAILED_RESPONSE_IDS = [
  '693f87098b3b8fb6db938d82',
  '694131593fe50732981e2892',
  '6942479467d048ca77f121a5',
  '693d578b091c03354305e384',
  '694101eb3fbf1f6f6003294b'
];

async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixValidationErrors() {
  console.log('=== Fixing Validation Errors ===\n');
  
  const fixedIds = [];
  const stillFailed = [];

  for (const responseId of FAILED_RESPONSE_IDS) {
    try {
      const response = await SurveyResponse.findById(responseId);
      if (!response) {
        console.log(`⚠️  Response ${responseId} not found`);
        continue;
      }

      // Fix empty enum values in verificationData
      if (response.verificationData) {
        if (response.verificationData.criteria) {
          // Fix criteria enum values - set empty strings to null
          const enumFields = [
            'genderMatching',
            'upcomingElectionsMatching',
            'previousElectionsMatching',
            'previousLoksabhaElectionsMatching',
            'nameMatching',
            'ageMatching',
            'phoneNumberAsked'
          ];
          
          enumFields.forEach(field => {
            if (response.verificationData.criteria[field] === '') {
              response.verificationData.criteria[field] = null;
            }
          });
        }

        // Fix top-level enum values
        const enumFields = [
          'genderMatching',
          'upcomingElectionsMatching',
          'previousElectionsMatching',
          'previousLoksabhaElectionsMatching',
          'nameMatching',
          'ageMatching',
          'phoneNumberAsked'
        ];
        
        enumFields.forEach(field => {
          if (response.verificationData[field] === '') {
            response.verificationData[field] = null;
          }
        });
      }

      // Now update the Q8 response
      const q8Resp = response.responses.find(r => r.questionId === QUESTION_ID);
      if (q8Resp) {
        const responseStr = Array.isArray(q8Resp.response) ? JSON.stringify(q8Resp.response) : String(q8Resp.response);
        
        // Check if it needs to be updated
        if (responseStr.toLowerCase().includes('not_eligible_for_voting')) {
          // Update to "Refused to answer"
          q8Resp.response = 'refused_to_answer_{উত্তর_দিতে_অস্বীকার_করেছেন}';
          q8Resp.responseCodes = '88';
          q8Resp.responseWithCodes = {
            code: '88',
            answer: 'Refused to answer {উত্তর দিতে অস্বীকার করেছেন}',
            optionText: 'Refused to answer {উত্তর দিতে অস্বীকার করেছেন}'
          };
        } else if (responseStr.toLowerCase().includes('did_not_vote')) {
          // Update to "Will Not Vote"
          q8Resp.response = 'will_not_vote';
          q8Resp.responseCodes = '67';
          q8Resp.responseWithCodes = {
            code: '67',
            answer: 'Will Not Vote',
            optionText: 'Will Not Vote'
          };
        }
      }

      await response.save();
      fixedIds.push(responseId);
      console.log(`✅ Fixed response ${responseId}`);
    } catch (error) {
      console.error(`❌ Error fixing response ${responseId}:`, error.message);
      stillFailed.push({ id: responseId, error: error.message });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed: ${fixedIds.length} responses`);
  console.log(`Still failed: ${stillFailed.length} responses`);
  
  if (fixedIds.length > 0) {
    console.log('\nFixed Response IDs:');
    fixedIds.forEach(id => console.log(`  - ${id}`));
  }
  
  if (stillFailed.length > 0) {
    console.log('\nStill Failed:');
    stillFailed.forEach(({ id, error }) => console.log(`  - ${id}: ${error}`));
  }

  return { fixedIds, stillFailed };
}

async function main() {
  try {
    await connectDB();
    await fixValidationErrors();
    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };


