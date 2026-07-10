import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dog, Package, Calendar, User, Barcode, Loader2, AlertCircle, Store, MapPin, Edit2 } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import type { Product } from '@shared/schema'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { productStorage } from '@/lib/localStorage'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { insertProductSchema, type InsertProduct } from '@shared/schema'
import { useToast } from '@/hooks/use-toast'
import { MarketAutocomplete } from '@/components/market-autocomplete'

const SAO_PAULO_TZ = 'America/Sao_Paulo'

export default function FarejarPage() {
  const { toast } = useToast()
  const [isScanning, setIsScanning] = useState(false)
  const [scannedProducts, setScannedProducts] = useState<Product[]>([])
  const [hasScanned, setHasScanned] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editDate, setEditDate] = useState<Date>()

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      operatorName: '',
      eanCode: '',
      description: '',
      quantity: 1,
      quantityType: 'unidade',
      expirationDate: '',
      nomeCliente: '',
      enderecoCliente: ''
    }
  })

  const handleScan = async () => {
    setIsScanning(true)
    setHasScanned(false)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const expiringProducts = productStorage.getExpiringWithinDays(3)

    setScannedProducts(expiringProducts)
    setIsScanning(false)
    setHasScanned(true)
  }

  useEffect(() => {
    handleScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Abre o modal de edição já preenchido com os dados do produto clicado
  const handleEditClick = (product: Product) => {
    setSelectedProduct(product)
    form.reset({
      operatorName: product.operatorName,
      eanCode: product.eanCode,
      description: product.description,
      quantity: product.quantity,
      quantityType: product.quantityType,
      expirationDate: product.expirationDate,
      nomeCliente: product.nomeCliente ?? '',
      enderecoCliente: product.enderecoCliente ?? ''
    })
    setEditDate(parseISO(product.expirationDate))
  }

  // Salva a edição e refaz a varredura, já que uma data de vencimento
  // alterada pode fazer o produto sair (ou entrar) da lista de alerta
  const onEditSubmit = (data: InsertProduct) => {
    if (!selectedProduct) return

    try {
      const updatedProduct = productStorage.update(selectedProduct.id, data)
      if (updatedProduct) {
        toast({
          title: 'Produto atualizado!',
          description: `${updatedProduct.description} foi atualizado com sucesso.`
        })
        setSelectedProduct(null)
        form.reset()
        setEditDate(undefined)
        handleScan()
      } else {
        toast({
          title: 'Erro ao atualizar',
          description: 'Produto não encontrado.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o produto. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const getUrgencyLevel = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) {
      return { label: 'Vencido', variant: 'destructive' as const, color: 'text-destructive' }
    } else if (daysUntilExpiry === 0) {
      return { label: 'Vence hoje', variant: 'destructive' as const, color: 'text-destructive' }
    } else if (daysUntilExpiry === 1) {
      return { label: 'Vence amanhã', variant: 'destructive' as const, color: 'text-destructive' }
    } else {
      return { label: `${daysUntilExpiry} dias`, variant: 'default' as const, color: 'text-foreground' }
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-full sm:max-w-3xl md:max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <Dog className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Farejar Vencimentos</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">Produtos perecíveis com vencimento em até 3 dias</p>
      </div>

      <Alert className="mb-4 sm:mb-6">
        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
        <AlertTitle className="text-sm sm:text-base">Varredura de Vencimentos</AlertTitle>
        <AlertDescription className="text-xs sm:text-sm">
          Esta página mostra todos os produtos que vencem em até 3 dias ou já venceram. Tome as ações necessárias para evitar perdas.
        </AlertDescription>
      </Alert>

      <div className="mb-4 sm:mb-6 flex justify-center">
        <Button onClick={handleScan} disabled={isScanning} size="lg" className="gap-2" data-testid="button-scan">
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
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
            <Dog className="h-16 w-16 text-primary mb-3 sm:mb-4 animate-pulse" />
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-1 sm:mb-2 text-center">Farejando produtos...</h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center">Verificando produtos com vencimento próximo</p>
          </CardContent>
        </Card>
      ) : hasScanned && scannedProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
            <Dog className="h-16 w-16 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-1 sm:mb-2 text-center">Nenhum produto em alerta</h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center">Não há produtos vencendo nos próximos 3 dias</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-3 sm:mb-4">
            <p className="text-sm sm:text-base text-muted-foreground">
              {scannedProducts.length} produto{scannedProducts.length !== 1 ? 's' : ''} encontrado{scannedProducts.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {scannedProducts.map((product) => {
              const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ)
              const expiryInSaoPaulo = toZonedTime(parseISO(product.expirationDate), SAO_PAULO_TZ)
              const daysUntilExpiry = differenceInDays(expiryInSaoPaulo, nowInSaoPaulo)
              const urgency = getUrgencyLevel(daysUntilExpiry)

              return (
                <Card
                  key={product.id}
                  className="hover-elevate w-full border-l-4 border-l-destructive"
                  data-testid={`card-expiring-${product.id}`}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                      <CardTitle className="text-base sm:text-lg line-clamp-2">{product.description}</CardTitle>
                      <Badge variant={urgency.variant} className="shrink-0">
                        {urgency.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                    <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                      <Store className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      <span className="text-foreground line-clamp-1">{product.nomeCliente || 'Cliente não informado'}</span>
                    </div>

                    <div className="flex items-start gap-1 sm:gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm line-clamp-2">{product.enderecoCliente || 'Endereço não informado'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground">
                      <Barcode className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="font-mono">{product.eanCode}</span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 text-sm">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      <span>
                        {product.quantity} {product.quantityType}
                        {product.quantity > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className={urgency.color}>Vencimento: {format(parseISO(product.expirationDate), 'dd/MM/yyyy')}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {daysUntilExpiry >= 0
                            ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}`
                            : `Vencido há ${Math.abs(daysUntilExpiry)} dia${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''}`}
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

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 gap-2"
                      onClick={() => handleEditClick(product)}
                      data-testid={`button-edit-${product.id}`}>
                      <Edit2 className="h-4 w-4" />
                      Editar Produto
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de edição embutido — não depende de navegar pra outra página */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Atualize as informações do produto abaixo</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
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

              <FormField
                control={form.control}
                name="nomeCliente"
                render={() => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Nome do Cliente / Mercado</FormLabel>
                    <MarketAutocomplete />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enderecoCliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Preenchido automaticamente ao selecionar o mercado" {...field} className="bg-muted/30" />
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
                        <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
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
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            {editDate ? (
                              format(editDate, 'PPP', { locale: ptBR })
                            ) : (
                              <span className="text-muted-foreground">Selecione a data</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={editDate}
                          onSelect={(newDate) => {
                            setEditDate(newDate)
                            field.onChange(newDate?.toISOString() || '')
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
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedProduct(null)}>
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
  )
}
