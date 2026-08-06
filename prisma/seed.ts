import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

async function main() {
  console.log("Seeding FCCPC departments, units, and task templates...");

  // ─── DEPARTMENTS ───────────────────────────────────────────────
  const departments = [
    // Operations
    { name: "Surveillance and Investigation", shortCode: "S&I", category: "OPERATIONS" as const,
      description: "Enforcement, investigation, and dispute resolution",
      units: ["Enforcement", "Investigation", "Dispute Resolution"],
      tasks: [
        { title: "Open investigation case", category: "Investigation", requiresCaseRef: true },
        { title: "Field enforcement action", category: "Enforcement", requiresEvidence: true, requiresCaseRef: true },
        { title: "Dispute resolution session", category: "Dispute", requiresCaseRef: true },
        { title: "Market surveillance visit", category: "Surveillance", requiresEvidence: true },
        { title: "Case report preparation", category: "Reporting", requiresCaseRef: true },
        { title: "Witness statement recording", category: "Investigation", requiresCaseRef: true, requiresEvidence: true },
        { title: "Court filing / submission", category: "Legal", requiresCaseRef: true },
        { title: "Seizure and forfeiture action", category: "Enforcement", requiresEvidence: true, requiresAmount: true },
      ]
    },
    { name: "Consumer and Business Education", shortCode: "CBE", category: "OPERATIONS" as const,
      description: "Consumer education and business awareness",
      units: ["Customer Education", "Business Education"],
      tasks: [
        { title: "Consumer sensitisation workshop", category: "Education", requiresEvidence: true },
        { title: "Business education seminar", category: "Education", requiresEvidence: true },
        { title: "Complaint handling and referral", category: "Complaints", requiresCaseRef: true },
        { title: "Outreach programme", category: "Outreach", requiresEvidence: true },
        { title: "Media engagement / press", category: "Communications" },
        { title: "Educational content creation", category: "Content" },
        { title: "School / community visit", category: "Outreach", requiresEvidence: true },
      ]
    },
    { name: "Quality Assurance", shortCode: "QA", category: "OPERATIONS" as const,
      description: "Product and service quality inspection",
      units: ["Product Listing", "Services", "Clinic Management", "Laboratory Services", "Goods"],
      tasks: [
        { title: "Product listing inspection", category: "Inspection", requiresEvidence: true },
        { title: "Laboratory sample analysis", category: "Laboratory", requiresEvidence: true, requiresCaseRef: true },
        { title: "Clinic / healthcare facility inspection", category: "Inspection", requiresEvidence: true },
        { title: "Goods quality verification", category: "Verification", requiresEvidence: true },
        { title: "Service provider assessment", category: "Assessment", requiresCaseRef: true },
        { title: "Non-conformance report", category: "Reporting", requiresCaseRef: true },
        { title: "Product recall coordination", category: "Enforcement", requiresCaseRef: true, requiresAmount: true },
        { title: "Standards compliance review", category: "Compliance", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Mergers and Acquisitions", shortCode: "M&A", category: "OPERATIONS" as const,
      description: "Review and regulation of mergers, acquisitions, and business combinations",
      units: ["Product Sector", "Services Sector"],
      tasks: [
        { title: "Merger notification review", category: "Review", requiresCaseRef: true },
        { title: "Acquisition filing assessment", category: "Assessment", requiresCaseRef: true },
        { title: "Market concentration analysis", category: "Analysis", requiresCaseRef: true },
        { title: "Due diligence review", category: "Review", requiresEvidence: true },
        { title: "Remedies negotiation", category: "Negotiation", requiresCaseRef: true },
        { title: "M&A approval decision memo", category: "Decision", requiresCaseRef: true },
        { title: "Sector impact report", category: "Reporting", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Anti-Competitive Practices", shortCode: "ACP", category: "OPERATIONS" as const,
      description: "Monopoly and cartel investigations",
      units: ["Monopoly", "Cartel"],
      tasks: [
        { title: "Monopoly investigation", category: "Investigation", requiresCaseRef: true, requiresEvidence: true },
        { title: "Cartel detection and filing", category: "Investigation", requiresCaseRef: true },
        { title: "Price-fixing inquiry", category: "Investigation", requiresCaseRef: true, requiresAmount: true },
        { title: "Market dominance assessment", category: "Analysis", requiresCaseRef: true },
        { title: "Leniency application review", category: "Review", requiresCaseRef: true },
        { title: "Remedial order preparation", category: "Legal", requiresCaseRef: true },
        { title: "Competition law advisory", category: "Advisory", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    // Corporate Services
    { name: "Planning, Research and Statistics", shortCode: "PRS", category: "CORPORATE" as const,
      description: "Institutional planning, research, monitoring and evaluation",
      units: ["Planning", "Research and Statistics", "Monitoring and Evaluation"],
      tasks: [
        { title: "Annual work plan preparation", category: "Planning", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Research paper / policy brief", category: "Research", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Statistical data compilation", category: "Statistics", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "M&E field visit / assessment", category: "Monitoring", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Performance indicator tracking", category: "Monitoring", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Budget performance review", category: "Review", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Management report preparation", category: "Reporting", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Finance and Accounts", shortCode: "FIN", category: "CORPORATE" as const,
      description: "Revenue, expenditure, budget management and fiscal reporting",
      units: ["Revenue and External Assistance", "Expenditure", "Budget", "Final and Fiscal Reporting"],
      tasks: [
        { title: "Revenue collection / reconciliation", category: "Revenue", requiresAmount: true },
        { title: "Payment processing / voucher", category: "Expenditure", requiresAmount: true, requiresEvidence: true },
        { title: "Budget preparation / review", category: "Budget", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Financial statement preparation", category: "Reporting", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Bank reconciliation", category: "Reconciliation", requiresAmount: true },
        { title: "External assistance tracking", category: "Revenue", requiresAmount: true },
        { title: "Audit response / queries", category: "Audit", requiresEvidence: true },
        { title: "Payroll processing", category: "Payroll", requiresAmount: true },
      ]
    },
    { name: "Human Resource Management", shortCode: "HRM", category: "CORPORATE" as const,
      description: "Staff appointment, training, welfare and general services",
      units: ["Appointment, Promotion and Discipline", "Staff Training and Welfare", "General Services"],
      tasks: [
        { title: "Staff recruitment / interview", category: "Recruitment", requiresEvidence: true },
        { title: "Appointment / promotion letter", category: "Appointment" },
        { title: "Disciplinary proceeding", category: "Discipline", requiresCaseRef: true },
        { title: "Training programme coordination", category: "Training", requiresEvidence: true },
        { title: "Leave management / approval", category: "Welfare" },
        { title: "Staff welfare activity", category: "Welfare" },
        { title: "General services administration", category: "Administration" },
        { title: "Performance appraisal coordination", category: "Appraisal" },
        { title: "HR policy review / update", category: "Policy" },
      ]
    },
    // Standalone Units
    { name: "Legal", shortCode: "LGL", category: "STANDALONE" as const,
      description: "Litigation and board secretariat functions",
      units: ["Litigation", "Board Secretariat"],
      tasks: [
        { title: "Case filing and court appearance", category: "Litigation", requiresCaseRef: true },
        { title: "Legal opinion / advisory", category: "Advisory", requiresCaseRef: true },
        { title: "Contract review / drafting", category: "Contracts", requiresEvidence: true },
        { title: "Board meeting preparation", category: "Secretariat", requiresEvidence: true },
        { title: "Board resolution drafting", category: "Secretariat" },
        { title: "Legislation / regulation review", category: "Policy" },
        { title: "Settlement negotiation", category: "Litigation", requiresCaseRef: true },
      ]
    },
    { name: "Internal Audit", shortCode: "AUD", category: "STANDALONE" as const,
      description: "Internal audit and compliance",
      units: [],
      tasks: [
        { title: "Compliance audit / review", category: "Audit", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Financial audit fieldwork", category: "Audit", requiresEvidence: true, requiresCaseRef: false, requiresAmount: true },
        { title: "Audit report preparation", category: "Reporting", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Risk assessment", category: "Risk", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Follow-up on audit findings", category: "Follow-up", requiresCaseRef: true, requiresEvidence: false, requiresAmount: false },
        { title: "Internal control review", category: "Control", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Procurement", shortCode: "PCM", category: "STANDALONE" as const,
      description: "Purchasing and vendor management",
      units: [],
      tasks: [
        { title: "Procurement requisition processing", category: "Procurement", requiresAmount: true, requiresEvidence: false, requiresCaseRef: false },
        { title: "Vendor evaluation / selection", category: "Procurement", requiresEvidence: true, requiresAmount: false, requiresCaseRef: false },
        { title: "Contract award and management", category: "Contracts", requiresAmount: true, requiresEvidence: true, requiresCaseRef: false },
        { title: "Bid document preparation", category: "Bidding", requiresEvidence: true, requiresAmount: false, requiresCaseRef: false },
        { title: "Market survey / price comparison", category: "Survey", requiresAmount: true, requiresEvidence: false, requiresCaseRef: false },
        { title: "Procurement committee sitting", category: "Committee", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Goods receipt and verification", category: "Verification", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "ICT", shortCode: "ICT", category: "STANDALONE" as const,
      description: "Information and communications technology",
      units: [],
      tasks: [
        { title: "System maintenance / upgrade", category: "Infrastructure", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "User support / helpdesk ticket", category: "Support", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Network troubleshooting", category: "Infrastructure", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Software installation / configuration", category: "Systems", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Data backup and recovery", category: "Security", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Cybersecurity review / patch", category: "Security", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Website / portal update", category: "Web", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "IT procurement specification", category: "Procurement", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Training on IT system", category: "Training", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Press and Protocol", shortCode: "P&P", category: "STANDALONE" as const,
      description: "Communications, stock verification, and ACTU",
      units: ["Press & Protocol", "Stock Verification", "ACTU"],
      tasks: [
        { title: "Press release preparation", category: "Communications", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Media monitoring / clipping", category: "Communications", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Protocol event coordination", category: "Protocol", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Stock verification exercise", category: "Verification", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Social media management", category: "Communications", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Visitor / delegation reception", category: "Protocol", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
    { name: "Outstations and Stakeholder Coordination", shortCode: "OSC", category: "STANDALONE" as const,
      description: "Regional offices and stakeholder liaison",
      units: [],
      tasks: [
        { title: "Regional office coordination", category: "Coordination", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "Stakeholder engagement meeting", category: "Engagement", requiresEvidence: true, requiresCaseRef: false, requiresAmount: false },
        { title: "Field complaint resolution", category: "Complaints", requiresCaseRef: true, requiresEvidence: false, requiresAmount: false },
        { title: "Regional report preparation", category: "Reporting", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
        { title: "MOU / partnership facilitation", category: "Partnerships", requiresEvidence: false, requiresCaseRef: false, requiresAmount: false },
      ]
    },
  ];

  // Create all departments, units, and task templates
  for (const dept of departments) {
    const created = await prisma.department.upsert({
      where: { shortCode: dept.shortCode },
      update: {},
      create: {
        name: dept.name,
        shortCode: dept.shortCode,
        category: dept.category,
        description: dept.description,
      },
    });

    // Create units
    for (const unitName of dept.units) {
      await prisma.unit.upsert({
        where: { departmentId_shortCode: { departmentId: created.id, shortCode: unitName.slice(0, 6).toUpperCase() } },
        update: {},
        create: {
          name: unitName,
          shortCode: unitName.slice(0, 6).toUpperCase(),
          departmentId: created.id,
        },
      });
    }

    // Create task templates
    for (const task of dept.tasks) {
      await prisma.taskTemplate.create({
        data: {
          departmentId: created.id,
          title: task.title,
          category: task.category,
          requiresEvidence: task.requiresEvidence ?? false,
          requiresCaseRef: task.requiresCaseRef ?? false,
          requiresAmount: task.requiresCaseRef ?? false,
        },
      });
    }

    console.log(`Created: ${dept.name} with ${dept.units.length} units and ${dept.tasks.length} task types`);
  }

  // Create admin user
  const password = await bcrypt.hash("Admin@1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@fccpc.gov.ng" },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@fccpc.gov.ng",
      password,
      role: "ADMIN",
      staffId: "FCCPC/ADM/001",
    },
  });

  console.log("\nSeed complete!");
  console.log("Login: admin@fccpc.gov.ng / Admin@1234");
}

main().catch(console.error).finally(() => prisma.$disconnect());