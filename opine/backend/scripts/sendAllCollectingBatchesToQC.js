/**
 * One-time maintenance script to send ALL collecting QC batches to QC,
 * equivalent to pressing "Send to QC" for every batch in status "collecting".
 *
 * It:
 *   - Connects to MongoDB using MONGODB_URI
 *   - Finds all QCBatch documents with status 'collecting' and totalResponses > 0
 *   - For each batch:
 *       * Loads the active QCBatchConfig for that survey/company
 *       * Calls processBatch(batch, config) from qcBatchProcessor
 *
 * This uses the same core logic as:
 *   POST /api/qc-batches/:batchId/send-to-qc
 * but operates over all collecting batches.
 *
 * Usage (from /var/www/opine/backend):
 *   node scripts/sendAllCollectingBatchesToQC.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QCBatch = require('../models/QCBatch');
const Survey = require('../models/Survey');
const Company = require('../models/Company');
const QCBatchConfig = require('../models/QCBatchConfig');
const { processBatch } = require('../jobs/qcBatchProcessor');

async function main() {
  const startTime = Date.now();
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set. Please configure it in .env');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 5
    });

    console.log('🔍 Finding all QC batches in status \"collecting\" with responses...');
    const batches = await QCBatch.find({
      status: 'collecting',
      totalResponses: { $gt: 0 }
    })
      .populate('survey')
      .sort({ batchDate: 1 })
      .lean(false); // keep as Mongoose docs so processBatch can mutate/save

    console.log(`📦 Found ${batches.length} collecting batches to process`);

    let processedCount = 0;
    let skippedNoConfig = 0;
    let skippedNoSurvey = 0;

    for (const batch of batches) {
      try {
        const surveyId = batch.survey?._id || batch.survey;
        if (!surveyId) {
          console.warn(`⚠️  Skipping batch ${batch._id} - missing survey reference`);
          skippedNoSurvey += 1;
          continue;
        }

        const survey = await Survey.findById(surveyId).lean();
        if (!survey) {
          console.warn(`⚠️  Skipping batch ${batch._id} - survey ${surveyId} not found`);
          skippedNoSurvey += 1;
          continue;
        }

        const companyId = survey.company;
        if (!companyId) {
          console.warn(`⚠️  Skipping batch ${batch._id} - survey ${surveyId} has no company`);
          skippedNoSurvey += 1;
          continue;
        }

        // Ensure Company model is registered and the company exists
        const company = await Company.findById(companyId).select('_id').lean();
        if (!company) {
          console.warn(`⚠️  Skipping batch ${batch._id} - company ${companyId} not found`);
          skippedNoSurvey += 1;
          continue;
        }

        const config = await QCBatchConfig.getActiveConfig(surveyId, company._id);

        if (!config) {
          console.warn(
            `⚠️  Skipping batch ${batch._id} - no active QC batch config for survey ${surveyId}`
          );
          skippedNoConfig += 1;
          continue;
        }

        console.log(
          `\n📋 Processing collecting batch ${batch._id} for survey ${String(
            surveyId
          )} with sample ${config.samplePercentage}%`
        );
        await processBatch(batch, config);
        processedCount += 1;
      } catch (err) {
        console.error(`❌ Error processing collecting batch ${batch._id}:`, err.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ sendAllCollectingBatchesToQC completed in ${duration}ms`);
    console.log(`   - Batches processed: ${processedCount}`);
    console.log(`   - Batches skipped (no survey): ${skippedNoSurvey}`);
    console.log(`   - Batches skipped (no active config): ${skippedNoConfig}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error in sendAllCollectingBatchesToQC (${duration}ms):`, err.message);
    console.error(err.stack);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


