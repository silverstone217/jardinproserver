import { z } from "zod";

export const productionOutputSchema = z.object({
  productVariantId: z.string().min(1, "L'identifiant du format est requis"),

  quantity: z
    .number({ message: "La quantité doit être un nombre" })
    .int("La quantité doit être un nombre entier")
    .positive("La quantité doit être supérieure à 0"),
});

export type ProductionOutputInput = z.infer<typeof productionOutputSchema>;

export const createProductionSchema = z
  .object({
    productId: z.string().min(1, "L'identifiant du produit est requis"),

    quantityPlanned: z
      .number({ message: "La quantité planifiée doit être un nombre" })
      .int("La quantité planifiée doit être un nombre entier")
      .positive("La quantité planifiée doit être supérieure à 0"),

    outputs: z
      .array(productionOutputSchema)
      .min(1, "La production doit avoir au moins une sortie"),

    notes: z
      .string()
      .trim()
      .max(1000, "Les notes ne peuvent pas dépasser 1000 caractères")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const variantIds = data.outputs.map((output) => output.productVariantId);

    const uniqueVariantIds = new Set(variantIds);

    if (uniqueVariantIds.size !== variantIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["outputs"],
        message:
          "Un même format ne peut apparaître qu'une seule fois dans les sorties",
      });
    }
  });

export const productionActionSchema = z.object({
  id: z.string().min(1, "L'identifiant de la production est requis"),

  action: z.enum(["START", "COMPLETE", "CANCEL"], {
    message: "L'action de production est invalide",
  }),
});

export type ProductionActionInput = z.infer<typeof productionActionSchema>;

export type CreateProductionInput = z.infer<typeof createProductionSchema>;
