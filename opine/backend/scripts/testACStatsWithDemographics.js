#!/usr/bin/env node

/**
 * Script to test AC stats with demographics from the actual endpoint logic
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');

async function testACStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB\n');

    const surveyId = '68fd1915d41841da463f0d46';
    
    // Import the actual pipeline logic (simplified test)
    const matchStage = {
      $match: {
        survey: new mongoose.Types.ObjectId(surveyId),
        status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
      }
    };

    // Test with a small sample first
    const testPipeline = [
      matchStage,
      { $limit: 500 }, // Test with 500 responses
      {
        $addFields: {
          extractedAC: {
            $cond: {
              if: { $and: [{ $ne: ['$selectedAC', null] }, { $ne: ['$selectedAC', ''] }, { $ne: ['$selectedAC', 'N/A'] }] },
              then: '$selectedAC',
              else: {
                $cond: {
                  if: { $and: [{ $ne: ['$selectedPollingStation.acName', null] }, { $ne: ['$selectedPollingStation.acName', ''] }, { $ne: ['$selectedPollingStation.acName', 'N/A'] }] },
                  then: '$selectedPollingStation.acName',
                  else: null
                }
              }
            }
          },
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
          },
          // Extract caste (for this survey)
          casteResponse: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: {
                      $or: [
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'caste' } },
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'scheduled cast' } },
                        { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'category' } }
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
          // Extract religion
          religionResponse: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: {
                      $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'religion' }
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
          },
          casteValue: {
            $cond: {
              if: { $ne: ['$casteResponse', null] },
              then: {
                $cond: {
                  if: { $or: [{ $isArray: '$casteResponse.response' }, { $eq: [{ $type: '$casteResponse.response' }, 'array'] }] },
                  then: {
                    $cond: {
                      if: { $gt: [{ $size: { $ifNull: ['$casteResponse.response', []] } }, 0] },
                      then: {
                        $let: {
                          vars: { first: { $arrayElemAt: [{ $ifNull: ['$casteResponse.response', []] }, 0] } },
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
                  else: { $ifNull: ['$casteResponse.response', ''] }
                }
              },
              else: ''
            }
          },
          religionValue: {
            $cond: {
              if: { $ne: ['$religionResponse', null] },
              then: {
                $cond: {
                  if: { $or: [{ $isArray: '$religionResponse.response' }, { $eq: [{ $type: '$religionResponse.response' }, 'array'] }] },
                  then: {
                    $cond: {
                      if: { $gt: [{ $size: { $ifNull: ['$religionResponse.response', []] } }, 0] },
                      then: {
                        $let: {
                          vars: { first: { $arrayElemAt: [{ $ifNull: ['$religionResponse.response', []] }, 0] } },
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
                  else: { $ifNull: ['$religionResponse.response', ''] }
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
          },
          casteValue: {
            $cond: {
              if: { $or: [{ $isArray: '$casteValue' }, { $eq: [{ $type: '$casteValue' }, 'array'] }] },
              then: '',
              else: { $toString: { $ifNull: ['$casteValue', ''] } }
            }
          },
          religionValue: {
            $cond: {
              if: { $or: [{ $isArray: '$religionValue' }, { $eq: [{ $type: '$religionValue' }, 'array'] }] },
              then: '',
              else: { $toString: { $ifNull: ['$religionValue', ''] } }
            }
          }
        }
      },
      {
        $match: {
          extractedAC: { $ne: null }
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$extractedAC', 'N/A'] },
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
          scCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$casteResponse', null] },
                    {
                      $regexMatch: {
                        input: { $toLower: { $ifNull: ['$casteValue', ''] } },
                        regex: '(scheduled cast|sc|scheduled caste)'
                      }
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          muslimCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$religionResponse', null] },
                    {
                      $regexMatch: {
                        input: { $toLower: { $ifNull: ['$religionValue', ''] } },
                        regex: '(muslim|islam)'
                      }
                    }
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
                                { $ne: ['$ageValue', null] },
                                { $regexMatch: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }
                              ]
                            },
                            then: {
                              $let: {
                                vars: {
                                  regexResult: { $regexFind: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } },
                                  ageNum: {
                                    $cond: {
                                      if: { $ne: ['$$regexResult', null] },
                                      then: {
                                        $toInt: {
                                          $arrayElemAt: [
                                            { $ifNull: ['$$regexResult.captures', []] },
                                            0
                                          ]
                                        }
                                      },
                                      else: 0
                                    }
                                  }
                                },
                                in: {
                                  $and: [
                                    { $gte: ['$$ageNum', 18] },
                                    { $lte: ['$$ageNum', 24] }
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
                                { $ne: ['$ageValue', null] },
                                { $regexMatch: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } }
                              ]
                            },
                            then: {
                              $let: {
                                vars: {
                                  regexResult: { $regexFind: { input: { $toString: { $ifNull: ['$ageValue', ''] } }, regex: '^\\s*(\\d+)' } },
                                  ageNum: {
                                    $cond: {
                                      if: { $ne: ['$$regexResult', null] },
                                      then: {
                                        $toInt: {
                                          $arrayElemAt: [
                                            { $ifNull: ['$$regexResult.captures', []] },
                                            0
                                          ]
                                        }
                                      },
                                      else: 0
                                    }
                                  }
                                },
                                in: { $gte: ['$$ageNum', 50] }
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
      },
      {
        $project: {
          _id: 0,
          ac: '$_id',
          total: 1,
          femaleCount: 1,
          withoutPhoneCount: 1,
          scCount: 1,
          muslimCount: 1,
          age18to24Count: 1,
          age50PlusCount: 1
        }
      },
      {
        $limit: 5 // Show first 5 ACs
      }
    ];

    console.log('🧪 Testing AC stats aggregation with demographics...\n');
    const result = await SurveyResponse.aggregate(testPipeline, {
      allowDiskUse: true,
      maxTimeMS: 60000
    });

    if (result && result.length > 0) {
      console.log(`📊 Found ${result.length} ACs with responses:\n`);
      result.forEach((stat, idx) => {
        console.log(`--- AC ${idx + 1}: ${stat.ac} ---`);
        console.log(`   Total: ${stat.total}`);
        console.log(`   Female: ${stat.femaleCount || 0} (${stat.total > 0 ? ((stat.femaleCount || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log(`   Without Phone: ${stat.withoutPhoneCount || 0} (${stat.total > 0 ? ((stat.withoutPhoneCount || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log(`   SC: ${stat.scCount || 0} (${stat.total > 0 ? ((stat.scCount || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log(`   Muslim: ${stat.muslimCount || 0} (${stat.total > 0 ? ((stat.muslimCount || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log(`   Age 18-24: ${stat.age18to24Count || 0} (${stat.total > 0 ? ((stat.age18to24Count || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log(`   Age 50+: ${stat.age50PlusCount || 0} (${stat.total > 0 ? ((stat.age50PlusCount || 0) / stat.total * 100).toFixed(2) : 0}%)`);
        console.log('');
      });
    } else {
      console.log('❌ No results from aggregation');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testACStats();

