/**
 * Find Project Managers in Production by email
 */

const mongoose = require('mongoose');
const User = require('../models/User');

const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

const pmEmails = [
  'abdur.rakib@convergent.com',
  'bikash.sarkar@convergent.com',
  'krishna.das@convergent.com',
  'dulal.roy@convergent.com',
  'sibsankar.giri@convergent.com'
];

const main = async () => {
  try {
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    await mongoose.connect(PROD_MONGO_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    console.log('🔍 Searching for Project Managers...\n');
    
    for (const email of pmEmails) {
      const pm = await User.findOne({ email: email.toLowerCase(), userType: 'project_manager' });
      if (pm) {
        console.log(`✅ Found: ${pm.firstName} ${pm.lastName}`);
        console.log(`   Email: ${pm.email}`);
        console.log(`   User ID: ${pm._id}`);
        console.log(`   Member ID: ${pm.memberId || 'N/A'}\n`);
      } else {
        console.log(`❌ Not found: ${email}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

main();



