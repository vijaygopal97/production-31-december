/**
 * CREATE PROJECT MANAGER 3501 AND ASSIGN INTERVIEWERS
 * 
 * This script creates a new project manager with:
 * - Email: projectmanager3501@gmail.com
 * - Password: ProjectManager@#3501
 * 
 * And assigns all interviewers with member IDs in range 3501-3580 to this PM.
 * 
 * Usage:
 *   node scripts/createProjectManager3501.js
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
const PM_EMAIL = 'projectmanager3501@gmail.com';
const PM_PASSWORD = 'ProjectManager@#3501';
const PM_FIRST_NAME = 'Project';
const PM_LAST_NAME = 'Manager 3501';
const PM_PHONE = '9999999999'; // Placeholder phone

// Member ID range for interviewers
const MEMBER_ID_START = 3501;
const MEMBER_ID_END = 3580;

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
 * Create or update project manager
 */
async function createOrUpdateProjectManager(UserModel, dbName) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👤 Creating/Updating Project Manager in ${dbName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Get reference user for company info
    const referenceUser = await getReferenceUser(UserModel);
    console.log(`📋 Reference user: ${referenceUser.firstName} ${referenceUser.lastName} (${referenceUser.userType})`);
    console.log(`   Company: ${referenceUser.company?.companyName || 'N/A'}`);
    console.log(`   Company Code: ${referenceUser.companyCode || 'N/A'}\n`);

    // Check if PM already exists
    const existingPM = await UserModel.findOne({ 
      email: PM_EMAIL.toLowerCase() 
    });

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
            userType: 'project_manager',
            company: referenceUser.company._id,
            companyCode: referenceUser.companyCode,
            status: 'active',
            isEmailVerified: true,
            isPhoneVerified: true
          }
        }
      );

      const updatedPM = await UserModel.findById(existingPM._id);
      
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
      }

      console.log(`✅ Updated existing Project Manager`);
      console.log(`   ID: ${updatedPM._id}`);
      console.log(`   Email: ${updatedPM.email}`);
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
        userType: 'project_manager',
        company: referenceUser.company._id,
        companyCode: referenceUser.companyCode,
        assignedTeamMembers: [],
        status: 'active',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      const savedPM = await newPM.save();

      // Verify password
      const passwordValid = await savedPM.comparePassword(PM_PASSWORD);
      if (!passwordValid) {
        console.log(`⚠️  Password verification failed, retrying...`);
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(PM_PASSWORD, retrySalt);
        await UserModel.updateOne(
          { _id: savedPM._id },
          { $set: { password: retryHashedPassword } }
        );
        const retryPM = await UserModel.findById(savedPM._id);
        console.log(`✅ Password verified after retry\n`);
        return retryPM;
      }

      console.log(`✅ Created new Project Manager`);
      console.log(`   ID: ${savedPM._id}`);
      console.log(`   Email: ${savedPM.email}`);
      console.log(`   Password: ${PM_PASSWORD}\n`);

      return savedPM;
    }
  } catch (error) {
    console.error(`❌ Error creating/updating project manager:`, error);
    throw error;
  }
}

/**
 * Find interviewers in member ID range
 */
async function findInterviewersInRange(UserModel) {
  // Generate array of member IDs in range
  const memberIds = [];
  for (let i = MEMBER_ID_START; i <= MEMBER_ID_END; i++) {
    memberIds.push(i.toString());
  }

  // Find interviewers with these member IDs
  const interviewers = await UserModel.find({
    memberId: { $in: memberIds },
    userType: 'interviewer',
    status: 'active'
  }).sort({ memberId: 1 });

  return interviewers;
}

/**
 * Assign interviewers to project manager
 */
