require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { generateCSVForSurvey } = require('../utils/csvGeneratorHelper');

const SURVEY_ID = '68fd1915d41841da463f0d46';
const MONGODB_URI = process.env.MONGODB_URI;

async function exportAllTimeResponses() {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 600000,
      connectTimeoutMS: 30000
    });
    console.log('✅ Connected to MongoDB');
    
    console.log(`\n📄 Generating ALL TIME responses CSV for survey: ${SURVEY_ID}`);
    console.log('📊 Statuses: Pending_Approval, Approved, Rejected');
    console.log('📁 Output: /var/www/opine/backend/generated-csvs/68fd1915d41841da463f0d46/responses_codes.csv\n');
    
    // Use the same efficient method as csvGenerator.js
    await generateCSVForSurvey(SURVEY_ID, 'codes');
    
    console.log('\n✅ CSV generation completed!');
    console.log('📁 File location: /var/www/opine/backend/generated-csvs/68fd1915d41841da463f0d46/responses_codes.csv');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

exportAllTimeResponses();







