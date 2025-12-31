const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkUser = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Search by email
    const userByEmail = await User.findOne({ email: 'vijaytester1@gmail.com' }).select('+password');
    console.log('Search by email "vijaytester1@gmail.com":', userByEmail ? 'FOUND' : 'NOT FOUND');
    
    // Search by phone
    const userByPhone = await User.findOne({ phone: '9958011332' }).select('+password');
    console.log('Search by phone "9958011332":', userByPhone ? 'FOUND' : 'NOT FOUND');
    
    // Search by ID
    const userById = await User.findById('68d31a816be4caf24b09a098').select('+password');
    console.log('Search by ID "68d31a816be4caf24b09a098":', userById ? 'FOUND' : 'NOT FOUND');
    
    if (userByEmail) {
      console.log('\n📋 User Details:');
      console.log(`Email: ${userByEmail.email}`);
      console.log(`Phone: ${userByEmail.phone}`);
      console.log(`Status: ${userByEmail.status}`);
      console.log(`Interview Mode: ${userByEmail.interviewModes}`);
      console.log(`Password exists: ${!!userByEmail.password}`);
      if (userByEmail.password) {
        console.log(`Password hash: ${userByEmail.password.substring(0, 30)}...`);
      }
    }
    
    if (userByPhone && userByPhone._id.toString() !== (userByEmail?._id?.toString() || '')) {
      console.log('\n📋 User by Phone Details:');
      console.log(`Email: ${userByPhone.email}`);
      console.log(`Phone: ${userByPhone.phone}`);
      console.log(`Status: ${userByPhone.status}`);
    }
    
    if (userById && userById._id.toString() !== (userByEmail?._id?.toString() || '')) {
      console.log('\n📋 User by ID Details:');
      console.log(`Email: ${userById.email}`);
      console.log(`Phone: ${userById.phone}`);
      console.log(`Status: ${userById.status}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
};

checkUser();











