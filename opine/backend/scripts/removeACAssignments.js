/**
 * Script to remove AC assignments from CAPI users in survey
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SURVEY_ID = '68fd1915d41841da463f0d46';

// Users to process
const usersToProcess = [
  { memberId: '401', name: 'Amar Chandara Das', phone: '9635701999' },
  { memberId: '402', name: 'Nabin Bauri', phone: '8768483029' },
  { memberId: '403', name: 'Purusattam Paramanik', phone: '9242262259' },
  { memberId: '406', name: 'Subhas Kumar Singh', phone: '8670474384' },
  { memberId: '408', name: 'Bipasha Lohar', phone: '6295419141' },
  { memberId: '409', name: 'Pinku Pramanik', phone: '6295601613' },
  { memberId: '410', name: 'Soumaya Deep Deshmuk', phone: '6297447682' },
  { memberId: '411', name: 'Sikha Majhi', phone: '9093591391' },
  { memberId: '412', name: 'Surajit Ghosh..', phone: '7602916502' },
  { memberId: '413', name: 'Surajit Ghosh', phone: '8670921540' },
  { memberId: '414', name: 'Badal Lohar', phone: '8999625167' },
  { memberId: '415', name: 'Haradhan Lohar', phone: '9832759986' },
  { memberId: '416', name: 'Jadunath Modak', phone: '9134452477' },
  { memberId: '417', name: 'Sourav Dutta', phone: '8101106626' },
  { memberId: '418', name: 'Tumpa Ghosh', phone: '9883855459' },
  { memberId: '419', name: 'Suman Ghorui', phone: '8250077924' },
  { memberId: '420', name: 'Tapas Bari', phone: '6296016482' },
  { memberId: '431', name: 'SK MD YUNAS', phone: '7699532888' },
  { memberId: '432', name: 'SHAIKH ZEENATH SAMIM', phone: '9547841271' },
  { memberId: '433', name: 'Ganesh Bag', phone: '9775684547' },
  { memberId: '434', name: 'Sk Md Imran', phone: '8509936275' },
  { memberId: '435', name: 'Sk Rohit Islam', phone: '6296778138' },
  { memberId: '437', name: 'Sahin Nazrul', phone: '9749874636' },
  { memberId: '438', name: 'SHAIKH MAHAROOF HAQUE', phone: '7602977829' },
  { memberId: '439', name: 'Sayan Mandal', phone: '8906322973' },
  { memberId: '439', name: 'RANJANA DAS', phone: '6296256693' },
  { memberId: '440', name: 'SK ROBIUL', phone: '9144352907' },
  { memberId: '441', name: 'Shampa Das', phone: '7029005657' },
  { memberId: '442', name: 'Shipra Das', phone: '6296374096' },
  { memberId: '443', name: 'Chandana Low', phone: '8515834765' },
  { memberId: '444', name: 'Tanu Das', phone: '9734829472' },
  { memberId: '445', name: 'Anima Ghosh', phone: '6296451278' },
  { memberId: '446', name: 'Ranjit Chakraborty', phone: '9775020871' },
  { memberId: '447', name: 'Subhankar Dutta', phone: '9547492489' },
  { memberId: '461', name: 'Moushoni Nayek', phone: '8100154173' },
  { memberId: '462', name: 'Akash Jain', phone: '8961300575' },
  { memberId: '470', name: 'Amalesh Patra', phone: '7001717698' },
  { memberId: '471', name: 'Kunal Hambir', phone: '6290366196' },
  { memberId: '472', name: 'Ananda Ghosh', phone: '7585924247' },
  { memberId: '473', name: 'Ankita Ghosh', phone: '9083743861' },
  { memberId: '474', name: 'Saibal Ghosh', phone: '7608966650' },
  { memberId: '475', name: 'Biswajit Dolui', phone: '983293142' },
  { memberId: '477', name: 'Naresh Sarkar', phone: '9339474881' },
  { memberId: '478', name: 'Joysankar Singh', phone: '7719343605' },
  { memberId: '479', name: 'Md Raj', phone: '9800570986' },
  { memberId: '480', name: 'Aloke Kayal', phone: '7029069094' },
  { memberId: '481', name: 'Subhendu Adhakary', phone: '9735536566' },
  { memberId: '482', name: 'Paramita Dhara', phone: '8972377982' },
  { memberId: '483', name: 'Sujit Halder', phone: '9647159757' },
  { memberId: '485', name: 'Sandip Ghosh', phone: '9609027935' },
  { memberId: '487', name: 'Pritam Dolui', phone: '9883387247' },
  { memberId: '488', name: 'Bumba Dangar', phone: '8945983325' },
  { memberId: '498', name: 'SK SAHABUDDIN', phone: '8597544677' },
  { memberId: '499', name: 'Jharna Mondal', phone: '9332646654' },
  { memberId: '580', name: 'Rakesh Paul', phone: '9734222996' },
  { memberId: '581', name: 'Manoj Panda', phone: '7602995165' },
  { memberId: '582', name: 'Roni Mondal', phone: '7810880347' },
  { memberId: '583', name: 'Sonali Debnath', phone: '' },
  { memberId: '588', name: 'Subhajit Bhattacharya', phone: '8250426283' },
  { memberId: '590', name: 'MD SOYEL', phone: '7364023228' },
  { memberId: '1411', name: 'Debraj Maiti', phone: '9547657255' },
  { memberId: '1412', name: 'Anita Maiti', phone: '8293199679' },
  { memberId: '1413', name: 'Amit Kumar Hazra', phone: '8016162405' }
];

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, '').replace(/^\+91/, '').replace(/^91/, '').slice(-10);
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not set');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('📋 Loading survey...');
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName}\n`);
    
    console.log('🔍 Finding users and removing AC assignments...\n');
    console.log('='.repeat(80));
    
    const found = [];
    const notFound = [];
    const updated = [];
    
    for (const userData of usersToProcess) {
      let user = null;
      
      // Try to find by member ID first
      if (userData.memberId) {
        user = await User.findOne({ memberId: userData.memberId });
      }
      
      // If not found by member ID, try by phone
      if (!user && userData.phone) {
        const normalizedPhone = normalizePhone(userData.phone);
        user = await User.findOne({ phone: normalizedPhone });
      }
      
      if (user) {
        found.push({
          memberId: user.memberId,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          phone: user.phone || 'NO PHONE',
          userId: user._id.toString()
        });
        
        // Find assignment in survey
        const assignment = survey.capiInterviewers?.find(
          a => a.interviewer.toString() === user._id.toString()
        );
        
        if (assignment) {
          const hadACs = assignment.assignedACs && assignment.assignedACs.length > 0;
          const acsRemoved = hadACs ? assignment.assignedACs : [];
          
          // Remove AC assignments
          assignment.assignedACs = [];
          
          updated.push({
            memberId: user.memberId,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            phone: user.phone || 'NO PHONE',
            hadACs: hadACs,
            acsRemoved: acsRemoved
          });
          
          console.log(`✅ ${user.memberId} - ${user.firstName} ${user.lastName} - ${user.phone || 'NO PHONE'}`);
          if (hadACs) {
            console.log(`   🗑️  Removed ACs: ${acsRemoved.join(', ')}`);
          } else {
            console.log(`   ℹ️  No ACs assigned (already clean)`);
          }
        } else {
          console.log(`⚠️  ${user.memberId} - ${user.firstName} ${user.lastName} - ${user.phone || 'NO PHONE'}`);
          console.log(`   ⚠️  User found but not assigned to survey`);
        }
      } else {
        notFound.push({
          memberId: userData.memberId,
          name: userData.name,
          phone: userData.phone || 'NO PHONE'
        });
        console.log(`❌ NOT FOUND: ${userData.memberId} - ${userData.name} - ${userData.phone || 'NO PHONE'}`);
      }
    }
    
    // Save survey with updated assignments
    if (updated.length > 0) {
      console.log('\n💾 Saving survey updates...');
      await survey.save();
      console.log('✅ Survey saved successfully\n');
    }
    
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Found: ${found.length}`);
    console.log(`❌ Not Found: ${notFound.length}`);
    console.log(`🔄 Updated (ACs removed): ${updated.length}`);
    
    if (notFound.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ USERS NOT FOUND IN DATABASE');
      console.log('='.repeat(80));
      notFound.forEach(u => {
        console.log(`${u.memberId} - ${u.name} - ${u.phone}`);
      });
    }
    
    if (updated.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🔄 USERS WITH ACs REMOVED');
      console.log('='.repeat(80));
      updated.forEach(u => {
        if (u.hadACs) {
          console.log(`${u.memberId} - ${u.name} - ${u.phone}`);
          console.log(`   Removed ACs: ${u.acsRemoved.join(', ')}`);
        }
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

main();



