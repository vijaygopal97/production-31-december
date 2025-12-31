#!/usr/bin/env node

/**
 * Script to verify CAPI interviewer assignments
 * Usage: node verifyCAPIAssignments.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Survey = require('../models/Survey');
const User = require('../models/User');

const MEMBER_IDS = ['CAPI306', 'CAPI304', 'CAPI300'];
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function verifyAssignments() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log(`✅ Connected to MongoDB\n`);

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID).populate('capiInterviewers.interviewer', 'firstName lastName memberId email');
    if (!survey) {
      throw new Error(`Survey with ID ${SURVEY_ID} not found`);
    }

    console.log(`📋 Survey: ${survey.surveyName || survey.title || SURVEY_ID}`);
    console.log(`📝 Total CAPI Interviewers: ${survey.capiInterviewers?.length || 0}\n`);

    // Verify each interviewer
    for (const memberId of MEMBER_IDS) {
      const interviewer = await User.findOne({ memberId: memberId });
      
      if (!interviewer) {
        console.log(`❌ ${memberId}: Interviewer not found in database`);
        continue;
      }

      const assignment = survey.capiInterviewers?.find(
        a => a.interviewer && (
          a.interviewer._id?.toString() === interviewer._id.toString() ||
          a.interviewer.toString() === interviewer._id.toString()
        )
      );

      if (assignment) {
        const interviewerName = assignment.interviewer.firstName 
          ? `${assignment.interviewer.firstName} ${assignment.interviewer.lastName}`
          : interviewer.firstName 
            ? `${interviewer.firstName} ${interviewer.lastName}`
            : memberId;
        
        console.log(`✅ ${memberId} (${interviewerName}):`);
        console.log(`   - Status: ${assignment.status}`);
        console.log(`   - Assigned ACs: ${assignment.assignedACs?.length || 0}`);
        console.log(`   - Max Interviews: ${assignment.maxInterviews || 0}`);
        console.log(`   - Completed: ${assignment.completedInterviews || 0}`);
        console.log(`   - Assigned At: ${assignment.assignedAt || 'N/A'}`);
      } else {
        console.log(`❌ ${memberId}: NOT assigned to survey`);
      }
      console.log('');
    }

    await mongoose.connection.close();
    console.log(`✅ Verification complete`);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

verifyAssignments();
