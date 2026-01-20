#!/usr/bin/env node

/**
 * Add Contacts to Survey Script
 * 
 * This script adds contacts from an Excel file to a survey's respondent contacts
 * (JSON file and CatiRespondentQueue) and then cleans up duplicates.
 * 
 * Usage:
 *   node addContactsToSurvey.js [surveyId] <acName> <excelFile>
 * 
 * Arguments:
 *   surveyId  - (Optional) Survey ID. Defaults to: 68fd1915d41841da463f0d46
 *   acName    - (Required) Assembly Constituency name to assign to all contacts
 *   excelFile - (Required) Full path to Excel file containing contacts
 * 
 * Excel File Format:
 *   Columns: name, countryCode, phone, email, address, city, ac, pc, ps
 *   The script will override the AC column with the provided acName
 * 
 * Example:
 *   # Using default survey ID
 *   node addContactsToSurvey.js "Kharagpur Sadar" /var/www/Report-Generation/ac224_output.xlsx
 * 
 *   # With explicit survey ID
 *   node addContactsToSurvey.js 68fd1915d41841da463f0d46 "Kharagpur Sadar" /var/www/Report-Generation/ac224_output.xlsx
 * 
 * What it does:
 *   1. Reads contacts from Excel file
 *   2. Sets AC name for all contacts to the specified value
 *   3. Adds/updates contacts in JSON file (same as Edit Survey modal)
 *   4. Creates queue entries in CatiRespondentQueue for new contacts
 *   5. Cleans up duplicate phone numbers (keeps oldest entry per phone)
 *   6. Generates a summary report
 * 
 * Features:
 *   - Efficient batch processing (5000 contacts per batch)
 *   - Memory-optimized to prevent server crashes
 *   - Automatic duplicate detection and cleanup
 *   - Detailed progress logging
 */

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const Survey = require('../models/Survey');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Constants
const DEFAULT_SURVEY_ID = '68fd1915d41841da463f0d46';
const BATCH_SIZE = 5000; // Process in batches to avoid memory issues
const QUEUE_BATCH_SIZE = 5000; // Batch size for queue inserts

/**
 * Normalize phone number for duplicate checking
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.toString().trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI not found in environment variables');
  }
  
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

/**
 * Parse command-line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const surveyId = args[0] || DEFAULT_SURVEY_ID;
  const acName = args[1];
  const excelFile = args[2];
  
  if (!acName) {
    console.error('❌ Error: AC name is required');
    console.error('\nUsage: node addContactsToSurvey.js [surveyId] <acName> <excelFile>');
    console.error('\nExample:');
    console.error('  node addContactsToSurvey.js 68fd1915d41841da463f0d46 "Kharagpur Sadar" /path/to/file.xlsx');
    console.error('\nDefaults:');
    console.error(`  surveyId: ${DEFAULT_SURVEY_ID}`);
    process.exit(1);
  }
  
  if (!excelFile) {
    console.error('❌ Error: Excel file path is required');
    console.error('\nUsage: node addContactsToSurvey.js [surveyId] <acName> <excelFile>');
    process.exit(1);
  }
  
  // File existence will be checked in processExcelFile
  
  return { surveyId, acName, excelFile };
}

/**
 * Process Excel file and extract contacts
 */
