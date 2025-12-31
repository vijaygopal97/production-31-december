const mongoose = require('mongoose');
require('dotenv').config();

const createTestInterviewerCAPI = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const bcrypt = require('bcryptjs');

    // Create test interviewer credentials
    const email = 'testinterviewer4@gmail.com';
    const password = 'Test@1234';
    const phone = '9958233650';

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.log('User with this email or phone already exists');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with CAPI interview mode
    const newUser = new User({
      firstName: 'Amit',
      lastName: 'Singh',
      email: email,
      phone: phone,
      password: hashedPassword,
      isEmailVerified: false,
      isPhoneVerified: false,
      userType: 'interviewer',
      interviewModes: 'CAPI (Face To Face)', // CAPI mode
      canSelectMode: false,
      company: '68d33a0cd5e4634e58c4e678', // Same company as reference user
      companyCode: 'TEST001',
      status: 'active',
      isActive: true,
      gig_availability: false,
      gig_enabled: false,
      registrationSource: 'company_admin',
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
      performance: {
        qualityMetrics: {
          audioQuality: 0,
          responseAccuracy: 0,
          timeliness: 0,
          professionalism: 0
        },
        trustScore: 100,
        totalInterviews: 0,
        approvedInterviews: 0,
        rejectedInterviews: 0,
        averageRating: 0,
        totalEarnings: 0
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
        locationControlBooster: false
      },
      training: {
        certificationStatus: 'not_started',
        completedModules: []
      },
      interviewerProfile: {
        highestDegree: {
          name: 'M.Sc',
          institution: 'Delhi University',
          year: 2021
        },
        age: 27,
        gender: 'male',
        languagesSpoken: ['Hindi', 'English', 'Punjabi'],
        hasSurveyExperience: true,
        surveyExperienceYears: 2,
        surveyExperienceDescription: 'Experienced in field surveys and face-to-face interviews',
        cvUpload: 'cvUpload-1764630127133-571761495.docx', // Using same dummy file
        ownsSmartphone: true,
        smartphoneType: 'Both',
        androidVersion: '14',
        iosVersion: '17',
        willingToTravel: true,
        hasVehicle: true,
        willingToRecordAudio: true,
        agreesToRemuneration: true,
        bankAccountNumber: '786897982',
        bankAccountHolderName: 'AMIT SINGH',
        bankName: 'SBI',
        bankIfscCode: 'SBIN0001234',
        bankDocumentUpload: 'bankDocumentUpload-1764630178675-881719772.png', // Using same dummy file
        aadhaarNumber: '876897697892',
        aadhaarDocument: 'aadhaarDocument-1764630188489-204099240.png', // Using same dummy file
        panNumber: '7868979881',
        panDocument: 'panDocument-1764630192433-387051607.png', // Using same dummy file
        passportPhoto: 'passportPhoto-1764630195659-468808359.png', // Using same dummy file
        agreesToShareInfo: true,
        agreesToParticipateInSurvey: true,
        approvalStatus: 'approved',
        lastSubmittedAt: new Date(),
        approvalFeedback: 'Test account - Auto approved for CAPI',
        approvedAt: new Date(),
        approvedBy: '68d707f3926fa2d374b316e2' // Same approver as reference user
      }
    });

    await newUser.save();
    console.log('\n✅ Test CAPI interviewer created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Phone: ${phone}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\nUser ID: ${newUser._id}`);
    console.log(`Company: Test Company Ltd Updated (TEST001)`);
    console.log(`Interview Mode: CAPI (Face To Face)`);
    console.log(`Status: Active & Approved`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test CAPI interviewer:', error);
    process.exit(1);
  }
};

createTestInterviewerCAPI();

