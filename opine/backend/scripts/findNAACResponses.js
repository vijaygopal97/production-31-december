#!/usr/bin/env node

/**
 * Script to find SurveyResponse objects with "N/A" AC
 * This will help identify which responses are causing the N/A issue
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

async function findNAACResponses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB');

    const surveyId = '68fd1915d41841da463f0d46';
    
    console.log(`\n🔍 Searching for responses with "N/A" AC in survey: ${surveyId}\n`);

    // Find responses where selectedAC is "N/A" or contains "N/A"
    const responsesWithNA = await SurveyResponse.find({
      survey: surveyId,
      $or: [
        { selectedAC: 'N/A' },
        { selectedAC: { $regex: /^N\/A$/i } },
        { 'selectedPollingStation.acName': 'N/A' },
        { 'selectedPollingStation.acName': { $regex: /^N\/A$/i } }
      ]
    })
    .select('_id selectedAC selectedPollingStation status createdAt interviewer responses')
    .populate('interviewer', 'firstName lastName memberId')
    .lean()
    .limit(20); // Limit to first 20 for initial investigation

    console.log(`\n📊 Found ${responsesWithNA.length} responses with "N/A" in selectedAC or selectedPollingStation.acName\n`);

    if (responsesWithNA.length > 0) {
      console.log('='.repeat(80));
      console.log('RESPONSES WITH "N/A" AC:');
      console.log('='.repeat(80));
      
      responsesWithNA.forEach((response, index) => {
        console.log(`\n--- Response ${index + 1} ---`);
        console.log(`Response ID: ${response._id}`);
        console.log(`Status: ${response.status}`);
        console.log(`Created At: ${response.createdAt}`);
        console.log(`Interviewer: ${response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName} (${response.interviewer.memberId})` : 'N/A'}`);
        console.log(`Selected AC: ${JSON.stringify(response.selectedAC)}`);
        console.log(`Selected Polling Station AC: ${JSON.stringify(response.selectedPollingStation?.acName)}`);
        console.log(`Selected Polling Station: ${JSON.stringify(response.selectedPollingStation?.stationName)}`);
        
        // Check responses array for AC-related questions
        if (response.responses && Array.isArray(response.responses)) {
          const acRelatedResponses = response.responses.filter(r => {
            const questionText = (r.questionText || '').toLowerCase();
            const questionId = (r.questionId || '').toLowerCase();
            return questionText.includes('assembly') || 
                   questionText.includes('constituency') || 
                   questionText.includes('ac') ||
                   questionId.includes('ac') ||
                   questionId === 'ac-selection';
          });
          
          if (acRelatedResponses.length > 0) {
            console.log(`\nAC-related responses in responses array:`);
            acRelatedResponses.forEach((r, idx) => {
              console.log(`  ${idx + 1}. Question: ${r.questionText || r.questionId}`);
              console.log(`     Response: ${JSON.stringify(r.response)}`);
            });
          } else {
            console.log(`\nNo AC-related questions found in responses array`);
            console.log(`Total responses in array: ${response.responses.length}`);
            if (response.responses.length > 0) {
              console.log(`First 3 responses:`);
              response.responses.slice(0, 3).forEach((r, idx) => {
                console.log(`  ${idx + 1}. ${r.questionText || r.questionId}: ${JSON.stringify(r.response)}`);
              });
            }
          }
        } else {
          console.log(`\nNo responses array found`);
        }
        
        console.log(`\nFull Response Object (JSON):`);
        console.log(JSON.stringify(response, null, 2));
        console.log('\n' + '-'.repeat(80));
      });
    } else {
      console.log('✅ No responses found with "N/A" in selectedAC or selectedPollingStation.acName');
      console.log('\n🔍 Checking for responses with null/empty AC...\n');
      
      // Check for responses with null or empty AC
      const responsesWithNullAC = await SurveyResponse.find({
        survey: surveyId,
        $or: [
          { selectedAC: null },
          { selectedAC: '' },
          { selectedAC: { $exists: false } },
          { 'selectedPollingStation.acName': null },
          { 'selectedPollingStation.acName': '' }
        ]
      })
      .select('_id selectedAC selectedPollingStation status createdAt interviewer')
      .populate('interviewer', 'firstName lastName memberId')
      .lean()
      .limit(10);
      
      console.log(`Found ${responsesWithNullAC.length} responses with null/empty AC`);
      if (responsesWithNullAC.length > 0) {
        console.log('\nSample responses with null/empty AC:');
        responsesWithNullAC.slice(0, 5).forEach((r, idx) => {
          console.log(`  ${idx + 1}. ID: ${r._id}, Status: ${r.status}, SelectedAC: ${r.selectedAC}, PS AC: ${r.selectedPollingStation?.acName}`);
        });
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findNAACResponses();

