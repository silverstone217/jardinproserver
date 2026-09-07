import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { cloudinary } from "@/lib/cloudinary";

import type {
  CreateProductInput,
  CreateProductVariantInput,
  GetProductsInput,
  UpdateProductInput,
  UpdateProductStatusInput,
  UpdateProductVariantInput,
  UpdateProductVariantStatusInput,
} from "./product.schema";

/* ============================================================
   Helpers
============================================================ */

/**
 * Sérialise une variante Prisma afin de convertir Decimal -> number.
 */
const serializeProductVariant = <
  T extends {
    price: Prisma.Decimal;
  },
>(
  variant: T,
) => ({
  ...variant,
  price: Number(variant.price),
});

/**
 * Sérialise un produit et ses variantes.
 */
const serializeProduct = <
  T extends {
    variants: Array<{
      price: Prisma.Decimal;
    }>;
  },
>(
  product: T,
) => ({
  ...product,
  variants: product.variants.map(serializeProductVariant),
});

/**
 * Récupère le stock central des variantes.
 *
 * IMPORTANT :
 * - Le stock des produits finis est stocké dans StockBalance.
 * - Le stock central correspond à pointOfSaleId = null.
 * - On utilise groupBy car StockBalance ne possède actuellement
 *   aucune contrainte unique sur productVariantId + pointOfSaleId.
 * - Si plusieurs lignes existent pour une même variante,
 *   leurs quantités sont additionnées.
 *
 * Retour :
 * Map<productVariantId, stockTotal>
 */
const getCentralVariantStocks = async (variantIds: string[]) => {
  if (variantIds.length === 0) {
    return new Map<string, number>();
  }

  const stocks = await prisma.stockBalance.groupBy({
    by: ["productVariantId"],
    where: {
      productVariantId: {
        in: variantIds,
      },
      pointOfSaleId: null,
    },
    _sum: {
      quantity: true,
    },
  });

  return new Map(
    stocks
      .filter((stock) => stock.productVariantId !== null)
      .map((stock) => [
        stock.productVariantId!,
        Number(stock._sum.quantity ?? 0),
      ]),
  );
};

/**
 * Ajoute le stock central à chaque variante et calcule
 * le stock total du produit.
 */
const serializeProductWithStock = async <
  T extends {
    variants: Array<{
      id: string;
      price: Prisma.Decimal;
    }>;
  },
>(
  product: T,
) => {
  const variantIds = product.variants.map((variant) => variant.id);

  const centralStocks = await getCentralVariantStocks(variantIds);

  const variants = product.variants.map((variant) => ({
    ...serializeProductVariant(variant),
    stock: centralStocks.get(variant.id) ?? 0,
  }));

  const totalStock = variants.reduce(
    (total, variant) => total + variant.stock,
    0,
  );

  return {
    ...product,
    variants,
    totalStock,
  };
};

/* ============================================================
   Shop
============================================================ */

