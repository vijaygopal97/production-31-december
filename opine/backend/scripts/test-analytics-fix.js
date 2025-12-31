// Test script to identify which field is causing the array conversion error
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
require('dotenv').config({ path: '/var/www/opine/backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const SURVEY_ID = '68fd1915d41841da463f0d46';

async function testAnalytics() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!');

    // Find a sample response with array in response field
    const sample = await SurveyResponse.findOne({ 
      survey: SURVEY_ID,
      'responses.response': { $type: 'array' }
    }).limit(1);

    if (sample) {
      console.log('📋 Found sample response with array in response field:');
      const arrayResponse = sample.responses.find(r => Array.isArray(r.response));
      if (arrayResponse) {
        console.log('  Question:', arrayResponse.questionText);
        console.log('  Response type:', typeof arrayResponse.response);
        console.log('  Response is array:', Array.isArray(arrayResponse.response));
        console.log('  Response value:', JSON.stringify(arrayResponse.response, null, 2));
      }
    } else {
      console.log('ℹ️  No responses found with array in response field');
    }

    // Test the aggregation with minimal fields
    console.log('\n🧪 Testing minimal aggregation...');
    const testPipeline = [
      { $match: { survey: new mongoose.Types.ObjectId(SURVEY_ID) } },
      { $limit: 10 },
      {
        $addFields: {
          testGender: {
            $let: {
              vars: {
                filtered: {
                  $filter: {
                    input: { $ifNull: ['$responses', []] },
                    as: 'resp',
                    cond: { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'gender' } }
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
          testGenderValue: {
            $let: {
              vars: {
                val: {
                  $cond: {
                    if: { $isArray: '$testGender.response' },
                    then: {
                      $cond: {
                        if: { $gt: [{ $size: '$testGender.response' }, 0] },
                        then: {
                          $let: {
                            vars: { first: { $arrayElemAt: ['$testGender.response', 0] } },
                            in: {
                              $cond: {
                                if: { $isArray: '$$first' },
                                then: { $cond: { if: { $gt: [{ $size: '$$first' }, 0] }, then: { $arrayElemAt: ['$$first', 0] }, else: '' } },
                                else: '$$first'
                              }
                            }
                          }
                        },
                        else: ''
                      }
                    },
                    else: { $ifNull: ['$testGender.response', ''] }
                  }
                }
              },
              in: {
                $convert: {
                  input: '$$val',
                  to: 'string',
                  onError: '',
                  onNull: ''
                }
              }
            }
          }
        }
      },
      { $project: { _id: 1, testGender: 1, testGenderValue: 1 } }
    ];

    const result = await SurveyResponse.aggregate(testPipeline);
    console.log('✅ Test aggregation successful!');
    console.log('📊 Results:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

testAnalytics();





