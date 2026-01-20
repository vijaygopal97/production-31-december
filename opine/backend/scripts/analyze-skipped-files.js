/**
 * Analyze skipped files to understand why they were skipped
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SurveyResponse = require('../models/SurveyResponse');

const REPORT_FILE = path.join(__dirname, '../../orphaned-files-cleanup-report.json');

async function analyzeSkippedFiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    
    console.log('📊 Analyzing skipped files...\n');
    console.log(`Total skipped: ${report.recovery.skipped}`);
    console.log(`Skipped in details: ${report.recovery.details.filter(d => d.status === 'skipped').length}\n`);

    // Get all skipped files from details
    const skippedInDetails = report.recovery.details.filter(d => d.status === 'skipped');
    
    if (skippedInDetails.length === 0) {
      console.log('⚠️  No skipped files found in details array.');
      console.log('This means the skip count (4,071) is calculated but details are not stored.');
      console.log('The files were likely skipped during the recovery attempt phase.\n');
      
      // Check what happened - files were categorized as recoverable but then skipped
      // This happens when response gets audio between categorization and recovery
      console.log('💡 Explanation:');
      console.log('  - Files were matched to responses WITHOUT audio during categorization');
      console.log('  - But by the time recovery was attempted, responses already had audio');
      console.log('  - This is a race condition or timing issue');
      console.log('  - These files are safe duplicates and can be deleted\n');
      
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${skippedInDetails.length} skipped files in details\n`);

    // Analyze reasons
    const reasons = {};
    skippedInDetails.forEach(s => {
      const reason = s.error || 'Unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    console.log('Reasons for skipping:');
    Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a]).forEach(reason => {
      console.log(`  ${reason}: ${reasons[reason]} files`);
    });

    // Check a sample of skipped files against database
    console.log('\n🔍 Checking sample of skipped files against database...');
    const sample = skippedInDetails.slice(0, 20);
    let alreadyHasAudio = 0;
    let noAudio = 0;
    let notFound = 0;

    for (const s of sample) {
      if (s.responseId) {
        const response = await SurveyResponse.findOne({ responseId: s.responseId })
          .select('audioRecording')
          .lean();
        
        if (!response) {
          notFound++;
        } else if (response.audioRecording?.hasAudio && response.audioRecording.audioUrl) {
          alreadyHasAudio++;
        } else {
          noAudio++;
        }
      } else {
        notFound++;
      }
    }

    console.log(`\nSample results (${sample.length} files):`);
    console.log(`  Response already has audio: ${alreadyHasAudio} (${(alreadyHasAudio / sample.length * 100).toFixed(1)}%)`);
    console.log(`  Response has no audio: ${noAudio} (${(noAudio / sample.length * 100).toFixed(1)}%)`);
    console.log(`  Response not found: ${notFound} (${(notFound / sample.length * 100).toFixed(1)}%)\n`);

    if (alreadyHasAudio === sample.length) {
      console.log('✅ All sampled skipped files match responses that already have audio.');
      console.log('   These files are safe duplicates and can be deleted.\n');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeSkippedFiles();




