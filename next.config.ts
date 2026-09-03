import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // AUTH
    JWT_SECRET: process.env.JWT_SECRET,

    // DEFAULT_SHOP_URL
    DEFAULT_SHOP_URL: process.env.DEFAULT_SHOP_URL,

    // CLOUDINARY
    // CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    // CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    // CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  },
};

export default nextConfig;
