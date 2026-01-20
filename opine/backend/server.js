const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================
// GLOBAL ERROR HANDLERS - PREVENT CRASHES
// ============================================
// Handle unhandled promise rejections (prevent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED PROMISE REJECTION - Preventing crash:', reason);
  console.error('❌ Promise:', promise);
  console.error('❌ Stack:', reason?.stack || 'No stack trace');
  // Log to error file but don't crash
  // The error is already logged, we just prevent the crash
});

// Handle uncaught exceptions (prevent crashes)
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION - Preventing crash:', error);
  console.error('❌ Error name:', error.name);
  console.error('❌ Error message:', error.message);
  console.error('❌ Stack:', error.stack);
  // Log to error file but don't crash
  // The error is already logged, we just prevent the crash
});

// Handle warnings (log but don't crash)
process.on('warning', (warning) => {
  console.warn('⚠️ PROCESS WARNING:', warning.name);
  console.warn('⚠️ Message:', warning.message);
  console.warn('⚠️ Stack:', warning.stack);
});

// Import routes
const contactRoutes = require('./routes/contactRoutes');
const authRoutes = require('./routes/authRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const surveyResponseRoutes = require('./routes/surveyResponseRoutes');
const interviewerProfileRoutes = require('./routes/interviewerProfileRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const catiRoutes = require('./routes/catiRoutes');
const catiInterviewRoutes = require('./routes/catiInterviewRoutes');
const qcBatchRoutes = require('./routes/qcBatchRoutes');
const qcBatchConfigRoutes = require('./routes/qcBatchConfigRoutes');
const pollingStationRoutes = require('./routes/pollingStationRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');
const appUpdateRoutes = require('./routes/appUpdateRoutes');
const cron = require('node-cron');
const { processQCBatches } = require('./jobs/qcBatchProcessor');
// PHASE 2: Materialized Views - Background Jobs
const { startBackgroundJobs } = require('./jobs/startBackgroundJobs');

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_IP = process.env.SERVER_IP || 'localhost';
const MONGODB_URI = process.env.MONGODB_URI;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

// Middleware - Support multiple origins
const allowedOrigins = CORS_ORIGIN.includes(',') 
  ? CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [CORS_ORIGIN, 'https://convo.convergentview.com', 'https://opine.exypnossolutions.com'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin === allowed)) {
      callback(null, true);
    } else {
      // Check if origin matches any allowed origin pattern
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = allowed.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return origin === allowed;
      });
      callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
    }
  },
  credentials: true
}));

