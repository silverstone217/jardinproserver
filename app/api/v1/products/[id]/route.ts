import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import { updateProductSchema } from "@/lib/modules/products/product.schema";

import {
  getProductById,
  updateProduct,
} from "@/lib/modules/products/product.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * GET /api/v1/products/:id
 * ============================================================
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
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

    const product = await getProductById(id);

    return NextResponse.json(
      {
        message: "Produit récupéré avec succès",
        product,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products/:id error:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Authentification invalide",
            code: error.message,
          },
          { status: 401 },
        );
      }

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
        message: "Une erreur est survenue lors de la récupération du produit",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * PATCH /api/v1/products/:id
 * ============================================================
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

    const body = await request.json();

    const input = updateProductSchema.parse(body);

    const product = await updateProduct(id, input);

    return NextResponse.json(
      {
        message: "Produit modifié avec succès",
        product,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /products/:id error:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Authentification invalide",
            code: error.message,
          },
          { status: 401 },
        );
      }

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

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NAME_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Un produit portant ce nom existe déjà",
            code: "PRODUCT_NAME_ALREADY_EXISTS",
          },
          { status: 409 },
        );
      }

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
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de la modification du produit",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
