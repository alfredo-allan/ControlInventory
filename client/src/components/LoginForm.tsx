import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { login } from '@/lib/apiClient'
import { processarFila } from '@/lib/syncQueue'

const loginFormSchema = z.object({
  nome: z.string().min(1, 'Informe seu usuário'),
  senha: z.string().min(1, 'Informe sua senha')
})

type LoginFormValues = z.infer<typeof loginFormSchema>

// Formulário de login real, extraído de login.tsx (2026-10-13) pra ser
// reaproveitado tanto pela home animada (client/src/pages/home.tsx, que
// virou a tela de entrada do app) quanto por login.tsx — a MESMA lógica
// de autenticação/fila, só que agora num componente independente de
// layout: quem usa decide o que vem em volta (card centralizado,
// seção de uma landing, etc.).
export function LoginForm() {
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { nome: '', senha: '' }
  })

  const onSubmit = async (dados: LoginFormValues) => {
    setErro(null)
    setEntrando(true)
    try {
      await login(dados.nome, dados.senha)
      // Itens que ficaram presos na fila (ErroNaoAutenticado, enquanto
      // ninguém estava logado) tentam de novo assim que a sessão existe —
      // sem isso o operador só veria eles sincronizarem na próxima ação.
      // (O pull-sync — puxar o estado do servidor — não precisa ser disparado
      // aqui: o AuthGate em App.tsx já reage à mudança de autenticação e
      // chama puxarDoServidor() sozinho.)
      void processarFila()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.')
      setEntrando(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usuário</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="username" disabled={entrando} data-testid="input-login-nome" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="senha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  disabled={entrando}
                  data-testid="input-login-senha"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {erro && (
          <div
            className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
            data-testid="text-login-erro">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <Button type="submit" className="w-full gap-2" disabled={entrando} data-testid="button-login-entrar">
          {entrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {entrando ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </Form>
  )
}
