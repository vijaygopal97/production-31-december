/**
 * Script to create 5 test project manager accounts
 * Based on existing project manager: 6930b86b2eb7303ea516f8b9
 * 
 * This script:
 * 1. Gets the existing project manager's assignedTeamMembers
 * 2. Creates 5 new project managers with same assignedTeamMembers
 * 3. Sets simple passwords and hashes them correctly
 * 4. Tests logins to verify passwords work
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Company = require('../models/Company');

// Reference project manager ID
const REFERENCE_PM_ID = '6930b86b2eb7303ea516f8b9';

// Test project managers to create
const testProjectManagers = [
  {
    firstName: 'Test',
    lastName: 'PM 1',
    email: 'testpm1@convergent.com',
    phone: '+919999999901',
    password: 'TestPM1@123'
  },
  {
    firstName: 'Test',
    lastName: 'PM 2',
    email: 'testpm2@convergent.com',
    phone: '+919999999902',
    password: 'TestPM2@123'
  },
  {
    firstName: 'Test',
    lastName: 'PM 3',
    email: 'testpm3@convergent.com',
    phone: '+919999999903',
    password: 'TestPM3@123'
  },
  {
    firstName: 'Test',
    lastName: 'PM 4',
    email: 'testpm4@convergent.com',
    phone: '+919999999904',
    password: 'TestPM4@123'
  },
  {
    firstName: 'Test',
    lastName: 'PM 5',
    email: 'testpm5@convergent.com',
    phone: '+919999999905',
    password: 'TestPM5@123'
  }
];

// Test login function
const testLogin = async (email, password) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const isValid = await user.comparePassword(password);
    return { 
      success: isValid, 
      user: isValid ? { 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType
      } : null,
      error: isValid ? null : 'Invalid password'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

async function createTestProjectManagers() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get reference project manager
    console.log(`\n🔍 Finding Reference Project Manager: ${REFERENCE_PM_ID}`);
    const referencePM = await User.findById(REFERENCE_PM_ID)
      .populate('assignedTeamMembers.user', 'firstName lastName email memberId userType')
      .populate('company', 'companyName companyCode');

    if (!referencePM) {
      throw new Error(`Reference Project Manager with ID ${REFERENCE_PM_ID} not found`);
    }

    if (referencePM.userType !== 'project_manager') {
      throw new Error(`User ${REFERENCE_PM_ID} is not a project manager. Current type: ${referencePM.userType}`);
    }

    console.log(`✅ Found Reference Project Manager: ${referencePM.firstName} ${referencePM.lastName}`);
    console.log(`   Company: ${referencePM.company?.companyName || 'N/A'} (${referencePM.company?.companyCode || 'N/A'})`);
    console.log(`   Assigned Team Members: ${referencePM.assignedTeamMembers?.length || 0}`);

    // Get assignedTeamMembers structure
    const assignedTeamMembers = referencePM.assignedTeamMembers || [];
    
    // Convert to plain objects for copying
    const assignedTeamMembersPlain = assignedTeamMembers.map(member => ({
      user: member.user?._id || member.user,
      userType: member.userType,
      assignedAt: member.assignedAt || new Date(),
      assignedBy: referencePM._id
    }));

    console.log(`\n📋 Copying ${assignedTeamMembersPlain.length} assigned team members to new project managers`);

    // Store created users and credentials
    const createdUsers = [];
    const credentials = [];

    // Create each test project manager
    for (let i = 0; i < testProjectManagers.length; i++) {
      const pmData = testProjectManagers[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Creating Project Manager ${i + 1}/5: ${pmData.firstName} ${pmData.lastName}`);
      console.log(`Email: ${pmData.email}`);

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [
          { email: pmData.email.toLowerCase() },
          { phone: pmData.phone }
        ]
      });

      if (existingUser) {
        console.log(`⚠️  User already exists. Updating...`);
        
        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(pmData.password, salt);

        // Update existing user
        await User.updateOne(
          { _id: existingUser._id },
          {
            firstName: pmData.firstName,
            lastName: pmData.lastName,
            password: hashedPassword,
            userType: 'project_manager',
            company: referencePM.company._id,
            companyCode: referencePM.companyCode,
            assignedTeamMembers: assignedTeamMembersPlain,
            status: 'active',
            isEmailVerified: true,
            isPhoneVerified: true
          }
        );

        const updatedUser = await User.findById(existingUser._id);
        console.log(`✅ Updated existing user: ${updatedUser._id}`);

        // Verify password
        const passwordValid = await updatedUser.comparePassword(pmData.password);
        if (!passwordValid) {
          console.log(`⚠️  Password verification failed, retrying...`);
          const retrySalt = await bcrypt.genSalt(12);
          const retryHashedPassword = await bcrypt.hash(pmData.password, retrySalt);
          await User.updateOne(
            { _id: existingUser._id },
            { $set: { password: retryHashedPassword } }
          );
        }

        createdUsers.push(updatedUser);
        credentials.push({
          email: pmData.email,
          password: pmData.password,
          userId: updatedUser._id.toString()
        });
      } else {
        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(pmData.password, salt);

        // Create new user
        const newUser = new User({
          firstName: pmData.firstName,
          lastName: pmData.lastName,
          email: pmData.email.toLowerCase(),
          phone: pmData.phone,
          password: hashedPassword,
          userType: 'project_manager',
          company: referencePM.company._id,
          companyCode: referencePM.companyCode,
          assignedTeamMembers: assignedTeamMembersPlain,
          status: 'active',
          isEmailVerified: true,
          isPhoneVerified: true
        });

        const savedUser = await newUser.save();
        console.log(`✅ Created new user: ${savedUser._id}`);

        // Verify password
        const passwordValid = await savedUser.comparePassword(pmData.password);
        if (!passwordValid) {
          console.log(`⚠️  Password verification failed, retrying...`);
          const retrySalt = await bcrypt.genSalt(12);
          const retryHashedPassword = await bcrypt.hash(pmData.password, retrySalt);
          await User.updateOne(
            { _id: savedUser._id },
            { $set: { password: retryHashedPassword } }
          );
        }

        createdUsers.push(savedUser);
        credentials.push({
          email: pmData.email,
          password: pmData.password,
          userId: savedUser._id.toString()
        });
      }
    }

    // Test logins
    console.log(`\n${'='.repeat(60)}`);
    console.log('🧪 Testing Logins...');
    console.log(`${'='.repeat(60)}`);

    const loginResults = [];
    for (const cred of credentials) {
      console.log(`\nTesting login for: ${cred.email}`);
      const loginTest = await testLogin(cred.email, cred.password);
      
      if (loginTest.success) {
        console.log(`✅ Login successful!`);
        console.log(`   User: ${loginTest.user.firstName} ${loginTest.user.lastName}`);
        console.log(`   Type: ${loginTest.user.userType}`);
      } else {
        console.log(`❌ Login failed: ${loginTest.error}`);
      }
      
      loginResults.push({
        email: cred.email,
        password: cred.password,
        success: loginTest.success,
        error: loginTest.error
      });
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Created/Updated: ${createdUsers.length}`);
    console.log(`Successful Logins: ${loginResults.filter(r => r.success).length}/${loginResults.length}`);

    // Display credentials
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 CREDENTIALS (Copy-Paste Ready)');
    console.log(`${'='.repeat(60)}`);
    console.log('\n');
    
    credentials.forEach((cred, index) => {
      const result = loginResults.find(r => r.email === cred.email);
      const status = result?.success ? '✅' : '❌';
      console.log(`${status} Project Manager ${index + 1}:`);
      console.log(`   Email: ${cred.email}`);
      console.log(`   Password: ${cred.password}`);
      console.log(`   User ID: ${cred.userId}`);
      console.log(`   Login Status: ${result?.success ? 'SUCCESS' : 'FAILED'}`);
      if (result?.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    });

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
  createTestProjectManagers()
    .then(() => {
      console.log('\n🎉 All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = createTestProjectManagers;
