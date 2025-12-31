const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Email transporter configuration
// In production, use environment variables for SMTP settings
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};
  
// Generate secure 6-digit OTP using crypto.randomInt
exports.generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Create HMAC signature for OTP verification
exports.createOTPSignature = (email, otp) => {
  const secret = process.env.OTP_SECRET || 'your-otp-secret-key-change-in-production';
  const data = `${email}.${otp}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Verify OTP signature using timing-safe comparison
exports.verifyOTPSignature = (email, otp, providedHash) => {
  const expectedHash = exports.createOTPSignature(email, otp);
  const providedBuffer = Buffer.from(providedHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
  
// Send OTP email using nodemailer
exports.sendOTPEmail = async (email, otp) => {
  const transporter = createEmailTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_USER || 'noreply@opineindia.com',
    to: email,
    subject: 'Password Reset - Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You have requested to reset your password for your Opine India account.</p>
        <p>Your verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 4px; margin: 0;">${otp}</h1>
        </div>
        <p><strong>This code will expire in 5 minutes.</strong></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from Opine India. Please do not reply to this email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};

// Password validation helper
exports.validatePassword = (password) => {
  const errors = [];
  
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