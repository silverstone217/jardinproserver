import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/auth";
import { changePasswordSchema } from "@/lib/modules/security/security.schema";
import { changePassword } from "@/lib/modules/security/security.service";

export async function PATCH(request: NextRequest) {
  try {
    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    const { userId } = authenticate(request);

    // ============================================================
    // BODY
    // ============================================================

    const body = await request.json();

    // ============================================================
    // VALIDATION
    // ============================================================

    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: result.error.issues[0]?.message ?? "Données invalides.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // CHANGEMENT DU MOT DE PASSE
    // ============================================================

    await changePassword(userId, result.data);

    // ============================================================
    // SUCCESS
    // ============================================================

    return NextResponse.json(
      {
        message: "Votre mot de passe a été modifié avec succès.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Change password error:", error);

    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    if (error instanceof Error) {
      switch (error.message) {
        case "AUTHENTICATION_REQUIRED":
        case "INVALID_AUTHORIZATION_HEADER":
        case "INVALID_OR_EXPIRED_TOKEN":
        case "INVALID_TOKEN":
          return NextResponse.json(
            {
              message: "Votre session est invalide ou a expiré.",
            },
            { status: 401 },
          );

        // ========================================================
        // ERREURS SERVICE
        // ========================================================

        case "Utilisateur introuvable.":
          return NextResponse.json(
            {
              message: error.message,
            },
            { status: 404 },
          );

        case "Le mot de passe actuel est incorrect.":
          return NextResponse.json(
            {
              message: error.message,
            },
            { status: 401 },
          );
      }
    }

    // ============================================================
    // ERREUR INATTENDUE
    // ============================================================

    return NextResponse.json(
      {
        message: "Impossible de modifier le mot de passe.",
      },
      { status: 500 },
    );
  }
}
