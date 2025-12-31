/**
 * Script to test login for vijaytester1@gmail.com
 * This will help us debug the password issue
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const testLogin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'vijaytester1@gmail.com';
    const password = '9958011332';

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 User Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${user.email}`);
    console.log(`User ID: ${user._id}`);
    console.log(`Status: ${user.status}`);
    console.log(`Interview Mode: ${user.interviewModes}`);
    console.log(`Password field exists: ${!!user.password}`);
    console.log(`Password length: ${user.password ? user.password.length : 0}`);
    console.log(`Password starts with $2: ${user.password ? user.password.startsWith('$2') : false}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test password comparison
    console.log('🔐 Testing Password:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Plain password: ${password}`);
    
    if (user.password) {
      const isValid = await user.comparePassword(password);
      console.log(`Password comparison result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // Also test direct bcrypt compare
      const directCompare = await bcrypt.compare(password, user.password);
      console.log(`Direct bcrypt.compare result: ${directCompare ? '✅ VALID' : '❌ INVALID'}`);
      
      // Show first 50 chars of hash for debugging
      console.log(`Stored hash (first 50 chars): ${user.password.substring(0, 50)}...`);
    } else {
      console.log('❌ No password stored in database');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test creating a new hash and comparing
    console.log('🔧 Testing Hash Generation:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(password, salt);
    console.log(`New hash generated: ${newHash.substring(0, 50)}...`);
    const newHashCompare = await bcrypt.compare(password, newHash);
    console.log(`New hash comparison: ${newHashCompare ? '✅ VALID' : '❌ INVALID'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
};

testLogin();











