/**
 * Script to add approved CAPI interviewer users with specific member IDs and AC assignments
 * 
 * Creates CAPI interviewers with:
 * - Interview Mode: CAPI (Face To Face)
 * - AC (Assembly Constituency) assignments
 * - State: West Bengal
 * - Assigned to survey: 68fd1915d41841da463f0d46
 * 
 * Can run on both local and production servers
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config();

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const COUNTRY = 'India';

// Interviewer data with specific member IDs
const interviewersData = [
  {
    memberId: '5010',
    name: 'Kanhaiya Kumar',
    phone: '7004615861',
    email: '5010@gmail.com', // Generated email since not provided
    location: 'Howrah Madhya'
  },
  {
    memberId: '5011',
    name: 'Shamsher Alam',
    phone: '7541058361',
    email: '5011@gmail.com', // Generated email since not provided
    location: 'Howrah Madhya'
  },
  {
    memberId: '5012',
    name: 'Arun Singh',
    phone: '7004066145',
    email: 'sarun9924@gmail.com',
    location: 'Howrah'
  }
];

// Create interviewer user
const createInterviewer = async (userData, referenceUser, assignedBy) => {
  try {
    // Split name into firstName and lastName
    const nameParts = userData.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'CAPI';
    const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: userData.email.toLowerCase() },
        { phone: userData.phone },
        { memberId: userData.memberId }
      ]
    }).select('+password');

    if (existingUser) {
      // Update existing user
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.phone, salt);
      
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            firstName: firstName,
            lastName: lastName,
            email: userData.email.toLowerCase(),
            phone: userData.phone,
            memberId: userData.memberId, // Use the specified member ID
            userType: 'interviewer',
            interviewModes: 'CAPI (Face To Face)',
            password: hashedPassword,
            companyCode: COMPANY_CODE,
            status: 'active',
            isActive: true
          }
        }
      );
      
      const updatedUser = await User.findById(existingUser._id).select('+password');
      const passwordValid = await updatedUser.comparePassword(userData.phone);
      
      if (!passwordValid) {
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(userData.phone, retrySalt);
        await User.updateOne(
          { _id: existingUser._id },
          { $set: { password: retryHashedPassword } }
        );
      }
      
      // Update interviewer profile
      if (!updatedUser.interviewerProfile) {
        updatedUser.interviewerProfile = {};
      }
      updatedUser.interviewerProfile.approvalStatus = 'approved';
      updatedUser.interviewerProfile.approvalFeedback = 'Approved for CAPI';
      updatedUser.interviewerProfile.approvedBy = referenceUser.interviewerProfile?.approvedBy || assignedBy;
      updatedUser.interviewerProfile.approvedAt = new Date();
      updatedUser.interviewerProfile.lastSubmittedAt = new Date();
      
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
      return { success: true, user: updatedUser, isUpdate: true };
    }

    // Create new user
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(userData.phone, salt);
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: userData.email.toLowerCase(),
      phone: userData.phone,
      password: hashedPassword,
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: referenceUser.canSelectMode || false,
      company: companyId,
      companyCode: COMPANY_CODE,
      memberId: userData.memberId, // Use the specified member ID
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
    
    // Verify password
    const savedUser = await User.findById(newUser._id).select('+password');
    const passwordValid = await savedUser.comparePassword(userData.phone);
    
    if (!passwordValid) {
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(userData.phone, retrySalt);
      await User.updateOne(
        { _id: savedUser._id },
        { $set: { password: retryHashedPassword } }
      );
    }
    
    return { success: true, user: savedUser, isUpdate: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Assign CAPI interviewer to survey with AC
const assignToSurvey = async (interviewerId, assignedById, acName) => {
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
      // Update existing assignment with AC
      existingAssignment.assignedACs = [acName];
      existingAssignment.selectedState = STATE;
      existingAssignment.selectedCountry = COUNTRY;
      existingAssignment.assignedBy = assignedById;
      existingAssignment.assignedAt = new Date();
      existingAssignment.status = 'assigned';
      await survey.save();
      return; // Already assigned and updated
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
  } catch (error) {
    console.error(`Error assigning to survey: ${error.message}`);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`); // Hide credentials
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Fetch reference user
    console.log(`📋 Fetching reference user: ${REFERENCE_USER_ID}...`);
    const referenceUser = await User.findById(REFERENCE_USER_ID);
    if (!referenceUser) {
      throw new Error(`Reference user ${REFERENCE_USER_ID} not found`);
    }
    console.log(`✅ Found reference user: ${referenceUser.firstName} ${referenceUser.lastName}\n`);

    // Find company admin for assignment
    const companyAdmin = await User.findOne({
      userType: 'company_admin',
      companyCode: COMPANY_CODE,
      status: 'active'
    });
    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;

    console.log(`🚀 Starting creation of CAPI interviewers with specific IDs...\n`);
    console.log('='.repeat(80));

    const results = [];
    const createdUsers = [];

    for (let i = 0; i < interviewersData.length; i++) {
      const userData = interviewersData[i];
      const progress = `[${i + 1}/${interviewersData.length}]`;
      
      try {
        const result = await createInterviewer(userData, referenceUser, assignedBy);
        
        if (result.success) {
          // Assign to survey with AC
          await assignToSurvey(result.user._id, assignedBy, userData.location);
          
          const fullName = `${userData.name}`;
          results.push({
            ...result,
            userData,
            fullName
          });
          
          createdUsers.push({
            interviewerID: userData.memberId,
            Password: userData.phone,
            Name: fullName,
            Email: userData.email,
            AC: userData.location,
            State: STATE
          });
          
          console.log(`${progress} ✅ ${fullName} (${userData.memberId}) - ${result.isUpdate ? 'Updated' : 'Created'} - AC: ${userData.location}`);
        } else {
          console.log(`${progress} ❌ ${userData.name}: ${result.error}`);
          results.push({ ...result, userData });
        }
      } catch (error) {
        console.log(`${progress} ❌ ${userData.name}: ${error.message}`);
        results.push({ success: false, error: error.message, userData });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary:');
    console.log('='.repeat(80));
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successfully processed: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}\n`);

    // Output all created users
    console.log('📋 All Created CAPI Interviewers:');
    console.log('='.repeat(80));
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. InterviewerID: ${user.interviewerID}`);
      console.log(`   Password: ${user.Password}`);
      console.log(`   Name: ${user.Name}`);
      console.log(`   Email: ${user.Email}`);
      console.log(`   AC: ${user.AC}`);
      console.log(`   State: ${user.State}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n✅ Script completed!');
    
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

// Run script
if (require.main === module) {
  main();
}

module.exports = { createInterviewer, assignToSurvey };