const getShop = async () => {
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

/* ============================================================
   Cloudinary
============================================================ */

const PRODUCT_IMAGE_FOLDER = "jardin-pro/products";

const uploadProductImage = async (buffer: Buffer, productId: string) => {
  return new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: PRODUCT_IMAGE_FOLDER,
        public_id: productId,
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("PRODUCT_IMAGE_UPLOAD_FAILED"));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

const deleteProductImageFromCloudinary = async (productId: string) => {
  try {
    await cloudinary.uploader.destroy(`${PRODUCT_IMAGE_FOLDER}/${productId}`, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Failed to delete product image from Cloudinary:", error);
  }
};

/* ============================================================
   Product
============================================================ */

/**
 * Récupère tous les produits de la boutique.
 *
 * Le résultat contient :
 * - les variantes
 * - les compteurs
 * - totalStock = stock central cumulé de toutes les variantes
 *
 * Aucun stock de point de vente n'est inclus dans totalStock.
 */
export const getProducts = async (input: GetProductsInput = {}) => {
  const shop = await getShop();

  const products = await prisma.product.findMany({
    where: {
      shopId: shop.id,

      ...(input.search
        ? {
            name: {
              contains: input.search,
              mode: "insensitive",
            },
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
    },

    include: {
      /**
       * Les variantes appartiennent au produit.
       *
       * IMPORTANT :
       * Aucun ingredient ici.
       * Les ingrédients appartiennent directement à Product.
       */
      variants: {
        orderBy: {
          volumeMl: "asc",
        },

        include: {
          packaging: {
            select: {
              id: true,
              name: true,
              size: true,
              unit: true,
            },
          },
        },
      },

      /**
       * Compteurs utilisés dans la liste des produits.
       */
      _count: {
        select: {
          ingredients: true,
          productions: true,
          orderItems: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  /**
   * On récupère tous les IDs de variantes en une seule fois.
   * Cela évite complètement le problème N+1.
   */
  const variantIds = products.flatMap((product) =>
    product.variants.map((variant) => variant.id),
  );

  const centralStocks = await getCentralVariantStocks(variantIds);

  /**
   * Le stock total d'un produit est la somme du stock
   * central de toutes ses variantes.
   *
   * Exemple :
   *
   * 200 ml -> 45
   * 500 ml -> 28
   *
   * totalStock -> 73
   */
  return products.map((product) => {
    const serializedProduct = serializeProduct(product);

    const totalStock = product.variants.reduce((total, variant) => {
      return total + (centralStocks.get(variant.id) ?? 0);
    }, 0);

    return {
      ...serializedProduct,
      totalStock,
    };
  });
};

/**
 * Récupère un produit avec :
 * - ses variantes
 * - ses ingrédients
 * - totalStock
 * - stock de chaque variante
 */
export const getProductById = async (productId: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },

    include: {
      /* ======================================================
         VARIANTS
      ====================================================== */

      variants: {
        orderBy: {
          volumeMl: "asc",
        },

        include: {
          packaging: {
            select: {
              id: true,
              name: true,
              size: true,
              unit: true,
            },
          },
        },
      },

      /* ======================================================
         RECIPE / INGREDIENTS
      ====================================================== */

      ingredients: {
        orderBy: {
          createdAt: "asc",
        },

        include: {
          rawMaterial: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
        },
      },

      _count: {
        select: {
          ingredients: true,
          productions: true,
          orderItems: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Récupération du stock central de toutes les variantes
   * en une seule requête.
   */
  const variantIds = product.variants.map((variant) => variant.id);

  const centralStocks = await getCentralVariantStocks(variantIds);

  /**
   * Ajout du stock à chaque variante.
   */
  const variants = product.variants.map((variant) => ({
    ...serializeProductVariant(variant),

    stock: centralStocks.get(variant.id) ?? 0,
  }));

  /**
   * Calcul du stock total du produit.
   */
  const totalStock = variants.reduce(
    (total, variant) => total + variant.stock,
    0,
  );

  return {
    ...product,

    totalStock,

    variants,
  };
};

/* ============================================================
   Create Product
============================================================ */

export const createProduct = async (
  input: CreateProductInput,
  image?: File,
) => {
  const shop = await getShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      shopId: shop.id,

      name: {
        equals: input.name,
        mode: "insensitive",
      },
    },
  });

  if (existingProduct) {
    throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
  }

  const product = await prisma.product.create({
    data: {
      shopId: shop.id,
      name: input.name,
      description: input.description,
    },
  });

  /**
   * Même si aucune variante n'existe encore,
   * on retourne toujours variants: [].
   */
  if (!image) {
    return {
      ...product,
      variants: [],
      totalStock: 0,
    };
  }

  try {
    const arrayBuffer = await image.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadProductImage(buffer, product.id);

    const updatedProduct = await prisma.product.update({
      where: {
        id: product.id,
      },

      data: {
        image: uploadResult.secure_url,
      },
    });

    return {
      ...updatedProduct,
      variants: [],
      totalStock: 0,
    };
  } catch (error) {
    /**
     * Si l'upload échoue, on supprime le produit
     * afin d'éviter de garder un produit incomplet.
     */
    await prisma.product.delete({
      where: {
        id: product.id,
      },
    });

    throw error;
  }
};

/* ============================================================
   Update Product
============================================================ */

export const updateProduct = async (
  productId: string,
  input: UpdateProductInput,
) => {
  const shop = await getShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Vérification du nom uniquement si celui-ci change.
   */
  if (
    input.name !== undefined &&
    input.name.toLowerCase() !== existingProduct.name.toLowerCase()
  ) {
    const duplicateProduct = await prisma.product.findFirst({
      where: {
        shopId: shop.id,

        name: {
          equals: input.name,
          mode: "insensitive",
        },

        NOT: {
          id: productId,
        },
      },
    });

    if (duplicateProduct) {
      throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
    }
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      ...(input.name !== undefined
        ? {
            name: input.name,
          }
        : {}),

      ...(input.description !== undefined
        ? {
            description: input.description,
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
    },

    include: {
      variants: {
        include: {
          packaging: true,
        },
      },
    },
  });

  /**
   * On calcule également totalStock afin que la réponse
   * soit cohérente avec GET /products.
   */
  return serializeProductWithStock(product);
};

/* ============================================================
   Update Product Status
============================================================ */

export const updateProductStatus = async (
  productId: string,
  input: UpdateProductStatusInput,
) => {
  const shop = await getShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      isActive: input.isActive,
    },

    include: {
      variants: {
        include: {
          packaging: true,
        },
      },
    },
  });

  return serializeProductWithStock(product);
};

/* ============================================================
   Update Product Image
============================================================ */

export const updateProductImage = async (productId: string, image: File) => {
  const shop = await getShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const arrayBuffer = await image.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadProductImage(buffer, productId);

  const product = await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      image: uploadResult.secure_url,
    },

    include: {
      variants: {
        include: {
          packaging: true,
        },
      },
    },
  });

  return serializeProductWithStock(product);
};

/* ============================================================
   Delete Product Image
============================================================ */

export const removeProductImage = async (productId: string) => {
  const shop = await getShop();

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  if (existingProduct.image) {
    await deleteProductImageFromCloudinary(productId);
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      image: null,
    },

    include: {
      variants: {
        include: {
          packaging: true,
        },
      },
    },
  });

  return serializeProductWithStock(product);
};

