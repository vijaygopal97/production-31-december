/**
 * Script to bulk create approved CATI interviewer users from CSV
 * 
 * CSV Format:
 * - Column 1: teleform_user_id (memberId)
 * - Column 2: name (full name - split into firstName and lastName)
 * - Column 3: mobile_number (phone and password)
 * 
 * Creates users with:
 * - memberId from column 1
 * - firstName and lastName from column 2
 * - phone and password from column 3
 * - email: {memberId}@gmail.com
 * - userType: interviewer
 * - companyCode: TEST001
 * - interviewModes: CATI (Telephonic interview)
 * - Approved status
 * - Assigned to survey 68fd1915d41841da463f0d46
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config();

// Reference user ID to copy data from
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const CSV_PATH = '/var/www/opine/frontend/src/data/CATI Caller list.csv';

// Parse CSV file
const parseCSV = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header row
    const dataLines = lines.slice(1);
    
    const users = [];
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      // Parse CSV line (handle commas in names)
      const parts = [];
      let currentPart = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(currentPart.trim());
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart.trim());
      
      if (parts.length >= 3) {
        const teleformUserId = parts[0].trim();
        const name = parts[1].trim();
        const mobileNumber = parts[2].trim();
        
        if (teleformUserId && name && mobileNumber) {
          // Split name into firstName and lastName
          const nameParts = name.split(/\s+/);
          const firstName = nameParts[0] || 'CATI';
          const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
          
          users.push({
            memberId: teleformUserId,
            firstName: firstName,
            lastName: lastName,
            phone: mobileNumber,
            password: mobileNumber,
            email: `${teleformUserId}@gmail.com`
          });
        }
      }
    }
    
    return users;
  } catch (error) {
    throw new Error(`Error parsing CSV: ${error.message}`);
  }
};

// Create interviewer user
const createInterviewer = async (userData, referenceUser, assignedBy) => {
  try {
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
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email.toLowerCase(),
            phone: userData.phone,
            memberId: userData.memberId,
            userType: 'interviewer',
            interviewModes: 'CATI (Telephonic interview)',
            password: hashedPassword,
            companyCode: COMPANY_CODE,
            status: 'active',
            isActive: true
          }
        }
      );
      
      const updatedUser = await User.findById(existingUser._id).select('+password');
      const passwordValid = await updatedUser.comparePassword(userData.password);
      
      if (!passwordValid) {
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(userData.password, retrySalt);
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
      updatedUser.interviewerProfile.approvalFeedback = 'Bulk import - Auto approved for CATI';
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
        updatedUser.interviewerProfile.bankAccountHolderName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
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
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      phone: userData.phone,
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
        bankAccountHolderName: `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`,
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
        approvalFeedback: 'Bulk import - Auto approved for CATI',
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
    const passwordValid = await savedUser.comparePassword(userData.password);
    
    if (!passwordValid) {
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(userData.password, retrySalt);
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

// Assign interviewer to survey
const assignToSurvey = async (interviewerId, assignedById) => {
  try {
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    
    // Check if already assigned
    const existingAssignment = survey.catiInterviewers?.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      return; // Already assigned
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

    // Parse CSV
    console.log(`📄 Reading CSV file: ${CSV_PATH}...`);
    const usersData = parseCSV(CSV_PATH);
    console.log(`✅ Found ${usersData.length} users in CSV\n`);

    console.log(`🚀 Starting bulk creation...\n`);
    console.log('='.repeat(80));

    const results = [];
    const createdUsers = [];

    for (let i = 0; i < usersData.length; i++) {
      const userData = usersData[i];
      const progress = `[${i + 1}/${usersData.length}]`;
      
      try {
        const result = await createInterviewer(userData, referenceUser, assignedBy);
        
        if (result.success) {
          // Assign to survey
          await assignToSurvey(result.user._id, assignedBy);
          
          const fullName = `${userData.firstName} ${userData.lastName}`;
          results.push({
            ...result,
            userData,
            fullName
          });
          
          createdUsers.push({
            interviewerID: userData.memberId,
            Password: userData.password,
            Name: fullName
          });
          
          console.log(`${progress} ✅ ${fullName} (${userData.memberId}) - ${result.isUpdate ? 'Updated' : 'Created'}`);
        } else {
          console.log(`${progress} ❌ ${userData.firstName} ${userData.lastName} (${userData.memberId}): ${result.error}`);
          results.push({ ...result, userData });
        }
      } catch (error) {
        console.log(`${progress} ❌ ${userData.firstName} ${userData.lastName} (${userData.memberId}): ${error.message}`);
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

    // Output all created users in requested format
    console.log('📋 All Created Users:');
    console.log('='.repeat(80));
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. InterviewerID: ${user.interviewerID}`);
      console.log(`   Password: ${user.Password}`);
      console.log(`   Name: ${user.Name}`);
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

module.exports = { createInterviewer, assignToSurvey, parseCSV };











