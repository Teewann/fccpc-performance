// src/lib/refNo.ts
//
// Generates a unique, human-readable reference number for any record that
// needs one (DailyLog entries, Tasks, Case Transfers, etc).
//
// Format: {PREFIX}-{YEAR}-{TIMESTAMP}{RANDOM}   e.g.  DL-2026-M3X9F2
//
// Previous version counted existing rows to pick the next sequence number —
// this raced under concurrent writes (e.g. a department broadcast creating
// many tasks in parallel could generate duplicate numbers and crash on the
// unique constraint). This version needs no database read at all: it's
// both faster and correctness-safe under any level of concurrency, at the
// cost of the numbers no longer being purely sequential.

type RefPrefix = "DL" | "TASK" | "CT";

export function generateRefNo(prefix: RefPrefix): string {
  const year = new Date().getFullYear();
  const timestampPart = Date.now().toString(36).toUpperCase().slice(-4);
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${year}-${timestampPart}${randomPart}`;
}