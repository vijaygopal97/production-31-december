# 🎯 Project Understanding Document

## 📋 Overview

This document provides a comprehensive understanding of the Opine India platform - a MERN stack web application and connected React Native mobile application for market research data collection.

---

## 🖥️ Server Architecture

### **Development Server (Current Server)**
- **Location**: `/var/www/opine` and `/var/www/Opine-Android`
- **Purpose**: Development and testing environment
- **Status**: This is the server we are currently working on
- **Database**: Development MongoDB instance
- **Access**: Direct file system access

### **Production Server (SSH Server)**
- **SSH Connection**: `ubuntu@13.202.181.167`
- **SSH Key Location**: `/var/www/MyLogos/Convergent-New.pem`
- **Purpose**: Live production environment serving real users
- **Database**: Production MongoDB at `13.202.181.167:27017`
- **Access**: Via SSH using the PEM key file
- **Domain**: `convo.convergentview.com` and `opine.exypnossolutions.com`

**⚠️ CRITICAL**: The production server is live and serves real users. All changes must be carefully tested on the development server first.

---

## 📁 Project Structure

### 1. **MERN Stack Web Application** (`/var/www/opine`)

#### **Backend** (`/var/www/opine/backend`)
- **Technology**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Port**: 5000 (default)
- **Main File**: `server.js`
- **Key Features**:
  - RESTful API endpoints
  - JWT authentication
  - File upload handling (audio recordings, images)
  - CORS configuration for multiple origins
  - PM2 process management (5 instances)
  - Scheduled cron jobs (QC batch processing, CSV generation)
  - Webhook support for DeepCall integration

**Key Models**:
- `User.js` - User accounts (interviewers, project managers, quality agents)
- `Survey.js` - Survey definitions
- `SurveyResponse.js` - Survey responses from interviewers
- `CatiCall.js` - CATI (Computer-Assisted Telephone Interviewing) calls
- `CatiRespondentQueue.js` - Queue management for CATI
- `QCBatch.js` - Quality Control batch processing
- `Contact.js` - Respondent contacts
- `Company.js` - Company/organization data

**Key Routes**:
- `/api/auth` - Authentication endpoints
- `/api/surveys` - Survey management
- `/api/survey-responses` - Response submission and retrieval
- `/api/cati` - CATI interview management
- `/api/performance` - Interviewer performance metrics
- `/api/reports` - Analytics and reporting
- `/api/qc-batches` - Quality control batch management

**Environment Variables** (`.env`):
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - JWT token secret
- `CORS_ORIGIN` - Allowed CORS origins
- `SERVER_IP` - Server IP address
- `NODE_ENV` - Environment (development/production)

#### **Frontend** (`/var/www/opine/frontend`)
- **Technology**: React 19 with Vite
- **Styling**: Tailwind CSS
- **Port**: 3000 (development), served via Nginx in production
- **Build Output**: `/var/www/opine/frontend/dist`
- **Key Features**:
  - SEO optimization with environment control
  - Responsive design
  - Chart.js for analytics visualization
  - React Router for navigation
  - Axios for API communication

**Production Deployment**:
- Nginx serves static files from `/var/www/opine/frontend/dist`
- SSL/HTTPS configured with Let's Encrypt
- API requests proxied through Nginx to backend on port 5000
- Domain: `convo.convergentview.com`

**Environment Variables** (`.env`):
- `VITE_API_BASE_URL` - Backend API URL (empty string in production for relative paths)
- `VITE_ENABLE_SEO_INDEXING` - SEO indexing control
- `VITE_APP_NAME` - Application name

### 2. **React Native Mobile Application** (`/var/www/Opine-Android`)

- **Technology**: React Native with Expo (~54.0.30)
- **Platform**: Android (primary), iOS support
- **TypeScript**: Yes
- **Main Entry**: `App.tsx` and `index.ts`

**Key Features**:
- **Authentication**: Secure login for interviewers
- **Interview Interface**: 
  - Native GPS location tracking
  - Audio recording for CAPI interviews
  - Multiple question types (text, multiple choice, rating, date, number)
  - Offline data storage and sync
- **Dashboard**: Interviewer dashboard with survey overview
- **My Interviews**: View and manage interview history
- **Quality Agent Dashboard**: QC agent interface

**Key Screens**:
- `SplashScreen.tsx` - App initialization
- `LoginScreen.tsx` - User authentication
- `InterviewerDashboard.tsx` - Main dashboard
- `AvailableSurveys.tsx` - Browse available surveys
- `MyInterviews.tsx` - Interview history
- `InterviewInterface.tsx` - Active interview interface
- `QualityAgentDashboard.tsx` - QC agent interface

**Key Services**:
- `api.ts` - API service (connects to `https://convo.convergentview.com`)
- `offlineStorage.ts` - Local data persistence
- `syncService.ts` - Data synchronization
- `appLoggingService.ts` - Application logging
- `pollingStationsSyncService.ts` - Polling station data sync

**API Configuration**:
- **Base URL**: `https://convo.convergentview.com`
- Configured in `src/services/api.ts`
- Supports offline mode and network condition emulation

---

## 🔄 Data Flow

