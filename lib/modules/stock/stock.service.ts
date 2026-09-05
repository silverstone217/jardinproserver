import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  AddStockInput,
  AdjustStockInput,
  GetStockInput,
  RemoveStockInput,
  StockMovementsInput,
  StockResourceInput,
} from "./stock.schema";

type DbClient = Prisma.TransactionClient | typeof prisma;

type StockResourceType = "RAW_MATERIAL" | "PACKAGING" | "PRODUCT_VARIANT";

type ResolvedResource = {
  type: StockResourceType;
  id: string;
};

type StockLocation = {
  pointOfSaleId?: string;
};

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
 * Convertit une valeur numérique en Decimal Prisma.
 */
const decimal = (value: number | Prisma.Decimal) => new Prisma.Decimal(value);

/**
 * Détermine quelle ressource est concernée par l'opération.
 *
 * Une seule ressource doit être fournie :
 * - rawMaterialId
 * - packagingId
 * - productVariantId
 */
const resolveResource = (resource: StockResourceInput): ResolvedResource => {
  if (resource.rawMaterialId) {
    return {
      type: "RAW_MATERIAL",
      id: resource.rawMaterialId,
    };
  }

  if (resource.packagingId) {
    return {
      type: "PACKAGING",
      id: resource.packagingId,
    };
  }

  if (resource.productVariantId) {
    return {
      type: "PRODUCT_VARIANT",
      id: resource.productVariantId,
    };
  }

  throw new Error("STOCK_RESOURCE_REQUIRED");
};

/**
 * Vérifie que la combinaison ressource / emplacement
 * est autorisée.
 *
 * Stock central :
 * - matière première
 * - emballage
 * - produit fini
 *
 * Point de vente :
 * - produit fini uniquement
 */
const validateLocation = (
  resource: ResolvedResource,
  location: StockLocation,
) => {
  const isPointOfSale = Boolean(location.pointOfSaleId);

  if (isPointOfSale && resource.type !== "PRODUCT_VARIANT") {
    throw new Error("POINT_OF_SALE_STOCK_ONLY_PRODUCTS");
  }
};

/**
 * Vérifie qu'un point de vente appartient bien
 * à la boutique principale.
 */
const validatePointOfSale = async (
  db: DbClient,
  shopId: string,
  pointOfSaleId?: string,
) => {
  if (!pointOfSaleId) {
    return;
  }

  const pointOfSale = await db.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  if (!pointOfSale.isActive) {
    throw new Error("POINT_OF_SALE_INACTIVE");
  }
};

/**
 * Vérifie que la ressource appartient bien
 * à la boutique principale et qu'elle est active.
 */
