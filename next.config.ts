import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "unpdf"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