/* ============================================================
   Product Variants
============================================================ */

/**
 * Récupère toutes les variantes d'un produit.
 *
 * Chaque variante contient maintenant :
 * - ses informations habituelles
 * - ses compteurs
 * - son stock central
 */
export const getProductVariants = async (productId: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      productId,
    },

    orderBy: {
      volumeMl: "asc",
    },

    include: {
      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          unit: true,
        },
      },

      _count: {
        select: {
          stock: true,
          movements: true,
          productions: true,
          distributionItems: true,
          orderItems: true,
        },
      },
    },
  });

  /**
   * Une seule requête pour récupérer les stocks
   * de toutes les variantes.
   */
  const variantIds = variants.map((variant) => variant.id);

  const centralStocks = await getCentralVariantStocks(variantIds);

  return variants.map((variant) => ({
    ...serializeProductVariant(variant),

    stock: centralStocks.get(variant.id) ?? 0,
  }));
};

/* ============================================================
   Get Product Variant By ID
============================================================ */

export const getProductVariantById = async (
  productId: string,
  variantId: string,
) => {
  const shop = await getShop();

  const variant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      productId,

      product: {
        shopId: shop.id,
      },
    },

    include: {
      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          unit: true,
        },
      },

      /**
       * Petite référence vers le produit parent.
       *
       * Aucun chargement de recette ici.
       */
      product: {
        select: {
          id: true,
          name: true,
          shopId: true,
        },
      },

      _count: {
        select: {
          stock: true,
          movements: true,
          productions: true,
          distributionItems: true,
          orderItems: true,
        },
      },
    },
  });

  if (!variant) {
    throw new Error("PRODUCT_VARIANT_NOT_FOUND");
  }

  /**
   * Récupère uniquement le stock central
   * de cette variante.
   */
  const centralStocks = await getCentralVariantStocks([variant.id]);

  return {
    ...serializeProductVariant(variant),

    stock: centralStocks.get(variant.id) ?? 0,
  };
};

/* ============================================================
   Create Product Variant
============================================================ */

