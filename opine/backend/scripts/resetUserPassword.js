/**
 * Script to reset a user's password to their phone number
 * Finds user by memberId and resets password
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
require('../models/Company'); // Register Company model

// Member ID to reset
const MEMBER_ID = '230';

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
        memberId: user.memberId,
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

async function resetUserPassword() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by memberId
    console.log(`\n🔍 Finding user with memberId: ${MEMBER_ID}`);
    const user = await User.findOne({ memberId: MEMBER_ID })
      .select('+password');

    if (!user) {
      throw new Error(`User with memberId ${MEMBER_ID} not found`);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Member ID: ${user.memberId}`);
    console.log(`   User Type: ${user.userType}`);
    console.log(`   Company ID: ${user.company || 'N/A'}`);
    console.log(`   Company Code: ${user.companyCode || 'N/A'}`);

    // Get phone number without country code for password
    let phone = user.phone;
    phone = phone.replace(/^\+91/, '').replace(/^91/, '').replace(/[^0-9]/g, '');
    const password = phone; // Password is phone number without country code

    console.log(`\n🔐 Resetting password...`);
    console.log(`   Phone (cleaned): ${phone}`);
    console.log(`   New Password: ${password}`);

    // Hash password with bcrypt (same as project managers)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    console.log(`✅ Password updated`);

    // Verify password
    const updatedUser = await User.findById(user._id).select('+password');
    const passwordValid = await updatedUser.comparePassword(password);

    if (!passwordValid) {
      console.log(`⚠️  Password verification failed, retrying...`);
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(password, retrySalt);
      await User.updateOne(
        { _id: user._id },
        { $set: { password: retryHashedPassword } }
      );

      const retryUser = await User.findById(user._id).select('+password');
      const retryValid = await retryUser.comparePassword(password);

      if (!retryValid) {
        throw new Error(`Password verification failed after retry for memberId ${MEMBER_ID}`);
      }
      console.log(`✅ Password verified after retry`);
    } else {
      console.log(`✅ Password verified successfully`);
    }

    // Test login
    console.log(`\n🧪 Testing Login...`);
    const loginTest = await testLogin(user.email, password);

    if (loginTest.success) {
      console.log(`✅ Login successful!`);
      console.log(`   User: ${loginTest.user.firstName} ${loginTest.user.lastName}`);
      console.log(`   Email: ${loginTest.user.email}`);
      console.log(`   Type: ${loginTest.user.userType}`);
    } else {
      console.log(`❌ Login failed: ${loginTest.error}`);
      throw new Error(`Login test failed: ${loginTest.error}`);
    }

    // Display credentials
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 CREDENTIALS');
    console.log(`${'='.repeat(60)}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(`Member ID: ${user.memberId}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`Login Status: ${loginTest.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);

    console.log(`\n✅ Password reset completed successfully!`);

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
  resetUserPassword()
    .then(() => {
      console.log('\n🎉 All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = resetUserPassword;

