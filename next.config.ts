import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // The contract generator reads this .docx at runtime, so it has to be
  // bundled into the serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/contracts/*": ["./templates/**/*"],
  },
};

export default nextConfig;
