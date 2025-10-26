import { z } from "zod";

// Product schema for perishable items
export const productSchema = z.object({
  id: z.string(),
  operatorName: z.string().min(1, "Nome do operador é obrigatório"),
  eanCode: z.string().min(8, "Código EAN deve ter pelo menos 8 dígitos"),
  description: z.string().min(1, "Descrição é obrigatória"),
  quantity: z.number().min(1, "Quantidade deve ser pelo menos 1"),
  quantityType: z.enum(["unidade", "caixa"]),
  expirationDate: z.string(), // ISO date string
  registrationDate: z.string(), // ISO date string in São Paulo timezone
});

export const insertProductSchema = productSchema.omit({ id: true, registrationDate: true });

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Open Food Facts API response type
export interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
}

export interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}