const validateResource = async (
  db: DbClient,
  shopId: string,
  resource: ResolvedResource,
) => {
  switch (resource.type) {
    case "RAW_MATERIAL": {
      const rawMaterial = await db.rawMaterial.findFirst({
        where: {
          id: resource.id,
          shopId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!rawMaterial) {
        throw new Error("RAW_MATERIAL_NOT_FOUND");
      }

      if (!rawMaterial.isActive) {
        throw new Error("RAW_MATERIAL_INACTIVE");
      }

      return;
    }

    case "PACKAGING": {
      const packaging = await db.packaging.findFirst({
        where: {
          id: resource.id,
          shopId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!packaging) {
        throw new Error("PACKAGING_NOT_FOUND");
      }

      if (!packaging.isActive) {
        throw new Error("PACKAGING_INACTIVE");
      }

      return;
    }

    case "PRODUCT_VARIANT": {
      const variant = await db.productVariant.findFirst({
        where: {
          id: resource.id,
          product: {
            shopId,
          },
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!variant) {
        throw new Error("PRODUCT_VARIANT_NOT_FOUND");
      }

      if (!variant.isActive) {
        throw new Error("PRODUCT_VARIANT_INACTIVE");
      }

      return;
    }
  }
};

/**
 * Construit le WHERE permettant de retrouver
 * le StockBalance correspondant à une ressource
 * et à son emplacement.
 */
const buildStockWhere = (
  shopId: string,
  resource: ResolvedResource,
  pointOfSaleId?: string,
): Prisma.StockBalanceWhereInput => {
  switch (resource.type) {
    case "RAW_MATERIAL":
      return {
        rawMaterialId: resource.id,
        pointOfSaleId: null,
        rawMaterial: {
          shopId,
        },
      };

    case "PACKAGING":
      return {
        packagingId: resource.id,
        pointOfSaleId: null,
        packaging: {
          shopId,
        },
      };

    case "PRODUCT_VARIANT":
      return {
        productVariantId: resource.id,
        pointOfSaleId: pointOfSaleId ?? null,
        productVariant: {
          product: {
            shopId,
          },
        },
      };
  }
};

/**
 * Retourne un stock avec toutes les informations
 * utiles à l'application.
 */
const stockInclude = {
  rawMaterial: true,
  packaging: true,
  productVariant: {
    include: {
      product: true,
      packaging: true,
    },
  },
  pointOfSale: true,
} satisfies Prisma.StockBalanceInclude;

/**
 * Retourne le stock correspondant à une ressource.
 */
export const getStockBalance = async (
  resourceInput: StockResourceInput,
  pointOfSaleId?: string,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop();
  const resource = resolveResource(resourceInput);

  validateLocation(resource, {
    pointOfSaleId,
  });

  await validatePointOfSale(db, shop.id, pointOfSaleId);

  await validateResource(db, shop.id, resource);

  return db.stockBalance.findFirst({
    where: buildStockWhere(shop.id, resource, pointOfSaleId),
    include: stockInclude,
  });
};

/**
 * Récupère tous les stocks de la boutique.
 */
export const getStockBalances = async (filters: GetStockInput = {}) => {
  const shop = await getMainShop();

  const where: Prisma.StockBalanceWhereInput = {
    OR: [
      {
        rawMaterial: {
          shopId: shop.id,
        },
      },
      {
        packaging: {
          shopId: shop.id,
        },
      },
      {
        productVariant: {
          product: {
            shopId: shop.id,
          },
        },
      },
    ],

    ...(filters.pointOfSaleId && {
      pointOfSaleId: filters.pointOfSaleId,
    }),

    ...(filters.rawMaterialId && {
      rawMaterialId: filters.rawMaterialId,
    }),

    ...(filters.packagingId && {
      packagingId: filters.packagingId,
    }),

    ...(filters.productVariantId && {
      productVariantId: filters.productVariantId,
    }),
  };

  const stocks = await prisma.stockBalance.findMany({
    where,
    include: stockInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!filters.lowStockOnly) {
    return stocks;
  }

  return stocks.filter((stock) => {
    if (!stock.rawMaterial || stock.rawMaterial.minStock === null) {
      return false;
    }

    return stock.quantity.lessThanOrEqualTo(stock.rawMaterial.minStock);
  });
};

/**
 * Crée ou récupère un StockBalance.
 *
 * Cette fonction est interne au service.
 */
const getOrCreateStockBalance = async (
  db: DbClient,
  shopId: string,
  resource: ResolvedResource,
  pointOfSaleId?: string,
) => {
  const where = buildStockWhere(shopId, resource, pointOfSaleId);

  const existing = await db.stockBalance.findFirst({
    where,
  });

  if (existing) {
    return existing;
  }

  switch (resource.type) {
    case "RAW_MATERIAL":
      return db.stockBalance.create({
        data: {
          rawMaterialId: resource.id,
          pointOfSaleId: null,
          quantity: decimal(0),
        },
      });

    case "PACKAGING":
      return db.stockBalance.create({
        data: {
          packagingId: resource.id,
          pointOfSaleId: null,
          quantity: decimal(0),
        },
      });

    case "PRODUCT_VARIANT":
      return db.stockBalance.create({
        data: {
          productVariantId: resource.id,
          pointOfSaleId: pointOfSaleId ?? null,
          quantity: decimal(0),
        },
      });
  }
};

/**
 * Ajoute une quantité au stock.
 *
 * Cette fonction modifie uniquement StockBalance.
 * Les mouvements sont créés par les opérations métier.
 */
export const addStock = async (data: AddStockInput, db: DbClient = prisma) => {
  const shop = await getMainShop();
  const resource = resolveResource(data);

  validateLocation(resource, {
    pointOfSaleId: data.pointOfSaleId,
  });

  await validatePointOfSale(db, shop.id, data.pointOfSaleId);

  await validateResource(db, shop.id, resource);

  const stock = await getOrCreateStockBalance(
    db,
    shop.id,
    resource,
    data.pointOfSaleId,
  );

  const quantity = decimal(data.quantity);

  return db.stockBalance.update({
    where: {
      id: stock.id,
    },
    data: {
      quantity: {
        increment: quantity,
      },
    },
    include: stockInclude,
  });
};

/**
 * Retire une quantité du stock.
 *
 * Vérifie toujours que le stock disponible
 * est suffisant avant de modifier la quantité.
 */
export const removeStock = async (
  data: RemoveStockInput,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop();
  const resource = resolveResource(data);

  validateLocation(resource, {
    pointOfSaleId: data.pointOfSaleId,
  });

  await validatePointOfSale(db, shop.id, data.pointOfSaleId);

  await validateResource(db, shop.id, resource);

  const stock = await getOrCreateStockBalance(
    db,
    shop.id,
    resource,
    data.pointOfSaleId,
  );

  const requestedQuantity = decimal(data.quantity);

  if (stock.quantity.lessThan(requestedQuantity)) {
    throw new Error(
      `INSUFFICIENT_STOCK:${stock.quantity.toString()}:${requestedQuantity.toString()}`,
    );
  }

  return db.stockBalance.update({
    where: {
      id: stock.id,
    },
    data: {
      quantity: {
        decrement: requestedQuantity,
      },
    },
    include: stockInclude,
  });
};

/**
 * Ajuste directement le stock à une nouvelle quantité.
 *
 * Exemple :
 * stock actuel = 18
 * quantité réelle = 15
 *
 * => nouveau stock = 15
 */
export const adjustStock = async (
  data: AdjustStockInput,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop();
  const resource = resolveResource(data);

  validateLocation(resource, {
    pointOfSaleId: data.pointOfSaleId,
  });

  await validatePointOfSale(db, shop.id, data.pointOfSaleId);

  await validateResource(db, shop.id, resource);

  const stock = await getOrCreateStockBalance(
    db,
    shop.id,
    resource,
    data.pointOfSaleId,
  );

  return db.stockBalance.update({
    where: {
      id: stock.id,
    },
    data: {
      quantity: decimal(data.quantity),
    },
    include: stockInclude,
  });
};

/**
 * Historique des mouvements de stock.
 */
export const getStockMovements = async (filters: StockMovementsInput = {}) => {
  const shop = await getMainShop();

  return prisma.stockMovement.findMany({
    where: {
      shopId: shop.id,

      ...(filters.pointOfSaleId && {
        pointOfSaleId: filters.pointOfSaleId,
      }),

      ...(filters.rawMaterialId && {
        rawMaterialId: filters.rawMaterialId,
      }),

      ...(filters.packagingId && {
        packagingId: filters.packagingId,
      }),

      ...(filters.productVariantId && {
        productVariantId: filters.productVariantId,
      }),

      ...(filters.type && {
        type: filters.type,
      }),

      ...(filters.referenceId && {
        referenceId: filters.referenceId,
      }),
    },

    include: {
      rawMaterial: true,
      packaging: true,
      productVariant: {
        include: {
          product: true,
          packaging: true,
        },
      },
      pointOfSale: true,
    },

    orderBy: {
      createdAt: "desc",
    },

    take: filters.limit,
    skip: filters.offset,
  });
};
