const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

// Production quality agent memberIds (the correct ones)
const productionMemberIds = [
  '1001', '1006', '1007', '1008', '1009', '1010', '1011', '1012', '1013', '1014',
  '1015', '1016', '1017', '1018', '1019', '1020', '1021', '1022', '1023'
];

const COMPANY_ID = '68d33a0cd5e4634e58c4e678';
const COMPANY_CODE = 'TEST001';

async function addCompanyToQualityAgents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all quality agents
    const qualityAgents = await User.find({
      userType: 'quality_agent',
      companyCode: COMPANY_CODE,
      memberId: { $in: productionMemberIds }
    }).lean();

    console.log(`📊 Found ${qualityAgents.length} quality agents to update\n`);

    const results = [];

    for (const agent of qualityAgents) {
      try {
        const fullName = `${agent.firstName} ${agent.lastName}`;
        
        // Update company field
        await User.updateOne(
          { _id: agent._id },
          { 
            $set: { 
              company: new mongoose.Types.ObjectId(COMPANY_ID),
              companyCode: COMPANY_CODE,
              status: 'active',
              isActive: true
            } 
          }
        );
        
        console.log(`✅ Updated company for: ${fullName} (${agent.email})`);
        results.push({ success: true, agent: fullName, email: agent.email });
        
      } catch (error) {
        console.error(`❌ Error updating ${agent.firstName} ${agent.lastName}:`, error.message);
        results.push({ success: false, agent: `${agent.firstName} ${agent.lastName}`, email: agent.email, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 Summary:');
    console.log('='.repeat(100));
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successfully updated: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}\n`);

    if (failed.length > 0) {
      console.log('❌ Failed accounts:');
      failed.forEach(f => {
        console.log(`   - ${f.agent} (${f.email}): ${f.error || 'Unknown error'}`);
      });
      console.log('');
    }

    // Verify updates
    const updatedAgents = await User.find({
      userType: 'quality_agent',
      companyCode: COMPANY_CODE,
      memberId: { $in: productionMemberIds }
    }).select('firstName lastName email company companyCode status isActive').lean();

    console.log('\n📋 Verification - Sample Quality Agents:');
    console.log('='.repeat(100));
    updatedAgents.slice(0, 3).forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.firstName} ${agent.lastName}`);
      console.log(`   Email: ${agent.email}`);
      console.log(`   Company: ${agent.company}`);
      console.log(`   Company Code: ${agent.companyCode}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Is Active: ${agent.isActive}`);
      console.log('-'.repeat(100));
    });

    console.log('\n✅ Company assignment completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

addCompanyToQualityAgents();



