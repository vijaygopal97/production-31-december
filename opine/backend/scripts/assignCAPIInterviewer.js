#!/usr/bin/env node

/**
 * Script to assign a CAPI interviewer to a survey
 * Usage: node assignCAPIInterviewer.js <interviewerId> <surveyId> [production]
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Survey = require('../models/Survey');
const User = require('../models/User');

const INTERVIEWER_ID = process.argv[2] || '694a91ee8ae7606979819169';
const SURVEY_ID = process.argv[3] || '68fd1915d41841da463f0d46';
const IS_PRODUCTION = process.argv[4] === 'production';

async function assignCAPIInterviewer() {
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
    console.log(`\n📋 Assigning CAPI Interviewer:`);
    console.log(`   Interviewer ID: ${INTERVIEWER_ID}`);
    console.log(`   Survey ID: ${SURVEY_ID}`);
    console.log(`   Database: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

    // Find the interviewer
    const interviewer = await User.findById(INTERVIEWER_ID);
    if (!interviewer) {
      throw new Error(`Interviewer with ID ${INTERVIEWER_ID} not found`);
    }
    console.log(`✅ Found interviewer: ${interviewer.firstName} ${interviewer.lastName} (${interviewer.memberId || interviewer.email})`);

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey with ID ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName || survey.title}`);

    // Check existing CAPI interviewers to understand the pattern
    if (survey.capiInterviewers && survey.capiInterviewers.length > 0) {
      console.log(`\n📊 Current CAPI Interviewers (${survey.capiInterviewers.length}):`);
      
      // Find interviewers without AC assignments
      const interviewersWithoutAC = survey.capiInterviewers.filter(
        assignment => !assignment.assignedACs || assignment.assignedACs.length === 0
      );
      
      if (interviewersWithoutAC.length > 0) {
        console.log(`\n   Interviewers WITHOUT AC assignments (${interviewersWithoutAC.length}):`);
        interviewersWithoutAC.slice(0, 5).forEach((assignment, idx) => {
          console.log(`   ${idx + 1}. Interviewer: ${assignment.interviewer}`);
          console.log(`      Status: ${assignment.status}`);
          console.log(`      Assigned ACs: ${assignment.assignedACs || 'none'}`);
          console.log(`      Max Interviews: ${assignment.maxInterviews || 0}`);
          console.log(`      Completed: ${assignment.completedInterviews || 0}`);
        });
      }
      
      // Check if interviewer is already assigned
      const existingAssignment = survey.capiInterviewers.find(
        assignment => assignment.interviewer.toString() === INTERVIEWER_ID
      );
      
      if (existingAssignment) {
        console.log(`\n⚠️  Interviewer is already assigned to this survey`);
        console.log(`   Status: ${existingAssignment.status}`);
        console.log(`   Assigned ACs: ${existingAssignment.assignedACs || 'none'}`);
        
        // Update to ensure no ACs are assigned
        if (existingAssignment.assignedACs && existingAssignment.assignedACs.length > 0) {
          console.log(`\n   Removing AC assignments...`);
          existingAssignment.assignedACs = [];
          existingAssignment.status = 'assigned';
          await survey.save();
          console.log(`✅ Removed AC assignments from existing assignment`);
        } else {
          console.log(`✅ Interviewer already assigned without ACs (no changes needed)`);
        }
        return;
      }
    }

    // Get a system admin or company admin user ID for assignedBy
    // Try to find the survey creator or a company admin
    let assignedByUserId = null;
    if (survey.createdBy) {
      assignedByUserId = survey.createdBy;
    } else {
      // Find a company admin from the same company
      const companyAdmin = await User.findOne({
        company: survey.company,
        userType: { $in: ['company_admin', 'admin'] },
        status: 'active'
      }).limit(1);
      
      if (companyAdmin) {
        assignedByUserId = companyAdmin._id;
      }
    }

    if (!assignedByUserId) {
      // Use the interviewer's ID as fallback (not ideal but works)
      assignedByUserId = INTERVIEWER_ID;
      console.log(`⚠️  Warning: Could not find admin user for assignedBy, using interviewer ID`);
    }

    // Initialize capiInterviewers array if it doesn't exist
    if (!survey.capiInterviewers) {
      survey.capiInterviewers = [];
    }

    // Add the interviewer assignment (without ACs, following the pattern of other interviewers)
    survey.capiInterviewers.push({
      interviewer: INTERVIEWER_ID,
      assignedBy: assignedByUserId,
      assignedAt: new Date(),
      assignedACs: [], // No ACs assigned
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });

    await survey.save();
    console.log(`\n✅ Successfully assigned CAPI interviewer to survey`);
    console.log(`   - Interviewer: ${interviewer.firstName} ${interviewer.lastName}`);
    console.log(`   - Assigned ACs: none (empty array)`);
    console.log(`   - Status: assigned`);
    console.log(`   - Max Interviews: 0`);
    console.log(`   - Completed Interviews: 0`);

    await mongoose.connection.close();
    console.log(`\n✅ Database connection closed`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignCAPIInterviewer();

