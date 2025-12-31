import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { getMainText } from '../../utils/translations';
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
  FileText,
  Headphones,
  Download,
  RefreshCw,
  BarChart3,
  Target,
  Award,
  Zap,
  TrendingUp,
  MapPin,
  PhoneCall
} from 'lucide-react';
import { surveyResponseAPI, catiAPI } from '../../services/api';
import api from '../../services/api';

const MyInterviews = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [ageRange, setAgeRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('endTime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [catiCallDetails, setCatiCallDetails] = useState(null);
  const [catiRecordingBlobUrl, setCatiRecordingBlobUrl] = useState(null);
  const { showSuccess, showError } = useToast();

  // Fetch interviews for the logged-in interviewer
  useEffect(() => {
    fetchMyInterviews();
  }, [searchTerm, filterStatus, filterGender, ageRange, sortBy, sortOrder]);

  const fetchMyInterviews = async () => {
    try {
      setLoading(true);
      const response = await surveyResponseAPI.getMyInterviews({
        search: searchTerm,
        status: filterStatus,
        gender: filterGender,
        ageMin: ageRange.min,
        ageMax: ageRange.max,
        sortBy,
        sortOrder
      });
      
      if (response.success) {
        setInterviews(response.data.interviews);
      } else {
        showError('Failed to fetch your interviews');
      }
    } catch (error) {
      console.error('Error fetching interviews:', error);
      showError('Failed to fetch your interviews');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending_Approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-[#E6F0F8] text-[#001D48]';
      case 'abandoned':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending_Approval':
        return <Clock className="w-4 h-4" />;
      case 'Approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'Rejected':
        return <AlertCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'abandoned':
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewResponse = async (interview) => {
    setSelectedInterview(interview);
    setShowResponseDetails(true);
    setCatiCallDetails(null);
    setCatiRecordingBlobUrl(null);
    
    // If CATI interview, fetch call details
    if (interview.interviewMode === 'cati') {
      const callId = interview.call_id;
      if (callId) {
        try {
          const callResponse = await catiAPI.getCallById(callId);
          if (callResponse.success && callResponse.data) {
            setCatiCallDetails(callResponse.data);
            
            // Fetch recording if available
            if (callResponse.data.recordingUrl) {
              try {
                const recordingResponse = await api.get(
                  `/api/cati/recording/${callResponse.data._id}`,
                  { responseType: 'blob' }
                );
                const blob = new Blob([recordingResponse.data], { type: 'audio/mpeg' });
                const blobUrl = URL.createObjectURL(blob);
                setCatiRecordingBlobUrl(blobUrl);
              } catch (recordingError) {
                console.error('Error fetching CATI recording:', recordingError);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching CATI call details:', error);
        }
      }
    }
  };
  
  // Cleanup blob URL on unmount or modal close
  useEffect(() => {
    return () => {
      if (catiRecordingBlobUrl) {
        URL.revokeObjectURL(catiRecordingBlobUrl);
      }
    };
  }, [catiRecordingBlobUrl]);

  const handlePlayAudio = async (audioUrl, interviewId, signedUrl = null) => {
    if (audioPlaying === interviewId) {
      // Pause current audio
      if (audioElement) {
        audioElement.pause();
        setAudioPlaying(null);
        setAudioElement(null);
      }
    } else {
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
      }
      
      try {
        // Use signedUrl if available (from S3), otherwise construct URL from audioUrl
        let fullAudioUrl;
        if (signedUrl) {
          // Use S3 signed URL directly
          fullAudioUrl = signedUrl;
        } else if (audioUrl.startsWith('http')) {
          // Already a full URL
          fullAudioUrl = audioUrl;
        } else if (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) {
          // This is an S3 key, not a local path - need to get signed URL from API
          const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
          try {
            const response = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              fullAudioUrl = data.signedUrl || audioUrl;
            } else {
              console.error('Failed to get signed URL:', response.status);
              showError('Failed to get audio URL. Please try again.');
              setAudioPlaying(null);
              setAudioElement(null);
              return;
            }
          } catch (error) {
            console.error('Error fetching signed URL:', error);
            showError('Failed to get audio URL. Please try again.');
            setAudioPlaying(null);
            setAudioElement(null);
            return;
          }
        } else {
          // Local file path - construct full URL
          fullAudioUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}${audioUrl}`;
        }
        
        // For S3 signed URLs, skip HEAD check (they're always valid for the expiry period)
        if (!signedUrl) {
          // Only check local files
          try {
            const response = await fetch(fullAudioUrl, { method: 'HEAD' });
            if (!response.ok) {
              if (response.status === 404) {
                showError('Audio file not found. The file may have been deleted or moved.');
                setAudioPlaying(null);
                setAudioElement(null);
                return;
              } else {
                showError(`Failed to access audio file. Server returned ${response.status}.`);
                setAudioPlaying(null);
                setAudioElement(null);
                return;
              }
            }
          } catch (fetchError) {
            console.error('Error checking audio file:', fetchError);
            showError('Failed to access audio file. Please check your connection.');
            setAudioPlaying(null);
            setAudioElement(null);
            return;
          }
        }
        
        // Always use video element for WebM files (which are actually video/webm)
        const mediaElement = document.createElement('video');
        mediaElement.style.display = 'none'; // Hide the video element
        
        // Add event listeners
        mediaElement.addEventListener('ended', () => {
          setAudioPlaying(null);
          setAudioElement(null);
        });
        
        mediaElement.addEventListener('error', (e) => {
          console.error('Media playback error:', e);
          // Check if it's a 404 error (file not found)
          if (e.target.error && e.target.error.code === 4) {
            showError('Audio file not found. The file may have been deleted or moved.');
          } else {
            showError('Failed to play audio. The file may be corrupted or in an unsupported format.');
          }
          setAudioPlaying(null);
          setAudioElement(null);
        });
        
        // Set source and play
        mediaElement.src = fullAudioUrl;
        await mediaElement.load();
        await mediaElement.play();
        setAudioPlaying(interviewId);
        setAudioElement(mediaElement);
      } catch (error) {
        console.error('Error playing audio:', error);
        showError('Failed to play audio. Please check if the file exists and is accessible.');
        setAudioPlaying(null);
        setAudioElement(null);
      }
    }
  };

  const getRespondentInfo = (responses) => {
    // Extract respondent information from responses
    const nameResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('name') || 
      r.questionText.toLowerCase().includes('respondent')
    );
    const genderResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('gender') || 
      r.questionText.toLowerCase().includes('sex')
    );
    const ageResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('age') || 
      r.questionText.toLowerCase().includes('year')
    );

    return {
      name: nameResponse?.response || 'Not Available',
      gender: genderResponse?.response || 'Not Available',
      age: ageResponse?.response || 'Not Available'
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
  const isAgeInRange = (age, minAge, maxAge) => {
    if (!age) return false;
    if (minAge && age < parseInt(minAge)) return false;
    if (maxAge && age > parseInt(maxAge)) return false;
    return true;
  };

  // Helper function to clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterGender('');
    setAgeRange({ min: '', max: '' });
  };

  // Helper function to get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (filterStatus) count++;
    if (filterGender) count++;
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
    if (!survey) return null;
    
    // Handle nested survey structure
    const actualSurvey = survey.survey || survey;
    
    // Search in sections
    if (actualSurvey.sections) {
      for (const section of actualSurvey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.text === questionText) {
              return question;
            }
          }
        }
      }
    }
    
    // Search in top-level questions
    if (actualSurvey.questions) {
      for (const question of actualSurvey.questions) {
        if (question.text === questionText) {
          return question;
        }
      }
    }
    
    return null;
  };

  // Helper function to find question by keywords in survey
  const findQuestionByKeywords = (keywords, survey) => {
    if (!survey) return null;
    
    const actualSurvey = survey.survey || survey;
    const allQuestions = [];
    
    // Collect all questions
    if (actualSurvey.sections) {
      actualSurvey.sections.forEach(section => {
        if (section.questions) {
          allQuestions.push(...section.questions);
        }
      });
    }
    if (actualSurvey.questions) {
      allQuestions.push(...actualSurvey.questions);
    }
    
    // Find question matching keywords
    const keywordsLower = keywords.map(k => k.toLowerCase());
    return allQuestions.find(q => {
      const questionText = (q.text || '').toLowerCase();
      return keywordsLower.some(keyword => questionText.includes(keyword));
    });
  };

  // Helper function to get failed questions from verification criteria
  const getFailedQuestions = (verificationData, survey) => {
    if (!verificationData || !verificationData.criteria) return [];
    
    const criteria = verificationData.criteria;
    const failedQuestions = [];
    
    // Map criteria to question types and check if they failed
    // Based on getApprovalStatus logic from SurveyApprovals.jsx
    
    // Audio Status - fails if not '1', '4', or '7'
    if (criteria.audioStatus && !['1', '4', '7'].includes(criteria.audioStatus)) {
      failedQuestions.push({
        criterion: 'audioStatus',
        questionText: 'Audio Quality',
        reason: 'Audio quality did not match'
      });
    }
    
    // Gender Matching - fails if not '1'
    if (criteria.genderMatching && criteria.genderMatching !== '1') {
      const genderQuestion = findQuestionByKeywords(['gender'], survey) || 
                            findQuestionByText('What is your gender?', survey);
      failedQuestions.push({
        criterion: 'genderMatching',
        questionText: genderQuestion?.text || 'Gender question',
        reason: 'Gender response did not match'
      });
    }
    
    // Upcoming Elections Matching - fails if not '1' or '3'
    if (criteria.upcomingElectionsMatching && !['1', '3'].includes(criteria.upcomingElectionsMatching)) {
      const upcomingElectionsQuestion = findQuestionByKeywords(['upcoming', 'election', 'tomorrow', 'assembly election'], survey);
      failedQuestions.push({
        criterion: 'upcomingElectionsMatching',
        questionText: upcomingElectionsQuestion?.text || 'Upcoming elections question',
        reason: 'Upcoming elections response did not match'
      });
    }
    
    // Previous Elections Matching - fails if not '1' or '3'
    if (criteria.previousElectionsMatching && !['1', '3'].includes(criteria.previousElectionsMatching)) {
      const previousElectionsQuestion = findQuestionByKeywords(['previous', 'election', 'last assembly', 'voted'], survey);
      failedQuestions.push({
        criterion: 'previousElectionsMatching',
        questionText: previousElectionsQuestion?.text || 'Previous elections question',
        reason: 'Previous elections response did not match'
      });
    }
    
    // Previous Lok Sabha Elections Matching - fails if not '1' or '3'
    if (criteria.previousLoksabhaElectionsMatching && !['1', '3'].includes(criteria.previousLoksabhaElectionsMatching)) {
      const loksabhaQuestion = findQuestionByKeywords(['lok sabha', 'loksabha', 'parliamentary'], survey);
      failedQuestions.push({
        criterion: 'previousLoksabhaElectionsMatching',
        questionText: loksabhaQuestion?.text || 'Previous Lok Sabha elections question',
        reason: 'Previous Lok Sabha elections response did not match'
      });
    }
    
    // Name Matching - fails if not '1' or '3'
    if (criteria.nameMatching && !['1', '3'].includes(criteria.nameMatching)) {
      const nameQuestion = findQuestionByText('What is your full name?', survey) ||
                           findQuestionByKeywords(['name', 'full name'], survey);
      failedQuestions.push({
        criterion: 'nameMatching',
        questionText: nameQuestion?.text || 'Name question',
        reason: 'Name response did not match'
      });
    }
    
    // Age Matching - fails if not '1' or '3'
    if (criteria.ageMatching && !['1', '3'].includes(criteria.ageMatching)) {
      const ageQuestion = findQuestionByText('Could you please tell me your age in complete years?', survey) ||
                          findQuestionByKeywords(['age', 'year'], survey);
      failedQuestions.push({
        criterion: 'ageMatching',
        questionText: ageQuestion?.text || 'Age question',
        reason: 'Age response did not match'
      });
    }
    
    return failedQuestions;
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
  const evaluateCondition = (condition, responses) => {
    if (!condition.questionId || !condition.operator || condition.value === undefined || condition.value === '__NOVALUE__') {
      return false;
    }

    // Find the response for the target question
    const targetResponse = responses.find(response => {
      // Try to match by question ID first, then by question text
      return response.questionId === condition.questionId || 
             response.questionText === condition.questionText;
    });

    if (!targetResponse || !targetResponse.response) {
      return false;
    }

    const responseValue = targetResponse.response;
    const conditionValue = condition.value;

    // Helper function to get main text (without translation) for comparison
    const getComparisonValue = (val) => {
      if (val === null || val === undefined) return String(val || '');
      return getMainText(String(val)).toLowerCase().trim();
    };

    switch (condition.operator) {
      case 'equals':
        return getComparisonValue(responseValue) === getComparisonValue(conditionValue);
      case 'not_equals':
        return getComparisonValue(responseValue) !== getComparisonValue(conditionValue);
      case 'contains':
        return getComparisonValue(responseValue).includes(getComparisonValue(conditionValue));
      case 'not_contains':
        return !getComparisonValue(responseValue).includes(getComparisonValue(conditionValue));
      case 'greater_than':
        return parseFloat(responseValue) > parseFloat(conditionValue);
      case 'less_than':
        return parseFloat(responseValue) < parseFloat(conditionValue);
      case 'is_empty':
        return !responseValue || responseValue.toString().trim() === '';
      case 'is_not_empty':
        return responseValue && responseValue.toString().trim() !== '';
      case 'is_selected':
        return getComparisonValue(responseValue) === getComparisonValue(conditionValue);
      case 'is_not_selected':
        return getComparisonValue(responseValue) !== getComparisonValue(conditionValue);
      default:
        return false;
    }
  };

  // Helper function to check if all conditions are met
  const areConditionsMet = (conditions, responses) => {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => evaluateCondition(condition, responses));
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
        const conditionsMet = areConditionsMet(surveyQuestion.conditions, responses);
        
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

  const filteredInterviews = interviews.filter(interview => {
    const respondentInfo = getRespondentInfo(interview.responses);
    
    // Search filter - now includes respondent name
    const matchesSearch = !searchTerm || 
      interview.survey?.surveyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.responseId?.toString().includes(searchTerm) ||
      interview.sessionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      respondentInfo.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = !filterStatus || interview.status === filterStatus;
    
    // Gender filter
    const matchesGender = !filterGender || 
      respondentInfo.gender.toLowerCase() === filterGender.toLowerCase();
    
    // Age range filter
    const respondentAge = parseAge(respondentInfo.age);
    const matchesAgeRange = !ageRange.min && !ageRange.max || 
      isAgeInRange(respondentAge, ageRange.min, ageRange.max);
    
    return matchesSearch && matchesStatus && matchesGender && matchesAgeRange;
  });

  const sortedInterviews = [...filteredInterviews].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'endTime':
        aValue = new Date(a.endTime);
        bValue = new Date(b.endTime);
        break;
      case 'totalTimeSpent':
        aValue = a.totalTimeSpent;
        bValue = b.totalTimeSpent;
        break;
      case 'answeredQuestions':
        aValue = a.answeredQuestions;
        bValue = b.answeredQuestions;
        break;
      case 'completionPercentage':
        aValue = a.completionPercentage;
        bValue = b.completionPercentage;
        break;
      default:
        aValue = new Date(a.endTime);
        bValue = new Date(b.endTime);
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Interviews</h1>
          <p className="text-gray-600">View and manage all your completed interviews</p>
        </div>
        <button
          onClick={fetchMyInterviews}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-[#E6F0F8] rounded-lg">
              <FileText className="w-6 h-6 text-[#373177]" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Interviews</p>
              <p className="text-2xl font-bold text-gray-900">{interviews.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.status === 'Approved').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.status === 'Pending_Approval').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-[#E8E6F5] rounded-lg">
              <Headphones className="w-6 h-6 text-[#373177]" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">With Audio</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.audioRecording?.hasAudio).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Search Section */}
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
          
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Status</option>
                <option value="Pending_Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>

            {/* Gender Filter */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">Gender</label>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Age Range Filter */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">Age Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={ageRange.min}
                  onChange={(e) => setAgeRange(prev => ({ ...prev, min: e.target.value }))}
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  min="0"
                  max="120"
                />
                <span className="flex items-center text-gray-500 text-sm">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={ageRange.max}
                  onChange={(e) => setAgeRange(prev => ({ ...prev, max: e.target.value }))}
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  min="0"
                  max="120"
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="endTime-desc">Latest First</option>
                <option value="endTime-asc">Oldest First</option>
                <option value="totalTimeSpent-desc">Longest Duration</option>
                <option value="totalTimeSpent-asc">Shortest Duration</option>
                <option value="answeredQuestions-desc">Most Questions</option>
                <option value="answeredQuestions-asc">Least Questions</option>
                <option value="completionPercentage-desc">Highest Completion</option>
                <option value="completionPercentage-asc">Lowest Completion</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {getActiveFilterCount() > 0 && (
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">&nbsp;</label>
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFilterCount() > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 text-[#373177] hover:text-[#001D48]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterStatus && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Status: {filterStatus}
                  <button
                    onClick={() => setFilterStatus('')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterGender && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E8E6F5] text-purple-800">
                  Gender: {filterGender}
                  <button
                    onClick={() => setFilterGender('')}
                    className="ml-1 text-[#373177] hover:text-purple-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(ageRange.min || ageRange.max) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Age: {ageRange.min || '0'} - {ageRange.max || '∞'}
                  <button
                    onClick={() => setAgeRange({ min: '', max: '' })}
                    className="ml-1 text-orange-600 hover:text-orange-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interviews Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            <span className="ml-2 text-gray-600">Loading interviews...</span>
          </div>
        ) : sortedInterviews.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews found</h3>
            <p className="text-gray-600">
              {searchTerm || filterStatus 
                ? 'Try adjusting your search or filter criteria.' 
                : 'You haven\'t completed any interviews yet.'}
            </p>
          </div>
        ) : (
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
                    Type
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
                  const respondentInfo = getRespondentInfo(interview.responses);
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
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center mb-1">
                            <User className="w-4 h-4 mr-1 text-gray-400" />
                            {respondentInfo.name}
                          </div>
                          <div className="flex items-center mb-1">
                            <Users className="w-4 h-4 mr-1 text-gray-400" />
                            {respondentInfo.gender}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {respondentInfo.age}
                          </div>
                          {interview.location && (
                            <div className="flex items-center mt-1">
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
                            <Target className="w-4 h-4 mr-1 text-gray-400" />
                            {interview.answeredQuestions || 0} / {interview.totalQuestions || 0}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-[#001D48] h-2 rounded-full" 
                              style={{ width: `${interview.completionPercentage || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {interview.completionPercentage || 0}% complete
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Clock className="w-4 h-4 mr-1 text-gray-400" />
                          {formatDuration(interview.totalTimeSpent || 0)}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          interview.interviewMode === 'cati' 
                            ? 'bg-[#E8E6F5] text-purple-800' 
                            : 'bg-[#E6F0F8] text-[#001D48]'
                        }`}>
                          {interview.interviewMode === 'cati' ? (
                            <PhoneCall className="w-3 h-3 mr-1" />
                          ) : (
                            <MapPin className="w-3 h-3 mr-1" />
                          )}
                          <span className="ml-1">{interview.interviewMode === 'cati' ? 'CATI' : 'CAPI'}</span>
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                          {getStatusIcon(interview.status)}
                          <span className="ml-1">{interview.status}</span>
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        {interview.audioRecording?.hasAudio ? (
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
                        ) : (
                          <span className="text-sm text-gray-400">No Audio</span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewResponse(interview)}
                          className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>

    {/* Response Details Modal */}
    {showResponseDetails && selectedInterview && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-7xl h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-lg font-medium text-gray-900">
                Interview Response Details
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Response ID: {selectedInterview.responseId}</p>
                <p className="break-words max-w-4xl">
                  Survey: {selectedInterview.survey?.surveyName || 'Unknown Survey'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResponseDetails(false)}
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
                      {selectedInterview.status === 'Rejected' && selectedInterview.verificationData && (
                        <div className="col-span-2 mt-3 pt-3 border-t border-gray-300">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-start">
                              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h5 className="font-medium text-red-900 mb-2">Rejection Reason</h5>
                                {selectedInterview.verificationData.feedback && (
                                  <p className="text-sm text-red-800 mb-3">{selectedInterview.verificationData.feedback}</p>
                                )}
                                {(() => {
                                  const failedQuestions = getFailedQuestions(selectedInterview.verificationData, selectedInterview.survey);
                                  if (failedQuestions.length > 0) {
                                    return (
                                      <div>
                                        <p className="text-sm font-medium text-red-900 mb-2">Questions that failed quality review:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {failedQuestions.map((failed, index) => (
                                            <li key={index} className="text-sm text-red-800">
                                              <span className="font-medium">{failed.questionText}</span>
                                              {failed.reason && (
                                                <span className="text-red-700"> - {failed.reason}</span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                          <div>
                            <span className="text-gray-600">Location:</span>
                            <span className="ml-2 font-medium">
                              {selectedInterview.location.city}, {selectedInterview.location.state}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Coordinates:</span>
                            <span className="ml-2 font-medium text-xs">
                              {selectedInterview.location.latitude.toFixed(6)}, {selectedInterview.location.longitude.toFixed(6)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Call Information - Only for CATI interviews */}
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

              {/* Location Information - Only for CAPI interviews */}
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
                        className="text-[#373177] hover:text-[#001D48] text-sm underline"
                      >
                        View on OpenStreetMap
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Responses */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Question Responses</h4>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {(() => {
                    const { regularQuestions } = separateQuestions(selectedInterview.responses, selectedInterview.survey);
                    return regularQuestions.map((response, index) => {
                      // Find the corresponding question in the survey to get conditional logic
                      const surveyQuestion = findQuestionByText(response.questionText, selectedInterview.survey);
                      const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
                      const conditionsMet = hasConditions ? areConditionsMet(surveyQuestion.conditions, selectedInterview.responses) : true;
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">
                              Q{index + 1}: {response.questionText}
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
                        
                        {response.questionDescription && (
                          <p className="text-xs text-gray-600 mb-2">{response.questionDescription}</p>
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
                            <strong>Answer:</strong> {JSON.stringify(response.response)}
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

            {/* Audio Player / Call Recording */}
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
                      <div>File: {selectedInterview.audioRecording.audioUrl.split('/').pop()}</div>
                    </div>
                    <button
                      onClick={() => handlePlayAudio(selectedInterview.audioRecording.audioUrl, selectedInterview._id)}
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
                    <video
                      ref={(el) => {
                        if (el && audioPlaying === selectedInterview._id) {
                          const fullAudioUrl = selectedInterview.audioRecording.audioUrl.startsWith('http') 
                            ? selectedInterview.audioRecording.audioUrl 
                            : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}${selectedInterview.audioRecording.audioUrl}`;
                          el.src = fullAudioUrl;
                        }
                      }}
                      onEnded={() => setAudioPlaying(null)}
                      onError={(e) => {
                        console.error('Video element error:', e);
                        showError('Failed to load audio file');
                      }}
                      className="w-full"
                      controls
                      style={{ 
                        height: '40px', // Make it look like an audio player
                        objectFit: 'none' // Hide video content
                      }}
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
            </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default MyInterviews;
