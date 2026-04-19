import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SW_VERSION:
      process.env.NEXT_PUBLIC_SW_VERSION ??
      process.env.RENDER_GIT_COMMIT ??
      "dev",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
