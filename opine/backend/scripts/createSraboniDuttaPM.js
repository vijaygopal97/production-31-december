#!/usr/bin/env node

/**
 * CREATE PROJECT MANAGER: Sraboni Dutta
 * 
 * This script creates a new project manager account for Sraboni Dutta and
 * assigns all CATI-type interviewers to her.
 * 
 * Details:
 * - Name: Sraboni Dutta
 * - Email: sraboni.dutta@placeholder.com (placeholder)
 * - Password: 9099202445
 * - Random Member ID
 * - All CATI interviewers will be assigned
 * 
 * Usage:
 *   node scripts/createSraboniDuttaPM.js
 * 
 * This will process both DEVELOPMENT and PRODUCTION databases
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Database connections
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// Project Manager details
const PM_EMAIL = 'sraboni.dutta@placeholder.com';
const PM_PASSWORD = '9099202445';
const PM_FIRST_NAME = 'Sraboni';
const PM_LAST_NAME = 'Dutta';
const PM_PHONE = '9099202445'; // Using password as phone for placeholder

// Load models
const UserSchema = require('../models/User').schema;
const CompanySchema = require('../models/Company').schema;

let devConnection = null;
let prodConnection = null;
let DevUser = null;
let ProdUser = null;
let DevCompany = null;
let ProdCompany = null;

/**
 * Generate a random member ID for project manager
 */
function generateRandomMemberId() {
  // Generate a random 6-digit number
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `PM${randomNum}`;
}

/**
 * Connect to both databases
 */
async function connectDatabases() {
  try {
    console.log('🔌 Connecting to DEVELOPMENT database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    DevUser = devConnection.model('User', UserSchema);
    DevCompany = devConnection.model('Company', CompanySchema);
    console.log('✅ Connected to DEVELOPMENT database\n');

    console.log('🔌 Connecting to PRODUCTION database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdUser = prodConnection.model('User', UserSchema);
    ProdCompany = prodConnection.model('Company', CompanySchema);
    console.log('✅ Connected to PRODUCTION database\n');
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    throw error;
  }
}

/**
 * Get reference project manager or company admin for company info
 */
async function getReferenceUser(UserModel) {
  // Try to find an existing project manager first
  let referenceUser = await UserModel.findOne({ 
    userType: 'project_manager',
    status: 'active'
  }).populate('company');

  if (!referenceUser) {
    // Fall back to company admin
    referenceUser = await UserModel.findOne({ 
      userType: 'company_admin',
      status: 'active'
    }).populate('company');
  }

  if (!referenceUser) {
    throw new Error('No reference user (project manager or company admin) found. Cannot determine company.');
  }

  return referenceUser;
}

/**
 * Generate unique member ID
 */
async function generateUniqueMemberId(UserModel) {
  let memberId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    memberId = generateRandomMemberId();
    const existing = await UserModel.findOne({ memberId });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique member ID after multiple attempts');
  }

  return memberId;
}

/**
 * Create or update project manager
 */
async function createOrUpdateProjectManager(UserModel, dbName) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`👤 Creating/Updating Project Manager in ${dbName.toUpperCase()}`);
    console.log(`${'='.repeat(70)}\n`);

    // Get reference user for company info
    const referenceUser = await getReferenceUser(UserModel);
    console.log(`📋 Reference user: ${referenceUser.firstName} ${referenceUser.lastName} (${referenceUser.userType})`);
    console.log(`   Company: ${referenceUser.company?.companyName || 'N/A'}`);
    console.log(`   Company Code: ${referenceUser.companyCode || 'N/A'}\n`);

    // Check if PM already exists
    const existingPM = await UserModel.findOne({ 
      email: PM_EMAIL.toLowerCase() 
    });

    // Generate unique member ID
    const memberId = existingPM?.memberId || await generateUniqueMemberId(UserModel);
    console.log(`🆔 Generated Member ID: ${memberId}\n`);

    if (existingPM) {
      console.log(`⚠️  Project Manager already exists. Updating...`);
      
      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(PM_PASSWORD, salt);

      // Update existing PM
      await UserModel.updateOne(
        { _id: existingPM._id },
        {
          $set: {
            firstName: PM_FIRST_NAME,
            lastName: PM_LAST_NAME,
            email: PM_EMAIL.toLowerCase(),
            phone: PM_PHONE,
            password: hashedPassword,
            memberId: memberId,
            userType: 'project_manager',
            company: referenceUser.company._id,
            companyCode: referenceUser.companyCode,
            status: 'active',
            isEmailVerified: true,
            isPhoneVerified: true
          }
        }
      );

      const updatedPM = await UserModel.findById(existingPM._id).select('+password');
      
      // Verify password
      const passwordValid = await updatedPM.comparePassword(PM_PASSWORD);
      if (!passwordValid) {
        console.log(`⚠️  Password verification failed, retrying...`);
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(PM_PASSWORD, retrySalt);
        await UserModel.updateOne(
          { _id: existingPM._id },
          { $set: { password: retryHashedPassword } }
        );
        const retryPM = await UserModel.findById(existingPM._id).select('+password');
        const retryPasswordValid = await retryPM.comparePassword(PM_PASSWORD);
        if (!retryPasswordValid) {
          throw new Error('Password verification failed after retry');
        }
      }

      console.log(`✅ Updated existing Project Manager`);
      console.log(`   ID: ${updatedPM._id}`);
      console.log(`   Email: ${updatedPM.email}`);
      console.log(`   Member ID: ${memberId}`);
      console.log(`   Password: ${PM_PASSWORD}\n`);

      return updatedPM;
    } else {
      // Create new PM
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(PM_PASSWORD, salt);

      const newPM = new UserModel({
        firstName: PM_FIRST_NAME,
        lastName: PM_LAST_NAME,
        email: PM_EMAIL.toLowerCase(),
        phone: PM_PHONE,
        password: hashedPassword,
        memberId: memberId,
        userType: 'project_manager',
        company: referenceUser.company._id,
        companyCode: referenceUser.companyCode,
        assignedTeamMembers: [],
        status: 'active',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      const savedPM = await newPM.save();

      // Verify password - need to fetch with password selected
      const savedPMWithPassword = await UserModel.findById(savedPM._id).select('+password');
      const passwordValid = await savedPMWithPassword.comparePassword(PM_PASSWORD);
      if (!passwordValid) {
        console.log(`⚠️  Password verification failed, retrying...`);
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(PM_PASSWORD, retrySalt);
        await UserModel.updateOne(
          { _id: savedPM._id },
          { $set: { password: retryHashedPassword } }
        );
        const retryPM = await UserModel.findById(savedPM._id).select('+password');
        const retryPasswordValid = await retryPM.comparePassword(PM_PASSWORD);
        if (!retryPasswordValid) {
          throw new Error('Password verification failed after retry');
        }
        console.log(`✅ Password verified after retry\n`);
        return await UserModel.findById(savedPM._id);
      }

      console.log(`✅ Created new Project Manager`);
      console.log(`   ID: ${savedPM._id}`);
      console.log(`   Email: ${savedPM.email}`);
      console.log(`   Member ID: ${memberId}`);
      console.log(`   Password: ${PM_PASSWORD}\n`);

      return savedPM;
    }
  } catch (error) {
    console.error(`❌ Error creating/updating project manager:`, error);
    throw error;
  }
}

