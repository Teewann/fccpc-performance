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
import { ScreenShareButton } from "@/components/screenshare/ScreenShareUI";

type NavLink = {
  label: string;
  href: string;
  badge?: string;
  badgeGreen?: boolean;
  icon: string;
  iconColor: string;
  // If omitted, visible to every role. Otherwise, only these roles see it.
  allowedRoles?: string[];
};

type NavSection = {
  section: string;
  links: NavLink[];
};

const DIRECTOR_OR_UNIT_HEAD = ["DIRECTOR", "SUPERVISOR", "ADMIN"];
const HR_ONLY = ["HR"];
const ADMIN_ONLY = ["ADMIN"];
const EXECUTIVE_ONLY = ["EXECUTIVE"];
const NOT_STAFF_FACING = ["DIRECTOR", "SUPERVISOR", "HR", "ADMIN", "EXECUTIVE"]; // EVC Directives

// ── Single source of truth for the whole nav — one place, no duplicate lists ──
const SECTIONS: NavSection[] = [
  {
    section: "Core",
    links: [
      { label: "Dashboard", href: "/dashboard", icon: "▦", iconColor: "#60a5fa" },
      { label: "Daily Work Log", href: "/daily-log", icon: "📝", iconColor: "#34d399", allowedRoles: undefined },
      { label: "Supervisor Panel", href: "/supervisor", icon: "👁", iconColor: "#c084fc", allowedRoles: DIRECTOR_OR_UNIT_HEAD },
      { label: "Attendance", href: "/check-in", icon: "🕐", iconColor: "#f59e0b" },
      { label: "ID Card", href: "/id-card", icon: "🪪", iconColor: "#38bdf8" },
      { label: "Intern Log", href: "/intern", icon: "📓", iconColor: "#fb923c", allowedRoles: ["INTERN"] },
    ],
  },
  {
    section: "Management",
    links: [
      { label: "Departments", href: "/departments", icon: "🏢", iconColor: "#60a5fa", allowedRoles: DIRECTOR_OR_UNIT_HEAD },
      { label: "Tasks", href: "/tasks", icon: "✅", iconColor: "#4ade80" },
      { label: "KPI Manager", href: "/kpi", icon: "📊", iconColor: "#f472b6" },
      { label: "Appraisals", href: "/appraisals", icon: "⭐", iconColor: "#fbbf24", allowedRoles: HR_ONLY },
      { label: "EVC Directives", href: "/evc-directives", icon: "📌", iconColor: "#f87171", allowedRoles: NOT_STAFF_FACING },
      { label: "Leave", href: "/leave", icon: "🏖", iconColor: "#34d399" },
      { label: "Payment Workflow", href: "/payment-workflow", icon: "💳", iconColor: "#34d399" },
    ],
  },
  {
    section: "Intelligence",
    links: [
      { label: "AI Insights", href: "/ai-insights", icon: "✦", iconColor: "#e879f9", badge: "AI", badgeGreen: true, allowedRoles: DIRECTOR_OR_UNIT_HEAD },
      { label: "Reports", href: "/reports", icon: "📈", iconColor: "#60a5fa" },
      { label: "Communications", href: "/announcements", icon: "📢", iconColor: "#fb923c" },
      { label: "Promotion Exams", href: "/exams", icon: "🎓", iconColor: "#a78bfa" },
      { label: "Staff Directory", href: "/staff-directory", icon: "👥", iconColor: "#38bdf8", allowedRoles: DIRECTOR_OR_UNIT_HEAD },
      { label: "Performance", href: "/performance", icon: "🏆", iconColor: "#fbbf24", allowedRoles: HR_ONLY },
      { label: "Incentives", href: "/incentives", icon: "🎯", iconColor: "#f472b6", badge: "HR", badgeGreen: true, allowedRoles: HR_ONLY },
      { label: "HR Oversight", href: "/hr-oversight", icon: "👁", iconColor: "#c084fc", allowedRoles: HR_ONLY },
    ],
  },
  {
    section: "System",
    links: [
      { label: "Users", href: "/users", icon: "🔧", iconColor: "#f59e0b", allowedRoles: ADMIN_ONLY },
      { label: "Audit Trail", href: "/audit-trail", icon: "🔍", iconColor: "#f87171", allowedRoles: ADMIN_ONLY },
      { label: "Settings", href: "/settings", icon: "⚙", iconColor: "#94a3b8" },
      { label: "EVC Suite", href: "/vc9k2", icon: "⚡", iconColor: "#fbbf24", allowedRoles: EXECUTIVE_ONLY },
      { label: "Account Activation", href: "/admin/account-activation", icon: "🔑", iconColor: "#f472b6", badge: "Admin", badgeGreen: true, allowedRoles: ADMIN_ONLY },
    ],
  },
];

