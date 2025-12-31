/**
 * Delete Opines Collection Script
 * 
 * This script deletes the empty "opines" collection from MongoDB
 * since we're now using the Contact system instead.
 * 
 * Usage: node scripts/delete-opines.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function deleteOpinesCollection() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');

    const db = mongoose.connection.db;
    
    // Check if opines collection exists
    const collections = await db.listCollections().toArray();
    const opinesCollection = collections.find(col => col.name === 'opines');
    
    if (opinesCollection) {
      console.log('📋 Found "opines" collection');
      
      // Count documents in the collection
      const count = await db.collection('opines').countDocuments();
      console.log(`📊 Found ${count} documents in "opines" collection`);
      
      if (count === 0) {
        console.log('🗑️  Deleting empty "opines" collection...');
        await db.collection('opines').drop();
        console.log('✅ Successfully deleted "opines" collection');
      } else {
        console.log('⚠️  Collection is not empty. Please backup data before deletion.');
        console.log('💡 Use cleanup-opines.js to see what data exists first.');
      }
    } else {
      console.log('✅ "opines" collection not found - already deleted!');
    }
    
    // Show current collections
    console.log('\n📋 Current collections in database:');
    const currentCollections = await db.listCollections().toArray();
    currentCollections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the deletion
deleteOpinesCollection();
