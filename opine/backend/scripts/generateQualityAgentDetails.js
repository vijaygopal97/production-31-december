const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

// Function to generate password from name
function generatePassword(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Password123';
  
  const firstName = parts[0].toLowerCase();
  const restOfName = parts.slice(1).join('').toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1) + restOfName;
}

async function generateUserDetails() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({ 
      userType: 'quality_agent', 
      companyCode: 'TEST001',
      memberId: { $gte: '1000', $lte: '1999' }
    }).sort({ memberId: 1 }).lean();

    console.log('\n📋 Quality Agent User Details:\n');
    console.log('='.repeat(100));
    
    users.forEach((user, index) => {
      const fullName = `${user.firstName} ${user.lastName}`;
      const password = generatePassword(fullName);
      
      console.log(`\n${index + 1}. ${fullName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Member ID: ${user.memberId}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   CAPI ID: ${user['QA-capi-ID'] || 'N/A'}`);
      console.log(`   CATI ID: ${user['QA-cati-ID'] || 'N/A'}`);
      console.log('-'.repeat(100));
    });

    console.log(`\n✅ Total: ${users.length} quality agents\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateUserDetails();



