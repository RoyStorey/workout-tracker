import type { NextConfig } from "next";

// If you put the app behind a reverse proxy or a domain that differs from the
// Host header, list extra origins here (comma-separated) so Server Actions accept them.
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { allowedOrigins: extraOrigins },
  },
};

export default nextConfig;
