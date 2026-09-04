import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { updatePointOfSaleSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";
import {
  getPointOfSaleById,
  updatePointOfSale,
} from "@/lib/modules/point-of-sale/point-of-sale.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/v1/points-of-sale/:id
 *
 * Récupère un point de vente précis.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "Identifiant du point de vente requis",
        },
        { status: 400 },
      );
    }

    const pointOfSale = await getPointOfSaleById(id);

    return NextResponse.json(
      {
        pointOfSale,
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

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Point de vente introuvable",
            },
            { status: 404 },
          );
      }
    }

    console.error("Get point of sale error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/points-of-sale/:id
 *
 * Modifie les informations d'un point de vente.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "Identifiant du point de vente requis",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = updatePointOfSaleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const pointOfSale = await updatePointOfSale(id, validation.data);

    return NextResponse.json(
      {
        message: "Point de vente modifié avec succès",
        pointOfSale,
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

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Point de vente introuvable",
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

    console.error("Update point of sale error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
