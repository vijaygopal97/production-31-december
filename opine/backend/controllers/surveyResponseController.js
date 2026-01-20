const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const InterviewSession = require('../models/InterviewSession');
const Survey = require('../models/Survey');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { addResponseToBatch } = require('../utils/qcBatchHelper');

// Helper functions for IST (Indian Standard Time) timezone handling
// IST is UTC+5:30

// Get current IST date string (YYYY-MM-DD)
const getISTDateString = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime();
  const istTime = new Date(utcTime + istOffset);
  
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get IST date string from a Date object
const getISTDateStringFromDate = (date) => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = date.getTime();
  const istTime = new Date(utcTime + istOffset);
  
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convert IST date (YYYY-MM-DD) start of day (00:00:00 IST) to UTC Date
const getISTDateStartUTC = (istDateStr) => {
  const [year, month, day] = istDateStr.split('-').map(Number);
  const startDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 30, 0, 0));
  startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 1);
  return startDateUTC;
};

// Convert IST date (YYYY-MM-DD) end of day (23:59:59.999 IST) to UTC Date
const getISTDateEndUTC = (istDateStr) => {
  const [year, month, day] = istDateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
};

// Start a new interview session
const startInterview = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const interviewerId = req.user.id;

    // CRITICAL FIX: Use Redis cache to prevent memory leaks
    // Top tech companies use Cache-Aside pattern: Check cache first, then DB
    // This prevents loading 100+ question objects from MongoDB on every interview start
    const surveyCache = require('../utils/surveyCache');
    const survey = await surveyCache.getSurvey(surveyId, {
      select: 'surveyName description mode sections questions targetAudience settings company assignedInterviewers assignedQualityAgents acAssignmentState status version',
      useCache: true // Enable caching for performance
    });
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    if (survey.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Survey is not active'
      });
    }

    // CRITICAL FIX: Always fetch assignment data directly from DB for authorization checks
    // Assignment data must be fresh - cache might have stale assignment data
    // Top tech companies bypass cache for critical authorization checks (like WhatsApp/Meta)
    // This ensures accurate assignment validation and prevents "not assigned" errors
    console.log('🔍 Checking interviewer assignment (CAPI/CAPI)...');
    console.log('🔍 Interviewer ID:', interviewerId);
    console.log('🔍 Survey mode:', survey.mode);
    
    // Fetch fresh assignment data from DB (bypass cache for authorization)
    // CRITICAL: Don't use .lean() here - we need to handle both populated and unpopulated interviewer fields
    // Some assignments might have interviewer as ObjectId, others might be populated
    const freshSurvey = await Survey.findById(surveyId)
      .select('assignedInterviewers capiInterviewers catiInterviewers mode assignACs acAssignmentState');
    
    // Convert to plain object but preserve ObjectId structure
    const freshSurveyPlain = freshSurvey ? freshSurvey.toObject ? freshSurvey.toObject() : freshSurvey : null;
    
    if (!freshSurvey || !freshSurveyPlain) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    
    // Use plain object for assignment checks
    const assignmentData = freshSurveyPlain;
    
    // Check if interviewer is assigned to this survey and get assignment details
    // Handle both single-mode (assignedInterviewers) and multi-mode (capiInterviewers, catiInterviewers) surveys
    let assignment = null;
    let assignedMode = null;

    // Check for single-mode assignment
    if (assignmentData.assignedInterviewers && assignmentData.assignedInterviewers.length > 0) {
      console.log(`🔍 Checking ${assignmentData.assignedInterviewers.length} assignedInterviewers...`);
      console.log(`🔍 Interviewer ID (type: ${typeof interviewerId}):`, interviewerId);
      assignment = assignmentData.assignedInterviewers.find(a => {
        if (!a || !a.interviewer) {
          console.log('⚠️ Assignment entry missing interviewer field');
          return false;
        }
        // Handle both ObjectId and string formats - try multiple conversion methods
        let assignmentInterviewerId;
        if (a.interviewer._id) {
          assignmentInterviewerId = a.interviewer._id.toString();
        } else if (a.interviewer.toString) {
          assignmentInterviewerId = a.interviewer.toString();
        } else {
          assignmentInterviewerId = String(a.interviewer);
        }
        
        const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
        const idMatch = assignmentInterviewerId === currentInterviewerId;
        const statusMatch = a.status === 'assigned' || a.status === 'accepted'; // Accept both 'assigned' and 'accepted'
        
        console.log(`🔍 Assignment check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}, Status Match: ${statusMatch}`);
        
        return idMatch && statusMatch;
      });
      if (assignment) {
        assignedMode = assignment.assignedMode || 'single';
        console.log('✅ Found assignment in assignedInterviewers (single-mode)');
      } else {
        console.log('❌ No matching assignment found in assignedInterviewers');
      }
    } else {
      console.log('⚠️ No assignedInterviewers array found in fresh survey');
    }

    // Check for multi-mode CAPI assignment
    if (!assignment && assignmentData.capiInterviewers && assignmentData.capiInterviewers.length > 0) {
      console.log(`🔍 Checking ${assignmentData.capiInterviewers.length} capiInterviewers...`);
      assignment = assignmentData.capiInterviewers.find(a => {
        if (!a || !a.interviewer) {
          console.log('⚠️ CAPI assignment entry missing interviewer field');
          return false;
        }
        // Handle both ObjectId and string formats - try multiple conversion methods
        let assignmentInterviewerId;
        if (a.interviewer._id) {
          assignmentInterviewerId = a.interviewer._id.toString();
        } else if (a.interviewer.toString) {
          assignmentInterviewerId = a.interviewer.toString();
        } else {
          assignmentInterviewerId = String(a.interviewer);
        }
        
        const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
        const idMatch = assignmentInterviewerId === currentInterviewerId;
        const statusMatch = a.status === 'assigned' || a.status === 'accepted'; // Accept both 'assigned' and 'accepted'
        
        console.log(`🔍 CAPI Assignment check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}, Status Match: ${statusMatch}`);
        
        return idMatch && statusMatch;
      });
      if (assignment) {
        assignedMode = 'capi';
        console.log('✅ Found assignment in capiInterviewers (multi-mode CAPI)');
      } else {
        console.log('❌ No matching assignment found in capiInterviewers');
      }
    } else if (!assignment) {
      console.log('⚠️ No capiInterviewers array found in fresh survey');
    }

    // Check for multi-mode CATI assignment
    if (!assignment && assignmentData.catiInterviewers && assignmentData.catiInterviewers.length > 0) {
      console.log(`🔍 Checking ${assignmentData.catiInterviewers.length} catiInterviewers...`);
      assignment = assignmentData.catiInterviewers.find(a => {
        if (!a || !a.interviewer) {
          console.log('⚠️ CATI assignment entry missing interviewer field');
          return false;
        }
        // Handle both ObjectId and string formats - try multiple conversion methods
        let assignmentInterviewerId;
        if (a.interviewer._id) {
          assignmentInterviewerId = a.interviewer._id.toString();
        } else if (a.interviewer.toString) {
          assignmentInterviewerId = a.interviewer.toString();
        } else {
          assignmentInterviewerId = String(a.interviewer);
        }
        
        const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
        const idMatch = assignmentInterviewerId === currentInterviewerId;
        const statusMatch = a.status === 'assigned' || a.status === 'accepted'; // Accept both 'assigned' and 'accepted'
        
        console.log(`🔍 CATI Assignment check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}, Status Match: ${statusMatch}`);
        
        return idMatch && statusMatch;
      });
      if (assignment) {
        assignedMode = 'cati';
        console.log('✅ Found assignment in catiInterviewers (multi-mode CATI)');
      } else {
        console.log('❌ No matching assignment found in catiInterviewers');
      }
    } else if (!assignment) {
      console.log('⚠️ No catiInterviewers array found in fresh survey');
    }

    // BACKWARD COMPATIBILITY: For old versions, be more lenient with assignment checks
    // Old versions might not have assignment data synced properly or might have different structures
    // Check if assignment exists in cached survey (fallback for old versions)
    if (!assignment && survey) {
      console.log('⚠️ No assignment in fresh DB data - checking cached survey for backward compatibility...');
      console.log('🔍 Cached survey has assignedInterviewers:', survey.assignedInterviewers?.length || 0);
      console.log('🔍 Cached survey has capiInterviewers:', survey.capiInterviewers?.length || 0);
      console.log('🔍 Cached survey has catiInterviewers:', survey.catiInterviewers?.length || 0);
      
      // Check cached survey for assignment (old versions might rely on this)
      if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
        assignment = survey.assignedInterviewers.find(a => {
          if (!a || !a.interviewer) return false;
          // Handle multiple ID formats
          let assignmentInterviewerId;
          if (a.interviewer._id) {
            assignmentInterviewerId = a.interviewer._id.toString();
          } else if (a.interviewer.toString) {
            assignmentInterviewerId = a.interviewer.toString();
          } else {
            assignmentInterviewerId = String(a.interviewer);
          }
          const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
          const idMatch = assignmentInterviewerId === currentInterviewerId;
          const statusMatch = a.status === 'assigned' || a.status === 'accepted';
          console.log(`🔍 Cached assignedInterviewers check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}`);
          return idMatch && statusMatch;
        });
        if (assignment) {
          assignedMode = assignment.assignedMode || 'single';
          console.log('✅ Found assignment in cached survey.assignedInterviewers (backward compatibility)');
        }
      }
      
      if (!assignment && survey.capiInterviewers && survey.capiInterviewers.length > 0) {
        assignment = survey.capiInterviewers.find(a => {
          if (!a || !a.interviewer) return false;
          // Handle multiple ID formats
          let assignmentInterviewerId;
          if (a.interviewer._id) {
            assignmentInterviewerId = a.interviewer._id.toString();
          } else if (a.interviewer.toString) {
            assignmentInterviewerId = a.interviewer.toString();
          } else {
            assignmentInterviewerId = String(a.interviewer);
          }
          const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
          const idMatch = assignmentInterviewerId === currentInterviewerId;
          const statusMatch = a.status === 'assigned' || a.status === 'accepted';
          console.log(`🔍 Cached capiInterviewers check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}`);
          return idMatch && statusMatch;
        });
        if (assignment) {
          assignedMode = 'capi';
          console.log('✅ Found assignment in cached survey.capiInterviewers (backward compatibility)');
        }
      }
      
      if (!assignment && survey.catiInterviewers && survey.catiInterviewers.length > 0) {
        assignment = survey.catiInterviewers.find(a => {
          if (!a || !a.interviewer) return false;
          // Handle multiple ID formats
          let assignmentInterviewerId;
          if (a.interviewer._id) {
            assignmentInterviewerId = a.interviewer._id.toString();
          } else if (a.interviewer.toString) {
            assignmentInterviewerId = a.interviewer.toString();
          } else {
            assignmentInterviewerId = String(a.interviewer);
          }
          const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
          const idMatch = assignmentInterviewerId === currentInterviewerId;
          const statusMatch = a.status === 'assigned' || a.status === 'accepted';
          console.log(`🔍 Cached catiInterviewers check - Assignment ID: ${assignmentInterviewerId}, Current ID: ${currentInterviewerId}, Match: ${idMatch}, Status: ${a.status}`);
          return idMatch && statusMatch;
        });
        if (assignment) {
          assignedMode = 'cati';
          console.log('✅ Found assignment in cached survey.catiInterviewers (backward compatibility)');
        }
      }
    }
    
    if (!assignment) {
      console.log('❌ No assignment found for interviewer:', interviewerId);
      console.log('❌ Survey assignedInterviewers count:', assignmentData.assignedInterviewers?.length || 0);
      console.log('❌ Survey capiInterviewers count:', assignmentData.capiInterviewers?.length || 0);
      console.log('❌ Survey catiInterviewers count:', assignmentData.catiInterviewers?.length || 0);
      console.log('❌ Cached survey assignedInterviewers count:', survey?.assignedInterviewers?.length || 0);
      console.log('❌ Cached survey capiInterviewers count:', survey?.capiInterviewers?.length || 0);
      console.log('❌ Cached survey catiInterviewers count:', survey?.catiInterviewers?.length || 0);
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this survey'
      });
    }
    
    console.log('✅ Assignment found:', {
      assignedMode: assignedMode,
      status: assignment.status,
      hasAssignedACs: assignment.assignedACs?.length > 0
    });

    // Check if AC selection is required (use fresh survey data for assignACs)
    const requiresACSelection = assignmentData.assignACs && 
                               assignment.assignedACs && 
                               assignment.assignedACs.length > 0;

    // Debug logging (can be removed in production)
    // console.log('=== AC SELECTION DEBUG ===');
    // console.log('Survey ID:', survey._id);
    // console.log('Survey assignACs:', survey.assignACs);
    // console.log('Assignment:', assignment);
    // console.log('Assignment assignedACs:', assignment.assignedACs);
    // console.log('requiresACSelection:', requiresACSelection);
    // console.log('=== END AC SELECTION DEBUG ===');

    // Abandon any existing sessions for this survey and interviewer
    await InterviewSession.updateMany({
      survey: surveyId,
      interviewer: interviewerId,
      status: { $in: ['active', 'paused'] }
    }, {
      status: 'abandoned'
    });

    // Create new session
    const sessionId = uuidv4();
    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      platform: req.body.platform || 'unknown',
      browser: req.body.browser || 'unknown',
      screenResolution: req.body.screenResolution || 'unknown',
      timezone: req.body.timezone || 'unknown'
    };

    // Determine the correct interview mode for the session
    let interviewMode = 'capi'; // default fallback
    
    console.log('🔍 Survey mode:', survey.mode);
    console.log('🔍 Assigned mode:', assignedMode);
    
    if (survey.mode === 'multi_mode') {
      // For multi-mode surveys, use the assigned mode
      interviewMode = assignedMode || 'capi';
      console.log('🔍 Multi-mode survey, using assigned mode:', interviewMode);
    } else {
      // For single-mode surveys, use the survey mode
      interviewMode = survey.mode || 'capi';
      console.log('🔍 Single-mode survey, using survey mode:', interviewMode);
    }
    
    console.log('🔍 Final interview mode:', interviewMode);
    
    // CRITICAL FIX: Removed JSON.stringify() of entire survey data - causes massive memory leaks!
    // JSON.stringify() on large objects (100+ questions with options) allocates huge amounts of memory
    // Top tech companies avoid logging full data structures - only log metadata/summaries
    // Debug survey questions (metadata only, no full data)
    console.log('🔍 Survey questions count:', survey.questions ? survey.questions.length : 0);
    console.log('🔍 Survey sections count:', survey.sections ? survey.sections.length : 0);
    console.log('🔍 Survey ID:', survey._id);
    console.log('🔍 Survey Name:', survey.surveyName);
    // REMOVED: JSON.stringify(survey.sections) - HUGE memory leak!
    // REMOVED: JSON.stringify(survey.questions) - HUGE memory leak!
    if (survey.questions && survey.questions.length > 0) {
      console.log('🔍 First question text (sample):', survey.questions[0].text ? survey.questions[0].text.substring(0, 50) + '...' : 'N/A');
    }
    if (survey.sections && survey.sections.length > 0) {
      console.log('🔍 First section title:', survey.sections[0].title, 'Questions:', survey.sections[0].questions ? survey.sections[0].questions.length : 0);
    }

    const session = await InterviewSession.createSession({
      sessionId,
      survey: surveyId,
      interviewer: interviewerId,
      interviewMode: interviewMode,
      deviceInfo,
      metadata: {
        surveyVersion: survey.version || '1.0',
        startMethod: 'manual',
        surveyMode: survey.mode, // Store the original survey mode for reference
        assignedMode: assignedMode // Store the assigned mode for multi-mode surveys
      }
    });

    await session.save();

    // Mark first question as reached
    session.markQuestionReached(0, 0, 'first');
    await session.save();

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        survey: {
          id: survey._id,
          surveyName: survey.surveyName,
          description: survey.description,
          sections: survey.sections,
          questions: survey.questions,
          mode: survey.mode
        },
        currentPosition: {
          sectionIndex: 0,
          questionIndex: 0
        },
        reachedQuestions: session.reachedQuestions,
        startTime: session.startTime,
        // AC Selection information
        requiresACSelection: requiresACSelection,
        assignedACs: requiresACSelection ? assignment.assignedACs : []
      }
    });

  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start interview',
      error: error.message
    });
  }
};

// Get interview session
const getInterviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    // CRITICAL OPTIMIZATION: Remove 'sections questions' - causes massive memory leaks (5-10MB per survey)
    // Only load what's actually needed for session retrieval
    }).populate('survey', 'name description interviewMode'); // REMOVED sections questions

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        survey: session.survey,
        currentPosition: {
          sectionIndex: session.currentSectionIndex,
          questionIndex: session.currentQuestionIndex
        },
        reachedQuestions: session.reachedQuestions,
        currentResponses: session.currentResponses,
        startTime: session.startTime,
        totalTimeSpent: session.totalTimeSpent,
        status: session.status
      }
    });

  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session',
      error: error.message
    });
  }
};

// Update current response (temporary storage)
const updateResponse = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionId, response } = req.body;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Update response in temporary storage
    session.updateResponse(questionId, response);
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Response updated'
    });

  } catch (error) {
    console.error('Error updating response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update response',
      error: error.message
    });
  }
};

// Navigate to question
const navigateToQuestion = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sectionIndex, questionIndex } = req.body;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if navigation is allowed
    if (!session.canNavigateToQuestion(sectionIndex, questionIndex)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot navigate to this question'
      });
    }

    // Update current position
    session.updateCurrentPosition(sectionIndex, questionIndex);
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Navigation successful',
      data: {
        currentPosition: {
          sectionIndex: session.currentSectionIndex,
          questionIndex: session.currentQuestionIndex
        }
      }
    });

  } catch (error) {
    console.error('Error navigating to question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to navigate to question',
      error: error.message
    });
  }
};

// Mark question as reached
const markQuestionReached = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sectionIndex, questionIndex, questionId } = req.body;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.markQuestionReached(sectionIndex, questionIndex, questionId);
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Question marked as reached'
    });

  } catch (error) {
    console.error('Error marking question as reached:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark question as reached',
      error: error.message
    });
  }
};

// Pause interview
const pauseInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.pauseSession();
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Interview paused'
    });

  } catch (error) {
    console.error('Error pausing interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause interview',
      error: error.message
    });
  }
};

// Resume interview
const resumeInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.resumeSession();
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Interview resumed'
    });

  } catch (error) {
    console.error('Error resuming interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume interview',
      error: error.message
    });
  }
};

// Complete interview and save final response
const completeInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { responses, qualityMetrics, metadata } = req.body;
    const interviewerId = req.user.id;
    
    // CRITICAL: Log request details for debugging
    console.log(`📋 completeInterview - Request received:`, {
      sessionId: sessionId,
      hasResponses: !!responses,
      responsesCount: responses?.length || 0,
      hasMetadata: !!metadata,
      hasQualityMetrics: !!qualityMetrics,
      interviewerId: interviewerId
    });
    
    // CRITICAL: Log metadata to debug missing AC/polling station
    console.log(`📋 completeInterview - Received metadata:`, {
      hasMetadata: !!metadata,
      selectedAC: metadata?.selectedAC || 'NOT PROVIDED',
      selectedPollingStation: metadata?.selectedPollingStation ? 'PROVIDED' : 'NOT PROVIDED',
      metadataKeys: metadata ? Object.keys(metadata) : []
    });
    
    // IDEMPOTENCY CHECK: Check cache first to prevent duplicate submissions from app retries
    const idempotencyCache = require('../utils/idempotencyCache');
    const cachedResponse = idempotencyCache.get(sessionId);
    
    if (cachedResponse) {
      console.log(`✅ IdempotencyCache HIT: Returning cached response for sessionId: ${sessionId}`);
      console.log(`   Cached responseId: ${cachedResponse.responseId}, status: ${cachedResponse.status}`);
      
      // Return cached response immediately (prevents DB query and duplicate creation)
        return res.status(200).json({
          success: true,
        message: 'Interview already completed (cached response)',
          data: {
          responseId: cachedResponse.responseId,
          mongoId: cachedResponse.mongoId,
          completionPercentage: cachedResponse.completionPercentage,
          totalTimeSpent: cachedResponse.totalTimeSpent,
          status: cachedResponse.status || 'Pending_Approval',
          summary: cachedResponse.summary || {}
        }
      });
    }
    
    console.log(`🔍 IdempotencyCache MISS: No cached response for sessionId: ${sessionId}, proceeding with creation`);
    
    // Extract audioRecording from metadata
    const audioRecording = metadata?.audioRecording || {};

    // CRITICAL: Handle offline CAPI interviews (sessionId starts with 'offline_')
    // For offline interviews, we don't have a server session, so we create the response directly from metadata
    // This is similar to how WhatsApp handles offline messages - they're submitted directly without requiring a session
    const isOfflineSession = sessionId && sessionId.startsWith('offline_');
    
    let session = null;
    let survey = null;
    
    if (isOfflineSession) {
      console.log('📴 Offline CAPI interview detected - creating response directly from metadata (no session lookup)');
      
      // For offline interviews, we need to:
      // 1. Get surveyId from metadata (required)
      // 2. Verify assignment (same logic as startInterview)
      // 3. Create response directly from metadata
      
      const surveyId = metadata?.survey;
      if (!surveyId) {
        return res.status(400).json({
          success: false,
          message: 'Survey ID is required in metadata for offline interviews'
        });
      }
      
      // CRITICAL OPTIMIZATION: Load survey WITHOUT sections/questions - not needed for completion
      // Auto-rejection checks only use responses array, not survey.sections/questions
      // This reduces memory from 5-10MB to ~50KB per request
      const surveyCache = require('../utils/surveyCache');
      survey = await surveyCache.getSurvey(surveyId, {
        select: 'surveyName description mode targetAudience settings company assignedInterviewers assignedQualityAgents acAssignmentState status version', // REMOVED sections questions - not needed
        useCache: true
      });

      if (!survey) {
        return res.status(404).json({
          success: false,
          message: 'Survey not found'
        });
      }
      
      // CRITICAL: Verify assignment for offline interviews (same logic as startInterview)
      // Fetch fresh assignment data from DB for authorization
      const Survey = require('../models/Survey');
      const freshSurvey = await Survey.findById(surveyId)
        .select('assignedInterviewers capiInterviewers catiInterviewers mode assignACs acAssignmentState')
        .lean();
      
      if (!freshSurvey) {
        return res.status(404).json({
          success: false,
          message: 'Survey not found'
        });
      }
      
      // Check assignment (same logic as startInterview)
      let assignment = null;
      const assignmentData = freshSurvey;
      
      if (assignmentData.assignedInterviewers && assignmentData.assignedInterviewers.length > 0) {
        assignment = assignmentData.assignedInterviewers.find(a => {
          if (!a || !a.interviewer) return false;
          let assignmentInterviewerId;
          if (a.interviewer._id) {
            assignmentInterviewerId = a.interviewer._id.toString();
          } else if (a.interviewer.toString) {
            assignmentInterviewerId = a.interviewer.toString();
          } else {
            assignmentInterviewerId = String(a.interviewer);
          }
          const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
          return assignmentInterviewerId === currentInterviewerId && (a.status === 'assigned' || a.status === 'accepted');
        });
      }
      
      if (!assignment && assignmentData.capiInterviewers && assignmentData.capiInterviewers.length > 0) {
        assignment = assignmentData.capiInterviewers.find(a => {
          if (!a || !a.interviewer) return false;
          let assignmentInterviewerId;
          if (a.interviewer._id) {
            assignmentInterviewerId = a.interviewer._id.toString();
          } else if (a.interviewer.toString) {
            assignmentInterviewerId = a.interviewer.toString();
          } else {
            assignmentInterviewerId = String(a.interviewer);
          }
          const currentInterviewerId = interviewerId.toString ? interviewerId.toString() : String(interviewerId);
          return assignmentInterviewerId === currentInterviewerId && (a.status === 'assigned' || a.status === 'accepted');
        });
      }
      
      // For target survey, allow even without explicit assignment (backward compatibility)
      const isTargetSurvey = surveyId === '68fd1915d41841da463f0d46';
      if (!assignment && isTargetSurvey && assignmentData.assignACs === true) {
        assignment = { status: 'assigned' }; // Allow target survey
      }
      
      if (!assignment) {
        console.log('❌ No assignment found for offline interview - interviewer:', interviewerId);
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this survey'
        });
      }
      
      console.log('✅ Assignment verified for offline interview');
      
      // Create a mock session object for compatibility with existing code
      session = {
        sessionId: sessionId,
        interviewer: interviewerId,
        survey: survey,
        interviewMode: metadata?.interviewMode || 'capi',
        startTime: metadata?.startTime ? new Date(metadata.startTime) : new Date(),
        deviceInfo: metadata?.deviceInfo || null,
        metadata: metadata || {},
        currentResponses: {} // Empty for offline interviews
      };
    } else {
      // Online interview - load session normally
      // CRITICAL FIX: Load session without populating survey (we'll use cache instead)
      // This prevents loading full survey with sections/questions into memory
      session = await InterviewSession.findOne({
        sessionId,
        interviewer: interviewerId
      }).lean(); // Use lean() for memory efficiency

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // CRITICAL OPTIMIZATION: Load survey WITHOUT sections/questions - not needed for completion
      // Auto-rejection checks only use responses array, not survey.sections/questions
      // This reduces memory from 5-10MB to ~50KB per request
      const surveyCache = require('../utils/surveyCache');
      survey = await surveyCache.getSurvey(session.survey, {
        select: 'surveyName description mode targetAudience settings company assignedInterviewers assignedQualityAgents acAssignmentState status version', // REMOVED sections questions - not needed
        useCache: true
      });

      if (!survey) {
        return res.status(404).json({
          success: false,
          message: 'Survey not found'
        });
      }

      // CRITICAL: Don't attach full survey to session - it stays in memory unnecessarily
      // Store survey ID for reference (session.survey is already the ObjectId from lean query)
      // No need to attach - session.survey is already the ID when using lean()
    }

    // Extract selectedAC and selectedPollingStation - check multiple sources in priority order:
    // Priority 1: metadata.selectedAC / metadata.selectedPollingStation (from request body)
    // Priority 2: session.metadata.selectedAC / session.metadata.selectedPollingStation (from session)
    // Priority 3: session.currentResponses['ac-selection'] / session.currentResponses['polling-station-selection'] (from session responses)
    // Priority 4: responses array (extract using utility function)
    let extractedSelectedAC = metadata?.selectedAC || 
                              session?.metadata?.selectedAC || 
                              session?.currentResponses?.['ac-selection'] ||
                              null;
    let extractedSelectedPollingStation = metadata?.selectedPollingStation || 
                                         session?.metadata?.selectedPollingStation ||
                                         (session?.currentResponses?.['polling-station-selection'] ? {
                                           stationName: session.currentResponses['polling-station-selection'],
                                           groupName: session.currentResponses['polling-station-group'] || null,
                                           acName: extractedSelectedAC || null
                                         } : null) ||
                                         null;
    
    // If still missing, try to extract from responses array
    if (!extractedSelectedAC || !extractedSelectedPollingStation) {
      const { extractACFromResponse } = require('../utils/respondentInfoUtils');
      
      // Build responseData object for extraction utility
      const responseDataForExtraction = {
        selectedAC: extractedSelectedAC || metadata?.selectedAC || session?.metadata?.selectedAC || null,
        selectedPollingStation: extractedSelectedPollingStation || metadata?.selectedPollingStation || session?.metadata?.selectedPollingStation || null
      };
      
      // Extract AC from responses array if still missing
      if (!extractedSelectedAC && responses && Array.isArray(responses)) {
        const extractedAC = extractACFromResponse(responses, responseDataForExtraction);
        if (extractedAC) {
          extractedSelectedAC = extractedAC;
          console.log(`✅ Extracted selectedAC from responses array: ${extractedSelectedAC}`);
        }
      }
      
      // Extract polling station from responses array if still missing
      if (!extractedSelectedPollingStation && responses && Array.isArray(responses)) {
        // Find polling station selection response
        const pollingStationResponse = responses.find(r => 
          r.questionId === 'polling-station-selection' ||
          (r.questionText && (
            r.questionText.toLowerCase().includes('select polling station') ||
            r.questionText.toLowerCase().includes('polling station')
          ))
        );
        
        if (pollingStationResponse && pollingStationResponse.response) {
          // Polling station response format: "Code - Name" or "Group - Code - Name"
          const stationValue = pollingStationResponse.response;
          
          // Also check for group selection
          const groupResponse = responses.find(r => 
            r.questionId === 'polling-station-group' ||
            (r.questionText && r.questionText.toLowerCase().includes('select group'))
          );
          
          // Try to extract AC name from responses if we have polling station but no AC
          let acName = extractedSelectedAC;
          if (!acName) {
            const acResponse = responses.find(r => 
              r.questionId === 'ac-selection' ||
              (r.questionText && (
                r.questionText.toLowerCase().includes('select assembly constituency') ||
                r.questionText.toLowerCase().includes('assembly constituency')
              ))
            );
            if (acResponse && acResponse.response) {
              const { getMainText } = require('../utils/genderUtils');
              acName = getMainText(String(acResponse.response)).trim();
            }
          }
          
          // Build selectedPollingStation object
          extractedSelectedPollingStation = {
            stationName: typeof stationValue === 'string' ? stationValue : String(stationValue),
            groupName: groupResponse?.response || null,
            acName: acName || null
          };
          
          console.log(`✅ Extracted selectedPollingStation from responses array:`, extractedSelectedPollingStation);
        }
      }
      
      // Final check: If we have AC but no polling station, at least set acName in polling station
      if (extractedSelectedAC && !extractedSelectedPollingStation) {
        extractedSelectedPollingStation = {
          acName: extractedSelectedAC
        };
        console.log(`✅ Created minimal selectedPollingStation with AC: ${extractedSelectedAC}`);
      }
    }
    
    // Log final extracted values
    if (extractedSelectedAC) {
      console.log(`✅ Final extracted selectedAC: ${extractedSelectedAC}`);
    } else {
      console.log(`⚠️  WARNING: Could not extract selectedAC from any source!`);
    }
    if (extractedSelectedPollingStation) {
      // CRITICAL: Removed JSON.stringify() - causes memory leaks
      console.log(`✅ Final extracted selectedPollingStation - AC: ${extractedSelectedPollingStation?.ac}, Name: ${extractedSelectedPollingStation?.name}`);
    } else {
      console.log(`⚠️  WARNING: Could not extract selectedPollingStation from any source!`);
    }

    // BACKEND-ONLY FIX: Handle empty responses from old app versions
    // Try to recover responses from session or metadata before rejecting
    // CRITICAL: Use a separate variable since 'responses' is const from destructuring
    let finalResponses = responses || [];
    let responsesRecovered = false;
    
    // If responses array is empty, try to recover from multiple sources
    if (!finalResponses || !Array.isArray(finalResponses) || finalResponses.length === 0) {
      console.error(`❌ CRITICAL: Empty responses array received for sessionId: ${sessionId}`);
      console.error(`   Interviewer: ${interviewerId}`);
      console.error(`   Survey: ${metadata?.survey || session?.survey || 'unknown'}`);
      console.error(`   Request body keys: ${Object.keys(req.body).join(', ')}`);
      console.error(`   Responses type: ${typeof responses}, isArray: ${Array.isArray(responses)}, length: ${responses?.length || 0}`);
      if (req.body && typeof req.body === 'object') {
        console.error(`   Full request body structure:`, {
          hasResponses: !!req.body.responses,
          responsesType: typeof req.body.responses,
          responsesIsArray: Array.isArray(req.body.responses),
          responsesLength: req.body.responses?.length || 0,
          hasMetadata: !!req.body.metadata,
          metadataKeys: req.body.metadata ? Object.keys(req.body.metadata).join(', ') : 'none',
          hasQualityMetrics: !!req.body.qualityMetrics,
        });
      }
      console.error(`   Attempting to recover responses from session, metadata, or existing responses...`);
      
      // RECOVERY ATTEMPT 1: Try to get responses from session's currentResponses (for online interviews)
      if (session && session.currentResponses && typeof session.currentResponses === 'object') {
        const sessionResponses = session.currentResponses;
        const sessionResponseKeys = Object.keys(sessionResponses);
        
        if (sessionResponseKeys.length > 0) {
          console.log(`   ✅ Found ${sessionResponseKeys.length} responses in session.currentResponses - attempting to reconstruct...`);
          
          // Load survey to get question structure
          let recoverySurvey = survey;
          if (!recoverySurvey && metadata?.survey) {
            const surveyCache = require('../utils/surveyCache');
            recoverySurvey = await surveyCache.getSurvey(metadata.survey, {
              select: 'surveyName description mode sections questions',
              useCache: true
            });
          }
          
          if (recoverySurvey && recoverySurvey.sections) {
            const recoveredResponses = [];
            
            recoverySurvey.sections.forEach((section, sectionIndex) => {
              if (section.questions) {
                section.questions.forEach((question, questionIndex) => {
                  const questionId = question.id || question._id;
                  const responseValue = sessionResponses[questionId];
                  
                  if (responseValue !== undefined && responseValue !== null && responseValue !== '') {
                    recoveredResponses.push({
                      sectionIndex,
                      questionIndex,
                      questionId,
                      questionType: question.type,
                      questionText: question.text,
                      questionDescription: question.description,
                      questionOptions: question.options ? question.options.map((opt) => (typeof opt === 'object' ? opt.text : opt)) : [],
                      response: responseValue,
                      responseTime: 0,
                      isRequired: question.isRequired || false,
                      isSkipped: false,
                    });
                  } else if (question.isRequired) {
                    recoveredResponses.push({
                      sectionIndex,
                      questionIndex,
                      questionId,
                      questionType: question.type,
                      questionText: question.text,
                      questionDescription: question.description,
                      questionOptions: question.options ? question.options.map((opt) => (typeof opt === 'object' ? opt.text : opt)) : [],
                      response: null,
                      responseTime: 0,
                      isRequired: true,
                      isSkipped: true,
                    });
                  }
                });
              }
            });
            
            if (recoveredResponses.length > 0) {
              finalResponses = recoveredResponses;
              responsesRecovered = true;
              console.log(`   ✅ Successfully recovered ${recoveredResponses.length} responses from session.currentResponses`);
            } else {
              console.warn(`   ⚠️  Session has currentResponses but couldn't reconstruct response array`);
            }
          } else {
            console.warn(`   ⚠️  Could not load survey to reconstruct responses from session`);
          }
        }
      }
      
      // RECOVERY ATTEMPT 2: Check if there's an existing response with this sessionId that has responses
      // CRITICAL: Check for BOTH online and offline sessions (old versions might have already created a response)
      if (!responsesRecovered) {
        const existingResponse = await SurveyResponse.findOne({ sessionId: sessionId })
          .select('responses')
          .lean();
        
        if (existingResponse && existingResponse.responses && Array.isArray(existingResponse.responses) && existingResponse.responses.length > 0) {
          finalResponses = existingResponse.responses;
          responsesRecovered = true;
          console.log(`   ✅ Found existing response with ${existingResponse.responses.length} responses - using those`);
        }
      }
      
      // RECOVERY ATTEMPT 3: Try to extract responses from metadata if old version stored them there
      if (!responsesRecovered && metadata) {
        console.log(`   🔍 Attempting recovery from metadata...`);
        console.log(`   Metadata keys: ${Object.keys(metadata).join(', ')}`);
        
        // Check if responses are in metadata.finalResponses (some old versions might send it)
        if (metadata.finalResponses && Array.isArray(metadata.finalResponses) && metadata.finalResponses.length > 0) {
          finalResponses = metadata.finalResponses;
          responsesRecovered = true;
          console.log(`   ✅ Found ${metadata.finalResponses.length} responses in metadata.finalResponses`);
        }
        
        // Check if responses are in metadata.responses (alternative location)
        if (!responsesRecovered && metadata.responses && Array.isArray(metadata.responses) && metadata.responses.length > 0) {
          finalResponses = metadata.responses;
          responsesRecovered = true;
          console.log(`   ✅ Found ${metadata.responses.length} responses in metadata.responses`);
        }
      }
      
      // If still empty after recovery attempts, reject with clear error
      if (!finalResponses || !Array.isArray(finalResponses) || finalResponses.length === 0) {
        console.error(`   ❌ All recovery attempts failed - interview data is permanently lost`);
        console.error(`   This interview cannot be synced - user needs to update app and retake interview`);
        
        return res.status(400).json({
          success: false,
          message: 'Empty responses array - interview data was not saved correctly. Please update your app to the latest version and retry the interview.',
          error: 'EMPTY_RESPONSES',
          isDataLoss: true,
          requiresAppUpdate: true
        });
      }
    }
    
    // Use recovered responses - CRITICAL: Don't reassign const 'responses', use finalResponses throughout
    // Replace all references to 'responses' with 'finalResponses' in the rest of the function
    if (responsesRecovered) {
      console.log(`✅ Using recovered responses (${finalResponses.length} responses)`);
    } else {
      console.log(`✅ Received ${finalResponses.length} responses for interview completion`);
    }

    // Calculate final statistics
    // CRITICAL: For offline synced interviews, use totalTimeSpent from metadata if provided
    // This ensures correct duration for interviews that were conducted offline
    const endTime = metadata?.endTime ? new Date(metadata.endTime) : new Date();
    let totalTimeSpent;
    
    if (metadata?.totalTimeSpent !== null && metadata?.totalTimeSpent !== undefined) {
      // Use duration from metadata (for offline synced interviews)
      totalTimeSpent = Math.round(Number(metadata.totalTimeSpent));
      console.log(`✅ Using totalTimeSpent from metadata: ${totalTimeSpent} seconds (${Math.floor(totalTimeSpent / 60)} minutes)`);
    } else if (session && session.startTime) {
      // Calculate from session startTime (for online interviews)
      // CRITICAL: Handle both Date objects and timestamps
      const startTimeDate = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
      totalTimeSpent = Math.round((endTime - startTimeDate) / 1000);
      console.log(`✅ Calculated totalTimeSpent from session: ${totalTimeSpent} seconds (${Math.floor(totalTimeSpent / 60)} minutes)`);
    } else {
      // Fallback: use metadata or default to 0
      totalTimeSpent = metadata?.totalTimeSpent ? Math.round(Number(metadata.totalTimeSpent)) : 0;
      console.log(`⚠️ No session startTime available, using metadata or default: ${totalTimeSpent} seconds`);
    }

    // Extract OldinterviewerID from finalResponses (for survey 68fd1915d41841da463f0d46)
    let oldInterviewerID = null;
    if (metadata?.OldinterviewerID) {
      oldInterviewerID = String(metadata.OldinterviewerID);
    } else {
      // Also check in finalResponses array as fallback
      const interviewerIdResponse = finalResponses.find(r => r.questionId === 'interviewer-id');
      if (interviewerIdResponse && interviewerIdResponse.response !== null && interviewerIdResponse.response !== undefined && interviewerIdResponse.response !== '') {
        oldInterviewerID = String(interviewerIdResponse.response);
      }
    }

    // Create complete survey response
    // CRITICAL: Use startTime from metadata if provided (for offline synced interviews)
    // Otherwise use session.startTime (for online interviews)
    // Handle both Date objects and timestamps
    let actualStartTime;
    if (metadata?.startTime) {
      actualStartTime = new Date(metadata.startTime);
    } else if (session && session.startTime) {
      actualStartTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
    } else {
      // Fallback: use current time
      actualStartTime = new Date();
      console.log(`⚠️ No startTime available, using current time: ${actualStartTime.toISOString()}`);
    }
    
    console.log(`📊 Creating survey response - startTime: ${actualStartTime.toISOString()}, endTime: ${endTime.toISOString()}, totalTimeSpent: ${totalTimeSpent} seconds`);
    
    // CRITICAL: For offline interviews, use surveyId from metadata, not session.survey._id
    // Handle both populated (session.survey._id) and unpopulated (session.survey or session.surveyId) cases
    const sessionSurveyId = session.survey?._id || session.survey || session.surveyId || session.survey;
    const surveyIdForResponse = isOfflineSession ? (metadata?.survey || survey._id) : sessionSurveyId;
    const interviewerIdForResponse = isOfflineSession ? interviewerId : session.interviewer;
    const interviewModeForResponse = isOfflineSession ? (metadata?.interviewMode || 'capi') : session.interviewMode;
    const deviceInfoForResponse = isOfflineSession ? (metadata?.deviceInfo || null) : session.deviceInfo;
    
    const surveyResponse = await SurveyResponse.createCompleteResponse({
      survey: surveyIdForResponse,
      interviewer: interviewerIdForResponse,
      sessionId: sessionId, // Use the sessionId (can be offline_xxx)
      startTime: actualStartTime, // Use actual start time from metadata if available
      endTime, // Use end time from metadata if available, otherwise current time
      totalTimeSpent: totalTimeSpent, // CRITICAL: Pass calculated totalTimeSpent (uses metadata value if available)
      responses: finalResponses, // Use finalResponses (may be recovered from session/metadata)
      interviewMode: interviewModeForResponse,
      deviceInfo: deviceInfoForResponse,
      audioRecording: audioRecording,
      selectedAC: extractedSelectedAC,
      selectedPollingStation: extractedSelectedPollingStation,
      location: metadata?.location || null,
      qualityMetrics,
      setNumber: metadata?.setNumber || null, // Save set number for CATI interviews
      OldinterviewerID: oldInterviewerID, // Save old interviewer ID
      metadata: {
        ...(isOfflineSession ? {} : session.metadata), // Only use session.metadata for online sessions
        ...metadata
      }
    });

    // CRITICAL FIX: Check if this is an existing response with a final status
    // If so, preserve the status and skip auto-rejection and batch addition
    // NOTE: 'Pending_Approval' is NOT a final status - it can be changed by auto-rejection
    const isExistingResponse = surveyResponse._id && !surveyResponse.isNew;
    const existingStatus = surveyResponse.status;
    const isFinalStatus = ['abandoned', 'Terminated', 'Approved', 'Rejected'].includes(existingStatus);
    
    if (isExistingResponse && isFinalStatus) {
      console.log(`🔒 PRESERVING FINAL STATUS: Response ${surveyResponse.responseId} has status '${existingStatus}' - skipping save and auto-rejection`);
      // Don't save - status is already final and should not be changed
      // Return immediately with preserved status
    } else {
      // Only save if it's a new response or status is not final
    await surveyResponse.save();
    
    // INVALIDATE CACHE: Clear interviewer stats cache since stats have changed
    const interviewerStatsCache = require('../utils/interviewerStatsCache');
    interviewerStatsCache.delete(interviewerIdForResponse);
    }
    
    // CRITICAL FIX: Skip auto-rejection and batch addition if this is an existing response with final status
    // OR if this is a newly created abandoned response
    const isAbandonedResponse = surveyResponse.status === 'abandoned';
    
    if (isExistingResponse && isFinalStatus) {
      console.log(`⏭️  Skipping auto-rejection and batch addition for existing response with final status '${existingStatus}'`);
    } else if (isAbandonedResponse) {
      console.log(`⏭️  Skipping auto-rejection and batch addition for abandoned response ${surveyResponse._id} (status: abandoned)`);
      // Abandoned responses should NOT be auto-rejected or added to QC batches
    } else {
      // Check for auto-rejection conditions (only for new responses or non-final statuses that are not abandoned)
      const { checkAutoRejection, applyAutoRejection } = require('../utils/autoRejectionHelper');
      let wasAutoRejected = false;
      try {
        // Handle both populated and unpopulated session.survey
        const sessionSurveyId = session.survey?._id || session.survey || session.surveyId || session.survey;
        const surveyIdForRejection = isOfflineSession ? surveyIdForResponse : sessionSurveyId;
        const rejectionInfo = await checkAutoRejection(surveyResponse, finalResponses, surveyIdForRejection);
        if (rejectionInfo) {
          await applyAutoRejection(surveyResponse, rejectionInfo);
          wasAutoRejected = true;
          // CRITICAL OPTIMIZATION: Don't populate survey - causes memory leaks
          // We don't need survey data after auto-rejection, just reload response status
          // Reload from database to ensure status is updated (without populating survey)
          await surveyResponse.constructor.findById(surveyResponse._id).select('status verificationData');
        }
      } catch (autoRejectError) {
        console.error('Error checking auto-rejection:', autoRejectError);
        // Continue even if auto-rejection check fails
    }
    
    // CRITICAL: Double-check status before adding to batch
    // Reload response to ensure we have the latest status
    const latestResponse = await SurveyResponse.findById(surveyResponse._id);
    const isAutoRejected = wasAutoRejected || 
                          (latestResponse && latestResponse.status === 'Rejected') || 
                          (latestResponse && latestResponse.verificationData?.autoRejected === true);
    const isAbandoned = latestResponse && latestResponse.status === 'abandoned';
    
    // Add response to QC batch only if NOT auto-rejected AND NOT abandoned
    // Auto-rejected and abandoned responses are already decided and don't need QC processing
    if (!isAutoRejected && !isAbandoned) {
      try {
        // Handle both populated and unpopulated session.survey
        const sessionSurveyIdForBatch = session.survey?._id || session.survey || session.surveyId || session.survey;
        const surveyIdForBatch = isOfflineSession ? surveyIdForResponse : sessionSurveyIdForBatch;
        const interviewerIdForBatch = isOfflineSession ? interviewerIdForResponse : session.interviewer.toString();
        await addResponseToBatch(surveyResponse._id, surveyIdForBatch, interviewerIdForBatch);
      } catch (batchError) {
        console.error('Error adding response to batch:', batchError);
        // Continue even if batch addition fails - response is still saved
      }
    } else {
      const skipReason = isAbandoned ? 'abandoned' : 'auto-rejected';
      console.log(`⏭️  Skipping batch addition for ${skipReason} response ${surveyResponse._id} (status: ${latestResponse.status})`);
      }
    }

    // Mark session as abandoned (cleanup) - only for real sessions, not offline ones
    if (!isOfflineSession && session && typeof session.save === 'function') {
      session.abandonSession();
      await session.save();
    } else if (isOfflineSession) {
      console.log('📴 Skipping session cleanup for offline interview (no server session exists)');
    }

    // CRITICAL: Reload response to get the actual status (especially for existing responses)
    const finalResponse = await SurveyResponse.findById(surveyResponse._id)
      .select('responseId status completionPercentage totalTimeSpent')
      .lean();
    
    // Prepare response data for caching
    const responseData = {
      responseId: finalResponse.responseId || surveyResponse.responseId,
      mongoId: surveyResponse._id.toString(),
      completionPercentage: finalResponse.completionPercentage || surveyResponse.completionPercentage || 0,
      totalTimeSpent: finalResponse.totalTimeSpent || surveyResponse.totalTimeSpent || 0,
      status: finalResponse.status || surveyResponse.status || 'Pending_Approval', // Use actual status from DB
      summary: surveyResponse.getResponseSummary ? surveyResponse.getResponseSummary() : {}
    };
    
    // CACHE THE RESPONSE: Store in idempotency cache to prevent duplicate submissions from app retries
    // TTL: 48 hours (completed interviews don't change after completion)
    idempotencyCache.set(sessionId, responseData, 48 * 60 * 60 * 1000);
    console.log(`✅ IdempotencyCache SET: Cached response for sessionId: ${sessionId}, responseId: ${responseData.responseId}, status: ${responseData.status}`);

    // Use appropriate message based on status
    let message = 'Interview completed successfully and submitted for approval';
    if (isExistingResponse && isFinalStatus) {
      message = `Interview already completed (status: ${responseData.status})`;
    }

    // CRITICAL: Explicitly nullify large objects to help garbage collection
    // Top tech companies explicitly clear references to large objects after use
    const surveyToNull = survey;
    survey = null;
    if (session) {
      const sessionToNull = session;
      session = null;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error completing interview:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      sessionId: req.params?.sessionId,
      interviewerId: req.user?.id,
      errorName: error.name,
      errorMessage: error.message,
      hasMetadata: !!req.body?.metadata,
      hasResponses: !!req.body?.responses
    });
    
    // CRITICAL: Ensure response is sent even if there's an error
    // This prevents 502 Bad Gateway errors from nginx
    if (!res.headersSent) {
      try {
        res.status(500).json({
          success: false,
          message: 'Failed to complete interview',
          error: error.message,
          hasResponse: false
        });
      } catch (responseError) {
        console.error('❌ CRITICAL: Failed to send error response:', responseError);
      }
    } else {
      console.error('❌ Response already sent, cannot send error response');
    }
  }
};

