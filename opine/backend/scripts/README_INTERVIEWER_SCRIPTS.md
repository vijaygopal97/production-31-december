# Interviewer Addition Scripts

## Overview
Two reusable scripts for adding CATI and CAPI interviewers to both development and production servers.

## Scripts

### 1. `addCATIInterviewers.js` - For CATI (Telephonic) Interviewers
- **No AC Assignment** (CATI interviewers don't have AC assignments)
- **Location**: `/var/www/opine/backend/scripts/addCATIInterviewers.js`

### 2. `addCAPIInterviewers.js` - For CAPI (Face-to-Face) Interviewers
- **Includes AC Assignment** (CAPI interviewers are assigned to Assembly Constituencies)
- **Location**: `/var/www/opine/backend/scripts/addCAPIInterviewers.js`

## How to Use

### Step 1: Edit the Script
Open the appropriate script and add interviewer details to the `interviewersToAdd` array at the top.

#### For CATI Interviewers:
```javascript
const interviewersToAdd = [
  {
    name: 'Sumit Kumar Roy',
    phone: '8670475453',
    memberId: '191',
    email: 'cati191@gmail.com' // Optional - will auto-generate if not provided
  },
  // Add more interviewers...
];
```

#### For CAPI Interviewers:
```javascript
const interviewersToAdd = [
  {
    name: 'Hari Sankar Mahato',
    phone: '8340667307',
    whatsapp: '8340667307',
    email: 'harishankarm757@gmail.com',
    memberId: '4007',
    ac: 'Bandwan' // Assembly Constituency name
  },
  // Add more interviewers...
];
```

### Step 2: Run on Development
```bash
cd /var/www/opine/backend
node scripts/addCATIInterviewers.js    # For CATI
# OR
node scripts/addCAPIInterviewers.js    # For CAPI
```

### Step 3: Copy Script to Production
```bash
scp -i /var/www/MyLogos/Convergent-New.pem \
  /var/www/opine/backend/scripts/addCATIInterviewers.js \
  ubuntu@13.202.181.167:/var/www/opine/backend/scripts/
```

### Step 4: Run on Production
```bash
ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@13.202.181.167
cd /var/www/opine/backend
node scripts/addCATIInterviewers.js    # For CATI
# OR
node scripts/addCAPIInterviewers.js    # For CAPI
```

## Important Notes

1. **Phone Numbers**: Must be 10 digits, NO country code (+91 or 91)
2. **Passwords**: Automatically set to phone number (without country code)
3. **Email**: For CATI, email is optional and will auto-generate as `cati{memberId}@gmail.com` if not provided
4. **AC Names**: For CAPI, AC names must match exactly (case-sensitive) with the AC names in the system
5. **Member IDs**: Must be unique
6. **Survey**: All interviewers are assigned to survey `68fd1915d41841da463f0d46`

## What the Scripts Do

1. ✅ Create/Update user accounts with all required fields
2. ✅ Set approval status to 'approved'
3. ✅ Assign to the survey
4. ✅ For CAPI: Assign to specified AC (Assembly Constituency)
5. ✅ Test login credentials
6. ✅ Provide detailed summary report

## Troubleshooting

- If script says "No interviewers to add", check that the `interviewersToAdd` array is not empty
- If login test fails, the user is still created - you may need to reset the password manually
- If AC assignment fails, check that the AC name matches exactly (case-sensitive)
