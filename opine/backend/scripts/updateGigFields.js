require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function
const updateGigFields = async () => {
  try {
    console.log('🚀 Starting gig fields migration...');
    
    // Step 1: Add gig_availability field to all users who don't have it (default: false)
    console.log('📝 Step 1: Adding gig_availability field to users who don\'t have it...');
    const usersWithoutGigAvailability = await User.updateMany(
      { gig_availability: { $exists: false } },
      { $set: { gig_availability: false } }
    );
    console.log(`✅ Updated ${usersWithoutGigAvailability.modifiedCount} users with gig_availability field`);

    // Step 2: Add gig_enabled field to all users who don't have it (default: false)
    console.log('📝 Step 2: Adding gig_enabled field to users who don\'t have it...');
    const usersWithoutGigEnabled = await User.updateMany(
      { gig_enabled: { $exists: false } },
      { $set: { gig_enabled: false } }
    );
    console.log(`✅ Updated ${usersWithoutGigEnabled.modifiedCount} users with gig_enabled field`);

    // Step 3: Set gig_enabled = true for existing Interviewer, Quality Agent, and Data Analyst users
    console.log('📝 Step 3: Setting gig_enabled = true for Interviewer, Quality Agent, and Data Analyst users...');
    const gigEnabledUsers = await User.updateMany(
      { 
        userType: { $in: ['interviewer', 'quality_agent', 'Data_Analyst'] },
        gig_enabled: { $ne: true }
      },
      { $set: { gig_enabled: true } }
    );
    console.log(`✅ Updated ${gigEnabledUsers.modifiedCount} users with gig_enabled = true`);

    // Step 4: Get summary of current state
    console.log('📊 Step 4: Getting summary of current state...');
    
    const totalUsers = await User.countDocuments();
    const interviewerUsers = await User.countDocuments({ userType: 'interviewer' });
    const qualityAgentUsers = await User.countDocuments({ userType: 'quality_agent' });
    const dataAnalystUsers = await User.countDocuments({ userType: 'Data_Analyst' });
    
    const gigEnabledCount = await User.countDocuments({ gig_enabled: true });
    const gigAvailableCount = await User.countDocuments({ gig_availability: true });
    
    const gigEnabledInterviewers = await User.countDocuments({ 
      userType: 'interviewer', 
      gig_enabled: true 
    });
    const gigEnabledQualityAgents = await User.countDocuments({ 
      userType: 'quality_agent', 
      gig_enabled: true 
    });
    const gigEnabledDataAnalysts = await User.countDocuments({ 
      userType: 'Data_Analyst', 
      gig_enabled: true 
    });

    console.log('\n📈 Migration Summary:');
    console.log('==================');
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Interviewers: ${interviewerUsers}`);
    console.log(`Quality Agents: ${qualityAgentUsers}`);
    console.log(`Data Analysts: ${dataAnalystUsers}`);
    console.log(`Users with gig_enabled = true: ${gigEnabledCount}`);
    console.log(`Users with gig_availability = true: ${gigAvailableCount}`);
    console.log(`Interviewers with gig_enabled = true: ${gigEnabledInterviewers}`);
    console.log(`Quality Agents with gig_enabled = true: ${gigEnabledQualityAgents}`);
    console.log(`Data Analysts with gig_enabled = true: ${gigEnabledDataAnalysts}`);

    // Step 5: Show some examples of updated users
    console.log('\n👥 Sample of updated users:');
    console.log('==========================');
    const sampleUsers = await User.find({
      userType: { $in: ['interviewer', 'quality_agent', 'Data_Analyst'] }
    })
    .select('firstName lastName userType gig_enabled gig_availability')
    .limit(5);

    sampleUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.userType}): gig_enabled=${user.gig_enabled}, gig_availability=${user.gig_availability}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
};

// Main execution
const runMigration = async () => {
  try {
    await connectDB();
    await updateGigFields();
    console.log('\n✅ Migration script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
};

// Run the migration
runMigration();
