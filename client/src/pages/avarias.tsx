import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { PackageX, Zap, Camera, Search, FileDown, Loader2, Barcode, User, Store, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Scanner } from '@yudiel/react-qr-scanner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { quickSetupStorage } from '@/lib/quickSetup'
import {
  listarMercados,
  encontrarMercadoPorNome,
  garantirMercado,
  listarProdutos,
  listarAvarias,
  registrarAvaria,
  type RegistroAvaria
} from '@/lib/estoqueStorage'
import { puxarDoServidor } from '@/lib/pullSync'
import { baixarArquivo, ErroNaoAutenticado } from '@/lib/apiClient'

export default function AvariasPage() {
  const { toast } = useToast()
  const quickSetup = quickSetupStorage.get()
  const operador = quickSetup?.operatorName ?? ''

  const [mercadoId, setMercadoId] = useState<string>('')
  const [avarias, setAvarias] = useState<RegistroAvaria[]>([])
  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false)

  const [codigoEAN, setCodigoEAN] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [quantityType, setQuantityType] = useState<'unidade' | 'caixa'>('unidade')
  const [motivo, setMotivo] = useState('')

  // Mesmo padrão de montagem da Pesquisa Semanal: garante o mercado do Setup
  // Rápido (criando se ainda não existir neste aparelho) e, em paralelo,
  // puxa avarias/mercados do servidor — pra ver registros feitos por outro
  // operador, noutro aparelho, antes mesmo da primeira ação aqui.
  useEffect(() => {
    if (quickSetup?.nomeCliente) {
      const existenteId = encontrarMercadoPorNome(quickSetup.nomeCliente)
      const id =
        existenteId ??
        garantirMercado(quickSetup.nomeCliente, {
          rua: quickSetup.enderecoCliente || '',
          bairro: '',
          cidade: '',
          estado: ''
        })
      setMercadoId(id)
    }

    puxarDoServidor()
      .catch(() => {})
      .then(() => setAvarias(listarAvarias()))

    setAvarias(listarAvarias())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const avariasDoMercado = useMemo(
    () => avarias.filter((a) => a.mercadoId === mercadoId).sort((a, b) => b.registradoEm.localeCompare(a.registradoEm)),
    [avarias, mercadoId]
  )

  // Ao ler/digitar um EAN, procura o produto no catálogo deste mercado pra
  // preencher a descrição automaticamente — mesma ideia de
  // pesquisa-semanal.tsx, só que aqui não trava se não encontrar: o
  // operador pode descrever a avaria manualmente mesmo assim.
  const handleCodigoLido = (ean: string) => {
    setCodigoEAN(ean)
    const encontrado = listarProdutos(mercadoId).find((p) => p.codigoEAN === ean)
    if (encontrado) {
      setDescricao(encontrado.produto.descricao)
      setQuantityType(encontrado.produto.unidade)
      toast({ title: 'Produto encontrado!', description: encontrado.produto.descricao })
    } else {
      toast({
        title: 'Produto não encontrado no catálogo',
        description: 'Descreva a avaria manualmente abaixo.'
      })
    }
  }

  const { showScanner, setShowScanner, openScanner, handleScan, handleScanError } = useBarcodeScanner(handleCodigoLido)

  const limparFormulario = () => {
    setCodigoEAN('')
    setDescricao('')
    setQuantidade(1)
    setQuantityType('unidade')
    setMotivo('')
  }

  const handleRegistrarAvaria = () => {
    if (!mercadoId) return
    if (!codigoEAN.trim() || !descricao.trim()) {
      toast({ title: 'Preencha o EAN e a descrição', variant: 'destructive' })
      return
    }
    if (!quantidade || quantidade <= 0) {
      toast({ title: 'Informe uma quantidade válida', variant: 'destructive' })
      return
    }
    if (!motivo.trim()) {
      toast({ title: 'Informe o motivo da avaria/quebra', variant: 'destructive' })
      return
    }

    const registro = registrarAvaria({
      mercadoId,
      codigoEAN: codigoEAN.trim(),
      descricao: descricao.trim(),
      quantidade,
      quantityType,
      motivo: motivo.trim(),
      operador: operador || 'Operador',
      nomeCliente: quickSetup?.nomeCliente ?? '',
      enderecoCliente: quickSetup?.enderecoCliente ?? ''
    })

    if (!registro) {
      toast({ title: 'Erro ao registrar', description: 'Mercado não encontrado.', variant: 'destructive' })
      return
    }

    toast({ title: 'Avaria registrada!', description: `${registro.quantidade}x ${registro.descricao} — estoque já abatido.` })
    setAvarias(listarAvarias())
    limparFormulario()
  }

  const handleBaixarRelatorio = async () => {
    setBaixandoRelatorio(true)
    try {
      await baixarArquivo('/api/relatorios/avarias.docx', 'relatorio-avarias.docx')
    } catch (error) {
      toast({
        title: 'Erro ao baixar relatório',
        description: error instanceof ErroNaoAutenticado ? 'Sessão expirada. Faça login novamente.' : 'Verifique sua conexão e tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setBaixandoRelatorio(false)
    }
  }

  if (!quickSetup) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
            <Zap className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium text-foreground">Configure o Setup Rápido primeiro</p>
              <p className="text-sm text-muted-foreground mt-1">
                Avarias e Quebras usa o operador e o mercado do Setup Rápido pra já saber onde lançar o registro.
              </p>
            </div>
            <Link href="/setup-rapido">
              <Button className="gap-2">
                <Zap className="h-4 w-4" />
                Ir para o Setup Rápido
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <PackageX className="h-7 w-7 text-primary" />
          Avarias e Quebras
        </h1>
        <p className="text-muted-foreground">
          Registre produtos avariados ou quebrados — o estoque é abatido automaticamente.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 text-sm rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <Store className="h-4 w-4 text-primary shrink-0" />
        <span className="text-foreground truncate">
          <span className="font-medium">{quickSetup.nomeCliente}</span> · Operador: <span className="font-medium">{operador}</span>
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar avaria/quebra</CardTitle>
          <CardDescription>Escaneie o código de barras do produto ou digite manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Código EAN"
                className="pl-10"
                value={codigoEAN}
                onChange={(e) => setCodigoEAN(e.target.value)}
                onBlur={() => codigoEAN.trim() && handleCodigoLido(codigoEAN.trim())}
                data-testid="input-ean-avaria"
              />
            </div>
            <Button type="button" variant="outline" onClick={openScanner} className="gap-2 sm:shrink-0" data-testid="button-escanear-avaria">
              <Camera className="h-4 w-4" />
              Escanear
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Descrição do produto"
              className="pl-10"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              data-testid="input-descricao-avaria"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_2fr] gap-3">
            <Input
              type="number"
              min="1"
              placeholder="Quantidade"
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
              data-testid="input-quantidade-avaria"
            />
            <Select value={quantityType} onValueChange={(v) => setQuantityType(v as 'unidade' | 'caixa')}>
              <SelectTrigger data-testid="select-quantity-type-avaria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unidade">Unidade</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Motivo (ex.: avaria no transporte, embalagem rasgada...)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="col-span-2 sm:col-span-1"
              data-testid="input-motivo-avaria"
            />
          </div>

          <Button className="w-full gap-2" size="lg" onClick={handleRegistrarAvaria} data-testid="button-registrar-avaria">
            <PackageX className="h-4 w-4" />
            Registrar Avaria/Quebra
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">
          Registros deste mercado ({avariasDoMercado.length})
        </h2>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleBaixarRelatorio} disabled={baixandoRelatorio} data-testid="button-baixar-relatorio-avarias">
          {baixandoRelatorio ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Baixar relatório (.docx)
        </Button>
      </div>

      {avariasDoMercado.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <PackageX className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma avaria registrada neste mercado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {avariasDoMercado.map((a) => (
            <Card key={a.id} data-testid={`card-avaria-${a.id}`}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{a.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono">{a.codigoEAN}</p>
                </div>
                {/* self-start: sem isso, a badge herda align-items:stretch do
                    container flex-col no mobile e vira uma barra vermelha
                    esticada a largura toda — feedback do usuário (2026-10-13). */}
                <Badge variant="destructive" className="self-start shrink-0 gap-1">
                  <Trash2 className="h-3 w-3" />
                  {a.quantidade}x {a.quantityType === 'caixa' ? 'cx' : 'un'}
                </Badge>
                <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">{a.motivo}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <User className="h-3 w-3" />
                  {a.operador}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {format(parseISO(a.registradoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scanner da câmera — mesmo dialog usado em pesquisa-semanal.tsx */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Escanear Código de Barras</DialogTitle>
            <DialogDescription>Aponte a câmera para o código EAN do produto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="w-full rounded-lg overflow-hidden bg-black">
              {showScanner && (
                <Scanner
                  onScan={handleScan}
                  onError={handleScanError}
                  constraints={{ facingMode: 'environment' }}
                  formats={['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']}
                  components={{ finder: true, torch: true }}
                  styles={{ container: { width: '100%', height: '400px' } }}
                />
              )}
            </div>
            <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full">
              Fechar Scanner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
