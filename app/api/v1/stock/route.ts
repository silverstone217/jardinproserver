import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  addStock,
  adjustStock,
  getStockBalances,
  removeStock,
} from "@/lib/modules/stock/stock.service";

import {
  addStockSchema,
  adjustStockSchema,
  getStockSchema,
  removeStockSchema,
} from "@/lib/modules/stock/stock.schema";

/**
 * GET /api/v1/stock
 *
 * Récupère les stocks de la boutique.
 */
export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const searchParams = request.nextUrl.searchParams;

    const pointOfSaleId = searchParams.get("pointOfSaleId") ?? undefined;

    const rawMaterialId = searchParams.get("rawMaterialId") ?? undefined;

    const packagingId = searchParams.get("packagingId") ?? undefined;

    const productVariantId = searchParams.get("productVariantId") ?? undefined;

    const lowStockOnlyParam = searchParams.get("lowStockOnly");

    let lowStockOnly: boolean | undefined;

    if (lowStockOnlyParam !== null) {
      if (lowStockOnlyParam !== "true" && lowStockOnlyParam !== "false") {
        return NextResponse.json(
          {
            message: "Le paramètre lowStockOnly est invalide",
          },
          { status: 400 },
        );
      }

      lowStockOnly = lowStockOnlyParam === "true";
    }

    const validation = getStockSchema.safeParse({
      pointOfSaleId,
      rawMaterialId,
      packagingId,
      productVariantId,
      lowStockOnly,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const stocks = await getStockBalances(validation.data);

    return NextResponse.json(
      {
        message: "Stocks récupérés avec succès",
        stocks,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/stock:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Point de vente introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le point de vente est inactif",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/stock
 *
 * Ajoute une quantité au stock.
 *
 * Cette opération modifie uniquement StockBalance.
 * La création éventuelle du StockMovement est
 * effectuée par le module métier concerné.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const validation = addStockSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const stock = await addStock(validation.data);

    return NextResponse.json(
      {
        message: "Stock ajouté avec succès",
        stock,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST /api/v1/stock:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_STOCK_ONLY_PRODUCTS") {
        return NextResponse.json(
          {
            message:
              "Seuls les produits finis peuvent être stockés dans un point de vente",
          },
          { status: 400 },
        );
      }

      if (error.message === "POINT_OF_SALE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Point de vente introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le point de vente est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_INACTIVE") {
        return NextResponse.json(
          {
            message: "La matière première est inactive",
          },
          { status: 400 },
        );
      }

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_INACTIVE") {
        return NextResponse.json(
          {
            message: "L'emballage est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Format de produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le format de produit est inactif",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/stock
 *
 * Définit directement la quantité d'un stock.
 *
 * Cette opération est destinée aux ajustements
 * d'inventaire.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const validation = adjustStockSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const stock = await adjustStock(validation.data);

    return NextResponse.json(
      {
        message: "Stock ajusté avec succès",
        stock,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/stock:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_STOCK_ONLY_PRODUCTS") {
        return NextResponse.json(
          {
            message:
              "Seuls les produits finis peuvent être stockés dans un point de vente",
          },
          { status: 400 },
        );
      }

      if (error.message === "POINT_OF_SALE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Point de vente introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le point de vente est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_INACTIVE") {
        return NextResponse.json(
          {
            message: "La matière première est inactive",
          },
          { status: 400 },
        );
      }

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_INACTIVE") {
        return NextResponse.json(
          {
            message: "L'emballage est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Format de produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le format de produit est inactif",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/stock
 *
 * Retire une quantité du stock.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const validation = removeStockSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const stock = await removeStock(validation.data);

    return NextResponse.json(
      {
        message: "Stock retiré avec succès",
        stock,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("DELETE /api/v1/stock:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_STOCK_ONLY_PRODUCTS") {
        return NextResponse.json(
          {
            message:
              "Seuls les produits finis peuvent être stockés dans un point de vente",
          },
          { status: 400 },
        );
      }

      if (error.message === "POINT_OF_SALE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Point de vente introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "POINT_OF_SALE_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le point de vente est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_INACTIVE") {
        return NextResponse.json(
          {
            message: "La matière première est inactive",
          },
          { status: 400 },
        );
      }

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_INACTIVE") {
        return NextResponse.json(
          {
            message: "L'emballage est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Format de produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Le format de produit est inactif",
          },
          { status: 400 },
        );
      }

      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const [, available, requested] = error.message.split(":");

        return NextResponse.json(
          {
            message: "Stock insuffisant",
            available: Number(available),
            requested: Number(requested),
          },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}
