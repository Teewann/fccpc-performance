"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import LogoutButton from "@/components/layout/LogoutButton";
import { useSession } from "next-auth/react";
import { AGENCY } from "@/config/agency.config";
import UserAvatar from "@/components/UserAvatar";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import NotificationBell from "@/components/layout/NotificationBell";
import { ScreenShareButton } from '@/components/screenshare/ScreenShareUI';

type NavLink = {
  label: string;
  href: string;
  badge?: string;
  badgeGreen?: boolean;
  icon?: string;
  iconColor?: string;
};

type NavSection = {
  section: string;
  links: NavLink[];
};

const NAV_LINKS: Record<string, { icon: string; color: string }> = {
  "/dashboard":        { icon: "▦",  color: "#60a5fa" },
  "/staff-logs":       { icon: "📋", color: "#a78bfa" },
  "/daily-log":        { icon: "📝", color: "#34d399" },
  "/check-in":         { icon: "🕐", color: "#f59e0b" },
  "/id-card":          { icon: "🪪", color: "#38bdf8" },
  "/intern":           { icon: "📓", color: "#fb923c" },
  "/supervisor":       { icon: "👁",  color: "#c084fc" },
  "/departments":      { icon: "🏢", color: "#60a5fa" },
  "/tasks":            { icon: "✅", color: "#4ade80" },
  "/kpi":              { icon: "📊", color: "#f472b6" },
  "/appraisals":       { icon: "⭐", color: "#fbbf24" },
  "/leave":            { icon: "🏖", color: "#34d399" },
  "/evc-directives":   { icon: "📌", color: "#f87171" },
  "/compliance":       { icon: "⚖",  color: "#a3e635" },
  "/portal":           { icon: "🏛",  color: "#60a5fa" },
  "/payment-workflow": { icon: "💳", color: "#34d399" },
  "/case-transfer":    { icon: "↔",  color: "#f59e0b" },
  "/ai-insights":      { icon: "✦",  color: "#e879f9" },
  "/reports":          { icon: "📈", color: "#60a5fa" },
  "/announcements":    { icon: "📢", color: "#fb923c" },
  "/exams":            { icon: "🎓", color: "#a78bfa" },
  "/staff-directory":  { icon: "👥", color: "#38bdf8" },
  "/chat":             { icon: "💬", color: "#4ade80" },
  "/users":            { icon: "🔧", color: "#f59e0b" },
  "/audit-trail":      { icon: "🔍", color: "#f87171" },
  "/settings":         { icon: "⚙",  color: "#94a3b8" },
  "/vc9k2":            { icon: "⚡", color: "#fbbf24" },
  "/admin/account-activation": { icon: "🔑", color: "#f472b6" },
};

function makeLink(label: string, href: string, extra?: Partial<NavLink>): NavLink {
  const cfg = NAV_LINKS[href] || { icon: "•", color: "#94a3b8" };
  return { label, href, icon: cfg.icon, iconColor: cfg.color, ...extra };
}

