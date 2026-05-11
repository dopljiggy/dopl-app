import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "usuycwfezqxpnahfrxwc.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
};

export default nextConfig;
