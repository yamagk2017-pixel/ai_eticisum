import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["next-sanity", "sanity"],
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
