const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Survey = require('../models/Survey');

// Production quality agent memberIds (the correct ones to keep)
const productionMemberIds = [
  '1001', '1006', '1007', '1008', '1009', '1010', '1011', '1012', '1013', '1014',
  '1015', '1016', '1017', '1018', '1019', '1020', '1021', '1022', '1023'
];

async function cleanupDuplicateQualityAgents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all quality agents in development
    const allQualityAgents = await User.find({
      userType: 'quality_agent',
      companyCode: 'TEST001',
      memberId: { $gte: '1000', $lte: '1999' }
    }).select('_id memberId email firstName lastName').lean();

    console.log(`\n📊 Found ${allQualityAgents.length} quality agents in development`);

    // Identify duplicates to delete
    const toKeep = [];
    const toDelete = [];

    for (const agent of allQualityAgents) {
      if (productionMemberIds.includes(agent.memberId)) {
        // Check if we already have this memberId in toKeep
        const existing = toKeep.find(u => u.memberId === agent.memberId);
        if (!existing) {
          toKeep.push(agent);
        } else {
          // Multiple users with same memberId - keep the first one, delete others
          toDelete.push(agent);
        }
      } else {
        // Not in production list, delete it
        toDelete.push(agent);
      }
    }

    console.log(`\n✅ To Keep: ${toKeep.length} users`);
    console.log(`❌ To Delete: ${toDelete.length} users`);

    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found. All good!');
      process.exit(0);
    }

    console.log('\n📋 Users to be deleted:');
    toDelete.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} - MemberId: ${user.memberId} - Email: ${user.email}`);
    });

    // Delete duplicate users
    const deleteIds = toDelete.map(u => u._id);
    const deleteResult = await User.deleteMany({ _id: { $in: deleteIds } });

    console.log(`\n✅ Deleted ${deleteResult.deletedCount} duplicate quality agents`);

    // Verify final count
    const finalCount = await User.countDocuments({
      userType: 'quality_agent',
      companyCode: 'TEST001',
      memberId: { $in: productionMemberIds }
    });

    console.log(`\n✅ Final count: ${finalCount} quality agents (should be 19)`);

    // Also check survey assignments
    const survey = await Survey.findById('68fd1915d41841da463f0d46');
    if (survey && survey.assignedQualityAgents) {
      const validAgentIds = toKeep.map(u => u._id.toString());
      const originalCount = survey.assignedQualityAgents.length;
      
      // Remove assignments for deleted users
      survey.assignedQualityAgents = survey.assignedQualityAgents.filter(
        assignment => validAgentIds.includes(assignment.qualityAgent.toString())
      );
      
      await survey.save();
      console.log(`\n✅ Cleaned survey assignments: ${originalCount} -> ${survey.assignedQualityAgents.length}`);
    }

    console.log('\n✅ Cleanup completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

cleanupDuplicateQualityAgents();



