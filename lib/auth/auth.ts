import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

import { Role } from "@/generated/prisma/client";

interface AuthPayload {
  userId: string;
  role: Role;
}

const JWT_SECRET = process.env["JWT_SECRET"];

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export const authenticate = (request: NextRequest): AuthPayload => {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("INVALID_AUTHORIZATION_HEADER");
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.userId !== "string" ||
      !Object.values(Role).includes(payload.role)
    ) {
      throw new Error("INVALID_TOKEN");
    }

    return {
      userId: payload.userId,
      role: payload.role,
    };
  } catch {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }
};
