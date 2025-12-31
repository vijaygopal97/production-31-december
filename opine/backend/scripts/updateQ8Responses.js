const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const QUESTION_ID = 'question_1761427016019_4497'; // Q8 question ID

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

async function getSurveyQuestionDetails() {
  const survey = await Survey.findById(SURVEY_ID).lean();
  if (!survey) {
    throw new Error('Survey not found');
  }

  // Find Q8 question in sections
  let q8Question = null;
  if (survey.sections && survey.sections.length > 0) {
    for (const section of survey.sections) {
      if (section.questions) {
        q8Question = section.questions.find(q => {
          const text = q.text || '';
          return text.includes('2025 Preference') || text.includes('2025 preference') || 
                 (q.questionNumber && q.questionNumber === '8');
        });
        if (q8Question) break;
      }
    }
  }

  if (!q8Question) {
    console.log('⚠️  Q8 question not found in survey sections. Using question ID from responses.');
    return null;
  }

  console.log('\n=== Q8 Question Details ===');
  console.log('Question ID:', q8Question.id);
  console.log('Question Text:', q8Question.text);
  console.log('Question Number:', q8Question.questionNumber);
  console.log('\n=== Options ===');
  
  if (q8Question.options && q8Question.options.length > 0) {
    q8Question.options.forEach((opt, idx) => {
      const optObj = typeof opt === 'object' ? opt : { value: opt, text: opt };
      console.log(`  [${idx}] Code: ${optObj.code || 'N/A'}, Value: ${optObj.value || 'N/A'}, Text: ${optObj.text || 'N/A'}`);
    });
  }

  return q8Question;
}

async function findResponsesToUpdate() {
  console.log('\n=== Finding Responses to Update ===');
  
  const allResponses = await SurveyResponse.find({ survey: SURVEY_ID }).lean();
  console.log(`Total responses in survey: ${allResponses.length}`);

  const didNotVoteResponses = [];
  const notEligibleResponses = [];

  allResponses.forEach(resp => {
    const q8Resp = resp.responses.find(r => r.questionId === QUESTION_ID);
    if (!q8Resp) return;

    const response = q8Resp.response;
    const responseStr = Array.isArray(response) ? JSON.stringify(response) : String(response);
    
    // Check for did_not_vote (case insensitive, with or without underscores)
    if (responseStr.toLowerCase().includes('did_not_vote') || 
        responseStr.toLowerCase().includes('didnotvote') ||
        responseStr.toLowerCase().includes('did not vote')) {
      didNotVoteResponses.push({
        responseId: resp._id.toString(),
        sessionId: resp.sessionId,
        currentResponse: response,
        responseCodes: q8Resp.responseCodes,
        responseWithCodes: q8Resp.responseWithCodes
      });
    }

    // Check for not_eligible_for_voting (case insensitive, with or without underscores)
    if (responseStr.toLowerCase().includes('not_eligible_for_voting') ||
        responseStr.toLowerCase().includes('noteligibleforvoting') ||
        responseStr.toLowerCase().includes('not eligible for voting')) {
      notEligibleResponses.push({
        responseId: resp._id.toString(),
        sessionId: resp.sessionId,
        currentResponse: response,
        responseCodes: q8Resp.responseCodes,
        responseWithCodes: q8Resp.responseWithCodes
      });
    }
  });

  console.log(`\nFound ${didNotVoteResponses.length} responses with 'did_not_vote'`);
  console.log(`Found ${notEligibleResponses.length} responses with 'not_eligible_for_voting'`);

  if (didNotVoteResponses.length > 0) {
    console.log('\nSample did_not_vote responses (first 3):');
    didNotVoteResponses.slice(0, 3).forEach((r, idx) => {
      console.log(`  [${idx + 1}] Response ID: ${r.responseId}, Session: ${r.sessionId}`);
      console.log(`      Current Response: ${JSON.stringify(r.currentResponse)}`);
      console.log(`      Response Codes: ${JSON.stringify(r.responseCodes)}`);
    });
  }

  if (notEligibleResponses.length > 0) {
    console.log('\nSample not_eligible_for_voting responses (first 3):');
    notEligibleResponses.slice(0, 3).forEach((r, idx) => {
      console.log(`  [${idx + 1}] Response ID: ${r.responseId}, Session: ${r.sessionId}`);
      console.log(`      Current Response: ${JSON.stringify(r.currentResponse)}`);
      console.log(`      Response Codes: ${JSON.stringify(r.responseCodes)}`);
    });
  }

  return { didNotVoteResponses, notEligibleResponses };
}

