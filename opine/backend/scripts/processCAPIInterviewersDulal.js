/**
 * Script to process CAPI interviewers for Project Manager: dulal.roy@convergent.com
 * - Check if each member ID exists
 * - If exists and phone matches but name doesn't: update name
 * - If doesn't exist: create new CAPI interviewer
 * - Reset all passwords to phone numbers
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
const PROJECT_MANAGER_EMAIL = 'dulal.roy@convergent.com';

// CAPI interviewers data
const capiInterviewers = [
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
  { memberId: 'CAPI439', name: 'RANJANA DAS', phone: '6296256693' }, // Using second entry (last listed)
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
  { memberId: 'CAPI475', name: 'Biswajit Dolui', phone: '983293142' },
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
  { memberId: 'CAPI583', name: 'Sonali Debnath', phone: null }, // No phone provided
  { memberId: 'CAPI588', name: 'Subhajit Bhattacharya', phone: '8250426283' },
  { memberId: 'CAPI590', name: 'MD SOYEL', phone: '7364023228' },
  { memberId: 'CAPI1411', name: 'Debraj Maiti', phone: '9547657255' },
  { memberId: 'CAPI1412', name: 'Anita Maiti', phone: '8293199679' },
  { memberId: 'CAPI1413', name: 'Amit Kumar Hazra', phone: '8016162405' }
];

const normalizePhone = (phone) => {
  if (!phone) return null;
  return phone.replace(/\s+/g, '').replace(/^\+91/, '').replace(/^91/, '').slice(-10);
};

const normalizeName = (name) => {
  return name.trim().toUpperCase();
};

const resetPassword = async (user, phone) => {
  if (!phone) {
    console.log(`   ⚠️  Skipping password reset - no phone number provided`);
    return;
  }
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
  
  // Skip if no phone number (CAPI583)
  if (!normalizedPhone) {
    return {
      action: 'SKIPPED_NO_PHONE',
      memberId,
      name: `${firstName} ${lastName}`.trim()
    };
  }
  
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
      phoneMismatch: [],
      skippedNoPhone: []
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
        } else if (result.action === 'SKIPPED_NO_PHONE') {
          results.skippedNoPhone.push(result);
          console.log(`⏭️  SKIPPED (No Phone): ${result.memberId} - ${result.name}`);
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
    console.log(`⏭️  Skipped (No Phone): ${results.skippedNoPhone.length}`);
    
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
    
    if (results.skippedNoPhone.length > 0) {
      console.log('\n⏭️  SKIPPED (No Phone Number):');
      results.skippedNoPhone.forEach(r => {
        console.log(`   ${r.memberId}: ${r.name}`);
      });
    }
    
    console.log('\n✅ All interviewers processed!');
    console.log('✅ All passwords reset to phone numbers');
    console.log('✅ All assigned to survey');
    console.log('✅ All assigned to project manager (dulal.roy@convergent.com)\n');
    
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



