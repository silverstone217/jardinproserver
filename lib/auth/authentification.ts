import { NextRequest } from "next/server";

import { Role } from "@/generated/prisma/client";
import { authenticate } from "./auth";

export const requireAuth = (request: NextRequest, ...allowedRoles: Role[]) => {
  const user = authenticate(request);

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }

  return user;
};
