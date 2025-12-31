import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  Loader, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import SEO from './SEO';
import { authAPI } from '../services/api';

type Step = 'email' | 'otp' | 'reset';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [emailHash, setEmailHash] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false as string | false,
    error: null as string | null,
  });

  // Timer for OTP resend
  React.useEffect(() => {
    let interval: number;
    if (otpTimer > 0) {
      interval = window.setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }
    return errors;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Email is required'
      });
      return;
    }

    if (!validateEmail(email)) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Please provide a valid email address'
      });
      return;
    }

    setFormStatus({ loading: true, success: false, error: null });

    try {
      const response = await authAPI.forgotPassword(email.trim());
      
      if (response.success) {
        setFormStatus({
          loading: false,
          success: 'OTP sent successfully! Please check your email.',
          error: null
        });
        setEmailHash(response.emailHash); // Store the emailHash for OTP verification
        setCurrentStep('otp');
        setOtpTimer(60); // 60 seconds timer
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Failed to send OTP'
        });
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp.trim()) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'OTP is required'
      });
      return;
    }

    if (otp.trim().length !== 6) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'OTP must be 6 digits'
      });
      return;
    }

    if (!emailHash) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Session expired. Please request a new OTP.'
      });
      return;
    }

    setFormStatus({ loading: true, success: false, error: null });

    try {
      const response = await authAPI.verifyOTP(email, otp.trim(), emailHash);
      
      if (response.success) {
        setFormStatus({
          loading: false,
          success: 'OTP verified successfully! You can now reset your password.',
          error: null
        });
        setResetToken(response.resetToken); // Store the reset token
        setCurrentStep('reset');
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Invalid OTP'
        });
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      
      let errorMessage = 'Failed to verify OTP. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'All fields are required'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Passwords do not match'
      });
      return;
    }

    if (!resetToken) {
      setFormStatus({
        loading: false,
        success: false,
        error: 'Session expired. Please start the process again.'
      });
      return;
    }

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setFormStatus({
        loading: false,
        success: false,
        error: passwordErrors.join(', ')
      });
      return;
    }

    setFormStatus({ loading: true, success: false, error: null });

    try {
      const response = await authAPI.resetPassword(resetToken, email, newPassword, confirmPassword);
      
      if (response.success) {
        setFormStatus({
          loading: false,
          success: 'Password reset successfully! Redirecting to login...',
          error: null
        });
        
        // Redirect to login after 2 seconds
        // setTimeout(() => {
          navigate('/login');
        // }, 2000);
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Failed to reset password'
        });
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
    }
  };

  const handleResendOTP = async () => {
    if (otpTimer > 0) return;
    
    setFormStatus({ loading: true, success: false, error: null });
    
    try {
      const response = await authAPI.forgotPassword(email.trim());
      
      if (response.success) {
        setFormStatus({
          loading: false,
          success: 'OTP resent successfully! Please check your email.',
          error: null
        });
        setEmailHash(response.emailHash); // Update emailHash for new OTP
        setOtpTimer(60);
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Failed to resend OTP'
        });
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      
      let errorMessage = 'Failed to resend OTP. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
    }
  };

  const handleBackToEmail = () => {
    setCurrentStep('email');
    setOtp('');
    setEmailHash('');
    setResetToken('');
    setFormStatus({ loading: false, success: false, error: null });
  };

  const handleBackToOTP = () => {
    setCurrentStep('otp');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setFormStatus({ loading: false, success: false, error: null });
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {/* Email Step */}
        <div className={`flex items-center ${currentStep === 'email' ? 'text-[#001D48]' : currentStep === 'otp' || currentStep === 'reset' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'email' ? 'bg-[#E6F0F8]' : currentStep === 'otp' || currentStep === 'reset' ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Mail className="w-4 h-4" />
          </div>
          <span className="ml-2 text-sm font-medium">Email</span>
        </div>
        
        <div className={`w-8 h-0.5 ${currentStep === 'otp' || currentStep === 'reset' ? 'bg-green-400' : 'bg-gray-300'}`}></div>
        
        {/* OTP Step */}
        <div className={`flex items-center ${currentStep === 'otp' ? 'text-[#001D48]' : currentStep === 'reset' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'otp' ? 'bg-[#E6F0F8]' : currentStep === 'reset' ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Shield className="w-4 h-4" />
          </div>
          <span className="ml-2 text-sm font-medium">OTP</span>
        </div>
        
        <div className={`w-8 h-0.5 ${currentStep === 'reset' ? 'bg-green-400' : 'bg-gray-300'}`}></div>
        
        {/* Reset Step */}
        <div className={`flex items-center ${currentStep === 'reset' ? 'text-[#001D48]' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'reset' ? 'bg-[#E6F0F8]' : 'bg-gray-100'}`}>
            <Key className="w-4 h-4" />
          </div>
          <span className="ml-2 text-sm font-medium">Reset</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SEO 
        pathname="/forgot-password"
        title="Forgot Password - Convergent"
        description="Reset your password for Convergent account. Enter your email to receive a verification code and create a new password."
        keywords="forgot password, reset password, Convergent, account recovery"
        canonical="/forgot-password"
        ogTitle="Forgot Password - Convergent"
        ogDescription="Reset your password for Convergent account. Enter your email to receive a verification code and create a new password."
        ogImage="/og-image.jpg"
        ogType="website"
        twitterCard="summary_large_image"
        twitterSite="@opineindia"
        noIndex={false}
        customStructuredData={null}
      />
      <div className="forgot-password-page bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 min-h-screen flex items-center justify-center">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-[600px]">
          <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-200">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Reset Your <span className="bg-gradient-to-r from-[#373177] to-[#373177] bg-clip-text text-transparent">Password</span>
              </h1>
              <p className="text-gray-600">
                {currentStep === 'email' && 'Enter your email address to receive a verification code'}
                {currentStep === 'otp' && 'Enter the 6-digit code sent to your email'}
                {currentStep === 'reset' && 'Create a new password for your account'}
              </p>
            </div>

            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Form Status Messages */}
            {formStatus.success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6 flex items-center" role="alert">
                <CheckCircle className="w-5 h-5 mr-3" />
                <span className="block sm:inline">{formStatus.success}</span>
              </div>
            )}
            {formStatus.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 flex items-center" role="alert">
                <XCircle className="w-5 h-5 mr-3" />
                <span className="block sm:inline">{formStatus.error}</span>
              </div>
            )}

            {/* Email Step */}
            {currentStep === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transition-all duration-200 shadow-md flex items-center justify-center"
                  disabled={formStatus.loading}
                >
                  {formStatus.loading ? (
                    <>
                      <Loader className="w-5 h-5 mr-3 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-3" />
                      Send Verification Code
                    </>
                  )}
                </button>
              </form>
            )}

            {/* OTP Step */}
            {currentStep === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg text-center tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Code sent to: <span className="font-medium">{email}</span>
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#373177] to-[#373177] text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md flex items-center justify-center"
                    disabled={formStatus.loading}
                  >
                    {formStatus.loading ? (
                      <>
                        <Loader className="w-5 h-5 mr-3 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 mr-3" />
                        Verify Code
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={otpTimer > 0 || formStatus.loading}
                    className="text-sm text-[#001D48] hover:text-[#373177] disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                  >
                    {otpTimer > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Resend in {otpTimer}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Resend Code
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Reset Password Step */}
            {currentStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="Enter new password"
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
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="Confirm new password"
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Password Requirements:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• At least 8 characters long</li>
                    <li>• Contains uppercase and lowercase letters</li>
                    <li>• Contains at least one number</li>
                    <li>• Contains at least one special character (@$!%*?&)</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleBackToOTP}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#373177] to-[#373177] text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md flex items-center justify-center"
                    disabled={formStatus.loading}
                  >
                    {formStatus.loading ? (
                      <>
                        <Loader className="w-5 h-5 mr-3 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <Key className="w-5 h-5 mr-3" />
                        Reset Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-[#001D48] hover:text-[#373177]">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
