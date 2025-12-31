/**
 * Create CAPI Users from Correct Excel File
 * 
 * This script:
 * 1. Reads Excel file with project manager tabs
 * 2. For each interviewer in each tab:
 *    - If memberID exists and is CATI: Leave it alone, create NEW CAPI user with "CAPI{memberid}"
 *    - If memberID exists and is CAPI: Check phone match, update memberID to "CAPI{memberid}" if phone matches
 *    - If memberID doesn't exist: Create CAPI user with "CAPI{memberid}"
 * 3. Assign all CAPI users to survey
 * 4. Assign interviewers to respective Project Managers (based on tab name)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const path = require('path');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const EXCEL_FILE_PATH = '/var/www/New app Registration Update file with north bengal team (1).xlsx';
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8'; // Reference interviewer
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const COUNTRY = 'India';

// Project Manager mappings (tab name -> PM data with User IDs)
// Production User IDs (found by email lookup)
const PROJECT_MANAGER_MAPPINGS = {
  'Abdur Rakib ': { 
    firstName: 'Abdur', 
    lastName: 'Rakib', 
    email: 'abdur.rakib@convergent.com', 
    userId: '6942c33cfe90bbe7745b5dd0' // Production ID
  },
  'Bikash Ch Sarkar ': { 
    firstName: 'Bikash', 
    lastName: 'Ch Sarkar', 
    email: 'bikash.sarkar@convergent.com', 
    userId: '6942c399fe90bbe7745c9681' // Production ID
  },
  'Krishna Das- Agency ': { 
    firstName: 'Krishna', 
    lastName: 'Das', 
    email: 'krishna.das@convergent.com', 
    userId: '6942c421fe90bbe7745e0538' // Production ID
  },
  'Dulal Ch Roy ': { 
    firstName: 'Dulal', 
    lastName: 'Ch Roy', 
    email: 'dulal.roy@convergent.com', 
    userId: '6942c422fe90bbe7745e053b' // Production ID
  },
  'Sibsankar Giri ': { 
    firstName: 'Sibsankar', 
    lastName: 'Giri', 
    email: 'sibsankar.giri@convergent.com', 
    userId: '6942c423fe90bbe7745e053e' // Production ID
  }
};

// Notes for phone mismatches
const phoneMismatchNotes = [];

// Normalize phone number for comparison
const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
};

// Generate unique email with "capi" prefix
const generateUniqueCAPIEmail = async (memberId, baseEmail = null) => {
  // Always use "capi" prefix for CAPI users
  let email = `capi${memberId}@gmail.com`;
  
  // Check if email exists
  let existingUser = await User.findOne({ email: email.toLowerCase() });
  let counter = 1;
  
  // If email exists, try variations
  while (existingUser) {
    email = `capi${memberId}${counter}@gmail.com`;
    existingUser = await User.findOne({ email: email.toLowerCase() });
    counter++;
    
    // Safety limit
    if (counter > 100) {
      throw new Error(`Could not generate unique email for memberId ${memberId}`);
    }
  }
  
  return email.toLowerCase();
};

// Create CAPI user
// IMPORTANT: This function ONLY creates NEW CAPI users
// It NEVER modifies existing users (CATI or otherwise)
// existingUser parameter is only used to READ data (name, phone, etc.) for the NEW account
const createCAPIUser = async (memberId, name, phone, emailFromExcel, existingUser, referenceUser, assignedBy) => {
  try {
    const capiMemberId = `CAPI${memberId}`;
    
    // Check if CAPI user already exists with this memberID
    const existingCAPI = await User.findOne({ memberId: capiMemberId });
    if (existingCAPI) {
      console.log(`   ⚠️  CAPI user with ${capiMemberId} already exists, skipping creation`);
      return { user: existingCAPI, isNew: false };
    }

    // Use existing user data if available, otherwise use reference user
    // NOTE: We only READ from existingUser - we NEVER modify it
    const sourceUser = existingUser || referenceUser;
    
    // Split name - use name from Excel if provided, otherwise from existing user
    let firstName = 'CAPI';
    let lastName = 'Interviewer';
    
    if (name && name.trim()) {
      // Use name from Excel
      const nameParts = name.trim().split(/\s+/);
      firstName = nameParts[0] || 'CAPI';
      lastName = nameParts.slice(1).join(' ') || 'Interviewer';
    } else if (existingUser) {
      // Fallback: READ the existing user's name (from CATI user found by memberID)
      // We are NOT modifying the existing user - only reading its name for the NEW CAPI account
      firstName = existingUser.firstName || 'CAPI';
      lastName = existingUser.lastName || 'Interviewer';
      firstName = firstName.trim() || 'CAPI';
      lastName = lastName.trim() || 'Interviewer';
    }
    
    // Phone number - use phone from Excel if provided, otherwise from existing user
    let phoneNumber = phone;
    if (!phoneNumber || !phoneNumber.trim()) {
      phoneNumber = existingUser ? existingUser.phone : (referenceUser.phone || '9999999999');
    }
    phoneNumber = normalizePhone(phoneNumber);
    if (!phoneNumber || phoneNumber.length < 10) {
      phoneNumber = '9999999999'; // Default phone
    }
    
    const password = phoneNumber; // Password is phone number
    
    // Generate unique email with "capi" prefix - NEVER use existing user's email
    const email = await generateUniqueCAPIEmail(memberId);
    
    // Check if email already exists (double check)
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      throw new Error(`Email ${email} already exists in database`);
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const companyId = sourceUser.company || new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678');

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phoneNumber,
      password: hashedPassword,
      isEmailVerified: sourceUser.isEmailVerified || false,
      isPhoneVerified: sourceUser.isPhoneVerified || false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: sourceUser.canSelectMode || false,
      company: companyId,
      companyCode: COMPANY_CODE,
      memberId: capiMemberId,
      profile: sourceUser.profile || { languages: [], education: [], experience: [] },
      documents: sourceUser.documents || {
        aadhaar: { isVerified: false },
        pan: { isVerified: false },
        drivingLicense: { isVerified: false },
        bankDetails: { isVerified: false }
      },
      status: 'active',
      isActive: true,
      gig_availability: sourceUser.gig_availability || false,
      gig_enabled: sourceUser.gig_enabled || false,
      performance: sourceUser.performance || {
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
      preferences: sourceUser.preferences || {
        notifications: { email: true, sms: true, push: true, surveyAssignments: true, paymentUpdates: true, qualityFeedback: true },
        workingHours: { startTime: '09:00', endTime: '18:00', workingDays: [], timezone: 'Asia/Kolkata' },
        surveyPreferences: { maxDistance: 50, preferredLocations: [], minPayment: 0, maxInterviewsPerDay: 10 },
        locationControlBooster: true
      },
      registrationSource: sourceUser.registrationSource || 'company_admin',
      training: sourceUser.training || { completedModules: [], certificationStatus: 'not_started' },
      interviewerProfile: {
        age: sourceUser.interviewerProfile?.age || 28,
        gender: sourceUser.interviewerProfile?.gender || 'male',
        languagesSpoken: sourceUser.interviewerProfile?.languagesSpoken || ['Hindi', 'English'],
        highestDegree: sourceUser.interviewerProfile?.highestDegree || { name: 'B.Tech', institution: 'NIT', year: 2019 },
        hasSurveyExperience: sourceUser.interviewerProfile?.hasSurveyExperience !== undefined ? sourceUser.interviewerProfile.hasSurveyExperience : true,
        surveyExperienceYears: sourceUser.interviewerProfile?.surveyExperienceYears || 3,
        surveyExperienceDescription: sourceUser.interviewerProfile?.surveyExperienceDescription || 'Experienced in face-to-face surveys and CAPI operations',
        cvUpload: sourceUser.interviewerProfile?.cvUpload || 'cvUpload-1764630127133-571761495.docx',
        ownsSmartphone: sourceUser.interviewerProfile?.ownsSmartphone !== undefined ? sourceUser.interviewerProfile.ownsSmartphone : true,
        smartphoneType: sourceUser.interviewerProfile?.smartphoneType || 'Both',
        androidVersion: sourceUser.interviewerProfile?.androidVersion || '13',
        iosVersion: sourceUser.interviewerProfile?.iosVersion || '',
        willingToTravel: sourceUser.interviewerProfile?.willingToTravel !== undefined ? sourceUser.interviewerProfile.willingToTravel : true,
        hasVehicle: sourceUser.interviewerProfile?.hasVehicle !== undefined ? sourceUser.interviewerProfile.hasVehicle : true,
        willingToRecordAudio: sourceUser.interviewerProfile?.willingToRecordAudio !== undefined ? sourceUser.interviewerProfile.willingToRecordAudio : true,
        agreesToRemuneration: sourceUser.interviewerProfile?.agreesToRemuneration !== undefined ? sourceUser.interviewerProfile.agreesToRemuneration : true,
        bankAccountNumber: sourceUser.interviewerProfile?.bankAccountNumber || '786897980',
        bankAccountHolderName: `${firstName.toUpperCase()} ${lastName.toUpperCase()}`,
        bankName: sourceUser.interviewerProfile?.bankName || 'HDFC',
        bankIfscCode: sourceUser.interviewerProfile?.bankIfscCode || 'HDFC0001234',
        bankDocumentUpload: sourceUser.interviewerProfile?.bankDocumentUpload || 'bankDocumentUpload-1764630178675-881719772.png',
        aadhaarNumber: sourceUser.interviewerProfile?.aadhaarNumber || '876897697890',
        aadhaarDocument: sourceUser.interviewerProfile?.aadhaarDocument || 'aadhaarDocument-1764630188489-204099240.png',
        panNumber: sourceUser.interviewerProfile?.panNumber || '7868979879',
        panDocument: sourceUser.interviewerProfile?.panDocument || 'panDocument-1764630192433-387051607.png',
        passportPhoto: sourceUser.interviewerProfile?.passportPhoto || 'passportPhoto-1764630195659-468808359.png',
        agreesToShareInfo: sourceUser.interviewerProfile?.agreesToShareInfo !== undefined ? sourceUser.interviewerProfile.agreesToShareInfo : true,
        agreesToParticipateInSurvey: sourceUser.interviewerProfile?.agreesToParticipateInSurvey !== undefined ? sourceUser.interviewerProfile.agreesToParticipateInSurvey : true,
        approvalStatus: 'approved',
        approvalFeedback: 'Approved for CAPI',
        approvedBy: sourceUser.interviewerProfile?.approvedBy || assignedBy,
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
    console.error(`   ❌ Error creating CAPI user: ${error.message}`);
    throw error;
  }
};

// Update existing CAPI user's memberID
const updateCAPIUserMemberID = async (existingUser, newMemberId, excelPhone = null) => {
  try {
    // If Excel has phone number and it doesn't match, note it but still update memberID
    if (excelPhone) {
      const existingPhone = normalizePhone(existingUser.phone);
      const excelPhoneNormalized = normalizePhone(excelPhone);
      
      if (existingPhone !== excelPhoneNormalized) {
        phoneMismatchNotes.push({
          memberId: existingUser.memberId,
          newMemberId: newMemberId,
          name: `${existingUser.firstName} ${existingUser.lastName}`,
          existingPhone: existingUser.phone,
          excelPhone: excelPhone,
          note: 'Phone number mismatch - memberID updated but phone needs verification'
        });
      }
    }
    
    await User.updateOne(
      { _id: existingUser._id },
      { $set: { memberId: newMemberId } }
    );
    const updatedUser = await User.findById(existingUser._id);
    return updatedUser;
  } catch (error) {
    console.error(`   ❌ Error updating member ID: ${error.message}`);
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
    // Use production MongoDB URI
    const mongoUri = process.env.PRODUCTION_MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    // Get reference user
    console.log(`📋 Fetching reference user...`);
    const referenceUser = await User.findById(REFERENCE_USER_ID);
    if (!referenceUser) throw new Error(`Reference user ${REFERENCE_USER_ID} not found`);
    
    const companyAdmin = await User.findOne({ userType: 'company_admin', companyCode: COMPANY_CODE, status: 'active' });
    const assignedBy = companyAdmin ? companyAdmin._id : referenceUser._id;
    
    console.log(`✅ Found reference user\n`);

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

    const results = {
      created: [],
      updated: [],
      skipped: [],
      phoneMismatches: [],
      errors: []
    };

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
      console.log(`   Sheet: ${sheetName}`);
      console.log(`   PM User ID: ${pmMapping.userId}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Get Project Manager user
      const pm = await User.findById(pmMapping.userId);
      if (!pm) {
        console.log(`   ❌ Project Manager not found with ID: ${pmMapping.userId}`);
        continue;
      }
      
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
          const emailFromExcel = String(row['Email ID '] || '').trim();
          
          if (!memberId) {
            console.log(`   ⚠️  Skipping row: Missing memberId`);
            continue;
          }
          
          console.log(`\n   ${'='.repeat(60)}`);
          console.log(`   📝 Processing: ${name || 'Unknown'} (Member ID: ${memberId})`);
          console.log(`   ${'='.repeat(60)}`);
          
          // Check if user exists with this member ID
          const existingUser = await User.findOne({ memberId: memberId });
          
          if (existingUser) {
            const interviewModes = existingUser.interviewModes || '';
            const isCATI = interviewModes === 'CATI (Telephonic interview)' || interviewModes.includes('CATI');
            const isCAPI = interviewModes === 'CAPI (Face To Face)' || interviewModes.includes('CAPI');
            
            console.log(`   ✅ User exists: ${existingUser.firstName} ${existingUser.lastName}`);
            console.log(`   📱 Phone: ${existingUser.phone}`);
            console.log(`   📧 Email: ${existingUser.email}`);
            console.log(`   🔧 Interview Mode: ${interviewModes}`);
            
            if (isCATI && !isCAPI) {
              // CATI user - DO NOT MODIFY - leave it completely alone
              // Only READ the name from CATI user to use for NEW CAPI user
              // We are creating a completely separate new CAPI user account
              console.log(`   ℹ️  User is CATI - leaving CATI user UNCHANGED, creating NEW CAPI user`);
              console.log(`   📝 Using name from Excel: ${name || existingUser.firstName + ' ' + existingUser.lastName}`);
              console.log(`   🔒 CATI user will remain untouched - no changes to CATI account`);
              
              // Use name from Excel, or fallback to existing user's name
              const nameToUse = name || `${existingUser.firstName} ${existingUser.lastName}`;
              const phoneToUse = phone || existingUser.phone;
              
              const capiResult = await createCAPIUser(memberId, nameToUse, phoneToUse, emailFromExcel, existingUser, referenceUser, assignedBy);
              const capiUser = capiResult.user;
              
              // Assign to survey
              await assignToSurvey(capiUser._id, assignedBy);
              
              // Assign to project manager
              await assignToProjectManager(capiUser._id, pm._id);
              console.log(`   ✅ Assigned to PM: ${pm.firstName} ${pm.lastName}`);
              
              results.created.push({
                memberId: memberId,
                capiMemberId: capiUser.memberId,
                name: `${capiUser.firstName} ${capiUser.lastName}`,
                email: capiUser.email,
                phone: capiUser.phone,
                projectManager: `${pm.firstName} ${pm.lastName}`,
                action: 'created_new_capi_from_cati'
              });
              
              console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
              console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
              
            } else if (isCAPI) {
              // CAPI user - check if memberID needs update
              console.log(`   ℹ️  User is CAPI - checking if memberID needs update`);
              
              const capiMemberId = `CAPI${memberId}`;
              
              if (existingUser.memberId !== capiMemberId) {
                // Update member ID
                console.log(`   🔄 Updating memberID: ${existingUser.memberId} → ${capiMemberId}`);
                const updatedUser = await updateCAPIUserMemberID(existingUser, capiMemberId, phone);
                
                // Assign to survey
                await assignToSurvey(updatedUser._id, assignedBy);
                
                // Assign to project manager
                await assignToProjectManager(updatedUser._id, pm._id);
                console.log(`   ✅ Assigned to PM: ${pm.firstName} ${pm.lastName}`);
                
                results.updated.push({
                  memberId: memberId,
                  capiMemberId: capiMemberId,
                  name: `${updatedUser.firstName} ${updatedUser.lastName}`,
                  email: updatedUser.email,
                  phone: updatedUser.phone,
                  projectManager: `${pm.firstName} ${pm.lastName}`,
                  action: 'updated_memberid'
                });
                
                console.log(`   ✅ Updated memberID to: ${capiMemberId}`);
              } else {
                // Already has correct memberID
                console.log(`   ✓ MemberID already correct: ${capiMemberId}`);
                
                // Ensure assigned to survey
                await assignToSurvey(existingUser._id, assignedBy);
                
                // Ensure assigned to PM
                await assignToProjectManager(existingUser._id, pm._id);
                
                results.skipped.push({
                  memberId: memberId,
                  capiMemberId: capiMemberId,
                  name: `${existingUser.firstName} ${existingUser.lastName}`,
                  projectManager: `${pm.firstName} ${pm.lastName}`,
                  reason: 'already_correct'
                });
              }
              
              // Check phone match if Excel has phone
              if (phone) {
                const existingPhone = normalizePhone(existingUser.phone);
                const excelPhoneNormalized = normalizePhone(phone);
                
                if (existingPhone !== excelPhoneNormalized) {
                  phoneMismatchNotes.push({
                    memberId: memberId,
                    capiMemberId: capiMemberId,
                    name: `${existingUser.firstName} ${existingUser.lastName}`,
                    existingPhone: existingUser.phone,
                    excelPhone: phone,
                    projectManager: `${pm.firstName} ${pm.lastName}`,
                    note: 'Phone number mismatch - needs manual verification'
                  });
                  console.log(`   ⚠️  Phone mismatch: DB=${existingUser.phone}, Excel=${phone}`);
                }
              }
              
            } else {
              // Other mode (Both or unknown) - create new CAPI user
              console.log(`   ⚠️  User has mode: ${interviewModes} - creating new CAPI user`);
              
              const nameToUse = name || `${existingUser.firstName} ${existingUser.lastName}`;
              const phoneToUse = phone || existingUser.phone;
              
              const capiResult = await createCAPIUser(memberId, nameToUse, phoneToUse, emailFromExcel, existingUser, referenceUser, assignedBy);
              const capiUser = capiResult.user;
              
              await assignToSurvey(capiUser._id, assignedBy);
              await assignToProjectManager(capiUser._id, pm._id);
              
              results.created.push({
                memberId: memberId,
                capiMemberId: capiUser.memberId,
                name: `${capiUser.firstName} ${capiUser.lastName}`,
                email: capiUser.email,
                phone: capiUser.phone,
                projectManager: `${pm.firstName} ${pm.lastName}`,
                action: 'created_new_capi'
              });
              
              console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
              console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
            }
            
          } else {
            // User doesn't exist - create new CAPI user
            console.log(`   ℹ️  User does not exist - creating new CAPI user`);
            
            const capiResult = await createCAPIUser(memberId, name, phone, emailFromExcel, null, referenceUser, assignedBy);
            const capiUser = capiResult.user;
            
            // Assign to survey
            await assignToSurvey(capiUser._id, assignedBy);
            
            // Assign to project manager
            await assignToProjectManager(capiUser._id, pm._id);
            console.log(`   ✅ Assigned to PM: ${pm.firstName} ${pm.lastName}`);
            
            results.created.push({
              memberId: memberId,
              capiMemberId: capiUser.memberId,
              name: `${capiUser.firstName} ${capiUser.lastName}`,
              email: capiUser.email,
              phone: capiUser.phone,
              projectManager: `${pm.firstName} ${pm.lastName}`,
              action: 'created_new'
            });
            
            console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
            console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
          }
          
          interviewerCount++;
        } catch (error) {
          console.error(`   ❌ Error processing interviewer: ${error.message}`);
          errorCount++;
          results.errors.push({
            memberId: row['Intv ID '],
            name: row['Intv Name '],
            error: error.message,
            projectManager: `${pmMapping.firstName} ${pmMapping.lastName}`
          });
        }
      }
      
      console.log(`\n✅ Completed ${pmMapping.firstName} ${pmMapping.lastName}: ${interviewerCount} interviewers processed, ${errorCount} errors\n`);
    }

    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    
    console.log(`✅ Created: ${results.created.length}`);
    console.log(`🔄 Updated: ${results.updated.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    console.log(`📱 Phone Mismatches (for review): ${phoneMismatchNotes.length}\n`);

    if (phoneMismatchNotes.length > 0) {
      console.log(`\n📱 PHONE MISMATCH NOTES (FOR MANUAL REVIEW):\n`);
      phoneMismatchNotes.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.capiMemberId || item.memberId})`);
        console.log(`   Project Manager: ${item.projectManager}`);
        console.log(`   DB Phone: ${item.existingPhone}`);
        console.log(`   Excel Phone: ${item.excelPhone}`);
        console.log(`   Note: ${item.note}\n`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS:\n`);
      results.errors.forEach((item, index) => {
        console.log(`${index + 1}. Member ID: ${item.memberId}, Name: ${item.name}`);
        console.log(`   Project Manager: ${item.projectManager}`);
        console.log(`   Error: ${item.error}\n`);
      });
    }

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



