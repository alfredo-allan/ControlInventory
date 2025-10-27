import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Loader2, Package, Barcode, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { productStorage } from "@/lib/localStorage";

export default function RegisterPage() {
  const { toast } = useToast();
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [date, setDate] = useState<Date>();

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

  const fetchProductByEAN = async (ean: string) => {
    if (ean.length < 8) return;

    setIsLoadingProduct(true);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${ean}.json?fields=product_name,brands`
      );
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const productName = data.product.product_name || "";
        const brands = data.product.brands || "";
        const description = brands ? `${brands} - ${productName}` : productName;

        if (description) {
          form.setValue("description", description);
          toast({
            title: "Produto encontrado!",
            description: "Descrição preenchida automaticamente.",
          });
        } else {
          toast({
            title: "Produto não encontrado",
            description: "Digite a descrição manualmente.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Produto não encontrado",
          description: "Digite a descrição manualmente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao buscar produto",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const onSubmit = (data: InsertProduct) => {
    try {
      const savedProduct = productStorage.save(data);
      toast({
        title: "Produto registrado!",
        description: `${savedProduct.description} foi registrado com sucesso.`,
      });
      form.reset();
      setDate(undefined);
    } catch (error) {
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível salvar o produto. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Registrar Produto
        </h1>
        <p className="text-muted-foreground">
          Adicione um novo produto perecível ao sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Produto</CardTitle>
          <CardDescription>
            Preencha os dados abaixo. O código EAN buscará automaticamente a descrição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="operatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Operador</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Digite seu nome"
                          className="pl-10"
                          data-testid="input-operator-name"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="eanCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Barras (EAN)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Ex: 7891234567890"
                            className="pl-10"
                            data-testid="input-ean-code"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              fetchProductByEAN(e.target.value);
                            }}
                          />
                          {isLoadingProduct && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                          )}
                        </div>
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
                      <FormLabel>Descrição do Produto</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Será preenchido automaticamente"
                            className="pl-10"
                            data-testid="input-description"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          placeholder="1"
                          data-testid="input-quantity"
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-quantity-type">
                            <SelectValue placeholder="Selecione o tipo" />
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
                            data-testid="button-expiration-date"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {date ? (
                              format(date, "PPP", { locale: ptBR })
                            ) : (
                              <span className="text-muted-foreground">
                                Selecione a data
                              </span>
                            )}
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                data-testid="button-submit"
              >
                Registrar Produto
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