export const createProductVariant = async (
  productId: string,
  input: CreateProductVariantInput,
) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Une seule variante par format pour un produit.
   *
   * Contrainte Prisma :
   * @@unique([productId, size])
   */
  const existingVariant = await prisma.productVariant.findUnique({
    where: {
      productId_size: {
        productId,
        size: input.size,
      },
    },
  });

  if (existingVariant) {
    throw new Error("PRODUCT_VARIANT_ALREADY_EXISTS");
  }

  /**
   * Vérifier que l'emballage appartient
   * bien à la boutique.
   */
  const packaging = await prisma.packaging.findFirst({
    where: {
      id: input.packagingId,
      shopId: shop.id,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  /**
   * L'emballage doit correspondre au format
   * de la variante.
   */
  if (packaging.size !== input.size) {
    throw new Error("PACKAGING_SIZE_MISMATCH");
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      packagingId: input.packagingId,
      size: input.size,
      volumeMl: input.volumeMl,
      price: input.price,
      sku: input.sku?.trim() || null,
    },

    include: {
      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          unit: true,
        },
      },
    },
  });

  return {
    ...serializeProductVariant(variant),

    /**
     * Une nouvelle variante n'a normalement encore
     * aucun stock.
     */
    stock: 0,
  };
};

/* ============================================================
   Update Product Variant
============================================================ */

export const updateProductVariant = async (
  productId: string,
  variantId: string,
  input: UpdateProductVariantInput,
) => {
  const shop = await getShop();

  const existingVariant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      productId,

      product: {
        shopId: shop.id,
      },
    },
  });

  if (!existingVariant) {
    throw new Error("PRODUCT_VARIANT_NOT_FOUND");
  }

  /**
   * Si le format change, vérifier qu'il n'existe
   * pas déjà une autre variante avec ce format.
   */
  if (input.size !== undefined && input.size !== existingVariant.size) {
    const duplicateVariant = await prisma.productVariant.findUnique({
      where: {
        productId_size: {
          productId,
          size: input.size,
        },
      },
    });

    if (duplicateVariant && duplicateVariant.id !== variantId) {
      throw new Error("PRODUCT_VARIANT_ALREADY_EXISTS");
    }
  }

  /**
   * Si l'emballage ou le format change,
   * vérifier leur cohérence.
   */
  const nextPackagingId = input.packagingId ?? existingVariant.packagingId;

  const nextSize = input.size ?? existingVariant.size;

  if (input.packagingId !== undefined || input.size !== undefined) {
    const packaging = await prisma.packaging.findFirst({
      where: {
        id: nextPackagingId,
        shopId: shop.id,
      },
    });

    if (!packaging) {
      throw new Error("PACKAGING_NOT_FOUND");
    }

    if (packaging.size !== nextSize) {
      throw new Error("PACKAGING_SIZE_MISMATCH");
    }
  }

  const variant = await prisma.productVariant.update({
    where: {
      id: variantId,
    },

    data: {
      ...(input.packagingId !== undefined
        ? {
            packagingId: input.packagingId,
          }
        : {}),

      ...(input.size !== undefined
        ? {
            size: input.size,
          }
        : {}),

      ...(input.volumeMl !== undefined
        ? {
            volumeMl: input.volumeMl,
          }
        : {}),

      ...(input.price !== undefined
        ? {
            price: input.price,
          }
        : {}),

      ...(input.sku !== undefined
        ? {
            sku: input.sku?.trim() || null,
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
    },

    /**
     * IMPORTANT :
     * Aucun ingredient ici.
     *
     * ProductVariant n'a pas cette relation.
     */
    include: {
      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          unit: true,
        },
      },
    },
  });

  /**
   * Le stock n'est pas modifié lors de la modification
   * des informations de la variante.
   *
   * On le récupère simplement pour garder une réponse
   * cohérente avec les autres endpoints.
   */
  const centralStocks = await getCentralVariantStocks([variant.id]);

  return {
    ...serializeProductVariant(variant),

    stock: centralStocks.get(variant.id) ?? 0,
  };
};

/* ============================================================
   Update Product Variant Status
============================================================ */

export const updateProductVariantStatus = async (
  productId: string,
  variantId: string,
  input: UpdateProductVariantStatusInput,
) => {
  const shop = await getShop();

  const existingVariant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      productId,

      product: {
        shopId: shop.id,
      },
    },
  });

  if (!existingVariant) {
    throw new Error("PRODUCT_VARIANT_NOT_FOUND");
  }

  const variant = await prisma.productVariant.update({
    where: {
      id: variantId,
    },

    data: {
      isActive: input.isActive,
    },

    /**
     * IMPORTANT :
     * Aucun ingredient dans ProductVariant.
     */
    include: {
      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          unit: true,
        },
      },
    },
  });

  const centralStocks = await getCentralVariantStocks([variant.id]);

  return {
    ...serializeProductVariant(variant),

    stock: centralStocks.get(variant.id) ?? 0,
  };
};
