#!/usr/bin/env node

/**
 * Script to check if a CAPI interviewer is assigned to a survey
 * Usage: node checkCAPIInterviewerAssignment.js <interviewerId> <surveyId> [production]
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Survey = require('../models/Survey');
const User = require('../models/User');

const INTERVIEWER_ID = process.argv[2] || '694a91ee8ae7606979819169';
const SURVEY_ID = process.argv[3] || '68fd1915d41841da463f0d46';
const IS_PRODUCTION = process.argv[4] === 'production';

async function checkAssignment() {
  try {
    // Connect to appropriate database
    const PRODUCTION_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
    const mongoUri = IS_PRODUCTION 
      ? PRODUCTION_MONGO_URI
      : process.env.MONGODB_URI;
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log(`✅ Connected to ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'} MongoDB`);
    console.log(`\n📋 Checking CAPI Interviewer Assignment:`);
    console.log(`   Interviewer ID: ${INTERVIEWER_ID}`);
    console.log(`   Survey ID: ${SURVEY_ID}`);
    console.log(`   Database: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

    // Find the interviewer
    const interviewer = await User.findById(INTERVIEWER_ID);
    if (!interviewer) {
      console.log(`❌ Interviewer with ID ${INTERVIEWER_ID} not found`);
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`✅ Found interviewer: ${interviewer.firstName} ${interviewer.lastName} (${interviewer.memberId || interviewer.email})`);

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      console.log(`❌ Survey with ID ${SURVEY_ID} not found`);
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`✅ Found survey: ${survey.surveyName || survey.title}`);

    // Check if interviewer is assigned
    if (!survey.capiInterviewers || survey.capiInterviewers.length === 0) {
      console.log(`\n❌ No CAPI interviewers assigned to this survey`);
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n📊 Total CAPI Interviewers: ${survey.capiInterviewers.length}`);

    const existingAssignment = survey.capiInterviewers.find(
      assignment => assignment.interviewer.toString() === INTERVIEWER_ID
    );

    if (existingAssignment) {
      console.log(`\n✅ Interviewer IS assigned to this survey:`);
      console.log(`   Status: ${existingAssignment.status}`);
      console.log(`   Assigned ACs: ${existingAssignment.assignedACs && existingAssignment.assignedACs.length > 0 ? existingAssignment.assignedACs.join(', ') : 'none (empty array)'}`);
      console.log(`   Max Interviews: ${existingAssignment.maxInterviews || 0}`);
      console.log(`   Completed Interviews: ${existingAssignment.completedInterviews || 0}`);
      console.log(`   Assigned At: ${existingAssignment.assignedAt || 'N/A'}`);
      console.log(`   Assigned By: ${existingAssignment.assignedBy || 'N/A'}`);
    } else {
      console.log(`\n❌ Interviewer is NOT assigned to this survey`);
    }

    await mongoose.connection.close();
    console.log(`\n✅ Database connection closed`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAssignment();

