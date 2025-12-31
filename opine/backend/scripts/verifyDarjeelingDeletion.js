/**
 * Verification script to check if Darjeeling AC respondents were deleted
 */

const mongoose = require('mongoose');
const fs = require('fs');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const TARGET_AC = 'Darjeeling';
const JSON_FILE_PATH = '/var/www/opine/data/respondent-contacts/68fd1915d41841da463f0d46.json';

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Check database
    const dbCount = await CatiRespondentQueue.countDocuments({
      'respondentContact.ac': TARGET_AC
    });
    
    // Check JSON file
    let jsonCount = 0;
    let jsonTotal = 0;
    if (fs.existsSync(JSON_FILE_PATH)) {
      const contacts = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
      jsonTotal = Array.isArray(contacts) ? contacts.length : 0;
      jsonCount = Array.isArray(contacts) ? contacts.filter(c => (c.ac || '') === TARGET_AC).length : 0;
    }
    
    console.log('='.repeat(80));
    console.log('📊 Verification Results:');
    console.log('='.repeat(80));
    console.log(`\nDatabase (CatiRespondentQueue):`);
    console.log(`   Records with AC "${TARGET_AC}": ${dbCount}`);
    console.log(`   Status: ${dbCount === 0 ? '✅ All deleted' : '⚠️  Still has records'}`);
    
    console.log(`\nJSON File:`);
    console.log(`   Total contacts: ${jsonTotal}`);
    console.log(`   Contacts with AC "${TARGET_AC}": ${jsonCount}`);
    console.log(`   Status: ${jsonCount === 0 ? '✅ All deleted' : '⚠️  Still has contacts'}`);
    
    console.log('\n' + '='.repeat(80));
    
    if (dbCount === 0 && jsonCount === 0) {
      console.log('✅ Verification PASSED: All Darjeeling AC respondents have been deleted');
    } else {
      console.log('⚠️  Verification FAILED: Some Darjeeling AC respondents still exist');
    }
    console.log('='.repeat(80));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
