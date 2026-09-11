"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { AGENCY } from "@/config/agency.config";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import SessionTimeoutSetting from "@/components/settings/SessionTimeoutSetting";
import { BiometricEnrollment } from "@/components/settings/BiometricEnrollment";

type Tab = "account" | "photo" | "appearance" | "agency" | "security";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  role: string;
  staffId: string | null;
  gradeLevel: string | null;
  department: { name: string } | null;
  unit: { name: string } | null;
  createdAt: string;
  photo: string | null;
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Photo state
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState({ text: "", ok: true });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/settings/account");
      const data = await res.json();
      if (data.user) {
        setProfile(data.user);
        setName(data.user.name || "");
        setPhone(data.user.phone || "");
        setJobTitle(data.user.jobTitle || "");
        setPhoto(data.user.photo || null);
      }
    } catch (e) { console.error(e); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    if (newPassword && newPassword !== confirmPassword) {
      setMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setMsg({ text: "New password must be at least 8 characters.", ok: false });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, jobTitle,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Account updated successfully.", ok: true });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        fetchProfile();
      } else {
        setMsg({ text: data.error || "Failed to save changes.", ok: false });
      }
    } finally { setSaving(false); }
  }

  // ─── Photo handlers ───────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setPhotoMsg({ text: "File too large. Maximum size is 10MB.", ok: false });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/heic", "image/heif"];
    if (!allowed.includes(file.type) && file.type !== "") {
      setPhotoMsg({ text: "Unsupported file type. Use JPEG, PNG, WebP, etc.", ok: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  }

  function onCropComplete(crop: PixelCrop) {
    setCompletedCrop(crop);
  }

  async function handleCropConfirm() {
    if (!imageRef.current || !completedCrop) return;
    const canvas = document.createElement("canvas");
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      imageRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0, 0, canvas.width, canvas.height
    );
    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setShowCropModal(false);
    await uploadPhoto(croppedDataUrl);
  }

  async function uploadPhoto(dataUrl: string) {
    setPhotoUploading(true);
    setPhotoMsg({ text: "", ok: true });
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/settings/photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPhoto(data.photo);
        setPhotoMsg({ text: "Profile photo updated successfully.", ok: true });
        fetchProfile();
      } else {
        setPhotoMsg({ text: data.error || "Upload failed", ok: false });
      }
    } catch {
      setPhotoMsg({ text: "Network error. Please try again.", ok: false });
    } finally { setPhotoUploading(false); }
  }

  async function handleRemovePhoto() {
    if (!confirm("Remove your profile photo?")) return;
    try {
      const res = await fetch("/api/settings/photo", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setPhoto(null);
        setPhotoMsg({ text: "Profile photo removed.", ok: true });
        fetchProfile();
      } else {
        setPhotoMsg({ text: data.error || "Failed to remove photo.", ok: false });
      }
    } catch {
      setPhotoMsg({ text: "Network error.", ok: false });
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "account",    label: "My account",    icon: "👤" },
    { id: "photo",      label: "Profile photo", icon: "📷" },
    { id: "appearance", label: "Appearance",    icon: "🎨" },
    { id: "security",   label: "Security",      icon: "🔐" },
  ];

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "13px 16px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box", marginBottom: 16,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 14, fontWeight: 600,
    color: "var(--text-muted)", marginBottom: 8,
  };
  const disabledInp: React.CSSProperties = { ...inp, opacity: 0.5, cursor: "not-allowed" };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Settings
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today}</p>
          </div>
          <ThemeToggleButton />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
          {/* Tab navigation */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 10 }}>
            {profile && (
              <div style={{ textAlign: "center", padding: "16px 12px 14px", marginBottom: 6, borderBottom: "0.5px solid var(--border-soft)" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: "var(--accent-bg)",
                  border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "var(--accent-text)", margin: "0 auto 10px", overflow: "hidden",
                }}>
                  {photo ? (
                    <img src={photo} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{profile.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                  {AGENCY.roleLabels[profile.role as keyof typeof AGENCY.roleLabels] || profile.role}
                </div>
                {profile.department && (
                  <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 2 }}>{profile.department.name}</div>
                )}
              </div>
            )}

            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setMsg({ text: "", ok: true }); setPhotoMsg({ text: "", ok: true }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px",
                  borderRadius: 10, marginBottom: 4, textAlign: "left", cursor: "pointer",
                  fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
                  border: `0.5px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                  background: tab === t.id ? "var(--accent-bg)" : "transparent",
                  color: tab === t.id ? "var(--accent-text)" : "var(--text-muted)",
                }}
              >
                <span style={{ fontSize: 17 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 32 }}>
            {/* ════ ACCOUNT TAB ════ */}
            {tab === "account" && (
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>My account</h2>
                <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
                  Update your profile information. Email and role can only be changed by Admin.
                </p>
                {msg.text && (
                  <div style={{
                    background: msg.ok ? "var(--accent-bg)" : "#1f0707",
                    border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`,
                    color: msg.ok ? "var(--accent-text)" : "#f87171",
                    borderRadius: 10, padding: "14px 18px", fontSize: 15, marginBottom: 24,
                  }}>
                    {msg.text}
                  </div>
                )}
                <form onSubmit={handleSave}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={lbl}>Full name</label>
                      <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <label style={lbl}>Email <span style={{ fontSize: 12, color: "var(--text-hint)" }}>(read only)</span></label>
                      <input style={disabledInp} value={profile?.email || ""} disabled />
                    </div>
                    <div>
                      <label style={lbl}>Phone number</label>
                      <input style={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 xxx xxx xxxx" />
                    </div>
                    <div>
                      <label style={lbl}>Job title</label>
                      <input style={inp} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Your official job title" />
                    </div>
                    <div>
                      <label style={lbl}>Staff ID <span style={{ fontSize: 12, color: "var(--text-hint)" }}>(read only)</span></label>
                      <input style={disabledInp} value={profile?.staffId || "Not assigned"} disabled />
                    </div>
                    <div>
                      <label style={lbl}>Department <span style={{ fontSize: 12, color: "var(--text-hint)" }}>(read only)</span></label>
                      <input style={disabledInp} value={profile?.department?.name || "Not assigned"} disabled />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 24, borderTop: "0.5px solid var(--border-soft)" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Change password</h3>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>Leave blank to keep current password.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Current password</label>
                        <input style={inp} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                      </div>
                      <div>
                        <label style={lbl}>New password</label>
                        <input style={inp} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
                      </div>
                      <div>
                        <label style={lbl}>Confirm new password</label>
                        <input style={inp} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={saving} style={{
                    marginTop: 8, padding: "13px 32px", borderRadius: 10, border: "1.5px solid #22c55e",
                    background: "#052e16", color: "#4ade80", fontSize: 15, fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                  }}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </form>
              </div>
            )}

            {/* ════ PHOTO TAB ════ */}
            {tab === "photo" && (
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Profile photo</h2>
                <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
                  Upload a clear passport‑style photograph. It will appear throughout the system.
                </p>
                {photoMsg.text && (
                  <div style={{
                    background: photoMsg.ok ? "var(--accent-bg)" : "#1f0707",
                    border: `0.5px solid ${photoMsg.ok ? "var(--accent-border)" : "#7f1d1d"}`,
                    color: photoMsg.ok ? "var(--accent-text)" : "#f87171",
                    borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 20,
                  }}>
                    {photoMsg.text}
                  </div>
                )}

                <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24 }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: "50%", overflow: "hidden",
                    background: "var(--accent-bg)", border: "3px solid var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {photo ? (
                      <img src={photo} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 40, fontWeight: 700, color: "var(--accent-text)" }}>
                        {(name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <label style={{
                      display: "inline-block", padding: "12px 24px", borderRadius: 10, cursor: "pointer",
                      background: "var(--accent-bg)", color: "var(--accent-text)", border: "1.5px solid var(--accent)",
                      fontSize: 14, fontWeight: 600, marginBottom: 8,
                    }}>
                      {photoUploading ? "Uploading..." : "Upload photo"}
                      <input type="file" accept="image/*" onChange={handleFileSelect} hidden disabled={photoUploading} />
                    </label>
                    {photo && (
                      <button onClick={handleRemovePhoto} style={{
                        display: "block", background: "none", border: "none",
                        color: "#f87171", fontSize: 13, cursor: "pointer", fontWeight: 600,
                      }}>
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Supported formats: JPEG, PNG, WebP, GIF, BMP, TIFF. Maximum file size: 10 MB.
                </div>
              </div>
            )}

            {/* ════ APPEARANCE TAB ════ */}
            {tab === "appearance" && (
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Appearance</h2>
                <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
                  Control how the system looks. Your preference is saved automatically.
                </p>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Theme</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 560 }}>
                  {[
                    { id: "dark", label: "Dark mode", desc: "Dark slate background with green accents.", icon: "🌙" },
                    { id: "light", label: "Light mode", desc: "Clean white background.", icon: "☀️" },
                  ].map((opt) => {
                    const current = typeof window !== "undefined" ? (localStorage.getItem("fccpc-theme") || "dark") : "dark";
                    const isSelected = current === opt.id;
                    return (
                      <div key={opt.id} onClick={() => {
                        localStorage.setItem("fccpc-theme", opt.id);
                        document.documentElement.setAttribute("data-theme", opt.id);
                        window.location.reload();
                      }} style={{
                        padding: "20px", borderRadius: 14, cursor: "pointer",
                        border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        background: isSelected ? "var(--accent-bg)" : "var(--bg-input)",
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.icon}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{opt.label}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{opt.desc}</div>
                        {isSelected && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--accent-text)" }}>✓ Currently active</div>}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-hint)", marginTop: 16 }}>
                  You can also toggle the theme using the ☀️/🌙 button in the top right corner of any page.
                </p>
              </div>
            )}


            {/* ════ SECURITY TAB ════ */}
            {tab === "security" && (
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Security</h2>
                <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
                  Your account security and session information.
                </p>

                {[
                  { label: "Account status", value: "Active", color: "#4ade80" },
                  { label: "Authentication", value: "Email and password", color: "var(--text-primary)" },
                  { label: "Your role", value: AGENCY.roleLabels[profile?.role as keyof typeof AGENCY.roleLabels] || profile?.role || "-", color: "var(--text-primary)" },
                  { label: "Account created", value: profile ? new Date(profile.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "-", color: "var(--text-primary)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "16px 0", borderBottom: "0.5px solid var(--border-soft)",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
                  </div>
                ))}

                {/* ── BIOMETRIC ENROLLMENT ── */}
                <div style={{ marginTop: 24, padding: "20px 24px", background: "var(--bg-input)", borderRadius: 12, border: "0.5px solid var(--border)" }}>
                  <BiometricEnrollment />
                </div>

                {/* Session timeout setting */}
                <div style={{ marginBottom: 24 }}>
                  <SessionTimeoutSetting />
                </div>

                {/* Sign out button */}
                <div style={{ marginTop: 28 }}>
                  <button
                    onClick={async () => {
                      const { signOut } = await import("next-auth/react");
                      signOut({ callbackUrl: "/auth/login" });
                    }}
                    style={{
                      padding: "12px 28px",
                      borderRadius: 10,
                      border: "0.5px solid #7f1d1d",
                      background: "#1f0707",
                      color: "#f87171",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sign out of this session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Crop modal */}
        {showCropModal && cropSrc && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              background: "var(--bg-card)", borderRadius: 16, padding: 24,
              maxWidth: 600, width: "90%", maxHeight: "90vh", overflow: "auto",
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
                Crop your photo
              </h2>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={onCropComplete}
                circularCrop
                aspect={1}
              >
                <img
                  ref={imageRef}
                  src={cropSrc!}
                  alt="Source"
                  style={{ maxWidth: "100%" }}
                />
              </ReactCrop>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button onClick={() => setShowCropModal(false)} style={{
                  padding: "10px 20px", borderRadius: 10, border: "0.5px solid var(--border)",
                  background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer",
                }}>
                  Cancel
                </button>
                <button onClick={handleCropConfirm} style={{
                  padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e",
                  background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

