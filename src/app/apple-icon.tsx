import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#121211", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="130" height="130" viewBox="0 0 64 64">
          <g stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M17 11v22h30V11M32 33v18M25 51h14" />
          </g>
          <circle cx="32" cy="21" r="5" fill="#f26b30" />
        </svg>
      </div>
    ),
    size,
  );
}
