#!/usr/bin/env node

/**
 * Reassign Interviewers to projectmanager2@gmail.com
 * 
 * This script:
 * 1. Removes all currently assigned interviewers from projectmanager2@gmail.com
 * 2. Gets all interviewers assigned to specified project managers
 * 3. Assigns all those interviewers to projectmanager2@gmail.com
 * 
 * Source Project Managers:
 * - abdur.rakib@convergent.com
 * - bikash.sarkar@convergent.com
 * - krishna.das@convergent.com
 * - dulal.roy@convergent.com
 * - sibsankar.giri@convergent.com
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Configuration
const TARGET_PM_EMAIL = 'projectmanager2@gmail.com';
const SOURCE_PM_EMAILS = [
  'abdur.rakib@convergent.com',
  'bikash.sarkar@convergent.com',
  'krishna.das@convergent.com',
  'dulal.roy@convergent.com',
  'sibsankar.giri@convergent.com'
];

// Database URI
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

async function reassignInterviewers() {
  let connection = null;
  
  try {
    console.log('🚀 Starting interviewer reassignment process...\n');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database\n');
    
    // Step 1: Find target project manager
    console.log(`🔍 Step 1: Finding target project manager (${TARGET_PM_EMAIL})...`);
    const targetPM = await User.findOne({ 
      email: TARGET_PM_EMAIL.toLowerCase(),
      userType: 'project_manager'
    });
    
    if (!targetPM) {
      throw new Error(`Project manager with email ${TARGET_PM_EMAIL} not found`);
    }
    
    console.log(`✅ Found target PM: ${targetPM.firstName} ${targetPM.lastName} (${targetPM._id})`);
    console.log(`   Current assigned interviewers: ${targetPM.assignedTeamMembers?.length || 0}\n`);
    
    // Step 2: Find all source project managers
    console.log('🔍 Step 2: Finding source project managers...');
    const sourcePMs = await User.find({
      email: { $in: SOURCE_PM_EMAILS.map(e => e.toLowerCase()) },
      userType: 'project_manager'
    });
    
    if (sourcePMs.length !== SOURCE_PM_EMAILS.length) {
      const foundEmails = sourcePMs.map(pm => pm.email);
      const missingEmails = SOURCE_PM_EMAILS.filter(e => !foundEmails.includes(e.toLowerCase()));
      console.log(`⚠️  Warning: Some project managers not found: ${missingEmails.join(', ')}`);
    }
    
    console.log(`✅ Found ${sourcePMs.length} source project managers:\n`);
    sourcePMs.forEach(pm => {
      const count = pm.assignedTeamMembers?.length || 0;
      console.log(`   - ${pm.email}: ${count} interviewers`);
    });
    console.log('');
    
    // Step 3: Collect all unique interviewers from source PMs
    console.log('🔍 Step 3: Collecting all interviewers from source project managers...');
    const allInterviewerIds = new Set();
    const interviewerDetails = new Map();
    
    sourcePMs.forEach(pm => {
      if (pm.assignedTeamMembers && Array.isArray(pm.assignedTeamMembers)) {
        pm.assignedTeamMembers.forEach(member => {
          const interviewerId = member.user?._id || member.user;
          if (interviewerId) {
            const idString = interviewerId.toString();
            if (!allInterviewerIds.has(idString)) {
              allInterviewerIds.add(idString);
              interviewerDetails.set(idString, {
                user: interviewerId,
                userType: member.userType || 'interviewer',
                assignedAt: member.assignedAt || new Date(),
                assignedBy: pm._id
              });
            }
          }
        });
      }
    });
    
    console.log(`✅ Found ${allInterviewerIds.size} unique interviewers to assign\n`);
    
    // Step 4: Verify all interviewers exist
    console.log('🔍 Step 4: Verifying all interviewers exist...');
    const interviewerIdsArray = Array.from(allInterviewerIds).map(id => new mongoose.Types.ObjectId(id));
    const existingInterviewers = await User.find({
      _id: { $in: interviewerIdsArray },
      userType: 'interviewer'
    });
    
    if (existingInterviewers.length !== allInterviewerIds.size) {
      console.log(`⚠️  Warning: Some interviewers not found. Expected: ${allInterviewerIds.size}, Found: ${existingInterviewers.length}`);
    }
    
    console.log(`✅ Verified ${existingInterviewers.length} interviewers exist\n`);
    
    // Step 5: Clear target PM's current assignments
    console.log('🗑️  Step 5: Clearing current assignments from target PM...');
    targetPM.assignedTeamMembers = [];
    await targetPM.save();
    console.log('✅ Cleared current assignments\n');
    
    // Step 6: Assign all interviewers to target PM
    console.log('📝 Step 6: Assigning interviewers to target PM...');
    const newAssignments = Array.from(interviewerDetails.values()).map(detail => ({
      user: detail.user,
      userType: detail.userType,
      assignedAt: new Date(),
      assignedBy: targetPM._id
    }));
    
    targetPM.assignedTeamMembers = newAssignments;
    await targetPM.save();
    
    console.log(`✅ Assigned ${newAssignments.length} interviewers to ${TARGET_PM_EMAIL}\n`);
    
    // Step 7: Verify the assignment
    console.log('🔍 Step 7: Verifying assignment...');
    const updatedPM = await User.findById(targetPM._id);
    const assignedCount = updatedPM.assignedTeamMembers?.length || 0;
    
    console.log(`✅ Verification complete:`);
    console.log(`   Target PM: ${TARGET_PM_EMAIL}`);
    console.log(`   Assigned interviewers: ${assignedCount}`);
    console.log(`   Source PMs: ${sourcePMs.length}`);
    console.log(`   Unique interviewers collected: ${allInterviewerIds.size}\n`);
    
    // Summary
    console.log('='.repeat(70));
    console.log('  ✅ REASSIGNMENT COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   Target PM: ${TARGET_PM_EMAIL}`);
    console.log(`   Previous assignments: ${targetPM.assignedTeamMembers?.length || 0} (cleared)`);
    console.log(`   New assignments: ${assignedCount}`);
    console.log(`   Source PMs processed: ${sourcePMs.length}`);
    console.log(`   Source PMs:`);
    sourcePMs.forEach(pm => {
      const count = pm.assignedTeamMembers?.length || 0;
      console.log(`     - ${pm.email}: ${count} interviewers (unchanged)`);
    });
    console.log(`\n✅ All interviewers from source PMs are now assigned to ${TARGET_PM_EMAIL}`);
    console.log(`✅ Source PM assignments remain unchanged\n`);
    
  } catch (error) {
    console.error('\n❌ Error during reassignment:', error);
    throw error;
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from database');
    }
  }
}

// Run the script
if (require.main === module) {
  reassignInterviewers()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { reassignInterviewers };


