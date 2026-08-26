import { prisma } from "@/lib/prisma.js";
import type {
  CreateShopInput,
  UpdateShopInput,
  UpdateShopLogoInput,
} from "./shop.schema.js";

export const getShop = async () => {
  return await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });
};

export const createShop = async (data: CreateShopInput) => {
  const existingShop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (existingShop) {
    throw new Error("SHOP_ALREADY_EXISTS");
  }

  return await prisma.shop.create({
    data: {
      singleton: "MAIN",
      name: data.name,
      telephone: data.telephone,
      address: data.address,
      currency: data.currency,

      ...(data.logo !== undefined && {
        logo: data.logo,
      }),

      ...(data.slogan !== undefined && {
        slogan: data.slogan,
      }),

      ...(data.email !== undefined && {
        email: data.email,
      }),
    },
  });
};

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

export const updateLogo = async (data: UpdateShopLogoInput) => {
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
      logo: data.logo,
    },
  });
};
