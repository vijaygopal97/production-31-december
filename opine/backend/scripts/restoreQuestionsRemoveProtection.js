const mongoose = require('mongoose');
require('dotenv').config();

// Import the Survey model
const Survey = require('../models/Survey');

const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';

// Fixed questions that should exist (but without protection)
const FIXED_QUESTIONS = [
  {
    id: 'fixed_respondent_name',
    type: 'text',
    text: 'What is your full name?',
    description: 'Please provide your complete name as it appears on official documents.',
    required: true,
    order: 0,
    isFixed: false, // NOT protected
    isLocked: false, // NOT protected
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
  },
  {
    id: 'fixed_respondent_gender',
    type: 'multiple_choice',
    text: 'What is your gender?',
    description: 'Please select your gender identity.',
    required: true,
    order: 1,
    isFixed: false, // NOT protected
    isLocked: false, // NOT protected
    options: [
      { 
        id: 'fixed_gender_male', 
        text: 'Male', 
        value: 'male' 
      },
      { 
        id: 'fixed_gender_female', 
        text: 'Female', 
        value: 'female' 
      }
    ],
    settings: {
      allowMultiple: false,
      allowOther: false,
      required: true
    }
  },
  {
    id: 'fixed_respondent_age',
    type: 'numeric',
    text: 'Could you please tell me your age in complete years?',
    description: 'Please enter your age in years.',
    required: true,
    order: 2,
    isFixed: false, // NOT protected
    isLocked: false, // NOT protected
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
  }
];

async function restoreQuestionsRemoveProtection() {
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
      updatedSections = [{
        id: 'section_1',
        title: 'Respondent Information',
        questions: []
      }];
    }
    
    const firstSection = updatedSections[0];
    if (!firstSection.questions) {
      firstSection.questions = [];
    }
    
    // Get existing question IDs in first section
    const existingQuestionIds = firstSection.questions.map(q => {
      // Check both the question ID and if it matches fixed question IDs (with or without survey prefix)
      const baseId = q.id?.replace(/^.*_fixed_/, 'fixed_') || q.id;
      return baseId;
    });
    
    console.log('📝 Existing question IDs:', existingQuestionIds);
    
    // Add missing fixed questions (without protection)
    const questionsToAdd = [];
    FIXED_QUESTIONS.forEach(fixedQ => {
      const baseId = fixedQ.id.replace(/^.*_fixed_/, 'fixed_');
      if (!existingQuestionIds.includes(baseId)) {
        // Create question with survey-specific ID
        const questionId = `${TARGET_SURVEY_ID}_${fixedQ.id}`;
        questionsToAdd.push({
          ...fixedQ,
          id: questionId,
          questionNumber: null // Will be auto-generated
        });
        console.log(`➕ Will add question: ${fixedQ.text?.substring(0, 40)}`);
      } else {
        console.log(`✓ Question already exists: ${fixedQ.text?.substring(0, 40)}`);
      }
    });
    
    // Add missing questions at the beginning
    if (questionsToAdd.length > 0) {
      firstSection.questions = [...questionsToAdd, ...firstSection.questions];
      console.log(`✅ Added ${questionsToAdd.length} missing questions`);
    }
    
    // Remove protection from ALL questions in first section
    let protectionRemoved = false;
    firstSection.questions.forEach((question, index) => {
      if (question.isFixed || question.isLocked) {
        question.isFixed = false;
        question.isLocked = false;
        protectionRemoved = true;
        console.log(`🔓 Removed protection from question ${index + 1}: ${question.text?.substring(0, 40)}`);
      }
    });
    
    if (!protectionRemoved && questionsToAdd.length === 0) {
      console.log('ℹ️  No changes needed - questions already exist and are unprotected');
    }
    
    // Update the survey
    await Survey.findByIdAndUpdate(
      TARGET_SURVEY_ID,
      { 
        sections: updatedSections,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    console.log(`\n✅ Successfully updated survey: ${survey.surveyName}`);
    console.log(`   Survey ID: ${TARGET_SURVEY_ID}`);
    console.log(`   First section now has ${firstSection.questions.length} questions (all unprotected)`);

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
restoreQuestionsRemoveProtection();

