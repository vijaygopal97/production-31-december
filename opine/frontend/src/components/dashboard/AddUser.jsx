import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building2, 
  Users, 
  BarChart3, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader, 
  CheckCircle, 
  XCircle,
  UserPlus,
  Brain
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const userTypes = [
  { value: 'super_admin', label: 'Super Admin', icon: <ShieldCheck className="w-6 h-6" />, description: 'Platform owner with full control.' },
  { value: 'company_admin', label: 'Company Admin', icon: <Building2 className="w-6 h-6" />, description: 'Manages company operations, users, and finances.' },
  { value: 'project_manager', label: 'Project Manager', icon: <BarChart3 className="w-6 h-6" />, description: 'Creates and manages surveys, assigns interviewers.' },
  { value: 'interviewer', label: 'Interviewer', icon: <User className="w-6 h-6" />, description: 'Conducts field interviews and collects data.' },
  { value: 'quality_agent', label: 'Quality Agent', icon: <Users className="w-6 h-6" />, description: 'Verifies data quality and ensures authenticity.' },
  { value: 'Data_Analyst', label: 'Data Analyst', icon: <Brain className="w-6 h-6" />, description: 'Analyzes survey data and creates professional reports.' },
];

const companySizes = ['small', 'medium', 'large', 'enterprise'];

const userStatuses = [
  { value: 'active', label: 'Active', description: 'User can access the platform' },
  { value: 'pending', label: 'Pending', description: 'User needs approval' },
  { value: 'inactive', label: 'Inactive', description: 'User account is disabled' },
  { value: 'suspended', label: 'Suspended', description: 'User account is temporarily suspended' }
];

