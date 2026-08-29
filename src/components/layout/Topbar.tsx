"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useSession } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/layout/NotificationBell";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { ScreenShareButton } from "@/components/screenshare/ScreenShareUI";

// ─── Topbar Component ──────────────────────────────────────────────
export default function Topbar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { data: session } = useSession();
  const dark = theme === "dark";

  const [userPhoto, setUserPhoto] = useState<string | null>(
    (session?.user as any)?.photo ?? session?.user?.image ?? null
  );
  const [userIdRef, setUserIdRef] = useState<string>("");
  const [userName, setUserName] = useState(session?.user?.name || "User");
  const [userRole, setUserRole] = useState((session?.user as any)?.role || "");

  useEffect(() => {
    // Fetch user profile
    fetch("/api/settings/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          if (d.user.photo) setUserPhoto(d.user.photo);
          if (d.user.userIdRef) setUserIdRef(d.user.userIdRef);
          if (d.user.name) setUserName(d.user.name);
          if (d.user.role) setUserRole(d.user.role);
        }
      })
      .catch(() => {});
  }, []);

  // Get page title from pathname
  const getPageTitle = () => {
    const path = pathname || "/";
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return "Dashboard";
    
    const pageName = segments[segments.length - 1];
    return pageName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const pageTitle = getPageTitle();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "var(--bg-card)",
        borderBottom: "0.5px solid var(--border)",
        height: "64px",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left side - Page title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {pageTitle}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {pathname === "/" ? "Welcome back" : pathname?.split("/").filter(Boolean).join(" / ")}
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Screen Share Button */}
        <ScreenShareButton compact={true} />

        {/* Notification Bell */}
        <NotificationBell />

        {/* Theme Toggle */}
        <ThemeToggleButton />

        {/* User Avatar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px 4px 4px",
            borderRadius: 10,
            background: "var(--bg-input)",
            border: "0.5px solid var(--border)",
          }}
        >
          <UserAvatar user={{ photo: userPhoto, name: userName }} size={32} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {userName}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {userRole.charAt(0) + userRole.slice(1).toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}