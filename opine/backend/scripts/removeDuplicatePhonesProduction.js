const mongoose = require('mongoose');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const Survey = require('../models/Survey');

// Survey ID to process
const SURVEY_ID = '68fd1915d41841da463f0d46';

// Production Database Connection
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';

/**
 * Connect to Production MongoDB
 */
async function connectDB() {
  try {
    console.log('🔌 Connecting to PRODUCTION MongoDB...');
    await mongoose.connect(PROD_MONGO_URI);
    console.log('✅ Connected to PRODUCTION MongoDB successfully');
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
 * Find the respondent contacts JSON file path
 */
function findRespondentContactsFile(survey) {
  const path = require('path');
  const fs = require('fs');
  
  const possiblePaths = [];
  
  // Check if survey has respondentContactsFile field
  if (survey.respondentContactsFile) {
    if (path.isAbsolute(survey.respondentContactsFile)) {
      possiblePaths.push(survey.respondentContactsFile);
    } else {
      // Try relative to backend directory
      possiblePaths.push(path.join(__dirname, '..', survey.respondentContactsFile));
      // Try relative to project root
      possiblePaths.push(path.join('/var/www/opine', survey.respondentContactsFile));
    }
  }
  
  // Also try default paths
  possiblePaths.push(path.join('/var/www/opine', 'data', 'respondent-contacts', `${SURVEY_ID}.json`));
  possiblePaths.push(path.join(__dirname, '..', 'data', 'respondent-contacts', `${SURVEY_ID}.json`));
  
  // Also check Optimised-backup directory
  possiblePaths.push(path.join('/var/www/Optimised-backup', 'opine', 'data', 'respondent-contacts', `${SURVEY_ID}.json`));
  
  // Find the first existing file
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

/**
 * Remove duplicate phone numbers from respondent contacts JSON file
 */
async function removeDuplicatePhonesFromSurveyFile() {
  try {
    console.log('\n🔍 Step 1: Cleaning duplicates from respondent contacts JSON file in PRODUCTION...');
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);

    // Find the survey
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      console.log('⚠️  Survey not found in PRODUCTION!');
      return {
        totalContacts: 0,
        uniquePhones: 0,
        kept: 0,
        deleted: 0,
        filePath: null
      };
    }

    // Find the JSON file
    const filePath = findRespondentContactsFile(survey);
    if (!filePath) {
      console.log('⚠️  Respondent contacts JSON file not found in PRODUCTION!');
      console.log('   Checked default locations but file does not exist.\n');
      return {
        totalContacts: 0,
        uniquePhones: 0,
        kept: 0,
        deleted: 0,
        filePath: null
      };
    }

    console.log(`✅ Found JSON file at: ${filePath}\n`);

    // Read the JSON file
    const fs = require('fs');
    let allContacts = [];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      allContacts = JSON.parse(fileContent);
      if (!Array.isArray(allContacts)) {
        console.log('⚠️  File content is not an array!');
        return {
          totalContacts: 0,
          uniquePhones: 0,
          kept: 0,
          deleted: 0,
          filePath: filePath
        };
      }
    } catch (fileError) {
      console.error('❌ Error reading JSON file:', fileError.message);
      throw fileError;
    }

    console.log(`📊 Total contacts in JSON file: ${allContacts.length}\n`);

    // Sort contacts by addedAt (oldest first), then by index for consistent ordering
    const sortedContacts = allContacts
      .map((contact, index) => ({ ...contact, originalIndex: index }))
      .sort((a, b) => {
        const dateA = a.addedAt ? new Date(a.addedAt) : new Date(0);
        const dateB = b.addedAt ? new Date(b.addedAt) : new Date(0);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.originalIndex - b.originalIndex;
      });

    // Group by normalized phone number and identify duplicates
    const phoneMap = new Map();
    const contactsToKeep = [];
    const contactsToDelete = [];

    sortedContacts.forEach((contact) => {
      const phone = contact.phone;
      if (!phone) {
        // Keep contacts without phone numbers (shouldn't happen, but be safe)
        contactsToKeep.push(contact);
        return;
      }

      const normalizedPhone = normalizePhone(phone);

      if (!phoneMap.has(normalizedPhone)) {
        // First occurrence - keep it
        phoneMap.set(normalizedPhone, contact);
        contactsToKeep.push(contact);
      } else {
        // Duplicate - mark for deletion
        contactsToDelete.push({
          ...contact,
          keptContact: {
            name: phoneMap.get(normalizedPhone).name,
            phone: phoneMap.get(normalizedPhone).phone,
            addedAt: phoneMap.get(normalizedPhone).addedAt
          }
        });
      }
    });

    console.log(`📊 Analysis Results (JSON file - PRODUCTION):`);
    console.log(`   - Total contacts: ${allContacts.length}`);
    console.log(`   - Unique phone numbers: ${phoneMap.size}`);
    console.log(`   - Contacts to keep: ${contactsToKeep.length}`);
    console.log(`   - Contacts to delete: ${contactsToDelete.length}\n`);

    if (contactsToDelete.length === 0) {
      console.log('✅ No duplicates found in JSON file. Nothing to delete.\n');
      return {
        totalContacts: allContacts.length,
        uniquePhones: phoneMap.size,
        kept: contactsToKeep.length,
        deleted: 0,
        filePath: filePath
      };
    }

    // Show summary of what will be deleted
    console.log('⚠️  Contacts to be deleted from JSON file in PRODUCTION (keeping first occurrence):\n');
    console.log('='.repeat(80));
    
    // Group deletions by phone for better readability
    const deletionsByPhone = new Map();
    contactsToDelete.forEach(contact => {
      const normalizedPhone = normalizePhone(contact.phone);
      if (!deletionsByPhone.has(normalizedPhone)) {
        deletionsByPhone.set(normalizedPhone, []);
      }
      deletionsByPhone.get(normalizedPhone).push(contact);
    });

    // Show first 10 examples
    let exampleCount = 0;
    const maxExamples = 10;
    deletionsByPhone.forEach((deletions, phone) => {
      if (exampleCount < maxExamples) {
        const keptContact = deletions[0].keptContact;
        console.log(`\n📞 Phone: ${phone} (${deletions.length} duplicate(s) to delete)`);
        console.log(`   ✅ Keeping: ${keptContact.name} - ${keptContact.phone}`);
        deletions.slice(0, 3).forEach((del, idx) => {
          console.log(`   ❌ Deleting ${idx + 1}: ${del.name} - ${del.phone}`);
        });
        if (deletions.length > 3) {
          console.log(`   ... and ${deletions.length - 3} more`);
        }
        exampleCount++;
      }
    });

    if (deletionsByPhone.size > maxExamples) {
      console.log(`\n... and ${deletionsByPhone.size - maxExamples} more duplicate phone numbers`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n🗑️  Ready to delete ${contactsToDelete.length} duplicate contacts from JSON file in PRODUCTION...\n`);

    // Remove originalIndex from contactsToKeep before saving
    const cleanedContacts = contactsToKeep.map(({ originalIndex, keptContact, ...contact }) => contact);
    
    // Save cleaned contacts back to JSON file
    console.log('🗑️  Saving cleaned contacts to JSON file in PRODUCTION...');
    fs.writeFileSync(filePath, JSON.stringify(cleanedContacts, null, 2), 'utf8');

    console.log(`✅ JSON file cleaned in PRODUCTION:`);
    console.log(`   - Deleted: ${contactsToDelete.length} duplicate contacts`);
    console.log(`   - Kept: ${contactsToKeep.length} unique contacts`);
    console.log(`   - File: ${filePath}\n`);

    return {
      totalContacts: allContacts.length,
      uniquePhones: phoneMap.size,
      kept: contactsToKeep.length,
      deleted: contactsToDelete.length,
      filePath: filePath
    };

  } catch (error) {
    console.error('❌ Error removing duplicates from JSON file:', error);
    throw error;
  }
}

/**
 * Remove duplicate phone numbers from CatiRespondentQueue, keeping only the first occurrence
 */
async function removeDuplicatePhones() {
  try {
    console.log('\n🔍 Starting duplicate removal process in PRODUCTION...');
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);

    // Get all queue entries for this survey, sorted by createdAt (oldest first)
    const allEntries = await CatiRespondentQueue.find({
      survey: new mongoose.Types.ObjectId(SURVEY_ID)
    })
    .select('_id respondentContact.phone respondentContact.name status createdAt')
    .sort({ createdAt: 1, _id: 1 }); // Sort by creation date, then by _id for consistent ordering

    console.log(`📊 Total queue entries found: ${allEntries.length}\n`);

    // Group by phone number and identify duplicates
    const phoneMap = new Map();
    const entriesToDelete = [];
    const entriesToKeep = [];

    allEntries.forEach(entry => {
      const phone = entry.respondentContact?.phone;
      if (!phone) {
        return; // Skip entries without phone numbers
      }

      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedPhone = normalizePhone(phone);

      if (!phoneMap.has(normalizedPhone)) {
        // First occurrence - keep it
        phoneMap.set(normalizedPhone, entry);
        entriesToKeep.push({
          _id: entry._id.toString(),
          phone: phone,
          name: entry.respondentContact?.name || 'N/A',
          status: entry.status,
          createdAt: entry.createdAt
        });
      } else {
        // Duplicate - mark for deletion
        entriesToDelete.push({
          _id: entry._id.toString(),
          phone: phone,
          name: entry.respondentContact?.name || 'N/A',
          status: entry.status,
          createdAt: entry.createdAt,
          keptEntry: {
            _id: phoneMap.get(normalizedPhone)._id.toString(),
            name: phoneMap.get(normalizedPhone).respondentContact?.name || 'N/A'
          }
        });
      }
    });

    console.log(`📊 Analysis Results:`);
    console.log(`   - Total entries: ${allEntries.length}`);
    console.log(`   - Unique phone numbers: ${phoneMap.size}`);
    console.log(`   - Entries to keep: ${entriesToKeep.length}`);
    console.log(`   - Entries to delete: ${entriesToDelete.length}\n`);

    if (entriesToDelete.length === 0) {
      console.log('✅ No duplicates found in PRODUCTION. Nothing to delete.\n');
      return {
        totalEntries: allEntries.length,
        uniquePhones: phoneMap.size,
        kept: entriesToKeep.length,
        deleted: 0,
        deletedIds: []
      };
    }

    // Show summary of what will be deleted
    console.log('⚠️  Entries to be deleted from PRODUCTION (keeping first occurrence):\n');
    console.log('='.repeat(80));
    
    // Group deletions by phone for better readability
    const deletionsByPhone = new Map();
    entriesToDelete.forEach(entry => {
      const normalizedPhone = normalizePhone(entry.phone);
      if (!deletionsByPhone.has(normalizedPhone)) {
        deletionsByPhone.set(normalizedPhone, []);
      }
      deletionsByPhone.get(normalizedPhone).push(entry);
    });

    // Show first 20 examples
    let exampleCount = 0;
    const maxExamples = 20;
    deletionsByPhone.forEach((deletions, phone) => {
      if (deletions.length > 0 && exampleCount < maxExamples) {
        const keptEntry = deletions[0].keptEntry;
        console.log(`\n📞 Phone: ${phone} (${deletions.length} duplicate(s) to delete)`);
        console.log(`   ✅ Keeping: ${keptEntry._id} - ${keptEntry.name}`);
        deletions.slice(0, 3).forEach((del, idx) => {
          console.log(`   ❌ Deleting ${idx + 1}: ${del._id} - ${del.name} (Status: ${del.status})`);
        });
        if (deletions.length > 3) {
          console.log(`   ... and ${deletions.length - 3} more`);
        }
        exampleCount++;
      }
    });

    if (deletionsByPhone.size > maxExamples) {
      console.log(`\n... and ${deletionsByPhone.size - maxExamples} more phone numbers with duplicates`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n🗑️  Ready to delete ${entriesToDelete.length} duplicate entries from PRODUCTION...\n`);

    // Extract IDs to delete
    const idsToDelete = entriesToDelete.map(e => new mongoose.Types.ObjectId(e._id));

    // Perform deletion
    console.log('🗑️  Deleting duplicate entries from PRODUCTION...');
    const deleteResult = await CatiRespondentQueue.deleteMany({
      _id: { $in: idsToDelete }
    });

    console.log(`✅ Deletion completed in PRODUCTION:`);
    console.log(`   - Deleted: ${deleteResult.deletedCount} entries\n`);

    // Save deletion log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, `duplicate-deletion-log-PRODUCTION-${SURVEY_ID}-${Date.now()}.json`);
    
    const deletionLog = {
      surveyId: SURVEY_ID,
      timestamp: new Date().toISOString(),
      environment: 'PRODUCTION',
      summary: {
        totalEntries: allEntries.length,
        uniquePhones: phoneMap.size,
        kept: entriesToKeep.length,
        deleted: deleteResult.deletedCount
      },
      deletedEntries: entriesToDelete,
      keptEntries: entriesToKeep
    };

    fs.writeFileSync(logPath, JSON.stringify(deletionLog, null, 2));
    console.log(`💾 Deletion log saved to: ${logPath}\n`);

    return {
      totalEntries: allEntries.length,
      uniquePhones: phoneMap.size,
      kept: entriesToKeep.length,
      deleted: deleteResult.deletedCount,
      deletedIds: idsToDelete.map(id => id.toString()),
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
    
    // Step 1: Clean duplicates from respondent contacts JSON file
    const surveyResult = await removeDuplicatePhonesFromSurveyFile();
    
    // Step 2: Clean duplicates from CatiRespondentQueue
    const queueResult = await removeDuplicatePhones();
    
    console.log('\n📊 Final Summary (PRODUCTION):');
    console.log('='.repeat(80));
    console.log('\n📋 Respondent Contacts JSON File:');
    console.log(`   Total contacts before: ${surveyResult.totalContacts}`);
    console.log(`   Unique phone numbers: ${surveyResult.uniquePhones}`);
    console.log(`   Contacts kept: ${surveyResult.kept}`);
    console.log(`   Contacts deleted: ${surveyResult.deleted}`);
    if (surveyResult.filePath) {
      console.log(`   File path: ${surveyResult.filePath}`);
    }
    
    console.log('\n📋 CatiRespondentQueue:');
    console.log(`   Total entries before: ${queueResult.totalEntries}`);
    console.log(`   Unique phone numbers: ${queueResult.uniquePhones}`);
    console.log(`   Entries kept: ${queueResult.kept}`);
    console.log(`   Entries deleted: ${queueResult.deleted}`);
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total duplicates cleaned in PRODUCTION:`);
    console.log(`   - Survey contacts: ${surveyResult.deleted}`);
    console.log(`   - Queue entries: ${queueResult.deleted}`);
    console.log(`   - Grand total: ${surveyResult.deleted + queueResult.deleted}`);
    console.log('='.repeat(80));
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    console.log('✅ Duplicate removal completed successfully in PRODUCTION!\n');
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

module.exports = { removeDuplicatePhones, removeDuplicatePhonesFromSurveyFile };


