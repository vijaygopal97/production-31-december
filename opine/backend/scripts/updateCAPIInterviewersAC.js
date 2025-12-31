/**
 * Script to update AC assignment for CAPI interviewers
 * Changes AC from "Barabani" to "Bandwan" for specific interviewers
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SURVEY_ID = '68fd1915d41841da463f0d46';
const OLD_AC = 'Barabani';
const NEW_AC = 'Bandwan';
const MEMBER_IDS = ['4007', '4008'];

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find the interviewers by member ID
    console.log(`📋 Finding interviewers with Member IDs: ${MEMBER_IDS.join(', ')}...`);
    const interviewers = await User.find({
      memberId: { $in: MEMBER_IDS },
      userType: 'interviewer'
    });
    
    if (interviewers.length === 0) {
      throw new Error('No interviewers found with the specified Member IDs');
    }
    
    console.log(`✅ Found ${interviewers.length} interviewer(s):`);
    interviewers.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName} (Member ID: ${user.memberId}, User ID: ${user._id})`);
    });
    console.log('');

    // Get the survey
    console.log(`📋 Fetching survey: ${SURVEY_ID}...`);
    const survey = await Survey.findById(SURVEY_ID);
    if (!survey) {
      throw new Error(`Survey ${SURVEY_ID} not found`);
    }
    console.log(`✅ Found survey: ${survey.surveyName || SURVEY_ID}\n`);

    if (!survey.capiInterviewers || survey.capiInterviewers.length === 0) {
      throw new Error('No CAPI interviewers assigned to this survey');
    }

    console.log('🔄 Updating AC assignments...');
    console.log('='.repeat(80));
    
    let updatedCount = 0;
    const interviewerIds = interviewers.map(u => u._id.toString());
    
    for (let i = 0; i < survey.capiInterviewers.length; i++) {
      const assignment = survey.capiInterviewers[i];
      const interviewerId = assignment.interviewer.toString();
      
      if (interviewerIds.includes(interviewerId)) {
        const interviewer = interviewers.find(u => u._id.toString() === interviewerId);
        const currentACs = assignment.assignedACs || [];
        
        console.log(`\n📝 Processing: ${interviewer.firstName} ${interviewer.lastName} (${interviewer.memberId})`);
        console.log(`   Current ACs: ${currentACs.join(', ') || 'None'}`);
        
        // Update the AC assignment
        if (currentACs.includes(OLD_AC)) {
          // Replace Barabani with Bandwan
          assignment.assignedACs = currentACs.map(ac => ac === OLD_AC ? NEW_AC : ac);
          // If Bandwan is not already in the list, add it
          if (!assignment.assignedACs.includes(NEW_AC)) {
            assignment.assignedACs.push(NEW_AC);
          }
          // Remove duplicates
          assignment.assignedACs = [...new Set(assignment.assignedACs)];
          updatedCount++;
          console.log(`   ✅ Updated ACs: ${assignment.assignedACs.join(', ')}`);
        } else if (currentACs.length === 0 || !currentACs.includes(NEW_AC)) {
          // If no ACs or Bandwan not present, set it
          assignment.assignedACs = [NEW_AC];
          updatedCount++;
          console.log(`   ✅ Set ACs: ${assignment.assignedACs.join(', ')}`);
        } else {
          console.log(`   ⚠️  AC already set to: ${currentACs.join(', ')}`);
        }
      }
    }

    if (updatedCount > 0) {
      await survey.save();
      console.log(`\n✅ Survey saved with ${updatedCount} updated assignment(s)\n`);
    } else {
      console.log(`\n⚠️  No assignments were updated\n`);
    }

    // Verify the changes
    console.log('📋 Verification - Current AC Assignments:');
    console.log('='.repeat(80));
    for (const assignment of survey.capiInterviewers) {
      const interviewerId = assignment.interviewer.toString();
      if (interviewerIds.includes(interviewerId)) {
        const interviewer = interviewers.find(u => u._id.toString() === interviewerId);
        console.log(`\n${interviewer.firstName} ${interviewer.lastName} (${interviewer.memberId}):`);
        console.log(`   Assigned ACs: ${(assignment.assignedACs || []).join(', ') || 'None'}`);
        console.log(`   State: ${assignment.selectedState || 'N/A'}`);
        console.log(`   Country: ${assignment.selectedCountry || 'N/A'}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Script completed!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
