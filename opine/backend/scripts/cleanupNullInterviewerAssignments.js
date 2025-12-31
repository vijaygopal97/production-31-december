/**
 * Script to remove null interviewer assignments from survey
 * This fixes the error: Cannot read properties of null (reading '_id')
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';

const cleanupNullAssignments = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }

    console.log('📋 Checking survey assignments...\n');

    // Clean up catiInterviewers
    if (survey.catiInterviewers && survey.catiInterviewers.length > 0) {
      const interviewerIds = survey.catiInterviewers
        .map(a => a.interviewer?.toString())
        .filter(Boolean);
      
      const existingUsers = await User.find({ _id: { $in: interviewerIds } })
        .select('_id')
        .lean();
      
      const existingIds = new Set(existingUsers.map(u => u._id.toString()));
      
      const beforeCount = survey.catiInterviewers.length;
      survey.catiInterviewers = survey.catiInterviewers.filter(
        assignment => {
          if (!assignment.interviewer) return false;
          return existingIds.has(assignment.interviewer.toString());
        }
      );
      
      const removedCount = beforeCount - survey.catiInterviewers.length;
      console.log(`✅ Cleaned ${removedCount} null CATI interviewer assignments`);
      console.log(`   Before: ${beforeCount}, After: ${survey.catiInterviewers.length}\n`);
    }

    // Clean up capiInterviewers
    if (survey.capiInterviewers && survey.capiInterviewers.length > 0) {
      const interviewerIds = survey.capiInterviewers
        .map(a => a.interviewer?.toString())
        .filter(Boolean);
      
      const existingUsers = await User.find({ _id: { $in: interviewerIds } })
        .select('_id')
        .lean();
      
      const existingIds = new Set(existingUsers.map(u => u._id.toString()));
      
      const beforeCount = survey.capiInterviewers.length;
      survey.capiInterviewers = survey.capiInterviewers.filter(
        assignment => {
          if (!assignment.interviewer) return false;
          return existingIds.has(assignment.interviewer.toString());
        }
      );
      
      const removedCount = beforeCount - survey.capiInterviewers.length;
      console.log(`✅ Cleaned ${removedCount} null CAPI interviewer assignments`);
      console.log(`   Before: ${beforeCount}, After: ${survey.capiInterviewers.length}\n`);
    }

    // Clean up assignedInterviewers
    if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
      const interviewerIds = survey.assignedInterviewers
        .map(a => a.interviewer?.toString())
        .filter(Boolean);
      
      const existingUsers = await User.find({ _id: { $in: interviewerIds } })
        .select('_id')
        .lean();
      
      const existingIds = new Set(existingUsers.map(u => u._id.toString()));
      
      const beforeCount = survey.assignedInterviewers.length;
      survey.assignedInterviewers = survey.assignedInterviewers.filter(
        assignment => {
          if (!assignment.interviewer) return false;
          return existingIds.has(assignment.interviewer.toString());
        }
      );
      
      const removedCount = beforeCount - survey.assignedInterviewers.length;
      console.log(`✅ Cleaned ${removedCount} null assigned interviewer assignments`);
      console.log(`   Before: ${beforeCount}, After: ${survey.assignedInterviewers.length}\n`);
    }

    await survey.save();
    console.log('✅ Survey updated successfully\n');

    await mongoose.disconnect();
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
  cleanupNullAssignments();
}

module.exports = { cleanupNullAssignments };

