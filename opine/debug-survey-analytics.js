const mongoose = require('mongoose');
const Survey = require('./backend/models/Survey');
const SurveyResponse = require('./backend/models/SurveyResponse');

async function debugSurveyAnalytics() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine');
    console.log('Connected to MongoDB');

    // Find the West Bengal survey
    const survey = await Survey.findOne({ 
      surveyName: { $regex: 'West Bengal', $options: 'i' } 
    });
    
    if (!survey) {
      console.log('❌ West Bengal survey not found');
      return;
    }

    console.log('🔍 Found survey:', {
      id: survey._id,
      name: survey.surveyName,
      sampleSize: survey.sampleSize
    });

    // Get all responses for this survey
    const allResponses = await SurveyResponse.find({ survey: survey._id });
    console.log('📊 Total responses found:', allResponses.length);

    if (allResponses.length > 0) {
      console.log('📋 Response details:');
      allResponses.forEach((response, index) => {
        console.log(`  ${index + 1}. ID: ${response._id}, Status: ${response.status}, Created: ${response.createdAt}`);
      });

      // Group by status
      const statusCounts = {};
      allResponses.forEach(response => {
        statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
      });
      console.log('📈 Status breakdown:', statusCounts);

      // Calculate analytics
      const approvedCount = statusCounts['Approved'] || 0;
      const completionRate = survey.sampleSize > 0 ? Math.round((approvedCount / survey.sampleSize) * 100) : 0;
      
      console.log('🎯 Analytics:');
      console.log(`  - Approved Responses: ${approvedCount}`);
      console.log(`  - Sample Size: ${survey.sampleSize}`);
      console.log(`  - Completion Rate: ${completionRate}%`);
    } else {
      console.log('❌ No responses found for this survey');
    }

    // Check if there are any responses with different survey references
    const allSurveyResponses = await SurveyResponse.find({});
    console.log('🔍 Total survey responses in database:', allSurveyResponses.length);
    
    if (allSurveyResponses.length > 0) {
      console.log('📋 All survey responses:');
      allSurveyResponses.forEach((response, index) => {
        console.log(`  ${index + 1}. Survey: ${response.survey}, Status: ${response.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

debugSurveyAnalytics();

