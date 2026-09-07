import { Prisma, BottleSize } from "@/generated/prisma/client";

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

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Récupérer la boutique unique.
 */
const getShop = async () => {
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

/**
 * Retourne le volume attendu pour un format donné.
 */
const getExpectedVolume = (size: BottleSize): number => {
  switch (size) {
    case BottleSize.ML_200:
      return 200;

    case BottleSize.ML_500:
      return 500;

    default:
      throw new Error("INVALID_BOTTLE_SIZE");
  }
};

/**
 * Vérifie que le volume correspond au format.
 */
const validateVariantVolume = (size: BottleSize, volumeMl: number): void => {
  const expectedVolume = getExpectedVolume(size);

  if (volumeMl !== expectedVolume) {
    throw new Error("INVALID_VARIANT_VOLUME");
  }
};

/**
 * Vérifie que l'emballage existe et appartient
 * à la boutique courante.
 */
const getShopPackaging = async (shopId: string, packagingId: string) => {
  const packaging = await prisma.packaging.findFirst({
    where: {
      id: packagingId,
      shopId,
    },
    select: {
      id: true,
      name: true,
      size: true,
      unit: true,
      isActive: true,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

  return packaging;
};

/**
 * ============================================================
 * CLOUDINARY - PRODUCT IMAGE
 * ============================================================
 */

/**
 * Upload une image produit sur Cloudinary.
 *
 * Toutes les images utilisent le même public_id que le produit.
 * Cela permet de remplacer l'image avec overwrite: true.
 */
const uploadProductImage = async (buffer: Buffer, productId: string) => {
  return new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "jardin-pro/products",
        public_id: productId,
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("CLOUDINARY_UPLOAD_FAILED"));
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

/**
 * Supprime l'image d'un produit sur Cloudinary.
 */
const deleteProductImage = async (productId: string) => {
  await cloudinary.uploader.destroy(`jardin-pro/products/${productId}`, {
    resource_type: "image",
  });
};

/**
 * ============================================================
 * SERIALIZATION
 * ============================================================
 */

/**
 * Convertit le Decimal Prisma `price` en number
 * avant d'envoyer la donnée au client.
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
 * Sérialise un produit et toutes ses variantes.
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
 * ============================================================
 * PRODUCTS
 * ============================================================
 */

/**
 * Récupérer tous les produits.
 */
export const getProducts = async (input: GetProductsInput = {}) => {
  const shop = await getShop();

  const products = await prisma.product.findMany({
    where: {
      shopId: shop.id,

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),

      ...(input.search
        ? {
            name: {
              contains: input.search,
              mode: "insensitive",
            },
          }
        : {}),
    },

    include: {
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

  return products.map(serializeProduct);
};

/**
 * Récupérer un produit par son ID.
 */
export const getProductById = async (id: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    include: {
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

      ingredients: {
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

  return serializeProduct(product);
};

/**
 * ============================================================
 * CREATE PRODUCT
 * ============================================================
 */

/**
 * Créer un produit.
 *
 * L'image est optionnelle.
 *
 * Le produit est d'abord créé afin d'obtenir son ID.
 * Ensuite l'image est envoyée sur Cloudinary avec cet ID
 * comme public_id.
 */
export const createProduct = async (
  input: CreateProductInput,
  image?: File,
) => {
  const shop = await getShop();

  /**
   * Vérifier que le nom n'existe pas déjà.
   */
  const existingProduct = await prisma.product.findFirst({
    where: {
      shopId: shop.id,
      name: {
        equals: input.name,
        mode: "insensitive",
      },
    },

    select: {
      id: true,
    },
  });

  if (existingProduct) {
    throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
  }

  /**
   * Créer d'abord le produit.
   */
  const product = await prisma.product.create({
    data: {
      shopId: shop.id,
      name: input.name,
      description: input.description,
    },
  });

  /**
   * Aucun fichier image.
   */
  if (!image) {
    return product;
  }

  try {
    /**
     * Convertir le File en Buffer.
     */
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    /**
     * Upload Cloudinary.
     */
    const uploadResult = await uploadProductImage(buffer, product.id);

    /**
     * Sauvegarder uniquement l'URL Cloudinary
     * dans Prisma.
     */
    const updatedProduct = await prisma.product.update({
      where: {
        id: product.id,
      },

      data: {
        image: uploadResult.secure_url,
      },
    });

    return updatedProduct;
  } catch (error) {
    /**
     * Si l'upload échoue, on supprime le produit
     * qui vient d'être créé.
     */
    await prisma.product.delete({
      where: {
        id: product.id,
      },
    });

    throw error;
  }
};

/**
 * ============================================================
 * UPDATE PRODUCT INFORMATION
 * ============================================================
 */

/**
 * Modifier les informations d'un produit.
 *
 * IMPORTANT :
 * Cette fonction ne modifie jamais l'image.
 *
 * L'image possède maintenant son propre endpoint/service.
 */
export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Vérifier l'unicité du nom.
   */
  if (input.name !== undefined) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        shopId: shop.id,

        id: {
          not: id,
        },

        name: {
          equals: input.name,
          mode: "insensitive",
        },
      },

      select: {
        id: true,
      },
    });

    if (existingProduct) {
      throw new Error("PRODUCT_NAME_ALREADY_EXISTS");
    }
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id,
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
  });

  return updatedProduct;
};

/**
 * ============================================================
 * UPDATE PRODUCT IMAGE
 * ============================================================
 */

/**
 * Remplacer l'image d'un produit.
 *
 * L'image est uploadée avec le même public_id.
 * Cloudinary remplace donc automatiquement l'ancienne.
 */
export const updateProductImage = async (id: string, image: File) => {
  const shop = await getShop();

  /**
   * Vérifier que le produit appartient à la boutique.
   */
  const product = await prisma.product.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Convertir le fichier en Buffer.
   */
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  /**
   * Upload avec overwrite.
   */
  const uploadResult = await uploadProductImage(buffer, product.id);

  /**
   * Mettre à jour uniquement l'URL.
   */
  const updatedProduct = await prisma.product.update({
    where: {
      id: product.id,
    },

    data: {
      image: uploadResult.secure_url,
    },
  });

  return updatedProduct;
};

/**
 * ============================================================
 * DELETE PRODUCT IMAGE
 * ============================================================
 */

/**
 * Supprimer l'image d'un produit.
 */
export const removeProductImage = async (id: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
      image: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Si le produit n'a pas d'image,
   * il n'y a rien à supprimer.
   */
  if (!product.image) {
    return product;
  }

  /**
   * Supprimer l'image de Cloudinary.
   */
  await deleteProductImage(product.id);

  /**
   * Supprimer l'URL de Prisma.
   */
  const updatedProduct = await prisma.product.update({
    where: {
      id: product.id,
    },

    data: {
      image: null,
    },
  });

  return updatedProduct;
};

/**
 * ============================================================
 * PRODUCT STATUS
 * ============================================================
 */

/**
 * Activer / désactiver un produit.
 */
export const updateProductStatus = async (
  id: string,
  input: UpdateProductStatusInput,
) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id,
      shopId: shop.id,
    },

    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id,
    },

    data: {
      isActive: input.isActive,
    },
  });

  return updatedProduct;
};

