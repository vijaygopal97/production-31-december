/**
 * Script to find CATI users by phone number and add missing ones
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';

// Users to find/add
const usersToFind = [
  { name: 'KABINA KHATUN', phone: '8250049424' },
  { name: 'PRIYA SHANKAR', phone: '8370823975' },
  { name: 'PRANJAL SUTRADHAR', phone: '8509524647' },
  { name: 'ANTARA PRADHAN', phone: '7063239381' },
  { name: 'LAKSHYA THAPA', phone: '7719219779' },
  { name: 'ASHTHA SHAH', phone: '8250316305' },
  { name: 'PRIYANKA PATHAK', phone: '6295242103' },
  { name: 'HRITESH TAMANG', phone: '8944848649' },
  { name: 'HIRANMOY PANDIT', phone: '7384638012' },
  { name: 'SUBHA MALLIK', phone: '7407236511' },
  { name: 'Jahanara Khatoon', phone: '9382115873' },
  { name: 'ANIMESH ROY', phone: '8967215263' },
  { name: 'SAMIRAN DAS', phone: '8597638130' },
  { name: 'RAJAT ROY', phone: '9064376368' },
  { name: 'PRATIBHA SHA', phone: '9046720791' },
  { name: 'APARNA SARKAR', phone: '9332948136' },
  { name: 'KANIKA KERKETTA', phone: '9647732765' },
  { name: 'SUSMITA SAHA', phone: '8167029266' },
  { name: 'KAKALI MAJUMDER', phone: '9064006902' },
  { name: 'TITHI BISWAS', phone: '9775768489' },
  { name: 'PUJA KUNDU', phone: '7478824785' },
  { name: 'SUPANNA MURMU', phone: '9593889417' },
  { name: 'BRISTI HALDER', phone: '8293506338' },
  { name: 'NUPUR MONDAL', phone: '7679392167' },
  { name: 'PUJA DAS', phone: '7501264295' },
  { name: 'MIM PARVIN', phone: '6295623404' },
  { name: 'ANASBIN JAMAN', phone: '8391845069' }
];

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, '').replace(/^\+91/, '').replace(/^91/, '').slice(-10);
};

const getNextAvailableMemberIds = async (count) => {
  // Find all numeric member IDs (not just CATI)
  const allUsers = await User.find({
    memberId: { $regex: /^\d+$/ }
  }).select('memberId');
  
  const usedIds = new Set(allUsers.map(u => parseInt(u.memberId)).filter(id => !isNaN(id)));
  
  // Find next available IDs starting from 527
  const availableIds = [];
  let currentId = 527;
  
  while (availableIds.length < count) {
    if (!usedIds.has(currentId)) {
      availableIds.push(String(currentId));
    }
    currentId++;
    // Safety limit
    if (currentId > 10000) break;
  }
  
  return availableIds;
};

const assignToSurvey = async (interviewerId, assignedById) => {
  const survey = await Survey.findById(SURVEY_ID);
  if (!survey) {
    throw new Error(`Survey ${SURVEY_ID} not found`);
  }
  
  if (!survey.catiInterviewers) {
    survey.catiInterviewers = [];
  }
  
  const existingAssignment = survey.catiInterviewers.find(
    assignment => assignment.interviewer.toString() === interviewerId.toString()
  );
  
  if (!existingAssignment) {
    survey.catiInterviewers.push({
      interviewer: interviewerId,
      assignedBy: assignedById,
      assignedAt: new Date(),
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });
    await survey.save();
  }
};

const createCATIInterviewer = async (userData, referenceUser, assignedBy, memberId) => {
  const nameParts = userData.name.split(/\s+/).filter(p => p.trim());
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
  const phone = normalizePhone(userData.phone);
  const password = phone;
  const email = `cati${memberId}@gmail.com`;
  
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const newUser = new User({
    firstName: firstName,
    lastName: lastName,
    email: email.toLowerCase(),
    phone: phone,
    password: hashedPassword,
    isEmailVerified: false,
    isPhoneVerified: false,
    userType: 'interviewer',
    interviewModes: 'CATI (Telephonic interview)',
    canSelectMode: false,
    company: referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
    companyCode: COMPANY_CODE,
    memberId: memberId,
    status: 'active',
    isActive: true,
    interviewerProfile: {
      ...(referenceUser.interviewerProfile || {}),
      approvalStatus: 'approved',
      approvalFeedback: 'Approved for CATI',
      approvedBy: referenceUser.interviewerProfile?.approvedBy || assignedBy,
      approvedAt: new Date(),
      lastSubmittedAt: new Date()
    },
    loginAttempts: 0,
    assignedTeamMembers: []
  });
  
  await newUser.save({ runValidators: false });
  
  // Verify password
  const savedUser = await User.findById(newUser._id).select('+password');
  const passwordValid = await savedUser.comparePassword(password);
  if (!passwordValid) {
    const retrySalt = await bcrypt.genSalt(12);
    const retryHashedPassword = await bcrypt.hash(password, retrySalt);
    await User.updateOne({ _id: newUser._id }, { $set: { password: retryHashedPassword } });
  }
  
  // Assign to survey
  await assignToSurvey(newUser._id, assignedBy);
  
  return newUser;
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not set');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    console.log(`📋 Fetching reference user: ${REFERENCE_USER_ID}...`);
    const referenceUser = await User.findById(REFERENCE_USER_ID);
    if (!referenceUser) {
      throw new Error(`Reference user ${REFERENCE_USER_ID} not found`);
    }
    console.log(`✅ Found reference user: ${referenceUser.firstName} ${referenceUser.lastName}\n`);
    
    const companyAdmin = await User.findOne({
      userType: 'company_admin',
      companyCode: COMPANY_CODE,
      status: 'active'
    });
    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;
    
    console.log('🔍 Finding users by phone number...\n');
    console.log('='.repeat(80));
    
    const found = [];
    const notFound = [];
    
    // First pass: find existing users
    for (const userData of usersToFind) {
      const normalizedPhone = normalizePhone(userData.phone);
      const user = await User.findOne({ phone: normalizedPhone });
      
      if (user) {
        found.push({
          memberId: user.memberId || 'NO MEMBER ID',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          phone: user.phone || normalizedPhone
        });
        console.log(`✅ Found: ${user.memberId || 'NO ID'} - ${user.firstName} ${user.lastName} - ${user.phone}`);
      } else {
        notFound.push({
          name: userData.name,
          phone: normalizedPhone
        });
        console.log(`❌ Not Found: ${userData.name} - ${normalizedPhone}`);
      }
    }
    
    // Get available member IDs for missing users
    if (notFound.length > 0) {
      const availableIds = await getNextAvailableMemberIds(notFound.length);
      notFound.forEach((user, index) => {
        user.memberId = availableIds[index] || String(527 + index);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Found: ${found.length}`);
    console.log(`❌ Not Found: ${notFound.length}`);
    
    if (found.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ EXISTING USERS (Member ID - Name - Phone)');
      console.log('='.repeat(80));
      found.forEach(u => {
        console.log(`${u.memberId} - ${u.name} - ${u.phone}`);
      });
    }
    
    if (notFound.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ MISSING USERS (Will be created as CATI)');
      console.log('='.repeat(80));
      notFound.forEach(u => {
        console.log(`   ${u.name} - ${u.phone} (Will get Member ID: ${u.memberId})`);
      });
      
      console.log('\n🚀 Creating missing users...\n');
      console.log('='.repeat(80));
      
      const created = [];
      for (const userData of notFound) {
        try {
          const newUser = await createCATIInterviewer(
            { name: userData.name, phone: userData.phone },
            referenceUser,
            assignedBy,
            userData.memberId
          );
          
          created.push({
            memberId: userData.memberId,
            name: `${newUser.firstName} ${newUser.lastName}`.trim(),
            phone: newUser.phone,
            email: newUser.email
          });
          
          console.log(`✅ Created: ${userData.memberId} - ${userData.name} - ${userData.phone}`);
          console.log(`   Email: ${newUser.email}`);
          console.log(`   Password: ${newUser.phone}\n`);
        } catch (error) {
          console.error(`❌ Error creating ${userData.name}:`, error.message);
        }
      }
      
      console.log('='.repeat(80));
      console.log('📝 ALL USERS (Member ID - Name - Phone)');
      console.log('='.repeat(80));
      
      // Combine found and created
      const allUsers = [...found, ...created.map(c => ({
        memberId: c.memberId,
        name: c.name,
        phone: c.phone
      }))];
      
      // Sort by member ID
      allUsers.sort((a, b) => {
        const aNum = parseInt(a.memberId) || 0;
        const bNum = parseInt(b.memberId) || 0;
        return aNum - bNum;
      });
      
      allUsers.forEach(u => {
        console.log(`${u.memberId} - ${u.name} - ${u.phone}`);
      });
      
      console.log(`\n✅ Created ${created.length} new CATI interviewers`);
      console.log(`✅ All assigned to survey ${SURVEY_ID}\n`);
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('📝 ALL USERS (Member ID - Name - Phone)');
      console.log('='.repeat(80));
      
      found.sort((a, b) => {
        const aNum = parseInt(a.memberId) || 0;
        const bNum = parseInt(b.memberId) || 0;
        return aNum - bNum;
      });
      
      found.forEach(u => {
        console.log(`${u.memberId} - ${u.name} - ${u.phone}`);
      });
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

main();



