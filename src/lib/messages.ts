// src/lib/messages.ts
//
// One place for every success/error/status message the daily-log system
// shows a user. Keeps tone consistent and means nobody has to invent
// wording on the spot when adding a new action later.

export const MESSAGES = {
  dailyLog: {
    submitSuccess: "Logged. Nice work.",
    draftSaved: "Saved as a draft.",
    submitError: "Couldn't save that entry. Check your connection and try again.",
    missingFields: "Fill in the task type, title, description, and time spent.",
  },
  quickCapture: {
    parseSuccess: (n: number) => `Found ${n} ${n === 1 ? "entry" : "entries"}. Review before submitting.`,
    parseEmpty: "Didn't catch a clear task in that text. Try adding a bit more detail.",
    parseError: "AI parsing isn't responding right now. You can log manually instead.",
    tooShort: "Write a line or two about what you worked on first.",
    tooLong: "That's a lot of text. Try splitting it into two batches.",
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
    empty: "Nothing to repeat yet. Log something once and it'll show up here.",
    submitted: "Logged for today.",
  },
  bulk: {
    empty: "Add at least one row with a title and category.",
    allSaved: (n: number) => `All ${n} entries logged.`,
    partial: (ok: number, total: number) => `${ok} of ${total} saved. The rest are still in the grid, try again.`,
  },
  proxy: {
    needStaff: "Select who this entry is for.",
    needFields: "Title and category are required.",
    success: "Logged. They'll see it under their own confirmations to review.",
    unauthorized: "You're not set up to log on behalf of this person yet. Ask HR to confirm the reporting line.",
    notFound: "Couldn't find that staff member.",
  },
  acknowledge: {
    confirmed: "Confirmed.",
    disputed: "Flagged as disputed. This goes to HR for review.",
    alreadyResolved: "This one's already been actioned.",
    unauthorized: "This isn't waiting on you specifically.",
  },
  auth: {
        notAuthenticated: "Your session's expired. Log in again to continue.",
    forbidden: "You don't have access to do that.",
  },
  generic: {
    networkError: "Connection issue. Try again in a moment.",
    serverError: "Something went wrong on our end. Try again shortly.",
  },
};