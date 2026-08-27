import { prisma } from "@/lib/prisma";

import type {
  CreateShopInput,
  UpdateShopInput,
  UpdateShopLogoInput,
} from "./shop.schema";

export const getShop = async () => {
  return await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });
};

export const createShop = async (input: CreateShopInput, ownerId: string) => {
  const existingShop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (existingShop) {
    throw new Error("SHOP_ALREADY_EXISTS");
  }

  return prisma.shop.create({
    data: {
      singleton: "MAIN",
      name: input.name,
      logo: "https://cjgcp7dt9x9bwv6c.public.blob.vercel-storage.com/images/logo/shop-logo.png",
      slogan: input.slogan,
      telephone: input.telephone,
      email: input.email,
      address: input.address,
      currency: input.currency ?? "CDF",
      ownerId,
    },
  });
};

// UPDATE SHOP

export const updateShop = async (data: UpdateShopInput) => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return await prisma.shop.update({
    where: {
      singleton: "MAIN",
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.logo !== undefined && {
        logo: data.logo,
      }),

      ...(data.slogan !== undefined && {
        slogan: data.slogan,
      }),

      ...(data.telephone !== undefined && {
        telephone: data.telephone,
      }),

      ...(data.email !== undefined && {
        email: data.email,
      }),

      ...(data.address !== undefined && {
        address: data.address,
      }),

      ...(data.currency !== undefined && {
        currency: data.currency,
      }),
    },
  });
};

// UPDATE LOGO
export const updateLogo = async (logo: string) => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return await prisma.shop.update({
    where: {
      singleton: "MAIN",
    },
    data: {
      logo,
    },
  });
};
