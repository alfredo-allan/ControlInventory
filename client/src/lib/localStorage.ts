import { type Product, type InsertProduct } from "@shared/schema";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { enfileirar } from "./syncQueue";

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

    // Salvamento local já aconteceu (linha acima) — isso aqui é só pra
    // marcar que o registro também precisa ser enviado pro servidor quando
    // existir um. Nunca bloqueia nem atrasa o save local.
    void enfileirar("produto.registrar", newProduct);

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

    // Igual ao save(): o local já está salvo, isso só marca que a edição
    // também precisa ir pro servidor. Antes disso faltava — uma edição
    // feita aqui nunca saía do navegador.
    void enfileirar("produto.atualizar", updatedProduct);

    return updatedProduct;
  },

  delete(id: string): boolean {
    const products = this.getAll();
    const filteredProducts = products.filter((p) => p.id !== id);

    if (filteredProducts.length === products.length) {
      return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredProducts));

    // Mesma lógica: exclusão local já aconteceu, isso enfileira a exclusão
    // (soft delete) no servidor também — sem isso o item "ressuscitava" na
    // próxima vez que o app puxasse os dados do backend.
    void enfileirar("produto.deletar", { id });

    return true;
  },

  // Funde a lista vinda do servidor (GET /api/produtos-registrados) no
  // localStorage deste aparelho — chamado pelo pull-sync (ver pullSync.ts).
  // O servidor é a fonte de verdade pra tudo que já sincronizou (é assim
  // que um registro feito num aparelho passa a aparecer no Farejar/Listar
  // de outro); mas qualquer item só local — criado offline, já enfileirado
  // mas ainda sem confirmação do servidor — é preservado, nunca apagado só
  // porque esta leitura ainda não o viu do outro lado.
  mergeFromServer(produtosDoServidor: Product[]): void {
    const locais = this.getAll()
    const idsDoServidor = new Set(produtosDoServidor.map((p) => p.id))
    const somenteLocais = locais.filter((p) => !idsDoServidor.has(p.id))
    const combinados = [...produtosDoServidor, ...somenteLocais]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combinados))
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
