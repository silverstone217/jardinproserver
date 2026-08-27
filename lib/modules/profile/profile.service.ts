import { prisma } from "@/lib/prisma";
import type { UpdateProfileInput } from "./profile.schema";

export const updateProfile = async (
  userId: string,
  data: UpdateProfileInput,
) => {
  // ============================================================
  // VÉRIFIER QUE L'UTILISATEUR EXISTE
  // ============================================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // ============================================================
  // VÉRIFIER L'EMAIL
  // ============================================================

  if (data.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
      select: {
        id: true,
      },
    });

    if (emailExists && emailExists.id !== userId) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
  }

  // ============================================================
  // VÉRIFIER LE TÉLÉPHONE
  // ============================================================

  if (data.telephone !== existingUser.telephone) {
    const telephoneExists = await prisma.user.findUnique({
      where: {
        telephone: data.telephone,
      },
      select: {
        id: true,
      },
    });

    if (telephoneExists && telephoneExists.id !== userId) {
      throw new Error("TELEPHONE_ALREADY_EXISTS");
    }
  }

  // ============================================================
  // MODIFIER LE PROFIL
  // ============================================================

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: data.name,
      telephone: data.telephone,
      email: data.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

// MODIFY IMAGE URL

export const updateProfileImage = async (userId: string, image: string) => {
  // ============================================================
  // VÉRIFIER QUE L'UTILISATEUR EXISTE
  // ============================================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // ============================================================
  // MODIFIER L'IMAGE
  // ============================================================

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      image,
    },
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};
