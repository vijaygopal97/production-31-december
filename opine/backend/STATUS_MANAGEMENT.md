# CATI Respondent Queue Status Management

## How Status is Identified

The status of a contact (respondent) in the CATI queue is stored in the `CatiRespondentQueue` model in the `status` field.

## Available Statuses

The system uses the following statuses (defined in `/var/www/opine/backend/models/CatiRespondentQueue.js`):

1. **`pending`** - Waiting to be called (default status)
2. **`assigned`** - Assigned to an interviewer
3. **`calling`** - Call in progress
4. **`interview_success`** - Interview completed successfully
5. **`call_failed`** - Call failed (technical issue)
6. **`busy`** - Number was busy
7. **`not_interested`** - Respondent not interested
8. **`call_later`** - Scheduled for later call
9. **`no_answer`** - No answer
10. **`switched_off`** - Phone switched off
11. **`not_reachable`** - Number not reachable
12. **`does_not_exist`** - Number does not exist
13. **`rejected`** - Call rejected by respondent

## How Status is Updated

### 1. **From Interview Actions** (`catiInterviewController.js`)

- **When starting interview**: Status changes to `assigned` (line 175)
- **When making call**: Status changes to `calling` (line 351)
- **When abandoning**: Status changes based on abandonment reason (lines 409-440)
  - `call_later` → `pending` (with higher priority)
  - `call_failed` → `pending` (for retry)
  - Other reasons → specific status (e.g., `not_interested`, `busy`)
- **When completing**: Status changes to `interview_success` (line 541)

### 2. **From Webhook** (`catiController.js`)

When a call webhook is received, the system maps the call status to queue status (lines 1003-1014):

```javascript
const statusMap = {
  'answered': 'calling',
  'completed': 'interview_success',
  'no-answer': 'no_answer',
  'busy': 'busy',
  'failed': 'call_failed',
  'cancelled': 'rejected'
};
```

## How to Change Status

### Option 1: Direct Database Update (MongoDB)

You can directly update the status in MongoDB:

```javascript
// Connect to MongoDB
use your_database_name

// Update a specific queue entry
db.catirespondentqueues.updateOne(
  { _id: ObjectId("queue_entry_id") },
  { $set: { status: "pending" } }
)

// Reset all non-success entries to pending for a survey
db.catirespondentqueues.updateMany(
  { 
    survey: ObjectId("survey_id"),
    status: { $ne: "interview_success" }
  },
  { 
    $set: { 
      status: "pending",
      assignedTo: null,
      assignedAt: null
    }
  }
)
```

### Option 2: Modify the Status Mapping

To change how webhook call statuses map to queue statuses, edit `/var/www/opine/backend/controllers/catiController.js` around line 1003:

```javascript
const statusMap = {
  'answered': 'calling',           // Change this mapping
  'completed': 'interview_success', // Change this mapping
  'no-answer': 'no_answer',        // Change this mapping
  'busy': 'busy',                  // Change this mapping
  'failed': 'call_failed',         // Change this mapping
  'cancelled': 'rejected'          // Change this mapping
};
```

### Option 3: Modify Abandonment Status Logic

To change how abandonment reasons map to statuses, edit `/var/www/opine/backend/controllers/catiInterviewController.js` around line 409:

```javascript
const statusMap = {
  'call_later': 'call_later',      // Change this mapping
  'not_interested': 'not_interested', // Change this mapping
  'busy': 'busy',                   // Change this mapping
  // Add more mappings as needed
};
```

### Option 4: Add New Status Values

To add new status values:

1. Edit `/var/www/opine/backend/models/CatiRespondentQueue.js` and add to the enum (line 28):
```javascript
enum: [
  'pending',
  'assigned',
  'calling',
  'interview_success',
  'call_failed',
  'busy',
  'not_interested',
  'call_later',
  'no_answer',
  'switched_off',
  'not_reachable',
  'does_not_exist',
  'rejected',
  'your_new_status'  // Add here
]
```

2. Update status mappings in controllers to use the new status

## Querying Status

To find respondents by status:

```javascript
// In Node.js/MongoDB
const pendingRespondents = await CatiRespondentQueue.find({ 
  survey: surveyId, 
  status: 'pending' 
});

// Count by status
const statusCounts = await CatiRespondentQueue.aggregate([
  { $match: { survey: surveyId } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```

## Important Notes

- Status `pending` is required for respondents to be assigned to interviewers
- Status `interview_success` means the interview was completed and should not be reset
- When status is set to `pending`, `assignedTo` and `assignedAt` are typically cleared
- The webhook automatically updates status based on call outcome
- Manual status changes should be done carefully to maintain data integrity





