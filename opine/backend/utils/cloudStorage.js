const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { PassThrough } = require('stream');
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

    // CRITICAL FIX: Use streaming instead of loading entire file into memory
    // Top tech companies (Amazon, Meta) use streaming for large file uploads
    // This prevents loading 1GB+ audio files into memory
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / 1024 / 1024;
    
    if (fileSizeMB > 10) {
      console.log(`📤 Streaming large file to S3: ${fileSizeMB.toFixed(2)}MB (${filePath})`);
    }
    
    // Use file stream instead of readFileSync to prevent memory leaks
    const fileStream = fs.createReadStream(filePath);
    
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
      Body: fileStream, // Use stream instead of buffer
      ContentType: contentType,
      Metadata: {
        ...(options.metadata || {}),
        uploadedAt: new Date().toISOString(),
        originalSize: fileStats.size.toString()
      },
      ACL: 'private' // Private by default, use signed URLs for access
    };

    // Use managedUpload for streaming large files
    const result = await s3.upload(params, {
      partSize: 10 * 1024 * 1024, // 10MB parts for large files
      queueSize: 4 // Concurrent uploads
    }).promise();
    
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

/**
 * Stream audio file from S3 through server (proxy)
 * This eliminates cross-region data transfer charges by streaming through server
 * @param {string} audioUrl - Audio URL (S3 key or local path)
 * @param {Object} req - Express request object (for Range header support)
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const streamAudioFromS3 = async (audioUrl, req, res) => {
  try {
    console.log('🔍 streamAudioFromS3 - Received audioUrl:', audioUrl);
    
    if (!audioUrl) {
      return res.status(404).json({ success: false, message: 'Audio URL not provided' });
    }

    // Skip mock URLs
    if (audioUrl.startsWith('mock://') || audioUrl.includes('mock://')) {
      return res.status(400).json({ success: false, message: 'Mock URLs are not supported' });
    }

    // Extract S3 key from audioUrl
    let s3Key = extractS3Key(audioUrl);
    console.log('🔍 streamAudioFromS3 - Extracted S3 key:', s3Key);
    
    // If it's a local path, check if file exists locally first
    if (audioUrl.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../..', audioUrl);
      if (fs.existsSync(localPath)) {
        // File exists locally, stream from local file
        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          // Handle Range requests for seeking
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(localPath, { start, end });
          const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=3600'
          };
          res.writeHead(206, head);
          file.pipe(res);
        } else {
          const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=3600'
          };
          res.writeHead(200, head);
          fs.createReadStream(localPath).pipe(res);
        }
        return;
      } else {
        // File doesn't exist locally, use S3 key
        s3Key = audioUrl.replace('/uploads/', '');
      }
    }

    if (!s3Key) {
      console.error('❌ streamAudioFromS3 - Invalid S3 key extracted from:', audioUrl);
      return res.status(404).json({ success: false, message: 'Invalid audio URL' });
    }

    // Get object metadata from S3
    const headParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key
    };

    console.log('🔍 streamAudioFromS3 - Checking S3 object:', { bucket: BUCKET_NAME, key: s3Key });
    
    let objectMetadata;
    try {
      objectMetadata = await s3.headObject(headParams).promise();
      console.log('✅ streamAudioFromS3 - S3 object found:', {
        size: objectMetadata.ContentLength,
        contentType: objectMetadata.ContentType
      });
    } catch (error) {
      console.error('❌ streamAudioFromS3 - S3 headObject error:', {
        code: error.code,
        message: error.message,
        key: s3Key,
        bucket: BUCKET_NAME
      });
      if (error.code === 'NotFound') {
        return res.status(404).json({ success: false, message: 'Audio file not found in S3' });
      }
      throw error;
    }

    const fileSize = objectMetadata.ContentLength;
    const contentType = objectMetadata.ContentType || 'audio/mpeg';
    const range = req.headers.range;

    // PHASE 3: Backend caching - Check cache first
    const CACHE_DIR = path.join(__dirname, '../../uploads/audio-cache');
    const cacheKey = crypto.createHash('md5').update(s3Key).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.cache`);
    const cacheMetadataPath = path.join(CACHE_DIR, `${cacheKey}.meta`);
    
    // Check if cached file exists and is valid
    let useCache = false;
    if (fs.existsSync(cachePath) && fs.existsSync(cacheMetadataPath)) {
      try {
        const cacheMetadata = JSON.parse(fs.readFileSync(cacheMetadataPath, 'utf8'));
        // Cache is valid if metadata matches (size, contentType)
        if (cacheMetadata.size === fileSize && cacheMetadata.contentType === contentType) {
          const cacheStat = fs.statSync(cachePath);
          // Cache file exists and size matches
          if (cacheStat.size === fileSize) {
            useCache = true;
            console.log('✅ streamAudioFromS3 - Using cached file:', cachePath);
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ streamAudioFromS3 - Cache metadata read error, using S3:', cacheError.message);
      }
    }

    // Get object from S3 (or from cache)
    const getObjectParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key
    };

    if (range) {
      // PHASE 1: HTTP Range Request Support (progressive streaming)
      // Handle Range requests for seeking (partial content) with streaming
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      getObjectParams.Range = `bytes=${start}-${end}`;

      if (useCache) {
        // PHASE 3: Serve from cache with Range support
        const file = fs.createReadStream(cachePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        file.pipe(res);
      } else {
        // PHASE 1: Stream from S3 (don't buffer entire chunk)
        const s3Stream = s3.getObject(getObjectParams).createReadStream();
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        
        // PHASE 2: Stream directly to client (pipe, don't buffer)
        s3Stream.pipe(res);
      }
    } else {
      // PHASE 2: Streaming Proxy (don't buffer entire file)
      // Stream full file without buffering in memory
      if (useCache) {
        // PHASE 3: Serve from cache
        const file = fs.createReadStream(cachePath);
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        file.pipe(res);
      } else {
        // PHASE 2: Stream from S3 directly (pipe, don't buffer)
        const s3Stream = s3.getObject(getObjectParams).createReadStream();
        
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        
        // PHASE 2: Stream directly to client
        // PHASE 3: Cache in background (stream to cache and client simultaneously)
        const cacheWriteStream = fs.createWriteStream(cachePath);
        const metadataWriteStream = fs.createWriteStream(cacheMetadataPath);
        
        // Write metadata (async, don't block)
        metadataWriteStream.write(JSON.stringify({
          s3Key: s3Key,
          size: fileSize,
          contentType: contentType,
          cachedAt: new Date().toISOString()
        }));
        metadataWriteStream.end();
        
        // PHASE 3: Cache strategy - Stream to cache in background (non-blocking)
        // Use PassThrough stream to split the stream to both cache and client
        const passThrough = new PassThrough();
        
        // Handle S3 stream errors
        s3Stream.on('error', (error) => {
          console.error('❌ streamAudioFromS3 - S3 stream error:', error);
          cacheWriteStream.destroy();
          passThrough.destroy();
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to stream audio file' });
          }
        });
        
        // Pipe S3 stream through PassThrough (allows splitting)
        s3Stream.pipe(passThrough);
        
        // Pipe to client (primary - don't wait for cache)
        passThrough.pipe(res);
        
        // Pipe to cache (secondary - in background)
        passThrough.pipe(cacheWriteStream);
        
        // Handle cache completion (non-blocking)
        cacheWriteStream.on('finish', () => {
          console.log('✅ streamAudioFromS3 - File cached successfully:', cachePath);
        });
        
        cacheWriteStream.on('error', (error) => {
          console.warn('⚠️ streamAudioFromS3 - Cache write error (non-critical):', error.message);
          // Don't fail request if cache fails - just log warning
        });
      }
    }
  } catch (error) {
    console.error('Error streaming audio from S3:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream audio file', error: error.message });
    }
  }
};

/**
 * Download audio from provider recording URL and upload to S3
 * @param {string} recordingUrl - Recording URL (DeepCall or other provider)
 * @param {string} callId - CATI call ID (for S3 key generation)
 * @param {Object} options - Options including DEEPCALL_TOKEN, DEEPCALL_USER_ID, source
 * @returns {Promise<{s3Key: string, fileSize: number, duration?: number}>} - S3 key and metadata
 */
