/**
 * Script to delete Darjeeling AC respondents from:
 * 1. CatiRespondentQueue collection (both dev and prod)
 * 2. JSON file: /var/www/opine/data/respondent-contacts/68fd1915d41841da463f0d46.json
 * 
 * WARNING: This script permanently deletes data. Use with caution.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const TARGET_AC = 'Darjeeling';
const JSON_FILE_PATH = '/var/www/opine/data/respondent-contacts/68fd1915d41841da463f0d46.json';

const deleteFromDatabase = async () => {
  try {
    console.log(`\n🗑️  Deleting CatiRespondentQueue records with AC: "${TARGET_AC}"...`);
    
    // First, count how many records will be deleted
    const countQuery = {
      'respondentContact.ac': TARGET_AC
    };
    
    const count = await CatiRespondentQueue.countDocuments(countQuery);
    console.log(`   Found ${count} records to delete`);
    
    if (count === 0) {
      console.log(`   ✅ No records found with AC: "${TARGET_AC}"`);
      return { deleted: 0, total: 0 };
    }
    
    // Show sample records before deletion (for verification)
    const sampleRecords = await CatiRespondentQueue.find(countQuery).limit(5).lean();
    console.log(`\n   Sample records to be deleted (first 5):`);
    sampleRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. Name: ${record.respondentContact?.name || 'N/A'}, Phone: ${record.respondentContact?.phone || 'N/A'}, AC: ${record.respondentContact?.ac || 'N/A'}`);
    });
    
    // Delete the records
    const deleteResult = await CatiRespondentQueue.deleteMany(countQuery);
    
    console.log(`\n   ✅ Successfully deleted ${deleteResult.deletedCount} records from CatiRespondentQueue`);
    
    return { deleted: deleteResult.deletedCount, total: count };
  } catch (error) {
    console.error(`   ❌ Error deleting from database:`, error.message);
    throw error;
  }
};

const deleteFromJSONFile = async () => {
  try {
    console.log(`\n🗑️  Deleting records from JSON file: ${JSON_FILE_PATH}...`);
    
    // Check if file exists
    if (!fs.existsSync(JSON_FILE_PATH)) {
      console.log(`   ⚠️  JSON file not found: ${JSON_FILE_PATH}`);
      return { deleted: 0, total: 0 };
    }
    
    // Read the JSON file
    const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    const contacts = JSON.parse(fileContent);
    
    if (!Array.isArray(contacts)) {
      console.log(`   ⚠️  JSON file does not contain an array`);
      return { deleted: 0, total: 0 };
    }
    
    console.log(`   Total contacts in file: ${contacts.length}`);
    
    // Filter out Darjeeling contacts
    const beforeCount = contacts.length;
    const filteredContacts = contacts.filter(contact => {
      const ac = contact.ac || '';
      return ac !== TARGET_AC;
    });
    const afterCount = filteredContacts.length;
    const deletedCount = beforeCount - afterCount;
    
    console.log(`   Contacts with AC "${TARGET_AC}": ${deletedCount}`);
    
    if (deletedCount === 0) {
      console.log(`   ✅ No contacts found with AC: "${TARGET_AC}"`);
      return { deleted: 0, total: beforeCount };
    }
    
    // Show sample contacts to be deleted
    const darjeelingContacts = contacts.filter(contact => (contact.ac || '') === TARGET_AC);
    console.log(`\n   Sample contacts to be deleted (first 5):`);
    darjeelingContacts.slice(0, 5).forEach((contact, index) => {
      console.log(`   ${index + 1}. Name: ${contact.name || 'N/A'}, Phone: ${contact.phone || 'N/A'}, AC: ${contact.ac || 'N/A'}`);
    });
    
    // Create backup before deletion
    const backupPath = `${JSON_FILE_PATH}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, fileContent, 'utf8');
    console.log(`\n   📦 Backup created: ${backupPath}`);
    
    // Write filtered contacts back to file
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(filteredContacts, null, 2), 'utf8');
    
    console.log(`\n   ✅ Successfully deleted ${deletedCount} contacts from JSON file`);
    console.log(`   Remaining contacts: ${afterCount}`);
    
    return { deleted: deletedCount, total: beforeCount };
  } catch (error) {
    console.error(`   ❌ Error deleting from JSON file:`, error.message);
    throw error;
  }
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(80));
    console.log(`🚀 Starting deletion of "${TARGET_AC}" AC respondents`);
    console.log('='.repeat(80));
    
    // Delete from database
    const dbResult = await deleteFromDatabase();
    
    // Delete from JSON file
    const jsonResult = await deleteFromJSONFile();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`\nDatabase (CatiRespondentQueue):`);
    console.log(`   Total records found: ${dbResult.total}`);
    console.log(`   Records deleted: ${dbResult.deleted}`);
    
    console.log(`\nJSON File:`);
    console.log(`   Total contacts in file: ${jsonResult.total}`);
    console.log(`   Contacts deleted: ${jsonResult.deleted}`);
    console.log(`   Remaining contacts: ${jsonResult.total - jsonResult.deleted}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Script completed successfully!');
    console.log('='.repeat(80));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { deleteFromDatabase, deleteFromJSONFile };
