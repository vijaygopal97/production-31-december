import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Loader,
  User,
  Phone,
  Lock,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from 'lucide-react';
import { authAPI, surveyAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const AddProjectManagerInterviewer = ({ onInterviewerCreated }) => {
  const { showSuccess, showError } = useToast();
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    interviewerType: 'CATI', // 'CAPI' or 'CATI'
    interviewerId: '', // Optional - can be left empty for auto-generation
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    usePhoneAsPassword: false,
    surveyIds: [] // Multi-select surveys
  });

  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null
  });

  const [showPassword, setShowPassword] = useState(false);
  const [memberIdChecking, setMemberIdChecking] = useState(false);
  const [memberIdAvailable, setMemberIdAvailable] = useState(null); // null = not checked, true = available, false = taken
  const [memberIdCheckMessage, setMemberIdCheckMessage] = useState('');
  const memberIdCheckTimeoutRef = useRef(null);

  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [surveySearchTerm, setSurveySearchTerm] = useState('');
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false);
  const surveyDropdownRef = useRef(null);

  // Load active surveys
  useEffect(() => {
    const loadSurveys = async () => {
      try {
        setLoadingSurveys(true);
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
        showError('Failed to load surveys');
      } finally {
        setLoadingSurveys(false);
      }
    };

    loadSurveys();
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

  // Check member ID availability in real-time
  useEffect(() => {
    // Clear previous timeout
    if (memberIdCheckTimeoutRef.current) {
      clearTimeout(memberIdCheckTimeoutRef.current);
    }

    // Reset state if interviewer ID is empty
    if (!formData.interviewerId || formData.interviewerId.trim() === '') {
      setMemberIdAvailable(null);
      setMemberIdCheckMessage('');
      return;
    }

    // Validate format first
    let isValidFormat = false;
    let formattedId = formData.interviewerId.trim();

    if (formData.interviewerType === 'CAPI') {
      // CAPI: Must start with CAPI, then up to 5 digits
      if (formattedId.toUpperCase().startsWith('CAPI')) {
        const numericPart = formattedId.replace(/^CAPI/i, '');
        if (/^\d+$/.test(numericPart) && numericPart.length <= 5) {
          isValidFormat = true;
          formattedId = `CAPI${numericPart}`;
        }
      } else if (/^\d+$/.test(formattedId) && formattedId.length <= 5) {
        // User entered just numbers, add CAPI prefix
        isValidFormat = true;
        formattedId = `CAPI${formattedId}`;
      }
    } else {
      // CATI: Must be numeric, up to 5 digits
      if (/^\d+$/.test(formattedId) && formattedId.length <= 5) {
        isValidFormat = true;
      }
    }

    if (!isValidFormat) {
      setMemberIdAvailable(false);
      setMemberIdCheckMessage(
        formData.interviewerType === 'CAPI' 
          ? 'CAPI ID must be "CAPI" followed by up to 5 digits (e.g., CAPI12345)'
          : 'CATI ID must be numeric, up to 5 digits (e.g., 12345)'
      );
      return;
    }

    // Debounce the API call
    setMemberIdChecking(true);
    memberIdCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await authAPI.checkMemberIdAvailability(formattedId);
        if (response.success) {
          setMemberIdAvailable(response.available);
          if (response.available) {
            setMemberIdCheckMessage('Interviewer ID is available');
          } else {
            setMemberIdCheckMessage(
              `Interviewer ID is already taken by ${response.existingUser?.name || 'another user'}`
            );
          }
        } else {
          setMemberIdAvailable(false);
          setMemberIdCheckMessage('Error checking availability');
        }
      } catch (error) {
        console.error('Error checking member ID:', error);
        setMemberIdAvailable(false);
        setMemberIdCheckMessage('Error checking availability');
      } finally {
        setMemberIdChecking(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (memberIdCheckTimeoutRef.current) {
        clearTimeout(memberIdCheckTimeoutRef.current);
      }
    };
  }, [formData.interviewerId, formData.interviewerType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Reset member ID check when type changes
    if (name === 'interviewerType') {
      setFormData(prev => ({
        ...prev,
        interviewerId: '', // Clear interviewer ID when type changes
        interviewerType: value
      }));
      setMemberIdAvailable(null);
      setMemberIdCheckMessage('');
    }

    // Update password when usePhoneAsPassword changes
    if (name === 'usePhoneAsPassword') {
      setFormData(prev => ({
        ...prev,
        password: checked ? prev.phone : ''
      }));
    }

    // Update password when phone changes and usePhoneAsPassword is enabled
    if (name === 'phone' && formData.usePhoneAsPassword) {
      setFormData(prev => ({
        ...prev,
        password: value
      }));
    }
  };

  const handleSurveyToggle = (surveyId) => {
    setFormData(prev => {
      const currentIds = prev.surveyIds || [];
      if (currentIds.includes(surveyId)) {
        return {
          ...prev,
          surveyIds: currentIds.filter(id => id !== surveyId)
        };
      } else {
        return {
          ...prev,
          surveyIds: [...currentIds, surveyId]
        };
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

    if (!formData.usePhoneAsPassword && !formData.password) {
      errors.push('Password is required');
    } else if (!formData.usePhoneAsPassword && formData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Validate interviewer ID if provided
    if (formData.interviewerId && formData.interviewerId.trim() !== '') {
      if (memberIdAvailable === false) {
        errors.push('Interviewer ID is not available');
      }
      if (memberIdAvailable === null && memberIdChecking) {
        errors.push('Please wait while we check Interviewer ID availability');
      }
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

    setFormStatus({ loading: true, success: false, error: null });

    try {
      // Normalize phone number
      let normalizedPhone = formData.phone.replace(/^\+91/, '').replace(/^91/, '').trim();

      // Format interviewer ID if provided
      let formattedInterviewerId = formData.interviewerId.trim();
      if (formattedInterviewerId && formData.interviewerType === 'CAPI') {
        if (!formattedInterviewerId.toUpperCase().startsWith('CAPI')) {
          formattedInterviewerId = `CAPI${formattedInterviewerId.replace(/^CAPI/i, '')}`;
        }
      }

      const interviewerData = {
        interviewerType: formData.interviewerType,
        interviewerId: formattedInterviewerId || undefined, // Send undefined if empty for auto-generation
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: normalizedPhone,
        password: formData.usePhoneAsPassword ? undefined : formData.password,
        usePhoneAsPassword: formData.usePhoneAsPassword,
        surveyIds: formData.surveyIds || []
      };

      const response = await authAPI.addInterviewerByProjectManager(interviewerData);

      if (response.success) {
        setFormStatus({ loading: false, success: true, error: null });
        showSuccess('Interviewer Added!', 'Interviewer has been added to your team successfully.');
        
        // Reset form
        setFormData({
          interviewerType: 'CATI',
          interviewerId: '',
          firstName: '',
          lastName: '',
          phone: '',
          password: '',
          usePhoneAsPassword: false,
          surveyIds: []
        });
        setMemberIdAvailable(null);
        setMemberIdCheckMessage('');

        // Call callback
        if (onInterviewerCreated) {
          onInterviewerCreated();
        }
      } else {
        const errorMessage = response.message || 'Interviewer creation failed';
        setFormStatus({
          loading: false,
          success: false,
          error: errorMessage
        });
        showError('Interviewer Creation Failed', errorMessage);
      }
    } catch (error) {
      console.error('Add interviewer error:', error);
      let errorMessage = 'Interviewer creation failed. Please try again.';

      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
          if (Array.isArray(error.response.data.errors)) {
            errorMessage = error.response.data.errors.map(err => err.message || err).join(', ');
          } else {
            errorMessage = JSON.stringify(error.response.data.errors);
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
      showError('Interviewer Creation Failed', errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Interviewer</h1>
        <p className="text-gray-600">Add a new interviewer to your team</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interviewer Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Interviewer Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleChange({ target: { name: 'interviewerType', value: 'CAPI' } })}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                  formData.interviewerType === 'CAPI'
                    ? 'border-[#001D48] bg-[#E6F0F8] shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-full ${formData.interviewerType === 'CAPI' ? 'bg-[#001D48] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <User className="w-6 h-6" />
                </div>
                <span className="mt-3 text-sm font-semibold text-gray-800">CAPI</span>
                <p className="text-xs text-gray-500 text-center mt-1">Face To Face Interview</p>
              </button>
              <button
                type="button"
                onClick={() => handleChange({ target: { name: 'interviewerType', value: 'CATI' } })}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                  formData.interviewerType === 'CATI'
                    ? 'border-[#001D48] bg-[#E6F0F8] shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-full ${formData.interviewerType === 'CATI' ? 'bg-[#001D48] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Phone className="w-6 h-6" />
                </div>
                <span className="mt-3 text-sm font-semibold text-gray-800">CATI</span>
                <p className="text-xs text-gray-500 text-center mt-1">Telephonic Interview</p>
              </button>
            </div>
          </div>

          {/* Interviewer ID */}
          <div>
            <label htmlFor="interviewerId" className="block text-sm font-medium text-gray-700 mb-2">
              Interviewer ID (Optional)
              <span className="text-gray-500 text-xs ml-2">
                {formData.interviewerType === 'CAPI' 
                  ? 'Format: CAPI + up to 5 digits (e.g., CAPI12345). Leave empty for auto-generation.'
                  : 'Format: Up to 5 digits (e.g., 12345). Leave empty for auto-generation.'}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="interviewerId"
                name="interviewerId"
                value={formData.interviewerId}
                onChange={handleChange}
                placeholder={formData.interviewerType === 'CAPI' ? 'CAPI12345' : '12345'}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  memberIdAvailable === false ? 'border-red-300' : 
                  memberIdAvailable === true ? 'border-green-300' : 
                  'border-gray-300'
                }`}
                maxLength={formData.interviewerType === 'CAPI' ? 10 : 5}
              />
              {formData.interviewerId && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {memberIdChecking ? (
                    <Loader className="w-5 h-5 animate-spin text-gray-400" />
                  ) : memberIdAvailable === true ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : memberIdAvailable === false ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              )}
            </div>
            {memberIdCheckMessage && (
              <p className={`mt-1 text-xs ${
                memberIdAvailable === true ? 'text-green-600' : 
                memberIdAvailable === false ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {memberIdCheckMessage}
              </p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="10-digit phone number"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                name="usePhoneAsPassword"
                checked={formData.usePhoneAsPassword}
                onChange={handleChange}
                className="mr-2 rounded border-gray-300 text-[#001D48] focus:ring-[#001D48]"
              />
              <span className="text-sm font-medium text-gray-700">
                Use phone number as password
              </span>
            </label>
            {!formData.usePhoneAsPassword && (
              <div className="mt-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <X className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters long</p>
              </div>
            )}
          </div>

          {/* Survey Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Surveys (Optional)
              <span className="text-gray-500 text-xs ml-2">Select surveys to assign this interviewer to</span>
            </label>
            <div className="relative" ref={surveyDropdownRef}>
              <div
                onClick={() => setShowSurveyDropdown(!showSurveyDropdown)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {formData.surveyIds.length > 0 
                    ? `${formData.surveyIds.length} survey(s) selected`
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
                          const isSelected = formData.surveyIds.includes(survey._id);
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
            {formData.surveyIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.surveyIds.map(surveyId => {
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
              onClick={() => onInterviewerCreated && onInterviewerCreated()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formStatus.loading || memberIdChecking || memberIdAvailable === false}
              className="px-6 py-2 bg-[#001D48] text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {formStatus.loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Adding Interviewer...
                </>
              ) : (
                'Add Interviewer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectManagerInterviewer;

