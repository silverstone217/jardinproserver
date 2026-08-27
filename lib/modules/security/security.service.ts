import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { ChangePasswordInput } from "./security.schema";

export const changePassword = async (
  userId: string,
  data: ChangePasswordInput,
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  // Vérifier l'ancien mot de passe
  const isPasswordValid = await bcrypt.compare(
    data.currentPassword,
    user.password,
  );

  if (!isPasswordValid) {
    throw new Error("Le mot de passe actuel est incorrect.");
  }

  // Générer le hash du nouveau mot de passe
  const hashedPassword = await bcrypt.hash(data.newPassword, 12);

  // Enregistrer le nouveau mot de passe
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    success: true,
  };
};