/**
 * Find all CATI interviewers
 */
async function findAllCATIInterviewers(UserModel) {
  // Find all interviewers with CATI interview mode
  const interviewers = await UserModel.find({
    userType: 'interviewer',
    interviewModes: 'CATI (Telephonic interview)',
    status: { $in: ['active', 'pending'] } // Include both active and pending
  }).sort({ memberId: 1 });

  return interviewers;
}

/**
 * Assign CATI interviewers to project manager
 */
async function assignCATIInterviewersToPM(UserModel, pm, dbName) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`👥 Assigning CATI Interviewers to PM in ${dbName.toUpperCase()}`);
    console.log(`${'='.repeat(70)}\n`);

    // Find all CATI interviewers
    const interviewers = await findAllCATIInterviewers(UserModel);
    console.log(`📋 Found ${interviewers.length} CATI interviewers\n`);

    if (interviewers.length === 0) {
      console.log(`⚠️  No CATI interviewers found. Nothing to assign.\n`);
      return { assigned: 0, alreadyAssigned: 0 };
    }

    // Get current assigned team members
    const currentPM = await UserModel.findById(pm._id);
    const currentAssignedIds = new Set(
      (currentPM.assignedTeamMembers || []).map(m => m.user?.toString() || m.user.toString())
    );

    // Prepare new assignments
    const newAssignments = [];
    let alreadyAssignedCount = 0;

    for (const interviewer of interviewers) {
      const interviewerId = interviewer._id.toString();
      
      if (currentAssignedIds.has(interviewerId)) {
        alreadyAssignedCount++;
        continue; // Skip if already assigned
      }

      newAssignments.push({
        user: interviewer._id,
        userType: 'interviewer',
        assignedAt: new Date(),
        assignedBy: pm._id
      });
    }

    // Add new assignments to existing ones
    const updatedAssignments = [
      ...(currentPM.assignedTeamMembers || []),
      ...newAssignments
    ];

    // Update PM with all assignments
    await UserModel.updateOne(
      { _id: pm._id },
      { $set: { assignedTeamMembers: updatedAssignments } }
    );

    console.log(`✅ Assignment Summary:`);
    console.log(`   Total CATI interviewers found: ${interviewers.length}`);
    console.log(`   Already assigned: ${alreadyAssignedCount}`);
    console.log(`   Newly assigned: ${newAssignments.length}`);
    console.log(`   Total assigned now: ${updatedAssignments.length}\n`);

    return { 
      assigned: newAssignments.length, 
      alreadyAssigned: alreadyAssignedCount,
      total: updatedAssignments.length
    };
  } catch (error) {
    console.error(`❌ Error assigning interviewers:`, error);
    throw error;
  }
}

/**
 * Verify the created project manager
 */
