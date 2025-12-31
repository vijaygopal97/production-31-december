/**
 * Script to create approved CATI interviewer user
 * 
 * This script creates an interviewer user with:
 * - Specified memberId, email, phone, and password
 * - Interview Mode: CATI (Telephonic interview)
 * - Complete profile data from reference user (68ebf124ab86ea29f3c0f1f8)
 * - Approved status
 * - Properly hashed password using bcrypt
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Reference user ID to copy data from
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';

// Create interviewer user
const createInterviewer = async (userData) => {
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
      console.log(`\n   Updating existing user with CATI mode and correct settings...\n`);
      
      // Hash password using bcrypt with salt rounds 12 (same as User model)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Validate and adjust memberId if needed (must be exactly 6 digits)
      let memberId = userData.memberId;
      if (memberId && memberId.length !== 6) {
        if (memberId.length > 6) {
          // Use last 6 digits if longer
          memberId = memberId.slice(-6);
          console.log(`⚠️  MemberId adjusted to 6 digits: ${memberId}\n`);
        } else {
          // Pad with zeros if shorter
          memberId = memberId.padStart(6, '0');
          console.log(`⚠️  MemberId padded to 6 digits: ${memberId}\n`);
        }
      }

      // Update the existing user using updateOne to ensure password is saved correctly
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            email: userData.email.toLowerCase(),
            phone: userData.phone,
            memberId: memberId,
            interviewModes: 'CATI (Telephonic interview)',
            password: hashedPassword, // Manually hashed password
            status: 'active',
            isActive: true
          }
        }
      );
      
      // Reload the user to get updated data (with password field for verification)
      existingUser = await User.findById(existingUser._id).select('+password');
      
      // Verify password was set correctly
      const passwordValid = await existingUser.comparePassword(userData.password);
      if (!passwordValid) {
        console.log('⚠️  Warning: Password verification failed after update. Retrying...');
        // Retry password update
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
      existingUser.interviewerProfile.approvedBy = referenceUser.interviewerProfile?.approvedBy || new mongoose.Types.ObjectId('68d707f3926fa2d374b316e2');
      existingUser.interviewerProfile.approvedAt = new Date();
      existingUser.interviewerProfile.lastSubmittedAt = new Date();
      
      // Copy missing fields from reference user
      if (referenceUser.interviewerProfile) {
        if (!existingUser.interviewerProfile.age) existingUser.interviewerProfile.age = referenceUser.interviewerProfile.age || 28;
        if (!existingUser.interviewerProfile.gender) existingUser.interviewerProfile.gender = referenceUser.interviewerProfile.gender || 'male';
        if (!existingUser.interviewerProfile.languagesSpoken || existingUser.interviewerProfile.languagesSpoken.length === 0) {
          existingUser.interviewerProfile.languagesSpoken = referenceUser.interviewerProfile.languagesSpoken || ['Hindi', 'English'];
        }
        if (!existingUser.interviewerProfile.highestDegree) {
          existingUser.interviewerProfile.highestDegree = referenceUser.interviewerProfile.highestDegree || {
            name: 'B.Tech',
            institution: 'NIT',
            year: 2019
          };
        }
        // Copy other fields if missing
        const fieldsToCopy = [
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
        // Update bank account holder name
        const firstName = existingUser.firstName || 'User';
        const lastName = existingUser.lastName || 'Name';
        existingUser.interviewerProfile.bankAccountHolderName = `${firstName.toUpperCase()} ${lastName.toUpperCase()}`;
      }
      
      // Copy other missing fields from reference user
      if (!existingUser.company) existingUser.company = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');
      if (!existingUser.companyCode) existingUser.companyCode = referenceUser.companyCode || 'TEST001';
      if (!existingUser.profile || Object.keys(existingUser.profile).length === 0) {
        existingUser.profile = referenceUser.profile || { languages: [], education: [], experience: [] };
      }
      if (!existingUser.preferences || Object.keys(existingUser.preferences).length === 0) {
        existingUser.preferences = referenceUser.preferences;
      }
      if (!existingUser.performance || Object.keys(existingUser.performance).length === 0) {
        existingUser.performance = referenceUser.performance;
      }
      
      // Save other profile updates
      await existingUser.save({ runValidators: false });
      
      // Final verification
      const finalUser = await User.findById(existingUser._id).select('+password');
      const finalPasswordCheck = await finalUser.comparePassword(userData.password);
      
      console.log(`✅ Updated user: ${finalUser.firstName || 'N/A'} ${finalUser.lastName || 'N/A'} (${finalUser.email})`);
      console.log(`   MemberId: ${finalUser.memberId || 'N/A'}`);
      console.log(`   User ID: ${finalUser._id}`);
      console.log(`   Interview Mode: ${finalUser.interviewModes}`);
      console.log(`   Status: ${finalUser.status}`);
      console.log(`   Password verified: ${finalPasswordCheck ? '✅' : '❌'}`);
      
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

    // Validate and adjust memberId if needed (must be exactly 6 digits)
    let memberId = userData.memberId;
    if (memberId && memberId.length !== 6) {
      if (memberId.length > 6) {
        // Use last 6 digits if longer
        memberId = memberId.slice(-6);
        console.log(`⚠️  MemberId adjusted to 6 digits: ${memberId}\n`);
      } else {
        // Pad with zeros if shorter
        memberId = memberId.padStart(6, '0');
        console.log(`⚠️  MemberId padded to 6 digits: ${memberId}\n`);
      }
    }

    // Create new user
    console.log(`📝 Creating new user with memberId: ${memberId}\n`);

    // Hash password first
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create user object
    const newUser = new User({
      firstName: userData.firstName || 'CATI',
      lastName: userData.lastName || 'Interviewer',
      email: userData.email.toLowerCase(),
      phone: userData.phone,
      password: hashedPassword, // Manually hashed password
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CATI (Telephonic interview)',
      canSelectMode: referenceUser.canSelectMode || false,
      company: referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
      companyCode: referenceUser.companyCode || 'TEST001',
      memberId: memberId,
      profile: referenceUser.profile || {
        languages: [],
        education: [],
        experience: []
      },
      documents: referenceUser.documents || {
        aadhaar: {
          isVerified: false
        },
        pan: {
          isVerified: false
        },
        drivingLicense: {
          isVerified: false
        },
        bankDetails: {
          isVerified: false
        }
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
        approvedBy: referenceUser.interviewerProfile?.approvedBy || new mongoose.Types.ObjectId('68d707f3926fa2d374b316e2'),
        approvedAt: new Date(),
        lastSubmittedAt: new Date()
      },
      loginAttempts: 0,
      assignedTeamMembers: []
    });

    // Save user
    await newUser.save({ runValidators: false });
    
    // Verify password was hashed correctly
    const savedUser = await User.findById(newUser._id).select('+password');
    const passwordValid = await savedUser.comparePassword(userData.password);
    
    if (!passwordValid) {
      console.log('⚠️  Warning: Password verification failed. Manually hashing...');
      // Manually hash and update if pre-save hook didn't work
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
    console.log(`   Interview Mode: ${savedUser.interviewModes}`);
    console.log(`   Status: ${savedUser.status}`);
    console.log(`   Password verified: ${passwordValid ? '✅' : '❌'}`);
    
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

// Main execution
const main = async () => {
  try {
    // User data
    const userData = {
      memberId: '1177007',
      email: '1177007@gmail.com',
      phone: '9958011332',
      password: '9958011332', // Password same as phone number
      firstName: 'CATI',
      lastName: 'Interviewer'
    };

    const result = await createInterviewer(userData);
    
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

module.exports = { createInterviewer };











