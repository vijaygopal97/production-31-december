/**
 * Script to remove +91 prefix from phone numbers in User objects
 * Changes phone numbers from "+919958011332" to "9958011332"
 * 
 * Runs on both development and production databases
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const fixPhoneNumbers = async (mongoUri, environment) => {
  try {
    console.log(`\n🔌 Connecting to ${environment} MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to ${environment} MongoDB\n`);

    // Find all users with phone numbers starting with +91
    const usersWithPlus91 = await User.find({
      phone: { $regex: /^\+91/ }
    }).select('_id phone memberId email firstName lastName');

    console.log(`📋 Found ${usersWithPlus91.length} users with +91 prefix in ${environment}\n`);

    if (usersWithPlus91.length === 0) {
      console.log(`✅ No users to fix in ${environment}\n`);
      await mongoose.disconnect();
      return { fixed: 0, total: 0 };
    }

    let fixed = 0;
    let errors = 0;

    console.log(`🔧 Fixing phone numbers...\n`);

    for (const user of usersWithPlus91) {
      try {
        const oldPhone = user.phone;
        const newPhone = oldPhone.replace(/^\+91/, '');
        
        await User.updateOne(
          { _id: user._id },
          { $set: { phone: newPhone } }
        );
        
        fixed++;
        if (fixed % 50 === 0) {
          console.log(`   Fixed ${fixed}/${usersWithPlus91.length} users...`);
        }
      } catch (error) {
        console.error(`   ❌ Error fixing user ${user._id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} phone numbers in ${environment}`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    await mongoose.disconnect();
    return { fixed, total: usersWithPlus91.length };
  } catch (error) {
    console.error(`❌ Error in ${environment}:`, error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

const main = async () => {
  try {
    // Development
    const devUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    const devResult = await fixPhoneNumbers(devUri, 'Development');

    // Production
    console.log('\n' + '='.repeat(80));
    console.log('📡 PRODUCTION DATABASE');
    console.log('='.repeat(80));
    
    // You'll need to set PROD_MONGODB_URI or update this
    const prodUri = process.env.PROD_MONGODB_URI;
    if (prodUri) {
      const prodResult = await fixPhoneNumbers(prodUri, 'Production');
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 SUMMARY');
      console.log('='.repeat(80));
      console.log(`Development: Fixed ${devResult.fixed}/${devResult.total} users`);
      console.log(`Production: Fixed ${prodResult.fixed}/${prodResult.total} users`);
      console.log('='.repeat(80));
    } else {
      console.log('⚠️  PROD_MONGODB_URI not set, skipping production');
      console.log('\n📊 SUMMARY');
      console.log('='.repeat(80));
      console.log(`Development: Fixed ${devResult.fixed}/${devResult.total} users`);
      console.log('='.repeat(80));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { fixPhoneNumbers };