### **Survey Response Flow**:
1. **Mobile App** → Interviewer conducts interview → Response saved locally
2. **Mobile App** → Syncs with backend API → Response uploaded to server
3. **Backend** → Stores in MongoDB → Processes for QC batches
4. **Web Dashboard** → Project managers/QC agents review responses
5. **Reports** → Analytics and reports generated

### **CATI (Telephone Interviewing) Flow**:
1. **Web Dashboard** → Create CATI survey → Assign to CATI interviewers
2. **Backend** → Manages respondent queue → DeepCall webhook integration
3. **CATI Interviewer** → Makes calls via web interface → Records responses
4. **Backend** → Processes call data → Updates queue status

---

## 🗄️ Database Architecture

### **MongoDB Collections**:
- **Users**: Interviewers, project managers, quality agents, companies
- **Surveys**: Survey definitions with questions and configurations
- **SurveyResponses**: Completed interview responses with audio recordings
- **CatiCalls**: CATI call records and status
- **CatiRespondentQueue**: Queue management for CATI interviews
- **QCBatches**: Quality control batch assignments
- **Contacts**: Respondent contact information
- **Companies**: Organization/company data

### **Database Sync**:
- Production database: `13.202.181.167:27017/Opine`
- Development database: Local or separate instance
- Sync scripts available in `/var/www/opine/backend/scripts/`:
  - `syncDatabaseFromProduction.js` - Full database sync (READ-ONLY on production)
  - `copyTodayResponsesFromProdSSH.js` - Copy today's responses via SSH

---

## 🔐 Security & Authentication

- **JWT Token-based Authentication**
- **Role-based Access Control**:
  - Interviewers (CAPI/CATI)
  - Project Managers
  - Quality Agents
  - Companies
- **CORS Configuration**: Multiple allowed origins
- **Environment Variables**: All secrets in `.env` files (not committed)

---

## 📊 Key Features

### **Survey Modes**:
1. **CAPI** (Computer-Assisted Personal Interviewing)
   - Requires GPS location
   - Audio recording mandatory
   - Mobile app interface

2. **CATI** (Computer-Assisted Telephone Interviewing)
   - Web-based calling interface
   - DeepCall integration for telephony
   - Queue management system

3. **Online** - Web-based surveys

### **Quality Control**:
- QC batch processing
- Automated batch creation
- Quality agent assignment
- Response review and approval workflow

### **Analytics & Reporting**:
- Interviewer performance metrics
- Survey analytics
- Response statistics
- CSV export functionality

---

## 🚀 Deployment

### **Development Server**:
- PM2 manages backend processes (5 instances)
- Frontend served via Nginx (production build)
- MongoDB connection via environment variables

### **Production Server**:
- Accessed via SSH: `ubuntu@13.202.181.167`
- Same structure as development
- Production MongoDB database
- SSL/HTTPS enabled
- Domain: `convo.convergentview.com`

### **Deployment Process**:
1. Make changes on development server
2. Test thoroughly
3. Build frontend: `cd /var/www/opine/frontend && npm run build`
4. Sync to production via SSH (if needed)
5. Restart services on production

---

## 📝 Important Notes

### **⚠️ Production Server Safety**:
- **NEVER** make direct changes to production without testing
- Always test on development server first
- Use sync scripts carefully (they are READ-ONLY on production)
- Database sync scripts create backups before modifying development

### **File Locations**:
- **SSH Key**: `/var/www/MyLogos/Convergent-New.pem`
- **Backend Logs**: `/var/www/opine/logs/`
- **Uploads**: `/var/www/opine/uploads/` (audio recordings, images)
- **Frontend Build**: `/var/www/opine/frontend/dist/`

### **Scripts Directory**:
- `/var/www/opine/backend/scripts/` - Contains utility scripts for:
  - Database operations
  - Data migration
  - User management
  - Report generation
  - Production sync operations

---

## 🔗 API Endpoints Summary

### **Authentication**:
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### **Surveys**:
- `GET /api/surveys` - List surveys
- `GET /api/surveys/:id` - Get survey details
- `POST /api/surveys` - Create survey
- `PUT /api/surveys/:id` - Update survey

### **Survey Responses**:
- `POST /api/survey-responses` - Submit response
- `GET /api/survey-responses` - List responses (with filters)
- `GET /api/survey-responses/:id` - Get response details
- `PUT /api/survey-responses/:id` - Update response

### **CATI**:
- `POST /api/cati/webhook` - DeepCall webhook endpoint
- `GET /api/cati/queue` - Get respondent queue
- `POST /api/cati/calls` - Create/manage calls

### **Performance & Reports**:
- `GET /api/performance` - Interviewer performance metrics
- `GET /api/reports` - Generate reports
- `POST /api/reports/export` - Export data to CSV

---

## 📱 Mobile App Configuration

- **API Base URL**: `https://convo.convergentview.com`
- **Offline Support**: Yes (AsyncStorage)
- **Network Sync**: Automatic when online
- **Location Services**: Required for CAPI interviews
- **Audio Recording**: Required for CAPI interviews

---

## 🎯 Next Steps

This document serves as a reference for understanding the project structure. When tasks are assigned, we will:
1. Carefully analyze the requirements
2. Test on development server first
3. Verify changes work correctly
4. Deploy to production only after thorough testing

---

**Last Updated**: 2025-12-29
**Maintained By**: Development Team









