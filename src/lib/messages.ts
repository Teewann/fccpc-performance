// src/lib/messages.ts
// Centralized copy / message strings for the FCCPC system.
//
// This file now exports TWO things:
//   - MSG: your existing flat export, untouched — kept in case anything
//     else in the project already imports from it.
//   - MESSAGES: the nested structure the six daily-log components
//     (QuickCaptureLog, TimerLog, RepeatLog, BulkGridLog, ProxyLog,
//     PendingAcknowledgments) actually import. This was missing entirely,
//     which is what caused the build error.

export const MSG = {
  // Auth
  NOT_AUTHENTICATED:   'You must be logged in to perform this action.',
  FORBIDDEN:           'You do not have permission to perform this action.',

  // Daily logs
  LOG_SUBMITTED:       'Your daily log has been submitted successfully.',
  LOG_UPDATED:         'Log updated successfully.',
  LOG_NOT_FOUND:       'Log entry not found.',
  LOG_ALREADY_ACK:     'This log has already been acknowledged.',

  // Acknowledgments
  ACK_CONFIRMED:       'Log confirmed successfully.',
  ACK_DISPUTED:        'Log disputed. HR has been notified.',

  // Tasks
  TASK_CREATED:        'Task created and assigned successfully.',
  TASK_NOT_FOUND:      'Task not found.',
  TASK_BROADCAST_SENT: 'Broadcast directive sent to all department members.',

  // Case transfer
  TRANSFER_INITIATED:  'Case transfer request submitted.',
  TRANSFER_ACCEPTED:   'Case transfer accepted.',
  TRANSFER_REJECTED:   'Case transfer rejected.',

  // General
  SERVER_ERROR:        'An unexpected error occurred. Please try again.',
  VALIDATION_ERROR:    'Please check your input and try again.',
  SUCCESS:             'Operation completed successfully.',
} as const;

export const MESSAGES = {
  dailyLog: {
    submitSuccess: "Logged. Nice work.",
    draftSaved: "Saved as a draft.",
    submitError: "Couldn't save that entry. Check your connection and try again.",
    missingFields: "Fill in the task type, title, description, and time spent.",
  },
  quickCapture: {
    parseSuccess: (n: number) => `Found ${n} ${n === 1 ? "entry" : "entries"}. Review before submitting.`,
    parseEmpty: "Didn't catch a clear task in that text — try adding a bit more detail.",
    parseError: "AI parsing isn't responding right now. You can log manually instead.",
    tooShort: "Write a line or two about what you worked on first.",
    tooLong: "That's a lot of text — try splitting it into two batches.",
    submitAllSuccess: (n: number) => `${n} ${n === 1 ? "entry" : "entries"} logged.`,
    submitPartial: (ok: number, total: number) => `${ok} of ${total} logged. Review the rest and try again.`,
  },
  timer: {
    needLabel: "Give it a quick label before starting the timer.",
    saved: "Time logged.",
    saveError: "Couldn't save this one. Your timer result is still shown above, try again.",
  },
  repeat: {
    loadError: "Couldn't load your recent entries.",
    empty: "Nothing to repeat yet — log something once and it'll show up here.",
    submitted: "Logged for today.",
  },
  bulk: {
    empty: "Add at least one row with a title and category.",
    allSaved: (n: number) => `All ${n} entries logged.`,
    partial: (ok: number, total: number) => `${ok} of ${total} saved — the rest are still in the grid, try again.`,
  },
  proxy: {
    needStaff: "Select who this entry is for.",
    needFields: "Title and category are required.",
    success: "Logged. They'll see it under their own confirmations to review.",
    unauthorized: "You're not set up to log on behalf of this person yet — ask HR to confirm the reporting line.",
    notFound: "Couldn't find that staff member.",
  },
  acknowledge: {
    confirmed: "Confirmed.",
    disputed: "Flagged as disputed — this goes to HR for review.",
    alreadyResolved: "This one's already been actioned.",
    unauthorized: "This isn't waiting on you specifically.",
  },
  auth: {
    notAuthenticated: "Your session's expired — log in again to continue.",
    forbidden: "You don't have access to do that.",
  },
  generic: {
    networkError: "Connection issue — try again in a moment.",
    serverError: "Something went wrong on our end. Try again shortly.",
  },
};