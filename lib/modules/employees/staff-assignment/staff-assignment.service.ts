import { prisma } from "@/lib/prisma";

import type { CreateStaffAssignmentInput } from "./staff-assignment.schema";

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
 *
 * Le projet fonctionne actuellement avec une seule boutique.
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
 * Règles :
 * - un EMPLOYEE peut être affecté par le manager ;
 * - un MANAGER peut s'affecter lui-même ;
 * - un MANAGER ne peut pas affecter un autre MANAGER ;
 * - un ADMIN n'est pas assignable ;
 * - un utilisateur banni ne peut pas être affecté.
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
 * Vérifie qu'un point de vente appartient à la boutique
 * et qu'il est actif.
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
 * Récupère l'affectation active d'un utilisateur
 * dans la boutique principale.
 */
export const getActiveAssignment = async (userId: string) => {
  const shop = await getMainShopOrThrow();

  return prisma.staffAssignment.findFirst({
    where: {
      userId,
      shopId: shop.id,
      isActive: true,
    },
    orderBy: {
      startDate: "desc",
    },
    select: staffAssignmentSelect,
  });
};

/**
 * Récupère toutes les affectations de la boutique principale.
 *
 * Les affectations actives sont retournées en premier,
 * puis les affectations terminées par ordre de date décroissante.
 */
export const getStaffAssignments = async () => {
  const shop = await getMainShopOrThrow();

  return prisma.staffAssignment.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        startDate: "desc",
      },
    ],
    select: staffAssignmentSelect,
  });
};

/**
 * Crée une nouvelle affectation.
 *
 * Règles :
 * - l'utilisateur doit être assignable ;
 * - l'utilisateur ne doit pas être banni ;
 * - le point de vente doit appartenir à la boutique ;
 * - le point de vente doit être actif ;
 * - l'utilisateur ne doit pas déjà avoir une affectation active.
 *
 * Le manager peut également s'affecter lui-même.
 */
export const createStaffAssignment = async (
  userId: string,
  input: CreateStaffAssignmentInput,
  managerId?: string,
) => {
  const shop = await getMainShopOrThrow();

  const user = await getAssignableUserOrThrow(userId, managerId);

  /**
   * Une affectation active est unique fonctionnellement
   * pour un utilisateur dans la boutique.
   */
  const activeAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: user.id,
      shopId: shop.id,
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

  /**
   * Le point de vente est obligatoire pour une affectation.
   */
  if (!input.pointOfSaleId) {
    throw new Error("POINT_OF_SALE_REQUIRED");
  }

  const pointOfSale = await getPointOfSaleOrThrow(input.pointOfSaleId, shop.id);

  return prisma.staffAssignment.create({
    data: {
      userId: user.id,
      shopId: shop.id,
      pointOfSaleId: pointOfSale.id,
      startDate: new Date(),
      isActive: true,
      endDate: null,
    },
    select: staffAssignmentSelect,
  });
};

/**
 * Termine l'affectation active d'un utilisateur.
 *
 * L'affectation n'est pas supprimée afin de conserver
 * l'historique.
 */
export const endStaffAssignment = async (userId: string) => {
  const shop = await getMainShopOrThrow();

  const activeAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      shopId: shop.id,
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
 * Récupère l'historique des affectations d'un utilisateur
 * dans la boutique principale.
 */
export const getStaffAssignmentHistory = async (userId: string) => {
  const shop = await getMainShopOrThrow();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return prisma.staffAssignment.findMany({
    where: {
      userId,
      shopId: shop.id,
    },
    orderBy: {
      startDate: "desc",
    },
    select: staffAssignmentSelect,
  });
};
