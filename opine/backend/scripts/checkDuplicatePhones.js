const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

// Survey ID to check
const SURVEY_ID = '68fd1915d41841da463f0d46';

// Set to true to actually delete duplicates (false = dry run)
const DELETE_DUPLICATES = true;

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Check for duplicate phone numbers in catirespondentqueues
 */
async function checkDuplicatePhones() {
  try {
    console.log('\n🔍 Checking for duplicate phone numbers...');
    console.log(`📋 Survey ID: ${SURVEY_ID}`);
    console.log(`🗑️  Delete Mode: ${DELETE_DUPLICATES ? 'ENABLED (will delete)' : 'DISABLED (dry run)'}\n`);

    // Get all queue entries for this survey
    const allEntries = await CatiRespondentQueue.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID)
    }).select('_id respondentContact.phone respondentContact.name status assignedTo createdAt');

    console.log(`📊 Total queue entries found: ${allEntries.length}\n`);

    // Group by phone number
    const phoneMap = new Map();

    allEntries.forEach(entry => {
      const phone = entry.respondentContact?.phone;
      if (!phone) {
        return; // Skip entries without phone numbers
      }

      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');

      if (!phoneMap.has(normalizedPhone)) {
        phoneMap.set(normalizedPhone, []);
      }

      phoneMap.get(normalizedPhone).push({
        _id: entry._id,
        phone: phone,
        name: entry.respondentContact?.name || 'N/A',
        status: entry.status,
        assignedTo: entry.assignedTo ? entry.assignedTo.toString() : null,
        createdAt: entry.createdAt
      });
    });

    // Find duplicates (phone numbers with more than one entry)
    const duplicates = [];
    phoneMap.forEach((entries, phone) => {
      if (entries.length > 1) {
        // Sort by createdAt (oldest first)
        entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        duplicates.push({
          phone: phone,
          count: entries.length,
          entries: entries
        });
      }
    });

    // Display results
    if (duplicates.length === 0) {
      console.log('✅ No duplicate phone numbers found!\n');
      console.log('📊 Summary:');
      console.log(`   - Total entries: ${allEntries.length}`);
      console.log(`   - Unique phone numbers: ${phoneMap.size}`);
      console.log(`   - Duplicates: 0\n`);
      return {
        totalEntries: allEntries.length,
        uniquePhones: phoneMap.size,
        duplicateCount: 0,
        duplicates: [],
        deletedCount: 0
      };
    } else {
      console.log(`⚠️  Found ${duplicates.length} duplicate phone number(s):\n`);
      console.log('='.repeat(80));
      
      duplicates.forEach((dup, index) => {
        console.log(`\n${index + 1}. Phone Number: ${dup.phone}`);
        console.log(`   Occurrences: ${dup.count}`);
        console.log(`   Details:`);
        
        dup.entries.forEach((entry, entryIndex) => {
          const keepDelete = entryIndex === 0 ? '✅ KEEP (oldest)' : '❌ DELETE';
          console.log(`   ${entryIndex + 1}. Object ID: ${entry._id} ${keepDelete}`);
          console.log(`      Name: ${entry.name}`);
          console.log(`      Status: ${entry.status}`);
          console.log(`      Assigned To: ${entry.assignedTo || 'Not assigned'}`);
          console.log(`      Created At: ${entry.createdAt}`);
          console.log('');
        });
        console.log('-'.repeat(80));
      });

      console.log('\n📊 Summary:');
      console.log(`   - Total entries: ${allEntries.length}`);
      console.log(`   - Unique phone numbers: ${phoneMap.size}`);
      console.log(`   - Duplicate phone numbers: ${duplicates.length}`);
      console.log(`   - Total duplicate entries: ${duplicates.reduce((sum, d) => sum + d.count, 0)}`);
      console.log(`   - Entries to keep: ${duplicates.length}`);
      console.log(`   - Entries to delete: ${duplicates.reduce((sum, d) => sum + d.count - 1, 0)}\n`);

      // Delete duplicates
      let deletedCount = 0;
      const idsToDelete = [];

      duplicates.forEach((dup) => {
        // Keep the first entry (oldest), delete the rest
        for (let i = 1; i < dup.entries.length; i++) {
          idsToDelete.push(new mongoose.Types.ObjectId(dup.entries[i]._id));
        }
      });

      if (idsToDelete.length > 0) {
        console.log(`\n🗑️  Preparing to delete ${idsToDelete.length} duplicate entries...\n`);
        
        if (DELETE_DUPLICATES) {
          console.log('⚠️  DELETION MODE ENABLED - Deleting duplicates...\n');
          const deleteResult = await CatiRespondentQueue.deleteMany({
            _id: { $in: idsToDelete }
          });
          deletedCount = deleteResult.deletedCount;
          console.log(`✅ Successfully deleted ${deletedCount} duplicate entries!\n`);
        } else {
          console.log('ℹ️  DRY RUN MODE - No deletions performed');
          console.log(`   Would delete ${idsToDelete.length} entries with IDs:\n`);
          idsToDelete.slice(0, 10).forEach(id => console.log(`   - ${id}`));
          if (idsToDelete.length > 10) {
            console.log(`   ... and ${idsToDelete.length - 10} more\n`);
          }
        }
    }

    return {
      totalEntries: allEntries.length,
      uniquePhones: phoneMap.size,
      duplicateCount: duplicates.length,
        duplicates: duplicates,
        deletedCount: DELETE_DUPLICATES ? deletedCount : 0,
        wouldDeleteCount: !DELETE_DUPLICATES ? idsToDelete.length : 0
    };
    }

  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await connectDB();
    const result = await checkDuplicatePhones();
    
    // Save results to a JSON file for reference
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `duplicate-phones-report-${SURVEY_ID}-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}\n`);
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkDuplicatePhones };

