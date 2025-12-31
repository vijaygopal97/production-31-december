const SurveyResponse = require('../models/SurveyResponse');
const InterviewSession = require('../models/InterviewSession');
const Survey = require('../models/Survey');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { addResponseToBatch } = require('../utils/qcBatchHelper');

// Start a new interview session
const startInterview = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const interviewerId = req.user.id;

    // Check if survey exists and is active
    const survey = await Survey.findById(surveyId);
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

    // Check if interviewer is assigned to this survey and get assignment details
    // Handle both single-mode (assignedInterviewers) and multi-mode (capiInterviewers, catiInterviewers) surveys
    let assignment = null;
    let assignedMode = null;

    // Check for single-mode assignment
    if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
      assignment = survey.assignedInterviewers.find(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
      if (assignment) {
        assignedMode = assignment.assignedMode || 'single';
      }
    }

    // Check for multi-mode CAPI assignment
    if (!assignment && survey.capiInterviewers && survey.capiInterviewers.length > 0) {
      assignment = survey.capiInterviewers.find(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
      if (assignment) {
        assignedMode = 'capi';
      }
    }

    // Check for multi-mode CATI assignment
    if (!assignment && survey.catiInterviewers && survey.catiInterviewers.length > 0) {
      assignment = survey.catiInterviewers.find(
        assignment => assignment.interviewer.toString() === interviewerId && 
                     assignment.status === 'assigned'
      );
      if (assignment) {
        assignedMode = 'cati';
      }
    }

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this survey'
      });
    }

    // Check if AC selection is required
    const requiresACSelection = survey.assignACs && 
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
    
    // Debug survey questions
    console.log('🔍 Survey questions count:', survey.questions ? survey.questions.length : 0);
    console.log('🔍 Survey sections count:', survey.sections ? survey.sections.length : 0);
    console.log('🔍 Survey ID:', survey._id);
    console.log('🔍 Survey Name:', survey.surveyName);
    console.log('🔍 Full survey sections:', JSON.stringify(survey.sections, null, 2));
    console.log('🔍 Full survey questions:', JSON.stringify(survey.questions, null, 2));
    if (survey.questions && survey.questions.length > 0) {
      console.log('🔍 First question:', survey.questions[0].text);
    }
    if (survey.sections && survey.sections.length > 0) {
      console.log('🔍 First section:', survey.sections[0].title, 'Questions:', survey.sections[0].questions ? survey.sections[0].questions.length : 0);
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
    }).populate('survey', 'name description sections questions interviewMode');

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
    
    // Extract audioRecording from metadata
    const audioRecording = metadata?.audioRecording || {};

    const session = await InterviewSession.findOne({
      sessionId,
      interviewer: interviewerId
    }).populate('survey');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
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
    } else {
      // Calculate from session startTime (for online interviews)
      totalTimeSpent = Math.round((endTime - session.startTime) / 1000);
      console.log(`✅ Calculated totalTimeSpent from session: ${totalTimeSpent} seconds (${Math.floor(totalTimeSpent / 60)} minutes)`);
    }

    // Extract OldinterviewerID from responses (for survey 68fd1915d41841da463f0d46)
    let oldInterviewerID = null;
    if (metadata?.OldinterviewerID) {
      oldInterviewerID = String(metadata.OldinterviewerID);
    } else {
      // Also check in responses array as fallback
      const interviewerIdResponse = responses.find(r => r.questionId === 'interviewer-id');
      if (interviewerIdResponse && interviewerIdResponse.response !== null && interviewerIdResponse.response !== undefined && interviewerIdResponse.response !== '') {
        oldInterviewerID = String(interviewerIdResponse.response);
      }
    }

    // Create complete survey response
    // CRITICAL: Use startTime from metadata if provided (for offline synced interviews)
    // Otherwise use session.startTime (for online interviews)
    const actualStartTime = metadata?.startTime ? new Date(metadata.startTime) : session.startTime;
    
    console.log(`📊 Creating survey response - startTime: ${actualStartTime.toISOString()}, endTime: ${endTime.toISOString()}, totalTimeSpent: ${totalTimeSpent} seconds`);
    
    const surveyResponse = await SurveyResponse.createCompleteResponse({
      survey: session.survey._id,
      interviewer: session.interviewer,
      sessionId: session.sessionId,
      startTime: actualStartTime, // Use actual start time from metadata if available
      endTime, // Use end time from metadata if available, otherwise current time
      totalTimeSpent: totalTimeSpent, // CRITICAL: Pass calculated totalTimeSpent (uses metadata value if available)
      responses,
      interviewMode: session.interviewMode,
      deviceInfo: session.deviceInfo,
      audioRecording: audioRecording,
      selectedAC: metadata?.selectedAC || null,
      selectedPollingStation: metadata?.selectedPollingStation || null,
      location: metadata?.location || null,
      qualityMetrics,
      setNumber: metadata?.setNumber || null, // Save set number for CATI interviews
      OldinterviewerID: oldInterviewerID, // Save old interviewer ID
      metadata: {
        ...session.metadata,
        ...metadata
      }
    });

    await surveyResponse.save();
    
    // Check for auto-rejection conditions
    const { checkAutoRejection, applyAutoRejection } = require('../utils/autoRejectionHelper');
    let wasAutoRejected = false;
    try {
      const rejectionInfo = await checkAutoRejection(surveyResponse, responses, session.survey._id);
      if (rejectionInfo) {
        await applyAutoRejection(surveyResponse, rejectionInfo);
        wasAutoRejected = true;
        // Refresh the response to get updated status
        await surveyResponse.populate('survey');
        // Reload from database to ensure status is updated
        await surveyResponse.constructor.findById(surveyResponse._id);
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
    
    // Add response to QC batch only if NOT auto-rejected
    // Auto-rejected responses are already decided and don't need QC processing
    if (!isAutoRejected) {
      try {
        await addResponseToBatch(surveyResponse._id, session.survey._id, session.interviewer.toString());
      } catch (batchError) {
        console.error('Error adding response to batch:', batchError);
        // Continue even if batch addition fails - response is still saved
      }
    } else {
      console.log(`⏭️  Skipping batch addition for auto-rejected response ${surveyResponse._id} (status: ${latestResponse.status})`);
    }

    // Mark session as abandoned (cleanup)
    session.abandonSession();
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Interview completed successfully and submitted for approval',
      data: {
        responseId: surveyResponse.responseId, // Use the new numerical responseId
        mongoId: surveyResponse._id, // Keep MongoDB ID for internal reference
        completionPercentage: surveyResponse.completionPercentage,
        totalTimeSpent: surveyResponse.totalTimeSpent,
        // Always show Pending_Approval to interviewer, even if auto-rejected
        status: 'Pending_Approval',
        summary: surveyResponse.getResponseSummary()
      }
    });

  } catch (error) {
    console.error('Error completing interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete interview',
      error: error.message
    });
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
    }).populate('survey');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
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
        selectedAC: metadata?.selectedAC || null,
        selectedPollingStation: metadata?.selectedPollingStation || null,
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

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
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

    // Get gender response counts from completed responses
    // Use genderUtils to find gender responses (including registered voter question equivalence)
    const { findGenderResponse, normalizeGenderResponse } = require('../utils/genderUtils');
    
    const allResponses = await SurveyResponse.find({
      survey: survey._id,
      status: { $in: ['Pending_Approval', 'Approved', 'completed'] }
    }).select('responses survey').populate('survey');
    
    // Count gender responses using normalized values
    const genderResponseCounts = {};
    allResponses.forEach(response => {
      const genderResp = findGenderResponse(response.responses, response.survey);
      if (genderResp && genderResp.response) {
        const normalizedGender = normalizeGenderResponse(genderResp.response);
        // Map normalized values to standard format
        const genderKey = normalizedGender === 'male' ? 'male' : (normalizedGender === 'female' ? 'female' : normalizedGender);
        genderResponseCounts[genderKey] = (genderResponseCounts[genderKey] || 0) + 1;
      }
    });

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
    
    const { sessionId, surveyId } = req.body;
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

    // Check if session exists and belongs to interviewer
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

    // Generate unique filename based on uploaded file extension
    const timestamp = Date.now();
    const originalExt = path.extname(req.file.originalname) || '.webm';
    const filename = `interview_${sessionId}_${timestamp}${originalExt}`;
    
    const fs = require('fs');
    const { uploadToS3, isS3Configured, generateAudioKey } = require('../utils/cloudStorage');
    
    let audioUrl; // Will store S3 key, not full URL
    let storageType = 'local';
    
    // Try to upload to S3 if configured, otherwise use local storage
    if (isS3Configured()) {
      try {
        // Generate S3 key with organized folder structure
        const s3Key = generateAudioKey(sessionId, filename);
        const metadata = {
          sessionId,
          surveyId,
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
    
    console.log('✅ Upload successful - File size:', req.file.size, 'bytes');
    console.log('✅ Audio URL:', audioUrl);
    console.log('✅ Storage type:', storageType);
    
    res.status(200).json({
      success: true,
      message: 'Audio file uploaded successfully',
      data: {
        audioUrl,
        filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        sessionId,
        surveyId,
        storageType
      }
    });

  } catch (error) {
    console.error('❌ Error uploading audio file:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio file',
      error: error.message
    });
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
    let interviews = await SurveyResponse.find(query)
      .populate('survey', 'surveyName description category sections')
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

    // Helper function to add signed URL to audio recording
    const { getAudioSignedUrl } = require('../utils/cloudStorage');
    const addSignedUrlToAudio = async (audioRecording) => {
      if (!audioRecording || !audioRecording.audioUrl) {
        return audioRecording;
      }
      
      // Skip mock URLs - these are test URLs, not real files
      if (audioRecording.audioUrl.startsWith('mock://') || audioRecording.audioUrl.includes('mock://')) {
        return {
          ...audioRecording,
          signedUrl: null, // No signed URL for mock URLs
          originalUrl: audioRecording.audioUrl,
          isMock: true // Flag to indicate this is a mock URL
        };
      }
      
      try {
        const signedUrl = await getAudioSignedUrl(audioRecording.audioUrl, 3600);
        return {
          ...audioRecording,
          signedUrl, // Add signed URL for S3 files
          originalUrl: audioRecording.audioUrl // Keep original for reference
        };
      } catch (error) {
        console.error('Error generating signed URL for audio:', error);
        return audioRecording; // Return original if signed URL generation fails
      }
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

      // Add signed URL to audio recording if present
      let audioRecording = interview.audioRecording;
      if (audioRecording && audioRecording.audioUrl) {
        audioRecording = await addSignedUrlToAudio(audioRecording);
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
      console.log('getPendingApprovals - Query for responses:', JSON.stringify(query, null, 2));
      
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
    let interviews = await SurveyResponse.find(query)
      .populate({
        path: 'survey',
        select: 'surveyName description category sections company assignedQualityAgents',
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
    console.log('getPendingApprovals - Raw interviews data:', interviews.map(i => ({
      id: i._id,
      responseId: i.responseId,
      status: i.status,
      surveyId: i.survey?._id || i.survey,
      surveyName: i.survey?.surveyName,
      hasSurvey: !!i.survey,
      hasInterviewer: !!i.interviewer,
      interviewerId: i.interviewer?._id?.toString() || i.interviewer?.toString() || 'null',
      interviewerName: i.interviewer ? `${i.interviewer.firstName} ${i.interviewer.lastName}` : 'null',
      interviewerMemberId: i.interviewer?.memberId || 'null',
      createdAt: i.createdAt
    })));

    // Filter out responses where survey is null (doesn't belong to company)
    const beforeNullFilter = interviews.length;
    interviews = interviews.filter(interview => interview.survey !== null);
    console.log('getPendingApprovals - After null survey filter:', interviews.length, '(removed', beforeNullFilter - interviews.length, 'responses with null survey)');
    
    // Debug: Log the structure of assignedQualityAgents to see if assignedACs is included
    if (interviews.length > 0 && interviews[0].survey && interviews[0].survey.assignedQualityAgents) {
      console.log('getPendingApprovals - Sample assignedQualityAgents structure:', 
        JSON.stringify(interviews[0].survey.assignedQualityAgents[0], null, 2));
    }
    
    // If user is a quality agent, filter by AC assignments if any
    if (userType === 'quality_agent') {
      console.log('getPendingApprovals - Quality agent filtering, total interviews before filter:', interviews.length);
      console.log('getPendingApprovals - Survey assignments map:', JSON.stringify(surveyAssignmentsMap, null, 2));
      
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
    const { getAudioSignedUrl: getAudioUrl } = require('../utils/cloudStorage');
    const interviewsWithSignedUrls = await Promise.all(transformedInterviews.map(async (interview) => {
      if (interview.audioRecording && interview.audioRecording.audioUrl) {
        try {
          const signedUrl = await getAudioUrl(interview.audioRecording.audioUrl, 3600);
          interview.audioRecording = {
            ...interview.audioRecording,
            signedUrl,
            originalUrl: interview.audioRecording.audioUrl
          };
        } catch (error) {
          console.error('Error generating signed URL for interview:', interview._id, error);
        }
      }
      return interview;
    }));

    res.status(200).json({
      success: true,
      data: {
        interviews: interviewsWithSignedUrls,
        total: interviewsWithSignedUrls.length
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

// Get next available response from queue for review
const getNextReviewAssignment = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company;
    const userType = req.user.userType;
    const { search, gender, ageMin, ageMax } = req.query;

    console.log('getNextReviewAssignment - User:', req.user.email, req.user.userType);

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
    
    // Build base query - only get responses with status 'Pending_Approval' that are NOT assigned
    // Exclude responses that are in batches (unless they're in the 40% sample)
    // Check for responses that either don't have reviewAssignment, or have expired assignments
    let query = { 
      status: 'Pending_Approval',
      $and: [
        // Assignment check
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

    // If quality agent, filter by assigned surveys and ACs
    let assignedSurveyIds = null;
    let surveyAssignmentsMap = {};
    if (userType === 'quality_agent') {
      
      const assignedSurveys = await Survey.find({
        company: companyObjectId,
        'assignedQualityAgents.qualityAgent': { $in: [userIdObjectId, userId] }
      })
      .select('_id surveyName assignedQualityAgents')
      .lean();
      
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
      
      if (assignedSurveyIds.length === 0) {
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
      const companySurveys = await Survey.find({ company: companyObjectId })
        .select('_id')
        .lean();
      const companySurveyIds = companySurveys.map(s => s._id);
      
      if (companySurveyIds.length === 0) {
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
    
    const activeAssignment = await SurveyResponse.findOne(activeAssignmentQuery)
      .populate({
        path: 'survey',
        select: 'surveyName description category sections company assignedQualityAgents',
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
        // Calculate effective questions using the same logic as below
        function findQuestionByTextForActive(questionText, survey) {
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

        const effectiveQuestions = activeAssignment.responses?.filter(r => {
          if (!r.isSkipped) return true;
          const surveyQuestion = findQuestionByTextForActive(r.questionText, activeAssignment.survey);
          const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
          if (!hasConditions) return false;
          return areConditionsMetForActive(surveyQuestion.conditions, activeAssignment.responses);
        }).length || 0;
        
        const answeredQuestions = activeAssignment.responses?.filter(r => !r.isSkipped).length || 0;
        const completionPercentage = effectiveQuestions > 0 ? Math.round((answeredQuestions / effectiveQuestions) * 100) : 0;

        // Add signed URL to audio recording if present (same as new assignment)
        let audioRecording = activeAssignment.audioRecording;
        if (audioRecording && audioRecording.audioUrl) {
          const { getAudioSignedUrl } = require('../utils/cloudStorage');
          // Skip mock URLs
          if (!audioRecording.audioUrl.startsWith('mock://') && !audioRecording.audioUrl.includes('mock://')) {
            try {
              const signedUrl = await getAudioSignedUrl(audioRecording.audioUrl, 3600);
              audioRecording = {
                ...audioRecording,
                signedUrl,
                originalUrl: audioRecording.audioUrl
              };
            } catch (error) {
              console.error('Error generating signed URL for audio in active assignment:', error);
              // Keep original audioRecording if signed URL generation fails
            }
          } else {
            // Mark as mock URL
            audioRecording = {
              ...audioRecording,
              signedUrl: null,
              isMock: true
            };
          }
        }

        // Explicitly preserve interviewer field with memberId
        // Log raw interviewer data before transformation
        console.log('🔍 getNextReviewAssignment - Active assignment raw interviewer:', {
          hasInterviewer: !!activeAssignment.interviewer,
          interviewerType: typeof activeAssignment.interviewer,
          interviewerIsObject: activeAssignment.interviewer && typeof activeAssignment.interviewer === 'object',
          interviewerKeys: activeAssignment.interviewer ? Object.keys(activeAssignment.interviewer) : [],
          interviewerId: activeAssignment.interviewer?._id?.toString(),
          interviewerMemberId: activeAssignment.interviewer?.memberId,
          interviewerMemberID: activeAssignment.interviewer?.memberID,
          fullInterviewer: JSON.stringify(activeAssignment.interviewer, null, 2)
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
        console.log('🔍 getNextReviewAssignment - Active assignment transformed interviewer:', {
          hasInterviewer: !!transformedResponse.interviewer,
          interviewerId: transformedResponse.interviewer?._id?.toString(),
          interviewerName: transformedResponse.interviewer ? `${transformedResponse.interviewer.firstName} ${transformedResponse.interviewer.lastName}` : 'null',
          interviewerMemberId: transformedResponse.interviewer?.memberId || 'null',
          interviewerKeys: transformedResponse.interviewer ? Object.keys(transformedResponse.interviewer) : [],
          fullTransformedInterviewer: JSON.stringify(transformedResponse.interviewer, null, 2)
        });
        console.log('🔍 getNextReviewAssignment - Final response interviewer memberId check:', {
          memberId: transformedResponse.interviewer?.memberId,
          hasMemberId: !!transformedResponse.interviewer?.memberId,
          interviewerObject: transformedResponse.interviewer
        });

        return res.status(200).json({
          success: true,
          data: {
            interview: transformedResponse,
            expiresAt: activeAssignment.reviewAssignment.expiresAt
          }
        });
      }
    }

    // Find the next available response (oldest first)
    let availableResponses = await SurveyResponse.find(query)
      .populate({
        path: 'survey',
        select: 'surveyName description category sections company assignedQualityAgents',
        populate: {
          path: 'assignedQualityAgents.qualityAgent',
          select: 'firstName lastName email _id'
        }
      })
      .populate({
        path: 'interviewer',
        select: 'firstName lastName email phone memberId'
      })
      .sort({ createdAt: 1 }) // Oldest first
      .lean();

    // Filter out null surveys (shouldn't happen now, but keep as safety check)
    availableResponses = availableResponses.filter(response => response.survey !== null);

    // If quality agent, filter by AC assignments
    if (userType === 'quality_agent') {
      availableResponses = availableResponses.filter(response => {
        const survey = response.survey;
        if (!survey || !survey._id) return false;
        
        const surveyId = survey._id.toString();
        const assignment = surveyAssignmentsMap[surveyId];
        
        if (!assignment) return false;
        
        const assignedACs = assignment.assignedACs || [];
        const hasAssignedACs = Array.isArray(assignedACs) && assignedACs.length > 0;
        
        if (hasAssignedACs) {
          return response.selectedAC && assignedACs.includes(response.selectedAC);
        }
        
        return true; // No ACs assigned, show all
      });
    }

    // Apply client-side filters
    if (search) {
      const searchLower = search.toLowerCase();
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

    // Helper functions
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
      return res.status(200).json({
        success: true,
        data: {
          interview: null,
          message: 'No responses available for review'
        }
      });
    }

    // Get the first available response
    const nextResponse = availableResponses[0];

    // Assign it to the current user (30 minutes lock)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const updatedResponse = await SurveyResponse.findByIdAndUpdate(
      nextResponse._id,
      {
        reviewAssignment: {
          assignedTo: userId,
          assignedAt: new Date(),
          expiresAt: expiresAt
        }
      },
      { new: true }
    )
    .populate({
      path: 'survey',
      select: 'surveyName description category sections company assignedQualityAgents',
      populate: {
        path: 'assignedQualityAgents.qualityAgent',
        select: 'firstName lastName email _id'
      }
    })
    .populate({
      path: 'interviewer',
      select: 'firstName lastName email phone memberId',
      options: { lean: true }
    })
    .lean();

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

    // Add signed URL to audio recording if present (same as getPendingApprovals)
    let audioRecording = updatedResponse.audioRecording;
    if (audioRecording && audioRecording.audioUrl) {
      const { getAudioSignedUrl } = require('../utils/cloudStorage');
      // Skip mock URLs
      if (!audioRecording.audioUrl.startsWith('mock://') && !audioRecording.audioUrl.includes('mock://')) {
        try {
          const signedUrl = await getAudioSignedUrl(audioRecording.audioUrl, 3600);
          audioRecording = {
            ...audioRecording,
            signedUrl,
            originalUrl: audioRecording.audioUrl
          };
        } catch (error) {
          console.error('Error generating signed URL for audio in getNextReviewAssignment:', error);
          // Keep original audioRecording if signed URL generation fails
        }
      } else {
        // Mark as mock URL
        audioRecording = {
          ...audioRecording,
          signedUrl: null,
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
      fullTransformedInterviewer: JSON.stringify(transformedResponse.interviewer, null, 2)
    });
    console.log('🔍 getNextReviewAssignment - Final response interviewer memberId check:', {
      memberId: transformedResponse.interviewer?.memberId,
      hasMemberId: !!transformedResponse.interviewer?.memberId,
      interviewerObject: transformedResponse.interviewer
    });

    res.status(200).json({
      success: true,
      data: {
        interview: transformedResponse,
        expiresAt: expiresAt
      }
    });

  } catch (error) {
    console.error('Error getting next review assignment:', error);
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
  console.log('🔵 Request params:', JSON.stringify(req.params));
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

    // Find all available set numbers in the survey FIRST (before checking last response)
    const survey = await Survey.findById(surveyId).select('sections');
    
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
    
    if (setArray.length === 0) {
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
    
    console.log(`🔵 SetData query result for survey ${surveyId}:`, lastSetData);
    
    const lastSetNumber = lastSetData && lastSetData.setNumber !== null && lastSetData.setNumber !== undefined 
      ? Number(lastSetData.setNumber) 
      : null;
    
    console.log(`🔵 Last set number used for survey ${surveyId}:`, lastSetNumber);
    console.log(`🔵 Available sets:`, setArray);
    
    // Debug: Check all SetData entries for this survey
    const allSetData = await SetData.find({
      survey: new mongoose.Types.ObjectId(surveyId),
      interviewMode: 'cati'
    })
    .sort({ createdAt: -1 })
    .select('setNumber createdAt')
    .limit(5)
    .lean();
    console.log(`🔵 Last 5 SetData entries for survey ${surveyId}:`, allSetData);
    
    let nextSetNumber;
    
    if (lastSetNumber === null) {
      // No previous set data - this is the first interview, use Set 1 (first set)
      nextSetNumber = setArray[0];
      console.log(`🔵 No previous set data - using first set: ${nextSetNumber}`);
    } else {
      // Find the index of the last set in the sorted array
      const lastSetIndex = setArray.indexOf(lastSetNumber);
        
      if (lastSetIndex === -1) {
        // Last set is not in available sets (shouldn't happen, but handle gracefully)
        nextSetNumber = setArray[0];
        console.log(`🔵 Last set ${lastSetNumber} not found in available sets - using first set: ${nextSetNumber}`);
        } else {
        // Rotate to the next set in the array (circular rotation)
        const nextIndex = (lastSetIndex + 1) % setArray.length;
        nextSetNumber = setArray[nextIndex];
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
    const updateData = {
      $set: {
        status: newStatus,
        verificationData: {
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
        }
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
    
    // Get all survey responses that belong to surveys from this company
    const allResponses = await SurveyResponse.find({})
      .populate({
        path: 'survey',
        select: 'surveyName company',
        populate: {
          path: 'company',
          select: '_id'
        }
      })
      .lean();
    
    // Filter responses that belong to this company
    const companyResponses = allResponses.filter(response => 
      response.survey && 
      response.survey.company && 
      response.survey.company._id.toString() === companyId.toString()
    );
    
    console.log('debugSurveyResponses - All responses for company:', companyResponses.map(r => ({
      id: r._id,
      responseId: r.responseId,
      status: r.status,
      surveyName: r.survey?.surveyName,
      surveyCompany: r.survey?.company?._id,
      userCompany: companyId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })));
    
    // Group by status
    const statusCounts = companyResponses.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('debugSurveyResponses - Status counts:', statusCounts);
    
    res.status(200).json({
      success: true,
      data: {
        totalResponses: companyResponses.length,
        statusCounts,
        responses: companyResponses.map(r => ({
          id: r._id,
          responseId: r.responseId,
          status: r.status,
          surveyName: r.survey?.surveyName,
          surveyCompany: r.survey?.company?._id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }))
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
    const interviewerId = req.user.id;

    // Find the survey response
    const surveyResponse = await SurveyResponse.findById(responseId)
      .populate('survey', 'surveyName description status sections questions targetAudience settings')
      .populate('interviewer', 'firstName lastName email phone')
      .select('survey interviewer status responses location metadata interviewMode selectedAC audioRecording createdAt updatedAt startedAt completedAt totalTimeSpent completionPercentage responseId');

    if (!surveyResponse) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }

    // Check if the interviewer has access to this response
    if (surveyResponse.interviewer && surveyResponse.interviewer._id.toString() !== interviewerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this survey response'
      });
    }

    // Add signed URL to audio recording if present
    const { getAudioSignedUrl } = require('../utils/cloudStorage');
    if (surveyResponse.audioRecording && surveyResponse.audioRecording.audioUrl) {
      // Skip mock URLs
      const audioUrl = surveyResponse.audioRecording.audioUrl;
      if (!audioUrl.startsWith('mock://') && !audioUrl.includes('mock://')) {
        try {
          const signedUrl = await getAudioSignedUrl(audioUrl, 3600);
          surveyResponse.audioRecording = {
            ...surveyResponse.audioRecording.toObject ? surveyResponse.audioRecording.toObject() : surveyResponse.audioRecording,
            signedUrl,
            originalUrl: audioUrl
          };
        } catch (error) {
          console.error('Error generating signed URL for audio:', error);
        }
      } else {
        // Mark as mock URL
        surveyResponse.audioRecording = {
          ...surveyResponse.audioRecording.toObject ? surveyResponse.audioRecording.toObject() : surveyResponse.audioRecording,
          signedUrl: null,
          isMock: true
        };
      }
    }

    res.json({
      success: true,
      interview: surveyResponse
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
    const { getAudioSignedUrl } = require('../utils/cloudStorage');
    responses = await Promise.all(responses.map(async (response) => {
      if (response.audioRecording && response.audioRecording.audioUrl) {
        const audioUrl = response.audioRecording.audioUrl;
        // Skip mock URLs
        if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
          response.audioRecording = {
            ...response.audioRecording,
            signedUrl: null,
            isMock: true
          };
        } else {
          try {
            const signedUrl = await getAudioSignedUrl(audioUrl, 3600);
            response.audioRecording = {
              ...response.audioRecording,
              signedUrl,
              originalUrl: audioUrl
            };
          } catch (error) {
            console.error('Error generating signed URL for response:', response._id, error);
          }
        }
      }
      return response;
    }));
    
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
  try {
    const { responseId } = req.params;
    
    const response = await SurveyResponse.findByIdAndUpdate(
      responseId,
      { 
        $set: {
          status: 'Pending_Approval',
          updatedAt: new Date()
        },
        $unset: {
          'reviewAssignment': '',
          'verificationData.reviewer': '',
          'verificationData.reviewedAt': ''
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

    // Get all responses for this survey (filtered by project manager if applicable)
    const allResponses = await SurveyResponse.find(responseFilter)
      .populate('interviewer', 'firstName lastName')
      .populate('qcBatch', 'status')
      .lean();

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

    // Get all responses for this survey (filtered by project manager if applicable)
    const allResponses = await SurveyResponse.find(responseFilter)
      .populate('interviewer', 'firstName lastName')
      .populate('qcBatch', 'status')
      .lean();

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

// Get signed URL for audio file
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

    const { getAudioSignedUrl: getSignedUrl } = require('../utils/cloudStorage');
    const signedUrl = await getSignedUrl(audioUrlToUse, 3600); // 1 hour expiry

    if (!signedUrl) {
      return res.status(404).json({
        success: false,
        message: 'Could not generate signed URL for this audio file'
      });
    }

    res.json({
      success: true,
      signedUrl,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Error getting audio signed URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate signed URL',
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
  getMyInterviews,
  getPendingApprovals,
  getNextReviewAssignment,
  releaseReviewAssignment,
  submitVerification,
  debugSurveyResponses,
  getSurveyResponseById,
  getSurveyResponses,
  approveSurveyResponse,
  rejectSurveyResponse,
  setPendingApproval,
  getACPerformanceStats,
  getInterviewerPerformanceStats,
  getLastCatiSetNumber
};