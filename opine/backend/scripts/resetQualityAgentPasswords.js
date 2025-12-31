const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

// Production quality agent memberIds (the correct ones)
const productionMemberIds = [
  '1001', '1006', '1007', '1008', '1009', '1010', '1011', '1012', '1013', '1014',
  '1015', '1016', '1017', '1018', '1019', '1020', '1021', '1022', '1023'
];

// Function to generate password from name (same as before)
function generatePassword(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Password123';
  const firstName = parts[0].toLowerCase();
  const restOfName = parts.slice(1).join('').toLowerCase();
  return firstName.charAt(0).toUpperCase() + firstName.slice(1) + restOfName;
}

async function resetQualityAgentPasswords() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all quality agents
    const qualityAgents = await User.find({
      userType: 'quality_agent',
      companyCode: 'TEST001',
      memberId: { $in: productionMemberIds }
    }).select('+password').lean();

    console.log(`📊 Found ${qualityAgents.length} quality agents to reset passwords\n`);

    const results = [];
    const credentials = [];

    for (const agent of qualityAgents) {
      try {
        const fullName = `${agent.firstName} ${agent.lastName}`;
        const plainPassword = generatePassword(fullName);
        
        // Use the same hashing method as the reference script
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);
        
        // Update password
        await User.updateOne(
          { _id: agent._id },
          { $set: { password: hashedPassword } }
        );
        
        // Verify password works
        const updatedUser = await User.findById(agent._id).select('+password');
        if (updatedUser && updatedUser.comparePassword) {
          const passwordValid = await updatedUser.comparePassword(plainPassword);
          
          if (!passwordValid) {
            // Retry with new salt if verification fails
            console.log(`⚠️  Password verification failed for ${fullName}, retrying...`);
            const retrySalt = await bcrypt.genSalt(12);
            const retryHashedPassword = await bcrypt.hash(plainPassword, retrySalt);
            await User.updateOne(
              { _id: agent._id },
              { $set: { password: retryHashedPassword } }
            );
            
            // Verify again
            const retryUser = await User.findById(agent._id).select('+password');
            const retryValid = await retryUser.comparePassword(plainPassword);
            if (!retryValid) {
              console.log(`❌ Password reset failed for ${fullName} after retry`);
              results.push({ success: false, agent: fullName, email: agent.email });
              continue;
            }
          }
        }
        
        console.log(`✅ Reset password for: ${fullName} (${agent.email})`);
        results.push({ success: true, agent: fullName, email: agent.email, password: plainPassword });
        credentials.push({
          name: fullName,
          email: agent.email,
          password: plainPassword,
          memberId: agent.memberId
        });
        
      } catch (error) {
        console.error(`❌ Error resetting password for ${agent.firstName} ${agent.lastName}:`, error.message);
        results.push({ success: false, agent: `${agent.firstName} ${agent.lastName}`, email: agent.email, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 Summary:');
    console.log('='.repeat(100));
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successfully reset: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}\n`);

    if (failed.length > 0) {
      console.log('❌ Failed accounts:');
      failed.forEach(f => {
        console.log(`   - ${f.agent} (${f.email}): ${f.error || 'Unknown error'}`);
      });
      console.log('');
    }

    console.log('\n📋 Quality Agent Credentials:');
    console.log('='.repeat(100));
    credentials.forEach((cred, index) => {
      console.log(`\n${index + 1}. ${cred.name}`);
      console.log(`   Email: ${cred.email}`);
      console.log(`   Password: ${cred.password}`);
      console.log(`   Member ID: ${cred.memberId}`);
      console.log('-'.repeat(100));
    });

    console.log('\n✅ Password reset completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

resetQualityAgentPasswords();



