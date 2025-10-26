import { type Product, type InsertProduct } from "@shared/schema";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const STORAGE_KEY = "perishable_products";
const SAO_PAULO_TZ = "America/Sao_Paulo";

export const productStorage = {
  getAll(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error loading products from localStorage:", error);
      return [];
    }
  },

  getById(id: string): Product | undefined {
    const products = this.getAll();
    return products.find((p) => p.id === id);
  },

  save(insertProduct: InsertProduct): Product {
    const products = this.getAll();
    
    const saoPauloTime = formatInTimeZone(
      new Date(),
      SAO_PAULO_TZ,
      "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
    );
    
    const newProduct: Product = {
      ...insertProduct,
      id: crypto.randomUUID(),
      registrationDate: saoPauloTime,
    };

    products.push(newProduct);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    
    return newProduct;
  },

  update(id: string, insertProduct: InsertProduct): Product | null {
    const products = this.getAll();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return null;
    }

    const updatedProduct: Product = {
      ...insertProduct,
      id,
      registrationDate: products[index].registrationDate,
    };

    products[index] = updatedProduct;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    
    return updatedProduct;
  },

  delete(id: string): boolean {
    const products = this.getAll();
    const filteredProducts = products.filter((p) => p.id !== id);

    if (filteredProducts.length === products.length) {
      return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredProducts));
    return true;
  },

  getExpiringWithinDays(days: number): Product[] {
    const products = this.getAll();
    
    const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ);
    nowInSaoPaulo.setHours(0, 0, 0, 0);
    
    return products.filter((product) => {
      const expirationDate = toZonedTime(new Date(product.expirationDate), SAO_PAULO_TZ);
      expirationDate.setHours(0, 0, 0, 0);
      
      const diffTime = expirationDate.getTime() - nowInSaoPaulo.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays <= days;
    });
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