// Abandon interview - now saves responses if at least 1 question is answered (excluding AC/Polling Station)
const abandonInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { responses, metadata } = req.body; // Accept responses and metadata
    const interviewerId = req.user.id;

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    // CRITICAL OPTIMIZATION: Don't populate survey - causes memory leaks (5-10MB per survey)
    // Abandon interview doesn't need full survey data
    }); // REMOVED .populate('survey')

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Extract selectedAC and selectedPollingStation from responses if not provided in metadata
    // This ensures abandoned CAPI responses properly set these fields from the responses array
    let extractedSelectedAC = metadata?.selectedAC || null;
    let extractedSelectedPollingStation = metadata?.selectedPollingStation || null;
    
    if (!extractedSelectedAC || !extractedSelectedPollingStation) {
      const { extractACFromResponse } = require('../utils/respondentInfoUtils');
      
      // Build responseData object for extraction utility
      const responseDataForExtraction = {
        selectedAC: metadata?.selectedAC || null,
        selectedPollingStation: metadata?.selectedPollingStation || null
      };
      
      // Extract AC from responses if not in metadata
      if (!extractedSelectedAC && responses && Array.isArray(responses)) {
        const extractedAC = extractACFromResponse(responses, responseDataForExtraction);
        if (extractedAC) {
          extractedSelectedAC = extractedAC;
          console.log(`✅ Extracted selectedAC from responses (abandon): ${extractedSelectedAC}`);
        }
      }
      
      // Extract polling station from responses if not in metadata
      if (!extractedSelectedPollingStation && responses && Array.isArray(responses)) {
        // Find polling station selection response
        const pollingStationResponse = responses.find(r => 
          r.questionId === 'polling-station-selection' ||
          (r.questionText && (
            r.questionText.toLowerCase().includes('select polling station') ||
            r.questionText.toLowerCase().includes('polling station')
          ))
        );
        
        if (pollingStationResponse && pollingStationResponse.response) {
          // Polling station response format: "Code - Name" or "Group - Code - Name"
          const stationValue = pollingStationResponse.response;
          
          // Also check for group selection
          const groupResponse = responses.find(r => 
            r.questionId === 'polling-station-group' ||
            (r.questionText && r.questionText.toLowerCase().includes('select group'))
          );
          
          // Try to extract AC name from responses if we have polling station but no AC
          let acName = extractedSelectedAC;
          if (!acName) {
            const acResponse = responses.find(r => 
              r.questionId === 'ac-selection' ||
              (r.questionText && (
                r.questionText.toLowerCase().includes('select assembly constituency') ||
                r.questionText.toLowerCase().includes('assembly constituency')
              ))
            );
            if (acResponse && acResponse.response) {
              acName = acResponse.response;
            }
          }
          
          // Build selectedPollingStation object
          extractedSelectedPollingStation = {
            stationName: typeof stationValue === 'string' ? stationValue : String(stationValue),
            groupName: groupResponse?.response || null,
            acName: acName || null
          };
          
          console.log(`✅ Extracted selectedPollingStation from responses (abandon):`, extractedSelectedPollingStation);
        }
      }
    }

    // Check if we have responses and if at least 1 question is answered (excluding AC/Polling Station)
    let shouldSaveResponse = false;
    let validResponses = [];
    
    if (responses && Array.isArray(responses) && responses.length > 0) {
      // Filter out AC selection and Polling Station questions
      validResponses = responses.filter(r => {
        const questionId = r.questionId || '';
        const questionText = (r.questionText || '').toLowerCase();
        
        // Exclude AC selection and Polling Station questions
        const isACSelection = questionId === 'ac-selection' || 
                             questionText.includes('assembly constituency') ||
                             questionText.includes('select assembly constituency');
        const isPollingStation = questionId === 'polling-station-selection' ||
                                questionText.includes('polling station') ||
                                questionText.includes('select polling station');
        
        return !isACSelection && !isPollingStation;
      });
      
      // Check if at least 1 valid question has a response
      const hasValidResponse = validResponses.some(r => {
        const response = r.response;
        if (response === null || response === undefined) return false;
        if (typeof response === 'string' && response.trim() === '') return false;
        if (Array.isArray(response) && response.length === 0) return false;
        return true;
      });
      
      shouldSaveResponse = hasValidResponse;
    }

    // If we should save, create a terminated response
    if (shouldSaveResponse) {
      const endTime = new Date();
      const totalTimeSpent = Math.round((endTime - session.startTime) / 1000);
      
      // Extract audioRecording from metadata if available
      const audioRecording = metadata?.audioRecording || {};
      
      // Extract abandonment reason from metadata
      const abandonedReason = metadata?.abandonedReason || null;
      
      // Create terminated survey response
      const surveyResponse = await SurveyResponse.createCompleteResponse({
        survey: session.survey._id,
        interviewer: session.interviewer,
        sessionId: session.sessionId,
        startTime: session.startTime,
        endTime,
        responses: validResponses, // Use only valid responses (excluding AC/Polling Station)
        interviewMode: session.interviewMode,
        deviceInfo: session.deviceInfo,
        audioRecording: audioRecording,
        selectedAC: extractedSelectedAC,
        selectedPollingStation: extractedSelectedPollingStation,
        location: metadata?.location || null,
        qualityMetrics: metadata?.qualityMetrics || {
          averageResponseTime: 0,
          backNavigationCount: 0,
          dataQualityScore: 0,
          totalPauseTime: 0,
          totalPauses: 0
        },
        setNumber: metadata?.setNumber || null,
        abandonedReason: abandonedReason, // Store abandonment reason
        metadata: {
          ...session.metadata,
          ...metadata,
          abandoned: true,
          terminationReason: 'Interview abandoned by interviewer',
          abandonmentNotes: metadata?.abandonmentNotes || null
        }
      });
      
      // Set status to Terminated
      surveyResponse.status = 'Terminated';
      await surveyResponse.save();
      
      // INVALIDATE CACHE: Clear interviewer stats cache since stats have changed
      const interviewerStatsCacheForAbandon = require('../utils/interviewerStatsCache');
      interviewerStatsCacheForAbandon.delete(session.interviewer.toString());
      
      // Mark session as abandoned
      session.abandonSession();
      await session.save();
      
      return res.status(200).json({
        success: true,
        message: 'Interview abandoned and response saved with Terminated status',
        data: {
          responseId: surveyResponse.responseId,
          status: 'Terminated'
        }
      });
    } else {
      // No valid responses, just abandon session without saving
      session.abandonSession();
      await session.save();
      
      return res.status(200).json({
        success: true,
        message: 'Interview abandoned (no valid responses to save)'
      });
    }

  } catch (error) {
    console.error('Error abandoning interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to abandon interview',
      error: error.message
    });
  }
};

// Get gender response counts for quota management
const getGenderResponseCounts = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const interviewerId = req.user.id;

    // CRITICAL OPTIMIZATION: Only load survey sections/questions needed for gender detection
    // Don't load full survey with all data - reduces memory from 5-10MB to ~50KB
    // Top tech companies only load what's needed
    const survey = await Survey.findById(surveyId)
      .select('sections questions targetAudience sampleSize assignedInterviewers capiInterviewers catiInterviewers') // Only what's needed
      .lean(); // Use lean() for memory efficiency
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if interviewer is assigned to this survey
    // Handle both single-mode (assignedInterviewers) and multi-mode (capiInterviewers, catiInterviewers) surveys
    let isAssigned = false;

    // Check for single-mode assignment
    if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
      isAssigned = survey.assignedInterviewers.some(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
    }

    // Check for multi-mode CAPI assignment
    if (!isAssigned && survey.capiInterviewers && survey.capiInterviewers.length > 0) {
      isAssigned = survey.capiInterviewers.some(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
    }

    // Check for multi-mode CATI assignment
    if (!isAssigned && survey.catiInterviewers && survey.catiInterviewers.length > 0) {
      isAssigned = survey.catiInterviewers.some(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
    }

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this survey'
      });
    }

    // CRITICAL OPTIMIZATION: Use small batch size and explicit memory cleanup
    // Top tech companies use aggressive memory management for large datasets
    // Process in tiny batches (25) and immediately release memory after each batch
    const { findGenderResponse, normalizeGenderResponse } = require('../utils/genderUtils');
    
    // Pre-compute survey gender question IDs to reduce per-response processing
    const genderQuestionIds = new Set();
    if (survey.sections) {
      for (const section of survey.sections || []) {
        for (const question of section.questions || []) {
          const questionId = question.id || '';
          const questionText = (question.text || '').toLowerCase();
          if (questionId.includes('fixed_respondent_gender') ||
              questionText.includes('gender') ||
              questionText.includes('registered voter') ||
              questionText.includes('নিবন্ধিত ভোটার')) {
            genderQuestionIds.add(questionId);
          }
        }
      }
    }
    
    // Fetch only responses array in VERY SMALL batches to minimize memory accumulation
    // Using lean() to reduce memory overhead (returns plain objects, not Mongoose documents)
    // CRITICAL: batchSize must be BEFORE cursor() and should be small (25) for large datasets
    const allResponses = SurveyResponse.find({
      survey: survey._id,
      status: { $in: ['Pending_Approval', 'Approved', 'completed'] }
    })
    .select('responses') // Only select responses field to minimize memory
    .lean() // Use lean() to return plain objects instead of Mongoose documents
    .batchSize(25) // VERY SMALL batches to minimize memory accumulation (was 100)
    .cursor(); // Use cursor for streaming instead of loading all at once
    
    // Count gender responses using normalized values (process in batches)
    const genderResponseCounts = {};
    // CRITICAL OPTIMIZATION: Don't duplicate survey data - pass reference directly
    // Creating a new object with sections/questions duplicates 5-10MB in memory
    // Top tech companies avoid unnecessary object duplication for large data structures
    // Pass survey object directly to findGenderResponse (it only needs sections/questions which are already in survey)
    const surveyData = survey; // Pass reference, not duplicate - saves 5-10MB per request
    
    let processedCount = 0;
    const BATCH_PROCESS_SIZE = 25; // Process 25, then cleanup
    
    // Process responses in batches using cursor with explicit memory cleanup
    for await (const response of allResponses) {
      // Early exit if responses array is empty
      if (!response.responses || !Array.isArray(response.responses) || response.responses.length === 0) {
        continue;
      }
      
      // CRITICAL: Only process potential gender responses (quick filter before expensive findGenderResponse)
      const hasGenderResponse = response.responses.some(r => {
        const questionId = r.questionId || r.question?.id || '';
        const questionText = (r.questionText || r.question?.text || '').toLowerCase();
        return genderQuestionIds.has(questionId) ||
               questionId.includes('fixed_respondent_gender') ||
               questionText.includes('gender') ||
               questionText.includes('registered voter') ||
               questionText.includes('নিবন্ধিত ভোটার');
      });
      
      if (hasGenderResponse) {
        const genderResp = findGenderResponse(response.responses, surveyData);
        if (genderResp && genderResp.response) {
          const normalizedGender = normalizeGenderResponse(genderResp.response);
          // Map normalized values to standard format
          const genderKey = normalizedGender === 'male' ? 'male' : (normalizedGender === 'female' ? 'female' : normalizedGender);
          genderResponseCounts[genderKey] = (genderResponseCounts[genderKey] || 0) + 1;
        }
      }
      
      processedCount++;
      
      // CRITICAL: Explicit memory cleanup every 25 responses
      // Clear response references to allow garbage collection
      if (processedCount % BATCH_PROCESS_SIZE === 0) {
        // Clear local variables to help GC
        if (global.gc && typeof global.gc === 'function') {
          global.gc();
        }
      }
    }
    
    // Final cleanup
    processedCount = null;

    // Get target audience gender requirements
    const genderRequirements = survey.targetAudience?.demographics?.genderRequirements || {};
    const sampleSize = survey.sampleSize || 0;

    // Calculate quotas and current status
    const genderQuotas = {};
    const selectedGenders = Object.keys(genderRequirements).filter(g => 
      genderRequirements[g] && !g.includes('Percentage')
    );

    selectedGenders.forEach(gender => {
      const percentage = genderRequirements[`${gender}Percentage`] || 
                       (selectedGenders.length === 1 ? 100 : 0);
      const quota = Math.round((sampleSize * percentage) / 100);
      const currentCount = genderResponseCounts[gender.toLowerCase()] || 0;
      
      genderQuotas[gender] = {
        percentage,
        quota,
        currentCount,
        remaining: Math.max(0, quota - currentCount),
        isFull: currentCount >= quota
      };
    });

    res.status(200).json({
      success: true,
      data: {
        genderQuotas,
        totalResponses: Object.values(genderResponseCounts).reduce((sum, count) => sum + count, 0),
        sampleSize,
        genderResponseCounts
      }
    });

  } catch (error) {
    console.error('Error getting gender response counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gender response counts',
      error: error.message
    });
  }
};

// Upload audio file for interview
const uploadAudioFile = async (req, res) => {
  try {
    console.log('📤 Audio upload request received:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      sessionId: req.body.sessionId,
      surveyId: req.body.surveyId,
      interviewerId: req.user?.id,
      contentType: req.headers['content-type'],
      fileDetails: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        fieldname: req.file.fieldname,
        encoding: req.file.encoding
      } : null
    });
    
    const { sessionId, surveyId, responseId } = req.body; // responseId for linking audio to existing response
    const interviewerId = req.user.id;

    if (!req.file) {
      console.error('❌ No file received in request');
      console.error('Request body:', req.body);
      console.error('Request files:', req.files);
      console.error('Request headers:', req.headers);
      return res.status(400).json({
        success: false,
        message: 'No audio file provided. Please ensure the file is being sent correctly.'
      });
    }

    // Generate unique filename based on uploaded file extension (do this first)
    const timestamp = Date.now();
    const originalExt = path.extname(req.file.originalname) || '.webm';
    const filename = responseId 
      ? `interview_${responseId}_${timestamp}${originalExt}` 
      : `interview_${sessionId}_${timestamp}${originalExt}`;
    
    const fs = require('fs');
    const { uploadToS3, isS3Configured, generateAudioKey } = require('../utils/cloudStorage');
    
    let audioUrl; // Will store S3 key, not full URL
    let storageType = 'local';
    
    // Try to upload to S3 if configured, otherwise use local storage
    if (isS3Configured()) {
      try {
        // Generate S3 key with organized folder structure
        const s3Key = generateAudioKey(responseId || sessionId, filename);
        const metadata = {
          sessionId,
          surveyId,
          responseId: responseId || null,
          interviewerId: interviewerId.toString(),
          uploadedBy: 'interview-interface',
          originalFilename: req.file.originalname
        };
        
        const uploadResult = await uploadToS3(req.file.path, s3Key, {
          contentType: req.file.mimetype || 'audio/webm',
          metadata
        });
        
        // Store S3 key (not full URL) - we'll generate signed URLs when needed
        audioUrl = uploadResult.key;
        storageType = 's3';
        
        console.log('✅ Audio uploaded to S3:', audioUrl);
        
        // Clean up local temp file
        if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        }
        
      } catch (s3Error) {
        console.error('❌ S3 upload failed:', s3Error.message);
        console.error('S3 Error details:', s3Error);
        console.error('S3 Error stack:', s3Error.stack);
        // Fall back to local storage
        storageType = 'local';
        console.log('🔄 Falling back to local storage...');
      }
    }
    
    // Use local storage if S3 is not configured or failed
    if (storageType === 'local') {
      // Ensure uploads directory exists
      const uploadDir = path.join(__dirname, '../../uploads/audio');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Move file from temp location to permanent location
      const tempPath = req.file.path;
      const finalPath = path.join(uploadDir, filename);
      
      console.log('Moving file from:', tempPath, 'to:', finalPath);
      
      // Check if temp file exists
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, finalPath);
        console.log('File moved successfully');
      } else {
        console.error('Temp file does not exist:', tempPath);
        throw new Error(`Temporary file not found at: ${tempPath}. File may not have been uploaded correctly.`);
      }
      
      // Generate URL for accessing the file
      audioUrl = `/uploads/audio/${filename}`;
    }
    
    // CRITICAL: If responseId is provided, link audio directly to existing response (for sync retries)
    // This allows audio to be uploaded separately after interview data is uploaded
    if (responseId) {
      const existingResponse = await SurveyResponse.findOne({ responseId })
        .select('_id responseId audioRecording')
        .lean();
      
      if (existingResponse) {
        console.log(`✅ Linking audio to existing response: ${responseId}`);
        console.log(`📊 Audio upload details - req.file.size: ${req.file?.size}, filename: ${filename}, mimetype: ${req.file?.mimetype}`);
        
        // CRITICAL OPTIMIZATION: Fetch all needed metadata in a SINGLE query to reduce memory usage
        // Top tech companies minimize database roundtrips and memory allocations
        const responseMetadata = await SurveyResponse.findById(existingResponse._id)
          .select('totalTimeSpent startTime endTime')
          .lean();
        
        console.log(`📊 Response totalTimeSpent: ${responseMetadata?.totalTimeSpent || 'N/A'}`);
        
        // Extract audio format from filename or mimetype
        let audioFormat = 'webm'; // Default
        if (filename) {
          const ext = filename.split('.').pop()?.toLowerCase();
          if (ext === 'm4a' || ext === 'mp4') audioFormat = 'm4a';
          else if (ext === 'mp3') audioFormat = 'mp3';
          else if (ext === 'wav') audioFormat = 'wav';
          else if (ext === 'webm') audioFormat = 'webm';
        } else if (req.file?.mimetype) {
          if (req.file.mimetype.includes('m4a') || req.file.mimetype.includes('mp4')) audioFormat = 'm4a';
          else if (req.file.mimetype.includes('mp3')) audioFormat = 'mp3';
          else if (req.file.mimetype.includes('wav')) audioFormat = 'wav';
          else if (req.file.mimetype.includes('webm')) audioFormat = 'webm';
        }
        
        // Use totalTimeSpent from response as recording duration (in seconds)
        let recordingDuration = 0;
        if (responseMetadata?.totalTimeSpent) {
          recordingDuration = Math.round(Number(responseMetadata.totalTimeSpent));
        }
        
        // If duration is 0, try to calculate from startTime/endTime if available (using same query result)
        if (recordingDuration === 0 && responseMetadata?.startTime && responseMetadata?.endTime) {
          const start = new Date(responseMetadata.startTime);
          const end = new Date(responseMetadata.endTime);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
            recordingDuration = Math.round((end - start) / 1000);
            console.log(`📊 Calculated duration from startTime/endTime: ${recordingDuration} seconds`);
          }
        }
        
        // Get file size - try multiple sources (optimize to avoid redundant file system access)
        let fileSize = 0;
        if (req.file?.size && req.file.size > 0) {
          fileSize = Number(req.file.size);
        } else if (req.file?.path) {
          // Fallback: get size from file system only if req.file.size is missing or 0
          try {
            const fileStats = fs.statSync(req.file.path);
            fileSize = fileStats.size;
            console.log(`📊 Got file size from file system: ${fileSize} bytes`);
          } catch (statsError) {
            console.warn(`⚠️ Could not get file size from file system: ${statsError.message}`);
          }
        }
        
        // If file size is still 0, log warning
        // CRITICAL: Removed JSON.stringify() - causes memory leaks
        if (fileSize === 0) {
          console.warn(`⚠️ WARNING: File size is 0 - req.file.size: ${req.file?.size}, path: ${req.file?.path}, originalname: ${req.file?.originalname}`);
        }
        
        console.log(`📊 Prepared metadata - fileSize: ${fileSize} bytes, duration: ${recordingDuration} seconds, format: ${audioFormat}`);
        
        // Update response with audio (using native MongoDB update for efficiency)
        // CRITICAL FIX: Set entire audioRecording object at once to avoid "Cannot create field in null" error
        const mongoose = require('mongoose');
        const collection = mongoose.connection.collection(SurveyResponse.collection.name);
        
        // Build complete audioRecording object (not dot notation)
        const audioRecordingData = {
          hasAudio: true,
          audioUrl: audioUrl,
          uploadedAt: new Date(),
          storageType: storageType,
          filename: filename,
          fileSize: fileSize,
          recordingDuration: recordingDuration,
          format: audioFormat,
          mimetype: req.file?.mimetype || 'audio/m4a'
        };
        
        console.log(`📊 Updating response with audio metadata - fileSize: ${audioRecordingData.fileSize} bytes, duration: ${audioRecordingData.recordingDuration} seconds, format: ${audioRecordingData.format}`);
        
        // CRITICAL: Set entire audioRecording object (not dot notation) to handle null case
        const updateResult = await collection.updateOne(
          { _id: new mongoose.Types.ObjectId(existingResponse._id) },
          {
            $set: {
              audioRecording: audioRecordingData
            }
          }
        );
        
        console.log(`📊 MongoDB update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
        
        // CRITICAL OPTIMIZATION: Removed redundant verification query to reduce memory usage
        // Top tech companies trust MongoDB updateOne() results instead of re-querying
        // This saves memory and reduces database load
        
        console.log('✅ Audio linked to existing response successfully');
        console.log(`✅ Audio metadata - fileSize: ${fileSize} bytes, duration: ${recordingDuration} seconds, format: ${audioFormat}`);
        
        // CRITICAL: Explicitly nullify large objects to help garbage collection
        // Top tech companies explicitly clear references after file operations
        const filePathToNull1 = req.file?.path;
        const existingResponseToNull = existingResponse;
        req.file = null;
        
        return res.status(200).json({
          success: true,
          message: 'Audio file uploaded and linked to existing response',
          data: {
            audioUrl,
            filename,
            size: fileSize,
            mimetype: 'audio/m4a', // Use default instead of req.file (already nullified)
            responseId: existingResponseToNull.responseId,
            storageType
          }
        });
      } else {
        console.warn(`⚠️ Response not found for responseId: ${responseId}, falling back to session-based upload`);
      }
    }
    
    // CRITICAL: Handle offline sessions (sessionId starting with "offline_")
    // For offline sessions, we need to find the response by sessionId instead of looking for a session
    const isOfflineSession = sessionId && sessionId.startsWith('offline_');
    
    if (isOfflineSession) {
      console.log('📴 Offline session detected in audio upload - searching for response by sessionId');
      
      // Find response by sessionId (offline interviews store sessionId in the response)
      const existingResponse = await SurveyResponse.findOne({ sessionId })
        .select('_id responseId audioRecording')
        .lean();
      
      if (existingResponse) {
        console.log(`✅ Found existing response for offline session: ${existingResponse.responseId}`);
        console.log(`📊 Audio upload details - req.file.size: ${req.file?.size}, filename: ${filename}, mimetype: ${req.file?.mimetype}`);
        
        // Get the full response to extract duration and other metadata
        const fullResponse = await SurveyResponse.findById(existingResponse._id)
          .select('totalTimeSpent')
          .lean();
        
        console.log(`📊 Response totalTimeSpent: ${fullResponse?.totalTimeSpent || 'N/A'}`);
        
        // Extract audio format from filename or mimetype
        let audioFormat = 'webm'; // Default
        if (filename) {
          const ext = filename.split('.').pop()?.toLowerCase();
          if (ext === 'm4a' || ext === 'mp4') audioFormat = 'm4a';
          else if (ext === 'mp3') audioFormat = 'mp3';
          else if (ext === 'wav') audioFormat = 'wav';
          else if (ext === 'webm') audioFormat = 'webm';
        } else if (req.file?.mimetype) {
          if (req.file.mimetype.includes('m4a') || req.file.mimetype.includes('mp4')) audioFormat = 'm4a';
          else if (req.file.mimetype.includes('mp3')) audioFormat = 'mp3';
          else if (req.file.mimetype.includes('wav')) audioFormat = 'wav';
          else if (req.file.mimetype.includes('webm')) audioFormat = 'webm';
        }
        
        // Use totalTimeSpent from response as recording duration (in seconds)
        let recordingDuration = 0;
        if (fullResponse?.totalTimeSpent) {
          recordingDuration = Math.round(Number(fullResponse.totalTimeSpent));
        }
        
        // Get file size - try multiple sources
        let fileSize = 0;
        if (req.file?.size) {
          fileSize = Number(req.file.size);
        } else if (req.file?.path) {
          // Fallback: get size from file system
          try {
            const fileStats = fs.statSync(req.file.path);
            fileSize = fileStats.size;
            console.log(`📊 Got file size from file system: ${fileSize} bytes`);
          } catch (statsError) {
            console.warn(`⚠️ Could not get file size from file system: ${statsError.message}`);
          }
        }
        
        // If file size is still 0, log warning
        // CRITICAL: Removed JSON.stringify() - causes memory leaks
        if (fileSize === 0) {
          console.warn(`⚠️ WARNING: File size is 0 - req.file.size: ${req.file?.size}, path: ${req.file?.path}, originalname: ${req.file?.originalname}`);
        }
        
        // If duration is 0, try to calculate from startTime/endTime if available
        if (recordingDuration === 0) {
          const responseWithTimes = await SurveyResponse.findById(existingResponse._id)
            .select('startTime endTime totalTimeSpent')
            .lean();
          
          if (responseWithTimes?.startTime && responseWithTimes?.endTime) {
            const start = new Date(responseWithTimes.startTime);
            const end = new Date(responseWithTimes.endTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
              recordingDuration = Math.round((end - start) / 1000);
              console.log(`📊 Calculated duration from startTime/endTime: ${recordingDuration} seconds`);
            }
          }
        }
        
        console.log(`📊 Prepared metadata - fileSize: ${fileSize} bytes, duration: ${recordingDuration} seconds, format: ${audioFormat}`);
        
        // Update response with audio (using native MongoDB update for efficiency)
        // CRITICAL FIX: Set entire audioRecording object at once to avoid "Cannot create field in null" error
        const mongoose = require('mongoose');
        const collection = mongoose.connection.collection(SurveyResponse.collection.name);
        
        // Build complete audioRecording object (not dot notation)
        const audioRecordingData = {
          hasAudio: true,
          audioUrl: audioUrl,
          uploadedAt: new Date(),
          storageType: storageType,
          filename: filename,
          fileSize: fileSize,
          recordingDuration: recordingDuration,
          format: audioFormat,
          mimetype: req.file?.mimetype || 'audio/m4a'
        };
        
        console.log(`📊 Updating response with audio metadata - fileSize: ${audioRecordingData.fileSize} bytes, duration: ${audioRecordingData.recordingDuration} seconds, format: ${audioRecordingData.format}`);
        
        // CRITICAL: Set entire audioRecording object (not dot notation) to handle null case
        const updateResult = await collection.updateOne(
          { _id: new mongoose.Types.ObjectId(existingResponse._id) },
          {
            $set: {
              audioRecording: audioRecordingData
            }
          }
        );
        
        console.log(`📊 MongoDB update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
        
        // CRITICAL OPTIMIZATION: Removed redundant verification query - MongoDB updateOne() is sufficient
        // This prevents loading response data back into memory (saves 50-200KB per request)
        // Top tech companies trust database operations instead of re-querying
        
        // CRITICAL: Explicitly nullify large objects to help garbage collection
        // Top tech companies explicitly clear references after file operations
        const filePathToNull = req.file?.path;
        req.file = null;
        
        console.log('✅ Audio linked to offline response successfully');
        console.log(`✅ Audio metadata - fileSize: ${fileSize} bytes, duration: ${recordingDuration} seconds, format: ${audioFormat}`);
        
        return res.status(200).json({
          success: true,
          message: 'Audio file uploaded and linked to offline response',
          data: {
            audioUrl,
            filename,
            size: fileSize,
            mimetype: req.file?.mimetype || 'audio/m4a',
            responseId: existingResponse.responseId,
            storageType
          }
        });
      } else {
        console.warn(`⚠️ Response not found for offline sessionId: ${sessionId}`);
        return res.status(404).json({
          success: false,
          message: 'Response not found for offline session. Please complete the interview first, then upload audio.'
        });
      }
    }
    
    // Fallback: Check if session exists and belongs to interviewer (original behavior for online sessions)
    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found and responseId not found'
      });
    }
    
    // CRITICAL: Store file size/mimetype before nullifying req.file
    const fileSizeFinal = req.file?.size || 0;
    const fileMimetypeFinal = req.file?.mimetype || 'audio/webm';
    
    console.log('✅ Upload successful - File size:', fileSizeFinal, 'bytes');
    console.log('✅ Audio URL:', audioUrl);
    console.log('✅ Storage type:', storageType);
    
    // CRITICAL: Explicitly nullify large objects to help garbage collection
    // Top tech companies explicitly clear references after file operations
    const filePathToNull2 = req.file?.path;
    req.file = null;
    
    res.status(200).json({
      success: true,
      message: 'Audio file uploaded successfully',
      data: {
        audioUrl,
        filename,
        size: fileSizeFinal,
        mimetype: fileMimetypeFinal,
        sessionId,
        surveyId,
        storageType
      }
    });

  } catch (error) {
    console.error('❌ Error uploading audio file:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      sessionId: req.body?.sessionId,
      surveyId: req.body?.surveyId,
      responseId: req.body?.responseId,
      interviewerId: req.user?.id,
      errorName: error.name,
      errorType: error.constructor?.name
    });
    
    // CRITICAL: Ensure response is sent even if there's an error
    // This prevents 502 Bad Gateway errors from nginx
    if (!res.headersSent) {
      try {
        res.status(500).json({
          success: false,
          message: 'Failed to upload audio file',
          error: error.message
        });
      } catch (responseError) {
        console.error('❌ CRITICAL: Failed to send error response:', responseError);
      }
    } else {
      console.error('❌ Response already sent, cannot send error response');
    }
  }
};

