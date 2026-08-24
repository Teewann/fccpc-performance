import prisma from "@/lib/prisma";

/**
 * Call this whenever a real event happens that should count toward a KPI —
 * e.g. a revenue submission gets approved, a task gets completed, etc.
 * It finds any KPI for that department with a matching sourceType and adds to it.
 */
export async function applyAutoContribution(
  departmentId: string,
  sourceType: string,       // e.g. "AUTO_REVENUE"
  amount: number,
  note?: string
) {
  const matchingKpis = await prisma.kPI.findMany({
    where: { departmentId, sourceType },
  });

  for (const kpi of matchingKpis) {
    const newCurrent = kpi.current + amount;
    await prisma.kPI.update({ where: { id: kpi.id }, data: { current: newCurrent } });
    await prisma.kPISnapshot.create({
      data: { kpiId: kpi.id, value: newCurrent, note: note || `Auto-added ${amount} from ${sourceType}` },
    });
  }
}