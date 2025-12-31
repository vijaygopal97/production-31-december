/**
 * Script to remove +91 prefix from phone numbers in User objects
 * Changes phone numbers from "+919958011332" to "9958011332"
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const fixPhoneNumbers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all users with phone numbers starting with +91
    const users = await User.find({
      phone: { $regex: /^\+91/ }
    }).select('_id phone memberId email firstName lastName').lean();

    console.log(`📋 Found ${users.length} users with +91 prefix\n`);

    if (users.length === 0) {
      console.log(`✅ No users to fix\n`);
      await mongoose.disconnect();
      return { fixed: 0, total: 0 };
    }

    let fixed = 0;
    let errors = 0;

    console.log(`🔧 Fixing phone numbers...\n`);

    for (const user of users) {
      try {
        const oldPhone = user.phone;
        const newPhone = oldPhone.replace(/^\+91/, '');
        
        await User.updateOne(
          { _id: user._id },
          { $set: { phone: newPhone } }
        );
        
        fixed++;
        if (fixed % 50 === 0) {
          console.log(`   Fixed ${fixed}/${users.length} users...`);
        }
      } catch (error) {
        console.error(`   ❌ Error fixing user ${user._id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} phone numbers`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    await mongoose.disconnect();
    return { fixed, total: users.length };
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

if (require.main === module) {
  fixPhoneNumbers().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fixPhoneNumbers };

