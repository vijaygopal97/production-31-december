const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const QUESTION_ID = 'question_1761427016019_4497';

// IDs provided by user (could be sessionId, responseId, or _id)
const SEARCH_IDS = [
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

async function findAndUpdateResponses() {
  console.log('=== Finding All Responses with did_not_vote in Q8 ===\n');
  
  // First, find all responses with did_not_vote
  const allResponses = await SurveyResponse.find({ survey: SURVEY_ID }).lean();
  const foundResponses = [];
  
  allResponses.forEach(resp => {
    const q8 = resp.responses.find(r => r.questionId === QUESTION_ID);
    if (q8) {
      const respStr = Array.isArray(q8.response) ? JSON.stringify(q8.response) : String(q8.response);
      if (respStr.toLowerCase().includes('did_not_vote')) {
        foundResponses.push({
          _id: resp._id.toString(),
          sessionId: resp.sessionId,
          responseId: resp.responseId || 'N/A',
          currentResponse: respStr,
          responseCode: q8.responseCodes
        });
      }
    }
  });

  console.log(`Found ${foundResponses.length} responses with did_not_vote in Q8:\n`);
  foundResponses.forEach((r, idx) => {
    console.log(`[${idx + 1}] _id: ${r._id}`);
    console.log(`    sessionId: ${r.sessionId}`);
    console.log(`    responseId: ${r.responseId}`);
    console.log(`    currentResponse: ${r.currentResponse}`);
    console.log(`    responseCode: ${r.responseCode}`);
    console.log('');
  });

  // Now try to match the provided IDs
  console.log('\n=== Matching Provided IDs ===\n');
  const matched = [];
  const notMatched = [];

  for (const searchId of SEARCH_IDS) {
    const found = foundResponses.find(r => 
      r._id === searchId || 
      r.sessionId === searchId || 
      r.responseId === searchId
    );

    if (found) {
      matched.push({ searchId, found });
      console.log(`✅ Matched: ${searchId} -> _id: ${found._id}, sessionId: ${found.sessionId}`);
    } else {
      notMatched.push(searchId);
      console.log(`❌ Not matched: ${searchId}`);
    }
  }

  // Update matched responses
  console.log('\n=== Updating Matched Responses ===\n');
  const updatedIds = [];
  const failedIds = [];

  for (const { searchId, found } of matched) {
    try {
      const response = await SurveyResponse.findById(found._id);
      if (!response) {
        console.log(`⚠️  Response ${found._id} not found`);
        failedIds.push({ searchId, reason: 'Not found after match' });
        continue;
      }

      const q8Resp = response.responses.find(r => r.questionId === QUESTION_ID);
      if (!q8Resp) {
        console.log(`⚠️  Q8 response not found in ${found._id}`);
        failedIds.push({ searchId, reason: 'Q8 response not found' });
        continue;
      }

      // Update to "Will Not Vote"
      q8Resp.response = 'will_not_vote_{ভোট_দেবেন_না{मतदान_नहीं_करेंगे}}';
      q8Resp.responseCodes = '67';
      q8Resp.responseWithCodes = {
        code: '67',
        answer: 'Will not vote {ভোট দেবেন না{मतदान नहीं करेंगे}}',
        optionText: 'Will not vote {ভোট দেবেন না{मतदान नहीं करेंगे}}'
      };

      // Fix validation errors
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
      updatedIds.push({ searchId, responseId: found._id, sessionId: found.sessionId });
      console.log(`✅ Updated: ${searchId} -> _id: ${found._id}`);
    } catch (error) {
      console.error(`❌ Error updating ${searchId}:`, error.message);
      failedIds.push({ searchId, reason: error.message });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total found with did_not_vote: ${foundResponses.length}`);
  console.log(`Matched with provided IDs: ${matched.length}`);
  console.log(`Updated: ${updatedIds.length}`);
  console.log(`Failed: ${failedIds.length}`);
  console.log(`Not matched: ${notMatched.length}`);

  if (updatedIds.length > 0) {
    console.log('\n✅ Updated Response IDs:');
    updatedIds.forEach(({ searchId, responseId, sessionId }) => {
      console.log(`  - Search ID: ${searchId}`);
      console.log(`    Response _id: ${responseId}`);
      console.log(`    Session ID: ${sessionId}`);
    });
  }

  if (failedIds.length > 0) {
    console.log('\n❌ Failed:');
    failedIds.forEach(({ searchId, reason }) => {
      console.log(`  - ${searchId}: ${reason}`);
    });
  }

  if (notMatched.length > 0) {
    console.log('\n⚠️  Not Matched (check if these IDs are correct):');
    notMatched.forEach(id => {
      console.log(`  - ${id}`);
    });
  }

  return { foundResponses, matched, updatedIds, failedIds, notMatched };
}

async function main() {
  try {
    await connectDB();
    await findAndUpdateResponses();
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


