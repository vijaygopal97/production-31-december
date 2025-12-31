/**
 * Reusable Script to add approved CAPI interviewers
 * Survey: 68fd1915d41841da463f0d46
 * 
 * INSTRUCTIONS:
 * 1. Add interviewer details to the 'interviewersToAdd' array below
 * 2. Run: node scripts/addCAPIInterviewers.js (for development)
 * 3. Run on production: ssh to production and run the same command
 * 
 * Format for each interviewer:
 * {
 *   name: 'Full Name',
 *   phone: '10-digit phone number (no country code)',
 *   whatsapp: '10-digit whatsapp number (no country code)',
 *   email: 'email@example.com',
 *   memberId: 'unique member ID',
 *   ac: 'Assembly Constituency Name' (e.g., 'Bandwan', 'Barabani')
 * }
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
const COUNTRY = 'India';

// ============================================================================
// ADD INTERVIEWER DETAILS HERE
// ============================================================================
const interviewersToAdd = [
  {
    name: 'Bipasha Lohar',
    phone: '6295419141',
    whatsapp: '6295419141',
    email: 'bipshaloh6282@gmail.com',
    memberId: 'CAPI408',
    ac: 'Purulia'
  },
  {
    name: 'SK MD YUNAS',
    phone: '7699532888',
    whatsapp: '7699532888',
    email: 'capi431@gmail.com',
    memberId: 'CAPI431',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SHAIKH ZEENATH SAMIM',
    phone: '9547841271',
    whatsapp: '9547841271',
    email: 'capi432@gmail.com',
    memberId: 'CAPI432',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SHAIKH MAHAROOF HAQUE',
    phone: '7602977829',
    whatsapp: '7602977829',
    email: 'capi438@gmail.com',
    memberId: 'CAPI438',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SK ROBIUL',
    phone: '9144352907',
    whatsapp: '9144352907',
    email: 'capi440@gmail.com',
    memberId: 'CAPI440',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'Bumba Dangar',
    phone: '8945983325',
    whatsapp: '8945983325',
    email: 'capi488@gmail.com',
    memberId: 'CAPI488',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SK SAHABUDDIN',
    phone: '8597544677',
    whatsapp: '8597544677',
    email: 'capi498@gmail.com',
    memberId: 'CAPI498',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'Jharna Mondal',
    phone: '9332646654',
    whatsapp: '9332646654',
    email: 'capi499@gmail.com',
    memberId: 'CAPI499',
    ac: 'PaschimBurdwan'
  },
  {
    name: 'Manoj Panda',
    phone: '7602995165',
    whatsapp: '7602995165',
    email: 'capi581@gmail.com',
    memberId: 'CAPI581',
    ac: 'Hooghly'
  },
  {
    name: 'Roni Mondal',
    phone: '7810880347',
    whatsapp: '7810880347',
    email: 'capi582@gmail.com',
    memberId: 'CAPI582',
    ac: 'Hooghly'
  },
  {
    name: 'Subhajit Bhattacharya',
    phone: '8250426283',
    whatsapp: '8250426283',
    email: 'capi588@gmail.com',
    memberId: 'CAPI588',
    ac: 'Hooghly'
  },
  {
    name: 'Sonali Debnath',
    phone: '9876543210',
    whatsapp: '9876543210',
    email: 'capi583@gmail.com',
    memberId: 'CAPI583',
    ac: 'Hooghly'
  }
];

// ============================================================================
// DO NOT MODIFY BELOW THIS LINE
// ============================================================================

// Test login
const testLogin = async (email, password) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const isValid = await user.comparePassword(password);
    return { 
      success: isValid, 
      user: isValid ? { 
        email: user.email, 
        memberId: user.memberId,
        firstName: user.firstName,
        lastName: user.lastName
      } : null,
      error: isValid ? null : 'Invalid password'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const createInterviewer = async (userData, referenceUser, assignedBy) => {
  try {
    const nameParts = userData.name.split(/\s+/);
    const firstName = nameParts[0] || 'CAPI';
    const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
    
    // Phone number should NOT have country code (strictly no +91)
    let phone = userData.phone;
    phone = phone.replace(/^\+91/, '').replace(/^91/, '');
    
    const password = phone; // Password is phone number without country code
    
    const existingUser = await User.findOne({ 
      $or: [
        { email: userData.email.toLowerCase() },
        { phone: phone },
        { memberId: userData.memberId }
      ]
    }).select('+password');

    if (existingUser) {
      console.log(`⚠️  User already exists (${userData.memberId}). Updating...`);
      
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            firstName: firstName,
            lastName: lastName,
            email: userData.email.toLowerCase(),
            phone: phone,
            memberId: userData.memberId,
            userType: 'interviewer',
            interviewModes: 'CAPI (Face To Face)',
            password: hashedPassword,
            companyCode: COMPANY_CODE,
            company: referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
            status: 'active',
            isActive: true
          }
        }
      );
      
      const updatedUser = await User.findById(existingUser._id).select('+password');
      const passwordValid = await updatedUser.comparePassword(password);
      
      if (!passwordValid) {
        console.log(`⚠️  Password verification failed, retrying...`);
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(password, retrySalt);
        await User.updateOne(
          { _id: existingUser._id },
          { $set: { password: retryHashedPassword } }
        );
        
        const retryUser = await User.findById(existingUser._id).select('+password');
        const retryValid = await retryUser.comparePassword(password);
        if (!retryValid) {
          throw new Error(`Password verification failed after retry for ${userData.memberId}`);
        }
      }
      
      if (!updatedUser.interviewerProfile) {
        updatedUser.interviewerProfile = {};
      }
      updatedUser.interviewerProfile.approvalStatus = 'approved';
      updatedUser.interviewerProfile.approvalFeedback = 'Approved for CAPI';
      updatedUser.interviewerProfile.approvedBy = referenceUser.interviewerProfile?.approvedBy || assignedBy;
      updatedUser.interviewerProfile.approvedAt = new Date();
      updatedUser.interviewerProfile.lastSubmittedAt = new Date();
      
      if (referenceUser.interviewerProfile) {
        const fieldsToCopy = [
          'age', 'gender', 'languagesSpoken', 'highestDegree',
          'hasSurveyExperience', 'surveyExperienceYears', 'surveyExperienceDescription',
          'cvUpload', 'ownsSmartphone', 'smartphoneType', 'androidVersion', 'iosVersion',
          'willingToTravel', 'hasVehicle', 'willingToRecordAudio', 'agreesToRemuneration',
          'bankAccountNumber', 'bankName', 'bankIfscCode', 'bankDocumentUpload',
          'aadhaarNumber', 'aadhaarDocument', 'panNumber', 'panDocument', 'passportPhoto',
          'agreesToShareInfo', 'agreesToParticipateInSurvey'
        ];
        fieldsToCopy.forEach(field => {
          if (!updatedUser.interviewerProfile[field] && referenceUser.interviewerProfile[field]) {
            updatedUser.interviewerProfile[field] = referenceUser.interviewerProfile[field];
          }
        });
        if (!updatedUser.interviewerProfile.age) updatedUser.interviewerProfile.age = 28;
        if (!updatedUser.interviewerProfile.gender) updatedUser.interviewerProfile.gender = 'male';
        if (!updatedUser.interviewerProfile.languagesSpoken || updatedUser.interviewerProfile.languagesSpoken.length === 0) {
          updatedUser.interviewerProfile.languagesSpoken = ['Hindi', 'English'];
        }
        if (!updatedUser.interviewerProfile.highestDegree) {
          updatedUser.interviewerProfile.highestDegree = {
            name: 'B.Tech',
            institution: 'NIT',
            year: 2019
          };
        }
        updatedUser.interviewerProfile.bankAccountHolderName = `${firstName.toUpperCase()} ${lastName.toUpperCase()}`;
      }
      
      if (!updatedUser.company) {
        updatedUser.company = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');
      }
      
      if (!updatedUser.profile || Object.keys(updatedUser.profile).length === 0) {
        updatedUser.profile = referenceUser.profile || { languages: [], education: [], experience: [] };
      }
      if (!updatedUser.preferences || Object.keys(updatedUser.preferences).length === 0) {
        updatedUser.preferences = referenceUser.preferences;
      }
      if (!updatedUser.performance || Object.keys(updatedUser.performance).length === 0) {
        updatedUser.performance = referenceUser.performance;
      }
      
      await updatedUser.save({ runValidators: false });
      
      console.log(`✅ User updated: ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})`);
      console.log(`   Member ID: ${updatedUser.memberId}`);
      console.log(`   User ID: ${updatedUser._id}\n`);
      
      return { user: updatedUser, isNew: false };
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: userData.email.toLowerCase(),
      phone: phone,
      password: hashedPassword,
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: referenceUser.canSelectMode || false,
      company: companyId,
      companyCode: COMPANY_CODE,
      memberId: userData.memberId,
      profile: referenceUser.profile || {
        languages: [],
        education: [],
        experience: []
      },
      documents: referenceUser.documents || {
        aadhaar: { isVerified: false },
        pan: { isVerified: false },
        drivingLicense: { isVerified: false },
        bankDetails: { isVerified: false }
      },
      status: 'active',
      isActive: true,
      gig_availability: referenceUser.gig_availability || false,
      gig_enabled: referenceUser.gig_enabled || false,
      performance: referenceUser.performance || {
        trustScore: 100,
        totalInterviews: 0,
        approvedInterviews: 0,
        rejectedInterviews: 0,
        averageRating: 0,
        totalEarnings: 0,
        qualityMetrics: {
          audioQuality: 0,
          responseAccuracy: 0,
          timeliness: 0,
          professionalism: 0
        }
      },
      preferences: referenceUser.preferences || {
        notifications: {
          email: true,
          sms: true,
          push: true,
          surveyAssignments: true,
          paymentUpdates: true,
          qualityFeedback: true
        },
        workingHours: {
          startTime: '09:00',
          endTime: '18:00',
          workingDays: [],
          timezone: 'Asia/Kolkata'
        },
        surveyPreferences: {
          maxDistance: 50,
          preferredLocations: [],
          minPayment: 0,
          maxInterviewsPerDay: 10
        },
        locationControlBooster: true
      },
      registrationSource: referenceUser.registrationSource || 'company_admin',
      training: referenceUser.training || {
        completedModules: [],
        certificationStatus: 'not_started'
      },
      interviewerProfile: {
        age: referenceUser.interviewerProfile?.age || 28,
        gender: referenceUser.interviewerProfile?.gender || 'male',
        languagesSpoken: referenceUser.interviewerProfile?.languagesSpoken || ['Hindi', 'English'],
        highestDegree: referenceUser.interviewerProfile?.highestDegree || {
          name: 'B.Tech',
          institution: 'NIT',
          year: 2019
        },
        hasSurveyExperience: referenceUser.interviewerProfile?.hasSurveyExperience !== undefined 
          ? referenceUser.interviewerProfile.hasSurveyExperience 
          : true,
        surveyExperienceYears: referenceUser.interviewerProfile?.surveyExperienceYears || 3,
        surveyExperienceDescription: referenceUser.interviewerProfile?.surveyExperienceDescription || 'Experienced in face-to-face surveys and CAPI operations',
        cvUpload: referenceUser.interviewerProfile?.cvUpload || 'cvUpload-1764630127133-571761495.docx',
        ownsSmartphone: referenceUser.interviewerProfile?.ownsSmartphone !== undefined 
          ? referenceUser.interviewerProfile.ownsSmartphone 
          : true,
        smartphoneType: referenceUser.interviewerProfile?.smartphoneType || 'Both',
        androidVersion: referenceUser.interviewerProfile?.androidVersion || '13',
        iosVersion: referenceUser.interviewerProfile?.iosVersion || '',
        willingToTravel: referenceUser.interviewerProfile?.willingToTravel !== undefined 
          ? referenceUser.interviewerProfile.willingToTravel 
          : true,
        hasVehicle: referenceUser.interviewerProfile?.hasVehicle !== undefined 
          ? referenceUser.interviewerProfile.hasVehicle 
          : true,
        willingToRecordAudio: referenceUser.interviewerProfile?.willingToRecordAudio !== undefined 
          ? referenceUser.interviewerProfile.willingToRecordAudio 
          : true,
        agreesToRemuneration: referenceUser.interviewerProfile?.agreesToRemuneration !== undefined 
          ? referenceUser.interviewerProfile.agreesToRemuneration 
          : true,
        bankAccountNumber: referenceUser.interviewerProfile?.bankAccountNumber || '786897980',
        bankAccountHolderName: `${firstName.toUpperCase()} ${lastName.toUpperCase()}`,
        bankName: referenceUser.interviewerProfile?.bankName || 'HDFC',
        bankIfscCode: referenceUser.interviewerProfile?.bankIfscCode || 'HDFC0001234',
        bankDocumentUpload: referenceUser.interviewerProfile?.bankDocumentUpload || 'bankDocumentUpload-1764630178675-881719772.png',
        aadhaarNumber: referenceUser.interviewerProfile?.aadhaarNumber || '876897697890',
        aadhaarDocument: referenceUser.interviewerProfile?.aadhaarDocument || 'aadhaarDocument-1764630188489-204099240.png',
        panNumber: referenceUser.interviewerProfile?.panNumber || '7868979879',
        panDocument: referenceUser.interviewerProfile?.panDocument || 'panDocument-1764630192433-387051607.png',
        passportPhoto: referenceUser.interviewerProfile?.passportPhoto || 'passportPhoto-1764630195659-468808359.png',
        agreesToShareInfo: referenceUser.interviewerProfile?.agreesToShareInfo !== undefined 
          ? referenceUser.interviewerProfile.agreesToShareInfo 
          : true,
        agreesToParticipateInSurvey: referenceUser.interviewerProfile?.agreesToParticipateInSurvey !== undefined 
          ? referenceUser.interviewerProfile.agreesToParticipateInSurvey 
          : true,
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
    
    const savedUser = await User.findById(newUser._id).select('+password');
    const passwordValid = await savedUser.comparePassword(password);
    
    if (!passwordValid) {
      console.log(`⚠️  Password verification failed, retrying...`);
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(password, retrySalt);
      await User.updateOne(
        { _id: savedUser._id },
        { $set: { password: retryHashedPassword } }
      );
      
      const retryUser = await User.findById(savedUser._id).select('+password');
      const retryValid = await retryUser.comparePassword(password);
      if (!retryValid) {
        throw new Error(`Password verification failed after retry for ${userData.memberId}`);
      }
    }
    
    console.log(`✅ User created: ${savedUser.firstName} ${savedUser.lastName} (${savedUser.email})`);
    console.log(`   Member ID: ${savedUser.memberId}`);
    console.log(`   User ID: ${savedUser._id}\n`);
    
    return { user: savedUser, isNew: true };
  } catch (error) {
    console.error(`❌ Error creating user ${userData.memberId}:`, error.message);
    throw error;
  }
};

const assignToSurvey = async (interviewerId, assignedById, acName) => {
  try {
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    
    const existingAssignment = survey.capiInterviewers?.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      // Update existing assignment with AC
      existingAssignment.assignedACs = [acName];
      existingAssignment.selectedState = STATE;
      existingAssignment.selectedCountry = COUNTRY;
      existingAssignment.assignedBy = assignedById;
      existingAssignment.assignedAt = new Date();
      existingAssignment.status = 'assigned';
      await survey.save();
      console.log(`✅ Interviewer already assigned to survey, updated with AC: ${acName}`);
      return;
    }
    
    if (!survey.capiInterviewers) {
      survey.capiInterviewers = [];
    }
    
    survey.capiInterviewers.push({
      interviewer: interviewerId,
      assignedBy: assignedById,
      assignedAt: new Date(),
      assignedACs: [acName], // Array of AC names
      selectedState: STATE, // West Bengal
      selectedCountry: COUNTRY, // India
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });
    
    await survey.save();
    console.log(`✅ Interviewer assigned to survey ${SURVEY_ID} with AC: ${acName}`);
  } catch (error) {
    console.error(`❌ Error assigning to survey: ${error.message}`);
    throw error;
  }
};

const main = async () => {
  try {
    if (interviewersToAdd.length === 0) {
      console.log('⚠️  No interviewers to add. Please add interviewer details to the \'interviewersToAdd\' array at the top of the script.');
      process.exit(0);
    }

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
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

    console.log('🚀 Creating/Updating CAPI Interviewers\n');
    console.log('='.repeat(80));
    
    const results = [];
    const loginTests = [];
    
    for (const userInfo of interviewersToAdd) {
      try {
        const nameParts = userInfo.name.split(/\s+/);
        const firstName = nameParts[0] || 'CAPI';
        const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
        
        // Phone number should NOT have country code (strictly no +91)
        let phone = userInfo.phone;
        phone = phone.replace(/^\+91/, '').replace(/^91/, '');
        
        const password = phone; // Password is phone number without country code
        
        const interviewerData = {
          name: userInfo.name,
          memberId: userInfo.memberId,
          email: userInfo.email,
          phone: phone,
          password: password
        };
        
        console.log(`\n📝 Processing: ${firstName} ${lastName} (${userInfo.memberId})`);
        console.log(`   Email: ${userInfo.email}`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Password: ${password}`);
        console.log(`   AC: ${userInfo.ac}`);
        console.log('-'.repeat(80));
        
        const result = await createInterviewer(interviewerData, referenceUser, assignedBy);
        await assignToSurvey(result.user._id, assignedBy, userInfo.ac);
        
        console.log(`🔐 Testing login for ${userInfo.email}...`);
        const loginTest = await testLogin(userInfo.email, password);
        if (loginTest.success) {
          console.log(`✅ Login test PASSED for ${userInfo.email}`);
        } else {
          console.log(`❌ Login test FAILED for ${userInfo.email}: ${loginTest.error}`);
        }
        loginTests.push({ email: userInfo.email, password, success: loginTest.success, error: loginTest.error });
        
        results.push({
          ...result,
          interviewerData,
          ac: userInfo.ac
        });
        
        console.log(`✅ Completed: ${result.user.firstName} ${result.user.lastName}\n`);
      } catch (error) {
        console.error(`❌ Error processing user:`, error.message);
        results.push({ success: false, error: error.message, userInfo });
      }
    }
    
    console.log('='.repeat(80));
    console.log('\n✅ All interviewers processed!\n');
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success !== false && r.user);
    const failed = results.filter(r => r.success === false);
    const loginFailed = loginTests.filter(t => !t.success);
    
    console.log(`✅ Successfully created/updated: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`🔐 Login tests passed: ${loginTests.length - loginFailed.length}/${loginTests.length}`);
    
    if (loginFailed.length > 0) {
      console.log(`\n⚠️  Login test failures:`);
      loginFailed.forEach(test => {
        console.log(`   - ${test.email}: ${test.error}`);
      });
    }
    
    console.log('\n📋 Created/Updated Interviewers:');
    console.log('='.repeat(80));
    
    successful.forEach((result, index) => {
      const { user, interviewerData, ac } = result;
      console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   InterviewerID: ${user.memberId}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${interviewerData.password}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Approval: ${user.interviewerProfile?.approvalStatus || 'N/A'}`);
      console.log(`   Survey Assignment: Assigned to ${SURVEY_ID}`);
      console.log(`   AC Assignment: ${ac}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { createInterviewer, assignToSurvey, testLogin };
