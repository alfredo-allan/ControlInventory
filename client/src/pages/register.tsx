import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar,
  Loader2,
  Package,
  Barcode,
  User,
  Camera,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { productStorage } from "@/lib/localStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function RegisterPage() {
  const { toast } = useToast();
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [date, setDate] = useState<Date>();
  const [showScanner, setShowScanner] = useState(false);
  const [productImage, setProductImage] = useState<string>("");
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<
    boolean | null
  >(null);
  const hasCheckedPermission = useRef(false);

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      operatorName: "",
      eanCode: "",
      description: "",
      quantity: 1,
      quantityType: "unidade",
      expirationDate: "",
      imageUrl: "",
    },
  });

  // Carregar permissão do cache ao montar
  useEffect(() => {
    const cachedPermission = localStorage.getItem("camera-permission");
    if (cachedPermission) {
      setCameraPermissionGranted(cachedPermission === "granted");
      hasCheckedPermission.current = true;
    }
  }, []);

  // Cache de imagens no localStorage
  const getCachedImage = (ean: string): string | null => {
    try {
      const cached = localStorage.getItem(`product-image-${ean}`);
      if (cached) {
        const { url, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000) {
          return url;
        }
      }
    } catch (error) {
      console.warn("Erro ao acessar cache de imagem:", error);
    }
    return null;
  };

  const setCachedImage = (ean: string, url: string) => {
    try {
      localStorage.setItem(
        `product-image-${ean}`,
        JSON.stringify({
          url,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn("Erro ao salvar cache de imagem:", error);
    }
  };

  // Buscar produto com imagem da API
  const fetchProductByEAN = async (ean: string) => {
    if (ean.length < 8) return;

    setIsLoadingProduct(true);

    const cachedImage = getCachedImage(ean);
    if (cachedImage) {
      setProductImage(cachedImage);
      form.setValue("imageUrl", cachedImage);
    }

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${ean}.json?fields=product_name,brands,image_url,image_front_url,image_front_small_url`
      );
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const productName = data.product.product_name || "";
        const brands = data.product.brands || "";
        const description = brands ? `${brands} - ${productName}` : productName;

        const imageUrl =
          data.product.image_url ||
          data.product.image_front_url ||
          data.product.image_front_small_url ||
          "";

        if (description) {
          form.setValue("description", description);

          if (imageUrl) {
            setProductImage(imageUrl);
            form.setValue("imageUrl", imageUrl);
            setCachedImage(ean, imageUrl);

            toast({
              title: "Produto encontrado!",
              description: "Descrição e imagem carregadas automaticamente.",
            });
          } else {
            toast({
              title: "Produto encontrado!",
              description: "Descrição preenchida automaticamente.",
            });
          }
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

  // Verificar e solicitar permissões da câmera
  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      console.log("🎥 Solicitando permissão da câmera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      // Fechar stream após teste
      stream.getTracks().forEach((track) => track.stop());

      console.log("✅ Permissão concedida!");

      // Salvar no cache
      localStorage.setItem("camera-permission", "granted");
      setCameraPermissionGranted(true);
      hasCheckedPermission.current = true;

      return true;
    } catch (error: any) {
      console.error("❌ Erro ao solicitar permissão:", error);

      // Salvar rejeição no cache
      localStorage.setItem("camera-permission", "denied");
      setCameraPermissionGranted(false);
      hasCheckedPermission.current = true;

      // Mensagem específica baseada no erro
      let errorMessage = "Não foi possível acessar a câmera.";

      if (error.name === "NotAllowedError") {
        errorMessage =
          "Permissão negada. Permita o acesso à câmera nas configurações.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "Nenhuma câmera encontrada no dispositivo.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Câmera já está em uso por outro aplicativo.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage =
          "Câmera traseira não disponível. Tentando câmera frontal...";
      }

      toast({
        title: "Erro na câmera",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    }
  };

  // Processar código escaneado
  const handleScan = (result: any) => {
    if (!result || !result[0]?.rawValue) return;

    const code = result[0].rawValue;
    const cleanEAN = code.replace(/\D/g, "");

    if (cleanEAN.length >= 8) {
      form.setValue("eanCode", cleanEAN);
      fetchProductByEAN(cleanEAN);
      setShowScanner(false);

      toast({
        title: "Código lido com sucesso!",
        description: `EAN: ${cleanEAN}`,
      });
    } else {
      toast({
        title: "Código inválido",
        description: "O código escaneado não é um EAN válido.",
        variant: "destructive",
      });
    }
  };

  // Abrir scanner com verificação/solicitação de permissões
  const handleOpenScanner = async () => {
    // Se já temos a permissão em cache e foi concedida
    if (hasCheckedPermission.current && cameraPermissionGranted) {
      console.log("📸 Permissão já concedida (cache)");
      setShowScanner(true);
      return;
    }

    // Se foi negada anteriormente, tentar novamente
    if (hasCheckedPermission.current && cameraPermissionGranted === false) {
      toast({
        title: "Permissão necessária",
        description: "Solicitando acesso à câmera novamente...",
      });
    }

    // Solicitar permissão
    const granted = await requestCameraPermission();

    if (granted) {
      setShowScanner(true);
    }
  };

  // Limpar cache de permissão (útil para debug)
  const resetCameraPermission = () => {
    localStorage.removeItem("camera-permission");
    setCameraPermissionGranted(null);
    hasCheckedPermission.current = false;
    toast({
      title: "Cache limpo",
      description: "A permissão será solicitada novamente.",
    });
  };

  // Limpar imagem do produto
  const clearProductImage = () => {
    setProductImage("");
    form.setValue("imageUrl", "");
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
      setProductImage("");
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
            Preencha os dados abaixo. Escaneie o código de barras para
            preenchimento automático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Nome do Operador */}
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

              {/* Código EAN com Scanner */}
              <FormField
                control={form.control}
                name="eanCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Barras (EAN)</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
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
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleOpenScanner}
                          className="shrink-0"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Grid: Descrição + Imagem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Descrição do Produto */}
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

                {/* Preview da Imagem */}
                <div className="space-y-2">
                  <FormLabel>Imagem do Produto</FormLabel>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 flex items-center justify-center min-h-[120px]">
                    {productImage ? (
                      <div className="relative group">
                        <img
                          src={productImage}
                          alt="Preview do produto"
                          className="max-h-24 max-w-full object-contain rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={clearProductImage}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Imagem aparecerá aqui</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantidade e Tipo */}
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
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
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

              {/* Data de Vencimento */}
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

              {/* Botão Registrar */}
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

      {/* Dialog do Scanner */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Escanear Código de Barras</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="w-full rounded-lg overflow-hidden bg-black">
              {showScanner && (
                <Scanner
                  onScan={handleScan}
                  onError={(error: any) => {
                    console.error("Erro detalhado no scanner:", error);
                    setShowScanner(false);

                    const errorMsg =
                      error?.message ||
                      error?.toString() ||
                      "Erro desconhecido";

                    toast({
                      title: "Erro na câmera",
                      description: errorMsg,
                      variant: "destructive",
                    });
                  }}
                  constraints={{
                    facingMode: "environment",
                  }}
                  formats={[
                    "ean_13",
                    "ean_8",
                    "code_128",
                    "code_39",
                    "upc_a",
                    "upc_e",
                  ]}
                  components={{
                    finder: true,
                    torch: true,
                  }}
                  styles={{
                    container: {
                      width: "100%",
                      height: "400px",
                    },
                  }}
                />
              )}
            </div>
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setShowScanner(false)}>
                Fechar Scanner
              </Button>
              <p className="text-sm text-muted-foreground">
                Aponte para o código de barras
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
