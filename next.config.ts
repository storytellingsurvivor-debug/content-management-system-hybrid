import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["10.10.1.211"],
  // Emit a noindex header on every response of the admin.happy-milo CMS,
  // including API/webhook routes and non-HTML responses. Scoped to this host
  // only, so the public happy-milo.com site is unaffected.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
