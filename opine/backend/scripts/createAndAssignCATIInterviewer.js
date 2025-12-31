/**
 * Script to create approved CATI interviewer user and assign to survey
 * 
 * This script:
 * 1. Creates an interviewer user with specified details
 * 2. Ensures userType is 'interviewer' (not company_admin or super_admin)
 * 3. Sets companyCode to TEST001
 * 4. Assigns the interviewer to the specified survey
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config();

// Reference user ID to copy data from
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';

// Create interviewer user and assign to survey
const createAndAssignInterviewer = async (userData) => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Fetch reference user to copy data from
    console.log(`📋 Fetching reference user: ${REFERENCE_USER_ID}...`);
    const referenceUser = await User.findById(REFERENCE_USER_ID);
    
    if (!referenceUser) {
      throw new Error(`Reference user ${REFERENCE_USER_ID} not found`);
    }
    console.log(`✅ Found reference user: ${referenceUser.firstName} ${referenceUser.lastName}\n`);

    // Find a company admin user to use as assignedBy for survey assignment
    const companyAdmin = await User.findOne({
      userType: 'company_admin',
      companyCode: COMPANY_CODE,
      status: 'active'
    });

    if (!companyAdmin) {
      console.log('⚠️  No company admin found, will use reference user for assignment\n');
    }

    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;

    // Check if user already exists
    let existingUser = await User.findOne({ 
      $or: [
        { email: userData.email.toLowerCase() },
        { phone: userData.phone },
        { memberId: userData.memberId }
      ]
    }).select('+password');

    if (existingUser) {
      console.log(`⚠️  User already exists:`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Phone: ${existingUser.phone}`);
      console.log(`   MemberId: ${existingUser.memberId || 'N/A'}`);
      console.log(`   User ID: ${existingUser._id}`);
      console.log(`   UserType: ${existingUser.userType}`);
      console.log(`\n   Updating existing user with correct settings...\n`);
      
      // Hash password using bcrypt with salt rounds 12
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Update the existing user - ensure userType is interviewer and companyCode is TEST001
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            email: userData.email.toLowerCase(),
            phone: userData.phone,
            memberId: userData.memberId,
            userType: 'interviewer', // Ensure it's interviewer, not company_admin or super_admin
            interviewModes: 'CATI (Telephonic interview)',
            password: hashedPassword,
            companyCode: COMPANY_CODE, // Always set to TEST001
            status: 'active',
            isActive: true
          }
        }
      );
      
      // Reload the user
      existingUser = await User.findById(existingUser._id).select('+password');
      
      // Verify password
      const passwordValid = await existingUser.comparePassword(userData.password);
      if (!passwordValid) {
        console.log('⚠️  Password verification failed. Retrying...');
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(userData.password, retrySalt);
        await User.updateOne(
          { _id: existingUser._id },
          { $set: { password: retryHashedPassword } }
        );
        existingUser = await User.findById(existingUser._id).select('+password');
        const retryValid = await existingUser.comparePassword(userData.password);
        if (!retryValid) {
          throw new Error('Failed to set password correctly');
        }
        console.log('✅ Password retry successful\n');
      }
      
      // Update interviewer profile
      if (!existingUser.interviewerProfile) {
        existingUser.interviewerProfile = {};
      }
      existingUser.interviewerProfile.approvalStatus = 'approved';
      existingUser.interviewerProfile.approvalFeedback = 'Test account - Auto approved for CATI';
      existingUser.interviewerProfile.approvedBy = referenceUser.interviewerProfile?.approvedBy || assignedBy;
      existingUser.interviewerProfile.approvedAt = new Date();
      existingUser.interviewerProfile.lastSubmittedAt = new Date();
      
      // Copy missing fields from reference user
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
          if (!existingUser.interviewerProfile[field] && referenceUser.interviewerProfile[field]) {
            existingUser.interviewerProfile[field] = referenceUser.interviewerProfile[field];
          }
        });
        // Set defaults if still missing
        if (!existingUser.interviewerProfile.age) existingUser.interviewerProfile.age = 28;
        if (!existingUser.interviewerProfile.gender) existingUser.interviewerProfile.gender = 'male';
        if (!existingUser.interviewerProfile.languagesSpoken || existingUser.interviewerProfile.languagesSpoken.length === 0) {
          existingUser.interviewerProfile.languagesSpoken = ['Hindi', 'English'];
        }
        if (!existingUser.interviewerProfile.highestDegree) {
          existingUser.interviewerProfile.highestDegree = {
            name: 'B.Tech',
            institution: 'NIT',
            year: 2019
          };
        }
        existingUser.interviewerProfile.bankAccountHolderName = `${(existingUser.firstName || 'CATI').toUpperCase()} ${(existingUser.lastName || 'INTERVIEWER').toUpperCase()}`;
      }
      
      // Ensure company is set
      if (!existingUser.company) {
        existingUser.company = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');
      }
      
      // Copy other missing fields
      if (!existingUser.profile || Object.keys(existingUser.profile).length === 0) {
        existingUser.profile = referenceUser.profile || { languages: [], education: [], experience: [] };
      }
      if (!existingUser.preferences || Object.keys(existingUser.preferences).length === 0) {
        existingUser.preferences = referenceUser.preferences;
      }
      if (!existingUser.performance || Object.keys(existingUser.performance).length === 0) {
        existingUser.performance = referenceUser.performance;
      }
      
      await existingUser.save({ runValidators: false });
      
      const finalUser = await User.findById(existingUser._id).select('+password');
      const finalPasswordCheck = await finalUser.comparePassword(userData.password);
      
      console.log(`✅ Updated user: ${finalUser.firstName || 'N/A'} ${finalUser.lastName || 'N/A'} (${finalUser.email})`);
      console.log(`   MemberId: ${finalUser.memberId}`);
      console.log(`   User ID: ${finalUser._id}`);
      console.log(`   UserType: ${finalUser.userType}`);
      console.log(`   CompanyCode: ${finalUser.companyCode}`);
      console.log(`   Interview Mode: ${finalUser.interviewModes}`);
      console.log(`   Status: ${finalUser.status}`);
      console.log(`   Password verified: ${finalPasswordCheck ? '✅' : '❌'}\n`);

      // Assign to survey
      await assignToSurvey(finalUser._id, assignedBy);
      
      console.log('\n📋 Login Credentials:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email: ${finalUser.email}`);
      console.log(`Password: ${userData.password}`);
      console.log(`Phone: ${finalUser.phone}`);
      console.log(`MemberId: ${finalUser.memberId}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      await mongoose.disconnect();
      return { success: true, user: finalUser, memberId: finalUser.memberId, isUpdate: true };
    }

    // Create new user
    console.log(`📝 Creating new user with memberId: ${userData.memberId}\n`);

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Get company ID from reference user or default
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    // Create user object - ensure userType is interviewer
    const newUser = new User({
      firstName: userData.firstName || 'CATI',
      lastName: userData.lastName || 'Interviewer',
      email: userData.email.toLowerCase(),
      phone: userData.phone,
      password: hashedPassword,
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer', // Always interviewer, not company_admin or super_admin
      interviewModes: 'CATI (Telephonic interview)',
      canSelectMode: referenceUser.canSelectMode || false,
      company: companyId,
      companyCode: COMPANY_CODE, // Always TEST001
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
        bankAccountHolderName: `${(userData.firstName || 'CATI').toUpperCase()} ${(userData.lastName || 'INTERVIEWER').toUpperCase()}`,
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
        approvalFeedback: 'Test account - Auto approved for CATI',
        approvedBy: referenceUser.interviewerProfile?.approvedBy || assignedBy,
        approvedAt: new Date(),
        lastSubmittedAt: new Date()
      },
      loginAttempts: 0,
      assignedTeamMembers: []
    });

    // Save user
    await newUser.save({ runValidators: false });
    
    // Verify password
    const savedUser = await User.findById(newUser._id).select('+password');
    const passwordValid = await savedUser.comparePassword(userData.password);
    
    if (!passwordValid) {
      console.log('⚠️  Password verification failed. Manually hashing...');
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(userData.password, retrySalt);
      await User.updateOne(
        { _id: savedUser._id },
        { $set: { password: retryHashedPassword } }
      );
      const retryUser = await User.findById(savedUser._id).select('+password');
      const retryValid = await retryUser.comparePassword(userData.password);
      if (!retryValid) {
        throw new Error('Failed to set password correctly');
      }
      console.log('✅ Password manually set and verified\n');
    }
    
    console.log(`✅ Created user: ${savedUser.firstName} ${savedUser.lastName} (${savedUser.email})`);
    console.log(`   MemberId: ${savedUser.memberId}`);
    console.log(`   User ID: ${savedUser._id}`);
    console.log(`   UserType: ${savedUser.userType}`);
    console.log(`   CompanyCode: ${savedUser.companyCode}`);
    console.log(`   Interview Mode: ${savedUser.interviewModes}`);
    console.log(`   Status: ${savedUser.status}`);
    console.log(`   Password verified: ${passwordValid ? '✅' : '❌'}\n`);

    // Assign to survey
    await assignToSurvey(savedUser._id, assignedBy);
    
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${savedUser.email}`);
    console.log(`Password: ${userData.password}`);
    console.log(`Phone: ${savedUser.phone}`);
    console.log(`MemberId: ${savedUser.memberId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    return { success: true, user: savedUser, memberId: savedUser.memberId };
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    return { success: false, error: error.message };
  }
};

// Assign interviewer to survey
const assignToSurvey = async (interviewerId, assignedById) => {
  try {
    console.log(`📋 Assigning interviewer to survey: ${SURVEY_ID}...`);
    
    // Find survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    
    console.log(`✅ Found survey: ${survey.surveyName || survey._id}\n`);
    
    // Check if interviewer is already assigned
    const existingAssignment = survey.catiInterviewers?.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      console.log(`⚠️  Interviewer already assigned to this survey`);
      console.log(`   Status: ${existingAssignment.status}`);
      console.log(`   Assigned at: ${existingAssignment.assignedAt}\n`);
      return;
    }
    
    // Add to catiInterviewers array
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
    
    console.log(`✅ Interviewer assigned to survey successfully!\n`);
  } catch (error) {
    console.error(`❌ Error assigning to survey:`, error.message);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    // User data
    const userData = {
      memberId: '11223',
      email: '11223@gmail.com',
      phone: '9958011332',
      password: '9958011332', // Same as phone number
      firstName: 'CATI',
      lastName: 'Interviewer'
    };

    const result = await createAndAssignInterviewer(userData);
    
    if (result.success) {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Script failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
};

// Run script
if (require.main === module) {
  main();
}

module.exports = { createAndAssignInterviewer, assignToSurvey };











