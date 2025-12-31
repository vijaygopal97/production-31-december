/**
 * Assign CAPI users to Project Manager: abdur.rakib@convergent.com
 * 
 * This script assigns all the newly added CAPI interviewers to the specified Project Manager
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PM_EMAIL = 'abdur.rakib@convergent.com';
const CAPI_MEMBER_IDS = [
  'CAPI408',
  'CAPI431',
  'CAPI432',
  'CAPI438',
  'CAPI440',
  'CAPI488',
  'CAPI498',
  'CAPI499',
  'CAPI581',
  'CAPI582',
  'CAPI583',
  'CAPI588'
];

const assignCAPIUsersToPM = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find Project Manager
    console.log(`📋 Finding Project Manager: ${PM_EMAIL}...`);
    const pm = await User.findOne({ email: PM_EMAIL.toLowerCase(), userType: 'project_manager' });
    if (!pm) {
      throw new Error(`Project Manager with email ${PM_EMAIL} not found`);
    }
    console.log(`✅ Found Project Manager: ${pm.firstName} ${pm.lastName} (${pm._id})\n`);

    // Find all CAPI users by memberId
    console.log(`🔍 Finding CAPI users...`);
    const capiUsers = await User.find({
      memberId: { $in: CAPI_MEMBER_IDS }
    });
    
    console.log(`✅ Found ${capiUsers.length} CAPI users:\n`);
    capiUsers.forEach(user => {
      console.log(`   - ${user.memberId}: ${user.firstName} ${user.lastName} (${user._id})`);
    });
    console.log();

    if (capiUsers.length === 0) {
      console.log('⚠️  No CAPI users found. Nothing to assign.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Initialize assignedTeamMembers if not exists
    if (!pm.assignedTeamMembers) {
      pm.assignedTeamMembers = [];
    }

    // Get existing assigned user IDs
    const existingUserIds = pm.assignedTeamMembers.map(m => m.user.toString());
    
    let newlyAssigned = 0;
    let alreadyAssigned = 0;

    // Assign each CAPI user
    console.log('📝 Assigning CAPI users to Project Manager...\n');
    for (const capiUser of capiUsers) {
      if (existingUserIds.includes(capiUser._id.toString())) {
        console.log(`   ⏭️  ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName}) - Already assigned`);
        alreadyAssigned++;
      } else {
        pm.assignedTeamMembers.push({
          user: capiUser._id,
          userType: 'interviewer',
          assignedAt: new Date(),
          assignedBy: pm._id
        });
        console.log(`   ✅ ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName}) - Assigned`);
        newlyAssigned++;
      }
    }

    // Save Project Manager
    if (newlyAssigned > 0) {
      await pm.save();
      console.log(`\n✅ Project Manager updated successfully`);
    } else {
      console.log(`\n✓ All CAPI users were already assigned`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total CAPI users: ${capiUsers.length}`);
    console.log(`   Newly assigned: ${newlyAssigned}`);
    console.log(`   Already assigned: ${alreadyAssigned}`);
    console.log(`   Total assigned to PM: ${pm.assignedTeamMembers.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  assignCAPIUsersToPM();
}

module.exports = { assignCAPIUsersToPM };