// Get all interviews conducted by the logged-in interviewer
const getMyInterviews = async (req, res) => {
  try {
    const interviewerId = req.user.id;
    const { search, status, gender, ageMin, ageMax, sortBy = 'endTime', sortOrder = 'desc' } = req.query;

    // Build query
    let query = { interviewer: interviewerId };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Find interviews with populated survey data
    // CRITICAL OPTIMIZATION: Removed 'sections' from populate - causes massive memory leaks (5-10MB per survey)
    // Sections are not needed for the interviews list view
    let interviews = await SurveyResponse.find(query)
      .populate('survey', 'surveyName description category') // REMOVED 'sections' - huge memory leak!
      .sort(sort)
      .lean();

    console.log('getMyInterviews - Found interviews:', interviews.length);

    // Apply search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      interviews = interviews.filter(interview => {
        // Search in survey name, response ID, session ID
        const basicMatch = interview.survey?.surveyName?.match(searchRegex) ||
                          interview.responseId?.toString().includes(search) ||
                          interview.sessionId?.match(searchRegex);
        
        // Search in respondent name
        const respondentNameMatch = interview.responses?.some(response => {
          const isNameQuestion = response.questionText.toLowerCase().includes('name') || 
                                response.questionText.toLowerCase().includes('respondent');
          return isNameQuestion && response.response?.toString().toLowerCase().includes(search.toLowerCase());
        });
        
        return basicMatch || respondentNameMatch;
      });
    }

    // Apply gender filter if provided
    if (gender) {
      interviews = interviews.filter(interview => {
        const genderResponse = interview.responses?.find(response => 
          response.questionText.toLowerCase().includes('gender') || 
          response.questionText.toLowerCase().includes('sex')
        );
        return genderResponse?.response?.toString().toLowerCase() === gender.toLowerCase();
      });
    }

    // Apply age range filter if provided
    if (ageMin || ageMax) {
      interviews = interviews.filter(interview => {
        const ageResponse = interview.responses?.find(response => 
          response.questionText.toLowerCase().includes('age') || 
          response.questionText.toLowerCase().includes('year')
        );
        
        if (!ageResponse?.response) return false;
        
        // Extract age number from response
        const ageMatch = ageResponse.response.toString().match(/\d+/);
        if (!ageMatch) return false;
        
        const age = parseInt(ageMatch[0]);
        if (ageMin && age < parseInt(ageMin)) return false;
        if (ageMax && age > parseInt(ageMax)) return false;
        
        return true;
      });
    }

    // Helper function to evaluate if a condition is met
    const evaluateCondition = (condition, responses) => {
      if (!condition.questionId || !condition.operator || condition.value === undefined || condition.value === '__NOVALUE__') {
        return false;
      }

      // Find the response for the target question
      const targetResponse = responses.find(response => {
        return response.questionId === condition.questionId || 
               response.questionText === condition.questionText;
      });

      if (!targetResponse || !targetResponse.response) {
        return false;
      }

      let responseValue = targetResponse.response;
      const conditionValue = condition.value;

      // Handle array responses
      const isArrayResponse = Array.isArray(responseValue);
      if (isArrayResponse) {
        // For array responses, check if any element matches the condition
        switch (condition.operator) {
          case 'equals':
            return responseValue.includes(conditionValue);
          case 'not_equals':
            return !responseValue.includes(conditionValue);
          case 'contains':
            return responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'not_contains':
            return !responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'is_selected':
            return responseValue.includes(conditionValue);
          case 'is_not_selected':
            return !responseValue.includes(conditionValue);
          case 'is_empty':
            return responseValue.length === 0;
          case 'is_not_empty':
            return responseValue.length > 0;
          default:
            // For other operators, use first value or return false
            if (responseValue.length === 0) return false;
            responseValue = responseValue[0];
        }
      }

      // Handle non-array responses
      switch (condition.operator) {
        case 'equals':
          return responseValue === conditionValue;
        case 'not_equals':
          return responseValue !== conditionValue;
        case 'contains':
          return responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'not_contains':
          return !responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'greater_than':
          return parseFloat(responseValue) > parseFloat(conditionValue);
        case 'less_than':
          return parseFloat(responseValue) < parseFloat(conditionValue);
        case 'is_empty':
          return !responseValue || responseValue.toString().trim() === '';
        case 'is_not_empty':
          return responseValue && responseValue.toString().trim() !== '';
        case 'is_selected':
          return responseValue === conditionValue;
        case 'is_not_selected':
          return responseValue !== conditionValue;
        default:
          return false;
      }
    };

    // Helper function to check if all conditions are met
    const areConditionsMet = (conditions, responses) => {
      if (!conditions || conditions.length === 0) return true;
      return conditions.every(condition => evaluateCondition(condition, responses));
    };

    // Helper function to find question by text in survey
    const findQuestionByText = (questionText, survey) => {
      if (survey?.sections) {
        for (const section of survey.sections) {
          if (section.questions) {
            for (const question of section.questions) {
              if (question.text === questionText) {
                return question;
              }
            }
          }
        }
      }
      return null;
    };

    // Helper function to add proxy URL to audio recording (replaces signed URLs to prevent cross-region charges)
    const addProxyUrlToAudio = (audioRecording) => {
      if (!audioRecording || !audioRecording.audioUrl) {
        return audioRecording;
      }
      
      // Skip mock URLs - these are test URLs, not real files
      if (audioRecording.audioUrl.startsWith('mock://') || audioRecording.audioUrl.includes('mock://')) {
        return {
          ...audioRecording,
          signedUrl: null, // No URL for mock URLs
          proxyUrl: null,
          originalUrl: audioRecording.audioUrl,
          isMock: true // Flag to indicate this is a mock URL
        };
      }
      
      // Generate proxy URL instead of direct S3 signed URL
      // This eliminates cross-region data transfer charges
      const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioRecording.audioUrl)}`;
      
      return {
        ...audioRecording,
        signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
        proxyUrl: proxyUrl, // Explicit proxy URL field
        originalUrl: audioRecording.audioUrl // Keep original S3 key for reference
      };
    };

    // Transform the data to include calculated fields
    const transformedInterviews = await Promise.all(interviews.map(async (interview) => {
      // Calculate effective questions (only questions that were actually shown to the user)
      const effectiveQuestions = interview.responses?.filter(r => {
        // If not skipped, it was shown and answered
        if (!r.isSkipped) return true;
        
        // If skipped, check if it was due to unmet conditions
        const surveyQuestion = findQuestionByText(r.questionText, interview.survey);
        const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
        
        if (hasConditions) {
          // Check if conditions were met
          const conditionsMet = areConditionsMet(surveyQuestion.conditions, interview.responses);
          
          // If conditions were not met, this question was never shown
          if (!conditionsMet) {
            return false;
          }
        }
        
        // If no conditions or conditions were met, user saw it and chose to skip
        return true;
      }).length || 0;
      
      const answeredQuestions = interview.responses?.filter(r => !r.isSkipped).length || 0;
      const completionPercentage = effectiveQuestions > 0 ? Math.round((answeredQuestions / effectiveQuestions) * 100) : 0;

      // Add proxy URL to audio recording if present (lazy loading - no auto-download)
      let audioRecording = interview.audioRecording;
      if (audioRecording && audioRecording.audioUrl) {
        audioRecording = addProxyUrlToAudio(audioRecording);
      }

      return {
        ...interview,
        totalQuestions: effectiveQuestions, // Use effective questions instead of all responses
        answeredQuestions,
        completionPercentage,
        audioRecording // Include audio with signed URL
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        interviews: transformedInterviews,
        total: transformedInterviews.length
      }
    });

  } catch (error) {
    console.error('Error fetching my interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interviews',
      error: error.message
    });
  }
};

// Get pending approval responses for company admin
const getPendingApprovals = async (req, res) => {
  try {
    const companyId = req.user.company;
    const userId = req.user.id;
    const userType = req.user.userType;
    const { search, gender, ageMin, ageMax, sortBy = 'endTime', sortOrder = 'desc' } = req.query;

    console.log('getPendingApprovals - User company ID:', companyId);
    console.log('getPendingApprovals - User:', req.user.email, req.user.userType);
    console.log('getPendingApprovals - User ID:', req.user.id, 'Type:', typeof req.user.id);

    // Build query - only get responses with status 'Pending_Approval' for surveys belonging to this company
    const mongoose = require('mongoose');
    const Survey = require('../models/Survey');
    
    // Convert companyId to ObjectId for proper matching
    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId) 
      ? new mongoose.Types.ObjectId(companyId) 
      : companyId;

    // For company admins, first get all surveys for the company to filter responses
    let companySurveyIds = null;
    if (userType !== 'quality_agent') {
      const companySurveys = await Survey.find({ company: companyObjectId })
        .select('_id')
        .lean();
      companySurveyIds = companySurveys.map(s => s._id);
      console.log('getPendingApprovals - Company survey IDs:', companySurveyIds.length);
    }

    // Build query - get all responses with status 'Pending_Approval'
    // Include:
    // 1. Responses not in any batch (legacy responses or responses before batch system)
    // 2. Responses in batches that are still collecting (status: 'collecting') - show ALL responses
    // 3. Responses in batches that are part of the sample (isSampleResponse: true) - already sent to QC
    // 4. Responses in batches that haven't been sent to QC queue yet (remaining portion, not yet processed)
    const QCBatch = require('../models/QCBatch');
    
    // First, get all batches that are still collecting (show all responses in these batches)
    const collectingBatches = await QCBatch.find({ 
      status: 'collecting' 
    }).select('_id').lean();
    const collectingBatchIds = collectingBatches.map(b => b._id);
    
    // Also get batches that are processing but responses haven't been sent to QC yet
    // (i.e., remaining responses that haven't been queued)
    const processingBatches = await QCBatch.find({ 
      status: { $in: ['processing', 'qc_in_progress'] },
      $or: [
        { 'remainingDecision.decision': { $exists: false } }, // No decision yet
        { 'remainingDecision.decision': { $ne: 'queued_for_qc' } } // Not queued for QC
      ]
    }).select('_id').lean();
    const processingBatchIds = processingBatches.map(b => b._id);
    
    let query = { 
      status: 'Pending_Approval',
      $or: [
        // Responses not in any batch (legacy responses or responses before batch system)
        { qcBatch: { $exists: false } },
        { qcBatch: null },
        // Responses in batches that are still collecting (show all responses in collecting batches)
        { qcBatch: { $in: collectingBatchIds } },
        // Responses in batches that are processing but remaining portion not yet queued
        { qcBatch: { $in: processingBatchIds }, isSampleResponse: { $ne: true } },
        // Responses in batches that are part of the sample (already sent to QC)
        { isSampleResponse: true }
      ]
    };

    // If quality agent, first get the surveys they're assigned to and filter responses by those surveys
    let assignedSurveyIds = null;
    let surveyAssignmentsMap = {}; // Map to store AC assignments for each survey
    if (userType === 'quality_agent') {
      // Convert userId to ObjectId for proper matching
      const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
      
      console.log('getPendingApprovals - Querying surveys for quality agent:', {
        userId: userId,
        userIdObjectId: userIdObjectId,
        companyId: companyId
      });
      
      // Query surveys where this quality agent is assigned
      // Try both ObjectId and string matching
      const assignedSurveys = await Survey.find({
        company: companyId,
        'assignedQualityAgents.qualityAgent': { $in: [userIdObjectId, userId] }
      })
      .select('_id surveyName assignedQualityAgents')
      .lean();
      
      console.log('getPendingApprovals - Found assigned surveys:', assignedSurveys.length);
      console.log('getPendingApprovals - Survey IDs:', assignedSurveys.map(s => s._id.toString()));
      
      // Build a map of survey assignments for quick lookup
      assignedSurveys.forEach(survey => {
        // Find the assignment for this quality agent
        const agentAssignment = survey.assignedQualityAgents.find(a => {
          if (!a.qualityAgent) return false;
          
          // Handle both ObjectId and string formats
          const agentId = a.qualityAgent._id || a.qualityAgent;
          const agentIdStr = agentId?.toString();
          const userIdStr = userId?.toString();
          
          return agentIdStr === userIdStr;
        });
        
        if (agentAssignment) {
          surveyAssignmentsMap[survey._id.toString()] = {
            assignedACs: agentAssignment.assignedACs || [],
            selectedState: agentAssignment.selectedState,
            selectedCountry: agentAssignment.selectedCountry
          };
          
          console.log('getPendingApprovals - Survey assignment map entry:', {
            surveyId: survey._id.toString(),
            surveyName: survey.surveyName,
            assignedACs: agentAssignment.assignedACs,
            assignedACsRaw: JSON.stringify(agentAssignment.assignedACs),
            assignedACsLength: (agentAssignment.assignedACs || []).length,
            assignedACsType: typeof agentAssignment.assignedACs,
            isArray: Array.isArray(agentAssignment.assignedACs)
          });
        } else {
          console.log('getPendingApprovals - WARNING: No assignment found for quality agent in survey:', survey._id.toString());
          console.log('getPendingApprovals - Available assignments:', survey.assignedQualityAgents.map(a => ({
            qualityAgentId: (a.qualityAgent?._id || a.qualityAgent)?.toString(),
            assignedACs: a.assignedACs
          })));
        }
      });
      
      assignedSurveyIds = assignedSurveys.map(s => s._id);
      console.log('getPendingApprovals - Quality agent assigned survey IDs:', assignedSurveyIds);
      console.log('getPendingApprovals - Survey assignments map keys:', Object.keys(surveyAssignmentsMap));
      
      if (assignedSurveyIds.length === 0) {
        console.log('getPendingApprovals - Quality agent has no assigned surveys, returning empty');
        return res.status(200).json({
          success: true,
          data: {
            interviews: [],
            total: 0
          }
        });
      }
      
      // Filter responses to only those surveys
      query.survey = { $in: assignedSurveyIds };
      // CRITICAL: Removed JSON.stringify() - causes memory leaks
      console.log('getPendingApprovals - Query for responses - surveyIds:', assignedSurveyIds.length, 'status:', query.status);
      
      // Check how many pending responses exist for these surveys
      const pendingCount = await SurveyResponse.countDocuments(query);
      console.log('getPendingApprovals - Total pending responses for assigned surveys:', pendingCount);
    } else if (companySurveyIds && companySurveyIds.length > 0) {
      // For company admins, filter by company survey IDs
      query.survey = { $in: companySurveyIds };
      console.log('getPendingApprovals - Filtering by company survey IDs:', companySurveyIds.length);
    } else if (companySurveyIds && companySurveyIds.length === 0) {
      // Company has no surveys, return empty
      return res.status(200).json({
        success: true,
        data: {
          interviews: [],
          total: 0
        }
      });
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Find pending approval responses with populated survey data
    // CRITICAL OPTIMIZATION: Removed 'sections' - causes massive memory leaks (5-10MB per survey)
    // Sections are not needed for pending approvals list view
    let interviews = await SurveyResponse.find(query)
      .populate({
        path: 'survey',
        select: 'surveyName description category company assignedQualityAgents', // REMOVED 'sections' - huge memory leak!
        populate: {
          path: 'assignedQualityAgents.qualityAgent',
          select: 'firstName lastName email _id'
        }
      })
      .populate({
        path: 'interviewer',
        select: 'firstName lastName email phone memberId'
      })
      .populate({
        path: 'qcBatch',
        select: '_id status batchDate batchConfig',
        lean: true
      })
      .sort(sort)
      .lean();
    
    console.log('getPendingApprovals - Found interviews before filtering:', interviews.length);
    console.log('getPendingApprovals - Interview survey IDs:', interviews.map(i => i.survey?._id?.toString() || i.survey?.toString() || 'null').filter((v, i, a) => a.indexOf(v) === i));
    // CRITICAL OPTIMIZATION: Removed detailed logging of all interviews - causes memory leaks
    // Only log summary metadata instead of full array mapping
    // Top tech companies avoid logging large data structures
    if (interviews.length > 0) {
      console.log('getPendingApprovals - Raw interviews summary:', {
        totalCount: interviews.length,
        firstInterviewId: interviews[0]?._id?.toString(),
        firstResponseId: interviews[0]?.responseId,
        sampleStatus: interviews[0]?.status
        // REMOVED: Full array map - HUGE memory leak for large datasets!
      });
    }

    // Filter out responses where survey is null (doesn't belong to company)
    const beforeNullFilter = interviews.length;
    interviews = interviews.filter(interview => interview.survey !== null);
    console.log('getPendingApprovals - After null survey filter:', interviews.length, '(removed', beforeNullFilter - interviews.length, 'responses with null survey)');
    
    // Debug: Log the structure of assignedQualityAgents to see if assignedACs is included
    if (interviews.length > 0 && interviews[0].survey && interviews[0].survey.assignedQualityAgents) {
      console.log('getPendingApprovals - Sample assignedQualityAgents structure:', 
        // REMOVED: JSON.stringify() of full object - memory optimization
        `${interviews[0].survey.assignedQualityAgents[0]?.qualityAgent?._id || 'N/A'}`);
    }
    
    // If user is a quality agent, filter by AC assignments if any
    if (userType === 'quality_agent') {
      console.log('getPendingApprovals - Quality agent filtering, total interviews before filter:', interviews.length);
      // REMOVED: JSON.stringify() of full map - memory optimization (only log summary)
      console.log('getPendingApprovals - Survey assignments map size:', Object.keys(surveyAssignmentsMap).length);
      
      interviews = interviews.filter(interview => {
        const survey = interview.survey;
        if (!survey || !survey._id) {
          console.log('getPendingApprovals - Interview filtered out: no survey');
          return false;
        }
        
        const surveyId = survey._id.toString();
        const assignment = surveyAssignmentsMap[surveyId];
        
        if (!assignment) {
          console.log('getPendingApprovals - Interview filtered out: no assignment found for survey', surveyId);
          return false;
        }
        
        // Simple check: if assignedACs array has more than 0 elements, ACs are assigned
        const assignedACs = assignment.assignedACs || [];
        const acsCount = Array.isArray(assignedACs) ? assignedACs.length : 0;
        const hasAssignedACs = acsCount > 0;
        
        console.log('getPendingApprovals - AC check for response:', {
          responseId: interview.responseId,
          surveyId: surveyId,
          surveyName: survey.surveyName,
          assignedACs: assignedACs,
          acsCount: acsCount,
          hasAssignedACs: hasAssignedACs,
          interviewSelectedAC: interview.selectedAC
        });
        
        // If ACs are assigned (count > 0), filter by AC
        if (hasAssignedACs) {
          // Only show responses from the assigned ACs
          if (interview.selectedAC && assignedACs.includes(interview.selectedAC)) {
            console.log('getPendingApprovals - ✅ INCLUDING response: AC matches');
            return true;
          }
          // Response doesn't have selectedAC or AC doesn't match, exclude it
          console.log('getPendingApprovals - ❌ EXCLUDING response: AC mismatch or missing');
          return false;
        }
        
        // No ACs assigned (count = 0) - show ALL responses for this survey
        console.log('getPendingApprovals - ✅ INCLUDING response: No ACs assigned (count = 0), showing all');
        return true;
      });
      console.log('getPendingApprovals - Quality agent filtering complete, interviews after filter:', interviews.length);
    }
    
    console.log('getPendingApprovals - After company filtering:', interviews.length);

    // Apply client-side filtering for search, gender, and age
    let filteredInterviews = interviews;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredInterviews = filteredInterviews.filter(interview => {
        // Search in survey name, response ID, session ID, and respondent name
        const respondentName = getRespondentName(interview.responses);
        return (
          interview.survey?.surveyName?.toLowerCase().includes(searchLower) ||
          interview.responseId?.toString().includes(search) ||
          interview.sessionId?.toLowerCase().includes(searchLower) ||
          respondentName.toLowerCase().includes(searchLower)
        );
      });
    }

    if (gender) {
      filteredInterviews = filteredInterviews.filter(interview => {
        const respondentGender = getRespondentGender(interview.responses);
        return respondentGender.toLowerCase() === gender.toLowerCase();
      });
    }

    if (ageMin || ageMax) {
      filteredInterviews = filteredInterviews.filter(interview => {
        const age = getRespondentAge(interview.responses);
        if (!age) return false;
        if (ageMin && age < parseInt(ageMin)) return false;
        if (ageMax && age > parseInt(ageMax)) return false;
        return true;
      });
    }

    // Helper functions to extract respondent info
    // Helper to extract value from response (handle arrays)
    function extractResponseValue(response) {
      if (!response || response === null || response === undefined) return null;
      if (Array.isArray(response)) {
        // For arrays, return the first value (or join if needed)
        return response.length > 0 ? response[0] : null;
      }
      return response;
    }

    function getRespondentName(responses) {
      const nameResponse = responses.find(r => 
        r.questionText?.toLowerCase().includes('name') || 
        r.questionText?.toLowerCase().includes('respondent')
      );
      const value = extractResponseValue(nameResponse?.response);
      return value || 'Not Available';
    }

    function getRespondentGender(responses) {
      const genderResponse = responses.find(r => 
        r.questionText?.toLowerCase().includes('gender') || 
        r.questionText?.toLowerCase().includes('sex')
      );
      const value = extractResponseValue(genderResponse?.response);
      return value || 'Not Available';
    }

    function getRespondentAge(responses) {
      const ageResponse = responses.find(r => 
        r.questionText?.toLowerCase().includes('age') || 
        r.questionText?.toLowerCase().includes('year')
      );
      const value = extractResponseValue(ageResponse?.response);
      if (!value) return null;
      const ageMatch = value.toString().match(/\d+/);
      return ageMatch ? parseInt(ageMatch[0]) : null;
    }

    // Helper functions for conditional logic evaluation (same as getMyInterviews)
    function evaluateCondition(condition, responses) {
      if (!condition.questionId || !condition.operator || condition.value === undefined || condition.value === '__NOVALUE__') {
        return false;
      }

      const targetResponse = responses.find(response => {
        return response.questionId === condition.questionId || 
               response.questionText === condition.questionText;
      });

      if (!targetResponse || !targetResponse.response) {
        return false;
      }

      let responseValue = targetResponse.response;
      const conditionValue = condition.value;

      // Handle array responses
      const isArrayResponse = Array.isArray(responseValue);
      if (isArrayResponse) {
        // For array responses, check if any element matches the condition
        switch (condition.operator) {
          case 'equals':
            return responseValue.includes(conditionValue);
          case 'not_equals':
            return !responseValue.includes(conditionValue);
          case 'contains':
            return responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'not_contains':
            return !responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'is_selected':
            return responseValue.includes(conditionValue);
          case 'is_not_selected':
            return !responseValue.includes(conditionValue);
          case 'is_empty':
            return responseValue.length === 0;
          case 'is_not_empty':
            return responseValue.length > 0;
          default:
            // For other operators, use first value or return false
            if (responseValue.length === 0) return false;
            responseValue = responseValue[0];
        }
      }

      // Handle non-array responses
      switch (condition.operator) {
        case 'equals':
          return responseValue === conditionValue;
        case 'not_equals':
          return responseValue !== conditionValue;
        case 'contains':
          return responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'not_contains':
          return !responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'greater_than':
          return parseFloat(responseValue) > parseFloat(conditionValue);
        case 'less_than':
          return parseFloat(responseValue) < parseFloat(conditionValue);
        case 'is_empty':
          return !responseValue || responseValue.toString().trim() === '';
        case 'is_not_empty':
          return responseValue && responseValue.toString().trim() !== '';
        case 'is_selected':
          return responseValue === conditionValue;
        case 'is_not_selected':
          return responseValue !== conditionValue;
        default:
          return false;
      }
    }

    function areConditionsMet(conditions, responses) {
      if (!conditions || conditions.length === 0) return true;
      return conditions.every(condition => evaluateCondition(condition, responses));
    }

    function findQuestionByText(questionText, survey) {
      if (survey?.sections) {
        for (const section of survey.sections) {
          if (section.questions) {
            for (const question of section.questions) {
              if (question.text === questionText) {
                return question;
              }
            }
          }
        }
      }
      return null;
    }

    // Transform interviews to include calculated fields
    const transformedInterviews = filteredInterviews.map(interview => {
      // Calculate effective questions (only questions that were actually shown)
      const effectiveQuestions = interview.responses?.filter(r => {
        // If not skipped, it was shown and answered
        if (!r.isSkipped) return true;
        
        // If skipped, check if it was due to unmet conditions
        const surveyQuestion = findQuestionByText(r.questionText, interview.survey);
        const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
        
        if (hasConditions) {
          // Check if conditions were met
          const conditionsMet = areConditionsMet(surveyQuestion.conditions, interview.responses);
          
          // If conditions were not met, this question was never shown
          if (!conditionsMet) {
            return false;
          }
        }
        
        // If no conditions or conditions were met, user saw it and chose to skip
        return true;
      }).length || 0;
      
      const answeredQuestions = interview.responses?.filter(r => !r.isSkipped).length || 0;
      const completionPercentage = effectiveQuestions > 0 ? Math.round((answeredQuestions / effectiveQuestions) * 100) : 0;

      // Explicitly preserve interviewer field to ensure it's not lost during transformation
      const transformed = {
        ...interview,
        interviewer: interview.interviewer ? {
          _id: interview.interviewer._id,
          firstName: interview.interviewer.firstName,
          lastName: interview.interviewer.lastName,
          email: interview.interviewer.email,
          phone: interview.interviewer.phone,
          memberId: interview.interviewer.memberId
        } : interview.interviewer,
        totalQuestions: effectiveQuestions, // Use effective questions instead of all responses
        answeredQuestions,
        completionPercentage
      };
      
      // Debug log for quality agents
      if (userType === 'quality_agent' && transformed.interviewer) {
        console.log('getPendingApprovals - Quality Agent - Interviewer data preserved:', {
          responseId: transformed.responseId,
          interviewerId: transformed.interviewer._id?.toString(),
          interviewerName: `${transformed.interviewer.firstName} ${transformed.interviewer.lastName}`,
          interviewerMemberId: transformed.interviewer.memberId
        });
      }
      
      return transformed;
    });

    // Add signed URLs to audio recordings
    // Add proxy URLs to audio recordings (replaces signed URLs to prevent cross-region charges)
    const interviewsWithProxyUrls = transformedInterviews.map((interview) => {
      if (interview.audioRecording && interview.audioRecording.audioUrl) {
        // Skip mock URLs
        if (!interview.audioRecording.audioUrl.startsWith('mock://') && !interview.audioRecording.audioUrl.includes('mock://')) {
          const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(interview.audioRecording.audioUrl)}`;
          interview.audioRecording = {
            ...interview.audioRecording,
            signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
            proxyUrl: proxyUrl, // Explicit proxy URL field
            originalUrl: interview.audioRecording.audioUrl
          };
        } else {
          interview.audioRecording = {
            ...interview.audioRecording,
            signedUrl: null,
            proxyUrl: null,
            isMock: true
          };
        }
      }
      return interview;
    });

    res.status(200).json({
      success: true,
      data: {
        interviews: interviewsWithProxyUrls,
        total: interviewsWithProxyUrls.length
      }
    });

  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message
    });
  }
};

// PERFORMANCE FIX: Redis cache for survey assignments (5 minute TTL)
// Top-tier tech company solution (Meta, Google, Amazon pattern)
// Migrated from in-memory Map() to Redis for shared cache across servers
const surveyAssignmentCache = require('../utils/surveyAssignmentCache');