/**
 * ============================================================
 * PRODUCT VARIANTS
 * ============================================================
 */

/**
 * Récupérer une variante et vérifier qu'elle appartient
 * bien au produit et à la boutique.
 */
const getProductVariant = async (
  shopId: string,
  productId: string,
  variantId: string,
) => {
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      productId,

      product: {
        shopId,
      },
    },

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
        },
      },
    },
  });

  if (!variant) {
    throw new Error("PRODUCT_VARIANT_NOT_FOUND");
  }

  return variant;
};

/**
 * Récupérer une variante par son ID.
 */
export const getProductVariantById = async (
  productId: string,
  variantId: string,
) => {
  const shop = await getShop();

  const variant = await getProductVariant(shop.id, productId, variantId);

  return serializeProductVariant(variant);
};

/**
 * Ajouter une variante à un produit.
 */
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

    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Vérification du volume correspondant au format.
   *
   * ML_200 → 200 ml
   * ML_500 → 500 ml
   */
  validateVariantVolume(input.size, input.volumeMl);

  /**
   * Vérifier l'emballage.
   */
  const packaging = await getShopPackaging(shop.id, input.packagingId);

  /**
   * L'emballage doit correspondre au format.
   */
  if (packaging.size !== input.size) {
    throw new Error("PACKAGING_SIZE_MISMATCH");
  }

  /**
   * Une seule variante par format pour un produit.
   */
  const existingVariant = await prisma.productVariant.findFirst({
    where: {
      productId,
      size: input.size,
    },

    select: {
      id: true,
    },
  });

  if (existingVariant) {
    throw new Error("PRODUCT_VARIANT_ALREADY_EXISTS");
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      packagingId: packaging.id,
      size: input.size,
      volumeMl: input.volumeMl,
      price: new Prisma.Decimal(input.price),
      sku: input.sku,
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

  return serializeProductVariant(variant);
};

