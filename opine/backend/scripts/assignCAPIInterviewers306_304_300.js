#!/usr/bin/env node

/**
 * Script to assign CAPI interviewers (CAPI306, CAPI304, CAPI300) to survey
 * Usage: node assignCAPIInterviewers306_304_300.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Survey = require('../models/Survey');
const User = require('../models/User');

const MEMBER_IDS = ['CAPI306', 'CAPI304', 'CAPI300'];
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function assignCAPIInterviewers() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log(`✅ Connected to MongoDB`);
    console.log(`\n📋 Assigning CAPI Interviewers to Survey:`);
    console.log(`   Member IDs: ${MEMBER_IDS.join(', ')}`);
    console.log(`   Survey ID: ${SURVEY_ID}\n`);

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey with ID ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName || survey.title || SURVEY_ID}`);

    // Initialize capiInterviewers array if it doesn't exist
    if (!survey.capiInterviewers) {
      survey.capiInterviewers = [];
    }

    // Get a system admin or company admin user ID for assignedBy
    let assignedByUserId = null;
    if (survey.createdBy) {
      assignedByUserId = survey.createdBy;
    } else {
      // Find a company admin from the same company
      const companyAdmin = await User.findOne({
        company: survey.company,
        userType: { $in: ['company_admin', 'admin', 'project_manager'] },
        status: 'active'
      }).limit(1);
      
      if (companyAdmin) {
        assignedByUserId = companyAdmin._id;
      }
    }

    if (!assignedByUserId) {
      // Find any active user from the same company as fallback
      const fallbackUser = await User.findOne({
        company: survey.company,
        status: 'active'
      }).limit(1);
      
      if (fallbackUser) {
        assignedByUserId = fallbackUser._id;
        console.log(`⚠️  Warning: Using fallback user for assignedBy: ${fallbackUser.email}`);
      } else {
        throw new Error('Could not find a user to set as assignedBy');
      }
    }

    // Process each interviewer
    let assignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const memberId of MEMBER_IDS) {
      try {
        // Find the interviewer by memberId
        const interviewer = await User.findOne({
          memberId: memberId,
          userType: 'interviewer',
          status: 'active'
        });

        if (!interviewer) {
          console.log(`❌ Interviewer with memberId ${memberId} not found or not active`);
          errorCount++;
          continue;
        }

        console.log(`\n📌 Processing: ${memberId} (${interviewer.firstName} ${interviewer.lastName})`);

        // Check if interviewer is already assigned
        const existingAssignment = survey.capiInterviewers.find(
          assignment => assignment.interviewer.toString() === interviewer._id.toString()
        );

        if (existingAssignment) {
          console.log(`   ⚠️  Already assigned to survey (skipping)`);
          console.log(`      Status: ${existingAssignment.status}`);
          console.log(`      Assigned ACs: ${existingAssignment.assignedACs?.length || 0}`);
          skippedCount++;
          continue;
        }

        // Add the interviewer assignment
        survey.capiInterviewers.push({
          interviewer: interviewer._id,
          assignedBy: assignedByUserId,
          assignedAt: new Date(),
          assignedACs: [], // Empty array - no specific ACs assigned
          status: 'assigned',
          maxInterviews: 0,
          completedInterviews: 0
        });

        console.log(`   ✅ Added to capiInterviewers array`);
        assignedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing ${memberId}:`, error.message);
        errorCount++;
      }
    }

    // Save the survey with all assignments
    if (assignedCount > 0) {
      await survey.save();
      console.log(`\n✅ Successfully saved survey with ${assignedCount} new assignment(s)`);
    }

    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully assigned: ${assignedCount}`);
    console.log(`   ⚠️  Already assigned (skipped): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total CAPI interviewers in survey: ${survey.capiInterviewers.length}`);

    await mongoose.connection.close();
    console.log(`\n✅ Database connection closed`);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

assignCAPIInterviewers();



