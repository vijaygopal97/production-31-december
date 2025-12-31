const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/interviewer-documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get interviewer profile by ID (for company admins)
const getInterviewerProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('+interviewerProfile');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType !== 'interviewer') {
      return res.status(400).json({ message: 'User is not an interviewer' });
    }

    // Add signed URLs to document fields
    const { getSignedUrl } = require('../utils/cloudStorage');
    const profileObj = user.toObject ? user.toObject() : user;
    if (profileObj.interviewerProfile) {
      const docFields = ['cvUpload', 'aadhaarDocument', 'panDocument', 'passportPhoto', 'bankDocumentUpload'];
      for (const field of docFields) {
        if (profileObj.interviewerProfile[field]) {
          try {
            const signedUrl = await getSignedUrl(profileObj.interviewerProfile[field], 3600);
            profileObj.interviewerProfile[field + 'SignedUrl'] = signedUrl;
          } catch (error) {
            console.error(`Error generating signed URL for ${field}:`, error);
            // Continue without signed URL
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        _id: profileObj._id,
        firstName: profileObj.firstName,
        lastName: profileObj.lastName,
        email: profileObj.email,
        phone: profileObj.phone,
        userType: profileObj.userType,
        status: profileObj.status,
        createdAt: profileObj.createdAt,
        updatedAt: profileObj.updatedAt,
        interviewerProfile: profileObj.interviewerProfile || {}
      }
    });
  } catch (error) {
    console.error('Error fetching interviewer profile by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get interviewer profile
const getInterviewerProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('+interviewerProfile');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        basicDetails: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone
        },
        interviewerProfile: user.interviewerProfile || {}
      }
    });
  } catch (error) {
    console.error('Error fetching interviewer profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update interviewer profile
const updateInterviewerProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Get the current user to check existing data
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentProfile = currentUser.interviewerProfile || {};
    
    // Check if verification fields have been changed
    const verificationFields = ['aadhaarNumber', 'aadhaarDocument', 'panNumber', 'panDocument', 'passportPhoto'];
    
    console.log('🔍 Debugging verification change detection:');
    console.log('Current approval status:', currentProfile.approvalStatus);
    console.log('Update data keys:', Object.keys(updateData));
    console.log('Current profile verification fields:', {
      aadhaarNumber: currentProfile.aadhaarNumber,
      aadhaarDocument: currentProfile.aadhaarDocument,
      panNumber: currentProfile.panNumber,
      panDocument: currentProfile.panDocument,
      passportPhoto: currentProfile.passportPhoto
    });
    console.log('Update data verification fields:', {
      aadhaarNumber: updateData.aadhaarNumber,
      aadhaarDocument: updateData.aadhaarDocument,
      panNumber: updateData.panNumber,
      panDocument: updateData.panDocument,
      passportPhoto: updateData.passportPhoto
    });
    
    const verificationChanged = verificationFields.some(field => {
      const hasChanged = updateData[field] !== undefined && updateData[field] !== currentProfile[field];
      if (hasChanged) {
        console.log(`✅ Verification field changed: ${field}`);
        console.log(`  Old value: ${currentProfile[field]}`);
        console.log(`  New value: ${updateData[field]}`);
      }
      return hasChanged;
    });

    console.log('Verification changed:', verificationChanged);

    // If verification fields changed and profile was approved, set status to unverified
    if (verificationChanged && currentProfile.approvalStatus === 'approved') {
      console.log('🔄 Setting status to unverified due to verification changes');
      updateData.approvalStatus = 'unverified';
      updateData.approvalFeedback = ''; // Clear previous feedback
    }

    // Remove fields that shouldn't be updated directly (except when we explicitly set them above)
    if (!updateData.approvalStatus) {
      delete updateData.approvalStatus;
    } else {
      console.log('🔄 Approval status will be updated to:', updateData.approvalStatus);
    }
    delete updateData.approvedBy;
    delete updateData.approvedAt;
    delete updateData.lastSubmittedAt;

    // Merge the update data with existing interviewerProfile
    const mergedProfile = { ...currentProfile, ...updateData };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { interviewerProfile: mergedProfile } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ Profile updated successfully. New approval status:', user.interviewerProfile.approvalStatus);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.interviewerProfile
    });
  } catch (error) {
    console.error('Error updating interviewer profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Submit profile for approval
const submitProfileForApproval = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Allow both company-associated and independent interviewers to submit for approval
    // Independent interviewers will be reviewed by super admin
    // Company-associated interviewers will be reviewed by their company admin

    // Update approval status to pending
    user.interviewerProfile.approvalStatus = 'pending';
    user.interviewerProfile.lastSubmittedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Profile submitted for approval successfully'
    });
  } catch (error) {
    console.error('Error submitting profile for approval:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get pending profiles for company admin (only company-associated interviewers)
const getPendingProfiles = async (req, res) => {
  try {
    const companyId = req.user.company;
    
    // Only company admins can access this
    if (req.user.userType !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company admin only.'
      });
    }
    
    const pendingProfiles = await User.find({
      company: companyId, // Only show interviewers from this company
      userType: 'interviewer',
      'interviewerProfile.approvalStatus': 'pending'
    }).select('firstName lastName email phone interviewerProfile');

    // Add signed URLs to document fields
    const { getSignedUrl } = require('../utils/cloudStorage');
    const profilesWithSignedUrls = await Promise.all(pendingProfiles.map(async (profile) => {
      const profileObj = profile.toObject ? profile.toObject() : profile;
      if (profileObj.interviewerProfile) {
        const docFields = ['cvUpload', 'aadhaarDocument', 'panDocument', 'passportPhoto', 'bankDocumentUpload'];
        for (const field of docFields) {
          if (profileObj.interviewerProfile[field]) {
            try {
              const signedUrl = await getSignedUrl(profileObj.interviewerProfile[field], 3600);
              profileObj.interviewerProfile[field + 'SignedUrl'] = signedUrl;
            } catch (error) {
              console.error(`Error generating signed URL for ${field}:`, error);
              // Continue without signed URL
            }
          }
        }
      }
      return profileObj;
    }));

    res.json({
      success: true,
      data: profilesWithSignedUrls
    });
  } catch (error) {
    console.error('Error fetching pending profiles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Approve or reject profile
const reviewProfile = async (req, res) => {
  try {
    const { userId, status, feedback } = req.body; // status: 'approved' or 'rejected'
    const reviewerId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the reviewer is a company admin of the same company
    if (req.user.userType !== 'company_admin' || !user.company || user.company.toString() !== req.user.company.toString()) {
      return res.status(403).json({ message: 'Unauthorized to review this profile' });
    }

    // Update approval status
    user.interviewerProfile.approvalStatus = status;
    user.interviewerProfile.approvalFeedback = feedback;
    user.interviewerProfile.approvedBy = reviewerId;
    user.interviewerProfile.approvedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `Profile ${status} successfully`
    });
  } catch (error) {
    console.error('Error reviewing profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get pending profiles for super admin (independent interviewers)
const getIndependentInterviewerProfiles = async (req, res) => {
  try {
    // Only super admin can access this
    if (req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.'
      });
    }

    const pendingProfiles = await User.find({
      $or: [
        { company: { $exists: false } }, // No company field
        { company: null } // Company field exists but is null
      ],
      userType: 'interviewer',
      'interviewerProfile.approvalStatus': 'pending'
    }).select('firstName lastName email phone interviewerProfile');

    // Add signed URLs to document fields
    const { getSignedUrl } = require('../utils/cloudStorage');
    const profilesWithSignedUrls = await Promise.all(pendingProfiles.map(async (profile) => {
      const profileObj = profile.toObject ? profile.toObject() : profile;
      if (profileObj.interviewerProfile) {
        const docFields = ['cvUpload', 'aadhaarDocument', 'panDocument', 'passportPhoto', 'bankDocumentUpload'];
        for (const field of docFields) {
          if (profileObj.interviewerProfile[field]) {
            try {
              const signedUrl = await getSignedUrl(profileObj.interviewerProfile[field], 3600);
              profileObj.interviewerProfile[field + 'SignedUrl'] = signedUrl;
            } catch (error) {
              console.error(`Error generating signed URL for ${field}:`, error);
              // Continue without signed URL
            }
          }
        }
      }
      return profileObj;
    }));

    res.json({
      success: true,
      data: profilesWithSignedUrls
    });
  } catch (error) {
    console.error('Error fetching independent interviewer profiles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Review independent interviewer profile (super admin only)
const reviewIndependentInterviewerProfile = async (req, res) => {
  try {
    console.log('🔍 reviewIndependentInterviewerProfile called');
    console.log('📝 Request params:', req.params);
    console.log('📝 Request body:', req.body);
    console.log('👤 User info:', { id: req.user._id, userType: req.user.userType, email: req.user.email });
    
    const { userId } = req.params;
    const { status, feedback } = req.body;

    // Only super admin can access this
    if (req.user.userType !== 'super_admin') {
      console.log('❌ Access denied - not super admin');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.'
      });
    }

    // Validate status
    if (!['approved', 'rejected', 'changes_requested'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved, rejected, or changes_requested.'
      });
    }

    // Check if user exists and is an independent interviewer
    console.log('🔍 Looking for user with ID:', userId);
    const user = await User.findOne({
      _id: userId,
      $or: [
        { company: { $exists: false } }, // No company field
        { company: null } // Company field exists but is null
      ],
      userType: 'interviewer'
    });

    console.log('👤 Found user:', user ? { id: user._id, email: user.email, company: user.company, userType: user.userType } : 'null');

    if (!user) {
      console.log('❌ User not found - returning 404');
      return res.status(404).json({
        success: false,
        message: 'Independent interviewer not found.'
      });
    }

    // Update the profile
    const updateData = {
      'interviewerProfile.approvalStatus': status,
      'interviewerProfile.approvalFeedback': feedback || '',
      'interviewerProfile.reviewedAt': new Date(),
      'interviewerProfile.reviewedBy': req.user._id
    };

    await User.findByIdAndUpdate(userId, updateData);

    res.json({
      success: true,
      message: `Profile ${status} successfully.`
    });
  } catch (error) {
    console.error('Error reviewing independent interviewer profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getInterviewerProfileById,
  getInterviewerProfile,
  updateInterviewerProfile,
  submitProfileForApproval,
  getPendingProfiles,
  reviewProfile,
  getIndependentInterviewerProfiles,
  reviewIndependentInterviewerProfile
};