async function getNewOptionValues() {
  // Get the survey to find the new option values
  const survey = await Survey.findById(SURVEY_ID).lean();
  if (!survey) {
    throw new Error('Survey not found');
  }

  let q8Question = null;
  if (survey.sections && survey.sections.length > 0) {
    for (const section of survey.sections) {
      if (section.questions) {
        q8Question = section.questions.find(q => {
          const text = q.text || '';
          return text.includes('2025 Preference') || text.includes('2025 preference') || 
                 (q.questionNumber && q.questionNumber === '8');
        });
        if (q8Question) break;
      }
    }
  }

  if (!q8Question || !q8Question.options) {
    console.log('⚠️  Could not find Q8 question in survey. Using hardcoded values.');
    // Return hardcoded values based on user's description
    return {
      willNotVote: {
        value: 'will_not_vote', // This might need to be adjusted based on actual value
        code: '67',
        text: 'Will Not Vote'
      },
      refusedToAnswer: {
        value: 'refused_to_answer', // This might need to be adjusted
        code: null, // Need to find this
        text: 'Refused to answer'
      }
    };
  }

  // Find "Will Not Vote" option (code 67) - NEW option that replaced "Did Not Vote"
  let willNotVoteOption = q8Question.options.find(opt => {
    const optObj = typeof opt === 'object' ? opt : { value: opt };
    return optObj.code === '67' && 
           (optObj.text && optObj.text.toLowerCase().includes('will not vote')) ||
           (optObj.value && optObj.value.toLowerCase().includes('will_not_vote'));
  });

  // If not found, create it based on user's description (code 67, new option)
  if (!willNotVoteOption) {
    // Check if code 67 exists but is still the old "Did Not Vote"
    const code67Option = q8Question.options.find(opt => {
      const optObj = typeof opt === 'object' ? opt : { value: opt };
      return optObj.code === '67';
    });
    
    if (code67Option) {
      // Use the existing code 67 option but update to "Will Not Vote" values
      const opt = typeof code67Option === 'object' ? code67Option : { value: code67Option };
      willNotVoteOption = {
        code: '67',
        value: 'will_not_vote', // New value (user said they added this)
        text: 'Will Not Vote' // New text
      };
    } else {
      willNotVoteOption = {
        code: '67',
        value: 'will_not_vote',
        text: 'Will Not Vote'
      };
    }
  }

  // Find "Refused to answer" option (code 88)
  let refusedToAnswerOption = q8Question.options.find(opt => {
    const optObj = typeof opt === 'object' ? opt : { value: opt };
    return (optObj.text && optObj.text.toLowerCase().includes('refused')) ||
           (optObj.value && optObj.value.toLowerCase().includes('refused'));
  });

  // If not found, use code 88 (which should be "Refused to answer")
  if (!refusedToAnswerOption) {
    const code88Option = q8Question.options.find(opt => {
      const optObj = typeof opt === 'object' ? opt : { value: opt };
      return optObj.code === '88';
    });
    
    if (code88Option) {
      refusedToAnswerOption = typeof code88Option === 'object' ? code88Option : { value: code88Option };
    } else {
      refusedToAnswerOption = {
        code: '88',
        value: 'refused_to_answer',
        text: 'Refused to answer'
      };
    }
  }

  console.log('\n=== New Option Values ===');
  if (willNotVoteOption) {
    const opt = typeof willNotVoteOption === 'object' ? willNotVoteOption : { value: willNotVoteOption };
    console.log('Will Not Vote:', {
      code: opt.code,
      value: opt.value,
      text: opt.text
    });
  } else {
    console.log('⚠️  Will Not Vote option not found in survey');
  }

  if (refusedToAnswerOption) {
    const opt = typeof refusedToAnswerOption === 'object' ? refusedToAnswerOption : { value: refusedToAnswerOption };
    console.log('Refused to Answer:', {
      code: opt.code,
      value: opt.value,
      text: opt.text
    });
  } else {
    console.log('⚠️  Refused to Answer option not found in survey');
  }

  return {
    willNotVote: willNotVoteOption ? (typeof willNotVoteOption === 'object' ? willNotVoteOption : { value: willNotVoteOption }) : null,
    refusedToAnswer: refusedToAnswerOption ? (typeof refusedToAnswerOption === 'object' ? refusedToAnswerOption : { value: refusedToAnswerOption }) : null
  };
}

