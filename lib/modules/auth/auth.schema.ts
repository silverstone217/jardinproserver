import { z } from "zod";

export const loginSchema = z.object({
  telephone: z
    .string()
    .regex(
      /^\d{10}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres",
    ),

  password: z.string().min(1, "Le mot de passe est obligatoire"),
});

export type LoginInput = z.infer<typeof loginSchema>;
