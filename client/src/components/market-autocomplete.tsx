'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FormControl } from '@/components/ui/form'

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

export function MarketAutocomplete() {
  const [open, setOpen] = React.useState(false)
  const { setValue, watch } = useFormContext()

  // Observa o valor atual do campo nomeCliente
  const currentValue = watch('nomeCliente') || ''

  // Lista de mercados vinda com tipo Mercado[] garantido
  const mercados = data.mercados

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
            {currentValue ? mercados.find((m: Mercado) => m.nome === currentValue)?.nome : 'Selecione ou digite o nome do mercado...'}
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
            <CommandGroup heading="Sugestões do Sistema">
              {mercados.map((mercado: Mercado) => (
                <CommandItem
                  key={mercado.nome}
                  value={mercado.nome}
                  onSelect={() => {
                    // 1. Define o nome do cliente
                    setValue('nomeCliente', mercado.nome, { shouldValidate: true })

                    // 2. Formata e define o endereço completo de forma automatizada
                    const end = mercado.endereco
                    const enderecoFormatado = `${end.rua}, ${end.bairro} - ${end.cidade}/${end.estado}`
                    setValue('enderecoCliente', enderecoFormatado, { shouldValidate: true })

                    setOpen(false)
                  }}>
                  <Check className={cn('mr-2 h-4 w-4', currentValue === mercado.nome ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{mercado.nome}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {mercado.endereco.rua}, {mercado.endereco.bairro}
                    </span>
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