function getNavItems(role: string): NavSection[] {
  const isIntern     = role === "INTERN";
  const isStaff      = role === "STAFF";
  const isSupervisor = role === "SUPERVISOR";
  const isDirector   = role === "DIRECTOR";
  const isHR         = role === "HR";
  const isAdmin      = role === "ADMIN";
  const isExecutive  = role === "EXECUTIVE";
  const isCorper     = role === "CORPER";
  const isITSiwes    = role === "IT_SIWES";
  const isContract   = role === "CONTRACT";
  const isConsultant = role === "CONSULTANT";
  const isOther      = role === "OTHER";

  const isRegularStaff   = isStaff || isSupervisor || isDirector || isCorper || isITSiwes || isContract || isConsultant || isOther;
  const canReviewLogs    = isSupervisor || isDirector || isHR || isAdmin || isExecutive;
  const canSeeKPI        = isDirector || isHR || isAdmin || isExecutive;
  const canSeeAppraisals = isHR || isAdmin || isExecutive;
  const canSeeAI         = isDirector || isHR || isAdmin || isExecutive;
  const canSeeReports    = isDirector || isHR || isAdmin || isExecutive;
  const canSeeExams      = isHR || isAdmin || isExecutive || isStaff || isSupervisor || isDirector;
  const canSeeUsers      = isAdmin;
  const canSeeAudit      = isAdmin;
  const canSeeActivation = isAdmin;

  if (isAdmin) {
    return [
      {
        section: "Core",
        links: [
          makeLink("Dashboard",      "/dashboard" ),
          makeLink("Staff Logs",     "/staff-logs"),
          makeLink("Daily Work Log", "/daily-log" ),
          makeLink("Attendance",     "/check-in"  ),
          makeLink("ID Card",        "/id-card"   ),
          makeLink("Intern Log",     "/intern"    ),
        ],
      },
      {
        section: "Management",
        links: [
          makeLink("Supervisor Panel",      "/supervisor"    ),
          makeLink("Departments",           "/departments"   ),
          makeLink("Tasks",                 "/tasks"         ),
          makeLink("KPI Manager",           "/kpi"           ),
          makeLink("Appraisals",            "/appraisals"    ),
          makeLink("Leave",                 "/leave"         ),
          makeLink("EVC Directives",        "/evc-directives"),
          makeLink("Business Compliance",   "/compliance"    ),
          makeLink("Business Registration", "/portal"        ),
        ],
      },
      {
        section: "Intelligence",
        links: [
          makeLink("AI Insights",     "/ai-insights",    { badge: "AI", badgeGreen: true }),
          makeLink("Reports",         "/reports"        ),
          makeLink("Communications",  "/announcements"  ),
          makeLink("Promotion Exams", "/exams"          ),
          makeLink("Staff Directory", "/staff-directory"),
        ],
      },
      {
        section: "System",
        links: [
          makeLink("Chat",        "/chat"       ),
          makeLink("Users",       "/users"      ),
          makeLink("Audit Trail", "/audit-trail"),
          makeLink("Settings",    "/settings"   ),
          makeLink("EVC Suite",   "/vc9k2"      ),
          makeLink("Account Activation", "/admin/account-activation", { badge: "Admin", badgeGreen: true }),
        ],
      },
    ];
  }

  return [
    {
      section: "Core",
      links: [
        makeLink("Dashboard", "/dashboard"),
        ...(!isIntern ? [makeLink("Staff Logs", "/supervisor")] : []),
        ...(isRegularStaff ? [
          makeLink("Daily Work Log", "/daily-log"),
          makeLink("Performance", "/performance"),
          makeLink("Incentives", "/incentives"),
          makeLink("Attendance",     "/check-in" ),
          makeLink("ID Card",        "/id-card"  ),
        ] : []),
        ...(isIntern ? [makeLink("Intern Log", "/intern")] : []),
      ],
    },
    {
      section: "Management",
      links: [
        ...(canReviewLogs    ? [makeLink("Supervisor Panel",      "/supervisor"      )] : []),
        makeLink("Departments",           "/departments"     ),
        ...(!isIntern        ? [makeLink("Tasks",                 "/tasks"           )] : []),
        ...(canSeeKPI        ? [makeLink("KPI Manager",           "/kpi"             )] : []),
        ...(canSeeAppraisals ? [makeLink("Appraisals",            "/appraisals"      )] : []),
        makeLink("Leave",                 "/leave"           ),
        makeLink("EVC Directives",        "/evc-directives"  ),
        makeLink("Business Compliance",   "/compliance"      ),
        makeLink("Business Registration", "/portal"          ),
        makeLink("Payment Workflow",      "/payment-workflow"),
        makeLink("Case Transfer",         "/case-transfer"   ),
      ],
    },
    {
      section: "Intelligence",
      links: [
        ...(canSeeAI      ? [makeLink("AI Insights",    "/ai-insights",    { badge: "3", badgeGreen: true })] : []),
        ...(canSeeReports ? [makeLink("Reports",         "/reports"        )] : []),
        makeLink("Communications",  "/announcements"  ),
        ...(canSeeExams   ? [makeLink("Promotion Exams", "/exams"          )] : []),
        ...(!isIntern     ? [makeLink("Staff Directory", "/staff-directory")] : []),
      ],
    },
    {
      section: "System",
      links: [
        makeLink("Chat",     "/chat"    ),
        ...(canSeeUsers ? [makeLink("Users",       "/users"      )] : []),
        ...(canSeeAudit ? [makeLink("Audit Trail", "/audit-trail")] : []),
        makeLink("Settings", "/settings"),
        ...(isExecutive ? [makeLink("EVC Suite", "/vc9k2")] : []),
        ...(canSeeActivation ? [makeLink("Account Activation", "/admin/account-activation", { badge: "Admin", badgeGreen: true })] : []),
      ],
    },
  ].filter((s) => s.links.length > 0);
}

