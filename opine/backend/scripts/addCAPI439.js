/**
 * Script to add CAPI interviewer 439 (RANJANA DAS) and assign to survey without AC
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';

const userData = {
  memberId: '439',
  name: 'RANJANA DAS',
  phone: '6296256693'
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, '').replace(/^\+91/, '').replace(/^91/, '').slice(-10);
};

const assignToSurvey = async (interviewerId, assignedById) => {
  try {
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    
    // Check if already assigned
    const existingAssignment = survey.capiInterviewers?.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      // Remove AC assignments if any
      existingAssignment.assignedACs = [];
      existingAssignment.assignedBy = assignedById;
      existingAssignment.assignedAt = new Date();
      existingAssignment.status = 'assigned';
      await survey.save();
      console.log(`✅ User already assigned to survey, AC assignments removed`);
      return;
    }
    
    if (!survey.capiInterviewers) {
      survey.capiInterviewers = [];
    }
    
    // Assign without AC
    survey.capiInterviewers.push({
      interviewer: interviewerId,
      assignedBy: assignedById,
      assignedAt: new Date(),
      assignedACs: [], // No AC assignments
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });
    
    await survey.save();
    console.log(`✅ Interviewer assigned to survey ${SURVEY_ID} (no AC assigned)`);
  } catch (error) {
    console.error(`❌ Error assigning to survey: ${error.message}`);
    throw error;
  }
};

const createCAPIInterviewer = async (userData, referenceUser, assignedBy) => {
  const nameParts = userData.name.split(/\s+/).filter(p => p.trim());
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
  const phone = normalizePhone(userData.phone);
  const password = phone;
  const email = `capi${userData.memberId}@gmail.com`;
  
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
    interviewModes: 'CAPI (Face To Face)',
    canSelectMode: false,
    company: referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
    companyCode: COMPANY_CODE,
    memberId: userData.memberId,
    status: 'active',
    isActive: true,
    interviewerProfile: {
      ...(referenceUser.interviewerProfile || {}),
      approvalStatus: 'approved',
      approvalFeedback: 'Approved for CAPI',
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
  
  return newUser;
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
    
    console.log(`🔍 Checking if user exists (Member ID: ${userData.memberId}, Phone: ${userData.phone})...\n`);
    
    // Check if user exists by member ID
    let user = await User.findOne({ memberId: userData.memberId });
    
    // If not found by member ID, check by phone
    if (!user && userData.phone) {
      const normalizedPhone = normalizePhone(userData.phone);
      user = await User.findOne({ phone: normalizedPhone });
    }
    
    if (user) {
      console.log(`✅ User already exists:`);
      console.log(`   Member ID: ${user.memberId}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Phone: ${user.phone || 'NO PHONE'}`);
      console.log(`   Email: ${user.email}\n`);
    } else {
      console.log(`❌ User not found. Creating new user...\n`);
      user = await createCAPIInterviewer(userData, referenceUser, assignedBy);
      console.log(`✅ Created new CAPI interviewer:`);
      console.log(`   Member ID: ${user.memberId}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.phone}\n`);
    }
    
    // Assign to survey (without AC)
    console.log(`📝 Assigning to survey ${SURVEY_ID} (no AC assignment)...`);
    await assignToSurvey(user._id, assignedBy);
    console.log(`✅ Assignment complete\n`);
    
    console.log('='.repeat(80));
    console.log('✅ SUMMARY');
    console.log('='.repeat(80));
    console.log(`Member ID: ${user.memberId}`);
    console.log(`Name: ${user.firstName} ${user.lastName}`);
    console.log(`Phone: ${user.phone || 'NO PHONE'}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.phone || 'NO PHONE'}`);
    console.log(`Survey: ${SURVEY_ID}`);
    console.log(`AC Assignment: None (empty array)`);
    console.log('='.repeat(80));
    
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



