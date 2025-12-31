import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Building2, Shield, Crown, UserCheck, BarChart3, Lock, Eye, EyeOff, Key, Search, Users } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { authAPI } from '../../services/api';

const EditUserModal = ({ user, onSave, onCancel }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
    resetPassword: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Team member assignment states (for Project Managers)
  const [availableInterviewers, setAvailableInterviewers] = useState([]);
  const [availableQualityAgents, setAvailableQualityAgents] = useState([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [selectedInterviewers, setSelectedInterviewers] = useState([]);
  const [selectedQualityAgents, setSelectedQualityAgents] = useState([]);
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [qualityAgentSearch, setQualityAgentSearch] = useState('');

  // Load team members for project managers
  const loadTeamMembers = async () => {
    try {
      setLoadingTeamMembers(true);
      
      const interviewerParams = {
        page: 1,
        limit: 1000,
        userType: 'interviewer'
      };
      
      const qualityAgentParams = {
        page: 1,
        limit: 1000,
        userType: 'quality_agent'
      };
      
      const [interviewerResponse, qualityAgentResponse] = await Promise.all([
        authAPI.getCompanyUsers(interviewerParams),
        authAPI.getCompanyUsers(qualityAgentParams)
      ]);
      
      if (interviewerResponse.success) {
        setAvailableInterviewers(interviewerResponse.data?.users || []);
      }
      
      if (qualityAgentResponse.success) {
        setAvailableQualityAgents(qualityAgentResponse.data?.users || []);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      showError('Failed to load team members');
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  useEffect(() => {
    if (user) {
      
      // Initialize form data with user data
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        userType: user.userType || 'interviewer',
        status: user.status || 'active',
        isEmailVerified: user.isEmailVerified || false,
        isPhoneVerified: user.isPhoneVerified || false,
        gig_enabled: user.gig_enabled ?? false,
        // Interview mode settings (for interviewer and quality agent users)
        interviewModes: user.interviewModes ?? 'Both',
        canSelectMode: user.canSelectMode ?? false,
        // Company info if available
        companyName: user.company?.companyName || '',
        companyCode: user.companyCode || '',
        // Profile info
        bio: user.profile?.bio || '',
        gender: user.profile?.gender || '',
        dateOfBirth: user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split('T')[0] : '',
        // Address info
        street: user.profile?.address?.street || '',
        city: user.profile?.address?.city || '',
        state: user.profile?.address?.state || '',
        country: user.profile?.address?.country || '',
        postalCode: user.profile?.address?.postalCode || '',
      });

      // Initialize team member assignments for project managers
      if (user.userType === 'project_manager') {
        // Reset selections first
        setSelectedInterviewers([]);
        setSelectedQualityAgents([]);
        // Load team members - selections will be set in a separate useEffect
        loadTeamMembers();
      }
    }
  }, [user]);

  // Separate useEffect to set selected team members after they're loaded
  useEffect(() => {
    // Only run when user is a project manager, loading is complete, and we have the user data
    if (user && user.userType === 'project_manager' && !loadingTeamMembers) {
      // Set selected interviewers and quality agents after team members are loaded
      if (user.assignedTeamMembers && Array.isArray(user.assignedTeamMembers) && user.assignedTeamMembers.length > 0) {
        const interviewerIds = user.assignedTeamMembers
          .filter(member => member.userType === 'interviewer')
          .map(member => {
            // Handle both populated and non-populated cases
            if (member.user) {
              // If user is populated (object), get _id
              if (typeof member.user === 'object' && member.user !== null && member.user._id) {
                return member.user._id.toString();
              }
              // If user is a string (ObjectId), use it directly
              if (typeof member.user === 'string') {
                return member.user;
              }
            }
            return null;
          })
          .filter(id => id !== null);
        
        const qualityAgentIds = user.assignedTeamMembers
          .filter(member => member.userType === 'quality_agent')
          .map(member => {
            // Handle both populated and non-populated cases
            if (member.user) {
              // If user is populated (object), get _id
              if (typeof member.user === 'object' && member.user !== null && member.user._id) {
                return member.user._id.toString();
              }
              // If user is a string (ObjectId), use it directly
              if (typeof member.user === 'string') {
                return member.user;
              }
            }
            return null;
          })
          .filter(id => id !== null);
        
        // Always update selections, even if empty (to clear previous selections)
        setSelectedInterviewers(interviewerIds);
        setSelectedQualityAgents(qualityAgentIds);
      } else {
        // If no assignedTeamMembers, clear selections
        setSelectedInterviewers([]);
        setSelectedQualityAgents([]);
      }
    }
  }, [user, availableInterviewers, availableQualityAgents, loadingTeamMembers]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    };
  };

  const isPasswordValid = validatePassword(passwordData.newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate password if password section is shown and password is being set
      if (showPasswordSection && passwordData.resetPassword && passwordData.newPassword) {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          showError('Validation Error', 'Passwords do not match');
          setLoading(false);
          return;
        }
        
        if (!isPasswordValid.isValid) {
          showError('Validation Error', 'Password does not meet requirements');
          setLoading(false);
          return;
        }
      }

      // Prepare the data for update
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        userType: formData.userType,
        status: formData.status,
        isEmailVerified: formData.isEmailVerified,
        isPhoneVerified: formData.isPhoneVerified,
        gig_enabled: formData.gig_enabled,
        // Interview mode settings (for interviewer and quality agent users)
        ...((formData.userType === 'interviewer' || formData.userType === 'quality_agent') && {
          interviewModes: formData.interviewModes,
          ...(formData.userType === 'interviewer' && { canSelectMode: formData.canSelectMode })
        }),
        profile: {
          bio: formData.bio,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
          address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            postalCode: formData.postalCode,
          }
        }
      };

      // Add password data if password is being reset
      if (showPasswordSection && passwordData.resetPassword && passwordData.newPassword) {
        updateData.password = passwordData.newPassword;
      }

      // Add assigned team members for project managers
      if (formData.userType === 'project_manager') {
        const assignedTeamMembers = [
          ...selectedInterviewers.map(id => ({
            user: id,
            userType: 'interviewer'
          })),
          ...selectedQualityAgents.map(id => ({
            user: id,
            userType: 'quality_agent'
          }))
        ];
        updateData.assignedTeamMembers = assignedTeamMembers;
      }

      await onSave(updateData);
    } catch (error) {
      setError('Failed to update user');
      console.error('Edit user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'super_admin':
        return <Crown className="w-4 h-4 text-red-500" />;
      case 'company_admin':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'project_manager':
        return <BarChart3 className="w-4 h-4 text-green-500" />;
      case 'interviewer':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'quality_agent':
        return <Shield className="w-4 h-4 text-orange-500" />;
      case 'Data_Analyst':
        return <BarChart3 className="w-4 h-4 text-indigo-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {getUserTypeIcon(user.userType)}
            <h2 className="text-xl font-semibold text-gray-900">
              Edit User: {user.firstName} {user.lastName}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Type
              </label>
              <select
                name="userType"
                value={formData.userType || 'interviewer'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="super_admin">Super Admin</option>
                <option value="company_admin">Company Admin</option>
                <option value="project_manager">Project Manager</option>
                <option value="interviewer">Interviewer</option>
                <option value="quality_agent">Quality Agent</option>
                <option value="Data_Analyst">Data Analyst</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status || 'active'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Verification Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="isEmailVerified"
                checked={formData.isEmailVerified || false}
                onChange={handleChange}
                className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700">
                Email Verified
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="isPhoneVerified"
                checked={formData.isPhoneVerified || false}
                onChange={handleChange}
                className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700">
                Phone Verified
              </label>
            </div>
          </div>

          {/* Gig Feature Section - Only for Interviewer, Quality Agent, and Data Analyst */}
          {['interviewer', 'quality_agent', 'Data_Analyst'].includes(formData.userType) && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Gig Work Feature</h3>
              <div className="bg-[#E6F0F8] border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    name="gig_enabled"
                    checked={formData.gig_enabled || false}
                    onChange={handleChange}
                    className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 mt-1"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">
                      Enable Gig Feature
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Allow this user to participate in gig work opportunities. 
                      This enables them to take on additional projects beyond their regular assignments.
                    </p>
                    <div className="mt-2 text-xs text-blue-700">
                      <strong>Note:</strong> When enabled, the user can later choose to make themselves available for gig work in their profile settings.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interview Mode Settings (for Interviewer and Quality Agent users) */}
          {(formData.userType === 'interviewer' || formData.userType === 'quality_agent') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Interview Mode Settings</h3>
              
              {/* Interview Modes Dropdown */}
              <div className="mb-4">
                <label htmlFor="interviewModes" className="block text-sm font-medium text-gray-700 mb-2">
                  Interview Modes <span className="text-red-500">*</span>
                </label>
                <select
                  id="interviewModes"
                  name="interviewModes"
                  value={formData.interviewModes ?? 'Both'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CAPI (Face To Face)">CAPI (Face To Face)</option>
                  <option value="CATI (Telephonic interview)">CATI (Telephonic interview)</option>
                  <option value="Both">Both</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  Select the interview modes this {formData.userType === 'interviewer' ? 'interviewer' : 'quality agent'} can perform.
                </p>
              </div>

              {/* Can Select Mode Checkbox - Only for Interviewer users */}
              {formData.userType === 'interviewer' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      name="canSelectMode"
                      checked={formData.canSelectMode ?? false}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-1"
                    />
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 cursor-pointer">
                        Enable Interviewer to Select Mode
                      </label>
                      <p className="text-xs text-gray-600 mt-1">
                        Allow this interviewer to change their interview modes in their profile settings. 
                        If unchecked, the interviewer will be locked to the selected mode above.
                      </p>
                      <div className="mt-2 text-xs text-green-700">
                        <strong>Note:</strong> When enabled, the interviewer can later choose their preferred interview modes in their profile settings.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Team Member Assignment (for Project Managers) */}
          {formData.userType === 'project_manager' && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-600" />
                <span>Assign Team Members</span>
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Select interviewers and quality agents that this project manager will manage.
              </p>

              {/* Interviewers Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interviewers {selectedInterviewers.length > 0 && (
                    <span className="text-[#001D48] font-normal">({selectedInterviewers.length} selected)</span>
                  )}
                </label>
                {loadingTeamMembers ? (
                  <div className="text-sm text-gray-500">Loading interviewers...</div>
                ) : (
                  <div className="space-y-2">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or member ID..."
                        value={interviewerSearch}
                        onChange={(e) => setInterviewerSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {interviewerSearch && (
                        <button
                          type="button"
                          onClick={() => setInterviewerSearch('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Filtered Interviewers List */}
                    <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50">
                      {availableInterviewers.length === 0 ? (
                        <p className="text-sm text-gray-500">No interviewers available in your company</p>
                      ) : (() => {
                        const filtered = availableInterviewers.filter(interviewer => {
                          if (!interviewerSearch) return true;
                          const searchLower = interviewerSearch.toLowerCase();
                          const fullName = `${interviewer.firstName} ${interviewer.lastName}`.toLowerCase();
                          const email = (interviewer.email || '').toLowerCase();
                          const memberId = (interviewer.memberId || '').toLowerCase();
                          return fullName.includes(searchLower) || 
                                 email.includes(searchLower) || 
                                 memberId.includes(searchLower);
                        });
                        
                        if (filtered.length === 0) {
                          return <p className="text-sm text-gray-500">No interviewers found matching your search</p>;
                        }
                        
                        return filtered.map((interviewer) => {
                          const isSelected = selectedInterviewers.includes(interviewer._id);
                          return (
                            <label
                              key={interviewer._id}
                              className="flex items-center space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedInterviewers([...selectedInterviewers, interviewer._id]);
                                  } else {
                                    setSelectedInterviewers(selectedInterviewers.filter(id => id !== interviewer._id));
                                  }
                                }}
                                className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {interviewer.firstName} {interviewer.lastName}
                                  </span>
                                  {interviewer.memberId && (
                                    <span className="text-xs bg-[#E6F0F8] text-blue-700 px-2 py-0.5 rounded font-mono">
                                      ID: {interviewer.memberId}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{interviewer.email}</span>
                              </div>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Quality Agents Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Agents {selectedQualityAgents.length > 0 && (
                    <span className="text-[#001D48] font-normal">({selectedQualityAgents.length} selected)</span>
                  )}
                </label>
                {loadingTeamMembers ? (
                  <div className="text-sm text-gray-500">Loading quality agents...</div>
                ) : (
                  <div className="space-y-2">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or member ID..."
                        value={qualityAgentSearch}
                        onChange={(e) => setQualityAgentSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {qualityAgentSearch && (
                        <button
                          type="button"
                          onClick={() => setQualityAgentSearch('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Filtered Quality Agents List */}
                    <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50">
                      {availableQualityAgents.length === 0 ? (
                        <p className="text-sm text-gray-500">No quality agents available in your company</p>
                      ) : (() => {
                        const filtered = availableQualityAgents.filter(agent => {
                          if (!qualityAgentSearch) return true;
                          const searchLower = qualityAgentSearch.toLowerCase();
                          const fullName = `${agent.firstName} ${agent.lastName}`.toLowerCase();
                          const email = (agent.email || '').toLowerCase();
                          const memberId = (agent.memberId || '').toLowerCase();
                          return fullName.includes(searchLower) || 
                                 email.includes(searchLower) || 
                                 memberId.includes(searchLower);
                        });
                        
                        if (filtered.length === 0) {
                          return <p className="text-sm text-gray-500">No quality agents found matching your search</p>;
                        }
                        
                        return filtered.map((agent) => {
                          const isSelected = selectedQualityAgents.includes(agent._id);
                          return (
                            <label
                              key={agent._id}
                              className="flex items-center space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQualityAgents([...selectedQualityAgents, agent._id]);
                                  } else {
                                    setSelectedQualityAgents(selectedQualityAgents.filter(id => id !== agent._id));
                                  }
                                }}
                                className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {agent.firstName} {agent.lastName}
                                  </span>
                                  {agent.memberId && (
                                    <span className="text-xs bg-[#E6F0F8] text-blue-700 px-2 py-0.5 rounded font-mono">
                                      ID: {agent.memberId}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{agent.email}</span>
                              </div>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Password Management */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                <Lock className="w-5 h-5 text-gray-600" />
                <span>Password Management</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-[#001D48] hover:text-[#373177] border border-blue-300 rounded-lg hover:bg-[#E6F0F8] transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>{showPasswordSection ? 'Hide Password Options' : 'Reset Password'}</span>
              </button>
            </div>

            {showPasswordSection && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="resetPassword"
                    checked={passwordData.resetPassword}
                    onChange={handlePasswordChange}
                    className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Reset user password
                  </label>
                </div>

                {passwordData.resetPassword && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordData.newPassword && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`flex items-center space-x-1 ${isPasswordValid.minLength ? 'text-green-600' : 'text-red-600'}`}>
                              <div className={`w-2 h-2 rounded-full ${isPasswordValid.minLength ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span>At least 8 characters</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${isPasswordValid.hasUpperCase ? 'text-green-600' : 'text-red-600'}`}>
                              <div className={`w-2 h-2 rounded-full ${isPasswordValid.hasUpperCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span>1 uppercase letter</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${isPasswordValid.hasLowerCase ? 'text-green-600' : 'text-red-600'}`}>
                              <div className={`w-2 h-2 rounded-full ${isPasswordValid.hasLowerCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span>1 lowercase letter</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${isPasswordValid.hasNumbers ? 'text-green-600' : 'text-red-600'}`}>
                              <div className={`w-2 h-2 rounded-full ${isPasswordValid.hasNumbers ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span>1 number</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                      )}
                    </div>

                    <div className="bg-[#E6F0F8] border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-[#001D48]">
                        <strong>Note:</strong> The user will need to use this new password to log in. 
                        Consider notifying them about the password change.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Company Information */}
          {user.company && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Code
                  </label>
                  <input
                    type="text"
                    name="companyCode"
                    value={formData.companyCode || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

          {/* Profile Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Address Information */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      name="street"
                      value={formData.street || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
