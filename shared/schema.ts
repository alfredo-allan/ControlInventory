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
  imageUrl: z.string().optional(), // URL da imagem do produto

  // Cliente/Mercado atendido nesse registro — agora fazem parte da entidade
  // principal, e não só do formulário, para aparecerem em list.tsx e afins.
  nomeCliente: z.string().min(1, "O nome do mercado/cliente é obrigatório"),
  enderecoCliente: z.string().min(1, "O endereço é obrigatório"),
});

export const insertProductSchema = productSchema.omit({
  id: true,
  registrationDate: true,
});

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Open Food Facts API response type
export interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
}

export interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

// Tipo para o cache de imagens
export interface ImageCache {
  url: string;
  timestamp: number;
  ean: string;
}

// productFormSchema agora é idêntico ao insertProductSchema, já que
// nomeCliente/enderecoCliente vieram para a entidade principal. Mantido
// como alias separado para não quebrar os imports existentes no formulário.
export const productFormSchema = insertProductSchema;
export type ProductFormValues = z.infer<typeof productFormSchema>;
