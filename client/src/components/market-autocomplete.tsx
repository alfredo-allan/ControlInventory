'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FormControl } from '@/components/ui/form'
import { productStorage } from '@/lib/localStorage'

// Importando os dados do seu JSON diretamente
import dataFrutap from '../data/frutap.json'

// --- Tipagens explícitas para matar os erros do TS ---
interface Endereco {
  rua: string
  bairro: string
  cidade: string
  estado: string
}

interface Produto {
  codigoEAN: string
  descricao: string
}

interface Mercado {
  nome: string
  endereco: Endereco
  produtos: Produto[]
}

interface FrutapData {
  mercados: Mercado[]
}

// Fazemos um cast seguro baseado na estrutura real do arquivo
const data = dataFrutap as unknown as FrutapData

// Sugestão "achatada" pra exibir na lista: nome do mercado + endereço já
// formatado como texto único, seja ele vindo do catálogo estático ou de um
// cadastro real feito no app.
interface MercadoSugerido {
  nome: string
  enderecoFormatado: string
}

function formatarEndereco(end: Endereco): string {
  return `${end.rua}, ${end.bairro} - ${end.cidade}/${end.estado}`
}

// Junta o catálogo estático do Frutap com os mercados que o operador já
// usou em cadastros reais (productStorage) — assim a sugestão cobre tanto
// o catálogo pré-carregado quanto nomes digitados manualmente no passado,
// que é o que o usuário chama de "mercados registrados na aplicação".
function getMercadosSugeridos(): MercadoSugerido[] {
  const vistos = new Map<string, MercadoSugerido>()

  data.mercados.forEach((mercado) => {
    vistos.set(mercado.nome, {
      nome: mercado.nome,
      enderecoFormatado: formatarEndereco(mercado.endereco)
    })
  })

  productStorage.getAll().forEach((produto) => {
    if (!produto.nomeCliente || vistos.has(produto.nomeCliente)) return
    vistos.set(produto.nomeCliente, {
      nome: produto.nomeCliente,
      enderecoFormatado: produto.enderecoCliente || ''
    })
  })

  return Array.from(vistos.values())
}

export function MarketAutocomplete() {
  const [open, setOpen] = React.useState(false)
  const { setValue, watch } = useFormContext()

  // Observa o valor atual do campo nomeCliente
  const currentValue = watch('nomeCliente') || ''

  // Recalcula ao abrir o popover, pra sempre refletir os cadastros mais
  // recentes feitos no app (sem precisar recarregar a página).
  const [mercados, setMercados] = React.useState<MercadoSugerido[]>([])

  React.useEffect(() => {
    if (open) {
      setMercados(getMercadosSugeridos())
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal text-left h-10 border-input bg-background',
              !currentValue && 'text-muted-foreground'
            )}>
            {currentValue || 'Selecione ou digite o nome do mercado...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar mercado..."
            className="h-9"
            onValueChange={(search) => {
              setValue('nomeCliente', search, { shouldValidate: true })
            }}
          />
          <CommandList>
            <CommandEmpty className="py-2 px-4 text-sm text-muted-foreground">
              Nenhum mercado encontrado. Usando termo digitado.
            </CommandEmpty>
            <CommandGroup heading="Mercados sugeridos">
              {mercados.map((mercado) => (
                <CommandItem
                  key={mercado.nome}
                  value={mercado.nome}
                  onSelect={() => {
                    // 1. Define o nome do cliente
                    setValue('nomeCliente', mercado.nome, { shouldValidate: true })

                    // 2. Define o endereço já formatado (se existir)
                    if (mercado.enderecoFormatado) {
                      setValue('enderecoCliente', mercado.enderecoFormatado, { shouldValidate: true })
                    }

                    setOpen(false)
                  }}>
                  <Check className={cn('mr-2 h-4 w-4', currentValue === mercado.nome ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{mercado.nome}</span>
                    {mercado.enderecoFormatado && (
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {mercado.enderecoFormatado}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
