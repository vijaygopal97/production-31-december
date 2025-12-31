/**
 * Import Project Managers and CAPI Interviewers from Excel File
 * 
 * This script:
 * 1. Reads Excel file with project manager tabs
 * 2. Creates/updates project managers
 * 3. Creates/updates CAPI interviewers from each tab
 * 4. Assigns interviewers to survey and project managers
 * 5. Tests all logins
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const path = require('path');
const User = require('../models/User');
const Survey = require('../models/Survey');
const Company = require('../models/Company');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const EXCEL_FILE_PATH = '/var/www/New app Registration Update file with north bengal team (1).xlsx';
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8'; // Reference interviewer
const REFERENCE_PM_ID = '6930b86b2eb7303ea516f8b9'; // Reference project manager
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const COUNTRY = 'India';

// Project Manager name mappings (Excel tab name -> PM data)
const PROJECT_MANAGER_MAPPINGS = {
  'Abdur Rakib ': { firstName: 'Abdur', lastName: 'Rakib', email: 'abdur.rakib@convergent.com', phone: '9999999001' },
  'Bikash Ch Sarkar ': { firstName: 'Bikash', lastName: 'Ch Sarkar', email: 'bikash.sarkar@convergent.com', phone: '9999999002' },
  'Krishna Das- Agency ': { firstName: 'Krishna', lastName: 'Das', email: 'krishna.das@convergent.com', phone: '9999999003' },
  'Dulal Ch Roy ': { firstName: 'Dulal', lastName: 'Ch Roy', email: 'dulal.roy@convergent.com', phone: '9999999004' },
  'Sibsankar Giri ': { firstName: 'Sibsankar', lastName: 'Giri', email: 'sibsankar.giri@convergent.com', phone: '9999999005' }
};

// Test login function
const testLogin = async (email, password) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return { success: false, error: 'User not found' };
    const isValid = await user.comparePassword(password);
    return { success: isValid, user: isValid ? { email: user.email, firstName: user.firstName, lastName: user.lastName, userType: user.userType } : null, error: isValid ? null : 'Invalid password' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Create or update project manager
const createOrUpdateProjectManager = async (pmData, referencePM) => {
  try {
    const existingPM = await User.findOne({
      $or: [
        { email: pmData.email.toLowerCase() },
        { firstName: pmData.firstName, lastName: pmData.lastName, userType: 'project_manager' }
      ]
    });

    if (existingPM) {
      console.log(`   ⚠️  PM already exists. Updating...`);
      // Update existing PM
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(pmData.password, salt);
      
      await User.updateOne(
        { _id: existingPM._id },
        {
          $set: {
            firstName: pmData.firstName,
            lastName: pmData.lastName,
            email: pmData.email.toLowerCase(),
            phone: pmData.phone,
            password: hashedPassword,
            userType: 'project_manager',
            company: referencePM.company._id,
            companyCode: referencePM.companyCode,
            status: 'active',
            isEmailVerified: true,
            isPhoneVerified: true
          }
        }
      );
      
      const updatedPM = await User.findById(existingPM._id);
      return { user: updatedPM, isNew: false };
    } else {
      // Create new PM
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(pmData.password, salt);
      
      const newPM = new User({
        firstName: pmData.firstName,
        lastName: pmData.lastName,
        email: pmData.email.toLowerCase(),
        phone: pmData.phone,
        password: hashedPassword,
        userType: 'project_manager',
        company: referencePM.company._id,
        companyCode: referencePM.companyCode,
        assignedTeamMembers: [],
        status: 'active',
        isEmailVerified: true,
        isPhoneVerified: true
      });
      
      const savedPM = await newPM.save();
      return { user: savedPM, isNew: true };
    }
  } catch (error) {
    console.error(`   ❌ Error creating/updating PM: ${error.message}`);
    throw error;
  }
};

// Create or update CAPI interviewer
const createOrUpdateInterviewer = async (interviewerData, referenceUser, assignedBy) => {
  try {
    const nameParts = interviewerData.name.split(/\s+/).filter(p => p.trim());
    const firstName = nameParts[0] || 'CAPI';
    const lastName = nameParts.slice(1).join(' ') || 'Interviewer';
    
    // Phone number should NOT have country code (strictly no +91)
    let phone = String(interviewerData.phone || '').trim();
    phone = phone.replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
    
    if (!phone || phone.length < 10) {
      throw new Error(`Invalid phone number: ${interviewerData.phone}`);
    }
    
    const password = phone; // Password is phone number without country code
    
    // Generate email if not provided
    const email = interviewerData.email && interviewerData.email.trim() 
      ? interviewerData.email.trim().toLowerCase().replace(/\s+/g, '')
      : `capi${interviewerData.memberId}@gmail.com`;
    
    const existingUser = await User.findOne({
      $or: [
        { memberId: String(interviewerData.memberId) },
        { email: email },
        { phone: phone }
      ]
    }).select('+password');

    if (existingUser) {
      console.log(`   ⚠️  Interviewer exists (${interviewerData.memberId}). Updating...`);
      
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone,
            memberId: String(interviewerData.memberId),
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
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(password, retrySalt);
        await User.updateOne({ _id: existingUser._id }, { $set: { password: retryHashedPassword } });
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
        const fieldsToCopy = ['age', 'gender', 'languagesSpoken', 'highestDegree', 'hasSurveyExperience', 'surveyExperienceYears', 'surveyExperienceDescription', 'cvUpload', 'ownsSmartphone', 'smartphoneType', 'androidVersion', 'iosVersion', 'willingToTravel', 'hasVehicle', 'willingToRecordAudio', 'agreesToRemuneration', 'bankAccountNumber', 'bankName', 'bankIfscCode', 'bankDocumentUpload', 'aadhaarNumber', 'aadhaarDocument', 'panNumber', 'panDocument', 'passportPhoto', 'agreesToShareInfo', 'agreesToParticipateInSurvey'];
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
          updatedUser.interviewerProfile.highestDegree = { name: 'B.Tech', institution: 'NIT', year: 2019 };
        }
        updatedUser.interviewerProfile.bankAccountHolderName = `${firstName.toUpperCase()} ${lastName.toUpperCase()}`;
      }
      
      await updatedUser.save({ runValidators: false });
      return { user: updatedUser, isNew: false };
    }

    // Create new interviewer
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const companyId = referenceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: hashedPassword,
      isEmailVerified: referenceUser.isEmailVerified || false,
      isPhoneVerified: referenceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: referenceUser.canSelectMode || false,
      company: companyId,
      companyCode: COMPANY_CODE,
      memberId: String(interviewerData.memberId),
      profile: referenceUser.profile || { languages: [], education: [], experience: [] },
      documents: referenceUser.documents || { aadhaar: { isVerified: false }, pan: { isVerified: false }, drivingLicense: { isVerified: false }, bankDetails: { isVerified: false } },
      status: 'active',
      isActive: true,
      gig_availability: referenceUser.gig_availability || false,
      gig_enabled: referenceUser.gig_enabled || false,
      performance: referenceUser.performance || { trustScore: 100, totalInterviews: 0, approvedInterviews: 0, rejectedInterviews: 0, averageRating: 0, totalEarnings: 0, qualityMetrics: { audioQuality: 0, responseAccuracy: 0, timeliness: 0, professionalism: 0 } },
      preferences: referenceUser.preferences || { notifications: { email: true, sms: true, push: true, surveyAssignments: true, paymentUpdates: true, qualityFeedback: true }, workingHours: { startTime: '09:00', endTime: '18:00', workingDays: [], timezone: 'Asia/Kolkata' }, surveyPreferences: { maxDistance: 50, preferredLocations: [], minPayment: 0, maxInterviewsPerDay: 10 }, locationControlBooster: true },
      registrationSource: referenceUser.registrationSource || 'company_admin',
      training: referenceUser.training || { completedModules: [], certificationStatus: 'not_started' },
      interviewerProfile: {
        age: referenceUser.interviewerProfile?.age || 28,
        gender: referenceUser.interviewerProfile?.gender || 'male',
        languagesSpoken: referenceUser.interviewerProfile?.languagesSpoken || ['Hindi', 'English'],
        highestDegree: referenceUser.interviewerProfile?.highestDegree || { name: 'B.Tech', institution: 'NIT', year: 2019 },
        hasSurveyExperience: referenceUser.interviewerProfile?.hasSurveyExperience !== undefined ? referenceUser.interviewerProfile.hasSurveyExperience : true,
        surveyExperienceYears: referenceUser.interviewerProfile?.surveyExperienceYears || 3,
        surveyExperienceDescription: referenceUser.interviewerProfile?.surveyExperienceDescription || 'Experienced in face-to-face surveys and CAPI operations',
        cvUpload: referenceUser.interviewerProfile?.cvUpload || 'cvUpload-1764630127133-571761495.docx',
        ownsSmartphone: referenceUser.interviewerProfile?.ownsSmartphone !== undefined ? referenceUser.interviewerProfile.ownsSmartphone : true,
        smartphoneType: referenceUser.interviewerProfile?.smartphoneType || 'Both',
        androidVersion: referenceUser.interviewerProfile?.androidVersion || '13',
        iosVersion: referenceUser.interviewerProfile?.iosVersion || '',
        willingToTravel: referenceUser.interviewerProfile?.willingToTravel !== undefined ? referenceUser.interviewerProfile.willingToTravel : true,
        hasVehicle: referenceUser.interviewerProfile?.hasVehicle !== undefined ? referenceUser.interviewerProfile.hasVehicle : true,
        willingToRecordAudio: referenceUser.interviewerProfile?.willingToRecordAudio !== undefined ? referenceUser.interviewerProfile.willingToRecordAudio : true,
        agreesToRemuneration: referenceUser.interviewerProfile?.agreesToRemuneration !== undefined ? referenceUser.interviewerProfile.agreesToRemuneration : true,
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
        agreesToShareInfo: referenceUser.interviewerProfile?.agreesToShareInfo !== undefined ? referenceUser.interviewerProfile.agreesToShareInfo : true,
        agreesToParticipateInSurvey: referenceUser.interviewerProfile?.agreesToParticipateInSurvey !== undefined ? referenceUser.interviewerProfile.agreesToParticipateInSurvey : true,
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
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(password, retrySalt);
      await User.updateOne({ _id: savedUser._id }, { $set: { password: retryHashedPassword } });
    }
    
    return { user: savedUser, isNew: true };
  } catch (error) {
    console.error(`   ❌ Error creating interviewer: ${error.message}`);
    throw error;
  }
};

// Assign interviewer to survey
const assignToSurvey = async (interviewerId, assignedById) => {
  try {
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) throw new Error(`Survey ${SURVEY_ID} not found`);
    
    if (!survey.capiInterviewers) survey.capiInterviewers = [];
    
    const existingAssignment = survey.capiInterviewers.find(
      assignment => assignment.interviewer.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      return; // Already assigned
    }
    
    survey.capiInterviewers.push({
      interviewer: interviewerId,
      assignedBy: assignedById,
      assignedAt: new Date(),
      assignedACs: [],
      selectedState: STATE,
      selectedCountry: COUNTRY,
      status: 'assigned',
      maxInterviews: 0,
      completedInterviews: 0
    });
    
    await survey.save();
  } catch (error) {
    console.error(`   ❌ Error assigning to survey: ${error.message}`);
    throw error;
  }
};

// Assign interviewer to project manager
const assignToProjectManager = async (interviewerId, pmId) => {
  try {
    const pm = await User.findById(pmId);
    if (!pm) throw new Error(`Project Manager ${pmId} not found`);
    
    if (!pm.assignedTeamMembers) pm.assignedTeamMembers = [];
    
    const existingAssignment = pm.assignedTeamMembers.find(
      member => member.user && member.user.toString() === interviewerId.toString()
    );
    
    if (existingAssignment) {
      return; // Already assigned
    }
    
    pm.assignedTeamMembers.push({
      user: interviewerId,
      userType: 'interviewer',
      assignedAt: new Date(),
      assignedBy: pmId
    });
    
    await pm.save();
  } catch (error) {
    console.error(`   ❌ Error assigning to PM: ${error.message}`);
    throw error;
  }
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get reference users
    console.log(`📋 Fetching reference users...`);
    const referenceUser = await User.findById(REFERENCE_USER_ID);
    if (!referenceUser) throw new Error(`Reference user ${REFERENCE_USER_ID} not found`);
    
    const referencePM = await User.findById(REFERENCE_PM_ID).populate('company');
    if (!referencePM) throw new Error(`Reference PM ${REFERENCE_PM_ID} not found`);
    
    const companyAdmin = await User.findOne({ userType: 'company_admin', companyCode: COMPANY_CODE, status: 'active' });
    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;
    
    console.log(`✅ Found reference users\n`);

    // Read Excel file
    console.log(`📖 Reading Excel file: ${EXCEL_FILE_PATH}`);
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    console.log(`Available sheets: ${workbook.SheetNames.join(', ')}\n`);
    
    // Match sheet names (handle trailing spaces)
    const sheetNames = workbook.SheetNames.filter(name => {
      const trimmed = name.trim();
      return PROJECT_MANAGER_MAPPINGS[trimmed] || Object.keys(PROJECT_MANAGER_MAPPINGS).some(key => trimmed === key.trim());
    });
    console.log(`✅ Found ${sheetNames.length} project manager sheets\n`);

    const allCredentials = [];
    const allLoginTests = [];

    // Process each project manager sheet
    for (const sheetName of sheetNames) {
      const trimmedName = sheetName.trim();
      let pmMapping = PROJECT_MANAGER_MAPPINGS[trimmedName];
      
      if (!pmMapping) {
        // Try to find by matching trimmed keys
        const foundKey = Object.keys(PROJECT_MANAGER_MAPPINGS).find(key => key.trim() === trimmedName);
        if (foundKey) {
          pmMapping = PROJECT_MANAGER_MAPPINGS[foundKey];
        }
      }
      
      if (!pmMapping) {
        console.log(`⚠️  No mapping found for sheet: ${sheetName}`);
        continue;
      }
      
      console.log(`${'='.repeat(80)}`);
      console.log(`📋 Processing Project Manager: ${pmMapping.firstName} ${pmMapping.lastName}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Create/update project manager
      const pmPassword = `${pmMapping.firstName}${pmMapping.lastName}@123`.replace(/\s+/g, '');
      const pmDataWithPassword = {
        ...pmMapping,
        password: pmPassword
      };
      console.log(`   PM Data:`, pmDataWithPassword);
      const pmResult = await createOrUpdateProjectManager(
        pmDataWithPassword,
        referencePM
      );
      const pm = pmResult.user;
      console.log(`✅ Project Manager: ${pm.firstName} ${pm.lastName} (${pm.email})`);
      console.log(`   Password: ${pmPassword}`);
      console.log(`   User ID: ${pm._id}\n`);
      
      allCredentials.push({
        type: 'Project Manager',
        name: `${pm.firstName} ${pm.lastName}`,
        email: pm.email,
        password: pmPassword,
        userId: pm._id.toString(),
        memberId: null
      });
      
      // Read interviewer data from sheet
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📝 Found ${data.length} interviewers in sheet\n`);
      
      let interviewerCount = 0;
      let errorCount = 0;
      
      // Process each interviewer
      for (const row of data) {
        try {
          const memberId = String(row['Intv ID '] || '').trim();
          const name = String(row['Intv Name '] || '').trim();
          const phone = String(row['Mobile Number '] || '').trim();
          const email = String(row['Email ID '] || '').trim();
          
          if (!memberId || !name) {
            console.log(`   ⚠️  Skipping row: Missing memberId or name`);
            continue;
          }
          
          console.log(`   📝 Processing: ${name} (${memberId})`);
          
          // Create/update interviewer
          const interviewerResult = await createOrUpdateInterviewer(
            { memberId, name, phone, email },
            referenceUser,
            assignedBy
          );
          const interviewer = interviewerResult.user;
          
          // Assign to survey
          await assignToSurvey(interviewer._id, assignedBy);
          
          // Assign to project manager
          await assignToProjectManager(interviewer._id, pm._id);
          
          // Get password (phone number)
          const interviewerPhone = String(interviewer.phone || '').replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
          const interviewerPassword = interviewerPhone;
          
          console.log(`   ✅ Created/Updated: ${interviewer.firstName} ${interviewer.lastName}`);
          console.log(`      Email: ${interviewer.email}`);
          console.log(`      Password: ${interviewerPassword}`);
          console.log(`      Member ID: ${interviewer.memberId}\n`);
          
          allCredentials.push({
            type: 'CAPI Interviewer',
            name: `${interviewer.firstName} ${interviewer.lastName}`,
            email: interviewer.email,
            password: interviewerPassword,
            userId: interviewer._id.toString(),
            memberId: interviewer.memberId,
            projectManager: `${pm.firstName} ${pm.lastName}`
          });
          
          interviewerCount++;
        } catch (error) {
          console.error(`   ❌ Error processing interviewer: ${error.message}`);
          errorCount++;
        }
      }
      
      console.log(`\n✅ Completed: ${interviewerCount} interviewers processed, ${errorCount} errors\n`);
    }

    // Test all logins
    console.log(`${'='.repeat(80)}`);
    console.log('🧪 Testing All Logins...');
    console.log(`${'='.repeat(80)}\n`);
    
    for (const cred of allCredentials) {
      console.log(`Testing: ${cred.email}...`);
      const loginTest = await testLogin(cred.email, cred.password);
      allLoginTests.push({ ...cred, loginSuccess: loginTest.success, loginError: loginTest.error });
      if (loginTest.success) {
        console.log(`   ✅ Login successful\n`);
      } else {
        console.log(`   ❌ Login failed: ${loginTest.error}\n`);
      }
    }

    // Final summary
    console.log(`${'='.repeat(80)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    
    const successfulLogins = allLoginTests.filter(t => t.loginSuccess).length;
    console.log(`✅ Total Users Created/Updated: ${allCredentials.length}`);
    console.log(`✅ Successful Logins: ${successfulLogins}/${allCredentials.length}`);
    console.log(`❌ Failed Logins: ${allCredentials.length - successfulLogins}\n`);

    // Display all credentials
    console.log(`${'='.repeat(80)}`);
    console.log('📋 ALL CREDENTIALS (Copy-Paste Ready)');
    console.log(`${'='.repeat(80)}\n`);
    
    // Group by type
    const pms = allCredentials.filter(c => c.type === 'Project Manager');
    const interviewers = allCredentials.filter(c => c.type === 'CAPI Interviewer');
    
    console.log('PROJECT MANAGERS:\n');
    pms.forEach((cred, index) => {
      const test = allLoginTests.find(t => t.email === cred.email);
      console.log(`${index + 1}. ${cred.name}`);
      console.log(`   Email: ${cred.email}`);
      console.log(`   Password: ${cred.password}`);
      console.log(`   User ID: ${cred.userId}`);
      console.log(`   Login: ${test?.loginSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      if (test?.loginError) console.log(`   Error: ${test.loginError}`);
      console.log('');
    });
    
    console.log('\nCAPI INTERVIEWERS:\n');
    interviewers.forEach((cred, index) => {
      const test = allLoginTests.find(t => t.email === cred.email);
      console.log(`${index + 1}. ${cred.name}`);
      console.log(`   Member ID: ${cred.memberId}`);
      console.log(`   Email: ${cred.email}`);
      console.log(`   Password: ${cred.password}`);
      console.log(`   Phone: ${cred.password}`);
      console.log(`   Project Manager: ${cred.projectManager}`);
      console.log(`   User ID: ${cred.userId}`);
      console.log(`   Login: ${test?.loginSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      if (test?.loginError) console.log(`   Error: ${test.loginError}`);
      console.log('');
    });

    console.log(`${'='.repeat(80)}`);
    console.log('✅ Script completed successfully!');
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { main };
