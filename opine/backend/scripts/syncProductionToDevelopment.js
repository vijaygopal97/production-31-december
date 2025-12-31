/**
 * SYNC PRODUCTION DATABASE TO DEVELOPMENT
 * 
 * This script:
 * 1. Connects to both production and development databases
 * 2. Lists all collections in production
 * 3. Drops all collections in development
 * 4. Copies all collections from production to development
 * 5. Verifies the sync was successful
 * 
 * WARNING: This will DELETE all data in the development database and replace it with production data
 */

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Database connections
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine';
// Development database - try env first, then fallback to localhost
const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@localhost:27017/Opine?authSource=admin';

const PROD_DB_NAME = 'Opine';
const DEV_DB_NAME = 'Opine';

let prodClient, devClient, prodDb, devDb;

async function connectDatabases() {
  try {
    console.log('🔌 Connecting to PRODUCTION database...');
    console.log(`   URI: ${PROD_MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
    prodClient = new MongoClient(PROD_MONGO_URI);
    await prodClient.connect();
    prodDb = prodClient.db(PROD_DB_NAME);
    console.log('✅ Connected to PRODUCTION database\n');

    console.log('🔌 Connecting to DEVELOPMENT database...');
    console.log(`   URI: ${DEV_MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
    devClient = new MongoClient(DEV_MONGO_URI);
    await devClient.connect();
    devDb = devClient.db(DEV_DB_NAME);
    console.log('✅ Connected to DEVELOPMENT database\n');
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    throw error;
  }
}

async function getCollections(db) {
  try {
    const collections = await db.listCollections().toArray();
    return collections.map(c => c.name);
  } catch (error) {
    console.error('❌ Error listing collections:', error);
    throw error;
  }
}

async function getCollectionCount(db, collectionName) {
  try {
    return await db.collection(collectionName).countDocuments();
  } catch (error) {
    console.error(`❌ Error counting documents in ${collectionName}:`, error);
    return 0;
  }
}

async function copyCollection(prodCollection, devCollection, collectionName) {
  try {
    console.log(`\n📋 Copying collection: ${collectionName}`);
    
    // Get document count
    const prodCount = await prodCollection.countDocuments();
    console.log(`   Production documents: ${prodCount.toLocaleString()}`);
    
    if (prodCount === 0) {
      console.log(`   ⚠️  Collection is empty, skipping...`);
      return { success: true, count: 0 };
    }

    // Get all documents from production
    console.log(`   Fetching documents from production...`);
    const documents = await prodCollection.find({}).toArray();
    console.log(`   ✅ Fetched ${documents.length.toLocaleString()} documents`);

    // Drop existing collection in development
    console.log(`   Dropping existing collection in development...`);
    try {
      await devCollection.drop();
      console.log(`   ✅ Dropped existing collection`);
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ℹ️  Collection doesn't exist, creating new one`);
      } else {
        throw error;
      }
    }

    // Insert documents into development
    if (documents.length > 0) {
      console.log(`   Inserting ${documents.length.toLocaleString()} documents into development...`);
      
      // Insert in batches to avoid memory issues
      const batchSize = 1000;
      let inserted = 0;
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await devCollection.insertMany(batch, { ordered: false });
        inserted += batch.length;
        process.stdout.write(`\r   Progress: ${inserted.toLocaleString()}/${documents.length.toLocaleString()} (${Math.round(inserted/documents.length*100)}%)`);
      }
      console.log(`\n   ✅ Inserted ${inserted.toLocaleString()} documents`);
    }

    // Verify count
    const devCount = await devCollection.countDocuments();
    if (devCount === prodCount) {
      console.log(`   ✅ Verification passed: ${devCount.toLocaleString()} documents`);
      return { success: true, count: devCount };
    } else {
      console.log(`   ⚠️  Count mismatch: Production=${prodCount.toLocaleString()}, Development=${devCount.toLocaleString()}`);
      return { success: false, count: devCount, expected: prodCount };
    }
  } catch (error) {
    console.error(`   ❌ Error copying collection ${collectionName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function syncDatabase() {
  try {
    console.log('='.repeat(60));
    console.log('🔄 SYNCING PRODUCTION DATABASE TO DEVELOPMENT');
    console.log('='.repeat(60));
    console.log('\n⚠️  WARNING: This will DELETE all data in development and replace it with production data!\n');

    // Connect to databases
    await connectDatabases();

    // Get all collections from production
    console.log('📊 Getting collections from PRODUCTION...');
    const prodCollections = await getCollections(prodDb);
    console.log(`✅ Found ${prodCollections.length} collections in production:`);
    prodCollections.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });
    console.log('');

    // Get current collections in development (for info)
    console.log('📊 Getting collections from DEVELOPMENT (before sync)...');
    const devCollectionsBefore = await getCollections(devDb);
    console.log(`ℹ️  Found ${devCollectionsBefore.length} collections in development (will be replaced)\n`);

    // Sync each collection
    const results = [];
    let totalDocuments = 0;
    let successCount = 0;
    let failCount = 0;

    for (const collectionName of prodCollections) {
      const prodCollection = prodDb.collection(collectionName);
      const devCollection = devDb.collection(collectionName);

      const result = await copyCollection(prodCollection, devCollection, collectionName);
      results.push({ collection: collectionName, ...result });
      
      if (result.success) {
        successCount++;
        totalDocuments += result.count || 0;
      } else {
        failCount++;
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal Collections: ${prodCollections.length}`);
    console.log(`✅ Successfully synced: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📄 Total Documents Copied: ${totalDocuments.toLocaleString()}\n`);

    // Show failed collections
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('❌ Failed Collections:');
      failed.forEach(r => {
        console.log(`   - ${r.collection}: ${r.error || 'Count mismatch'}`);
      });
      console.log('');
    }

    // Verify final state
    console.log('🔍 Verifying final state...');
    const devCollectionsAfter = await getCollections(devDb);
    console.log(`✅ Development now has ${devCollectionsAfter.length} collections\n`);

    // Compare collection counts
    console.log('📊 Collection Count Comparison:');
    console.log('-'.repeat(60));
    for (const collectionName of prodCollections) {
      const prodCount = await getCollectionCount(prodDb, collectionName);
      const devCount = await getCollectionCount(devDb, collectionName);
      const match = prodCount === devCount ? '✅' : '❌';
      console.log(`${match} ${collectionName.padEnd(40)} Prod: ${prodCount.toString().padStart(10)} Dev: ${devCount.toString().padStart(10)}`);
    }

    console.log('\n' + '='.repeat(60));
    if (failCount === 0) {
      console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
    } else {
      console.log('⚠️  SYNC COMPLETED WITH WARNINGS');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    console.error(error.stack);
    throw error;
  } finally {
    // Close connections
    if (prodClient) {
      await prodClient.close();
      console.log('🔌 Closed PRODUCTION connection');
    }
    if (devClient) {
      await devClient.close();
      console.log('🔌 Closed DEVELOPMENT connection');
    }
  }
}

// Main execution
if (require.main === module) {
  syncDatabase()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { syncDatabase };



