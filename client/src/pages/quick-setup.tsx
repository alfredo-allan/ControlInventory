import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation } from 'wouter'
import { User, Zap, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { MarketAutocomplete } from '@/components/market-autocomplete'
import { quickSetupStorage, type QuickSetupConfig } from '@/lib/quickSetup'

// Mesmo padrão de validação do productFormSchema para esses três campos —
// se passou aqui, passa lá na hora de ir escondido no form de Registrar.
const quickSetupFormSchema = z.object({
  operatorName: z.string().min(1, 'Nome do operador é obrigatório'),
  nomeCliente: z.string().min(1, 'O nome do mercado/cliente é obrigatório'),
  enderecoCliente: z.string().min(1, 'O endereço é obrigatório'),
})

type QuickSetupFormValues = z.infer<typeof quickSetupFormSchema>

export default function QuickSetupPage() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const [activeConfig, setActiveConfig] = useState<QuickSetupConfig | null>(() => quickSetupStorage.get())

  const form = useForm<QuickSetupFormValues>({
    resolver: zodResolver(quickSetupFormSchema),
    defaultValues: activeConfig ?? {
      operatorName: '',
      nomeCliente: '',
      enderecoCliente: ''
    }
  })

  const onSubmit = (data: QuickSetupFormValues) => {
    quickSetupStorage.save(data)
    setActiveConfig(data)

    toast({
      title: 'Setup Rápido salvo!',
      description: `Operador "${data.operatorName}" e mercado "${data.nomeCliente}" já vêm preenchidos no formulário de Registrar.`
    })

    setLocation('/')
  }

  const handleDeactivate = () => {
    quickSetupStorage.clear()
    setActiveConfig(null)
    form.reset({ operatorName: '', nomeCliente: '', enderecoCliente: '' })

    toast({
      title: 'Setup Rápido desativado',
      description: 'O formulário de Registrar volta a pedir operador e mercado normalmente.'
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" />
          Setup Rápido
        </h1>
        <p className="text-muted-foreground">
          Configure uma vez o seu nome e o mercado que você está atendendo. Enquanto o Setup Rápido
          estiver ativo, o formulário de Registrar não pede mais esses campos — fica mais curto e rápido
          de preencher.
        </p>
      </div>

      {activeConfig && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Setup Rápido ativo</p>
                  <p className="text-muted-foreground">
                    Operador: <span className="text-foreground">{activeConfig.operatorName}</span> · Mercado:{' '}
                    <span className="text-foreground">{activeConfig.nomeCliente}</span>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeactivate}
                className="gap-2 shrink-0"
                data-testid="button-quicksetup-deactivate">
                <Trash2 className="h-4 w-4" />
                Desativar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Operador e Mercado</CardTitle>
          <CardDescription>Esses dados serão usados automaticamente em todo novo registro.</CardDescription>
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
                          data-testid="input-quicksetup-operator-name"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nome do Cliente / Mercado — mesmo autocomplete do form de Registrar */}
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

              {/* Endereço do Cliente */}
              <FormField
                control={form.control}
                name="enderecoCliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço do Cliente</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Preenchido ao selecionar o mercado, ou digite manualmente"
                        data-testid="input-quicksetup-address"
                        {...field}
                        className="bg-muted/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full gap-2" size="lg" data-testid="button-quicksetup-submit">
                <Zap className="h-4 w-4" />
                Salvar Setup Rápido
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
