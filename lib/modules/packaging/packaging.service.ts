import { prisma } from "@/lib/prisma";
import type {
  CreatePackagingInput,
  UpdatePackagingInput,
} from "./packaging.schema";

/**
 * Récupère la boutique unique du projet.
 */
const getMainShop = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

/**
 * Créer un emballage.
 */
export const createPackaging = async (data: CreatePackagingInput) => {
  const shop = await getMainShop();

  const existingPackaging = await prisma.packaging.findUnique({
    where: {
      shopId_name_size: {
        shopId: shop.id,
        name: data.name,
        size: data.size,
      },
    },
  });

  if (existingPackaging) {
    throw new Error("PACKAGING_ALREADY_EXISTS");
  }

  const packaging = await prisma.packaging.create({
    data: {
      shopId: shop.id,
      name: data.name,
      size: data.size,
      unit: data.unit,
    },
  });

  return packaging;
};

/**
 * Récupérer tous les emballages de la boutique.
 */
export const getPackagings = async () => {
  const shop = await getMainShop();

  const packagings = await prisma.packaging.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  return packagings;
};

/**
 * Récupérer un emballage par son identifiant.
 */
export const getPackagingById = async (id: string) => {
  const shop = await getMainShop();

  const packaging = await prisma.packaging.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  return packaging;
};

/**
 * Modifier un emballage.
 */
export const updatePackaging = async (
  id: string,
  data: UpdatePackagingInput,
) => {
  const shop = await getMainShop();

  const existingPackaging = await prisma.packaging.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!existingPackaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  const name = data.name ?? existingPackaging.name;

  const size = data.size ?? existingPackaging.size;

  const duplicatePackaging = await prisma.packaging.findFirst({
    where: {
      shopId: shop.id,
      name,
      size,
      NOT: {
        id,
      },
    },
  });

  if (duplicatePackaging) {
    throw new Error("PACKAGING_ALREADY_EXISTS");
  }

  const packaging = await prisma.packaging.update({
    where: {
      id,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.size !== undefined && {
        size: data.size,
      }),

      ...(data.isActive !== undefined && {
        isActive: data.isActive,
      }),
    },
  });

  return packaging;
};

/**
 * Désactiver un emballage.
 */
export const deactivatePackaging = async (id: string) => {
  const shop = await getMainShop();

  const packaging = await prisma.packaging.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  if (!packaging.isActive) {
    throw new Error("PACKAGING_ALREADY_INACTIVE");
  }

  const updatedPackaging = await prisma.packaging.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return updatedPackaging;
};

/**
 * Activer un emballage.
 */
export const activatePackaging = async (id: string) => {
  const shop = await getMainShop();

  const packaging = await prisma.packaging.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  if (packaging.isActive) {
    throw new Error("PACKAGING_ALREADY_ACTIVE");
  }

  const updatedPackaging = await prisma.packaging.update({
    where: {
      id,
    },
    data: {
      isActive: true,
    },
  });

  return updatedPackaging;
};
