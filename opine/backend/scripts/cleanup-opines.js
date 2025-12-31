/**
 * Cleanup Script for Opine India Backend
 * 
 * This script removes the old "opines" collection from MongoDB
 * since we're now using the Contact system instead.
 * 
 * Usage: node scripts/cleanup-opines.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function cleanupOpinesCollection() {
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
      
      if (count > 0) {
        console.log('⚠️  WARNING: This will delete all documents in the "opines" collection!');
        console.log('💡 If you want to keep the data, please backup first.');
        console.log('');
        console.log('To proceed with deletion, uncomment the following lines in this script:');
        console.log('// await db.collection("opines").drop();');
        console.log('// console.log("🗑️  Successfully deleted opines collection");');
      } else {
        console.log('📭 Collection is empty, safe to delete');
        // Uncomment the next two lines to actually delete the collection
        // await db.collection('opines').drop();
        // console.log('🗑️  Successfully deleted opines collection');
      }
    } else {
      console.log('✅ "opines" collection not found - already cleaned up!');
    }
    
    // Show current collections
    console.log('\n📋 Current collections in database:');
    const currentCollections = await db.listCollections().toArray();
    currentCollections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupOpinesCollection();
