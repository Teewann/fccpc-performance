// src/config/taskTypes.ts
// ─── Task Types - used in Daily Work Log AND Tasks pages ──────────────
// Import this wherever you need task type options

export const TASK_TYPES = [
  // File & Document Work
  { value: "FILE_TREATMENT",        label: "File Treatment",           icon: "📁", group: "Documents" },
  { value: "CORRESPONDENCE",        label: "Correspondence",           icon: "✉️", group: "Documents" },
  { value: "REPORT_WRITING",        label: "Report Writing",           icon: "📝", group: "Documents" },
  { value: "LEGAL_REVIEW",          label: "Legal / Compliance Review",icon: "⚖️", group: "Documents" },

  // Physical / Field Work
  { value: "PHYSICAL_TASK",         label: "Physical Task (On-site)",  icon: "🏗️", group: "Field" },
  { value: "MARKET_SURVEILLANCE",   label: "Market Surveillance",      icon: "🏪", group: "Field" },
  { value: "INSPECTION",            label: "Inspection / Enforcement", icon: "🔍", group: "Field" },
  { value: "OUTSIDE_ASSIGNMENT",    label: "Outside Assignment",       icon: "🚗", group: "Field" },

  // Investigations & Cases
  { value: "INVESTIGATION",         label: "Investigation",            icon: "🔎", group: "Cases" },
  { value: "CONSUMER_COMPLAINT",    label: "Consumer Complaint",       icon: "📣", group: "Cases" },
  { value: "MERGER_REVIEW",         label: "Merger / Acquisition Review", icon: "🤝", group: "Cases" },
  { value: "ANTI_COMPETITIVE",      label: "Anti-Competitive Case",    icon: "🚫", group: "Cases" },
  { value: "DISPUTE_RESOLUTION",    label: "Dispute Resolution",       icon: "🤲", group: "Cases" },

  // Internal Coordination
  { value: "INTER_DEPARTMENTAL",    label: "Inter-Departmental Task",  icon: "🔗", group: "Internal" },
  { value: "MEETING",               label: "Meeting (Internal)",       icon: "👥", group: "Internal" },
  { value: "ADMINISTRATIVE",        label: "Administrative Task",      icon: "🗂️", group: "Internal" },
  { value: "PROCUREMENT_TASK",      label: "Procurement Task",         icon: "🛒", group: "Internal" },

  // Virtual / Remote
  { value: "VIRTUAL_TASK",          label: "Virtual / Online Task",    icon: "💻", group: "Virtual" },
  { value: "ONLINE_MEETING",        label: "Online Meeting / Webinar", icon: "📹", group: "Virtual" },
  { value: "RESEARCH",              label: "Research & Analysis",      icon: "📊", group: "Virtual" },

  // Training & Development
  { value: "TRAINING",              label: "Training / Workshop",      icon: "🎓", group: "Development" },
  { value: "POLICY_REVIEW",         label: "Policy / Regulation Review", icon: "📜", group: "Development" },

  // Zone Work
  { value: "ZONE_ASSIGNMENT",       label: "Zone Assignment",          icon: "📍", group: "Zones" },
  { value: "OUTREACH",              label: "Public Outreach / Education", icon: "📢", group: "Zones" },
  { value: "STAKEHOLDER_ENGAGEMENT",label: "Stakeholder Engagement",   icon: "🤝", group: "Zones" },
];

// Grouped for select dropdowns
export const TASK_TYPE_GROUPS = TASK_TYPES.reduce((acc, t) => {
  if (!acc[t.group]) acc[t.group] = [];
  acc[t.group].push(t);
  return acc;
}, {} as Record<string, typeof TASK_TYPES>);

// Get label from value
export function getTaskTypeLabel(value: string): string {
  return TASK_TYPES.find((t) => t.value === value)?.label || value;
}

// Get icon from value
export function getTaskTypeIcon(value: string): string {
  return TASK_TYPES.find((t) => t.value === value)?.icon || "📋";
}