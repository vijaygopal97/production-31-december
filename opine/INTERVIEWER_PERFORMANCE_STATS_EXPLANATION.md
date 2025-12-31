# Interviewer Performance Statistics - Calculation Explanation

## Overview

The Interviewer Performance modal on the `/company/surveys/{surveyId}/reports` page displays several demographic statistics. This document explains how these statistics are calculated, specifically:

1. **% of Interviews mentioned as SC** (Scheduled Caste)
2. **% of Interviews mentioned as Muslims**
3. **% of Interviews under the age of (18-24)**
4. **% of Interviews under the age of (50)**

---

## Data Source

The statistics are calculated from **SurveyResponse** objects in the database. Each response contains:
- `responses`: An array of question-answer pairs
- `interviewer`: Reference to the interviewer who conducted the interview
- `status`: Approval status (Approved, Rejected, Pending_Approval)
- `interviewMode`: CAPI or CATI

---

## Question Detection Method

The system uses a **keyword-based search** to find relevant questions in the response data. This is implemented through the `findQuestionResponse()` function.

### How `findQuestionResponse()` Works

**Location:** 
- Backend: `/var/www/opine/backend/controllers/surveyResponseController.js` (line 3863)
- Frontend: `/var/www/opine/frontend/src/pages/SurveyReportsPage.jsx` (line 1375)

**Function Logic:**
```javascript
const findQuestionResponse = (responses, keywords) => {
  if (!responses || !Array.isArray(responses)) return null;
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  return responses.find(r => {
    const questionText = (r.questionText || '').toLowerCase();
    return normalizedKeywords.some(keyword => questionText.includes(keyword));
  });
};
```

**How it works:**
1. Takes an array of responses and an array of keywords
2. Normalizes all keywords to lowercase
3. Searches through each response's `questionText` field
4. Returns the **first response** where the question text contains **any** of the provided keywords
5. Uses case-insensitive substring matching (`.includes()`)

**Important Notes:**
- It finds the **first match** only (not all matches)
- Uses substring matching, so "age" will match "What is your age?" or "Age in years"
- Case-insensitive matching
- If multiple questions match, only the first one in the array is returned

---

## Individual Statistics Calculation

### 1. % of Interviews mentioned as SC (Scheduled Caste)

**Backend Location:** `surveyResponseController.js` lines 4001-4012  
**Frontend Location:** `SurveyReportsPage.jsx` lines 1562-1572

**Only calculated for survey:** `68fd1915d41841da463f0d46`

**Detection Keywords:**
```javascript
['caste', 'scheduled cast', 'sc', 'category']
```

**Process:**
1. Uses `findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category'])` to find the caste question
2. Extracts the response value using `getMainTextValue()` (strips translations)
3. Converts to lowercase and checks if it contains:
   - `'scheduled cast'`
   - `'sc'`
   - `'scheduled caste'`
4. If match found, increments `scCount`

**Example:**
- Question: "What is your caste category?"
- Response: "Scheduled Cast" → **Counted as SC**
- Response: "SC" → **Counted as SC**
- Response: "General" → **Not counted**

**Calculation:**
```javascript
scPercentage = (scCount / totalResponses) * 100
```

---

### 2. % of Interviews mentioned as Muslims

**Backend Location:** `surveyResponseController.js` lines 4014-4021  
**Frontend Location:** `SurveyReportsPage.jsx` lines 1574-1581

**Detection Keywords:**
```javascript
['religion', 'muslim', 'hindu', 'christian']
```

**Process:**
1. Uses `findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian'])` to find the religion question
2. Extracts the response value using `getMainTextValue()` (strips translations)
3. Converts to lowercase and checks if it contains:
   - `'muslim'`
   - `'islam'`
4. If match found, increments `muslimCount`

**Example:**
- Question: "What is your religion?"
- Response: "Muslim" → **Counted as Muslim**
- Response: "Islam" → **Counted as Muslim**
- Response: "Hindu" → **Not counted**

**Calculation:**
```javascript
muslimPercentage = (muslimCount / totalResponses) * 100
```

---

### 3. % of Interviews under the age of (18-24)

**Backend Location:** `surveyResponseController.js` lines 4023-4035  
**Frontend Location:** `SurveyReportsPage.jsx` lines 1583-1595

**Detection Keywords:**
```javascript
['age', 'year']
```

**Process:**
1. Uses `findQuestionResponse(responseData, ['age', 'year'])` to find the age question
2. Extracts the response value
3. Parses it as an integer using `parseInt()`
4. Validates the age is a valid number (not NaN)
5. Checks if age is **>= 18 AND <= 24**
6. If match found, increments `age18to24Count`

**Example:**
- Question: "What is your age?"
- Response: "22" → **Counted** (22 is between 18-24)
- Response: "25" → **Not counted** (25 > 24)
- Response: "17" → **Not counted** (17 < 18)
- Response: "18" → **Counted** (18 is in range)
- Response: "24" → **Counted** (24 is in range)

**Frontend Validation:**
- Also checks: `age > 0 && age < 150` (to filter invalid ages)

**Calculation:**
```javascript
age18to24Percentage = (age18to24Count / totalResponses) * 100
```

