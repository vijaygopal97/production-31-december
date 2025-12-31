#!/usr/bin/env node

/**
 * Script to find SurveyResponse objects where AC extraction would fail
 * This simulates the extraction logic to find which responses would result in "N/A"
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');
const { getGroupsForAC } = require('../utils/pollingStationHelper');

// Helper functions from the controller
const getMainTextValue = (text) => {
  if (!text) return '';
  if (typeof text !== 'string') {
    text = String(text);
  }
  const openBraceIndex = text.indexOf('{');
  if (openBraceIndex === -1) {
    return text.trim();
  }
  return text.substring(0, openBraceIndex).trim();
};

const isValidACName = (value, state) => {
  if (!value || typeof value !== 'string') return false;
  const cleaned = getMainTextValue(value).trim();
  if (!cleaned || cleaned === 'N/A' || cleaned === '') return false;
  
  const lower = cleaned.toLowerCase();
  const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
  if (invalidValues.includes(lower)) return false;
  if (lower.startsWith('yes') || lower.startsWith('no')) return false;
  if (lower.match(/^yes[_\s]/i) || lower.match(/^no[_\s]/i)) return false;
  
  if (cleaned.length <= 2) return false;
  
  const acData = getGroupsForAC(state, cleaned);
  if (acData && acData.ac_name) {
    return true;
  }
  
  const hasCapitalLetters = /[A-Z]/.test(cleaned);
  const hasMultipleWords = cleaned.split(/\s+/).length > 1;
  const looksLikeName = hasCapitalLetters || hasMultipleWords;
  
  return looksLikeName;
};

const extractACFromResponse = (response, state) => {
  // Priority 1: Check selectedAC field
  if (response.selectedAC && isValidACName(response.selectedAC, state)) {
    return getMainTextValue(response.selectedAC).trim();
  }
  
  // Priority 2: Check selectedPollingStation.acName
  if (response.selectedPollingStation?.acName && isValidACName(response.selectedPollingStation.acName, state)) {
    return getMainTextValue(response.selectedPollingStation.acName).trim();
  }
  
  // Priority 3: Check responses array for questionId === 'ac-selection'
  if (response.responses && Array.isArray(response.responses)) {
    const acSelectionResponse = response.responses.find(r => 
      r.questionId === 'ac-selection' && r.response
    );
    if (acSelectionResponse && isValidACName(acSelectionResponse.response, state)) {
      return getMainTextValue(acSelectionResponse.response).trim();
    }
    
    // Priority 4: Check for questionType that indicates AC selection
    const acTypeResponse = response.responses.find(r => 
      (r.questionType === 'ac_selection' || 
       r.questionType === 'assembly_constituency' ||
       r.questionType === 'ac') && 
      r.response
    );
    if (acTypeResponse && isValidACName(acTypeResponse.response, state)) {
      return getMainTextValue(acTypeResponse.response).trim();
    }
    
    // Priority 5: Search by question text containing "assembly" or "constituency"
    const acTextResponses = response.responses.filter(r => {
      if (!r.questionText || !r.response) return false;
      const questionText = (r.questionText || '').toLowerCase();
      const hasAssembly = questionText.includes('assembly');
      const hasConstituency = questionText.includes('constituency');
      const isConsentQuestion = questionText.includes('consent') || 
                                questionText.includes('agree') ||
                                questionText.includes('participate') ||
                                questionText.includes('willing');
      
      return (hasAssembly || hasConstituency) && !isConsentQuestion;
    });
    
    for (const acResponse of acTextResponses) {
      if (isValidACName(acResponse.response, state)) {
        return getMainTextValue(acResponse.response).trim();
      }
    }
  }
  
  return null;
};

async function findResponsesWithNullExtractedAC() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB');

    const surveyId = '68fd1915d41841da463f0d46';
    
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      console.error('Survey not found');
      process.exit(1);
    }
    
    const state = survey.acAssignmentState || 'West Bengal';
    
    console.log(`\n🔍 Searching for responses where AC extraction fails in survey: ${surveyId}`);
    console.log(`State: ${state}\n`);

    // Get a sample of responses to test extraction
    const sampleSize = 1000;
    const responses = await SurveyResponse.find({
      survey: surveyId
    })
    .select('_id selectedAC selectedPollingStation status createdAt interviewer responses')
    .lean()
    .limit(sampleSize);
    
    // Manually populate interviewer if needed (skip for now to avoid model issues)

    console.log(`Testing AC extraction on ${responses.length} responses...\n`);

    const responsesWithNullAC = [];
    
    for (const response of responses) {
      const extractedAC = extractACFromResponse(response, state);
      if (!extractedAC || extractedAC === 'N/A' || extractedAC.trim() === '') {
        responsesWithNullAC.push({
          response,
          extractedAC
        });
      }
    }

    console.log(`\n📊 Found ${responsesWithNullAC.length} responses where AC extraction returns null/empty\n`);

    if (responsesWithNullAC.length > 0) {
      console.log('='.repeat(80));
      console.log('RESPONSES WITH NULL/EMPTY EXTRACTED AC:');
      console.log('='.repeat(80));
      
      // Show first 10 problematic responses
      responsesWithNullAC.slice(0, 10).forEach((item, index) => {
        const response = item.response;
        console.log(`\n--- Response ${index + 1} ---`);
        console.log(`Response ID: ${response._id}`);
        console.log(`Status: ${response.status}`);
        console.log(`Created At: ${response.createdAt}`);
        console.log(`Interviewer ID: ${response.interviewer || 'N/A'}`);
        console.log(`Selected AC: ${JSON.stringify(response.selectedAC)}`);
        console.log(`Selected Polling Station: ${JSON.stringify({
          stationName: response.selectedPollingStation?.stationName,
          acName: response.selectedPollingStation?.acName,
          pcName: response.selectedPollingStation?.pcName
        })}`);
        console.log(`Extracted AC: ${item.extractedAC || 'null'}`);
        
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
            console.log(`\nAC-related responses found (but extraction failed):`);
            acRelatedResponses.forEach((r, idx) => {
              console.log(`  ${idx + 1}. Question: ${r.questionText || r.questionId}`);
              console.log(`     Response: ${JSON.stringify(r.response)}`);
              console.log(`     Is Valid AC Name: ${isValidACName(r.response, state)}`);
            });
          } else {
            console.log(`\nNo AC-related questions found in responses array`);
          }
        }
        
        console.log(`\nFull Response Object (JSON):`);
        console.log(JSON.stringify(response, null, 2));
        console.log('\n' + '-'.repeat(80));
      });
      
      console.log(`\n\nTotal responses with null AC: ${responsesWithNullAC.length} out of ${responses.length} tested`);
      console.log(`Percentage: ${((responsesWithNullAC.length / responses.length) * 100).toFixed(2)}%`);
    } else {
      console.log('✅ All tested responses have valid extracted AC');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findResponsesWithNullExtractedAC();

