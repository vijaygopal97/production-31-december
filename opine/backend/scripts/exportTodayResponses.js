/**
 * Export today's SurveyResponses from Production
 * This script is run on the production server
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const exportTodayResponses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Get current date - use last 24 hours to be safe (covers timezone issues)
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Fetch all responses from last 24 hours
    // Convert survey ID to ObjectId to ensure proper matching
    const surveyObjectId = mongoose.Types.ObjectId.isValid(SURVEY_ID) 
      ? new mongoose.Types.ObjectId(SURVEY_ID) 
      : SURVEY_ID;
    
    const responses = await SurveyResponse.find({
      survey: surveyObjectId,
      createdAt: { $gte: last24Hours }
    }).lean();
    
    // Write to file to avoid stdout buffer issues with large JSON
    const fs = require('fs');
    const outputFile = '/tmp/prod_responses_' + Date.now() + '.json';
    fs.writeFileSync(outputFile, JSON.stringify(responses));
    console.log(outputFile); // Output file path to stdout
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

exportTodayResponses();

