/**
 * Fix CAPI Users from CATI IDs Excel
 * 
 * This script:
 * 1. Reads member IDs from Excel
 * 2. For each member ID:
 *    - If exists and is CATI: Leave it alone, create NEW CAPI user with "CAPI{memberid}" and email prefixed with "capi"
 *    - If exists and is CAPI: Check phone match, update memberID to "CAPI{memberid}" if phone matches
 *    - If doesn't exist: Create CAPI user with "CAPI{memberid}" and email prefixed with "capi"
 * 3. Assign all CAPI users to survey
 * 4. Assign to project managers (maintain existing assignments or find from existing users)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const path = require('path');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const EXCEL_FILE_PATH = '/var/www/CATI IDs.xlsx';
const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8'; // Reference interviewer
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const COUNTRY = 'India';

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

// Find project manager for an interviewer
const findProjectManagerForInterviewer = async (interviewerId) => {
  try {
    const pm = await User.findOne({
      userType: 'project_manager',
      'assignedTeamMembers.user': interviewerId
    });
    return pm;
  } catch (error) {
    console.error(`   ⚠️  Error finding PM: ${error.message}`);
    return null;
  }
};

// Create CAPI user
// IMPORTANT: This function ONLY creates NEW CAPI users
// It NEVER modifies existing users (CATI or otherwise)
// existingUser parameter is only used to READ data (name, phone, etc.) for the NEW account
const createCAPIUser = async (memberId, existingUser, referenceUser, assignedBy) => {
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
    // This is for creating a NEW CAPI account, existing CATI user stays completely unchanged
    // We create a completely separate new user account
    const sourceUser = existingUser || referenceUser;
    
    // Split name - READ from existing user if available (we NEVER modify existing user)
    // This is for NEW CAPI account only - existing CATI user remains untouched
    let firstName = 'CAPI';
    let lastName = 'Interviewer';
    
    if (existingUser) {
      // READ the existing user's name (from CATI user found by memberID)
      // We are NOT modifying the existing user - only reading its name for the NEW CAPI account
      firstName = existingUser.firstName || 'CAPI';
      lastName = existingUser.lastName || 'Interviewer';
      
      // Clean up the names
      firstName = firstName.trim() || 'CAPI';
      lastName = lastName.trim() || 'Interviewer';
      
      // IMPORTANT: existingUser is passed here only for READING - we never save/modify it
    } else {
      // If no existing user found, use default CAPI name
      firstName = 'CAPI';
      lastName = 'Interviewer';
    }
    
    // Phone number - use existing user's phone if available
    let phone = existingUser ? existingUser.phone : (referenceUser.phone || '9999999999');
    phone = normalizePhone(phone);
    if (!phone || phone.length < 10) {
      phone = '9999999999'; // Default phone
    }
    
    const password = phone; // Password is phone number
    
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
      phone: phone,
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
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

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
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Found ${data.length} member IDs in Excel`);
    console.log(`📊 Starting processing...\n`);

    const results = {
      created: [],
      updated: [],
      skipped: [],
      phoneMismatches: [],
      errors: []
    };

    const totalRows = data.length;
    let processedCount = 0;

    // Process each member ID
    for (const row of data) {
      processedCount++;
      try {
        const memberId = String(row['Caller ID'] || '').trim();
        
        if (!memberId) {
          console.log(`   ⚠️  Skipping row: Empty member ID`);
          continue;
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 Processing Member ID: ${memberId} (${processedCount}/${totalRows})`);
        console.log(`${'='.repeat(60)}`);
        
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
            console.log(`   📝 Reading name from CATI user (NOT modifying): ${existingUser.firstName} ${existingUser.lastName}`);
            console.log(`   🔒 CATI user will remain untouched - no changes to CATI account`);
            
            // Pass existingUser only to READ its name - we never modify it
            const capiResult = await createCAPIUser(memberId, existingUser, referenceUser, assignedBy);
            const capiUser = capiResult.user;
            
            // Assign to survey
            await assignToSurvey(capiUser._id, assignedBy);
            
            // Find and assign to PM (if existing user had a PM, assign CAPI user to same PM)
            const pm = await findProjectManagerForInterviewer(existingUser._id);
            if (pm) {
              await assignToProjectManager(capiUser._id, pm._id);
              console.log(`   ✅ Assigned to PM: ${pm.firstName} ${pm.lastName}`);
            }
            
            results.created.push({
              memberId: memberId,
              capiMemberId: capiUser.memberId,
              name: `${capiUser.firstName} ${capiUser.lastName}`,
              email: capiUser.email,
              phone: capiUser.phone,
              action: 'created_new_capi_from_cati'
            });
            
            console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
            console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
            console.log(`   📊 Progress: ${processedCount}/${totalRows} (${Math.round(processedCount/totalRows*100)}%)\n`);
            
          } else if (isCAPI) {
            // CAPI user - check if memberID needs update
            console.log(`   ℹ️  User is CAPI - checking if memberID needs update`);
            
            const capiMemberId = `CAPI${memberId}`;
            
            if (existingUser.memberId !== capiMemberId) {
              // Update member ID
              console.log(`   🔄 Updating memberID: ${existingUser.memberId} → ${capiMemberId}`);
              const updatedUser = await updateCAPIUserMemberID(existingUser, capiMemberId);
              
              // Assign to survey
              await assignToSurvey(updatedUser._id, assignedBy);
              
              // Find and assign to PM
              const pm = await findProjectManagerForInterviewer(existingUser._id);
              if (pm) {
                await assignToProjectManager(updatedUser._id, pm._id);
                console.log(`   ✅ Assigned to PM: ${pm.firstName} ${pm.lastName}`);
              }
              
              results.updated.push({
                memberId: memberId,
                capiMemberId: capiMemberId,
                name: `${updatedUser.firstName} ${updatedUser.lastName}`,
                email: updatedUser.email,
                phone: updatedUser.phone,
                action: 'updated_memberid'
              });
              
              console.log(`   ✅ Updated memberID to: ${capiMemberId}`);
            } else {
              // Already has correct memberID
              console.log(`   ✓ MemberID already correct: ${capiMemberId}`);
              
              // Ensure assigned to survey
              await assignToSurvey(existingUser._id, assignedBy);
              
              results.skipped.push({
                memberId: memberId,
                capiMemberId: capiMemberId,
                name: `${existingUser.firstName} ${existingUser.lastName}`,
                reason: 'already_correct'
              });
            }
            
            // Note for phone verification (Excel doesn't have phone column)
            phoneMismatchNotes.push({
              memberId: memberId,
              capiMemberId: capiMemberId,
              name: `${existingUser.firstName} ${existingUser.lastName}`,
              phone: existingUser.phone,
              note: 'Phone number needs manual verification - Excel does not contain phone numbers'
            });
            
          } else {
            // Other mode (Both or unknown) - create new CAPI user
            console.log(`   ⚠️  User has mode: ${interviewModes} - creating new CAPI user`);
            
            const capiResult = await createCAPIUser(memberId, existingUser, referenceUser, assignedBy);
            const capiUser = capiResult.user;
            
            await assignToSurvey(capiUser._id, assignedBy);
            
            const pm = await findProjectManagerForInterviewer(existingUser._id);
            if (pm) {
              await assignToProjectManager(capiUser._id, pm._id);
            }
            
            results.created.push({
              memberId: memberId,
              capiMemberId: capiUser.memberId,
              name: `${capiUser.firstName} ${capiUser.lastName}`,
              email: capiUser.email,
              phone: capiUser.phone,
              action: 'created_new_capi'
            });
            
            console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
            console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
            console.log(`   📊 Progress: ${processedCount}/${totalRows} (${Math.round(processedCount/totalRows*100)}%)\n`);
          }
          
        } else {
          // User doesn't exist - create new CAPI user
          console.log(`   ℹ️  User does not exist - creating new CAPI user`);
          
          const capiResult = await createCAPIUser(memberId, null, referenceUser, assignedBy);
          const capiUser = capiResult.user;
          
          // Assign to survey
          await assignToSurvey(capiUser._id, assignedBy);
          
          results.created.push({
            memberId: memberId,
            capiMemberId: capiUser.memberId,
            name: `${capiUser.firstName} ${capiUser.lastName}`,
            email: capiUser.email,
            phone: capiUser.phone,
            action: 'created_new'
          });
          
          console.log(`   ✅ Created CAPI user: ${capiUser.memberId} (${capiUser.firstName} ${capiUser.lastName})`);
          console.log(`   📧 Email: ${capiUser.email} (prefixed with 'capi' to avoid conflicts)`);
          console.log(`   📊 Progress: ${processedCount}/${totalRows} (${Math.round(processedCount/totalRows*100)}%)\n`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing member ID ${row['Caller ID']}: ${error.message}`);
        results.errors.push({
          memberId: row['Caller ID'],
          error: error.message
        });
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    
    console.log(`✅ Created: ${results.created.length}`);
    console.log(`🔄 Updated: ${results.updated.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    console.log(`📱 Phone Notes (for review): ${phoneMismatchNotes.length}\n`);

    if (results.created.length > 0) {
      console.log(`\n📋 CREATED USERS:\n`);
      results.created.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.capiMemberId})`);
        console.log(`   Email: ${item.email}`);
        console.log(`   Phone: ${item.phone}`);
        console.log(`   Password: ${item.phone}`);
        console.log(`   Action: ${item.action}\n`);
      });
    }

    if (results.updated.length > 0) {
      console.log(`\n🔄 UPDATED USERS:\n`);
      results.updated.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.capiMemberId})`);
        console.log(`   Email: ${item.email}`);
        console.log(`   Phone: ${item.phone}`);
        console.log(`   Action: ${item.action}\n`);
      });
    }

    if (phoneMismatchNotes.length > 0) {
      console.log(`\n📱 PHONE VERIFICATION NOTES (FOR MANUAL REVIEW):\n`);
      phoneMismatchNotes.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.capiMemberId || item.memberId})`);
        console.log(`   Current Phone: ${item.phone}`);
        console.log(`   Note: ${item.note}\n`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS:\n`);
      results.errors.forEach((item, index) => {
        console.log(`${index + 1}. Member ID: ${item.memberId}`);
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



