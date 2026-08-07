import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DEPARTMENTS = [
  // ── OPERATIONS (under ECOPs) ────────────────────────────────────────
  {
    name:        "Surveillance and Investigation",
    shortCode:   "S&I",
    category:    "OPERATIONS",
    description: "Enforcement, investigation and dispute resolution",
    units: [
      { name: "Enforcement",        shortCode: "ENF" },
      { name: "Investigation",      shortCode: "INV" },
      { name: "Dispute Resolution", shortCode: "DR"  },
    ],
  },
  {
    name:        "Consumer and Business Education",
    shortCode:   "CBE",
    category:    "OPERATIONS",
    description: "Consumer education and business education programmes",
    units: [
      { name: "Customer Education", shortCode: "CE" },
      { name: "Business Education", shortCode: "BE" },
    ],
  },
  {
    name:        "Quality Assurance",
    shortCode:   "QA",
    category:    "OPERATIONS",
    description: "Product listing, services, clinic management and laboratory",
    units: [
      { name: "Product Listing",       shortCode: "PL"  },
      { name: "Services",              shortCode: "SVC" },
      { name: "Clinic Management",     shortCode: "CM"  },
      { name: "Laboratory Services",   shortCode: "LAB" },
      { name: "Goods",                 shortCode: "GDS" },
    ],
  },
  {
    name:        "Mergers and Acquisitions",
    shortCode:   "M&A",
    category:    "OPERATIONS",
    description: "Merger notifications, acquisition filings and financial transactions",
    units: [
      { name: "Product Sector",  shortCode: "PS" },
      { name: "Services Sector", shortCode: "SS" },
    ],
  },
  {
    name:        "Anti-Competitive Practices",
    shortCode:   "ACP",
    category:    "OPERATIONS",
    description: "Monopoly and cartel investigations",
    units: [
      { name: "Monopoly", shortCode: "MON" },
      { name: "Cartel",   shortCode: "CAR" },
    ],
  },

  // ── CORPORATE SERVICES (under ECS) ──────────────────────────────────
  {
    name:        "Finance and Accounts",
    shortCode:   "FIN",
    category:    "CORPORATE",
    description: "Revenue, expenditure, budget and fiscal reporting",
    units: [
      { name: "Revenue and External Assistance", shortCode: "REA" },
      { name: "Expenditure",                    shortCode: "EXP" },
      { name: "Budget",                         shortCode: "BGT" },
      { name: "Final and Fiscal Reporting",     shortCode: "FFR" },
    ],
  },
  {
    name:        "Planning Research and Statistics",
    shortCode:   "PRS",
    category:    "CORPORATE",
    description: "Planning, research, statistics and monitoring",
    units: [
      { name: "Planning",              shortCode: "PLN" },
      { name: "Research and Statistics", shortCode: "R&S" },
      { name: "Monitoring and Evaluation", shortCode: "M&E" },
    ],
  },
  {
    name:        "Human Resource Management",
    shortCode:   "HRM",
    category:    "CORPORATE",
    description: "Appointment, training, welfare and general services",
    units: [
      { name: "Appointment, Promotion and Discipline", shortCode: "APD" },
      { name: "Staff Training and Welfare",            shortCode: "STW" },
      { name: "General Services",                      shortCode: "GS"  },
    ],
  },

  // ── DIRECTLY UNDER EVC ──────────────────────────────────────────────
  {
    name:        "Legal",
    shortCode:   "LGL",
    category:    "CORPORATE",
    description: "Litigation and board secretariat",
    units: [
      { name: "Litigation",        shortCode: "LIT" },
      { name: "Board Secretariat", shortCode: "BS"  },
    ],
  },
  {
    name:        "Corporate Affairs",
    shortCode:   "CA",
    category:    "CORPORATE",
    description: "Press, protocol, stock verification and ACTU",
    units: [
      { name: "Press and Protocol",    shortCode: "P&P"  },
      { name: "Stock Verification",    shortCode: "SV"   },
      { name: "ACTU",                  shortCode: "ACTU" },
    ],
  },
  {
    name:        "Internal Audit",
    shortCode:   "IA",
    category:    "CORPORATE",
    description: "Internal audit and compliance",
    units: [],
  },
  {
    name:        "Procurement",
    shortCode:   "PROC",
    category:    "CORPORATE",
    description: "Procurement and supply",
    units: [],
  },
  {
    name:        "ICT",
    shortCode:   "ICT",
    category:    "CORPORATE",
    description: "Information and communication technology",
    units: [],
  },

  // ── NEW DEPARTMENTS (from your list) ───────────────────────────────
  {
    name:        "Administration",
    shortCode:   "ADM",
    category:    "CORPORATE",
    description: "General administration and office management",
    units: [],
  },
  {
    name:        "Human Resources",
    shortCode:   "HR",
    category:    "CORPORATE",
    description: "HR operations and staff relations",
    units: [],
  },
  {
    name:        "Registry",
    shortCode:   "REG",
    category:    "CORPORATE",
    description: "File registry, records and documentation",
    units: [],
  },
  {
    name:        "Mail Office",
    shortCode:   "MAIL",
    category:    "CORPORATE",
    description: "Incoming and outgoing correspondence",
    units: [],
  },
  {
    name:        "Branch and Outstations",
    shortCode:   "BRANCH",
    category:    "STANDALONE",
    description: "Zonal offices, state offices and outstation coordination",
    units: [
      { name: "Lagos Zone",     shortCode: "LAG" },
      { name: "Kano Zone",      shortCode: "KAN" },
      { name: "Port Harcourt Zone", shortCode: "PHC" },
      { name: "Enugu Zone",     shortCode: "ENU" },
      { name: "Ibadan Zone",    shortCode: "IBA" },
      { name: "Maiduguri Zone", shortCode: "MAI" },
    ],
  },

  // ── EXECUTIVE OFFICES ───────────────────────────────────────────────
  {
    name:        "Office of the EVC",
    shortCode:   "EVC",
    category:    "EXECUTIVE",
    description: "Executive Vice Chairman / Chief Executive office",
    units: [],
  },
  {
    name:        "Executive Commissioner Operations",
    shortCode:   "ECOPS",
    category:    "EXECUTIVE",
    description: "Executive Commissioner (Operations) office",
    units: [],
  },
  {
    name:        "Executive Commissioner Corporate Services",
    shortCode:   "ECS",
    category:    "EXECUTIVE",
    description: "Executive Commissioner (Corporate Services) office",
    units: [],
  },
];

