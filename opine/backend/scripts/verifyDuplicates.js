const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const CatiRespondentQueue = require('../models/CatiRespondentQueue');

const SURVEY_ID = '68fd1915d41841da463f0d46';

(async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
  await mongoose.connect(mongoUri);
  
  const allEntries = await CatiRespondentQueue.find({
    survey: new mongoose.Types.ObjectId(SURVEY_ID)
  }).select('respondentContact.phone status');
  
  const phoneMap = new Map();
  allEntries.forEach(entry => {
    const phone = entry.respondentContact?.phone;
    if (phone) {
      const normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      if (!phoneMap.has(normalizedPhone)) {
        phoneMap.set(normalizedPhone, 0);
      }
      phoneMap.set(normalizedPhone, phoneMap.get(normalizedPhone) + 1);
    }
  });
  
  const duplicates = [];
  phoneMap.forEach((count, phone) => {
    if (count > 1) {
      duplicates.push({ phone, count });
    }
  });
  
  console.log('=== DATABASE VERIFICATION ===');
  console.log(`Total entries: ${allEntries.length}`);
  console.log(`Unique phone numbers: ${phoneMap.size}`);
  console.log(`Duplicate phone numbers: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate phone numbers:`);
    duplicates.slice(0, 10).forEach(d => {
      console.log(`   - ${d.phone}: ${d.count} occurrences`);
    });
  } else {
    console.log(`\n✅ No duplicates found! Database is clean.`);
  }
  
  // Get status distribution
  const statusCounts = await CatiRespondentQueue.aggregate([
    { $match: { survey: new mongoose.Types.ObjectId(SURVEY_ID) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  console.log(`\n=== STATUS DISTRIBUTION ===`);
  statusCounts.forEach(s => {
    console.log(`  ${s._id || 'null'}: ${s.count}`);
  });
  
  await mongoose.connection.close();
})();


