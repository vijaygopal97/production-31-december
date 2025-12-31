const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const { generateCSVForSurvey } = require('../utils/csvGeneratorHelper');

// Directory to store generated CSV files
const CSV_STORAGE_DIR = path.join(__dirname, '../generated-csvs');

// Ensure storage directory exists
if (!fs.existsSync(CSV_STORAGE_DIR)) {
  fs.mkdirSync(CSV_STORAGE_DIR, { recursive: true });
}

/**
 * Generate CSV files for all surveys at 12:00 AM IST daily
 * Using Asia/Kolkata timezone, '0 0 * * *' runs at midnight IST
 */
const scheduleCSVGeneration = () => {
  console.log('📅 CSV Generation Scheduler initialized');
  console.log('⏰ Scheduled to run daily at 12:00 AM IST');
  
  // Run at 12:00 AM IST (midnight) using IST timezone
  cron.schedule('0 0 * * *', async () => {
    console.log('\n🔄 Starting scheduled CSV generation at', new Date().toISOString());
    console.log('📅 IST Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    await generateAllSurveyCSVs();
  }, {
    timezone: 'Asia/Kolkata' // IST timezone
  });
  
  // Also allow manual trigger for testing (uncomment to test immediately)
  // For testing: run once immediately
  // generateAllSurveyCSVs();
};

/**
 * Generate CSV files for all surveys
 */
const generateAllSurveyCSVs = async () => {
  try {
    console.log('📊 Fetching all surveys...');
    const surveys = await Survey.find({}).lean();
    
    if (surveys.length === 0) {
      console.log('⚠️  No surveys found');
      return;
    }
    
    console.log(`✅ Found ${surveys.length} surveys`);
    
    for (const survey of surveys) {
      try {
        console.log(`\n📝 Processing survey: ${survey.surveyName || survey.title || survey._id}`);
        
        // Generate both versions: codes and responses
        await generateCSVForSurvey(survey._id.toString(), 'codes');
        await generateCSVForSurvey(survey._id.toString(), 'responses');
        
        console.log(`✅ Completed CSV generation for survey: ${survey._id}`);
      } catch (error) {
        console.error(`❌ Error generating CSV for survey ${survey._id}:`, error.message);
        // Continue with next survey even if one fails
      }
    }
    
    console.log('\n✅ All CSV generation completed');
  } catch (error) {
    console.error('❌ Error in generateAllSurveyCSVs:', error);
  }
};

module.exports = {
  scheduleCSVGeneration,
  generateAllSurveyCSVs
};

