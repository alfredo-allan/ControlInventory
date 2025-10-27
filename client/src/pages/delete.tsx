import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Package, Calendar, User, Barcode, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Product } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { productStorage } from "@/lib/localStorage";

export default function DeletePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    setProducts(productStorage.getAll());
  }, []);

  const filteredProducts = products.filter((product) =>
    product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.eanCode.includes(searchTerm) ||
    product.operatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;

    try {
      const success = productStorage.delete(productToDelete.id);
      if (success) {
        toast({
          title: "Produto excluído!",
          description: `${productToDelete.description} foi removido do sistema.`,
        });
        setProducts(productStorage.getAll());
        setProductToDelete(null);
      } else {
        toast({
          title: "Erro ao excluir",
          description: "Produto não encontrado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o produto. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Deletar Produto
        </h1>
        <p className="text-muted-foreground">
          Busque e remova produtos do sistema
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Buscar Produto</CardTitle>
          <CardDescription>
            Pesquise por descrição, código EAN ou nome do operador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite para buscar..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchTerm 
                ? "Tente buscar com outros termos" 
                : "Não há produtos para deletar"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-2">
                    {product.description}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0">
                    {product.quantityType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Barcode className="h-4 w-4" />
                  <span className="font-mono">{product.eanCode}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{product.quantity} {product.quantityType}{product.quantity > 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Vence: {format(parseISO(product.expirationDate), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{product.operatorName}</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-4 gap-2"
                  onClick={() => setProductToDelete(product)}
                  data-testid={`button-delete-${product.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Deletar Produto
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir este produto?</p>
              {productToDelete && (
                <div className="mt-4 p-3 rounded-md bg-muted space-y-1">
                  <p className="font-medium text-foreground">{productToDelete.description}</p>
                  <p className="text-sm text-muted-foreground">EAN: {productToDelete.eanCode}</p>
                  <p className="text-sm text-muted-foreground">
                    Quantidade: {productToDelete.quantity} {productToDelete.quantityType}
                    {productToDelete.quantity > 1 ? "s" : ""}
                  </p>
                </div>
              )}
              <p className="text-destructive font-medium mt-4">
                Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete"
            >
              Deletar Produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