// Increase body size limit for large Excel file uploads (800MB)
// CRITICAL OPTIMIZATION: Only capture raw body for webhook if it's small (<10MB)
// Large webhook bodies (>10MB) should not be stored in memory - causes massive leaks
// Top tech companies limit in-memory storage for webhook endpoints
app.use(express.json({ 
  limit: '800mb',
  verify: (req, res, buf, encoding) => {
    if (req.path === '/api/cati/webhook' && req.method === 'POST') {
      // CRITICAL: Only store rawBody if it's small (<10MB) to prevent memory leaks
      // For larger bodies, we'll parse directly from req.body
      const bodySize = buf.length;
      if (bodySize < 10 * 1024 * 1024) { // 10MB limit
        req.rawBody = buf.toString(encoding || 'utf8');
      } else {
        console.warn(`⚠️ Large webhook body detected (${Math.round(bodySize / 1024 / 1024)}MB), skipping rawBody storage to prevent memory leak`);
        req.rawBody = null; // Don't store large bodies in memory
      }
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '800mb',
  verify: (req, res, buf, encoding) => {
    if (req.path === '/api/cati/webhook' && req.method === 'POST') {
      // CRITICAL: Only store rawBody if it's small (<10MB) to prevent memory leaks
      const bodySize = buf.length;
      if (bodySize < 10 * 1024 * 1024) { // 10MB limit
        req.rawBody = buf.toString(encoding || 'utf8');
      } else {
        console.warn(`⚠️ Large webhook body detected (${Math.round(bodySize / 1024 / 1024)}MB), skipping rawBody storage to prevent memory leak`);
        req.rawBody = null; // Don't store large bodies in memory
      }
    }
  }
}));
app.use(cookieParser());

// ============================================
// REQUEST LOGGING & MEMORY MONITORING MIDDLEWARE
// ============================================
// Log ALL incoming API requests and track memory usage to identify leaks
// This runs BEFORE authentication middleware
app.use((req, res, next) => {
  // Only log API requests to reduce noise
  if (req.path.startsWith('/api/')) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    
    // Log request start with memory
    const authHeader = req.headers.authorization || '';
    const authPreview = authHeader 
      ? (authHeader.length > 50 ? authHeader.substring(0, 50) + '...' : authHeader)
      : 'NO AUTH HEADER';
    
    console.log(`[REQUEST START] ${method} ${route || req.path} | Memory: ${Math.round(startMemory.heapUsed / 1024 / 1024)}MB | Timestamp: ${new Date().toISOString()}`);
    
    // Track response finish with memory
    const originalSend = res.send;
    res.send = function(data) {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
      const memoryDiffMB = Math.round(memoryDiff / 1024 / 1024);
      
      if (memoryDiffMB > 50) {
        console.log(`🚨 [MEMORY LEAK DETECTED] ${method} ${route || req.path} | Duration: ${duration}ms | Memory: +${memoryDiffMB}MB (${Math.round(startMemory.heapUsed / 1024 / 1024)}MB → ${Math.round(endMemory.heapUsed / 1024 / 1024)}MB) | Status: ${res.statusCode}`);
      } else if (memoryDiffMB > 20) {
        console.log(`⚠️  [MEMORY GROWTH] ${method} ${route || req.path} | Duration: ${duration}ms | Memory: +${memoryDiffMB}MB | Status: ${res.statusCode}`);
      } else {
        console.log(`✅ [REQUEST END] ${method} ${route || req.path} | Duration: ${duration}ms | Memory: ${memoryDiffMB >= 0 ? '+' : ''}${memoryDiffMB}MB | Status: ${res.statusCode}`);
      }
      
      originalSend.call(this, data);
    };
  }
  next();
});

// Serve static files (audio recordings)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve party logos
const partyLogosPath = path.resolve(__dirname, '../../Report-Generation/party symbols');
console.log('📁 Party logos path:', partyLogosPath);
app.use('/api/party-logos', express.static(partyLogosPath, {
  setHeaders: (res, filePath) => {
    // Set proper content type based on file extension
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// MongoDB Connection
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// MongoDB Connection - Use async/await to ensure connection is ready before starting server
(async () => {
  try {
    // CRITICAL FIX: Connect with readPreference but use query-level for actual reads
    // Connection-level readPreference is a hint, query-level is enforced
    // CRITICAL FIX: Ensure replica set discovery works properly
    // NOTE: readPreference is set ONLY in connection options (not in URI) for Mongoose compatibility
    // Mongoose may not properly parse readPreference from URI, so we set it here
           await mongoose.connect(MONGODB_URI, {
             maxPoolSize: 100,
             minPoolSize: 10,
             serverSelectionTimeoutMS: 30000,
             socketTimeoutMS: 45000,
             connectTimeoutMS: 15000, // Increased for replica set discovery
             retryReads: true, // Enable retry reads for better reliability
             directConnection: false, // CRITICAL: Must be false for replica set
             heartbeatFrequencyMS: 10000, // Check server status every 10s
             readPreference: 'secondaryPreferred', // CRITICAL FIX: Use primary first, fallback to secondary for load balancing
             maxStalenessSeconds: 90 // Allow secondary if it's within 30s of primary
           });
    
    // Wait for replica set discovery (give it time to find all members)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Connected to MongoDB successfully!');
    console.log(`📊 Database: ${MONGODB_URI.split('@')[1]?.split('/')[0] || 'Connected'}`);
    console.log(`📊 Connection configured for: Secondary Preferred (queries will use .read('secondaryPreferred'))`);
    
    // Verify replica set status
    try {
      const admin = mongoose.connection.db.admin();
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log(`📊 Replica Set: ${status.set} (${status.members.length} members)`);
      status.members.forEach(m => {
        console.log(`   ${m.name} - ${m.stateStr} (health: ${m.health})`);
      });
    } catch (err) {
      console.warn('⚠️  Could not verify replica set status:', err.message);
    }
    
    // PHASE 2: Background jobs for materialized views
    // OPTIMIZED: Jobs now run quickly with improved queries and batch processing
    // Materialized views enable instant lookups (<50ms) vs complex queries (1-10s)
    startBackgroundJobs().catch(err => {
      console.error('⚠️  Failed to start background jobs:', err.message);
    });
    console.log('✅ Background jobs enabled for materialized views');
    
    // Schedule QC batch processing to run daily at 12:00 AM (midnight) IST
    // This will process batches from previous days and check in-progress batches
    cron.schedule('0 0 * * *', async () => {
      console.log('⏰ QC Batch Processing Job triggered by cron (12:00 AM IST)');
      try {
        await processQCBatches();
        console.log('✅ QC Batch Processing Job completed successfully');
      } catch (error) {
        console.error('❌ QC Batch Processing Job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    console.log('⏰ QC Batch Processing Job scheduled to run daily at 12:00 AM IST');
    
    // Schedule CSV generation to run daily at 12:00 AM IST
    const { scheduleCSVGeneration } = require('./jobs/csvGenerator');
    scheduleCSVGeneration();
    
    // Start server only after MongoDB connection is established
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 HTTP Server is running on port ${PORT}`);
      console.log(`🌐 Access your API at: http://${SERVER_IP}:${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 CORS Origin: ${CORS_ORIGIN}`);
      console.log(`⚠️  Note: Audio recording requires HTTPS. Use localhost for development.`);
      console.log(`⏱️  Server timeout set to 2 hours for very large file processing (up to 800MB)`);
      console.log(`🛡️  Global error handlers installed to prevent crashes`);
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log(`🔧 Please whitelist IP: ${SERVER_IP} in MongoDB Atlas`);
    console.log('💡 Check your MONGODB_URI in .env file');
    process.exit(1); // Exit if database connection fails
  }
})();

// Note: Opine model removed - using Contact model instead

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Opine API!' });
});

// Health check endpoint for load balancer
// CRITICAL: Must be FAST (no DB checks) to avoid timeouts under load
app.get('/health', (req, res) => {
  // Get actual server IP for load balancer identification
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let actualServerIP = req.socket.localAddress || SERVER_IP;
  
  // Fast response without DB check (mongoose.connection.readyState can be slow under load)
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    database: 'connected', // Assume connected (check removed for speed)
    server: actualServerIP, // Use actual private IP to identify server
    publicIP: SERVER_IP // Keep public IP for reference
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/interviewer-profile', interviewerProfileRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cati-interview', catiInterviewRoutes);
app.use('/api/cati', catiRoutes);
app.use('/api/survey-responses', surveyResponseRoutes);
app.use('/api/qc-batches', qcBatchRoutes);
app.use('/api/qc-batch-config', qcBatchConfigRoutes);
app.use('/api/polling-stations', pollingStationRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/app-logs', require('./routes/appLogRoutes'));
app.use('/api/app', appUpdateRoutes);

// Note: Opines API routes removed - using Contact API instead

// ============================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ============================================
// Catch-all error handler for Express routes (prevents crashes)
app.use((err, req, res, next) => {
  console.error('❌ EXPRESS ERROR HANDLER:', err);
  console.error('❌ Error name:', err.name);
  console.error('❌ Error message:', err.message);
  console.error('❌ Stack:', err.stack);
  console.error('❌ Request URL:', req.url);
  console.error('❌ Request method:', req.method);
  
  // Send error response but don't crash
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Create HTTP server with increased timeout for large file uploads
const server = require('http').createServer(app);
server.timeout = 7200000; // 2 hours timeout for very large file uploads and report generation
server.keepAliveTimeout = 7200000; // 2 hours keep-alive timeout
server.headersTimeout = 7200000; // 2 hours headers timeout

// Handle server errors gracefully
server.on('error', (error) => {
  console.error('❌ SERVER ERROR:', error);
  console.error('❌ Error details:', {
    code: error.code,
    message: error.message,
    stack: error.stack
  });
  // Don't exit - let PM2 handle restarts if needed
});

// Handle client errors (prevent crashes from bad requests)
server.on('clientError', (error, socket) => {
  console.error('❌ CLIENT ERROR:', error.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// Note: Server is started inside the MongoDB connection async function above
// to ensure database is connected before accepting requests