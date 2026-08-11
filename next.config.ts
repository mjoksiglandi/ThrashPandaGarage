import type { NextConfig } from "next";

const loginHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/login",
        headers: loginHeaders,
      },
      {
        source: "/api/account-login",
        headers: loginHeaders,
      },
    ];
  },
};

export default nextConfig;