/**
 * Modifier une variante.
 */
export const updateProductVariant = async (
  productId: string,
  variantId: string,
  input: UpdateProductVariantInput,
) => {
  const shop = await getShop();

  const variant = await getProductVariant(shop.id, productId, variantId);

  const newSize = input.size ?? variant.size;
  const newVolumeMl = input.volumeMl ?? variant.volumeMl;
  const newPackagingId = input.packagingId ?? variant.packagingId;

  /**
   * Vérifier la cohérence format / volume.
   */
  validateVariantVolume(newSize, newVolumeMl);

  /**
   * Vérifier l'emballage.
   */
  const packaging = await getShopPackaging(shop.id, newPackagingId);

  /**
   * L'emballage doit correspondre au format.
   */
  if (packaging.size !== newSize) {
    throw new Error("PACKAGING_SIZE_MISMATCH");
  }

  /**
   * Si le format change, vérifier qu'il n'existe
   * pas déjà une autre variante avec ce format.
   */
  if (input.size !== undefined) {
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        productId,
        size: newSize,

        id: {
          not: variantId,
        },
      },

      select: {
        id: true,
      },
    });

    if (existingVariant) {
      throw new Error("PRODUCT_VARIANT_ALREADY_EXISTS");
    }
  }

  const updatedVariant = await prisma.productVariant.update({
    where: {
      id: variantId,
    },

    data: {
      ...(input.packagingId !== undefined
        ? {
            packagingId: newPackagingId,
          }
        : {}),

      ...(input.size !== undefined
        ? {
            size: newSize,
          }
        : {}),

      ...(input.volumeMl !== undefined
        ? {
            volumeMl: newVolumeMl,
          }
        : {}),

      ...(input.price !== undefined
        ? {
            price: new Prisma.Decimal(input.price),
          }
        : {}),

      ...(input.sku !== undefined
        ? {
            sku: input.sku,
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
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

  return serializeProductVariant(updatedVariant);
};

/**
 * Activer / désactiver une variante.
 */
export const updateProductVariantStatus = async (
  productId: string,
  variantId: string,
  input: UpdateProductVariantStatusInput,
) => {
  const shop = await getShop();

  await getProductVariant(shop.id, productId, variantId);

  const updatedVariant = await prisma.productVariant.update({
    where: {
      id: variantId,
    },

    data: {
      isActive: input.isActive,
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

  return serializeProductVariant(updatedVariant);
};

/**
 * Récupérer toutes les variantes d'un produit.
 */
export const getProductVariants = async (productId: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },

    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      productId,
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

    orderBy: {
      volumeMl: "asc",
    },
  });

  return variants.map(serializeProductVariant);
};
