/**
 * Script to update phone numbers and reset passwords for specific CAPI users
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const usersToUpdate = [
  {
    memberId: 'CAPI583',
    name: 'Sonali Debnath',
    phone: '9876543210', // Placeholder number
    note: 'Placeholder phone assigned'
  },
  {
    memberId: 'CAPI416',
    name: 'Jadunath Modak',
    phone: '9134452477',
    note: 'Replaced placeholder phone'
  },
  {
    memberId: 'CAPI439',
    name: 'RANJANA DAS',
    phone: '6296256693',
    note: 'Replaced existing phone'
  },
  {
    memberId: 'CAPI475',
    name: 'Biswajit Dolui',
    phone: '983293142',
    note: 'Replaced placeholder phone'
  }
];

const normalizePhone = (phone) => {
  if (!phone) return null;
  let phoneStr = String(phone).replace(/\s+/g, '');
  // Only remove country code if number is longer than 10 digits
  if (phoneStr.length > 10) {
    phoneStr = phoneStr.replace(/^\+91/, '').replace(/^91/, '');
  }
  // Take last 10 digits
  return phoneStr.slice(-10);
};

const resetPassword = async (user, phone) => {
  const password = normalizePhone(phone);
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword } }
  );
  
  // Verify password
  const updatedUser = await User.findById(user._id).select('+password');
  const passwordValid = await updatedUser.comparePassword(password);
  
  if (!passwordValid) {
    // Retry with new salt
    const retrySalt = await bcrypt.genSalt(12);
    const retryHashedPassword = await bcrypt.hash(password, retrySalt);
    await User.updateOne(
      { _id: user._id },
      { $set: { password: retryHashedPassword } }
    );
  }
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not set');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🚀 Updating CAPI Users Phone Numbers and Passwords...\n');
    console.log('='.repeat(80));
    
    const results = [];
    
    for (const userData of usersToUpdate) {
      try {
        const user = await User.findOne({ memberId: userData.memberId });
        
        if (!user) {
          console.log(`❌ User ${userData.memberId} (${userData.name}) - NOT FOUND`);
          results.push({
            memberId: userData.memberId,
            status: 'NOT_FOUND',
            error: 'User not found in database'
          });
          continue;
        }
        
        const oldPhone = user.phone || 'NO PHONE';
        const newPhone = normalizePhone(userData.phone);
        const oldName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Update phone number
        user.phone = newPhone;
        await user.save({ runValidators: false });
        
        // Reset password to new phone number
        await resetPassword(user, newPhone);
        
        // Update name if provided and different
        const nameParts = userData.name.split(/\s+/).filter(p => p.trim());
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
        
        if (normalizeName(oldName) !== normalizeName(userData.name)) {
          user.firstName = firstName;
          user.lastName = lastName;
          await user.save({ runValidators: false });
        }
        
        // Verify password works
        const verifyUser = await User.findById(user._id).select('+password');
        const passwordValid = await verifyUser.comparePassword(newPhone);
        
        results.push({
          memberId: userData.memberId,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          oldPhone: oldPhone,
          newPhone: newPhone,
          password: newPhone,
          passwordVerified: passwordValid,
          status: 'UPDATED',
          note: userData.note
        });
        
        console.log(`✅ Updated: ${userData.memberId} - ${userData.name}`);
        console.log(`   Old Phone: ${oldPhone}`);
        console.log(`   New Phone: ${newPhone}`);
        console.log(`   Password: ${newPhone} (verified: ${passwordValid ? 'YES' : 'NO'})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Note: ${userData.note}\n`);
        
      } catch (error) {
        console.error(`❌ Error updating ${userData.memberId}:`, error.message);
        results.push({
          memberId: userData.memberId,
          status: 'ERROR',
          error: error.message
        });
      }
    }
    
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Updated: ${results.filter(r => r.status === 'UPDATED').length}`);
    console.log(`❌ Errors: ${results.filter(r => r.status === 'ERROR' || r.status === 'NOT_FOUND').length}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 USER DETAILS FOR TESTING');
    console.log('='.repeat(80));
    console.log('\n| Member ID | Name | Email | Password (Phone) | Status |');
    console.log('|-----------|------|-------|------------------|--------|');
    
    results.forEach(r => {
      if (r.status === 'UPDATED') {
        console.log(`| ${r.memberId} | ${r.name} | ${r.email} | ${r.password} | ✅ Updated |`);
      } else {
        console.log(`| ${r.memberId} | - | - | - | ❌ ${r.status} |`);
      }
    });
    
    console.log('\n✅ All updates completed!\n');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

const normalizeName = (name) => {
  return name.trim().toUpperCase();
};

main();



