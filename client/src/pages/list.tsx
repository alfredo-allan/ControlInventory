import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Package, Calendar, User, Barcode, Printer } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import type { Product } from "@shared/schema";
import { productStorage } from "@/lib/localStorage";
import { useLocation } from "wouter";

const SAO_PAULO_TZ = "America/Sao_Paulo";

export default function ListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    setProducts(productStorage.getAll());
  }, []);

  const getExpiryStatus = (expirationDate: string) => {
    const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ);
    const expiryInSaoPaulo = toZonedTime(parseISO(expirationDate), SAO_PAULO_TZ);
    const daysUntilExpiry = differenceInDays(expiryInSaoPaulo, nowInSaoPaulo);

    if (daysUntilExpiry < 0) {
      return { label: "Vencido", variant: "destructive" as const, days: daysUntilExpiry };
    } else if (daysUntilExpiry <= 3) {
      return { label: "Vence em breve", variant: "destructive" as const, days: daysUntilExpiry };
    } else if (daysUntilExpiry <= 7) {
      return { label: "Atenção", variant: "default" as const, days: daysUntilExpiry };
    } else {
      return { label: "OK", variant: "secondary" as const, days: daysUntilExpiry };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-full sm:max-w-3xl md:max-w-7xl">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-1 sm:mb-2">
            Lista de Produtos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Todos os produtos perecíveis cadastrados
          </p>
        </div>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="gap-2 mt-2 sm:mt-0 print:hidden"
          data-testid="button-print"
        >
          <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
          Imprimir Registros
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
            <Package className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-1 sm:mb-2 text-center">
              Nenhum produto cadastrado
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              Comece registrando seu primeiro produto perecível
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {products.map((product) => {
            const expiryStatus = getExpiryStatus(product.expirationDate);

            return (
              <Card key={product.id} className="hover-elevate w-full" data-testid={`card-product-${product.id}`}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                    <CardTitle className="text-base sm:text-lg line-clamp-2">
                      {product.description}
                    </CardTitle>
                    <Badge variant={expiryStatus.variant} className="shrink-0">
                      {expiryStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground">
                    <Barcode className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="font-mono">{product.eanCode}</span>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 text-sm">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <span>
                      {product.quantity} {product.quantityType}
                      {product.quantity > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>
                        Vence: {format(parseISO(product.expirationDate), "dd/MM/yyyy")}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {expiryStatus.days >= 0
                          ? `${expiryStatus.days} dia${expiryStatus.days !== 1 ? 's' : ''} restante${expiryStatus.days !== 1 ? 's' : ''}`
                          : `Vencido há ${Math.abs(expiryStatus.days)} dia${Math.abs(expiryStatus.days) !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{product.operatorName}</span>
                  </div>

                  <div className="pt-1 sm:pt-2 text-xs sm:text-sm text-muted-foreground">
                    Registrado em: {format(parseISO(product.registrationDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setLocation("/atualizar")}
                    data-testid={`button-edit-${product.id}`}
                  >
                    <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setLocation("/deletar")}
                    data-testid={`button-delete-${product.id}`}
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Excluir
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
