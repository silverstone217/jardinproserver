import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  createStaffAssignment,
  deactivateActiveStaffAssignmentByUserId,
  getActiveStaffAssignmentByUserId,
} from "@/lib/modules/employees/staff-assignment/staff-assignment.service";

import { createStaffAssignmentSchema } from "@/lib/modules/employees/staff-assignment/staff-assignment.schema";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/v1/employees/[id]/assignment
 *
 * Affecte un employé à un point de vente.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const body = await request.json();

    const validation = createStaffAssignmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    /**
     * Le userId envoyé dans le body doit correspondre
     * à l'identifiant de l'employé présent dans l'URL.
     */
    if (validation.data.userId !== id) {
      return NextResponse.json(
        {
          message:
            "L'identifiant du personnel ne correspond pas à la ressource demandée",
        },
        { status: 400 },
      );
    }

    const assignment = await createStaffAssignment({
      userId: id,
      pointOfSaleId: validation.data.pointOfSaleId,
    });

    return NextResponse.json(
      {
        message: "Personnel affecté avec succès",
        assignment,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // =========================
        // Authentification
        // =========================

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

        // =========================
        // Autorisation
        // =========================

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        // =========================
        // Personnel
        // =========================

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              code: "USER_NOT_FOUND",
              message: "Personnel introuvable",
            },
            { status: 404 },
          );

        // =========================
        // Point de vente
        // =========================

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              code: "POINT_OF_SALE_NOT_FOUND",
              message: "Point de vente introuvable",
            },
            { status: 404 },
          );

        case "POINT_OF_SALE_INACTIVE":
          return NextResponse.json(
            {
              code: "POINT_OF_SALE_INACTIVE",
              message: "Ce point de vente est désactivé",
            },
            { status: 400 },
          );

        // =========================
        // Affectation existante
        // =========================

        case "ALREADY_ASSIGNED":
          return NextResponse.json(
            {
              code: "ALREADY_ASSIGNED",
              message:
                "Ce personnel est déjà affecté à un point de vente. Veuillez d'abord le désaffecter avant de l'affecter à un autre point de vente.",
            },
            { status: 409 },
          );
      }
    }

    console.error("Erreur lors de l'affectation du personnel :", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/v1/employees/[id]/assignment
 *
 * Récupère l'affectation active d'un employé.
 *
 * Si aucune affectation active n'existe,
 * retourne 200 avec assignment: null.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const assignment = await getActiveStaffAssignmentByUserId(id);

    if (!assignment) {
      return NextResponse.json(
        {
          message: "Ce personnel n'a aucune affectation active",
          assignment: null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        message: "Affectation récupérée avec succès",
        assignment,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // =========================
        // Authentification
        // =========================

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

        // =========================
        // Autorisation
        // =========================

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        // =========================
        // Personnel
        // =========================

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              code: "USER_NOT_FOUND",
              message: "Personnel introuvable",
            },
            { status: 404 },
          );
      }
    }

    console.error("Erreur lors de la récupération de l'affectation :", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/employees/[id]/assignment
 *
 * Désaffecte l'employé de son point de vente actuel.
 *
 * L'affectation n'est pas supprimée :
 * elle passe simplement à isActive = false.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const assignment = await deactivateActiveStaffAssignmentByUserId(id);

    return NextResponse.json(
      {
        message: "Personnel désaffecté avec succès",
        assignment,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // =========================
        // Authentification
        // =========================

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

        // =========================
        // Autorisation
        // =========================

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        // =========================
        // Affectation
        // =========================

        case "ACTIVE_ASSIGNMENT_NOT_FOUND":
          return NextResponse.json(
            {
              code: "ACTIVE_ASSIGNMENT_NOT_FOUND",
              message: "Ce personnel n'a aucune affectation active",
            },
            { status: 404 },
          );
      }
    }

    console.error("Erreur lors de la désaffectation du personnel :", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
