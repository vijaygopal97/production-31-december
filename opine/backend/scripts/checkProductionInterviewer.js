#!/usr/bin/env node

/**
 * Script to check interviewer in production and survey assignments
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Survey = require('../models/Survey');
const User = require('../models/User');

const INTERVIEWER_ID = process.argv[2] || '694a91ee8ae7606979819169';
const SURVEY_ID = process.argv[3] || '68fd1915d41841da463f0d46';

async function checkProduction() {
  try {
    const PRODUCTION_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
    
    await mongoose.connect(PRODUCTION_MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log(`✅ Connected to PRODUCTION MongoDB\n`);

    // Try to find interviewer by ID
    let interviewer = await User.findById(INTERVIEWER_ID);
    
    if (!interviewer) {
      console.log(`❌ Interviewer with ID ${INTERVIEWER_ID} not found in production`);
      console.log(`\n🔍 Searching for interviewer by memberId or email...`);
      
      // Try to find by memberId (CAPI163)
      interviewer = await User.findOne({ memberId: 'CAPI163' });
      if (interviewer) {
        console.log(`✅ Found interviewer by memberId 'CAPI163':`);
        console.log(`   ID: ${interviewer._id}`);
        console.log(`   Name: ${interviewer.firstName} ${interviewer.lastName}`);
        console.log(`   Member ID: ${interviewer.memberId}`);
        console.log(`   Email: ${interviewer.email}`);
      } else {
        console.log(`❌ Interviewer with memberId 'CAPI163' also not found`);
      }
    } else {
      console.log(`✅ Found interviewer:`);
      console.log(`   ID: ${interviewer._id}`);
      console.log(`   Name: ${interviewer.firstName} ${interviewer.lastName}`);
      console.log(`   Member ID: ${interviewer.memberId}`);
      console.log(`   Email: ${interviewer.email}`);
    }

    // Check survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      console.log(`\n❌ Survey with ID ${SURVEY_ID} not found in production`);
      await mongoose.connection.close();
      process.exit(1);
    }
    
    console.log(`\n✅ Found survey: ${survey.surveyName || survey.title}`);
    
    if (!survey.capiInterviewers || survey.capiInterviewers.length === 0) {
      console.log(`\n❌ No CAPI interviewers assigned to this survey in production`);
    } else {
      console.log(`\n📊 Total CAPI Interviewers in production: ${survey.capiInterviewers.length}`);
      
      // Check if the interviewer is assigned
      const assignment = survey.capiInterviewers.find(
        a => a.interviewer && a.interviewer.toString() === INTERVIEWER_ID
      );
      
      if (assignment) {
        console.log(`\n✅ Interviewer IS assigned in production:`);
        console.log(`   Status: ${assignment.status}`);
        console.log(`   Assigned ACs: ${assignment.assignedACs && assignment.assignedACs.length > 0 ? assignment.assignedACs.join(', ') : 'none'}`);
      } else {
        console.log(`\n❌ Interviewer is NOT assigned in production`);
        
        // Show sample of assigned interviewers
        console.log(`\n📋 Sample of assigned interviewers (first 5):`);
        survey.capiInterviewers.slice(0, 5).forEach((a, idx) => {
          console.log(`   ${idx + 1}. Interviewer ID: ${a.interviewer}`);
          console.log(`      Status: ${a.status}`);
          console.log(`      ACs: ${a.assignedACs && a.assignedACs.length > 0 ? a.assignedACs.join(', ') : 'none'}`);
        });
      }
    }

    await mongoose.connection.close();
    console.log(`\n✅ Database connection closed`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProduction();

