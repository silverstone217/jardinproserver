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

    const body = await request.json();

    const input = createProductSchema.parse(body);

    const product = await createProduct(input);

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
        message: "Une erreur est survenue lors de la création du produit",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