async function assignInterviewersToPM(UserModel, pm, dbName) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👥 Assigning Interviewers to PM in ${dbName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Find interviewers in range
    const interviewers = await findInterviewersInRange(UserModel);
    console.log(`📋 Found ${interviewers.length} interviewers with member IDs ${MEMBER_ID_START}-${MEMBER_ID_END}\n`);

    if (interviewers.length === 0) {
      console.log(`⚠️  No interviewers found in range. Nothing to assign.\n`);
      return { assigned: 0, alreadyAssigned: 0 };
    }

    // Get current assigned team members
    if (!pm.assignedTeamMembers) {
      pm.assignedTeamMembers = [];
    }

    const existingUserIds = pm.assignedTeamMembers.map(m => m.user.toString());
    let assignedCount = 0;
    let alreadyAssignedCount = 0;

    // Assign each interviewer
    for (const interviewer of interviewers) {
      const interviewerId = interviewer._id.toString();
      
      if (existingUserIds.includes(interviewerId)) {
        console.log(`   ⚠️  Already assigned: ${interviewer.firstName} ${interviewer.lastName} (${interviewer.memberId})`);
        alreadyAssignedCount++;
        continue;
      }

      pm.assignedTeamMembers.push({
        user: interviewer._id,
        userType: 'interviewer',
        assignedAt: new Date(),
        assignedBy: pm._id
      });

      console.log(`   ✅ Assigned: ${interviewer.firstName} ${interviewer.lastName} (Member ID: ${interviewer.memberId})`);
      assignedCount++;
    }

    // Save PM with updated team members
    if (assignedCount > 0) {
      await pm.save();
      console.log(`\n✅ Assigned ${assignedCount} new interviewer(s) to Project Manager`);
      console.log(`   Total assigned: ${pm.assignedTeamMembers.length}`);
      console.log(`   Already assigned: ${alreadyAssignedCount}\n`);
    } else {
      console.log(`\n⚠️  No new assignments. All interviewers were already assigned.\n`);
    }

    return { assigned: assignedCount, alreadyAssigned: alreadyAssignedCount };

  } catch (error) {
    console.error(`❌ Error assigning interviewers:`, error);
    throw error;
  }
}

/**
 * Process a database
 */
async function processDatabase(UserModel, dbName) {
  try {
    // Create or update project manager
    const pm = await createOrUpdateProjectManager(UserModel, dbName);

    // Assign interviewers
    const results = await assignInterviewersToPM(UserModel, pm, dbName);

    return {
      pmId: pm._id.toString(),
      pmEmail: pm.email,
      ...results
    };
  } catch (error) {
    console.error(`❌ Error processing ${dbName}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting Project Manager 3501 Creation and Assignment\n');
    console.log(`📋 Project Manager Details:`);
    console.log(`   Email: ${PM_EMAIL}`);
    console.log(`   Password: ${PM_PASSWORD}`);
    console.log(`   Name: ${PM_FIRST_NAME} ${PM_LAST_NAME}\n`);
    console.log(`📋 Interviewer Range:`);
    console.log(`   Member IDs: ${MEMBER_ID_START} to ${MEMBER_ID_END}\n`);
    console.log(`⚠️  This will process both DEVELOPMENT and PRODUCTION databases\n`);

    // Connect to databases
    await connectDatabases();

    // Process development database
    const devResults = await processDatabase(DevUser, 'development');

    // Process production database
    const prodResults = await processDatabase(ProdUser, 'production');

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log('\nDEVELOPMENT:');
    console.log(`   👤 PM ID: ${devResults.pmId}`);
    console.log(`   📧 Email: ${devResults.pmEmail}`);
    console.log(`   ➕ Newly Assigned: ${devResults.assigned}`);
    console.log(`   ⚠️  Already Assigned: ${devResults.alreadyAssigned}`);
    console.log('\nPRODUCTION:');
    console.log(`   👤 PM ID: ${prodResults.pmId}`);
    console.log(`   📧 Email: ${prodResults.pmEmail}`);
    console.log(`   ➕ Newly Assigned: ${prodResults.assigned}`);
    console.log(`   ⚠️  Already Assigned: ${prodResults.alreadyAssigned}`);
    console.log(`\n✅ Process completed!\n`);

    // Close connections
    await devConnection.close();
    await prodConnection.close();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    
    if (devConnection) await devConnection.close();
    if (prodConnection) await prodConnection.close();
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, createOrUpdateProjectManager, assignInterviewersToPM };







