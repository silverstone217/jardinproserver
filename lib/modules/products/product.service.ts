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
      /*
       * Les variantes appartiennent au produit.
       *
       * IMPORTANT :
       * Aucun ingredients ici.
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

      /*
       * On récupère uniquement le nombre d'ingrédients
       * pour la liste des produits.
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

  return products.map(serializeProduct);
};

export const getProductById = async (productId: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },

    include: {
      /*
       * ======================================================
       * VARIANTS
       * ======================================================
       *
       * Une variante possède :
       * - packaging
       * - prix
       * - volume
       * - SKU
       *
       * Elle ne possède PAS de recette.
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

      /*
       * ======================================================
       * RECIPE / INGREDIENTS
       * ======================================================
       *
       * La recette appartient directement au Product.
       */
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

  return serializeProduct(product);
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

  /*
   * Même si aucune variante n'existe encore,
   * on retourne toujours variants: [].
   */
  if (!image) {
    return {
      ...product,
      variants: [],
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
    };
  } catch (error) {
    /*
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

  /*
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

  return product;
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

  return product;
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

  return product;
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

  return product;
};

/* ============================================================
   Product Variants
============================================================ */

/**
 * Récupère toutes les variantes d'un produit.
 *
 * IMPORTANT :
 * Les ingrédients ne sont PAS récupérés ici.
 * Ils appartiennent au Product.
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

  return variants.map(serializeProductVariant);
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

      /*
       * On garde une petite référence vers le produit
       * parent, sans charger sa recette ici.
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

  return serializeProductVariant(variant);
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

  /*
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

  /*
   * Vérifier que l'emballage appartient bien
   * à la boutique.
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

  /*
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

  return serializeProductVariant(variant);
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

  /*
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

  /*
   * Si l'emballage ou le format change,
   * vérifier la cohérence entre les deux.
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

    /*
     * IMPORTANT :
     * Aucun ingredients ici.
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

  return serializeProductVariant(variant);
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

    /*
     * IMPORTANT :
     * Aucun ingredients dans ProductVariant.
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

  return serializeProductVariant(variant);
};
