import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Keep production builds from replacing a running development server's assets.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
