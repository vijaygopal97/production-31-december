#!/usr/bin/env node

/**
 * Script to test demographic extraction from responses
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

async function testDemographicExtraction() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB\n');

    const surveyId = '68fd1915d41841da463f0d46';
    
    // Get a sample of responses with status Approved, Rejected, or Pending_Approval
    const sampleResponses = await SurveyResponse.find({
      survey: surveyId,
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    })
    .limit(10)
    .lean();

    console.log(`📊 Testing demographic extraction on ${sampleResponses.length} sample responses\n`);

    sampleResponses.forEach((response, idx) => {
      console.log(`\n--- Response ${idx + 1} ---`);
      console.log(`Response ID: ${response._id}`);
      console.log(`Status: ${response.status}`);
      
      // Extract gender
      if (response.responses && Array.isArray(response.responses)) {
        const genderResponse = response.responses.find(r => {
          const questionText = (r.questionText || '').toLowerCase();
          const questionId = (r.questionId || '').toLowerCase();
          return questionText.includes('gender') || 
                 questionText.includes('sex') || 
                 questionId.includes('gender');
        });
        
        if (genderResponse) {
          let genderValue = genderResponse.response;
          if (Array.isArray(genderValue)) {
            genderValue = genderValue[0];
          }
          if (genderValue) {
            // Extract main text (before underscore or brace)
            const genderStr = String(genderValue);
            const mainText = genderStr.split('_')[0].split('{')[0].trim().toLowerCase();
            console.log(`Gender Response: ${genderValue}`);
            console.log(`Gender Extracted: ${mainText}`);
            console.log(`Is Female: ${mainText.includes('female') || mainText === 'f' || mainText === '2'}`);
          }
        }
        
        // Extract age
        const ageResponse = response.responses.find(r => {
          const questionText = (r.questionText || '').toLowerCase();
          return questionText.includes('age') || questionText.includes('year');
        });
        
        if (ageResponse) {
          let ageValue = ageResponse.response;
          if (typeof ageValue === 'number') {
            console.log(`Age (number): ${ageValue}`);
            console.log(`Age 18-24: ${ageValue >= 18 && ageValue <= 24}`);
            console.log(`Age 50+: ${ageValue >= 50}`);
          } else if (ageValue) {
            const ageStr = String(ageValue);
            const ageMatch = ageStr.match(/^\s*(\d+)/);
            if (ageMatch) {
              const age = parseInt(ageMatch[1]);
              console.log(`Age (extracted): ${age}`);
              console.log(`Age 18-24: ${age >= 18 && age <= 24}`);
              console.log(`Age 50+: ${age >= 50}`);
            } else {
              console.log(`Age Response: ${ageValue} (could not extract number)`);
            }
          }
        }
        
        // Extract phone
        const phoneResponse = response.responses.find(r => {
          const questionText = (r.questionText || '').toLowerCase();
          return questionText.includes('phone') || questionText.includes('mobile');
        });
        
        if (phoneResponse) {
          let phoneValue = phoneResponse.response;
          if (Array.isArray(phoneValue)) {
            phoneValue = phoneValue[0];
          }
          const phoneStr = String(phoneValue || '').trim().toLowerCase();
          console.log(`Phone Response: ${phoneValue}`);
          console.log(`Has Phone: ${phoneStr !== '' && phoneStr !== 'n/a' && phoneStr !== '0'}`);
        }
        
        // Extract caste (for this survey)
        const casteResponse = response.responses.find(r => {
          const questionText = (r.questionText || '').toLowerCase();
          return questionText.includes('caste') || 
                 questionText.includes('scheduled cast') || 
                 questionText.includes('category');
        });
        
        if (casteResponse) {
          let casteValue = casteResponse.response;
          if (Array.isArray(casteValue)) {
            casteValue = casteValue[0];
          }
          if (casteValue) {
            const casteStr = String(casteValue).toLowerCase();
            console.log(`Caste Response: ${casteValue}`);
            console.log(`Is SC: ${casteStr.includes('scheduled cast') || casteStr.includes('sc') || casteStr.includes('scheduled caste')}`);
          }
        }
        
        // Extract religion
        const religionResponse = response.responses.find(r => {
          const questionText = (r.questionText || '').toLowerCase();
          return questionText.includes('religion');
        });
        
        if (religionResponse) {
          let religionValue = religionResponse.response;
          if (Array.isArray(religionValue)) {
            religionValue = religionValue[0];
          }
          if (religionValue) {
            const religionStr = String(religionValue).toLowerCase();
            console.log(`Religion Response: ${religionValue}`);
            console.log(`Is Muslim: ${religionStr.includes('muslim') || religionStr.includes('islam')}`);
          }
        }
      }
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testDemographicExtraction();

