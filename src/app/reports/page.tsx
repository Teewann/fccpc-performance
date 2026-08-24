"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

// ─── Types ────────────────────────────────────────────────────
type ReportConfig = {
  id:          string;
  title:       string;
  description: string;
  type:        string;
  icon:        string;
  iconBg:      string;
  iconColor:   string;
  formats:     ("PDF" | "Excel")[];
};

type Period = "weekly" | "monthly" | "quarterly" | "annual";
type Department = { id: string; name: string };

// ─── Report definitions ────────────────────────────────────────
const REPORTS: ReportConfig[] = [
  {
    id: "staff-logs",
    title: "Staff Productivity Log",
    description:
      "All daily work logs with task details, time spent, approval status and supervisor scores",
    type: "staff-logs",
    icon: "📋",
    iconBg: "#0c1a2e",
    iconColor: "#60a5fa",
    formats: ["PDF", "Excel"],
  },
  {
    id: "kpi-summary",
    title: "KPI Performance Summary",
    description:
      "All department KPIs with targets, current progress, percentage completion and status",
    type: "kpi-summary",
    icon: "🎯",
    iconBg: "#052e16",
    iconColor: "#4ade80",
    formats: ["PDF", "Excel"],
  },
  {
    id: "dept-ranking",
    title: "Department Rankings",
    description:
      "Comparative department performance: approval rates, log volumes, quality scores",
    type: "dept-ranking",
    icon: "🏆",
    iconBg: "#1c1107",
    iconColor: "#f59e0b",
    formats: ["PDF", "Excel"],
  },
  {
    id: "appraisal",
    title: "Staff Appraisal Report",
    description:
      "Individual staff performance ratings based on log data: suitable for HR review",
    type: "appraisal",
    icon: "👤",
    iconBg: "#1a0a2e",
    iconColor: "#a78bfa",
    formats: ["PDF", "Excel"],
  },
  {
    id: "tasks",
    title: "Task Report",
    description:
      "All department and EVC tasks — who assigned them, who they're assigned to, status and completion.",
    type: "tasks",
    icon: "✅",
    iconBg: "#1a0a2e",
    iconColor: "#a78bfa",
    formats: ["PDF", "Excel"],
  },
  {
    id: "communications",
    title: "Communications Report",
    description:
      "Announcements and memos posted, audience reached, and read rates. HR/Director/Admin/Executive only.",
    type: "communications",
    icon: "📢",
    iconBg: "#1c1107",
    iconColor: "#f59e0b",
    formats: ["PDF", "Excel"],
  },
  {
    id: "leave",
    title: "Leave Report",
    description:
      "Leave requests — type, dates, days taken, and approval status.",
    type: "leave",
    icon: "🏖️",
    iconBg: "#0c1a2e",
    iconColor: "#60a5fa",
    formats: ["PDF", "Excel"],
  },
  {
    id: "attendance",
    title: "Attendance Report",
    description:
      "Check-in/out times, hours worked, and on-premises status for the period.",
    type: "attendance",
    icon: "🕐",
    iconBg: "#1c1107",
    iconColor: "#f59e0b",
    formats: ["PDF", "Excel"],
  },
  {
    id: "exams",
    title: "Promotion Exam Report",
    description:
      "Exam attempts, scores, and pass/fail results by staff.",
    type: "exams",
    icon: "🎓",
    iconBg: "#1a0a2e",
    iconColor: "#a78bfa",
    formats: ["PDF", "Excel"],
  },
  {
    id: "staff-directory",
    title: "Staff Directory Report",
    description:
      "Full staff list with roles, departments, and status — for headcount and org records.",
    type: "staff-directory",
    icon: "👥",
    iconBg: "#052e16",
    iconColor: "#4ade80",
    formats: ["PDF", "Excel"],
  },
  {
    id: "chats",
    title: "Chat Export",
    description:
      "Full chat message log for the period. Administrator only — every export is itself logged.",
    type: "chats",
    icon: "💬",
    iconBg: "#1f0707",
    iconColor: "#f87171",
    formats: ["PDF", "Excel"],
  },
    {
    id: "kpi-trend",
    title: "KPI Trend Report",
    description: "How each KPI has moved over time, not just its current snapshot.",
    type: "kpi-trend",
    icon: "📈",
    iconBg: "#052e16",
    iconColor: "#4ade80",
    formats: ["PDF", "Excel"],
  },
  {
    id: "audit-trail",
    title: "System Audit Trail",
    description:
      "Every recorded system action - logins, approvals, check-ins, edits - with user, detail, IP and timestamp. Admin only.",
    type: "audit-trail",
    icon: "🔒",
    iconBg: "#1f0707",
    iconColor: "#f87171",
    formats: ["PDF", "Excel"],
  },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "quarterly", label: "This quarter" },
  { value: "annual", label: "This year" },
];

