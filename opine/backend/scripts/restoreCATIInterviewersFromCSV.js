/**
 * RESTORE CATI INTERVIEWERS FROM CSV
 * 
 * This script restores CATI interviewers who were overwritten by CAPI imports.
 * 
 * Problem:
 * - Existing CATI interviewers had their passwords and interview modes changed
 *   when CAPI users with same memberIds were imported
 * 
 * Solution:
 * - Read the original CATI caller list CSV
 * - For each memberId in CSV:
 *   - Find user in database
 *   - If phone changed OR interview mode changed from CATI to CAPI:
 *     - Restore password to phone number from CSV
 *     - Restore interview mode to CATI
 *     - Restore phone number to CSV value
 * 
 * Usage:
 *   node scripts/restoreCATIInterviewersFromCSV.js
 * 
 * This will process both DEVELOPMENT and PRODUCTION databases
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Database connections
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// CSV file path
const CSV_FILE_PATH = '/var/www/CATI Caller list (1).csv';

// Load User model
const UserSchema = require('../models/User').schema;

let devConnection = null;
let prodConnection = null;
let DevUser = null;
let ProdUser = null;

/**
 * Connect to both databases
 */
async function connectDatabases() {
  try {
    console.log('🔌 Connecting to DEVELOPMENT database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    DevUser = devConnection.model('User', UserSchema);
    console.log('✅ Connected to DEVELOPMENT database\n');

    console.log('🔌 Connecting to PRODUCTION database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdUser = prodConnection.model('User', UserSchema);
    console.log('✅ Connected to PRODUCTION database\n');
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    throw error;
  }
}

/**
 * Normalize phone number (remove country code, spaces, etc.)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
}

/**
 * Parse name into firstName and lastName
 */
function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const nameParts = String(fullName).trim().split(/\s+/);
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  } else {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }
}

/**
 * Read CSV file and parse CATI interviewers
 */
