"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { AGENCY } from "@/config/agency.config";
import QRCode from "qrcode";
import { toPng } from "html-to-image";

type UserBrief = {
  id: string;
  name: string;
  email: string;
  photo?: string | null;
  staffId?: string | null;
  role: string;
  gradeLevel?: string | null;
  department?: { name: string } | null;
  phone?: string | null;
};

export default function IdCardPage() {
  const [user, setUser] = useState<UserBrief | null>(null);
  const [allUsers, setAllUsers] = useState<UserBrief[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch current user
  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentUser(d.user);
          setUser(d.user);
          setSelectedUserId(d.user.id);
          if (["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(d.user.role)) {
            fetch("/api/users?limit=500")
              .then((r) => r.json())
              .then((data) => {
                const list = data.users || data.staff || data || [];
                setAllUsers(Array.isArray(list) ? list : []);
              });
          }
        }
        setLoading(false);
      });
  }, []);

  // Fetch selected user when dropdown changes
  useEffect(() => {
    if (!selectedUserId) return;
    if (selectedUserId === currentUser?.id) {
      setUser(currentUser);
      return;
    }
    fetch(`/api/users/${selectedUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, [selectedUserId, currentUser]);

  // Generate QR code for user
  useEffect(() => {
    if (!user) return;
    const content = `FCCPC|${user.staffId || user.email}|${user.name}`;
    QRCode.toDataURL(content, { width: 100, margin: 0 }, (err, url) => {
      if (!err) setQrDataUrl(url);
    });
  }, [user]);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, { quality: 0.95 });
    const link = document.createElement("a");
    link.download = `FCCPC_ID_${user?.staffId || user?.name}.png`;
    link.href = dataUrl;
    link.click();
  };

  const isPrivileged =
    currentUser &&
    ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(currentUser.role);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Expiry: one year from now
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        {/* Topbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Digital ID Card
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {isPrivileged && (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  minWidth: 220,
                }}
              >
                <option value={currentUser?.id || ""}>My Card</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.staffId || u.email})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowBack(!showBack)}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showBack ? "Show Front" : "Show Back"}
            </button>
            <button
              onClick={downloadCard}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📥 Download PNG
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🖨️ Print
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 16 }}>
            Loading your card...
          </div>
        ) : !user ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
            No user selected.
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <div
              ref={cardRef}
              style={{
                width: 520,
                minHeight: 320,
                borderRadius: 16,
                background: "linear-gradient(135deg, #ffffff 0%, #f0f8f4 100%)",
                border: "1px solid #22c55e",
                boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                color: "#111",
                fontFamily: "Segoe UI, sans-serif",
              }}
            >
              {!showBack ? (
                /* ── Front Side ── */
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                      borderBottom: "2px solid #22c55e",
                      paddingBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img
                        src="/fccpc-logo.jpg"
                        alt="FCCPC"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          objectFit: "contain",
                          border: "1px solid #22c55e",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>
                          {AGENCY.shortName}
                        </div>
                        <div style={{ fontSize: 11, color: "#444" }}>
                          {AGENCY.name}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", textAlign: "right" }}>
                      IDENTITY CARD
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20, flex: 1 }}>
                    <div style={{ flexShrink: 0 }}>
                      <div
                        style={{
                          width: 120,
                          height: 140,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "2px solid #22c55e",
                          background: "#f0fdf4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {user.photo ? (
                          <img src={user.photo} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 40, fontWeight: 700, color: "#166534" }}>
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Signature line */}
                      <div style={{ marginTop: 8, borderTop: "1px solid #ccc", paddingTop: 4, fontSize: 10, color: "#777", textAlign: "center" }}>
                        Signature
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
                        {user.role.charAt(0) + user.role.slice(1).toLowerCase()} ·{" "}
                        {user.department?.name || "Unassigned"}
                      </div>

                      {[
                        { label: "Staff ID", value: user.staffId || "N/A" },
                        { label: "Grade Level", value: user.gradeLevel || "N/A" },
                        { label: "Email", value: user.email },
                        { label: "Phone", value: user.phone || "N/A" },
                        {
                          label: "Expiry",
                          value: expiryDate.toLocaleDateString("en-GB"),
                        },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", marginBottom: 6 }}>
                          <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: "#444" }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #ccc",
                      paddingTop: 10,
                      fontSize: 11,
                      color: "#777",
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 10,
                    }}
                  >
                    <span>This card is property of FCCPC</span>
                    <span>Unauthorized use prohibited</span>
                  </div>
                </>
              ) : (
                /* ── Back Side ── */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    textAlign: "center",
                  }}
                >
                  <h3 style={{ color: "#166534", marginBottom: 8 }}>FCCPC Identity Card</h3>
                  <p style={{ fontSize: 12, color: "#333", maxWidth: 400, marginBottom: 16 }}>
                    If found, please return to the nearest FCCPC office or contact the ICT Unit at
                    helpdesk@fccpc.gov.ng or call +234‑800‑FCCPC‑00. This card is the property of the
                    Federal Competition & Consumer Protection Commission.
                  </p>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      style={{ width: 100, height: 100, border: "1px solid #ccc", borderRadius: 8 }}
                    />
                  )}
                  <p style={{ fontSize: 10, color: "#777", marginTop: 8 }}>
                    Scan for verification
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}