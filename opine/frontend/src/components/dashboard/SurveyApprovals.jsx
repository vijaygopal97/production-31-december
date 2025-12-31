import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { getMainText, getLanguageText, parseMultiTranslation } from '../../utils/translations';
import { 
  Search,
  Filter,
  Eye,
  Play,
  Pause,
  Volume2,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Download,
  RefreshCw,
  BarChart3,
  Target,
  Award,
  Zap,
  TrendingUp,
  Shield,
  CheckSquare,
  MapPin,
  PhoneCall
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI, catiAPI } from '../../services/api';
import api from '../../services/api';

const SurveyApprovals = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [allResponses, setAllResponses] = useState([]); // Keep for backward compatibility if needed elsewhere
  const [approvalStatsData, setApprovalStatsData] = useState({
    total: 0,
    pending: 0,
    withAudio: 0,
    completed: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [ageRange, setAgeRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('endTime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [fullSurveyData, setFullSurveyData] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [audioSignedUrls, setAudioSignedUrls] = useState({}); // Cache for signed URLs
  const [catiRecordingBlobUrls, setCatiRecordingBlobUrls] = useState({}); // Cache for CATI recording blob URLs
  const [loadingCatiRecordings, setLoadingCatiRecordings] = useState({}); // Track loading state for CATI recordings
  const [catiHasRecording, setCatiHasRecording] = useState({}); // Cache whether CATI interview has recording available
  const [checkingCatiRecording, setCheckingCatiRecording] = useState({}); // Track checking state for recording availability
  const [verificationForm, setVerificationForm] = useState({
    audioStatus: '',
    genderMatching: '',
    upcomingElectionsMatching: '',
    previousElectionsMatching: '',
    previousLoksabhaElectionsMatching: '',
    nameMatching: '',
    ageMatching: '',
    phoneNumberAsked: '',
    customFeedback: ''
  });
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [assignmentExpiresAt, setAssignmentExpiresAt] = useState(null);
  const [isGettingNextAssignment, setIsGettingNextAssignment] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [catiCallDetails, setCatiCallDetails] = useState(null);
  const [catiRecordingBlobUrl, setCatiRecordingBlobUrl] = useState(null);
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0); // Language index for responses display in modal
  const { showSuccess, showError } = useToast();

  // Reset language index when modal opens/closes
  useEffect(() => {
    if (showResponseDetails && selectedInterview) {
      // Reset to default language (0) when modal opens
      setSelectedLanguageIndex(0);
    }
  }, [showResponseDetails, selectedInterview]);

  // Helper function to get target audience from survey object
  const getTargetAudience = (interview) => {
    // First try to get from full survey data if available
    if (fullSurveyData && fullSurveyData._id === interview?.survey?._id) {
      return fullSurveyData.targetAudience;
    }
    // Fallback to interview survey data
    return interview?.survey?.targetAudience || interview?.survey?.survey?.targetAudience;
  };

  // Fetch full survey data when modal opens
  // For quality agents, use the survey data already populated in the interview object
  // For company admins, try to fetch additional details if needed
  const fetchFullSurveyData = async (surveyId, interviewSurveyData) => {
    try {
      // If we already have survey data from the interview, use it (especially for quality agents)
      if (interviewSurveyData && interviewSurveyData._id === surveyId) {
        setFullSurveyData(interviewSurveyData);
        return;
      }
      
      // For company admins, try to fetch additional details if needed
      if (user?.userType !== 'quality_agent') {
        // Try the direct survey endpoint first
        try {
          const response = await surveyAPI.getSurvey(surveyId);
          
          if (response.success) {
            setFullSurveyData(response.data.survey); // Use the nested survey object
            return;
          }
        } catch (directError) {
          console.log('Direct API failed, trying available surveys endpoint:', directError);
        }
        
        // Fallback: Try to get from available surveys (like AvailableSurveys does)
        try {
          const availableResponse = await surveyAPI.getAvailableSurveys();
          
          if (availableResponse.success) {
            const survey = availableResponse.data.surveys?.find(s => s._id === surveyId);
            if (survey) {
              setFullSurveyData(survey);
              return;
            }
          }
        } catch (availableError) {
          console.log('Available surveys API also failed:', availableError);
        }
      }
      
      // If all else fails, use the interview survey data if available
      if (interviewSurveyData) {
        setFullSurveyData(interviewSurveyData);
      } else {
        console.error('All methods failed to fetch survey data');
      }
    } catch (error) {
      console.error('Error fetching full survey data:', error);
      // Fallback to interview survey data if available
      if (interviewSurveyData) {
        setFullSurveyData(interviewSurveyData);
      }
    }
  };

  // Fetch approval statistics (optimized - uses aggregation endpoint)
  const fetchApprovalStats = async () => {
    try {
      // For quality agents, stats are calculated from interviews array (handled in stats calculation)
      if (user?.userType === 'quality_agent') {
        return;
      }
      const response = await surveyResponseAPI.getApprovalStats();
      if (response.success && response.data.stats) {
        // Store stats directly instead of fetching all responses
        setApprovalStatsData(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching approval stats:', error);
      // Set default values on error
      setApprovalStatsData({
        total: 0,
        pending: 0,
        withAudio: 0,
        completed: 0,
        rejected: 0
      });
    }
  };

  // Fetch approval stats and pending approvals list on initial load (for company admins)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Use optimized stats endpoint instead of fetching all responses
        await fetchApprovalStats();
        // For company admins, also fetch the pending approvals list
        if (user?.userType !== 'quality_agent') {
          await fetchPendingApprovals();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.userType]);

  // Fetch pending approvals when filters or pagination change (for company admins only)
  useEffect(() => {
    if (user?.userType !== 'quality_agent') {
    fetchPendingApprovals();
      // Refresh stats when filters change (in case they affect stats)
      fetchApprovalStats();
    }
  }, [searchTerm, filterGender, filterMode, ageRange, sortBy, sortOrder, currentPage, pageSize, user?.userType]);

  // Timer for assignment expiration
  useEffect(() => {
    if (!assignmentExpiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(assignmentExpiresAt);
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      
      if (diff === 0) {
        // Assignment expired
        setTimeRemaining(null);
        setAssignmentExpiresAt(null);
        if (currentAssignment) {
          showError('Your review assignment has expired. Please start a new quality check.');
          handleReleaseAssignment();
        }
      } else {
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [assignmentExpiresAt, currentAssignment]);

  // Fetch signed URL for selected interview audio when modal opens
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!selectedInterview || !showResponseDetails) return;
      
      const audioUrl = selectedInterview?.audioRecording?.audioUrl;
      if (!audioUrl) return;
      
      // Skip mock URLs - don't try to fetch signed URLs for them
      if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
        console.warn('⚠️ Mock URL detected, skipping signed URL fetch');
        return;
      }
      
      // If we already have a signed URL (from backend or cache), use it
      if (selectedInterview.audioRecording.signedUrl) {
        setAudioSignedUrls(prev => ({ ...prev, [selectedInterview._id]: selectedInterview.audioRecording.signedUrl }));
        return;
      }
      
      // If we already have it cached, skip
      if (audioSignedUrls[selectedInterview._id]) return;
      
      // Check if it's an S3 key (not a local path or full URL)
      if ((audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) && 
          !audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
        try {
          console.log('🔍 Fetching signed URL for S3 key:', audioUrl);
          const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.signedUrl) {
              console.log('✅ Signed URL fetched successfully');
              setAudioSignedUrls(prev => ({ ...prev, [selectedInterview._id]: data.signedUrl }));
            } else {
              console.error('❌ No signedUrl in response:', data);
            }
          } else {
            console.error('❌ Failed to fetch signed URL:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('❌ Error fetching signed URL:', error);
        }
      }
    };

    fetchSignedUrl();
  }, [selectedInterview?._id, selectedInterview?.audioRecording?.audioUrl, selectedInterview?.audioRecording?.signedUrl, showResponseDetails]);

  // Get next available response from queue
  const handleStartQualityCheck = async () => {
    try {
      setIsGettingNextAssignment(true);
      const params = {
        search: searchTerm,
        gender: filterGender,
        mode: filterMode,
        ageMin: ageRange.min,
        ageMax: ageRange.max
      };
      
      const response = await surveyResponseAPI.getNextReviewAssignment(params);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to get next assignment');
      }

      if (!response.data.interview) {
        showError(response.data.message || 'No responses available for review');
        return;
      }

      // Set the assigned response
      setCurrentAssignment(response.data.interview);
      setAssignmentExpiresAt(response.data.expiresAt);
      setSelectedInterview(response.data.interview);
      setCatiCallDetails(null);
      setCatiRecordingBlobUrl(null);
      setShowResponseDetails(true);
      
      // Fetch full survey data
      await fetchFullSurveyData(response.data.interview.survey._id, response.data.interview.survey);
      
      // If CATI interview, fetch call details using call_id (same as Company Admin flow)
      if (response.data.interview.interviewMode === 'cati') {
        console.log('🔍 CATI interview detected in handleStartQualityCheck');
        console.log('🔍 call_id value:', response.data.interview.call_id);
        const callId = response.data.interview.call_id;
        if (callId) {
          console.log('🔍 Fetching call details for callId:', callId);
          try {
            // Use getCallById which now supports both _id and callId
            const callResponse = await catiAPI.getCallById(callId);
            console.log('🔍 Call response:', callResponse);
            if (callResponse.success && callResponse.data) {
              console.log('✅ Call details fetched successfully:', callResponse.data);
              setCatiCallDetails(callResponse.data);
              // Fetch recording if available
              if (callResponse.data.recordingUrl) {
                try {
                  const recordingResponse = await api.get(`/api/cati/recording/${callResponse.data._id}`, {
                    responseType: 'blob'
                  });
                  if (recordingResponse.data) {
                    const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                    const blobUrl = URL.createObjectURL(blob);
                    setCatiRecordingBlobUrl(blobUrl);
                  }
                } catch (recordingError) {
                  console.error('Error fetching CATI recording:', recordingError);
                  // Don't show error for recording - it's optional
                }
              }
            } else {
              console.warn('⚠️ Call response not successful or no data:', callResponse);
              // Try fallback: search by survey and respondent phone (for older records)
              if (response.data.interview.survey?._id && response.data.interview.respondentPhone) {
                try {
                  console.log('🔍 Trying fallback: searching by survey and respondent phone');
                  const callsResponse = await catiAPI.getCalls(1, 10, response.data.interview.survey._id);
                  if (callsResponse.success && callsResponse.data?.calls) {
                    const respondentPhoneLast10 = response.data.interview.respondentPhone.slice(-10);
                    const matchingCall = callsResponse.data.calls.find(call => 
                      call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
                    );
                    if (matchingCall) {
                      console.log('✅ Found call via fallback method:', matchingCall);
                      setCatiCallDetails(matchingCall);
                      if (matchingCall.recordingUrl) {
                        try {
                          const recordingResponse = await api.get(`/api/cati/recording/${matchingCall._id}`, {
                            responseType: 'blob'
                          });
                          if (recordingResponse.data) {
                            const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                            const blobUrl = URL.createObjectURL(blob);
                            setCatiRecordingBlobUrl(blobUrl);
                          }
                        } catch (recordingError) {
                          console.error('Error fetching CATI recording via fallback:', recordingError);
                        }
                      }
                    }
                  }
                } catch (fallbackError) {
                  console.error('Error in fallback call search:', fallbackError);
                }
              }
            }
          } catch (error) {
            console.error('❌ Error fetching CATI call details:', error);
            console.error('❌ Error details:', error.response?.data || error.message);
            // Only show error if it's not a 403/404 (might be expected for some cases)
            if (error.response?.status !== 403 && error.response?.status !== 404) {
              showError('Failed to fetch call details. Please try again.');
            }
          }
        } else {
          console.warn('⚠️ No call_id found in SurveyResponse for CATI interview');
          // Try fallback: search by survey and respondent phone (for older records)
          if (response.data.interview.survey?._id && response.data.interview.respondentPhone) {
            try {
              console.log('🔍 Trying fallback: searching by survey and respondent phone');
              const callsResponse = await catiAPI.getCalls(1, 10, response.data.interview.survey._id);
              if (callsResponse.success && callsResponse.data?.calls) {
                const respondentPhoneLast10 = response.data.interview.respondentPhone.slice(-10);
                const matchingCall = callsResponse.data.calls.find(call => 
                  call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
                );
                if (matchingCall) {
                  console.log('✅ Found call via fallback method:', matchingCall);
                  setCatiCallDetails(matchingCall);
                  if (matchingCall.recordingUrl) {
                    try {
                      const recordingResponse = await api.get(`/api/cati/recording/${matchingCall._id}`, {
                        responseType: 'blob'
                      });
                      if (recordingResponse.data) {
                        const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                        const blobUrl = URL.createObjectURL(blob);
                        setCatiRecordingBlobUrl(blobUrl);
                      }
                    } catch (recordingError) {
                      console.error('Error fetching CATI recording via fallback:', recordingError);
                    }
                  }
                }
              }
            } catch (fallbackError) {
              console.error('Error in fallback call search:', fallbackError);
            }
          }
        }
      }
      
      showSuccess('Response assigned. You have 30 minutes to complete the review.');
    } catch (error) {
      console.error('Error getting next assignment:', error);
      showError(error.response?.data?.message || 'Failed to get next assignment. Please try again.');
    } finally {
      setIsGettingNextAssignment(false);
    }
  };

  // Release assignment (when user closes modal without submitting)
  const handleReleaseAssignment = async () => {
    if (!currentAssignment || !currentAssignment.responseId) return;

    try {
      await surveyResponseAPI.releaseReviewAssignment(currentAssignment.responseId);
      setCurrentAssignment(null);
      setAssignmentExpiresAt(null);
      setSelectedInterview(null);
      setShowResponseDetails(false);
      resetVerificationForm();
    } catch (error) {
      // Silently ignore 403/404 errors (assignment might already be expired/released or doesn't exist)
      // Don't log these errors as they're expected when assignment is already released
      if (error.response?.status !== 403 && error.response?.status !== 404) {
        console.error('Error releasing assignment:', error);
      }
      // Silently handle 403/404 - these are expected when assignment is already released/expired
    }
  };

  const fetchPendingApprovals = async () => {
    // Only fetch list for company admins
    if (user?.userType === 'quality_agent') {
      return;
    }
    
    try {
      setLoading(true);
      const params = {
        search: searchTerm,
        gender: filterGender,
        mode: filterMode,
        ageMin: ageRange.min,
        ageMax: ageRange.max,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize
      };
      
      const response = await surveyResponseAPI.getPendingApprovals(params);
      
      setInterviews(response.data.interviews || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      showError('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  };

  // Handle verification form input changes
  const handleVerificationFormChange = (field, value) => {
    setVerificationForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Reset verification form when modal opens/closes
  const resetVerificationForm = () => {
    setVerificationForm({
      audioStatus: '',
      genderMatching: '',
      upcomingElectionsMatching: '',
      previousElectionsMatching: '',
      previousLoksabhaElectionsMatching: '',
      nameMatching: '',
      ageMatching: '',
      phoneNumberAsked: '',
      customFeedback: ''
    });
  };

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup: stop all audio and remove dynamically created audio elements
      const allAudioElements = document.querySelectorAll('audio[data-interview-id]');
      allAudioElements.forEach(el => {
        el.pause();
        el.currentTime = 0;
        // Only remove dynamically created elements (not the one in modal)
        if (!el.closest('.bg-gray-50')) {
          el.remove();
        }
      });
      setAudioPlaying(null);
    };
  }, []);

  // Cleanup audio when modal closes
  const handleCloseModal = async () => {
    // Stop any playing audio
    const allAudioElements = document.querySelectorAll('audio[data-interview-id]');
    allAudioElements.forEach(el => {
      el.pause();
      el.currentTime = 0;
    });
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
    setAudioPlaying(null);
    
    // Cleanup CATI recording blob URL
    if (catiRecordingBlobUrl) {
      URL.revokeObjectURL(catiRecordingBlobUrl);
      setCatiRecordingBlobUrl(null);
    }
    
    // Release assignment if one exists (user is closing without submitting)
    // Only try to release if we have a valid assignment
    if (currentAssignment && currentAssignment.responseId) {
      try {
      await handleReleaseAssignment();
      } catch (error) {
        // Silently ignore errors when releasing assignment (assignment might already be expired/released)
        console.log('Assignment release skipped (may already be released):', error.message);
      }
    }
    
    setShowResponseDetails(false);
    setSelectedInterview(null);
    setFullSurveyData(null); // Clear full survey data
    setCatiCallDetails(null); // Clear CATI call details
    resetVerificationForm();
  };

  // Helper function to check if a value is a rejection option for a question type
  const isRejectionOption = (questionType, value) => {
    if (!value || value === '') return false;
    
    switch (questionType) {
      case 'audioStatus':
        // Rejection options: anything that's not "1", "4", or "7"
        return value !== '1' && value !== '4' && value !== '7';
      case 'gender':
        // Rejection options: "2" (Not Matched), "3" (Male answering on behalf of female)
        return value === '2' || value === '3';
      case 'upcomingElection':
      case 'assembly2021':
      case 'lokSabha2024':
      case 'name':
      case 'age':
        // Rejection options: "2" (Not Matched), "4" (Did not ask)
        // Note: "3" (Cannot hear) is acceptable, not a rejection
        return value === '2' || value === '4';
      default:
        return false;
    }
  };

  // Helper function to check if any rejection option has been selected
  // NOTE: Questions 6 (name), 7 (age), and 8 (phoneNumber) are excluded from rejection logic
  const hasRejectionOption = () => {
    // Check in order of questions (excluding name, age, and phoneNumber)
    const questionOrder = [
      { type: 'audioStatus', value: verificationForm.audioStatus },
      { type: 'gender', value: verificationForm.genderMatching },
      { type: 'upcomingElection', value: verificationForm.upcomingElectionsMatching },
      { type: 'assembly2021', value: verificationForm.previousElectionsMatching },
      { type: 'lokSabha2024', value: verificationForm.previousLoksabhaElectionsMatching },
      // Q6 (name), Q7 (age), and Q8 (phoneNumber) are excluded - they don't affect rejection
    ];
    
    for (const question of questionOrder) {
      if (question.value && isRejectionOption(question.type, question.value)) {
        return true;
      }
    }
    
    return false;
  };

  // Helper function to check if a verification question should be shown
  const shouldShowVerificationQuestion = (questionType, interview) => {
    if (!interview) return true;
    
    // Phone number question should not be shown for CATI responses
    if (questionType === 'phoneNumber' && interview.interviewMode === 'cati') {
      return false;
    }
    
    const audioStatus = verificationForm.audioStatus;
    
    // Q1-Q5: Only option '1' (first/best option) is acceptable for approval
    // If ANY of Q1-Q5 is NOT option '1', hide ALL subsequent questions
    
    // Q1: Audio Status - if NOT option '1', hide ALL subsequent questions (Q2-Q8)
    // Check this FIRST before anything else
    if (audioStatus !== '' && audioStatus !== null && audioStatus !== undefined && audioStatus !== '1') {
      // If audioStatus exists and is not '1', only show audioStatus question itself
      // Hide everything else (Q2-Q8 including Q6 name)
      return questionType === 'audioStatus';
    }
    
    // Q2: Gender Matching - if NOT option '1', hide ALL subsequent questions (Q3-Q8)
    if (verificationForm.genderMatching && verificationForm.genderMatching !== '' && verificationForm.genderMatching !== '1') {
      // If gender is not '1', only show audioStatus and gender questions
      // Hide everything else (Q3-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender') {
        return false;
      }
    }
    
    // Q3: Upcoming Elections - if NOT option '1', hide ALL subsequent questions (Q4-Q8)
    if (verificationForm.upcomingElectionsMatching && verificationForm.upcomingElectionsMatching !== '' && verificationForm.upcomingElectionsMatching !== '1') {
      // If Q3 is not '1', only show Q1, Q2, Q3
      // Hide everything else (Q4-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender' && questionType !== 'upcomingElection') {
        return false;
      }
    }
    
    // Q4: Previous Elections - if NOT option '1', hide ALL subsequent questions (Q5-Q8)
    if (verificationForm.previousElectionsMatching && verificationForm.previousElectionsMatching !== '' && verificationForm.previousElectionsMatching !== '1') {
      // If Q4 is not '1', only show Q1, Q2, Q3, Q4
      // Hide everything else (Q5-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender' && 
          questionType !== 'upcomingElection' && questionType !== 'assembly2021') {
        return false;
      }
    }
    
    // Q5: Previous Loksabha Elections - if NOT option '1', hide Q6, Q7, Q8 (informational questions)
    if (verificationForm.previousLoksabhaElectionsMatching && verificationForm.previousLoksabhaElectionsMatching !== '' && verificationForm.previousLoksabhaElectionsMatching !== '1') {
      // If Q5 is not '1', hide Q6, Q7, Q8
      if (questionType === 'name' || questionType === 'age' || questionType === 'phoneNumber') {
        return false;
      }
    }
    
    // For gender question, only show if audioStatus is '1' (best option)
    if (questionType === 'gender') {
      if (audioStatus !== '1') {
        return false;
      }
    }
    
    // Only reach here if none of the rejection conditions above were met
    // Now check if related response is skipped
    const verificationResponses = getVerificationResponses(interview);
    
    // Check if related response is skipped
    switch (questionType) {
      case 'gender':
        return !verificationResponses.genderResponse?.isSkipped;
      case 'upcomingElection':
        return !verificationResponses.upcomingElectionResponse?.isSkipped;
      case 'assembly2021':
        return !verificationResponses.assembly2021Response?.isSkipped;
      case 'lokSabha2024':
        return !verificationResponses.lokSabha2024Response?.isSkipped;
      case 'name':
        return !verificationResponses.nameResponse?.isSkipped;
      case 'age':
        return !verificationResponses.ageResponse?.isSkipped;
      default:
        return true;
    }
  };

  // Check if form is complete and valid
  const isVerificationFormValid = () => {
    if (!selectedInterview) return false;
    
    // Audio status is always required
    if (verificationForm.audioStatus === '') return false;
    
    // If a rejection option is selected, form is valid (don't require other questions)
    if (hasRejectionOption()) {
      return true;
    }
    
    // Otherwise, check each question only if it should be shown
    if (shouldShowVerificationQuestion('gender', selectedInterview) && verificationForm.genderMatching === '') return false;
    if (shouldShowVerificationQuestion('upcomingElection', selectedInterview) && verificationForm.upcomingElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('assembly2021', selectedInterview) && verificationForm.previousElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('lokSabha2024', selectedInterview) && verificationForm.previousLoksabhaElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('name', selectedInterview) && verificationForm.nameMatching === '') return false;
    if (shouldShowVerificationQuestion('age', selectedInterview) && verificationForm.ageMatching === '') return false;
    if (shouldShowVerificationQuestion('phoneNumber', selectedInterview) && verificationForm.phoneNumberAsked === '') return false;
    
    return true;
  };

  // Determine approval status based on form responses
  const getApprovalStatus = () => {
    if (!selectedInterview) return 'rejected';
    
    // If any rejection option is selected, automatically reject
    if (hasRejectionOption()) {
      return 'rejected';
    }
    
    // For approval, ALL fields must be either:
    // - Best case (option 1 for most fields, or 1/4 for audioStatus), OR
    // - "Cannot hear the response clearly" (option 3 for matching fields, or 7 for audioStatus)
    // If ANY field has "Not Matched" (2) or any other invalid value, reject
    // Only check questions that should be shown
    
    // Q1: Audio Status - Accept only if "1" (best), "4" (best), or "7" (cannot hear)
    const audioStatus = verificationForm.audioStatus;
    if (audioStatus !== '1' && audioStatus !== '4' && audioStatus !== '7') {
      return 'rejected';
    }
    
    // Q2: Gender Matching - Accept only if "1" (matched/best)
    // Note: Option "3" is "Male answering on behalf of female", NOT "cannot hear", so reject it
    // Reject if "2" (not matched), "3" (male answering), or any other value
    if (shouldShowVerificationQuestion('gender', selectedInterview)) {
      if (verificationForm.genderMatching !== '1') {
        return 'rejected';
      }
    }
    
    // Q3: Upcoming Elections Matching - Accept only if "1" (matched/best) or "3" (cannot hear)
    if (shouldShowVerificationQuestion('upcomingElection', selectedInterview)) {
      if (verificationForm.upcomingElectionsMatching !== '1' && verificationForm.upcomingElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    // Q4: Previous Elections Matching - Accept only if "1" (matched/best) or "3" (cannot hear)
    if (shouldShowVerificationQuestion('assembly2021', selectedInterview)) {
      if (verificationForm.previousElectionsMatching !== '1' && verificationForm.previousElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    // Q5: Previous Loksabha Elections Matching - Accept only if "1" (matched/best) or "3" (cannot hear)
    if (shouldShowVerificationQuestion('lokSabha2024', selectedInterview)) {
      if (verificationForm.previousLoksabhaElectionsMatching !== '1' && verificationForm.previousLoksabhaElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    // Q6: Name Matching - EXCLUDED from rejection logic (informational only)
    // Q7: Age Matching - EXCLUDED from rejection logic (informational only)
    // Q8: Phone Number Asked - EXCLUDED from rejection logic (informational only)
    // These questions are answered but do NOT affect approval/rejection status
    
    // All criteria met = approve
    return 'approved';
  };

  // Submit verification form
  const handleSubmitVerification = async () => {
    if (!isVerificationFormValid()) {
      showError('Please answer all required questions before submitting');
      return;
    }

    try {
      setIsSubmittingVerification(true);
      
      const approvalStatus = getApprovalStatus();
      const verificationData = {
        responseId: selectedInterview.responseId,
        status: approvalStatus,
        verificationCriteria: {
          audioStatus: verificationForm.audioStatus,
          genderMatching: verificationForm.genderMatching,
          upcomingElectionsMatching: verificationForm.upcomingElectionsMatching,
          previousElectionsMatching: verificationForm.previousElectionsMatching,
          previousLoksabhaElectionsMatching: verificationForm.previousLoksabhaElectionsMatching,
          nameMatching: verificationForm.nameMatching,
          ageMatching: verificationForm.ageMatching,
          phoneNumberAsked: verificationForm.phoneNumberAsked
        },
        feedback: verificationForm.customFeedback || ''
      };

      // Submit verification to backend
      const response = await surveyResponseAPI.submitVerification(verificationData);
      
      if (!response.success) {
        throw new Error(response.message || 'Verification submission failed');
      }
      
      if (approvalStatus === 'approved') {
        showSuccess('Survey response approved successfully!');
      } else {
        showSuccess('Survey response has been rejected with feedback provided to interviewer.');
      }
      
      // Clear assignment and close modal (don't try to release - backend already did it)
      setCurrentAssignment(null);
      setAssignmentExpiresAt(null);
      setSelectedInterview(null);
      setShowResponseDetails(false);
      resetVerificationForm();
      
      // Cleanup CATI recording blob URL
      if (catiRecordingBlobUrl) {
        URL.revokeObjectURL(catiRecordingBlobUrl);
        setCatiRecordingBlobUrl(null);
      }
      
      // Refresh stats using optimized endpoint
      await fetchApprovalStats();
      
    } catch (error) {
      console.error('Error submitting verification:', error);
      showError('Failed to submit verification. Please try again.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Helper function to get respondent info from responses
  const getRespondentInfo = (responses, surveyId = null) => {
    // Helper to extract value from response (handle arrays)
    const extractValue = (response) => {
      if (!response || response === null || response === undefined) return null;
      if (Array.isArray(response)) {
        // For arrays, return the first value (or join if needed)
        return response.length > 0 ? response[0] : null;
      }
      return response;
    };

    // Helper to find response by question text (ignoring translations)
    const findResponseByQuestionText = (responses, searchTexts) => {
      return responses.find(r => {
        if (!r.questionText) return false;
        const mainText = getMainText(r.questionText).toLowerCase();
        return searchTexts.some(text => mainText.includes(text.toLowerCase()));
      });
    };

    // Special handling for survey "68fd1915d41841da463f0d46"
    if (surveyId === '68fd1915d41841da463f0d46') {
      // Find name from name question
      const nameResponse = findResponseByQuestionText(responses, [
        'what is your full name',
        'full name',
        'name'
      ]);
      
      // Find gender from "Please note the respondent's gender"
      let genderResponse = findResponseByQuestionText(responses, [
        'please note the respondent\'s gender',
        'note the respondent\'s gender',
        'respondent\'s gender',
        'respondent gender',
        'note the gender'
      ]);
      
      // If not found, try broader search
      if (!genderResponse) {
        genderResponse = findResponseByQuestionText(responses, ['gender']);
      }
      
      // If still not found, try to find by question ID or other patterns
      if (!genderResponse) {
        const genderResponseById = responses.find(r => 
          r.questionId?.includes('gender') || 
          r.questionId?.includes('respondent_gender')
        );
        if (genderResponseById) {
          return {
            name: extractValue(nameResponse?.response) || 'Not Available',
            gender: extractValue(genderResponseById?.response) || 'Not Available',
            age: extractValue(ageResponse?.response) || 'Not Available'
          };
        }
      }
      
      // Last resort: try to find in survey structure if available
      if (!genderResponse && fullSurveyData) {
        // Find the gender question in the survey
        let genderQuestion = null;
        if (fullSurveyData.sections) {
          for (const section of fullSurveyData.sections) {
            if (section.questions) {
              genderQuestion = section.questions.find(q => {
                const qText = getMainText(q.text || '').toLowerCase();
                return qText.includes('please note the respondent\'s gender') ||
                       qText.includes('note the respondent\'s gender') ||
                       qText.includes('respondent\'s gender');
              });
              if (genderQuestion) break;
            }
          }
        }
        
        // If found, try to match by question ID
        if (genderQuestion && genderQuestion.id) {
          genderResponse = responses.find(r => r.questionId === genderQuestion.id);
        }
      }
      
      // Find age from age question
      const ageResponse = findResponseByQuestionText(responses, [
        'could you please tell me your age',
        'your age in complete years',
        'age in complete years',
        'age'
      ]);

      return {
        name: extractValue(nameResponse?.response) || 'Not Available',
        gender: extractValue(genderResponse?.response) || 'Not Available',
        age: extractValue(ageResponse?.response) || 'Not Available'
      };
    }

    // Default behavior for other surveys
    const nameResponse = findResponseByQuestionText(responses, [
      'name',
      'respondent',
      'full name'
    ]);
    const genderResponse = findResponseByQuestionText(responses, [
      'gender',
      'sex'
    ]);
    const ageResponse = findResponseByQuestionText(responses, [
      'age',
      'year'
    ]);

    return {
      name: extractValue(nameResponse?.response) || 'Not Available',
      gender: extractValue(genderResponse?.response) || 'Not Available',
      age: extractValue(ageResponse?.response) || 'Not Available'
    };
  };

  // Helper function to parse age from response
  const parseAge = (ageResponse) => {
    if (!ageResponse || ageResponse === 'Not Available') return null;
    
    // Try to extract number from the response
    const ageMatch = ageResponse.toString().match(/\d+/);
    return ageMatch ? parseInt(ageMatch[0]) : null;
  };

  // Helper function to check if age is in range
  const isAgeInRange = (age, min, max) => {
    if (!age) return false;
    if (min && age < parseInt(min)) return false;
    if (max && age > parseInt(max)) return false;
    return true;
  };

  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Helper function to format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending_Approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending_Approval':
        return <AlertCircle className="w-4 h-4" />;
      case 'Approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'Rejected':
        return <X className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterGender('');
    setFilterMode('');
    setAgeRange({ min: '', max: '' });
  };

  // Helper function to get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (filterGender) count++;
    if (filterMode) count++;
    if (ageRange.min || ageRange.max) count++;
    return count;
  };

  // Helper function to get operator description for conditional logic
  const getOperatorDescription = (operator) => {
    switch (operator) {
      case 'equals': return 'is exactly';
      case 'not_equals': return 'is not';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      case 'greater_than': return 'is greater than';
      case 'less_than': return 'is less than';
      case 'is_empty': return 'is empty';
      case 'is_not_empty': return 'is not empty';
      case 'is_selected': return 'is selected';
      case 'is_not_selected': return 'is not selected';
      default: return operator;
    }
  };

  // Helper function to find question by ID in survey data
  const findQuestionById = (questionId, survey) => {
    if (survey?.sections) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.id === questionId) {
              return question;
            }
          }
        }
      }
    }
    return null;
  };

  // Helper function to find question by text in survey data
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

  // Helper function to check if a question is AC selection or polling station
  const isACOrPollingStationQuestion = (responseItem, surveyQuestion) => {
    // Check by questionId
    if (responseItem.questionId === 'ac-selection') return true;
    // Check by question type
    if (surveyQuestion?.type === 'polling_station') return true;
    // Check by question text (fallback)
    const questionText = responseItem.questionText || surveyQuestion?.text || '';
    if (questionText.toLowerCase().includes('select assembly constituency') || 
        questionText.toLowerCase().includes('select polling station')) {
      return true;
    }
    return false;
  };

  // Helper function to separate AC/polling station questions from regular questions
  const separateQuestions = (responses, survey) => {
    if (!responses || !Array.isArray(responses)) {
      return { interviewInfoQuestions: [], regularQuestions: [] };
    }
    
    const interviewInfoQuestions = [];
    const regularQuestions = [];
    
    responses.forEach((responseItem) => {
      const surveyQuestion = findQuestionByText(responseItem.questionText, survey);
      if (isACOrPollingStationQuestion(responseItem, surveyQuestion)) {
        interviewInfoQuestions.push(responseItem);
      } else {
        regularQuestions.push(responseItem);
      }
    });
    
    return { interviewInfoQuestions, regularQuestions };
  };

  // Helper function to extract AC and polling station info from responses
  const getACAndPollingStationFromResponses = (responses, survey) => {
    if (!responses || !Array.isArray(responses)) {
      return { ac: null, pollingStation: null, groupName: null };
    }
    
    let ac = null;
    let pollingStation = null;
    let groupName = null;
    
    responses.forEach((responseItem) => {
      const surveyQuestion = findQuestionByText(responseItem.questionText, survey);
      
      // Check if this is AC selection question
      if (responseItem.questionId === 'ac-selection' || 
          (surveyQuestion && surveyQuestion.id === 'ac-selection')) {
        ac = responseItem.response || null;
      }
      
      // Check if this is polling station question
      if (surveyQuestion?.type === 'polling_station' || 
          responseItem.questionText?.toLowerCase().includes('select polling station')) {
        // Polling station response should be in format "Code - Name" (e.g., "40 - Station Name")
        // or might be stored as "Group - Code - Name" in polling-station-selection
        const stationResponse = responseItem.response;
        if (stationResponse) {
          if (typeof stationResponse === 'string' && stationResponse.includes(' - ')) {
            const parts = stationResponse.split(' - ');
            // Check if it's "Group - Station" format (where Station is "Code - Name")
            if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
              // Format: "Group X - Code - Name"
              groupName = parts[0] || null;
              pollingStation = parts.slice(1).join(' - '); // Join "Code - Name"
            } else if (parts.length === 2 && parts[0].toLowerCase().startsWith('group')) {
              // Format: "Group X - Code" (missing name, but use what we have)
              groupName = parts[0] || null;
              pollingStation = parts[1] || stationResponse;
            } else {
              // It's already in "Code - Name" format
              pollingStation = stationResponse;
            }
          } else {
            // Just code or name - use as is
            pollingStation = stationResponse;
          }
        }
      }
      
      // Also check for polling station group selection
      if (responseItem.questionId === 'polling-station-group' ||
          responseItem.questionText?.toLowerCase().includes('select group')) {
        groupName = responseItem.response || null;
      }
    });
    
    return { ac, pollingStation, groupName };
  };

  // Helper function to format polling station display with code and name
  const formatPollingStationDisplay = (stationValue, selectedPollingStation) => {
    // Priority 1: Use selectedPollingStation.stationName (should have full "Code - Name" format)
    if (selectedPollingStation?.stationName) {
      // If it already includes " - ", it's in the correct format "Code - Name"
      if (selectedPollingStation.stationName.includes(' - ')) {
        return selectedPollingStation.stationName;
      }
      // If it's just a code, check if stationValue has the full format
      if (stationValue && typeof stationValue === 'string' && stationValue.includes(' - ')) {
        return stationValue;
      }
      // If selectedPollingStation.stationName is just a code, return it as is
      return selectedPollingStation.stationName;
    }
    
    // Priority 2: Use stationValue from response
    if (stationValue) {
      // If it already includes " - ", it's in the correct format "Code - Name"
      if (typeof stationValue === 'string' && stationValue.includes(' - ')) {
        return stationValue;
      }
      // If stationValue is in format "Group - Code", extract just the code part
      if (typeof stationValue === 'string' && stationValue.includes(' - ')) {
        const parts = stationValue.split(' - ');
        if (parts[0].toLowerCase().startsWith('group')) {
          return parts[1] || stationValue;
        }
        return stationValue;
      }
      // If it's just a code (numeric), return as is
      return stationValue;
    }
    
    return null;
  };

  // Helper function to evaluate if a condition is met
  const evaluateCondition = (condition, responses, survey) => {
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

    const responseValue = targetResponse.response;
    const conditionValue = condition.value;

    // Find the target question to get its options for proper comparison
    const targetQuestion = findQuestionById(condition.questionId, survey);

    // Helper function to get main text (without translation) for comparison
    const getComparisonValue = (val) => {
      if (val === null || val === undefined) return String(val || '').toLowerCase().trim();
      const strVal = String(val);
      
      // If we have the target question and it has options, try to match the value to an option
      if (targetQuestion && targetQuestion.options && Array.isArray(targetQuestion.options)) {
        // Check if val matches any option.value or option.text (after stripping translations)
        for (const option of targetQuestion.options) {
          const optionValue = typeof option === 'object' ? (option.value || option.text) : option;
          const optionText = typeof option === 'object' ? option.text : option;
          
          // Check if val matches option.value or option.text (with or without translations)
          if (strVal === String(optionValue) || strVal === String(optionText)) {
            // Return the main text of the option (without translation)
            return getMainText(String(optionText)).toLowerCase().trim();
          }
          
          // Also check if main texts match (in case translations differ)
          if (getMainText(strVal).toLowerCase().trim() === getMainText(String(optionText)).toLowerCase().trim()) {
            return getMainText(String(optionText)).toLowerCase().trim();
          }
        }
      }
      
      // Fallback: just strip translations from the value itself
      return getMainText(strVal).toLowerCase().trim();
    };

    // Get comparison values for both response and condition value
    // Handle arrays properly
    const responseComparison = Array.isArray(responseValue) 
      ? responseValue.map(r => getComparisonValue(r))
      : getComparisonValue(responseValue);
    const conditionComparison = getComparisonValue(conditionValue);

    let met = false;

    switch (condition.operator) {
      case 'equals':
        if (Array.isArray(responseComparison)) {
          met = responseComparison.some(r => r === conditionComparison);
        } else {
          met = responseComparison === conditionComparison;
        }
        break;
      case 'not_equals':
        if (Array.isArray(responseComparison)) {
          met = !responseComparison.some(r => r === conditionComparison);
        } else {
          met = responseComparison !== conditionComparison;
        }
        break;
      case 'contains':
        const responseStr = Array.isArray(responseComparison) 
          ? responseComparison.join(' ') 
          : String(responseComparison);
        met = responseStr.includes(conditionComparison);
        break;
      case 'not_contains':
        const responseStr2 = Array.isArray(responseComparison) 
          ? responseComparison.join(' ') 
          : String(responseComparison);
        met = !responseStr2.includes(conditionComparison);
        break;
      case 'greater_than':
        met = parseFloat(responseValue) > parseFloat(conditionValue);
        break;
      case 'less_than':
        met = parseFloat(responseValue) < parseFloat(conditionValue);
        break;
      case 'is_empty':
        met = !responseValue || (Array.isArray(responseValue) ? responseValue.length === 0 : responseValue.toString().trim() === '');
        break;
      case 'is_not_empty':
        met = responseValue && (Array.isArray(responseValue) ? responseValue.length > 0 : responseValue.toString().trim() !== '');
        break;
      case 'is_selected':
        if (Array.isArray(responseComparison)) {
          met = responseComparison.some(r => r === conditionComparison);
        } else {
          met = responseComparison === conditionComparison;
        }
        break;
      case 'is_not_selected':
        if (Array.isArray(responseComparison)) {
          met = !responseComparison.some(r => r === conditionComparison);
        } else {
          met = responseComparison !== conditionComparison;
        }
        break;
      default:
        met = false;
    }

    return met;
  };

  // Helper function to check if all conditions are met
  const areConditionsMet = (conditions, responses, survey) => {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => evaluateCondition(condition, responses, survey));
  };

  // Helper function to calculate effective questions (only questions that were actually shown)
  const calculateEffectiveQuestions = (responses, survey) => {
    return responses?.filter(r => {
      // If not skipped, it was shown and answered
      if (!r.isSkipped) return true;
      
      // If skipped, check if it was due to unmet conditions
      const surveyQuestion = findQuestionByText(r.questionText, survey);
      const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
      
      if (hasConditions) {
        // Check if conditions were met
        const conditionsMet = areConditionsMet(surveyQuestion.conditions, responses, survey);
        
        // If conditions were not met, this question was never shown
        if (!conditionsMet) {
          return false;
        }
      }
      
      // If no conditions or conditions were met, user saw it and chose to skip
      return true;
    }).length || 0;
  };

  // Helper function to format conditional logic
  const formatConditionalLogic = (conditions, survey) => {
    if (!conditions || conditions.length === 0) return null;
    
    const formattedConditions = conditions
      .filter(condition => condition.questionId && condition.operator && condition.value !== undefined && condition.value !== '__NOVALUE__')
      .map((condition, index) => {
        const targetQuestion = findQuestionById(condition.questionId, survey);
        const targetQuestionText = targetQuestion ? targetQuestion.text : `Question ${condition.questionId}`;
        const operator = getOperatorDescription(condition.operator);
        const value = condition.value;
        
        return `${targetQuestionText} ${operator} "${value}"`;
      });

    if (formattedConditions.length === 0) return null;
    
    return formattedConditions.join(' AND ');
  };

  // Helper function to format response display text
  const formatResponseDisplay = (response, surveyQuestion, languageIndex = 0) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }

    // If it's an array (multiple selections)
    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      
      // Map each value to its display text using the question options
      const displayTexts = response.map(value => {
        // Check if this is an "Others: [specified text]" response
        if (typeof value === 'string' && value.startsWith('Others: ')) {
          return value; // Return as-is (e.g., "Others: Custom text")
        }
        
        if (surveyQuestion && surveyQuestion.options) {
          const option = surveyQuestion.options.find(opt => opt.value === value);
          if (option) {
            // Use getLanguageText to get the selected language
            return getLanguageText(option.text, languageIndex);
          }
          return value;
        }
        return value;
      });
      
      return displayTexts.join(', ');
    }

    // If it's a string or single value
    if (typeof response === 'string' || typeof response === 'number') {
      // Check if this is an "Others: [specified text]" response
      if (typeof response === 'string' && response.startsWith('Others: ')) {
        return response; // Return as-is (e.g., "Others: Custom text")
      }
      
      // Handle rating responses with labels
      if (surveyQuestion && surveyQuestion.type === 'rating' && typeof response === 'number') {
        const scale = surveyQuestion.scale || {};
        const labels = scale.labels || [];
        const min = scale.min || 1;
        const label = labels[response - min];
        if (label) {
          const labelText = getLanguageText(label, languageIndex);
          return `${response} (${labelText})`;
        }
        return response.toString();
      }
      
      // Map to display text using question options
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === response);
        if (option) {
          // Use getLanguageText to get the selected language
          return getLanguageText(option.text, languageIndex);
        }
        return response.toString();
      }
      return response.toString();
    }

    return JSON.stringify(response);
  };

  // Helper function to find question in survey by keywords
  const findQuestionInSurveyByKeywords = (keywords, survey, requireAll = false) => {
    if (!survey) return null;
    const actualSurvey = survey.survey || survey;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    
    const searchInQuestions = (questions) => {
      for (const question of questions) {
        const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
        if (requireAll) {
          if (normalizedKeywords.every(keyword => questionText.includes(keyword))) {
            return question;
          }
        } else {
          if (normalizedKeywords.some(keyword => questionText.includes(keyword))) {
            return question;
          }
        }
      }
      return null;
    };
    
    // Search in sections
    if (actualSurvey.sections) {
      for (const section of actualSurvey.sections) {
        if (section.questions) {
          const found = searchInQuestions(section.questions);
          if (found) return found;
        }
      }
    }
    
    // Search in top-level questions
    if (actualSurvey.questions) {
      const found = searchInQuestions(actualSurvey.questions);
      if (found) return found;
    }
    
    return null;
  };

  // Helper function to find response by matching question text (without translations)
  const findResponseByQuestionText = (responses, targetQuestionText) => {
    if (!responses || !Array.isArray(responses)) return null;
    const targetMainText = getMainText(targetQuestionText).toLowerCase().trim();
    
    return responses.find(r => {
      const responseQuestionText = getMainText(r.questionText || '').toLowerCase().trim();
      // Exact match or contains the main text
      return responseQuestionText === targetMainText || 
             responseQuestionText.includes(targetMainText) ||
             targetMainText.includes(responseQuestionText);
    });
  };

  // Helper function to find response by matching survey question (finds question in survey, then matches response)
  const findResponseBySurveyQuestion = (keywords, responses, survey, requireAll = false, excludeKeywords = []) => {
    // First, find the question in the survey
    const surveyQuestion = findQuestionInSurveyByKeywords(keywords, survey, requireAll);
    if (!surveyQuestion) return null;
    
    // Get the main text of the survey question (without translation)
    const surveyQuestionMainText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
    
    // If exclude keywords are provided, check if this question matches them
    if (excludeKeywords.length > 0) {
      const questionTextLower = surveyQuestionMainText.toLowerCase();
      const hasExcludeKeyword = excludeKeywords.some(keyword => questionTextLower.includes(keyword.toLowerCase()));
      if (hasExcludeKeyword) return null;
    }
    
    // Now find the response that matches this question text
    return findResponseByQuestionText(responses, surveyQuestionMainText);
  };

  // Helper function to find response by question text keywords (fallback method)
  const findResponseByKeywords = (responses, keywords, requireAll = false, excludeKeywords = []) => {
    if (!responses || !Array.isArray(responses)) return null;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    return responses.find(r => {
      const questionText = getMainText(r.questionText || '').toLowerCase();
      
      // Check exclude keywords first
      if (normalizedExclude.length > 0) {
        const hasExcludeKeyword = normalizedExclude.some(keyword => questionText.includes(keyword));
        if (hasExcludeKeyword) return false;
      }
      
      // Check include keywords
      if (requireAll) {
        return normalizedKeywords.every(keyword => questionText.includes(keyword));
      } else {
        return normalizedKeywords.some(keyword => questionText.includes(keyword));
      }
    });
  };

  // Get specific responses for verification questions
  const getVerificationResponses = (interview) => {
    if (!interview || !interview.responses) {
      return {
        gender: 'Not Available',
        upcomingElection: 'Not Available',
        assembly2021: 'Not Available',
        lokSabha2024: 'Not Available',
        name: 'Not Available',
        age: 'Not Available'
      };
    }
    
    const responses = interview.responses;
    const survey = interview.survey || fullSurveyData;
    
    // Gender response - match by finding question in survey first
    let genderResponse = findResponseBySurveyQuestion(['gender', 'sex'], responses, survey, false);
    if (!genderResponse) {
      genderResponse = findResponseByKeywords(responses, ['gender', 'sex'], false);
    }
    const genderValue = genderResponse?.response 
      ? (Array.isArray(genderResponse.response) ? genderResponse.response[0] : genderResponse.response)
      : null;
    const genderQuestion = genderResponse ? findQuestionByText(genderResponse.questionText, survey) : null;
    
    // Upcoming election response (Q9) - "2025 Preference"
    // Match by finding question in survey first
    let upcomingElectionResponse = findResponseBySurveyQuestion(['2025', 'preference'], responses, survey, true);
    if (!upcomingElectionResponse) {
      upcomingElectionResponse = findResponseByKeywords(responses, ['2025', 'preference'], true);
    }
    const upcomingElectionValue = upcomingElectionResponse?.response 
      ? (Array.isArray(upcomingElectionResponse.response) ? upcomingElectionResponse.response[0] : upcomingElectionResponse.response)
      : null;
    const upcomingElectionQuestion = upcomingElectionResponse ? findQuestionByText(upcomingElectionResponse.questionText, survey) : null;
    
    // 2021 Assembly election response (Q6) - "Which party did you vote for in the last assembly elections (MLA) in 2021?"
    let assembly2021Response = findResponseBySurveyQuestion([
      'last assembly elections', 'mla', '2021', 'which party did you vote'
    ], responses, survey, false);
    if (!assembly2021Response) {
      assembly2021Response = findResponseByKeywords(responses, [
        'last assembly elections', 'mla', '2021', 'which party did you vote'
      ], false);
    }
    const assembly2021Value = assembly2021Response?.response 
      ? (Array.isArray(assembly2021Response.response) ? assembly2021Response.response[0] : assembly2021Response.response)
      : null;
    const assembly2021Question = assembly2021Response ? findQuestionByText(assembly2021Response.questionText, survey) : null;
    
    // 2024 Lok Sabha election response (Q6) - "2024 GE Party Choice"
    // Match by finding "2024 GE Party Choice" question in survey first
    // Use more specific keywords to avoid matching age or other questions
    let lokSabha2024Response = null;
    
    // Strategy 1: Look for "ge party choice" with "2024" - require both
    lokSabha2024Response = findResponseBySurveyQuestion([
      'ge party choice', '2024'
    ], responses, survey, true, ['age', 'বয়স', 'year', 'old', 'assembly', 'ae', '2021', '2025']);
    
    // Strategy 2: Look for responses with "2024" and "ge party choice" separately
    if (!lokSabha2024Response) {
      lokSabha2024Response = findResponseByKeywords(responses, [
        '2024', 'ge party choice'
      ], true, ['age', 'বয়স', 'year', 'old', 'assembly', 'ae', '2021', '2025', 'preference']);
    }
    
    // Strategy 3: Look for "ge party choice" (case-insensitive) with "2024" anywhere
    if (!lokSabha2024Response) {
      lokSabha2024Response = responses.find((r) => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        const has2024 = questionText.includes('2024');
        const hasGePartyChoice = questionText.includes('ge party choice') || questionText.includes('ge party');
        const hasExclude = questionText.includes('age') || questionText.includes('বয়স') || 
                          questionText.includes('assembly') || questionText.includes('ae') ||
                          questionText.includes('2021') || questionText.includes('2025') ||
                          questionText.includes('preference');
        return has2024 && hasGePartyChoice && !hasExclude;
      });
    }
    const lokSabha2024Value = lokSabha2024Response?.response 
      ? (Array.isArray(lokSabha2024Response.response) ? lokSabha2024Response.response[0] : lokSabha2024Response.response)
      : null;
    const lokSabha2024Question = lokSabha2024Response ? findQuestionByText(lokSabha2024Response.questionText, survey) : null;
    
    // Name response - "Would You like to share your name with us?"
    let nameResponse = findResponseBySurveyQuestion(['would you like to share your name', 'share your name', 'name with us'], responses, survey, false);
    if (!nameResponse) {
      nameResponse = findResponseByKeywords(responses, ['would you like to share your name', 'share your name', 'name with us'], false);
    }
    // Fallback to general name search
    if (!nameResponse) {
      nameResponse = findResponseBySurveyQuestion(['name', 'respondent'], responses, survey, false);
      if (!nameResponse) {
        nameResponse = findResponseByKeywords(responses, ['name', 'respondent'], false);
      }
    }
    const nameValue = nameResponse?.response 
      ? (Array.isArray(nameResponse.response) ? nameResponse.response[0] : nameResponse.response)
      : null;
    const nameQuestion = nameResponse ? findQuestionByText(nameResponse.questionText, survey) : null;
    
    // Age response - "Could you please tell me your age in complete years?"
    // Try multiple matching strategies - start with simplest first
    let ageResponse = null;
    
    // Strategy 1: Direct text match - look for exact question text or key phrases
    ageResponse = responses.find(r => {
      const questionText = getMainText(r.questionText || '').toLowerCase().trim();
      // Match common age question patterns
      return questionText.includes('could you please tell me your age') ||
             questionText.includes('tell me your age in complete years') ||
             questionText === 'could you please tell me your age in complete years?';
    });
    
    // Strategy 2: More flexible matching - look for "age" and "years" or "complete years"
    if (!ageResponse) {
      ageResponse = responses.find(r => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        return (questionText.includes('age') || questionText.includes('বয়স')) && 
               (questionText.includes('complete years') || questionText.includes('year'));
      });
    }
    
    // Strategy 3: Find question in survey first, excluding election-related terms
    if (!ageResponse) {
      ageResponse = findResponseBySurveyQuestion([
        'age', 'how old', 'tell me your age', 'complete years', 'বয়স'
      ], responses, survey, false, ['election', 'vote', 'party', 'preference', 'lok sabha', 'loksabha', 'mp', 'mla', '2025', '2024', '2021']);
    }
    
    // Strategy 4: Direct keyword matching with exclusions
    if (!ageResponse) {
      ageResponse = findResponseByKeywords(responses, [
        'age', 'how old', 'tell me your age', 'complete years', 'বয়স'
      ], false, ['election', 'vote', 'party', 'preference', 'lok sabha', 'loksabha', 'mp', 'mla', '2025', '2024', '2021']);
    }
    
    // Strategy 5: Last resort - any question with "age" that doesn't have election keywords
    if (!ageResponse) {
      ageResponse = responses.find(r => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        const hasAge = questionText.includes('age') || questionText.includes('বয়স');
        const hasElection = questionText.includes('election') || questionText.includes('vote') || 
                           questionText.includes('party') || questionText.includes('preference');
        return hasAge && !hasElection;
      });
    }
    const ageValue = ageResponse?.response 
      ? (Array.isArray(ageResponse.response) ? ageResponse.response[0] : ageResponse.response)
      : null;
    const ageQuestion = ageResponse ? findQuestionByText(ageResponse.questionText, survey) : null;
    
    return {
      gender: genderValue ? formatResponseDisplay(genderValue, genderQuestion) : 'Not Available',
      upcomingElection: upcomingElectionValue ? formatResponseDisplay(upcomingElectionValue, upcomingElectionQuestion) : 'Not Available',
      assembly2021: assembly2021Value ? formatResponseDisplay(assembly2021Value, assembly2021Question) : 'Not Available',
      lokSabha2024: lokSabha2024Value ? formatResponseDisplay(lokSabha2024Value, lokSabha2024Question) : 'Not Available',
      name: nameValue ? formatResponseDisplay(nameValue, nameQuestion) : 'Not Available',
      age: ageValue ? formatResponseDisplay(ageValue, ageQuestion) : 'Not Available',
      // Include response objects to check if skipped
      genderResponse,
      upcomingElectionResponse,
      assembly2021Response,
      lokSabha2024Response,
      nameResponse,
      ageResponse
    };
  };

  const filteredInterviews = interviews.filter(interview => {
    const surveyId = interview.survey?._id || interview.survey?.survey?._id || fullSurveyData?._id;
    const respondentInfo = getRespondentInfo(interview.responses, surveyId);
    
    // Search filter - now includes respondent name
    const matchesSearch = !searchTerm || 
      interview.survey?.surveyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.responseId?.toString().includes(searchTerm) ||
      interview.sessionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      respondentInfo.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Gender filter
    const matchesGender = !filterGender || respondentInfo.gender.toLowerCase() === filterGender.toLowerCase();
    
    // Mode filter
    const matchesMode = !filterMode || interview.interviewMode?.toLowerCase() === filterMode.toLowerCase();
    
    // Age filter
    const age = parseAge(respondentInfo.age);
    const matchesAge = isAgeInRange(age, ageRange.min, ageRange.max);
    
    return matchesSearch && matchesGender && matchesMode && matchesAge;
  });

  const sortedInterviews = [...filteredInterviews].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    if (sortBy === 'endTime') {
      return sortOrder === 'asc' ? new Date(aValue) - new Date(bValue) : new Date(bValue) - new Date(aValue);
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return aValue < bValue ? 1 : -1;
  });

  // Audio playback functions - now controls the HTML audio element
  // Check if CATI interview has recording available (lightweight check - only fetches call details)
  const checkCatiRecordingAvailability = async (interview) => {
    if (!interview || interview.interviewMode !== 'cati') return false;
    
    const interviewId = interview._id;
    
    // If already checked, return cached result
    if (catiHasRecording.hasOwnProperty(interviewId)) {
      return catiHasRecording[interviewId];
    }
    
    // If already checking, return false (will update when check completes)
    if (checkingCatiRecording[interviewId]) {
      return false;
    }
    
    const callId = interview.call_id;
    if (!callId) {
      // Try fallback: search by survey and respondent phone
      if (interview.survey?._id && interview.respondentPhone) {
        try {
          setCheckingCatiRecording(prev => ({ ...prev, [interviewId]: true }));
          const callsResponse = await catiAPI.getCalls(1, 10, interview.survey._id);
          if (callsResponse.success && callsResponse.data?.calls) {
            const respondentPhoneLast10 = interview.respondentPhone.slice(-10);
            const matchingCall = callsResponse.data.calls.find(call => 
              call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
            );
            const hasRecording = !!(matchingCall && matchingCall.recordingUrl);
            setCatiHasRecording(prev => ({ ...prev, [interviewId]: hasRecording }));
            setCheckingCatiRecording(prev => {
              const newState = { ...prev };
              delete newState[interviewId];
              return newState;
            });
            return hasRecording;
          }
        } catch (fallbackError) {
          console.error('Error in fallback call search:', fallbackError);
        } finally {
          setCheckingCatiRecording(prev => {
            const newState = { ...prev };
            delete newState[interviewId];
            return newState;
          });
        }
      }
      // No call_id and no fallback - mark as no recording
      setCatiHasRecording(prev => ({ ...prev, [interviewId]: false }));
      return false;
    }
    
    try {
      setCheckingCatiRecording(prev => ({ ...prev, [interviewId]: true }));
      const callResponse = await catiAPI.getCallById(callId);
      const hasRecording = !!(callResponse.success && callResponse.data && callResponse.data.recordingUrl);
      setCatiHasRecording(prev => ({ ...prev, [interviewId]: hasRecording }));
      setCheckingCatiRecording(prev => {
        const newState = { ...prev };
        delete newState[interviewId];
        return newState;
      });
      return hasRecording;
    } catch (error) {
      console.error('Error checking CATI call details:', error);
      setCatiHasRecording(prev => ({ ...prev, [interviewId]: false }));
      setCheckingCatiRecording(prev => {
        const newState = { ...prev };
        delete newState[interviewId];
        return newState;
      });
      return false;
    }
  };

  // Fetch CATI recording blob for playback (only called when user clicks Play)
  const fetchCatiRecording = async (interview) => {
    if (!interview || interview.interviewMode !== 'cati') return null;
    
    const interviewId = interview._id;
    
    // If already cached, return it
    if (catiRecordingBlobUrls[interviewId]) {
      return catiRecordingBlobUrls[interviewId];
    }
    
    // If already loading, return null
    if (loadingCatiRecordings[interviewId]) {
      return null;
    }
    
    const callId = interview.call_id;
    if (!callId) {
      // Try fallback: search by survey and respondent phone
      if (interview.survey?._id && interview.respondentPhone) {
        try {
          setLoadingCatiRecordings(prev => ({ ...prev, [interviewId]: true }));
          const callsResponse = await catiAPI.getCalls(1, 10, interview.survey._id);
          if (callsResponse.success && callsResponse.data?.calls) {
            const respondentPhoneLast10 = interview.respondentPhone.slice(-10);
            const matchingCall = callsResponse.data.calls.find(call => 
              call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
            );
            if (matchingCall && matchingCall.recordingUrl) {
              try {
                const recordingResponse = await api.get(`/api/cati/recording/${matchingCall._id}`, {
                  responseType: 'blob'
                });
                if (recordingResponse.data) {
                  const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                  const blobUrl = URL.createObjectURL(blob);
                  setCatiRecordingBlobUrls(prev => ({ ...prev, [interviewId]: blobUrl }));
                  setLoadingCatiRecordings(prev => {
                    const newState = { ...prev };
                    delete newState[interviewId];
                    return newState;
                  });
                  return blobUrl;
                }
              } catch (recordingError) {
                console.error('Error fetching CATI recording via fallback:', recordingError);
                showError('Failed to load CATI recording');
              }
            }
          }
        } catch (fallbackError) {
          console.error('Error in fallback call search:', fallbackError);
        } finally {
          setLoadingCatiRecordings(prev => {
            const newState = { ...prev };
            delete newState[interviewId];
            return newState;
          });
        }
      }
      return null;
    }
    
    try {
      setLoadingCatiRecordings(prev => ({ ...prev, [interviewId]: true }));
      const callResponse = await catiAPI.getCallById(callId);
      if (callResponse.success && callResponse.data && callResponse.data.recordingUrl) {
        try {
          const recordingResponse = await api.get(`/api/cati/recording/${callResponse.data._id}`, {
            responseType: 'blob'
          });
          if (recordingResponse.data) {
            const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
            const blobUrl = URL.createObjectURL(blob);
            setCatiRecordingBlobUrls(prev => ({ ...prev, [interviewId]: blobUrl }));
            setLoadingCatiRecordings(prev => {
              const newState = { ...prev };
              delete newState[interviewId];
              return newState;
            });
            return blobUrl;
          }
        } catch (recordingError) {
          console.error('Error fetching CATI recording:', recordingError);
          showError('Failed to load CATI recording');
        }
      }
    } catch (error) {
      console.error('Error fetching CATI call details:', error);
      showError('Failed to load CATI call details');
    } finally {
      setLoadingCatiRecordings(prev => {
        const newState = { ...prev };
        delete newState[interviewId];
        return newState;
      });
    }
    
    return null;
  };

  // Handle playing CATI audio from blob URL
  const handlePlayCatiAudio = async (interviewId, interview) => {
    if (audioPlaying === interviewId) {
      // Pause current audio
      const audioEl = document.querySelector(`audio[data-interview-id="${interviewId}"][data-cati="true"]`);
      if (audioEl) {
        audioEl.pause();
        setAudioPlaying(null);
      }
      return;
    }
    
    // Stop any currently playing audio (both CAPI and CATI)
    const allAudioElements = document.querySelectorAll('audio[data-interview-id]');
    allAudioElements.forEach(el => {
      if (el.getAttribute('data-interview-id') !== interviewId) {
        el.pause();
        el.currentTime = 0;
      }
    });
    // Also stop CAPI audio if playing
    if (audioPlaying && audioPlaying !== interviewId) {
      setAudioPlaying(null);
    }
    
    // Get or fetch CATI recording blob URL
    let blobUrl = catiRecordingBlobUrls[interviewId];
    if (!blobUrl) {
      blobUrl = await fetchCatiRecording(interview);
      if (!blobUrl) {
        showError('Failed to load CATI recording');
        return;
      }
    }
    
    // Find or create the audio element for this interview
    let audioEl = document.querySelector(`audio[data-interview-id="${interviewId}"][data-cati="true"]`);
    
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.setAttribute('data-interview-id', interviewId);
      audioEl.setAttribute('data-cati', 'true');
      audioEl.src = blobUrl;
      audioEl.controls = false;
      audioEl.onended = () => setAudioPlaying(null);
      audioEl.onpause = () => setAudioPlaying(null);
      audioEl.onplay = () => setAudioPlaying(interviewId);
      audioEl.onerror = () => {
        showError('Failed to play CATI recording');
        setAudioPlaying(null);
      };
      document.body.appendChild(audioEl);
    }
    
    // Play the audio
    try {
      await audioEl.play();
      setAudioPlaying(interviewId);
    } catch (error) {
      console.error('Error playing CATI audio:', error);
      showError('Failed to play CATI recording');
      setAudioPlaying(null);
    }
  };

  const handlePlayAudio = async (audioUrl, interviewId, signedUrl = null) => {
    // Check for mock URLs
    if (audioUrl && (audioUrl.startsWith('mock://') || audioUrl.includes('mock://') || audioUrl.includes('mock%3A//'))) {
      alert('Audio recording is not available. This appears to be a test/mock recording.');
      return;
    }

    if (audioPlaying === interviewId) {
      // Pause current audio
      const audioEl = document.querySelector(`audio[data-interview-id="${interviewId}"]`);
      if (audioEl) {
        audioEl.pause();
        setAudioPlaying(null);
      }
    } else {
      // Stop any currently playing audio (both CAPI and CATI)
      const allAudioElements = document.querySelectorAll('audio[data-interview-id]');
      allAudioElements.forEach(el => {
        if (el.getAttribute('data-interview-id') !== interviewId) {
          el.pause();
          el.currentTime = 0;
        }
      });
      // Also stop CATI audio if playing
      if (audioPlaying && audioPlaying !== interviewId) {
        setAudioPlaying(null);
      }
      
      // Find or create the audio element for this interview
      let audioEl = document.querySelector(`audio[data-interview-id="${interviewId}"]`);
      
      // If audio element doesn't exist, create it dynamically
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.setAttribute('data-interview-id', interviewId);
        
        // Construct the audio URL - prefer signedUrl (S3) if available
        let audioSrc = '';
        if (signedUrl) {
          // Use S3 signed URL directly
          audioSrc = signedUrl;
          audioEl.src = audioSrc;
        } else if (!audioUrl) {
          audioSrc = '';
          audioEl.src = audioSrc;
        } else if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
          // Check for mock URLs in full URLs
          if (audioUrl.includes('mock%3A//') || audioUrl.includes('mock://')) {
            alert('Audio recording is not available. This appears to be a test/mock recording.');
            return;
          }
          // If it's already a full S3 signed URL, use it directly
          if (audioUrl.includes('.s3.')) {
            audioSrc = audioUrl;
          } else if (audioUrl.includes('localhost') && window.location.protocol === 'https:') {
            const urlPath = audioUrl.replace(/^https?:\/\/[^\/]+/, '');
            audioSrc = `${window.location.origin}${urlPath}`;
          } else {
            audioSrc = audioUrl;
          }
          audioEl.src = audioSrc;
        } else if (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) {
          // This is an S3 key, not a local path - need to get signed URL from API
          const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
          // Fetch signed URL asynchronously
          fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error('Failed to get signed URL');
          })
          .then(data => {
            if (data.signedUrl) {
              audioEl.src = data.signedUrl;
              audioEl.load();
            } else {
              throw new Error('No signed URL in response');
            }
          })
          .catch(error => {
            console.error('Error fetching signed URL:', error);
            showError('Failed to get audio URL. Please try again.');
            setAudioPlaying(null);
          });
        } else if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
          // Mock URL - don't try to load it
          alert('Audio recording is not available. This appears to be a test/mock recording.');
          setAudioPlaying(null);
          return;
        } else {
          // Local path (starts with /)
          const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
          audioSrc = `${API_BASE_URL}${audioUrl}`;
          audioEl.src = audioSrc;
        }
        audioEl.style.display = 'none';
        audioEl.onended = () => setAudioPlaying(null);
        audioEl.onpause = () => {
          // Only clear if not manually paused by user clicking pause
          if (audioPlaying === interviewId) {
            setAudioPlaying(null);
          }
        };
        audioEl.onerror = async (e) => {
          console.error('Audio element error:', e);
          // Check for mock URLs first
          if (audioUrl && (audioUrl.startsWith('mock://') || audioUrl.includes('mock://'))) {
            alert('Audio recording is not available. This appears to be a test/mock recording.');
            setAudioPlaying(null);
            return;
          }
          // If audioUrl is an S3 key, try to get signed URL
          if (audioUrl && (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/'))) {
            try {
              const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
              const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
              const token = localStorage.getItem('token');
              const signedUrlResponse = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (signedUrlResponse.ok) {
                const data = await signedUrlResponse.json();
                if (data.signedUrl) {
                  // Update the audio element src with signed URL
                  audioEl.src = data.signedUrl;
                  audioEl.load();
                  return;
                }
              }
            } catch (error) {
              console.error('Error fetching signed URL:', error);
            }
          }
          showError('Failed to load audio file');
          setAudioPlaying(null);
        };
        
        document.body.appendChild(audioEl);
      }
      
      // Play the audio
      if (audioEl) {
        // If audioSrc is empty or still an S3 key, we need to wait for it to be set
        if (!audioEl.src || audioEl.src === window.location.href) {
          // Wait a bit for async signed URL fetch to complete
          setTimeout(() => {
            if (audioEl.src && audioEl.src !== window.location.href) {
              audioEl.play().catch(error => {
                console.error('Audio play error:', error);
                showError('Failed to play audio');
                setAudioPlaying(null);
              });
              setAudioPlaying(interviewId);
            } else {
              showError('Failed to load audio URL');
              setAudioPlaying(null);
            }
          }, 500);
        } else {
          audioEl.play().catch(error => {
            console.error('Audio play error:', error);
            showError('Failed to play audio');
            setAudioPlaying(null);
          });
          setAudioPlaying(interviewId);
        }
      }
    }
  };

  // Calculate statistics
  // For quality agents, use the filtered interviews array (already filtered by backend)
  // For company admins, use allResponses for overall company stats
  const stats = user?.userType === 'quality_agent' ? {
    // Quality agent stats - calculated from their assigned interviews only
    // Note: interviews array only contains pending approvals (filtered by backend)
    // Approved/Rejected counts would require fetching all responses for quality agent
    total: interviews.length, // Total pending interviews assigned to this quality agent
    pending: interviews.length, // All interviews in the array are pending
    withAudio: interviews.filter(i => i.audioRecording?.hasAudio).length,
    completed: 0, // Approved responses are not in pending list - would need separate API call
    rejected: 0 // Rejected responses are not in pending list - would need separate API call
  } : {
    // Company admin stats - use optimized stats from aggregation endpoint
    total: approvalStatsData.total || 0,
    pending: approvalStatsData.pending || 0,
    withAudio: approvalStatsData.withAudio || 0,
    completed: approvalStatsData.completed || 0,
    rejected: approvalStatsData.rejected || 0
  };


  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Approvals</h1>
          <p className="text-gray-600">Review and verify pending survey responses for quality assurance</p>
        </div>
        <div className="flex items-center gap-3">
          {timeRemaining && currentAssignment && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Time remaining: {timeRemaining}
              </span>
            </div>
          )}
          {!currentAssignment && (
        <button
              onClick={handleStartQualityCheck}
              disabled={isGettingNextAssignment}
              className="inline-flex items-center px-6 py-3 bg-[#001D48] text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGettingNextAssignment ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Getting Next Response...
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Start Quality Check
                </>
              )}
        </button>
          )}
        </div>
      </div>

      {/* Statistics Cards - Only show for Company Admins */}
      {user?.userType !== 'quality_agent' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-[#E6F0F8] text-[#373177]">
              <FileText className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
              <p className="text-sm text-gray-600">Total Pending</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-50 text-red-600">
              <X className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">{stats.rejected}</h3>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">{stats.completed}</h3>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-[#E8E6F5] text-[#373177]">
              <Headphones className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">{stats.withAudio}</h3>
              <p className="text-sm text-gray-600">With Audio</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Filters - Only show for Company Admins */}
      {user?.userType !== 'quality_agent' && (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1 invisible">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by survey title, respondent name, response ID, or session ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1">Gender</label>
            <select
              value={filterGender}
              onChange={(e) => {
                setFilterGender(e.target.value);
                setCurrentPage(1); // Reset to first page when filtering
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1">Interview Mode</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Modes</option>
              <option value="capi">CAPI</option>
              <option value="cati">CATI</option>
              <option value="online">Online</option>
            </select>
          </div>
          
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1">Age Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={ageRange.min}
                onChange={(e) => {
                  setAgeRange(prev => ({ ...prev, min: e.target.value }));
                  setCurrentPage(1); // Reset to first page when filtering
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <span className="flex items-center text-gray-500">-</span>
              <input
                type="number"
                placeholder="Max"
                value={ageRange.max}
                onChange={(e) => {
                  setAgeRange(prev => ({ ...prev, max: e.target.value }));
                  setCurrentPage(1); // Reset to first page when filtering
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="endTime">Latest First</option>
              <option value="startTime">Earliest First</option>
              <option value="totalTimeSpent">Duration</option>
              <option value="responseId">Response ID</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
        </div>
        
        {/* Active Filters Display */}
        {getActiveFilterCount() > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Search: {searchTerm}
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 text-[#373177] hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterGender && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Gender: {filterGender}
                  <button
                    onClick={() => {
                      setFilterGender('');
                      setCurrentPage(1); // Reset to first page when clearing filter
                    }}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterMode && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E8E6F5] text-purple-800">
                  Mode: {filterMode.toUpperCase()}
                  <button
                    onClick={() => {
                      setFilterMode('');
                      setCurrentPage(1); // Reset to first page when clearing filter
                    }}
                    className="ml-1 text-[#373177] hover:text-purple-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(ageRange.min || ageRange.max) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E8E6F5] text-purple-800">
                  Age: {ageRange.min || '0'} - {ageRange.max || '∞'}
                  <button
                    onClick={() => {
                      setAgeRange({ min: '', max: '' });
                      setCurrentPage(1); // Reset to first page when clearing filter
                    }}
                    className="ml-1 text-[#373177] hover:text-purple-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Queue-based Assignment UI */}
      {user?.userType === 'quality_agent' ? (
        // Quality Agent: Queue-based only (no list)
        !currentAssignment ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4">
                  <CheckSquare className="w-10 h-10 text-[#373177]" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Review?</h3>
                <p className="text-gray-600 mb-6">
                  Click "Start Quality Check" to get the next available response from the queue. 
                  You'll have 30 minutes to complete the review.
                </p>
                <button
                  onClick={handleStartQualityCheck}
                  disabled={isGettingNextAssignment}
                  className="inline-flex items-center px-8 py-4 bg-[#001D48] text-white rounded-lg shadow-sm text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGettingNextAssignment ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                      Getting Next Response...
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-5 h-5 mr-3" />
                      Start Quality Check
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Current Assignment</h3>
              <p className="text-sm text-gray-600">Review this response and submit your verification</p>
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {timeRemaining} remaining
                </span>
              </div>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
               onClick={() => setShowResponseDetails(true)}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-base font-medium text-gray-900">
                    {currentAssignment.survey?.surveyName || 'Survey'}
                  </h4>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {currentAssignment.responseId}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {getRespondentInfo(currentAssignment.responses, currentAssignment.survey?._id || currentAssignment.survey?.survey?._id || fullSurveyData?._id).name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(currentAssignment.totalTimeSpent)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {currentAssignment.completionPercentage}% Complete
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResponseDetails(true);
                }}
                className="ml-4 px-4 py-2 bg-[#001D48] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Review Now
              </button>
            </div>
          </div>
        </div>
        )
      ) : (
        // Company Admin: Show both queue button and list view
        <>
          {/* Current Assignment Card (if any) */}
          {currentAssignment && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Assignment</h3>
                  <p className="text-sm text-gray-600">Review this response and submit your verification</p>
                </div>
                {timeRemaining && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">
                      {timeRemaining} remaining
                    </span>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                   onClick={() => setShowResponseDetails(true)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-medium text-gray-900">
                        {currentAssignment.survey?.surveyName || 'Survey'}
                      </h4>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {currentAssignment.responseId}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {getRespondentInfo(currentAssignment.responses, currentAssignment.survey?._id || currentAssignment.survey?.survey?._id || fullSurveyData?._id).name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(currentAssignment.totalTimeSpent)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {currentAssignment.completionPercentage}% Complete
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResponseDetails(true);
                    }}
                    className="ml-4 px-4 py-2 bg-[#001D48] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Review Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001D48]"></div>
          <span className="ml-2 text-gray-600">Loading pending approvals...</span>
        </div>
      ) : sortedInterviews.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
          <p className="text-gray-600">All survey responses have been reviewed and approved.</p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '240px'}}>
                  Interview Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Respondent Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Audio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedInterviews.map((interview) => {
                const surveyId = interview.survey?._id || interview.survey?.survey?._id || fullSurveyData?._id;
                const respondentInfo = getRespondentInfo(interview.responses, surveyId);
                return (
                  <tr key={interview._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4" style={{width: '240px'}}>
                          <div className="max-w-none">
                            <div 
                              className="text-sm font-medium text-gray-900 cursor-help"
                              style={{width: '200px', wordWrap: 'break-word'}}
                              title={interview.survey?.surveyName || 'Unknown Survey'}
                            >
                              {interview.survey?.surveyName 
                                ? (interview.survey.surveyName.length > 60 
                                    ? `${interview.survey.surveyName.substring(0, 60)}...` 
                                    : interview.survey.surveyName)
                                : 'Unknown Survey'
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {interview.responseId}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDate(interview.endTime)}
                            </div>
                            {interview.interviewMode && (
                              <div className="text-xs mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  interview.interviewMode === 'capi' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : interview.interviewMode === 'cati' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-[#E8E6F5] text-purple-800'
                                }`}>
                                  {interview.interviewMode.toUpperCase()}
                                </span>
                              </div>
                            )}
                            {interview.qcBatch && (
                              <div className="text-xs mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  interview.qcBatch.status === 'collecting' 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : interview.qcBatch.status === 'processing' || interview.qcBatch.status === 'qc_in_progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`} title={`Batch Status: ${interview.qcBatch.status === 'collecting' ? 'Collecting Responses' : interview.qcBatch.status}`}>
                                  {interview.qcBatch.status === 'collecting' ? 'Batch: Collecting' : `Batch: ${interview.qcBatch.status}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center mb-1">
                              <User className="w-4 h-4 mr-1 text-gray-400" />
                              <span className="font-medium">{respondentInfo.name}</span>
                            </div>
                            <div className="flex items-center mb-1">
                              <Users className="w-4 h-4 mr-1 text-gray-400" />
                              <span className="capitalize">{respondentInfo.gender}</span>
                            </div>
                            <div className="flex items-center mb-1">
                              <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                              <span>{respondentInfo.age}</span>
                            </div>
                            {interview.selectedAC && (
                              <div className="flex items-center mb-1">
                                <Target className="w-4 h-4 mr-1 text-blue-400" />
                                <span className="text-[#373177] font-medium">{interview.selectedAC}</span>
                              </div>
                            )}
                            {interview.location && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1 text-green-400" />
                                <span className="text-green-600 font-medium text-xs">
                                  {interview.location.city}, {interview.location.state}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center mb-1">
                              <BarChart3 className="w-4 h-4 mr-1 text-gray-400" />
                              <span>{interview.answeredQuestions}/{calculateEffectiveQuestions(interview.responses, interview.survey)}</span>
                            </div>
                            <div className="flex items-center">
                              <Target className="w-4 h-4 mr-1 text-gray-400" />
                              <span>{interview.completionPercentage}% complete</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Clock className="w-4 h-4 mr-1 text-gray-400" />
                            <span>{formatDuration(interview.totalTimeSpent)}</span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                            {getStatusIcon(interview.status)}
                            <span className="ml-1">{interview.status}</span>
                          </span>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            // Handle CATI interviews
                            if (interview.interviewMode === 'cati') {
                              const interviewId = interview._id;
                              const hasChecked = catiHasRecording.hasOwnProperty(interviewId);
                              const hasRecording = catiHasRecording[interviewId] === true;
                              const isChecking = checkingCatiRecording[interviewId];
                              const isLoading = loadingCatiRecordings[interviewId];
                              
                              // Check if we can check for recording (have call_id or fallback conditions)
                              const canCheck = interview.call_id || (interview.survey?._id && interview.respondentPhone);
                              
                              // If not checked yet and we can check, trigger check (but don't wait - show loading state)
                              if (!hasChecked && !isChecking && canCheck) {
                                // Trigger async check (fire and forget)
                                checkCatiRecordingAvailability(interview).catch(err => {
                                  console.error('Error checking CATI recording:', err);
                                });
                              }
                              
                              // Show loading while checking availability
                              if (isChecking || (!hasChecked && canCheck)) {
                                return (
                                  <span className="text-sm text-gray-400 inline-flex items-center">
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    Checking...
                                  </span>
                                );
                              }
                              
                              // If checked and has recording, show play button
                              if (hasRecording) {
                                return (
                                  <button
                                    onClick={() => handlePlayCatiAudio(interviewId, interview)}
                                    disabled={isLoading}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isLoading ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                        Loading...
                                      </>
                                    ) : audioPlaying === interviewId ? (
                                      <>
                                        <Pause className="w-4 h-4 mr-1" />
                                        Pause
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-4 h-4 mr-1" />
                                        Play
                                      </>
                                    )}
                                  </button>
                                );
                              }
                              
                              // If checked and no recording, or can't check (no call_id and no fallback), show "No Audio"
                              return <span className="text-sm text-gray-400">No Audio</span>;
                            }
                            
                            // Handle CAPI interviews (existing logic)
                            if (interview.audioRecording?.hasAudio) {
                              return (
                            <button
                              onClick={() => handlePlayAudio(
                                interview.audioRecording.audioUrl, 
                                interview._id,
                                interview.audioRecording.signedUrl
                              )}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              {audioPlaying === interview._id ? (
                                <Pause className="w-4 h-4 mr-1" />
                              ) : (
                                <Play className="w-4 h-4 mr-1" />
                              )}
                              {audioPlaying === interview._id ? 'Pause' : 'Play'}
                            </button>
                              );
                            }
                            
                            return <span className="text-sm text-gray-400">No Audio</span>;
                          })()}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={async () => {
                              setSelectedInterview(interview);
                              resetVerificationForm();
                              setCatiCallDetails(null);
                              setCatiRecordingBlobUrl(null);
                              setShowResponseDetails(true);
                              // Fetch full survey data to get target audience
                              // Pass the survey data already in the interview object
                              if (interview?.survey?._id) {
                                fetchFullSurveyData(interview.survey._id, interview.survey);
                              }
                              // If CATI interview, fetch call details using call_id
                              if (interview.interviewMode === 'cati') {
                                console.log('🔍 CATI interview detected');
                                console.log('🔍 Interview object keys:', Object.keys(interview));
                                console.log('🔍 call_id value:', interview.call_id);
                                console.log('🔍 Full interview object:', JSON.stringify(interview, null, 2));
                                
                                const callId = interview.call_id;
                                if (callId) {
                                  console.log('🔍 Fetching call details for callId:', callId);
                                  try {
                                    // Use getCallById which now supports both _id and callId
                                    const callResponse = await catiAPI.getCallById(callId);
                                    console.log('🔍 Call response:', callResponse);
                                    if (callResponse.success && callResponse.data) {
                                      console.log('✅ Call details fetched successfully:', callResponse.data);
                                      setCatiCallDetails(callResponse.data);
                                      // Fetch recording if available
                                      if (callResponse.data.recordingUrl) {
                                        try {
                                          const recordingResponse = await api.get(`/api/cati/recording/${callResponse.data._id}`, {
                                            responseType: 'blob'
                                          });
                                          if (recordingResponse.data) {
                                            const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                                            const blobUrl = URL.createObjectURL(blob);
                                            setCatiRecordingBlobUrl(blobUrl);
                                          }
                                        } catch (recordingError) {
                                          console.error('Error fetching CATI recording:', recordingError);
                                          // Don't show error for recording - it's optional
                                        }
                                      }
                                    } else {
                                      console.warn('⚠️ Call response not successful or no data:', callResponse);
                                      // Try fallback: search by survey and respondent phone (for older records)
                                      if (interview.survey?._id && interview.respondentPhone) {
                                        try {
                                          console.log('🔍 Trying fallback: searching by survey and respondent phone');
                                          const callsResponse = await catiAPI.getCalls(1, 10, interview.survey._id);
                                          if (callsResponse.success && callsResponse.data?.calls) {
                                            const respondentPhoneLast10 = interview.respondentPhone.slice(-10);
                                            const matchingCall = callsResponse.data.calls.find(call => 
                                              call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
                                            );
                                            if (matchingCall) {
                                              console.log('✅ Found call via fallback method:', matchingCall);
                                              setCatiCallDetails(matchingCall);
                                              if (matchingCall.recordingUrl) {
                                                try {
                                                  const recordingResponse = await api.get(`/api/cati/recording/${matchingCall._id}`, {
                                                    responseType: 'blob'
                                                  });
                                                  if (recordingResponse.data) {
                                                    const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                                                    const blobUrl = URL.createObjectURL(blob);
                                                    setCatiRecordingBlobUrl(blobUrl);
                                                  }
                                                } catch (recordingError) {
                                                  console.error('Error fetching CATI recording via fallback:', recordingError);
                                                }
                                              }
                                            }
                                          }
                                        } catch (fallbackError) {
                                          console.error('Error in fallback call search:', fallbackError);
                                        }
                                      }
                                    }
                                  } catch (error) {
                                    console.error('❌ Error fetching CATI call details:', error);
                                    console.error('❌ Error details:', error.response?.data || error.message);
                                    // Only show error if it's not a 403/404 (might be expected for some cases)
                                    if (error.response?.status !== 403 && error.response?.status !== 404) {
                                      showError('Failed to fetch call details. Please try again.');
                                    }
                                  }
                                } else {
                                  console.warn('⚠️ No call_id found in SurveyResponse for CATI interview');
                                  console.warn('⚠️ Interview object:', interview);
                                  // Try fallback: search by survey and respondent phone (for older records)
                                  if (interview.survey?._id && interview.respondentPhone) {
                                    try {
                                      console.log('🔍 Trying fallback: searching by survey and respondent phone');
                                      const callsResponse = await catiAPI.getCalls(1, 10, interview.survey._id);
                                      if (callsResponse.success && callsResponse.data?.calls) {
                                        const respondentPhoneLast10 = interview.respondentPhone.slice(-10);
                                        const matchingCall = callsResponse.data.calls.find(call => 
                                          call.toNumber && call.toNumber.slice(-10) === respondentPhoneLast10
                                        );
                                        if (matchingCall) {
                                          console.log('✅ Found call via fallback method:', matchingCall);
                                          setCatiCallDetails(matchingCall);
                                          if (matchingCall.recordingUrl) {
                                            try {
                                              const recordingResponse = await api.get(`/api/cati/recording/${matchingCall._id}`, {
                                                responseType: 'blob'
                                              });
                                              if (recordingResponse.data) {
                                                const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                                                const blobUrl = URL.createObjectURL(blob);
                                                setCatiRecordingBlobUrl(blobUrl);
                                              }
                                            } catch (recordingError) {
                                              console.error('Error fetching CATI recording via fallback:', recordingError);
                                            }
                                          }
                                        }
                                      }
                                    } catch (fallbackError) {
                                      console.error('Error in fallback call search:', fallbackError);
                                    }
                                  }
                                }
                              }
                            }}
                            className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Verify Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
          
          {/* Results Summary and Pagination */}
          {pagination.totalInterviews !== undefined && (
            <>
              {/* Results Summary */}
              <div className="flex items-center justify-between text-sm text-gray-600 mt-4 mb-4">
                <div>
                  Showing {interviews.length} of {pagination.totalInterviews || 0} pending approvals
                </div>
                <div className="flex items-center space-x-2">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={45}>45</option>
                    <option value={60}>60</option>
                  </select>
                </div>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Page {pagination.currentPage || 1} of {pagination.totalPages || 1}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages || 1) }, (_, i) => {
                      const pageNum = (pagination.currentPage || 1) <= 3 
                        ? i + 1 
                        : (pagination.currentPage || 1) + i - 2;
                      
                      if (pageNum > pagination.totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 border rounded-lg transition-colors ${
                            pageNum === (pagination.currentPage || 1)
                              ? 'bg-[#001D48] text-white border-[#373177]'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
        </div>
              )}
            </>
          )}
        </>
          )}
        </>
      )}
    </div>

    {/* Response Details Modal */}
    {showResponseDetails && selectedInterview && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-7xl h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-lg font-medium text-gray-900">
                Survey Response Verification
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Response ID: {selectedInterview.responseId}</p>
                <p className="break-words max-w-4xl">
                  Survey: {selectedInterview.survey?.surveyName || 'Unknown Survey'}
                </p>
                {selectedInterview.interviewMode && (
                  <p className="flex items-center">
                    <span className="mr-2">Mode:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedInterview.interviewMode === 'capi' 
                        ? 'bg-blue-100 text-blue-800' 
                        : selectedInterview.interviewMode === 'cati' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-[#E8E6F5] text-purple-800'
                    }`}>
                      {selectedInterview.interviewMode.toUpperCase()}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interview Info */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 p-4 rounded-lg flex-shrink-0">
                <h4 className="font-medium text-gray-900 mb-3">Interview Information</h4>
                {(() => {
                  // Extract AC and polling station from responses
                  const { ac: acFromResponse, pollingStation: pollingStationFromResponse, groupName: groupNameFromResponse } = getACAndPollingStationFromResponses(selectedInterview.responses, selectedInterview.survey);
                  const displayAC = acFromResponse || selectedInterview.selectedPollingStation?.acName || selectedInterview.selectedAC;
                  // Format polling station to show both code and name
                  const pollingStationValue = pollingStationFromResponse || selectedInterview.selectedPollingStation?.stationName;
                  const displayPollingStation = formatPollingStationDisplay(pollingStationValue, selectedInterview.selectedPollingStation);
                  const displayPC = selectedInterview.selectedPollingStation?.pcName;
                  
                  return (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedInterview.interviewer ? (
                        <>
                          <div>
                            <span className="text-gray-600">Interviewer:</span>
                            <span className="ml-2 font-medium">
                              {selectedInterview.interviewer.firstName} {selectedInterview.interviewer.lastName}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Interviewer ID:</span>
                            <span className="ml-2 font-medium">
                              {selectedInterview.interviewer.memberId || 'N/A'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 text-xs text-gray-400">
                          Interviewer information not available
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{formatDuration(selectedInterview.totalTimeSpent)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Completion:</span>
                        <span className="ml-2 font-medium">
                          {(() => {
                            const effectiveTotal = calculateEffectiveQuestions(selectedInterview.responses, selectedInterview.survey);
                            return effectiveTotal > 0 ? Math.round((selectedInterview.answeredQuestions / effectiveTotal) * 100) : 0;
                          })()}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Questions:</span>
                        <span className="ml-2 font-medium">{selectedInterview.answeredQuestions}/{calculateEffectiveQuestions(selectedInterview.responses, selectedInterview.survey)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedInterview.status)}`}>
                          {selectedInterview.status}
                        </span>
                      </div>
                      {displayAC && (
                        <div>
                          <span className="text-gray-600">Assembly Constituency:</span>
                          <span className="ml-2 font-medium">{displayAC}</span>
                        </div>
                      )}
                      {displayPC && (
                        <div>
                          <span className="text-gray-600">Parliamentary Constituency:</span>
                          <span className="ml-2 font-medium">{displayPC} {selectedInterview.selectedPollingStation?.pcNo ? `(${selectedInterview.selectedPollingStation.pcNo})` : ''}</span>
                        </div>
                      )}
                      {displayPollingStation && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Polling Station:</span>
                          <span className="ml-2 font-medium">{displayPollingStation}</span>
                        </div>
                      )}
                      {selectedInterview.location && (
                        <>
                          {(selectedInterview.location.city || selectedInterview.location.state) && (
                            <div>
                              <span className="text-gray-600">Location:</span>
                              <span className="ml-2 font-medium">
                                {selectedInterview.location.city ? `${selectedInterview.location.city}, ` : ''}{selectedInterview.location.state || 'N/A'}
                              </span>
                            </div>
                          )}
                          {selectedInterview.location.latitude && selectedInterview.location.longitude && (
                            <div>
                              <span className="text-gray-600">Coordinates:</span>
                              <span className="ml-2 font-medium text-xs">
                                {selectedInterview.location.latitude.toFixed(6)}, {selectedInterview.location.longitude.toFixed(6)}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Call Information Section - Only for CATI interviews */}
              {selectedInterview.interviewMode === 'cati' && catiCallDetails && (
                <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center text-lg">
                    <PhoneCall className="w-5 h-5 mr-2 text-[#373177]" />
                    Call Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">Call Status:</span>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          catiCallDetails.callStatus === 'completed' || catiCallDetails.callStatus === 'answered' 
                            ? 'bg-green-100 text-green-800' 
                            : catiCallDetails.callStatus === 'failed' || catiCallDetails.callStatus === 'busy'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {catiCallDetails.callStatusDescription || catiCallDetails.statusDescription || catiCallDetails.callStatus}
                        </span>
                      </div>
                    </div>
                    {(catiCallDetails.callStatusCode || catiCallDetails.originalStatusCode) && (
                      <div>
                        <span className="text-gray-600 font-medium">Status Code:</span>
                        <span className="ml-2 font-medium">{catiCallDetails.callStatusCode || catiCallDetails.originalStatusCode}</span>
                      </div>
                    )}
                    {catiCallDetails.callId && (
                      <div className="col-span-2">
                        <span className="text-gray-600 font-medium">Call ID:</span>
                        <span className="ml-2 font-medium text-xs font-mono break-all">{catiCallDetails.callId}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 font-medium">From Number:</span>
                      <span className="ml-2 font-medium">{catiCallDetails.fromNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">To Number:</span>
                      <span className="ml-2 font-medium">{catiCallDetails.toNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Call Duration:</span>
                      <span className="ml-2 font-medium">
                        {catiCallDetails.callDuration ? formatDuration(catiCallDetails.callDuration) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Talk Duration:</span>
                      <span className="ml-2 font-medium">
                        {catiCallDetails.talkDuration ? formatDuration(catiCallDetails.talkDuration) : 'N/A'}
                      </span>
                    </div>
                    {(catiCallDetails.startTime || catiCallDetails.callStartTime) && (
                      <div>
                        <span className="text-gray-600 font-medium">Call Start Time:</span>
                        <span className="ml-2 font-medium">
                          {new Date(catiCallDetails.startTime || catiCallDetails.callStartTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {(catiCallDetails.endTime || catiCallDetails.callEndTime) && (
                      <div>
                        <span className="text-gray-600 font-medium">Call End Time:</span>
                        <span className="ml-2 font-medium">
                          {new Date(catiCallDetails.endTime || catiCallDetails.callEndTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {catiCallDetails.ringDuration && catiCallDetails.ringDuration > 0 && (
                      <div>
                        <span className="text-gray-600 font-medium">Ring Duration:</span>
                        <span className="ml-2 font-medium">
                          {formatDuration(catiCallDetails.ringDuration)}
                        </span>
                      </div>
                    )}
                    {catiCallDetails.hangupCause && (
                      <div>
                        <span className="text-gray-600 font-medium">Hangup Cause:</span>
                        <span className="ml-2 font-medium">{catiCallDetails.hangupCause}</span>
                      </div>
                    )}
                    {catiCallDetails.hangupBySource && (
                      <div>
                        <span className="text-gray-600 font-medium">Hangup By:</span>
                        <span className="ml-2 font-medium">{catiCallDetails.hangupBySource}</span>
                      </div>
                    )}
                    {catiCallDetails.fromType && (
                      <div>
                        <span className="text-gray-600 font-medium">From Type:</span>
                        <span className="ml-2 font-medium">{catiCallDetails.fromType}</span>
                      </div>
                    )}
                    {catiCallDetails.toType && (
                      <div>
                        <span className="text-gray-600 font-medium">To Type:</span>
                        <span className="ml-2 font-medium">{catiCallDetails.toType}</span>
                      </div>
                    )}
                    {catiCallDetails.recordingUrl && (
                      <div className="col-span-2">
                        <span className="text-gray-600 font-medium">Recording Available:</span>
                        <span className="ml-2 font-medium text-green-600">Yes</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedInterview.interviewMode === 'cati' && !catiCallDetails && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Call Information Not Available</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Call details could not be loaded. This may be because the call record was not found or the interview was completed before the call was made.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Target Audience Requirements */}
              {(() => {
                const targetAudience = getTargetAudience(selectedInterview);
                return targetAudience;
              })() && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Target Audience Requirements
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="space-y-4">
                      {(() => {
                        const targetAudience = getTargetAudience(selectedInterview);
                        if (!targetAudience) return null;

                        return (
                          <>
                            {/* Demographics */}
                            {targetAudience.demographics && Object.keys(targetAudience.demographics).some(key => 
                              targetAudience.demographics[key] && typeof targetAudience.demographics[key] === 'boolean'
                            ) && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <Users className="w-4 h-4 mr-2" />
                                  Demographics
                                </h5>
                                <div className="space-y-3">
                                  
                                  {/* Age Group */}
                                  {targetAudience.demographics['Age Group'] && targetAudience.demographics.ageRange && (
                                    <div className="p-3 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                      <h6 className="text-xs font-medium text-blue-900 mb-1">Age Range</h6>
                                      <span className="text-xs text-blue-700">
                                        {targetAudience.demographics.ageRange.min || 'Not specified'} - {targetAudience.demographics.ageRange.max || 'Not specified'} years
                                      </span>
                                    </div>
                                  )}

                                  {/* Gender Requirements */}
                                  {targetAudience.demographics['Gender'] && targetAudience.demographics.genderRequirements && (
                                    <div className="p-3 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                      <h6 className="text-xs font-medium text-purple-900 mb-2">Gender Distribution</h6>
                                      <div className="space-y-1">
                                        {(() => {
                                          const requirements = targetAudience.demographics.genderRequirements;
                                          const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                                          
                                          return selectedGenders.map(gender => {
                                            const percentage = requirements[`${gender}Percentage`];
                                            const displayPercentage = selectedGenders.length === 1 && !percentage ? 100 : (percentage || 0);
                                            return (
                                              <div key={gender} className="flex items-center justify-between">
                                                <span className="text-xs text-purple-700">{gender}</span>
                                                <span className="text-xs font-semibold text-purple-900">{displayPercentage}%</span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  )}

                                  {/* Income Level */}
                                  {targetAudience.demographics['Income Level'] && targetAudience.demographics.incomeRange && (
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                      <h6 className="text-xs font-medium text-green-900 mb-1">Income Range</h6>
                                      <span className="text-xs text-green-700">
                                        ₹{targetAudience.demographics.incomeRange.min?.toLocaleString() || 'Not specified'} - ₹{targetAudience.demographics.incomeRange.max?.toLocaleString() || 'Not specified'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Education */}
                                  {targetAudience.demographics['Education'] && targetAudience.demographics.educationRequirements && (
                                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                      <h6 className="text-xs font-medium text-yellow-900 mb-2">Education Level</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.demographics.educationRequirements)
                                          .filter(edu => targetAudience.demographics.educationRequirements[edu])
                                          .map(education => (
                                            <span key={education} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                              {education}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Occupation */}
                                  {targetAudience.demographics['Occupation'] && targetAudience.demographics.occupationRequirements && (
                                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                      <h6 className="text-xs font-medium text-indigo-900 mb-1">Occupation Requirements</h6>
                                      <p className="text-xs text-indigo-700">{targetAudience.demographics.occupationRequirements}</p>
                                    </div>
                                  )}

                                  {/* Marital Status */}
                                  {targetAudience.demographics['Marital Status'] && targetAudience.demographics.maritalStatusRequirements && (
                                    <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                                      <h6 className="text-xs font-medium text-pink-900 mb-2">Marital Status</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.demographics.maritalStatusRequirements)
                                          .filter(status => targetAudience.demographics.maritalStatusRequirements[status])
                                          .map(status => (
                                            <span key={status} className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                                              {status}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Family Size */}
                                  {targetAudience.demographics['Family Size'] && targetAudience.demographics.familySizeRange && (
                                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                      <h6 className="text-xs font-medium text-teal-900 mb-1">Family Size Range</h6>
                                      <span className="text-xs text-teal-700">
                                        {targetAudience.demographics.familySizeRange.min || 'Not specified'} - {targetAudience.demographics.familySizeRange.max || 'Not specified'} members
                                      </span>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}

                            {/* Geographic */}
                            {targetAudience.geographic && Object.keys(targetAudience.geographic).some(key => 
                              targetAudience.geographic[key] && typeof targetAudience.geographic[key] === 'boolean'
                            ) && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  Geographic Targeting
                                </h5>
                                <div className="space-y-3">
                                  
                                  {/* Country */}
                                  {targetAudience.geographic['Country'] && targetAudience.geographic.countryRequirements && (
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                      <h6 className="text-xs font-medium text-green-900 mb-1">Target Countries</h6>
                                      <p className="text-xs text-green-700">{targetAudience.geographic.countryRequirements}</p>
                                    </div>
                                  )}

                                  {/* State/Province */}
                                  {targetAudience.geographic['State/Province'] && targetAudience.geographic.stateRequirements && (
                                    <div className="p-3 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                      <h6 className="text-xs font-medium text-blue-900 mb-1">Target States/Provinces</h6>
                                      <p className="text-xs text-blue-700">{targetAudience.geographic.stateRequirements}</p>
                                    </div>
                                  )}

                                  {/* City */}
                                  {targetAudience.geographic['City'] && targetAudience.geographic.cityRequirements && (
                                    <div className="p-3 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                      <h6 className="text-xs font-medium text-purple-900 mb-1">Target Cities</h6>
                                      <p className="text-xs text-purple-700">{targetAudience.geographic.cityRequirements}</p>
                                    </div>
                                  )}

                                  {/* Urban/Rural */}
                                  {targetAudience.geographic['Urban/Rural'] && targetAudience.geographic.areaTypeRequirements && (
                                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                      <h6 className="text-xs font-medium text-orange-900 mb-2">Area Type</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.geographic.areaTypeRequirements)
                                          .filter(area => targetAudience.geographic.areaTypeRequirements[area])
                                          .map(area => (
                                            <span key={area} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                              {area}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Postal Code */}
                                  {targetAudience.geographic['Postal Code'] && targetAudience.geographic.postalCodeRequirements && (
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                      <h6 className="text-xs font-medium text-gray-900 mb-1">Postal Code Requirements</h6>
                                      <p className="text-xs text-gray-700">{targetAudience.geographic.postalCodeRequirements}</p>
                                    </div>
                                  )}

                                  {/* Timezone */}
                                  {targetAudience.geographic['Timezone'] && targetAudience.geographic.timezoneRequirements && (
                                    <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                                      <h6 className="text-xs font-medium text-cyan-900 mb-2">Timezone Requirements</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.geographic.timezoneRequirements)
                                          .filter(tz => targetAudience.geographic.timezoneRequirements[tz])
                                          .map(timezone => (
                                            <span key={timezone} className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-full">
                                              {timezone}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}

                            {/* Custom Specifications */}
                            {targetAudience.custom && targetAudience.custom.trim() && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Custom Specifications
                                </h5>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-700">{targetAudience.custom}</p>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Audience Requirements */}
              {(() => {
                const targetAudience = getTargetAudience(selectedInterview);
                return targetAudience;
              })() && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Target Audience Requirements
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="space-y-4">
                      {(() => {
                        const targetAudience = getTargetAudience(selectedInterview);
                        if (!targetAudience) return null;

                        return (
                          <>
                            {/* Demographics */}
                            {targetAudience.demographics && Object.keys(targetAudience.demographics).some(key => 
                              targetAudience.demographics[key] && typeof targetAudience.demographics[key] === 'boolean'
                            ) && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <Users className="w-4 h-4 mr-2" />
                                  Demographics
                                </h5>
                                <div className="space-y-3">
                                  
                                  {/* Age Group */}
                                  {targetAudience.demographics['Age Group'] && targetAudience.demographics.ageRange && (
                                    <div className="p-3 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                      <h6 className="text-xs font-medium text-blue-900 mb-1">Age Range</h6>
                                      <span className="text-xs text-blue-700">
                                        {targetAudience.demographics.ageRange.min || 'Not specified'} - {targetAudience.demographics.ageRange.max || 'Not specified'} years
                                      </span>
                                    </div>
                                  )}

                                  {/* Gender Requirements */}
                                  {targetAudience.demographics['Gender'] && targetAudience.demographics.genderRequirements && (
                                    <div className="p-3 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                      <h6 className="text-xs font-medium text-purple-900 mb-2">Gender Distribution</h6>
                                      <div className="space-y-1">
                                        {(() => {
                                          const requirements = targetAudience.demographics.genderRequirements;
                                          const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                                          
                                          return selectedGenders.map(gender => {
                                            const percentage = requirements[`${gender}Percentage`];
                                            const displayPercentage = selectedGenders.length === 1 && !percentage ? 100 : (percentage || 0);
                                            return (
                                              <div key={gender} className="flex items-center justify-between">
                                                <span className="text-xs text-purple-700">{gender}</span>
                                                <span className="text-xs font-semibold text-purple-900">{displayPercentage}%</span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  )}

                                  {/* Income Level */}
                                  {targetAudience.demographics['Income Level'] && targetAudience.demographics.incomeRange && (
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                      <h6 className="text-xs font-medium text-green-900 mb-1">Income Range</h6>
                                      <span className="text-xs text-green-700">
                                        ₹{targetAudience.demographics.incomeRange.min?.toLocaleString() || 'Not specified'} - ₹{targetAudience.demographics.incomeRange.max?.toLocaleString() || 'Not specified'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Education */}
                                  {targetAudience.demographics['Education'] && targetAudience.demographics.educationRequirements && (
                                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                      <h6 className="text-xs font-medium text-yellow-900 mb-2">Education Level</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.demographics.educationRequirements)
                                          .filter(edu => targetAudience.demographics.educationRequirements[edu])
                                          .map(education => (
                                            <span key={education} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                              {education}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Occupation */}
                                  {targetAudience.demographics['Occupation'] && targetAudience.demographics.occupationRequirements && (
                                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                      <h6 className="text-xs font-medium text-indigo-900 mb-1">Occupation Requirements</h6>
                                      <p className="text-xs text-indigo-700">{targetAudience.demographics.occupationRequirements}</p>
                                    </div>
                                  )}

                                  {/* Marital Status */}
                                  {targetAudience.demographics['Marital Status'] && targetAudience.demographics.maritalStatusRequirements && (
                                    <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                                      <h6 className="text-xs font-medium text-pink-900 mb-2">Marital Status</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.demographics.maritalStatusRequirements)
                                          .filter(status => targetAudience.demographics.maritalStatusRequirements[status])
                                          .map(status => (
                                            <span key={status} className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                                              {status}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Family Size */}
                                  {targetAudience.demographics['Family Size'] && targetAudience.demographics.familySizeRange && (
                                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                      <h6 className="text-xs font-medium text-teal-900 mb-1">Family Size Range</h6>
                                      <span className="text-xs text-teal-700">
                                        {targetAudience.demographics.familySizeRange.min || 'Not specified'} - {targetAudience.demographics.familySizeRange.max || 'Not specified'} members
                                      </span>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}

                            {/* Geographic */}
                            {targetAudience.geographic && Object.keys(targetAudience.geographic).some(key => 
                              targetAudience.geographic[key] && typeof targetAudience.geographic[key] === 'boolean'
                            ) && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  Geographic Targeting
                                </h5>
                                <div className="space-y-3">
                                  
                                  {/* Country */}
                                  {targetAudience.geographic['Country'] && targetAudience.geographic.countryRequirements && (
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                      <h6 className="text-xs font-medium text-green-900 mb-1">Target Countries</h6>
                                      <p className="text-xs text-green-700">{targetAudience.geographic.countryRequirements}</p>
                                    </div>
                                  )}

                                  {/* State/Province */}
                                  {targetAudience.geographic['State/Province'] && targetAudience.geographic.stateRequirements && (
                                    <div className="p-3 bg-[#E6F0F8] rounded-lg border border-blue-200">
                                      <h6 className="text-xs font-medium text-blue-900 mb-1">Target States/Provinces</h6>
                                      <p className="text-xs text-blue-700">{targetAudience.geographic.stateRequirements}</p>
                                    </div>
                                  )}

                                  {/* City */}
                                  {targetAudience.geographic['City'] && targetAudience.geographic.cityRequirements && (
                                    <div className="p-3 bg-[#E8E6F5] rounded-lg border border-purple-200">
                                      <h6 className="text-xs font-medium text-purple-900 mb-1">Target Cities</h6>
                                      <p className="text-xs text-purple-700">{targetAudience.geographic.cityRequirements}</p>
                                    </div>
                                  )}

                                  {/* Urban/Rural */}
                                  {targetAudience.geographic['Urban/Rural'] && targetAudience.geographic.areaTypeRequirements && (
                                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                      <h6 className="text-xs font-medium text-orange-900 mb-2">Area Type</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.geographic.areaTypeRequirements)
                                          .filter(area => targetAudience.geographic.areaTypeRequirements[area])
                                          .map(area => (
                                            <span key={area} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                              {area}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Postal Code */}
                                  {targetAudience.geographic['Postal Code'] && targetAudience.geographic.postalCodeRequirements && (
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                      <h6 className="text-xs font-medium text-gray-900 mb-1">Postal Code Requirements</h6>
                                      <p className="text-xs text-gray-700">{targetAudience.geographic.postalCodeRequirements}</p>
                                    </div>
                                  )}

                                  {/* Timezone */}
                                  {targetAudience.geographic['Timezone'] && targetAudience.geographic.timezoneRequirements && (
                                    <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                                      <h6 className="text-xs font-medium text-cyan-900 mb-2">Timezone Requirements</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.keys(targetAudience.geographic.timezoneRequirements)
                                          .filter(tz => targetAudience.geographic.timezoneRequirements[tz])
                                          .map(timezone => (
                                            <span key={timezone} className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-full">
                                              {timezone}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}

                            {/* Custom Specifications */}
                            {targetAudience.custom && targetAudience.custom.trim() && (
                              <div>
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Custom Specifications
                                </h5>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-700">{targetAudience.custom}</p>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Location Map - Only for CAPI interviews */}
              {selectedInterview.location && selectedInterview.interviewMode !== 'cati' && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Interview Location</h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Address:</strong> {selectedInterview.location.address}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Accuracy:</strong> ±{Math.round(selectedInterview.location.accuracy)} meters
                      </p>
                    </div>
                    <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedInterview.location.longitude-0.01},${selectedInterview.location.latitude-0.01},${selectedInterview.location.longitude+0.01},${selectedInterview.location.latitude+0.01}&layer=mapnik&marker=${selectedInterview.location.latitude},${selectedInterview.location.longitude}`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        title="Interview Location"
                      />
                    </div>
                    <div className="mt-2 text-center">
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${selectedInterview.location.latitude}&mlon=${selectedInterview.location.longitude}&zoom=15`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#373177] hover:text-blue-800 text-sm underline"
                      >
                        View on OpenStreetMap
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Responses */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Question Responses</h4>
                  {(() => {
                    // Detect available languages from all responses
                    const languageCounts = new Set();
                    if (selectedInterview?.responses) {
                      selectedInterview.responses.forEach(resp => {
                        if (resp.questionText) {
                          try {
                            const languages = parseMultiTranslation(resp.questionText);
                            if (languages && Array.isArray(languages)) {
                              languages.forEach((_, index) => languageCounts.add(index));
                            }
                          } catch (e) {
                            // Ignore parsing errors
                          }
                        }
                        if (resp.questionDescription) {
                          try {
                            const languages = parseMultiTranslation(resp.questionDescription);
                            if (languages && Array.isArray(languages)) {
                              languages.forEach((_, index) => languageCounts.add(index));
                            }
                          } catch (e) {
                            // Ignore parsing errors
                          }
                        }
                        // Also check survey question options
                        if (selectedInterview.survey) {
                          const surveyQuestion = findQuestionByText(resp.questionText, selectedInterview.survey);
                          if (surveyQuestion?.options) {
                            surveyQuestion.options.forEach(opt => {
                              if (opt.text) {
                                try {
                                  const languages = parseMultiTranslation(String(opt.text));
                                  if (languages && Array.isArray(languages)) {
                                    languages.forEach((_, index) => languageCounts.add(index));
                                  }
                                } catch (e) {
                                  // Ignore parsing errors
                                }
                              }
                            });
                          }
                        }
                      });
                    }
                    const languageCountsArray = Array.from(languageCounts);
                    const maxLanguages = languageCountsArray.length > 0 
                      ? Math.max(...languageCountsArray, 0) + 1 
                      : 1;
                    const availableLanguages = Array.from({ length: maxLanguages }, (_, i) => `Language ${i + 1}`);
                    
                    return availableLanguages.length > 1 ? (
                      <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-300">
                        <span className="text-sm text-gray-700">🌐</span>
                        <select
                          value={selectedLanguageIndex}
                          onChange={(e) => setSelectedLanguageIndex(parseInt(e.target.value, 10))}
                          className="text-sm border-none bg-transparent text-gray-700 focus:outline-none focus:ring-0 cursor-pointer font-medium"
                          style={{ minWidth: '120px' }}
                        >
                          {availableLanguages.map((label, index) => (
                            <option key={index} value={index}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {(() => {
                    const { regularQuestions } = separateQuestions(selectedInterview.responses, selectedInterview.survey);
                    return regularQuestions.map((response, index) => {
                      // Find the corresponding question in the survey to get conditional logic
                      const surveyQuestion = findQuestionByText(response.questionText, selectedInterview.survey);
                      const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
                      const conditionsMet = hasConditions ? areConditionsMet(surveyQuestion.conditions, selectedInterview.responses, selectedInterview.survey) : true;
                      
                      // Get display text for question and description using selected language
                      const questionTextDisplay = getLanguageText(response.questionText || '', selectedLanguageIndex);
                      const questionDescriptionDisplay = response.questionDescription 
                        ? getLanguageText(response.questionDescription, selectedLanguageIndex)
                        : null;
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">
                              Q{index + 1}: {questionTextDisplay}
                            </h5>
                          <div className="flex items-center space-x-2">
                            {hasConditions && conditionsMet && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-md">
                                <Zap className="w-3 h-3" />
                                <span className="text-xs font-medium">Condition Met</span>
                              </div>
                            )}
                            {hasConditions && !conditionsMet && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 rounded-md">
                                <Zap className="w-3 h-3" />
                                <span className="text-xs font-medium">Condition Not Met</span>
                              </div>
                            )}
                            {response.isSkipped && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Skipped
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {questionDescriptionDisplay && (
                          <p className="text-xs text-gray-600 mb-2">{questionDescriptionDisplay}</p>
                        )}
                        
                        {/* Conditional Logic Display */}
                        {hasConditions && (
                          <div className={`mb-3 p-3 border rounded-lg ${
                            conditionsMet 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center space-x-2 mb-2">
                              <Zap className={`w-4 h-4 ${conditionsMet ? 'text-green-600' : 'text-red-600'}`} />
                              <span className={`text-sm font-medium ${conditionsMet ? 'text-green-800' : 'text-red-800'}`}>
                                Conditional Logic:
                              </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${conditionsMet ? 'text-green-700' : 'text-red-700'}`}>
                              {conditionsMet 
                                ? `This question appeared because: ${formatConditionalLogic(surveyQuestion.conditions, selectedInterview.survey)}`
                                : `This question was skipped because: ${formatConditionalLogic(surveyQuestion.conditions, selectedInterview.survey)} (condition not met)`
                              }
                            </p>
                          </div>
                        )}
                        
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm text-gray-800">
                            <strong>Answer:</strong> {formatResponseDisplay(response.response, surveyQuestion, selectedLanguageIndex)}
                          </p>
                        </div>
                        {response.responseTime > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Response time: {response.responseTime}s
                          </p>
                        )}
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            </div>

            {/* Audio Player & Quality Metrics & Actions */}
            <div className="space-y-6">
              {selectedInterview.interviewMode === 'cati' && catiCallDetails?.recordingUrl ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Headphones className="w-5 h-5 mr-2" />
                    Call Recording
                  </h4>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      <div>Call Duration: {catiCallDetails?.callDuration ? formatDuration(catiCallDetails.callDuration) : 'N/A'}</div>
                      <div>Talk Duration: {catiCallDetails?.talkDuration ? formatDuration(catiCallDetails.talkDuration) : 'N/A'}</div>
                      <div>Format: MP3</div>
                      <div>Status: {catiCallDetails?.callStatusDescription || catiCallDetails?.callStatus || 'N/A'}</div>
                    </div>
                    {catiRecordingBlobUrl ? (
                      <>
                        <audio
                          data-interview-id={selectedInterview._id}
                          src={catiRecordingBlobUrl}
                          onEnded={() => setAudioPlaying(null)}
                          onPause={() => setAudioPlaying(null)}
                          onPlay={() => setAudioPlaying(selectedInterview._id)}
                          className="w-full"
                          controls
                        />
                        <a
                          href={catiRecordingBlobUrl}
                          download={`cati_recording_${catiCallDetails?.callId || catiCallDetails?._id || 'recording'}.mp3`}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Recording
                        </a>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">Loading recording...</div>
                    )}
                  </div>
                </div>
              ) : selectedInterview.audioRecording?.hasAudio ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Headphones className="w-5 h-5 mr-2" />
                    Audio Recording
                  </h4>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      <div>Duration: {formatDuration(selectedInterview.audioRecording.recordingDuration)}</div>
                      <div>Format: {selectedInterview.audioRecording.format?.toUpperCase()}</div>
                      <div>Size: {(selectedInterview.audioRecording.fileSize / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      onClick={() => handlePlayAudio(
                        selectedInterview.audioRecording.audioUrl, 
                        selectedInterview._id,
                        selectedInterview.audioRecording.signedUrl
                      )}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {audioPlaying === selectedInterview._id ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause Audio
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Play Audio
                        </>
                      )}
                    </button>
                    <audio
                      key={`audio-${selectedInterview._id}-${audioSignedUrls[selectedInterview._id] ? 'signed' : 'pending'}`}
                      data-interview-id={selectedInterview._id}
                      src={(() => {
                        const audioUrl = selectedInterview.audioRecording.audioUrl;
                        
                        // Check for mock URLs
                        if (audioUrl && (audioUrl.startsWith('mock://') || audioUrl.includes('mock://') || audioUrl.includes('mock%3A//'))) {
                          console.warn('⚠️ Mock URL detected, skipping audio playback');
                          return null;
                        }
                        
                        // Priority: cached signed URL > backend provided signedUrl > local path/full URL > empty
                        const cachedSignedUrl = audioSignedUrls[selectedInterview._id];
                        if (cachedSignedUrl) {
                          console.log('✅ Using cached signed URL');
                          return cachedSignedUrl;
                        }
                        
                        const backendSignedUrl = selectedInterview.audioRecording.signedUrl;
                        if (backendSignedUrl) {
                          console.log('✅ Using backend provided signed URL');
                          return backendSignedUrl;
                        }
                        
                        // NEVER set S3 keys directly - they will be resolved relative to current page
                        if (audioUrl && (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/'))) {
                          // This is an S3 key - return null to prevent empty string src, will be fetched in useEffect or onError
                          console.log('⚠️ S3 key detected, waiting for signed URL...');
                          return null;
                        }
                        // Check for mock URLs - return null to prevent browser from trying to load them
                        if (audioUrl && (audioUrl.startsWith('mock://') || audioUrl.includes('mock://'))) {
                          console.warn('⚠️ Mock URL detected, skipping audio playback');
                          return null;
                        }
                        // Only return if it's a local path (starts with /) or full URL (starts with http)
                        if (audioUrl && (audioUrl.startsWith('/') || audioUrl.startsWith('http'))) {
                          console.log('✅ Using local/full URL:', audioUrl);
                          return audioUrl;
                        }
                        return '';
                      })()}
                      onEnded={() => setAudioPlaying(null)}
                      onPause={() => setAudioPlaying(null)}
                      onError={async (e) => {
                        console.error('Audio element error:', e);
                        const audioEl = e.target;
                        const audioUrl = selectedInterview.audioRecording.audioUrl;
                        
                        // Check for mock URLs first
                        if (audioUrl && (audioUrl.startsWith('mock://') || audioUrl.includes('mock://'))) {
                          console.warn('⚠️ Mock URL detected in onError, skipping');
                          setAudioPlaying(null);
                          return;
                        }
                        
                        // If audioUrl is an S3 key, try to get signed URL
                        if (audioUrl && (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) && !audioSignedUrls[selectedInterview._id]) {
                          try {
                            const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
                            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
                            const token = localStorage.getItem('token');
                            const signedUrlResponse = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });
                            if (signedUrlResponse.ok) {
                              const data = await signedUrlResponse.json();
                              if (data.signedUrl) {
                                // Update the audio element src with signed URL
                                setAudioSignedUrls(prev => ({ ...prev, [selectedInterview._id]: data.signedUrl }));
                                audioEl.src = data.signedUrl;
                                audioEl.load();
                                // Try to play again
                                audioEl.play().catch(playError => {
                                  console.error('Error playing audio after loading signed URL:', playError);
                                  showError('Failed to play audio. Please try again.');
                                  setAudioPlaying(null);
                                });
                                return;
                              }
                            }
                          } catch (error) {
                            console.error('Error fetching signed URL:', error);
                          }
                        }
                        
                        const src = audioEl?.src || audioUrl;
                        console.error('Failed to load audio from:', src);
                        showError('Audio file not found. The file may have been deleted or moved.');
                        setAudioPlaying(null);
                        // Hide the audio element on error
                        if (audioEl) {
                          audioEl.style.display = 'none';
                        }
                      }}
                      className="w-full"
                      controls
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <Headphones className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No audio recording available</p>
                </div>
              )}

              {/* Quality Metrics */}
              {selectedInterview.qualityMetrics && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Quality Metrics</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(selectedInterview.qualityMetrics).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Survey Response Verification Form */}
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Survey Response Verification</h4>
                <div className="space-y-6">
                  
                  {/* Question 1: Audio Status */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      1. Audio status (অডিও স্ট্যাটাস)
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="1"
                          checked={verificationForm.audioStatus === '1'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">1 - Survey Conversation can be heard (জরিপের কথোপকথন শোনা যাচ্ছে)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="2"
                          checked={verificationForm.audioStatus === '2'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">2 - No Conversation (কোনো কথোপকথন নেই)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="3"
                          checked={verificationForm.audioStatus === '3'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">3 - Irrelevant Conversation (অপ্রাসঙ্গিক কথোপকথন)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="4"
                          checked={verificationForm.audioStatus === '4'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">4 - Can hear the interviewer more than the respondent (সাক্ষাৎকারগ্রহণকারীর কণ্ঠস্বর উত্তরদাতার তুলনায় বেশি শোনা যাচ্ছে)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="7"
                          checked={verificationForm.audioStatus === '7'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">7 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audioStatus"
                          value="8"
                          checked={verificationForm.audioStatus === '8'}
                          onChange={(e) => handleVerificationFormChange('audioStatus', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">8 - Duplicate Audio (ডুপ্লিকেট অডিও)</span>
                      </label>
                    </div>
                  </div>

                  {/* Question 2: Gender Matching - Only show if Audio Status is '1' or '7' */}
                  {shouldShowVerificationQuestion('gender', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        2. Gender of the Respondent Matching? (উত্তরদাতার লিঙ্গ কি মেলানো হয়েছে?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {selectedInterview && (
                        <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                          <span className="text-sm font-medium text-blue-700">Response: </span>
                          <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).gender}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="genderMatching"
                            value="1"
                            checked={verificationForm.genderMatching === '1'}
                            onChange={(e) => handleVerificationFormChange('genderMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="genderMatching"
                            value="2"
                            checked={verificationForm.genderMatching === '2'}
                            onChange={(e) => handleVerificationFormChange('genderMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="genderMatching"
                            value="3"
                            checked={verificationForm.genderMatching === '3'}
                            onChange={(e) => handleVerificationFormChange('genderMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">3 - Male answering on behalf of female (মহিলার পক্ষ থেকে পুরুষ উত্তর দিচ্ছেন।)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Question 3: Upcoming Elections Matching */}
                  {shouldShowVerificationQuestion('upcomingElection', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        3. Is the Response Matching for the Upcoming Elections preference (Q8)? (উত্তরটি কি আসন্ন নির্বাচনের পছন্দ (প্রশ্ন ৮) এর সাথে মিলে যাচ্ছে?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {selectedInterview && (
                        <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                          <span className="text-sm font-medium text-blue-700">Response: </span>
                          <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).upcomingElection}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="upcomingElectionsMatching"
                            value="1"
                            checked={verificationForm.upcomingElectionsMatching === '1'}
                            onChange={(e) => handleVerificationFormChange('upcomingElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="upcomingElectionsMatching"
                            value="2"
                            checked={verificationForm.upcomingElectionsMatching === '2'}
                            onChange={(e) => handleVerificationFormChange('upcomingElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="upcomingElectionsMatching"
                            value="3"
                            checked={verificationForm.upcomingElectionsMatching === '3'}
                            onChange={(e) => handleVerificationFormChange('upcomingElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="upcomingElectionsMatching"
                            value="4"
                            checked={verificationForm.upcomingElectionsMatching === '4'}
                            onChange={(e) => handleVerificationFormChange('upcomingElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">4 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Question 4: Previous Elections Matching */}
                  {shouldShowVerificationQuestion('assembly2021', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        4. Is the Response Matching for the Previous 2021 Assembly Election (Q5)? (উত্তরটি কি ২০২১ সালের পূর্ববর্তী বিধানসভা নির্বাচনের (প্রশ্ন ৫) সাথে মিলে যাচ্ছে?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {selectedInterview && (
                        <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                          <span className="text-sm font-medium text-blue-700">Response: </span>
                          <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).assembly2021}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousElectionsMatching"
                            value="1"
                            checked={verificationForm.previousElectionsMatching === '1'}
                            onChange={(e) => handleVerificationFormChange('previousElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousElectionsMatching"
                            value="2"
                            checked={verificationForm.previousElectionsMatching === '2'}
                            onChange={(e) => handleVerificationFormChange('previousElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousElectionsMatching"
                            value="3"
                            checked={verificationForm.previousElectionsMatching === '3'}
                            onChange={(e) => handleVerificationFormChange('previousElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousElectionsMatching"
                            value="4"
                            checked={verificationForm.previousElectionsMatching === '4'}
                            onChange={(e) => handleVerificationFormChange('previousElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">4 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Question 5: Previous Loksabha Elections Matching */}
                  {shouldShowVerificationQuestion('lokSabha2024', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        5. Is the Response Matching for the Previous 2024 Loksabha Election (Q6)? (উত্তরটি কি ২০২৪ সালের পূর্ববর্তী লোকসভা নির্বাচনের (প্রশ্ন ৬) সাথে মিলে যাচ্ছে?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {selectedInterview && (
                        <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                          <span className="text-sm font-medium text-blue-700">Response: </span>
                          <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).lokSabha2024}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousLoksabhaElectionsMatching"
                            value="1"
                            checked={verificationForm.previousLoksabhaElectionsMatching === '1'}
                            onChange={(e) => handleVerificationFormChange('previousLoksabhaElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousLoksabhaElectionsMatching"
                            value="2"
                            checked={verificationForm.previousLoksabhaElectionsMatching === '2'}
                            onChange={(e) => handleVerificationFormChange('previousLoksabhaElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousLoksabhaElectionsMatching"
                            value="3"
                            checked={verificationForm.previousLoksabhaElectionsMatching === '3'}
                            onChange={(e) => handleVerificationFormChange('previousLoksabhaElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="previousLoksabhaElectionsMatching"
                            value="4"
                            checked={verificationForm.previousLoksabhaElectionsMatching === '4'}
                            onChange={(e) => handleVerificationFormChange('previousLoksabhaElectionsMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">4 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Question 6: Name Matching */}
                  {shouldShowVerificationQuestion('name', selectedInterview) && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      6. Name of the Respondent Matching? (উত্তরদাতার নাম কি মিলে গেছে?)
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    {selectedInterview && (
                      <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                        <span className="text-sm font-medium text-blue-700">Response: </span>
                        <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).name}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nameMatching"
                          value="1"
                          checked={verificationForm.nameMatching === '1'}
                          onChange={(e) => handleVerificationFormChange('nameMatching', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nameMatching"
                          value="2"
                          checked={verificationForm.nameMatching === '2'}
                          onChange={(e) => handleVerificationFormChange('nameMatching', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nameMatching"
                          value="3"
                          checked={verificationForm.nameMatching === '3'}
                          onChange={(e) => handleVerificationFormChange('nameMatching', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="nameMatching"
                          value="4"
                          checked={verificationForm.nameMatching === '4'}
                          onChange={(e) => handleVerificationFormChange('nameMatching', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">4 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                      </label>
                    </div>
                  </div>
                  )}

                  {/* Question 7: Age Matching */}
                  {shouldShowVerificationQuestion('age', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        7. Is the Age matching? (বয়স কি মিলে গেছে?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      {selectedInterview && (
                        <div className="mb-3 p-2 bg-[#E6F0F8] border-l-4 border-blue-500 rounded">
                          <span className="text-sm font-medium text-blue-700">Response: </span>
                          <span className="text-sm text-[#373177]">{getVerificationResponses(selectedInterview).age}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ageMatching"
                            value="1"
                            checked={verificationForm.ageMatching === '1'}
                            onChange={(e) => handleVerificationFormChange('ageMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">1 - Matched (মিলে গেছে)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ageMatching"
                            value="2"
                            checked={verificationForm.ageMatching === '2'}
                            onChange={(e) => handleVerificationFormChange('ageMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">2 - Not Matched (মেলেনি)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ageMatching"
                            value="3"
                            checked={verificationForm.ageMatching === '3'}
                            onChange={(e) => handleVerificationFormChange('ageMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ageMatching"
                            value="4"
                            checked={verificationForm.ageMatching === '4'}
                            onChange={(e) => handleVerificationFormChange('ageMatching', e.target.value)}
                            className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">4 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Question 8: Phone Number Asked */}
                  {shouldShowVerificationQuestion('phoneNumber', selectedInterview) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        8. Did the interviewer ask the phone number of the respondent? (সাক্ষাৎকারগ্রহণকারী কি উত্তরদাতার ফোন নম্বর জিজ্ঞাসা করেছিলেন?)
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <div className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phoneNumberAsked"
                          value="1"
                          checked={verificationForm.phoneNumberAsked === '1'}
                          onChange={(e) => handleVerificationFormChange('phoneNumberAsked', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">1 - Asked the number and noted in the questionnaire (নম্বরটি জিজ্ঞাসা করে প্রশ্নপত্রে নোট করা হয়েছে)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phoneNumberAsked"
                          value="2"
                          checked={verificationForm.phoneNumberAsked === '2'}
                          onChange={(e) => handleVerificationFormChange('phoneNumberAsked', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">2 - Asked the question but the respondent refused to share (প্রশ্নটি করা হয়েছে কিন্তু উত্তরদাতা শেয়ার করতে অস্বীকার করেছেন)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phoneNumberAsked"
                          value="3"
                          checked={verificationForm.phoneNumberAsked === '3'}
                          onChange={(e) => handleVerificationFormChange('phoneNumberAsked', e.target.value)}
                          className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">3 - Did not ask (জিজ্ঞাসা করা হয়নি)</span>
                      </label>
                      </div>
                    </div>
                  )}

                  {/* Custom Feedback */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Additional Feedback (Optional)
                    </label>
                    <textarea
                      value={verificationForm.customFeedback}
                      onChange={(e) => handleVerificationFormChange('customFeedback', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Provide any additional feedback or notes for the interviewer..."
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSubmitVerification}
                      disabled={!isVerificationFormValid() || isSubmittingVerification}
                      className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isVerificationFormValid() && !isSubmittingVerification
                          ? 'bg-[#001D48] hover:bg-blue-700 focus:ring-blue-500'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSubmittingVerification ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-4 h-4 mr-2" />
                          Submit Verification
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default SurveyApprovals;











