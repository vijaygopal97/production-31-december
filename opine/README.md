# Opine India - Market Research Platform

A modern MERN stack application for connecting market research companies with verified field interviewers across India.

## 🚀 Features

- **Multi-tenant Platform**: Connect research companies with gig workers
- **Professional Interface**: Modern, responsive design with Tailwind CSS
- **SEO Optimized**: Complete SEO management system with environment control
- **Real-time Communication**: Backend API with MongoDB integration
- **Security First**: Environment-based configuration with no hardcoded secrets

## 🛠️ Tech Stack

### Frontend
- **React 19** with Vite
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Helmet Async** for SEO management
- **Axios** for API communication

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **CORS** enabled for cross-origin requests
- **Environment-based configuration**

## 📁 Project Structure

```
opine/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── config/         # SEO and app configuration
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   └── docs/           # Documentation
│   ├── public/             # Static assets
│   ├── scripts/            # Utility scripts
│   ├── .env.sample         # Environment variables template
│   └── package.json
├── backend/                 # Node.js backend API
│   ├── .env.sample         # Environment variables template
│   └── server.js           # Express server
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19+ 
- MongoDB Atlas account
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/vijaygopal97/opine-india.git
cd opine-india
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.sample .env
# Edit .env with your MongoDB URI and other configurations
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.sample .env
# Edit .env with your API URL and other configurations
npm run dev
```

### 4. Environment Configuration

#### Backend (.env)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
PORT=5000
SERVER_IP=your-server-ip
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_ENABLE_SEO_INDEXING=false
VITE_APP_NAME=Opine India
```

## 🔧 SEO Management

The application includes a comprehensive SEO management system:

### Development Mode (No Indexing)
```bash
npm run seo:dev
```

### Production Mode (Indexing Enabled)
```bash
npm run seo:prod
```

### Check Current Status
```bash
npm run seo:status
```

## 📊 API Endpoints

### Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API welcome message |
| GET | `/api/opines` | Get all opinions |
| POST | `/api/opines` | Create new opinion |
| GET | `/api/opines/:id` | Get specific opinion |
| PUT | `/api/opines/:id` | Update opinion |
| DELETE | `/api/opines/:id` | Delete opinion |

## 🌐 Deployment

### Development Server
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

### Production Considerations
1. Set `VITE_ENABLE_SEO_INDEXING=true` in frontend
2. Configure production MongoDB URI
3. Set up proper CORS origins
4. Configure domain-specific settings

## 🔒 Security

- All sensitive data stored in environment variables
- No hardcoded secrets in codebase
- CORS properly configured
- MongoDB connection secured
- SEO indexing controlled via environment

## 📝 Environment Variables

### Required Variables

#### Backend
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 5000)
- `SERVER_IP`: Server IP address
- `CORS_ORIGIN`: Allowed CORS origin

#### Frontend
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_ENABLE_SEO_INDEXING`: SEO indexing control

### Optional Variables
See `.env.sample` files for complete list of optional configurations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `src/docs/`
- Review environment configuration

## 🎯 Roadmap

- [ ] User authentication system
- [ ] Real-time chat functionality
- [ ] File upload capabilities
- [ ] Advanced analytics
- [ ] Mobile app development
- [ ] Payment integration

---

**Opine India** - Connecting market research companies with professional field interviewers across India. 🚀
