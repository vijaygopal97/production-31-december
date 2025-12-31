/**
 * Script to create 10 test approved interviewer users
 * 
 * This script creates test interviewer users with:
 * - Test email addresses
 * - Default password (same for all)
 * - Unique memberId generation
 * - Complete profile data matching sample user
 * - Approved status
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Default password for all test accounts
const DEFAULT_PASSWORD = 'Test@1234';

// Generate unique 6-digit memberId
const generateMemberId = async () => {
  let memberId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    memberId = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if this memberId already exists
    const existingUser = await User.findOne({ memberId });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique memberId after maximum attempts');
  }

  return memberId;
};

// Create test interviewer user
const createTestInterviewer = async (userData, index) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: userData.email.toLowerCase() },
        { phone: userData.phone }
      ]
    });

    if (existingUser) {
      console.log(`⚠️  User already exists: ${userData.firstName} ${userData.lastName} (${userData.email})`);
      return { success: false, message: 'User already exists', user: existingUser };
    }

    // Generate memberId
    const memberId = await generateMemberId();
    console.log(`📝 Generated memberId: ${memberId} for ${userData.firstName} ${userData.lastName}`);

    // Create user object - password will be hashed automatically by pre-save hook
    const newUser = new User({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      phone: userData.phone,
      password: DEFAULT_PASSWORD, // Default password - will be hashed by pre-save hook
      isEmailVerified: false,
      isPhoneVerified: false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)',
      canSelectMode: false,
      company: new mongoose.Types.ObjectId('68d33a0cd5e4634e58c4e678'),
      companyCode: 'TEST001',
      memberId: memberId,
      profile: {
        languages: [],
        education: [],
        experience: []
      },
      documents: {
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
      gig_availability: false,
      gig_enabled: false,
      performance: {
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
      preferences: {
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
      registrationSource: 'company_admin',
      training: {
        completedModules: [],
        certificationStatus: 'not_started'
      },
      interviewerProfile: {
        age: 28,
        gender: 'male',
        languagesSpoken: ['Hindi', 'English'],
        highestDegree: {
          name: 'B.Tech',
          institution: 'NIT',
          year: 2019
        },
        hasSurveyExperience: true,
        surveyExperienceYears: 3,
        surveyExperienceDescription: 'Experienced in field surveys',
        cvUpload: 'cvUpload-1764630127133-571761495.docx',
        ownsSmartphone: true,
        smartphoneType: 'Android Only',
        androidVersion: '13',
        iosVersion: '',
        willingToTravel: true,
        hasVehicle: true,
        willingToRecordAudio: true,
        agreesToRemuneration: true,
        bankAccountNumber: '786897980',
        bankAccountHolderName: userData.firstName.toUpperCase() + ' ' + userData.lastName.toUpperCase(),
        bankName: 'HDFC',
        bankIfscCode: 'HDFC0001234',
        bankDocumentUpload: 'bankDocumentUpload-1764630178675-881719772.png',
        aadhaarNumber: '876897697890',
        aadhaarDocument: 'aadhaarDocument-1764630188489-204099240.png',
        panNumber: '7868979879',
        panDocument: 'panDocument-1764630192433-387051607.png',
        passportPhoto: 'passportPhoto-1764630195659-468808359.png',
        agreesToShareInfo: true,
        agreesToParticipateInSurvey: true,
        approvalStatus: 'approved',
        approvalFeedback: 'Test account - Auto approved',
        approvedBy: new mongoose.Types.ObjectId('68d707f3926fa2d374b316e2'),
        approvedAt: new Date(),
        lastSubmittedAt: new Date()
      },
      loginAttempts: 0,
      assignedTeamMembers: []
    });

    // Save user - this will trigger the pre-save hook to hash the password
    await newUser.save();
    console.log(`✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.email}) with memberId: ${memberId}`);

    return { 
      success: true, 
      user: newUser, 
      memberId: memberId,
      email: userData.email,
      phone: userData.phone,
      name: `${userData.firstName} ${userData.lastName}`
    };
  } catch (error) {
    console.error(`❌ Error creating user ${userData.firstName} ${userData.lastName}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Main execution
const main = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Generate test interviewer data
    const testInterviewers = [];
    for (let i = 1; i <= 10; i++) {
      testInterviewers.push({
        firstName: `Test`,
        lastName: `Interviewer${i}`,
        phone: `900000000${String(i).padStart(1, '0')}`, // 9000000001, 9000000002, etc.
        email: `testinterviewer${i}@test.com`
      });
    }

    console.log(`\n📋 Creating ${testInterviewers.length} test interviewer users...`);
    console.log(`🔑 Default Password for all: ${DEFAULT_PASSWORD}\n`);

    const results = [];
    const credentials = [];

    for (let i = 0; i < testInterviewers.length; i++) {
      const interviewer = testInterviewers[i];
      const result = await createTestInterviewer(interviewer, i + 1);
      results.push({
        name: `${interviewer.firstName} ${interviewer.lastName}`,
        email: interviewer.email,
        phone: interviewer.phone,
        ...result
      });

      if (result.success) {
        credentials.push({
          name: result.name,
          email: result.email,
          phone: result.phone,
          memberId: result.memberId,
          password: DEFAULT_PASSWORD
        });
      }
      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('='.repeat(70));
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successfully created: ${successful.length}`);
    successful.forEach(r => {
      console.log(`   - ${r.name} (${r.email}) - MemberId: ${r.memberId}`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   - ${r.name} (${r.email}): ${r.message || r.error}`);
      });
    }

    // Credentials Table
    console.log('\n\n📋 LOGIN CREDENTIALS:');
    console.log('='.repeat(70));
    console.log(`Default Password for ALL accounts: ${DEFAULT_PASSWORD}`);
    console.log('='.repeat(70));
    console.log('S.No | Name              | Email                      | Phone        | MemberId | Password');
    console.log('-'.repeat(70));
    credentials.forEach((cred, index) => {
      console.log(
        `${String(index + 1).padStart(4)} | ${cred.name.padEnd(17)} | ${cred.email.padEnd(26)} | ${cred.phone.padEnd(11)} | ${cred.memberId} | ${cred.password}`
      );
    });
    console.log('='.repeat(70));

    // JSON format for easy copying
    console.log('\n\n📄 Credentials in JSON format:');
    console.log(JSON.stringify(credentials, null, 2));

    console.log('\n✅ Script completed!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run script
if (require.main === module) {
  main();
}

module.exports = { createTestInterviewer, generateMemberId };