function getNavItems(role: string): NavSection[] {
  return SECTIONS
    .map((section) => ({
      section: section.section,
      links: section.links.filter((link) => !link.allowedRoles || link.allowedRoles.includes(role)),
    }))
    .filter((s) => s.links.length > 0);
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

const STORAGE_KEY = "sidebar_closed_sections";
const SCROLL_KEY = "sidebar_scroll_position";

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
  const [isClient, setIsClient] = useState(false);
  const isResizing = useRef(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsClient(true);
    try {
      const raw = sessionStorage.getItem("sidebar_width");
      if (raw) {
        const width = Number(raw);
        if (width >= 180 && width <= 400) {
          setExpandedWidth(width);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        sessionStorage.setItem("sidebar_width", String(expandedWidth));
      } catch {}
    }
  }, [expandedWidth, isClient]);

  const [closedSections, setClosedSections] = useState<Set<string>>(() => loadClosedSections());

  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.photo)     setUserPhoto(d.user.photo);
        if (d?.user?.userIdRef) setUserIdRef(d.user.userIdRef);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const p = (session?.user as any)?.photo ?? session?.user?.image ?? null;
    if (p) setUserPhoto(p);
  }, [session]);

  // ── Preserve scroll position across navigations ──────────────────────
  // Each page currently mounts its own <Sidebar />, so this remounts on
  // every navigation and would otherwise reset to the top every time.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) nav.scrollTop = Number(saved);
    } catch {}

    let raf: number | null = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try { sessionStorage.setItem(SCROLL_KEY, String(nav.scrollTop)); } catch {}
      });
    };
    nav.addEventListener("scroll", onScroll);
    return () => nav.removeEventListener("scroll", onScroll);
  }, []);

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
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const navItems = getNavItems(role);
  const sidebarWidth = collapsed ? 62 : expandedWidth;

  return (
    <>
      <aside
        suppressHydrationWarning
        style={{
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
        }}
      >
        <div style={{
          flexShrink: 0,
          borderBottom: "0.5px solid var(--border-soft)",
          padding: collapsed ? "16px 10px 14px" : "18px 14px 16px",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
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

        <div style={{
          flexShrink: 0,
          borderBottom: "0.5px solid var(--border-soft)",
          padding: collapsed ? "10px 8px" : "10px 12px",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 7px",
              borderRadius: 10,
              background: "var(--bg-input)",
              border: "0.5px solid var(--border)",
              gap: 2,
              overflow: "hidden",
            }}>
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

              <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0, opacity: 0.5 }} />

              <div style={{ flexShrink: 0 }}>
                <NotificationBell />
              </div>

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
                      e.currentTarget.style.border = `2px solid ${isActive ? item.color + "60" : "transparent"}`;
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

        <nav
          ref={navRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingTop: 4,
            paddingBottom: 8,
          }}
        >
          {collapsed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, paddingTop: 4 }}>
              {navItems.flatMap((s) => s.links).map((link) => {
                const isActive = pathname === link.href;
                const color    = link.iconColor;
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
                    {link.icon}
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
                      const lColor   = link.iconColor;
                      return (
                        <Link key={link.href} href={link.href} style={{
                          display: "flex", alignItems: "center", gap: 9,
                          padding: "8px 14px 8px 12px", fontSize: 13,
                          borderLeft: `3px solid ${isActive ? lColor : "transparent"}`,
                          background: isActive ? `${lColor}18` : "transparent",
                          color: isActive ? lColor : "var(--text-muted)",
                          fontWeight: isActive ? 700 : 500,
                          textDecoration: "none", transition: "all 0.12s",
                        }}
                          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = `${lColor}12`; e.currentTarget.style.color = lColor; } }}
                          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; } }}
                        >
                          <span style={{ fontSize: 17, flexShrink: 0, minWidth: 22, textAlign: "center" }}>
                            {link.icon}
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

        <div style={{
          flexShrink: 0,
          padding: collapsed ? "10px 8px" : "12px 12px 14px",
          borderTop: "0.5px solid var(--border-soft)",
          transition: "padding 0.22s",
        }}>
          {collapsed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <UserAvatar user={{ photo: userPhoto, name: userName }} size={30} />
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
                    ID: {userIdRef || "—"}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 6 }}>
                <ScreenShareButton compact={true} />
              </div>

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
        @keyframes ssRecordPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes ssSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}