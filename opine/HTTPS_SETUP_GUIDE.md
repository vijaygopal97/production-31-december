# 🔒 HTTPS Setup Guide for Audio Recording

## 🚨 **Current Issue**
You're accessing the site via HTTP (`http://74.225.250.243:3000`) but **microphone access requires HTTPS** for security reasons.

## 🎯 **Quick Solutions**

### **Option 1: Use Localhost (Recommended for Development)**
```bash
# Access via localhost instead of IP
http://localhost:3000
# or
http://127.0.0.1:3000
```

### **Option 2: Set Up HTTPS with SSL Certificate**

#### **Step 1: Get SSL Certificate (Free with Let's Encrypt)**
```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Get certificate for your domain
sudo certbot certonly --standalone -d your-domain.com
```

#### **Step 2: Configure Nginx (if using)**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### **Step 3: Update PM2 Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'opine-backend',
    script: './backend/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      CORS_ORIGIN: 'https://your-domain.com'
    }
  }, {
    name: 'opine-frontend',
    script: 'serve',
    args: '-s build -l 3000',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### **Option 3: Temporary HTTPS with Self-Signed Certificate**

#### **Step 1: Generate Self-Signed Certificate**
```bash
# Create certificates directory
mkdir -p /var/www/opine/ssl

# Generate private key
openssl genrsa -out /var/www/opine/ssl/server.key 2048

# Generate certificate
openssl req -new -x509 -key /var/www/opine/ssl/server.key -out /var/www/opine/ssl/server.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=74.225.250.243"
```

#### **Step 2: Update Backend Server**
```javascript
// backend/server.js
const https = require('https');
const fs = require('fs');

// Add SSL configuration
const options = {
  key: fs.readFileSync('/var/www/opine/ssl/server.key'),
  cert: fs.readFileSync('/var/www/opine/ssl/server.crt')
};

// Create HTTPS server
const server = https.createServer(options, app);
server.listen(PORT, () => {
  console.log(`✅ HTTPS Server running on https://74.225.250.243:${PORT}`);
});
```

#### **Step 3: Update Frontend Build**
```bash
# Update package.json scripts
"scripts": {
  "build": "react-scripts build",
  "serve": "serve -s build -l 3000 --ssl-cert /var/www/opine/ssl/server.crt --ssl-key /var/www/opine/ssl/server.key"
}
```

## 🔧 **Immediate Fix (Chrome Settings)**

### **For Development Only:**
1. **Open Chrome Settings** → Privacy and Security → Site Settings
2. **Add your site**: `http://74.225.250.243:3000`
3. **Allow Microphone** access
4. **Refresh the page**

### **Chrome Flags (Advanced):**
```bash
# Launch Chrome with insecure origins allowed
google-chrome --unsafely-treat-insecure-origin-as-secure=http://74.225.250.243:3000 --user-data-dir=/tmp/chrome_dev_test
```

## 🚀 **Recommended Production Setup**

### **1. Domain Name Setup**
```bash
# Point your domain to your server IP
# A Record: your-domain.com → 74.225.250.243
```

### **2. Nginx Reverse Proxy**
```bash
# Install Nginx
sudo apt install nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/opine
```

### **3. SSL Certificate**
```bash
# Get free SSL certificate
sudo certbot --nginx -d your-domain.com
```

### **4. Update Environment Variables**
```bash
# .env file
CORS_ORIGIN=https://your-domain.com
NODE_ENV=production
```

## 🎯 **Quick Test Solution**

### **Option A: Use Localhost**
```bash
# Access via localhost (works with HTTP)
http://localhost:3000
```

### **Option B: Chrome Insecure Origins**
1. **Open Chrome** with this flag:
```bash
google-chrome --unsafely-treat-insecure-origin-as-secure=http://74.225.250.243:3000
```

### **Option C: Firefox (Less Restrictive)**
Firefox allows microphone access on HTTP for development:
```bash
# Access via Firefox
http://74.225.250.243:3000
```

## 🔍 **Verification Steps**

1. **Check Protocol**: Ensure URL shows `https://` or use `localhost`
2. **Browser Console**: Look for "Audio Support Check" logs
3. **Microphone Permission**: Should prompt for permission
4. **Audio Indicator**: Should show "Recording" status

## 🎉 **Expected Result**

After implementing HTTPS:
- ✅ Microphone permission prompt appears
- ✅ Audio recording starts automatically
- ✅ Visual indicators show recording status
- ✅ Interview continues seamlessly

## 📞 **Need Help?**

If you need assistance with any of these steps, let me know which option you'd prefer to implement!
