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
        source: "/article/:section/:id(\\d+).php",
        destination: "/news/wp/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
