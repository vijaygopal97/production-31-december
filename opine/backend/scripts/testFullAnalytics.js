#!/usr/bin/env node

/**
 * Script to test the full analytics endpoint and check demographic stats
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

async function testFullAnalytics() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB\n');

    const surveyId = '68fd1915d41841da463f0d46';
    
    // Simulate the full pipeline (simplified version to test)
    const matchStage = {
      $match: {
        survey: new mongoose.Types.ObjectId(surveyId),
        status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
      }
    };

    // Test the addFieldsStage logic
    const testPipeline = [
      matchStage,
      {
        $limit: 1000 // Test with 1000 responses
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
          },
          // Extract age
          ageResponse: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: {
                      $or: [
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'age' } },
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'year' } }
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
          },
          // Extract phone
          phoneResponse: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: {
                      $or: [
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'phone' } },
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'mobile' } }
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
          },
          ageValue: {
            $cond: {
              if: { $ne: ['$ageResponse', null] },
              then: {
                $cond: {
                  if: { $eq: [{ $type: '$ageResponse.response' }, 'number'] },
                  then: { $toString: '$ageResponse.response' },
                  else: {
                    $cond: {
                      if: { $or: [{ $isArray: '$ageResponse.response' }, { $eq: [{ $type: '$ageResponse.response' }, 'array'] }] },
                      then: {
                        $cond: {
                          if: { $gt: [{ $size: { $ifNull: ['$ageResponse.response', []] } }, 0] },
                          then: {
                            $let: {
                              vars: { first: { $arrayElemAt: [{ $ifNull: ['$ageResponse.response', []] }, 0] } },
                              in: {
                                $cond: {
                                  if: { $eq: [{ $type: '$$first' }, 'number'] },
                                  then: { $toString: '$$first' },
                                  else: { $toString: { $ifNull: ['$$first', ''] } }
                                }
                              }
                            }
                          },
                          else: ''
                        }
                      },
                      else: { $toString: { $ifNull: ['$ageResponse.response', ''] } }
                    }
                  }
                }
              },
              else: ''
            }
          },
          phoneValue: {
            $cond: {
              if: { $ne: ['$phoneResponse', null] },
              then: {
                $cond: {
                  if: { $or: [{ $isArray: '$phoneResponse.response' }, { $eq: [{ $type: '$phoneResponse.response' }, 'array'] }] },
                  then: {
                    $cond: {
                      if: { $gt: [{ $size: { $ifNull: ['$phoneResponse.response', []] } }, 0] },
                      then: {
                        $let: {
                          vars: { first: { $arrayElemAt: [{ $ifNull: ['$phoneResponse.response', []] }, 0] } },
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
                  else: { $ifNull: ['$phoneResponse.response', ''] }
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
          },
          phoneValue: {
            $cond: {
              if: { $or: [{ $isArray: '$phoneValue' }, { $eq: [{ $type: '$phoneValue' }, 'array'] }] },
              then: '',
              else: { $toString: { $ifNull: ['$phoneValue', ''] } }
            }
          },
          ageValue: {
            $cond: {
              if: { $or: [{ $isArray: '$ageValue' }, { $eq: [{ $type: '$ageValue' }, 'array'] }] },
              then: '',
              else: { $toString: { $ifNull: ['$ageValue', ''] } }
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
          },
          withoutPhoneCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$phoneResponse', null] },
                    { $eq: [{ $ifNull: ['$phoneValue', ''] }, ''] },
                    { $eq: [{ $toLower: { $ifNull: ['$phoneValue', ''] } }, 'n/a'] },
                    { $eq: [{ $ifNull: ['$phoneValue', ''] }, '0'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          age18to24Count: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$ageResponse', null] },
                    {
                      $cond: {
                        if: { $eq: [{ $type: '$ageResponse.response' }, 'number'] },
                        then: {
                          $and: [
                            { $gte: ['$ageResponse.response', 18] },
                            { $lte: ['$ageResponse.response', 24] }
                          ]
                        },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $ne: ['$ageValue', ''] },
                                { $regexMatch: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }
                              ]
                            },
                            then: {
                              $let: {
                                vars: {
                                  firstDigit: {
                                    $toInt: {
                                      $arrayElemAt: [
                                        { $regexFind: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }.captures || [],
                                        0
                                      ]
                                    }
                                  }
                                },
                                in: {
                                  $and: [
                                    { $gte: ['$$firstDigit', 18] },
                                    { $lte: ['$$firstDigit', 24] }
                                  ]
                                }
                              }
                            },
                            else: false
                          }
                        }
                      }
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          age50PlusCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$ageResponse', null] },
                    {
                      $cond: {
                        if: { $eq: [{ $type: '$ageResponse.response' }, 'number'] },
                        then: { $gte: ['$ageResponse.response', 50] },
                        else: {
                          $cond: {
                            if: {
                              $and: [
                                { $ne: ['$ageValue', ''] },
                                { $regexMatch: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }
                              ]
                            },
                            then: {
                              $let: {
                                vars: {
                                  firstDigit: {
                                    $toInt: {
                                      $arrayElemAt: [
                                        { $regexFind: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }.captures || [],
                                        0
                                      ]
                                    }
                                  }
                                },
                                in: { $gte: ['$$firstDigit', 50] }
                              }
                            },
                            else: false
                          }
                        }
                      }
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

    console.log('🧪 Testing full aggregation pipeline with demographics...\n');
    const result = await SurveyResponse.aggregate(testPipeline, {
      allowDiskUse: true,
      maxTimeMS: 60000
    });

    if (result && result.length > 0) {
      const stats = result[0];
      console.log('📊 Full Aggregation Results:');
      console.log(`   Total Responses: ${stats.total}`);
      console.log(`   Female Count: ${stats.femaleCount || 0}`);
      console.log(`   Female Percentage: ${stats.total > 0 ? ((stats.femaleCount || 0) / stats.total * 100).toFixed(2) : 0}%`);
      console.log(`   Without Phone Count: ${stats.withoutPhoneCount || 0}`);
      console.log(`   Without Phone Percentage: ${stats.total > 0 ? ((stats.withoutPhoneCount || 0) / stats.total * 100).toFixed(2) : 0}%`);
      console.log(`   Age 18-24 Count: ${stats.age18to24Count || 0}`);
      console.log(`   Age 18-24 Percentage: ${stats.total > 0 ? ((stats.age18to24Count || 0) / stats.total * 100).toFixed(2) : 0}%`);
      console.log(`   Age 50+ Count: ${stats.age50PlusCount || 0}`);
      console.log(`   Age 50+ Percentage: ${stats.total > 0 ? ((stats.age50PlusCount || 0) / stats.total * 100).toFixed(2) : 0}%`);
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

testFullAnalytics();

