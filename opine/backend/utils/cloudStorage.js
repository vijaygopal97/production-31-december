const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'convergent-audio-documents-bucket';

/**
 * Upload file to AWS S3
 * @param {string} filePath - Local file path
 * @param {string} key - S3 object key (e.g., 'audio/interviews/2024/12/file.m4a')
 * @param {Object} options - Upload options
 * @param {string} options.contentType - MIME type (auto-detected if not provided)
 * @param {Object} options.metadata - File metadata
 * @returns {Promise<{key: string, url: string}>} - S3 key and URL
 */
const uploadToS3 = async (filePath, key, options = {}) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);
    const fileStats = fs.statSync(filePath);
    
    // Auto-detect content type if not provided
    let contentType = options.contentType;
    if (!contentType) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.m4a': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.webm': 'audio/webm',
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      contentType = contentTypes[ext] || 'application/octet-stream';
    }
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        ...(options.metadata || {}),
        uploadedAt: new Date().toISOString(),
        originalSize: fileStats.size.toString()
      },
      ACL: 'private' // Private by default, use signed URLs for access
    };

    const result = await s3.upload(params).promise();
    
    // Return S3 key (not full URL) - we'll use signed URLs for access
    return {
      key: result.Key,
      url: result.Location, // Full S3 URL (for reference, but use signed URLs)
      bucket: result.Bucket,
      etag: result.ETag
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

/**
 * Upload file buffer directly to S3 (for in-memory files)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} key - S3 object key
 * @param {Object} options - Upload options
 * @returns {Promise<{key: string, url: string}>} - S3 key and URL
 */
const uploadBufferToS3 = async (fileBuffer, key, options = {}) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: {
        ...(options.metadata || {}),
        uploadedAt: new Date().toISOString()
      },
      ACL: 'private'
    };

    const result = await s3.upload(params).promise();
    
    return {
      key: result.Key,
      url: result.Location,
      bucket: result.Bucket,
      etag: result.ETag
    };
  } catch (error) {
    console.error('Error uploading buffer to S3:', error);
    throw error;
  }
};

/**
 * Generate pre-signed URL for secure access to S3 object
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Pre-signed URL
 */
const getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    // Handle both S3 keys and old local paths
    let s3Key = key;
    
    // If it's a local path like /uploads/audio/file.m4a, convert to S3 key
    if (key.startsWith('/uploads/')) {
      s3Key = key.replace('/uploads/', '');
    }
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Expires: expiresIn
    };

    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
};

/**
 * Get signed URL from audioUrl (handles both S3 keys and local paths)
 * @param {string} audioUrl - Audio URL (can be S3 key or local path)
 * @param {number} expiresIn - URL expiration time in seconds
 * @returns {Promise<string>} - Pre-signed URL or local URL
 */
const getAudioSignedUrl = async (audioUrl, expiresIn = 3600) => {
  try {
    if (!audioUrl) {
      return null;
    }

    // Skip mock/test URLs - these are not real files
    if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
      console.warn('⚠️ Skipping mock URL:', audioUrl);
      return null;
    }

    // If it's already a full URL (http/https), return as is (unless it's a mock URL)
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      // Check if it's a mock URL that was URL-encoded
      if (audioUrl.includes('mock%3A//') || audioUrl.includes('mock://')) {
        console.warn('⚠️ Skipping mock URL (encoded):', audioUrl);
        return null;
      }
      return audioUrl;
    }

    // If it's a local path, check if we should convert to S3
    if (audioUrl.startsWith('/uploads/')) {
      // Check if file exists locally
      const localPath = path.join(__dirname, '../..', audioUrl);
      if (fs.existsSync(localPath)) {
        // File exists locally, return local URL (for backward compatibility during migration)
        return audioUrl;
      } else {
        // File doesn't exist locally, try to get from S3
        const s3Key = audioUrl.replace('/uploads/', '');
        return await getSignedUrl(s3Key, expiresIn);
      }
    }

    // Assume it's an S3 key
    return await getSignedUrl(audioUrl, expiresIn);
  } catch (error) {
    console.error('Error getting audio signed URL:', error);
    // Fallback to original URL (but check if it's a mock URL first)
    if (audioUrl && !audioUrl.startsWith('mock://') && !audioUrl.includes('mock://')) {
      return audioUrl;
    }
    return null;
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - Success status
 */
const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
};

/**
 * Check if file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - True if file exists
 */
const fileExistsInS3 = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * List files in S3 with prefix
 * @param {string} prefix - S3 key prefix (e.g., 'audio/interviews/')
 * @returns {Promise<Array>} - Array of file keys
 */
const listFilesInS3 = async (prefix = '') => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents.map(item => item.Key);
  } catch (error) {
    console.error('Error listing files in S3:', error);
    throw error;
  }
};

/**
 * Extract S3 key from URL or path
 * @param {string} urlOrPath - Can be S3 URL, local path, or S3 key
 * @returns {string} - S3 key
 */
const extractS3Key = (urlOrPath) => {
  if (!urlOrPath) return null;
  
  // If it's a full S3 URL
  if (urlOrPath.includes('.s3.') || urlOrPath.includes('s3://')) {
    const match = urlOrPath.match(/s3:\/\/[^\/]+\/(.+)$/) || urlOrPath.match(/\.s3\.[^\/]+\/(.+)$/);
    if (match) return match[1];
  }
  
  // If it's a local path
  if (urlOrPath.startsWith('/uploads/')) {
    return urlOrPath.replace('/uploads/', '');
  }
  
  // Assume it's already an S3 key
  return urlOrPath;
};

/**
 * Check if S3 is configured
 * @returns {boolean}
 */
const isS3Configured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET_NAME);
};

/**
 * Generate S3 key for audio file
 * @param {string} sessionId - Interview session ID
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
const generateAudioKey = (sessionId, filename) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `audio/interviews/${year}/${month}/${sessionId}_${Date.now()}_${filename}`;
};

/**
 * Generate S3 key for document
 * @param {string} documentType - Type of document (aadhaar, pan, passport, bank, cv)
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
const generateDocumentKey = (documentType, userId, filename) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(filename);
  const uniqueName = `${documentType}-${userId}-${Date.now()}${ext}`;
  return `documents/${documentType}/${year}/${month}/${uniqueName}`;
};

/**
 * Generate S3 key for report
 * @param {string} reportType - Type of report (survey-report, analytics, etc.)
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
const generateReportKey = (reportType, filename) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `reports/${reportType}/${year}/${month}/${Date.now()}_${filename}`;
};

module.exports = {
  uploadToS3,
  uploadBufferToS3,
  getSignedUrl,
  getAudioSignedUrl,
  deleteFromS3,
  fileExistsInS3,
  listFilesInS3,
  extractS3Key,
  isS3Configured,
  generateAudioKey,
  generateDocumentKey,
  generateReportKey,
  BUCKET_NAME
};