async function processExcelFile(excelFile, targetACName) {
  console.log(`\n📖 Reading Excel file: ${excelFile}`);
  
  try {
    await fs.access(excelFile);
  } catch (error) {
    throw new Error(`Excel file not found: ${excelFile}`);
  }
  
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON - same format as uploadRespondentContacts
  const data = XLSX.utils.sheet_to_json(worksheet, {
    header: ['name', 'countryCode', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'],
    defval: '',
    raw: true
  });
  
  console.log(`📊 Total rows from Excel: ${data.length}`);
  
  // Filter out header rows (same logic as uploadRespondentContacts)
  const headerValues = ['name', 'country code', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'];
  const filteredData = data.filter(row => {
    const nameStr = row.name ? row.name.toString().toLowerCase().trim() : '';
    const phoneStr = row.phone ? row.phone.toString().toLowerCase().trim() : '';
    
    if (headerValues.includes(nameStr) || headerValues.includes(phoneStr)) {
      return false;
    }
    
    if (nameStr === 'name' || phoneStr === 'phone') {
      return false;
    }
    
    return true;
  });
  
  console.log(`📊 Filtered rows (after removing headers): ${filteredData.length}`);
  
  // Process contacts
  const contacts = [];
  const errors = [];
  
  for (let i = 0; i < filteredData.length; i++) {
    const row = filteredData[i];
    const actualIndex = i + 2; // +2 for header row and 0-index
    
    // Validate required fields
    if (!row.name || !row.phone) {
      errors.push(`Row ${actualIndex}: Missing name or phone`);
      continue;
    }
    
    // Clean phone number (same logic as uploadRespondentContacts)
    let cleanPhone = String(row.phone).trim().replace(/[^\d]/g, '');
    
    if (!cleanPhone || cleanPhone === '') {
      errors.push(`Row ${actualIndex}: Invalid phone number`);
      continue;
    }
    
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      errors.push(`Row ${actualIndex}: Invalid phone number format. Phone must be 10-15 digits (got ${cleanPhone.length} digits)`);
      continue;
    }
    
    if (!/^\d+$/.test(cleanPhone)) {
      errors.push(`Row ${actualIndex}: Phone number contains non-numeric characters`);
      continue;
    }
    
    // Handle country code
    let countryCode = '';
    if (row.countryCode !== null && row.countryCode !== undefined && row.countryCode !== '') {
      const countryCodeStr = String(row.countryCode).trim();
      countryCode = countryCodeStr.startsWith('+') ? countryCodeStr.substring(1) : countryCodeStr;
      countryCode = countryCode.replace(/[^\d]/g, '');
    }
    
    // Create contact object - CRITICAL: Set AC to target AC name for all contacts
    const contact = {
      name: row.name.toString().trim(),
      countryCode: countryCode || undefined,
      phone: cleanPhone,
      email: row.email ? row.email.toString().trim() : '',
      address: row.address ? row.address.toString().trim() : '',
      city: row.city ? row.city.toString().trim() : '',
      ac: targetACName, // CRITICAL: Set AC to target AC name for all contacts
      pc: row.pc ? row.pc.toString().trim() : '',
      ps: row.ps ? row.ps.toString().trim() : '',
      addedAt: new Date().toISOString(),
      addedBy: 'system'
    };
    
    contacts.push(contact);
  }
  
  console.log(`\n✅ Processed ${contacts.length} valid contacts`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors encountered`);
    if (errors.length <= 20) {
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      errors.slice(0, 20).forEach(err => console.log(`  - ${err}`));
      console.log(`  ... and ${errors.length - 20} more errors`);
    }
  }
  
  return { contacts, errors };
}

/**
 * Update JSON file with new contacts
 */
async function updateJSONFile(surveyId, contacts, targetACName) {
  const jsonFilePath = path.join('/var/www/opine', 'data', 'respondent-contacts', `${surveyId}.json`);
  const jsonDir = path.dirname(jsonFilePath);
  
  // Ensure directory exists
  await fs.mkdir(jsonDir, { recursive: true });
  
  let allContacts = [];
  try {
    const fileContent = await fs.readFile(jsonFilePath, 'utf8');
    allContacts = JSON.parse(fileContent);
    if (!Array.isArray(allContacts)) {
      allContacts = [];
    }
    console.log(`📖 Read ${allContacts.length} existing contacts from JSON file`);
  } catch (fileError) {
    console.log(`📝 JSON file doesn't exist yet, will create new one`);
    allContacts = [];
  }
  
  // Filter out duplicates by phone number
  const existingPhones = new Set(allContacts.map(c => c.phone).filter(Boolean));
  const newContacts = contacts.filter(c => !existingPhones.has(c.phone));
  
  console.log(`\n📊 JSON File Analysis:`);
  console.log(`  - Total from Excel: ${contacts.length}`);
  console.log(`  - Existing in JSON: ${allContacts.length}`);
  console.log(`  - New contacts to add: ${newContacts.length}`);
  console.log(`  - Duplicates skipped: ${contacts.length - newContacts.length}`);
  
  // Update AC name for existing contacts
  let updatedACCount = 0;
  const phonesToUpdate = new Set(contacts.map(c => c.phone));
  for (const contact of allContacts) {
    if (phonesToUpdate.has(contact.phone) && contact.ac !== targetACName) {
      contact.ac = targetACName;
      updatedACCount++;
    }
  }
  
  // Add new contacts
  if (newContacts.length > 0 || updatedACCount > 0) {
    allContacts = [...newContacts, ...allContacts];
    const jsonString = JSON.stringify(allContacts, null, 2);
    await fs.writeFile(jsonFilePath, jsonString, 'utf8');
    if (newContacts.length > 0) {
      console.log(`✅ Added ${newContacts.length} contacts to JSON file`);
    }
    if (updatedACCount > 0) {
      console.log(`✅ Updated AC name to "${targetACName}" for ${updatedACCount} existing contacts in JSON file`);
    }
  } else {
    console.log(`✅ All contacts already exist in JSON file`);
  }
  
  return { newContacts, allContacts };
}

/**
 * Create queue entries for contacts
 */
async function createQueueEntries(surveyId, contacts) {
  console.log(`\n📊 Creating queue entries...`);
  
  // Check for duplicate phones in queue
  const existingQueuePhones = await CatiRespondentQueue.distinct(
    'respondentContact.phone',
    { survey: surveyId }
  );
  const existingQueuePhonesSet = new Set(existingQueuePhones.filter(Boolean));
  console.log(`📊 Found ${existingQueuePhonesSet.size} existing phone numbers in queue`);
  
  // Filter contacts that need to be added to queue
  const contactsForQueue = contacts.filter(contact => {
    const phone = contact.phone || '';
    return phone && !existingQueuePhonesSet.has(phone);
  });
  
  console.log(`📊 Queue creation analysis:`);
  console.log(`  - Total contacts from Excel: ${contacts.length}`);
  console.log(`  - Already in queue: ${contacts.length - contactsForQueue.length}`);
  console.log(`  - Need to add to queue: ${contactsForQueue.length}`);
  
  if (contactsForQueue.length === 0) {
    console.log(`✅ All contacts are already in queue`);
    return 0;
  }
  
  // Create queue entries
  const queueEntries = contactsForQueue.map(contact => ({
    survey: surveyId,
    respondentContact: {
      name: contact.name || '',
      countryCode: contact.countryCode || '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      city: contact.city || '',
      ac: contact.ac || '',
      pc: contact.pc || '',
      ps: contact.ps || ''
    },
    status: 'pending',
    currentAttemptNumber: 0
  }));
  
  // Process in batches
  let totalInserted = 0;
  let totalBatches = Math.ceil(queueEntries.length / QUEUE_BATCH_SIZE);
  console.log(`\n📦 Processing ${queueEntries.length} queue entries in ${totalBatches} batches of ${QUEUE_BATCH_SIZE}...`);
  
  for (let i = 0; i < queueEntries.length; i += QUEUE_BATCH_SIZE) {
    const batch = queueEntries.slice(i, i + QUEUE_BATCH_SIZE);
    const batchNumber = Math.floor(i / QUEUE_BATCH_SIZE) + 1;
    
    try {
      await CatiRespondentQueue.insertMany(batch, {
        ordered: false,
        lean: false
      });
      totalInserted += batch.length;
      console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${batch.length} entries inserted (Total: ${totalInserted}/${queueEntries.length})`);
      
      // Small delay between batches to prevent overwhelming MongoDB
      if (i + QUEUE_BATCH_SIZE < queueEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (batchError) {
      console.error(`⚠️ Error inserting batch ${batchNumber}:`, batchError.message);
      if (batchError.writeErrors && batchError.writeErrors.length > 0) {
        console.error(`⚠️ ${batchError.writeErrors.length} entries failed in batch ${batchNumber}`);
      }
    }
  }
  
  console.log(`\n✅ Queue creation completed: ${totalInserted}/${queueEntries.length} entries inserted successfully`);
  
  // Update AC name in existing queue entries
  console.log(`\n🔄 Updating AC name in existing queue entries...`);
  const targetACName = contacts[0]?.ac;
  if (targetACName) {
    const updateResult = await CatiRespondentQueue.updateMany(
      {
        survey: surveyId,
        'respondentContact.phone': { $in: contacts.map(c => c.phone) },
        'respondentContact.ac': { $ne: targetACName }
      },
      {
        $set: {
          'respondentContact.ac': targetACName
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Updated AC name to "${targetACName}" for ${updateResult.modifiedCount} existing queue entries`);
    }
  }
  
  return totalInserted;
}

