const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DEV_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';
const PROD_MONGO_URI = 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const UserSchema = require('../models/User').schema;

async function unlockAccounts(UserModel, dbName) {
  const now = new Date();
  const result = await UserModel.updateMany(
    { lockUntil: { $exists: true, $gt: now } },
    { $unset: { lockUntil: 1, loginAttempts: 1 } }
  );
  console.log(`${dbName}: Unlocked ${result.modifiedCount} accounts`);
  return result.modifiedCount;
}

async function main() {
  try {
    console.log('🔓 Unlocking all locked accounts...\n');
    
    const devConn = await mongoose.createConnection(DEV_MONGO_URI);
    const DevUser = devConn.model('User', UserSchema);
    const devCount = await unlockAccounts(DevUser, 'DEVELOPMENT');
    
    const prodConn = await mongoose.createConnection(PROD_MONGO_URI);
    const ProdUser = prodConn.model('User', UserSchema);
    const prodCount = await unlockAccounts(ProdUser, 'PRODUCTION');
    
    console.log(`\n✅ Total unlocked: ${devCount + prodCount} accounts`);
    
    await devConn.close();
    await prodConn.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
