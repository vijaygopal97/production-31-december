import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Loader,
  User,
  Phone,
  Mail,
  Power,
  PowerOff,
  Save,
  Lock,
  FileText,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { authAPI, surveyAPI } from '../../services/api';

const EditProjectManagerInterviewer = ({ interviewer, onInterviewerUpdated, onCancel }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    locationControlBooster: false,
    resetPasswordToPhone: false,
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [assignedSurveys, setAssignedSurveys] = useState([]);
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [surveySearchTerm, setSurveySearchTerm] = useState('');
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false);
  const surveyDropdownRef = useRef(null);
  const [selectedSurveyIds, setSelectedSurveyIds] = useState([]);
  const [interviewerType, setInterviewerType] = useState('CATI'); // CAPI, CATI, or Both

  // Initialize form data from interviewer prop
  useEffect(() => {
    if (interviewer) {
      // Handle both direct interviewer object and nested user object
      const interviewerData = interviewer.user || interviewer;
      
      setFormData({
        firstName: interviewerData.firstName || '',
        lastName: interviewerData.lastName || '',
        phone: interviewerData.phone || '',
        email: interviewerData.email || '',
        locationControlBooster: interviewerData.preferences?.locationControlBooster || false,
        resetPasswordToPhone: false,
        password: ''
      });

      // Determine interviewer type
      const modes = interviewerData.interviewModes || '';
      if (modes.includes('CAPI') && modes.includes('CATI')) {
        setInterviewerType('Both');
      } else if (modes.includes('CAPI')) {
        setInterviewerType('CAPI');
      } else {
        setInterviewerType('CATI');
      }
    }
  }, [interviewer]);

  // Load assigned surveys
  useEffect(() => {
    const loadAssignedSurveys = async () => {
      // Handle both direct interviewer object and nested user object
      const interviewerData = interviewer?.user || interviewer;
      const interviewerId = interviewerData?._id;
      
      if (!interviewerId) return;
      
      try {
        setLoadingSurveys(true);
        const response = await authAPI.getInterviewerSurveys(interviewerId);
        if (response.success) {
          setAssignedSurveys(response.data.surveys || []);
          setSelectedSurveyIds(response.data.surveys.map(s => s._id));
        }
      } catch (error) {
        console.error('Error loading assigned surveys:', error);
      } finally {
        setLoadingSurveys(false);
      }
    };

    loadAssignedSurveys();
  }, [interviewer]);

  // Load available surveys
  useEffect(() => {
    const loadAvailableSurveys = async () => {
      try {
        const response = await surveyAPI.getSurveys({
          page: 1,
          limit: 1000,
          status: 'active'
        });

        if (response.success) {
          setAvailableSurveys(response.data.surveys || []);
        }
      } catch (error) {
        console.error('Error loading surveys:', error);
      }
    };

    loadAvailableSurveys();
  }, []);

  // Close survey dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (surveyDropdownRef.current && !surveyDropdownRef.current.contains(event.target)) {
        setShowSurveyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Update password when resetPasswordToPhone changes
    if (name === 'resetPasswordToPhone') {
      setFormData(prev => ({
        ...prev,
        password: checked ? '' : prev.password
      }));
    }
  };

  const handleToggleLocationBooster = () => {
    setFormData(prev => ({
      ...prev,
      locationControlBooster: !prev.locationControlBooster
    }));
  };

  const handleSurveyToggle = (surveyId) => {
    setSelectedSurveyIds(prev => {
      if (prev.includes(surveyId)) {
        return prev.filter(id => id !== surveyId);
      } else {
        return [...prev, surveyId];
      }
    });
  };

  const filteredSurveys = availableSurveys.filter(survey =>
    survey.surveyName?.toLowerCase().includes(surveySearchTerm.toLowerCase()) ||
    survey.description?.toLowerCase().includes(surveySearchTerm.toLowerCase())
  );

  const validateForm = () => {
    const errors = [];

    if (!formData.firstName.trim()) {
      errors.push('First name is required');
    }

    if (!formData.lastName.trim()) {
      errors.push('Last name is required');
    }

    if (!formData.phone.trim()) {
      errors.push('Phone number is required');
    } else {
      const phoneRegex = /^[\+]?[0-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone.replace(/\s+/g, ''))) {
        errors.push('Please enter a valid phone number');
      }
    }

    if (!formData.resetPasswordToPhone && formData.password && formData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        showError('Validation Error', error);
      });
      return;
    }

    setLoading(true);

    try {
      // Normalize phone number
      let normalizedPhone = formData.phone.replace(/^\+91/, '').replace(/^91/, '').trim();

      // Handle both direct interviewer object and nested user object
      const interviewerData = interviewer?.user || interviewer;
      const interviewerId = interviewerData?._id || interviewer?._id;

      // Update basic info and password
      const updateData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: normalizedPhone,
        resetPasswordToPhone: formData.resetPasswordToPhone,
        password: formData.resetPasswordToPhone ? undefined : (formData.password || undefined)
      };

      await authAPI.updateInterviewerByPM(interviewerId, updateData);

      // Update preferences (location booster)
      await authAPI.updateInterviewerPreferencesByPM(interviewerId, {
        locationControlBooster: formData.locationControlBooster
      });

      // Update survey assignments
      const currentSurveyIds = assignedSurveys.map(s => s._id);
      const surveysToAdd = selectedSurveyIds.filter(id => !currentSurveyIds.includes(id));
      const surveysToRemove = currentSurveyIds.filter(id => !selectedSurveyIds.includes(id));

      // Remove from surveys
      for (const surveyId of surveysToRemove) {
        try {
          const survey = await surveyAPI.getSurvey(surveyId);
          if (survey.success && survey.data) {
            const surveyData = survey.data;
            const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
            
            if (isMultiMode) {
              // Remove from appropriate array based on interviewer type for multi-mode surveys
              const capiInterviewerIds = surveyData.capiInterviewers
                ?.filter(a => {
                  const assignmentInterviewerId = a.interviewer?._id || a.interviewer;
                  return assignmentInterviewerId && assignmentInterviewerId.toString() !== interviewerId.toString();
                })
                .map(a => a.interviewer?._id || a.interviewer) || [];
              const catiInterviewerIds = surveyData.catiInterviewers
                ?.filter(a => {
                  const assignmentInterviewerId = a.interviewer?._id || a.interviewer;
                  return assignmentInterviewerId && assignmentInterviewerId.toString() !== interviewerId.toString();
                })
                .map(a => a.interviewer?._id || a.interviewer) || [];

              await surveyAPI.assignInterviewers(surveyId, {
                capiInterviewerIds,
                catiInterviewerIds
              });
            } else {
              // Handle single-mode surveys
              const surveyMode = surveyData.mode || (surveyData.modes && surveyData.modes[0]);
              const isCAPISurvey = surveyMode === 'CAPI' || surveyMode === 'Face To Face';
              const isCATISurvey = surveyMode === 'CATI' || surveyMode === 'Telephonic';
              
              if (isCAPISurvey && (interviewerType === 'CAPI' || interviewerType === 'Both')) {
                // Remove from CAPI interviewers
                const capiInterviewerIds = surveyData.capiInterviewers
                  ?.filter(a => {
                    const assignmentInterviewerId = a.interviewer?._id || a.interviewer;
                    return assignmentInterviewerId && assignmentInterviewerId.toString() !== interviewerId.toString();
                  })
                  .map(a => a.interviewer?._id || a.interviewer) || [];
                
                await surveyAPI.assignInterviewers(surveyId, {
                  capiInterviewerIds,
                  catiInterviewerIds: surveyData.catiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || []
                });
              } else if (isCATISurvey && (interviewerType === 'CATI' || interviewerType === 'Both')) {
                // Remove from CATI interviewers
                const catiInterviewerIds = surveyData.catiInterviewers
                  ?.filter(a => {
                    const assignmentInterviewerId = a.interviewer?._id || a.interviewer;
                    return assignmentInterviewerId && assignmentInterviewerId.toString() !== interviewerId.toString();
                  })
                  .map(a => a.interviewer?._id || a.interviewer) || [];
                
                await surveyAPI.assignInterviewers(surveyId, {
                  capiInterviewerIds: surveyData.capiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [],
                  catiInterviewerIds
                });
              } else {
                // For single-mode surveys using assignedInterviewers (legacy)
                const interviewerIds = surveyData.assignedInterviewers
                  ?.filter(a => {
                    const assignmentInterviewerId = a.interviewer?._id || a.interviewer;
                    return assignmentInterviewerId && assignmentInterviewerId.toString() !== interviewerId.toString();
                  })
                  .map(a => a.interviewer?._id || a.interviewer) || [];
                
                await surveyAPI.assignInterviewers(surveyId, {
                  interviewerIds
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error removing from survey ${surveyId}:`, error);
        }
      }

      // Add to surveys
      for (const surveyId of surveysToAdd) {
        try {
          const survey = await surveyAPI.getSurvey(surveyId);
          if (survey.success && survey.data) {
            const surveyData = survey.data;
            const isMultiMode = surveyData.mode === 'multi_mode' || (surveyData.modes && surveyData.modes.length > 1);
            
            if (isMultiMode) {
              // Add to appropriate array based on interviewer type for multi-mode surveys
              const existingCAPI = surveyData.capiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [];
              const existingCATI = surveyData.catiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [];

              const capiInterviewerIds = [...existingCAPI];
              const catiInterviewerIds = [...existingCATI];

              if (interviewerType === 'CAPI' || interviewerType === 'Both') {
                if (!capiInterviewerIds.some(id => id.toString() === interviewerId.toString())) {
                  capiInterviewerIds.push(interviewerId);
                }
              }
              if (interviewerType === 'CATI' || interviewerType === 'Both') {
                if (!catiInterviewerIds.some(id => id.toString() === interviewerId.toString())) {
                  catiInterviewerIds.push(interviewerId);
                }
              }

              await surveyAPI.assignInterviewers(surveyId, {
                capiInterviewerIds: interviewerType === 'CAPI' || interviewerType === 'Both' ? capiInterviewerIds : existingCAPI,
                catiInterviewerIds: interviewerType === 'CATI' || interviewerType === 'Both' ? catiInterviewerIds : existingCATI
              });
            } else {
              // Handle single-mode surveys
              const surveyMode = surveyData.mode || (surveyData.modes && surveyData.modes[0]);
              const isCAPISurvey = surveyMode === 'CAPI' || surveyMode === 'Face To Face';
              const isCATISurvey = surveyMode === 'CATI' || surveyMode === 'Telephonic';
              
              if (isCAPISurvey && (interviewerType === 'CAPI' || interviewerType === 'Both')) {
                // Add to CAPI interviewers
                const existingCAPI = surveyData.capiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [];
                const capiInterviewerIds = [...existingCAPI];
                
                if (!capiInterviewerIds.some(id => id.toString() === interviewerId.toString())) {
                  capiInterviewerIds.push(interviewerId);
                }
                
                await surveyAPI.assignInterviewers(surveyId, {
                  capiInterviewerIds,
                  catiInterviewerIds: surveyData.catiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || []
                });
              } else if (isCATISurvey && (interviewerType === 'CATI' || interviewerType === 'Both')) {
                // Add to CATI interviewers
                const existingCATI = surveyData.catiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [];
                const catiInterviewerIds = [...existingCATI];
                
                if (!catiInterviewerIds.some(id => id.toString() === interviewerId.toString())) {
                  catiInterviewerIds.push(interviewerId);
                }
                
                await surveyAPI.assignInterviewers(surveyId, {
                  capiInterviewerIds: surveyData.capiInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [],
                  catiInterviewerIds
                });
              } else {
                // For single-mode surveys using assignedInterviewers (legacy)
                const existingInterviewers = surveyData.assignedInterviewers?.map(a => a.interviewer?._id || a.interviewer) || [];
                const interviewerIds = [...existingInterviewers];
                
                if (!interviewerIds.some(id => id.toString() === interviewerId.toString())) {
                  interviewerIds.push(interviewerId);
                }
                
                await surveyAPI.assignInterviewers(surveyId, {
                  interviewerIds
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error adding to survey ${surveyId}:`, error);
        }
      }

      showSuccess('Interviewer Updated!', 'Interviewer information has been updated successfully.');
      
      if (onInterviewerUpdated) {
        await onInterviewerUpdated();
      }
    } catch (error) {
      console.error('Error updating interviewer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update interviewer. Please try again.';
      showError('Update Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Interviewer</h1>
        <p className="text-gray-600">Update interviewer information and settings</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interviewer Info Display */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[#373177] to-[#373177] rounded-full flex items-center justify-center text-white font-medium">
                {formData.firstName?.charAt(0) || 'I'}{formData.lastName?.charAt(0) || 'U'}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {formData.firstName} {formData.lastName}
                </div>
                {(() => {
                  const interviewerData = interviewer?.user || interviewer;
                  return interviewerData?.memberId && (
                    <div className="text-sm text-gray-500">
                      Interviewer ID: <span className="font-mono">{interviewerData.memberId}</span>
                    </div>
                  );
                })()}
                <div className="text-sm text-gray-500">
                  Type: {interviewerType}
                </div>
              </div>
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                required
                placeholder="Enter phone number"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                style={{ color: '#111827' }}
              />
            </div>
            {formData.phone && (
              <p className="mt-1 text-xs text-gray-500">Current: {formData.phone}</p>
            )}
          </div>

          {/* Email (Read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                readOnly
                disabled
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          {/* Password Reset */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                name="resetPasswordToPhone"
                checked={formData.resetPasswordToPhone}
                onChange={handleChange}
                className="mr-2 rounded border-gray-300 text-[#001D48] focus:ring-[#001D48]"
              />
              <span className="text-sm font-medium text-gray-700">
                Reset Password to Phone Number
              </span>
            </label>
            {!formData.resetPasswordToPhone && (
              <div className="mt-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    minLength={8}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Leave empty to keep current password. Must be at least 8 characters if provided.</p>
              </div>
            )}
          </div>

          {/* Location Booster Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Location Control Booster
            </label>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {formData.locationControlBooster ? 'Location Booster is ON' : 'Location Booster is OFF'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.locationControlBooster 
                      ? 'Interviewer can bypass geofencing restrictions'
                      : 'Interviewer must be within geofencing boundaries'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLocationBooster}
                  className={`ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.locationControlBooster
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {formData.locationControlBooster ? (
                    <>
                      <PowerOff className="w-4 h-4 mr-2" />
                      Turn Off Booster
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 mr-2" />
                      Turn Booster ON
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Assigned Surveys */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned Surveys
              <span className="text-gray-500 text-xs ml-2">Select surveys to assign this interviewer to</span>
            </label>
            <div className="relative" ref={surveyDropdownRef}>
              <div
                onClick={() => setShowSurveyDropdown(!showSurveyDropdown)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {selectedSurveyIds.length > 0 
                    ? `${selectedSurveyIds.length} survey(s) selected`
                    : 'Select surveys...'}
                </span>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              
              {showSurveyDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {loadingSurveys ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading surveys...
                    </div>
                  ) : (
                    <>
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search surveys..."
                          value={surveySearchTerm}
                          onChange={(e) => setSurveySearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredSurveys.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No active surveys found
                        </div>
                      ) : (
                        filteredSurveys.map(survey => {
                          const isSelected = selectedSurveyIds.includes(survey._id);
                          return (
                            <div
                              key={survey._id}
                              onClick={() => handleSurveyToggle(survey._id)}
                              className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                                isSelected ? 'bg-[#E6F0F8]' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{survey.surveyName}</div>
                                  {survey.description && (
                                    <div className="text-xs text-gray-500 mt-1 truncate">
                                      {survey.description}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <CheckCircle className="w-5 h-5 text-[#373177]" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            {selectedSurveyIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSurveyIds.map(surveyId => {
                  const survey = availableSurveys.find(s => s._id === surveyId);
                  if (!survey) return null;
                  return (
                    <span
                      key={surveyId}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]"
                    >
                      {survey.surveyName}
                      <button
                        type="button"
                        onClick={() => handleSurveyToggle(surveyId)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#001D48] text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectManagerInterviewer;