async function verifyProjectManager(UserModel, pm, dbName) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Verifying Project Manager in ${dbName.toUpperCase()}`);
    console.log(`${'='.repeat(70)}\n`);

    const verifiedPM = await UserModel.findById(pm._id)
      .select('+password')
      .populate('assignedTeamMembers.user', 'firstName lastName memberId interviewModes status')
      .populate('company', 'companyName companyCode');

    // Test password
    const passwordValid = await verifiedPM.comparePassword(PM_PASSWORD);
    
    console.log(`✅ Verification Results:`);
    console.log(`   Name: ${verifiedPM.firstName} ${verifiedPM.lastName}`);
    console.log(`   Email: ${verifiedPM.email}`);
    console.log(`   Member ID: ${verifiedPM.memberId}`);
    console.log(`   Phone: ${verifiedPM.phone}`);
    console.log(`   Password: ${PM_PASSWORD} (${passwordValid ? '✅ Valid' : '❌ Invalid'})`);
    console.log(`   User Type: ${verifiedPM.userType}`);
    console.log(`   Status: ${verifiedPM.status}`);
    console.log(`   Company: ${verifiedPM.company?.companyName || 'N/A'}`);
    console.log(`   Company Code: ${verifiedPM.companyCode || 'N/A'}`);
    console.log(`   Assigned Interviewers: ${verifiedPM.assignedTeamMembers?.length || 0}\n`);

    // Show sample interviewers
    if (verifiedPM.assignedTeamMembers && verifiedPM.assignedTeamMembers.length > 0) {
      console.log(`📋 Sample Assigned Interviewers (first 5):`);
      verifiedPM.assignedTeamMembers.slice(0, 5).forEach((member, index) => {
        const interviewer = member.user;
        if (interviewer) {
          console.log(`   ${index + 1}. ${interviewer.memberId || 'N/A'} - ${interviewer.firstName} ${interviewer.lastName} (${interviewer.interviewModes || 'N/A'})`);
        }
      });
      console.log('');
    }

    if (!passwordValid) {
      throw new Error('Password verification failed');
    }

    return verifiedPM;
  } catch (error) {
    console.error(`❌ Error verifying project manager:`, error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 CREATING PROJECT MANAGER: Sraboni Dutta');
    console.log('='.repeat(70) + '\n');

    // Connect to databases
    await connectDatabases();

    // Process DEVELOPMENT
    console.log('\n' + '🟢 '.repeat(35));
    console.log('PROCESSING DEVELOPMENT DATABASE');
    console.log('🟢 '.repeat(35) + '\n');

    const devPM = await createOrUpdateProjectManager(DevUser, 'DEVELOPMENT');
    const devAssignment = await assignCATIInterviewersToPM(DevUser, devPM, 'DEVELOPMENT');
    const verifiedDevPM = await verifyProjectManager(DevUser, devPM, 'DEVELOPMENT');

    // Process PRODUCTION
    console.log('\n' + '🔴 '.repeat(35));
    console.log('PROCESSING PRODUCTION DATABASE');
    console.log('🔴 '.repeat(35) + '\n');

    const prodPM = await createOrUpdateProjectManager(ProdUser, 'PRODUCTION');
    const prodAssignment = await assignCATIInterviewersToPM(ProdUser, prodPM, 'PRODUCTION');
    const verifiedProdPM = await verifyProjectManager(ProdUser, prodPM, 'PRODUCTION');

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ TASK COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70) + '\n');

    console.log('📊 FINAL SUMMARY:\n');
    console.log('DEVELOPMENT:');
    console.log(`   Project Manager: ${verifiedDevPM.firstName} ${verifiedDevPM.lastName}`);
    console.log(`   Email: ${verifiedDevPM.email}`);
    console.log(`   Member ID: ${verifiedDevPM.memberId}`);
    console.log(`   Password: ${PM_PASSWORD}`);
    console.log(`   Assigned CATI Interviewers: ${devAssignment.total}\n`);

    console.log('PRODUCTION:');
    console.log(`   Project Manager: ${verifiedProdPM.firstName} ${verifiedProdPM.lastName}`);
    console.log(`   Email: ${verifiedProdPM.email}`);
    console.log(`   Member ID: ${verifiedProdPM.memberId}`);
    console.log(`   Password: ${PM_PASSWORD}`);
    console.log(`   Assigned CATI Interviewers: ${prodAssignment.total}\n`);

    console.log('='.repeat(70));
    console.log('📝 CREDENTIALS FOR SRABONI DUTTA:');
    console.log('='.repeat(70));
    console.log(`   Email: ${PM_EMAIL}`);
    console.log(`   Password: ${PM_PASSWORD}`);
    console.log(`   Member ID (Dev): ${verifiedDevPM.memberId}`);
    console.log(`   Member ID (Prod): ${verifiedProdPM.memberId}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error in main execution:', error);
    throw error;
  } finally {
    // Disconnect from databases
    if (devConnection) {
      await devConnection.close();
      console.log('🔌 Disconnected from DEVELOPMENT database');
    }
    if (prodConnection) {
      await prodConnection.close();
      console.log('🔌 Disconnected from PRODUCTION database');
    }
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Script completed successfully\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { main };

