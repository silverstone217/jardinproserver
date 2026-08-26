import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import type { LoginInput } from "./auth.schema";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env["JWT_SECRET"];

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: {
      telephone: input.telephone,
    },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordValid = await bcrypt.compare(input.password, user.password);

  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      telephone: user.telephone,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};
