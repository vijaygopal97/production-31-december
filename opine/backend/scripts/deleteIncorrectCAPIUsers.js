/**
 * Delete all CAPI users that were incorrectly created
 * This deletes users with memberID starting with "CAPI"
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all users with memberID starting with "CAPI"
    console.log('🔍 Finding all CAPI users (memberID starting with "CAPI")...');
    const capiUsers = await User.find({ 
      memberId: { $regex: /^CAPI/i }
    });

    console.log(`📊 Found ${capiUsers.length} CAPI users to delete\n`);

    if (capiUsers.length === 0) {
      console.log('✅ No CAPI users found. Nothing to delete.\n');
      await mongoose.disconnect();
      return;
    }

    // Show what will be deleted
    console.log('📋 Users to be deleted:');
    capiUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.memberId}) - ${user.email}`);
    });
    console.log('');

    // Delete all CAPI users
    console.log('🗑️  Deleting CAPI users...');
    const deleteResult = await User.deleteMany({ 
      memberId: { $regex: /^CAPI/i }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} CAPI users\n`);

    // Also remove from survey assignments
    const Survey = require('../models/Survey');
    const survey = await Survey.findById('68fd1915d41841da463f0d46');
    if (survey && survey.capiInterviewers) {
      const capiUserIds = capiUsers.map(u => u._id);
      const originalLength = survey.capiInterviewers.length;
      survey.capiInterviewers = survey.capiInterviewers.filter(
        assignment => !capiUserIds.some(id => id.toString() === assignment.interviewer.toString())
      );
      await survey.save();
      console.log(`✅ Removed ${originalLength - survey.capiInterviewers.length} CAPI assignments from survey\n`);
    }

    // Remove from Project Manager assignments
    const pms = await User.find({ userType: 'project_manager' });
    let removedFromPMs = 0;
    for (const pm of pms) {
      if (pm.assignedTeamMembers && pm.assignedTeamMembers.length > 0) {
        const originalLength = pm.assignedTeamMembers.length;
        const capiUserIds = capiUsers.map(u => u._id.toString());
        pm.assignedTeamMembers = pm.assignedTeamMembers.filter(
          member => !capiUserIds.includes(member.user.toString())
        );
        if (pm.assignedTeamMembers.length !== originalLength) {
          await pm.save();
          removedFromPMs += (originalLength - pm.assignedTeamMembers.length);
        }
      }
    }
    console.log(`✅ Removed ${removedFromPMs} CAPI user assignments from Project Managers\n`);

    console.log('✅ Cleanup completed successfully!\n');

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



