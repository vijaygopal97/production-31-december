/**
 * Reusable Script to add approved CATI interviewers
 * Survey: 68fd1915d41841da463f0d46
 * 
 * INSTRUCTIONS:
 * 1. Add interviewer details to the 'interviewersToAdd' array below
 * 2. Run: node scripts/addCATIInterviewers.js (for development)
 * 3. Run on production: ssh to production and run the same command
 * 
 * Format for each interviewer:
 * {
 *   name: 'Full Name',
 *   phone: '10-digit phone number (no country code)',
 *   memberId: 'unique member ID',
 *   email: 'email@example.com' (optional - will auto-generate if not provided)
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

// ============================================================================
// ADD INTERVIEWER DETAILS HERE
// ============================================================================
const interviewersToAdd = [
  {
    name: 'KABINA KHATUN',
    phone: '8250049424',
    memberId: '500',
    email: 'cati500@gmail.com'
  },
  {
    name: 'PRIYA SHANKAR',
    phone: '8370823975',
    memberId: '501',
    email: 'cati501@gmail.com'
  },
  {
    name: 'PRANJAL SUTRADHAR',
    phone: '8509524647',
    memberId: '502',
    email: 'cati502@gmail.com'
  },
  {
    name: 'ANTARA PRADHAN',
    phone: '7063239381',
    memberId: '503',
    email: 'cati503@gmail.com'
  },
  {
    name: 'LAKSHYA THAPA',
    phone: '7719219779',
    memberId: '504',
    email: 'cati504@gmail.com'
  },
  {
    name: 'ASHTHA SHAH',
    phone: '8250316305',
    memberId: '505',
    email: 'cati505@gmail.com'
  },
  {
    name: 'PRIYANKA PATHAK',
    phone: '6295242103',
    memberId: '506',
    email: 'cati506@gmail.com'
  },
  {
    name: 'HRITESH TAMANG',
    phone: '8944848649',
    memberId: '507',
    email: 'cati507@gmail.com'
  },
  {
    name: 'HIRANMOY PANDIT',
    phone: '7384638012',
    memberId: '508',
    email: 'cati508@gmail.com'
  },
  {
    name: 'SUBHA MALLIK',
    phone: '7407236511',
    memberId: '509',
    email: 'cati509@gmail.com'
  },
  {
    name: 'Jahanara Khatoon',
    phone: '9382115873',
    memberId: '510',
    email: 'cati510@gmail.com'
  },
  {
    name: 'ANIMESH ROY',
    phone: '8967215263',
    memberId: '511',
    email: 'cati511@gmail.com'
  },
  {
    name: 'SAMIRAN DAS',
    phone: '8597638130',
    memberId: '512',
    email: 'cati512@gmail.com'
  },
  {
    name: 'RAJAT ROY',
    phone: '9064376368',
    memberId: '513',
    email: 'cati513@gmail.com'
  },
  {
    name: 'PRATIBHA SHA',
    phone: '9046720791',
    memberId: '514',
    email: 'cati514@gmail.com'
  },
  {
    name: 'APARNA SARKAR',
    phone: '9332948136',
    memberId: '515',
    email: 'cati515@gmail.com'
  },
  {
    name: 'KANIKA KERKETTA',
    phone: '9647732765',
    memberId: '516',
    email: 'cati516@gmail.com'
  },
  {
    name: 'SUSMITA SAHA',
    phone: '8167029266',
    memberId: '517',
    email: 'cati517@gmail.com'
  },
  {
    name: 'KAKALI MAJUMDER',
    phone: '9064006902',
    memberId: '518',
    email: 'cati518@gmail.com'
  },
  {
    name: 'TITHI BISWAS',
    phone: '9775768489',
    memberId: '519',
    email: 'cati519@gmail.com'
  },
  {
    name: 'PUJA KUNDU',
    phone: '7478824785',
    memberId: '520',
    email: 'cati520@gmail.com'
  },
  {
    name: 'SUPANNA MURMU',
    phone: '9593889417',
    memberId: '521',
    email: 'cati521@gmail.com'
  },
  {
    name: 'BRISTI HALDER',
    phone: '8293506338',
    memberId: '522',
    email: 'cati522@gmail.com'
  },
  {
    name: 'NUPUR MONDAL',
    phone: '7679392167',
    memberId: '523',
    email: 'cati523@gmail.com'
  },
  {
    name: 'PUJA DAS',
    phone: '7501264295',
    memberId: '524',
    email: 'cati524@gmail.com'
  },
  {
    name: 'MIM PARVIN',
    phone: '6295623404',
    memberId: '525',
    email: 'cati525@gmail.com'
  },
  {
    name: 'ANASBIN JAMAN',
    phone: '8391845069',
    memberId: '526',
    email: 'cati526@gmail.com'
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
    const firstName = nameParts[0] || 'CATI';
    const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
    
    // Phone number should NOT have country code (strictly no +91)
    let phone = userData.phone;
    phone = phone.replace(/^\+91/, '').replace(/^91/, '');
    
    const password = phone; // Password is phone number without country code
    
    // Auto-generate email if not provided
    const email = userData.email || `cati${userData.memberId}@gmail.com`;
    
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { phone: phone },
        { memberId: userData.memberId }
      ]
    }).select('+password');

    if (existingUser) {
      console.log(`⚠️  User already exists with memberId ${userData.memberId}. SKIPPING (not overwriting)...`);
      console.log(`   Existing Name: ${existingUser.firstName} ${existingUser.lastName}`);
      console.log(`   Existing Email: ${existingUser.email}`);
      console.log(`   Existing Member ID: ${existingUser.memberId}\n`);
      
      // Return existing user but mark as skipped
      return { user: existingUser, isNew: false, skipped: true };
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: email.toLowerCase(),
      phone: phone,
      password: hashedPassword,
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CATI (Telephonic interview)',
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
        surveyExperienceDescription: referenceUser.interviewerProfile?.surveyExperienceDescription || 'Experienced in telephonic surveys and CATI operations',
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
        approvalFeedback: 'Approved for CATI',
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

const assignToSurvey = async (interviewerId, assignedById) => {
  try {
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    
    const existingAssignment = survey.catiInterviewers?.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      console.log(`✅ Interviewer already assigned to survey`);
      return;
    }
    
    if (!survey.catiInterviewers) {
      survey.catiInterviewers = [];
    }
    
    survey.catiInterviewers.push({
      interviewer: interviewerId,
      assignedBy: assignedById,
      assignedAt: new Date(),
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });
    
    await survey.save();
    console.log(`✅ Interviewer assigned to survey ${SURVEY_ID}`);
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

    console.log('🔍 Checking for existing member IDs...\n');
    const existingMembers = [];
    const newMembers = [];
    
    for (const userInfo of interviewersToAdd) {
      const existingUser = await User.findOne({ 
        memberId: userInfo.memberId 
      });
      
      if (existingUser) {
        existingMembers.push({
          memberId: userInfo.memberId,
          name: userInfo.name,
          existingEmail: existingUser.email,
          existingName: `${existingUser.firstName} ${existingUser.lastName}`
        });
        console.log(`⚠️  Member ID ${userInfo.memberId} (${userInfo.name}) already exists:`);
        console.log(`   Existing Name: ${existingUser.firstName} ${existingUser.lastName}`);
        console.log(`   Existing Email: ${existingUser.email}\n`);
      } else {
        newMembers.push(userInfo);
      }
    }
    
    if (existingMembers.length > 0) {
      console.log('='.repeat(80));
      console.log(`⚠️  Found ${existingMembers.length} existing member ID(s) - These will be SKIPPED:`);
      existingMembers.forEach(m => {
        console.log(`   - Member ID: ${m.memberId} | Name: ${m.name} | Existing: ${m.existingName} (${m.existingEmail})`);
      });
      console.log('='.repeat(80));
      console.log(`\n📝 Will create ${newMembers.length} new interviewer(s)\n`);
    }
    
    if (newMembers.length === 0) {
      console.log('⚠️  All member IDs already exist. Nothing to create.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('🚀 Creating/Updating CATI Interviewers\n');
    console.log('='.repeat(80));
    
    const results = [];
    const loginTests = [];
    
    for (const userInfo of newMembers) {
      try {
        const nameParts = userInfo.name.split(/\s+/);
        const firstName = nameParts[0] || 'CATI';
        const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
        
        // Phone number should NOT have country code (strictly no +91)
        let phone = userInfo.phone;
        phone = phone.replace(/^\+91/, '').replace(/^91/, '');
        
        const password = phone; // Password is phone number without country code
        const email = userInfo.email || `cati${userInfo.memberId}@gmail.com`;
        
        const interviewerData = {
          name: userInfo.name,
          memberId: userInfo.memberId,
          email: email,
          phone: phone,
          password: password
        };
        
        console.log(`\n📝 Processing: ${firstName} ${lastName} (${userInfo.memberId})`);
        console.log(`   Email: ${email}`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Password: ${password}`);
        console.log('-'.repeat(80));
        
        const result = await createInterviewer(interviewerData, referenceUser, assignedBy);
        
        // Skip assignment and login test if user was skipped (already exists)
        if (result.skipped) {
          console.log(`⏭️  SKIPPED - User already exists, not overwriting\n`);
          results.push({
            ...result,
            interviewerData,
            skipped: true
          });
          continue;
        }
        
        await assignToSurvey(result.user._id, assignedBy);
        
        console.log(`🔐 Testing login for ${email}...`);
        const loginTest = await testLogin(email, password);
        if (loginTest.success) {
          console.log(`✅ Login test PASSED for ${email}`);
        } else {
          console.log(`❌ Login test FAILED for ${email}: ${loginTest.error}`);
        }
        loginTests.push({ email, password, success: loginTest.success, error: loginTest.error });
        
        results.push({
          ...result,
          interviewerData
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
    
    const successful = results.filter(r => r.success !== false && r.user && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    const failed = results.filter(r => r.success === false);
    const loginFailed = loginTests.filter(t => !t.success);
    
    console.log(`✅ Successfully created: ${successful.length}`);
    console.log(`⏭️  Skipped (already exist): ${skipped.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`🔐 Login tests passed: ${loginTests.length - loginFailed.length}/${loginTests.length}`);
    
    if (skipped.length > 0) {
      console.log(`\n⏭️  SKIPPED Member IDs (already exist - not overwritten):`);
      skipped.forEach(result => {
        console.log(`   - Member ID: ${result.interviewerData.memberId} | Name: ${result.interviewerData.name} | Existing Email: ${result.user.email}`);
      });
    }
    
    if (loginFailed.length > 0) {
      console.log(`\n⚠️  Login test failures:`);
      loginFailed.forEach(test => {
        console.log(`   - ${test.email}: ${test.error}`);
      });
    }
    
    console.log('\n📋 Created/Updated Interviewers:');
    console.log('='.repeat(80));
    
    successful.forEach((result, index) => {
      const { user, interviewerData } = result;
      console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   InterviewerID: ${user.memberId}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${interviewerData.password}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Approval: ${user.interviewerProfile?.approvalStatus || 'N/A'}`);
      console.log(`   Survey Assignment: Assigned to ${SURVEY_ID}`);
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
