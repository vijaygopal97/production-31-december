const mongoose = require('mongoose');
require('dotenv').config();

// Import the Survey model
const Survey = require('../models/Survey');

const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';

async function removeAllProtectionFromSurvey() {
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
    let updatedSections = JSON.parse(JSON.stringify(survey.sections)); // Deep clone

    // Search through all sections
    for (let sectionIndex = 0; sectionIndex < updatedSections.length; sectionIndex++) {
      const section = updatedSections[sectionIndex];
      
      if (section.questions && Array.isArray(section.questions)) {
        // Remove isFixed and isLocked from all questions
        for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
          const question = section.questions[questionIndex];
          
          if (question.isFixed || question.isLocked) {
            console.log(`🔍 Found fixed/locked question: ${question.text?.substring(0, 50) || 'Unknown'}`);
            
            // Remove isFixed and isLocked
            delete updatedSections[sectionIndex].questions[questionIndex].isFixed;
            delete updatedSections[sectionIndex].questions[questionIndex].isLocked;
            
            updated = true;
            console.log(`✅ Removed isFixed/isLocked from question ${questionIndex + 1}`);
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
      console.log(`   Removed isFixed/isLocked from all questions`);
    } else {
      console.log(`\n⚠️  No fixed/locked questions found in survey: ${survey.surveyName}`);
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
removeAllProtectionFromSurvey();

