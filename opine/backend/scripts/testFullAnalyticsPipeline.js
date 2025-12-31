const mongoose = require('mongoose');
require('dotenv').config();

const SurveyResponse = require('../models/SurveyResponse');

async function testFullPipeline() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opine');
    console.log('✅ Connected to MongoDB');

    const surveyId = '68fd1915d41841da463f0d46';
    const matchStage = {
      survey: new mongoose.Types.ObjectId(surveyId),
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
    };

    // Test the full addFieldsStage with AC extraction
    const addFieldsStage = {
      $addFields: {
        acValueFromResponse: {
          $let: {
            vars: {
              acResponse: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ['$responses', []] },
                      as: 'resp',
                      cond: { $eq: ['$$resp.questionId', 'ac-selection'] }
                    }
                  },
                  0
                ]
              }
            },
            in: {
              $cond: {
                if: { $ne: ['$$acResponse', null] },
                then: {
                  $let: {
                    vars: {
                      rawResponse: {
                        $cond: {
                          if: { $isArray: '$$acResponse.response' },
                          then: { $arrayElemAt: ['$$acResponse.response', 0] },
                          else: { $ifNull: ['$$acResponse.response', ''] }
                        }
                      },
                      responseStr: {
                        $toString: {
                          $cond: {
                            if: { $isArray: '$$acResponse.response' },
                            then: { $arrayElemAt: ['$$acResponse.response', 0] },
                            else: { $ifNull: ['$$acResponse.response', ''] }
                          }
                        }
                      },
                      openBraceIndex: {
                        $indexOfBytes: [
                          {
                            $toString: {
                              $cond: {
                                if: { $isArray: '$$acResponse.response' },
                                then: { $arrayElemAt: ['$$acResponse.response', 0] },
                                else: { $ifNull: ['$$acResponse.response', ''] }
                              }
                            }
                          },
                          '{'
                        ]
                      }
                    },
                    in: {
                      $cond: {
                        if: { $eq: ['$$openBraceIndex', -1] },
                        then: { $trim: { input: '$$responseStr' } },
                        else: {
                          $trim: {
                            input: { $substr: ['$$responseStr', 0, '$$openBraceIndex'] }
                          }
                        }
                      }
                    }
                  }
                },
                else: null
              }
            }
          }
        },
        extractedAC: {
          $cond: {
            if: { $and: [{ $ne: ['$selectedAC', null] }, { $ne: ['$selectedAC', ''] }, { $ne: ['$selectedAC', 'N/A'] }] },
            then: '$selectedAC',
            else: {
              $cond: {
                if: { $and: [{ $ne: ['$selectedPollingStation.acName', null] }, { $ne: ['$selectedPollingStation.acName', ''] }, { $ne: ['$selectedPollingStation.acName', 'N/A'] }] },
                then: '$selectedPollingStation.acName',
                else: {
                  $ifNull: ['$acValueFromResponse', null]
                }
              }
            }
          }
        }
      }
    };

    // Test pipeline with addFieldsStage
    const testPipeline = [
      { $match: matchStage },
      addFieldsStage,
      {
        $group: {
          _id: { $ifNull: ['$extractedAC', 'N/A'] },
          total: { $sum: 1 }
        }
      },
      { $limit: 5 } // Just get first 5 to test
    ];

    console.log('🚀 Testing full pipeline with AC extraction...');
    const result = await SurveyResponse.aggregate(testPipeline, {
      allowDiskUse: true,
      maxTimeMS: 300000
    });

    console.log('✅ Pipeline executed successfully!');
    console.log('Sample results:', JSON.stringify(result, null, 2));

    // Now test the basicStatsPipeline
    const basicStatsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 }
        }
      }
    ];

    console.log('\n🚀 Testing basic stats pipeline...');
    const basicStats = await SurveyResponse.aggregate(basicStatsPipeline, {
      allowDiskUse: true,
      maxTimeMS: 300000
    });

    console.log('✅ Basic stats:', JSON.stringify(basicStats, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testFullPipeline();

