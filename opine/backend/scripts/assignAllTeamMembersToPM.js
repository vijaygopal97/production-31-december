/**
 * Script to assign all remaining interviewers and quality agents
 * to Project Manager: 6930b86b2eb7303ea516f8b9
 * 
 * This script:
 * 1. Finds the project manager by ID
 * 2. Gets all interviewers and quality agents
 * 3. Checks which ones are already assigned
 * 4. Adds all remaining ones to assignedTeamMembers
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Company = require('../models/Company');

// Project Manager ID
const PROJECT_MANAGER_ID = '6930b86b2eb7303ea516f8b9';

async function assignAllTeamMembers() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the project manager
    console.log(`\n🔍 Finding Project Manager: ${PROJECT_MANAGER_ID}`);
    const projectManager = await User.findById(PROJECT_MANAGER_ID)
      .populate('assignedTeamMembers.user', 'firstName lastName email memberId userType');
    
    // Populate company separately if needed
    if (projectManager && projectManager.company) {
      await projectManager.populate('company', 'companyName companyCode');
    }

    if (!projectManager) {
      throw new Error(`Project Manager with ID ${PROJECT_MANAGER_ID} not found`);
    }

    if (projectManager.userType !== 'project_manager') {
      throw new Error(`User ${PROJECT_MANAGER_ID} is not a project manager. Current type: ${projectManager.userType}`);
    }

    console.log(`✅ Found Project Manager: ${projectManager.firstName} ${projectManager.lastName}`);
    console.log(`   Company: ${projectManager.company?.companyName || 'N/A'} (${projectManager.company?.companyCode || 'N/A'})`);
    console.log(`   Email: ${projectManager.email}`);

    // Get current assigned team members
    const currentAssignedUserIds = new Set();
    if (projectManager.assignedTeamMembers && projectManager.assignedTeamMembers.length > 0) {
      projectManager.assignedTeamMembers.forEach(member => {
        const userId = member.user?._id?.toString() || member.user?.toString();
        if (userId) {
          currentAssignedUserIds.add(userId);
        }
      });
      console.log(`\n📋 Currently assigned team members: ${currentAssignedUserIds.size}`);
    } else {
      console.log(`\n📋 Currently assigned team members: 0`);
    }

    // Get all interviewers and quality agents
    // If project manager has a company, filter by company; otherwise get all
    const query = {
      userType: { $in: ['interviewer', 'quality_agent'] },
      status: { $ne: 'deleted' } // Exclude deleted users
    };

    // If project manager has a company, filter by company
    if (projectManager.company) {
      query.company = projectManager.company._id;
      console.log(`\n🔍 Finding interviewers and quality agents for company: ${projectManager.company.companyName}`);
    } else {
      console.log(`\n🔍 Finding ALL interviewers and quality agents (no company filter)`);
    }

    const allTeamMembers = await User.find(query)
      .select('_id firstName lastName email memberId userType company status')
      .lean();

    console.log(`✅ Found ${allTeamMembers.length} total team members`);

    // Separate interviewers and quality agents
    const interviewers = allTeamMembers.filter(u => u.userType === 'interviewer');
    const qualityAgents = allTeamMembers.filter(u => u.userType === 'quality_agent');

    console.log(`   - Interviewers: ${interviewers.length}`);
    console.log(`   - Quality Agents: ${qualityAgents.length}`);

    // Find which ones are NOT already assigned
    const unassignedInterviewers = interviewers.filter(u => !currentAssignedUserIds.has(u._id.toString()));
    const unassignedQualityAgents = qualityAgents.filter(u => !currentAssignedUserIds.has(u._id.toString()));

    console.log(`\n📊 Assignment Summary:`);
    console.log(`   - Already assigned interviewers: ${interviewers.length - unassignedInterviewers.length}`);
    console.log(`   - Already assigned quality agents: ${qualityAgents.length - unassignedQualityAgents.length}`);
    console.log(`   - Unassigned interviewers: ${unassignedInterviewers.length}`);
    console.log(`   - Unassigned quality agents: ${unassignedQualityAgents.length}`);

    if (unassignedInterviewers.length === 0 && unassignedQualityAgents.length === 0) {
      console.log(`\n✅ All team members are already assigned! No action needed.`);
      await mongoose.disconnect();
      return;
    }

    // Prepare new assignments
    const newAssignments = [];

    // Add unassigned interviewers
    unassignedInterviewers.forEach(interviewer => {
      newAssignments.push({
        user: interviewer._id,
        userType: 'interviewer',
        assignedAt: new Date(),
        assignedBy: projectManager._id
      });
    });

    // Add unassigned quality agents
    unassignedQualityAgents.forEach(qualityAgent => {
      newAssignments.push({
        user: qualityAgent._id,
        userType: 'quality_agent',
        assignedAt: new Date(),
        assignedBy: projectManager._id
      });
    });

    console.log(`\n➕ Adding ${newAssignments.length} new assignments...`);

    // Get existing assignments (to preserve them)
    const existingAssignments = projectManager.assignedTeamMembers || [];
    
    // Convert existing assignments to plain objects
    const existingAssignmentsPlain = existingAssignments.map(member => ({
      user: member.user?._id || member.user,
      userType: member.userType,
      assignedAt: member.assignedAt || new Date(),
      assignedBy: member.assignedBy || projectManager._id
    }));

    // Combine existing and new assignments
    const allAssignments = [...existingAssignmentsPlain, ...newAssignments];

    // Update the project manager
    console.log(`\n💾 Updating Project Manager...`);
    const updatedPM = await User.findByIdAndUpdate(
      PROJECT_MANAGER_ID,
      { assignedTeamMembers: allAssignments },
      { new: true, runValidators: true }
    )
    .populate('assignedTeamMembers.user', 'firstName lastName email memberId userType');

    console.log(`✅ Project Manager updated successfully!`);

    // Display summary
    console.log(`\n📈 Final Summary:`);
    console.log(`   - Total assigned team members: ${updatedPM.assignedTeamMembers.length}`);
    
    const finalInterviewers = updatedPM.assignedTeamMembers.filter(m => m.userType === 'interviewer');
    const finalQualityAgents = updatedPM.assignedTeamMembers.filter(m => m.userType === 'quality_agent');
    
    console.log(`   - Interviewers: ${finalInterviewers.length}`);
    console.log(`   - Quality Agents: ${finalQualityAgents.length}`);

    // Show some examples of newly assigned members
    if (newAssignments.length > 0) {
      console.log(`\n📝 Examples of newly assigned members:`);
      const sampleSize = Math.min(5, newAssignments.length);
      for (let i = 0; i < sampleSize; i++) {
        const assignment = newAssignments[i];
        const user = allTeamMembers.find(u => u._id.toString() === assignment.user.toString());
        if (user) {
          console.log(`   - ${user.userType}: ${user.firstName} ${user.lastName} (${user.memberId || 'N/A'})`);
        }
      }
      if (newAssignments.length > sampleSize) {
        console.log(`   ... and ${newAssignments.length - sampleSize} more`);
      }
    }

    console.log(`\n✅ Script completed successfully!`);

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
  assignAllTeamMembers()
    .then(() => {
      console.log('\n🎉 All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = assignAllTeamMembers;

