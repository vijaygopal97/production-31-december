const mongoose = require('mongoose');
require('dotenv').config();

// Import the Survey model
const Survey = require('../models/Survey');

const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';
const AGE_QUESTION_TEXT = 'Could you please tell me your age in complete years?';

async function updateAgeQuestionType() {
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
    
    let updated = false;
    let updatedSections = [...survey.sections];

    // Search through all sections
    for (let sectionIndex = 0; sectionIndex < updatedSections.length; sectionIndex++) {
      const section = updatedSections[sectionIndex];
      
      if (section.questions && Array.isArray(section.questions)) {
        // Search for the age question
        for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
          const question = section.questions[questionIndex];
          
          // Check if this is the age question by text or ID
          const isAgeQuestion = 
            question.text === AGE_QUESTION_TEXT ||
            question.id === 'fixed_respondent_age' ||
            question.id.includes('fixed_respondent_age') ||
            (question.isFixed && question.text && question.text.toLowerCase().includes('age'));
          
          if (isAgeQuestion && question.type === 'text') {
            console.log(`🔍 Found age question in section ${sectionIndex}, question ${questionIndex}`);
            console.log(`   Current type: ${question.type}`);
            console.log(`   Question text: ${question.text}`);
            
            // Update the question type to numeric
            updatedSections[sectionIndex].questions[questionIndex] = {
              ...question,
              type: 'numeric',
              validation: {
                ...(question.validation || {}),
                minValue: question.validation?.minValue || 13,
                maxValue: question.validation?.maxValue || 120
                // Remove pattern as it's not needed for numeric type
              }
            };
            
            // Remove pattern from validation if it exists
            if (updatedSections[sectionIndex].questions[questionIndex].validation.pattern) {
              delete updatedSections[sectionIndex].questions[questionIndex].validation.pattern;
            }
            
            updated = true;
            console.log(`✅ Updated question type to: numeric`);
          }
        }
      }
    }

    if (updated) {
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
    } else {
      console.log(`\n⚠️  Age question not found or already updated in survey: ${survey.surveyName}`);
    }

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
updateAgeQuestionType();