function readCATICallerList() {
  const callers = [];
  
  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found: ${CSV_FILE_PATH}`);
  }

  const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const lines = fileContent.split('\n');
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (simple comma-separated)
    const parts = line.split(',');
    if (parts.length >= 3) {
      const memberId = String(parts[0] || '').trim();
      const name = String(parts[1] || '').trim();
      const phone = normalizePhone(parts[2] || '');
      
      if (memberId && name && phone) {
        const { firstName, lastName } = parseName(name);
        callers.push({
          memberId,
          name,
          firstName,
          lastName,
          phone
        });
      }
    }
  }

  console.log(`📋 Read ${callers.length} CATI callers from CSV\n`);
  return callers;
}

/**
 * Restore a single CATI interviewer
 */
async function restoreCATIInterviewer(callerData, UserModel, dbName) {
  try {
    const { memberId, name, firstName, lastName, phone } = callerData;
    
    // Find user by memberId
    const user = await UserModel.findOne({ memberId }).select('+password');
    
    if (!user) {
      console.log(`   ⚠️  User not found with memberId: ${memberId} (${name})`);
      return { restored: false, reason: 'not_found' };
    }

    const currentPhone = normalizePhone(user.phone);
    const csvPhone = normalizePhone(phone);
    const currentInterviewMode = user.interviewModes || '';
    const isCATI = currentInterviewMode.includes('CATI');
    const isCAPI = currentInterviewMode.includes('CAPI');
    const currentFirstName = (user.firstName || '').trim();
    const currentLastName = (user.lastName || '').trim();
    const csvFirstName = firstName.trim();
    const csvLastName = lastName.trim();

    // Check if restoration is needed
    const phoneChanged = currentPhone !== csvPhone;
    const modeChanged = isCAPI || (!isCATI && currentInterviewMode !== 'CATI (Telephonic interview)');
    const nameChanged = currentFirstName !== csvFirstName || currentLastName !== csvLastName;

    if (!phoneChanged && !modeChanged && !nameChanged) {
      console.log(`   ✓ User ${memberId} (${name}) is already correct - no changes needed`);
      return { restored: false, reason: 'already_correct' };
    }

    console.log(`   🔄 Restoring user ${memberId} (${name}):`);
    if (nameChanged) {
      console.log(`      Name: ${currentFirstName} ${currentLastName} → ${csvFirstName} ${csvLastName}`);
    }
    if (phoneChanged) {
      console.log(`      Phone: ${currentPhone} → ${csvPhone}`);
    }
    if (modeChanged) {
      console.log(`      Mode: ${currentInterviewMode} → CATI (Telephonic interview)`);
    }

    // Hash password (phone number from CSV)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(csvPhone, salt);

    // Update user
    const updateData = {
      firstName: csvFirstName,
      lastName: csvLastName,
      phone: csvPhone,
      interviewModes: 'CATI (Telephonic interview)',
      password: hashedPassword,
      status: 'active',
      isActive: true
    };

    await UserModel.updateOne(
      { _id: user._id },
      { $set: updateData }
    );

    // Verify password
    const updatedUser = await UserModel.findById(user._id).select('+password');
    const passwordValid = await updatedUser.comparePassword(csvPhone);

    if (!passwordValid) {
      console.log(`      ⚠️  Password verification failed, retrying...`);
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(csvPhone, retrySalt);
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { password: retryHashedPassword } }
      );
      
      const retryUser = await UserModel.findById(user._id).select('+password');
      const retryValid = await retryUser.comparePassword(csvPhone);
      if (!retryValid) {
        throw new Error(`Password verification failed after retry for ${memberId}`);
      }
    }

    console.log(`      ✅ Restored successfully`);
    console.log(`         Name: ${csvFirstName} ${csvLastName}`);
    console.log(`         Email: ${updatedUser.email}`);
    console.log(`         Phone: ${csvPhone}`);
    console.log(`         Password: ${csvPhone} (phone number)`);
    console.log(`         Mode: CATI (Telephonic interview)\n`);

    return { 
      restored: true, 
      memberId, 
      name, 
      phoneChanged, 
      modeChanged,
      nameChanged
    };

  } catch (error) {
    console.error(`   ❌ Error restoring ${callerData.memberId} (${callerData.name}):`, error.message);
    return { restored: false, reason: 'error', error: error.message };
  }
}

/**
 * Process all CATI callers for a database
 */
async function processDatabase(callers, UserModel, dbName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Processing ${dbName.toUpperCase()} Database`);
  console.log(`${'='.repeat(60)}\n`);

  let restoredCount = 0;
  let alreadyCorrectCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < callers.length; i++) {
    const caller = callers[i];
    console.log(`[${i + 1}/${callers.length}] Processing: ${caller.name} (Member ID: ${caller.memberId})`);

    const result = await restoreCATIInterviewer(caller, UserModel, dbName);

    if (result.restored) {
      restoredCount++;
    } else if (result.reason === 'already_correct') {
      alreadyCorrectCount++;
    } else if (result.reason === 'not_found') {
      notFoundCount++;
    } else {
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${dbName.toUpperCase()} Database Summary:`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   ✅ Restored: ${restoredCount}`);
  console.log(`   ✓ Already correct: ${alreadyCorrectCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total processed: ${callers.length}\n`);

  return {
    restored: restoredCount,
    alreadyCorrect: alreadyCorrectCount,
    notFound: notFoundCount,
    errors: errorCount,
    total: callers.length
  };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting CATI Interviewer Restoration Process\n');
    console.log('⚠️  This will restore CATI interviewers from CSV file');
    console.log('   - Restores password to phone number from CSV');
    console.log('   - Restores interview mode to CATI');
    console.log('   - Restores phone number to CSV value');
    console.log('   - Processes both DEVELOPMENT and PRODUCTION databases\n');

    // Read CSV file
    console.log('📖 Reading CSV file...');
    const callers = await readCATICallerList();

    if (callers.length === 0) {
      console.log('❌ No callers found in CSV file');
      process.exit(1);
    }

    // Connect to databases
    await connectDatabases();

    // Process development database
    const devResults = await processDatabase(callers, DevUser, 'development');

    // Process production database
    const prodResults = await processDatabase(callers, ProdUser, 'production');

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log('\nDEVELOPMENT:');
    console.log(`   ✅ Restored: ${devResults.restored}`);
    console.log(`   ✓ Already correct: ${devResults.alreadyCorrect}`);
    console.log(`   ⚠️  Not found: ${devResults.notFound}`);
    console.log(`   ❌ Errors: ${devResults.errors}`);
    console.log('\nPRODUCTION:');
    console.log(`   ✅ Restored: ${prodResults.restored}`);
    console.log(`   ✓ Already correct: ${prodResults.alreadyCorrect}`);
    console.log(`   ⚠️  Not found: ${prodResults.notFound}`);
    console.log(`   ❌ Errors: ${prodResults.errors}`);
    console.log(`\n✅ Restoration process completed!\n`);

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

module.exports = { main, restoreCATIInterviewer, readCATICallerList };







