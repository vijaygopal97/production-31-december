/**
 * Script to add specific approved interviewer users with provided credentials
 */

const mongoose = require('mongoose');
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
      
      // Update password if user exists
      existingUser.password = userData.password;
      await existingUser.save({ runValidators: false });
      console.log(`✅ Updated password for existing user: ${userData.firstName} ${userData.lastName}`);
      
      return { success: true, user: existingUser, memberId: existingUser.memberId, isUpdate: true };
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
      password: userData.password, // Plain password - will be hashed by pre-save hook
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

    return { success: true, user: newUser, memberId: memberId, isUpdate: false };
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
        firstName: 'Probir',
        lastName: 'Ghosh',
        email: 'gprabir463@gmail.com',
        phone: '9674464701',
        password: '9674464701'
      },
      {
        firstName: 'Poritosh',
        lastName: 'Chakraborty',
        email: 'cparitosh975@gmail.com',
        phone: '8918315822',
        password: '8918315822'
      },
      {
        firstName: 'Rohit',
        lastName: 'Bag',
        email: 'bagr42534@gmail.com',
        phone: '7076119379',
        password: '7076119379'
      },
      {
        firstName: 'Rakesh',
        lastName: 'Bag',
        email: 'rbag53462@gmail.com',
        phone: '8391866423',
        password: '8391866423'
      }
    ];

    console.log(`\n📋 Creating/Updating ${interviewers.length} interviewer users...\n`);

    const results = [];
    const credentials = [];

    for (const interviewer of interviewers) {
      const result = await createInterviewer(interviewer);
      results.push({
        name: `${interviewer.firstName} ${interviewer.lastName}`,
        email: interviewer.email,
        phone: interviewer.phone,
        password: interviewer.password,
        ...result
      });

      if (result.success) {
        credentials.push({
          name: `${interviewer.firstName} ${interviewer.lastName}`,
          email: interviewer.email,
          phone: interviewer.phone,
          memberId: result.memberId,
          password: interviewer.password
        });
      }
      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('='.repeat(70));
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successfully created/updated: ${successful.length}`);
    successful.forEach(r => {
      const action = r.isUpdate ? 'Updated' : 'Created';
      console.log(`   ${action}: ${r.name} (${r.email}) - MemberId: ${r.memberId}`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   - ${r.name} (${r.email}): ${r.error}`);
      });
    }

    // Credentials
    console.log('\n\n📋 LOGIN CREDENTIALS:');
    console.log('='.repeat(70));
    credentials.forEach((cred, index) => {
      console.log(`\nAccount ${index + 1}:`);
      console.log(`Email: ${cred.email}`);
      console.log(`password: ${cred.password}`);
      console.log(`Interviewer ID: ${cred.memberId}`);
    });
    console.log('\n' + '='.repeat(70));

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







