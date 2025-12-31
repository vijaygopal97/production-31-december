import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  FileText, 
  Smartphone, 
  CreditCard, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Eye, 
  EyeOff,
  Save,
  Send,
  Loader,
  ChevronDown,
  X,
  XCircle,
  Clock,
  GraduationCap,
  FileImage,
  FileCheck
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { getFileUrl } from '../../utils/config';

const InterviewerProfile = () => {
  const { showSuccess, showError, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [profileData, setProfileData] = useState({
    basicDetails: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    interviewerProfile: {
      age: '',
      gender: '',
      languagesSpoken: [],
      highestDegree: {
        name: '',
        institution: '',
        year: ''
      },
      hasSurveyExperience: null,
      surveyExperienceYears: '',
      surveyExperienceDescription: '',
      cvUpload: '',
      ownsSmartphone: null,
      smartphoneType: '',
      androidVersion: '',
      iosVersion: '',
      willingToTravel: null,
      hasVehicle: null,
      willingToRecordAudio: null,
      agreesToRemuneration: null,
      bankAccountNumber: '',
      bankAccountHolderName: '',
      bankName: '',
      bankIfscCode: '',
      bankDocumentUpload: '',
      aadhaarNumber: '',
      aadhaarDocument: '',
      panNumber: '',
      panDocument: '',
      passportPhoto: '',
      agreesToShareInfo: null,
      agreesToParticipateInSurvey: null,
      approvalStatus: 'pending',
      approvalFeedback: '',
      lastSubmittedAt: null
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [languages, setLanguages] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [languageSearchTerm, setLanguageSearchTerm] = useState('');
  const languageDropdownRef = useRef(null);
  const [showCvPreview, setShowCvPreview] = useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = useState('');
  const [showBankDocPreview, setShowBankDocPreview] = useState(false);
  const [bankDocPreviewUrl, setBankDocPreviewUrl] = useState('');
  const [showPanPreview, setShowPanPreview] = useState(false);
  const [panPreviewUrl, setPanPreviewUrl] = useState('');
  const [showAadhaarPreview, setShowAadhaarPreview] = useState(false);
  const [aadhaarPreviewUrl, setAadhaarPreviewUrl] = useState('');
  const [showPassportPreview, setShowPassportPreview] = useState(false);
  const [passportPreviewUrl, setPassportPreviewUrl] = useState('');
  
  // Approval workflow state
  const [verificationChanged, setVerificationChanged] = useState(false);
  const [originalVerificationData, setOriginalVerificationData] = useState(null);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      fetchProfileData();
      fetchLanguages();
    }
  }, [isInitialized]);

  // Validation function to check if all required fields and documents are complete
  const isProfileComplete = () => {
    const profile = profileData.interviewerProfile;
    
    // Check basic required fields (including CV upload and experience)
    const basicFieldsComplete = 
      profile.age && 
      profile.gender && 
      profile.languagesSpoken && profile.languagesSpoken.length > 0 &&
      profile.highestDegree?.name &&
      profile.highestDegree?.institution &&
      profile.highestDegree?.year &&
      profile.hasSurveyExperience !== null && // Experience question must be answered
      (profile.hasSurveyExperience === false || // If no experience, that's fine
       (profile.hasSurveyExperience === true && // If yes, then years and description are required
        profile.surveyExperienceYears > 0 &&
        profile.surveyExperienceDescription && profile.surveyExperienceDescription.trim() !== '')) &&
      profile.cvUpload;

    // Check survey requirements
    const surveyRequirementsComplete = 
      profile.ownsSmartphone !== undefined &&
      (profile.ownsSmartphone ? profile.smartphoneType : true) &&
      (profile.smartphoneType === 'Android Only' ? profile.androidVersion : true) &&
      (profile.smartphoneType === 'IOS Only' ? profile.iosVersion : true) &&
      (profile.smartphoneType === 'Both' ? (profile.androidVersion && profile.iosVersion) : true) &&
      profile.willingToTravel !== undefined &&
      profile.hasVehicle !== undefined &&
      profile.willingToRecordAudio !== undefined &&
      profile.agreesToRemuneration !== undefined;

    // Check payment details
    const paymentDetailsComplete = 
      profile.bankAccountNumber &&
      profile.bankAccountHolderName &&
      profile.bankName &&
      profile.bankIfscCode &&
      profile.bankDocumentUpload;

    // Check verification documents
    const verificationComplete = 
      profile.aadhaarNumber &&
      profile.aadhaarDocument &&
      profile.panNumber &&
      profile.panDocument &&
      profile.passportPhoto;

    // Check agreements
    const agreementsComplete = 
      profile.agreesToShareInfo === true &&
      profile.agreesToParticipateInSurvey === true;

    return basicFieldsComplete && surveyRequirementsComplete && paymentDetailsComplete && verificationComplete && agreementsComplete;
  };

  // Check if verification tab has been modified
  const hasVerificationChanged = () => {
    if (!originalVerificationData) return false;
    
    const current = profileData.interviewerProfile;
    const original = originalVerificationData;
    
    return (
      current.aadhaarNumber !== original.aadhaarNumber ||
      current.aadhaarDocument !== original.aadhaarDocument ||
      current.panNumber !== original.panNumber ||
      current.panDocument !== original.panDocument ||
      current.passportPhoto !== original.passportPhoto
    );
  };

  // Check if submit button should be shown
  const shouldShowSubmitButton = () => {
    const status = profileData.interviewerProfile.approvalStatus;
    
    // Don't show if profile is already in review (pending) to prevent multiple requests
    if (status === 'pending') return false;
    
    // Show if profile is not complete (first time submission)
    if (!isProfileComplete()) return true;
    
    // Show if status is rejected or changes_requested
    if (['rejected', 'changes_requested'].includes(status)) return true;
    
    // Show if status is unverified (after verification changes are saved)
    if (status === 'unverified') return true;
    
    // Don't show if approved (even if verification has been changed but not saved yet)
    return false;
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting to fetch profile data...');
      
      // Get the basic user information from the current user context
      // Since we're in a dashboard, the user should be available from localStorage or context
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No authentication token found');
        return;
      }
      console.log('✅ Token found:', token.substring(0, 20) + '...');

      // Get user data from the existing auth API
      console.log('📡 Calling authAPI.getMe()...');
      const userResponse = await authAPI.getMe();
      console.log('📡 Raw user response:', userResponse);
      
      // Extract user data from the response structure
      const user = userResponse.data || userResponse.user || userResponse;
      console.log('👤 Processed user data:', user);
      
      // Now get the interviewer profile data
      let interviewerProfile = {};
      try {
        console.log('📡 Calling authAPI.getInterviewerProfile()...');
        const profileResponse = await authAPI.getInterviewerProfile();
        console.log('📡 Profile response:', profileResponse);
        interviewerProfile = profileResponse.data?.interviewerProfile || {};
      } catch (error) {
        console.log('⚠️ No interviewer profile found yet:', error.message);
      }
      
      // Set the profile data with existing user information
      const basicDetails = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      };
      
      console.log('📝 Setting basic details:', basicDetails);
      console.log('📝 Setting interviewer profile:', interviewerProfile);
      console.log('📝 Experience fields from backend:', {
        hasSurveyExperience: interviewerProfile.hasSurveyExperience,
        surveyExperienceYears: interviewerProfile.surveyExperienceYears,
        surveyExperienceDescription: interviewerProfile.surveyExperienceDescription
      });
      
      setProfileData(prevData => {
        const newData = {
          ...prevData,
          basicDetails: basicDetails,
          interviewerProfile: {
            age: interviewerProfile.age || '',
            gender: interviewerProfile.gender || '',
            languagesSpoken: interviewerProfile.languagesSpoken || [],
            highestDegree: {
              name: interviewerProfile.highestDegree?.name || '',
              institution: interviewerProfile.highestDegree?.institution || '',
              year: interviewerProfile.highestDegree?.year || ''
            },
            hasSurveyExperience: interviewerProfile.hasSurveyExperience ?? null,
            surveyExperienceYears: interviewerProfile.surveyExperienceYears || '',
            surveyExperienceDescription: interviewerProfile.surveyExperienceDescription || '',
            cvUpload: interviewerProfile.cvUpload || '',
            ownsSmartphone: interviewerProfile.ownsSmartphone ?? null,
            smartphoneType: interviewerProfile.smartphoneType || '',
            androidVersion: interviewerProfile.androidVersion || '',
            iosVersion: interviewerProfile.iosVersion || '',
            willingToTravel: interviewerProfile.willingToTravel ?? null,
            hasVehicle: interviewerProfile.hasVehicle ?? null,
            willingToRecordAudio: interviewerProfile.willingToRecordAudio ?? null,
            agreesToRemuneration: interviewerProfile.agreesToRemuneration ?? null,
            bankAccountNumber: interviewerProfile.bankAccountNumber || '',
            bankAccountHolderName: interviewerProfile.bankAccountHolderName || '',
            bankName: interviewerProfile.bankName || '',
            bankIfscCode: interviewerProfile.bankIfscCode || '',
            bankDocumentUpload: interviewerProfile.bankDocumentUpload || '',
            aadhaarNumber: interviewerProfile.aadhaarNumber || '',
            aadhaarDocument: interviewerProfile.aadhaarDocument || '',
            panNumber: interviewerProfile.panNumber || '',
            panDocument: interviewerProfile.panDocument || '',
            passportPhoto: interviewerProfile.passportPhoto || '',
            agreesToShareInfo: interviewerProfile.agreesToShareInfo ?? null,
            agreesToParticipateInSurvey: interviewerProfile.agreesToParticipateInSurvey ?? null,
            approvalStatus: interviewerProfile.approvalStatus || 'pending',
            approvalFeedback: interviewerProfile.approvalFeedback || '',
            lastSubmittedAt: interviewerProfile.lastSubmittedAt || null
          }
        };
        console.log('📝 Updated profile data:', newData);
        return newData;
      });
      
      setSelectedLanguages(interviewerProfile.languagesSpoken || []);
      
      // Store original verification data for change detection
      const verificationData = {
        aadhaarNumber: interviewerProfile.aadhaarNumber || '',
        aadhaarDocument: interviewerProfile.aadhaarDocument || '',
        panNumber: interviewerProfile.panNumber || '',
        panDocument: interviewerProfile.panDocument || '',
        passportPhoto: interviewerProfile.passportPhoto || ''
      };
      setOriginalVerificationData(verificationData);
      
      console.log('✅ Profile data fetch completed successfully');
      
    } catch (error) {
      console.error('❌ Error fetching profile data:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      // Show user-friendly error message
      showError('Profile Load Error', 'Failed to load profile data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLanguages = async () => {
    try {
      // Comprehensive list of Indian languages including regional and tribal languages
      const indianLanguages = [
        // Official Languages of India (22 Scheduled Languages)
        'Hindi', 'English', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Gujarati',
        'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Maithili',
        'Santali', 'Nepali', 'Konkani', 'Manipuri', 'Bodo', 'Sanskrit', 'Kashmiri',
        'Sindhi', 'Dogri',
        
        // Major Regional Languages
        'Bhojpuri', 'Rajasthani', 'Chhattisgarhi', 'Haryanvi', 'Magahi', 'Awadhi',
        'Garhwali', 'Kumaoni', 'Tulu', 'Kodava', 'Coorgi', 'Kokborok', 'Mizo',
        'Khasi', 'Garo', 'Jaintia', 'Ladakhi', 'Balti', 'Shina', 'Burushaski',
        
        // South Indian Languages
        'Badaga', 'Irula', 'Kurumba', 'Toda', 'Kota', 'Gondi', 'Kui', 'Kuvi',
        'Chenchu', 'Koya', 'Yerukala', 'Sugali', 'Lambadi', 'Banjara',
        
        // North Indian Languages
        'Braj', 'Bundeli', 'Bagheli', 'Jaunsari', 'Kangri', 'Pahari', 'Himachali',
        'Kutchi', 'Khandeshi', 'Ahirani', 'Varhadi', 'Dangi', 'Malvi', 'Nimadi',
        
        // East Indian Languages
        'Mundari', 'Ho', 'Kurukh', 'Sora', 'Gutob', 'Remo', 'Bonda', 'Gadaba',
        'Korku', 'Bhil', 'Bareli', 'Pardhi', 'Warli',
        
        // Northeast Indian Languages
        'Lepcha', 'Limbu', 'Rai', 'Tamang', 'Gurung', 'Magar', 'Newari', 'Tharu',
        'Naga', 'Ao', 'Angami', 'Chakhesang', 'Chang', 'Konyak', 'Lotha', 'Phom',
        'Pochury', 'Rengma', 'Sangtam', 'Sema', 'Yimchunger', 'Zeme',
        
        // Tribal and Indigenous Languages
        'Bhil', 'Gondi', 'Korku', 'Warli', 'Bareli', 'Pardhi', 'Banjara',
        'Lambadi', 'Sugali', 'Yerukala', 'Chenchu', 'Koya', 'Savara', 'Gadaba',
        'Bonda', 'Remo', 'Gutob', 'Sora', 'Kurukh', 'Ho', 'Mundari',
        
        // Other Important Languages
        'Tibetan', 'Sherpa', 'Lepcha', 'Limbu', 'Rai', 'Tamang', 'Gurung',
        'Magar', 'Newari', 'Tharu', 'Kurumba', 'Irula', 'Toda', 'Kota',
        
        // Foreign Languages (commonly spoken in India)
        'Arabic', 'Persian', 'French', 'Portuguese', 'Dutch', 'Chinese',
        'Japanese', 'Korean', 'Russian', 'German', 'Spanish', 'Italian'
      ];
      
      // Remove duplicates and sort alphabetically
      const uniqueLanguages = [...new Set(indianLanguages)].sort();
      setLanguages(uniqueLanguages);
    } catch (error) {
      console.error('Error fetching languages:', error);
      // Fallback to a basic list if there's an error
      const fallbackLanguages = [
        'Hindi', 'English', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Gujarati',
        'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Maithili',
        'Santali', 'Nepali', 'Konkani', 'Manipuri', 'Bodo', 'Sanskrit', 'Kashmiri',
        'Sindhi', 'Dogri', 'Bhojpuri', 'Rajasthani', 'Chhattisgarhi', 'Haryanvi',
        'Magahi', 'Awadhi', 'Garhwali', 'Kumaoni', 'Tulu', 'Kodava', 'Coorgi'
      ];
      setLanguages(fallbackLanguages);
    }
  };

  const handleInputChange = (section, field, value) => {
    setProfileData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNestedInputChange = (section, parentField, field, value) => {
    setProfileData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [field]: value
        }
      }
    }));
  };


  const handleFileUpload = async (field, file) => {
    try {
      console.log('🔄 Starting file upload for field:', field);
      console.log('📝 Current form data before upload:', profileData.interviewerProfile);
      
      const formData = new FormData();
      formData.append(field, file);
      
      const response = await authAPI.uploadDocuments(formData);
      console.log('📡 Upload response:', response);
      
      // Only update the specific field that was uploaded
      handleInputChange('interviewerProfile', field, response.data[field]);
      
      // Update the original verification data to reflect the new file
      if (['aadhaarDocument', 'panDocument', 'passportPhoto'].includes(field)) {
        setOriginalVerificationData(prev => ({
          ...prev,
          [field]: response.data[field]
        }));
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update basic details using the existing auth API
      if (profileData.basicDetails.firstName || profileData.basicDetails.lastName || 
          profileData.basicDetails.email || profileData.basicDetails.phone) {
        try {
          await authAPI.updateProfile({
            firstName: profileData.basicDetails.firstName,
            lastName: profileData.basicDetails.lastName,
            email: profileData.basicDetails.email,
            phone: profileData.basicDetails.phone
          });
        } catch (error) {
          console.error('Error updating basic profile:', error);
          // Continue with interviewer profile update even if basic profile update fails
        }
      }
      
      // Update interviewer profile data - only send fields with actual values
      const updatedData = {
        ...profileData.interviewerProfile,
        languagesSpoken: selectedLanguages
      };
      
      // Filter out empty strings, null, and undefined values
      const filteredData = Object.keys(updatedData).reduce((acc, key) => {
        const value = updatedData[key];
        
        // Special handling for experience fields - always include them if they exist
        if (['hasSurveyExperience', 'surveyExperienceYears', 'surveyExperienceDescription'].includes(key)) {
          if (value !== null && value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }
        
        // Only include fields that have valid values
        if (value !== '' && value !== null && value !== undefined) {
          // Handle boolean fields (they can be false, which is a valid value)
          if (typeof value === 'boolean') {
            acc[key] = value;
          }
          // Handle number fields (they can be 0, which is a valid value)
          else if (typeof value === 'number') {
            acc[key] = value;
          }
          // Handle string fields (must not be empty)
          else if (typeof value === 'string' && value.trim() !== '') {
            acc[key] = value;
          }
          // Handle array fields (must not be empty)
          else if (Array.isArray(value) && value.length > 0) {
            acc[key] = value;
          }
          // Handle object fields (must have content)
          else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const hasContent = Object.values(value).some(v => 
              v !== '' && v !== null && v !== undefined && 
              (typeof v !== 'string' || v.trim() !== '')
            );
            if (hasContent) {
              acc[key] = value;
            }
          }
        }
        return acc;
      }, {});
      
      console.log('🔍 Frontend sending data to backend:', filteredData);
      console.log('🔍 Verification fields being sent:', {
        aadhaarNumber: filteredData.aadhaarNumber,
        aadhaarDocument: filteredData.aadhaarDocument,
        panNumber: filteredData.panNumber,
        panDocument: filteredData.panDocument,
        passportPhoto: filteredData.passportPhoto
      });
      
      const response = await authAPI.updateInterviewerProfile(filteredData);
      console.log('✅ Backend response:', response);
      
      // Show success message
      showSuccess('Profile Updated', 'Profile information updated successfully!');
      
      // Refresh the data to show updated values
      fetchProfileData();
      
    } catch (error) {
      console.error('Error saving profile:', error);
      
      // Check for specific validation errors
      if (error.response?.status === 500) {
        const errorMessage = error.response?.data?.message || 'Server validation error';
        if (errorMessage.includes('age') && errorMessage.includes('minimum')) {
          showError('Age Validation Error', 'Age must be at least 18 years old. Please check your age and try again.');
        } else if (errorMessage.includes('validation')) {
          showError('Validation Error', 'Please check all required fields and ensure they meet the requirements.');
        } else {
          showError('Server Error', 'An error occurred while saving. Please try again.');
        }
      } else {
        showError('Save Error', 'Error saving profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      setSubmitting(true);
      
      // First save the current profile data - only send fields with actual values
      const updatedData = {
        ...profileData.interviewerProfile,
        languagesSpoken: selectedLanguages
      };
      
      // Filter out empty strings, null, and undefined values
      const filteredData = Object.keys(updatedData).reduce((acc, key) => {
        const value = updatedData[key];
        
        // Special handling for experience fields - always include them if they exist
        if (['hasSurveyExperience', 'surveyExperienceYears', 'surveyExperienceDescription'].includes(key)) {
          if (value !== null && value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }
        
        // Only include fields that have valid values
        if (value !== '' && value !== null && value !== undefined) {
          // Handle boolean fields (they can be false, which is a valid value)
          if (typeof value === 'boolean') {
            acc[key] = value;
          }
          // Handle number fields (they can be 0, which is a valid value)
          else if (typeof value === 'number') {
            acc[key] = value;
          }
          // Handle string fields (must not be empty)
          else if (typeof value === 'string' && value.trim() !== '') {
            acc[key] = value;
          }
          // Handle array fields (must not be empty)
          else if (Array.isArray(value) && value.length > 0) {
            acc[key] = value;
          }
          // Handle object fields (must have content)
          else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const hasContent = Object.values(value).some(v => 
              v !== '' && v !== null && v !== undefined && 
              (typeof v !== 'string' || v.trim() !== '')
            );
            if (hasContent) {
              acc[key] = value;
            }
          }
        }
        return acc;
      }, {});
      
      console.log('🔍 Frontend sending data to backend:', filteredData);
      console.log('🔍 Verification fields being sent:', {
        aadhaarNumber: filteredData.aadhaarNumber,
        aadhaarDocument: filteredData.aadhaarDocument,
        panNumber: filteredData.panNumber,
        panDocument: filteredData.panDocument,
        passportPhoto: filteredData.passportPhoto
      });
      
      await authAPI.updateInterviewerProfile(filteredData);
      
      // Then submit for approval
      await authAPI.submitProfileForApproval();
      
      // If verification was changed, update the original data
      if (hasVerificationChanged()) {
        const newVerificationData = {
          aadhaarNumber: profileData.interviewerProfile.aadhaarNumber,
          aadhaarDocument: profileData.interviewerProfile.aadhaarDocument,
          panNumber: profileData.interviewerProfile.panNumber,
          panDocument: profileData.interviewerProfile.panDocument,
          passportPhoto: profileData.interviewerProfile.passportPhoto
        };
        setOriginalVerificationData(newVerificationData);
        setVerificationChanged(false);
      }
      
      // Show success message and refresh data
      showSuccess('Profile Submitted', 'Profile submitted for approval successfully!');
      fetchProfileData();
    } catch (error) {
      console.error('Error submitting profile:', error);
      showError('Submission Error', 'Error submitting profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showError('Password Mismatch', 'New password and confirm password do not match!');
        return;
      }
      if (passwordData.newPassword.length < 8) {
        showError('Password Too Short', 'New password must be at least 8 characters long!');
        return;
      }
      await authAPI.changePassword(passwordData);
      // Show success message and reset form
      showSuccess('Password Changed', 'Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      showError('Password Change Error', 'Error changing password. Please try again.');
    }
  };

  // Language dropdown functions
  const toggleLanguageDropdown = () => {
    setIsLanguageDropdownOpen(!isLanguageDropdownOpen);
    setLanguageSearchTerm('');
  };

  const handleLanguageSelect = (language) => {
    if (!selectedLanguages.includes(language)) {
      setSelectedLanguages([...selectedLanguages, language]);
    }
    setLanguageSearchTerm('');
    setIsLanguageDropdownOpen(false);
  };

  const handleLanguageRemove = (languageToRemove) => {
    setSelectedLanguages(selectedLanguages.filter(lang => lang !== languageToRemove));
  };

  const filteredLanguages = languages.filter(language =>
    language.toLowerCase().includes(languageSearchTerm.toLowerCase()) &&
    !selectedLanguages.includes(language)
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target)) {
        setIsLanguageDropdownOpen(false);
        setLanguageSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // CV Preview functions
  const handleCvPreview = () => {
    if (profileData.interviewerProfile.cvUpload) {
      // Create a full URL for the CV file using environment configuration
      const cvUrl = getFileUrl(profileData.interviewerProfile.cvUpload);
      setCvPreviewUrl(cvUrl);
      setShowCvPreview(true);
    }
  };

  const closeCvPreview = () => {
    setShowCvPreview(false);
    setCvPreviewUrl('');
  };

  // Bank Document Preview functions
  const handleBankDocPreview = () => {
    if (profileData.interviewerProfile.bankDocumentUpload) {
      const bankDocUrl = getFileUrl(profileData.interviewerProfile.bankDocumentUpload);
      setBankDocPreviewUrl(bankDocUrl);
      setShowBankDocPreview(true);
    }
  };

  const closeBankDocPreview = () => {
    setShowBankDocPreview(false);
    setBankDocPreviewUrl('');
  };

  // PAN Document Preview functions
  const handlePanPreview = () => {
    if (profileData.interviewerProfile.panDocument) {
      const panUrl = getFileUrl(profileData.interviewerProfile.panDocument);
      setPanPreviewUrl(panUrl);
      setShowPanPreview(true);
    }
  };

  const closePanPreview = () => {
    setShowPanPreview(false);
    setPanPreviewUrl('');
  };

  // Aadhaar Document Preview functions
  const handleAadhaarPreview = () => {
    if (profileData.interviewerProfile.aadhaarDocument) {
      const aadhaarUrl = getFileUrl(profileData.interviewerProfile.aadhaarDocument);
      setAadhaarPreviewUrl(aadhaarUrl);
      setShowAadhaarPreview(true);
    }
  };

  const closeAadhaarPreview = () => {
    setShowAadhaarPreview(false);
    setAadhaarPreviewUrl('');
  };

  // Passport Photo Preview functions
  const handlePassportPreview = () => {
    if (profileData.interviewerProfile.passportPhoto) {
      const passportUrl = getFileUrl(profileData.interviewerProfile.passportPhoto);
      setPassportPreviewUrl(passportUrl);
      setShowPassportPreview(true);
    }
  };

  const closePassportPreview = () => {
    setShowPassportPreview(false);
    setPassportPreviewUrl('');
  };

  // Format approval status for display
  const getStatusDisplay = (status) => {
    // If profile is not complete, show "Profile Not Completed"
    if (!isProfileComplete()) {
      return 'Profile Not Completed';
    }
    
    // If verification has been changed after approval, show "Unverified"
    if (status === 'approved' && hasVerificationChanged()) {
      return 'Unverified';
    }
    
    switch (status) {
      case 'pending':
        return 'In Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'changes_requested':
        return 'Changes Requested';
      default:
        return 'Unverified';
    }
  };

  // Get status color and icon
  const getStatusStyle = (status) => {
    // If profile is not complete, show "Profile Not Completed" style
    if (!isProfileComplete()) {
      return {
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-400',
        textColor: 'text-gray-800',
        iconColor: 'text-gray-400',
        icon: AlertCircle
      };
    }
    
    // If verification has been changed after approval, show "Unverified" style
    if (status === 'approved' && hasVerificationChanged()) {
      return {
        bgColor: 'bg-[#E6F0F8]',
        borderColor: 'border-blue-400',
        textColor: 'text-[#001D48]',
        iconColor: 'text-blue-400',
        icon: Shield
      };
    }
    
    switch (status) {
      case 'pending':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-400',
          icon: Clock
        };
      case 'approved':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-400',
          textColor: 'text-green-800',
          iconColor: 'text-green-400',
          icon: CheckCircle
        };
      case 'rejected':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-400',
          textColor: 'text-red-800',
          iconColor: 'text-red-400',
          icon: XCircle
        };
      case 'changes_requested':
        return {
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-400',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-400',
          icon: AlertCircle
        };
      default:
        return {
          bgColor: 'bg-[#E6F0F8]',
          borderColor: 'border-blue-400',
          textColor: 'text-[#001D48]',
          iconColor: 'text-blue-400',
          icon: Shield
        };
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Details', icon: User },
    { id: 'personal', label: 'Personal Details', icon: FileText },
    { id: 'survey', label: 'Survey Requirements', icon: Smartphone },
    { id: 'payment', label: 'Payment Details', icon: CreditCard },
    { id: 'verification', label: 'Verification', icon: Shield }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-[#373177]" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">Manage your profile information and documents</p>
      </div>

      {/* Modern Status Card */}
      {(() => {
        const currentStatus = profileData.interviewerProfile.approvalStatus || 'unverified';
        const statusStyle = getStatusStyle(currentStatus);
        const StatusIcon = statusStyle.icon;
        return (
          <div className="mb-8">
            <div className={`relative overflow-hidden rounded-2xl shadow-lg border border-gray-100 ${statusStyle.bgColor}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${statusStyle.bgColor} border border-gray-200 shadow-sm`}>
                      <StatusIcon className={`h-6 w-6 ${statusStyle.iconColor}`} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${statusStyle.textColor}`}>
                        {getStatusDisplay(currentStatus)}
                      </h3>
                      <p className={`text-sm ${statusStyle.textColor} opacity-80`}>
                        Profile verification status
                      </p>
                    </div>
                  </div>
                  {profileData.interviewerProfile.approvalFeedback && (
                    <div className="text-right">
                      <p className={`text-sm font-medium ${statusStyle.textColor}`}>Feedback</p>
                      <p className={`text-sm ${statusStyle.textColor} opacity-80 max-w-xs`}>
                        {profileData.interviewerProfile.approvalFeedback}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

        {/* Modern Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
            <nav className="flex space-x-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-[#373177] to-indigo-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Modern Tab Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {activeTab === 'basic' && (
          <div className="p-8">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-[#E6F0F8] rounded-lg">
                  <User className="h-6 w-6 text-[#373177]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Basic Information</h3>
              </div>
              <p className="text-gray-600 ml-11">Update your personal contact details</p>
            </div>
            
            {/* Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">First Name</label>
                <input
                  type="text"
                  value={profileData.basicDetails.firstName}
                  onChange={(e) => handleInputChange('basicDetails', 'firstName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={profileData.basicDetails.lastName}
                  onChange={(e) => handleInputChange('basicDetails', 'lastName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your last name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={profileData.basicDetails.email}
                  onChange={(e) => handleInputChange('basicDetails', 'email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your email address"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={profileData.basicDetails.phone}
                  onChange={(e) => handleInputChange('basicDetails', 'phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            {/* Password Change Section */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Shield className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Security Settings</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white pr-12"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={handlePasswordChange}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="p-8">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Personal Details</h3>
              </div>
              <p className="text-gray-600 ml-11">Share your personal information and qualifications</p>
            </div>
            
            {/* Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Age</label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profileData.interviewerProfile.age || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'age', e.target.value)}
                  onBlur={(e) => {
                    const age = parseInt(e.target.value);
                    if (e.target.value && age < 18) {
                      showError('Invalid Age', 'Age must be at least 18 years old.');
                    } else if (e.target.value && age > 100) {
                      showError('Invalid Age', 'Age must be less than 100 years old.');
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your age (minimum 18)"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Gender</label>
                <select
                  value={profileData.interviewerProfile.gender || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'gender', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Languages Section */}
            <div className="lg:col-span-2 space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Languages Spoken</label>
              <div className="relative" ref={languageDropdownRef}>
                {/* Selected Languages Tags */}
                <div className="min-h-[52px] p-3 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all duration-200 flex flex-wrap gap-2 items-center cursor-pointer" onClick={toggleLanguageDropdown}>
                  {selectedLanguages.length > 0 ? (
                    selectedLanguages.map((language) => (
                      <span
                        key={language}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gradient-to-r from-[#E6F0F8]0 to-indigo-500 text-white border border-blue-300 shadow-sm"
                      >
                        {language}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLanguageRemove(language);
                          }}
                          className="ml-2 text-white hover:text-blue-100 transition-colors duration-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">Select languages you speak...</span>
                  )}
                  <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
                </div>

                {/* Modern Dropdown */}
                {isLanguageDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder="Search languages..."
                        value={languageSearchTerm}
                        onChange={(e) => setLanguageSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        autoFocus
                      />
                    </div>
                    
                    {/* Language Options */}
                    <div className="py-2">
                      {filteredLanguages.length > 0 ? (
                        filteredLanguages.map((language) => (
                          <button
                            key={language}
                            type="button"
                            onClick={() => handleLanguageSelect(language)}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-[#E6F0F8] hover:to-indigo-50 hover:text-[#373177] focus:outline-none focus:bg-gradient-to-r focus:from-[#E6F0F8] focus:to-indigo-50 focus:text-blue-700 transition-all duration-200"
                          >
                            {language}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {languageSearchTerm ? 'No languages found' : 'All languages selected'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Educational Qualifications */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-[#E8E6F5] rounded-lg">
                  <GraduationCap className="h-6 w-6 text-[#373177]" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Educational Qualifications</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Highest Degree</label>
                  <input
                    type="text"
                    value={profileData.interviewerProfile.highestDegree.name || ''}
                    onChange={(e) => handleNestedInputChange('interviewerProfile', 'highestDegree', 'name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="e.g., Bachelor's, Master's, PhD"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Institution</label>
                  <input
                    type="text"
                    value={profileData.interviewerProfile.highestDegree.institution || ''}
                    onChange={(e) => handleNestedInputChange('interviewerProfile', 'highestDegree', 'institution', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="University or College name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Graduation Year</label>
                  <input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={profileData.interviewerProfile.highestDegree.year || ''}
                    onChange={(e) => handleNestedInputChange('interviewerProfile', 'highestDegree', 'year', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Year of graduation"
                  />
                </div>
              </div>
            </div>

            {/* Survey Experience */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileCheck className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Survey Experience</h4>
              </div>
              <div className="space-y-6">
                {/* Do you have Survey Experience? */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Do you have previous experience conducting surveys or market research?
                  </label>
                  <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasSurveyExperience"
                        value="true"
                        checked={profileData.interviewerProfile.hasSurveyExperience === true}
                        onChange={(e) => handleInputChange('interviewerProfile', 'hasSurveyExperience', true)}
                        className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Yes</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasSurveyExperience"
                        value="false"
                        checked={profileData.interviewerProfile.hasSurveyExperience === false}
                        onChange={(e) => handleInputChange('interviewerProfile', 'hasSurveyExperience', false)}
                        className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">No</span>
                    </label>
                  </div>
                </div>

                {/* Experience Details - Only show if Yes is selected */}
                {profileData.interviewerProfile.hasSurveyExperience === true && (
                  <div className="space-y-6 bg-orange-50 p-6 rounded-xl border border-orange-200">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Years of Experience */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          Years of Experience <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={profileData.interviewerProfile.surveyExperienceYears || ''}
                          onChange={(e) => handleInputChange('interviewerProfile', 'surveyExperienceYears', parseInt(e.target.value) || '')}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                          placeholder="Enter number of years"
                        />
                      </div>
                    </div>

                    {/* Experience Description */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Describe your survey experience <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={profileData.interviewerProfile.surveyExperienceDescription || ''}
                        onChange={(e) => {
                          const text = e.target.value;
                          const words = text.trim().split(/\s+/).filter(word => word.length > 0);
                          if (words.length <= 1000) {
                            handleInputChange('interviewerProfile', 'surveyExperienceDescription', text);
                          }
                        }}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white resize-none"
                        placeholder="Please describe your experience conducting surveys, types of surveys you've worked on, methodologies used, and any relevant details that would help us understand your background..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CV Upload Section */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Resume/CV Upload</h4>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload('cvUpload', e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-[#E6F0F8]0 file:to-indigo-500 file:text-white hover:file:from-[#373177] hover:file:to-indigo-600 transition-all duration-200"
                  />
                </div>
                {profileData.interviewerProfile.cvUpload && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <span className="text-sm text-green-800 font-semibold">
                          CV Uploaded Successfully
                        </span>
                        <p className="text-xs text-green-600">Your resume is ready for review</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCvPreview}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Preview
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'survey' && (
          <div className="p-8">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-[#E8E6F5] rounded-lg">
                  <Smartphone className="h-6 w-6 text-[#373177]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Survey Requirements</h3>
              </div>
              <p className="text-gray-600 ml-11">Tell us about your technical capabilities and preferences</p>
            </div>
            
            <div className="space-y-8">
              {/* Smartphone Ownership */}
              <div className="bg-gray-50 rounded-xl p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">Do you own a smartphone? *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ownsSmartphone"
                      checked={profileData.interviewerProfile.ownsSmartphone === true}
                      onChange={() => handleInputChange('interviewerProfile', 'ownsSmartphone', true)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ownsSmartphone"
                      checked={profileData.interviewerProfile.ownsSmartphone === false}
                      onChange={() => handleInputChange('interviewerProfile', 'ownsSmartphone', false)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Smartphone Type */}
              {profileData.interviewerProfile.ownsSmartphone && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Smartphone Type *</label>
                  <select
                    value={profileData.interviewerProfile.smartphoneType || ''}
                    onChange={(e) => handleInputChange('interviewerProfile', 'smartphoneType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="">Select Type</option>
                    <option value="Android Only">Android Only</option>
                    <option value="IOS Only">IOS Only</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              )}

              {/* Android Version */}
              {profileData.interviewerProfile.smartphoneType === 'Android Only' && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Android Version *</label>
                  <input
                    type="text"
                    value={profileData.interviewerProfile.androidVersion || ''}
                    onChange={(e) => handleInputChange('interviewerProfile', 'androidVersion', e.target.value)}
                    placeholder="e.g., Android 12"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  />
                </div>
              )}

              {/* iOS Version */}
              {profileData.interviewerProfile.smartphoneType === 'IOS Only' && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">iOS Version *</label>
                  <input
                    type="text"
                    value={profileData.interviewerProfile.iosVersion || ''}
                    onChange={(e) => handleInputChange('interviewerProfile', 'iosVersion', e.target.value)}
                    placeholder="e.g., iOS 16"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  />
                </div>
              )}

              {/* Both Android and iOS */}
              {profileData.interviewerProfile.smartphoneType === 'Both' && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Operating System Versions *</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Android Version</label>
                      <input
                        type="text"
                        value={profileData.interviewerProfile.androidVersion || ''}
                        onChange={(e) => handleInputChange('interviewerProfile', 'androidVersion', e.target.value)}
                        placeholder="e.g., Android 12"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">iOS Version</label>
                      <input
                        type="text"
                        value={profileData.interviewerProfile.iosVersion || ''}
                        onChange={(e) => handleInputChange('interviewerProfile', 'iosVersion', e.target.value)}
                        placeholder="e.g., iOS 16"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Travel Preferences */}
              <div className="bg-gray-50 rounded-xl p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">Would you be willing to travel for work outside your district? *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="willingToTravel"
                      checked={profileData.interviewerProfile.willingToTravel === true}
                      onChange={() => handleInputChange('interviewerProfile', 'willingToTravel', true)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="willingToTravel"
                      checked={profileData.interviewerProfile.willingToTravel === false}
                      onChange={() => handleInputChange('interviewerProfile', 'willingToTravel', false)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Vehicle Ownership */}
              <div className="bg-gray-50 rounded-xl p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">Do you currently have a vehicle to travel? *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="hasVehicle"
                      checked={profileData.interviewerProfile.hasVehicle === true}
                      onChange={() => handleInputChange('interviewerProfile', 'hasVehicle', true)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="hasVehicle"
                      checked={profileData.interviewerProfile.hasVehicle === false}
                      onChange={() => handleInputChange('interviewerProfile', 'hasVehicle', false)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Audio Recording */}
              <div className="bg-gray-50 rounded-xl p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">Would you be willing to record audio on your smartphone? *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="willingToRecordAudio"
                      checked={profileData.interviewerProfile.willingToRecordAudio === true}
                      onChange={() => handleInputChange('interviewerProfile', 'willingToRecordAudio', true)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="willingToRecordAudio"
                      checked={profileData.interviewerProfile.willingToRecordAudio === false}
                      onChange={() => handleInputChange('interviewerProfile', 'willingToRecordAudio', false)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Remuneration Agreement */}
              <div className="bg-gray-50 rounded-xl p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">Do you agree with the remuneration of the survey? *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="agreesToRemuneration"
                      checked={profileData.interviewerProfile.agreesToRemuneration === true}
                      onChange={() => handleInputChange('interviewerProfile', 'agreesToRemuneration', true)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="agreesToRemuneration"
                      checked={profileData.interviewerProfile.agreesToRemuneration === false}
                      onChange={() => handleInputChange('interviewerProfile', 'agreesToRemuneration', false)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">No</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="p-8">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Payment Details</h3>
              </div>
              <p className="text-gray-600 ml-11">Provide your banking information for payments</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Account Number</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.bankAccountNumber || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'bankAccountNumber', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your bank account number"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Account Holder Name</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.bankAccountHolderName || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'bankAccountHolderName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter account holder name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Bank Name</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.bankName || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'bankName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter bank name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">IFSC Code</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.bankIfscCode || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'bankIfscCode', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter IFSC code"
                />
              </div>
            </div>

            {/* Bank Document Upload */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-[#E6F0F8] rounded-lg">
                  <FileImage className="h-6 w-6 text-[#373177]" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Bank Document Upload</h4>
              </div>
              
              {/* Document Requirements Instructions */}
              <div className="bg-[#E6F0F8] border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-[#373177] mt-0.5" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold text-[#001D48] mb-2">Document Requirements</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Please upload either one of the following documents:
                    </p>
                    <ul className="text-sm text-blue-700 space-y-2">
                      <li className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-[#001D48] rounded-full mr-3 mt-2 flex-shrink-0"></span>
                        <div>
                          <strong>Cancelled Cheque</strong> - A cancelled cheque from your bank account showing account details
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-[#001D48] rounded-full mr-3 mt-2 flex-shrink-0"></span>
                        <div>
                          <strong>Passbook Image</strong> - A clear photo of your bank passbook's first page with account details
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('bankDocumentUpload', e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-green-500 file:to-emerald-500 file:text-white hover:file:from-green-600 hover:file:to-emerald-600 transition-all duration-200"
                  />
                </div>
                {profileData.interviewerProfile.bankDocumentUpload && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <span className="text-sm text-green-800 font-semibold">
                          Bank Document Uploaded Successfully
                        </span>
                        <p className="text-xs text-green-600">Your banking document is ready for review</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleBankDocPreview}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Preview
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'verification' && (
          <div className="p-8">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Verification Documents</h3>
              </div>
              <p className="text-gray-600 ml-11">Upload your identity and verification documents</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Aadhaar Number *</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.aadhaarNumber || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'aadhaarNumber', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your Aadhaar number"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Upload Aadhaar *</label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('aadhaarDocument', e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-red-500 file:to-pink-500 file:text-white hover:file:from-red-600 hover:file:to-pink-600 transition-all duration-200"
                  />
                  {profileData.interviewerProfile.aadhaarDocument && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <span className="text-sm text-green-800 font-semibold">
                            Aadhaar Card Uploaded Successfully
                          </span>
                          <p className="text-xs text-green-600">Your Aadhaar document is ready for review</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAadhaarPreview}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Preview
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">PAN Number</label>
                <input
                  type="text"
                  value={profileData.interviewerProfile.panNumber || ''}
                  onChange={(e) => handleInputChange('interviewerProfile', 'panNumber', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your PAN number"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Upload PAN</label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('panDocument', e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-500 file:to-indigo-500 file:text-white hover:file:from-[#373177] hover:file:to-indigo-600 transition-all duration-200"
                  />
                  {profileData.interviewerProfile.panDocument && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <span className="text-sm text-green-800 font-semibold">
                            PAN Card Uploaded Successfully
                          </span>
                          <p className="text-xs text-green-600">Your PAN document is ready for review</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handlePanPreview}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Preview
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Passport Photo Upload */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <User className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Passport Size Photo</h4>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('passportPhoto', e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-orange-500 file:to-yellow-500 file:text-white hover:file:from-orange-600 hover:file:to-yellow-600 transition-all duration-200"
                  />
                </div>
                {profileData.interviewerProfile.passportPhoto && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <span className="text-sm text-green-800 font-semibold">
                          Passport Photo Uploaded Successfully
                        </span>
                        <p className="text-xs text-green-600">Your passport photo is ready for review</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handlePassportPreview}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Preview
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Agreements Section */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FileCheck className="h-6 w-6 text-yellow-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Agreements</h4>
              </div>
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileData.interviewerProfile.agreesToShareInfo === true}
                      onChange={(e) => handleInputChange('interviewerProfile', 'agreesToShareInfo', e.target.checked)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      I agree to share my information which would be kept confidential
                    </span>
                  </label>
                </div>
                <div className="bg-gray-50 rounded-xl p-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileData.interviewerProfile.agreesToParticipateInSurvey === true}
                      onChange={(e) => handleInputChange('interviewerProfile', 'agreesToParticipateInSurvey', e.target.checked)}
                      className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      I agree to participate in surveys through the App
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Action Buttons */}
      <div className="mt-8">
        {/* Instructions */}
        <div className="mb-6 p-4 bg-[#E6F0F8] border border-blue-200 rounded-xl">
          <div className="flex items-start space-x-3">
            <div className="p-1 bg-[#E6F0F8] rounded-lg">
              <AlertCircle className="h-5 w-5 text-[#373177]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Submission Requirements</h4>
              <p className="text-sm text-[#001D48]">
                {!isProfileComplete() 
                  ? "Complete all required fields and upload all documents in all tabs to submit for approval."
                  : profileData.interviewerProfile.approvalStatus === 'pending'
                  ? "Your profile is currently under review. Please wait for the approval process to complete."
                  : hasVerificationChanged() && profileData.interviewerProfile.approvalStatus === 'approved'
                  ? "You have made changes to your verification documents. Save your changes to submit for re-approval."
                  : "Your profile is complete and ready for submission."
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </button>
          
          {shouldShowSubmitButton() && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submitting || !isProfileComplete()}
              className={`inline-flex items-center px-6 py-3 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl ${
                !isProfileComplete()
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#373177] to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500'
              }`}
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {!isProfileComplete() ? 'Complete Profile to Submit' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>

      {/* CV Preview Modal */}
      {showCvPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">CV Preview</h3>
              <button
                onClick={closeCvPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-md overflow-hidden">
                {cvPreviewUrl.endsWith('.pdf') ? (
                  <iframe
                    src={cvPreviewUrl}
                    className="w-full h-full"
                    title="CV Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-50">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">Document Preview</p>
                      <p className="text-sm text-gray-500 mb-4">
                        This document type cannot be previewed inline.
                      </p>
                      <a
                        href={cvPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeCvPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={cvPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Bank Document Preview Modal */}
      {showBankDocPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Bank Document Preview</h3>
              <button
                onClick={closeBankDocPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-md overflow-hidden">
                <img
                  src={bankDocPreviewUrl}
                  alt="Bank Document Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeBankDocPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={bankDocPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PAN Document Preview Modal */}
      {showPanPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">PAN Card Preview</h3>
              <button
                onClick={closePanPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-md overflow-hidden">
                <img
                  src={panPreviewUrl}
                  alt="PAN Card Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closePanPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={panPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Aadhaar Document Preview Modal */}
      {showAadhaarPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Aadhaar Card Preview</h3>
              <button
                onClick={closeAadhaarPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-md overflow-hidden">
                <img
                  src={aadhaarPreviewUrl}
                  alt="Aadhaar Card Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeAadhaarPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={aadhaarPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Passport Photo Preview Modal */}
      {showPassportPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Passport Photo Preview</h3>
              <button
                onClick={closePassportPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-md overflow-hidden">
                <img
                  src={passportPreviewUrl}
                  alt="Passport Photo Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closePassportPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={passportPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewerProfile;
