import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/livecheck",
  assetPrefix: "/livecheck",
  images: { unoptimized: true },
  // The build script runs TypeScript 7 before Next.js. Next still needs the
  // older TypeScript compiler API for configuration and editor tooling.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
