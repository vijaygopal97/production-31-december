/**
 * Import Project Manager Users from Production to Development Database
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PRODUCTION_MONGO_URI = process.env.PRODUCTION_MONGO_URI || 'mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin';
const DEV_MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://opine_user:OpineApp2024Secure@localhost:27017/Opine?authSource=Opine';

const PROJECT_MANAGER_IDS = [
  '6942432cd66fc34ec0f70e84',
  '6942432ed66fc34ec0f7119b',
  '69424330d66fc34ec0f714b2',
  '69424332d66fc34ec0f717c9',
  '69424334d66fc34ec0f71ae0',
];

const testLogin = async (email, password, connection) => {
  try {
    const UserModel = connection.model('User', User.schema);
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return { success: false, error: 'User not found' };
    const isValid = await user.comparePassword(password);
    return { success: isValid, user: isValid ? { email: user.email, firstName: user.firstName, lastName: user.lastName, userType: user.userType } : null, error: isValid ? null : 'Invalid password' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const importProjectManagers = async () => {
  let prodConnection = null;
  let devConnection = null;
  try {
    console.log('🚀 Starting Project Manager import process...\n');
    console.log('📡 Connecting to PRODUCTION database (READ-ONLY)...');
    prodConnection = await mongoose.createConnection(PRODUCTION_MONGO_URI);
    const ProdUser = prodConnection.model('User', User.schema);
    console.log('✅ Connected to PRODUCTION database\n');
    console.log('📡 Connecting to DEVELOPMENT database...');
    devConnection = await mongoose.createConnection(DEV_MONGO_URI);
    const DevUser = devConnection.model('User', User.schema);
    console.log('✅ Connected to DEVELOPMENT database\n');
    console.log('📋 Fetching project managers from production...');
    const userIds = PROJECT_MANAGER_IDS.map(id => new mongoose.Types.ObjectId(id));
    const prodUsers = await ProdUser.find({ _id: { $in: userIds } }).select('+password').lean();
    console.log(`✅ Found ${prodUsers.length} project managers\n`);
    if (prodUsers.length === 0) {
      console.log('⚠️  No project managers found. Exiting.');
      return;
    }
    const results = [];
    const loginTests = [];
    for (const prodUser of prodUsers) {
      try {
        const email = prodUser.email.toLowerCase();
        console.log(`📝 Processing: ${prodUser.firstName} ${prodUser.lastName} (${email})`);
        const existingUser = await DevUser.findOne({ $or: [{ email: email }, { _id: prodUser._id }] }).select('+password');
        if (existingUser) {
          console.log(`⚠️  User exists. Updating...`);
          const password = prodUser.email.includes('testpm1') ? 'TestPM1@123' : prodUser.email.includes('testpm2') ? 'TestPM2@123' : prodUser.email.includes('testpm3') ? 'TestPM3@123' : prodUser.email.includes('testpm4') ? 'TestPM4@123' : prodUser.email.includes('testpm5') ? 'TestPM5@123' : null;
          const salt = await bcrypt.genSalt(12);
          const hashedPassword = password ? await bcrypt.hash(password, salt) : prodUser.password;
          const updateData = { ...prodUser, _id: existingUser._id, password: hashedPassword, email: email, updatedAt: new Date() };
          delete updateData.__v;
          await DevUser.updateOne({ _id: existingUser._id }, { $set: updateData });
          const updatedUser = await DevUser.findById(existingUser._id).select('+password');
          if (password) {
            console.log(`🔐 Testing login...`);
            const loginTest = await testLogin(email, password, devConnection);
            if (loginTest.success) console.log(`✅ Login PASSED`);
            else console.log(`❌ Login FAILED: ${loginTest.error}`);
            loginTests.push({ email, password, success: loginTest.success, error: loginTest.error });
          }
          console.log(`✅ User updated: ${updatedUser.firstName} ${updatedUser.lastName}\n`);
          results.push({ user: updatedUser, isNew: false, success: true });
        } else {
          const password = prodUser.email.includes('testpm1') ? 'TestPM1@123' : prodUser.email.includes('testpm2') ? 'TestPM2@123' : prodUser.email.includes('testpm3') ? 'TestPM3@123' : prodUser.email.includes('testpm4') ? 'TestPM4@123' : prodUser.email.includes('testpm5') ? 'TestPM5@123' : null;
          const salt = await bcrypt.genSalt(12);
          const hashedPassword = password ? await bcrypt.hash(password, salt) : prodUser.password;
          const newUserData = { ...prodUser, email: email, password: hashedPassword, createdAt: prodUser.createdAt || new Date(), updatedAt: new Date() };
          delete newUserData.__v;
          const newUser = new DevUser(newUserData);
          await newUser.save({ runValidators: false });
          const savedUser = await DevUser.findById(newUser._id).select('+password');
          if (password) {
            console.log(`🔐 Testing login...`);
            const loginTest = await testLogin(email, password, devConnection);
            if (loginTest.success) console.log(`✅ Login PASSED`);
            else console.log(`❌ Login FAILED: ${loginTest.error}`);
            loginTests.push({ email, password, success: loginTest.success, error: loginTest.error });
          }
          console.log(`✅ User created: ${savedUser.firstName} ${savedUser.lastName}\n`);
          results.push({ user: savedUser, isNew: true, success: true });
        }
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        results.push({ success: false, error: error.message, email: prodUser.email });
      }
    }
    console.log('='.repeat(80));
    console.log('\n✅ Import completed!\n');
    const successful = results.filter(r => r.success !== false && r.user);
    const failed = results.filter(r => r.success === false);
    const loginFailed = loginTests.filter(t => !t.success);
    console.log(`✅ Imported/Updated: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`🔐 Login tests passed: ${loginTests.length - loginFailed.length}/${loginTests.length}`);
    if (loginFailed.length > 0) {
      console.log(`\n⚠️  Login failures:`);
      loginFailed.forEach(test => console.log(`   - ${test.email}: ${test.error}`));
    }
    console.log('\n📋 Imported Project Managers:');
    successful.forEach((result, index) => {
      const { user } = result;
      const password = user.email.includes('testpm1') ? 'TestPM1@123' : user.email.includes('testpm2') ? 'TestPM2@123' : user.email.includes('testpm3') ? 'TestPM3@123' : user.email.includes('testpm4') ? 'TestPM4@123' : user.email.includes('testpm5') ? 'TestPM5@123' : 'N/A';
      console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${password}`);
      console.log(`   User Type: ${user.userType}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   User ID: ${user._id}`);
    });
    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    if (prodConnection) await prodConnection.close();
    if (devConnection) await devConnection.close();
  }
};

if (require.main === module) {
  importProjectManagers().then(() => { console.log('\n✅ Script completed'); process.exit(0); }).catch((error) => { console.error('\n❌ Script failed:', error); process.exit(1); });
}

module.exports = { importProjectManagers };
