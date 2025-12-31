/**
 * Script to reverse CATI interviewer name changes
 * Restores original names that were incorrectly updated
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Original names that need to be restored
const originalNames = {
  '501': 'Tahira Khatun',
  '502': 'Smrity banerjee',
  '503': 'Sakiran Bibi',
  '504': 'Afrin',
  '505': 'Anneca',
  '506': 'Hakima',
  '507': 'Taimur',
  '508': 'Alisha khatoon'
};

const reverseNames = async (serverName, mongoUri) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 ${serverName} Server - Reversing Name Changes`);
  console.log('='.repeat(80));
  
  try {
    console.log(`🔌 Connecting to MongoDB...`);
    console.log(`   URI: ${mongoUri ? mongoUri.replace(/\/\/.*@/, '//***@') : 'Not set'}`);
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to ${serverName} MongoDB\n`);
    
    const restored = [];
    const notFound = [];
    
    for (const [memberId, originalName] of Object.entries(originalNames)) {
      const user = await User.findOne({ memberId: memberId });
      
      if (!user) {
        notFound.push({ memberId, originalName });
        console.log(`⚠️  Member ID ${memberId} (${originalName}) - NOT FOUND`);
        continue;
      }
      
      const nameParts = originalName.split(/\s+/).filter(p => p.trim());
      const originalFirstName = nameParts[0] || '';
      const originalLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : originalFirstName;
      const originalFullName = nameParts.length > 1 ? `${originalFirstName} ${nameParts.slice(1).join(' ')}` : originalFirstName;
      
      // Restore the original name
      user.firstName = originalFirstName;
      user.lastName = originalLastName;
      await user.save({ runValidators: false });
      
      restored.push({
        memberId,
        restoredName: originalFullName,
        email: user.email
      });
      
      console.log(`✅ Restored Member ID ${memberId}:`);
      console.log(`   Restored to: ${originalFullName}`);
      console.log(`   Email: ${user.email}\n`);
    }
    
    await mongoose.disconnect();
    
    return { restored, notFound };
    
  } catch (error) {
    console.error(`❌ Error on ${serverName}:`, error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

const main = async () => {
  console.log('🚀 Starting CATI Name Reversal Process\n');
  console.log('='.repeat(80));
  
  // Development server
  const devUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!devUri) {
    console.error('❌ MONGO_URI or MONGODB_URI not set in environment variables');
    process.exit(1);
  }
  const devResults = await reverseNames('Development', devUri);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n✅ DEVELOPMENT SERVER:');
  console.log(`   Names Restored: ${devResults.restored.length}`);
  console.log(`   Not Found: ${devResults.notFound.length}`);
  
  if (devResults.restored.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 RESTORED NAMES');
    console.log('='.repeat(80));
    
    console.log('\n🔧 DEVELOPMENT SERVER RESTORATIONS:');
    devResults.restored.forEach(item => {
      console.log(`   Member ID ${item.memberId}: Restored to "${item.restoredName}" (${item.email})`);
    });
  }
  
  console.log('\n⚠️  Production reversal will be run separately via SSH');
  console.log('   Run this script on production server to reverse production changes.\n');
  
  console.log('\n✅ Process completed!\n');
};

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



