#!/usr/bin/env node

/**
 * Script to test the aggregation pipeline demographic extraction
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

async function testAggregation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB\n');

    const surveyId = '68fd1915d41841da463f0d46';
    
    // Test a small aggregation to see if demographics are being calculated
    const testPipeline = [
      {
        $match: {
          survey: new mongoose.Types.ObjectId(surveyId),
          status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
        }
      },
      {
        $limit: 100 // Test with 100 responses first
      },
      {
        $addFields: {
          // Extract gender
          genderResponse: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: {
                      $or: [
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'gender' } },
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionId', ''] } }, regex: 'gender' } }
                      ]
                    }
                  }
                }
              },
              in: {
                $cond: {
                  if: { $and: [{ $isArray: '$$filtered' }, { $gt: [{ $size: '$$filtered' }, 0] }] },
                  then: { $arrayElemAt: ['$$filtered', 0] },
                  else: null
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          genderValue: {
            $cond: {
              if: { $ne: ['$genderResponse', null] },
              then: {
                $cond: {
                  if: { $or: [{ $isArray: '$genderResponse.response' }, { $eq: [{ $type: '$genderResponse.response' }, 'array'] }] },
                  then: {
                    $cond: {
                      if: { $gt: [{ $size: { $ifNull: ['$genderResponse.response', []] } }, 0] },
                      then: {
                        $let: {
                          vars: { first: { $arrayElemAt: [{ $ifNull: ['$genderResponse.response', []] }, 0] } },
                          in: {
                            $cond: {
                              if: { $or: [{ $isArray: '$$first' }, { $eq: [{ $type: '$$first' }, 'array'] }] },
                              then: { $cond: { if: { $gt: [{ $size: '$$first' }, 0] }, then: { $arrayElemAt: ['$$first', 0] }, else: '' } },
                              else: { $ifNull: ['$$first', ''] }
                            }
                          }
                        }
                      },
                      else: ''
                    }
                  },
                  else: { $ifNull: ['$genderResponse.response', ''] }
                }
              },
              else: ''
            }
          }
        }
      },
      {
        $addFields: {
          genderValue: {
            $cond: {
              if: { $or: [{ $isArray: '$genderValue' }, { $eq: [{ $type: '$genderValue' }, 'array'] }] },
              then: '',
              else: {
                $toLower: {
                  $arrayElemAt: [
                    { $split: [{ $toString: { $ifNull: ['$genderValue', ''] } }, '_'] },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          femaleCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$genderResponse', null] },
                    {
                      $or: [
                        { $regexMatch: { input: { $ifNull: ['$genderValue', ''] }, regex: 'female' } },
                        { $eq: ['$genderValue', 'f'] },
                        { $eq: ['$genderValue', '2'] }
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    console.log('🧪 Testing aggregation pipeline with 100 responses...\n');
    const result = await SurveyResponse.aggregate(testPipeline, {
      allowDiskUse: true,
      maxTimeMS: 30000
    });

    if (result && result.length > 0) {
      const stats = result[0];
      console.log('📊 Aggregation Results:');
      console.log(`   Total Responses: ${stats.total}`);
      console.log(`   Female Count: ${stats.femaleCount}`);
      console.log(`   Female Percentage: ${stats.total > 0 ? ((stats.femaleCount / stats.total) * 100).toFixed(2) : 0}%`);
    } else {
      console.log('❌ No results from aggregation');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAggregation();

