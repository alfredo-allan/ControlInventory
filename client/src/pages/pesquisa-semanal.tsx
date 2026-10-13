import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, Link } from 'wouter'
import {
  ClipboardList,
  Minus,
  Plus,
  AlertTriangle,
  Info,
  PackagePlus,
  Zap,
  Search,
  Camera,
  DollarSign,
  Loader2,
  Check
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Scanner } from '@yudiel/react-qr-scanner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { cn } from '@/lib/utils'
import { quickSetupStorage } from '@/lib/quickSetup'
import {
  listarMercados,
  listarProdutos,
  encontrarMercadoPorNome,
  garantirMercado,
  cadastrarProdutoNoCatalogo,
  definirEstoqueInicial,
  definirPrecoUnitario,
  salvarPesquisaSemanal,
  getPesquisaDoCicloAtual,
  getCicloIdAtual
} from '@/lib/estoqueStorage'
import { puxarDoServidor } from '@/lib/pullSync'

const formatarPreco = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

export default function PesquisaSemanalPage() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const quickSetup = quickSetupStorage.get()

  const [mercados, setMercados] = useState(() => listarMercados())
  const [mercadoId, setMercadoId] = useState<string>('')
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [precos, setPrecos] = useState<Record<string, number>>({})
  // 'salvando' por ~350ms e depois 'salvo' por ~900ms ao perder o foco do
  // campo de preço — feedback puramente perceptual (o salvamento local em
  // si é síncrono/instantâneo), pra dar certeza visual de que o blur
  // realmente registrou o valor. A sincronização de verdade com o servidor
  // continua representada à parte, pelo indicador global no Header.
  const [statusSalvamentoPreco, setStatusSalvamentoPreco] = useState<Record<string, 'salvando' | 'salvo'>>({})
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)
  const [mostrarAdicionarProduto, setMostrarAdicionarProduto] = useState(false)
  const [novoProduto, setNovoProduto] = useState({ codigoEAN: '', descricao: '', quantidadeInicial: 0 })
  const [busca, setBusca] = useState('')
  // Incrementado sempre que a lista de produtos do mercado precisa ser
  // relida do storage (ex.: depois de cadastrar um produto novo).
  const [refreshKey, setRefreshKey] = useState(0)

  // Item que acabou de ser lido pela câmera — usado pra focar o campo de
  // quantidade dele e revelar o campo de preço só desse item (o catálogo
  // inteiro tendo input de preço visível o tempo todo ficaria poluído).
  const [itemEmFocoEAN, setItemEmFocoEAN] = useState<string | null>(null)
  const [precoVisivelEAN, setPrecoVisivelEAN] = useState<Set<string>>(new Set())
  const quantidadeInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Ao montar: se o Setup Rápido tem um mercado configurado, já usa ele —
  // criando o mercado no estoque na hora, se ainda não existir por lá.
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
      setMercados(listarMercados())
      setMercadoId(id)
    } else {
      const lista = listarMercados()
      setMercados(lista)
      if (lista.length > 0) setMercadoId(lista[0].id)
    }

    // Local-first: a seleção de mercado acima já usa o que está salvo neste
    // aparelho. Em paralelo, puxa catálogo/mercados/saldos do servidor —
    // pega mercados e produtos cadastrados por outro operador, noutro
    // aparelho — e, quando terminar, atualiza a lista de mercados e força
    // `produtos` (useMemo abaixo) a reler o storage via `refreshKey`.
    // Silencioso em erro (offline/sem sessão): segue só com o que já tinha.
    puxarDoServidor()
      .catch(() => {})
      .then(() => {
        setMercados(listarMercados())
        setRefreshKey((k) => k + 1)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produtos = useMemo(() => (mercadoId ? listarProdutos(mercadoId) : []), [mercadoId, refreshKey])

  // Sempre que troca de mercado (ou os produtos mudam), reinicia a contagem
  // com o valor esperado (estoque atual) como ponto de partida — e os preços
  // com o que já estava salvo pra esse mercado.
  useEffect(() => {
    const baseContagens: Record<string, number> = {}
    const basePrecos: Record<string, number> = {}
    produtos.forEach(({ codigoEAN, produto }) => {
      baseContagens[codigoEAN] = produto.estoque.quantidadeAtual
      if (produto.estoque.precoUnitario) basePrecos[codigoEAN] = produto.estoque.precoUnitario
    })
    setContagens(baseContagens)
    setPrecos(basePrecos)
  }, [mercadoId, produtos])

  // Troca de mercado limpa o "foco" do scanner — mas só a troca de mercado:
  // isso roda separado do efeito acima pra não apagar o item recém-escaneado
  // sempre que `produtos` mudar (ex.: logo depois de cadastrar um produto
  // novo, que também mexe em `produtos` mas não deve perder o foco).
  useEffect(() => {
    setPrecoVisivelEAN(new Set())
    setItemEmFocoEAN(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercadoId])

  const pesquisaDoCiclo = mercadoId ? getPesquisaDoCicloAtual(mercadoId) : null
  const cicloAtual = getCicloIdAtual()

  const operador = quickSetup?.operatorName ?? ''

  // Lista completa — usada na confirmação final (TODOS os itens, mesmo sem
  // ter sido tocados, pra não perder nenhuma divergência da revisão).
  const itensComDivergencia = useMemo(() => {
    return produtos.map(({ codigoEAN, produto }) => {
      const quantidadeContada = contagens[codigoEAN] ?? produto.estoque.quantidadeAtual
      const quantidadeEsperada = produto.estoque.quantidadeAtual
      const divergencia = quantidadeContada - quantidadeEsperada
      const divergenciaGrande =
        quantidadeEsperada === 0 ? quantidadeContada > 0 : Math.abs(divergencia) / Math.max(quantidadeEsperada, 1) > 0.2
      return {
        codigoEAN,
        descricao: produto.descricao,
        quantidadeEsperada,
        quantidadeContada,
        divergencia,
        divergenciaGrande,
        // Unidade já é um atributo do produto no catálogo (definido no
        // cadastro, Registrar Produto) — a contagem semanal só herda e
        // mostra, não deixa escolher de novo (senão um mesmo produto
        // podia virar "caixa" numa semana e "unidade" na outra).
        unidade: produto.unidade
      }
    })
  }, [produtos, contagens])

  // Catálogo inteiro aparece pra qualquer mercado agora (fix do travamento
  // antigo) — com a busca o operador acha o item rápido mesmo com o catálogo
  // grande, sem precisar rolar tudo.
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return itensComDivergencia
    return itensComDivergencia.filter(
      (item) => item.descricao.toLowerCase().includes(termo) || item.codigoEAN.toLowerCase().includes(termo)
    )
  }, [itensComDivergencia, busca])

  // Com o catálogo global agora tendo dezenas de itens por mercado, listar
  // TODOS na revisão final ficaria enorme pra conferir — só o que realmente
  // mudou importa aqui; o resto é resumido num contador.
  const itensAlterados = useMemo(() => itensComDivergencia.filter((item) => item.divergencia !== 0), [itensComDivergencia])
  const quantidadeInalterados = itensComDivergencia.length - itensAlterados.length

  const ajustarContagem = (codigoEAN: string, delta: number) => {
    setContagens((atual) => ({ ...atual, [codigoEAN]: Math.max(0, (atual[codigoEAN] ?? 0) + delta) }))
  }

  const revelarPreco = (codigoEAN: string) => {
    setPrecoVisivelEAN((atual) => new Set(atual).add(codigoEAN))
  }

  // Máscara de centavos: cada tecla digitada reconsidera TODOS os dígitos já
  // presentes no campo como centavos (ex.: digitar "1", "9", "5" em sequência
  // vira 0,01 → 0,19 → 1,95) — é o padrão de input de moeda mais comum em
  // apps brasileiros, evita o operador ter que digitar a vírgula na mão e
  // funciona igual em qualquer teclado (inclusive numérico de celular).
  const formatarCentavos = (valor: number) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const atualizarPreco = (codigoEAN: string, valorDigitado: string) => {
    const centavos = parseInt(valorDigitado.replace(/\D/g, ''), 10) || 0
    setPrecos((atual) => ({ ...atual, [codigoEAN]: centavos / 100 }))
  }

  const persistirPreco = (codigoEAN: string) => {
    if (!mercadoId) return
    definirPrecoUnitario(mercadoId, codigoEAN, precos[codigoEAN] ?? 0)

    setStatusSalvamentoPreco((atual) => ({ ...atual, [codigoEAN]: 'salvando' }))
    window.setTimeout(() => {
      setStatusSalvamentoPreco((atual) => ({ ...atual, [codigoEAN]: 'salvo' }))
      window.setTimeout(() => {
        setStatusSalvamentoPreco((atual) => {
          const copia = { ...atual }
          delete copia[codigoEAN]
          return copia
        })
      }, 900)
    }, 350)
  }

  // Scanner de câmera: ao ler um EAN, procura o produto no catálogo (que já
  // é global — aparece pra qualquer mercado) e foca direto no campo de
  // quantidade dele, revelando também o campo de preço pra preencher em
  // seguida. Se o EAN não existir em lugar nenhum, abre o cadastro já com o
  // código preenchido, em vez de simplesmente dizer "não encontrado".
  const handleCodigoLido = (codigoEAN: string) => {
    const encontrado = produtos.find((p) => p.codigoEAN === codigoEAN)

    if (!encontrado) {
      toast({
        title: 'Produto não encontrado no catálogo',
        description: 'Preencha a descrição pra cadastrar esse EAN agora.'
      })
      setNovoProduto((n) => ({ ...n, codigoEAN }))
      setMostrarAdicionarProduto(true)
      return
    }

    setBusca('')
    setPrecoVisivelEAN((atual) => new Set(atual).add(codigoEAN))
    setItemEmFocoEAN(codigoEAN)

    toast({ title: 'Produto encontrado!', description: encontrado.produto.descricao })
  }

  const { showScanner, setShowScanner, openScanner, handleScan, handleScanError } = useBarcodeScanner(handleCodigoLido)

  // Depois que o item escaneado aparece na lista (pode precisar de um render
  // a mais quando a busca acabou de ser limpa), rola até ele e foca a
  // quantidade — esse é o comportamento pedido: ler o EAN já deixa o
  // operador digitando a quantidade na hora.
  useEffect(() => {
    if (!itemEmFocoEAN) return
    const input = quantidadeInputRefs.current[itemEmFocoEAN]
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input.focus()
      input.select()
    }
  }, [itemEmFocoEAN, itensFiltrados])

  const handleCadastrarProduto = () => {
    if (!mercadoId || !novoProduto.codigoEAN || !novoProduto.descricao) {
      toast({ title: 'Preencha EAN e descrição', variant: 'destructive' })
      return
    }

    const codigoEAN = novoProduto.codigoEAN.trim()

    // Cadastra no catálogo GLOBAL — a partir de agora o item aparece pra
    // qualquer mercado, não só pra esse.
    cadastrarProdutoNoCatalogo(codigoEAN, novoProduto.descricao.trim())
    definirEstoqueInicial(mercadoId, codigoEAN, novoProduto.quantidadeInicial, operador || 'Operador')

    toast({ title: 'Produto cadastrado no catálogo!', description: 'Já disponível pra todos os mercados.' })
    setNovoProduto({ codigoEAN: '', descricao: '', quantidadeInicial: 0 })
    setMostrarAdicionarProduto(false)
    setMercados(listarMercados())
    setPrecoVisivelEAN((atual) => new Set(atual).add(codigoEAN))
    setItemEmFocoEAN(codigoEAN)
    setRefreshKey((k) => k + 1)
  }

  const handleFecharPesquisa = () => {
    if (!mercadoId) return

    salvarPesquisaSemanal({
      mercadoId,
      operador: operador || 'Operador',
      itens: itensComDivergencia.map((item) => ({
        codigoEAN: item.codigoEAN,
        quantidadeContada: item.quantidadeContada,
        quantityType: item.unidade
      }))
    })

    toast({
      title: 'Pesquisa semanal fechada!',
      description: `Ciclo ${cicloAtual} registrado. Confira a sugestão de pedido agora.`
    })

    setMostrarConfirmacao(false)
    setLocation('/painel-sugestao')
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
                A Pesquisa Semanal usa o operador e o mercado do Setup Rápido pra já abrir direto na contagem, sem
                pedir isso de novo.
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
          <ClipboardList className="h-7 w-7 text-primary" />
          Pesquisa Semanal
        </h1>
        <p className="text-muted-foreground">
          Conte o que está na prateleira. Ciclo atual: <span className="font-medium text-foreground">{cicloAtual}</span>
        </p>
      </div>

      {pesquisaDoCiclo && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span className="text-foreground">
            Você já fechou a pesquisa deste ciclo em{' '}
            <span className="font-medium">{format(new Date(pesquisaDoCiclo.fechadaEm), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>.
            Pode recontar e fechar de novo se precisar corrigir algo.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Contagem por produto</CardTitle>
              <CardDescription>Ajuste a quantidade real encontrada em cada item.</CardDescription>
            </div>
            <Select value={mercadoId} onValueChange={setMercadoId}>
              <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-mercado-pesquisa">
                <SelectValue placeholder="Selecione o mercado" />
              </SelectTrigger>
              <SelectContent>
                {mercados.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Escanear produto — foco da melhoria: ler o EAN já leva direto pro
              campo de quantidade do item, com o campo de preço aberto do lado. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" onClick={openScanner} className="gap-2 sm:shrink-0" data-testid="button-escanear-produto">
              <Camera className="h-4 w-4" />
              Escanear Produto
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou EAN..."
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                data-testid="input-busca-produto"
              />
            </div>
          </div>

          {itensFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {busca ? 'Nenhum produto encontrado com esse termo.' : 'Nenhum produto no catálogo ainda. Cadastre um abaixo.'}
            </p>
          )}

          {itensFiltrados.map((item) => {
            const precoAtual = precos[item.codigoEAN] ?? 0
            const precoVisivel = precoVisivelEAN.has(item.codigoEAN)

            return (
              <div
                key={item.codigoEAN}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                  item.codigoEAN === itemEmFocoEAN && 'border-primary ring-2 ring-primary/20'
                )}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.codigoEAN}</p>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  Esperado: {item.quantidadeEsperada} {item.unidade === 'caixa' ? 'cx' : 'un'}
                </div>

                {/* Stepper horizontal (-  valor  +) com botões de 36px — o
                    design anterior (setas empilhadas de 17px de altura) era
                    preciso demais pra mouse e quase impossível de acertar
                    com o dedo no mobile. Feedback do usuário (2026-10-13). */}
                <div className="flex items-stretch rounded-md border border-input bg-background shrink-0 overflow-hidden">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent"
                    onClick={() => ajustarContagem(item.codigoEAN, -1)}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="w-12 border-0 border-x border-input rounded-none text-center px-1 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={contagens[item.codigoEAN] ?? 0}
                    onChange={(e) =>
                      setContagens((atual) => ({ ...atual, [item.codigoEAN]: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                    }
                    ref={(el) => {
                      quantidadeInputRefs.current[item.codigoEAN] = el
                    }}
                    data-testid={`input-contagem-${item.codigoEAN}`}
                  />
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent"
                    onClick={() => ajustarContagem(item.codigoEAN, 1)}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Preço (R$) — fica escondido por padrão pra não poluir o catálogo
                    inteiro; aparece quando o item é escaneado ou quando o operador
                    clica pra informar manualmente. Máscara de centavos + feedback
                    de salvamento (spinner -> check) ao perder o foco. O estado
                    "fechado" usa o MESMO tamanho/alinhamento/borda do estado
                    "aberto" (antes era um botão ghost sem borda, que não parecia
                    um campo clicável — feedback do usuário, 2026-10-13). */}
                {precoVisivel ? (
                  <div className="relative shrink-0 w-28">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="pl-8 pr-7 text-right"
                      value={precos[item.codigoEAN] !== undefined ? formatarCentavos(precos[item.codigoEAN]) : ''}
                      onChange={(e) => atualizarPreco(item.codigoEAN, e.target.value)}
                      onBlur={() => persistirPreco(item.codigoEAN)}
                      data-testid={`input-preco-${item.codigoEAN}`}
                    />
                    {statusSalvamentoPreco[item.codigoEAN] === 'salvando' && (
                      <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    {statusSalvamentoPreco[item.codigoEAN] === 'salvo' && (
                      <Check className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => revelarPreco(item.codigoEAN)}
                    data-testid={`button-preco-${item.codigoEAN}`}
                    className="relative shrink-0 w-28 h-9 rounded-md border border-input bg-background px-2.5 flex items-center justify-end gap-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                    <DollarSign className="h-3.5 w-3.5 absolute left-2.5" />
                    {precoAtual > 0 ? formatarPreco(precoAtual) : 'Preço'}
                  </button>
                )}

                {item.divergenciaGrande && (
                  <Badge variant="destructive" className="self-start shrink-0 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.divergencia > 0 ? '+' : ''}
                    {item.divergencia}
                  </Badge>
                )}
              </div>
            )
          })}

          <Button type="button" variant="outline" className="gap-2" onClick={() => setMostrarAdicionarProduto(true)}>
            <PackagePlus className="h-4 w-4" />
            Cadastrar produto novo no catálogo
          </Button>
        </CardContent>
      </Card>

      <Button
        className="w-full mt-6 gap-2"
        size="lg"
        disabled={produtos.length === 0}
        onClick={() => setMostrarConfirmacao(true)}
        data-testid="button-revisar-pesquisa">
        Revisar e Fechar Pesquisa
      </Button>

      {/* Confirmação com as divergências antes de fechar de verdade */}
      <Dialog open={mostrarConfirmacao} onOpenChange={setMostrarConfirmacao}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar pesquisa</DialogTitle>
            <DialogDescription>Revise as divergências antes de fechar o ciclo {cicloAtual}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {itensAlterados.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma contagem foi alterada do valor esperado.</p>
            )}
            {itensAlterados.map((item) => (
              <div key={item.codigoEAN} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <span className="text-foreground truncate pr-2">{item.descricao}</span>
                <span className={item.divergenciaGrande ? 'text-destructive font-medium shrink-0' : 'text-muted-foreground shrink-0'}>
                  {item.quantidadeEsperada} → {item.quantidadeContada} ({item.divergencia > 0 ? '+' : ''}
                  {item.divergencia})
                </span>
              </div>
            ))}
          </div>
          {quantidadeInalterados > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {quantidadeInalterados} produto{quantidadeInalterados > 1 ? 's' : ''} sem alteração não {quantidadeInalterados > 1 ? 'aparecem' : 'aparece'} aqui, mas{' '}
              {quantidadeInalterados > 1 ? 'serão' : 'será'} salvo{quantidadeInalterados > 1 ? 's' : ''} normalmente.
            </p>
          )}
          <Button onClick={handleFecharPesquisa} className="w-full" data-testid="button-confirmar-pesquisa">
            Confirmar e Fechar Pesquisa
          </Button>
        </DialogContent>
      </Dialog>

      {/* Cadastrar produto novo no catálogo global — fica disponível pra todos os mercados */}
      <Dialog open={mostrarAdicionarProduto} onOpenChange={setMostrarAdicionarProduto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar produto novo</DialogTitle>
            <DialogDescription>
              Só use isso pra um item que ainda não existe em nenhum mercado. Produtos já cadastrados aparecem
              automaticamente na busca acima, em qualquer mercado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Código EAN"
              value={novoProduto.codigoEAN}
              onChange={(e) => setNovoProduto((n) => ({ ...n, codigoEAN: e.target.value }))}
            />
            <Input
              placeholder="Descrição do produto"
              value={novoProduto.descricao}
              onChange={(e) => setNovoProduto((n) => ({ ...n, descricao: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              placeholder="Quantidade atual neste mercado"
              value={novoProduto.quantidadeInicial}
              onChange={(e) => setNovoProduto((n) => ({ ...n, quantidadeInicial: parseInt(e.target.value, 10) || 0 }))}
            />
            <Button onClick={handleCadastrarProduto} className="w-full">
              Cadastrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner da câmera — ler o EAN já foca a quantidade do item na lista
          (ou abre o cadastro, se o produto ainda não existir em lugar nenhum). */}
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
