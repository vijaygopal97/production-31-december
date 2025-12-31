const mongoose = require('mongoose');
require('dotenv').config();

const testSetNumberSave = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const SurveyResponse = require('../models/SurveyResponse');
    const collection = mongoose.connection.collection('surveyresponses');
    
    // Test updating an existing document
    const testId = '692f44ddc210e6861381f391';
    console.log(`\n🔵 Testing setNumber update on document: ${testId}`);
    
    // Check current value
    const before = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { projection: { setNumber: 1, responseId: 1 } }
    );
    console.log(`📊 BEFORE - setNumber: ${before?.setNumber}, responseId: ${before?.responseId}`);
    
    // Update with setNumber = 1
    const updateResult = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { $set: { setNumber: 1 } }
    );
    console.log(`📊 Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
    
    // Check after update
    const after = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { projection: { setNumber: 1, responseId: 1 } }
    );
    console.log(`📊 AFTER - setNumber: ${after?.setNumber}, responseId: ${after?.responseId}`);
    
    if (after?.setNumber === 1) {
      console.log('✅ SUCCESS: setNumber was saved correctly!');
    } else {
      console.log('❌ FAILED: setNumber was not saved correctly!');
    }
    
    // Test with null
    console.log(`\n🔵 Testing setNumber update with null`);
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { $set: { setNumber: null } }
    );
    const afterNull = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { projection: { setNumber: 1 } }
    );
    console.log(`📊 AFTER NULL - setNumber: ${afterNull?.setNumber}`);
    
    // Test with number again
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { $set: { setNumber: 2 } }
    );
    const afterTwo = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(testId) },
      { projection: { setNumber: 1 } }
    );
    console.log(`📊 AFTER 2 - setNumber: ${afterTwo?.setNumber}`);
    
    if (afterTwo?.setNumber === 2) {
      console.log('✅ SUCCESS: setNumber update works correctly!');
    } else {
      console.log('❌ FAILED: setNumber update does not work!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testSetNumberSave();

