import React, { useState, useEffect } from 'react';
import { X, User, Calendar, MapPin, Clock, CheckCircle, AlertCircle, SkipForward, Eye, EyeOff, ThumbsDown, ThumbsUp, Zap, Play, Pause, Headphones, PhoneCall, Download, RotateCcw } from 'lucide-react';
import { surveyResponseAPI, catiAPI } from '../../services/api';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import assemblyConstituencies from '../../data/assemblyConstituencies.json';
import { renderWithTranslationProfessional, parseTranslation, getMainText, getLanguageText, parseMultiTranslation } from '../../utils/translations';
import { findGenderResponse, normalizeGenderResponse } from '../../utils/genderUtils';

const ResponseDetailsModal = ({ response, survey, onClose, hideActions = false, onStatusChange, hideSurveyResponses = false, hideStatusChange = false }) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioSignedUrl, setAudioSignedUrl] = useState(null);
  const [catiCallDetails, setCatiCallDetails] = useState(null);
  const [catiRecordingBlobUrl, setCatiRecordingBlobUrl] = useState(null);
  const [currentResponse, setCurrentResponse] = useState(response);
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0); // Language index for responses display
  const { showSuccess, showError } = useToast();

  // Update currentResponse when response prop changes
  useEffect(() => {
    setCurrentResponse(response);
    // Reset language index when response changes
    setSelectedLanguageIndex(0);
  }, [response]);

  // Fetch CATI call details when modal opens for CATI responses
  useEffect(() => {
    // Reset state when response changes
    setCatiCallDetails(null);
    if (catiRecordingBlobUrl) {
      URL.revokeObjectURL(catiRecordingBlobUrl);
      setCatiRecordingBlobUrl(null);
    }
    
    if (currentResponse?.interviewMode === 'cati') {
      const callId = currentResponse.call_id;
      if (callId) {
        const fetchCallDetails = async () => {
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
            }
          } catch (error) {
            console.error('Error fetching CATI call details:', error);
            // Don't show error - call details are optional
          }
        };
        fetchCallDetails();
      }
    }
    
    // Cleanup blob URL on unmount
    return () => {
      if (catiRecordingBlobUrl) {
        URL.revokeObjectURL(catiRecordingBlobUrl);
      }
    };
  }, [currentResponse?._id, currentResponse?.interviewMode, currentResponse?.call_id]);

  // Fetch signed URL for S3 audio if needed
  useEffect(() => {
    const fetchSignedUrl = async () => {
      // Reset audioSignedUrl when response changes
      setAudioSignedUrl(null);
      
      if (currentResponse?.audioRecording?.audioUrl) {
        const audioUrl = currentResponse.audioRecording.audioUrl;
        
        // If we already have a signedUrl from backend, use it
        if (currentResponse.audioRecording.signedUrl) {
          setAudioSignedUrl(currentResponse.audioRecording.signedUrl);
          return;
        }
        
        // Check if it's an S3 key (not a local path or full URL)
        if ((audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) && 
            !audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
          try {
            const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
            const token = localStorage.getItem('token');
            const fetchResponse = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(audioUrl)}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (fetchResponse.ok) {
              const data = await fetchResponse.json();
              if (data.signedUrl) {
                setAudioSignedUrl(data.signedUrl);
              }
            }
          } catch (error) {
            console.error('Error fetching signed URL:', error);
          }
        } else if (audioUrl.startsWith('/') || audioUrl.startsWith('http')) {
          // For local paths or full URLs, we can use them directly
          // But we don't need to set audioSignedUrl for these
        }
      } else if (currentResponse?.audioRecording?.signedUrl) {
        setAudioSignedUrl(currentResponse.audioRecording.signedUrl);
      }
    };

    fetchSignedUrl();
  }, [currentResponse?._id, currentResponse?.audioRecording?.audioUrl, currentResponse?.audioRecording?.signedUrl]);

  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
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

  // Helper function to get district from AC using assemblyConstituencies.json
  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.district) {
          return constituency.district;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to get Lok Sabha from AC
  const getLokSabhaFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.lokSabha) {
          return constituency.lokSabha;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to get state from GPS location or selectedPollingStation
  const getStateFromGPS = (location, selectedPollingStation = null, interviewMode = null) => {
    // First check GPS location
    if (location?.state) return location.state;
    if (location?.address?.state) return location.address.state;
    if (location?.administrative_area_level_1) return location.administrative_area_level_1;
    
    // For CATI responses, check selectedPollingStation.state as fallback
    if (interviewMode === 'cati' && selectedPollingStation?.state) {
      return selectedPollingStation.state;
    }
    
    // Also check selectedPollingStation for CAPI responses if location doesn't have state
    if (selectedPollingStation?.state) {
      return selectedPollingStation.state;
    }
    
    return 'N/A';
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
    
    const actualSurvey = survey?.survey || survey;
    const interviewInfoQuestions = [];
    const regularQuestions = [];
    
    responses.forEach((responseItem) => {
      const surveyQuestion = findQuestionByText(responseItem.questionText, actualSurvey);
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
    
    const actualSurvey = survey?.survey || survey;
    let ac = null;
    let pollingStation = null;
    let groupName = null;
    
    responses.forEach((responseItem) => {
      const surveyQuestion = findQuestionByText(responseItem.questionText, actualSurvey);
      
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
            // Just code or name - use as is, will be formatted in display
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
      // (In a full implementation, we'd look up the name, but for now show the code)
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
        // If first part is "Group X", the second part might be the code
        if (parts[0].toLowerCase().startsWith('group')) {
          // Return the code (second part)
          return parts[1] || stationValue;
        }
        // Otherwise it's already "Code - Name" format
        return stationValue;
      }
      // If it's just a code (numeric), return as is
      return stationValue;
    }
    
    return null;
  };

  // Helper function to extract respondent info from responses array
  const getRespondentInfo = (responses, responseData) => {
    if (!responses || !Array.isArray(responses)) {
      return { name: 'N/A', gender: 'N/A', age: 'N/A', city: 'N/A', district: 'N/A', ac: 'N/A', lokSabha: 'N/A', state: 'N/A' };
    }

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
    const findResponseByQuestionText = (searchTexts) => {
      return responses.find(r => {
        if (!r.questionText) return false;
        const mainText = getMainText(r.questionText).toLowerCase();
        return searchTexts.some(text => mainText.includes(text.toLowerCase()));
      });
    };

    // Get survey ID - convert to string to handle ObjectId objects
    const surveyIdRaw = responseData?.survey?._id || survey?._id || null;
    const surveyId = surveyIdRaw ? String(surveyIdRaw) : null;

    // Helper function to check if a response value is a gender value
    const isGenderResponseValue = (value) => {
      if (!value) return false;
      const valueStr = String(value).toLowerCase().trim();
      // Check for exact gender values
      if (valueStr === 'male' || valueStr === 'female' || valueStr === 'non_binary' || valueStr === 'other') return true;
      // Check for gender option codes
      if (valueStr === '1' || valueStr === '2' || valueStr === '3') return true;
      // Check for translation format (e.g., "Male_{পুরুষ}")
      if (valueStr.includes('_{')) return true;
      // Check if it starts with gender keywords
      if (valueStr.startsWith('male') || valueStr.startsWith('female')) return true;
      return false;
    };

    // Find gender response FIRST to exclude it from name search
    const genderResponse = findGenderResponse(responses, survey) || responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('gender') || 
      getMainText(r.questionText || '').toLowerCase().includes('sex') ||
      getMainText(r.questionText || '').toLowerCase().includes('respondent\'s gender')
    );
    
    // Get gender identifiers to exclude from name search
    const genderQuestionId = genderResponse?.questionId;
    const genderResponseId = genderResponse?._id || genderResponse?.id;
    const genderIdentifiers = new Set();
    if (genderQuestionId) genderIdentifiers.add(genderQuestionId);
    if (genderResponseId) {
      genderIdentifiers.add(String(genderResponseId));
      if (genderResponse._id) genderIdentifiers.add(String(genderResponse._id));
      if (genderResponse.id) genderIdentifiers.add(String(genderResponse.id));
    }

    // Special handling for survey "68fd1915d41841da463f0d46"
    let nameResponse = null;
    if (surveyId === '68fd1915d41841da463f0d46') {
      // Strategy 1: Find by fixed questionId (most reliable for this survey)
      // Based on actual data: questionId = "68fd1915d41841da463f0d46_fixed_respondent_name"
      const fixedNameQuestionId = `${surveyId}_fixed_respondent_name`;
      const nameResponseById = responses.find(r => r.questionId === fixedNameQuestionId);
      
      if (nameResponseById) {
        // CRITICAL: Multiple checks to ensure it's not the gender response
        const isGenderById = genderIdentifiers.has(nameResponseById.questionId) ||
                            genderIdentifiers.has(String(nameResponseById._id)) ||
                            genderIdentifiers.has(String(nameResponseById.id));
        const isGenderByValue = isGenderResponseValue(nameResponseById.response);
        const isGenderByText = nameResponseById.questionText && 
                              (getMainText(nameResponseById.questionText).toLowerCase().includes('gender') ||
                               getMainText(nameResponseById.questionText).toLowerCase().includes('respondent\'s gender'));
        
        // Only use if it passes ALL checks
        if (!isGenderById && !isGenderByValue && !isGenderByText) {
          nameResponse = nameResponseById;
        }
      }
      
      // Strategy 2: Find by question text pattern if not found by ID
      if (!nameResponse) {
        const textResponse = findResponseByQuestionText([
          'would you like to share your name',
          'share your name with us',
          'share your name'
        ]);
        if (textResponse) {
          // Verify it's not the gender response
          if (!genderIdentifiers.has(textResponse.questionId) &&
              !genderIdentifiers.has(String(textResponse._id)) &&
              !genderIdentifiers.has(String(textResponse.id)) &&
              !isGenderResponseValue(textResponse.response)) {
            const qText = getMainText(textResponse.questionText || '').toLowerCase();
            if (!qText.includes('gender') && !qText.includes('respondent\'s gender')) {
              nameResponse = textResponse;
            }
          }
        }
      }
    } else {
      // For other surveys, use general name search (excluding gender)
      nameResponse = responses.find(r => {
        // Skip if this is the gender response
        if (genderIdentifiers.has(r.questionId) ||
            genderIdentifiers.has(String(r._id)) ||
            genderIdentifiers.has(String(r.id))) {
          return false;
        }
        // Skip if response value is a gender value
        if (isGenderResponseValue(r.response)) {
          return false;
        }
        // Skip if question text is about gender
        const qText = getMainText(r.questionText || '').toLowerCase();
        if (qText.includes('gender') || qText.includes('sex')) {
          return false;
        }
        // Look for name-related questions
        return qText.includes('name') || 
               (qText.includes('respondent') && !qText.includes('gender'));
      });
    }
    
    // Get gender question from survey to format the response correctly
    let genderQuestion = null;
    if (genderResponse && survey) {
      const actualSurvey = survey.survey || survey;
      genderQuestion = findQuestionByText(genderResponse.questionText, actualSurvey);
    }
    
    // Format gender response using formatResponseDisplay (removes translation part)
    let genderDisplay = 'N/A';
    if (genderResponse?.response) {
      const genderValue = extractValue(genderResponse.response);
      if (genderValue) {
        genderDisplay = formatResponseDisplay(genderValue, genderQuestion);
      }
    }
    
    const ageResponse = responses.find(r => 
      r.questionText?.toLowerCase().includes('age') || 
      r.questionText?.toLowerCase().includes('year')
    );

    const acResponse = responses.find(r => 
      r.questionText?.toLowerCase().includes('assembly') ||
      r.questionText?.toLowerCase().includes('constituency')
    );

    // Get city from GPS location if available, otherwise from responses
    let city = 'N/A';
    if (responseData?.location?.city) {
      city = responseData.location.city;
    } else {
      const cityResponse = responses.find(r => 
        r.questionText?.toLowerCase().includes('city') || 
        r.questionText?.toLowerCase().includes('location')
      );
      city = extractValue(cityResponse?.response) || 'N/A';
    }

    // Get district from AC using assemblyConstituencies.json
    const acName = extractValue(acResponse?.response) || 'N/A';
    const district = getDistrictFromAC(acName);

    // Get Lok Sabha from AC using assemblyConstituencies.json
    const lokSabha = getLokSabhaFromAC(acName);

    // Get state from GPS location or selectedPollingStation (for CATI responses)
    const state = getStateFromGPS(responseData?.location, responseData?.selectedPollingStation, responseData?.interviewMode);

    // Get name and capitalize it
    // CRITICAL: Ensure nameResponse is not the gender response
    let name = 'N/A';
    if (nameResponse) {
      // Final validation: Ensure it's not the gender response
      if (genderIdentifiers.has(nameResponse.questionId) ||
          genderIdentifiers.has(String(nameResponse._id)) ||
          genderIdentifiers.has(String(nameResponse.id)) ||
          isGenderResponseValue(nameResponse.response)) {
        nameResponse = null; // Clear it
      } else if (nameResponse.questionText) {
        const qText = getMainText(nameResponse.questionText).toLowerCase();
        if (qText.includes('gender') || 
            qText.includes('respondent\'s gender') || 
            qText.includes('note the gender')) {
          nameResponse = null; // Clear it
        }
      }
    }
    
    if (nameResponse?.response) {
      const nameValue = extractValue(nameResponse.response);
      const nameStr = String(nameValue).toLowerCase().trim();
      
      // ABSOLUTE FINAL CHECK: ensure it's not a gender value
      if (!isGenderResponseValue(nameValue) && 
          nameValue && 
          nameValue !== 'N/A' && 
          nameValue !== null &&
          nameValue !== undefined &&
          nameStr !== '' &&
          nameStr.length > 1 &&
          !nameStr.includes('_{') && // Extra check for translation format
          !nameStr.startsWith('male') && // Extra check
          !nameStr.startsWith('female')) { // Extra check
        // Capitalize the name
        name = String(nameValue)
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      } else {
        name = 'N/A'; // If it's a gender value, explicitly set to N/A
      }
    }
    
    return {
      name: name,
      gender: genderDisplay,
      age: extractValue(ageResponse?.response) || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabha,
      state: state
    };
  };

  // Helper function to format response display text (shows only main text, no translation)
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
          const option = surveyQuestion.options.find(opt => 
            opt.value === value || 
            opt.value?.toString() === value?.toString() ||
            opt.code === value ||
            opt.code?.toString() === value?.toString()
          );
          if (option) {
            // Use getLanguageText to get the selected language
            return getLanguageText(option.text || option.value || value, languageIndex);
          }
        }
        // If value has translation format, use getLanguageText
        if (typeof value === 'string') {
          return getLanguageText(value, languageIndex);
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
          // Use getLanguageText to get the selected language
          const labelText = getLanguageText(label, languageIndex);
          return `${response} (${labelText})`;
        }
        return response.toString();
      }
      
      // Map to display text using question options
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => 
          opt.value === response || 
          opt.value?.toString() === response?.toString() ||
          opt.code === response ||
          opt.code?.toString() === response?.toString()
        );
        if (option) {
          // Use getLanguageText to get the selected language
          return getLanguageText(option.text || option.value || response.toString(), languageIndex);
        }
        // If response has translation format, use getLanguageText
        if (typeof response === 'string') {
          return getLanguageText(response, languageIndex);
        }
        return response.toString();
      }
      
      // If response has translation format, use getLanguageText
      if (typeof response === 'string') {
        return getLanguageText(response, languageIndex);
      }
      
      return response.toString();
    }

    return JSON.stringify(response);
  };

  // Helper function to find question by text (same as SurveyApprovals)
  const findQuestionByText = (questionText, survey) => {
    if (!survey || !questionText) return null;
    
    // Search in sections
    if (survey.sections) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.text === questionText || question.questionText === questionText) {
              return question;
            }
          }
        }
      }
    }
    
    // Search in direct questions
    if (survey.questions) {
      for (const question of survey.questions) {
        if (question.text === questionText || question.questionText === questionText) {
          return question;
        }
      }
    }
    
    return null;
  };

  // Helper function to get operator description
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
    if (!survey || !questionId) return null;
    
    // Handle nested survey structure
    const actualSurvey = survey.survey || survey;
    
    // Search in sections
    if (actualSurvey?.sections) {
      for (const section of actualSurvey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.id === questionId) {
              return question;
            }
          }
        }
      }
    }
    
    // Search in direct questions
    if (actualSurvey?.questions) {
      for (const question of actualSurvey.questions) {
        if (question.id === questionId) {
          return question;
        }
      }
    }
    
    return null;
  };

  // Helper function to evaluate if a condition is met
  // This matches the logic from SurveyApprovals.jsx to handle translations correctly
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
    // This matches the logic from SurveyApprovals.jsx
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

  // Helper function to format conditional logic (same as SurveyApprovals)
  const formatConditionalLogic = (conditions, survey) => {
    if (!conditions || conditions.length === 0) return null;
    
    // Handle nested survey structure
    const actualSurvey = survey?.survey || survey;
    
    const formattedConditions = conditions
      .filter(condition => condition.questionId && condition.operator && condition.value !== undefined && condition.value !== '__NOVALUE__')
      .map((condition, index) => {
        const targetQuestion = findQuestionById(condition.questionId, actualSurvey);
        let targetQuestionText = targetQuestion ? (targetQuestion.text || targetQuestion.questionText) : `Question ${condition.questionId}`;
        // Strip translation from question text
        targetQuestionText = getMainText(targetQuestionText);
        
        const operator = getOperatorDescription(condition.operator);
        let value = condition.value;
        
        // If value is an option value, try to find the option text (without translation)
        if (targetQuestion && targetQuestion.options) {
          const matchingOption = targetQuestion.options.find(opt => 
            opt.value === value || 
            opt.value?.toString() === value?.toString() ||
            opt.code === value ||
            opt.code?.toString() === value?.toString()
          );
          if (matchingOption) {
            // Use main text (without translation)
            value = getMainText(matchingOption.text || matchingOption.value || value);
          } else if (typeof value === 'string' && value.includes('_{')) {
            // If value has translation format, extract main text
            value = value.split('_{')[0];
          }
        } else if (typeof value === 'string' && value.includes('_{')) {
          // If value has translation format, extract main text
          value = value.split('_{')[0];
        }
        
        return `${targetQuestionText} ${operator} "${value}"`;
      });

    if (formattedConditions.length === 0) return null;
    
    return formattedConditions.join(' AND ');
  };

  // Get all questions from survey
  const getAllQuestions = () => {
    const questions = [];
    
    if (!survey) {
      return questions;
    }
    
    // Handle nested survey structure
    const actualSurvey = survey.survey || survey;
    
    if (actualSurvey.sections) {
      actualSurvey.sections.forEach(section => {
        if (section.questions) {
          questions.push(...section.questions);
        }
      });
    }
    
    if (actualSurvey.questions) {
      questions.push(...actualSurvey.questions);
    }
    
    return questions;
  };

  const questions = getAllQuestions();
  const respondentInfo = getRespondentInfo(currentResponse.responses, currentResponse);

  // Handle response rejection
  const handleRejectResponse = async () => {
    if (!rejectReason.trim()) {
      showError('Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await surveyResponseAPI.rejectResponse(currentResponse._id || currentResponse.responseId, {
        reason: rejectReason,
        feedback: rejectReason
      });
      if (result.success) {
        showSuccess('Response rejected successfully');
        setShowRejectForm(false);
        setRejectReason('');
        // Update local state
        setCurrentResponse({ ...currentResponse, status: 'Rejected', verificationData: { ...currentResponse.verificationData, feedback: rejectReason } });
        // Notify parent component if callback provided
        if (onStatusChange) {
          onStatusChange({ ...currentResponse, status: 'Rejected', verificationData: { ...currentResponse.verificationData, feedback: rejectReason } });
        }
      } else {
        throw new Error(result.message || 'Failed to reject response');
      }
    } catch (error) {
      console.error('Error rejecting response:', error);
      showError(error.response?.data?.message || 'Failed to reject response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle response approval
  const handleApproveResponse = async () => {
    setIsSubmitting(true);
    try {
      const result = await surveyResponseAPI.approveResponse(currentResponse._id || currentResponse.responseId);
      if (result.success) {
        showSuccess('Response approved successfully');
        // Update local state
        setCurrentResponse({ ...currentResponse, status: 'Approved' });
        // Notify parent component if callback provided
        if (onStatusChange) {
          onStatusChange({ ...currentResponse, status: 'Approved' });
        }
      } else {
        throw new Error(result.message || 'Failed to approve response');
      }
    } catch (error) {
      console.error('Error approving response:', error);
      showError(error.response?.data?.message || 'Failed to approve response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle setting response to Pending Approval
  const handleSetPendingApproval = async () => {
    if (!window.confirm('Are you sure you want to set this response back to Pending Approval? This will clear the review assignment and allow it to be reviewed again.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await surveyResponseAPI.setPendingApproval(currentResponse._id || currentResponse.responseId);
      if (result.success) {
        showSuccess('Response set to Pending Approval successfully');
        // Update local state
        setCurrentResponse({ ...currentResponse, status: 'Pending_Approval' });
        // Notify parent component if callback provided
        if (onStatusChange) {
          onStatusChange({ ...currentResponse, status: 'Pending_Approval' });
        }
      } else {
        throw new Error(result.message || 'Failed to set response to Pending Approval');
      }
    } catch (error) {
      console.error('Error setting response to Pending Approval:', error);
      showError(error.response?.data?.message || 'Failed to set response to Pending Approval. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Response Details
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Response ID: {currentResponse.responseId || currentResponse._id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Response Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Interviewer</p>
                    <p className="text-sm text-gray-600">
                      {response.interviewer 
                        ? `${response.interviewer.firstName} ${response.interviewer.lastName}${response.interviewer.email ? ` (${response.interviewer.email})` : ''}`
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Date</p>
                    <p className="text-sm text-gray-600">
                      {new Date(response.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Status</p>
                    <p className="text-sm text-gray-600">{currentResponse.status}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Duration</p>
                    <p className="text-sm text-gray-600">
                      {response.totalTimeSpent ? 
                        `${Math.round(response.totalTimeSpent / 60)} minutes` : 
                        'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Review Information - Only show if response has been reviewed */}
            {currentResponse.verificationData?.reviewer && (
              <div className="bg-[#E6F0F8] rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-[#001D48]" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Reviewed By</p>
                      <p className="text-sm text-gray-600">
                        {currentResponse.verificationData.reviewer?.firstName && currentResponse.verificationData.reviewer?.lastName
                          ? `${currentResponse.verificationData.reviewer.firstName} ${currentResponse.verificationData.reviewer.lastName}${currentResponse.verificationData.reviewer?.email ? ` (${currentResponse.verificationData.reviewer.email})` : ''}`
                          : currentResponse.verificationData.reviewer?.email || 'Unknown Reviewer'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-[#001D48]" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Reviewed At</p>
                      <p className="text-sm text-gray-600">
                        {currentResponse.verificationData.reviewedAt
                          ? new Date(currentResponse.verificationData.reviewedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <CheckCircle className={`w-5 h-5 ${
                      currentResponse.status === 'Approved' ? 'text-green-600' : 
                      currentResponse.status === 'Rejected' ? 'text-red-600' : 
                      'text-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Review Decision</p>
                      <p className={`text-sm font-semibold ${
                        currentResponse.status === 'Approved' ? 'text-green-600' : 
                        currentResponse.status === 'Rejected' ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {currentResponse.status === 'Approved' ? 'Approved' : 
                         currentResponse.status === 'Rejected' ? 'Rejected' : 
                         currentResponse.status}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Demographics */}
            <div className="bg-[#E6F0F8] rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Demographics</h3>
              {(() => {
                // Extract AC and polling station from responses
                const { ac: acFromResponse, pollingStation: pollingStationFromResponse, groupName: groupNameFromResponse } = getACAndPollingStationFromResponses(currentResponse.responses, survey);
                const displayAC = acFromResponse || currentResponse.selectedPollingStation?.acName || currentResponse.selectedAC || respondentInfo.ac;
                // Format polling station to show both code and name
                const pollingStationValue = pollingStationFromResponse || currentResponse.selectedPollingStation?.stationName;
                const displayPollingStation = formatPollingStationDisplay(pollingStationValue, currentResponse.selectedPollingStation);
                const displayGroupName = groupNameFromResponse || currentResponse.selectedPollingStation?.groupName;
                const displayPC = currentResponse.selectedPollingStation?.pcName;
                const displayDistrict = currentResponse.selectedPollingStation?.district || respondentInfo.district;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Name</p>
                      <p className="text-sm text-gray-600">{respondentInfo.name}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Gender</p>
                      <p className="text-sm text-gray-600">{respondentInfo.gender}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Age</p>
                      <p className="text-sm text-gray-600">{respondentInfo.age}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">City</p>
                      <p className="text-sm text-gray-600">{respondentInfo.city}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">District</p>
                      <p className="text-sm text-gray-600">{displayDistrict}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">State</p>
                      <p className="text-sm text-gray-600">{respondentInfo.state}</p>
                    </div>
                    
                    {displayAC && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Assembly Constituency (AC)</p>
                        <p className="text-sm text-gray-600">{displayAC}</p>
                      </div>
                    )}
                    
                    {displayPC && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Parliamentary Constituency (PC)</p>
                        <p className="text-sm text-gray-600">{displayPC} {currentResponse.selectedPollingStation?.pcNo ? `(${currentResponse.selectedPollingStation.pcNo})` : ''}</p>
                      </div>
                    )}
                    
                    {displayPollingStation && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Polling Station</p>
                        <p className="text-sm text-gray-600">{displayPollingStation}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Lok Sabha</p>
                      <p className="text-sm text-gray-600">{displayPC || respondentInfo.lokSabha}</p>
                    </div>
                    
                    {currentResponse.location && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <p className="text-sm font-medium text-gray-700">GPS Coordinates</p>
                        <p className="text-sm text-gray-600 font-mono">
                          ({currentResponse.location.latitude?.toFixed(4)}, {currentResponse.location.longitude?.toFixed(4)})
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Call Information - Only for CATI interviews */}
            {currentResponse.interviewMode === 'cati' && catiCallDetails && (
              <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center text-lg">
                  <PhoneCall className="w-5 h-5 mr-2 text-[#001D48]" />
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
            {currentResponse.interviewMode === 'cati' && !catiCallDetails && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
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

            {/* GPS Location Map - Only for CAPI interviews */}
            {currentResponse.location && currentResponse.interviewMode !== 'cati' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Location</h3>
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Address:</strong> {currentResponse.location.address || 'Address not available'}
                  </p>
                  {currentResponse.location.accuracy && (
                    <p className="text-sm text-gray-600">
                      <strong>Accuracy:</strong> ±{Math.round(currentResponse.location.accuracy)} meters
                    </p>
                  )}
                </div>
                <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentResponse.location.longitude-0.01},${currentResponse.location.latitude-0.01},${currentResponse.location.longitude+0.01},${currentResponse.location.latitude+0.01}&layer=mapnik&marker=${currentResponse.location.latitude},${currentResponse.location.longitude}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    title="Interview Location"
                  />
                </div>
                <div className="mt-2 text-center">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${currentResponse.location.latitude}&mlon=${currentResponse.location.longitude}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#001D48] hover:text-blue-800 text-sm underline"
                  >
                    View on OpenStreetMap
                  </a>
                </div>
              </div>
            )}

            {/* Audio Recording / Call Recording */}
            {currentResponse.interviewMode === 'cati' && catiCallDetails?.recordingUrl ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Headphones className="w-5 h-5 mr-2" />
                  Call Recording
                </h3>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Call Duration: {catiCallDetails?.callDuration ? formatDuration(catiCallDetails.callDuration) : 'N/A'}</div>
                    <div>Talk Duration: {catiCallDetails?.talkDuration ? formatDuration(catiCallDetails.talkDuration) : 'N/A'}</div>
                    <div>Format: MP3</div>
                    <div>Status: {catiCallDetails?.callStatusDescription || catiCallDetails?.callStatus || 'N/A'}</div>
                  </div>
                  {catiRecordingBlobUrl ? (
                    <>
                      <audio
                        src={catiRecordingBlobUrl}
                        onEnded={() => setAudioPlaying(false)}
                        onPause={() => setAudioPlaying(false)}
                        onPlay={() => setAudioPlaying(true)}
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
            ) : currentResponse.interviewMode === 'cati' && !catiCallDetails?.recordingUrl ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <PhoneCall className="w-5 h-5 mr-2" />
                  Call Recording
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <Headphones className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No call recording available</p>
                </div>
              </div>
            ) : currentResponse.audioRecording?.audioUrl ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Headphones className="w-5 h-5 mr-2" />
                  Audio Recording (CAPI)
                </h3>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 space-y-1">
                    {currentResponse.audioRecording.recordingDuration && (
                      <div>Duration: {formatDuration(currentResponse.audioRecording.recordingDuration)}</div>
                    )}
                    {currentResponse.audioRecording.format && (
                      <div>Format: {currentResponse.audioRecording.format.toUpperCase()}</div>
                    )}
                    {currentResponse.audioRecording.fileSize && (
                      <div>File Size: {(currentResponse.audioRecording.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                    )}
                  </div>
                    {(audioSignedUrl || currentResponse.audioRecording.signedUrl || currentResponse.audioRecording.audioUrl) && (
                      <audio
                        data-response-id={currentResponse._id || currentResponse.responseId}
                        src={audioSignedUrl || currentResponse.audioRecording.signedUrl || (() => {
                          // Only return valid URLs, not S3 keys or empty strings
                          const audioUrl = currentResponse.audioRecording.audioUrl;
                          if (!audioUrl) return null;
                          // If it's a local path or full URL, return it
                          if (audioUrl.startsWith('/') || audioUrl.startsWith('http')) {
                            return audioUrl;
                          }
                          // If it's an S3 key, return null (will be fetched in useEffect or onError)
                          return null;
                        })()}
                        onEnded={() => setAudioPlaying(false)}
                        onPause={() => setAudioPlaying(false)}
                        onPlay={() => setAudioPlaying(true)}
                        onError={async (e) => {
                          console.error('Audio element error:', e);
                          // If audioUrl is an S3 key, try to get signed URL
                          const audioUrl = currentResponse.audioRecording?.audioUrl;
                          if (audioUrl && (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) && !audioSignedUrl) {
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
                                  setAudioSignedUrl(data.signedUrl);
                                  const audioEl = e.target;
                                  audioEl.src = data.signedUrl;
                                  audioEl.load();
                                  // Try to play again
                                  audioEl.play().catch(playError => {
                                    console.error('Error playing audio after loading signed URL:', playError);
                                  });
                                  return;
                                }
                              }
                            } catch (error) {
                              console.error('Error fetching signed URL:', error);
                            }
                          }
                          showError('Failed to load audio file. The file may have been deleted or moved.');
                          setAudioPlaying(false);
                        }}
                        className="w-full"
                        controls
                      />
                    )}
                  {(currentResponse.audioRecording.audioUrl || audioSignedUrl) && (
                    <a
                      href={audioSignedUrl || currentResponse.audioRecording.signedUrl || (() => {
                        let audioUrl = currentResponse.audioRecording.audioUrl || '';
                        if (audioUrl.startsWith('/')) {
                          return `${window.location.origin}${audioUrl}`;
                        }
                        // If it's an S3 key, use signed URL
                        if (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) {
                          return audioSignedUrl || audioUrl; // Will use signed URL if available
                        }
                        return audioUrl;
                      })()}
                      download={`capi_recording_${currentResponse.responseId || currentResponse._id || 'recording'}.${currentResponse.audioRecording.format || 'webm'}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Recording
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Recording</h3>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <Headphones className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No audio recording available</p>
                </div>
              </div>
            )}

            {/* Survey Responses - Hide for project managers */}
            {!hideSurveyResponses && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Survey Responses</h3>
                {(() => {
                  // Detect available languages from all responses
                  const languageCounts = new Set();
                  if (currentResponse?.responses) {
                    currentResponse.responses.forEach(resp => {
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
                      const actualSurvey = survey?.survey || survey;
                      if (actualSurvey) {
                        const surveyQuestion = findQuestionByText(resp.questionText, actualSurvey);
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
              <div className="space-y-4">
                {(() => {
                  const { regularQuestions } = separateQuestions(currentResponse.responses, survey);
                  return regularQuestions.map((responseItem, index) => {
                    try {
                      // Find the corresponding question in the survey to get conditional logic
                      // The survey object has a nested structure: {survey: {...}}
                      const actualSurvey = survey.survey || survey;
                      const surveyQuestion = findQuestionByText(responseItem.questionText, actualSurvey);
                      const hasConditions = surveyQuestion?.conditions && surveyQuestion.conditions.length > 0;
                      const conditionsMet = hasConditions ? areConditionsMet(surveyQuestion.conditions, currentResponse.responses, actualSurvey) : true;
                      
                      // Get display text for question and description using selected language
                      const questionTextDisplay = getLanguageText(responseItem.questionText || 'Question', selectedLanguageIndex);
                      const questionDescriptionDisplay = responseItem.questionDescription 
                        ? getLanguageText(responseItem.questionDescription, selectedLanguageIndex)
                        : null;
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">
                                Q{index + 1}: {questionTextDisplay}
                              </h4>
                            {questionDescriptionDisplay && (
                              <p className="text-sm text-gray-600 mb-2">
                                {questionDescriptionDisplay}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
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
                            {responseItem.isSkipped ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <SkipForward className="w-3 h-3 mr-1" />
                                Skipped
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Answered
                              </span>
                            )}
                          </div>
                        </div>
                        
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
                                ? `This question appeared because: ${formatConditionalLogic(surveyQuestion.conditions, actualSurvey)}`
                                : `This question was skipped because: ${formatConditionalLogic(surveyQuestion.conditions, actualSurvey)} (condition not met)`
                              }
                            </p>
                          </div>
                        )}
                        
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Answer:</span>{' '}
                            {responseItem.isSkipped ? (
                              <span className="text-yellow-600 italic">Question was skipped</span>
                            ) : (
                              formatResponseDisplay(responseItem.response, surveyQuestion, selectedLanguageIndex)
                            )}
                          </p>
                          {responseItem.responseTime > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Response time: {responseItem.responseTime}s
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error('Error rendering response item:', error, responseItem);
                    const errorQuestionText = getLanguageText(responseItem.questionText || 'Question (Error)', selectedLanguageIndex);
                    return (
                      <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-red-900 mb-1">
                              {errorQuestionText}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Error
                            </span>
                          </div>
                        </div>
                        <div className="bg-red-100 rounded-lg p-3">
                          <p className="text-sm text-red-700">
                            <span className="font-medium">Error:</span> Failed to render this response item
                          </p>
                        </div>
                      </div>
                    );
                  }
                });
                })()}
              </div>
            </div>
            )}

            {/* Response Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Response Status</h3>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      currentResponse.status === 'Approved' 
                        ? 'bg-green-100 text-green-800' 
                        : currentResponse.status === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {currentResponse.status === 'Pending_Approval' ? 'Pending Approval' : currentResponse.status}
                    </span>
                  </div>
                  {/* Rejection Reason */}
                  {currentResponse.status === 'Rejected' && currentResponse.verificationData?.feedback && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {(() => {
                            // Check if it's auto-rejected
                            const isAutoRejected = currentResponse.verificationData.autoRejected === true || 
                                                   (currentResponse.verificationData.autoRejectionReasons && 
                                                    currentResponse.verificationData.autoRejectionReasons.length > 0) ||
                                                   // Check feedback text for known auto-rejection reasons
                                                   (currentResponse.verificationData.feedback && (
                                                     currentResponse.verificationData.feedback.includes('Interview Too Short') ||
                                                     currentResponse.verificationData.feedback.includes('Not Voter') ||
                                                     currentResponse.verificationData.feedback.includes('Not a Registered Voter') ||
                                                     currentResponse.verificationData.feedback.includes('Duplicate Response')
                                                   ));
                            
                            // Only show label if we can determine it's auto-rejected, otherwise don't show label
                            if (isAutoRejected) {
                              return (
                                <>
                                  <div className="text-sm font-medium text-red-900 mb-1">
                                    Auto Rejection Reason
                                  </div>
                                  <div className="text-sm text-red-700 whitespace-pre-wrap">
                                    {currentResponse.verificationData.feedback}
                                  </div>
                                </>
                              );
                            } else if (currentResponse.verificationData.reviewer) {
                              // Has a reviewer, so it's manual rejection
                              return (
                                <>
                                  <div className="text-sm font-medium text-red-900 mb-1">
                                    Rejection Reason
                                  </div>
                                  <div className="text-sm text-red-700 whitespace-pre-wrap">
                                    {currentResponse.verificationData.feedback}
                                  </div>
                                </>
                              );
                            } else {
                              // Can't determine, just show feedback without label
                              return (
                                <div className="text-sm text-red-700 whitespace-pre-wrap">
                                  {currentResponse.verificationData.feedback}
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status Change Buttons - Show for Approved/Rejected/Pending_Approval responses */}
            {!hideActions && !hideStatusChange && (currentResponse.status === 'Approved' || currentResponse.status === 'Rejected' || currentResponse.status === 'Pending_Approval') && (
              <div className="bg-gray-50 border-t border-gray-200 p-4 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Response Status</h3>
                <div className="flex items-center justify-end space-x-3 flex-wrap gap-2">
                  {/* Set to Pending Approval - Show if Approved or Rejected */}
                  {(currentResponse.status === 'Approved' || currentResponse.status === 'Rejected') && (
                    <button
                      onClick={handleSetPendingApproval}
                      disabled={isSubmitting}
                      className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{isSubmitting ? 'Updating...' : 'Set to Pending Approval'}</span>
                    </button>
                  )}
                  
                  {/* Approve - Show if Rejected or Pending_Approval */}
                  {(currentResponse.status === 'Rejected' || currentResponse.status === 'Pending_Approval') && (
                    <button
                      onClick={handleApproveResponse}
                      disabled={isSubmitting}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{isSubmitting ? 'Approving...' : 'Approve Response'}</span>
                    </button>
                  )}
                  
                  {/* Reject - Show if Pending_Approval or Approved */}
                  {(currentResponse.status === 'Pending_Approval' || currentResponse.status === 'Approved') && (
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={isSubmitting}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>Reject Response</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Reject Form */}
            {showRejectForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Reject Response
                    </h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for rejection
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        rows={4}
                        placeholder="Please provide a reason for rejecting this response..."
                      />
                    </div>
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRejectResponse}
                        disabled={isSubmitting || !rejectReason.trim()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Rejecting...' : 'Reject Response'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponseDetailsModal;