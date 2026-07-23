import type { MetadataRoute } from "next";

// This app is the Milo back-office / CMS, served on the dedicated
// `admin.happy-milo` subdomain. robots.txt is scoped per-host, so disallowing
// everything here keeps the back-office out of search engines without touching
// the public happy-milo.com site (a separate host).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
