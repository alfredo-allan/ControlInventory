import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dog, Package, Calendar, User, Barcode, Loader2, AlertCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import type { Product } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { productStorage } from "@/lib/localStorage";

const SAO_PAULO_TZ = "America/Sao_Paulo";

export default function FarejarPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProducts, setScannedProducts] = useState<Product[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    setHasScanned(false);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const expiringProducts = productStorage.getExpiringWithinDays(3);

    setScannedProducts(expiringProducts);
    setIsScanning(false);
    setHasScanned(true);
  };

  useEffect(() => {
    handleScan();
  }, []);

  const getUrgencyLevel = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) {
      return { label: "Vencido", variant: "destructive" as const, color: "text-destructive" };
    } else if (daysUntilExpiry === 0) {
      return { label: "Vence hoje", variant: "destructive" as const, color: "text-destructive" };
    } else if (daysUntilExpiry === 1) {
      return { label: "Vence amanhã", variant: "destructive" as const, color: "text-destructive" };
    } else {
      return { label: `${daysUntilExpiry} dias`, variant: "default" as const, color: "text-foreground" };
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Dog className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-semibold text-foreground">
            Farejar Vencimentos
          </h1>
        </div>
        <p className="text-muted-foreground">
          Produtos perecíveis com vencimento em até 3 dias
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Varredura de Vencimentos</AlertTitle>
        <AlertDescription>
          Esta página mostra todos os produtos que vencem em até 3 dias ou já venceram.
          Tome as ações necessárias para evitar perdas.
        </AlertDescription>
      </Alert>

      <div className="mb-6 flex justify-center">
        <Button
          onClick={handleScan}
          disabled={isScanning}
          size="lg"
          className="gap-2"
          data-testid="button-scan"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Farejando...
            </>
          ) : (
            <>
              <Dog className="h-5 w-5" />
              Farejar Novamente
            </>
          )}
        </Button>
      </div>

      {isScanning ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Dog className="h-16 w-16 text-primary mb-4 animate-pulse" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              Farejando produtos...
            </h3>
            <p className="text-muted-foreground text-center">
              Verificando produtos com vencimento próximo
            </p>
          </CardContent>
        </Card>
      ) : hasScanned && scannedProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Dog className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              Nenhum produto em alerta
            </h3>
            <p className="text-muted-foreground text-center">
              Não há produtos vencendo nos próximos 3 dias
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {scannedProducts.length} produto{scannedProducts.length !== 1 ? "s" : ""} encontrado
              {scannedProducts.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scannedProducts.map((product) => {
              const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ);
              const expiryInSaoPaulo = toZonedTime(parseISO(product.expirationDate), SAO_PAULO_TZ);
              const daysUntilExpiry = differenceInDays(expiryInSaoPaulo, nowInSaoPaulo);
              const urgency = getUrgencyLevel(daysUntilExpiry);

              return (
                <Card
                  key={product.id}
                  className="hover-elevate border-l-4 border-l-destructive"
                  data-testid={`card-expiring-${product.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-2">
                        {product.description}
                      </CardTitle>
                      <Badge variant={urgency.variant} className="shrink-0">
                        {urgency.label}
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
                        <span className={urgency.color}>
                          Vencimento: {format(parseISO(product.expirationDate), "dd/MM/yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {daysUntilExpiry >= 0
                            ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}`
                            : `Vencido há ${Math.abs(daysUntilExpiry)} dia${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''}`
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
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