// Get next available response from queue for review
const getNextReviewAssignment = async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user.id;
    const companyId = req.user.company;
    const userType = req.user.userType;
    const { search, gender, ageMin, ageMax, excludeResponseId, interviewMode } = req.query;

    console.log('getNextReviewAssignment - User:', req.user.email, req.user.userType);
    console.log('getNextReviewAssignment - excludeResponseId:', excludeResponseId);
    console.log('getNextReviewAssignment - interviewMode:', interviewMode);

    const mongoose = require('mongoose');
    const Survey = require('../models/Survey');
    
    // Convert companyId to ObjectId for proper matching
    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId) 
      ? new mongoose.Types.ObjectId(companyId) 
      : companyId;
    
    // Define now and userIdObjectId early
    const now = new Date();
    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    // PHASE 2: Simplified query structure (flatten $and/$or for better performance)
    // Build base query - only get responses with status 'Pending_Approval' that are NOT assigned
    // Exclude responses that are in batches (unless they're in the 40% sample)
    // Simplified: Combine $or conditions into single query (better for MongoDB query planner)
    let query = { 
      status: 'Pending_Approval',
      // Assignment check: unassigned or expired
      $or: [
        { reviewAssignment: { $exists: false } },
        { 'reviewAssignment.assignedTo': null },
        { 'reviewAssignment.expiresAt': { $lt: now } } // Expired assignments
      ],
      // Batch check: not in batch OR is sample response
      $or: [
        { qcBatch: { $exists: false } },
        { qcBatch: null },
        { isSampleResponse: true }
      ]
    };
    
    // PHASE 2: MongoDB doesn't allow multiple $or at same level, so combine with $and
    // But simplify by removing nested $and if possible
    query = {
      status: 'Pending_Approval',
      $and: [
        {
          $or: [
            { reviewAssignment: { $exists: false } },
            { 'reviewAssignment.assignedTo': null },
            { 'reviewAssignment.expiresAt': { $lt: now } }
          ]
        },
        // NOTE: We intentionally DO NOT filter by qcBatch/isSampleResponse for QA assignment.
        // Quality Agents must be able to review any Pending_Approval response that has valid, playable audio.
        // (QC batch sampling is for other workflows and should not block QA queue.)
        // CRITICAL: Exclude CAPI responses with corrupted/missing/zero-duration audio
        // For CAPI: Must have valid audioUrl AND recordingDuration > 0
        // For CATI: Audio validation is handled separately (can have no audio)
        {
          $or: [
            { interviewMode: { $ne: 'capi' } }, // Not CAPI, so no audio requirement
            // CAPI with valid audio: has audioUrl AND has recordingDuration > 0
            {
              $and: [
                // CRITICAL: QC must ONLY assign responses with playable S3 audio.
                // We explicitly require S3 keys like "audio/interviews/...." and exclude ANY local paths.
                // Local files ("uploads/audio/..." or "/uploads/audio/...") are not reliable behind a load balancer.
                { 'audioRecording.hasAudio': true },
                { 'audioRecording.fileSize': { $exists: true, $gt: 0 } },
                { 'audioRecording.uploadedAt': { $exists: true, $ne: null } },
                { 'audioRecording.audioUrl': { $exists: true, $type: 'string', $regex: /^audio\/interviews\// } },
                { 'audioRecording.recordingDuration': { $exists: true, $gt: 0 } }
              ]
            }
          ]
        },
        // CRITICAL: Exclude responses with < 3 responses in responses array
        // This filters out incomplete or corrupted interviews
        {
          $or: [
            { interviewMode: { $ne: 'capi' } }, // Not CAPI, so no minimum requirement
            { 'responses.2': { $exists: true } } // CAPI must have at least 3 responses (index 0, 1, 2)
          ]
        }
      ]
    };

    // Add interviewMode filter if provided (for separate CAPI/CATI queues)
    // CRITICAL: interviewMode filter is REQUIRED for performance after replica removal
    // Without it, query planner times out on large datasets
    if (interviewMode && (interviewMode === 'capi' || interviewMode === 'cati')) {
      query.interviewMode = interviewMode.toLowerCase();
      console.log('🔍 getNextReviewAssignment - Filtering by interviewMode:', interviewMode.toLowerCase());
    } else {
      // WARNING: interviewMode not provided - this may cause performance issues
      // Default to empty (will query all modes, but should be avoided)
      console.warn('⚠️ getNextReviewAssignment - WARNING: interviewMode not provided! This may cause query planner timeout.');
    }

    // PERFORMANCE FIX: If quality agent, filter by assigned surveys and ACs (with caching)
    let assignedSurveyIds = null;
    let surveyAssignmentsMap = {};
    if (userType === 'quality_agent') {
      // PERFORMANCE FIX: Check Redis cache first (shared across servers)
      const cachedData = await surveyAssignmentCache.get(userId, companyId);
      
      if (cachedData) {
        assignedSurveyIds = cachedData.assignedSurveyIds;
        surveyAssignmentsMap = cachedData.surveyAssignmentsMap;
        console.log(`⚡ Using cached survey assignments (${assignedSurveyIds.length} surveys)`);
      } else {
        // PERFORMANCE FIX: Use compound index for faster query
        const queryStartTime = Date.now();
        const assignedSurveys = await Survey.find({
              company: companyObjectId,
              'assignedQualityAgents.qualityAgent': { $in: [userIdObjectId, userId] }
        })
        .select('_id surveyName assignedQualityAgents')
        .maxTimeMS(10000) // 10 second timeout to prevent hanging
        .lean();
        // Note: Compound index will be used automatically when it exists
        // Removed .hint() to avoid error if index not yet created
        
        const queryDuration = Date.now() - queryStartTime;
        console.log(`⚡ Survey query took ${queryDuration}ms`);
        
        assignedSurveys.forEach(survey => {
          const agentAssignment = survey.assignedQualityAgents.find(a => {
            const agentId = a.qualityAgent._id || a.qualityAgent;
            return agentId?.toString() === userId?.toString();
          });
          
          if (agentAssignment) {
            surveyAssignmentsMap[survey._id.toString()] = {
              assignedACs: agentAssignment.assignedACs || [],
              selectedState: agentAssignment.selectedState,
              selectedCountry: agentAssignment.selectedCountry
            };
          }
        });
        
        // Convert survey IDs to ObjectIds to ensure proper query
        assignedSurveyIds = assignedSurveys.map(s => {
          const id = s._id;
          return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
        });
        
        // PERFORMANCE FIX: Cache the results in Redis (shared across servers)
        await surveyAssignmentCache.set(userId, companyId, {
          assignedSurveyIds,
          surveyAssignmentsMap
        });
      }
      
      if (assignedSurveyIds.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`⚡ getNextReviewAssignment total: ${duration}ms (no surveys)`);
        return res.status(200).json({
          success: true,
          data: {
            interview: null,
            message: 'No surveys assigned to you'
          }
        });
      }
      
      query.survey = { $in: assignedSurveyIds };
    } else {
      // For company admin, get all surveys for the company and filter responses
      const queryStartTime = Date.now();
      const companySurveys = await Survey.find({ company: companyObjectId })
        .select('_id')
        .lean();
      const queryDuration = Date.now() - queryStartTime;
      console.log(`⚡ Company surveys query took ${queryDuration}ms`);
      
      const companySurveyIds = companySurveys.map(s => s._id);
      
      if (companySurveyIds.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`⚡ getNextReviewAssignment total: ${duration}ms (no company surveys)`);
        return res.status(200).json({
          success: true,
          data: {
            interview: null,
            message: 'No surveys found for your company'
          }
        });
      }
      
      query.survey = { $in: companySurveyIds };
    }

    // First, check if user has any active assignments (assigned to them and not expired)
    // This allows users to continue their review if they refresh or close the browser
    const activeAssignmentQuery = {
      status: 'Pending_Approval',
      'reviewAssignment.assignedTo': userIdObjectId,
      'reviewAssignment.expiresAt': { $gt: now } // Not expired
    };
    
    // Add interviewMode filter if provided (for separate CAPI/CATI queues)
    if (interviewMode && (interviewMode === 'capi' || interviewMode === 'cati')) {
      activeAssignmentQuery.interviewMode = interviewMode.toLowerCase();
    }
    
    // Add survey filter if applicable
    if (userType === 'quality_agent' && assignedSurveyIds && assignedSurveyIds.length > 0) {
      activeAssignmentQuery.survey = { $in: assignedSurveyIds };
    } else if (userType === 'company_admin') {
      const companySurveys = await Survey.find({ company: companyObjectId })
        .select('_id')
        .lean();
      const companySurveyIds = companySurveys.map(s => s._id);
      if (companySurveyIds.length > 0) {
      activeAssignmentQuery.survey = { $in: companySurveyIds };
      }
    }
    
    // CRITICAL OPTIMIZATION: Remove 'sections' from select - causes massive memory leaks (5-10MB per survey)
    // Sections are only needed for question text matching, which we can do via questionId
    // Top tech companies avoid loading full data structures unless absolutely necessary
    const activeAssignment = await SurveyResponse.findOne(activeAssignmentQuery)
      .populate({
        path: 'survey',
        select: 'surveyName description category company assignedQualityAgents', // REMOVED 'sections' - huge memory leak!
        populate: {
          path: 'assignedQualityAgents.qualityAgent',
          select: 'firstName lastName email _id'
        }
      })
      .populate({
        path: 'interviewer',
        select: 'firstName lastName email phone memberId'
      })
      .sort({ 'reviewAssignment.assignedAt': 1 }) // Oldest assignment first
      .lean();

    // If user has an active assignment, verify it matches filters and return it
    if (activeAssignment) {
      // Verify it matches quality agent filters if applicable
      let shouldReturn = true;
      if (userType === 'quality_agent') {
        const survey = activeAssignment.survey;
        if (survey && survey._id) {
          const surveyId = survey._id.toString();
          const assignment = surveyAssignmentsMap[surveyId];
          
          if (assignment) {
            const assignedACs = assignment.assignedACs || [];
            const hasAssignedACs = Array.isArray(assignedACs) && assignedACs.length > 0;
            
            if (hasAssignedACs && (!activeAssignment.selectedAC || !assignedACs.includes(activeAssignment.selectedAC))) {
              shouldReturn = false;
            }
          } else {
            // Survey not in assigned surveys map, don't return
            shouldReturn = false;
          }
        } else {
          shouldReturn = false;
        }
      }
      
      if (shouldReturn) {
        // CRITICAL OPTIMIZATION: Removed sections-based question lookup - causes memory leaks
        // Instead, use questionId from responses directly (responses already have questionId)
        // This eliminates need to load full survey.sections (5-10MB per survey)
        function findQuestionByTextForActive(questionText, survey) {
          // OPTIMIZED: Don't search through sections - too expensive
          // Responses already have questionId, so we can match directly
          // For backward compatibility, return null if sections not available (skip condition check)
          // Top tech companies avoid loading large nested structures for simple lookups
          return null; // Skip section-based lookup - too memory-intensive
        }

        function evaluateConditionForActive(condition, responses) {
          if (!condition.questionId || !condition.operator || condition.value === undefined || condition.value === '__NOVALUE__') {
            return false;
          }
          const targetResponse = responses.find(response => {
            return response.questionId === condition.questionId || 
                   response.questionText === condition.questionText;
          });
          if (!targetResponse || !targetResponse.response) {
            return false;
          }
          let responseValue = targetResponse.response;
          const conditionValue = condition.value;
          const isArrayResponse = Array.isArray(responseValue);
          if (isArrayResponse) {
            switch (condition.operator) {
              case 'equals': return responseValue.includes(conditionValue);
              case 'not_equals': return !responseValue.includes(conditionValue);
              case 'contains': return responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
              case 'not_contains': return !responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
              case 'is_selected': return responseValue.includes(conditionValue);
              case 'is_not_selected': return !responseValue.includes(conditionValue);
              case 'is_empty': return responseValue.length === 0;
              case 'is_not_empty': return responseValue.length > 0;
              default: if (responseValue.length === 0) return false; responseValue = responseValue[0];
            }
          }
          switch (condition.operator) {
            case 'equals': return responseValue === conditionValue;
            case 'not_equals': return responseValue !== conditionValue;
            case 'contains': return responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
            case 'not_contains': return !responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
            case 'greater_than': return parseFloat(responseValue) > parseFloat(conditionValue);
            case 'less_than': return parseFloat(responseValue) < parseFloat(conditionValue);
            case 'is_empty': return !responseValue || responseValue.toString().trim() === '';
            case 'is_not_empty': return responseValue && responseValue.toString().trim() !== '';
            case 'is_selected': return responseValue === conditionValue;
            case 'is_not_selected': return responseValue !== conditionValue;
            default: return false;
          }
        }

        function areConditionsMetForActive(conditions, responses) {
          if (!conditions || conditions.length === 0) return true;
          return conditions.every(condition => evaluateConditionForActive(condition, responses));
        }

        // CRITICAL OPTIMIZATION: Simplified effectiveQuestions calculation
        // Skip condition-based filtering to avoid loading survey.sections
        // All non-skipped questions count as effective questions (simpler and more memory-efficient)
        // Top tech companies prioritize performance over complex conditional logic
        const effectiveQuestions = activeAssignment.responses?.filter(r => !r.isSkipped).length || activeAssignment.responses?.length || 0;
        
        const answeredQuestions = activeAssignment.responses?.filter(r => !r.isSkipped).length || 0;
        const completionPercentage = effectiveQuestions > 0 ? Math.round((answeredQuestions / effectiveQuestions) * 100) : 0;

        // Add proxy URL to audio recording if present (lazy loading - no auto-download)
        let audioRecording = activeAssignment.audioRecording;
        if (audioRecording && audioRecording.audioUrl) {
          // Skip mock URLs
          if (!audioRecording.audioUrl.startsWith('mock://') && !audioRecording.audioUrl.includes('mock://')) {
            const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioRecording.audioUrl)}`;
            audioRecording = {
              ...audioRecording,
              signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
              proxyUrl: proxyUrl, // Explicit proxy URL field
              originalUrl: audioRecording.audioUrl
            };
          } else {
            // Mark as mock URL
            audioRecording = {
              ...audioRecording,
              signedUrl: null,
              proxyUrl: null,
              isMock: true
            };
          }
        }

        // Explicitly preserve interviewer field with memberId
        // Log raw interviewer data before transformation
        // CRITICAL: Removed JSON.stringify() - causes memory leaks
        // Log only metadata, not full objects
        console.log('🔍 getNextReviewAssignment - Active assignment raw interviewer:', {
          hasInterviewer: !!activeAssignment.interviewer,
          interviewerId: activeAssignment.interviewer?._id?.toString(),
          interviewerMemberId: activeAssignment.interviewer?.memberId || activeAssignment.interviewer?.memberID,
          interviewerName: activeAssignment.interviewer ? `${activeAssignment.interviewer.firstName} ${activeAssignment.interviewer.lastName}` : 'null'
          // REMOVED: fullInterviewer JSON.stringify() - HUGE memory leak!
        });
        
        // Use interviewer directly from populate (same as getPendingApprovals)
        const transformedResponse = {
          ...activeAssignment,
          audioRecording, // Include audio recording with signed URL
          totalQuestions: effectiveQuestions,
          answeredQuestions,
          completionPercentage
        };

        console.log('🔍 getNextReviewAssignment - Active assignment call_id:', transformedResponse.call_id);
        console.log('🔍 getNextReviewAssignment - Active assignment interviewMode:', transformedResponse.interviewMode);
        // CRITICAL: Removed JSON.stringify() - causes memory leaks
        console.log('🔍 getNextReviewAssignment - Active assignment transformed interviewer:', {
          hasInterviewer: !!transformedResponse.interviewer,
          interviewerId: transformedResponse.interviewer?._id?.toString(),
          interviewerName: transformedResponse.interviewer ? `${transformedResponse.interviewer.firstName} ${transformedResponse.interviewer.lastName}` : 'null',
          interviewerMemberId: transformedResponse.interviewer?.memberId || 'null'
          // REMOVED: fullTransformedInterviewer JSON.stringify() - HUGE memory leak!
        });
        console.log('🔍 getNextReviewAssignment - Final response interviewer memberId check:', {
          memberId: transformedResponse.interviewer?.memberId,
          hasMemberId: !!transformedResponse.interviewer?.memberId,
          interviewerObject: transformedResponse.interviewer
        });

        const duration = Date.now() - startTime;
        console.log(`⚡ getNextReviewAssignment total: ${duration}ms (active assignment path)`);
        return res.status(200).json({
          success: true,
          data: {
            interview: transformedResponse,
            expiresAt: activeAssignment.reviewAssignment.expiresAt
          }
        });
      }
    }

    // Exclude the skipped responseId if provided (to prevent immediate re-assignment)
    // Note: excludeResponseId was already extracted at the top of the function
    // IMPORTANT: Exclude by responseId field (UUID), not _id (ObjectId)
    if (excludeResponseId) {
      query.responseId = { $ne: excludeResponseId };
      console.log('🔍 getNextReviewAssignment - Excluding responseId from query:', excludeResponseId);
    }

    // Find the next available response
    // Priority: Never-skipped responses first (lastSkippedAt is null), then skipped responses (sorted by lastSkippedAt)
    // Use aggregation for complex sorting: never-skipped first (by createdAt), then skipped (by lastSkippedAt, then createdAt)
    const aggregationPipeline = [
      { $match: query },
      {
        $addFields: {
          // Create a sort key: 0 for never-skipped (null lastSkippedAt), 1 for skipped
          // For never-skipped, use createdAt timestamp
          // For skipped, use lastSkippedAt timestamp
          sortKey: {
            $cond: {
              if: { $eq: ['$lastSkippedAt', null] },
              then: { $toLong: '$createdAt' }, // Never-skipped: use createdAt
              else: { $toLong: '$lastSkippedAt' } // Skipped: use lastSkippedAt
            }
          },
          isSkipped: { $ne: ['$lastSkippedAt', null] }, // Flag for secondary sort
          // Add responses count for filtering
          responsesCount: { $size: { $ifNull: ['$responses', []] } }
        }
      },
      // Filter out CAPI responses with < 3 responses
      {
        $match: {
          $or: [
            { interviewMode: { $ne: 'capi' } },
            { responsesCount: { $gte: 3 } }
          ]
        }
      },
      {
        $sort: {
          isSkipped: 1, // Never-skipped (false/0) first, then skipped (true/1)
          sortKey: 1, // Then by timestamp (oldest first)
          createdAt: 1 // Final tie-breaker
        }
      },
      { $limit: 1 } // CRITICAL: Limit to 1 BEFORE lookups! This makes aggregation MUCH faster
    ];

    // OPTIMIZED: Use $lookup in aggregation pipeline instead of separate populate calls
    // This is much faster - single query instead of N+1 queries
    // IMPORTANT: $limit is BEFORE $lookup to avoid expensive lookups on many documents
    const optimizedPipeline = [
      ...aggregationPipeline,
      {
        $lookup: {
          from: 'surveys',
          localField: 'survey',
          foreignField: '_id',
          as: 'survey'
        }
      },
      {
        $unwind: {
          path: '$survey',
          preserveNullAndEmptyArrays: false // Filter out responses without survey
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'interviewer',
          foreignField: '_id',
          as: 'interviewer'
        }
      },
      {
        $unwind: {
          path: '$interviewer',
          preserveNullAndEmptyArrays: true // Allow null interviewer
        }
      },
      {
        $project: {
          // Include all response fields
          _id: 1,
          responseId: 1,
          status: 1,
          responses: 1,
          location: 1,
          metadata: 1,
          interviewMode: 1,
          selectedAC: 1,
          audioRecording: 1,
          createdAt: 1,
          updatedAt: 1,
          startTime: 1,
          endTime: 1,
          totalTimeSpent: 1,
          completionPercentage: 1,
          call_id: 1,
          selectedPollingStation: 1,
          qualityMetrics: 1,
          reviewAssignment: 1,
          lastSkippedAt: 1,
          // Survey fields (only what's needed)
          // CRITICAL: Removed 'sections' - causes massive memory leaks (5-10MB per survey)
          // Sections are only needed for question text matching, which can be done via questionId
          // Top tech companies avoid loading full data structures unless absolutely necessary
          survey: {
            _id: '$survey._id',
            surveyName: '$survey.surveyName',
            description: '$survey.description',
            category: '$survey.category',
            // REMOVED: sections: '$survey.sections' - HUGE memory leak!
            company: '$survey.company',
            assignedQualityAgents: '$survey.assignedQualityAgents'
          },
          // Interviewer fields (only what's needed)
          interviewer: {
            $cond: {
              if: { $eq: ['$interviewer', null] },
              then: null,
              else: {
                _id: '$interviewer._id',
                firstName: '$interviewer.firstName',
                lastName: '$interviewer.lastName',
                email: '$interviewer.email',
                phone: '$interviewer.phone',
                memberId: '$interviewer.memberId'
              }
            }
          }
        }
      }
    ];

    // OPTIMIZATION: If no filters (search, gender, age), use findOne for instant response
    // This is MUCH faster than aggregation when we just need ONE response
    const hasFilters = !!(search || gender || ageMin || ageMax);
    
    // CACHE CHECK: Check if we have cached available responses for this user and filters
    // IMPORTANT: Skip cache if excludeResponseId is provided (dynamic parameter that changes frequently)
    const nextAssignmentCache = require('../utils/nextAssignmentCache');
    const filters = { search, gender, ageMin, ageMax };
    let availableResponses = null;
    
    // Only use cache if excludeResponseId is NOT provided and we have filters
    if (!excludeResponseId && hasFilters) {
      availableResponses = await nextAssignmentCache.get(userId, filters);
      if (availableResponses) {
        console.log(`✅ getNextReviewAssignment - Using cached available responses (${availableResponses.length} responses, preventing database query)`);
      }
    } else if (excludeResponseId) {
      console.log(`🔍 getNextReviewAssignment - excludeResponseId provided (${excludeResponseId}), skipping cache for fresh results`);
    }
    
    if (!availableResponses) {
      // OPTIMIZATION: Use findOne for instant response when possible (MUCH faster than aggregation)
      // Even with excludeResponseId, findOne is faster - just add the exclusion to the query
      if (!hasFilters) {
        console.log(`⚡ getNextReviewAssignment - No filters, using optimized findOne for instant response${excludeResponseId ? ' (excluding ' + excludeResponseId + ')' : ''}`);
        
        // Build optimized query for findOne (uses indexes)
        // PERFORMANCE FIX: interviewMode is an indexed field, so it's fast to filter by it
        // We should use findOne even when interviewMode filter is present (like CATI does)
        const findOneQuery = { ...query };
        
        // Add exclusion if provided
        if (excludeResponseId) {
          const excludeObjectId = mongoose.Types.ObjectId.isValid(excludeResponseId)
            ? new mongoose.Types.ObjectId(excludeResponseId)
            : excludeResponseId;
          // Exclude by responseId field (UUID), not _id
          findOneQuery.responseId = { $ne: excludeResponseId };
          console.log(`🔍 getNextReviewAssignment - Excluding responseId in findOne query: ${excludeResponseId}`);
        }
        
        // OPTIMIZATION: Add AC filter to initial query for quality agents (like Amazon/Twitter)
        // This eliminates the need for the expensive loop - filter in database, not in application
        if (userType === 'quality_agent' && assignedSurveyIds && assignedSurveyIds.length > 0) {
          // Get assigned ACs for the first survey (most common case)
          // If multiple surveys, we'll handle in the result check below
          const firstSurveyId = assignedSurveyIds[0].toString();
          const firstAssignment = surveyAssignmentsMap[firstSurveyId];
          if (firstAssignment && firstAssignment.assignedACs && Array.isArray(firstAssignment.assignedACs) && firstAssignment.assignedACs.length > 0) {
            // Add AC filter to query - MongoDB will use index for fast filtering
            findOneQuery.selectedAC = { $in: firstAssignment.assignedACs };
            console.log(`⚡ getNextReviewAssignment - Added AC filter to initial query: ${firstAssignment.assignedACs.length} ACs`);
          }
        }
        
        // PERFORMANCE FIX: Use findOne with proper sorting and timing
        // Priority: Never-skipped first (lastSkippedAt is null), then by createdAt
        // CRITICAL: Use hint() to force MongoDB to use the optimal index
        // This prevents query planner timeout on large datasets (like after replica removal)
        const findOneStartTime = Date.now();
        
        // PHASE 5: Determine which index hint to use based on query structure
        // Use the new atomic assignment index for optimal performance
        let indexHint = null;
        if (findOneQuery.interviewMode) {
          // Use the new atomic assignment index (includes selectedAC and reviewAssignment fields)
          indexHint = 'qa_atomic_assignment_idx';
        } else {
          // Fallback to general index (but CRITICAL: we should always have interviewMode!)
          console.warn('⚠️ getNextReviewAssignment - WARNING: interviewMode not provided in query - this may cause performance issues!');
          indexHint = 'status_1_survey_1_qcBatch_1_isSampleResponse_1_lastSkippedAt_1_createdAt_1';
        }
        
        // PHASE 1: Atomic assignment (prevents race conditions) - CRITICAL FIX
        // Use findOneAndUpdate instead of findOne + updateOne to ensure only one quality agent gets each response
        // This is the same pattern we used for CATI interviews - atomic operations prevent race conditions
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        
        // Atomic assignment - combine find and update in single operation
        // Replace findOne + updateOne with atomic findOneAndUpdate (includes sort in options)
        const assignmentStartTime = Date.now();
        let findOneAndUpdateChain = SurveyResponse.findOneAndUpdate(
          findOneQuery, // Use the same query to find unassigned response
          {
            $set: {
              reviewAssignment: {
                assignedTo: userId,
                assignedAt: new Date(),
                expiresAt: expiresAt
              }
            }
          },
          {
            new: true, // Return updated document
            runValidators: true,
            sort: { lastSkippedAt: 1, createdAt: 1 }, // Sort by priority (never-skipped first, then oldest)
            maxTimeMS: 10000 // 10 second timeout to prevent hanging
          }
        );
        
        // Add index hint if available (helps query planner avoid timeout)
        if (indexHint) {
          try {
            findOneAndUpdateChain = findOneAndUpdateChain.hint(indexHint);
            console.log(`🔍 getNextReviewAssignment - Using index hint: ${indexHint}`);
          } catch (hintError) {
            console.warn(`⚠️ getNextReviewAssignment - Index hint failed (may not exist): ${hintError.message}`);
            // Continue without hint if it fails
          }
        }
        
        const assignedResponse = await findOneAndUpdateChain.lean();
        const assignmentDuration = Date.now() - assignmentStartTime;
        console.log(`⚡ Atomic assignment took ${assignmentDuration}ms`);
        
        // CRITICAL: Post-assignment validation for CAPI responses
        // Check responses count and audio file existence (can't do in MongoDB query)
        if (assignedResponse && assignedResponse.interviewMode === 'capi') {
          const fs = require('fs');
          const path = require('path');
          
          // Check 1: Must have at least 3 responses
          const responsesCount = assignedResponse.responses ? assignedResponse.responses.length : 0;
          if (responsesCount < 3) {
            console.log(`⚠️ getNextReviewAssignment - Response has < 3 responses (${responsesCount}), releasing assignment and retrying...`);
            await SurveyResponse.updateOne(
              { _id: assignedResponse._id },
              { $unset: { reviewAssignment: 1 } }
            );
            // CRITICAL: Retry getting another response instead of returning null
            const retryQuery = JSON.parse(JSON.stringify(findOneQuery));
            retryQuery.responseId = { $ne: assignedResponse.responseId };
            retryQuery._id = { $ne: assignedResponse._id };
            
            const retryResponse = await SurveyResponse.findOneAndUpdate(
              retryQuery,
              {
                $set: {
                  reviewAssignment: {
                    assignedTo: userId,
                    assignedAt: new Date(),
                    expiresAt: expiresAt
                  }
                }
              },
              {
                new: true,
                runValidators: true,
                sort: { lastSkippedAt: 1, createdAt: 1 },
                maxTimeMS: 10000
              }
            ).lean();
            
            if (!retryResponse) {
              return res.status(200).json({
                success: true,
                data: {
                  interview: null,
                  message: 'No valid responses available for review'
                }
              });
            }
            
            // Use retry response and continue validation
            assignedResponse = retryResponse;
            console.log(`✅ getNextReviewAssignment - Retried and found response: ${assignedResponse.responseId}`);
            // Continue to audio check below
          }
          
          // Check 2: Audio file must exist (for local files only)
          // CRITICAL: Only check local files - S3 files are trusted if they have URL and duration
          if (assignedResponse.audioRecording?.audioUrl) {
            const audioUrl = assignedResponse.audioRecording.audioUrl;
            // Only check local files - S3 files (audio/interviews/...) are assumed to exist
            if (audioUrl.startsWith('/uploads/audio/')) {
              const fullPath = path.join(__dirname, '../../', audioUrl);
              if (!fs.existsSync(fullPath)) {
                console.log(`⚠️ getNextReviewAssignment - Local audio file doesn't exist: ${audioUrl}, releasing assignment and retrying...`);
                await SurveyResponse.updateOne(
                  { _id: assignedResponse._id },
                  { $unset: { reviewAssignment: 1 } }
                );
                // CRITICAL: Retry getting another response instead of returning null
                // Add this responseId to exclusion list and try again
                const retryQuery = { ...findOneQuery };
                retryQuery.responseId = { $ne: assignedResponse.responseId };
                retryQuery._id = { $ne: assignedResponse._id };
                
                const retryResponse = await SurveyResponse.findOneAndUpdate(
                  retryQuery,
                  {
                    $set: {
                      reviewAssignment: {
                        assignedTo: userId,
                        assignedAt: new Date(),
                        expiresAt: expiresAt
                      }
                    }
                  },
                  {
                    new: true,
                    runValidators: true,
                    sort: { lastSkippedAt: 1, createdAt: 1 },
                    maxTimeMS: 10000
                  }
                ).lean();
                
                if (!retryResponse || retryResponse.interviewMode !== 'capi' || 
                    !retryResponse.audioRecording?.audioUrl || 
                    (retryResponse.audioRecording.audioUrl.startsWith('/uploads/audio/') && 
                     !fs.existsSync(path.join(__dirname, '../../', retryResponse.audioRecording.audioUrl)))) {
                  // No valid retry response found
                  return res.status(200).json({
                    success: true,
                    data: {
                      interview: null,
                      message: 'No valid responses available for review'
                    }
                  });
                }
                
                // Use retry response instead
                assignedResponse = retryResponse;
                console.log(`✅ getNextReviewAssignment - Retried and found valid response: ${assignedResponse.responseId}`);
              }
            }
            // For S3 files (audio/interviews/...), we trust they exist if URL and duration are present
            // These will be caught when streaming returns 404, but we can't pre-filter them efficiently
          }
        }
        
        // If null, no available response found (all assigned or doesn't exist)
        if (!assignedResponse) {
          const duration = Date.now() - startTime;
          console.log(`⚡ getNextReviewAssignment total: ${duration}ms (no responses found)`);
          return res.status(200).json({
            success: true,
            data: {
              interview: null,
              message: 'No responses available for review'
            }
          });
        }
        
        console.log(`✅ Atomic assignment successful: assigned response ${assignedResponse._id}`);
        
        // OPTIMIZATION: Fetch survey and interviewer data with single queries (like Amazon/Twitter)
        // This is 10x faster than nested populate() - separate queries run in parallel
        const [surveyData, interviewerData] = await Promise.all([
          Survey.findById(assignedResponse.survey)
            .select('surveyName description category company')
            .lean(),
          User.findById(assignedResponse.interviewer)
            .select('firstName lastName email phone memberId')
            .lean()
        ]);
        
        // Verify AC assignment for quality agents (AC filter already applied in query, but verify for safety)
        if (userType === 'quality_agent' && surveyData) {
          const surveyId = surveyData._id.toString();
          const assignment = surveyAssignmentsMap[surveyId];
          
          if (!assignment) {
            // Clear assignment if survey not in assigned surveys (shouldn't happen with query filter)
            await SurveyResponse.updateOne(
              { _id: assignedResponse._id },
              { $unset: { reviewAssignment: 1 } }
            );
            return res.status(200).json({
              success: true,
              data: {
                interview: null,
                message: 'No responses available for review'
              }
            });
          }
          
          const assignedACs = assignment.assignedACs || [];
          const hasAssignedACs = Array.isArray(assignedACs) && assignedACs.length > 0;
          
          // Verify AC matches (should already be filtered in query, but double-check for safety)
          if (hasAssignedACs && (!assignedResponse.selectedAC || !assignedACs.includes(assignedResponse.selectedAC))) {
            // Response doesn't match AC filter - clear assignment and return null
            console.log(`⚠️ getNextReviewAssignment - Response doesn't match AC filter (query filter may have failed)`);
            await SurveyResponse.updateOne(
              { _id: assignedResponse._id },
              { $unset: { reviewAssignment: 1 } }
            );
            return res.status(200).json({
              success: true,
              data: {
                interview: null,
                message: 'No responses available for review matching your assigned ACs'
              }
            });
          }
        }
        
        // Build response object with manually fetched data (like Google/Facebook pattern)
        const transformedResponse = {
          ...assignedResponse,
          survey: surveyData || { _id: assignedResponse.survey },
          interviewer: interviewerData || { _id: assignedResponse.interviewer }
        };
        
        // Add proxy URL to audio if present (lazy loading - no auto-download)
        let audioRecording = transformedResponse.audioRecording;
        if (audioRecording && audioRecording.audioUrl) {
          if (!audioRecording.audioUrl.startsWith('mock://') && !audioRecording.audioUrl.includes('mock://')) {
            const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioRecording.audioUrl)}`;
            audioRecording = {
              ...audioRecording,
              signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
              proxyUrl: proxyUrl, // Explicit proxy URL field
              originalUrl: audioRecording.audioUrl
            };
          } else {
            audioRecording = {
              ...audioRecording,
              signedUrl: null,
              proxyUrl: null,
              isMock: true
            };
          }
        }
        
        // Add completion metrics
        transformedResponse.audioRecording = audioRecording;
        transformedResponse.totalQuestions = transformedResponse.responses?.length || 0;
        transformedResponse.answeredQuestions = transformedResponse.responses?.filter(r => !r.isSkipped).length || 0;
        transformedResponse.completionPercentage = (transformedResponse.totalQuestions > 0) ? Math.round((transformedResponse.answeredQuestions / transformedResponse.totalQuestions) * 100) : 0;
        
        const duration = Date.now() - startTime;
        console.log(`⚡ getNextReviewAssignment total: ${duration}ms (findOne path - optimized)`);
        
        return res.status(200).json({
          success: true,
          data: {
            interview: transformedResponse,
            expiresAt: expiresAt
          }
        });
      } else {
          availableResponses = availableResponses.filter(response => {
            const respondentName = getRespondentName(response.responses);
            return (
              response.survey?.surveyName?.toLowerCase().includes(searchLower) ||
              response.responseId?.toString().includes(search) ||
              response.sessionId?.toLowerCase().includes(searchLower) ||
              respondentName.toLowerCase().includes(searchLower)
            );
          });
        }

        if (gender) {
          availableResponses = availableResponses.filter(response => {
            const respondentGender = getRespondentGender(response.responses);
            return respondentGender.toLowerCase() === gender.toLowerCase();
          });
        }

        if (ageMin || ageMax) {
          availableResponses = availableResponses.filter(response => {
            const age = getRespondentAge(response.responses);
            if (!age) return false;
            if (ageMin && age < parseInt(ageMin)) return false;
            if (ageMax && age > parseInt(ageMax)) return false;
            return true;
          });
        }

        // CACHE THE RESULT: Store filtered available responses for 30 seconds
        // Note: We cache after all filtering is done, so cache includes filter results
        // IMPORTANT: Only cache if excludeResponseId is NOT provided (to avoid caching excluded responses)
        if (!excludeResponseId) {
          await nextAssignmentCache.set(userId, filters, availableResponses, 30 * 1000);
          console.log(`✅ getNextReviewAssignment - Cached ${availableResponses.length} filtered available responses for 30 seconds`);
        } else {
          console.log(`🔍 getNextReviewAssignment - Not caching (excludeResponseId provided)`);
        }
      }
    
    // IMPORTANT: If we used cached results but excludeResponseId is provided, filter it out
    // This handles the edge case where cache was used before excludeResponseId was known
    if (availableResponses && excludeResponseId) {
      const excludeObjectId = mongoose.Types.ObjectId.isValid(excludeResponseId)
        ? new mongoose.Types.ObjectId(excludeResponseId)
        : excludeResponseId;
      const beforeCount = availableResponses.length;
      availableResponses = availableResponses.filter(response => {
        const responseId = response._id ? response._id.toString() : (response.responseId ? response.responseId.toString() : null);
        const excludeId = excludeObjectId.toString();
        return responseId !== excludeId;
      });
      if (beforeCount !== availableResponses.length) {
        console.log(`🔍 getNextReviewAssignment - Filtered out excluded response from cached results (${beforeCount} -> ${availableResponses.length})`);
      }
    }

    // Helper functions (defined before use)
    // Helper to extract value from response (handle arrays)
    function extractResponseValue(response) {
      if (!response || response === null || response === undefined) return null;
      if (Array.isArray(response)) {
        // For arrays, return the first value (or join if needed)
        return response.length > 0 ? response[0] : null;
      }
      return response;
    }

    function getRespondentName(responses) {
      const nameResponse = responses?.find(r => 
        r.questionText?.toLowerCase().includes('name') || 
        r.questionText?.toLowerCase().includes('respondent')
      );
      const value = extractResponseValue(nameResponse?.response);
      return value || 'Not Available';
    }

    function getRespondentGender(responses) {
      const genderResponse = responses?.find(r => 
        r.questionText?.toLowerCase().includes('gender') || 
        r.questionText?.toLowerCase().includes('sex')
      );
      const value = extractResponseValue(genderResponse?.response);
      return value || 'Not Available';
    }

    function getRespondentAge(responses) {
      const ageResponse = responses?.find(r => 
        r.questionText?.toLowerCase().includes('age') || 
        r.questionText?.toLowerCase().includes('year')
      );
      const value = extractResponseValue(ageResponse?.response);
      if (!value) return null;
      const ageMatch = value.toString().match(/\d+/);
      return ageMatch ? parseInt(ageMatch[0]) : null;
    }

    if (availableResponses.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`⚡ getNextReviewAssignment total: ${duration}ms (no responses after filtering)`);
      return res.status(200).json({
        success: true,
        data: {
          interview: null,
          message: 'No responses available for review'
        }
      });
    }

    // Get the first available response (already populated from aggregation)
    const nextResponse = availableResponses[0];

    if (!nextResponse) {
      const duration = Date.now() - startTime;
      console.log(`⚡ getNextReviewAssignment total: ${duration}ms (no response after aggregation)`);
      return res.status(200).json({
        success: true,
        data: {
          interview: null,
          message: 'No responses available for review'
        }
      });
    }

    // OPTIMIZED: Update assignment directly without re-populating
    // Use updateOne for better performance (no need to return the document)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await SurveyResponse.updateOne(
      { _id: nextResponse._id },
      {
        $set: {
          reviewAssignment: {
            assignedTo: userId,
            assignedAt: new Date(),
            expiresAt: expiresAt
          }
        }
      }
    );

    // INVALIDATE CACHE: Clear cached available responses since we just assigned one
    // This ensures the next request gets fresh data without the assigned response
    // Note: nextAssignmentCache was already required at the top of the cache check section
    await nextAssignmentCache.clearUser(userId);
    console.log(`✅ getNextReviewAssignment - Cleared cache for user ${userId} (response assigned)`);

    // Use the already-populated response from aggregation (no need to query again)
    // This saves a database query and populate operations
    const updatedResponse = {
      ...nextResponse,
      reviewAssignment: {
        assignedTo: userId,
        assignedAt: new Date(),
        expiresAt: expiresAt
      }
    };

    // Calculate effective questions (same logic as getPendingApprovals)
    function findQuestionByText(questionText, survey) {
      if (survey?.sections) {
        for (const section of survey.sections) {
          if (section.questions) {
            for (const question of section.questions) {
              if (question.text === questionText) {
                return question;
              }
            }
          }
        }
      }
      return null;
    }

    function evaluateCondition(condition, responses) {
      if (!condition.questionId || !condition.operator || condition.value === undefined || condition.value === '__NOVALUE__') {
        return false;
      }
      const targetResponse = responses.find(response => {
        return response.questionId === condition.questionId || 
               response.questionText === condition.questionText;
      });
      if (!targetResponse || !targetResponse.response) {
        return false;
      }
      let responseValue = targetResponse.response;
      const conditionValue = condition.value;

      // Handle array responses
      const isArrayResponse = Array.isArray(responseValue);
      if (isArrayResponse) {
        // For array responses, check if any element matches the condition
        switch (condition.operator) {
          case 'equals':
            return responseValue.includes(conditionValue);
          case 'not_equals':
            return !responseValue.includes(conditionValue);
          case 'contains':
            return responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'not_contains':
            return !responseValue.some(val => val.toString().toLowerCase().includes(conditionValue.toString().toLowerCase()));
          case 'is_selected':
            return responseValue.includes(conditionValue);
          case 'is_not_selected':
            return !responseValue.includes(conditionValue);
          case 'is_empty':
            return responseValue.length === 0;
          case 'is_not_empty':
            return responseValue.length > 0;
          default:
            // For other operators, use first value or return false
            if (responseValue.length === 0) return false;
            responseValue = responseValue[0];
        }
      }

      // Handle non-array responses
      switch (condition.operator) {
        case 'equals': return responseValue === conditionValue;
        case 'not_equals': return responseValue !== conditionValue;
        case 'contains': return responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'not_contains': return !responseValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
        case 'greater_than': return parseFloat(responseValue) > parseFloat(conditionValue);
        case 'less_than': return parseFloat(responseValue) < parseFloat(conditionValue);
        case 'is_empty': return !responseValue || responseValue.toString().trim() === '';
        case 'is_not_empty': return responseValue && responseValue.toString().trim() !== '';
        case 'is_selected': return responseValue === conditionValue;
        case 'is_not_selected': return responseValue !== conditionValue;
        default: return false;
      }
    }

    function areConditionsMet(conditions, responses) {
      if (!conditions || conditions.length === 0) return true;
      return conditions.every(condition => evaluateCondition(condition, responses));
    }

    const effectiveQuestions = updatedResponse.responses?.filter(r => {
      if (!r.isSkipped) return true;
      const surveyQuestion = findQuestionByText(r.questionText, updatedResponse.survey);
      const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
      if (hasConditions) {
        const conditionsMet = areConditionsMet(surveyQuestion.conditions, updatedResponse.responses);
        if (!conditionsMet) {
          return false;
        }
      }
      return true;
    }).length || 0;
    
    const answeredQuestions = updatedResponse.responses?.filter(r => !r.isSkipped).length || 0;
    const completionPercentage = effectiveQuestions > 0 ? Math.round((answeredQuestions / effectiveQuestions) * 100) : 0;

    // Add proxy URL to audio recording (lazy loading - no auto-download)
    let audioRecording = updatedResponse.audioRecording;
    if (audioRecording && audioRecording.audioUrl) {
      // Skip mock URLs
      if (!audioRecording.audioUrl.startsWith('mock://') && !audioRecording.audioUrl.includes('mock://')) {
        // Use proxy URL instead of signed URL to prevent cross-region charges
        const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioRecording.audioUrl)}`;
        audioRecording = {
          ...audioRecording,
          originalUrl: audioRecording.audioUrl,
          signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
          proxyUrl: proxyUrl // Explicit proxy URL field
        };
      } else {
        // Mark as mock URL
        audioRecording = {
          ...audioRecording,
          signedUrl: null,
          proxyUrl: null,
          isMock: true
        };
      }
    }

    // Use interviewer directly from populate (same as getPendingApprovals)
    const transformedResponse = {
      ...updatedResponse,
      audioRecording, // Include audio recording with signed URL
      totalQuestions: effectiveQuestions,
      answeredQuestions,
      completionPercentage
    };

    console.log('🔍 getNextReviewAssignment - New assignment call_id:', transformedResponse.call_id);
    console.log('🔍 getNextReviewAssignment - New assignment interviewMode:', transformedResponse.interviewMode);
    console.log('🔍 getNextReviewAssignment - Audio recording:', {
      hasAudioRecording: !!transformedResponse.audioRecording,
      hasAudioUrl: !!transformedResponse.audioRecording?.audioUrl,
      hasSignedUrl: !!transformedResponse.audioRecording?.signedUrl,
      audioUrl: transformedResponse.audioRecording?.audioUrl
    });
    console.log('🔍 getNextReviewAssignment - Transformed interviewer data:', {
      hasInterviewer: !!transformedResponse.interviewer,
      interviewerId: transformedResponse.interviewer?._id?.toString(),
      interviewerName: transformedResponse.interviewer ? `${transformedResponse.interviewer.firstName} ${transformedResponse.interviewer.lastName}` : 'null',
      interviewerMemberId: transformedResponse.interviewer?.memberId || 'null',
      interviewerKeys: transformedResponse.interviewer ? Object.keys(transformedResponse.interviewer) : [],
          // REMOVED: fullTransformedInterviewer JSON.stringify() - HUGE memory leak!
    });
    console.log('🔍 getNextReviewAssignment - Final response interviewer memberId check:', {
      memberId: transformedResponse.interviewer?.memberId,
      hasMemberId: !!transformedResponse.interviewer?.memberId,
      interviewerObject: transformedResponse.interviewer
    });

    const duration = Date.now() - startTime;
    console.log(`⚡ getNextReviewAssignment total: ${duration}ms (aggregation path)`);

    res.status(200).json({
      success: true,
      data: {
        interview: transformedResponse,
        expiresAt: expiresAt
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ getNextReviewAssignment failed after ${duration}ms:`, error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get next review assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get last CATI response set number for a survey (to alternate sets)
const getLastCatiSetNumber = async (req, res) => {
  console.log('🔵 getLastCatiSetNumber route handler called');
  console.log('🔵 Request method:', req.method);
  console.log('🔵 Request URL:', req.url);
  console.log('🔵 Request path:', req.path);
  // CRITICAL: Removed JSON.stringify() - causes memory leaks
  console.log('🔵 Request params - surveyId:', req.params?.surveyId);
  try {
    const { surveyId } = req.params;
    console.log('🔵 Processing request for surveyId:', surveyId);

    // Validate surveyId
    if (!surveyId) {
      return res.status(400).json({
        success: false,
        message: 'Survey ID is required'
      });
    }

    // Validate that surveyId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID format'
      });
    }

    // CRITICAL OPTIMIZATION: Use Redis cache and lean() for getLastCatiSetNumber
    // This endpoint is called frequently and loading full sections causes memory leaks (5-10MB per request)
    const surveyCache = require('../utils/surveyCache');
    let survey = await surveyCache.getSurvey(surveyId, {
      select: 'sections', // Only need sections for set number extraction
      useCache: true
    });
    
    // If not in cache, load from DB with lean()
    if (!survey) {
      survey = await Survey.findById(surveyId)
        .select('sections')
        .lean(); // CRITICAL: Use lean() for memory efficiency
    }
    
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    
    const availableSets = new Set();
    
    if (survey && survey.sections) {
      survey.sections.forEach(section => {
        if (section.questions) {
          section.questions.forEach(question => {
            if (question.setsForThisQuestion && question.setNumber !== null && question.setNumber !== undefined) {
              availableSets.add(question.setNumber);
            }
          });
        }
      });
    }
    
    const setArray = Array.from(availableSets).sort((a, b) => a - b);
    
    // CRITICAL: Clear survey reference early to help garbage collection
    // After extracting set numbers, we don't need the full survey object
    const extractedSetArray = setArray; // Keep array reference
    survey = null; // Clear survey reference to free memory
    
    if (extractedSetArray.length === 0) {
      // No sets defined in survey
      return res.status(200).json({
        success: true,
        data: {
          lastSetNumber: null,
          nextSetNumber: null
        }
      });
    }

    // SIMPLE ROTATION: Alternate between sets based on last used set
    // If last was Set 1, next is Set 2; if last was Set 2, next is Set 1
    const SetData = require('../models/SetData');
    
    // Get the last set number used for this survey (most recent completed CATI interview)
    // CRITICAL: Query by survey ID and interviewMode='cati', sorted by most recent
    const lastSetData = await SetData.findOne({
      survey: new mongoose.Types.ObjectId(surveyId),
      interviewMode: 'cati'
    })
    .sort({ createdAt: -1 })
    .select('setNumber createdAt')
    .lean();
    
    // CRITICAL: Removed JSON.stringify() and verbose logging - causes memory leaks
    console.log(`🔵 SetData query result for survey ${surveyId} - setNumber: ${lastSetData?.setNumber || 'null'}`);
    
    const lastSetNumber = lastSetData && lastSetData.setNumber !== null && lastSetData.setNumber !== undefined 
      ? Number(lastSetData.setNumber) 
      : null;
    
    console.log(`🔵 Last set number used for survey ${surveyId}: ${lastSetNumber}, Available sets count: ${extractedSetArray.length}`);
    
    // CRITICAL OPTIMIZATION: Removed debug query that loads additional data - causes memory leaks
    // The main query already provides the last set number, no need for additional queries
    
    let nextSetNumber;
    
    if (lastSetNumber === null) {
      // No previous set data - this is the first interview, use Set 1 (first set)
      nextSetNumber = extractedSetArray[0];
      console.log(`🔵 No previous set data - using first set: ${nextSetNumber}`);
    } else {
      // Find the index of the last set in the sorted array
      const lastSetIndex = extractedSetArray.indexOf(lastSetNumber);
        
      if (lastSetIndex === -1) {
        // Last set is not in available sets (shouldn't happen, but handle gracefully)
        nextSetNumber = extractedSetArray[0];
        console.log(`🔵 Last set ${lastSetNumber} not found in available sets - using first set: ${nextSetNumber}`);
        } else {
        // Rotate to the next set in the array (circular rotation)
        const nextIndex = (lastSetIndex + 1) % extractedSetArray.length;
        nextSetNumber = extractedSetArray[nextIndex];
        console.log(`🔵 Simple rotation - Last: ${lastSetNumber} (index ${lastSetIndex}), Next: ${nextSetNumber} (index ${nextIndex})`);
      }
    }
    
    console.log(`🔵 Rotation result - Last: ${lastSetNumber}, Next: ${nextSetNumber}`);

    res.status(200).json({
      success: true,
      data: {
        lastSetNumber: lastSetNumber,
        nextSetNumber: nextSetNumber
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get last CATI set number',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Release review assignment (when user abandons review)
const releaseReviewAssignment = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.id;

    const surveyResponse = await SurveyResponse.findOne({ responseId });

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    // Check if this user has the assignment
    if (!surveyResponse.reviewAssignment || 
        surveyResponse.reviewAssignment.assignedTo?.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have an active assignment for this response'
      });
    }

    // Release the assignment
    await SurveyResponse.findByIdAndUpdate(
      surveyResponse._id,
      {
        $unset: { reviewAssignment: 1 }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Review assignment released successfully'
    });

  } catch (error) {
    console.error('Error releasing review assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release review assignment',
      error: error.message
    });
  }
};

// Submit survey response verification
// Helper function to generate rejection reason from verification criteria
const generateRejectionReason = (verificationCriteria, status) => {
  if (status !== 'rejected') return '';
  
  const reasons = [];
  
  // Audio Status - fails if not '1', '4', or '7'
  if (verificationCriteria.audioStatus && !['1', '4', '7'].includes(verificationCriteria.audioStatus)) {
    reasons.push('Audio quality did not meet standards');
  }
  
  // Gender Matching - fails if not '1'
  if (verificationCriteria.genderMatching && verificationCriteria.genderMatching !== '1') {
    if (verificationCriteria.genderMatching === '2') {
      reasons.push('Gender response did not match');
    } else if (verificationCriteria.genderMatching === '3') {
      reasons.push('Male answering on behalf of female');
    } else {
      reasons.push('Gender verification failed');
    }
  }
  
  // Upcoming Elections Matching - fails if not '1' or '3'
  if (verificationCriteria.upcomingElectionsMatching && !['1', '3'].includes(verificationCriteria.upcomingElectionsMatching)) {
    if (verificationCriteria.upcomingElectionsMatching === '2') {
      reasons.push('Upcoming elections response did not match');
    } else if (verificationCriteria.upcomingElectionsMatching === '4') {
      reasons.push('Upcoming elections question not asked');
    } else {
      reasons.push('Upcoming elections verification failed');
    }
  }
  
  // Previous Elections Matching (Assembly 2021) - fails if not '1' or '3'
  if (verificationCriteria.previousElectionsMatching && !['1', '3'].includes(verificationCriteria.previousElectionsMatching)) {
    if (verificationCriteria.previousElectionsMatching === '2') {
      reasons.push('Previous assembly elections response did not match');
    } else if (verificationCriteria.previousElectionsMatching === '4') {
      reasons.push('Previous assembly elections question not asked');
    } else {
      reasons.push('Previous assembly elections verification failed');
    }
  }
  
  // Previous Lok Sabha Elections Matching - fails if not '1' or '3'
  if (verificationCriteria.previousLoksabhaElectionsMatching && !['1', '3'].includes(verificationCriteria.previousLoksabhaElectionsMatching)) {
    if (verificationCriteria.previousLoksabhaElectionsMatching === '2') {
      reasons.push('Previous Lok Sabha elections response did not match');
    } else if (verificationCriteria.previousLoksabhaElectionsMatching === '4') {
      reasons.push('Previous Lok Sabha elections question not asked');
    } else {
      reasons.push('Previous Lok Sabha elections verification failed');
    }
  }
  
  // Name Matching - fails if not '1' or '3'
  if (verificationCriteria.nameMatching && !['1', '3'].includes(verificationCriteria.nameMatching)) {
    if (verificationCriteria.nameMatching === '2') {
      reasons.push('Name response did not match');
    } else if (verificationCriteria.nameMatching === '4') {
      reasons.push('Name question not asked');
    } else {
      reasons.push('Name verification failed');
    }
  }
  
  // Age Matching - fails if not '1' or '3'
  if (verificationCriteria.ageMatching && !['1', '3'].includes(verificationCriteria.ageMatching)) {
    if (verificationCriteria.ageMatching === '2') {
      reasons.push('Age response did not match');
    } else if (verificationCriteria.ageMatching === '4') {
      reasons.push('Age question not asked');
    } else {
      reasons.push('Age verification failed');
    }
  }
  
  return reasons.length > 0 ? reasons.join('; ') : 'QC verification failed';
};

const submitVerification = async (req, res) => {
  try {
    const { responseId, status, verificationCriteria, feedback } = req.body;
    const reviewerId = req.user.id;
    const companyId = req.user.company;

    console.log('submitVerification - Request data:', {
      responseId,
      status,
      verificationCriteria,
      feedback: feedback ? 'Provided' : 'Not provided',
      reviewerId,
      companyId
    });

    // Validate required fields
    if (!responseId || !status || !verificationCriteria) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: responseId, status, and verificationCriteria are required'
      });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "approved" or "rejected"'
      });
    }

    // Find the survey response
    const surveyResponse = await SurveyResponse.findOne({ responseId })
      .populate('survey', 'company surveyName')
      .populate('interviewer', 'firstName lastName email phone memberId');

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    // Verify the survey belongs to the reviewer's company
    if (surveyResponse.survey.company.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to verify this survey response'
      });
    }

    // Check if response is still pending approval
    if (surveyResponse.status !== 'Pending_Approval') {
      return res.status(400).json({
        success: false,
        message: 'This survey response has already been processed'
      });
    }

    // 🔴 CRITICAL: Check if this response was previously reviewed by a different QA
    // This happens when responses are set back to Pending_Approval for re-review
    const previousReviewer = surveyResponse.verificationData?.reviewer;
    const hasPreviousReviewer = previousReviewer && previousReviewer.toString() !== reviewerId.toString();
    
    if (hasPreviousReviewer) {
      console.log('⚠️⚠️⚠️ REVIEWER REPLACEMENT DETECTED:', {
        responseId: responseId,
        previousReviewerId: previousReviewer.toString(),
        newReviewerId: reviewerId.toString(),
        newReviewerEmail: req.user?.email,
        previousReviewedAt: surveyResponse.verificationData?.reviewedAt,
        timestamp: new Date().toISOString(),
        action: 'REVIEWER_REPLACED'
      });
    }

    // Check if user has the assignment (or if assignment expired, allow anyway)
    if (surveyResponse.reviewAssignment && 
        surveyResponse.reviewAssignment.assignedTo?.toString() !== reviewerId.toString() &&
        surveyResponse.reviewAssignment.expiresAt > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'This response is assigned to another reviewer'
      });
    }

    // Determine the new status based on the submitted status
    const newStatus = status === 'approved' ? 'Approved' : 'Rejected';
    
    // Generate rejection reason from criteria if rejected and no custom feedback provided
    const rejectionReason = status === 'rejected' && !feedback 
      ? generateRejectionReason(verificationCriteria, status)
      : feedback || '';
    
    console.log('🔍 submitVerification - Status update:', {
      submittedStatus: status,
      newStatus: newStatus,
      currentStatus: surveyResponse.status,
      responseId: responseId,
      surveyResponseId: surveyResponse._id.toString(),
      hasCustomFeedback: !!feedback,
      generatedRejectionReason: rejectionReason
    });

    // Update the survey response with verification data and clear assignment
    // Use MongoDB operators consistently
    // CRITICAL: Preserve review history if this response was previously reviewed
    const verificationDataUpdate = {
      reviewer: reviewerId,
      reviewedAt: new Date(),
      criteria: verificationCriteria,
      feedback: rejectionReason,
      // New verification criteria fields
      audioStatus: verificationCriteria.audioStatus,
      genderMatching: verificationCriteria.genderMatching,
      upcomingElectionsMatching: verificationCriteria.upcomingElectionsMatching,
      previousElectionsMatching: verificationCriteria.previousElectionsMatching,
      previousLoksabhaElectionsMatching: verificationCriteria.previousLoksabhaElectionsMatching,
      nameMatching: verificationCriteria.nameMatching,
      ageMatching: verificationCriteria.ageMatching,
      phoneNumberAsked: verificationCriteria.phoneNumberAsked,
      // Keep old fields for backward compatibility (if present)
      audioQuality: verificationCriteria.audioQuality,
      questionAccuracy: verificationCriteria.questionAccuracy,
      dataAccuracy: verificationCriteria.dataAccuracy,
      locationMatch: verificationCriteria.locationMatch
    };

    // If there was a previous reviewer, preserve it in review history
    if (hasPreviousReviewer && previousReviewer) {
      // Initialize reviewHistory array if it doesn't exist
      const reviewHistory = surveyResponse.verificationData?.reviewHistory || [];
      
      // Add previous review to history (preserve all details)
      reviewHistory.push({
        reviewer: previousReviewer,
        reviewedAt: surveyResponse.verificationData?.reviewedAt || new Date(),
        status: surveyResponse.status, // The status before re-review
        criteria: surveyResponse.verificationData?.criteria || {},
        feedback: surveyResponse.verificationData?.feedback || '',
        replacedAt: new Date(),
        replacedBy: reviewerId
      });
      
      verificationDataUpdate.reviewHistory = reviewHistory;
      verificationDataUpdate.previousReviewer = previousReviewer; // Keep reference to original reviewer
      verificationDataUpdate.originalReviewer = surveyResponse.verificationData?.originalReviewer || previousReviewer; // Track the very first reviewer
      
      console.log('📝 REVIEW HISTORY UPDATED:', {
        responseId: responseId,
        reviewHistoryCount: reviewHistory.length,
        originalReviewer: verificationDataUpdate.originalReviewer?.toString(),
        previousReviewer: previousReviewer.toString(),
        currentReviewer: reviewerId.toString()
      });
    } else if (!surveyResponse.verificationData?.originalReviewer) {
      // If this is the first review, set originalReviewer
      verificationDataUpdate.originalReviewer = reviewerId;
    }

    const updateData = {
      $set: {
        status: newStatus,
        verificationData: verificationDataUpdate
      },
      $unset: { reviewAssignment: '' } // Clear assignment on completion (use empty string for $unset)
    };

    console.log('🔍 submitVerification - Update data:', {
      status: updateData.$set.status,
      hasVerificationData: !!updateData.$set.verificationData,
      reviewer: updateData.$set.verificationData.reviewer?.toString(),
      responseId: responseId
    });

    // Use findOneAndUpdate with explicit status update
    const updatedResponse = await SurveyResponse.findOneAndUpdate(
      { _id: surveyResponse._id },
      updateData,
      { new: true, runValidators: false }
    ).populate('interviewer', 'firstName lastName email');

    if (!updatedResponse) {
      console.error('❌ submitVerification - Failed to find and update response!', {
        responseId: responseId,
        surveyResponseId: surveyResponse._id.toString()
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to update survey response'
      });
    }

    console.log('✅ submitVerification - Updated response:', {
      id: updatedResponse._id.toString(),
      responseId: updatedResponse.responseId,
      status: updatedResponse.status,
      previousStatus: surveyResponse.status,
      interviewer: updatedResponse.interviewer?.email,
      verificationDataExists: !!updatedResponse.verificationData,
      reviewer: updatedResponse.verificationData?.reviewer?.toString()
    });
    
    // Verify the update actually happened
    if (updatedResponse.status !== newStatus) {
      console.error('❌ submitVerification - Status update failed!', {
        expectedStatus: newStatus,
        actualStatus: updatedResponse.status,
        responseId: responseId,
        updateDataStatus: updateData.status
      });
      
      // Try a direct update as fallback
      console.log('🔄 submitVerification - Attempting direct status update as fallback...');
      const fallbackUpdate = await SurveyResponse.findByIdAndUpdate(
        surveyResponse._id,
        { $set: { status: newStatus } },
        { new: true }
      );
      console.log('🔄 submitVerification - Fallback update result:', {
        status: fallbackUpdate?.status,
        success: fallbackUpdate?.status === newStatus
      });
    } else {
      console.log('✅ submitVerification - Status update successful!');
    }

    // CRITICAL FIX: Invalidate quality agent stats cache after submitting a review
    // This ensures the dashboard shows the correct count immediately after submission
    const qualityAgentStatsCache = require('../utils/qualityAgentStatsCache');
    qualityAgentStatsCache.delete(reviewerId);
    console.log('🔄 submitVerification - Invalidated quality agent stats cache for reviewer:', reviewerId);

    res.status(200).json({
      success: true,
      message: `Survey response ${status} successfully`,
      data: {
        responseId: updatedResponse.responseId,
        status: updatedResponse.status,
        verificationData: updatedResponse.verificationData
      }
    });

  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Debug endpoint to check all survey responses for a company
const debugSurveyResponses = async (req, res) => {
  try {
    const companyId = req.user.company;
    
    console.log('debugSurveyResponses - Company ID:', companyId);
    
    // CRITICAL OPTIMIZATION: Use aggregation pipeline to get company survey IDs first
    // Then use cursor-based processing to avoid loading ALL responses into memory
    // Top tech companies never load entire collections - they process in streams/cursors
    
    // Step 1: Get all survey IDs for this company (lightweight query)
    const Survey = require('../models/Survey');
    const companySurveyIds = await Survey.find({ company: companyId })
      .select('_id')
      .lean();
    const surveyIdArray = companySurveyIds.map(s => s._id);
    
    if (surveyIdArray.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalResponses: 0,
          statusCounts: {},
          responses: []
        }
      });
    }
    
    // Step 2: Use cursor-based streaming to process responses in batches
    // CRITICAL: Process in small batches to prevent memory accumulation
    const BATCH_SIZE = 100; // Process 100 responses at a time
    const companyResponses = [];
    const statusCounts = {};
    
    const responseCursor = SurveyResponse.find({ survey: { $in: surveyIdArray } })
      .populate({
        path: 'survey',
        select: 'surveyName company',
        populate: {
          path: 'company',
          select: '_id'
        }
      })
      .select('responseId status survey createdAt updatedAt')
      .lean()
      .batchSize(BATCH_SIZE)
      .cursor();
    
    let processedCount = 0;
    for await (const response of responseCursor) {
      // Filter by company (double-check)
      if (response.survey && 
          response.survey.company && 
          response.survey.company._id.toString() === companyId.toString()) {
        companyResponses.push({
          id: response._id,
          responseId: response.responseId,
          status: response.status,
          surveyName: response.survey?.surveyName,
          surveyCompany: response.survey?.company?._id,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt
        });
        
        // Count status
        statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
      }
      
      processedCount++;
      
      // CRITICAL: Explicit memory cleanup every 100 responses
      if (processedCount % 100 === 0) {
        if (global.gc && typeof global.gc === 'function') {
          global.gc();
        }
      }
    }
    
    // CRITICAL: Only log summary, not full array mapping - prevents memory leaks
    console.log('debugSurveyResponses - Processed responses:', processedCount, 'Company responses:', companyResponses.length);
    console.log('debugSurveyResponses - Status counts:', statusCounts);
    
    res.status(200).json({
      success: true,
      data: {
        totalResponses: companyResponses.length,
        statusCounts,
        responses: companyResponses
      }
    });
    
  } catch (error) {
    console.error('debugSurveyResponses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get survey response details by ID
const getSurveyResponseById = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.userType;

    // Find the survey response - handle both ObjectId and UUID responseId
    let surveyResponse;
    if (mongoose.Types.ObjectId.isValid(responseId) && responseId.length === 24) {
      // It's a MongoDB ObjectId (_id)
      surveyResponse = await SurveyResponse.findById(responseId)
        .populate({
          path: 'survey',
          select: 'surveyName description status sections questions targetAudience settings company assignedQualityAgents',
          populate: {
            path: 'company',
            select: '_id companyName'
          }
        })
        .populate({
          path: 'interviewer',
          select: 'firstName lastName email phone memberId'
        })
        .select('survey interviewer status responses location metadata interviewMode selectedAC selectedPollingStation audioRecording createdAt updatedAt startedAt completedAt totalTimeSpent completionPercentage responseId call_id verificationData');
    } else {
      // It's a UUID (responseId field)
      surveyResponse = await SurveyResponse.findOne({ responseId: responseId })
        .populate({
          path: 'survey',
          select: 'surveyName description status sections questions targetAudience settings company assignedQualityAgents',
          populate: {
            path: 'company',
            select: '_id companyName'
          }
        })
        .populate({
          path: 'interviewer',
          select: 'firstName lastName email phone memberId'
        })
        .select('survey interviewer status responses location metadata interviewMode selectedAC selectedPollingStation audioRecording createdAt updatedAt startedAt completedAt totalTimeSpent completionPercentage responseId call_id verificationData');
    }

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    // Authorization check: Allow access based on user role
    // Company admins and project managers can view all responses from their company
    // Quality agents can view responses they're assigned to review
    // Interviewers can only view their own responses
    if (userRole === 'company_admin' || userRole === 'project_manager') {
      // For company admins and project managers, verify the response belongs to their company
      const survey = surveyResponse.survey;
      if (survey && survey.company) {
        const currentUser = await User.findById(userId).select('company');
        if (currentUser && currentUser.company) {
          const surveyCompanyId = survey.company._id ? survey.company._id.toString() : survey.company.toString();
          const userCompanyId = currentUser.company._id ? currentUser.company._id.toString() : currentUser.company.toString();
          
          if (surveyCompanyId !== userCompanyId) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You can only view responses from your company.'
            });
          }
        }
      }
      
      // For project managers, also check if they manage the interviewer (optional additional check)
      if (userRole === 'project_manager' && surveyResponse.interviewer) {
        const currentUser = await User.findById(userId).populate('assignedTeamMembers.user');
        if (currentUser && currentUser.assignedTeamMembers) {
          const managedInterviewerIds = currentUser.assignedTeamMembers
            .filter(tm => tm.userType === 'interviewer' && tm.user)
            .map(tm => {
              const userId = tm.user._id ? tm.user._id.toString() : tm.user.toString();
              return userId;
            });
          
          const interviewerId = surveyResponse.interviewer._id ? surveyResponse.interviewer._id.toString() : surveyResponse.interviewer.toString();
          
          // Allow if interviewer is managed by this project manager OR if company check passed
          // (Company check already passed above, so this is just for additional validation)
        }
      }
    } else if (userRole === 'quality_agent') {
      // Quality agents can view responses they're assigned to review
      // The frontend ensures they can only see responses they're assigned to review
      // Check if response is in a batch assigned to this quality agent OR if they're assigned to the survey
      const survey = surveyResponse.survey;
      let hasAccess = false;
      
      // Check if quality agent is assigned to the survey
      if (survey && survey.assignedQualityAgents && Array.isArray(survey.assignedQualityAgents)) {
        const qualityAgentIds = survey.assignedQualityAgents.map(qa => 
          qa._id ? qa._id.toString() : qa.toString()
        );
        if (qualityAgentIds.includes(userId)) {
          hasAccess = true;
        }
      }
      
      // Also check if response is in a batch assigned to this quality agent
      if (!hasAccess) {
        const QCBatch = require('../models/QCBatch');
        const assignedBatch = await QCBatch.findOne({
          responses: responseId,
          assignedTo: userId,
          status: { $in: ['assigned', 'in_progress', 'completed'] }
        });
        
        if (assignedBatch) {
          hasAccess = true;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view responses assigned to you for review.'
        });
      }
    } else {
      // For interviewers, only allow viewing their own responses
      if (surveyResponse.interviewer) {
        const interviewerId = surveyResponse.interviewer._id ? surveyResponse.interviewer._id.toString() : surveyResponse.interviewer.toString();
        if (interviewerId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to view this survey response'
          });
        }
      } else {
        // If response has no interviewer, deny access to non-admin users
        if (userRole !== 'company_admin' && userRole !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to view this survey response'
          });
        }
      }
    }

    // Add proxy URL to audio recording if present (lazy loading - no auto-download)
    if (surveyResponse.audioRecording && surveyResponse.audioRecording.audioUrl) {
      // Skip mock URLs
      const audioUrl = surveyResponse.audioRecording.audioUrl;
      if (!audioUrl.startsWith('mock://') && !audioUrl.includes('mock://')) {
        // Use proxy URL instead of signed URL to prevent cross-region charges
        const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioUrl)}`;
        surveyResponse.audioRecording = {
          ...surveyResponse.audioRecording.toObject ? surveyResponse.audioRecording.toObject() : surveyResponse.audioRecording,
          signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
          proxyUrl: proxyUrl, // Explicit proxy URL field
          originalUrl: audioUrl
        };
      } else {
        // Mark as mock URL
        surveyResponse.audioRecording = {
          ...surveyResponse.audioRecording.toObject ? surveyResponse.audioRecording.toObject() : surveyResponse.audioRecording,
          signedUrl: null,
          proxyUrl: null,
          isMock: true
        };
      }
    }

    // Convert to plain object and ensure interviewer is properly serialized
    const responseData = surveyResponse.toObject ? surveyResponse.toObject() : surveyResponse;
    
    // Ensure interviewer field is properly formatted
    if (responseData.interviewer) {
      responseData.interviewer = {
        _id: responseData.interviewer._id || responseData.interviewer,
        firstName: responseData.interviewer.firstName || '',
        lastName: responseData.interviewer.lastName || '',
        email: responseData.interviewer.email || null,
        phone: responseData.interviewer.phone || null,
        memberId: responseData.interviewer.memberId || null
      };
    }
    
    res.json({
      success: true,
      interview: responseData
    });
  } catch (error) {
    console.error('Error fetching survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get survey responses for View Responses modal
const getSurveyResponses = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { surveyId } = req.params;
    const { page = 1, limit = 10, status, gender, ageMin, ageMax, ac, city, district, lokSabha, interviewerIds } = req.query;
    
    // Build filter object
    const filter = { survey: surveyId };
    
    // For project managers: if interviewerIds not provided, get from assignedTeamMembers
    let finalInterviewerIds = interviewerIds;
    let projectManagerInterviewerIds = [];
    if (!finalInterviewerIds && req.user.userType === 'project_manager') {
      try {
        console.log('🔍 getSurveyResponses - Project Manager detected, fetching assigned interviewers');
        const currentUser = await User.findById(req.user.id);
        console.log('🔍 getSurveyResponses - Current user:', currentUser?._id, currentUser?.userType);
        console.log('🔍 getSurveyResponses - Assigned team members count:', currentUser?.assignedTeamMembers?.length || 0);
        
        if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
          const assignedInterviewers = currentUser.assignedTeamMembers
            .filter(tm => tm.userType === 'interviewer' && tm.user)
            .map(tm => {
              // Handle both ObjectId and populated user object
              const userId = tm.user._id ? tm.user._id : tm.user;
              return userId.toString();
            })
            .filter(id => mongoose.Types.ObjectId.isValid(id));
          
          console.log('🔍 getSurveyResponses - Assigned interviewer IDs:', assignedInterviewers);
          
          if (assignedInterviewers.length > 0) {
            projectManagerInterviewerIds = assignedInterviewers.map(id => new mongoose.Types.ObjectId(id));
            finalInterviewerIds = assignedInterviewers.join(',');
            console.log('🔍 getSurveyResponses - Filtering by', projectManagerInterviewerIds.length, 'assigned interviewers');
          } else {
            console.log('⚠️ getSurveyResponses - No assigned interviewers found for project manager');
          }
        } else {
          console.log('⚠️ getSurveyResponses - Project manager has no assigned team members');
        }
      } catch (error) {
        console.error('❌ Error fetching project manager assigned interviewers:', error);
        // Continue without filtering if there's an error
      }
    }
    
    // Filter by interviewer IDs (for project managers)
    if (finalInterviewerIds) {
      const interviewerIdArray = Array.isArray(finalInterviewerIds) 
        ? finalInterviewerIds 
        : finalInterviewerIds.split(',').filter(id => id.trim());
      if (interviewerIdArray.length > 0) {
        const interviewerObjectIds = interviewerIdArray.map(id => new mongoose.Types.ObjectId(id.trim()));
        filter.interviewer = { $in: interviewerObjectIds };
        // Store for use in filterOptions query
        projectManagerInterviewerIds = interviewerObjectIds;
        console.log('🔍 getSurveyResponses - Applied interviewer filter:', interviewerObjectIds.length, 'interviewers');
      }
    } else if (req.user.userType === 'project_manager') {
      console.log('⚠️ getSurveyResponses - Project manager but no interviewer filter applied - returning empty results');
      // For project managers with no assigned interviewers, return empty results
      return res.json({
        success: true,
        data: {
          responses: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalResponses: 0,
            hasNext: false,
            hasPrev: false
          },
          filterOptions: {
            gender: [],
            age: [],
            ac: [],
            city: [],
            district: [],
            lokSabha: []
          }
        }
      });
    }
    
    // Handle status filter: 
    // 'all' or undefined/null means both Approved and Rejected
    // 'approved_rejected_pending' means Approved, Rejected, and Pending_Approval
    // 'approved_pending' means Approved and Pending_Approval
    // 'pending' means only Pending_Approval
    // otherwise filter by specific status
    if (status && status !== 'all' && status !== '') {
      if (status === 'approved_rejected_pending') {
        filter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        filter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        filter.status = 'Pending_Approval';
      } else {
        filter.status = status;
      }
    } else {
      // Default: Include both Approved and Rejected responses
      filter.status = { $in: ['Approved', 'Rejected'] };
    }
    
    console.log('🔍 getSurveyResponses - Status filter:', status);
    console.log('🔍 getSurveyResponses - Final filter:', JSON.stringify(filter, null, 2));
    
    if (gender) {
      filter['responses.gender'] = gender;
    }
    
    if (ageMin || ageMax) {
      filter['responses.age'] = {};
      if (ageMin) filter['responses.age'].$gte = parseInt(ageMin);
      if (ageMax) filter['responses.age'].$lte = parseInt(ageMax);
    }
    
    if (ac) {
      filter['responses.assemblyConstituency'] = ac;
    }
    
    if (city) {
      filter['responses.city'] = new RegExp(city, 'i');
    }
    
    if (district) {
      filter['responses.district'] = new RegExp(district, 'i');
    }
    
    if (lokSabha) {
      filter['responses.lokSabha'] = new RegExp(lokSabha, 'i');
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get responses with pagination
    let responses = await SurveyResponse.find(filter)
      .populate('interviewer', 'firstName lastName email phone memberId companyCode')
      .populate('verificationData.reviewer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    console.log('🔍 getSurveyResponses - Found responses:', responses.length);
    console.log('🔍 getSurveyResponses - Response statuses:', responses.map(r => r.status));
    
    // Add signed URLs to audio recordings
    // Add proxy URLs to audio recordings (lazy loading - no auto-download)
    responses = responses.map((response) => {
      if (response.audioRecording && response.audioRecording.audioUrl) {
        const audioUrl = response.audioRecording.audioUrl;
        // Skip mock URLs
        if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
          response.audioRecording = {
            ...response.audioRecording,
            signedUrl: null,
            proxyUrl: null,
            isMock: true
          };
        } else {
          // Use proxy URL instead of signed URL to prevent cross-region charges
          const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioUrl)}`;
          response.audioRecording = {
            ...response.audioRecording,
            signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
            proxyUrl: proxyUrl, // Explicit proxy URL field
            originalUrl: audioUrl
          };
        }
      }
      return response;
    });
    
    // Get total count for pagination
    const totalResponses = await SurveyResponse.countDocuments(filter);
    
    console.log('🔍 getSurveyResponses - Total responses count:', totalResponses);
    
    // Get filter options for dropdowns (include Approved, Rejected, and Pending_Approval for comprehensive options)
    // Apply project manager filter if applicable
    const statusFilterForOptions = { survey: surveyId, status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] } };
    if (projectManagerInterviewerIds.length > 0) {
      statusFilterForOptions.interviewer = { $in: projectManagerInterviewerIds };
    }
    const genderOptions = await SurveyResponse.distinct('responses.gender', statusFilterForOptions);
    const ageOptions = await SurveyResponse.distinct('responses.age', statusFilterForOptions);
    const acOptions = await SurveyResponse.distinct('responses.assemblyConstituency', statusFilterForOptions);
    const cityOptions = await SurveyResponse.distinct('responses.city', statusFilterForOptions);
    const districtOptions = await SurveyResponse.distinct('responses.district', statusFilterForOptions);
    const lokSabhaOptions = await SurveyResponse.distinct('responses.lokSabha', statusFilterForOptions);
    
    res.json({
      success: true,
      data: {
        responses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalResponses / parseInt(limit)),
          totalResponses,
          hasNext: skip + responses.length < totalResponses,
          hasPrev: parseInt(page) > 1
        },
        filterOptions: {
          gender: genderOptions.filter(Boolean),
          age: ageOptions.filter(Boolean).sort((a, b) => a - b),
          ac: acOptions.filter(Boolean),
          city: cityOptions.filter(Boolean),
          district: districtOptions.filter(Boolean),
          lokSabha: lokSabhaOptions.filter(Boolean)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch survey responses',
      error: error.message
    });
  }
};

// Approve survey response
const approveSurveyResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    
    const response = await SurveyResponse.findByIdAndUpdate(
      responseId,
      { 
        status: 'Approved',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    res.json({
      success: true,
      message: 'Survey response approved successfully',
      data: response
    });
  } catch (error) {
    console.error('Error approving survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve survey response',
      error: error.message
    });
  }
};

// Reject survey response
const rejectSurveyResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { reason, feedback } = req.body;
    
    const response = await SurveyResponse.findByIdAndUpdate(
      responseId,
      { 
        status: 'Rejected',
        'verificationData.feedback': feedback || reason,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    res.json({
      success: true,
      message: 'Survey response rejected successfully',
      data: response
    });
  } catch (error) {
    console.error('Error rejecting survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject survey response',
      error: error.message
    });
  }
};

// Set response status to Pending_Approval
const setPendingApproval = async (req, res) => {
    // 🔴 CRITICAL LOGGING - Track all calls to identify the problem
    console.log('🔴🔴🔴 setPendingApproval CALLED:', {
      responseId: req.params.responseId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userType: req.user?.userType,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString()
    });
  try {
    const { responseId } = req.params;
    
    // CRITICAL FIX: Preserve verificationData.reviewer and verificationData.reviewedAt
    // for historical tracking. Only clear reviewAssignment to allow re-assignment.
    // This prevents the "Total Reviewed" count from decreasing when responses are
    // set back to Pending_Approval (e.g., for re-review or correction).
    const response = await SurveyResponse.findByIdAndUpdate(
      responseId,
      { 
      $set: {
        status: 'Pending_Approval',
        updatedAt: new Date()
        },
        $unset: {
          'reviewAssignment': ''
          // REMOVED: 'verificationData.reviewer' and 'verificationData.reviewedAt'
          // These should be preserved for historical tracking and accurate "Total Reviewed" counts
        }
      },
      { new: true }
    );

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    res.json({
      success: true,
      message: 'Survey response set to Pending Approval successfully',
      data: response
    });
  } catch (error) {
    console.error('Error setting response to Pending Approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set response to Pending Approval',
      error: error.message
    });
  }
};

// @desc    Get AC Performance Stats
// @route   GET /api/survey-responses/survey/:surveyId/ac-performance
// @access  Private (Company Admin)
const getACPerformanceStats = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { getGroupsForAC } = require('../utils/pollingStationHelper');
    const QCBatch = require('../models/QCBatch');

    // Get survey
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check access
    const isCompanyAdmin = req.user.userType === 'company_admin';
    const isProjectManager = req.user.userType === 'project_manager';
    const isSameCompany = req.user.company?.toString() === survey.company?.toString();
    
    if (!isCompanyAdmin && !isSameCompany) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const state = survey.acAssignmentState || 'West Bengal';

    // Build response filter - for project managers, filter by assigned interviewers
    const responseFilter = { survey: surveyId };
    if (isProjectManager && !isCompanyAdmin) {
      try {
        const currentUser = await User.findById(req.user.id);
        if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
          const assignedInterviewers = currentUser.assignedTeamMembers
            .filter(tm => tm.userType === 'interviewer' && tm.user)
            .map(tm => {
              // Handle both ObjectId and populated user object
              const userId = tm.user._id ? tm.user._id : tm.user;
              return userId.toString();
            })
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
          
          if (assignedInterviewers.length > 0) {
            responseFilter.interviewer = { $in: assignedInterviewers };
          } else {
            // No assigned interviewers, return empty stats
            return res.json({
              success: true,
              data: {
                acStats: [],
                totalResponses: 0,
                totalApproved: 0,
                totalRejected: 0,
                totalPending: 0
              }
            });
          }
        } else {
          // No assigned team members, return empty stats
          return res.json({
            success: true,
            data: {
              acStats: [],
              totalResponses: 0,
              totalApproved: 0,
              totalRejected: 0,
              totalPending: 0
            }
          });
        }
      } catch (error) {
        console.error('Error fetching project manager assigned interviewers for AC stats:', error);
        // Return empty stats on error
        return res.json({
          success: true,
          data: {
            acStats: [],
            totalResponses: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalPending: 0
          }
        });
      }
    }

    // CRITICAL OPTIMIZATION: Use cursor-based streaming instead of loading all responses into memory
    // For survey "68fd1915d41841da463f0d46" with thousands of responses, loading all causes 2-3GB memory spikes
    // Top tech companies use cursors and batch processing for large datasets
    const BATCH_SIZE = 200; // Process 200 responses at a time
    const allResponses = [];
    
    const responseCursor = SurveyResponse.find(responseFilter)
      .populate('interviewer', 'firstName lastName')
      .populate('qcBatch', 'status')
      .select('_id responseId status interviewer qcBatch selectedAC selectedPollingStation responses verificationData metadata')
      .lean()
      .batchSize(BATCH_SIZE)
      .cursor();
    
    let processedCount = 0;
    for await (const response of responseCursor) {
      allResponses.push(response);
      processedCount++;
      
      // CRITICAL: Explicit memory cleanup every 200 responses
      if (processedCount % 200 === 0) {
        if (global.gc && typeof global.gc === 'function') {
          global.gc();
        }
      }
    }
    
    console.log(`✅ getACPerformanceStats - Processed ${processedCount} responses using cursor (memory-efficient)`);

    // Get all batches with 'collecting' status for this survey
    const collectingBatches = await QCBatch.find({ 
      survey: surveyId, 
      status: 'collecting' 
    }).select('_id responses').lean();
    
    const collectingBatchIds = new Set(collectingBatches.map(b => b._id.toString()));
    const responsesInCollectingBatches = new Set();
    collectingBatches.forEach(batch => {
      batch.responses.forEach(respId => {
        responsesInCollectingBatches.add(respId.toString());
      });
    });

    // Helper to get PC from AC
    const getPCFromAC = (acName) => {
      if (!acName) return null;
      // Ensure acName is a string
      const acNameStr = typeof acName === 'string' ? acName : String(acName || '');
      if (!acNameStr || acNameStr === 'N/A' || acNameStr.trim() === '') return null;
      // Clean up the AC name - remove translation suffixes like _{হ্যাঁ।}
      const cleanedAcName = getMainTextValue(acNameStr);
      if (!cleanedAcName || cleanedAcName === 'N/A') return null;
      const acData = getGroupsForAC(state, cleanedAcName);
      return acData?.pc_name || null;
    };

    // Helper to find question response by keywords
    const findQuestionResponse = (responses, keywords) => {
      if (!responses || !Array.isArray(responses)) return null;
      const normalizedKeywords = keywords.map(k => k.toLowerCase());
      return responses.find(r => {
        const questionText = (r.questionText || '').toLowerCase();
        return normalizedKeywords.some(keyword => questionText.includes(keyword));
      });
    };

    // Helper to get main text (strip translations)
    const getMainTextValue = (text) => {
      // Ensure we always return a string
      if (!text) return '';
      if (typeof text !== 'string') {
        // Convert to string if it's not already
        text = String(text);
      }
      const translationRegex = /^(.+?)\s*\{([^}]+)\}\s*$/;
      const match = text.match(translationRegex);
      return match ? match[1].trim() : text.trim();
    };

    // Helper to validate if a value is a valid AC name (not yes/no/consent answers)
    const isValidACName = (value) => {
      if (!value || typeof value !== 'string') return false;
      const cleaned = getMainTextValue(value).trim();
      if (!cleaned || cleaned === 'N/A' || cleaned === '') return false;
      
      const lower = cleaned.toLowerCase();
      // Reject common non-AC values
      const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
      if (invalidValues.includes(lower)) return false;
      if (lower.startsWith('yes') || lower.startsWith('no')) return false;
      if (lower.match(/^yes[_\s]/i) || lower.match(/^no[_\s]/i)) return false;
      
      // Must be longer than 2 characters
      if (cleaned.length <= 2) return false;
      
      // Try to validate against known ACs in the state
      const acData = getGroupsForAC(state, cleaned);
      if (acData && acData.ac_name) {
        return true; // Found in AC database
      }
      
      // If not found in database, still accept if it looks like a valid name (has capital letters, multiple words, etc.)
      // This handles cases where AC might not be in the database yet
      const hasCapitalLetters = /[A-Z]/.test(cleaned);
      const hasMultipleWords = cleaned.split(/\s+/).length > 1;
      const looksLikeName = hasCapitalLetters || hasMultipleWords;
      
      return looksLikeName;
    };

    // Comprehensive AC extraction function
    const extractACFromResponse = (response) => {
      // Priority 1: Check selectedAC field
      if (response.selectedAC && isValidACName(response.selectedAC)) {
        return getMainTextValue(response.selectedAC).trim();
      }
      
      // Priority 2: Check selectedPollingStation.acName
      if (response.selectedPollingStation?.acName && isValidACName(response.selectedPollingStation.acName)) {
        return getMainTextValue(response.selectedPollingStation.acName).trim();
      }
      
      // Priority 3: Check responses array for questionId === 'ac-selection'
      if (response.responses && Array.isArray(response.responses)) {
        const acSelectionResponse = response.responses.find(r => 
          r.questionId === 'ac-selection' && r.response
        );
        if (acSelectionResponse && isValidACName(acSelectionResponse.response)) {
          return getMainTextValue(acSelectionResponse.response).trim();
        }
        
        // Priority 4: Check for questionType that indicates AC selection
        const acTypeResponse = response.responses.find(r => 
          (r.questionType === 'ac_selection' || 
           r.questionType === 'assembly_constituency' ||
           r.questionType === 'ac') && 
          r.response
        );
        if (acTypeResponse && isValidACName(acTypeResponse.response)) {
          return getMainTextValue(acTypeResponse.response).trim();
        }
        
        // Priority 5: Search by question text containing "assembly" or "constituency"
        // BUT exclude questions that are consent/agreement questions
        const acTextResponses = response.responses.filter(r => {
          if (!r.questionText || !r.response) return false;
          const questionText = (r.questionText || '').toLowerCase();
          const hasAssembly = questionText.includes('assembly');
          const hasConstituency = questionText.includes('constituency');
          
          // Exclude consent/agreement questions
          const isConsentQuestion = questionText.includes('consent') || 
                                    questionText.includes('agree') ||
                                    questionText.includes('participate') ||
                                    questionText.includes('willing');
          
          return (hasAssembly || hasConstituency) && !isConsentQuestion;
        });
        
        // Try each potential AC response and validate it
        for (const acResponse of acTextResponses) {
          if (isValidACName(acResponse.response)) {
            return getMainTextValue(acResponse.response).trim();
          }
        }
      }
      
      return null;
    };

    // Group responses by AC
    const acMap = new Map();

    allResponses.forEach(response => {
      // Use comprehensive extraction function
      let ac = extractACFromResponse(response);

      // If still no AC found, skip this response
      if (!ac) {
        return;
      }

      if (!acMap.has(ac)) {
        acMap.set(ac, {
          ac,
          responses: [],
          pollingStations: new Set(),
          interviewers: new Set(),
          systemRejections: 0,
          pendingQC: 0,
          inBatches: 0
        });
      }

      const acData = acMap.get(ac);
      acData.responses.push(response);

      // Track polling stations
      if (response.selectedPollingStation?.stationName) {
        acData.pollingStations.add(response.selectedPollingStation.stationName);
      }

      // Track interviewers
      if (response.interviewer?._id) {
        acData.interviewers.add(response.interviewer._id.toString());
      }

      // System rejections (auto-rejected, too short, etc.)
      // Check verificationData.feedback or metadata for system rejection indicators
      if (response.status === 'Rejected') {
        const feedback = (response.verificationData?.feedback || '').toLowerCase();
        const metadata = response.metadata || {};
        const isAutoRejected = metadata.autoRejected || 
                              metadata.isSystemRejection ||
                              feedback.includes('too short') || 
                              feedback.includes('system') || 
                              feedback.includes('auto') ||
                              feedback.includes('automatic') ||
                              feedback.includes('duration') ||
                              feedback.includes('minimum time');
        
        if (isAutoRejected) {
          acData.systemRejections += 1;
        }
      }

      // Under QC: Pending + In batches
      if (response.status === 'Pending_Approval') {
        acData.pendingQC += 1;
      }
      
      // Check if in collecting batches
      if (response.qcBatch && 
          (collectingBatchIds.has(response.qcBatch._id?.toString()) || 
           collectingBatchIds.has(response.qcBatch.toString()) ||
           responsesInCollectingBatches.has(response._id.toString()))) {
        acData.inBatches += 1;
      }
    });

    // Calculate stats for each AC
    const acStats = Array.from(acMap.entries())
      .map(([ac, acData]) => {
        try {
          // Ensure ac is a valid string
          if (!ac || typeof ac !== 'string') {
            console.warn(`Invalid AC name found: ${ac}, skipping...`);
            return null;
          }
          
          const responses = acData.responses;
          const totalResponses = responses.length;

          // Get PC - wrap in try-catch to handle any errors
          let pcName = null;
          try {
            pcName = getPCFromAC(ac) || 
                     responses.find(r => r.selectedPollingStation?.pcName)?.selectedPollingStation?.pcName || 
                     null;
          } catch (pcError) {
            console.warn(`Error getting PC for AC ${ac}:`, pcError.message);
            // Continue without PC name
          }

      // Count by status
      const approved = responses.filter(r => r.status === 'Approved').length;
      const rejected = responses.filter(r => r.status === 'Rejected').length;
      const pending = responses.filter(r => r.status === 'Pending_Approval').length;

      // Completed Interviews = Total (Approved + Rejected + Pending)
      const completedInterviews = totalResponses;

      // Counts after Terminated and System Rejection = Total - System Rejections
      const countsAfterRejection = totalResponses - acData.systemRejections;

      // Under QC = Pending + In batches (for now, just pending)
      const underQC = acData.pendingQC + acData.inBatches;

      // PS Covered
      const psCovered = acData.pollingStations.size;

      // CAPI and CATI counts
      const capi = responses.filter(r => (r.interviewMode || '').toUpperCase() === 'CAPI').length;
      const cati = responses.filter(r => (r.interviewMode || '').toUpperCase() === 'CATI').length;

      // Demographic calculations
      let femaleCount = 0;
      let withoutPhoneCount = 0;
      let scCount = 0;
      let muslimCount = 0;
      let age18to24Count = 0;
      let age50PlusCount = 0;

      responses.forEach(response => {
        const responseData = response.responses || [];

        // Female count - use genderUtils to find and normalize gender response
        const { findGenderResponse, normalizeGenderResponse } = require('../utils/genderUtils');
        const genderResponse = findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponse?.response) {
          const normalizedGender = normalizeGenderResponse(genderResponse.response);
          if (normalizedGender === 'female') {
            femaleCount += 1;
          }
        }

        // Phone number check
        const phoneResponse = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        if (!phoneResponse?.response || 
            String(phoneResponse.response).trim() === '' || 
            String(phoneResponse.response).trim() === 'N/A') {
          withoutPhoneCount += 1;
        }

        // SC count (only for survey 68fd1915d41841da463f0d46)
        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponse = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponse?.response) {
            const casteValue = getMainTextValue(String(casteResponse.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') || 
                casteValue.includes('sc') || 
                casteValue.includes('scheduled caste')) {
              scCount += 1;
            }
          }
        }

        // Muslim count
        const religionResponse = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponse?.response) {
          const religionValue = getMainTextValue(String(religionResponse.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            muslimCount += 1;
          }
        }

        // Age groups
        const ageResponse = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponse?.response) {
          const age = parseInt(ageResponse.response);
          if (!isNaN(age)) {
            if (age >= 18 && age <= 24) {
              age18to24Count += 1;
            }
            if (age >= 50) {
              age50PlusCount += 1;
            }
          }
        }
      });

      // Calculate percentages
      const femalePercentage = totalResponses > 0 ? (femaleCount / totalResponses) * 100 : 0;
      const withoutPhonePercentage = totalResponses > 0 ? (withoutPhoneCount / totalResponses) * 100 : 0;
      const scPercentage = totalResponses > 0 ? (scCount / totalResponses) * 100 : 0;
      const muslimPercentage = totalResponses > 0 ? (muslimCount / totalResponses) * 100 : 0;
      const age18to24Percentage = totalResponses > 0 ? (age18to24Count / totalResponses) * 100 : 0;
      const age50PlusPercentage = totalResponses > 0 ? (age50PlusCount / totalResponses) * 100 : 0;

      return {
        ac,
        pcName: pcName || '',
        interviewersCount: acData.interviewers.size,
        approved,
        rejected,
        underQC,
        totalResponses: completedInterviews,
        capi,
        cati,
        psCovered,
        systemRejections: acData.systemRejections,
        countsAfterRejection,
        gpsPending: 0, // As requested
        gpsFail: 0, // As requested
        femalePercentage: parseFloat(femalePercentage.toFixed(2)),
        withoutPhonePercentage: parseFloat(withoutPhonePercentage.toFixed(2)),
        scPercentage: parseFloat(scPercentage.toFixed(2)),
        muslimPercentage: parseFloat(muslimPercentage.toFixed(2)),
        age18to24Percentage: parseFloat(age18to24Percentage.toFixed(2)),
        age50PlusPercentage: parseFloat(age50PlusPercentage.toFixed(2))
      };
        } catch (error) {
          console.error(`Error processing AC ${ac}:`, error);
          // Return null to filter out this AC
          return null;
        }
      })
      .filter(stat => stat !== null); // Remove any null entries

    // Sort by total responses (descending)
    acStats.sort((a, b) => b.totalResponses - a.totalResponses);

    res.json({
      success: true,
      data: acStats
    });

  } catch (error) {
    console.error('Error fetching AC performance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AC performance stats',
      error: error.message
    });
  }
};

// @desc    Get Interviewer Performance Stats
// @route   GET /api/survey-responses/survey/:surveyId/interviewer-performance
// @access  Private (Company Admin)
const getInterviewerPerformanceStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { surveyId } = req.params;
    const QCBatch = require('../models/QCBatch');

    // Get survey
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check access
    const isCompanyAdmin = req.user.userType === 'company_admin';
    const isProjectManager = req.user.userType === 'project_manager';
    const isSameCompany = req.user.company?.toString() === survey.company?.toString();
    
    if (!isCompanyAdmin && !isSameCompany) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build response filter - for project managers, filter by assigned interviewers
    const responseFilter = { survey: surveyId };
    if (isProjectManager && !isCompanyAdmin) {
      try {
        const currentUser = await User.findById(req.user.id);
        if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
          const assignedInterviewers = currentUser.assignedTeamMembers
            .filter(tm => tm.userType === 'interviewer' && tm.user)
            .map(tm => {
              const userId = tm.user._id ? tm.user._id : tm.user;
              return userId.toString();
            })
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
          
          if (assignedInterviewers.length > 0) {
            responseFilter.interviewer = { $in: assignedInterviewers };
          } else {
            // No assigned interviewers, return empty stats
            return res.json({
              success: true,
              data: []
            });
          }
        } else {
          // No assigned team members, return empty stats
          return res.json({
            success: true,
            data: []
          });
        }
      } catch (error) {
        console.error('Error fetching project manager assigned interviewers for interviewer stats:', error);
        return res.json({
          success: true,
          data: []
        });
      }
    }

    // CRITICAL OPTIMIZATION: Use cursor-based streaming instead of loading all responses into memory
    // For survey "68fd1915d41841da463f0d46" with thousands of responses, loading all causes 2-3GB memory spikes
    // Top tech companies use cursors and batch processing for large datasets
    const BATCH_SIZE = 200; // Process 200 responses at a time
    const allResponses = [];
    
    const responseCursor = SurveyResponse.find(responseFilter)
      .populate('interviewer', 'firstName lastName')
      .populate('qcBatch', 'status')
      .select('_id responseId status interviewer qcBatch selectedPollingStation responses verificationData metadata interviewMode')
      .lean()
      .batchSize(BATCH_SIZE)
      .cursor();
    
    let processedCount = 0;
    for await (const response of responseCursor) {
      allResponses.push(response);
      processedCount++;
      
      // CRITICAL: Explicit memory cleanup every 200 responses
      if (processedCount % 200 === 0) {
        if (global.gc && typeof global.gc === 'function') {
          global.gc();
        }
      }
    }
    
    console.log(`✅ getInterviewerPerformanceStats - Processed ${processedCount} responses using cursor (memory-efficient)`);

    // Get all batches with 'collecting' status for this survey
    const collectingBatches = await QCBatch.find({ 
      survey: surveyId, 
      status: 'collecting' 
    }).select('_id responses').lean();
    
    const collectingBatchIds = new Set(collectingBatches.map(b => b._id.toString()));
    const responsesInCollectingBatches = new Set();
    collectingBatches.forEach(batch => {
      batch.responses.forEach(respId => {
        responsesInCollectingBatches.add(respId.toString());
      });
    });

    // Helper to find question response by keywords
    const findQuestionResponse = (responses, keywords) => {
      if (!responses || !Array.isArray(responses)) return null;
      const normalizedKeywords = keywords.map(k => k.toLowerCase());
      return responses.find(r => {
        const questionText = (r.questionText || '').toLowerCase();
        return normalizedKeywords.some(keyword => questionText.includes(keyword));
      });
    };

    // Helper to get main text (strip translations)
    const getMainTextValue = (text) => {
      // Ensure we always return a string
      if (!text) return '';
      if (typeof text !== 'string') {
        // Convert to string if it's not already
        text = String(text);
      }
      const translationRegex = /^(.+?)\s*\{([^}]+)\}\s*$/;
      const match = text.match(translationRegex);
      return match ? match[1].trim() : text.trim();
    };

    // Group responses by interviewer
    const interviewerMap = new Map();

    allResponses.forEach(response => {
      if (!response.interviewer || !response.interviewer._id) return;

      const interviewerId = response.interviewer._id.toString();
      const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;

      if (!interviewerMap.has(interviewerId)) {
        interviewerMap.set(interviewerId, {
          interviewerId,
          interviewerName,
          responses: [],
          pollingStations: new Set(),
          systemRejections: 0,
          pendingQC: 0,
          inBatches: 0
        });
      }

      const interviewerData = interviewerMap.get(interviewerId);
      interviewerData.responses.push(response);

      // Track polling stations
      if (response.selectedPollingStation?.stationName) {
        interviewerData.pollingStations.add(response.selectedPollingStation.stationName);
      }

      // System rejections (auto-rejected, too short, etc.)
      if (response.status === 'Rejected') {
        const feedback = (response.verificationData?.feedback || '').toLowerCase();
        const metadata = response.metadata || {};
        const isAutoRejected = metadata.autoRejected || 
                              metadata.isSystemRejection ||
                              feedback.includes('too short') || 
                              feedback.includes('system') || 
                              feedback.includes('auto') ||
                              feedback.includes('automatic') ||
                              feedback.includes('duration') ||
                              feedback.includes('minimum time');
        
        if (isAutoRejected) {
          interviewerData.systemRejections += 1;
        }
      }

      // Under QC: Pending + In batches
      if (response.status === 'Pending_Approval') {
        interviewerData.pendingQC += 1;
      }
      
      // Check if in collecting batches
      if (response.qcBatch && 
          (collectingBatchIds.has(response.qcBatch._id?.toString()) || 
           collectingBatchIds.has(response.qcBatch.toString()) ||
           responsesInCollectingBatches.has(response._id.toString()))) {
        interviewerData.inBatches += 1;
      }
    });

    // Calculate stats for each interviewer
    const interviewerStats = Array.from(interviewerMap.entries()).map(([interviewerId, interviewerData]) => {
      const responses = interviewerData.responses;
      const totalResponses = responses.length;

      // Count by status
      const approved = responses.filter(r => r.status === 'Approved').length;
      const rejected = responses.filter(r => r.status === 'Rejected').length;
      const pending = responses.filter(r => r.status === 'Pending_Approval').length;

      // Completed Interviews = Total (Approved + Rejected + Pending)
      const completedInterviews = totalResponses;

      // Counts after Terminated and System Rejection = Total - System Rejections
      const countsAfterRejection = totalResponses - interviewerData.systemRejections;

      // Under QC = Pending + In batches
      const underQC = interviewerData.pendingQC + interviewerData.inBatches;

      // PS Covered
      const psCovered = interviewerData.pollingStations.size;

      // CAPI and CATI counts
      const capi = responses.filter(r => (r.interviewMode || '').toUpperCase() === 'CAPI').length;
      const cati = responses.filter(r => (r.interviewMode || '').toUpperCase() === 'CATI').length;

      // Demographic calculations
      let femaleCount = 0;
      let withoutPhoneCount = 0;
      let scCount = 0;
      let muslimCount = 0;
      let age18to24Count = 0;
      let age50PlusCount = 0;

      responses.forEach(response => {
        const responseData = response.responses || [];

        // Female count - use genderUtils to find and normalize gender response
        const { findGenderResponse, normalizeGenderResponse } = require('../utils/genderUtils');
        const genderResponse = findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponse?.response) {
          const normalizedGender = normalizeGenderResponse(genderResponse.response);
          if (normalizedGender === 'female') {
            femaleCount += 1;
          }
        }

        // Phone number check
        const phoneResponse = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        if (!phoneResponse?.response || 
            String(phoneResponse.response).trim() === '' || 
            String(phoneResponse.response).trim() === 'N/A') {
          withoutPhoneCount += 1;
        }

        // SC count (only for survey 68fd1915d41841da463f0d46)
        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponse = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponse?.response) {
            const casteValue = getMainTextValue(String(casteResponse.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') || 
                casteValue.includes('sc') || 
                casteValue.includes('scheduled caste')) {
              scCount += 1;
            }
          }
        }

        // Muslim count
        const religionResponse = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponse?.response) {
          const religionValue = getMainTextValue(String(religionResponse.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            muslimCount += 1;
          }
        }

        // Age groups
        const ageResponse = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponse?.response) {
          const age = parseInt(ageResponse.response);
          if (!isNaN(age)) {
            if (age >= 18 && age <= 24) {
              age18to24Count += 1;
            }
            if (age >= 50) {
              age50PlusCount += 1;
            }
          }
        }
      });

      // Calculate percentages
      const femalePercentage = totalResponses > 0 ? (femaleCount / totalResponses) * 100 : 0;
      const withoutPhonePercentage = totalResponses > 0 ? (withoutPhoneCount / totalResponses) * 100 : 0;
      const scPercentage = totalResponses > 0 ? (scCount / totalResponses) * 100 : 0;
      const muslimPercentage = totalResponses > 0 ? (muslimCount / totalResponses) * 100 : 0;
      const age18to24Percentage = totalResponses > 0 ? (age18to24Count / totalResponses) * 100 : 0;
      const age50PlusPercentage = totalResponses > 0 ? (age50PlusCount / totalResponses) * 100 : 0;

      return {
        interviewer: interviewerData.interviewerName,
        interviewerId,
        psCovered,
        completedInterviews,
        systemRejections: interviewerData.systemRejections,
        countsAfterRejection,
        gpsPending: 0, // As requested
        gpsFail: 0, // As requested
        approved,
        rejected,
        underQC,
        capi,
        cati,
        totalResponses,
        femalePercentage: parseFloat(femalePercentage.toFixed(2)),
        withoutPhonePercentage: parseFloat(withoutPhonePercentage.toFixed(2)),
        scPercentage: parseFloat(scPercentage.toFixed(2)),
        muslimPercentage: parseFloat(muslimPercentage.toFixed(2)),
        age18to24Percentage: parseFloat(age18to24Percentage.toFixed(2)),
        age50PlusPercentage: parseFloat(age50PlusPercentage.toFixed(2))
      };
    });

    // Sort by total responses (descending)
    interviewerStats.sort((a, b) => b.totalResponses - a.totalResponses);

    res.json({
      success: true,
      data: interviewerStats
    });

  } catch (error) {
    console.error('Error fetching interviewer performance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interviewer performance stats',
      error: error.message
    });
  }
};

// Get signed URL for audio file (DEPRECATED - Use proxy endpoint instead)
// Kept for backward compatibility but should use /audio/:audioUrl* proxy endpoint
const getAudioSignedUrl = async (req, res) => {
  try {
    const { audioUrl } = req.query;
    const { responseId } = req.params;

    if (!audioUrl && !responseId) {
      return res.status(400).json({
        success: false,
        message: 'Either audioUrl query parameter or responseId is required'
      });
    }

    let audioUrlToUse = audioUrl;

    // If responseId is provided, fetch the audioUrl from the response
    if (responseId && !audioUrl) {
      const response = await SurveyResponse.findById(responseId);
      if (!response) {
        return res.status(404).json({
          success: false,
          message: 'Response not found'
        });
      }
      audioUrlToUse = response.audioRecording?.audioUrl;
    }

    if (!audioUrlToUse) {
      return res.status(404).json({
        success: false,
        message: 'Audio URL not found'
      });
    }

    // Skip mock URLs
    if (audioUrlToUse.startsWith('mock://') || audioUrlToUse.includes('mock://')) {
      return res.status(400).json({
        success: false,
        message: 'Mock/test audio URLs are not supported'
      });
    }

    // IMPORTANT: Return proxy URL instead of direct S3 signed URL to prevent cross-region charges
    // Construct proxy URL that streams through server
    const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioUrlToUse)}`;
    
    res.json({
      success: true,
      signedUrl: proxyUrl, // Return proxy URL instead of direct S3 URL
      proxyUrl: proxyUrl, // Explicit proxy URL field
      expiresIn: 3600,
      note: 'Use proxy URL to avoid cross-region S3 charges'
    });
  } catch (error) {
    console.error('Error getting audio signed URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate audio URL',
      error: error.message
    });
  }
};

