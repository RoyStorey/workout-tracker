import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#121211", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="130" height="130" viewBox="0 0 64 64">
          <g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M17 15v34M26 15v34M35 15v34M44 15v34M11 41l42-18" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
