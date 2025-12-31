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
  if (!survey) {
    console.log('Survey not found');
    process.exit(1);
  }
  
  // Get recent CATI responses with interviewers
  const responses = await SurveyResponse.find({
    survey: survey._id,
    interviewMode: 'cati',
    interviewer: { $exists: true, $ne: null }
  }).populate('interviewer', 'firstName lastName').sort({ createdAt: -1 }).limit(30).lean();
  
  console.log(`Found ${responses.length} CATI responses with interviewers\n`);
  
  let callConnectedCount = 0;
  let totalDials = 0;
  
  responses.forEach((r, idx) => {
    totalDials++;
    const interviewerName = r.interviewer ? `${r.interviewer.firstName || ''} ${r.interviewer.lastName || ''}`.trim() : 'Unknown';
    
    // Get call status using same logic as backend
    let callStatus = null;
    if (r.knownCallStatus) {
      callStatus = r.knownCallStatus;
    } else if (r.metadata && r.metadata.callStatus) {
      callStatus = r.metadata.callStatus;
    } else if (r.responses && Array.isArray(r.responses)) {
      const callStatusResp = r.responses.find(resp => 
        resp.questionId === 'call-status' || resp.questionId === 'call_status'
      );
      if (callStatusResp && callStatusResp.response) {
        callStatus = callStatusResp.response;
      }
    }
    
    const normalizedCallStatus = callStatus ? callStatus.toLowerCase().trim() : 'unknown';
    const isCallConnected = normalizedCallStatus === 'call_connected' || normalizedCallStatus === 'success';
    
    if (isCallConnected) {
      callConnectedCount++;
    }
    
    if (idx < 10) {
      console.log(`Response ${idx + 1}:`);
      console.log(`  Interviewer: ${interviewerName}`);
      console.log(`  knownCallStatus: ${r.knownCallStatus || 'null'}`);
      console.log(`  metadata.callStatus: ${r.metadata?.callStatus || 'null'}`);
      if (r.responses && Array.isArray(r.responses)) {
        const callStatusResp = r.responses.find(resp => 
          resp.questionId === 'call-status' || resp.questionId === 'call_status'
        );
        console.log(`  responses[call-status]: ${callStatusResp?.response || 'null'}`);
      }
      console.log(`  Normalized: ${normalizedCallStatus}`);
      console.log(`  Is Connected: ${isCallConnected}`);
      console.log('');
    }
  });
  
  console.log(`\nSummary:`);
  console.log(`  Total Dials: ${totalDials}`);
  console.log(`  Calls Connected: ${callConnectedCount}`);
  console.log(`  Percentage: ${((callConnectedCount / totalDials) * 100).toFixed(2)}%`);
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});