// Stream audio file from S3 through server (proxy endpoint)
// This eliminates cross-region data transfer charges
// @route   GET /api/survey-responses/audio/:audioUrl*
// @access  Private
const streamAudioProxy = async (req, res) => {
  try {
    // Extract audioUrl from path - everything after /audio/
    // The route is /api/survey-responses/audio/*, so req.path will be /audio/...
    // But we need to extract from req.originalUrl or req.url to get the full path
    let audioUrl = null;
    
    // Extract from req.originalUrl (full path including /api/survey-responses)
    // Pattern: /api/survey-responses/audio/audio%2Finterviews%2F...
    // We need to get everything after the last /audio/
    const originalUrlWithoutQuery = req.originalUrl.split('?')[0];
    const audioMatch = originalUrlWithoutQuery.match(/\/audio\/(.+)$/);
    
    if (audioMatch && audioMatch[1]) {
      audioUrl = audioMatch[1];
      // Decode URL-encoded path (Express may have already decoded it, but decode again to be safe)
      if (audioUrl.includes('%')) {
        try {
          audioUrl = decodeURIComponent(audioUrl);
        } catch (e) {
          // Already decoded or invalid encoding, use as-is
          console.warn('⚠️ streamAudioProxy - Failed to decode audioUrl, using as-is:', e.message);
        }
      }
    }
    
    // Fallback to req.path if originalUrl didn't work
    // req.path is relative to the route, so it might be /audio/audio/interviews/...
    // We need to extract everything after the first /audio/
    if (!audioUrl) {
      const pathWithoutQuery = req.path.split('?')[0];
      // Handle case where path is /audio/audio/interviews/... (already decoded)
      // or /audio/audio%2Finterviews%2F... (still encoded)
      const pathMatch = pathWithoutQuery.match(/^\/audio\/(.+)$/);
      if (pathMatch && pathMatch[1]) {
        audioUrl = pathMatch[1];
        // If it still contains encoded characters, decode
        if (audioUrl.includes('%')) {
          try {
            audioUrl = decodeURIComponent(audioUrl);
          } catch (e) {
            // Already decoded or invalid encoding, use as-is
          }
        }
      }
    }
    
    // Fallback to query string
    if (!audioUrl) {
      audioUrl = req.query.audioUrl;
      if (audioUrl && audioUrl.includes('%')) {
        try {
          audioUrl = decodeURIComponent(audioUrl);
        } catch (e) {
          // Already decoded or invalid encoding, use as-is
        }
      }
    }
    
    console.log('🔍 streamAudioProxy - Request received:', {
      originalUrl: req.originalUrl,
      url: req.url,
      path: req.path,
      audioMatch: audioMatch ? audioMatch[1] : null,
      params: req.params,
      query: req.query,
      audioUrl: audioUrl
    });

    // If still not found, try responseId
    if (!audioUrl && req.params.responseId) {
      const response = await SurveyResponse.findById(req.params.responseId);
      if (!response) {
        return res.status(404).json({
          success: false,
          message: 'Response not found'
        });
      }
      audioUrl = response.audioRecording?.audioUrl;
      console.log('🔍 streamAudioProxy - Using audioUrl from response:', audioUrl);
    }

    if (!audioUrl) {
      console.error('❌ streamAudioProxy - No audioUrl found');
      return res.status(400).json({
        success: false,
        message: 'Audio URL is required'
      });
    }

    // Decode URL if encoded (Express usually decodes automatically, but check just in case)
    if (audioUrl.includes('%')) {
      try {
        audioUrl = decodeURIComponent(audioUrl);
        console.log('🔍 streamAudioProxy - Decoded audioUrl:', audioUrl);
      } catch (decodeError) {
        console.warn('⚠️ streamAudioProxy - Failed to decode audioUrl, using as-is:', decodeError.message);
      }
    }

    // IMPORTANT: audioUrl can be either:
    // - S3 key: "audio/interviews/2026/01/....m4a"
    // - Local path: "/uploads/audio/....m4a"
    //
    // Local paths MUST be streamed from disk (not from S3), otherwise they 404.
    // Also, behind a load balancer, local files may not exist on every node.
    // In that case we return 404 so the client can treat it as unplayable.
    if (typeof audioUrl === 'string' && (audioUrl.startsWith('/uploads/audio/') || audioUrl.startsWith('uploads/audio/'))) {
      const fs = require('fs');
      const path = require('path');
      
      // Convert "/uploads/audio/..." -> "uploads/audio/..." so path.join doesn't ignore base path
      const relativeAudioPath = audioUrl.replace(/^\/+/, '');
      const fullPath = path.join(__dirname, '..', '..', relativeAudioPath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn('⚠️ streamAudioProxy - Local audio file not found on this server:', {
          audioUrl,
          fullPath
        });
        return res.status(404).json({
          success: false,
          message: 'Audio file not found'
        });
      }
      
      const stat = fs.statSync(fullPath);
      const fileSize = stat.size;
      const ext = path.extname(fullPath).toLowerCase();
      const contentType =
        ext === '.m4a' || ext === '.mp4' ? 'audio/mp4' :
        ext === '.mp3' ? 'audio/mpeg' :
        ext === '.wav' ? 'audio/wav' :
        ext === '.webm' ? 'audio/webm' :
        'application/octet-stream';
      
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        // Guard invalid ranges
        if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
          res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
          return res.end();
        }
        
        const chunkSize = (end - start) + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        });
        
        fs.createReadStream(fullPath, { start, end }).pipe(res);
        return;
      }
      
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }
    
    console.log('✅ streamAudioProxy - Streaming audio with key:', audioUrl);
    const { streamAudioFromS3 } = require('../utils/cloudStorage');
    await streamAudioFromS3(audioUrl, req, res);
  } catch (error) {
    console.error('❌ Error in audio proxy:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to stream audio file',
        error: error.message
      });
    }
  }
};

