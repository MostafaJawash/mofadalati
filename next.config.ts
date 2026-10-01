import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF route reads the Arabic fonts from disk at runtime.
  outputFileTracingIncludes: {
    "/api/preferences/pdf": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
