const mongoose = require('mongoose');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

// Survey ID to check
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
 * Check for duplicate phone numbers in catirespondentqueues
 */
async function checkDuplicatePhones() {
  try {
    console.log('\n🔍 Checking for duplicate phone numbers in PRODUCTION...');
    console.log(`📋 Survey ID: ${SURVEY_ID}\n`);

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
        _id: entry._id.toString(),
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
        duplicates.push({
          phone: phone,
          count: entries.length,
          entries: entries
        });
      }
    });

    // Display results
    if (duplicates.length === 0) {
      console.log('✅ No duplicate phone numbers found in PRODUCTION!\n');
      console.log('📊 Summary:');
      console.log(`   - Total entries: ${allEntries.length}`);
      console.log(`   - Unique phone numbers: ${phoneMap.size}`);
      console.log(`   - Duplicates: 0\n`);
    } else {
      console.log(`⚠️  Found ${duplicates.length} duplicate phone number(s) in PRODUCTION:\n`);
      console.log('='.repeat(80));
      
      // Show first 10 duplicates as examples
      const examplesToShow = Math.min(10, duplicates.length);
      duplicates.slice(0, examplesToShow).forEach((dup, index) => {
        console.log(`\n${index + 1}. Phone Number: ${dup.phone}`);
        console.log(`   Occurrences: ${dup.count}`);
        console.log(`   First entry: ${dup.entries[0]._id} - ${dup.entries[0].name} (Status: ${dup.entries[0].status})`);
        console.log(`   Duplicates to delete: ${dup.count - 1}`);
      });

      if (duplicates.length > examplesToShow) {
        console.log(`\n... and ${duplicates.length - examplesToShow} more duplicate phone numbers`);
      }

      console.log('\n' + '='.repeat(80));
      console.log('\n📊 Summary:');
      console.log(`   - Total entries: ${allEntries.length}`);
      console.log(`   - Unique phone numbers: ${phoneMap.size}`);
      console.log(`   - Duplicate phone numbers: ${duplicates.length}`);
      console.log(`   - Total duplicate entries: ${duplicates.reduce((sum, d) => sum + d.count, 0)}\n`);
    }

    return {
      totalEntries: allEntries.length,
      uniquePhones: phoneMap.size,
      duplicateCount: duplicates.length,
      duplicates: duplicates
    };

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
    const reportPath = path.join(__dirname, `duplicate-phones-report-PRODUCTION-${SURVEY_ID}-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`💾 Detailed report saved to: ${reportPath}\n`);
    
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