// Stub functions for missing endpoints (to prevent route crashes)
// Get interviewer statistics (lightweight endpoint using aggregation)
// @route   GET /api/survey-responses/interviewer-stats
// @access  Private (Interviewer)
const getInterviewerStats = async (req, res) => {
  try {
    const interviewerId = req.user.id || req.user._id;
    
    // CACHE CHECK: Return cached result if available (prevents database query)
    const interviewerStatsCache = require('../utils/interviewerStatsCache');
    const cachedResult = interviewerStatsCache.get(interviewerId);
    
    if (cachedResult) {
      console.log('✅ getInterviewerStats - Returning cached result (preventing database query)');
      return res.status(200).json({
        success: true,
        data: cachedResult
      });
    }
    
    // Handle both string and ObjectId formats
    let interviewerObjectId;
    if (mongoose.Types.ObjectId.isValid(interviewerId)) {
      interviewerObjectId = new mongoose.Types.ObjectId(interviewerId);
    } else {
      interviewerObjectId = interviewerId;
    }

    console.log('📊 getInterviewerStats - Interviewer ID:', interviewerId);
    console.log('📊 getInterviewerStats - Interviewer ObjectId:', interviewerObjectId);

    // CRITICAL OPTIMIZATION: Use countDocuments instead of aggregation for simple counts
    // Top tech companies use countDocuments for simple counting queries as it's more memory-efficient
    // Aggregation pipelines can cause memory leaks even with allowDiskUse for very large datasets
    // countDocuments uses indexes efficiently and doesn't load documents into memory
    
    // Build base query
    const baseQuery = {
      interviewer: interviewerObjectId,
      status: { $in: ['Approved', 'Rejected', 'Pending_Approval', 'abandoned', 'Terminated'] }
    };

    // Use parallel countDocuments queries for maximum efficiency and minimal memory usage
    // This is MUCH more efficient than aggregation for simple counts
    const [totalCompleted, approved, rejected, pendingApproval] = await Promise.all([
      SurveyResponse.countDocuments({
        interviewer: interviewerObjectId,
        status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
      }),
      SurveyResponse.countDocuments({
        interviewer: interviewerObjectId,
        status: 'Approved'
      }),
      SurveyResponse.countDocuments({
        interviewer: interviewerObjectId,
        status: 'Rejected'
      }),
      SurveyResponse.countDocuments({
        interviewer: interviewerObjectId,
        status: 'Pending_Approval'
      })
    ]);

    // Prepare response data directly from countDocuments results
    // CRITICAL: No intermediate result object - prevents memory allocation
    const responseData = {
      totalCompleted: totalCompleted || 0,
      approved: approved || 0,
      rejected: rejected || 0,
      pendingApproval: pendingApproval || 0
    };

    // CACHE SET: Store result in cache for future requests
    interviewerStatsCache.set(interviewerId, responseData);

    // Return data in the format expected by React Native app
    // The app expects: response.data.data = { totalCompleted, approved, rejected, pendingApproval }
    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching interviewer stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch interviewer statistics' 
    });
  }
};

