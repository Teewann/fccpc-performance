"use client";
import { useState } from "react";

export default function UserAvatar({
  user,
  size = 32,
}: {
  user?: { photo?: string | null; name?: string | null; image?: string | null };
  size?: number;
}) {
  const [zoom, setZoom] = useState(false);
  const photo = user?.photo || user?.image || null;

  const initials = (user?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div
        onClick={() => photo && setZoom(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          cursor: photo ? "pointer" : "default",
          flexShrink: 0,
          background: photo ? "transparent" : "var(--accent-bg)",
          border: `1.5px solid var(--accent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt="avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: size * 0.35,
              fontWeight: 700,
              color: "var(--accent-text)",
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {zoom && photo && (
        <div
          onClick={() => setZoom(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <img
            src={photo}
            alt="full size avatar"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16 }}
          />
        </div>
      )}
    </>
  );
}