/**
 * Check which member IDs exist in production database
 */

const mongoose = require('mongoose');
const User = require('../models/User');

const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

const memberIDsToCheck = [
  'CAPI401',
  'CAPI402',
  'CAPI403',
  'CAPI406',
  'CAPI408',
  'CAPI409',
  'CAPI410',
  'CAPI411',
  'CAPI412',
  'CAPI413',
  'CAPI414',
  'CAPI415',
  'CAPI416',
  'CAPI417',
  'CAPI418',
  'CAPI419',
  'CAPI420',
  'CAPI431',
  'CAPI432',
  'CAPI433',
  'CAPI434',
  'CAPI435',
  'CAPI437',
  'CAPI438',
  'CAPI439',
  'CAPI440',
  'CAPI441',
  'CAPI442',
  'CAPI443',
  'CAPI444',
  'CAPI445',
  'CAPI446',
  'CAPI447',
  'CAPI461',
  'CAPI462',
  'CAPI470',
  'CAPI471',
  'CAPI472',
  'CAPI473',
  'CAPI474',
  'CAPI475',
  'CAPI477',
  'CAPI478',
  'CAPI479',
  'CAPI480',
  'CAPI481',
  'CAPI482',
  'CAPI483',
  'CAPI485',
  'CAPI487',
  'CAPI488',
  'CAPI498',
  'CAPI499',
  'CAPI580',
  'CAPI581',
  'CAPI582',
  'CAPI583',
  'CAPI588',
  'CAPI590',
  'CAPI1411',
  'CAPI1412',
  'CAPI1413'
];

const main = async () => {
  try {
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    await mongoose.connect(PROD_MONGO_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    console.log(`🔍 Checking ${memberIDsToCheck.length} member IDs...\n`);
    
    const existing = [];
    const missing = [];
    
    for (const memberId of memberIDsToCheck) {
      // Use case-insensitive regex to match member IDs
      const user = await User.findOne({ 
        memberId: { $regex: new RegExp(`^${memberId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      
      if (user) {
        existing.push({
          memberId: memberId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          userType: user.userType
        });
        console.log(`✅ ${memberId} - EXISTS (${user.firstName} ${user.lastName})`);
      } else {
        missing.push(memberId);
        console.log(`❌ ${memberId} - NOT FOUND`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Existing: ${existing.length}`);
    console.log(`❌ Missing: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log('\n❌ MEMBER IDs THAT DO NOT EXIST:');
      console.log('='.repeat(80));
      missing.forEach(id => console.log(`   - ${id}`));
    }
    
    if (existing.length > 0) {
      console.log('\n✅ MEMBER IDs THAT EXIST:');
      console.log('='.repeat(80));
      existing.forEach(item => {
        console.log(`   - ${item.memberId}: ${item.name} (${item.email}) - ${item.userType}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

main();



