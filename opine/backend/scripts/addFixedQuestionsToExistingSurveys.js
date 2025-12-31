const mongoose = require('mongoose');
require('dotenv').config();

// Import the Survey model
const Survey = require('../models/Survey');

// Fixed questions that need to be added to existing surveys
const FIXED_QUESTIONS = [
  {
    id: 'fixed_respondent_name',
    type: 'text',
    text: 'What is your full name?',
    description: 'Please provide your complete name as it appears on official documents.',
    required: true,
    order: 0,
    isFixed: true,
    isLocked: true,
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
    isFixed: true,
    isLocked: true,
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
      },
      { 
        id: 'fixed_gender_non_binary', 
        text: 'Non-Binary', 
        value: 'non_binary' 
      }
    ],
    settings: {
      allowMultiple: false, // Single selection only
      allowOther: false,
      required: true
    }
  },
  {
    id: 'fixed_respondent_age',
    type: 'text',
    text: 'What is your age?',
    description: 'Please enter your age in years.',
    required: true,
    order: 2,
    isFixed: true,
    isLocked: true,
    options: [],
    settings: {
      allowMultiple: false,
      allowOther: false,
      required: true
    },
    validation: {
      minValue: 13,
      maxValue: 120,
      pattern: '^[0-9]+$'
    }
  }
];

async function addFixedQuestionsToExistingSurveys() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all surveys
    const surveys = await Survey.find({});
    console.log(`📊 Found ${surveys.length} surveys to update`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const survey of surveys) {
      try {
        let needsUpdate = false;
        let updatedSections = [...survey.sections];

        // Check if survey has sections
        if (!updatedSections || updatedSections.length === 0) {
          // Create a new section with fixed questions
          updatedSections = [{
            id: 'section_1',
            title: 'Respondent Information',
            questions: [...FIXED_QUESTIONS]
          }];
          needsUpdate = true;
        } else {
          // Check if fixed questions already exist in the first section
          const firstSection = updatedSections[0];
          if (!firstSection) {
            updatedSections[0] = {
              id: 'section_1',
              title: 'Respondent Information',
              questions: [...FIXED_QUESTIONS]
            };
            needsUpdate = true;
          } else {
            // Check if fixed questions already exist
            const existingFixedQuestionIds = firstSection.questions
              .filter(q => q.isFixed)
              .map(q => q.id.replace(/^.*_fixed_/, 'fixed_')); // Remove survey-specific prefix

            // Add missing fixed questions
            const missingFixedQuestions = FIXED_QUESTIONS.filter(
              fixedQ => !existingFixedQuestionIds.includes(fixedQ.id)
            );

            if (missingFixedQuestions.length > 0) {
              // Insert fixed questions at the beginning of the first section
              updatedSections[0] = {
                ...firstSection,
                questions: [...missingFixedQuestions, ...firstSection.questions]
              };
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          // Update the survey
          await Survey.findByIdAndUpdate(
            survey._id,
            { 
              sections: updatedSections,
              updatedAt: new Date()
            },
            { new: true }
          );
          
          console.log(`✅ Updated survey: ${survey.surveyName} (ID: ${survey._id})`);
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped survey: ${survey.surveyName} (already has fixed questions)`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`❌ Error updating survey ${survey.surveyName}:`, error.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} surveys`);
    console.log(`⏭️  Skipped: ${skippedCount} surveys`);
    console.log(`📊 Total processed: ${surveys.length} surveys`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  addFixedQuestionsToExistingSurveys()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addFixedQuestionsToExistingSurveys };













