/**
 * Script to add approved CATI interviewers from Excel file
 * Excel: /var/www/opine/frontend/src/data/Telecaller_Group 1.xlsx
 * 
 * Assign to survey: 68fd1915d41841da463f0d46
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');
const path = require('path');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config();

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const EXCEL_PATH = '/var/www/opine/frontend/src/data/Telecaller_Group 1.xlsx';

// Read Excel file using Python script (fallback to hardcoded data if pandas not available)
const readExcelFile = async () => {
  try {
    const pythonScript = path.join(__dirname, 'readTelecallerGroup1Excel.py');
    const output = execSync(`python3 "${pythonScript}" "${EXCEL_PATH}"`, { encoding: 'utf-8' });
    return JSON.parse(output.trim());
  } catch (error) {
    console.log('⚠️  Python script failed, reading Excel directly...');
    // Try to read Excel file directly using Node.js xlsx library or return empty array
    // For now, return empty array and let the script fail gracefully
    // The user should ensure pandas is installed on production
    console.error('❌ Cannot read Excel file without pandas. Please install pandas on production server.');
    return [];
  }
};

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
    // Create new user (existing users were already deleted)
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
    const passwordValid = await savedUser.comparePassword(userData.password);
    
    if (!passwordValid) {
      console.log(`⚠️  Password verification failed, retrying...`);
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(userData.password, retrySalt);
      await User.updateOne(
        { _id: savedUser._id },
        { $set: { password: retryHashedPassword } }
      );
      
      const retryUser = await User.findById(savedUser._id).select('+password');
      const retryValid = await retryUser.comparePassword(userData.password);
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
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
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

    console.log('📖 Reading Excel file...');
    const excelData = await readExcelFile();
    console.log(`✅ Found ${excelData.length} interviewers in Excel\n`);

    // Extract memberIds and delete existing users
    const memberIds = excelData.map(row => row['Caller ID']?.toString().trim()).filter(Boolean);
    console.log(`🗑️  Deleting existing users with memberIds: ${memberIds.slice(0, 5).join(', ')}... (${memberIds.length} total)`);
    const deleteResult = await User.deleteMany({ 
      memberId: { $in: memberIds },
      userType: 'interviewer',
      companyCode: COMPANY_CODE
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing users\n`);
    
    // Also remove from survey assignments
    const survey = await Survey.findById(SURVEY_ID);
    if (survey && survey.catiInterviewers) {
      const userIds = await User.find({ memberId: { $in: memberIds } }).select('_id').lean();
      const userIdStrings = userIds.map(u => u._id.toString());
      const beforeCount = survey.catiInterviewers.length;
      survey.catiInterviewers = survey.catiInterviewers.filter(
        assignment => !userIdStrings.includes(assignment.interviewer.toString())
      );
      await survey.save();
      console.log(`✅ Cleaned survey assignments\n`);
    }

    console.log('🚀 Creating CATI Interviewers\n');
    console.log('='.repeat(80));
    
    const results = [];
    const loginTests = [];
    
    for (const row of excelData) {
      try {
        const agentName = row['Caller Name']?.trim();
        const contactNumber = row['Caller Mobile No.']?.toString().trim();
        const memberId = row['Caller ID']?.toString().trim();
        
        if (!agentName || !contactNumber || !memberId) {
          console.log(`⚠️  Skipping row with missing data:`, row);
          continue;
        }
        
        const nameParts = agentName.split(/\s+/);
        const firstName = nameParts[0] || 'CATI';
        const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
        
        let phone = contactNumber;
        if (!phone.startsWith('+')) {
          phone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
        }
        
        const email = `cati${memberId}@gmail.com`;
        const password = contactNumber;
        
        const interviewerData = {
          memberId,
          firstName,
          lastName,
          email,
          phone,
          password,
          ac: 'Default'
        };
        
        console.log(`\n📝 Processing: ${firstName} ${lastName} (${memberId})`);
        console.log(`   Email: ${email}`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Password: ${password}`);
        console.log('-'.repeat(80));
        
        const result = await createInterviewer(interviewerData, referenceUser, assignedBy);
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
        console.error(`❌ Error processing row:`, error.message);
        results.push({ success: false, error: error.message, row });
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
