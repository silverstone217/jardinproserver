import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  createRawMaterial,
  getRawMaterials,
  updateRawMaterial,
} from "@/lib/modules/raw-material/raw-material.service";

import {
  createRawMaterialSchema,
  rawMaterialIdSchema,
  updateRawMaterialSchema,
} from "@/lib/modules/raw-material/raw-material.schema";

export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const rawMaterials = await getRawMaterials();

    return NextResponse.json(
      {
        message: "Matières premières récupérées avec succès",
        rawMaterials,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/raw-material:", error);

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
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const validation = createRawMaterialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const rawMaterial = await createRawMaterial(validation.data);

    return NextResponse.json(
      {
        message: "Matière première créée avec succès",
        rawMaterial,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/v1/raw-material:", error);

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

      if (error.message === "RAW_MATERIAL_NAME_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Une matière première avec ce nom existe déjà",
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

export async function PATCH(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const idValidation = rawMaterialIdSchema.safeParse({
      id: body?.id,
    });

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "L'identifiant de la matière première est requis",
          errors: idValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const validation = updateRawMaterialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const rawMaterial = await updateRawMaterial(
      idValidation.data.id,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Matière première modifiée avec succès",
        rawMaterial,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/raw-material:", error);

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

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_NAME_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Une matière première avec ce nom existe déjà",
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
