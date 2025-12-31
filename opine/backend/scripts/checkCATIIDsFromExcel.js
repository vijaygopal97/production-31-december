/**
 * CHECK CATI IDs FROM EXCEL
 * 
 * This script reads member IDs from "/var/www/CATI IDs.xlsx" and checks
 * which ones are currently set as CAPI interviewers in the production database.
 * 
 * It does NOT make any changes - only reports the data.
 * 
 * Usage:
 *   node scripts/checkCATIIDsFromExcel.js
 */

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Excel file path
const EXCEL_FILE_PATH = '/var/www/CATI IDs.xlsx';

// Production database connection
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// Load User model
const UserSchema = require('../models/User').schema;

let prodConnection = null;
let ProdUser = null;

/**
 * Connect to production database
 */
async function connectDatabase() {
  try {
    console.log('🔌 Connecting to PRODUCTION database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdUser = prodConnection.model('User', UserSchema);
    console.log('✅ Connected to PRODUCTION database\n');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    throw error;
  }
}

/**
 * Read member IDs from Excel file
 */
function readMemberIdsFromExcel() {
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    throw new Error(`Excel file not found: ${EXCEL_FILE_PATH}`);
  }

  console.log(`📖 Reading Excel file: ${EXCEL_FILE_PATH}\n`);
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📋 Found ${data.length} rows in Excel file\n`);
  
  // Extract member IDs - try different possible column names
  const memberIds = [];
  const memberIdColumnNames = ['memberId', 'member ID', 'Member ID', 'MemberId', 'ID', 'id', 'teleform_user_id', 'Caller ID', 'CallerID'];
  
  for (const row of data) {
    let memberId = null;
    
    // Try to find member ID in any of the possible column names
    for (const colName of memberIdColumnNames) {
      if (row[colName] !== undefined && row[colName] !== null && row[colName] !== '') {
        memberId = String(row[colName]).trim();
        break;
      }
    }
    
    // If not found, try first numeric column
    if (!memberId) {
      for (const key in row) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const strValue = String(value).trim();
          if (/^\d+$/.test(strValue)) {
            memberId = strValue;
            break;
          }
        }
      }
    }
    
    if (memberId) {
      memberIds.push(memberId);
    }
  }
  
  console.log(`📋 Extracted ${memberIds.length} member IDs from Excel\n`);
  console.log(`📋 Sample member IDs: ${memberIds.slice(0, 10).join(', ')}${memberIds.length > 10 ? '...' : ''}\n`);
  
  return memberIds;
}

/**
 * Check users in production database
 */
async function checkUsersInProduction(memberIds) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Checking Users in PRODUCTION Database`);
    console.log(`${'='.repeat(60)}\n`);

    // Find all users with these member IDs
    const users = await ProdUser.find({ 
      memberId: { $in: memberIds }
    }).select('memberId firstName lastName email phone interviewModes userType status');

    console.log(`✅ Found ${users.length} users in production database\n`);

    // Create a map for quick lookup
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.memberId, user);
    });

    // Categorize results
    const results = {
      found: [],
      notFound: [],
      capi: [],
      cati: [],
      both: [],
      other: []
    };

    // Check each member ID from Excel
    for (const memberId of memberIds) {
      const user = userMap.get(memberId);
      
      if (!user) {
        results.notFound.push(memberId);
        continue;
      }

      results.found.push({
        memberId: user.memberId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email || 'N/A',
        phone: user.phone || 'N/A',
        interviewMode: user.interviewModes || 'N/A',
        userType: user.userType || 'N/A',
        status: user.status || 'N/A'
      });

      // Categorize by interview mode
      const mode = user.interviewModes || '';
      if (mode === 'CAPI (Face To Face)') {
        results.capi.push({
          memberId: user.memberId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          interviewMode: user.interviewModes || 'N/A'
        });
      } else if (mode === 'CATI (Telephonic interview)') {
        results.cati.push({
          memberId: user.memberId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          interviewMode: user.interviewModes || 'N/A'
        });
      } else if (mode === 'Both') {
        results.both.push({
          memberId: user.memberId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          interviewMode: user.interviewModes || 'N/A'
        });
      } else {
        results.other.push({
          memberId: user.memberId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          interviewMode: user.interviewModes || 'N/A'
        });
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Error checking users:', error);
    throw error;
  }
}