/**
 * Clean up duplicate phone numbers from queue
 */
async function cleanupDuplicates(surveyId) {
  console.log(`\n🧹 Cleaning up duplicate phone numbers...`);
  
  const surveyObjectId = new mongoose.Types.ObjectId(surveyId);
  
  // Count total entries
  const totalCount = await CatiRespondentQueue.countDocuments({ survey: surveyObjectId });
  console.log(`📊 Total queue entries: ${totalCount}`);
  
  if (totalCount === 0) {
    console.log('✅ No entries found. Nothing to process.\n');
    return { totalEntries: 0, uniquePhones: 0, duplicateCount: 0, deleted: 0 };
  }
  
  // Fetch entries in batches to avoid memory issues
  console.log('📥 Fetching entries from database...');
  const allEntries = await CatiRespondentQueue.find({ survey: surveyObjectId })
    .select('_id respondentContact.phone respondentContact.name status createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  
  console.log(`✅ Fetched ${allEntries.length} entries\n`);
  
  // Group by normalized phone number and identify duplicates
  console.log('🔍 Processing entries to find duplicates...');
  const phoneMap = new Map();
  const idsToDelete = [];
  
  allEntries.forEach(entry => {
    const phone = entry.respondentContact?.phone;
    if (!phone) {
      return; // Skip entries without phone numbers
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    if (!phoneMap.has(normalizedPhone)) {
      // First occurrence - keep it
      phoneMap.set(normalizedPhone, entry);
    } else {
      // Duplicate - mark for deletion
      idsToDelete.push(new mongoose.Types.ObjectId(entry._id));
    }
  });
  
  const duplicateCount = idsToDelete.length;
  const uniquePhones = phoneMap.size;
  
  console.log(`📊 Duplicate Analysis:`);
  console.log(`  - Total entries: ${allEntries.length}`);
  console.log(`  - Unique phone numbers: ${uniquePhones}`);
  console.log(`  - Duplicate entries to delete: ${duplicateCount}`);
  
  if (duplicateCount === 0) {
    console.log('✅ No duplicates found!\n');
    return { totalEntries: allEntries.length, uniquePhones, duplicateCount: 0, deleted: 0 };
  }
  
  // Delete duplicates in batches
  console.log(`\n🗑️  Deleting ${duplicateCount} duplicate entries...`);
  let totalDeleted = 0;
  const DELETE_BATCH_SIZE = 1000;
  
  for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + DELETE_BATCH_SIZE);
    const batchNumber = Math.floor(i / DELETE_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(idsToDelete.length / DELETE_BATCH_SIZE);
    
    try {
      const deleteResult = await CatiRespondentQueue.deleteMany({
        _id: { $in: batch }
      });
      totalDeleted += deleteResult.deletedCount;
      console.log(`✅ Batch ${batchNumber}/${totalBatches}: Deleted ${deleteResult.deletedCount} duplicates (Total: ${totalDeleted}/${duplicateCount})`);
      
      // Small delay between batches
      if (i + DELETE_BATCH_SIZE < idsToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (deleteError) {
      console.error(`⚠️ Error deleting batch ${batchNumber}:`, deleteError.message);
    }
  }
  
  console.log(`\n✅ Duplicate cleanup completed: ${totalDeleted}/${duplicateCount} duplicates deleted`);
  
  return { totalEntries: allEntries.length, uniquePhones, duplicateCount, deleted: totalDeleted };
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();
  
  try {
    // Parse arguments
    const { surveyId, acName, excelFile } = parseArguments();
    
    console.log('='.repeat(70));
    console.log('ADD CONTACTS TO SURVEY');
    console.log('='.repeat(70));
    console.log(`Survey ID: ${surveyId}`);
    console.log(`AC Name: ${acName}`);
    console.log(`Excel File: ${excelFile}`);
    console.log('='.repeat(70));
    
    // Connect to database
    await connectDB();
    
    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      throw new Error(`Survey ${surveyId} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName}`);
    
    // Process Excel file
    const { contacts, errors } = await processExcelFile(excelFile, acName);
    
    if (contacts.length === 0) {
      console.log('❌ No valid contacts to add');
      process.exit(0);
    }
    
    // Update JSON file
    const { newContacts } = await updateJSONFile(surveyId, contacts, acName);
    
    // Update survey to reference JSON file if not already set
    if (!survey.respondentContactsFile) {
      await Survey.findByIdAndUpdate(surveyId, {
        respondentContactsFile: `data/respondent-contacts/${surveyId}.json`
      });
      console.log(`✅ Updated survey to reference JSON file`);
    }
    
    // Create queue entries
    const queueEntriesCreated = await createQueueEntries(surveyId, contacts);
    
    // Cleanup duplicates
    const cleanupResult = await cleanupDuplicates(surveyId);
    
    // Verify final status
    console.log(`\n🔍 Final Verification:`);
    const targetACPending = await CatiRespondentQueue.countDocuments({
      survey: surveyId,
      status: 'pending',
      'respondentContact.ac': acName
    });
    const totalPending = await CatiRespondentQueue.countDocuments({
      survey: surveyId,
      status: 'pending'
    });
    console.log(`  - Pending "${acName}" contacts in queue: ${targetACPending}`);
    console.log(`  - Total pending contacts in queue: ${totalPending}`);
    
    // Generate summary report
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const summary = {
      generatedAt: new Date().toISOString(),
      surveyId: surveyId,
      surveyName: survey.surveyName,
      acName: acName,
      excelFile: excelFile,
      totalRowsInExcel: contacts.length + errors.length,
      validContacts: contacts.length,
      errors: errors.length,
      newContactsAdded: newContacts.length,
      queueEntriesCreated: queueEntriesCreated,
      duplicateCleanup: cleanupResult,
      finalStatus: {
        pendingTargetAC: targetACPending,
        totalPending: totalPending
      },
      durationSeconds: duration,
      errors: errors.slice(0, 100) // Limit errors in report
    };
    
    const reportPath = path.join(__dirname, `../reports/add-contacts-${surveyId}-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n✅ Summary report saved to: ${reportPath}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Added ${newContacts.length} contacts to JSON file`);
    console.log(`✅ Created ${queueEntriesCreated} queue entries`);
    console.log(`✅ Deleted ${cleanupResult.deleted} duplicate entries`);
    console.log(`✅ Pending "${acName}" contacts in queue: ${targetACPending}`);
    console.log(`⏱️  Total duration: ${duration}s`);
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error processing contacts:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, processExcelFile, updateJSONFile, createQueueEntries, cleanupDuplicates };

