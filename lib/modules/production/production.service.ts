import {
  Prisma,
  ProductionStatus,
  StockMovementType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateProductionInput } from "./production.schema";

/**
 * Client Prisma utilisable avec ou sans transaction.
 */
type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Relations utilisées par les réponses Production.
 */
const productionInclude = {
  product: {
    select: {
      id: true,
      shopId: true,
      name: true,
      description: true,
      image: true,
      recipeVolumeMl: true,
      isActive: true,

      ingredients: {
        include: {
          rawMaterial: {
            select: {
              id: true,
              shopId: true,
              name: true,
              unit: true,
              isActive: true,
            },
          },
        },
      },

      variants: {
        include: {
          packaging: {
            select: {
              id: true,
              shopId: true,
              name: true,
              size: true,
              unit: true,
              isActive: true,
            },
          },
        },
      },
    },
  },

  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      role: true,
    },
  },

  outputs: {
    include: {
      productVariant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              shopId: true,
            },
          },

          packaging: {
            select: {
              id: true,
              name: true,
              size: true,
              unit: true,
              isActive: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.ProductionBatchInclude;

type ProductionWithRelations = Prisma.ProductionBatchGetPayload<{
  include: typeof productionInclude;
}>;

/**
 * Récupère la boutique unique de l'application.
 *
 * La boutique est identifiée par singleton = "MAIN".
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
 * Convertit une valeur Decimal Prisma en number.
 */
const decimalToNumber = (value: Prisma.Decimal | number): number => {
  return Number(value);
};

/**
 * Calcule le volume total correspondant aux sorties.
 */
const calculateOutputVolume = (
  outputs: Array<{
    quantity: number;
    productVariant: {
      volumeMl: number;
    };
  }>,
): number => {
  return outputs.reduce(
    (total, output) => total + output.quantity * output.productVariant.volumeMl,
    0,
  );
};

/**
 * Récupère une production appartenant à la boutique principale.
 */
export const getProductionById = async (
  id: string,
): Promise<ProductionWithRelations> => {
  const shop = await getMainShop();

  const production = await prisma.productionBatch.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
    include: productionInclude,
  });

  if (!production) {
    throw new Error("PRODUCTION_NOT_FOUND");
  }

  return production;
};

/**
 * Récupère les productions de la boutique principale.
 */
