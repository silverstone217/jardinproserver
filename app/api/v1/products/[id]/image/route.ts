import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  removeProductImage,
  updateProductImage,
} from "@/lib/modules/products/product.service";

/**
 * ============================================================
 * CONFIGURATION IMAGE
 * ============================================================
 */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 Mo

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * PATCH /api/v1/products/:id/image
 * ============================================================
 *
 * Remplace l'image du produit.
 *
 * Content-Type:
 * multipart/form-data
 *
 * Field:
 * - image
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    /**
     * ========================================================
     * AUTHENTIFICATION
     * ========================================================
     */

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

    /**
     * ========================================================
     * AUTORISATION
     * ========================================================
     */

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    /**
     * ========================================================
     * PARAMÈTRE ID
     * ========================================================
     */

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    /**
     * ========================================================
     * FORM DATA
     * ========================================================
     */

    const formData = await request.formData();

    const image = formData.get("image");

    /**
     * ========================================================
     * VALIDATION IMAGE
     * ========================================================
     */

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          message: "L'image est requise",
          code: "IMAGE_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return NextResponse.json(
        {
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
          code: "INVALID_IMAGE_TYPE",
        },
        { status: 400 },
      );
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          message: "L'image ne doit pas dépasser 2 Mo.",
          code: "IMAGE_TOO_LARGE",
        },
        { status: 400 },
      );
    }

    /**
     * ========================================================
     * REMPLACEMENT IMAGE
     * ========================================================
     */

    const product = await updateProductImage(id, image);

    return NextResponse.json(
      {
        message: "Image du produit remplacée avec succès",
        product,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /products/:id/image error:", error);

    if (error instanceof Error) {
      /**
       * AUTH
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
       * FORBIDDEN
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
       * PRODUCT
       */
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      /**
       * CLOUDINARY
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
        message: "Une erreur est survenue lors du remplacement de l'image",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * DELETE /api/v1/products/:id/image
 * ============================================================
 *
 * Supprime l'image du produit de Cloudinary
 * et remet Product.image à null.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    /**
     * ========================================================
     * AUTHENTIFICATION
     * ========================================================
     */

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

    /**
     * ========================================================
     * AUTORISATION
     * ========================================================
     */

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    /**
     * ========================================================
     * PARAMÈTRE ID
     * ========================================================
     */

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    /**
     * ========================================================
     * SUPPRESSION IMAGE
     * ========================================================
     */

    const product = await removeProductImage(id);

    return NextResponse.json(
      {
        message: "Image du produit supprimée avec succès",
        product,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("DELETE /products/:id/image error:", error);

    if (error instanceof Error) {
      /**
       * AUTH
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
       * FORBIDDEN
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
       * PRODUCT
       */
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de la suppression de l'image",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