// ─── Excel export helper ──────────────────────────────────────
async function exportToExcel(rows: any[], filename: string, title: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const cols = Object.keys(rows[0] || {}).map((k) => ({
    wch: Math.max(k.length + 4, 18),
  }));
  ws["!cols"] = cols;
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF export – dynamic columns, full text, no truncation ──
async function exportToPDF(
  rows: any[],
  filename: string,
  title: string,
  period: string,
  userInfo: { name: string; role: string },
  type?: string
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  const HEADER_COLOR: [number, number, number] = [30, 58, 95];
  const headerHeight = 28;

  // ── BLUE HEADER BAR ──────────────────────────────────────────
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, pageW, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("FCCPC Performance Intelligence System", pageW / 2, 10, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 215, 230);
  doc.text(
    `Federal Competition & Consumer Protection Commission  |  ${title}  |  Period: ${period}`,
    pageW / 2,
    18,
    { align: "center" }
  );

  doc.setTextColor(200, 215, 230);
  doc.setFontSize(8);
  const generatedTime = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  doc.text(
    `Generated by: ${userInfo.name} (${userInfo.role})  |  Date: ${generatedTime}`,
    pageW / 2,
    25,
    { align: "center" }
  );

  if (rows.length === 0) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(12);
    doc.text("No data available for this report.", margin, headerHeight + 15);
    doc.save(`${filename}.pdf`);
    return;
  }

  // ── Staff‑logs custom layout ────────────────────────────────
  if (type === "staff-logs") {
    const processedRows = rows.map((row) => {
      const { staffName, staffEmail, unit, taskCategory, ...rest } = row;
      return {
        staffIdentity: { name: staffName, email: staffEmail },
        department: row.department,
        taskTitle: row.taskTitle,
        description: row.description,
        timeSpent: row.timeSpent,
        priority: row.priority,
        status: row.status,
        caseRef: row.caseRef ?? "",
        supervisorScore: row.supervisorScore ?? "",
        supervisorComment: row.supervisorComment ?? "",
        date: row.date,
      };
    });

    const columns = [
      { key: "staffIdentity",   headerLines: ["Staff","Identity"], alignment: "left",  widthFraction: 0.13, isIdentity: true },
      { key: "department",      header: "Department",             alignment: "left",  widthFraction: 0.09 },
      { key: "taskTitle",       header: "Task Title",             alignment: "left",  widthFraction: 0.09 },
      { key: "description",     header: "Description",            alignment: "left",  widthFraction: 0.10 },
      { key: "timeSpent",       header: "Time Spent",             alignment: "center",widthFraction: 0.08 },
      { key: "priority",        header: "Priority",               alignment: "center",widthFraction: 0.09, noWrap: true },
      { key: "status",          header: "Status",                 alignment: "center",widthFraction: 0.09, noWrap: true },
      { key: "caseRef",         header: "Case Ref",               alignment: "center",widthFraction: 0.08 },
      { key: "supervisorScore", headerLines: ["Supervisor","Score"], alignment: "center",widthFraction: 0.08 },
      { key: "supervisorComment",headerLines: ["Supervisor","Comment"], alignment: "center",widthFraction: 0.09 },
      { key: "date",            header: "Date",                   alignment: "center",widthFraction: 0.08, noWrap: true },
    ];

    const availableWidth = pageW - margin * 2;
    const colWidths = columns.map(col => col.widthFraction * availableWidth);
    const colPositions: number[] = [];
    let xPos = margin;
    for (const w of colWidths) {
      colPositions.push(xPos);
      xPos += w;
    }

    const cellPadding = 2;
    const headerRowH = 14;
    let y = headerHeight + 6;

    doc.setFillColor(...HEADER_COLOR);
    doc.rect(margin, y, availableWidth, headerRowH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");

    columns.forEach((col, i) => {
      const centerX = colPositions[i] + colWidths[i] / 2;
      const leftX = colPositions[i] + cellPadding;
      const cellCenterY = y + headerRowH / 2;
      doc.setFontSize(col.headerLines ? 7 : 8);

      if (col.headerLines) {
        const line1 = col.headerLines[0];
        const line2 = col.headerLines[1];
        const lineH = 3.8;
        const totalH = lineH * 2;
        const startY = cellCenterY - totalH / 2 + lineH / 2;
        if (col.alignment === "left") {
          doc.text(line1, leftX, startY, { align: "left" });
          doc.text(line2, leftX, startY + lineH, { align: "left" });
        } else {
          doc.text(line1, centerX, startY, { align: "center" });
          doc.text(line2, centerX, startY + lineH, { align: "center" });
        }
      } else {
        if (col.alignment === "left") {
          doc.text(col.header!, leftX, cellCenterY, { align: "left" });
        } else {
          doc.text(col.header!, centerX, cellCenterY, { align: "center" });
        }
      }
    });

    y += headerRowH;

    doc.setFont("helvetica", "normal");
    const baseFontSize = 9;
    const lineHeight = 5;

    processedRows.forEach((row, ri) => {
      const cellData = columns.map((col, i) => {
        const effectiveWidth = colWidths[i] - cellPadding * 2;
        let lines: string[] = [];
        if (col.isIdentity) {
          lines = [row.staffIdentity.name, row.staffIdentity.email];
        } else if (col.noWrap) {
          lines = [(row as any)[col.key]?.toString() || ""];
        } else {
          const raw = (row as any)[col.key]?.toString() || "";
          lines = doc.splitTextToSize(raw, effectiveWidth);
        }
        return { lines, colKey: col.key, isIdentity: col.isIdentity, alignment: col.alignment };
      });

      const maxLines = Math.max(...cellData.map(d => d.lines.length), 1);
      const rowHeight = maxLines * lineHeight + 4;

      if (y + rowHeight > pageH - 16) {
        doc.addPage();
        y = 14;
      }

      if (ri % 2 === 0) {
        doc.setFillColor(240, 245, 250);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, y, availableWidth, rowHeight, "F");

      cellData.forEach((cell, i) => {
        const col = columns[i];
        const centerX = colPositions[i] + colWidths[i] / 2;
        const leftX = colPositions[i] + cellPadding;
        const textBlockHeight = cell.lines.length * lineHeight;
        const startY = y + (rowHeight - textBlockHeight) / 2 + lineHeight * 0.8;

        if (cell.isIdentity) {
          doc.setFontSize(baseFontSize);
          doc.setTextColor(50, 50, 50);
          doc.text(cell.lines[0], leftX, startY, { align: "left" });
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text(cell.lines[1], leftX, startY + lineHeight, { align: "left" });
        } else {
          const firstLine = cell.lines[0] || "";
          let cellColor: [number, number, number] = [50, 50, 50];
          if (cell.colKey === "status") {
            const lower = firstLine.toLowerCase();
            if (lower.includes("approved")) cellColor = [34, 197, 94];
            else if (lower.includes("rejected")) cellColor = [239, 68, 68];
            else if (lower.includes("pending") || lower.includes("submitted"))
              cellColor = [245, 158, 11];
          }

          doc.setTextColor(...cellColor);
          doc.setFontSize(baseFontSize);

          cell.lines.forEach((line: string, li: number) => {
            if (cell.alignment === "left") {
              doc.text(line, leftX, startY + li * lineHeight, { align: "left" });
            } else {
              doc.text(line, centerX, startY + li * lineHeight, { align: "center" });
            }
          });
        }
      });

      y += rowHeight;
    });

    doc.setFillColor(...HEADER_COLOR);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(
      `FCCPC Performance Intelligence System  |  Confidential  |  Page 1  |  ${new Date().toLocaleDateString("en-GB")}`,
      pageW / 2,
      pageH - 3,
      { align: "center" }
    );

    doc.save(`${filename}.pdf`);
    return;
  }

  // ── GENERIC REPORTS – full text, no truncation ──
  const headers = Object.keys(rows[0]);
  const availableWidth = pageW - margin * 2;
  const cellPadding = 2;

  // 1. Measure the maximum text width for each column
  const columnMaxWidths = headers.map((header) => {
    const headerLabel = header
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
    let maxW = doc.getTextWidth(headerLabel);

    for (const row of rows) {
      const val = (row[header] ?? "").toString();
      const tw = doc.getTextWidth(val);
      if (tw > maxW) maxW = tw;
    }
    return maxW;
  });

  const totalTextWidth = columnMaxWidths.reduce((a, b) => a + b, 0) || 1;
  const minColWidth = 20;
  const unscaledWidths = columnMaxWidths.map((w) => {
    const desired = (w / totalTextWidth) * availableWidth;
    return Math.max(desired, minColWidth);
  });

  let totalUnscaled = unscaledWidths.reduce((a, b) => a + b, 0);
  const scale = availableWidth / totalUnscaled;
  const colWidths = unscaledWidths.map((w) => w * scale);

  const colPositions: number[] = [];
  let xPos = margin;
  for (const w of colWidths) {
    colPositions.push(xPos);
    xPos += w;
  }

  const headerRowH = 10;
  let y = headerHeight + 6;

  doc.setFillColor(...HEADER_COLOR);
  doc.rect(margin, y, availableWidth, headerRowH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  headers.forEach((h, i) => {
    const label = h
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
    const centerX = colPositions[i] + colWidths[i] / 2;
    doc.text(label, centerX, y + headerRowH / 2 + 2, { align: "center" });
  });

  y += headerRowH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lineHeight = 5;

  rows.forEach((row, ri) => {
    const cellLines = headers.map((h, i) => {
      const val = (row[h] ?? "").toString();
      const maxWidth = colWidths[i] - cellPadding * 2;
      return doc.splitTextToSize(val, maxWidth);
    });

    const maxLines = Math.max(...cellLines.map(lines => lines.length), 1);
    const rowHeight = maxLines * lineHeight + 4;

    if (y + rowHeight > pageH - 16) {
      doc.addPage();
      y = 14;
    }

    if (ri % 2 === 0) {
      doc.setFillColor(240, 245, 250);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, y, availableWidth, rowHeight, "F");

    headers.forEach((h, i) => {
      const raw = (row[h] ?? "").toString();
      let cellColor: [number, number, number] = [50, 50, 50];
      if (h.toLowerCase().includes("status") ||
          h === "performanceRating" ||
          h === "approvalStatus" ||
          h === "verificationMethod" ||
          h === "result" ||
          h === "status") {
        const lower = raw.toLowerCase();
        if (lower.includes("approved") || lower.includes("on track") || lower.includes("excellent") ||
            lower.includes("good") || lower.includes("satisfactory") || lower.includes("present") ||
            lower.includes("passed") || lower.includes("active") || lower.includes("completed") ||
            lower.includes("treated") || lower.includes("accepted")) {
          cellColor = [34, 197, 94];
        } else if (lower.includes("rejected") || lower.includes("needs improvement") ||
                   lower.includes("absent") || lower.includes("failed") || lower.includes("inactive") ||
                   lower.includes("cancelled") || lower.includes("revoked") || lower.includes("behind") ||
                   lower.includes("overdue")) {
          cellColor = [239, 68, 68];
        } else if (lower.includes("pending") || lower.includes("submitted") ||
                   lower.includes("at risk") || lower.includes("late") || lower.includes("under") ||
                   lower.includes("in progress") || lower.includes("suspended")) {
          cellColor = [245, 158, 11];
        }
      }

      doc.setTextColor(...cellColor);
      const lines = cellLines[i];
      const centerX = colPositions[i] + colWidths[i] / 2;
      const textBlockHeight = lines.length * lineHeight;
      const startY = y + (rowHeight - textBlockHeight) / 2 + lineHeight * 0.8;

      lines.forEach((line: string, li: number) => {
        doc.text(line, centerX, startY + li * lineHeight, { align: "center" });
      });
    });

    y += rowHeight;
  });

  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(
    `FCCPC Performance Intelligence System  |  Confidential  |  Page 1  |  ${new Date().toLocaleDateString("en-GB")}`,
    pageW / 2,
    pageH - 3,
    { align: "center" }
  );

  doc.save(`${filename}.pdf`);
}

// ─── Staff Picker Component ────────────────────────────────────
function StaffPicker({
  value,
  onChange,
  callerRole,
  callerDeptId
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  callerRole: string;
  callerDeptId: string | null;
}) {
  const [staff, setStaff] = useState<{ id: string; name: string; department: { name: string } | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callerRole || !["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(callerRole)) return;
    setLoading(true);
    const url = callerRole === "DIRECTOR" && callerDeptId
      ? `/api/users?deptId=${callerDeptId}&limit=500`
      : "/api/users?limit=500";
    fetch(url)
      .then(r => r.json())
      .then(d => setStaff(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [callerRole, callerDeptId]);

  if (!["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(callerRole)) return null;

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      style={{
        width: "100%",
        background: "var(--bg-input)",
        border: "0.5px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 14,
        color: "var(--text-primary)",
        outline: "none",
        boxSizing: "border-box",
      }}
    >
      <option value="">All staff {callerRole === "DIRECTOR" ? "in my department" : ""}</option>
      {loading ? (
        <option disabled>Loading...</option>
      ) : (
        staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.department ? `(${s.department.name})` : ""}
          </option>
        ))
      )}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastExported, setLastExported] = useState<Record<string, string>>({});
  const [role, setRole] = useState("");
  const [deptId, setDeptId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    fetch("/api/settings/account")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setRole(d.user.role);
          setDeptId(d.user.departmentId || null);
        }
      })
      .catch(() => {});

    fetch("/api/departments")
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
      .catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const personScoped = ["staff-logs", "appraisal", "tasks", "leave", "attendance"];
  const showPicker = role === "DIRECTOR" || ["HR", "ADMIN", "EXECUTIVE"].includes(role);
  const canFilterDept = ["HR", "ADMIN", "EXECUTIVE"].includes(role);

  function toggleDept(id: string) {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleExport(report: ReportConfig, format: "PDF" | "Excel") {
    const key = `${report.id}-${format}`;
    setLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const params = new URLSearchParams({
        type: report.type,
        period: useCustomRange ? "custom" : period
      });

      if (personScoped.includes(report.id) && targetUserId) {
        params.set("targetUserId", targetUserId);
      }
      if (selectedDeptIds.length > 0) {
        params.set("deptIds", selectedDeptIds.join(","));
      }
      if (useCustomRange && customFrom && customTo) {
        params.set("dateFrom", customFrom);
        params.set("dateTo", customTo);
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      const meta = data.meta || {
        requestedBy: { name: "Unknown", role: "Unknown" },
      };

      if (!res.ok || !data.rows) {
        alert("Failed to fetch report data. Please try again.");
        return;
      }

      const filename = `FCCPC_${report.title.replace(/\s+/g, "_")}_${period}_${new Date().toISOString().slice(0, 10)}`;

      if (format === "Excel") {
        await exportToExcel(data.rows, filename, report.title);
      } else {
        await exportToPDF(
          data.rows,
          filename,
          report.title,
          period,
          meta.requestedBy,
          report.type
        );
      }

      setLastExported((prev) => ({
        ...prev,
        [key]: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
    } catch (err) {
      console.error(err);
      alert("Export failed. Please check console for details.");
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Intelligence Reports
            </h1>
            <p style={{
              fontSize: 15,
              color: "#d97706",
              marginTop: 4,
              fontWeight: 500,
            }}>
              {today} · Export data as PDF or Excel
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              borderRadius: 10, border: "1.5px solid #22c55e",
              background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Live data
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* ─── Period selector with Custom Range ─────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#800020",
            marginBottom: 10
          }}>
            Report period
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setUseCustomRange(false); }}
                style={{
                  padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: `0.5px solid ${!useCustomRange && period === p.value ? "var(--accent)" : "var(--border)"}`,
                  background: !useCustomRange && period === p.value ? "var(--accent-bg)" : "var(--bg-card)",
                  color: !useCustomRange && period === p.value ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setUseCustomRange(true)}
              style={{
                padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: `0.5px solid ${useCustomRange ? "var(--accent)" : "var(--border)"}`,
                background: useCustomRange ? "var(--accent-bg)" : "var(--bg-card)",
                color: useCustomRange ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Custom range
            </button>
          </div>

          {useCustomRange && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>From</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)"
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>To</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)"
                }}
              />
            </div>
          )}
        </div>

        {/* ─── Staff Picker + Department Filter ──────────────────── */}
        {showPicker && (
          <div style={{ marginBottom: 28, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 420, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                Generate for a specific staff member (optional)
              </div>
              <StaffPicker
                value={targetUserId}
                onChange={setTargetUserId}
                callerRole={role}
                callerDeptId={deptId}
              />
            </div>

            {canFilterDept && (
              <div style={{ maxWidth: 420, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                  Filter by department(s) (optional)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {departments.map(d => {
                    const active = selectedDeptIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => toggleDept(d.id)}
                        style={{
                          padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                          border: active ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
                          background: active ? "#052e16" : "var(--bg-input)",
                          color: active ? "#4ade80" : "var(--text-muted)",
                        }}
                      >
                        {d.name}
                      </button>
                    );
                  })}
                </div>
                {selectedDeptIds.length > 0 && (
                  <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 6 }}>
                    Selected: {selectedDeptIds.length} department{selectedDeptIds.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}

            <div style={{
              fontSize: 12,
              color: "#60a5fa",
              background: "#0c1a2e",
              border: "0.5px solid #1e3a5f",
              borderRadius: 8,
              padding: "10px 14px",
              flexBasis: "100%"
            }}>
              <strong>📌 Note:</strong> Staff filter applies to Task, Staff Productivity, Appraisal, Leave and Attendance reports.
              Department filter applies to the same, plus KPI and Department Rankings.
              Leave both empty for {role === "DIRECTOR" ? "your whole department" : "the whole organisation"}.
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{
          background: "#0c1a2e", border: "0.5px solid #1e3a5f",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <div style={{ fontSize: 14, color: "#60a5fa", lineHeight: 1.5 }}>
            All reports are generated from live data. PDF files are formatted for printing and board presentations.
            Excel files are formatted for data analysis and further processing.
          </div>
        </div>

        {/* Report cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {REPORTS.filter(r =>
            (r.id !== "audit-trail" && r.id !== "chats") || role === "ADMIN"
          ).map((report) => (
            <div
              key={report.id}
              className="card-bg"
              style={{ borderRadius: 16, padding: "24px 24px 20px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: report.iconBg, border: `0.5px solid ${report.iconColor}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {report.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.01em" }}>
                    {report.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {report.description}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: "0.5px", background: "var(--border-soft)" }} />

              {/* Export buttons */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {report.formats.map((fmt) => {
                  const key      = `${report.id}-${fmt}`;
                  const isLoading = loading[key];
                  const lastExp  = lastExported[key];

                  return (
                    <button
                      key={fmt}
                      onClick={() => handleExport(report, fmt)}
                      disabled={isLoading}
                      style={{
                        flex: 1, padding: "11px 16px", borderRadius: 10,
                        fontSize: 14, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.15s",
                        ...(fmt === "PDF"
                          ? { background: "#0c1a2e", border: "0.5px solid #1e3a5f", color: "#60a5fa" }
                          : { background: "#052e16", border: "0.5px solid #14532d", color: "#4ade80" }
                        ),
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? (
                        <>
                          <span style={{ fontSize: 13 }}>⏳</span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 14 }}>{fmt === "PDF" ? "📄" : "📊"}</span>
                          Export {fmt}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Last exported info */}
              {(lastExported[`${report.id}-PDF`] || lastExported[`${report.id}-Excel`]) && (
                <div style={{ fontSize: 12, color: "var(--text-hint)", display: "flex", gap: 12 }}>
                  {lastExported[`${report.id}-PDF`] && (
                    <span>PDF exported at {lastExported[`${report.id}-PDF`]}</span>
                  )}
                  {lastExported[`${report.id}-Excel`] && (
                    <span>Excel exported at {lastExported[`${report.id}-Excel`]}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom note - RED DARK COLOR */}
        <div style={{
          marginTop: 24,
          padding: "16px 20px",
          background: "#1a0000",
          border: "1px solid #800020",
          borderRadius: 12,
          fontSize: 13,
          color: "#cc3333",
          lineHeight: 1.6,
          fontWeight: 500,
          fontStyle: "italic",
        }}>
          <strong style={{ color: "#ff4444" }}>🔒 Security note:</strong> All reports contain live
          FCCPC data and are classified as internal documents. Do not distribute outside the Commission
          without authorisation from your Director or the Executive Vice Chairman.
        </div>
      </main>
    </div>
  );
}