const downloadAndUploadCatiAudio = async (recordingUrl, callId, options = {}) => {
  const axios = require('axios');
  const { uploadBufferToS3, generateAudioKey } = require('./cloudStorage');
  
  if (!recordingUrl || !callId) {
    throw new Error('Recording URL and callId are required');
  }

  const DEEPCALL_TOKEN = options.DEEPCALL_TOKEN || process.env.DEEPCALL_TOKEN || '6GQJuwW6lB8ZBHntzaRU';
  const DEEPCALL_USER_ID = options.DEEPCALL_USER_ID || process.env.DEEPCALL_USER_ID || '89130240';
  const source = options.source || (() => {
    try {
      const host = new URL(String(recordingUrl)).hostname || '';
      return host.includes('sarv.com') ? 'deepcall' : 'provider';
    } catch (_) {
      return 'provider';
    }
  })();

  console.log(`📥 Downloading CATI audio (${source}) for callId: ${callId}`);
  
  let recordingResponse = null;
  let lastError = null;

  if (source !== 'deepcall') {
    // Non-DeepCall: do NOT mutate query params (could break signed URLs)
    try {
      recordingResponse = await axios.get(recordingUrl, {
        headers: {
          'User-Agent': 'OpineCATI/1.0',
          'Accept': 'audio/*, */*'
        },
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5,
        maxContentLength: 100 * 1024 * 1024
      });
      console.log('✅ Successfully downloaded recording (no auth)');
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      if (error.response?.status === 404) {
        throw new Error('RECORDING_DELETED');
      }
      throw new Error(`Failed to download recording: ${error.message}`);
    }
  } else {
    // DeepCall: Try with token as query parameter
  try {
      const urlWithToken = new URL(recordingUrl);
    urlWithToken.searchParams.set('token', DEEPCALL_TOKEN);
    urlWithToken.searchParams.set('user_id', DEEPCALL_USER_ID);
    
    recordingResponse = await axios.get(urlWithToken.toString(), {
      headers: {
        'User-Agent': 'SarvCT/1.0',
        'Accept': 'audio/mpeg, audio/*, */*'
      },
      responseType: 'arraybuffer', // Use arraybuffer to get full file in memory
      timeout: 60000, // 60 seconds timeout
      maxRedirects: 5,
      maxContentLength: 100 * 1024 * 1024 // 100MB max file size
    });
    console.log('✅ Successfully downloaded recording with token query params');
  } catch (error1) {
    console.log('⚠️  Method 1 (token query) failed:', error1.message);
    lastError = error1;
    
    // Method 2: Try with Bearer token in header
    try {
        recordingResponse = await axios.get(recordingUrl, {
        headers: {
          'Authorization': `Bearer ${DEEPCALL_TOKEN}`,
          'User-Agent': 'SarvCT/1.0',
          'Accept': 'audio/mpeg, audio/*, */*'
        },
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5,
        maxContentLength: 100 * 1024 * 1024
      });
      console.log('✅ Successfully downloaded recording with Bearer token');
    } catch (error2) {
      console.log('⚠️  Method 2 (Bearer token) failed:', error2.message);
      lastError = error2;
      
      // Method 3: Try without authentication
      try {
          recordingResponse = await axios.get(recordingUrl, {
          headers: {
            'User-Agent': 'SarvCT/1.0',
            'Accept': 'audio/mpeg, audio/*, */*'
          },
          responseType: 'arraybuffer',
          timeout: 60000,
          maxRedirects: 5,
          maxContentLength: 100 * 1024 * 1024
        });
        console.log('✅ Successfully downloaded recording without auth');
      } catch (error3) {
        console.error('❌ All download methods failed. Last error:', error3.message);
        if (error3.response?.status === 404) {
          throw new Error('RECORDING_DELETED'); // Special error for deleted recordings
        }
        throw new Error(`Failed to download recording: ${error3.message}`);
        }
      }
    }
  }

  if (!recordingResponse || !recordingResponse.data) {
    throw new Error('No data received from DeepCall');
  }

  const audioBuffer = Buffer.from(recordingResponse.data);
  const fileSize = audioBuffer.length;
  console.log(`✅ Downloaded ${(fileSize / 1024 / 1024).toFixed(2)} MB from DeepCall`);

  // Generate S3 key: audio/cati/YYYY/MM/callId_timestamp.mp3
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime();
  const s3Key = `audio/cati/${year}/${month}/${callId}_${timestamp}.mp3`;

  console.log(`📤 Uploading to S3: ${s3Key}`);
  
  // Upload to S3
  const uploadResult = await uploadBufferToS3(audioBuffer, s3Key, {
    contentType: 'audio/mpeg',
    metadata: {
      source: source,
      callId: callId,
      originalUrl: recordingUrl,
      uploadedAt: now.toISOString()
    }
  });

  console.log(`✅ Successfully uploaded to S3: ${s3Key}`);

  return {
    s3Key: uploadResult.key,
    fileSize: fileSize,
    contentType: 'audio/mpeg'
  };
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
  streamAudioFromS3,
  downloadAndUploadCatiAudio,
  BUCKET_NAME
};
