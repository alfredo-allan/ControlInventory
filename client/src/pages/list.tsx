import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Edit2, Trash2, Package, Calendar, User, Barcode, Download, Store, MapPin } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import type { Product } from '@shared/schema'
import { productStorage } from '@/lib/localStorage'
import { useLocation } from 'wouter'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { insertProductSchema, type InsertProduct } from '@shared/schema'
import { useToast } from '@/hooks/use-toast'
import { MarketAutocomplete } from '@/components/market-autocomplete'

const SAO_PAULO_TZ = 'America/Sao_Paulo'
const TODOS_CLIENTES = '__todos__'

// Identidade única do cliente: nome + endereço juntos.
// Evita misturar dois mercados que por acaso tenham nome parecido
// mas sejam endereços/unidades diferentes.
const getClienteKey = (product: Product) => `${product.nomeCliente ?? ''}|${product.enderecoCliente ?? ''}`

export default function ListPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<string>(TODOS_CLIENTES)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editDate, setEditDate] = useState<Date>()
  const [, setLocation] = useLocation()

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

  useEffect(() => {
    setProducts(productStorage.getAll())
  }, [])

  // Lista de clientes únicos (nome + endereço) presentes nos produtos cadastrados
  const clientesUnicos = useMemo(() => {
    const mapa = new Map<string, { key: string; nomeCliente: string; enderecoCliente: string }>()

    products.forEach((product) => {
      const key = getClienteKey(product)
      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          nomeCliente: product.nomeCliente || 'Cliente não informado',
          enderecoCliente: product.enderecoCliente || 'Endereço não informado'
        })
      }
    })

    return Array.from(mapa.values())
  }, [products])

  // Produtos filtrados pelo cliente selecionado — usados tanto na
  // exibição dos cards quanto na geração do relatório
  const filteredProducts = useMemo(() => {
    if (clienteSelecionado === TODOS_CLIENTES) return products
    return products.filter((product) => getClienteKey(product) === clienteSelecionado)
  }, [products, clienteSelecionado])

  const getExpiryStatus = (expirationDate: string) => {
    const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ)
    const expiryInSaoPaulo = toZonedTime(parseISO(expirationDate), SAO_PAULO_TZ)
    const daysUntilExpiry = differenceInDays(expiryInSaoPaulo, nowInSaoPaulo)

    if (daysUntilExpiry < 0) {
      return { label: 'Vencido', variant: 'destructive' as const, days: daysUntilExpiry }
    } else if (daysUntilExpiry <= 3) {
      return { label: 'Vence em breve', variant: 'destructive' as const, days: daysUntilExpiry }
    } else if (daysUntilExpiry <= 7) {
      return { label: 'Atenção', variant: 'default' as const, days: daysUntilExpiry }
    } else {
      return { label: 'OK', variant: 'secondary' as const, days: daysUntilExpiry }
    }
  }

  // Abreviação usada no relatório: "caixa" -> "cx", "unidade" -> "un"
  const getQuantityAbbreviation = (type: Product['quantityType']) => {
    return type === 'caixa' ? 'cx' : 'un'
  }

  // Slug simples pro nome do arquivo, a partir do nome do cliente selecionado
  const getClienteSlug = () => {
    if (clienteSelecionado === TODOS_CLIENTES) return 'todos-clientes'

    const cliente = clientesUnicos.find((c) => c.key === clienteSelecionado)
    if (!cliente) return 'cliente'

    return cliente.nomeCliente
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleDownloadList = () => {
    const blocos = filteredProducts.map((product) => {
      return [
        `Promotor : ${product.operatorName}`,
        `Cliente : ${product.nomeCliente || 'Não informado'}`,
        `Endereço :  ${product.enderecoCliente || 'Não informado'}`,
        `EAN : ${product.eanCode}`,
        `Descrição : ${product.description}`,
        `Data Vencimento : ${format(parseISO(product.expirationDate), 'dd/MM/yyyy')}`,
        `Qtd. Produtos : ${product.quantity} ${getQuantityAbbreviation(product.quantityType)}`,
        '-----------------------------'
      ].join('\n')
    })

    const conteudo = blocos.join('\n')

    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `registros-${getClienteSlug()}-${format(new Date(), 'dd-MM-yyyy-HHmm')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Abre o modal de edição já preenchido com os dados do produto clicado —
  // não navega mais pra outra página
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

  const onEditSubmit = (data: InsertProduct) => {
    if (!selectedProduct) return

    try {
      const updatedProduct = productStorage.update(selectedProduct.id, data)
      if (updatedProduct) {
        toast({
          title: 'Produto atualizado!',
          description: `${updatedProduct.description} foi atualizado com sucesso.`
        })
        setProducts(productStorage.getAll())
        setSelectedProduct(null)
        form.reset()
        setEditDate(undefined)
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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-full sm:max-w-3xl md:max-w-7xl">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-1 sm:mb-2">Lista de Produtos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Todos os produtos perecíveis cadastrados</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
            <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-cliente-filtro">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_CLIENTES}>Todos os clientes</SelectItem>
              {clientesUnicos.map((cliente) => (
                <SelectItem key={cliente.key} value={cliente.key}>
                  {cliente.nomeCliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleDownloadList}
            variant="outline"
            className="gap-2"
            data-testid="button-download-list"
            disabled={filteredProducts.length === 0}>
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            Baixar Lista
          </Button>
        </div>
      </div>

      {clienteSelecionado !== TODOS_CLIENTES && (
        <p className="mb-4 text-sm text-muted-foreground">
          Mostrando {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} de{' '}
          <span className="font-medium text-foreground">{clientesUnicos.find((c) => c.key === clienteSelecionado)?.nomeCliente}</span>
        </p>
      )}

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
            <Package className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-1 sm:mb-2 text-center">
              {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto para esse cliente'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              {products.length === 0 ? 'Comece registrando seu primeiro produto perecível' : 'Escolha outro cliente no filtro acima'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => {
            const expiryStatus = getExpiryStatus(product.expirationDate)

            return (
              <Card key={product.id} className="hover-elevate w-full" data-testid={`card-product-${product.id}`}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                    <CardTitle className="text-base sm:text-lg line-clamp-2">{product.description}</CardTitle>
                    <Badge variant={expiryStatus.variant} className="shrink-0">
                      {expiryStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                  {/* Cliente / Mercado */}
                  <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                    <Store className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span className="text-foreground font-medium line-clamp-1">{product.nomeCliente || 'Cliente não informado'}</span>
                  </div>

                  {/* Endereço do Cliente */}
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
                      <span>Vence: {format(parseISO(product.expirationDate), 'dd/MM/yyyy')}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {expiryStatus.days >= 0
                          ? `${expiryStatus.days} dia${expiryStatus.days !== 1 ? 's' : ''} restante${expiryStatus.days !== 1 ? 's' : ''}`
                          : `Vencido há ${Math.abs(expiryStatus.days)} dia${Math.abs(expiryStatus.days) !== 1 ? 's' : ''}`}
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
                <CardFooter className="flex flex-row gap-2 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleEditClick(product)}
                    data-testid={`button-edit-${product.id}`}>
                    <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setLocation('/deletar')}
                    data-testid={`button-delete-${product.id}`}>
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Excluir
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de edição embutido — não depende mais de navegar pro Farejar */}
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
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          value={Number.isNaN(field.value) ? '' : field.value}
                          onChange={(e) => {
                            const rawValue = e.target.value
                            field.onChange(rawValue === '' ? NaN : parseInt(rawValue, 10))
                          }}
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
