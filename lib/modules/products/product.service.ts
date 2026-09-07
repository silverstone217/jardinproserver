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

export const getProductById = async (productId: string) => {
  const shop = await getShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
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
   * Même si aucune variante n'existe encore, on retourne toujours
   * variants: [] afin que le frontend puisse utiliser la même structure.
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
     * Si l'upload échoue, on supprime le produit créé afin
     * d'éviter de garder un produit incomplet en base.
     */
    await prisma.product.delete({
      where: {
        id: product.id,
      },
    });

    throw error;
  }
};

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
   UPDATE Product Image
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
   DELETE Product Image
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
   Product Variant
============================================================ */

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
   * Un produit ne peut avoir qu'une variante par format
   * grâce à @@unique([productId, size]).
   *
   * On vérifie explicitement afin de retourner une erreur
   * métier claire.
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

  const packaging = await prisma.packaging.findFirst({
    where: {
      id: input.packagingId,
      shopId: shop.id,
    },
  });

  if (!packaging) {
    throw new Error("PACKAGING_NOT_FOUND");
  }

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
   * Si le format est modifié, vérifier qu'il n'existe
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
   * Si l'emballage ou le format change, vérifier que
   * l'emballage appartient à la boutique et correspond
   * au format choisi.
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
