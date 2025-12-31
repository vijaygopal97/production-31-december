/**
 * Verify Project Manager Cleanup in Production
 * Check that all assigned interviewers have CAPI-prefixed memberIDs
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

const PROJECT_MANAGERS = [
  { name: 'Abdur Rakib', userId: '6942c33cfe90bbe7745b5dd0' },
  { name: 'Bikash Ch Sarkar', userId: '6942c399fe90bbe7745c9681' },
  { name: 'Krishna Das', userId: '6942c421fe90bbe7745e0538' },
  { name: 'Dulal Ch Roy', userId: '6942c422fe90bbe7745e053b' },
  { name: 'Sibsankar Giri', userId: '6942c423fe90bbe7745e053e' }
];

const isCAPIInterviewer = (memberId) => {
  if (!memberId) return false;
  return /^CAPI/i.test(memberId);
};

const main = async () => {
  try {
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    await mongoose.connect(PROD_MONGO_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    console.log('🔍 Verifying cleanup results...\n');

    for (const pmInfo of PROJECT_MANAGERS) {
      const pm = await User.findById(pmInfo.userId).populate('assignedTeamMembers.user');
      
      if (!pm) {
        console.log(`❌ PM not found: ${pmInfo.name}\n`);
        continue;
      }

      console.log(`${'='.repeat(60)}`);
      console.log(`📋 ${pmInfo.name}`);
      console.log(`${'='.repeat(60)}`);
      
      if (!pm.assignedTeamMembers || pm.assignedTeamMembers.length === 0) {
        console.log(`   ℹ️  No assigned team members\n`);
        continue;
      }

      const interviewers = pm.assignedTeamMembers.filter(m => m.userType === 'interviewer');
      console.log(`   📊 Total assigned interviewers: ${interviewers.length}\n`);

      let capiCount = 0;
      let nonCapiCount = 0;
      const nonCapiList = [];

      for (const member of interviewers) {
        if (member.user && member.user.memberId) {
          if (isCAPIInterviewer(member.user.memberId)) {
            capiCount++;
          } else {
            nonCapiCount++;
            nonCapiList.push({
              name: `${member.user.firstName} ${member.user.lastName}`,
              memberId: member.user.memberId
            });
          }
        }
      }

      console.log(`   ✅ CAPI interviewers: ${capiCount}`);
      if (nonCapiCount > 0) {
        console.log(`   ❌ Non-CAPI interviewers: ${nonCapiCount}`);
        console.log(`   🗑️  Non-CAPI list:`);
        nonCapiList.forEach(item => {
          console.log(`      - ${item.name} (${item.memberId})`);
        });
      } else {
        console.log(`   ✅ All interviewers are CAPI - Cleanup verified!\n`);
      }
      console.log('');
    }

    console.log('✅ Verification complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

main();



