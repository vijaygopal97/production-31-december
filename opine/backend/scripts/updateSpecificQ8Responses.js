const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const QUESTION_ID = 'question_1761427016019_4497';

// Session IDs provided by user
const SESSION_IDS = [
  '40b8b5ac-047f-4cb7-a794-9d421384715d',
  '9deda76f-5eb9-44f9-8d57-c6202034a909',
  '91e89b39-ad69-4dfc-beb5-365b02861cc0',
  '7e2451fa-5207-4f62-a687-200e30176c9c',
  'fca729ea-fbd5-4060-bba8-62e165ea91bb',
  'b3dff23b-53ee-406e-bedf-81a2cca80e30',
  '8397cda4-92a3-42dc-aa59-add25a439091'
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

async function updateSpecificResponses() {
  console.log('=== Finding and Updating Specific Responses ===\n');
  
  const updatedIds = [];
  const notFoundIds = [];
  const alreadyUpdated = [];

  for (const sessionId of SESSION_IDS) {
    try {
      const response = await SurveyResponse.findOne({ 
        survey: SURVEY_ID,
        sessionId: sessionId 
      });

      if (!response) {
        console.log(`⚠️  Response with sessionId ${sessionId} not found`);
        notFoundIds.push(sessionId);
        continue;
      }

      const q8Resp = response.responses.find(r => r.questionId === QUESTION_ID);
      if (!q8Resp) {
        console.log(`⚠️  Q8 response not found for sessionId ${sessionId}`);
        notFoundIds.push(sessionId);
        continue;
      }

      const responseStr = Array.isArray(q8Resp.response) 
        ? JSON.stringify(q8Resp.response) 
        : String(q8Resp.response);

      // Check if it still has did_not_vote
      if (responseStr.toLowerCase().includes('did_not_vote')) {
        console.log(`\n📋 Found response ${response._id} (sessionId: ${sessionId})`);
        console.log(`   Current response: ${responseStr}`);
        console.log(`   Current code: ${q8Resp.responseCodes}`);

        // Update to "Will Not Vote"
        // Get the correct value from the survey - it should be "will_not_vote" with translations
        q8Resp.response = 'will_not_vote_{ভোট_দেবেন_না{मतदान_नहीं_करेंगे}}';
        q8Resp.responseCodes = '67';
        q8Resp.responseWithCodes = {
          code: '67',
          answer: 'Will not vote {ভোট দেবেন না{मतदान नहीं करेंगे}}',
          optionText: 'Will not vote {ভোট দেবেন না{मतदान नहीं करेंगे}}'
        };

        // Fix any validation errors in verificationData
        if (response.verificationData) {
          if (response.verificationData.criteria) {
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

        await response.save();
        updatedIds.push({ sessionId, responseId: response._id.toString() });
        console.log(`✅ Updated response ${response._id}`);
        console.log(`   New response: ${q8Resp.response}`);
        console.log(`   New code: ${q8Resp.responseCodes}`);
      } else {
        console.log(`ℹ️  Response ${response._id} (sessionId: ${sessionId}) already updated or doesn't have did_not_vote`);
        alreadyUpdated.push({ sessionId, responseId: response._id.toString(), currentResponse: responseStr });
      }
    } catch (error) {
      console.error(`❌ Error updating sessionId ${sessionId}:`, error.message);
      notFoundIds.push(sessionId);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updatedIds.length} responses`);
  console.log(`Already updated/No did_not_vote: ${alreadyUpdated.length} responses`);
  console.log(`Not found/Errors: ${notFoundIds.length} responses`);

  if (updatedIds.length > 0) {
    console.log('\n✅ Updated Response IDs:');
    updatedIds.forEach(({ sessionId, responseId }) => {
      console.log(`  - SessionId: ${sessionId}`);
      console.log(`    ResponseId: ${responseId}`);
    });
  }

  if (alreadyUpdated.length > 0) {
    console.log('\nℹ️  Already Updated/No did_not_vote:');
    alreadyUpdated.forEach(({ sessionId, responseId, currentResponse }) => {
      console.log(`  - SessionId: ${sessionId}, ResponseId: ${responseId}`);
      console.log(`    Current: ${currentResponse}`);
    });
  }

  if (notFoundIds.length > 0) {
    console.log('\n⚠️  Not Found/Errors:');
    notFoundIds.forEach(sessionId => {
      console.log(`  - ${sessionId}`);
    });
  }

  return { updatedIds, alreadyUpdated, notFoundIds };
}

async function main() {
  try {
    await connectDB();
    await updateSpecificResponses();
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


