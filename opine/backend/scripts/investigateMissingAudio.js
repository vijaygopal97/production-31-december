/**
 * Investigation Script: Missing Audio Recording
 * Survey ID: 69426dc6ebf9ca4304a7024e
 * 
 * This script investigates why audio recording is missing for this CAPI survey
 * NO CODE CHANGES - RESEARCH ONLY
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');

const SURVEY_ID = '69426dc6ebf9ca4304a7024e';

async function investigateMissingAudio() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Try to find as response ID first (more likely)
    console.log(`\n🔍 Checking if ${SURVEY_ID} is a Response ID...`);
    let responseById = await SurveyResponse.findById(SURVEY_ID)
      .populate('interviewer', 'firstName lastName email memberId')
      .lean();
    
    let survey = null;
    let responses = [];
    
    if (responseById) {
      console.log(`✅ Found as Response ID!`);
      responses = [responseById];
      // Get survey from response
      survey = await Survey.findById(responseById.survey);
      if (survey) {
        console.log(`✅ Found Survey from Response: ${survey.title || survey.surveyTitle || 'N/A'}`);
      }
    } else {
      // Try to find as survey ID
      console.log(`⚠️  Not found as Response ID, checking if it's a Survey ID...`);
      survey = await Survey.findById(SURVEY_ID);
      
      if (survey) {
        console.log(`✅ Found as Survey ID: ${survey.title || survey.surveyTitle || 'N/A'}`);
        console.log(`   Mode: ${survey.mode || 'N/A'}`);
        console.log(`   Status: ${survey.status || 'N/A'}`);

        // Find all responses for this survey
        console.log(`\n🔍 Finding all responses for this survey...`);
        responses = await SurveyResponse.find({ survey: SURVEY_ID })
          .populate('interviewer', 'firstName lastName email memberId')
          .sort({ createdAt: -1 })
          .lean();
      } else {
        throw new Error(`Survey or Response with ID ${SURVEY_ID} not found`);
      }
    }

    console.log(`✅ Found ${responses.length} responses`);

    // Analyze each response
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RESPONSE ANALYSIS');
    console.log(`${'='.repeat(80)}`);

    responses.forEach((response, index) => {
      console.log(`\n--- Response ${index + 1}/${responses.length} ---`);
      console.log(`Response ID: ${response._id}`);
      console.log(`Session ID: ${response.sessionId}`);
      console.log(`Status: ${response.status}`);
      console.log(`Interview Mode: ${response.interviewMode}`);
      console.log(`Interviewer: ${response.interviewer?.firstName || 'N/A'} ${response.interviewer?.lastName || 'N/A'} (${response.interviewer?.memberId || 'N/A'})`);
      console.log(`Start Time: ${response.startTime}`);
      console.log(`End Time: ${response.endTime}`);
      console.log(`Total Time Spent: ${response.totalTimeSpent}s`);
      
      // Check audio recording
      console.log(`\n🎤 AUDIO RECORDING STATUS:`);
      if (response.audioRecording) {
        console.log(`   ✅ Audio Recording Object Exists`);
        console.log(`   Audio URL: ${response.audioRecording.audioUrl || 'N/A'}`);
        console.log(`   Signed URL: ${response.audioRecording.signedUrl ? 'Yes' : 'No'}`);
        console.log(`   Has Audio: ${response.audioRecording.hasAudio || false}`);
        console.log(`   Recording Duration: ${response.audioRecording.recordingDuration || 'N/A'}s`);
        console.log(`   File Size: ${response.audioRecording.fileSize || 'N/A'} bytes`);
        console.log(`   Format: ${response.audioRecording.format || 'N/A'}`);
        console.log(`   Uploaded At: ${response.audioRecording.uploadedAt || 'N/A'}`);
        
        if (!response.audioRecording.audioUrl && !response.audioRecording.hasAudio) {
          console.log(`   ⚠️  WARNING: Audio recording object exists but no audio URL!`);
        }
      } else {
        console.log(`   ❌ NO Audio Recording Object`);
      }

      // Check metadata
      if (response.metadata) {
        console.log(`\n📋 METADATA:`);
        console.log(`   GPS Location: ${response.metadata.gpsLocation ? 'Yes' : 'No'}`);
        console.log(`   Device Info: ${response.metadata.deviceInfo || 'N/A'}`);
        console.log(`   Browser Info: ${response.metadata.browserInfo || 'N/A'}`);
        if (response.metadata.audioRecording) {
          console.log(`   Metadata Audio Recording: ${JSON.stringify(response.metadata.audioRecording, null, 2)}`);
        }
      }

      // Check if it's CAPI mode
      if (response.interviewMode === 'capi') {
        console.log(`\n🔍 CAPI MODE ANALYSIS:`);
        console.log(`   Expected: Audio recording should be present`);
        if (!response.audioRecording || !response.audioRecording.audioUrl) {
          console.log(`   ⚠️  ISSUE: CAPI interview without audio recording!`);
          console.log(`   Possible causes:`);
          console.log(`   1. Audio recording failed to start`);
          console.log(`   2. Audio recording failed to upload`);
          console.log(`   3. Audio permission was denied but interview continued`);
          console.log(`   4. Browser/device doesn't support audio recording`);
          console.log(`   5. Network issue during upload`);
        }
      }

      // Check responses count
      console.log(`\n📝 RESPONSES:`);
      console.log(`   Total Questions Answered: ${response.responses?.length || 0}`);
      if (response.responses && response.responses.length > 0) {
        const firstFew = response.responses.slice(0, 3);
        firstFew.forEach((r, i) => {
          console.log(`   Q${i+1}: ${r.questionText?.substring(0, 50) || 'N/A'}...`);
        });
      }
    });

    // Find responses WITHOUT audio
    console.log(`\n${'='.repeat(80)}`);
    console.log('🚨 RESPONSES WITHOUT AUDIO RECORDING');
    console.log(`${'='.repeat(80)}`);

    const responsesWithoutAudio = responses.filter(r => 
      r.interviewMode === 'capi' && 
      (!r.audioRecording || !r.audioRecording.audioUrl || !r.audioRecording.hasAudio)
    );

    console.log(`\nFound ${responsesWithoutAudio.length} CAPI responses without audio:`);
    
    responsesWithoutAudio.forEach((response, index) => {
      console.log(`\n${index + 1}. Response ID: ${response._id}`);
      console.log(`   Session ID: ${response.sessionId}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Interviewer: ${response.interviewer?.firstName || 'N/A'} ${response.interviewer?.lastName || 'N/A'}`);
      console.log(`   Created: ${response.createdAt}`);
      console.log(`   Start Time: ${response.startTime}`);
      console.log(`   End Time: ${response.endTime}`);
      console.log(`   Duration: ${response.totalTimeSpent}s`);
      
      if (response.audioRecording) {
        console.log(`   Audio Recording Object: EXISTS but empty`);
        console.log(`   Audio URL: ${response.audioRecording.audioUrl || 'MISSING'}`);
        console.log(`   Has Audio: ${response.audioRecording.hasAudio || false}`);
      } else {
        console.log(`   Audio Recording Object: MISSING`);
      }
    });

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Responses: ${responses.length}`);
    console.log(`CAPI Responses: ${responses.filter(r => r.interviewMode === 'capi').length}`);
    console.log(`CAPI Responses WITH Audio: ${responses.filter(r => r.interviewMode === 'capi' && r.audioRecording && r.audioRecording.audioUrl).length}`);
    console.log(`CAPI Responses WITHOUT Audio: ${responsesWithoutAudio.length}`);
    console.log(`CATI Responses: ${responses.filter(r => r.interviewMode === 'cati').length}`);
    console.log(`Other Mode Responses: ${responses.filter(r => r.interviewMode !== 'capi' && r.interviewMode !== 'cati').length}`);

    console.log(`\n✅ Investigation completed!`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  investigateMissingAudio()
    .then(() => {
      console.log('\n🎉 Investigation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = investigateMissingAudio;

