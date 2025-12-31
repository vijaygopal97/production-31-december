const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Register models
require('../models/User');
require('../models/Survey');
require('../models/SurveyResponse');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine').then(async () => {
  const SurveyResponse = require('../models/SurveyResponse');
  const Survey = require('../models/Survey');
  
  const surveyId = '68fd1915d41841da463f0d46';
  const survey = await Survey.findById(surveyId);
  
  console.log('=== Testing Calls Connected Logic ===\n');
  
  // Get all CATI responses with interviewers
  const responses = await SurveyResponse.find({
    survey: survey._id,
    interviewMode: 'cati',
    interviewer: { $exists: true, $ne: null }
  }).populate('interviewer', 'firstName lastName').lean();
  
  console.log(`Total CATI responses with interviewers: ${responses.length}\n`);
  
  // Group by interviewer and count
  const interviewerMap = new Map();
  
  responses.forEach(response => {
    if (!response.interviewer || !response.interviewer._id) return;
    
    const interviewerId = response.interviewer._id.toString();
    const interviewerName = `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim();
    
    if (!interviewerMap.has(interviewerId)) {
      interviewerMap.set(interviewerId, {
        interviewerId,
        interviewerName,
        numberOfDials: 0,
        callsConnected: 0,
        sampleStatuses: []
      });
    }
    
    const stat = interviewerMap.get(interviewerId);
    stat.numberOfDials += 1;
    
    // Check knownCallStatus - SIMPLE CHECK
    const knownCallStatus = response.knownCallStatus;
    if (knownCallStatus) {
      const normalized = String(knownCallStatus).toLowerCase().trim();
      const isConnected = normalized === 'call_connected' || normalized === 'success';
      
      if (isConnected) {
        stat.callsConnected += 1;
      }
      
      // Store sample for debugging
      if (stat.sampleStatuses.length < 5) {
        stat.sampleStatuses.push({
          raw: knownCallStatus,
          normalized: normalized,
          isConnected: isConnected
        });
      }
    }
  });
  
  console.log('Interviewer Stats:');
  console.log('==================\n');
  
  Array.from(interviewerMap.values()).slice(0, 10).forEach(stat => {
    console.log(`${stat.interviewerName} (${stat.interviewerId}):`);
    console.log(`  Number of Dials: ${stat.numberOfDials}`);
    console.log(`  Calls Connected: ${stat.callsConnected}`);
    if (stat.sampleStatuses.length > 0) {
      console.log(`  Sample Statuses:`, stat.sampleStatuses.map(s => `${s.raw} (${s.normalized}) -> ${s.isConnected}`).join(', '));
    }
    console.log('');
  });
  
  const totalDials = Array.from(interviewerMap.values()).reduce((sum, s) => sum + s.numberOfDials, 0);
  const totalConnected = Array.from(interviewerMap.values()).reduce((sum, s) => sum + s.callsConnected, 0);
  
  console.log(`\n=== Summary ===`);
  console.log(`Total Interviewers: ${interviewerMap.size}`);
  console.log(`Total Dials: ${totalDials}`);
  console.log(`Total Calls Connected: ${totalConnected}`);
  
  // Also check raw database counts
  const dbConnectedCount = await SurveyResponse.countDocuments({
    survey: survey._id,
    interviewMode: 'cati',
    knownCallStatus: { $in: ['call_connected', 'success'] }
  });
  
  console.log(`\nDatabase count (knownCallStatus IN ['call_connected', 'success']): ${dbConnectedCount}`);
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});