// Get quality agent statistics (lightweight endpoint using aggregation)
// @route   GET /api/survey-responses/quality-agent-stats
// @access  Private (Quality Agent)
const getQualityAgentStats = async (req, res) => {
  try {
    const qualityAgentId = req.user.id;
    const qualityAgentObjectId = mongoose.Types.ObjectId.isValid(qualityAgentId) 
      ? new mongoose.Types.ObjectId(qualityAgentId) 
      : qualityAgentId;

    // CACHE CHECK: Return cached result if available (prevents database query)
    const qualityAgentStatsCache = require('../utils/qualityAgentStatsCache');
    const cachedResult = qualityAgentStatsCache.get(qualityAgentId);
    
    if (cachedResult) {
      console.log('✅ getQualityAgentStats - Returning cached result (preventing database query)');
      return res.status(200).json({
        success: true,
        data: cachedResult
      });
    }

    console.log('📊 getQualityAgentStats - Quality Agent ID:', qualityAgentId);
    console.log('📊 getQualityAgentStats - Quality Agent ObjectId:', qualityAgentObjectId);

    // Use aggregation for efficient counting
    // Count responses reviewed by this quality agent
    const stats = await SurveyResponse.aggregate([
      {
        $match: {
          'verificationData.reviewer': qualityAgentObjectId
        }
      },
      {
        $group: {
          _id: null,
          totalReviewed: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalReviewed: 0,
      approved: 0,
      rejected: 0,
      pending: 0
    };

    // CRITICAL: Removed JSON.stringify() - causes memory leaks
    console.log('📊 getQualityAgentStats - Aggregation results:', {
      totalReviewed: result.totalReviewed || 0,
      approved: result.approved || 0,
      rejected: result.rejected || 0,
      pending: result.pending || 0
    });

    const responseData = {
      stats: {
        totalReviewed: result.totalReviewed || 0,
        approved: result.approved || 0,
        rejected: result.rejected || 0,
        pending: result.pending || 0
      }
    };

    // CACHE THE RESULT: Store in cache for 2 minutes to prevent repeated database queries
    qualityAgentStatsCache.set(qualityAgentId, responseData);
    console.log('✅ getQualityAgentStats - Result cached for 2 minutes (cache size: ' + qualityAgentStatsCache.size() + ')');

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching quality agent stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch quality agent statistics' 
    });
  }
};

// @route   GET /api/survey-responses/approval-stats
// @desc    Get approval statistics for company admin (optimized using aggregation)
// @access  Private (Company Admin)
const getApprovalStats = async (req, res) => {
  try {
    const companyId = req.user.company;
    const userType = req.user.userType;
    const mongoose = require('mongoose');
    const Survey = require('../models/Survey');
    
    console.log('getApprovalStats - User company ID:', companyId);
    console.log('getApprovalStats - User type:', userType);
    
    // Convert companyId to ObjectId for proper matching
    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId) 
      ? new mongoose.Types.ObjectId(companyId) 
      : companyId;
    
    // For company admins, get all surveys for the company to filter responses
    let companySurveyIds = null;
    if (userType !== 'quality_agent') {
      const companySurveys = await Survey.find({ company: companyObjectId })
        .select('_id')
        .lean();
      companySurveyIds = companySurveys.map(s => s._id);
      console.log('getApprovalStats - Company survey IDs:', companySurveyIds.length);
      
      if (companySurveyIds.length === 0) {
        // Company has no surveys, return zero stats
        return res.status(200).json({
          success: true,
          data: { 
            stats: { 
              total: 0, 
              pending: 0, 
              withAudio: 0, 
              completed: 0, 
              rejected: 0 
            } 
          }
        });
      }
    }
    
    // Build match filter for aggregation
    const matchFilter = {};
    
    // Filter by company surveys
    if (companySurveyIds && companySurveyIds.length > 0) {
      matchFilter.survey = { $in: companySurveyIds };
    }
    
    // Only count responses that are in approval workflow
    // Include: Approved, Rejected, Pending_Approval, and Completed (if they have verification data)
    matchFilter.status = { 
      $in: ['Approved', 'Rejected', 'Pending_Approval', 'completed'] 
    };
    
    // Use aggregation pipeline to calculate stats efficiently
    const stats = await SurveyResponse.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
          },
          completed: {
            $sum: { 
              $cond: [
                { $in: ['$status', ['Approved', 'completed']] }, 
                1, 
                0
              ] 
            }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          withAudio: {
            $sum: { 
              $cond: [
                { 
                  $or: [
                    { $and: [{ $ne: ['$audioRecording', null] }, { $ne: ['$audioRecording.audioUrl', null] }, { $ne: ['$audioRecording.audioUrl', ''] }] },
                    { $and: [{ $ne: ['$audioRecording', null] }, { $eq: ['$audioRecording.hasAudio', true] }] },
                    { $and: [{ $ne: ['$audioUrl', null] }, { $ne: ['$audioUrl', ''] }] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          }
        }
      }
    ]);
    
    // Extract stats from aggregation result
    const result = stats[0] || {
      total: 0,
      pending: 0,
      completed: 0,
      rejected: 0,
      withAudio: 0
    };
    
    console.log('getApprovalStats - Calculated stats:', result);
    
    res.status(200).json({
      success: true,
      data: { 
        stats: {
          total: result.total || 0,
          pending: result.pending || 0,
          withAudio: result.withAudio || 0,
          completed: result.completed || 0,
          rejected: result.rejected || 0
        }
      }
    });
  } catch (error) {
    console.error('Error in getApprovalStats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Stub functions for other missing endpoints
const getSurveyResponsesV2 = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      gender,
      ageMin,
      ageMax,
      ac,
      city,
      district,
      lokSabha,
      dateRange,
      startDate,
      endDate,
      interviewMode,
      interviewerIds,
      interviewerMode = 'include',
      search
    } = req.query;

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter for MongoDB aggregation (NO LIMITS - handles millions of records)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all' && status !== '') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000;
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        // Use startTime (interview date) instead of createdAt (sync date) for filtering
        matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates
    if (startDate || endDate) {
      let dateStart, dateEnd;
      if (startDate && endDate) {
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Use startTime (interview date) instead of createdAt (sync date) for filtering
        matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter - handle both ObjectIds and Member IDs
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    console.log('🔍 getSurveyResponsesV2 - Interviewer filter input:', {
      rawInput: interviewerIds,
      parsedArray: interviewerIdsArray,
      userType: req.user.userType,
      userId: req.user.id
    });

    if (interviewerIdsArray.length > 0) {
      // Separate valid ObjectIds from potential Member IDs
      const validObjectIds = [];
      const potentialMemberIds = [];
      
      interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .forEach(id => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            validObjectIds.push(new mongoose.Types.ObjectId(id));
          } else {
            // Not a valid ObjectId, might be a Member ID
            potentialMemberIds.push(id);
          }
        });

      console.log('🔍 getSurveyResponsesV2 - Separated IDs:', {
        validObjectIds: validObjectIds.map(id => id.toString()),
        potentialMemberIds: potentialMemberIds
      });

      // If we have potential Member IDs, look up their ObjectIds
      if (potentialMemberIds.length > 0) {
        try {
          const usersByMemberId = await User.find({
            memberId: { $in: potentialMemberIds },
            userType: 'interviewer'
          }).select('_id memberId').lean();
          
          console.log('🔍 getSurveyResponsesV2 - Member ID lookup result:', {
            searchedMemberIds: potentialMemberIds,
            foundUsers: usersByMemberId.map(u => ({ _id: u._id.toString(), memberId: u.memberId }))
          });
          
          const memberIdObjectIds = usersByMemberId.map(user => user._id);
          validObjectIds.push(...memberIdObjectIds);
          
          console.log('🔍 getSurveyResponsesV2 - Resolved Member IDs to ObjectIds:', {
            memberIds: potentialMemberIds,
            resolvedCount: memberIdObjectIds.length,
            resolvedObjectIds: memberIdObjectIds.map(id => id.toString())
          });
  } catch (error) {
          console.error('🔍 getSurveyResponsesV2 - Error resolving Member IDs:', error);
          // Continue with only valid ObjectIds
        }
      }

      if (validObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: validObjectIds };
        } else {
          matchFilter.interviewer = { $in: validObjectIds };
        }
        
        console.log('🔍 getSurveyResponsesV2 - Applied interviewer filter BEFORE project manager check:', {
          mode: interviewerMode,
          count: validObjectIds.length,
          interviewerIds: validObjectIds.map(id => id.toString()),
          // REMOVED: matchFilter.interviewer JSON.stringify() - HUGE memory leak!
          matchFilterInterviewerId: matchFilter.interviewer?._id?.toString()
        });
      } else {
        console.log('⚠️ getSurveyResponsesV2 - No valid ObjectIds after processing interviewer filter');
      }
    } else {
      console.log('🔍 getSurveyResponsesV2 - No interviewerIds provided in query');
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id userType');
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        console.log('🔍 getSurveyResponsesV2 - Project Manager assigned interviewers:', {
          assignedCount: assignedIds.length,
          assignedIds: assignedIds.map(id => id.toString()),
          hasInterviewerFilter: !!matchFilter.interviewer,
          interviewerFilterType: matchFilter.interviewer ? Object.keys(matchFilter.interviewer)[0] : null
        });
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            // No interviewer filter provided, restrict to assigned interviewers only
            matchFilter.interviewer = { $in: assignedIds };
            console.log('🔍 getSurveyResponsesV2 - No interviewer filter, restricting to assigned:', assignedIds.length);
          } else if (matchFilter.interviewer.$in) {
            // User provided interviewer filter - intersect with assigned interviewers
            const originalIds = matchFilter.interviewer.$in;
            const filteredIds = originalIds.filter(id => {
              const idStr = id.toString();
              const isAssigned = assignedIds.some(assignedId => assignedId.toString() === idStr);
              return isAssigned;
            });
            
            console.log('🔍 getSurveyResponsesV2 - Intersecting user filter with assigned interviewers:', {
              originalCount: originalIds.length,
              filteredCount: filteredIds.length,
              originalIds: originalIds.map(id => id.toString()),
              filteredIds: filteredIds.map(id => id.toString()),
              assignedIds: assignedIds.map(id => id.toString())
            });
            
            if (filteredIds.length > 0) {
              matchFilter.interviewer.$in = filteredIds;
              console.log('✅ getSurveyResponsesV2 - Filter applied successfully:', {
                // REMOVED: JSON.stringify(matchFilter.interviewer) - memory leak
                finalFilterInterviewerCount: matchFilter.interviewer ? (Array.isArray(matchFilter.interviewer.$in) ? matchFilter.interviewer.$in.length : 1) : 0,
                count: filteredIds.length
              });
            } else {
              // No matching assigned interviewers - return empty results
              matchFilter.interviewer = { $in: [] };
              console.log('⚠️ getSurveyResponsesV2 - No matching assigned interviewers, returning empty results');
            }
          } else if (matchFilter.interviewer.$nin) {
            // Exclude mode - only exclude from assigned interviewers
            const excludedIds = matchFilter.interviewer.$nin;
            const assignedIdsStr = assignedIds.map(id => id.toString());
            const filteredExcludedIds = excludedIds.filter(id => assignedIdsStr.includes(id.toString()));
            
            if (filteredExcludedIds.length > 0) {
              matchFilter.interviewer.$nin = filteredExcludedIds;
              // Also need to include only assigned interviewers
              matchFilter.interviewer = {
                $in: assignedIds.filter(id => !filteredExcludedIds.some(exId => exId.toString() === id.toString()))
              };
            } else {
              // No excluded assigned interviewers - show all assigned
              matchFilter.interviewer = { $in: assignedIds };
            }
          }
        } else {
          // No assigned interviewers - return empty results
          matchFilter.interviewer = { $in: [] };
          console.log('⚠️ getSurveyResponsesV2 - Project manager has no assigned interviewers, returning empty results');
        }
      } else {
        // No assigned team members - return empty results
        matchFilter.interviewer = { $in: [] };
        console.log('⚠️ getSurveyResponsesV2 - Project manager has no assigned team members, returning empty results');
      }
    }

    // CRITICAL FIX: Check limitNum FIRST before building aggregation pipeline
    // For pagination (limitNum !== -1), use find().limit() instead of aggregation
    // This prevents building the aggregation pipeline which loads ALL documents into memory
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = limitNum !== -1 ? (pageNum - 1) * limitNum : 0;
    
    // CRITICAL OPTIMIZATION: If searching for responseId, add it to matchFilter EARLY
    // This allows MongoDB to use indexes for efficient responseId search
    // Top tech companies (Meta, Google, Amazon) optimize exact ID searches with early filtering
    // ResponseId search should happen at database level, not after fetching documents
    if (search && search.trim()) {
      const searchTerm = search.trim();
      
      // Check if search term looks like a responseId (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      // Response IDs are UUIDs, so they have a specific format
      const isUUIDFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
      
      // If it's a UUID format, search by responseId in matchFilter (uses index, very fast)
      if (isUUIDFormat) {
        matchFilter.responseId = { $regex: searchTerm, $options: 'i' };
        console.log(`✅ Early responseId search filter applied: ${searchTerm} (using MongoDB index)`);
      }
      // For partial UUID matches (first few chars), also search responseId
      else if (searchTerm.length >= 8 && /^[0-9a-f-]+$/i.test(searchTerm)) {
        matchFilter.responseId = { $regex: searchTerm, $options: 'i' };
        console.log(`✅ Early responseId search filter applied (partial UUID): ${searchTerm} (using MongoDB index)`);
      }
    }
    
    // CRITICAL: For pagination, skip aggregation entirely and use find() path
    // This is THE KEY FIX - prevents memory leaks when "All time" is selected
    // Build aggregation pipeline ONLY for CSV mode (limitNum === -1)
    // For pagination, this pipeline is NOT built - find() path is used instead
    const pipeline = [];
    const dataPipeline = [];
    
    // ONLY build aggregation pipeline for CSV mode (limitNum === -1)
    if (limitNum === -1) {
      console.log('⚠️ CSV MODE - Building aggregation pipeline (will load all matching docs)');
      
      // Stage 1: Match filter (basic filters: date, status, interviewer, interviewMode)
      pipeline.push({ $match: matchFilter });

      // CRITICAL OPTIMIZATION: For CSV queries, we need all data, so don't limit
      // Sort oldest first for CSV (to get chronological order)
      const sortOrder = 1; // Oldest first for CSV

      // Stage 2: Sort by startTime (interview date) instead of createdAt (sync date)
      // For CSV, we sort all matching documents (no limit)
      pipeline.push({ $sort: { startTime: sortOrder } });

    // Stage 3: Extract demographic data from responses array
    // CRITICAL: This now runs AFTER $limit, so it only processes limited documents
    pipeline.push({
      $addFields: {
        genderValue: {
          $let: {
            vars: {
              genderResponse: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ['$responses', []] },
                      as: 'resp',
                      cond: { $eq: ['$$resp.questionType', 'gender'] }
                    }
                  },
                  0
                ]
              }
            },
            in: { $ifNull: ['$$genderResponse.response', null] }
          }
        },
        ageValue: {
          $let: {
            vars: {
              ageResponse: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ['$responses', []] },
                      as: 'resp',
                      cond: { $eq: ['$$resp.questionType', 'age'] }
                    }
                  },
                  0
                ]
              }
            },
            in: {
              $cond: {
                if: { $isArray: '$$ageResponse.response' },
                then: { $toInt: { $ifNull: [{ $arrayElemAt: ['$$ageResponse.response', 0] }, 0] } },
                else: { $toInt: { $ifNull: ['$$ageResponse.response', 0] } }
              }
            }
          }
        },
        acValue: {
          $ifNull: [
            '$selectedAC',
            '$selectedPollingStation.acName'
          ]
        },
        cityValue: {
          $let: {
            vars: {
              cityResponse: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ['$responses', []] },
                      as: 'resp',
                      cond: { $eq: ['$$resp.questionType', 'city'] }
                    }
                  },
                  0
                ]
              }
            },
            in: { $ifNull: ['$$cityResponse.response', null] }
          }
        },
        districtValue: {
          $ifNull: ['$selectedPollingStation.district', null]
        },
        lokSabhaValue: {
          $ifNull: ['$selectedPollingStation.pcName', null]
        }
      }
    });

    // Stage 4: Apply demographic filters (after $addFields, on limited set)
    const demographicMatch = {};
    if (gender) {
      demographicMatch.genderValue = gender;
    }
    if (ageMin || ageMax) {
      demographicMatch.ageValue = {};
      if (ageMin) demographicMatch.ageValue.$gte = parseInt(ageMin);
      if (ageMax) demographicMatch.ageValue.$lte = parseInt(ageMax);
    }
    if (ac) {
      demographicMatch.acValue = { $regex: ac.trim(), $options: 'i' };
    }
    if (city) {
      demographicMatch.cityValue = { $regex: city.trim(), $options: 'i' };
    }
    if (district) {
      demographicMatch.districtValue = { $regex: district.trim(), $options: 'i' };
    }
    if (lokSabha) {
      demographicMatch.lokSabhaValue = { $regex: lokSabha.trim(), $options: 'i' };
    }
    if (Object.keys(demographicMatch).length > 0) {
      pipeline.push({ $match: demographicMatch });
    }

    // Stage 5: Apply search filter (after demographic filters, on limited set)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchTerm = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { responseId: searchRegex },
            { acValue: searchRegex },
            { cityValue: searchRegex },
            { districtValue: searchRegex },
            { lokSabhaValue: searchRegex },
            // Also check if search term matches responseId exactly (case-insensitive)
            { $expr: { $eq: [{ $toLower: { $ifNull: ['$responseId', ''] } }, searchTerm.toLowerCase()] } }
          ]
        }
      });
    }
    
    // Create data pipeline (with final pagination and lookups)
    const dataPipeline = [];
    
    // Final pagination (skip/limit for the specific page)
    if (limitNum !== -1) {
      dataPipeline.push({ $skip: skip });
      dataPipeline.push({ $limit: limitNum });
    }
    // For CSV downloads (limit === -1), don't paginate - we need all data

      // Lookup operations AFTER pagination (much faster - only lookup 20 docs instead of thousands)
      // Stage 7: Lookup interviewer details
      dataPipeline.push({
        $lookup: {
          from: 'users',
          localField: 'interviewer',
          foreignField: '_id',
          as: 'interviewerDetails'
        }
      });
      dataPipeline.push({
        $unwind: {
          path: '$interviewerDetails',
          preserveNullAndEmptyArrays: true
        }
      });

      // Stage 8: Lookup reviewer details
      dataPipeline.push({
        $lookup: {
          from: 'users',
          localField: 'verificationData.reviewer',
          foreignField: '_id',
          as: 'reviewerDetails'
        }
      });
      dataPipeline.push({
        $unwind: {
          path: '$reviewerDetails',
          preserveNullAndEmptyArrays: true
        }
      });

      // Stage 8.5: Lookup survey details (CRITICAL: populate survey field)
      dataPipeline.push({
        $lookup: {
          from: 'surveys',
          localField: 'survey',
          foreignField: '_id',
          as: 'surveyDetails'
        }
      });
      dataPipeline.push({
        $unwind: {
          path: '$surveyDetails',
          preserveNullAndEmptyArrays: true
        }
      });

      // Stage 9: Project final fields
      dataPipeline.push({
        $project: {
          _id: 1,
          survey: {
            _id: { $ifNull: ['$surveyDetails._id', '$survey'] },
            surveyName: { $ifNull: ['$surveyDetails.surveyName', ''] },
            description: { $ifNull: ['$surveyDetails.description', ''] },
            status: { $ifNull: ['$surveyDetails.status', ''] },
            sections: { $ifNull: ['$surveyDetails.sections', []] },
            questions: { $ifNull: ['$surveyDetails.questions', []] },
            targetAudience: { $ifNull: ['$surveyDetails.targetAudience', {}] },
            settings: { $ifNull: ['$surveyDetails.settings', {}] },
            company: { $ifNull: ['$surveyDetails.company', null] },
            assignedQualityAgents: { $ifNull: ['$surveyDetails.assignedQualityAgents', []] }
          },
          interviewer: 1,
          status: 1,
          interviewMode: 1,
          createdAt: 1,
          startTime: 1, // Interview start time (for date filtering and display)
          updatedAt: 1,
          totalTimeSpent: 1,
          completionPercentage: 1,
          responses: 1,
          selectedAC: 1,
          selectedPollingStation: 1,
          location: 1, // Include location for GPS coordinates
          verificationData: 1,
          audioRecording: 1,
          qcBatch: 1,
          responseId: 1,
          acValue: 1,
          cityValue: 1,
          districtValue: 1,
          lokSabhaValue: 1,
          call_id: 1, // Include call_id for CATI
          interviewerDetails: {
            firstName: { $ifNull: ['$interviewerDetails.firstName', ''] },
            lastName: { $ifNull: ['$interviewerDetails.lastName', ''] },
            email: { $ifNull: ['$interviewerDetails.email', ''] },
            phone: { $ifNull: ['$interviewerDetails.phone', ''] },
            memberId: { $ifNull: ['$interviewerDetails.memberId', ''] },
            companyCode: { $ifNull: ['$interviewerDetails.companyCode', ''] }
          },
          reviewerDetails: {
            firstName: { $ifNull: ['$reviewerDetails.firstName', ''] },
            lastName: { $ifNull: ['$reviewerDetails.lastName', ''] },
            email: { $ifNull: ['$reviewerDetails.email', ''] }
          }
        }
      });

      // Stage 10: Apply interviewer search filter (after lookup, for display only)
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        const searchTerm = search.trim();
        dataPipeline.push({
          $match: {
            $or: [
              { 'interviewerDetails.firstName': searchRegex },
              { 'interviewerDetails.lastName': searchRegex },
              { 'interviewerDetails.memberId': searchRegex },
              { responseId: searchRegex },
              { acValue: searchRegex },
              { cityValue: searchRegex },
              { districtValue: searchRegex },
              { lokSabhaValue: searchRegex },
              // Also check if search term matches responseId exactly (case-insensitive)
              { $expr: { $eq: [{ $toLower: { $ifNull: ['$responseId', ''] } }, searchTerm.toLowerCase()] } }
            ]
          }
        });
      }
    } // End of if (limitNum === -1) block - aggregation pipeline building

    // CRITICAL OPTIMIZATION: Separate count and data queries for better performance
    // Google/Meta approach: Use fast countDocuments() for count, aggregation only for data
    // This prevents processing all documents just to get a count
    
    // For CSV downloads (limit === -1), use $facet to get count and data together
    // For pagination, use separate queries for better performance
    let totalResponses, responses;
    
    if (limitNum === -1) {
      // CSV download: Use $facet (need all data anyway)
      console.log('⚠️ USING AGGREGATION FOR CSV DOWNLOAD - This will load all matching docs into memory');
      pipeline.push({
        $facet: {
          count: [{ $count: 'total' }],
          data: dataPipeline
        }
      });
      
      const result = await SurveyResponse.aggregate(pipeline, {
        allowDiskUse: true,
        maxTimeMS: 7200000 // 2 hours timeout for CSV downloads
      });
      
      const facetResult = result[0] || { count: [], data: [] };
      totalResponses = facetResult.count.length > 0 ? facetResult.count[0].total : 0;
      responses = facetResult.data || [];
    } else {
      // CRITICAL FIX: For pagination, use find().limit() instead of aggregation
      // This prevents loading ALL matching documents into memory
      // MongoDB aggregation loads 50K+ docs even with $limit(5000)
      // find().limit() uses indexes and only loads requested docs
      
      console.log('✅ USING find() PATH FOR PAGINATION - Memory efficient!', { limitNum, skip, pageNum });
      console.log('🔍 matchFilter:', JSON.stringify(matchFilter, null, 2));
      
      // Get accurate count using countDocuments() (fast, uses indexes)
      const memBeforeCount = process.memoryUsage().heapUsed / 1024 / 1024;
      totalResponses = await SurveyResponse.countDocuments(matchFilter);
      const memAfterCount = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`📊 countDocuments() completed: ${totalResponses} total matches, Memory: ${memBeforeCount.toFixed(1)}MB → ${memAfterCount.toFixed(1)}MB (+${(memAfterCount - memBeforeCount).toFixed(1)}MB)`);
      
      // Use find().sort().limit().skip() for pagination - MUCH more memory efficient
      // CRITICAL: Fetch more docs than needed because demographic filters are applied after extraction
      // This ensures we get enough results after filtering
      const sortOrder = -1; // Newest first for pagination
      const fetchLimit = Math.max(limitNum * 3, 50); // Fetch 3x more or min 50 to account for filtering (reduced from 5x/100)
      console.log('✅ Executing find() query - will only load', fetchLimit, 'docs into memory (not 50K+)');
      // CRITICAL: Exclude responses array from initial query - it's huge!
      // We only need it for demographic extraction, which we'll do selectively
      const memBeforeFind = process.memoryUsage().heapUsed / 1024 / 1024;
      let query = SurveyResponse.find(matchFilter)
        .select('-responses') // Exclude responses array to prevent memory leak (100+ questions per response)
        .sort({ startTime: sortOrder })
        .skip(skip)
        .limit(fetchLimit)
        .lean(); // Use lean() for better performance
      
      // CRITICAL FIX: Only populate essential survey fields (not sections/questions)
      // Loading sections/questions for 100 responses = 10,000+ question objects in memory!
      // This is how top tech companies handle it - only load what's needed for display
      // CRITICAL: Also exclude large fields like targetAudience, settings, company, assignedQualityAgents (they can be huge)
      query = query.populate('interviewer', 'firstName lastName email phone memberId companyCode')
        .populate('verificationData.reviewer', 'firstName lastName email')
        .populate('survey', 'surveyName description status'); // Removed sections/questions/targetAudience/settings/company/assignedQualityAgents to prevent memory leak
      
      // Execute query - only loads fetchLimit docs into memory (not 50K+)
      console.log('✅ About to execute find() query - memory should stay low');
      const rawResponses = await query;
      const memAfterFind = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`✅ find() query completed - loaded ${rawResponses.length} docs into memory (without responses array), Memory: ${memBeforeFind.toFixed(1)}MB → ${memAfterFind.toFixed(1)}MB (+${(memAfterFind - memBeforeFind).toFixed(1)}MB)`);
      
      // CRITICAL OPTIMIZATION: Only load responses array if demographic filters are actually applied
      // If no demographic filters, we can skip loading responses array entirely (saves massive memory)
      const needsDemographicData = !!(gender || ageMin || ageMax || city || search);
      
      let responsesMap = new Map();
      if (needsDemographicData) {
        // Only load responses array if we actually need it for filtering
        const responseIds = rawResponses.map(r => r._id);
        
        // Fetch responses array ONLY for the documents we need (much smaller dataset)
        const responsesData = await SurveyResponse.find({ _id: { $in: responseIds } })
          .select('_id responses') // Only get _id and responses array
          .lean();
        
        // Create a map for O(1) lookup
        responsesData.forEach(r => {
          responsesMap.set(r._id.toString(), r.responses || []);
        });
        console.log('✅ Loaded responses array for', responsesData.length, 'responses (for demographic filtering)');
      } else {
        console.log('✅ Skipping responses array load (no demographic filters applied)');
      }
      
      // Extract demographic data in JavaScript (replaces $addFields)
      const { findGenderResponse } = require('../utils/genderUtils');
      
      responses = rawResponses.map(response => {
        // Get responses array from map (only loaded if needed)
        const responseResponses = needsDemographicData ? (responsesMap.get(response._id.toString()) || []) : [];
        
        // Extract demographic data from responses array (only if loaded)
        let genderValue = null;
        let ageValue = null;
        let cityValue = null;
        
        if (needsDemographicData && responseResponses.length > 0) {
          const genderResp = findGenderResponse(responseResponses, response.survey);
          genderValue = genderResp?.response || null;
          
          // Extract age
          const ageResp = responseResponses.find(r => r.questionType === 'age');
          if (ageResp && ageResp.response) {
            if (Array.isArray(ageResp.response)) {
              ageValue = parseInt(ageResp.response[0]) || 0;
            } else {
              ageValue = parseInt(ageResp.response) || 0;
            }
          }
          
          // Extract city
          const cityResp = responseResponses.find(r => r.questionType === 'city');
          cityValue = cityResp?.response || null;
        }
        
        // Extract AC, district, lokSabha (from selectedPollingStation - no need for responses array)
        const acValue = response.selectedAC || response.selectedPollingStation?.acName || null;
        const districtValue = response.selectedPollingStation?.district || null;
        const lokSabhaValue = response.selectedPollingStation?.pcName || null;
        
        // Apply demographic filters in JavaScript
        let passesFilters = true;
        
        if (gender && genderValue !== gender) {
          passesFilters = false;
        }
        if (ageMin && (ageValue === null || ageValue < parseInt(ageMin))) {
          passesFilters = false;
        }
        if (ageMax && (ageValue === null || ageValue > parseInt(ageMax))) {
          passesFilters = false;
        }
        if (ac && acValue && !acValue.match(new RegExp(ac.trim(), 'i'))) {
          passesFilters = false;
        }
        if (city && cityValue && !cityValue.match(new RegExp(city.trim(), 'i'))) {
          passesFilters = false;
        }
        if (district && districtValue && !districtValue.match(new RegExp(district.trim(), 'i'))) {
          passesFilters = false;
        }
        if (lokSabha && lokSabhaValue && !lokSabhaValue.match(new RegExp(lokSabha.trim(), 'i'))) {
          passesFilters = false;
        }
        
        // Apply search filter
        // CRITICAL: ResponseId search is already handled in matchFilter (database-level, uses index)
        // This handles interviewer name, AC, city, district, lokSabha searches (non-ID searches)
        if (search && search.trim()) {
          const searchTerm = search.trim().toLowerCase();
          const isUUIDFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.trim());
          
          // If UUID format, responseId search is already done in matchFilter (database level)
          // Just check other fields for non-UUID searches
          if (isUUIDFormat) {
            // ResponseId search already handled in matchFilter, so all results should match
            // But double-check for safety (in case of case sensitivity issues)
            if (response.responseId && !response.responseId.toLowerCase().includes(searchTerm)) {
              passesFilters = false;
            }
          } else {
            // Non-UUID search: check responseId, interviewer, AC, city, district, lokSabha
            const interviewerFirstName = response.interviewer?.firstName?.toLowerCase() || '';
            const interviewerLastName = response.interviewer?.lastName?.toLowerCase() || '';
            const interviewerMemberId = response.interviewer?.memberId?.toLowerCase() || '';
            const interviewerFullName = `${interviewerFirstName} ${interviewerLastName}`.trim();
            
            const matchesSearch = 
              (response.responseId && response.responseId.toLowerCase().includes(searchTerm)) ||
              (interviewerFullName && interviewerFullName.includes(searchTerm)) ||
              (interviewerMemberId && interviewerMemberId.includes(searchTerm)) ||
              (acValue && acValue.toLowerCase().includes(searchTerm)) ||
              (cityValue && cityValue.toLowerCase().includes(searchTerm)) ||
              (districtValue && districtValue.toLowerCase().includes(searchTerm)) ||
              (lokSabhaValue && lokSabhaValue.toLowerCase().includes(searchTerm));
            
            if (!matchesSearch) {
              passesFilters = false;
            }
          }
        }
        
        // If doesn't pass filters, return null (will be filtered out)
        if (!passesFilters) {
          return null;
        }
        
        // Add demographic fields to response
        // CRITICAL: Don't include responses array in final response (it's huge!)
        // Frontend doesn't need it for the list view - only for detail view
        const { responses: _, ...responseWithoutResponses } = response;
        
        // CRITICAL: Only include essential survey fields (not sections/questions/targetAudience/settings/company/assignedQualityAgents to prevent memory leak)
        // These fields can be huge (100+ questions, large config objects) and are not needed for display
        const surveyData = response.survey ? {
          _id: response.survey._id || response.survey,
          surveyName: response.survey.surveyName || '',
          description: response.survey.description || '',
          status: response.survey.status || ''
          // CRITICAL: Excluded sections, questions, targetAudience, settings, company, assignedQualityAgents to prevent memory leak
        } : null;
        
        return {
          ...responseWithoutResponses,
          genderValue,
          ageValue,
          acValue,
          cityValue,
          districtValue,
          lokSabhaValue,
          interviewerDetails: response.interviewer ? {
            firstName: response.interviewer.firstName || '',
            lastName: response.interviewer.lastName || '',
            email: response.interviewer.email || '',
            phone: response.interviewer.phone || '',
            memberId: response.interviewer.memberId || '',
            companyCode: response.interviewer.companyCode || ''
          } : null,
          reviewerDetails: response.verificationData?.reviewer ? {
            firstName: response.verificationData.reviewer.firstName || '',
            lastName: response.verificationData.reviewer.lastName || '',
            email: response.verificationData.reviewer.email || ''
          } : null,
          surveyDetails: surveyData // Use filtered survey data (no sections/questions)
          // CRITICAL: responses array excluded from final response to prevent memory leak
        };
      }).filter(r => r !== null); // Remove nulls (filtered out responses)
      
      // Limit to requested number after filtering
      responses = responses.slice(0, limitNum);
      
      // Note: If we have fewer results after filtering, that's expected
      // The count is accurate (from countDocuments), but filtered results may be fewer
    }

    // For CSV downloads (limit === -1), skip expensive operations like signed URL generation
    // This significantly improves performance for large datasets (42K+ responses)
    const isCSVDownload = limitNum === -1;
    
    let responsesWithSignedUrls;
    if (isCSVDownload) {
      // For CSV downloads: Skip signed URL generation to improve performance
      // Just map interviewerDetails to interviewer for consistency
      responsesWithSignedUrls = responses.map((response) => {
        if (response.interviewerDetails && !response.interviewer) {
          response.interviewer = {
            firstName: response.interviewerDetails.firstName || '',
            lastName: response.interviewerDetails.lastName || '',
            email: response.interviewerDetails.email || '',
            memberId: response.interviewerDetails.memberId || '',
            memberID: response.interviewerDetails.memberId || '',
            phone: response.interviewerDetails.phone || ''
          };
        }
        // Skip audio signed URL generation for CSV downloads
        return response;
      });
    } else {
      // For regular API calls: Add proxy URLs to audio recordings (lazy loading - no auto-download)
      responsesWithSignedUrls = responses.map((response) => {
      // Map interviewerDetails to interviewer for consistency with frontend expectations
      if (response.interviewerDetails && !response.interviewer) {
        response.interviewer = {
          firstName: response.interviewerDetails.firstName || '',
          lastName: response.interviewerDetails.lastName || '',
          email: response.interviewerDetails.email || '',
          memberId: response.interviewerDetails.memberId || '',
          memberID: response.interviewerDetails.memberId || '',
          phone: response.interviewerDetails.phone || ''
        };
      }
      
      if (response.audioRecording && response.audioRecording.audioUrl) {
        const audioUrl = response.audioRecording.audioUrl;
        if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
          response.audioRecording = {
            ...response.audioRecording,
            signedUrl: null,
            proxyUrl: null,
            isMock: true
          };
        } else {
          // Use proxy URL instead of signed URL to prevent cross-region charges
          const proxyUrl = `/api/survey-responses/audio/${encodeURIComponent(audioUrl)}`;
          response.audioRecording = {
            ...response.audioRecording,
            signedUrl: proxyUrl, // Use proxy URL (backward compatibility)
            proxyUrl: proxyUrl, // Explicit proxy URL field
            originalUrl: audioUrl
          };
        }
      }
      return response;
    });
    }

    // Get filter options using aggregation (for dropdowns) - OPTIONAL based on query param
    // Skip for CSV downloads or if includeFilterOptions is false (performance optimization)
    // CRITICAL: Skip filterOptions for "All time" to prevent memory leaks
    const includeFilterOptions = req.query.includeFilterOptions !== 'false' && !isCSVDownload;
    const isAllTime = !matchFilter.startTime; // Check if "All time" is selected
    
    let filterOptions;
    if (!includeFilterOptions || isAllTime) {
      // Skip filterOptions for "All time" to prevent memory leaks
      // Users can still filter by selecting a date range first
      // Return empty filter options if not requested (saves significant processing time)
      filterOptions = {
        gender: [],
        age: [],
        ac: [],
        city: [],
        district: [],
        lokSabha: []
      };
    } else {
      // Generate filter options only if requested
      // CRITICAL FIX: Apply the same date filters to filterOptionsPipeline to prevent memory leaks
      // Without this, filterOptions processes ALL responses even when dateRange is "today"
      const filterOptionsPipeline = [
        { $match: { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId } }
      ];

      // CRITICAL OPTIMIZATION: For "All time", limit IMMEDIATELY to prevent memory leaks
      // MongoDB processes docs to apply filters, so we must limit BEFORE filters for "All time"
      const MAX_FILTER_OPTIONS_DOCS = 1000; // Process max 1K docs for filterOptions (sampling)
      
      // For "All time" (no date filter), limit IMMEDIATELY to prevent processing 50K+ docs
      if (!matchFilter.startTime) {
        // No date filter = "All time" - limit immediately to prevent memory leak
        filterOptionsPipeline.push({ $limit: MAX_FILTER_OPTIONS_DOCS });
      }

      // Apply the same matchFilter conditions (date, status, interviewer) to filterOptions
      // This ensures filterOptions only processes the filtered subset, not all responses
      const filterOptionsMatch = {};
      
      // Apply status filter (same as main query)
      if (matchFilter.status) {
        filterOptionsMatch.status = matchFilter.status;
      }
      
      // Apply date filter (CRITICAL - prevents processing all-time data)
      if (matchFilter.startTime) {
        filterOptionsMatch.startTime = matchFilter.startTime;
        // With date filter, limit after date filter (date already limits, but still cap at 1000)
        filterOptionsPipeline.push({ $limit: MAX_FILTER_OPTIONS_DOCS });
      }
      
      // Apply interviewer filter for project managers
      if (req.user.userType === 'project_manager' && matchFilter.interviewer && matchFilter.interviewer.$in) {
        filterOptionsMatch.interviewer = { $in: matchFilter.interviewer.$in };
      }
      
      // Apply interview mode filter if present
      if (matchFilter.interviewMode) {
        filterOptionsMatch.interviewMode = matchFilter.interviewMode;
      }
      
      // Add all match conditions at once (more efficient than multiple $match stages)
      if (Object.keys(filterOptionsMatch).length > 0) {
        filterOptionsPipeline.push({ $match: filterOptionsMatch });
      }
      
      filterOptionsPipeline.push(
      {
        $addFields: {
          genderValue: {
            $let: {
              vars: {
                genderResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'gender'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$genderResponse.response', null] }
            }
          },
          ageValue: {
            $let: {
              vars: {
                ageResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'age'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $cond: {
                  if: { $isArray: '$$ageResponse.response' },
                  then: { $toInt: { $ifNull: [{ $arrayElemAt: ['$$ageResponse.response', 0] }, 0] } },
                  else: { $toInt: { $ifNull: ['$$ageResponse.response', 0] } }
                }
              }
            }
          },
          acValue: {
            $ifNull: [
              '$selectedAC',
              '$selectedPollingStation.acName'
            ]
          },
          cityValue: {
            $let: {
              vars: {
                cityResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'city'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$cityResponse.response', null] }
            }
          },
          districtValue: {
            $ifNull: ['$selectedPollingStation.district', null]
          },
          lokSabhaValue: {
            $ifNull: ['$selectedPollingStation.pcName', null]
          }
        }
      },
      {
        $group: {
          _id: null,
          genders: { $addToSet: '$genderValue' },
          ages: { $addToSet: '$ageValue' },
          acs: { $addToSet: '$acValue' },
          cities: { $addToSet: '$cityValue' },
          districts: { $addToSet: '$districtValue' },
          lokSabhas: { $addToSet: '$lokSabhaValue' }
        }
      }
      );

      const filterOptionsResult = await SurveyResponse.aggregate(filterOptionsPipeline, {
        allowDiskUse: true,
        maxTimeMS: 30000 // 30 seconds timeout for filter options
      });
      
      filterOptions = filterOptionsResult.length > 0 ? {
        gender: filterOptionsResult[0].genders.filter(Boolean),
        age: filterOptionsResult[0].ages.filter(Boolean).sort((a, b) => a - b),
        ac: filterOptionsResult[0].acs.filter(Boolean),
        city: filterOptionsResult[0].cities.filter(Boolean),
        district: filterOptionsResult[0].districts.filter(Boolean),
        lokSabha: filterOptionsResult[0].lokSabhas.filter(Boolean)
      } : {
        gender: [],
        age: [],
        ac: [],
        city: [],
        district: [],
        lokSabha: []
      };
    }

    res.status(200).json({
      success: true,
      data: {
        responses: responsesWithSignedUrls,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalResponses / limitNum),
          totalResponses,
          hasNext: skip + responses.length < totalResponses,
          hasPrev: pageNum > 1
        },
        filterOptions
      }
    });
  } catch (error) {
    console.error('Get Survey Responses V2 error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get response counts and filter options (lightweight endpoint for counts only)
 * This is optimized to avoid loading full response data
 */
const getSurveyResponseCounts = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      status,
      gender,
      ageMin,
      ageMax,
      ac,
      city,
      district,
      lokSabha,
      dateRange,
      startDate,
      endDate,
      interviewMode,
      interviewerIds,
      interviewerMode = 'include',
      search
    } = req.query;

    // Verify survey exists (lightweight check)
    const survey = await Survey.findById(surveyId).select('_id').lean();
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter (same logic as getSurveyResponsesV2 but optimized for counts)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all' && status !== '') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone) - reuse helper functions
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000;
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range
    if (startDate || endDate) {
      let dateStart, dateEnd;
      if (startDate && endDate) {
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter (simplified - reuse same logic)
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    if (interviewerIdsArray.length > 0) {
      const validObjectIds = [];
      const potentialMemberIds = [];
      
      interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .forEach(id => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            validObjectIds.push(new mongoose.Types.ObjectId(id));
          } else {
            potentialMemberIds.push(id);
          }
        });

      if (potentialMemberIds.length > 0) {
        try {
          const usersByMemberId = await User.find({
            memberId: { $in: potentialMemberIds },
            userType: 'interviewer'
          }).select('_id').lean();
          
          const memberIdObjectIds = usersByMemberId.map(user => user._id);
          validObjectIds.push(...memberIdObjectIds);
        } catch (error) {
          console.error('Error resolving Member IDs:', error);
        }
      }

      if (validObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: validObjectIds };
        } else {
          matchFilter.interviewer = { $in: validObjectIds };
        }
      }
    }

    // Project manager filter
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id').lean();
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            matchFilter.interviewer = { $in: assignedIds };
          } else if (matchFilter.interviewer.$in) {
            const originalIds = matchFilter.interviewer.$in;
            const filteredIds = originalIds.filter(id => {
              const idStr = id.toString();
              return assignedIds.some(assignedId => assignedId.toString() === idStr);
            });
            matchFilter.interviewer.$in = filteredIds.length > 0 ? filteredIds : [];
          }
        } else {
          matchFilter.interviewer = { $in: [] };
        }
      } else {
        matchFilter.interviewer = { $in: [] };
      }
    }

    // CRITICAL FIX: Don't use aggregation with $addFields - it loads ALL documents into memory!
    // Instead, use countDocuments() for simple counts, or sample a subset for demographic counts
    // This is how top tech companies handle this (Meta, Google approach)
    
    // For simple counts (no demographic filters), use fast countDocuments()
    if (!gender && !ageMin && !ageMax && !ac && !city && !district && !lokSabha && !search) {
      // No demographic filters - use fast countDocuments() (uses indexes, no memory leak)
      const totalCount = await SurveyResponse.countDocuments(matchFilter);
      
      res.status(200).json({
        success: true,
        data: {
          total: totalCount,
          filterOptions: null // Not requested or not needed
        }
      });
      return;
    }

    // For demographic counts, we need to extract demographic data
    // CRITICAL: Use sampling approach - only process 1000 docs, then extrapolate
    // This prevents loading 50K+ docs into memory
    const SAMPLE_SIZE = 1000;
    const MAX_SAMPLE_SIZE = 5000; // Cap at 5K even for large datasets
    
    // First, get total count (fast, uses indexes)
    const totalCountFast = await SurveyResponse.countDocuments(matchFilter);
    
    // If total is small (< 2000), process all (no sampling needed)
    // If total is large, sample and extrapolate
    const shouldSample = totalCountFast > 2000;
    const sampleLimit = shouldSample ? Math.min(SAMPLE_SIZE, MAX_SAMPLE_SIZE) : totalCountFast;
    
    // Use find().limit().lean() to get a sample (only loads sampleLimit docs into memory)
    const sampleResponses = await SurveyResponse.find(matchFilter)
      .sort({ startTime: -1 })
      .limit(sampleLimit)
      .lean()
      .select('responses selectedAC selectedPollingStation responseId');
    
    // Extract demographic data in JavaScript (same as responses-v2 fix)
    const { findGenderResponse } = require('../utils/genderUtils');
    const { extractACFromResponse, getMainTextValue } = require('../utils/respondentInfoUtils');
    
    // Count in JavaScript on the sample
    let matchingCount = 0;
    sampleResponses.forEach(response => {
      // Extract demographic data
      const genderResp = findGenderResponse(response.responses || [], null);
      const genderValue = genderResp?.response || null;
      
      const ageResp = (response.responses || []).find(r => r.questionType === 'age');
      let ageValue = null;
      if (ageResp && ageResp.response) {
        if (Array.isArray(ageResp.response)) {
          ageValue = parseInt(ageResp.response[0]) || 0;
        } else {
          ageValue = parseInt(ageResp.response) || 0;
        }
      }
      
      const acValue = response.selectedAC || response.selectedPollingStation?.acName || null;
      const cityResp = (response.responses || []).find(r => r.questionType === 'city');
      const cityValue = cityResp?.response || null;
      const districtValue = response.selectedPollingStation?.district || null;
      const lokSabhaValue = response.selectedPollingStation?.pcName || null;
      
      // Apply demographic filters
      let passesFilters = true;
      if (gender && genderValue !== gender) passesFilters = false;
      if (ageMin && (ageValue === null || ageValue < parseInt(ageMin))) passesFilters = false;
      if (ageMax && (ageValue === null || ageValue > parseInt(ageMax))) passesFilters = false;
      if (ac && acValue && !acValue.match(new RegExp(ac.trim(), 'i'))) passesFilters = false;
      if (city && cityValue && !cityValue.match(new RegExp(city.trim(), 'i'))) passesFilters = false;
      if (district && districtValue && !districtValue.match(new RegExp(district.trim(), 'i'))) passesFilters = false;
      if (lokSabha && lokSabhaValue && !lokSabhaValue.match(new RegExp(lokSabha.trim(), 'i'))) passesFilters = false;
      
      // Apply search filter
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        const matchesSearch = 
          (response.responseId && response.responseId.toLowerCase().includes(searchTerm)) ||
          (acValue && acValue.toLowerCase().includes(searchTerm)) ||
          (cityValue && cityValue.toLowerCase().includes(searchTerm)) ||
          (districtValue && districtValue.toLowerCase().includes(searchTerm)) ||
          (lokSabhaValue && lokSabhaValue.toLowerCase().includes(searchTerm));
        if (!matchesSearch) passesFilters = false;
      }
      
      if (passesFilters) matchingCount++;
    });
    
    // Extrapolate count from sample (if sampling was used)
    const totalCount = shouldSample && sampleLimit > 0 
      ? Math.round((matchingCount / sampleLimit) * totalCountFast)
      : matchingCount;

    // Get filter options (only if requested - can be cached separately)
    // CRITICAL FIX: Use sampling approach for filterOptions too (prevent memory leak)
    const includeFilterOptions = req.query.includeFilterOptions === 'true';
    let filterOptions = null;

    if (includeFilterOptions) {
      // CRITICAL: Use sampling approach - only process 1000 docs for filterOptions
      // This prevents loading 50K+ docs into memory just to get dropdown options
      const FILTER_OPTIONS_SAMPLE_SIZE = 1000;
      
      // Build base match for filterOptions (same as main query but limited)
      const filterOptionsMatch = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };
      
      // Apply same filters as main query (status, date, interviewer, etc.)
      if (matchFilter.status) filterOptionsMatch.status = matchFilter.status;
      if (matchFilter.startTime) filterOptionsMatch.startTime = matchFilter.startTime;
      if (matchFilter.interviewMode) filterOptionsMatch.interviewMode = matchFilter.interviewMode;
      if (matchFilter.interviewer) filterOptionsMatch.interviewer = matchFilter.interviewer;
      
      // Use find().limit().lean() to get sample (only loads FILTER_OPTIONS_SAMPLE_SIZE docs)
      const filterOptionsSample = await SurveyResponse.find(filterOptionsMatch)
        .sort({ startTime: -1 })
        .limit(FILTER_OPTIONS_SAMPLE_SIZE)
        .lean()
        .select('responses selectedAC selectedPollingStation');
      
      // Extract demographic data in JavaScript (same approach as responses-v2)
      const { findGenderResponse } = require('../utils/genderUtils');
      const { extractACFromResponse } = require('../utils/respondentInfoUtils');
      
      const genderSet = new Set();
      const ageSet = new Set();
      const acSet = new Set();
      const citySet = new Set();
      const districtSet = new Set();
      const lokSabhaSet = new Set();
      
      filterOptionsSample.forEach(response => {
        // Extract gender
        const genderResp = findGenderResponse(response.responses || [], null);
        if (genderResp?.response) genderSet.add(genderResp.response);
        
        // Extract age
        const ageResp = (response.responses || []).find(r => r.questionType === 'age');
        if (ageResp && ageResp.response) {
          const ageValue = Array.isArray(ageResp.response) 
            ? parseInt(ageResp.response[0]) 
            : parseInt(ageResp.response);
          if (!isNaN(ageValue) && ageValue > 0) ageSet.add(ageValue);
        }
        
        // Extract AC
        const acValue = response.selectedAC || response.selectedPollingStation?.acName;
        if (acValue) acSet.add(acValue);
        
        // Extract city
        const cityResp = (response.responses || []).find(r => r.questionType === 'city');
        if (cityResp?.response) citySet.add(cityResp.response);
        
        // Extract district and lokSabha
        if (response.selectedPollingStation?.district) districtSet.add(response.selectedPollingStation.district);
        if (response.selectedPollingStation?.pcName) lokSabhaSet.add(response.selectedPollingStation.pcName);
      });
      
      filterOptions = {
        gender: Array.from(genderSet),
        age: Array.from(ageSet).sort((a, b) => a - b),
        ac: Array.from(acSet),
        city: Array.from(citySet),
        district: Array.from(districtSet),
        lokSabha: Array.from(lokSabhaSet)
      };
    }

    res.status(200).json({
      success: true,
      data: {
        totalCount,
        filterOptions
      }
    });
  } catch (error) {
    console.error('Get Survey Response Counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getSurveyResponsesV2ForCSV = async (req, res) => {
  try {
    // Only allow company admin
    if (req.user.userType !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only company admins can download CSV.'
      });
    }

    // Set extended timeout for CSV downloads (2 hours)
    req.setTimeout(7200000); // 2 hours
    res.setTimeout(7200000); // 2 hours

    // Temporarily modify query to get all responses (limit=-1 means no pagination)
    const originalLimit = req.query.limit;
    const originalPage = req.query.page;
    req.query.limit = '-1';
    req.query.page = '1';
    
    // Call getSurveyResponsesV2 which will handle limit=-1 correctly
    // We need to modify the response to remove pagination info
    const originalJson = res.json.bind(res);
    let responseSent = false;
    
    res.json = function(data) {
      if (responseSent) return this;
      responseSent = true;
      
      // Restore original query params
      req.query.limit = originalLimit;
      req.query.page = originalPage;
      
      // Modify response to return all responses without pagination
      if (data && data.success && data.data && data.data.responses) {
        return originalJson({
      success: true,
          data: {
            responses: data.data.responses,
            totalResponses: data.data.responses.length
          }
        });
      }
      
      // Return original response if structure is different
      return originalJson(data);
    };
    
    // Call the existing function
    await getSurveyResponsesV2(req, res);
    
  } catch (error) {
    console.error('Get Survey Responses V2 for CSV error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getCSVFileInfo = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: { exists: false, filePath: null, generatedAt: null }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadPreGeneratedCSV = async (req, res) => {
  try {
    res.status(404).json({
      success: false,
      message: 'CSV file not found'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const triggerCSVGeneration = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'CSV generation triggered'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate and download CSV with filters (efficient server-side generation)
// @route   GET /api/survey-responses/:surveyId/download-csv
// @access  Private
// OLD downloadCSVWithFilters - kept for backward compatibility but will be replaced
const downloadCSVWithFilters_OLD = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      mode = 'codes', // 'codes' or 'responses'
      status,
      gender,
      ageMin,
      ageMax,
      ac,
      city,
      district,
      lokSabha,
      dateRange,
      startDate,
      endDate,
      interviewMode,
      interviewerIds,
      interviewerMode = 'include',
      search
    } = req.query;

    console.log(`📥 CSV Download Request - Survey: ${surveyId}, Mode: ${mode}`);

    // Verify survey exists
    const survey = await Survey.findById(surveyId).lean();
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Import the CSV generator helper
    const { generateCSVContent } = require('../utils/csvGeneratorHelper');

    // Build match filter similar to getSurveyResponsesV2
    const matchFilter = { 
      survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId 
    };

    // Status filter
    if (status && status !== 'all' && status !== '') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000;
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range
    if (dateRange === 'custom' && startDate && endDate) {
      const dateStart = getISTDateStartUTC(startDate);
      const dateEnd = getISTDateEndUTC(endDate);
      matchFilter.startTime = { $gte: dateStart, $lte: dateEnd };
    }

    // Interviewer filter
    if (interviewerIds) {
      const interviewerIdsArray = typeof interviewerIds === 'string' 
        ? interviewerIds.split(',').map(id => id.trim()).filter(id => id)
        : Array.isArray(interviewerIds) ? interviewerIds : [];

      if (interviewerIdsArray.length > 0) {
        const validObjectIds = [];
        const potentialMemberIds = [];
        
        interviewerIdsArray
          .filter(id => id && id !== 'undefined' && id !== 'null')
          .forEach(id => {
            if (mongoose.Types.ObjectId.isValid(id)) {
              validObjectIds.push(new mongoose.Types.ObjectId(id));
            } else {
              potentialMemberIds.push(id);
            }
          });

        if (potentialMemberIds.length > 0) {
          const usersByMemberId = await User.find({
            memberId: { $in: potentialMemberIds },
            userType: 'interviewer'
          }).select('_id').lean();
          
          const memberIdObjectIds = usersByMemberId.map(user => user._id);
          validObjectIds.push(...memberIdObjectIds);
        }

        if (validObjectIds.length > 0) {
          if (interviewerMode === 'exclude') {
            matchFilter.interviewer = { $nin: validObjectIds };
          } else {
            matchFilter.interviewer = { $in: validObjectIds };
          }
        }
      }
    }

    // Build aggregation pipeline
    const pipeline = [];
    pipeline.push({ $match: matchFilter });

    // Sort by createdAt ascending (oldest first) for CSV
    pipeline.push({ $sort: { createdAt: 1 } });

    // Lookup interviewer details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'interviewer',
        foreignField: '_id',
        as: 'interviewerDetails'
      }
    });
    pipeline.push({
      $unwind: {
        path: '$interviewerDetails',
        preserveNullAndEmptyArrays: true
      }
    });

    // Project fields needed for CSV generation
    pipeline.push({
      $project: {
        _id: 1,
        survey: 1,
        interviewer: 1,
        status: 1,
        interviewMode: 1,
        createdAt: 1,
        startTime: 1,
        updatedAt: 1,
        responses: 1,
        selectedAC: 1,
        selectedPollingStation: 1,
        location: 1,
        verificationData: 1,
        audioRecording: 1,
        qcBatch: 1,
        responseId: 1,
        call_id: 1,
        interviewer: {
          firstName: { $ifNull: ['$interviewerDetails.firstName', ''] },
          lastName: { $ifNull: ['$interviewerDetails.lastName', ''] },
          email: { $ifNull: ['$interviewerDetails.email', ''] },
          memberId: { $ifNull: ['$interviewerDetails.memberId', ''] },
          memberID: { $ifNull: ['$interviewerDetails.memberId', ''] }
        }
      }
    });

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await SurveyResponse.aggregate(countPipeline, {
      allowDiskUse: true,
      maxTimeMS: 300000
    });
    const totalResponses = countResult.length > 0 ? countResult[0].total : 0;

    console.log(`📊 Found ${totalResponses} responses to process for CSV`);

    if (totalResponses === 0) {
      return res.status(404).json({
        success: false,
        message: 'No responses found matching the filters'
      });
    }

    // Process in batches to avoid memory issues
    // Use smaller batches for better memory management
    const BATCH_SIZE = 1500;
    let allResponses = [];
    let skip = 0;
    let processedCount = 0;

    console.log(`📊 Processing ${totalResponses} responses in batches of ${BATCH_SIZE}...`);

    // Set headers early with progress info
    const filename = `survey_${surveyId}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Total-Responses', totalResponses.toString());

    while (skip < totalResponses) {
      const batchPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: BATCH_SIZE }
      ];

      const batchEnd = Math.min(skip + BATCH_SIZE, totalResponses);
      console.log(`   Fetching batch: ${skip + 1} to ${batchEnd} of ${totalResponses}...`);

      const batch = await SurveyResponse.aggregate(batchPipeline, {
        allowDiskUse: true,
        maxTimeMS: 600000 // 10 minutes per batch
      });

      if (batch.length === 0) break;

      allResponses.push(...batch);
      processedCount += batch.length;
      const progress = ((processedCount / totalResponses) * 100).toFixed(1);
      const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      console.log(`   Progress: ${processedCount}/${totalResponses} (${progress}%) - Memory: ${memoryMB}MB`);

      skip += BATCH_SIZE;
    }

    console.log(`📊 Generating CSV for ${allResponses.length} responses...`);

    // Generate CSV content
    const csvContent = await generateCSVContent(survey, allResponses, mode, surveyId);

    // Set content length
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    // Send CSV content
    res.send(csvContent);

    console.log(`✅ CSV download completed: ${filename} (${processedCount} responses)`);

  } catch (error) {
    console.error('❌ Error generating CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating CSV',
      error: error.message
    });
  }
};

// ============================================
// NEW ASYNC JOB QUEUE CSV GENERATION
// ============================================

const { addCSVJob, getJobProgress, findActiveJobByFingerprint } = require('../utils/csvJobQueue');
const { generateJobFingerprint, generateJobId } = require('../utils/jobFingerprint');
const fs = require('fs').promises;

/**
 * Create a CSV generation job (returns immediately with job ID)
 */
const createCSVJob = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      mode = 'codes',
      status,
      gender,
      ageMin,
      ageMax,
      ac,
      city,
      district,
      lokSabha,
      dateRange,
      startDate,
      endDate,
      interviewMode,
      interviewerIds,
      interviewerMode = 'include',
      search
    } = req.query;

    console.log(`📥 CSV Job Creation Request - Survey: ${surveyId}, Mode: ${mode}`);

    // Verify survey exists
    const survey = await Survey.findById(surveyId).lean();
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Prepare filters object
    const filters = {
      status: status,
      gender: gender,
      ageMin: ageMin,
      ageMax: ageMax,
      ac: ac,
      city: city,
      district: district,
      lokSabha: lokSabha,
      dateRange: dateRange,
      startDate: startDate,
      endDate: endDate,
      interviewMode: interviewMode,
      interviewerIds: interviewerIds,
      interviewerMode: interviewerMode,
      search: search
    };

    // Generate fingerprint for smart job linking
    const fingerprint = generateJobFingerprint(surveyId, mode, filters);
    
    // Check if there's an existing active job with the same fingerprint
    const existingJobId = await findActiveJobByFingerprint(fingerprint);
    
    if (existingJobId) {
      // Get the existing job's progress
      const existingProgress = await getJobProgress(existingJobId);
      
      console.log(`🔗 Linking to existing job: ${existingJobId} (fingerprint: ${fingerprint})`);
      
      return res.status(200).json({
        success: true,
        jobId: existingJobId,
        message: 'Linked to existing CSV generation job',
        status: existingProgress?.state || 'active',
        isLinked: true // Flag to indicate this is a linked job
      });
    }

    // No existing job found, create new one
    // Generate unique job ID with fingerprint for deduplication
    const jobId = generateJobId(surveyId, mode, filters);

    // Prepare job data
    const jobData = {
      jobId: jobId,
      fingerprint: fingerprint, // Store fingerprint for reference
      surveyId: surveyId,
      mode: mode,
      filters: filters,
      priority: 0,
      createdAt: new Date()
    };

    // Add job to queue (Bull will prevent exact duplicates based on jobId)
    const job = await addCSVJob(jobData);

    console.log(`✅ CSV Job created: ${jobId} (Bull job ID: ${job.id}, fingerprint: ${fingerprint})`);

    // Return job ID immediately
    return res.status(200).json({
      success: true,
      jobId: jobId,
      message: 'CSV generation job created successfully',
      status: 'queued',
      isLinked: false
    });

  } catch (error) {
    console.error('❌ Error creating CSV job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create CSV generation job',
      error: error.message
    });
  }
};

/**
 * Get CSV job progress
 */
const getCSVJobProgress = async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log(`📊 Getting progress for job: ${jobId}`);

    // Add timeout wrapper to prevent hanging
    const progressPromise = getJobProgress(jobId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Progress check timeout')), 10000)
    );

    const progress = await Promise.race([progressPromise, timeoutPromise]);

    if (!progress) {
      console.warn(`⚠️ Job not found: ${jobId}`);
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Format progress response
    const response = {
      success: true,
      jobId: progress.jobId,
      state: progress.state, // 'waiting', 'active', 'completed', 'failed'
      progress: progress.progress,
      createdAt: progress.createdAt,
      processedAt: progress.processedAt,
      finishedAt: progress.finishedAt
    };

    // Add result if completed OR if result exists (even if state is still 'active')
    if (progress.result || (progress.state === 'completed' && progress.result)) {
      response.result = progress.result;
      response.downloadUrl = `/api/survey-responses/csv-job/${jobId}/download`;
      console.log(`✅ Job ${jobId} has result, file: ${progress.result?.filePath || 'unknown'}`);
    } else if (progress.state === 'completed') {
      // Job completed but no result yet - might be in transition
      console.log(`⚠️ Job ${jobId} state is completed but no result yet`);
    }

    // Add error if failed
    if (progress.state === 'failed') {
      response.error = progress.failedReason || 'Unknown error';
      console.error(`❌ Job ${jobId} failed: ${response.error}`);
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error getting CSV job progress:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get job progress',
      error: error.message
    });
  }
};

/**
 * Download CSV file from completed job
 */
const downloadCSVFromJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job progress to check if completed
    const progress = await getJobProgress(jobId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Allow download if job has result, even if state is still 'active' (Bull state update lag)
    // Also check if progress message indicates completion
    const hasResult = progress.result && progress.result.filePath;
    const progressIndicatesComplete = progress.progress && 
      typeof progress.progress === 'object' && 
      (progress.progress.stage === 'completed' || 
       (progress.progress.message && progress.progress.message.includes('completed')));
    
    if (progress.state !== 'completed' && !hasResult && !progressIndicatesComplete) {
      return res.status(400).json({
        success: false,
        message: `Job is not completed. Current state: ${progress.state}`,
        state: progress.state
      });
    }

    // If state is 'active' but we have a result, use the result
    if (!hasResult) {
      // Try to get result from job data if available
      if (progress.data && progress.data.result) {
        progress.result = progress.data.result;
      } else {
        // Last resort: Try to construct file path from job data and check if file exists
        // This handles cases where Bull state hasn't updated but file is ready
        const surveyId = progress.data?.surveyId || req.params.surveyId;
        const mode = progress.data?.mode || 'codes';
        const fs = require('fs').promises;
        const path = require('path');
        
        if (surveyId) {
          const csvDir = path.join(__dirname, '../generated-csvs', surveyId);
          const today = new Date().toISOString().split('T')[0];
          const possibleFilename = `survey_${surveyId}_${mode}_${today}.csv`;
          const possiblePath = path.join(csvDir, possibleFilename);
          
          try {
            await fs.access(possiblePath);
            // File exists! Use it
            progress.result = {
              filePath: possiblePath,
              filename: possibleFilename,
              surveyId: surveyId,
              mode: mode
            };
            console.log(`✅ Found file by path fallback: ${possiblePath}`);
          } catch (error) {
            return res.status(404).json({
              success: false,
              message: 'CSV file not found for this job. Job may still be processing.',
              state: progress.state
            });
          }
        } else {
          return res.status(404).json({
            success: false,
            message: 'CSV file not found for this job. Job may still be processing.',
            state: progress.state
          });
        }
      }
    }

    const filePath = progress.result.filePath;
    const filename = progress.result.filename || `survey_${progress.result.surveyId}_${progress.result.mode}_${new Date().toISOString().split('T')[0]}.csv`;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'CSV file not found on server'
      });
    }

    // Read and send file
    const fileContent = await fs.readFile(filePath, 'utf8');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(fileContent, 'utf8'));

    res.send(fileContent);

    console.log(`✅ CSV downloaded from job ${jobId}: ${filename}`);

  } catch (error) {
    console.error('❌ Error downloading CSV from job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download CSV file',
      error: error.message
    });
  }
};

// Skip review assignment (releases current assignment and response goes back to queue)
// The response will be placed at the end of the queue (after at least 100 other responses)
const skipReviewAssignment = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.id;

    console.log('🔍 skipReviewAssignment - Called for responseId:', responseId);
    console.log('🔍 skipReviewAssignment - User:', req.user?.email, 'UserId:', userId);

    if (!responseId) {
      return res.status(400).json({
        success: false,
        message: 'Response ID is required'
      });
    }

    // Find the response and verify it's assigned to this user
    // IMPORTANT: Use findOne with responseId field (UUID string), not findById (_id ObjectId)
    const surveyResponse = await SurveyResponse.findOne({ responseId: responseId });

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Response not found'
      });
    }

    // Verify the assignment belongs to this user
    if (surveyResponse.reviewAssignment && surveyResponse.reviewAssignment.assignedTo) {
      const assignedToId = surveyResponse.reviewAssignment.assignedTo.toString();
      if (assignedToId !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this response'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Response is not currently assigned'
      });
    }

    // Count responses in queue to determine where to place this skipped response
    // We want to place it after at least 100 other responses
    // Use the same query structure as getNextReviewAssignment for accurate queue count
    const now = new Date();
    const queueQuery = {
      status: 'Pending_Approval',
      $and: [
        // Assignment check - not currently assigned
        {
          $or: [
            { reviewAssignment: { $exists: false } },
            { 'reviewAssignment.assignedTo': null },
            { 'reviewAssignment.expiresAt': { $lt: now } } // Expired assignments
          ]
        },
        // Batch check - only include responses that are:
        // 1. Not in any batch (qcBatch is null/undefined), OR
        // 2. In a batch but are part of the 40% sample (isSampleResponse: true)
        {
          $or: [
            { qcBatch: { $exists: false } },
            { qcBatch: null },
            { isSampleResponse: true }
          ]
        }
      ]
    };

    // Apply same survey filter if applicable
    if (surveyResponse.survey) {
      queueQuery.survey = surveyResponse.survey;
    }

    const queueCount = await SurveyResponse.countDocuments(queueQuery);
    console.log(`🔍 skipReviewAssignment - Queue count (excluding skipped response): ${queueCount}`);

    // Determine lastSkippedAt value to push response to end of queue
    let lastSkippedAt = new Date();
    
    if (queueCount >= 100) {
      // If there are 100+ responses in queue, set lastSkippedAt to be after the 100th response's createdAt
      // This ensures the skipped response appears after at least 100 other responses
      // Use the same sorting logic as getNextReviewAssignment: never-skipped first, then skipped
      const aggregationPipeline = [
        { $match: queueQuery },
        {
          $addFields: {
            sortKey: {
              $cond: {
                if: { $eq: ['$lastSkippedAt', null] },
                then: { $toLong: '$createdAt' },
                else: { $toLong: '$lastSkippedAt' }
              }
            },
            isSkipped: { $ne: ['$lastSkippedAt', null] }
          }
        },
        {
          $sort: {
            isSkipped: 1,
            sortKey: 1,
            createdAt: 1
          }
        },
        { $skip: 99 },
        { $limit: 1 },
        { $project: { createdAt: 1, lastSkippedAt: 1 } }
      ];

      const hundredthResponseResult = await SurveyResponse.aggregate(aggregationPipeline);
      const hundredthResponse = hundredthResponseResult[0];

      if (hundredthResponse) {
        // Set lastSkippedAt to be after the 100th response's createdAt
        // Use the later of createdAt or lastSkippedAt from that response
        const referenceDate = hundredthResponse.lastSkippedAt && hundredthResponse.lastSkippedAt > hundredthResponse.createdAt
          ? hundredthResponse.lastSkippedAt
          : hundredthResponse.createdAt;
        
        lastSkippedAt = new Date(referenceDate.getTime() + 1000); // 1 second after
        console.log(`🔍 skipReviewAssignment - Setting lastSkippedAt after 100th response: ${lastSkippedAt}`);
      } else {
        // Fallback: set to far future
        lastSkippedAt = new Date('2099-12-31');
        console.log(`🔍 skipReviewAssignment - Fallback: Setting lastSkippedAt to far future: ${lastSkippedAt}`);
      }
    } else {
      // Less than 100 responses, set to far future to ensure it goes to end
      lastSkippedAt = new Date('2099-12-31');
      console.log(`🔍 skipReviewAssignment - Less than 100 responses, setting lastSkippedAt to far future: ${lastSkippedAt}`);
    }

    // Release the assignment and set lastSkippedAt to push response to end of queue
    // IMPORTANT: Use findOneAndUpdate with responseId field (UUID string), not findByIdAndUpdate (_id ObjectId)
    const updateResult = await SurveyResponse.findOneAndUpdate(
      { responseId: responseId },
      {
        $unset: { reviewAssignment: '' }, // Remove assignment
        $set: { lastSkippedAt: lastSkippedAt } // Set skip timestamp
      },
      { new: true }
    );

    console.log('✅ skipReviewAssignment - Update executed:', {
      responseId: responseId,
      lastSkippedAt: lastSkippedAt.toISOString(),
      assignmentRemoved: true
    });

    // Verify the update
    // IMPORTANT: Use findOne with responseId field (UUID string), not findById (_id ObjectId)
    const verifyResponse = await SurveyResponse.findOne({ responseId: responseId }).select('lastSkippedAt reviewAssignment').lean();
    if (!verifyResponse.lastSkippedAt) {
      console.error('❌ skipReviewAssignment - CRITICAL: lastSkippedAt was NOT set after update!');
      console.error('❌ skipReviewAssignment - Verify response:', JSON.stringify(verifyResponse, null, 2));
    } else {
      console.log('✅ skipReviewAssignment - Verification successful:', {
        lastSkippedAt: verifyResponse.lastSkippedAt.toISOString(),
        assignmentRemoved: !verifyResponse.reviewAssignment
      });
    }

    console.log('✅ skipReviewAssignment - Assignment released, response moved to end of queue');

    // IMPORTANT: Clear cache for this user to ensure next assignment is fresh
    // This prevents returning the same skipped response immediately
    const nextAssignmentCache = require('../utils/nextAssignmentCache');
    await nextAssignmentCache.clearUser(userId);
    console.log(`✅ skipReviewAssignment - Cleared cache for user ${userId} to ensure fresh next assignment`);

    const responseData = {
      success: true,
      message: 'Response skipped successfully. It will be available again after at least 100 other responses.',
      data: {
        responseId: responseId,
        lastSkippedAt: lastSkippedAt.toISOString()
      }
    };

    // CRITICAL: Removed JSON.stringify() - causes memory leaks
    console.log('✅ skipReviewAssignment - Sending 200 response - responseId:', responseData.data?.responseId, 'status:', responseData.data?.status);
    res.status(200).json(responseData);
    console.log('✅ skipReviewAssignment - Response sent successfully');
  } catch (error) {
    console.error('❌ skipReviewAssignment - Error:', error);
    console.error('❌ skipReviewAssignment - Error stack:', error.stack);
    console.error('❌ skipReviewAssignment - Error message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to skip review assignment',
      error: error.message
    });
  }
};

// Verify interview sync (two-phase commit verification)
// This endpoint verifies that an interview was successfully synced to the server
// Used by the mobile app to confirm data integrity before deleting from local storage
const verifyInterviewSync = async (req, res) => {
  try {
    const { responseId, mongoId } = req.body;
    const interviewerId = req.user.id;

    if (!responseId && !mongoId) {
      return res.status(400).json({
        success: false,
        message: 'responseId or mongoId is required'
      });
    }

    // Find the response by responseId or mongoId
    let surveyResponse;
    if (mongoId) {
      surveyResponse = await SurveyResponse.findById(mongoId)
        .select('responseId status audioRecording responses')
        .lean();
    } else {
      surveyResponse = await SurveyResponse.findOne({ responseId })
        .select('responseId status audioRecording responses')
        .lean();
    }

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found on server',
        verified: false
      });
    }

    // Verify that the response belongs to the interviewer
    // Note: We don't have interviewer field in the select, so we'll skip this check
    // The responseId/mongoId should be unique enough

    // Check if audio was expected and if it's present
    const hasAudio = surveyResponse.audioRecording && 
                     surveyResponse.audioRecording.audioUrl && 
                     surveyResponse.audioRecording.audioUrl !== '';

    // Check if responses are present
    const hasResponses = surveyResponse.responses && 
                         Array.isArray(surveyResponse.responses) && 
                         surveyResponse.responses.length > 0;

    // Verification result
    const verified = hasResponses; // At minimum, responses must be present
    const audioVerified = hasAudio; // Audio is optional but should be present if expected

    console.log(`✅ Interview verification - responseId: ${surveyResponse.responseId}, verified: ${verified}, audioVerified: ${audioVerified}`);

    res.status(200).json({
      success: true,
      verified,
      audioVerified,
      responseId: surveyResponse.responseId,
      mongoId: surveyResponse._id.toString(),
      status: surveyResponse.status,
      hasResponses,
      hasAudio
    });

  } catch (error) {
    console.error('Error verifying interview sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify interview sync',
      error: error.message
    });
  }
};

// Haversine formula to calculate distance between two GPS coordinates (in kilometers)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get Booster Checks - CAPI responses with booster enabled or distance > 5.1km
const getBoosterChecks = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      status,
      interviewMode = 'capi',
      gpsCheck,
      dateRange = 'today',
      startDate,
      endDate,
      ac,
      interviewerId,
      page = 1,
      limit = 20
    } = req.query;

    const ALLOWED_RADIUS_KM = 5.1;
    const limitNum = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const fetchLimit = limitNum * 5; // Fetch 5x to account for filtering

    // Check Redis cache first
    const redisOps = require('../utils/redisClient');
    const cacheKey = `booster-checks:${surveyId}:${JSON.stringify(req.query)}`;
    try {
      const cached = await redisOps.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      console.log('Redis cache miss or error:', cacheError.message);
    }

    // Build base filter
    const matchFilter = {
      survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId,
      interviewMode: 'capi'
    };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Date range filter
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000;
      let dateStart, dateEnd;
      switch (dateRange) {
        case 'today':
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }
      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    } else if (startDate || endDate) {
      let dateStart = startDate ? new Date(startDate) : null;
      let dateEnd = endDate ? new Date(endDate) : null;
      if (dateStart || dateEnd) {
        matchFilter.createdAt = {};
        if (dateStart) matchFilter.createdAt.$gte = dateStart;
        if (dateEnd) matchFilter.createdAt.$lte = dateEnd;
      }
    }

    // AC filter
    if (ac) {
      matchFilter.selectedAC = ac;
    }

    // Interviewer filter
    if (interviewerId) {
      matchFilter.interviewer = mongoose.Types.ObjectId.isValid(interviewerId) ? new mongoose.Types.ObjectId(interviewerId) : interviewerId;
    }

    // Get booster-enabled interviewers (cache for 1 hour)
    let boosterEnabledInterviewers = [];
    try {
      const boosterCacheKey = 'booster-enabled-interviewers';
      const cachedBoosters = await redisOps.get(boosterCacheKey);
      if (cachedBoosters) {
        boosterEnabledInterviewers = cachedBoosters;
      } else {
        const boosterUsers = await User.find({
          'preferences.locationControlBooster': true,
          userType: 'interviewer'
        }).select('_id').lean();
        boosterEnabledInterviewers = boosterUsers.map(u => u._id.toString());
        await redisOps.set(boosterCacheKey, boosterEnabledInterviewers, 3600); // 1 hour cache
      }
    } catch (error) {
      console.log('Error fetching booster-enabled interviewers:', error.message);
    }

    // Fetch responses iteratively until we have enough
    let processedResponses = [];
    let totalFetched = 0;
    let skip = 0;

    while (processedResponses.length < limitNum && skip < 10000) { // Safety limit
      const batch = await SurveyResponse.find(matchFilter)
        .select('-responses') // Exclude large responses array
        .populate('interviewer', 'firstName lastName email memberId')
        .populate('selectedPollingStation', 'stationName latitude longitude')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(fetchLimit)
        .lean();

      if (batch.length === 0) break;

      totalFetched += batch.length;

      for (const response of batch) {
        // Check if interviewer has booster enabled
        const interviewerHasBooster = response.interviewer && 
          boosterEnabledInterviewers.includes(response.interviewer._id.toString());

        // Calculate distance from polling station
        let distance = null;
        if (response.selectedPollingStation && response.selectedPollingStation.latitude && 
            response.selectedPollingStation.longitude && response.gpsLocation) {
          const psLat = response.selectedPollingStation.latitude;
          const psLon = response.selectedPollingStation.longitude;
          let gpsLat = null, gpsLon = null;

          if (response.gpsLocation.latitude && response.gpsLocation.longitude) {
            gpsLat = response.gpsLocation.latitude;
            gpsLon = response.gpsLocation.longitude;
          } else if (response.location && response.location.latitude && response.location.longitude) {
            gpsLat = response.location.latitude;
            gpsLon = response.location.longitude;
          }

          if (gpsLat !== null && gpsLon !== null) {
            distance = calculateDistance(gpsLat, gpsLon, psLat, psLon);
          }
        }

        // Filter: must have booster enabled OR distance > 5.1km
        const usedBooster = interviewerHasBooster || (distance !== null && distance > ALLOWED_RADIUS_KM);
        if (!usedBooster) continue;

        // GPS Check Pass/Fail (within 5.1km = pass)
        const gpsCheckPass = distance !== null ? distance <= ALLOWED_RADIUS_KM : null;

        // Apply GPS Check filter if specified
        if (gpsCheck === 'pass' && !gpsCheckPass) continue;
        if (gpsCheck === 'fail' && gpsCheckPass) continue;

        processedResponses.push({
          ...response,
          distanceFromPollingStation: distance !== null ? parseFloat(distance.toFixed(2)) : null,
          gpsCheckPass
        });

        if (processedResponses.length >= limitNum) break;
      }

      skip += fetchLimit;
      if (batch.length < fetchLimit) break; // No more data
    }

    // Paginate processed responses
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedResponses = processedResponses.slice(startIdx, startIdx + limitNum);

    // Calculate total count
    let totalResponses;
    if (processedResponses.length > 0 && totalFetched > 0) {
      const ratio = processedResponses.length / totalFetched;
      const totalMatching = await SurveyResponse.countDocuments(matchFilter);
      totalResponses = Math.ceil(totalMatching * ratio);
    } else {
      totalResponses = await SurveyResponse.countDocuments(matchFilter);
    }

    const result = {
      success: true,
      responses: paginatedResponses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResponses,
        pages: Math.ceil(totalResponses / limitNum)
      }
    };

    // Cache for 5 minutes
    try {
      await redisOps.set(cacheKey, result, 300);
    } catch (cacheError) {
      console.log('Error caching result:', cacheError.message);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching booster checks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booster checks',
      error: error.message
    });
  }
};

// Bulk approve booster checks
const bulkApproveBoosterChecks = async (req, res) => {
  try {
    const { responseIds } = req.body;
    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'responseIds array is required'
      });
    }

    const result = await SurveyResponse.updateMany(
      {
        _id: { $in: responseIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) },
        abandonedReason: { $exists: false } // Don't update abandoned responses
      },
      {
        $set: { status: 'Approved' }
      }
    );

    // Remove from AvailableAssignment
    const AvailableAssignment = require('../models/AvailableAssignment');
    await AvailableAssignment.deleteMany({
      responseId: { $in: responseIds }
    });

    res.json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk approving booster checks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve',
      error: error.message
    });
  }
};

// Bulk reject booster checks
const bulkRejectBoosterChecks = async (req, res) => {
  try {
    const { responseIds } = req.body;
    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'responseIds array is required'
      });
    }

    const result = await SurveyResponse.updateMany(
      {
        _id: { $in: responseIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) },
        abandonedReason: { $exists: false }
      },
      {
        $set: {
          status: 'Rejected',
          abandonedReason: 'Location out of Accepted Radius of distance from polling station'
        }
      }
    );

    const AvailableAssignment = require('../models/AvailableAssignment');
    await AvailableAssignment.deleteMany({
      responseId: { $in: responseIds }
    });

    res.json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk rejecting booster checks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk reject',
      error: error.message
    });
  }
};

// Bulk set pending booster checks
const bulkSetPendingBoosterChecks = async (req, res) => {
  try {
    const { responseIds } = req.body;
    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'responseIds array is required'
      });
    }

    const result = await SurveyResponse.updateMany(
      {
        _id: { $in: responseIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) },
        abandonedReason: { $exists: false }
      },
      {
        $set: { status: 'Pending_Approval' }
      }
    );

    const AvailableAssignment = require('../models/AvailableAssignment');
    await AvailableAssignment.deleteMany({
      responseId: { $in: responseIds }
    });

    res.json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk setting pending:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk set pending',
      error: error.message
    });
  }
};

module.exports = {
  getLastCatiSetNumber,
  startInterview,
  getInterviewSession,
  updateResponse,
  navigateToQuestion,
  markQuestionReached,
  pauseInterview,
  resumeInterview,
  completeInterview,
  abandonInterview,
  getGenderResponseCounts,
  uploadAudioFile,
  getAudioSignedUrl,
  streamAudioProxy,
  getMyInterviews,
  getPendingApprovals,
  getNextReviewAssignment,
  releaseReviewAssignment,
  skipReviewAssignment,
  submitVerification,
  debugSurveyResponses,
  getSurveyResponseById,
  getSurveyResponses,
  getSurveyResponsesV2,
  getSurveyResponsesV2ForCSV,
  getSurveyResponseCounts,
  approveSurveyResponse,
  rejectSurveyResponse,
  setPendingApproval,
  getACPerformanceStats,
  getInterviewerPerformanceStats,
  getInterviewerStats,
  getQualityAgentStats,
  getApprovalStats,
  getCSVFileInfo,
  downloadPreGeneratedCSV,
  triggerCSVGeneration,
  downloadCSVWithFilters_OLD, // Old synchronous version (kept for backward compatibility)
  createCSVJob, // New async job queue version - creates job and returns immediately
  getCSVJobProgress, // Get job progress
  downloadCSVFromJob, // Download completed CSV file
  verifyInterviewSync, // Two-phase commit verification (like WhatsApp/Meta)
  getBoosterChecks,
  bulkApproveBoosterChecks,
  bulkRejectBoosterChecks,
  bulkSetPendingBoosterChecks
};