export const AGENCY = {

  name:      "Federal Competition and Consumer Protection Commission",
  shortName: "FCCPC",
  tagline:   "Performance Intelligence System",
  country:   "Nigeria",
  website:   "https://fccpc.gov.ng",
  logoText:  "FC",
  version:   "1.0.0",

  allowedIPs: [
    "10.10.0.0/16",   // FCCPC internal network
    // add other IPs or ranges as needed

    // 10.10.0.0/16 only works if the app is self-hosted inside your LAN.
  // If you're on Vercel/a VPS reached over the public internet, find your
  // office router's real public IP (from the office WiFi, visit whatismyip.com)
  // and put THAT here instead, e.g. "105.112.xxx.xxx/32".
  // Until you confirm that, IP is treated as supporting evidence only, not a gate.
  ],
  
hqLocation: {
  lat:          9.0423,   // ← replace with calibrated value
  lng:          7.4985,   // ← replace with calibrated value
  radiusMeters: 250,      // ← replace with calibrated value
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