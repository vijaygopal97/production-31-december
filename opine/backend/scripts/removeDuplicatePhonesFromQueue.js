const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

// Survey ID to process
const SURVEY_ID = '68fd1915d41841da463f0d46';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Normalize phone number (remove spaces, dashes, parentheses, etc.)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.toString().trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Remove duplicate phone numbers from CatiRespondentQueue, keeping only the first occurrence
 * Uses MongoDB aggregation for efficient processing
 */
async function removeDuplicatePhones() {
  try {
    console.log('\n🔍 Checking for duplicate phone numbers...');
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);

    const surveyId = new mongoose.Types.ObjectId(SURVEY_ID);

    // Count total entries
    const totalCount = await CatiRespondentQueue.countDocuments({ survey: surveyId });
    console.log(`📊 Total queue entries found: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('✅ No entries found. Nothing to process.\n');
      return {
        totalEntries: 0,
        uniquePhones: 0,
        duplicateCount: 0,
        kept: 0,
        deleted: 0,
        deletedIds: []
      };
    }

    console.log('🔍 Finding duplicates using MongoDB aggregation...\n');

    // Step 1: Get all entries sorted by createdAt (oldest first)
    // Process in batches to avoid memory issues
    console.log('📥 Fetching entries from database...');
    const allEntries = await CatiRespondentQueue.find({ survey: surveyId })
      .select('_id respondentContact.phone respondentContact.name status createdAt')
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    console.log(`✅ Fetched ${allEntries.length} entries\n`);

    // Step 2: Group by normalized phone number and identify duplicates
    console.log('🔍 Processing entries to find duplicates...\n');
    const phoneMap = new Map();
    const idsToDelete = [];
    const duplicates = [];

    // Process entries and identify duplicates
    allEntries.forEach((entry, index) => {
      if (index > 0 && index % 50000 === 0) {
        console.log(`   Processed ${index}/${allEntries.length} entries...`);
      }

      const phone = entry.respondentContact?.phone;
      if (!phone) {
        return; // Skip entries without phone numbers
      }

      const normalizedPhone = normalizePhone(phone);

      if (!phoneMap.has(normalizedPhone)) {
        // First occurrence - keep it
        phoneMap.set(normalizedPhone, {
          _id: entry._id,
          phone: phone,
          name: entry.respondentContact?.name || 'N/A',
          createdAt: entry.createdAt
        });
      } else {
        // Duplicate - mark for deletion
        idsToDelete.push(entry._id);
        
        // Track duplicate info
        const existing = phoneMap.get(normalizedPhone);
        const dupInfo = duplicates.find(d => d.phone === normalizedPhone);
        if (!dupInfo) {
          duplicates.push({
            phone: normalizedPhone,
            count: 2, // Will be updated
            keptEntry: {
              _id: existing._id.toString(),
              name: existing.name,
              createdAt: existing.createdAt
            }
          });
        } else {
          dupInfo.count++;
        }
      }
    });

    console.log(`✅ Processing complete\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate phone numbers found!\n');
      console.log('📊 Summary:');
      console.log(`   - Total entries: ${totalCount}`);
      console.log(`   - Unique phone numbers: ${phoneMap.size}`);
      console.log(`   - Duplicates: 0\n`);
      
      return {
        totalEntries: totalCount,
        uniquePhones: phoneMap.size,
        duplicateCount: 0,
        kept: totalCount,
        deleted: 0,
        deletedIds: []
      };
    }

    const totalDuplicatesToDelete = idsToDelete.length;

    // Show summary
    console.log('='.repeat(80));
    console.log(`\n⚠️  Found ${duplicates.length} duplicate phone number(s)`);
    console.log(`📊 Duplicate Summary:`);
    console.log(`   - Total entries: ${totalCount}`);
    console.log(`   - Unique phone numbers: ${phoneMap.size}`);
    console.log(`   - Duplicate phone numbers: ${duplicates.length}`);
    console.log(`   - Entries to delete: ${totalDuplicatesToDelete}`);
    console.log(`   - Entries to keep: ${totalCount - totalDuplicatesToDelete}\n`);

    // Show first 10 duplicates as examples
    console.log('⚠️  Sample duplicates (first 10):\n');
    duplicates.slice(0, 10).forEach((dup, index) => {
      const duplicateCount = dup.count - 1; // Total count minus the one we keep
      console.log(`${index + 1}. Phone: ${dup.phone}`);
      console.log(`   Occurrences: ${dup.count}`);
      console.log(`   ✅ Keeping: ${dup.keptEntry.name} (ID: ${dup.keptEntry._id})`);
      console.log(`   ❌ Deleting: ${duplicateCount} duplicate(s)\n`);
    });

    if (duplicates.length > 10) {
      console.log(`... and ${duplicates.length - 10} more duplicate phone numbers\n`);
    }

    console.log('='.repeat(80));

    if (idsToDelete.length === 0) {
      console.log('\n✅ No duplicates to delete.\n');
      return {
        totalEntries: totalCount,
        uniquePhones: totalCount - totalDuplicatesToDelete,
        duplicateCount: duplicates.length,
        kept: totalCount,
        deleted: 0,
        deletedIds: []
      };
    }

    // Step 3: Delete duplicates in batches to avoid memory issues
    console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate entries in batches...\n`);
    
    const BATCH_SIZE = 10000;
    let totalDeleted = 0;
    const deletedIds = [];

    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(id => new mongoose.Types.ObjectId(id));
      
      const deleteResult = await CatiRespondentQueue.deleteMany({
        _id: { $in: batchIds }
      });

      totalDeleted += deleteResult.deletedCount;
      deletedIds.push(...batch.map(id => id.toString()));

      const progress = Math.min(i + BATCH_SIZE, idsToDelete.length);
      console.log(`   Progress: ${progress}/${idsToDelete.length} (${Math.round(progress / idsToDelete.length * 100)}%)`);
    }

    console.log(`\n✅ Deletion completed:`);
    console.log(`   - Deleted: ${totalDeleted} entries\n`);

    // Save deletion log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, `duplicate-deletion-log-${SURVEY_ID}-${Date.now()}.json`);
    
    const deletionLog = {
      surveyId: SURVEY_ID,
      timestamp: new Date().toISOString(),
      summary: {
        totalEntries: totalCount,
        uniquePhones: totalCount - totalDuplicatesToDelete,
        duplicateCount: duplicates.length,
        kept: totalCount - totalDuplicatesToDelete,
        deleted: totalDeleted
      },
      duplicates: duplicates.slice(0, 100), // Limit to first 100 for log file size
      totalDuplicatesFound: duplicates.length
    };

    fs.writeFileSync(logPath, JSON.stringify(deletionLog, null, 2));
    console.log(`💾 Deletion log saved to: ${logPath}\n`);

    return {
      totalEntries: totalCount,
      uniquePhones: totalCount - totalDuplicatesToDelete,
      duplicateCount: duplicates.length,
      kept: totalCount - totalDuplicatesToDelete,
      deleted: totalDeleted,
      deletedIds: deletedIds.slice(0, 1000), // Limit for return value
      logPath: logPath
    };

  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await connectDB();
    const result = await removeDuplicatePhones();
    
    console.log('\n📊 Final Summary:');
    console.log('='.repeat(80));
    console.log(`   - Total entries before: ${result.totalEntries}`);
    console.log(`   - Unique phone numbers: ${result.uniquePhones}`);
    console.log(`   - Duplicate phone numbers: ${result.duplicateCount}`);
    console.log(`   - Entries kept: ${result.kept}`);
    console.log(`   - Entries deleted: ${result.deleted}`);
    if (result.logPath) {
      console.log(`   - Log file: ${result.logPath}`);
    }
    console.log('='.repeat(80));
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    console.log('✅ Duplicate removal completed successfully!\n');
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

module.exports = { removeDuplicatePhones };
