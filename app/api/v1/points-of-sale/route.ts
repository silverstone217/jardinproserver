import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { createPointOfSaleSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";
import {
  createPointOfSale,
  getPointOfSales,
} from "@/lib/modules/point-of-sale/point-of-sale.service";

/**
 * GET /api/v1/points-of-sale
 *
 * Récupère tous les points de vente de la boutique.
 */
export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const pointsOfSale = await getPointOfSales();

    return NextResponse.json(
      {
        pointsOfSale,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "AUTHENTICATION_REQUIRED":
        case "INVALID_AUTHORIZATION_HEADER":
        case "INVALID_TOKEN":
        case "INVALID_OR_EXPIRED_TOKEN":
          return NextResponse.json(
            {
              message: "Session invalide ou expirée",
            },
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Aucune boutique n'a été configurée",
            },
            { status: 404 },
          );
      }
    }

    console.error("Get points of sale error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/points-of-sale
 *
 * Crée un nouveau point de vente.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const body = await request.json();

    const validation = createPointOfSaleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const pointOfSale = await createPointOfSale(validation.data);

    return NextResponse.json(
      {
        message: "Point de vente créé avec succès",
        pointOfSale,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "AUTHENTICATION_REQUIRED":
        case "INVALID_AUTHORIZATION_HEADER":
        case "INVALID_TOKEN":
        case "INVALID_OR_EXPIRED_TOKEN":
          return NextResponse.json(
            {
              message: "Session invalide ou expirée",
            },
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Aucune boutique n'a été configurée",
            },
            { status: 404 },
          );

        case "CODE_ALREADY_EXISTS":
          return NextResponse.json(
            {
              message: "Un point de vente avec ce code existe déjà",
            },
            { status: 409 },
          );
      }
    }

    console.error("Create point of sale error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
