// Setup Rápido: guarda o operador e o mercado/cliente que o operador está
// atendendo no momento, para que o formulário de Registrar já venha
// preenchido (e mais curto) sem precisar redigitar/selecionar isso toda vez.
// Tudo em localStorage, sem backend — mesmo padrão do productStorage.

const STORAGE_KEY = "quick-setup-config"

export interface QuickSetupConfig {
  operatorName: string
  nomeCliente: string
  enderecoCliente: string
}

export const quickSetupStorage = {
  get(): QuickSetupConfig | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null

      const parsed = JSON.parse(data) as Partial<QuickSetupConfig>

      // Só considera "ativo" se operador e mercado realmente existem.
      // Sem isso, um registro corrompido/parcial derrubaria o form inteiro.
      if (!parsed.operatorName || !parsed.nomeCliente) return null

      return {
        operatorName: parsed.operatorName,
        nomeCliente: parsed.nomeCliente,
        enderecoCliente: parsed.enderecoCliente ?? "",
      }
    } catch (error) {
      console.warn("Erro ao ler o Setup Rápido:", error)
      return null
    }
  },

  save(config: QuickSetupConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },

  isActive(): boolean {
    return this.get() !== null
  },
}
