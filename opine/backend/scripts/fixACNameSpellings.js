/**
 * Script to fix AC name spellings in database to match master data
 * Master data uses: "COOCHBEHAR DAKSHIN" and "COOCHBEHAR UTTAR (SC)"
 * Old spellings: "Cooch Behar Dakshin" and "Cooch Behar Uttar"
 */

const mongoose = require('mongoose');
const Survey = require('../models/Survey');

// AC name mapping: old spelling -> new spelling (from master data)
const AC_NAME_MAPPINGS = {
  'Cooch Behar Dakshin': 'COOCHBEHAR DAKSHIN',
  'Cooch Behar Uttar': 'COOCHBEHAR UTTAR (SC)',
  'cooch behar dakshin': 'COOCHBEHAR DAKSHIN',
  'cooch behar uttar': 'COOCHBEHAR UTTAR (SC)',
  'COOCH BEHAR DAKSHIN': 'COOCHBEHAR DAKSHIN',
  'COOCH BEHAR UTTAR': 'COOCHBEHAR UTTAR (SC)',
};

async function fixACNamesInArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(ac => {
    const normalized = AC_NAME_MAPPINGS[ac] || ac;
    return normalized;
  });
}

async function fixSurveyACNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine');
    console.log('Connected to MongoDB');

    const surveys = await Survey.find({});
    console.log(`Found ${surveys.length} surveys to check`);

    let updatedCount = 0;

    for (const survey of surveys) {
      let needsUpdate = false;

      // Fix assignedACs at root level
      if (survey.assignedACs && Array.isArray(survey.assignedACs)) {
        const originalACs = [...survey.assignedACs];
        survey.assignedACs = await fixACNamesInArray(survey.assignedACs);
        if (JSON.stringify(originalACs) !== JSON.stringify(survey.assignedACs)) {
          needsUpdate = true;
          console.log(`Survey ${survey._id}: Updated assignedACs`);
        }
      }

      // Fix assignedInterviewers
      if (survey.assignedInterviewers && Array.isArray(survey.assignedInterviewers)) {
        for (const interviewer of survey.assignedInterviewers) {
          if (interviewer.assignedACs && Array.isArray(interviewer.assignedACs)) {
            const originalACs = [...interviewer.assignedACs];
            interviewer.assignedACs = await fixACNamesInArray(interviewer.assignedACs);
            if (JSON.stringify(originalACs) !== JSON.stringify(interviewer.assignedACs)) {
              needsUpdate = true;
              console.log(`Survey ${survey._id}: Updated assignedInterviewers.assignedACs`);
            }
          }
        }
      }

      // Fix capiInterviewers
      if (survey.capiInterviewers && Array.isArray(survey.capiInterviewers)) {
        for (const interviewer of survey.capiInterviewers) {
          if (interviewer.assignedACs && Array.isArray(interviewer.assignedACs)) {
            const originalACs = [...interviewer.assignedACs];
            interviewer.assignedACs = await fixACNamesInArray(interviewer.assignedACs);
            if (JSON.stringify(originalACs) !== JSON.stringify(interviewer.assignedACs)) {
              needsUpdate = true;
              console.log(`Survey ${survey._id}: Updated capiInterviewers.assignedACs`);
            }
          }
        }
      }

      // Fix catiInterviewers
      if (survey.catiInterviewers && Array.isArray(survey.catiInterviewers)) {
        for (const interviewer of survey.catiInterviewers) {
          if (interviewer.assignedACs && Array.isArray(interviewer.assignedACs)) {
            const originalACs = [...interviewer.assignedACs];
            interviewer.assignedACs = await fixACNamesInArray(interviewer.assignedACs);
            if (JSON.stringify(originalACs) !== JSON.stringify(interviewer.assignedACs)) {
              needsUpdate = true;
              console.log(`Survey ${survey._id}: Updated catiInterviewers.assignedACs`);
            }
          }
        }
      }

      if (needsUpdate) {
        await survey.save();
        updatedCount++;
        console.log(`✅ Updated survey ${survey._id}`);
      }
    }

    console.log(`\n✅ Fixed AC names in ${updatedCount} surveys`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error fixing AC names:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixSurveyACNames();
}

module.exports = { fixSurveyACNames, AC_NAME_MAPPINGS };










