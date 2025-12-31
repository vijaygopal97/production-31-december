import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle, 
  User, 
  FileText, 
  CreditCard, 
  FileCheck, 
  ArrowRight,
  Lock,
  Unlock,
  Star,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

const ProfileCompletionGate = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionStatus, setCompletionStatus] = useState({
    isComplete: false,
    isApproved: false,
    status: 'unverified',
    missingFields: []
  });
  const [originalVerificationData, setOriginalVerificationData] = useState({});

  useEffect(() => {
    if (user?.userType === 'interviewer') {
      fetchProfileData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getInterviewerProfile();
      if (response.success) {
        setProfileData(response.data);
        
        // Store original verification data for change detection
        const interviewerProfile = response.data.interviewerProfile || {};
        setOriginalVerificationData({
          aadhaarNumber: interviewerProfile.aadhaarNumber,
          aadhaarDocument: interviewerProfile.aadhaarDocument,
          panNumber: interviewerProfile.panNumber,
          panDocument: interviewerProfile.panDocument,
          passportPhoto: interviewerProfile.passportPhoto
        });
        
        checkProfileCompletion(response.data);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkProfileCompletion = (profile) => {
    const interviewerProfile = profile.interviewerProfile || {};
    
    // Check basic required fields with proper validation (including CV upload and experience)
    const basicFieldsComplete = 
      interviewerProfile.age && interviewerProfile.age > 0 &&
      interviewerProfile.gender && interviewerProfile.gender.trim() !== '' &&
      interviewerProfile.languagesSpoken && interviewerProfile.languagesSpoken.length > 0 &&
      interviewerProfile.highestDegree?.name && interviewerProfile.highestDegree.name.trim() !== '' &&
      interviewerProfile.highestDegree?.institution && interviewerProfile.highestDegree.institution.trim() !== '' &&
      interviewerProfile.highestDegree?.year && interviewerProfile.highestDegree.year > 0 &&
      interviewerProfile.hasSurveyExperience !== null && // Experience question must be answered
      (interviewerProfile.hasSurveyExperience === false || // If no experience, that's fine
       (interviewerProfile.hasSurveyExperience === true && // If yes, then years and description are required
        interviewerProfile.surveyExperienceYears > 0 &&
        interviewerProfile.surveyExperienceDescription && interviewerProfile.surveyExperienceDescription.trim() !== '')) &&
      interviewerProfile.cvUpload && interviewerProfile.cvUpload.trim() !== '';

    // Check survey requirements
    const surveyRequirementsComplete = 
      interviewerProfile.ownsSmartphone !== undefined &&
      (interviewerProfile.ownsSmartphone ? (interviewerProfile.smartphoneType && interviewerProfile.smartphoneType.trim() !== '') : true) &&
      (interviewerProfile.smartphoneType === 'Android Only' ? (interviewerProfile.androidVersion && interviewerProfile.androidVersion.trim() !== '') : true) &&
      (interviewerProfile.smartphoneType === 'IOS Only' ? (interviewerProfile.iosVersion && interviewerProfile.iosVersion.trim() !== '') : true) &&
      (interviewerProfile.smartphoneType === 'Both' ? ((interviewerProfile.androidVersion && interviewerProfile.androidVersion.trim() !== '') && (interviewerProfile.iosVersion && interviewerProfile.iosVersion.trim() !== '')) : true) &&
      interviewerProfile.willingToTravel !== undefined &&
      interviewerProfile.hasVehicle !== undefined &&
      interviewerProfile.willingToRecordAudio !== undefined &&
      interviewerProfile.agreesToRemuneration !== undefined;

    // Check payment details
    const paymentDetailsComplete = 
      interviewerProfile.bankAccountNumber && interviewerProfile.bankAccountNumber.trim() !== '' &&
      interviewerProfile.bankAccountHolderName && interviewerProfile.bankAccountHolderName.trim() !== '' &&
      interviewerProfile.bankName && interviewerProfile.bankName.trim() !== '' &&
      interviewerProfile.bankIfscCode && interviewerProfile.bankIfscCode.trim() !== '' &&
      interviewerProfile.bankDocumentUpload && interviewerProfile.bankDocumentUpload.trim() !== '';

    // Check verification documents
    const verificationComplete = 
      interviewerProfile.aadhaarNumber && interviewerProfile.aadhaarNumber.trim() !== '' &&
      interviewerProfile.aadhaarDocument && interviewerProfile.aadhaarDocument.trim() !== '' &&
      interviewerProfile.panNumber && interviewerProfile.panNumber.trim() !== '' &&
      interviewerProfile.panDocument && interviewerProfile.panDocument.trim() !== '' &&
      interviewerProfile.passportPhoto && interviewerProfile.passportPhoto.trim() !== '';

    // Check agreements
    const agreementsComplete = 
      interviewerProfile.agreesToShareInfo === true &&
      interviewerProfile.agreesToParticipateInSurvey === true;

    const isComplete = basicFieldsComplete && surveyRequirementsComplete && paymentDetailsComplete && verificationComplete && agreementsComplete;
    const isApproved = interviewerProfile.approvalStatus === 'approved';
    const status = interviewerProfile.approvalStatus || 'unverified';

    // Determine missing fields for guidance - only show actually missing ones
    const missingFields = [];
    if (!basicFieldsComplete) missingFields.push('Profile Details');
    if (!surveyRequirementsComplete) missingFields.push('Survey Requirements');
    if (!paymentDetailsComplete) missingFields.push('Payment Details');
    if (!verificationComplete) missingFields.push('Verification Documents');
    if (!agreementsComplete) missingFields.push('Agreements');


    setCompletionStatus({
      isComplete,
      isApproved,
      status,
      missingFields
    });
  };

  // Check if verification tab has been modified (same logic as InterviewerProfile)
  const hasVerificationChanged = () => {
    if (!profileData || !profileData.interviewerProfile) return false;
    
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

  const getStatusDisplay = (status) => {
    // If profile is not complete, show "Profile Not Completed"
    if (!completionStatus.isComplete) {
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

  const getStatusStyle = (status) => {
    // If profile is not complete, show "Profile Not Completed" style
    if (!completionStatus.isComplete) {
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

  const handleCompleteProfile = () => {
    navigate('/interviewer/profile');
  };

  // If not an interviewer, render children normally
  if (user?.userType !== 'interviewer') {
    return children;
  }

  // If loading, show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-[#E8E6F5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#373177] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile status...</p>
        </div>
      </div>
    );
  }

  // If profile is complete and approved, render children
  if (completionStatus.isComplete && completionStatus.isApproved) {
    return children;
  }

  // Show profile completion gate
  const statusStyle = getStatusStyle(completionStatus.status);
  const StatusIcon = statusStyle.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-[#E8E6F5]">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#E6F0F8] rounded-lg">
                <Shield className="h-6 w-6 text-[#001D48]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Profile Verification Required</h1>
                <p className="text-sm text-gray-600">Complete your profile to access all features</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
                <StatusIcon className="h-4 w-4 inline mr-1" />
                {getStatusDisplay(completionStatus.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-full mb-6">
            <Lock className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {completionStatus.isComplete 
              ? "Profile Under Review" 
              : "Complete Your Profile to Get Started"
            }
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {completionStatus.isComplete 
              ? "Your profile has been submitted for review. Once approved, you'll have access to all dashboard features and can start taking surveys."
              : "To access all features and start earning, please complete your profile with all required information and documents."
            }
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Profile Status</h3>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
              <StatusIcon className="h-4 w-4 inline mr-2" />
              {getStatusDisplay(completionStatus.status)}
            </div>
          </div>

          {completionStatus.isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900">Profile Complete</h4>
                  <p className="text-sm text-green-700">All required information has been submitted for review.</p>
                </div>
              </div>
              
              {completionStatus.status === 'pending' && (
                <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Under Review</h4>
                    <p className="text-sm text-yellow-700">Our team is reviewing your profile. You'll be notified once the review is complete.</p>
                  </div>
                </div>
              )}

              {completionStatus.status === 'rejected' && (
                <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <h4 className="font-medium text-red-900">Profile Rejected</h4>
                    <p className="text-sm text-red-700">Please review the feedback and update your profile accordingly.</p>
                  </div>
                </div>
              )}

              {completionStatus.status === 'changes_requested' && (
                <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                  <div>
                    <h4 className="font-medium text-orange-900">Changes Requested</h4>
                    <p className="text-sm text-orange-700">Please make the requested changes to your profile.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-[#E6F0F8] border border-blue-200 rounded-lg">
                <AlertCircle className="h-6 w-6 text-[#001D48]" />
                <div>
                  <h4 className="font-medium text-blue-900">Profile Incomplete</h4>
                  <p className="text-sm text-blue-700">Please complete the following sections to submit your profile for review.</p>
                </div>
              </div>

              {/* Missing Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Profile Details', icon: User, required: true },
                  { name: 'Survey Requirements', icon: FileText, required: true },
                  { name: 'Payment Details', icon: CreditCard, required: true },
                  { name: 'Verification Documents', icon: FileCheck, required: true },
                  { name: 'Agreements', icon: Shield, required: true }
                ].map((section, index) => {
                  const Icon = section.icon;
                  const isMissing = completionStatus.missingFields.includes(section.name);
                  
                  return (
                    <div key={index} className={`p-4 rounded-lg border-2 ${
                      isMissing 
                        ? 'border-red-200 bg-red-50' 
                        : 'border-green-200 bg-green-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          isMissing 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-green-100 text-green-600'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h5 className={`font-medium ${
                            isMissing ? 'text-red-900' : 'text-green-900'
                          }`}>
                            {section.name}
                          </h5>
                          <p className={`text-sm ${
                            isMissing ? 'text-red-700' : 'text-green-700'
                          }`}>
                            {isMissing ? 'Incomplete' : 'Complete'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Benefits Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">What You'll Get After Approval</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#E6F0F8] rounded-lg mb-4">
                <Star className="h-6 w-6 text-[#001D48]" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Access to Surveys</h4>
              <p className="text-sm text-gray-600">Browse and participate in available survey opportunities</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Track Performance</h4>
              <p className="text-sm text-gray-600">Monitor your interview performance and earnings</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#E8E6F5] rounded-lg mb-4">
                <Award className="h-6 w-6 text-[#373177]" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Build Reputation</h4>
              <p className="text-sm text-gray-600">Earn trust scores and build your interviewer profile</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={handleCompleteProfile}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            {completionStatus.isComplete ? 'View Profile' : 'Complete Profile'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionGate;
