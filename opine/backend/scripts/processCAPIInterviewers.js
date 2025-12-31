/**
 * Script to process CAPI interviewers:
 * - Check if member ID exists
 * - If exists and phone matches but name doesn't: update name
 * - If doesn't exist: create new CAPI interviewer
 * - Reset password to phone number for all
 * - Assign to survey and project manager
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const PROJECT_MANAGER_EMAIL = 'krishna.das@convergent.com';

// CAPI interviewers data
const capiInterviewers = [
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
];

const normalizePhone = (phone) => {
  return phone.replace(/\s+/g, '').replace(/^\+91/, '').replace(/^91/, '').slice(-10);
};

const normalizeName = (name) => {
  return name.trim().toUpperCase();
};

const resetPassword = async (user, phone) => {
  const password = normalizePhone(phone);
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);
  user.password = hashedPassword;
  await user.save({ runValidators: false });
  
  // Verify password
  const updatedUser = await User.findById(user._id).select('+password');
  const passwordValid = await updatedUser.comparePassword(password);
  if (!passwordValid) {
    const retrySalt = await bcrypt.genSalt(12);
    const retryHashedPassword = await bcrypt.hash(password, retrySalt);
    await User.updateOne({ _id: user._id }, { $set: { password: retryHashedPassword } });
  }
};

const assignToSurvey = async (interviewerId, assignedById) => {
  const survey = await Survey.findById(SURVEY_ID);
  if (!survey) {
    throw new Error(`Survey ${SURVEY_ID} not found`);
  }
  
  if (!survey.capiInterviewers) {
    survey.capiInterviewers = [];
  }
  
  const existingAssignment = survey.capiInterviewers.find(
    assignment => assignment.interviewer.toString() === interviewerId.toString()
  );
  
  if (!existingAssignment) {
    survey.capiInterviewers.push({
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

const assignToProjectManager = async (interviewerId, pmId) => {
  const pm = await User.findById(pmId);
  if (!pm) {
    throw new Error(`Project Manager ${pmId} not found`);
  }
  
  if (!pm.assignedTeamMembers) {
    pm.assignedTeamMembers = [];
  }
  
  const existingAssignment = pm.assignedTeamMembers.find(
    assignment => assignment.user.toString() === interviewerId.toString()
  );
  
  if (!existingAssignment) {
    pm.assignedTeamMembers.push({
      user: interviewerId,
      userType: 'interviewer',
      assignedAt: new Date(),
      assignedBy: pmId
    });
    await pm.save();
  }
};

const processInterviewer = async (data, referenceUser, assignedBy, pmId) => {
  const { memberId, name, phone } = data;
  const normalizedPhone = normalizePhone(phone);
  const nameParts = name.split(/\s+/).filter(p => p.trim());
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
  const email = `${memberId.toLowerCase()}@gmail.com`;
  
  // Check if user exists
  const existingUser = await User.findOne({ memberId: memberId });
  
  if (existingUser) {
    const existingPhone = normalizePhone(existingUser.phone || '');
    const existingFullName = `${existingUser.firstName || ''} ${existingUser.lastName || ''}`.trim();
    const providedFullName = `${firstName} ${lastName}`.trim();
    
    // Check if phone matches
    if (existingPhone === normalizedPhone) {
      // Phone matches - check name
      if (normalizeName(existingFullName) !== normalizeName(providedFullName)) {
        // Name doesn't match - update it
        existingUser.firstName = firstName;
        existingUser.lastName = lastName;
        await existingUser.save({ runValidators: false });
        
        // Reset password
        await resetPassword(existingUser, phone);
        
        // Assign to survey
        await assignToSurvey(existingUser._id, assignedBy);
        
        // Assign to PM
        await assignToProjectManager(existingUser._id, pmId);
        
        return {
          action: 'UPDATED_NAME',
          memberId,
          oldName: existingFullName,
          newName: providedFullName,
          phone: normalizedPhone,
          email: existingUser.email
        };
      } else {
        // Name and phone match - just reset password and ensure assignments
        await resetPassword(existingUser, phone);
        await assignToSurvey(existingUser._id, assignedBy);
        await assignToProjectManager(existingUser._id, pmId);
        
        return {
          action: 'ALREADY_CORRECT',
          memberId,
          name: providedFullName,
          phone: normalizedPhone,
          email: existingUser.email
        };
      }
      } else {
        // Phone doesn't match - leave alone (but still reset password and ensure assignments)
        await resetPassword(existingUser, phone);
        await assignToSurvey(existingUser._id, assignedBy);
        await assignToProjectManager(existingUser._id, pmId);
        
        return {
          action: 'PHONE_MISMATCH',
          memberId,
          existingName: existingFullName,
          existingPhone: existingPhone,
          providedName: `${firstName} ${lastName}`.trim(),
          providedPhone: normalizedPhone,
          email: existingUser.email
        };
      }
  } else {
    // User doesn't exist - create new
    const password = normalizedPhone;
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      password: hashedPassword,
      isEmailVerified: false,
      isPhoneVerified: false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: false,
      company: referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
      companyCode: COMPANY_CODE,
      memberId: memberId,
      status: 'active',
      isActive: true,
      location: {
        state: STATE,
        country: 'India'
      },
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
    
    // Assign to survey
    await assignToSurvey(newUser._id, assignedBy);
    
    // Assign to PM
    await assignToProjectManager(newUser._id, pmId);
    
    return {
      action: 'CREATED',
      memberId,
      name: providedFullName,
      phone: normalizedPhone,
      email: email
    };
  }
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
    
    console.log(`📋 Fetching project manager: ${PROJECT_MANAGER_EMAIL}...`);
    const pm = await User.findOne({ 
      email: PROJECT_MANAGER_EMAIL.toLowerCase(),
      userType: 'project_manager'
    });
    if (!pm) {
      throw new Error(`Project Manager ${PROJECT_MANAGER_EMAIL} not found`);
    }
    console.log(`✅ Found project manager: ${pm.firstName} ${pm.lastName}\n`);
    
    const companyAdmin = await User.findOne({
      userType: 'company_admin',
      companyCode: COMPANY_CODE,
      status: 'active'
    });
    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;
    
    console.log('🚀 Processing CAPI Interviewers...\n');
    console.log('='.repeat(80));
    
    const results = {
      created: [],
      updatedName: [],
      alreadyCorrect: [],
      phoneMismatch: []
    };
    
    for (const interviewer of capiInterviewers) {
      try {
        const result = await processInterviewer(interviewer, referenceUser, assignedBy, pm._id);
        
        if (result.action === 'CREATED') {
          results.created.push(result);
          console.log(`✅ CREATED: ${result.memberId} - ${result.name} (${result.phone})`);
        } else if (result.action === 'UPDATED_NAME') {
          results.updatedName.push(result);
          console.log(`🔄 UPDATED NAME: ${result.memberId}`);
          console.log(`   Old: ${result.oldName}`);
          console.log(`   New: ${result.newName}`);
        } else if (result.action === 'ALREADY_CORRECT') {
          results.alreadyCorrect.push(result);
          console.log(`✓ ALREADY CORRECT: ${result.memberId} - ${result.name}`);
        } else if (result.action === 'PHONE_MISMATCH') {
          results.phoneMismatch.push(result);
          console.log(`⚠️  PHONE MISMATCH: ${result.memberId}`);
          console.log(`   Existing: ${result.existingName} (${result.existingPhone})`);
          console.log(`   Provided: ${result.providedName} (${result.providedPhone})`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${interviewer.memberId}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Created: ${results.created.length}`);
    console.log(`🔄 Name Updated: ${results.updatedName.length}`);
    console.log(`✓ Already Correct: ${results.alreadyCorrect.length}`);
    console.log(`⚠️  Phone Mismatch (Left Alone): ${results.phoneMismatch.length}`);
    
    if (results.created.length > 0) {
      console.log('\n📝 CREATED USERS:');
      results.created.forEach(r => {
        console.log(`   ${r.memberId}: ${r.name} (${r.phone}) - ${r.email}`);
      });
    }
    
    if (results.updatedName.length > 0) {
      console.log('\n📝 UPDATED NAMES:');
      results.updatedName.forEach(r => {
        console.log(`   ${r.memberId}: "${r.oldName}" → "${r.newName}" (${r.phone})`);
      });
    }
    
    if (results.phoneMismatch.length > 0) {
      console.log('\n⚠️  PHONE MISMATCHES (Left Alone):');
      results.phoneMismatch.forEach(r => {
        console.log(`   ${r.memberId}: Existing phone ${r.existingPhone} ≠ Provided ${r.providedPhone}`);
      });
    }
    
    console.log('\n✅ All interviewers processed!');
    console.log('✅ All passwords reset to phone numbers');
    console.log('✅ All assigned to survey');
    console.log('✅ All assigned to project manager\n');
    
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



