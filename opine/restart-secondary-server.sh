#!/bin/bash
# Script to restart secondary server
# Secondary server IP: 3.109.82.159 (or 172.31.47.152)

echo "=== RESTARTING SECONDARY SERVER ==="
echo ""
echo "Secondary Server: 3.109.82.159"
echo ""
echo "Files should already be synced via lsyncd."
echo "Now restarting servers on secondary instance..."
echo ""

# SSH into secondary server and restart
ssh -i /var/www/MyLogos/Convergent-New.pem -o StrictHostKeyChecking=no ubuntu@3.109.82.159 << 'ENDSSH'
cd /var/www/opine

echo "1. Restarting backend servers..."
pm2 restart opine-backend

echo ""
echo "2. Rebuilding frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "3. Restarting frontend..."
pm2 restart opine-frontend

echo ""
echo "4. Verifying changes..."
echo "Checking audioStatus enum:"
grep -c "enum: \['1', '2', '3', '4', '7', '8', '9'\]" backend/models/SurveyResponse.js && echo "✅ Backend enum includes '9'"

echo ""
echo "Checking frontend option 9:"
grep -c "9 - Interviewer acting as respondent" frontend/src/components/dashboard/SurveyApprovals.jsx && echo "✅ Frontend has option 9"

echo ""
echo "=== SECONDARY SERVER RESTARTED ==="
pm2 list | grep -E "backend|frontend" | head -5
ENDSSH

echo ""
echo "✅ Secondary server restart complete!"
