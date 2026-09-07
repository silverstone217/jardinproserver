import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  createProductSchema,
  getProductsSchema,
} from "@/lib/modules/products/product.schema";

import {
  createProduct,
  getProducts,
} from "@/lib/modules/products/product.service";

/**
 * ============================================================
 * IMAGE VALIDATION
 * ============================================================
 */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 Mo

/**
 * ============================================================
 * GET /api/v1/products
 * ============================================================
 */

export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentification requise",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { searchParams } = new URL(request.url);

    const rawIsActive = searchParams.get("isActive");

    const input = getProductsSchema.parse({
      search: searchParams.get("search") || undefined,

      isActive:
        rawIsActive === null
          ? undefined
          : rawIsActive === "true"
            ? true
            : rawIsActive === "false"
              ? false
              : undefined,
    });

    const products = await getProducts(input);

    return NextResponse.json(
      {
        message: "Produits récupérés avec succès",
        products,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products error:", error);

    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Accès refusé",
            code: "FORBIDDEN",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
            code: "SHOP_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "Paramètres de recherche invalides",
            code: "VALIDATION_ERROR",
            errors: error,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de la récupération des produits",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * POST /api/v1/products
 * ============================================================
 *
 * Content-Type:
 * multipart/form-data
 *
 * Fields:
 * - name
 * - description
 * - image (optionnelle)
 */

export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentification requise",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    /**
     * ========================================================
     * FORM DATA
     * ========================================================
     */

    const formData = await request.formData();

    const name = formData.get("name");
    const description = formData.get("description");
    const recipeVolumeMl = formData.get("recipeVolumeMl");
    const image = formData.get("image");

    /**
     * ========================================================
     * PRODUCT DATA
     * ========================================================
     */

    const input = createProductSchema.parse({
      name: typeof name === "string" ? name : "",

      description: typeof description === "string" ? description : undefined,

      /**
       * FormData transmet les nombres sous forme de string.
       * On convertit donc le rendement en nombre avant
       * de le transmettre au schéma Zod.
       */
      recipeVolumeMl:
        typeof recipeVolumeMl === "string" ? Number(recipeVolumeMl) : NaN,
    });

    /**
     * ========================================================
     * IMAGE
     * ========================================================
     *
     * L'image est optionnelle lors de la création.
     */

    let productImage: File | undefined;

    if (image !== null) {
      /**
       * Vérifier que c'est bien un fichier.
       */
      if (!(image instanceof File)) {
        return NextResponse.json(
          {
            message: "L'image fournie est invalide",
            code: "INVALID_IMAGE",
          },
          { status: 400 },
        );
      }

      /**
       * Vérifier le type MIME.
       */
      if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
        return NextResponse.json(
          {
            message: "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
            code: "INVALID_IMAGE_TYPE",
          },
          { status: 400 },
        );
      }

      /**
       * Vérifier la taille.
       */
      if (image.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          {
            message: "L'image ne doit pas dépasser 2 Mo.",
            code: "IMAGE_TOO_LARGE",
          },
          { status: 400 },
        );
      }

      productImage = image;
    }

    /**
     * ========================================================
     * CREATE PRODUCT
     * ========================================================
     */

    const product = await createProduct(input, productImage);

    return NextResponse.json(
      {
        message: "Produit créé avec succès",
        product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /products error:", error);

    if (error instanceof Error) {
      /**
       * ======================================================
       * AUTH
       * ======================================================
       */

      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          {
            message: "Authentification requise",
            code: "AUTHENTICATION_REQUIRED",
          },
          { status: 401 },
        );
      }

      if (
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Token invalide ou expiré",
            code: "INVALID_OR_EXPIRED_TOKEN",
          },
          { status: 401 },
        );
      }

      /**
       * ======================================================
       * PERMISSIONS
       * ======================================================
       */

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Accès refusé",
            code: "FORBIDDEN",
          },
          { status: 403 },
        );
      }

      /**
       * ======================================================
       * SHOP
       * ======================================================
       */

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
            code: "SHOP_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      /**
       * ======================================================
       * DUPLICATE PRODUCT
       * ======================================================
       */

      if (error.message === "PRODUCT_NAME_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Un produit portant ce nom existe déjà",
            code: "PRODUCT_NAME_ALREADY_EXISTS",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * VALIDATION ZOD
       * ======================================================
       */

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "Les données du produit sont invalides",
            code: "VALIDATION_ERROR",
            errors: error,
          },
          { status: 400 },
        );
      }

      /**
       * ======================================================
       * CLOUDINARY
       * ======================================================
       */

      if (error.message === "CLOUDINARY_UPLOAD_FAILED") {
        return NextResponse.json(
          {
            message: "L'image n'a pas pu être envoyée",
            code: "CLOUDINARY_UPLOAD_FAILED",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de la création du produit",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
