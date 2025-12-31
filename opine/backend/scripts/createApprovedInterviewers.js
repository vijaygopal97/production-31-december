/**
 * Script to create approved interviewer users
 * 
 * This script creates interviewer users with:
 * - Phone number as password (hashed)
 * - Unique memberId generation
 * - Complete profile data matching sample user
 * - Approved status
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

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

// Note: Password will be hashed automatically by User model's pre-save hook
// We just need to pass the plain phone number as password

// Create interviewer user
const createInterviewer = async (userData) => {
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
    // We bypass validation by using create() directly and setting password as plain phone number
    const newUser = new User({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      phone: userData.phone,
      password: userData.phone, // Plain phone number - will be hashed by pre-save hook
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
    // We use save() with runValidators: false to bypass password validation (uppercase/lowercase requirement)
    await newUser.save({ runValidators: false });
    console.log(`✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.email}) with memberId: ${memberId}`);

    return { success: true, user: newUser, memberId: memberId };
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

    // Interviewer data
    const interviewers = [
      {
        firstName: 'Biswanath',
        lastName: 'Mahata',
        phone: '9800311796',
        email: 'bnmredmi@gmail.com'
      },
      {
        firstName: 'Bhiswadeb',
        lastName: 'Mahato',
        phone: '9609981843',
        email: 'mahatobhiswadeb@gmail.com'
      },
      {
        firstName: 'Nirmal',
        lastName: 'mahato',
        phone: '6294313142',
        email: 'mahatonirmal457@gmail.com'
      },
      {
        firstName: 'Sandip',
        lastName: 'Mahato',
        phone: '8617836834',
        email: 'sm219734@gmail.com'
      }
    ];

    console.log(`\n📋 Creating ${interviewers.length} interviewer users...\n`);

    const results = [];
    for (const interviewer of interviewers) {
      const result = await createInterviewer(interviewer);
      results.push({
        name: `${interviewer.firstName} ${interviewer.lastName}`,
        email: interviewer.email,
        phone: interviewer.phone,
        ...result
      });
      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('='.repeat(60));
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

module.exports = { createInterviewer, generateMemberId };

