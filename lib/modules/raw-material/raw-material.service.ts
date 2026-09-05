import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateRawMaterialInput,
  GetRawMaterialsInput,
  UpdateRawMaterialInput,
} from "./raw-material.schema";

const rawMaterialInclude = {
  stock: true,
  _count: {
    select: {
      ingredients: true,
      movements: true,
    },
  },
} satisfies Prisma.RawMaterialInclude;

type RawMaterialWithRelations = Prisma.RawMaterialGetPayload<{
  include: typeof rawMaterialInclude;
}>;

/**
 * Récupère la boutique unique de l'application.
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
 * Récupère une matière première et vérifie qu'elle appartient
 * bien à la boutique.
 */
export const getRawMaterialById = async (
  id: string,
): Promise<RawMaterialWithRelations> => {
  const shop = await getMainShop();

  const rawMaterial = await prisma.rawMaterial.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
    include: rawMaterialInclude,
  });

  if (!rawMaterial) {
    throw new Error("RAW_MATERIAL_NOT_FOUND");
  }

  return rawMaterial;
};

/**
 * Récupère toutes les matières premières de la boutique.
 */
export const getRawMaterials = async (
  filters: GetRawMaterialsInput = {},
): Promise<RawMaterialWithRelations[]> => {
  const shop = await getMainShop();

  const where: Prisma.RawMaterialWhereInput = {
    shopId: shop.id,
  };

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  return prisma.rawMaterial.findMany({
    where,
    include: rawMaterialInclude,
    orderBy: {
      name: "asc",
    },
  });
};

/**
 * Vérifie qu'une matière première avec le même nom
 * n'existe pas déjà dans la boutique.
 */
const ensureNameIsAvailable = async (
  shopId: string,
  name: string,
  excludeId?: string,
) => {
  const existing = await prisma.rawMaterial.findFirst({
    where: {
      shopId,
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(excludeId
        ? {
            NOT: {
              id: excludeId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("RAW_MATERIAL_NAME_ALREADY_EXISTS");
  }
};

/**
 * Crée une matière première.
 */
export const createRawMaterial = async (
  data: CreateRawMaterialInput,
): Promise<RawMaterialWithRelations> => {
  const shop = await getMainShop();

  const name = data.name.trim();

  await ensureNameIsAvailable(shop.id, name);

  return prisma.rawMaterial.create({
    data: {
      shopId: shop.id,
      name,
      unit: data.unit,
      minStock:
        data.minStock !== undefined ? new Prisma.Decimal(data.minStock) : null,
    },
    include: rawMaterialInclude,
  });
};

/**
 * Modifie une matière première.
 */
export const updateRawMaterial = async (
  id: string,
  data: UpdateRawMaterialInput,
): Promise<RawMaterialWithRelations> => {
  const shop = await getMainShop();

  const existing = await prisma.rawMaterial.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!existing) {
    throw new Error("RAW_MATERIAL_NOT_FOUND");
  }

  const updateData: Prisma.RawMaterialUpdateInput = {};

  if (data.name !== undefined) {
    const name = data.name.trim();

    await ensureNameIsAvailable(shop.id, name, id);

    updateData.name = name;
  }

  if (data.unit !== undefined) {
    updateData.unit = data.unit;
  }

  if (data.minStock !== undefined) {
    updateData.minStock =
      data.minStock === null ? null : new Prisma.Decimal(data.minStock);
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  return prisma.rawMaterial.update({
    where: {
      id,
    },
    data: updateData,
    include: rawMaterialInclude,
  });
};

/**
 * Active ou désactive une matière première.
 */
export const updateRawMaterialStatus = async (
  id: string,
  isActive: boolean,
): Promise<RawMaterialWithRelations> => {
  const shop = await getMainShop();

  const existing = await prisma.rawMaterial.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
  });

  if (!existing) {
    throw new Error("RAW_MATERIAL_NOT_FOUND");
  }

  return prisma.rawMaterial.update({
    where: {
      id,
    },
    data: {
      isActive,
    },
    include: rawMaterialInclude,
  });
};
