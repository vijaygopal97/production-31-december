const mongoose = require('mongoose');

// Main connection (for writes) - connects to Primary
let mainConnection = null;

// Read connection (for reads) - connects to Secondaries
let readConnection = null;

/**
 * Initialize database connections
 * @param {string} mongoUri - MongoDB connection string
 */
async function initializeConnections(mongoUri) {
  try {
    // Main connection - for writes (goes to Primary)
    const writeUri = mongoUri.replace(/readPreference=[^&]*&?/g, '').replace(/&$/, '');
    mainConnection = await mongoose.connect(writeUri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      readPreference: 'primary', // Explicitly use primary for writes
      directConnection: false
    });
    
    console.log('✅ Main connection (writes) established');
    
    // Read connection - for reads (goes to Secondaries)
    // Reorder connection string to list secondaries FIRST (helps driver discover them)
    const uriParts = mongoUri.match(/mongodb:\/\/([^@]+)@([^\/]+)\/([^?]+)(\?.*)?/);
    if (uriParts) {
      const [, auth, hosts, db, query] = uriParts;
      const hostList = hosts.split(',');
      // Reorder: secondaries first, primary last
      const secondaries = hostList.filter(h => !h.includes('13.202.181.167'));
      const primary = hostList.filter(h => h.includes('13.202.181.167'));
      const reorderedHosts = [...secondaries, ...primary].join(',');
      
      const readUri = `mongodb://${auth}@${reorderedHosts}/${db}${query || '?'}readPreference=secondaryPreferred&maxStalenessSeconds=90`;
      
      readConnection = mongoose.createConnection(readUri, {
        maxPoolSize: 100, // More connections for reads
        minPoolSize: 10,
        serverSelectionTimeoutMS: 15000, // Increased for better secondary discovery
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000, // Increased
        readPreference: 'secondaryPreferred', // Prefer secondaries, fallback to primary if needed
        maxStalenessSeconds: 90, // Minimum required by MongoDB
        readPreferenceTags: [],
        directConnection: false,
        retryWrites: false, // Reads don't need retry writes
        retryReads: true // Enable retry reads for better reliability
      });
      
      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        readConnection.once('connected', resolve);
        readConnection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 15000);
      });
    } else {
      // Fallback to original URI if parsing fails
      const readUri = mongoUri.includes('readPreference') 
        ? mongoUri 
        : mongoUri + (mongoUri.includes('?') ? '&' : '?') + 'readPreference=secondaryPreferred&maxStalenessSeconds=90';
      
      readConnection = mongoose.createConnection(readUri, {
        maxPoolSize: 100,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        readPreference: 'secondaryPreferred',
        maxStalenessSeconds: 30,
        directConnection: false,
        retryWrites: false,
        retryReads: true
      });
      
      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        readConnection.once('connected', resolve);
        readConnection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 15000);
      });
    }
    
    console.log('✅ Read connection (secondaries) established');
    
    // Test read connection
    try {
      const hello = await readConnection.db.admin().command({hello: 1});
      console.log(`📊 Read connection using: ${hello.me}`);
      console.log(`   Is Primary: ${hello.isWritablePrimary}`);
      if (hello.isWritablePrimary) {
        console.log('⚠️  WARNING: Read connection is using Primary!');
        console.log('   This means secondaries may not be accessible.');
      } else {
        console.log('✅ Read connection successfully using Secondary!');
      }
    } catch (err) {
      console.error('⚠️  Could not verify read connection:', err.message);
    }
    
    return { mainConnection, readConnection };
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

/**
 * Get the main connection (for writes)
 */
function getMainConnection() {
  return mainConnection || mongoose.connection;
}

/**
 * Get the read connection (for reads from secondaries)
 */
function getReadConnection() {
  return readConnection || mongoose.connection;
}

/**
 * Get a model for reads (uses read connection)
 */
function getReadModel(modelName, schema) {
  if (!readConnection) {
    console.warn('⚠️  Read connection not initialized, using main connection');
    return mongoose.model(modelName, schema);
  }
  
  // Check if model already exists on read connection
  if (readConnection.models[modelName]) {
    return readConnection.models[modelName];
  }
  
  return readConnection.model(modelName, schema);
}

/**
 * Get a model for writes (uses main connection)
 */
function getWriteModel(modelName, schema) {
  return mongoose.model(modelName, schema);
}

module.exports = {
  initializeConnections,
  getMainConnection,
  getReadConnection,
  getReadModel,
  getWriteModel
};

