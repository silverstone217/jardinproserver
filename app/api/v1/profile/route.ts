import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/auth";
import { updateProfileSchema } from "@/lib/modules/profile/profile.schema";
import * as profileService from "@/lib/modules/profile/profile.service";

/**
 * GET /api/v1/profile
 *
 * Récupère les informations actuelles du profil
 * de l'utilisateur connecté.
 */
export async function GET(request: NextRequest) {
  try {
    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    // userId et role proviennent du JWT
    const user = authenticate(request);

    // ============================================================
    // RÉCUPÉRATION DU PROFIL
    // ============================================================

    const profile = await profileService.getProfile(user.userId);

    // ============================================================
    // RÉPONSE
    // ============================================================

    return NextResponse.json(
      {
        user: profile,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      // ----------------------------------------------------------
      // Authentification
      // ----------------------------------------------------------

      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          {
            message: "Authentication required",
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
            message: "Invalid or expired token",
          },
          { status: 401 },
        );
      }

      // ----------------------------------------------------------
      // Utilisateur introuvable
      // ----------------------------------------------------------

      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Utilisateur introuvable",
          },
          { status: 404 },
        );
      }
    }

    console.error("Get profile error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/profile
 *
 * Modifier les informations du profil
 * de l'utilisateur connecté.
 */
export async function PATCH(request: NextRequest) {
  try {
    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    const user = authenticate(request);

    // ============================================================
    // VALIDATION DES DONNÉES
    // ============================================================

    const body = await request.json();

    const validated = updateProfileSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json(
        {
          message,
        },
        { status: 400 },
      );
    }

    // ============================================================
    // MODIFICATION DU PROFIL
    // ============================================================

    const updatedUser = await profileService.updateProfile(
      user.userId,
      validated.data,
    );

    // ============================================================
    // RÉPONSE
    // ============================================================

    return NextResponse.json(
      {
        message: "Profil modifié avec succès",
        user: updatedUser,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      // ----------------------------------------------------------
      // Authentification
      // ----------------------------------------------------------

      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          {
            message: "Authentication required",
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
            message: "Invalid or expired token",
          },
          { status: 401 },
        );
      }

      // ----------------------------------------------------------
      // Utilisateur introuvable
      // ----------------------------------------------------------

      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Utilisateur introuvable",
          },
          { status: 404 },
        );
      }

      // ----------------------------------------------------------
      // Email déjà utilisé
      // ----------------------------------------------------------

      if (error.message === "EMAIL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Cette adresse email est déjà utilisée",
          },
          { status: 409 },
        );
      }

      // ----------------------------------------------------------
      // Téléphone déjà utilisé
      // ----------------------------------------------------------

      if (error.message === "TELEPHONE_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Ce numéro de téléphone est déjà utilisé",
          },
          { status: 409 },
        );
      }
    }

    console.error("Update profile error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
