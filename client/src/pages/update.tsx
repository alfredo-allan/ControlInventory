import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Edit2, Package, Calendar, User, Barcode } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Product } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { productStorage } from "@/lib/localStorage";

export default function UpdatePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [date, setDate] = useState<Date>();

  useEffect(() => {
    setProducts(productStorage.getAll());
  }, []);

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      operatorName: "",
      eanCode: "",
      description: "",
      quantity: 1,
      quantityType: "unidade",
      expirationDate: "",
    },
  });

  const filteredProducts = products.filter((product) =>
    product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.eanCode.includes(searchTerm) ||
    product.operatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    form.reset({
      operatorName: product.operatorName,
      eanCode: product.eanCode,
      description: product.description,
      quantity: product.quantity,
      quantityType: product.quantityType,
      expirationDate: product.expirationDate,
    });
    setDate(parseISO(product.expirationDate));
  };

  const onSubmit = (data: InsertProduct) => {
    if (!selectedProduct) return;

    try {
      const updatedProduct = productStorage.update(selectedProduct.id, data);
      if (updatedProduct) {
        toast({
          title: "Produto atualizado!",
          description: `${updatedProduct.description} foi atualizado com sucesso.`,
        });
        setProducts(productStorage.getAll());
        setSelectedProduct(null);
        form.reset();
        setDate(undefined);
      } else {
        toast({
          title: "Erro ao atualizar",
          description: "Produto não encontrado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o produto. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2">
          Atualizar Produto
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Busque e atualize as informações de produtos cadastrados
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
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 sm:px-6">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-2 text-center">
              {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              {searchTerm
                ? "Tente buscar com outros termos"
                : "Registre produtos para poder atualizá-los"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg line-clamp-2">
                    {product.description}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0">
                    {product.quantityType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Barcode className="h-4 w-4 text-muted-foreground" />
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
                  variant="default"
                  size="sm"
                  className="w-full mt-4 gap-2"
                  onClick={() => handleEditClick(product)}
                  data-testid={`button-edit-${product.id}`}
                >
                  <Edit2 className="h-4 w-4" />
                  Editar Produto
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>
              Atualize as informações do produto abaixo
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="operatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Operador</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eanCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código EAN</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 7891234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Descrição do produto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unidade">Unidade</SelectItem>
                          <SelectItem value="caixa">Caixa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {date ? format(date, "PPP", { locale: ptBR }) : <span className="text-muted-foreground">Selecione a data</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={date}
                          onSelect={(newDate) => {
                            setDate(newDate);
                            field.onChange(newDate?.toISOString() || "");
                          }}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedProduct(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
