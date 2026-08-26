import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
    DEFAULT_SHOP_URL: process.env.DEFAULT_SHOP_URL,
  },
};

export default nextConfig;
