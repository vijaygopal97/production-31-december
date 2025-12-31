/**
 * Script to generate a report of all CAPI users with their passwords (phone numbers)
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// All CAPI interviewers from both batches
const allCAPIUsers = {
  // Batch 1: Krishna Das
  krishna: [
    { memberId: 'CAPI551', name: 'Sayan Sarkar', phone: '9064416003' },
    { memberId: 'CAPI552', name: 'Raju Dhar', phone: '8944905209' },
    { memberId: 'CAPI553', name: 'Biky shil', phone: '9932849403' },
    { memberId: 'CAPI554', name: 'Reshabh Lama', phone: '7477875450' },
    { memberId: 'CAPI555', name: 'Koushal Lama', phone: '7047009593' },
    { memberId: 'CAPI564', name: 'Rajesh Rava', phone: '8145782462' },
    { memberId: 'CAPI565', name: 'Mintu Roy', phone: '8436152306' },
    { memberId: 'CAPI566', name: 'Sravan Kumar Mitra', phone: '9091367929' },
    { memberId: 'CAPI570', name: 'Ajit Barman', phone: '8011775871' },
    { memberId: 'CAPI582', name: 'Ramen Das', phone: '8234567233' },
    { memberId: 'CAPI591', name: 'Tuli sarkar', phone: '9142672465' },
    { memberId: 'CAPI710', name: 'Nasim', phone: '9733137075' },
    { memberId: 'CAPI711', name: 'Nafiul hoque', phone: '9762158033' },
    { memberId: 'CAPI712', name: 'AMIN SARDAR', phone: '7076589256' },
    { memberId: 'CAPI713', name: 'MD Abu bakkar siddik', phone: '9833203150' },
    { memberId: 'CAPI715', name: 'Islam sekh', phone: '8436419878' },
    { memberId: 'CAPI716', name: 'md Arif', phone: '9733137825' },
    { memberId: 'CAPI810', name: 'BIKASH DAS', phone: '8346966981' },
    { memberId: 'CAPI817', name: 'CHITTARANJAN DAS', phone: '7063469532' },
    { memberId: 'CAPI819', name: 'PARIMAL CANDRA DAS', phone: '8509084487' },
    { memberId: 'CAPI831', name: 'AL EMRAN RAHAMAN', phone: '9832647265' },
    { memberId: 'CAPI833', name: 'SHARIK RAHAMAN', phone: '8327838541' },
    { memberId: 'CAPI837', name: 'RUMA DAS', phone: '8348669734' },
    { memberId: 'CAPI838', name: 'SUBHANKAR DAS', phone: '7047548229' },
    { memberId: 'CAPI839', name: 'ARIF SARKAR', phone: '7001753612' },
    { memberId: 'CAPI840', name: 'SOUFIK SARKAR', phone: '9641779449' },
    { memberId: 'CAPI841', name: 'RAJIP RAI', phone: '6296474559' },
    { memberId: 'CAPI845', name: 'SUBHADEEP DAS', phone: '8348779367' },
    { memberId: 'CAPI846', name: 'TANAY BARMAN', phone: '8537065422' },
    { memberId: 'CAPI849', name: 'ABHI DEY', phone: '8101729722' },
    { memberId: 'CAPI850', name: 'RANJIT KUMAR BARMAN', phone: '6296959447' },
    { memberId: 'CAPI877', name: 'ANGAD GURUNG', phone: '9735985272' },
    { memberId: 'CAPI880', name: 'YASH RAI', phone: '7501162832' },
    { memberId: 'CAPI882', name: 'NILESH LIMBA', phone: '7063479266' },
    { memberId: 'CAPI886', name: 'NASIB MIYA', phone: '9907670142' },
    { memberId: 'CAPI910', name: 'SAKHAWAT', phone: '9242255434' },
    { memberId: 'CAPI930', name: 'aihan sarfaraj', phone: '7384166077' },
    { memberId: 'CAPI931', name: 'Sobrati sk', phone: '7584073913' },
    { memberId: 'CAPI932', name: 'Bilas sekh', phone: '6295229456' },
    { memberId: 'CAPI933', name: 'Imran sk', phone: '9061248238' },
    { memberId: 'CAPI934', name: 'Belal sk', phone: '8597089366' },
    { memberId: 'CAPI935', name: 'Sipon sk', phone: '8597089366' },
    { memberId: 'CAPI936', name: 'Asikul sk', phone: '9641523621' },
    { memberId: 'CAPI937', name: 'Rijwanur rahaman', phone: '9932652312' },
    { memberId: 'CAPI938', name: 'Aktar reja', phone: '9800236321' },
    { memberId: 'CAPI939', name: 'Ejaj ahmed', phone: '9749852658' },
    { memberId: 'CAPI940', name: 'Md asad Ahmed', phone: '9775236521' },
    { memberId: 'CAPI941', name: 'MASIHUR RAHAMAN', phone: '7076599020' },
    { memberId: 'CAPI942', name: 'MD FAHIM', phone: '9733137825' },
    { memberId: 'CAPI943', name: 'MD SALIM HOQUE', phone: '9832511197' },
    { memberId: 'CAPI944', name: 'MD ARIF', phone: '7074788218' },
    { memberId: 'CAPI950', name: 'RAMJAN HOSSAIN', phone: '9647152646' },
    { memberId: 'CAPI951', name: 'Sabnam Firdosh', phone: '9733125286' },
    { memberId: 'CAPI952', name: 'Jamirul Hasan', phone: '7718324586' },
    { memberId: 'CAPI953', name: 'Aniqul Islam', phone: '9733099908' },
    { memberId: 'CAPI957', name: 'arjaul hoque', phone: '9641971554' },
    { memberId: 'CAPI958', name: 'ajimuddin', phone: '6296388120' },
    { memberId: 'CAPI959', name: 'masiur rahaman', phone: '9749916166' }
  ],
  // Batch 2: Dulal Roy
  dulal: [
    { memberId: 'CAPI401', name: 'Amar Chandara Das', phone: '9635701999' },
    { memberId: 'CAPI402', name: 'Nabin Bauri', phone: '8768483029' },
    { memberId: 'CAPI403', name: 'Purusattam Paramanik', phone: '9242262259' },
    { memberId: 'CAPI406', name: 'Subhas Kumar Singh', phone: '8670474384' },
    { memberId: 'CAPI408', name: 'Bipasha Lohar', phone: '6295419141' },
    { memberId: 'CAPI409', name: 'Pinku Pramanik', phone: '6295601613' },
    { memberId: 'CAPI410', name: 'Soumaya Deep Deshmuk', phone: '6297447682' },
    { memberId: 'CAPI411', name: 'Sikha Majhi', phone: '9093591391' },
    { memberId: 'CAPI412', name: 'Surajit Ghosh..', phone: '7602916502' },
    { memberId: 'CAPI413', name: 'Surajit Ghosh', phone: '8670921540' },
    { memberId: 'CAPI414', name: 'Badal Lohar', phone: '8999625167' },
    { memberId: 'CAPI415', name: 'Haradhan Lohar', phone: '9832759986' },
    { memberId: 'CAPI416', name: 'Jadunath Modak', phone: '9134452477' },
    { memberId: 'CAPI417', name: 'Sourav Dutta', phone: '8101106626' },
    { memberId: 'CAPI418', name: 'Tumpa Ghosh', phone: '9883855459' },
    { memberId: 'CAPI419', name: 'Suman Ghorui', phone: '8250077924' },
    { memberId: 'CAPI420', name: 'Tapas Bari', phone: '6296016482' },
    { memberId: 'CAPI431', name: 'SK MD YUNAS', phone: '7699532888' },
    { memberId: 'CAPI432', name: 'SHAIKH ZEENATH SAMIM', phone: '9547841271' },
    { memberId: 'CAPI433', name: 'Ganesh Bag', phone: '9775684547' },
    { memberId: 'CAPI434', name: 'Sk Md Imran', phone: '8509936275' },
    { memberId: 'CAPI435', name: 'Sk Rohit Islam', phone: '6296778138' },
    { memberId: 'CAPI437', name: 'Sahin Nazrul', phone: '9749874636' },
    { memberId: 'CAPI438', name: 'SHAIKH MAHAROOF HAQUE', phone: '7602977829' },
    { memberId: 'CAPI439', name: 'RANJANA DAS', phone: '6296256693' },
    { memberId: 'CAPI440', name: 'SK ROBIUL', phone: '9144352907' },
    { memberId: 'CAPI441', name: 'Shampa Das', phone: '7029005657' },
    { memberId: 'CAPI442', name: 'Shipra Das', phone: '6296374096' },
    { memberId: 'CAPI443', name: 'Chandana Low', phone: '8515834765' },
    { memberId: 'CAPI444', name: 'Tanu Das', phone: '9734829472' },
    { memberId: 'CAPI445', name: 'Anima Ghosh', phone: '6296451278' },
    { memberId: 'CAPI446', name: 'Ranjit Chakraborty', phone: '9775020871' },
    { memberId: 'CAPI447', name: 'Subhankar Dutta', phone: '9547492489' },
    { memberId: 'CAPI461', name: 'Moushoni Nayek', phone: '8100154173' },
    { memberId: 'CAPI462', name: 'Akash Jain', phone: '8961300575' },
    { memberId: 'CAPI470', name: 'Amalesh Patra', phone: '7001717698' },
    { memberId: 'CAPI471', name: 'Kunal Hambir', phone: '6290366196' },
    { memberId: 'CAPI472', name: 'Ananda Ghosh', phone: '7585924247' },
    { memberId: 'CAPI473', name: 'Ankita Ghosh', phone: '9083743861' },
    { memberId: 'CAPI474', name: 'Saibal Ghosh', phone: '7608966650' },
    { memberId: 'CAPI475', name: 'Biswajit Dolui', phone: '983293142' }, // Note: Only 9 digits - may need leading 0
    { memberId: 'CAPI477', name: 'Naresh Sarkar', phone: '9339474881' },
    { memberId: 'CAPI478', name: 'Joysankar Singh', phone: '7719343605' },
    { memberId: 'CAPI479', name: 'Md Raj', phone: '9800570986' },
    { memberId: 'CAPI480', name: 'Aloke Kayal', phone: '7029069094' },
    { memberId: 'CAPI481', name: 'Subhendu Adhakary', phone: '9735536566' },
    { memberId: 'CAPI482', name: 'Paramita Dhara', phone: '8972377982' },
    { memberId: 'CAPI483', name: 'Sujit Halder', phone: '9647159757' },
    { memberId: 'CAPI485', name: 'Sandip Ghosh', phone: '9609027935' },
    { memberId: 'CAPI487', name: 'Pritam Dolui', phone: '9883387247' },
    { memberId: 'CAPI488', name: 'Bumba Dangar', phone: '8945983325' },
    { memberId: 'CAPI498', name: 'SK SAHABUDDIN', phone: '8597544677' },
    { memberId: 'CAPI499', name: 'Jharna Mondal', phone: '9332646654' },
    { memberId: 'CAPI580', name: 'Rakesh Paul', phone: '9734222996' },
    { memberId: 'CAPI581', name: 'Manoj Panda', phone: '7602995165' },
    { memberId: 'CAPI582', name: 'Roni Mondal', phone: '7810880347' },
    { memberId: 'CAPI588', name: 'Subhajit Bhattacharya', phone: '8250426283' },
    { memberId: 'CAPI590', name: 'MD SOYEL', phone: '7364023228' },
    { memberId: 'CAPI1411', name: 'Debraj Maiti', phone: '9547657255' },
    { memberId: 'CAPI1412', name: 'Anita Maiti', phone: '8293199679' },
    { memberId: 'CAPI1413', name: 'Amit Kumar Hazra', phone: '8016162405' }
  ]
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  // Convert to string first to preserve leading zeros
  let phoneStr = String(phone).replace(/\s+/g, '');
  // Remove country code if present
  phoneStr = phoneStr.replace(/^\+91/, '').replace(/^91/, '');
  // Take last 10 digits (don't pad - use as is)
  if (phoneStr.length > 10) {
    phoneStr = phoneStr.slice(-10);
  }
  return phoneStr;
};

const main = async () => {
  console.log('📋 CAPI Interviewers - User Passwords Report\n');
  console.log('='.repeat(100));
  console.log('\nNOTE: Password for each user is their phone number (10 digits)\n');
  console.log('='.repeat(100));
  
  // Batch 1: Krishna Das
  console.log('\n📌 PROJECT MANAGER: krishna.das@convergent.com\n');
  console.log('| Member ID | Name | Email | Password (Phone) |');
  console.log('|-----------|------|-------|------------------|');
  
  allCAPIUsers.krishna.forEach(user => {
    const phone = normalizePhone(user.phone);
    const email = `${user.memberId.toLowerCase()}@gmail.com`;
    console.log(`| ${user.memberId} | ${user.name} | ${email} | ${phone} |`);
  });
  
  // Batch 2: Dulal Roy
  console.log('\n\n📌 PROJECT MANAGER: dulal.roy@convergent.com\n');
  console.log('| Member ID | Name | Email | Password (Phone) |');
  console.log('|-----------|------|-------|------------------|');
  
  allCAPIUsers.dulal.forEach(user => {
    const phone = normalizePhone(user.phone);
    if (phone) {
      const email = `${user.memberId.toLowerCase()}@gmail.com`;
      console.log(`| ${user.memberId} | ${user.name} | ${email} | ${phone} |`);
    } else {
      console.log(`| ${user.memberId} | ${user.name} | N/A | NO PHONE |`);
    }
  });
  
  console.log('\n' + '='.repeat(100));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total Users (Krishna Das): ${allCAPIUsers.krishna.length}`);
  console.log(`   Total Users (Dulal Roy): ${allCAPIUsers.dulal.filter(u => normalizePhone(u.phone)).length}`);
  console.log(`   Total Users: ${allCAPIUsers.krishna.length + allCAPIUsers.dulal.filter(u => normalizePhone(u.phone)).length}`);
  console.log('\n✅ All passwords are set to the user\'s phone number (10 digits)\n');
};

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});