---

### 4. % of Interviews under the age of (50)

**Note:** The column name says "under the age of (50)" but it actually means **"50 and above"** (age >= 50)

**Backend Location:** `surveyResponseController.js` lines 4023-4035  
**Frontend Location:** `SurveyReportsPage.jsx` lines 1583-1595

**Detection Keywords:**
```javascript
['age', 'year']
```

**Process:**
1. Uses the same age question found above (reuses the same `ageResponse`)
2. Parses the age as integer
3. Validates the age is a valid number (not NaN)
4. Checks if age is **>= 50**
5. If match found, increments `age50PlusCount`

**Example:**
- Question: "What is your age?"
- Response: "50" → **Counted** (50 >= 50)
- Response: "55" → **Counted** (55 >= 50)
- Response: "49" → **Not counted** (49 < 50)

**Frontend Validation:**
- Also checks: `age > 0 && age < 150` (to filter invalid ages)

**Calculation:**
```javascript
age50PlusPercentage = (age50PlusCount / totalResponses) * 100
```

---

## Helper Functions

### `getMainTextValue()`

**Purpose:** Strips translation brackets from text

**Example:**
- Input: `"Scheduled Cast {अनुसूचित जाति}"`
- Output: `"Scheduled Cast"`

**Implementation:**
```javascript
const getMainTextValue = (text) => {
  if (!text) return '';
  if (typeof text !== 'string') {
    text = String(text);
  }
  const translationRegex = /^(.+?)\s*\{([^}]+)\}\s*$/;
  const match = text.match(translationRegex);
  return match ? match[1].trim() : text.trim();
};
```

---

## Calculation Flow (Backend API)

**Endpoint:** `GET /api/survey-responses/interviewer-performance/:surveyId`

**Location:** `/var/www/opine/backend/controllers/surveyResponseController.js` (function: `getInterviewerPerformanceStats`)

**Steps:**
1. Fetch all SurveyResponse documents for the survey
2. Group responses by interviewer
3. For each interviewer:
   - Loop through all their responses
   - For each response:
     - Extract the `responses` array (question-answer pairs)
     - Use `findQuestionResponse()` to find relevant questions
     - Extract and validate response values
     - Increment appropriate counters
   - Calculate percentages: `(count / totalResponses) * 100`
4. Return statistics for each interviewer

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "interviewer": "John Doe",
      "interviewerId": "...",
      "totalResponses": 100,
      "scPercentage": 25.50,
      "muslimPercentage": 30.00,
      "age18to24Percentage": 15.00,
      "age50PlusPercentage": 40.00,
      ...
    }
  ]
}
```

---

## Frontend Display

**Location:** `/var/www/opine/frontend/src/pages/SurveyReportsPage.jsx`

The frontend can calculate these stats in two ways:

1. **From Backend API:** Uses the `/api/survey-responses/interviewer-performance/:surveyId` endpoint
2. **Client-side Calculation:** Also calculates from filtered responses (respects date filters, status filters, etc.)

**Modal Display:**
- Shows statistics in a table format
- Each row represents one interviewer
- Statistics are displayed as percentages with 2 decimal places
- SC column only appears for survey `68fd1915d41841da463f0d46`

---

## Important Considerations

### 1. Question Detection Limitations

- **Keyword-based matching** may not always find the correct question if:
  - Question text doesn't contain expected keywords
  - Multiple questions contain the same keywords (only first match is used)
  - Question text is in a different language (though translations are stripped)

### 2. Response Value Parsing

- **Age parsing:** Uses `parseInt()` which may fail for non-numeric responses
- **Text matching:** Case-insensitive substring matching may have false positives
- **SC detection:** Only checks for specific strings, may miss variations

### 3. Data Quality

- Statistics depend on:
  - Interviewers asking the correct questions
  - Respondents providing accurate answers
  - Questions being properly saved in the response format

### 4. Survey-Specific Logic

- **SC percentage** is only calculated for survey `68fd1915d41841da463f0d46`
- Other surveys will not show this column

---

## Example Calculation

**Scenario:** An interviewer has 100 total responses

1. **SC Count:** 25 responses mention "SC" or "Scheduled Cast"
   - `scPercentage = (25 / 100) * 100 = 25.00%`

2. **Muslim Count:** 30 responses mention "Muslim" or "Islam"
   - `muslimPercentage = (30 / 100) * 100 = 30.00%`

3. **Age 18-24 Count:** 15 responses have age between 18-24
   - `age18to24Percentage = (15 / 100) * 100 = 15.00%`

4. **Age 50+ Count:** 40 responses have age >= 50
   - `age50PlusPercentage = (40 / 100) * 100 = 40.00%`

---

## Troubleshooting

If statistics appear incorrect:

1. **Check question text:** Verify the actual question text in responses contains the expected keywords
2. **Check response format:** Ensure responses are saved in the correct format
3. **Check data quality:** Verify response values are valid (e.g., age is numeric)
4. **Check filters:** Frontend calculations respect date/status filters, which may affect percentages

---

**Last Updated:** December 14, 2025  
**Documentation Version:** 1.0