const AddUser = ({ onUserCreated }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    userType: 'interviewer',
    companyCode: '',
    referralCode: '',
    status: 'active', // Default to active for Super Admin created users
    gig_enabled: false, // Default to false for admin created users
    // Interview Mode Settings (for Interviewer and Quality Agent users)
    interviewModes: 'Both',
    canSelectMode: false,
    // Company Admin specific fields
    companyName: '',
    industry: '',
    companySize: 'medium',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
  });

  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (formData.userType !== 'super_admin' && formData.userType !== 'company_admin') {
        try {
          const response = await authAPI.getCompanies();
          if (response.success) {
            setAvailableCompanies(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch companies:', error);
        }
      } else {
        setAvailableCompanies([]);
      }
    };
    fetchCompanies();
  }, [formData.userType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUserTypeChange = (userType) => {
    setFormData(prev => ({
      ...prev,
      userType,
      companyCode: '',
      referralCode: '',
      companyName: '',
      industry: '',
      companySize: 'medium',
      companyEmail: '',
      companyPhone: '',
      companyWebsite: ''
    }));
  };

  const validateForm = () => {
    const errors = [];

    // Basic validation
    if (!formData.firstName.trim()) errors.push('First name is required');
    if (!formData.lastName.trim()) errors.push('Last name is required');

    // Name validation
    if (formData.firstName.trim() && formData.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }
    if (formData.lastName.trim() && formData.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }
    if (!formData.email.trim()) errors.push('Email is required');

    // Email validation
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.push('Please provide a valid email address');
      }
    }
    if (!formData.phone.trim()) errors.push('Phone number is required');

    // Phone number validation
    if (formData.phone.trim()) {
      const phoneRegex = /^[\+]?[0-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone.trim().replace(/\s+/g, ''))) {
        errors.push('Please provide a valid phone number');
      }
    }
    if (!formData.password) errors.push('Password is required');
    if (formData.password !== formData.confirmPassword) errors.push('Passwords do not match');

    // Password strength validation
    if (formData.password && formData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Check password strength
    if (formData.password) {
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      
      if (!hasUpperCase || !hasLowerCase) {
        errors.push('Password must contain at least one uppercase letter and one lowercase letter');
      }
    }

    // Company validation for non-super-admin users
    // Company code is required for company_admin and project_manager
    // Optional for interviewer, quality_agent, and Data_Analyst (independent workers)
    if (formData.userType !== 'super_admin') {
      const requiresCompanyCode = ['company_admin', 'project_manager'].includes(formData.userType);
      
      if (requiresCompanyCode && !formData.companyCode.trim()) {
        errors.push('Company code is required');
      }

      // Company code validation (only if provided)
      if (formData.companyCode.trim()) {
        const companyCodeRegex = /^[A-Z0-9_]+$/;
        if (!companyCodeRegex.test(formData.companyCode.trim())) {
          errors.push('Company code can only contain uppercase letters, numbers, and underscores');
        }
        if (formData.companyCode.trim().length < 2 || formData.companyCode.trim().length > 20) {
          errors.push('Company code must be between 2 and 20 characters');
        }
      }
    }

    // Company admin specific validation
    if (formData.userType === 'company_admin') {
      if (!formData.companyName.trim()) errors.push('Company name is required');
      if (!formData.industry.trim()) errors.push('Industry is required');
      if (!formData.companyEmail.trim()) errors.push('Company email is required');
      if (!formData.companyPhone.trim()) errors.push('Company phone is required');

      // Company email validation
      if (formData.companyEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.companyEmail.trim())) {
          errors.push('Please provide a valid company email address');
        }
      }

      // Company phone validation
      if (formData.companyPhone.trim()) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(formData.companyPhone.trim().replace(/\s+/g, ''))) {
          errors.push('Please provide a valid company phone number');
        }
      }

      // Company website validation
      if (formData.companyWebsite.trim()) {
        const websiteRegex = /^https?:\/\/.+/;
        if (!websiteRegex.test(formData.companyWebsite.trim())) {
          errors.push('Please provide a valid website URL (starting with http:// or https://)');
        }
      }
    }

    // Referral code validation
    if (formData.referralCode.trim()) {
      if (formData.referralCode.trim().length < 3 || formData.referralCode.trim().length > 20) {
        errors.push('Referral code must be between 3 and 20 characters');
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    
    if (validationErrors.length > 0) {
      // Show validation errors as toast notifications
      validationErrors.forEach(error => {
        showError('Validation Error', error);
      });
      return;
    }

    setFormStatus({ loading: true, success: false, error: null });

    try {
      // Prepare registration data
      const registrationData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim().replace(/\s+/g, ''),
        password: formData.password,
        userType: formData.userType,
        status: formData.status,
        gig_enabled: formData.gig_enabled
      };

      // Add interview mode settings for interviewer and quality agent users
      if (formData.userType === 'interviewer') {
        registrationData.interviewModes = formData.interviewModes;
        registrationData.canSelectMode = formData.canSelectMode;
      } else if (formData.userType === 'quality_agent') {
        registrationData.interviewModes = formData.interviewModes;
        // Quality agents don't have canSelectMode option
      }

      // Only add optional fields if they have values
      if (formData.companyCode.trim()) {
        registrationData.companyCode = formData.companyCode.trim();
      }
      if (formData.referralCode.trim()) {
        registrationData.referralCode = formData.referralCode.trim();
      }

      // Add company information for company admin
      if (formData.userType === 'company_admin') {
        registrationData.companyName = formData.companyName.trim();
        registrationData.industry = formData.industry.trim();
        registrationData.companySize = formData.companySize;
        registrationData.companyEmail = formData.companyEmail.trim();
        registrationData.companyPhone = formData.companyPhone.trim().replace(/\s+/g, '');
        if (formData.companyWebsite.trim()) {
          registrationData.companyWebsite = formData.companyWebsite.trim();
        }
      }

      const response = await authAPI.register(registrationData);

      if (response.success) {
        setFormStatus({ loading: false, success: true, error: null });
        showSuccess('User Created!', 'User has been created successfully.');
        
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          userType: 'interviewer',
          companyCode: '',
          referralCode: '',
          status: 'active',
          gig_enabled: false,
          interviewModes: 'Both',
          canSelectMode: false,
          companyName: '',
          industry: '',
          companySize: 'medium',
          companyEmail: '',
          companyPhone: '',
          companyWebsite: '',
        });
        
        // Call callback if provided
        if (onUserCreated) {
          onUserCreated();
        }
      } else {
        const errorMessage = response.message || 'User creation failed';
        setFormStatus({
          loading: false,
          success: false,
          error: errorMessage
        });
        showError('User Creation Failed', errorMessage);
      }
    } catch (error) {
      console.error('User creation error:', error);

      let errorMessage = 'User creation failed. Please try again.';

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
      showError('User Creation Failed', errorMessage);
    }
  };

  const selectedUserType = userTypes.find(type => type.value === formData.userType);

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New User</h1>
        <p className="text-gray-600">Create a new user account for the platform</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
        {/* Form Status Messages - Now handled by toast notifications */}

        {/* User Type Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select User Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {userTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleUserTypeChange(type.value)}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-300
                  ${formData.userType === type.value
                    ? 'border-[#001D48] bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
              >
                <div className={`p-3 rounded-full ${formData.userType === type.value ? 'bg-[#373177] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {type.icon}
                </div>
                <span className="mt-3 text-sm font-semibold text-gray-800">{type.label}</span>
                <p className="text-xs text-gray-500 text-center mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            Create {selectedUserType?.label} Account
          </h2>

          {/* User Status Selection */}
          <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
            <h3 className="text-xl font-bold text-gray-800">User Status</h3>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                User Status <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userStatuses.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: status.value }))}
                    className={`flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-300 ${
                      formData.status === status.value
                        ? 'border-[#001D48] bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        status.value === 'active' ? 'bg-green-500' :
                        status.value === 'pending' ? 'bg-yellow-500' :
                        status.value === 'inactive' ? 'bg-gray-500' :
                        'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-semibold text-gray-800">{status.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 text-left">{status.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="grid sm:grid-cols-2 gap-4">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
                required
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Doe"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="john.doe@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="+91 98765 43210"
              required
            />
          </div>

          {/* Password Fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Gig Feature Section - Only for Interviewer, Quality Agent, and Data Analyst */}
          {['interviewer', 'quality_agent', 'Data_Analyst'].includes(formData.userType) && (
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Gig Work Feature</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="gig_enabled"
                    name="gig_enabled"
                    checked={formData.gig_enabled}
                    onChange={handleChange}
                    className="w-4 h-4 text-[#373177] border-gray-300 rounded focus:ring-blue-500 mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="gig_enabled" className="text-sm font-medium text-gray-700 cursor-pointer">
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
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Interview Mode Settings</h3>
              
              {/* Interview Modes Dropdown */}
              <div>
                <label htmlFor="interviewModes" className="block text-sm font-medium text-gray-700 mb-2">
                  Interview Modes <span className="text-red-500">*</span>
                </label>
                <select
                  id="interviewModes"
                  name="interviewModes"
                  value={formData.interviewModes}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
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
                      id="canSelectMode"
                      name="canSelectMode"
                      checked={formData.canSelectMode}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor="canSelectMode" className="text-sm font-medium text-gray-700 cursor-pointer">
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

          {/* Company Admin Fields */}
          {formData.userType === 'company_admin' && (
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Company Information</h3>
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Convergent Corp"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="companyCode"
                    name="companyCode"
                    value={formData.companyCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="OPINE_CORP"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                    Industry <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Market Research"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="companyEmail"
                    name="companyEmail"
                    value={formData.companyEmail}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contact@opinecorp.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="companyPhone"
                    name="companyPhone"
                    value={formData.companyPhone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Website
                  </label>
                  <input
                    type="url"
                    id="companyWebsite"
                    name="companyWebsite"
                    value={formData.companyWebsite}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://www.opinecorp.com"
                  />
                </div>
                <div>
                  <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Size <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="companySize"
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {companySizes.map(size => (
                      <option key={size} value={size}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Company Code for other users (not Super Admin or Company Admin) */}
          {formData.userType !== 'super_admin' && formData.userType !== 'company_admin' && (
            <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Company Affiliation</h3>
              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Code 
                  {['project_manager'].includes(formData.userType) ? (
                    <span className="text-red-500"> *</span>
                  ) : (
                    <span className="text-gray-500"> (Optional - for independent workers)</span>
                  )}
                </label>
                <select
                  id="companyCode"
                  name="companyCode"
                  value={formData.companyCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required={['project_manager'].includes(formData.userType)}
                >
                  <option value="">Select Company (Optional for independent workers)</option>
                  {availableCompanies.map(company => (
                    <option key={company.companyCode} value={company.companyCode}>
                      {company.companyName} ({company.companyCode})
                    </option>
                  ))}
                </select>
                {availableCompanies.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No active companies available.</p>
                )}
                {['interviewer', 'quality_agent', 'Data_Analyst'].includes(formData.userType) && (
                  <p className="text-sm text-[#373177] mt-2">
                    💡 You can work independently without a company affiliation, or join a company later.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Referral Code (Optional for all) */}
          <div className="border-t border-gray-200 pt-6 mt-6 space-y-6">
            <h3 className="text-xl font-bold text-gray-800">Optional Information</h3>
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code
              </label>
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="OPTIONAL_CODE"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md flex items-center justify-center"
            disabled={formStatus.loading}
          >
            {formStatus.loading ? (
              <>
                <Loader className="w-5 h-5 mr-3 animate-spin" />
                Creating User...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 mr-3" />
                Create User
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default AddUser;