const TOP_ICONS = [
  { href: "/chat",           icon: "💬", color: "#4ade80", title: "Chat"           },
  { href: "/evc-directives", icon: "📌", color: "#f87171", title: "EVC Directives" },
  { href: "/announcements",  icon: "📢", color: "#fb923c", title: "Communications" },
  { href: "/tasks",          icon: "✅", color: "#34d399", title: "Tasks"          },
];

const SECTION_COLORS: Record<string, string> = {
  Core:         "#60a5fa",
  Management:   "#f59e0b",
  Intelligence: "#e879f9",
  System:       "#34d399",
};

// Persist collapsed sections in sessionStorage so they survive navigation
const STORAGE_KEY = "sidebar_closed_sections";

function loadClosedSections(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveClosedSections(s: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {}
}

export default function Sidebar() {
  const pathname               = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { data: session }      = useSession();
  const dark                   = theme === "dark";
  const role                   = (session?.user as any)?.role || "";
  const userName               = session?.user?.name || "User";

  const [userPhoto,      setUserPhoto]      = useState<string | null>(
    (session?.user as any)?.photo ?? session?.user?.image ?? null
  );
  const [userIdRef,      setUserIdRef]      = useState<string>("");
  const [collapsed,      setCollapsed]      = useState(false);
  const [expandedWidth, setExpandedWidth] = useState<number>(232);

  const isResizing = useRef(false);

  // Load from sessionStorage on mount so state persists across navigation
  const [closedSections, setClosedSections] = useState<Set<string>>(() => loadClosedSections());

  // Load saved width after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("sidebar_width");
      if (raw) {
        const w = Number(raw);
        if (!isNaN(w) && w >= 180 && w <= 400) {
          setExpandedWidth(w);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Check sessionStorage first — avoids a DB trip on every page navigation
    try {
      const cached = sessionStorage.getItem("sidebar_account_cache");
      if (cached) {
        const d = JSON.parse(cached);
        if (d?.photo)     setUserPhoto(d.photo);
        if (d?.userIdRef) setUserIdRef(d.userIdRef);
        return; // already have it this session, skip the network call
      }
    } catch {}

    fetch("/api/settings/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.photo)     setUserPhoto(d.user.photo);
        if (d?.user?.userIdRef) setUserIdRef(d.user.userIdRef);
        try {
          sessionStorage.setItem("sidebar_account_cache", JSON.stringify({
            photo: d?.user?.photo, userIdRef: d?.user?.userIdRef,
          }));
        } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const p = (session?.user as any)?.photo ?? session?.user?.image ?? null;
    if (p) setUserPhoto(p);
  }, [session]);

  const toggleSection = useCallback((s: string) => {
    setClosedSections((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      saveClosedSections(next);
      return next;
    });
  }, []);
  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [collapsed]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const newWidth = Math.min(400, Math.max(180, e.clientX));
      setExpandedWidth(newWidth);
    }
    function handleMouseUp() {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setExpandedWidth((w) => {
          try { sessionStorage.setItem("sidebar_width", String(w)); } catch {}
          return w;
        });
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const navItems     = getNavItems(role);
  const sidebarWidth = collapsed ? 62 : expandedWidth;

  return (
    <>
      <aside style={{
        width: sidebarWidth,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--bg-sidebar)",
        borderRight: "0.5px solid var(--border)",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        zIndex: 40,
      }}>

        {/* ══════════════════════════════════════
            SECTION 1 - LOGO (never shrinks)
        ══════════════════════════════════════ */}
        <div style={{
          flexShrink: 0,
          borderBottom: "0.5px solid var(--border-soft)",
          padding: collapsed ? "16px 10px 14px" : "18px 14px 16px",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
            /* Collapsed: logo only at very top */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: "#fff",
                border: "2px solid var(--accent)", display: "flex", alignItems: "center",
                justifyContent: "center", overflow: "hidden", padding: 2,
              }}>
                <Image src="/fccpc-logo.jpg" alt="FCCPC" width={32} height={32}
                  style={{ objectFit: "contain", borderRadius: "50%" }} />
              </div>
            </div>
          ) : (
            /* Expanded: full logo + name, exactly as before */
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                background: "#fff", border: "2px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", padding: 2,
              }}>
                <Image src="/fccpc-logo.jpg" alt="FCCPC" width={44} height={44}
                  style={{ objectFit: "contain", borderRadius: "50%" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
                  lineHeight: 1.2, whiteSpace: "nowrap",
                }}>
                  {AGENCY.shortName}
                </div>
                <div style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 3, whiteSpace: "normal", lineHeight: 1.35 }}>
                  {AGENCY.tagline}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            SECTION 2 - ICON STRIP (below logo)
        ══════════════════════════════════════ */}
        <div style={{
          flexShrink: 0,
          borderBottom: "0.5px solid var(--border-soft)",
          padding: collapsed ? "10px 8px" : "10px 12px",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
            /* Collapsed icon strip: collapse arrow + bell stacked */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {/* Expand arrow */}
              <button
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
                style={{
                  width: 36, height: 30, borderRadius: 7,
                  background: "var(--accent-bg)",
                  border: "2px solid var(--accent)",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "var(--accent)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "var(--accent)"; }}
              >
                ▶
              </button>
              <NotificationBell />
            </div>
          ) : (
            /* Expanded icon strip: collapse | bell | chat | evc | comms | tasks */
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 7px",
              borderRadius: 10,
              background: "var(--bg-input)",
              border: "0.5px solid var(--border)",
              gap: 2,
              overflow: "hidden", // prevents tasks icon from sticking out
            }}>
              {/* Collapse button */}
              <button
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: "var(--accent-bg)",
                  border: "2px solid var(--accent)",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "var(--accent)"; }}
              >
                ◀
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0, opacity: 0.5 }} />

              {/* Bell */}
              <div style={{ flexShrink: 0 }}>
                <NotificationBell />
              </div>

              {/* Quick-action icons */}
              {TOP_ICONS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15,
                      background: isActive ? `${item.color}25` : "transparent",
                      border: `2px solid ${isActive ? item.color + "60" : "transparent"}`,
                      textDecoration: "none", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${item.color}25`;
                      e.currentTarget.style.border = `2px solid ${item.color}60`;
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isActive ? `${item.color}25` : "transparent";
                      e.currentTarget.style.border = isActive ? `2px solid ${item.color}60` : "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {item.icon}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            SECTION 3 - NAV (scrollable)
        ══════════════════════════════════════ */}
        <nav style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: 4,
          paddingBottom: 8,
          // inhouse scroll - only this region scrolls
        }}>
          {collapsed ? (
            /* Icon-only when collapsed */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, paddingTop: 4 }}>
              {navItems.flatMap((s) => s.links).map((link) => {
                const isActive = pathname === link.href;
                const color    = link.iconColor || "#94a3b8";
                return (
                  <Link key={link.href} href={link.href} title={link.label} style={{
                    width: 44, height: 36, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    background: isActive ? `${color}22` : "transparent",
                    border: isActive ? `2px solid ${color}55` : "2px solid transparent",
                    textDecoration: "none", transition: "all 0.12s", position: "relative",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.border = `2px solid ${color}40`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? `${color}22` : "transparent"; e.currentTarget.style.border = isActive ? `2px solid ${color}55` : "2px solid transparent"; }}
                  >
                    {link.icon || "•"}
                    {link.badge && (
                      <span style={{
                        position: "absolute", top: 3, right: 3,
                        width: 7, height: 7, borderRadius: "50%",
                        background: link.badgeGreen ? "#22c55e" : "#ef4444",
                        border: "1.5px solid var(--bg-sidebar)",
                      }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Full nav */
            navItems.map((section) => {
              const isClosed = closedSections.has(section.section);
              const sColor   = SECTION_COLORS[section.section] || "#94a3b8";
              return (
                <div key={section.section}>
                  <button
                    onClick={() => toggleSection(section.section)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 14px 5px",
                      background: "none", border: "none", cursor: "pointer",
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.13em",
                      textTransform: "uppercase", color: sColor,
                    }}>
                      {section.section}
                    </span>
                    <span style={{
                      fontSize: 14, color: sColor, fontWeight: 900,
                      transform: isClosed ? "rotate(-90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s", display: "inline-block", lineHeight: 1,
                    }}>
                      ▾
                    </span>
                  </button>

                  <div style={{
                    overflow: "hidden",
                    maxHeight: isClosed ? 0 : 1200,
                    opacity: isClosed ? 0 : 1,
                    transition: "max-height 0.25s ease, opacity 0.2s ease",
                  }}>
                    {section.links.map((link) => {
                      const isActive = pathname === link.href;
                      const lColor   = link.iconColor || "#94a3b8";
                      return (
                        <Link key={link.href} href={link.href} style={{
                          display: "flex", alignItems: "center", gap: 9,
                          padding: "8px 14px 8px 12px", fontSize: 13,
                          borderLeft: `3px solid ${isActive ? lColor : "transparent"}`,
                          background: isActive ? `${lColor}18` : "transparent",
                          color: isActive ? lColor : "var(--text-muted)",
                          fontWeight: isActive ? 600 : 400,
                          textDecoration: "none", transition: "all 0.12s",
                        }}
                          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = `${lColor}12`; e.currentTarget.style.color = lColor; } }}
                          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; } }}
                        >
                          <span style={{ fontSize: 17, flexShrink: 0, minWidth: 22, textAlign: "center" }}>
                            {link.icon || "•"}
                          </span>
                          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {link.label}
                          </span>
                          {link.badge && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, flexShrink: 0,
                              background: link.badgeGreen ? "#22c55e22" : "#7f1d1d",
                              color: link.badgeGreen ? "#4ade80" : "#fca5a5",
                              border: link.badgeGreen ? "0.5px solid #22c55e44" : "none",
                            }}>
                              {link.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </nav>

        {/* ══════════════════════════════════════
          {/* ══════════════════════════════════════
    SECTION 4 - FOOTER (never scrolls)
        {/* ══════════════════════════════════════
            SECTION 4 - FOOTER (never scrolls)
        ══════════════════════════════════════ */}
        <div style={{
          flexShrink: 0,
          padding: collapsed ? "10px 8px" : "12px 12px 14px",
          borderTop: "0.5px solid var(--border-soft)",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <UserAvatar user={{ photo: userPhoto, name: userName }} size={30} />
              <ScreenShareButton compact={true} />
              <button onClick={toggleTheme} title={dark ? "Light mode" : "Dark mode"} style={{
                width: 30, height: 30, borderRadius: 8, border: "0.5px solid var(--border)",
                background: "var(--bg-input)", cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {dark ? "☀️" : "🌙"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, padding: "0 2px" }}>
                <UserAvatar user={{ photo: userPhoto, name: userName }} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {AGENCY.roleLabels?.[role as keyof typeof AGENCY.roleLabels] || role}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", marginTop: 2, letterSpacing: "0.05em" }}>
                    ID: {userIdRef || "-"}
                  </div>
                </div>
              </div>
              
              <ScreenShareButton compact={false} />
              
              <button onClick={toggleTheme} style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                padding: "8px 12px", borderRadius: 9, marginBottom: 7,
                fontSize: 13, fontWeight: 500,
                border: "0.5px solid var(--border)", background: "var(--bg-input)",
                color: "var(--text-muted)", cursor: "pointer",
              }}>
                <span style={{ fontSize: 14 }}>{dark ? "☀️" : "🌙"}</span>
                {dark ? "Light mode" : "Dark mode"}
              </button>
              
              <LogoutButton />
            </>
          )}
        </div>
        {!collapsed && (
          <div
            onMouseDown={handleResizeStart}
            title="Drag to resize"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 5,
              height: "100%",
              cursor: "col-resize",
              zIndex: 50,
              background: "transparent",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.opacity = "0.35"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "1"; }}
          />
        )}
      </aside>

      <style>{`
        aside nav::-webkit-scrollbar { width: 3px; }
        aside nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        aside nav::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </>
  );
}