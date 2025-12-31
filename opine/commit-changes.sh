#!/bin/bash
cd /var/www/opine
git add frontend/src/services/api.js frontend/src/components/dashboard/RespondentUpload.jsx backend/controllers/surveyController.js
git commit -m "Fix survey save timeout and add pagination for large respondent contacts (9000+ contacts support)"
git push success-backup Developer
echo "Changes committed and pushed successfully!"

