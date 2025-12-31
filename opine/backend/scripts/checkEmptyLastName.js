const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const User = require('../models/User');

async function checkAndFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Verify user 103 is fixed
    const user103 = await User.findOne({ memberId: /^103$/i });
    console.log('✅ User 103 verification:');
    console.log('  - firstName:', user103.firstName);
    console.log('  - lastName:', user103.lastName);
    console.log('  - status:', user103.status);
    console.log('  - email:', user103.email);
    
    // Check for other users with empty lastName
    const usersWithEmptyLastName = await User.find({
      $or: [
        { lastName: { $exists: false } },
        { lastName: '' },
        { lastName: null }
      ]
    }).select('memberId firstName lastName email userType status').limit(20);
    
    console.log('\n📊 Other users with empty lastName:', usersWithEmptyLastName.length);
    if (usersWithEmptyLastName.length > 0) {
      console.log('⚠️  Found users with empty lastName:');
      usersWithEmptyLastName.forEach(u => {
        console.log(`  - memberId: ${u.memberId || 'N/A'}, firstName: ${u.firstName}, lastName: '${u.lastName || ''}', email: ${u.email}`);
      });
    } else {
      console.log('✅ No other users found with empty lastName');
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

if (require.main === module) {
  checkAndFix();
}

module.exports = { checkAndFix };



