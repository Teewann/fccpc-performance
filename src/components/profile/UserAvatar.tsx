"use client";
import Image from "next/image";

// ─── Deterministic colour per person ─────────────────────────────────────────
const GRADIENTS = [
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  "linear-gradient(135deg,#10b981,#047857)",
  "linear-gradient(135deg,#f59e0b,#d97706)",
  "linear-gradient(135deg,#ef4444,#b91c1c)",
  "linear-gradient(135deg,#06b6d4,#0e7490)",
  "linear-gradient(135deg,#ec4899,#be185d)",
  "linear-gradient(135deg,#6366f1,#4338ca)",
];
function nameGradient(name?: string | null) {
  if (!name) return GRADIENTS[0];
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
}
function initials(name?: string | null) {
  if (!name) return "U";
  return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────
interface UserAvatarProps {
  /** Pass an object with photo + name */
  user: { photo?: string | null; name?: string | null };
  /** Pixel size — width and height */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UserAvatar({ user, size = 36, className, style }: UserAvatarProps) {
  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        overflow: "hidden", display: "inline-flex", alignItems: "center",
        justifyContent: "center", userSelect: "none", ...style,
      }}
    >
      {user?.photo ? (
        <Image
          src={user.photo}
          alt={user.name ?? "User"}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          unoptimized   // base64 images must skip next/image optimisation
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          background: nameGradient(user?.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize, fontWeight: 700, color: "#fff",
        }}>
          {initials(user?.name)}
        </div>
      )}
    </div>
  );
}