async function main() {
  console.log("🌱 Starting department seed...\n");
  let created = 0;
  let skipped = 0;

  for (const dept of DEPARTMENTS) {
    // ✅ Check if department exists by shortCode OR name
    const existing = await prisma.department.findFirst({
      where: {
        OR: [
          { shortCode: dept.shortCode },
          { name: dept.name }
        ]
      },
    });

    if (existing) {
      console.log(`  ⏭  Skipped (exists): ${dept.name} (${dept.shortCode})`);
      skipped++;

      // Still try to add any missing units
      for (const unit of dept.units) {
        const existingUnit = await prisma.unit.findFirst({
          where: { name: unit.name, departmentId: existing.id },
        });
        if (!existingUnit) {
          await prisma.unit.create({
            data: {
              name:         unit.name,
              shortCode:    unit.shortCode,
              departmentId: existing.id,
            },
          });
          console.log(`    + Added missing unit: ${unit.name}`);
        }
      }
      continue;
    }

    // Create department
    const newDept = await prisma.department.create({
      data: {
        name:        dept.name,
        shortCode:   dept.shortCode,
        category:    dept.category as any,
        description: dept.description,
      },
    });

    // Create units
    for (const unit of dept.units) {
      await prisma.unit.create({
        data: {
          name:         unit.name,
          shortCode:    unit.shortCode,
          departmentId: newDept.id,
        },
      });
    }

    console.log(`  ✅ Created: ${dept.name} (${dept.units.length} units)`);
    created++;
  }

  console.log(`\n✅ Done! Created: ${created}, Skipped: ${skipped}`);
  console.log("You can now assign users to these departments in the Users page.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
