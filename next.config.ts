import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "cdn.sanity.io" },
  { protocol: "https", hostname: "musicite.sub.jp" },
  { protocol: "http", hostname: "musicite.sub.jp" },
  { protocol: "https", hostname: "*.wp.com" },
];

const wpImageCdnBaseUrl = process.env.WP_IMAGE_CDN_BASE_URL;
if (wpImageCdnBaseUrl) {
  try {
    const cdnUrl = new URL(wpImageCdnBaseUrl);
    const protocol = cdnUrl.protocol === "http:" ? "http" : cdnUrl.protocol === "https:" ? "https" : null;
    if (protocol) {
      remotePatterns.push({
        protocol,
        hostname: cdnUrl.hostname,
      });
    }
  } catch {
    // Ignore invalid URL and keep default image hosts.
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["next-sanity", "sanity"],
  images: {
    remotePatterns,
  },
  async redirects() {
    return [
      {
        source: "/i4c/:id(\\d+).php",
        destination: "/news/wp/:id",
        permanent: true,
      },
      {
        source: "/i4c/col/:id(\\d+).php",
        destination: "/news/wp/:id",
        permanent: true,
      },
      {
        source: "/article/:section/:id(\\d+).php",
        destination: "/news/wp/:id",
        permanent: true,
      },
      {
        source: "/gk/sp/:id(\\d+).php",
        destination: "/news/wp/:id",
        permanent: true,
      },
      {
        source: "/inm/wp-content/uploads/:path*",
        destination: "https://musicite.sub.jp/inm/wp-content/uploads/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
