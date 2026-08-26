import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import { updateShopLogoSchema } from "@/lib/modules/shop/shop.schema";
import { updateLogo } from "@/lib/modules/shop/shop.service";

export async function PATCH(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const body = await request.json();

    const validated = updateShopLogoSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json({ message }, { status: 400 });
    }

    const shop = await updateLogo(validated.data);

    return NextResponse.json(
      {
        message: "Logo modifié avec succès",
        shop,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          { message: "Authentication required" },
          { status: 401 },
        );
      }

      if (
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          { message: "Invalid or expired token" },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "You do not have permission to access this resource",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Boutique introuvable",
          },
          { status: 404 },
        );
      }
    }

    console.error("Update shop logo error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
