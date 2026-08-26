import { Role } from "@/generated/prisma/client";

export const authorize = (role: Role, ...allowedRoles: Role[]): void => {
  if (!allowedRoles.includes(role)) {
    throw new Error("FORBIDDEN");
  }
};
