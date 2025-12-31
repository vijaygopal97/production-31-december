import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Building2, 
  Users, 
  BarChart3, 
  Globe,
  Shield,
  UserCog,
  ClipboardCheck,
  Target,
  DollarSign,
  Award,
  FileText,
  Brain,
  Settings,
  User,
  Lock,
  FileBarChart,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

const DashboardSidebar = ({ sidebarOpen, userType }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [profileStatus, setProfileStatus] = useState({
    isComplete: false,
    isApproved: false,
    status: 'unverified',
    missingFields: []
  });
  const [originalVerificationData, setOriginalVerificationData] = useState({});

  useEffect(() => {
    if (userType === 'interviewer') {
      fetchProfileStatus();
    }
  }, [userType]);

  const fetchProfileStatus = async () => {
    try {
      const response = await authAPI.getInterviewerProfile();
      if (response.success) {
        const interviewerProfile = response.data.interviewerProfile || {};
        
        // Store original verification data for change detection
        setOriginalVerificationData({
          aadhaarNumber: interviewerProfile.aadhaarNumber,
          aadhaarDocument: interviewerProfile.aadhaarDocument,
          panNumber: interviewerProfile.panNumber,
          panDocument: interviewerProfile.panDocument,
          passportPhoto: interviewerProfile.passportPhoto
        });
        
        // Check if profile is complete (same logic as ProfileCompletionGate)
        const isComplete = checkProfileCompletion(interviewerProfile);
        const isApproved = interviewerProfile.approvalStatus === 'approved';
        const status = interviewerProfile.approvalStatus || 'unverified';
        
        // Determine missing fields
        const missingFields = [];
        if (!isComplete) {
          // Check which sections are missing
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
          
          if (!basicFieldsComplete) missingFields.push('Profile Details');
          // Add other section checks as needed
        }
        
        setProfileStatus({ isComplete, isApproved, status, missingFields });
      }
    } catch (error) {
      console.error('Error fetching profile status:', error);
    }
  };

  const checkProfileCompletion = (profile) => {
    const basicFieldsComplete = 
      profile.age && profile.age > 0 &&
      profile.gender && profile.gender.trim() !== '' &&
      profile.languagesSpoken && profile.languagesSpoken.length > 0 &&
      profile.highestDegree?.name && profile.highestDegree.name.trim() !== '' &&
      profile.highestDegree?.institution && profile.highestDegree.institution.trim() !== '' &&
      profile.highestDegree?.year && profile.highestDegree.year > 0 &&
      profile.hasSurveyExperience !== null && // Experience question must be answered
      (profile.hasSurveyExperience === false || // If no experience, that's fine
       (profile.hasSurveyExperience === true && // If yes, then years and description are required
        profile.surveyExperienceYears > 0 &&
        profile.surveyExperienceDescription && profile.surveyExperienceDescription.trim() !== '')) &&
      profile.cvUpload && profile.cvUpload.trim() !== '';

    const surveyRequirementsComplete = 
      profile.ownsSmartphone !== undefined &&
      (profile.ownsSmartphone ? (profile.smartphoneType && profile.smartphoneType.trim() !== '') : true) &&
      (profile.smartphoneType === 'Android Only' ? (profile.androidVersion && profile.androidVersion.trim() !== '') : true) &&
      (profile.smartphoneType === 'IOS Only' ? (profile.iosVersion && profile.iosVersion.trim() !== '') : true) &&
      (profile.smartphoneType === 'Both' ? ((profile.androidVersion && profile.androidVersion.trim() !== '') && (profile.iosVersion && profile.iosVersion.trim() !== '')) : true) &&
      profile.willingToTravel !== undefined &&
      profile.hasVehicle !== undefined &&
      profile.willingToRecordAudio !== undefined &&
      profile.agreesToRemuneration !== undefined;

    const paymentDetailsComplete = 
      profile.bankAccountNumber && profile.bankAccountNumber.trim() !== '' &&
      profile.bankAccountHolderName && profile.bankAccountHolderName.trim() !== '' &&
      profile.bankName && profile.bankName.trim() !== '' &&
      profile.bankIfscCode && profile.bankIfscCode.trim() !== '' &&
      profile.bankDocumentUpload && profile.bankDocumentUpload.trim() !== '';

    const verificationComplete = 
      profile.aadhaarNumber && profile.aadhaarNumber.trim() !== '' &&
      profile.aadhaarDocument && profile.aadhaarDocument.trim() !== '' &&
      profile.panNumber && profile.panNumber.trim() !== '' &&
      profile.panDocument && profile.panDocument.trim() !== '' &&
      profile.passportPhoto && profile.passportPhoto.trim() !== '';

    const agreementsComplete = 
      profile.agreesToShareInfo === true &&
      profile.agreesToParticipateInSurvey === true;

    return basicFieldsComplete && surveyRequirementsComplete && paymentDetailsComplete && verificationComplete && agreementsComplete;
  };

  // Check if verification tab has been modified (same logic as InterviewerProfile)
  const hasVerificationChanged = () => {
    if (!originalVerificationData || Object.keys(originalVerificationData).length === 0) return false;
    
    // We need to get current profile data to compare
    // For now, we'll assume no changes since we don't have current data in sidebar
    // This is a simplified version - in a real scenario, you'd need to track current state
    return false;
  };

  // Get status display (same logic as InterviewerProfile)
  const getStatusDisplay = (status) => {
    // If profile is not complete, show "Profile Not Completed"
    if (!profileStatus.isComplete) {
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

  const isItemLocked = (itemPath) => {
    if (userType !== 'interviewer') return false;
    if (itemPath === '/interviewer/profile') return false; // Profile is always accessible
    return !(profileStatus.isComplete && profileStatus.isApproved);
  };
  
  // Define sidebar items based on user type
  const getSidebarItems = () => {
    if (userType === 'super_admin') {
      return [
        { icon: Home, label: 'Dashboard', path: '/admin/dashboard' },
        { icon: UserCog, label: 'Manage Users', path: '/admin/manage-users' },
        { icon: Building2, label: 'Manage Companies', path: '/admin/manage-companies' },
        { icon: Shield, label: 'Document Verification', path: '/admin/document-verification' },
        { icon: ClipboardCheck, label: 'Survey Templates', path: '/admin/survey-templates' },
        { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
        { icon: Settings, label: 'Settings', path: '/admin/settings' },
        { icon: User, label: 'Profile Settings', path: '/admin/profile' }
      ];
    } else if (userType === 'company_admin') {
      const items = [
        { icon: Home, label: 'Dashboard', path: '/company/dashboard' },
        { icon: Users, label: 'Team Management', path: '/company/team-management' },
        { icon: ClipboardCheck, label: 'Surveys', path: '/company/surveys' },
        { icon: Target, label: 'Survey Approvals', path: '/company/survey-approvals' },
        { icon: Shield, label: 'Document Verification', path: '/company/document-verification' },
        { icon: BarChart3, label: 'Performance Monitoring', path: '/company/performance' },
        { icon: DollarSign, label: 'Payment Settings', path: '/company/payment-settings' },
        { icon: Settings, label: 'Account Settings', path: '/company/account-settings' },
        { icon: User, label: 'Profile Settings', path: '/company/profile' }
      ];
      
      // Add Generate Report menu only for ajayadarsh@gmail.com
      if (user && user.email === 'ajayadarsh@gmail.com') {
        items.splice(5, 0, { icon: FileBarChart, label: 'Generate Report', path: '/company/generate-report' });
      }
      
      return items;
    } else if (userType === 'project_manager') {
      return [
        { icon: BarChart3, label: 'Survey Reports', path: '/project-manager/survey-reports' },
        { icon: Users, label: 'Team Management', path: '/project-manager/team-management' }
      ];
    } else if (userType === 'interviewer') {
      return [
        { icon: Home, label: 'Dashboard', path: '/interviewer/dashboard' },
        { icon: ClipboardCheck, label: 'Available Interviews', path: '/interviewer/available-surveys' },
        { icon: BarChart3, label: 'My Interviews', path: '/interviewer/my-interviews' },
        { icon: Award, label: 'Performance Monitoring', path: '/interviewer/performance' },
        { icon: DollarSign, label: 'Payments History', path: '/interviewer/payments-history' },
        { icon: Settings, label: 'Payment Settings', path: '/interviewer/payment-settings' },
        { icon: User, label: 'Profile Settings', path: '/interviewer/profile' }
      ];
    } else if (userType === 'quality_agent') {
      return [
        { icon: Home, label: 'Dashboard', path: '/quality-agent/dashboard' },
        { icon: CheckSquare, label: 'Survey Approvals', path: '/quality-agent/survey-approvals' },
        { icon: BarChart3, label: 'Performance Monitoring', path: '/quality-agent/performance' },
        { icon: DollarSign, label: 'Payments History', path: '/quality-agent/payments-history' },
        { icon: Settings, label: 'Payment Settings', path: '/quality-agent/payment-settings' },
        { icon: User, label: 'Profile Settings', path: '/quality-agent/profile' }
      ];
    } else if (userType === 'Data_Analyst') {
      return [
        { icon: Home, label: 'Dashboard', path: '/data-analyst/dashboard' },
        { icon: FileText, label: 'Available Gigs', path: '/data-analyst/available-gigs' },
        { icon: BarChart3, label: 'My Work', path: '/data-analyst/my-work' },
        { icon: Award, label: 'Performance Monitoring', path: '/data-analyst/performance' },
        { icon: DollarSign, label: 'Payments History', path: '/data-analyst/payments-history' },
        { icon: Settings, label: 'Payment Settings', path: '/data-analyst/payment-settings' },
        { icon: User, label: 'Profile Settings', path: '/data-analyst/profile' }
      ];
    } else {
      // Default fallback
      return [
        { icon: Home, label: 'Dashboard', path: '/dashboard' },
        { icon: BarChart3, label: 'My Work', path: '/my-work' },
        { icon: User, label: 'Profile', path: '/profile' }
      ];
    }
  };

  const sidebarItems = getSidebarItems();

  return (
    <aside className={`fixed left-0 top-16 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
      sidebarOpen ? 'w-64' : 'w-0'
    } overflow-hidden`}>
      <div className="p-4">
        <nav className="space-y-2">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isLocked = isItemLocked(item.path);
            
            return (
              <div key={index} className="relative">
                {isLocked ? (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg'
                      : 'text-gray-400 bg-gray-50 cursor-not-allowed'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <Lock className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      {item.count && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.count && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Profile Status for Interviewers */}
        {userType === 'interviewer' && (
          <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Profile Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Completion</span>
                <span className={`text-xs font-medium ${
                  profileStatus.isComplete ? 'text-green-600' : 'text-red-600'
                }`}>
                  {profileStatus.isComplete ? 'Complete' : 'Incomplete'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Status</span>
                <span className={`text-xs font-medium ${
                  profileStatus.isComplete && profileStatus.isApproved ? 'text-green-600' : 
                  !profileStatus.isComplete ? 'text-gray-600' :
                  profileStatus.status === 'pending' ? 'text-yellow-600' :
                  profileStatus.status === 'rejected' ? 'text-red-600' : 'text-[#373177]'
                }`}>
                  {getStatusDisplay(profileStatus.status)}
                </span>
              </div>
              {!(profileStatus.isComplete && profileStatus.isApproved) && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <Link
                    to="/interviewer/profile"
                    className="text-xs text-[#373177] hover:text-blue-800 font-medium flex items-center space-x-1"
                  >
                    <User className="h-3 w-3" />
                    <span>Complete Profile</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Stats in Sidebar - Only for Super Admin */}
        {userType === 'super_admin' && (
        <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">System Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Server Load</span>
              <span className="text-xs font-medium text-green-600">Low</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Uptime</span>
              <span className="text-xs font-medium text-green-600">99.9%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Active Sessions</span>
              <span className="text-xs font-medium text-[#001D48]">1,247</span>
            </div>
          </div>
        </div>
        )}
      </div>
    </aside>
  );
};

export default DashboardSidebar;
