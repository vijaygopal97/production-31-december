/**
 * Script to fix password for vijay user
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const fixPassword = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'vijay@gmail.com';
    const newEmail = 'vijaytester1@gmail.com';
    const password = '9958011332';

    // Find user
    let user = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { phone: '9958011332' }
      ]
    }).select('+password');

    if (!user) {
      console.log('❌ User not found');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Current User Details:');
    console.log(`Email: ${user.email}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`Status: ${user.status}`);
    console.log(`Interview Mode: ${user.interviewModes}`);
    console.log(`Password exists: ${!!user.password}`);
    if (user.password) {
      console.log(`Password hash (first 30): ${user.password.substring(0, 30)}...`);
    }
    console.log('');

    // Test current password
    if (user.password) {
      const isValid = await user.comparePassword(password);
      console.log(`Current password test: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log(`New password hash generated: ${hashedPassword.substring(0, 30)}...\n`);

    // Update user
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email: newEmail.toLowerCase(),
          password: hashedPassword,
          interviewModes: 'CATI (Telephonic interview)',
          status: 'active',
          isActive: true
        }
      }
    );

    // Reload and verify
    user = await User.findById(user._id).select('+password');
    console.log('✅ User Updated:');
    console.log(`Email: ${user.email}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`Status: ${user.status}`);
    console.log(`Interview Mode: ${user.interviewModes}`);
    console.log('');

    // Test password
    const isValid = await user.comparePassword(password);
    console.log(`Password test after update: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

    // Also test direct bcrypt
    const directCompare = await bcrypt.compare(password, user.password);
    console.log(`Direct bcrypt test: ${directCompare ? '✅ VALID' : '❌ INVALID'}\n`);

    console.log('📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(`Phone: ${user.phone}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
};

fixPassword();











