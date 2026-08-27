import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/auth";
import { updateProfileImageSchema } from "@/lib/modules/profile/profile.schema";
import * as profileService from "@/lib/modules/profile/profile.service";

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

    const validated = updateProfileImageSchema.safeParse(body);

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
    // MODIFICATION DE L'IMAGE
    // ============================================================

    // user.userId provient exclusivement du JWT
    const updatedUser = await profileService.updateProfileImage(
      user.userId,
      validated.data.image,
    );

    // ============================================================
    // RÉPONSE
    // ============================================================

    return NextResponse.json(
      {
        message: "Photo de profil modifiée avec succès",
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
    }

    console.error("Update profile image error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
