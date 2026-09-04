import { prisma } from "@/lib/prisma";

import type {
  CreatePointOfSaleInput,
  UpdatePointOfSaleInput,
  UpdatePointOfSaleStatusInput,
} from "./point-of-sale.schema";

// ============================================================
// SELECT
// ============================================================

const pointOfSaleSelect = {
  id: true,
  shopId: true,
  name: true,
  code: true,
  telephone: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================================
// RÉCUPÉRER LA BOUTIQUE UNIQUE
// ============================================================

const getShopOrThrow = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

// ============================================================
// RÉCUPÉRER UN POINT DE VENTE
// ============================================================

// const getPointOfSaleOrThrow = async (pointOfSaleId: string) => {
//   const pointOfSale = await prisma.pointOfSale.findUnique({
//     where: {
//       id: pointOfSaleId,
//     },
//     select: pointOfSaleSelect,
//   });

//   if (!pointOfSale) {
//     throw new Error("POINT_OF_SALE_NOT_FOUND");
//   }

//   return pointOfSale;
// };

// ============================================================
// LISTE DES POINTS DE VENTE
// ============================================================

export const getPointOfSales = async () => {
  const shop = await getShopOrThrow();

  return prisma.pointOfSale.findMany({
    where: {
      shopId: shop.id,
    },
    select: pointOfSaleSelect,
    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
  });
};

// ============================================================
// POINT DE VENTE PAR ID
// ============================================================

export const getPointOfSaleById = async (pointOfSaleId: string) => {
  const shop = await getShopOrThrow();

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId: shop.id,
    },
    select: pointOfSaleSelect,
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  return pointOfSale;
};

// ============================================================
// CRÉER UN POINT DE VENTE
// ============================================================

export const createPointOfSale = async (input: CreatePointOfSaleInput) => {
  const shop = await getShopOrThrow();

  // ----------------------------------------------------------
  // Vérifier que le code n'est pas déjà utilisé
  // ----------------------------------------------------------

  const existingCode = await prisma.pointOfSale.findFirst({
    where: {
      shopId: shop.id,
      code: input.code,
    },
    select: {
      id: true,
    },
  });

  if (existingCode) {
    throw new Error("CODE_ALREADY_EXISTS");
  }

  // ----------------------------------------------------------
  // Création
  // ----------------------------------------------------------

  return prisma.pointOfSale.create({
    data: {
      shopId: shop.id,
      name: input.name,
      code: input.code,
      telephone: input.telephone,
      address: input.address,
    },
    select: pointOfSaleSelect,
  });
};

// ============================================================
// MODIFIER UN POINT DE VENTE
// ============================================================

export const updatePointOfSale = async (
  pointOfSaleId: string,
  input: UpdatePointOfSaleInput,
) => {
  const shop = await getShopOrThrow();

  // ----------------------------------------------------------
  // Vérifier que le POS appartient bien à notre boutique
  // ----------------------------------------------------------

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId: shop.id,
    },
    select: {
      id: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  // ----------------------------------------------------------
  // Vérifier l'unicité du code
  // ----------------------------------------------------------

  if (input.code !== undefined) {
    const existingCode = await prisma.pointOfSale.findFirst({
      where: {
        shopId: shop.id,
        code: input.code,
        NOT: {
          id: pointOfSaleId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingCode) {
      throw new Error("CODE_ALREADY_EXISTS");
    }
  }

  // ----------------------------------------------------------
  // Modification
  // ----------------------------------------------------------

  return prisma.pointOfSale.update({
    where: {
      id: pointOfSaleId,
    },
    data: {
      ...(input.name !== undefined && {
        name: input.name,
      }),

      ...(input.code !== undefined && {
        code: input.code,
      }),

      ...(input.telephone !== undefined && {
        telephone: input.telephone,
      }),

      ...(input.address !== undefined && {
        address: input.address,
      }),
    },
    select: pointOfSaleSelect,
  });
};

// ============================================================
// ACTIVER / DÉSACTIVER UN POINT DE VENTE
// ============================================================

export const updatePointOfSaleStatus = async (
  pointOfSaleId: string,
  input: UpdatePointOfSaleStatusInput,
) => {
  const shop = await getShopOrThrow();

  // ----------------------------------------------------------
  // Vérifier que le POS appartient à notre boutique
  // ----------------------------------------------------------

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId: shop.id,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  // ----------------------------------------------------------
  // Éviter une mise à jour inutile
  // ----------------------------------------------------------

  if (pointOfSale.isActive === input.isActive) {
    return prisma.pointOfSale.findUnique({
      where: {
        id: pointOfSaleId,
      },
      select: pointOfSaleSelect,
    });
  }

  // ----------------------------------------------------------
  // Modification du statut
  // ----------------------------------------------------------

  return prisma.pointOfSale.update({
    where: {
      id: pointOfSaleId,
    },
    data: {
      isActive: input.isActive,
    },
    select: pointOfSaleSelect,
  });
};
