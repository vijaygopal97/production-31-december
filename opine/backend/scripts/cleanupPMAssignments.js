/**
 * Cleanup Project Manager Assignments
 * 
 * This script:
 * 1. For each specified Project Manager, checks their assigned interviewers
 * 2. Keeps only interviewers with memberID starting with "CAPI" (case-insensitive)
 * 3. Removes all other interviewers from the PM's assignedTeamMembers
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Production MongoDB URI
const PROD_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// Project Managers to clean up (Production User IDs)
const PROJECT_MANAGERS = [
  {
    name: 'Abdur Rakib',
    email: 'abdur.rakib@convergent.com',
    userId: '6942c33cfe90bbe7745b5dd0' // Production ID
  },
  {
    name: 'Bikash Ch Sarkar',
    email: 'bikash.sarkar@convergent.com',
    userId: '6942c399fe90bbe7745c9681' // Production ID
  },
  {
    name: 'Krishna Das',
    email: 'krishna.das@convergent.com',
    userId: '6942c421fe90bbe7745e0538' // Production ID
  },
  {
    name: 'Dulal Ch Roy',
    email: 'dulal.roy@convergent.com',
    userId: '6942c422fe90bbe7745e053b' // Production ID
  },
  {
    name: 'Sibsankar Giri',
    email: 'sibsankar.giri@convergent.com',
    userId: '6942c423fe90bbe7745e053e' // Production ID
  }
];

// Check if memberID starts with CAPI (case-insensitive)
const isCAPIInterviewer = (memberId) => {
  if (!memberId) return false;
  return /^CAPI/i.test(memberId);
};

const main = async () => {
  try {
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    await mongoose.connect(PROD_MONGO_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    const results = {
      processed: [],
      errors: []
    };

    // Process each Project Manager
    for (const pmInfo of PROJECT_MANAGERS) {
      try {
        console.log(`${'='.repeat(80)}`);
        console.log(`📋 Processing Project Manager: ${pmInfo.name}`);
        console.log(`   User ID: ${pmInfo.userId}`);
        console.log(`${'='.repeat(80)}\n`);

        // Find Project Manager
        const pm = await User.findById(pmInfo.userId);
        if (!pm) {
          console.log(`   ❌ Project Manager not found with ID: ${pmInfo.userId}\n`);
          results.errors.push({
            pm: pmInfo.name,
            error: 'PM not found'
          });
          continue;
        }

        console.log(`   ✅ Found PM: ${pm.firstName} ${pm.lastName}`);
        console.log(`   📧 Email: ${pm.email}\n`);

        // Check assigned team members
        if (!pm.assignedTeamMembers || pm.assignedTeamMembers.length === 0) {
          console.log(`   ℹ️  No assigned team members found. Nothing to clean up.\n`);
          results.processed.push({
            pm: pmInfo.name,
            total: 0,
            kept: 0,
            removed: 0
          });
          continue;
        }

        console.log(`   📊 Total assigned team members: ${pm.assignedTeamMembers.length}\n`);

        // Populate interviewer details to check memberIDs
        const teamMembersWithDetails = [];
        for (const member of pm.assignedTeamMembers) {
          if (member.userType === 'interviewer' && member.user) {
            const interviewer = await User.findById(member.user);
            if (interviewer) {
              teamMembersWithDetails.push({
                assignment: member,
                interviewer: interviewer,
                memberId: interviewer.memberId || 'N/A',
                isCAPI: isCAPIInterviewer(interviewer.memberId)
              });
            }
          } else {
            // Keep non-interviewer assignments (quality agents, etc.)
            teamMembersWithDetails.push({
              assignment: member,
              interviewer: null,
              memberId: 'N/A',
              isCAPI: true // Keep non-interviewer assignments
            });
          }
        }

        // Separate CAPI and non-CAPI interviewers
        const toKeep = [];
        const toRemove = [];

        for (const item of teamMembersWithDetails) {
          if (item.assignment.userType === 'interviewer') {
            if (item.isCAPI) {
              toKeep.push(item);
              console.log(`   ✅ KEEP: ${item.interviewer.firstName} ${item.interviewer.lastName} (${item.memberId})`);
            } else {
              toRemove.push(item);
              console.log(`   🗑️  REMOVE: ${item.interviewer.firstName} ${item.interviewer.lastName} (${item.memberId})`);
            }
          } else {
            // Keep non-interviewer assignments
            toKeep.push(item);
            console.log(`   ✅ KEEP: ${item.assignment.userType} (non-interviewer)`);
          }
        }

        console.log(`\n   📊 Summary:`);
        console.log(`      Total: ${pm.assignedTeamMembers.length}`);
        console.log(`      Keeping: ${toKeep.length}`);
        console.log(`      Removing: ${toRemove.length}\n`);

        if (toRemove.length > 0) {
          // Update assignedTeamMembers to keep only CAPI interviewers
          pm.assignedTeamMembers = toKeep.map(item => item.assignment);
          await pm.save();
          console.log(`   ✅ Updated Project Manager assignments\n`);
        } else {
          console.log(`   ✓ No changes needed - all interviewers are CAPI\n`);
        }

        results.processed.push({
          pm: pmInfo.name,
          total: pm.assignedTeamMembers.length,
          kept: toKeep.length,
          removed: toRemove.length
        });

      } catch (error) {
        console.error(`   ❌ Error processing ${pmInfo.name}: ${error.message}\n`);
        results.errors.push({
          pm: pmInfo.name,
          error: error.message
        });
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    console.log(`✅ Processed: ${results.processed.length} Project Managers`);
    console.log(`❌ Errors: ${results.errors.length}\n`);

    if (results.processed.length > 0) {
      console.log(`📋 DETAILED RESULTS:\n`);
      results.processed.forEach((item, index) => {
        console.log(`${index + 1}. ${item.pm}`);
        console.log(`   Total assigned: ${item.total}`);
        console.log(`   Kept (CAPI): ${item.kept}`);
        console.log(`   Removed (non-CAPI): ${item.removed}\n`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS:\n`);
      results.errors.forEach((item, index) => {
        console.log(`${index + 1}. ${item.pm}: ${item.error}\n`);
      });
    }

    console.log(`${'='.repeat(80)}`);
    console.log('✅ Cleanup completed successfully!');
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { main };



