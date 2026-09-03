import { envVariables } from "@/utils/envVariables";
import { v2 as cloudinary } from "cloudinary";

const cloudName = envVariables.CLOUDINARY_CLOUD_NAME;
const apiKey = envVariables.CLOUDINARY_API_KEY;
const apiSecret = envVariables.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("Cloudinary environment variables are not defined");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export { cloudinary };
