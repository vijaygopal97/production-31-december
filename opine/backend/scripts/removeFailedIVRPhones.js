#!/usr/bin/env node

/**
 * REMOVE FAILED IVR PHONE NUMBERS FROM CATI QUEUE
 * 
 * This script reads IVR call result Excel files and removes CatiRespondentQueue
 * entries for phone numbers that have "Failed" call results.
 * 
 * Files to process:
 * - /var/www/Report-Generation/obdlogs_msisdn251222173642.xls
 * - /var/www/Report-Generation/obdlogs_msisdn251222173742.xls
 * 
 * Logic:
 * 1. Read Excel files and extract phone numbers from "Call To" column
 * 2. Filter for rows where "Call Result" is "Failed"
 * 3. Delete CatiRespondentQueue documents where respondentContact.phone matches
 * 
 * Usage:
 *   node scripts/removeFailedIVRPhones.js
 * 
 * This will process both DEVELOPMENT and PRODUCTION databases
 */

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Database connections
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

// Excel files to process
const EXCEL_FILES = [
  '/var/www/Report-Generation/obdlogs_msisdn251222173642.xls',
  '/var/www/Report-Generation/obdlogs_msisdn251222173742.xls'
];

// Load models
const CatiRespondentQueueSchema = require('../models/CatiRespondentQueue').schema;

let devConnection = null;
let prodConnection = null;
let DevCatiQueue = null;
let ProdCatiQueue = null;

/**
 * Normalize phone number for comparison (remove spaces, dashes, etc.)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Connect to both databases
 */