/**
 * Print results
 */
function printResults(results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESULTS SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  console.log(`📋 Total Member IDs in Excel: ${results.found.length + results.notFound.length}`);
  console.log(`✅ Found in Database: ${results.found.length}`);
  console.log(`❌ Not Found in Database: ${results.notFound.length}\n`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('🔴 CAPI INTERVIEWERS (Should be CATI)');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.capi.length}\n`);

  if (results.capi.length > 0) {
    console.log('Member ID | Name | Email | Phone | Interview Mode');
    console.log('-'.repeat(80));
    results.capi.forEach(user => {
      console.log(`${user.memberId.padEnd(10)} | ${user.name.padEnd(30)} | ${user.email.padEnd(30)} | ${user.phone.padEnd(15)} | ${user.interviewMode}`);
    });
  } else {
    console.log('✅ No CAPI interviewers found - all are correctly set!\n');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🟢 CATI INTERVIEWERS (Correctly Set)');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.cati.length}\n`);

  if (results.cati.length > 0) {
    console.log('Member ID | Name | Email | Phone | Interview Mode');
    console.log('-'.repeat(80));
    results.cati.forEach(user => {
      console.log(`${user.memberId.padEnd(10)} | ${user.name.padEnd(30)} | ${user.email.padEnd(30)} | ${user.phone.padEnd(15)} | ${user.interviewMode}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🟡 BOTH MODES');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.both.length}\n`);

  if (results.both.length > 0) {
    console.log('Member ID | Name | Email | Phone | Interview Mode');
    console.log('-'.repeat(80));
    results.both.forEach(user => {
      console.log(`${user.memberId.padEnd(10)} | ${user.name.padEnd(30)} | ${user.email.padEnd(30)} | ${user.phone.padEnd(15)} | ${user.interviewMode}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('⚪ OTHER/UNKNOWN MODES');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.other.length}\n`);

  if (results.other.length > 0) {
    console.log('Member ID | Name | Email | Phone | Interview Mode');
    console.log('-'.repeat(80));
    results.other.forEach(user => {
      console.log(`${user.memberId.padEnd(10)} | ${user.name.padEnd(30)} | ${user.email.padEnd(30)} | ${user.phone.padEnd(15)} | ${user.interviewMode}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('❌ MEMBER IDs NOT FOUND IN DATABASE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.notFound.length}\n`);

  if (results.notFound.length > 0) {
    console.log('Missing Member IDs:');
    console.log(results.notFound.join(', '));
  } else {
    console.log('✅ All member IDs from Excel exist in the database!\n');
  }

  // Summary table
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total IDs in Excel:        ${results.found.length + results.notFound.length}`);
  console.log(`Found in Database:        ${results.found.length}`);
  console.log(`Not Found:                ${results.notFound.length}`);
  console.log(`\n🔴 Currently CAPI:         ${results.capi.length} (NEED TO FIX)`);
  console.log(`🟢 Currently CATI:         ${results.cati.length} (CORRECT)`);
  console.log(`🟡 Currently Both:         ${results.both.length}`);
  console.log(`⚪ Other/Unknown:          ${results.other.length}`);
  console.log(`\n✅ Process completed!\n`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting CATI IDs Check from Excel\n');
    console.log(`📄 Excel File: ${EXCEL_FILE_PATH}`);
    console.log(`📊 Database: PRODUCTION`);
    console.log(`\n⚠️  This script only READS data - NO CHANGES will be made\n`);

    // Read member IDs from Excel
    const memberIds = readMemberIdsFromExcel();

    // Connect to production database
    await connectDatabase();

    // Check users
    const results = await checkUsersInProduction(memberIds);

    // Print results
    printResults(results);

    // Close connection
    await prodConnection.close();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    
    if (prodConnection) await prodConnection.close();
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, readMemberIdsFromExcel, checkUsersInProduction };






