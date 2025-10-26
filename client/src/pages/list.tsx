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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Lista de Produtos
          </h1>
          <p className="text-muted-foreground">
            Todos os produtos perecíveis cadastrados
          </p>
        </div>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="gap-2 print:hidden"
          data-testid="button-print"
        >
          <Printer className="h-4 w-4" />
          Imprimir Registros
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              Nenhum produto cadastrado
            </h3>
            <p className="text-muted-foreground text-center">
              Comece registrando seu primeiro produto perecível
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const expiryStatus = getExpiryStatus(product.expirationDate);
            
            return (
              <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">
                      {product.description}
                    </CardTitle>
                    <Badge variant={expiryStatus.variant} className="shrink-0">
                      {expiryStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Barcode className="h-4 w-4" />
                    <span className="font-mono">{product.eanCode}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {product.quantity} {product.quantityType}
                      {product.quantity > 1 && product.quantityType === "unidade" ? "s" : ""}
                      {product.quantity > 1 && product.quantityType === "caixa" ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>
                        Vence: {format(parseISO(product.expirationDate), "dd/MM/yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {expiryStatus.days >= 0 
                          ? `${expiryStatus.days} dia${expiryStatus.days !== 1 ? 's' : ''} restante${expiryStatus.days !== 1 ? 's' : ''}`
                          : `Vencido há ${Math.abs(expiryStatus.days)} dia${Math.abs(expiryStatus.days) !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{product.operatorName}</span>
                  </div>

                  <div className="pt-2 text-xs text-muted-foreground">
                    Registrado em: {format(parseISO(product.registrationDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setLocation("/atualizar")}
                    data-testid={`button-edit-${product.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setLocation("/deletar")}
                    data-testid={`button-delete-${product.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page {
            margin: 2cm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          header, .print\\:hidden {
            display: none !important;
          }

          .container {
            max-width: 100% !important;
            padding: 0 !important;
          }

          h1 {
            font-size: 24px !important;
            margin-bottom: 20px !important;
          }

          .grid {
            display: block !important;
          }

          [data-testid^="card-product-"] {
            page-break-inside: avoid;
            margin-bottom: 20px;
            border: 1px solid #000;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
