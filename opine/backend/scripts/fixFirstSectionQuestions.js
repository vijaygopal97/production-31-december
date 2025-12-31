const mongoose = require('mongoose');
require('dotenv').config();

// Import the Survey model
const Survey = require('../models/Survey');

const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';

async function fixFirstSectionQuestions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the target survey
    const survey = await Survey.findById(TARGET_SURVEY_ID);
    
    if (!survey) {
      console.error(`❌ Survey not found: ${TARGET_SURVEY_ID}`);
      process.exit(1);
    }

    console.log(`📋 Found survey: ${survey.surveyName}`);
    
    let updatedSections = JSON.parse(JSON.stringify(survey.sections)); // Deep clone
    
    // Ensure first section exists
    if (!updatedSections || updatedSections.length === 0) {
      console.error('❌ No sections found in survey');
      process.exit(1);
    }
    
    const firstSection = updatedSections[0];
    if (!firstSection.questions) {
      firstSection.questions = [];
    }
    
    // Filter out corrupted questions (those with undefined text, id, or type)
    const validQuestions = firstSection.questions.filter(q => 
      q && q.id && q.text && q.type
    );
    
    console.log(`📝 Found ${firstSection.questions.length} total questions, ${validQuestions.length} valid questions`);
    
    // Ensure we have the 3 fixed questions (unprotected)
    const requiredQuestionIds = [
      '68fd1915d41841da463f0d46_fixed_respondent_name',
      '68fd1915d41841da463f0d46_fixed_respondent_gender',
      '68fd1915d41841da463f0d46_fixed_respondent_age'
    ];
    
    const existingQuestionIds = validQuestions.map(q => q.id);
    const missingIds = requiredQuestionIds.filter(id => !existingQuestionIds.includes(id));
    
    if (missingIds.length > 0) {
      console.log(`⚠️  Missing question IDs: ${missingIds.join(', ')}`);
    }
    
    // Build final questions array - keep valid questions that match required IDs, remove corrupted ones
    const finalQuestions = [];
    
    // Add the 3 required fixed questions (unprotected)
    requiredQuestionIds.forEach((reqId, index) => {
      const existingQ = validQuestions.find(q => q.id === reqId);
      if (existingQ) {
        // Update to ensure no protection
        finalQuestions.push({
          ...existingQ,
          isFixed: false,
          isLocked: false,
          order: index,
          questionNumber: null // Will be auto-generated
        });
        console.log(`✓ Kept question ${index + 1}: ${existingQ.text?.substring(0, 40)}`);
      } else {
        // Create missing question
        let newQuestion;
        if (reqId.includes('fixed_respondent_name')) {
          newQuestion = {
            id: reqId,
            type: 'text',
            text: 'What is your full name?',
            description: 'Please provide your complete name as it appears on official documents.',
            required: true,
            order: index,
            isFixed: false,
            isLocked: false,
            questionNumber: null,
            options: [],
            settings: {
              allowMultiple: false,
              allowOther: false,
              required: true
            },
            validation: {
              minLength: 2,
              maxLength: 100
            }
          };
        } else if (reqId.includes('fixed_respondent_gender')) {
          newQuestion = {
            id: reqId,
            type: 'multiple_choice',
            text: 'What is your gender?',
            description: 'Please select your gender identity.',
            required: true,
            order: index,
            isFixed: false,
            isLocked: false,
            questionNumber: null,
            options: [
              { id: 'fixed_gender_male', text: 'Male', value: 'male' },
              { id: 'fixed_gender_female', text: 'Female', value: 'female' }
            ],
            settings: {
              allowMultiple: false,
              allowOther: false,
              required: true
            }
          };
        } else if (reqId.includes('fixed_respondent_age')) {
          newQuestion = {
            id: reqId,
            type: 'numeric',
            text: 'Could you please tell me your age in complete years?',
            description: 'Please enter your age in years.',
            required: true,
            order: index,
            isFixed: false,
            isLocked: false,
            questionNumber: null,
            options: [],
            settings: {
              allowMultiple: false,
              allowOther: false,
              required: true
            },
            validation: {
              minValue: 13,
              maxValue: 120
            }
          };
        }
        
        if (newQuestion) {
          finalQuestions.push(newQuestion);
          console.log(`➕ Added missing question ${index + 1}: ${newQuestion.text?.substring(0, 40)}`);
        }
      }
    });
    
    // Update first section with cleaned questions
    firstSection.questions = finalQuestions;
    
    // Update the survey
    await Survey.findByIdAndUpdate(
      TARGET_SURVEY_ID,
      { 
        sections: updatedSections,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    console.log(`\n✅ Successfully fixed survey: ${survey.surveyName}`);
    console.log(`   Survey ID: ${TARGET_SURVEY_ID}`);
    console.log(`   First section now has ${finalQuestions.length} questions (all unprotected and editable)`);
    console.log(`   Questions:`);
    finalQuestions.forEach((q, idx) => {
      console.log(`     ${idx + 1}. ${q.text} (${q.type})`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating survey:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
fixFirstSectionQuestions();

