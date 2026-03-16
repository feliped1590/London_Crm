

## Problem

The task update mutation sends `due_time: ""` (empty string) to the database. The `due_time` column is of type `time`, which does not accept empty strings -- it needs either a valid time value or `null`.

## Fix

In `src/pages/Tasks.tsx`, in the `handleSubmit` function (and/or the `updateMutation`), convert empty `due_time` strings to `null` before sending to the database.

### File: `src/pages/Tasks.tsx`

Find the task update payload construction and ensure:
```typescript
due_time: formData.due_time || null,  // instead of formData.due_time which could be ""
```

This same fix should apply to both create and update mutations to prevent the issue in either flow.

