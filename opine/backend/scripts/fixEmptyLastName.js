const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const User = require('../models/User');

async function fixEmptyLastName() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find all users with empty lastName
    const usersWithEmptyLastName = await User.find({
      $or: [
        { lastName: { $exists: false } },
        { lastName: '' },
        { lastName: null }
      ]
    }).select('memberId firstName lastName email userType status');
    
    console.log(`📊 Found ${usersWithEmptyLastName.length} users with empty lastName\n`);
    
    if (usersWithEmptyLastName.length === 0) {
      console.log('✅ No users need fixing');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    let fixed = 0;
    let errors = 0;
    
    for (const user of usersWithEmptyLastName) {
      try {
        // Set lastName to 'User' if it's empty or missing
        user.lastName = 'User';
        await user.save();
        console.log(`✅ Fixed: memberId ${user.memberId || 'N/A'} - ${user.firstName} ${user.lastName}`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing user ${user.memberId || user._id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Fixed: ${fixed}`);
    console.log(`  - Errors: ${errors}`);
    console.log(`  - Total: ${usersWithEmptyLastName.length}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Fix complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

if (require.main === module) {
  fixEmptyLastName();
}

module.exports = { fixEmptyLastName };