export const getProductions = async (options?: {
  status?: ProductionStatus;
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<ProductionWithRelations[]> => {
  const shop = await getMainShop();

  return prisma.productionBatch.findMany({
    where: {
      shopId: shop.id,

      ...(options?.status !== undefined && {
        status: options.status,
      }),

      ...(options?.productId !== undefined && {
        productId: options.productId,
      }),
    },

    include: productionInclude,

    orderBy: {
      createdAt: "desc",
    },

    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
};

/**
 * Crée une production planifiée.
 *
 * IMPORTANT :
 * La création ne modifie PAS le stock.
 */
export const createProduction = async (
  createdById: string,
  data: CreateProductionInput,
): Promise<ProductionWithRelations> => {
  const shop = await getMainShop();

  /**
   * Récupération du produit avec sa recette
   * et ses variantes.
   */
  const product = await prisma.product.findFirst({
    where: {
      id: data.productId,
      shopId: shop.id,
    },

    include: {
      ingredients: {
        include: {
          rawMaterial: true,
        },
      },

      variants: {
        include: {
          packaging: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  if (!product.isActive) {
    throw new Error("PRODUCT_INACTIVE");
  }

  if (product.recipeVolumeMl <= 0) {
    throw new Error("INVALID_RECIPE_VOLUME");
  }

  if (product.ingredients.length === 0) {
    throw new Error("RECIPE_NOT_FOUND");
  }

  /**
   * Vérification des matières premières
   * utilisées dans la recette.
   */
  for (const ingredient of product.ingredients) {
    if (!ingredient.rawMaterial.isActive) {
      throw new Error("RAW_MATERIAL_INACTIVE");
    }

    if (ingredient.rawMaterial.shopId !== shop.id) {
      throw new Error("RAW_MATERIAL_NOT_FOUND");
    }

    if (ingredient.unit !== ingredient.rawMaterial.unit) {
      throw new Error("RECIPE_INGREDIENT_UNIT_MISMATCH");
    }

    if (Number(ingredient.quantity) <= 0) {
      throw new Error("INVALID_RECIPE_INGREDIENT_QUANTITY");
    }
  }

  /**
   * Récupération des variantes demandées.
   */
  const variantIds = data.outputs.map((output) => output.productVariantId);

  const variants = await prisma.productVariant.findMany({
    where: {
      id: {
        in: variantIds,
      },
    },

    include: {
      packaging: true,
    },
  });

  if (variants.length !== variantIds.length) {
    throw new Error("PRODUCT_VARIANT_NOT_FOUND");
  }

  /**
   * Vérification des variantes.
   */
  for (const variant of variants) {
    if (variant.productId !== product.id) {
      throw new Error("PRODUCT_VARIANT_PRODUCT_MISMATCH");
    }

    if (!variant.isActive) {
      throw new Error("PRODUCT_VARIANT_INACTIVE");
    }

    if (variant.packaging.shopId !== shop.id) {
      throw new Error("PACKAGING_NOT_FOUND");
    }

    if (!variant.packaging.isActive) {
      throw new Error("PACKAGING_INACTIVE");
    }

    if (variant.volumeMl <= 0) {
      throw new Error("INVALID_PRODUCT_VARIANT_VOLUME");
    }
  }

  /**
   * Associe chaque sortie à sa variante.
   */
  const outputsWithVariants = data.outputs.map((output) => {
    const variant = variants.find(
      (item) => item.id === output.productVariantId,
    );

    if (!variant) {
      throw new Error("PRODUCT_VARIANT_NOT_FOUND");
    }

    return {
      ...output,
      productVariant: variant,
    };
  });

  /**
   * Vérifie que le volume des sorties correspond
   * exactement au rendement prévu.
   */
  const expectedVolume = data.quantityPlanned * product.recipeVolumeMl;

  const outputVolume = calculateOutputVolume(outputsWithVariants);

  if (outputVolume !== expectedVolume) {
    throw new Error(
      `INVALID_PRODUCTION_VOLUME:${expectedVolume}:${outputVolume}`,
    );
  }

  /**
   * Vérifie que l'utilisateur existe.
   */
  const creator = await prisma.user.findUnique({
    where: {
      id: createdById,
    },

    select: {
      id: true,
    },
  });

  if (!creator) {
    throw new Error("USER_NOT_FOUND");
  }

  /**
   * Création de la production.
   *
   * Aucun stock n'est modifié ici.
   */
  return prisma.productionBatch.create({
    data: {
      shopId: shop.id,
      productId: product.id,
      createdById,

      quantityPlanned: data.quantityPlanned,
      quantityProduced: 0,

      status: ProductionStatus.PLANNED,

      notes: data.notes?.trim() || null,

      outputs: {
        create: data.outputs.map((output) => ({
          productVariantId: output.productVariantId,
          quantity: output.quantity,
        })),
      },
    },

    include: productionInclude,
  });
};

/**
 * Démarre une production.
 *
 * PLANNED → IN_PROGRESS
 *
 * Aucun stock n'est modifié.
 */
export const startProduction = async (
  id: string,
): Promise<ProductionWithRelations> => {
  const shop = await getMainShop();

  const production = await prisma.productionBatch.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
      status: true,
    },
  });

  if (!production) {
    throw new Error("PRODUCTION_NOT_FOUND");
  }

  if (production.status !== ProductionStatus.PLANNED) {
    throw new Error("PRODUCTION_CANNOT_BE_STARTED");
  }

  return prisma.productionBatch.update({
    where: {
      id: production.id,
    },

    data: {
      status: ProductionStatus.IN_PROGRESS,
      startedAt: new Date(),
    },

    include: productionInclude,
  });
};

/**
 * Finalise une production.
 *
 * IN_PROGRESS → COMPLETED
 *
 * Toute la modification du stock et la finalisation
 * de la production sont atomiques.
 *
 * IMPORTANT :
 * On ne passe volontairement pas par addStock/removeStock
 * ici afin d'éviter de multiplier les requêtes dans
 * la transaction.
 */
export const completeProduction = async (
  id: string,
): Promise<ProductionWithRelations> => {
  return prisma.$transaction(
    async (tx) => {
      /**
       * ==========================================
       * 1. BOUTIQUE
       * ==========================================
       */
      const shop = await getMainShop(tx);

      /**
       * ==========================================
       * 2. PRODUCTION
       * ==========================================
       *
       * On récupère toutes les données nécessaires
       * en une seule requête.
       */
      const production = await tx.productionBatch.findFirst({
        where: {
          id,
          shopId: shop.id,
        },

        include: {
          product: {
            include: {
              ingredients: {
                include: {
                  rawMaterial: true,
                },
              },

              variants: {
                include: {
                  packaging: true,
                },
              },
            },
          },

          outputs: {
            include: {
              productVariant: {
                include: {
                  packaging: true,
                },
              },
            },

            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!production) {
        throw new Error("PRODUCTION_NOT_FOUND");
      }

      /**
       * Une production doit être démarrée
       * avant d'être finalisée.
       */
      if (production.status !== ProductionStatus.IN_PROGRESS) {
        throw new Error("PRODUCTION_CANNOT_BE_COMPLETED");
      }

      const product = production.product;

      /**
       * ==========================================
       * 3. VALIDATION DU PRODUIT
       * ==========================================
       */
      if (!product.isActive) {
        throw new Error("PRODUCT_INACTIVE");
      }

      if (product.recipeVolumeMl <= 0) {
        throw new Error("INVALID_RECIPE_VOLUME");
      }

      /**
       * ==========================================
       * 4. VALIDATION DE LA RECETTE
       * ==========================================
       */
      if (product.ingredients.length === 0) {
        throw new Error("RECIPE_NOT_FOUND");
      }

      for (const ingredient of product.ingredients) {
        if (!ingredient.rawMaterial.isActive) {
          throw new Error("RAW_MATERIAL_INACTIVE");
        }

        if (ingredient.rawMaterial.shopId !== shop.id) {
          throw new Error("RAW_MATERIAL_NOT_FOUND");
        }

        if (ingredient.unit !== ingredient.rawMaterial.unit) {
          throw new Error("RECIPE_INGREDIENT_UNIT_MISMATCH");
        }

        if (Number(ingredient.quantity) <= 0) {
          throw new Error("INVALID_RECIPE_INGREDIENT_QUANTITY");
        }
      }

      /**
       * ==========================================
       * 5. VALIDATION DES SORTIES
       * ==========================================
       */
      if (production.outputs.length === 0) {
        throw new Error("PRODUCTION_OUTPUTS_REQUIRED");
      }

      for (const output of production.outputs) {
        const variant = output.productVariant;

        if (variant.productId !== product.id) {
          throw new Error("PRODUCT_VARIANT_PRODUCT_MISMATCH");
        }

        if (!variant.isActive) {
          throw new Error("PRODUCT_VARIANT_INACTIVE");
        }

        if (variant.packaging.shopId !== shop.id) {
          throw new Error("PACKAGING_NOT_FOUND");
        }

        if (!variant.packaging.isActive) {
          throw new Error("PACKAGING_INACTIVE");
        }

        if (variant.volumeMl <= 0) {
          throw new Error("INVALID_PRODUCT_VARIANT_VOLUME");
        }

        if (output.quantity <= 0) {
          throw new Error("INVALID_PRODUCTION_OUTPUT_QUANTITY");
        }
      }

      /**
       * ==========================================
       * 6. VALIDATION DU VOLUME
       * ==========================================
       */
      const outputVolume = calculateOutputVolume(
        production.outputs.map((output) => ({
          quantity: output.quantity,

          productVariant: {
            volumeMl: output.productVariant.volumeMl,
          },
        })),
      );

      const expectedVolume =
        production.quantityPlanned * product.recipeVolumeMl;

      if (outputVolume !== expectedVolume) {
        throw new Error(
          `INVALID_PRODUCTION_VOLUME:${expectedVolume}:${outputVolume}`,
        );
      }

      /**
       * ==========================================
       * 7. CALCUL DES BESOINS
       * ==========================================
       */

      /**
       * Matières premières nécessaires.
       */
      const rawMaterialRequirements = new Map<string, number>();

      for (const ingredient of product.ingredients) {
        const requiredQuantity =
          decimalToNumber(ingredient.quantity) * production.quantityPlanned;

        if (requiredQuantity <= 0) {
          throw new Error("INVALID_PRODUCTION_QUANTITY");
        }

        const current =
          rawMaterialRequirements.get(ingredient.rawMaterialId) ?? 0;

        rawMaterialRequirements.set(
          ingredient.rawMaterialId,
          current + requiredQuantity,
        );
      }

      /**
       * Emballages nécessaires.
       */
      const packagingRequirements = new Map<string, number>();

      for (const output of production.outputs) {
        const packagingId = output.productVariant.packagingId;

        const current = packagingRequirements.get(packagingId) ?? 0;

        packagingRequirements.set(packagingId, current + output.quantity);
      }

      /**
       * Produits finis nécessaires.
       *
       * Le schema empêche déjà les doublons,
       * mais on agrège quand même pour rester robuste.
       */
      const productVariantRequirements = new Map<string, number>();

      for (const output of production.outputs) {
        const current =
          productVariantRequirements.get(output.productVariantId) ?? 0;

        productVariantRequirements.set(
          output.productVariantId,
          current + output.quantity,
        );
      }

      /**
       * ==========================================
       * 8. CHARGEMENT DES STOCKS EN UNE REQUÊTE
       * ==========================================
       *
       * Au lieu de faire plusieurs appels :
       *
       * removeStock()
       * removeStock()
       * addStock()
       * addStock()
       *
       * on récupère tous les StockBalance nécessaires
       * d'un seul coup.
       */
      const rawMaterialIds = [...rawMaterialRequirements.keys()];

      const packagingIds = [...packagingRequirements.keys()];

      const productVariantIds = [...productVariantRequirements.keys()];

      const stockBalances = await tx.stockBalance.findMany({
        where: {
          pointOfSaleId: null,

          OR: [
            ...(rawMaterialIds.length > 0
              ? [
                  {
                    rawMaterialId: {
                      in: rawMaterialIds,
                    },
                  },
                ]
              : []),

            ...(packagingIds.length > 0
              ? [
                  {
                    packagingId: {
                      in: packagingIds,
                    },
                  },
                ]
              : []),

            ...(productVariantIds.length > 0
              ? [
                  {
                    productVariantId: {
                      in: productVariantIds,
                    },
                  },
                ]
              : []),
          ],
        },

        select: {
          id: true,
          rawMaterialId: true,
          packagingId: true,
          productVariantId: true,
          quantity: true,
        },
      });

      /**
       * Index des stocks par ressource.
       */
      const rawMaterialStocks = new Map<
        string,
        (typeof stockBalances)[number]
      >();

      const packagingStocks = new Map<string, (typeof stockBalances)[number]>();

      const productVariantStocks = new Map<
        string,
        (typeof stockBalances)[number]
      >();

      for (const stock of stockBalances) {
        if (stock.rawMaterialId) {
          rawMaterialStocks.set(stock.rawMaterialId, stock);
        }

        if (stock.packagingId) {
          packagingStocks.set(stock.packagingId, stock);
        }

        if (stock.productVariantId) {
          productVariantStocks.set(stock.productVariantId, stock);
        }
      }

      /**
       * ==========================================
       * 9. VÉRIFICATION DES MATIÈRES PREMIÈRES
       * ==========================================
       *
       * On vérifie tout avant de modifier le moindre
       * stock.
       */
      for (const [rawMaterialId, requiredQuantity] of rawMaterialRequirements) {
        const stock = rawMaterialStocks.get(rawMaterialId);

        if (!stock) {
          throw new Error(`INSUFFICIENT_STOCK:0:${requiredQuantity}`);
        }

        const availableQuantity = decimalToNumber(stock.quantity);

        if (availableQuantity < requiredQuantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:${availableQuantity}:${requiredQuantity}`,
          );
        }
      }

      /**
       * ==========================================
       * 10. VÉRIFICATION DES EMBALLAGES
       * ==========================================
       */
      for (const [packagingId, requiredQuantity] of packagingRequirements) {
        const stock = packagingStocks.get(packagingId);

        if (!stock) {
          throw new Error(`INSUFFICIENT_STOCK:0:${requiredQuantity}`);
        }

        const availableQuantity = decimalToNumber(stock.quantity);

        if (availableQuantity < requiredQuantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:${availableQuantity}:${requiredQuantity}`,
          );
        }
      }

      /**
       * ==========================================
       * 11. CONSOMMATION DES MATIÈRES PREMIÈRES
       * ==========================================
       */
      for (const [rawMaterialId, requiredQuantity] of rawMaterialRequirements) {
        const stock = rawMaterialStocks.get(rawMaterialId);

        if (!stock) {
          throw new Error(`INSUFFICIENT_STOCK:0:${requiredQuantity}`);
        }

        await tx.stockBalance.update({
          where: {
            id: stock.id,
          },

          data: {
            quantity: {
              decrement: new Prisma.Decimal(requiredQuantity),
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            shopId: shop.id,

            rawMaterialId,

            type: StockMovementType.PRODUCTION_OUT,

            quantity: new Prisma.Decimal(requiredQuantity),

            reason: "Consommation de matière première pour production",

            referenceId: production.id,

            createdById: production.createdById,
          },
        });
      }

      /**
       * ==========================================
       * 12. CONSOMMATION DES EMBALLAGES
       * ==========================================
       */
      for (const [packagingId, requiredQuantity] of packagingRequirements) {
        const stock = packagingStocks.get(packagingId);

        if (!stock) {
          throw new Error(`INSUFFICIENT_STOCK:0:${requiredQuantity}`);
        }

        await tx.stockBalance.update({
          where: {
            id: stock.id,
          },

          data: {
            quantity: {
              decrement: new Prisma.Decimal(requiredQuantity),
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            shopId: shop.id,

            packagingId,

            type: StockMovementType.PRODUCTION_OUT,

            quantity: new Prisma.Decimal(requiredQuantity),

            reason: "Consommation d'emballages pour production",

            referenceId: production.id,

            createdById: production.createdById,
          },
        });
      }

      /**
       * ==========================================
       * 13. AJOUT DES PRODUITS FINIS
       * ==========================================
       */
      for (const [productVariantId, quantity] of productVariantRequirements) {
        const stock = productVariantStocks.get(productVariantId);

        /**
         * Le stock produit fini peut ne pas encore
         * exister.
         *
         * Dans ce cas, on le crée directement à la
         * quantité produite.
         */
        if (!stock) {
          await tx.stockBalance.create({
            data: {
              productVariantId,

              pointOfSaleId: null,

              quantity: new Prisma.Decimal(quantity),
            },
          });
        } else {
          await tx.stockBalance.update({
            where: {
              id: stock.id,
            },

            data: {
              quantity: {
                increment: new Prisma.Decimal(quantity),
              },
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            shopId: shop.id,

            productVariantId,

            type: StockMovementType.PRODUCTION_IN,

            quantity: new Prisma.Decimal(quantity),

            reason: "Entrée de produits finis après production",

            referenceId: production.id,

            createdById: production.createdById,
          },
        });
      }

      /**
       * ==========================================
       * 14. FINALISATION DE LA PRODUCTION
       * ==========================================
       */
      await tx.productionBatch.update({
        where: {
          id: production.id,
        },

        data: {
          status: ProductionStatus.COMPLETED,

          quantityProduced: production.quantityPlanned,

          completedAt: new Date(),
        },
      });

      /**
       * ==========================================
       * 15. RETOUR DE LA PRODUCTION COMPLÈTE
       * ==========================================
       *
       * Cette requête reste dans la transaction afin
       * que la valeur retournée corresponde exactement
       * à ce qui vient d'être validé.
       */
      const completedProduction = await tx.productionBatch.findUnique({
        where: {
          id: production.id,
        },

        include: productionInclude,
      });

      if (!completedProduction) {
        throw new Error("PRODUCTION_NOT_FOUND");
      }

      return completedProduction;
    },

    {
      /**
       * Prisma donne 5 secondes par défaut aux
       * transactions interactives.
       *
       * Vercel + Neon peut facilement dépasser ce délai.
       */
      timeout: 15000,

      /**
       * On conserve Serializable afin que deux
       * finalisations concurrentes ne puissent pas
       * produire une incohérence de stock.
       */
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};

/**
 * Annule une production.
 *
 * PLANNED → CANCELLED
 * IN_PROGRESS → CANCELLED
 *
 * Aucun stock n'est inversé car le stock
 * n'est modifié qu'au moment de COMPLETED.
 */
export const cancelProduction = async (
  id: string,
): Promise<ProductionWithRelations> => {
  const shop = await getMainShop();

  const production = await prisma.productionBatch.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
      status: true,
    },
  });

  if (!production) {
    throw new Error("PRODUCTION_NOT_FOUND");
  }

  if (production.status === ProductionStatus.COMPLETED) {
    throw new Error("COMPLETED_PRODUCTION_CANNOT_BE_CANCELLED");
  }

  if (production.status === ProductionStatus.CANCELLED) {
    throw new Error("PRODUCTION_ALREADY_CANCELLED");
  }

  if (
    production.status !== ProductionStatus.PLANNED &&
    production.status !== ProductionStatus.IN_PROGRESS
  ) {
    throw new Error("PRODUCTION_CANNOT_BE_CANCELLED");
  }

  return prisma.productionBatch.update({
    where: {
      id: production.id,
    },

    data: {
      status: ProductionStatus.CANCELLED,
    },

    include: productionInclude,
  });
};
