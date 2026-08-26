import { NextRequest, NextResponse } from "next/server";

import { loginSchema } from "@/lib/modules/auth/auth.schema";
import * as authService from "@/lib/modules/auth/auth.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json({ message }, { status: 400 });
    }

    const result = await authService.login(validated.data);

    return NextResponse.json(
      {
        message: "Connexion réussie",
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        {
          message: "Numéro de téléphone ou mot de passe incorrect",
        },
        { status: 401 },
      );
    }

    console.error("Login error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