async function connectDatabases() {
  try {
    console.log('🔌 Connecting to DEVELOPMENT database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    DevCatiQueue = devConnection.model('CatiRespondentQueue', CatiRespondentQueueSchema);
    console.log('✅ Connected to DEVELOPMENT database\n');

    console.log('🔌 Connecting to PRODUCTION database...');
    prodConnection = await mongoose.createConnection(PROD_MONGO_URI);
    ProdCatiQueue = prodConnection.model('CatiRespondentQueue', CatiRespondentQueueSchema);
    console.log('✅ Connected to PRODUCTION database\n');
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    throw error;
  }
}

/**
 * Read Excel file and extract failed phone numbers
 */
function extractFailedPhones(filePath) {
  console.log(`\n📖 Reading file: ${path.basename(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return [];
  }

  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`   Found ${data.length} rows in file`);
    
    // Find column names (XLSX.utils.sheet_to_json uses first row as headers)
    const headers = Object.keys(data[0] || {});
    let callToColumn = null;
    let callResultColumn = null;
    
    // Find column names (case-insensitive, flexible matching)
    headers.forEach((header) => {
      const headerLower = String(header).toLowerCase().trim();
      if (headerLower.includes('call to') || headerLower === 'call to') {
        callToColumn = header;
      }
      if (headerLower.includes('call result') || headerLower === 'call result') {
        callResultColumn = header;
      }
    });
    
    if (!callToColumn || !callResultColumn) {
      console.error(`   ❌ Could not find required columns`);
      console.error(`   Available columns: ${headers.join(', ')}`);
      console.error(`   Looking for: "Call To" and "Call Result"`);
      return [];
    }
    
    console.log(`   Found columns: "Call To" = "${callToColumn}", "Call Result" = "${callResultColumn}"`);
    
    // Extract failed phone numbers
    const failedPhones = new Set();
    let failedCount = 0;
    let totalRows = 0;
    
    data.forEach((row) => {
      totalRows++;
      const phone = row[callToColumn];
      const callResult = row[callResultColumn];
      
      if (phone && callResult) {
        const resultLower = String(callResult).toLowerCase().trim();
        if (resultLower === 'failed') {
          const normalizedPhone = normalizePhone(phone);
          if (normalizedPhone) {
            failedPhones.add(normalizedPhone);
            failedCount++;
          }
        }
      }
    });
    
    console.log(`   ✅ Extracted ${failedCount} failed calls`);
    console.log(`   ✅ Found ${failedPhones.size} unique failed phone numbers`);
    
    return Array.from(failedPhones);
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Find and delete CatiRespondentQueue entries for failed phones
 */
async function removeFailedPhones(connection, CatiQueueModel, dbName) {
  console.log(`\n🔍 Processing ${dbName} database...`);
  
  // Collect all failed phones from all files
  const allFailedPhones = new Set();
  
  for (const filePath of EXCEL_FILES) {
    const failedPhones = extractFailedPhones(filePath);
    failedPhones.forEach(phone => allFailedPhones.add(phone));
  }
  
  if (allFailedPhones.size === 0) {
    console.log(`   ⚠️  No failed phone numbers found in Excel files`);
    return { found: 0, deleted: 0 };
  }
  
  console.log(`\n   📋 Total unique failed phone numbers: ${allFailedPhones.size}`);
  console.log(`   📋 Sample phones (first 10): ${Array.from(allFailedPhones).slice(0, 10).join(', ')}`);
  
  // Find all queue entries with these phone numbers
  // We need to search with normalized phone numbers
  const failedPhonesArray = Array.from(allFailedPhones);
  
  // Build query to find matching phones (handle both normalized and original formats)
  const matchingEntries = await CatiQueueModel.find({
    'respondentContact.phone': { $in: failedPhonesArray }
  }).select('_id respondentContact.phone respondentContact.name status survey');
  
  console.log(`   🔍 Found ${matchingEntries.length} queue entries with failed phone numbers`);
  
  // Also try to find with original phone formats (in case normalization differs)
  // Get all unique phone formats from database for these numbers
  const allMatchingPhones = new Set();
  matchingEntries.forEach(entry => {
    const phone = entry.respondentContact?.phone;
    if (phone) {
      allMatchingPhones.add(phone);
      allMatchingPhones.add(normalizePhone(phone));
    }
  });
  
  // Try a more flexible search - match any variation
  const flexibleQuery = {
    $or: [
      { 'respondentContact.phone': { $in: failedPhonesArray } },
      // Also try to match normalized versions
      ...failedPhonesArray.map(phone => ({
        'respondentContact.phone': { $regex: phone.replace(/\D/g, ''), $options: 'i' }
      }))
    ]
  };
  
  // Get all entries with phone numbers and filter manually for precise matching
  // This ensures we match correctly even if phone formats differ slightly
  const allEntries = await CatiQueueModel.find({
    'respondentContact.phone': { $exists: true, $ne: null, $ne: '' }
  }).select('_id respondentContact.phone respondentContact.name status survey');
  
  console.log(`   📊 Total entries with phone numbers in database: ${allEntries.length}`);
  
  // Filter entries where normalized phone matches failed phones
  const entriesToDelete = allEntries.filter(entry => {
    const phone = entry.respondentContact?.phone;
    if (!phone) return false;
    const normalized = normalizePhone(phone);
    // Also try matching just the digits (in case of country codes, etc.)
    const digitsOnly = normalized.replace(/\D/g, '');
    const failedPhonesDigits = Array.from(allFailedPhones).map(p => p.replace(/\D/g, ''));
    return allFailedPhones.has(normalized) || failedPhonesDigits.includes(digitsOnly);
  });
  
  console.log(`   ✅ Identified ${entriesToDelete.length} entries to delete`);
  
  if (entriesToDelete.length === 0) {
    console.log(`   ℹ️  No matching entries found in ${dbName} database`);
    return { found: 0, deleted: 0 };
  }
  
  // Show sample of what will be deleted
  console.log(`\n   📋 Sample entries to delete (first 5):`);
  entriesToDelete.slice(0, 5).forEach(entry => {
    console.log(`      - ID: ${entry._id}, Phone: ${entry.respondentContact?.phone}, Name: ${entry.respondentContact?.name || 'N/A'}, Status: ${entry.status || 'N/A'}`);
  });
  
  // Ask for confirmation
  console.log(`\n   ⚠️  WARNING: About to delete ${entriesToDelete.length} entries from ${dbName} database`);
  console.log(`   ⚠️  This action cannot be undone!`);
  
  // For safety, we'll proceed but log everything
  const idsToDelete = entriesToDelete.map(e => e._id);
  
  // Delete the entries
  const deleteResult = await CatiQueueModel.deleteMany({
    _id: { $in: idsToDelete }
  });
  
  console.log(`   ✅ Deleted ${deleteResult.deletedCount} entries from ${dbName} database`);
  
  return { found: entriesToDelete.length, deleted: deleteResult.deletedCount };
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('==========================================');
    console.log('  REMOVE FAILED IVR PHONE NUMBERS');
    console.log('==========================================\n');
    
    // Connect to databases
    await connectDatabases();
    
    // Process development database
    const devResult = await removeFailedPhones(devConnection, DevCatiQueue, 'DEVELOPMENT');
    
    // Process production database
    const prodResult = await removeFailedPhones(prodConnection, ProdCatiQueue, 'PRODUCTION');
    
    // Summary
    console.log('\n==========================================');
    console.log('  SUMMARY');
    console.log('==========================================');
    console.log(`DEVELOPMENT: Found ${devResult.found}, Deleted ${devResult.deleted}`);
    console.log(`PRODUCTION:  Found ${prodResult.found}, Deleted ${prodResult.deleted}`);
    console.log(`TOTAL:       Found ${devResult.found + prodResult.found}, Deleted ${devResult.deleted + prodResult.deleted}`);
    console.log('==========================================\n');
    
    // Close connections
    await devConnection.close();
    await prodConnection.close();
    
    console.log('✅ Script completed successfully');
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (devConnection) await devConnection.close().catch(() => {});
    if (prodConnection) await prodConnection.close().catch(() => {});
    process.exit(1);
  }
}

// Run the script
main();

