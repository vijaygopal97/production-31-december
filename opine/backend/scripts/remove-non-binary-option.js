const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Survey = require('../models/Survey');

const surveyId = '68fd1915d41841da463f0d46';

async function removeNonBinaryOption() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the survey
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      console.error(`❌ Survey with ID ${surveyId} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found survey: ${survey.surveyName}`);

    let updated = false;

    // Search through sections for the gender question
    if (survey.sections && Array.isArray(survey.sections)) {
      for (let sectionIndex = 0; sectionIndex < survey.sections.length; sectionIndex++) {
        const section = survey.sections[sectionIndex];
        if (section.questions && Array.isArray(section.questions)) {
          for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
            const question = section.questions[questionIndex];
            
            // Check if this is the gender question (fixed question or contains gender text)
            const isGenderQuestion = 
              question.id && question.id.includes('fixed_respondent_gender') ||
              question.text && question.text.toLowerCase().includes('gender') ||
              (question.isFixed && question.type === 'multiple_choice' && question.text && question.text.toLowerCase().includes('gender'));

            if (isGenderQuestion && question.options && Array.isArray(question.options)) {
              console.log(`\n🔍 Found gender question in section ${sectionIndex + 1}:`);
              console.log(`   Question ID: ${question.id}`);
              console.log(`   Question Text: ${question.text}`);
              console.log(`   Current options: ${question.options.length}`);
              
              // Find and remove Non-Binary option
              const initialOptionsCount = question.options.length;
              question.options = question.options.filter(option => {
                const isNonBinary = 
                  option.text && (option.text.toLowerCase() === 'non-binary' || option.text.toLowerCase() === 'non binary') ||
                  option.value && (option.value.toLowerCase() === 'non_binary' || option.value.toLowerCase() === 'non-binary') ||
                  option.id && option.id.includes('non_binary');
                
                if (isNonBinary) {
                  console.log(`   ❌ Removing option: ${option.text || option.value}`);
                  return false;
                }
                return true;
              });

              if (question.options.length < initialOptionsCount) {
                updated = true;
                console.log(`   ✅ Removed Non-Binary option. Remaining options: ${question.options.length}`);
                console.log(`   Remaining options: ${question.options.map(opt => opt.text || opt.value).join(', ')}`);
              } else {
                console.log(`   ℹ️  No Non-Binary option found in this question`);
              }
            }
          }
        }
      }
    }

    // Also check direct questions array if it exists
    if (survey.questions && Array.isArray(survey.questions)) {
      for (let questionIndex = 0; questionIndex < survey.questions.length; questionIndex++) {
        const question = survey.questions[questionIndex];
        
        const isGenderQuestion = 
          question.id && question.id.includes('fixed_respondent_gender') ||
          question.text && question.text.toLowerCase().includes('gender') ||
          (question.isFixed && question.type === 'multiple_choice' && question.text && question.text.toLowerCase().includes('gender'));

        if (isGenderQuestion && question.options && Array.isArray(question.options)) {
          console.log(`\n🔍 Found gender question in direct questions array:`);
          console.log(`   Question ID: ${question.id}`);
          console.log(`   Question Text: ${question.text}`);
          
          const initialOptionsCount = question.options.length;
          question.options = question.options.filter(option => {
            const isNonBinary = 
              option.text && (option.text.toLowerCase() === 'non-binary' || option.text.toLowerCase() === 'non binary') ||
              option.value && (option.value.toLowerCase() === 'non_binary' || option.value.toLowerCase() === 'non-binary') ||
              option.id && option.id.includes('non_binary');
            
            if (isNonBinary) {
              console.log(`   ❌ Removing option: ${option.text || option.value}`);
              return false;
            }
            return true;
          });

          if (question.options.length < initialOptionsCount) {
            updated = true;
            console.log(`   ✅ Removed Non-Binary option. Remaining options: ${question.options.length}`);
          }
        }
      }
    }

    if (updated) {
      // Save the updated survey
      survey.updatedAt = new Date();
      await survey.save();
      console.log('\n✅ Survey updated successfully!');
    } else {
      console.log('\nℹ️  No changes made. Non-Binary option may not exist or was already removed.');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
removeNonBinaryOption();