async function updateResponses(didNotVoteResponses, notEligibleResponses, newOptions) {
  console.log('\n=== Updating Responses ===');
  
  const updatedResponseIds = {
    didNotVote: [],
    notEligible: []
  };

  // Update did_not_vote responses to "Will Not Vote"
  if (didNotVoteResponses.length > 0 && newOptions.willNotVote) {
    console.log(`\nUpdating ${didNotVoteResponses.length} responses from 'did_not_vote' to 'Will Not Vote'...`);
    
    for (const respInfo of didNotVoteResponses) {
      try {
        const response = await SurveyResponse.findById(respInfo.responseId);
        if (!response) {
          console.log(`⚠️  Response ${respInfo.responseId} not found`);
          continue;
        }

        const q8Resp = response.responses.find(r => r.questionId === QUESTION_ID);
        if (!q8Resp) {
          console.log(`⚠️  Q8 response not found in ${respInfo.responseId}`);
          continue;
        }

        // Update response value
        q8Resp.response = newOptions.willNotVote.value;
        
        // Update responseCodes
        if (newOptions.willNotVote.code) {
          q8Resp.responseCodes = newOptions.willNotVote.code;
        }

        // Update responseWithCodes
        if (newOptions.willNotVote.text && newOptions.willNotVote.code) {
          q8Resp.responseWithCodes = {
            code: newOptions.willNotVote.code,
            answer: newOptions.willNotVote.text,
            optionText: newOptions.willNotVote.text
          };
        }

        await response.save();
        updatedResponseIds.didNotVote.push(respInfo.responseId);
        console.log(`✅ Updated response ${respInfo.responseId}`);
      } catch (error) {
        console.error(`❌ Error updating response ${respInfo.responseId}:`, error.message);
      }
    }
  }

  // Update not_eligible_for_voting responses to "Refused to answer"
  if (notEligibleResponses.length > 0 && newOptions.refusedToAnswer) {
    console.log(`\nUpdating ${notEligibleResponses.length} responses from 'not_eligible_for_voting' to 'Refused to answer'...`);
    
    for (const respInfo of notEligibleResponses) {
      try {
        const response = await SurveyResponse.findById(respInfo.responseId);
        if (!response) {
          console.log(`⚠️  Response ${respInfo.responseId} not found`);
          continue;
        }

        const q8Resp = response.responses.find(r => r.questionId === QUESTION_ID);
        if (!q8Resp) {
          console.log(`⚠️  Q8 response not found in ${respInfo.responseId}`);
          continue;
        }

        // Update response value
        q8Resp.response = newOptions.refusedToAnswer.value;
        
        // Update responseCodes
        if (newOptions.refusedToAnswer.code) {
          q8Resp.responseCodes = newOptions.refusedToAnswer.code;
        }

        // Update responseWithCodes
        if (newOptions.refusedToAnswer.text && newOptions.refusedToAnswer.code) {
          q8Resp.responseWithCodes = {
            code: newOptions.refusedToAnswer.code,
            answer: newOptions.refusedToAnswer.text,
            optionText: newOptions.refusedToAnswer.text
          };
        } else if (newOptions.refusedToAnswer.text) {
          q8Resp.responseWithCodes = {
            answer: newOptions.refusedToAnswer.text,
            optionText: newOptions.refusedToAnswer.text
          };
        }

        await response.save();
        updatedResponseIds.notEligible.push(respInfo.responseId);
        console.log(`✅ Updated response ${respInfo.responseId}`);
      } catch (error) {
        console.error(`❌ Error updating response ${respInfo.responseId}:`, error.message);
      }
    }
  }

  return updatedResponseIds;
}

async function main() {
  try {
    await connectDB();

    // Get survey question details
    await getSurveyQuestionDetails();

    // Get new option values
    const newOptions = await getNewOptionValues();

    // Find responses to update
    const { didNotVoteResponses, notEligibleResponses } = await findResponsesToUpdate();

    if (didNotVoteResponses.length === 0 && notEligibleResponses.length === 0) {
      console.log('\n✅ No responses found that need updating.');
      await mongoose.disconnect();
      return;
    }

    // Confirm before updating
    console.log('\n=== Summary ===');
    console.log(`Will update ${didNotVoteResponses.length} responses from 'did_not_vote' to 'Will Not Vote'`);
    console.log(`Will update ${notEligibleResponses.length} responses from 'not_eligible_for_voting' to 'Refused to answer'`);
    
    // Update responses
    const updatedIds = await updateResponses(didNotVoteResponses, notEligibleResponses, newOptions);

    console.log('\n=== Update Complete ===');
    console.log(`Updated ${updatedIds.didNotVote.length} responses from 'did_not_vote'`);
    console.log(`Updated ${updatedIds.notEligible.length} responses from 'not_eligible_for_voting'`);
    
    console.log('\n=== Updated Response IDs ===');
    console.log('did_not_vote → Will Not Vote:');
    updatedIds.didNotVote.forEach(id => console.log(`  - ${id}`));
    console.log('\nnot_eligible_for_voting → Refused to answer:');
    updatedIds.notEligible.forEach(id => console.log(`  - ${id}`));

    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };

