# 🚀 Opine India - Quick Setup Guide

## 📋 Environment Variables Setup

### For New Developers/Deployment:

1. **Copy the sample files:**
   ```bash
   # Frontend
   cp frontend/.env.sample frontend/.env
   
   # Backend  
   cp backend/.env.sample backend/.env
   ```

2. **Edit the .env files with your values:**

### 🔧 Frontend Environment Variables (.env)

```env
# Required Variables
VITE_API_BASE_URL=http://your-server-ip:5000
VITE_ENABLE_SEO_INDEXING=false  # Set to 'true' for production

# Optional Variables
VITE_APP_NAME=Opine India
VITE_APP_VERSION=1.0.0
```

### 🔧 Backend Environment Variables (.env)

```env
# Required Variables
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
PORT=5000
SERVER_IP=your-server-ip-here
CORS_ORIGIN=http://your-frontend-url:3000

# Optional Variables
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
```

## 🎯 Quick Commands

### Development Setup:
```bash
# Backend
cd backend
npm install
npm start

# Frontend (in new terminal)
cd frontend  
npm install
npm run dev
```

### SEO Control:
```bash
# Development (no indexing)
npm run seo:dev

# Production (indexing enabled)
npm run seo:prod

# Check status
npm run seo:status
```

## 🔒 Security Notes

- ✅ **Never commit actual .env files** to git
- ✅ **Always use .env.sample as template**
- ✅ **Keep sensitive data in environment variables**
- ✅ **Use different values for development/production**

## 📁 File Structure

```
opine/
├── frontend/
│   ├── .env.sample    # ✅ Template for frontend
│   └── .env           # ❌ Your actual config (not in git)
├── backend/
│   ├── .env.sample    # ✅ Template for backend  
│   └── .env           # ❌ Your actual config (not in git)
└── SETUP_GUIDE.md     # ✅ This file
```

## 🆘 Common Issues

### "MongoDB connection failed"
- Check your `MONGODB_URI` in backend/.env
- Ensure IP is whitelisted in MongoDB Atlas

### "CORS error"
- Check `CORS_ORIGIN` in backend/.env matches your frontend URL

### "API not found"
- Check `VITE_API_BASE_URL` in frontend/.env matches your backend URL

---

**Remember**: Always copy from `.env.sample` and never commit actual `.env` files! 🔐
