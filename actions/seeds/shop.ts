import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const shopDefault = async (): Promise<void> => {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: Role.MANAGER,
    },
  });

  if (existingAdmin) {
    console.log("ℹ️ Manager already exists.");
    return;
  }

  const password = await bcrypt.hash("admin123", 12);

  await prisma.user.create({
    data: {
      email: "admin@admin.com",
      name: "admin",
      telephone: "0123456789",
      password,
      role: Role.MANAGER,
    },
  });

  console.log("✅ Default manager created.");
};

export async function seedAdmin() {
  await shopDefault();
}
