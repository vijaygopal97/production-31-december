/**
 * One-time maintenance script to clean up stale AvailableAssignment entries.
 *
 * Stale = AvailableAssignment whose linked SurveyResponse is no longer in
 * status 'Pending_Approval'. This script:
 *   - Connects to MongoDB using MONGODB_URI
 *   - Finds such stale entries via an aggregation with $lookup
 *   - Deletes them in small batches to avoid memory / performance issues
 *
 * Usage (from /var/www/opine/backend):
 *   node scripts/cleanupStaleAvailableAssignments.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AvailableAssignment = require('../models/AvailableAssignment');

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

    console.log('🔍 Finding stale AvailableAssignment entries (non-Pending_Approval responses)...');

    // Use aggregation to avoid loading entire collections into memory
    const agg = AvailableAssignment.aggregate([
      {
        $lookup: {
          from: 'surveyresponses',
          localField: 'responseId',
          foreignField: '_id',
          as: 'resp'
        }
      },
      { $unwind: '$resp' },
      {
        $match: {
          'resp.status': { $ne: 'Pending_Approval' }
        }
      },
      {
        $project: {
          _id: 1
        }
      }
    ]);

    // Use aggregation cursor to avoid loading everything into memory
    const cursor = agg.cursor({ batchSize: 500 });

    const idsToDelete = [];
    let batchCount = 0;
    let totalDeleted = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      idsToDelete.push(doc._id);

      if (idsToDelete.length >= 500) {
        batchCount += 1;
        const res = await AvailableAssignment.deleteMany({ _id: { $in: idsToDelete } });
        totalDeleted += res.deletedCount || 0;
        console.log(`🧹 Deleted batch #${batchCount} - ${res.deletedCount || 0} stale entries`);
        idsToDelete.length = 0;
      }
    }

    if (idsToDelete.length > 0) {
      batchCount += 1;
      const res = await AvailableAssignment.deleteMany({ _id: { $in: idsToDelete } });
      totalDeleted += res.deletedCount || 0;
      console.log(`🧹 Deleted final batch #${batchCount} - ${res.deletedCount || 0} stale entries`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ cleanupStaleAvailableAssignments completed in ${duration}ms`);
    console.log(`   - Total stale entries deleted: ${totalDeleted}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error in cleanupStaleAvailableAssignments (${duration}ms):`, err.message);
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


