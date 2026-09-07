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

/**
 * Client Prisma utilisable avec ou sans transaction.
 */
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
 * ==========================================
 * HELPERS
 * ==========================================
 */

/**
 * Récupère la boutique unique de l'application.
 */
const getMainShop = async (db: DbClient = prisma) => {
  const shop = await db.shop.findUnique({
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

/**
 * Convertit une valeur en Decimal Prisma.
 */
const decimal = (value: number | Prisma.Decimal) => {
  return new Prisma.Decimal(value);
};

/**
 * Résout la ressource concernée par l'opération.
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
 * Vérifie que le type de ressource est compatible
 * avec l'emplacement demandé.
 *
 * Matières premières :
 * → stock central uniquement
 *
 * Emballages :
 * → stock central uniquement
 *
 * Produits finis :
 * → stock central ou point de vente
 */
const validateLocation = (
  resource: ResolvedResource,
  location: StockLocation,
) => {
  if (location.pointOfSaleId && resource.type !== "PRODUCT_VARIANT") {
    throw new Error("POINT_OF_SALE_STOCK_ONLY_PRODUCTS");
  }
};

/**
 * Vérifie qu'un point de vente appartient bien
 * à la boutique principale et qu'il est actif.
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
 * Vérifie que la ressource appartient à la boutique
 * et qu'elle est active.
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
 * Construit la condition de recherche du stock.
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
 * Relations retournées avec un StockBalance.
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
 * ==========================================
 * STOCK BALANCE
 * ==========================================
 */

/**
 * Récupère un stock existant ou le crée.
 *
 * IMPORTANT :
 * StockBalance n'a actuellement pas de contrainte
 * unique dans le schema Prisma.
 *
 * La fonction vérifie donc toujours l'existence
 * avant de créer une ligne.
 *
 * Elle gère également P2002 si une contrainte unique
 * est ajoutée plus tard.
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

  try {
    switch (resource.type) {
      case "RAW_MATERIAL":
        return await db.stockBalance.create({
          data: {
            rawMaterialId: resource.id,
            pointOfSaleId: null,
            quantity: decimal(0),
          },
        });

      case "PACKAGING":
        return await db.stockBalance.create({
          data: {
            packagingId: resource.id,
            pointOfSaleId: null,
            quantity: decimal(0),
          },
        });

      case "PRODUCT_VARIANT":
        return await db.stockBalance.create({
          data: {
            productVariantId: resource.id,
            pointOfSaleId: pointOfSaleId ?? null,
            quantity: decimal(0),
          },
        });
    }
  } catch (error) {
    /**
     * Protection future si une contrainte unique
     * existe en base.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingAfterConflict = await db.stockBalance.findFirst({
        where,
      });

      if (existingAfterConflict) {
        return existingAfterConflict;
      }
    }

    throw error;
  }
};

/**
 * ==========================================
 * LECTURE
 * ==========================================
 */

/**
 * Récupère le stock d'une ressource précise.
 */
export const getStockBalance = async (
  resourceInput: StockResourceInput,
  pointOfSaleId?: string,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop(db);

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
 * Récupère les stocks de la boutique.
 */
export const getStockBalances = async (
  filters: GetStockInput = {},
  db: DbClient = prisma,
) => {
  const shop = await getMainShop(db);

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

  const stocks = await db.stockBalance.findMany({
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
 * ==========================================
 * AJOUT DE STOCK
 * ==========================================
 */

/**
 * Ajoute une quantité au stock.
 *
 * Aucun StockMovement n'est créé ici.
 *
 * Les mouvements doivent être créés par le service
 * métier responsable de l'opération :
 *
 * PURCHASE
 * PRODUCTION_IN
 * DISTRIBUTION_IN
 * ADJUSTMENT
 * etc.
 */
export const addStock = async (data: AddStockInput, db: DbClient = prisma) => {
  const shop = await getMainShop(db);

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
 * ==========================================
 * RETRAIT DE STOCK
 * ==========================================
 */

/**
 * Retire une quantité du stock.
 *
 * Le retrait est effectué de manière conditionnelle
 * directement en base afin d'éviter qu'une concurrence
 * entre deux requêtes fasse passer le stock sous zéro.
 *
 * Exemple :
 *
 * Stock = 10
 *
 * Requête A → retire 7
 * Requête B → retire 7
 *
 * Une seule requête peut réussir.
 */
export const removeStock = async (
  data: RemoveStockInput,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop(db);

  const resource = resolveResource(data);

  validateLocation(resource, {
    pointOfSaleId: data.pointOfSaleId,
  });

  await validatePointOfSale(db, shop.id, data.pointOfSaleId);

  await validateResource(db, shop.id, resource);

  /**
   * Contrairement à addStock(), on ne crée pas
   * un StockBalance vide pour effectuer un retrait.
   *
   * Un stock inexistant est simplement considéré
   * comme un stock disponible de 0.
   */
  const stock = await db.stockBalance.findFirst({
    where: buildStockWhere(shop.id, resource, data.pointOfSaleId),
  });

  const requestedQuantity = decimal(data.quantity);

  if (!stock) {
    throw new Error(`INSUFFICIENT_STOCK:0:${requestedQuantity.toString()}`);
  }

  /**
   * Le contrôle de quantité est effectué directement
   * dans la requête SQL.
   *
   * Cela protège contre les retraits concurrents.
   */
  const result = await db.stockBalance.updateMany({
    where: {
      id: stock.id,

      quantity: {
        gte: requestedQuantity,
      },
    },

    data: {
      quantity: {
        decrement: requestedQuantity,
      },
    },
  });

  /**
   * count === 0 signifie que :
   *
   * - le stock était insuffisant
   * - ou une autre opération concurrente
   *   a consommé le stock avant nous.
   */
  if (result.count === 0) {
    const currentStock = await db.stockBalance.findUnique({
      where: {
        id: stock.id,
      },

      select: {
        quantity: true,
      },
    });

    const availableQuantity = currentStock?.quantity ?? decimal(0);

    throw new Error(
      `INSUFFICIENT_STOCK:${availableQuantity.toString()}:${requestedQuantity.toString()}`,
    );
  }

  /**
   * On récupère la ligne mise à jour avec
   * toutes les relations attendues par les appels
   * existants du service.
   */
  return db.stockBalance.findUnique({
    where: {
      id: stock.id,
    },

    include: stockInclude,
  });
};

/**
 * ==========================================
 * AJUSTEMENT
 * ==========================================
 */

/**
 * Définit directement la quantité du stock.
 *
 * Aucun StockMovement n'est créé ici.
 *
 * Le service métier d'inventaire doit créer le mouvement
 * ADJUSTMENT correspondant.
 */
export const adjustStock = async (
  data: AdjustStockInput,
  db: DbClient = prisma,
) => {
  const shop = await getMainShop(db);

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
 * ==========================================
 * MOUVEMENTS
 * ==========================================
 */

/**
 * Récupère l'historique des mouvements de stock.
 */
export const getStockMovements = async (
  filters: StockMovementsInput = {},
  db: DbClient = prisma,
) => {
  const shop = await getMainShop(db);

  return db.stockMovement.findMany({
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
