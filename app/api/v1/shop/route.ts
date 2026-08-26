import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { createShopSchema } from "./shop.schema";
import * as shopService from "./shop.service";

export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const body = await request.json();

    const validated = createShopSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json({ message }, { status: 400 });
    }

    const shop = await shopService.createShop(validated.data);

    return NextResponse.json(
      {
        message: "Boutique créée avec succès",
        shop,
      },
      { status: 201 },
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

      if (error.message === "SHOP_ALREADY_EXISTS") {
        return NextResponse.json(
          { message: "La boutique existe déjà" },
          { status: 409 },
        );
      }
    }

    console.error("Create shop error:", error);

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}
