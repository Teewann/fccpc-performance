export const AGENCY = {

  name:      "Federal Competition and Consumer Protection Commission",
  shortName: "FCCPC",
  tagline:   "Performance Intelligence System",
  country:   "Nigeria",
  website:   "https://fccpc.gov.ng",
  logoText:  "FC",
  version:   "1.0.0",

  allowedIPs: [
    // "10.10.0.0/16",   // ❌ COMMENTED OUT - Only works if self-hosted inside LAN
    // On Vercel, this never matches. Use office public IP instead.
    // Find office public IP from whatismyip.com on office WiFi.
    // Example: "105.112.xxx.xxx/32"
  ],

  hqLocation: {
    lat:          9.048052,   // ✅ Calibrated from 93 readings, filtered for accuracy
    lng:          7.511101,   // ✅ Calibrated from 93 readings, filtered for accuracy
    radiusMeters: 60,         // ✅ 40m reliable footprint + 20m cushion for different phones
    address:      "23 Jimmy Carter Street, Asokoro, Abuja",
  },

  terms: {
    chiefExecutive:      "Executive Vice Chairman",
    chiefExecutiveShort: "EVC",
    deputyExecutive:     "Executive Commissioner",
    departmentHead:      "Director",
    department:          "Department",
    unit:                "Unit",
    staff:               "Staff",
    intern:              "NYSC / IT Intern",
    internShort:         "Intern",
    workLog:             "Work Log",
    appraisal:           "Performance Appraisal",
    task:                "Task",
  },

  roleLabels: {
    STAFF:      "Staff",
    SUPERVISOR: "Supervisor",
    DIRECTOR:   "Director",
    HR:         "HR Officer",
    ADMIN:      "System Administrator",
    EXECUTIVE:  "Executive",
    INTERN:     "NYSC / IT Intern",
  },

  permissions: {
    canAssignTasks:       ["DIRECTOR", "ADMIN", "EXECUTIVE"],
    canReviewLogs:        ["SUPERVISOR", "DIRECTOR", "HR", "ADMIN", "EXECUTIVE"],
    canManageKPIs:        ["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"],
    canViewAllStaff:      ["HR", "ADMIN", "EXECUTIVE"],
    canPostAnnouncements: ["DIRECTOR", "ADMIN", "EXECUTIVE"],
    canAccessReports:     ["HR", "DIRECTOR", "ADMIN", "EXECUTIVE"],
    canManageUsers:       ["ADMIN"],
    canViewAuditLog:      ["ADMIN"],
  },

  appraisal: {
    outstanding:        90,
    exceedsExpectation: 75,
    meetsExpectation:   60,
    belowExpectation:   45,
  },

  workingDays: {
    perMonth:   22,
    perQuarter: 66,
    perYear:    264,
  },

  colors: {
    accent:       "#22c55e",
    accentDark:   "#166534",
    accentBg:     "#052e16",
    accentBorder: "#14532d",
    accentText:   "#4ade80",
  },

} as const;

export type Agency = typeof AGENCY;