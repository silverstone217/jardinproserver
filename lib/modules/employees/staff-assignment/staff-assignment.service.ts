import { prisma } from "@/lib/prisma";

import type {
  CreateStaffAssignmentInput,
  //   EndStaffAssignmentInput,
} from "./staff-assignment.schema";

/**
 * Sélection utilisée pour retourner une affectation
 * sans exposer de données sensibles.
 */
const staffAssignmentSelect = {
  id: true,
  userId: true,
  shopId: true,
  pointOfSaleId: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,

  user: {
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      image: true,
      role: true,
      isBanned: true,
    },
  },

  pointOfSale: {
    select: {
      id: true,
      name: true,
      code: true,
      telephone: true,
      address: true,
      isActive: true,
    },
  },
} as const;

/**
 * Récupère la boutique principale.
 */
const getMainShopOrThrow = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

/**
 * Vérifie qu'un utilisateur peut être affecté.
 *
 * Un employé peut être affecté par le manager.
 * Le manager peut également s'affecter lui-même.
 */
const getAssignableUserOrThrow = async (userId: string, managerId?: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      image: true,
      role: true,
      isBanned: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const isSelfAssignment = managerId === userId;

  if (user.role !== "EMPLOYEE" && !isSelfAssignment) {
    throw new Error("USER_NOT_ASSIGNABLE");
  }

  if (user.isBanned) {
    throw new Error("USER_IS_BANNED");
  }

  return user;
};

/**
 * Vérifie qu'un point de vente appartient à la boutique.
 */
const getPointOfSaleOrThrow = async (pointOfSaleId: string, shopId: string) => {
  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      telephone: true,
      address: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  if (!pointOfSale.isActive) {
    throw new Error("POINT_OF_SALE_INACTIVE");
  }

  return pointOfSale;
};

/**
 * Récupère l'affectation active d'un utilisateur.
 */
export const getActiveAssignment = async (userId: string) => {
  return prisma.staffAssignment.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      startDate: "desc",
    },
    select: staffAssignmentSelect,
  });
};

/**
 * Créer une nouvelle affectation.
 *
 * Si l'utilisateur possède déjà une affectation active,
 * l'opération est refusée.
 */
export const createStaffAssignment = async (
  userId: string,
  input: CreateStaffAssignmentInput,
  managerId?: string,
) => {
  const shop = await getMainShopOrThrow();

  const user = await getAssignableUserOrThrow(userId, managerId);

  const activeAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      pointOfSaleId: true,
    },
  });

  if (activeAssignment) {
    throw new Error("ACTIVE_ASSIGNMENT_ALREADY_EXISTS");
  }

  let pointOfSale = null;

  if (input.pointOfSaleId) {
    pointOfSale = await getPointOfSaleOrThrow(input.pointOfSaleId, shop.id);
  }

  return prisma.staffAssignment.create({
    data: {
      userId: user.id,
      shopId: shop.id,
      pointOfSaleId: pointOfSale?.id ?? null,
      startDate: new Date(),
      isActive: true,
    },
    select: staffAssignmentSelect,
  });
};

/**
 * Terminer l'affectation active d'un utilisateur.
 */
export const endStaffAssignment = async (userId: string) => {
  const activeAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      startDate: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!activeAssignment) {
    throw new Error("ACTIVE_ASSIGNMENT_NOT_FOUND");
  }

  return prisma.staffAssignment.update({
    where: {
      id: activeAssignment.id,
    },
    data: {
      isActive: false,
      endDate: new Date(),
    },
    select: staffAssignmentSelect,
  });
};

/**
 * Récupérer l'historique des affectations d'un utilisateur.
 */
export const getStaffAssignmentHistory = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return prisma.staffAssignment.findMany({
    where: {
      userId,
    },
    orderBy: {
      startDate: "desc",
    },
    select: staffAssignmentSelect,
  });
};
