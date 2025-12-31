/**
 * Script to get actual passwords from database for all CAPI users
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const allMemberIds = [
  // Krishna Das batch
  'CAPI551', 'CAPI552', 'CAPI553', 'CAPI554', 'CAPI555', 'CAPI564', 'CAPI565', 'CAPI566', 'CAPI570',
  'CAPI582', 'CAPI591', 'CAPI710', 'CAPI711', 'CAPI712', 'CAPI713', 'CAPI715', 'CAPI716', 'CAPI810',
  'CAPI817', 'CAPI819', 'CAPI831', 'CAPI833', 'CAPI837', 'CAPI838', 'CAPI839', 'CAPI840', 'CAPI841',
  'CAPI845', 'CAPI846', 'CAPI849', 'CAPI850', 'CAPI877', 'CAPI880', 'CAPI882', 'CAPI886', 'CAPI910',
  'CAPI930', 'CAPI931', 'CAPI932', 'CAPI933', 'CAPI934', 'CAPI935', 'CAPI936', 'CAPI937', 'CAPI938',
  'CAPI939', 'CAPI940', 'CAPI941', 'CAPI942', 'CAPI943', 'CAPI944', 'CAPI950', 'CAPI951', 'CAPI952',
  'CAPI953', 'CAPI957', 'CAPI958', 'CAPI959',
  // Dulal Roy batch
  'CAPI401', 'CAPI402', 'CAPI403', 'CAPI406', 'CAPI408', 'CAPI409', 'CAPI410', 'CAPI411', 'CAPI412',
  'CAPI413', 'CAPI414', 'CAPI415', 'CAPI416', 'CAPI417', 'CAPI418', 'CAPI419', 'CAPI420', 'CAPI431',
  'CAPI432', 'CAPI433', 'CAPI434', 'CAPI435', 'CAPI437', 'CAPI438', 'CAPI439', 'CAPI440', 'CAPI441',
  'CAPI442', 'CAPI443', 'CAPI444', 'CAPI445', 'CAPI446', 'CAPI447', 'CAPI461', 'CAPI462', 'CAPI470',
  'CAPI471', 'CAPI472', 'CAPI473', 'CAPI474', 'CAPI475', 'CAPI477', 'CAPI478', 'CAPI479', 'CAPI480',
  'CAPI481', 'CAPI482', 'CAPI483', 'CAPI485', 'CAPI487', 'CAPI488', 'CAPI498', 'CAPI499', 'CAPI580',
  'CAPI581', 'CAPI582', 'CAPI588', 'CAPI590', 'CAPI1411', 'CAPI1412', 'CAPI1413'
];

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('📋 CAPI Interviewers - Actual Database Passwords\n');
    console.log('='.repeat(100));
    console.log('\nNOTE: Password = Phone number stored in database\n');
    console.log('='.repeat(100));
    
    const users = await User.find({ memberId: { $in: allMemberIds } })
      .select('memberId firstName lastName email phone')
      .sort({ memberId: 1 });
    
    // Separate by PM
    const krishnaIds = ['CAPI551', 'CAPI552', 'CAPI553', 'CAPI554', 'CAPI555', 'CAPI564', 'CAPI565', 'CAPI566', 'CAPI570',
      'CAPI582', 'CAPI591', 'CAPI710', 'CAPI711', 'CAPI712', 'CAPI713', 'CAPI715', 'CAPI716', 'CAPI810',
      'CAPI817', 'CAPI819', 'CAPI831', 'CAPI833', 'CAPI837', 'CAPI838', 'CAPI839', 'CAPI840', 'CAPI841',
      'CAPI845', 'CAPI846', 'CAPI849', 'CAPI850', 'CAPI877', 'CAPI880', 'CAPI882', 'CAPI886', 'CAPI910',
      'CAPI930', 'CAPI931', 'CAPI932', 'CAPI933', 'CAPI934', 'CAPI935', 'CAPI936', 'CAPI937', 'CAPI938',
      'CAPI939', 'CAPI940', 'CAPI941', 'CAPI942', 'CAPI943', 'CAPI944', 'CAPI950', 'CAPI951', 'CAPI952',
      'CAPI953', 'CAPI957', 'CAPI958', 'CAPI959'];
    
    const krishnaUsers = users.filter(u => krishnaIds.includes(u.memberId));
    const dulalUsers = users.filter(u => !krishnaIds.includes(u.memberId));
    
    console.log('\n📌 PROJECT MANAGER: krishna.das@convergent.com\n');
    console.log('| Member ID | Name | Email | Password (Phone from DB) |');
    console.log('|-----------|------|-------|--------------------------|');
    
    krishnaUsers.forEach(user => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const phone = user.phone || 'NO PHONE';
      console.log(`| ${user.memberId} | ${name} | ${user.email || 'N/A'} | ${phone} |`);
    });
    
    console.log('\n\n📌 PROJECT MANAGER: dulal.roy@convergent.com\n');
    console.log('| Member ID | Name | Email | Password (Phone from DB) |');
    console.log('|-----------|------|-------|--------------------------|');
    
    dulalUsers.forEach(user => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const phone = user.phone || 'NO PHONE';
      console.log(`| ${user.memberId} | ${name} | ${user.email || 'N/A'} | ${phone} |`);
    });
    
    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Users Found: ${users.length}`);
    console.log(`   Krishna Das: ${krishnaUsers.length}`);
    console.log(`   Dulal Roy: ${dulalUsers.length}`);
    console.log('\n✅ Passwords are the phone numbers stored in the database\n');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main();



