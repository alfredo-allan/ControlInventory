// Hook que conecta a fila de sincronização (lib/syncQueue.ts) com React —
// expõe o status atual (offline / sincronizando / pendente / sincronizado),
// a lista de itens da fila, e uma função pra forçar uma sincronização manual.
// Usado pelo indicador no Header, mas pode ser consumido por qualquer tela
// que precise saber se há algo pendente de envio.

import { useCallback, useEffect, useState } from 'react'
import { assinarMudancasDaFila, listarFila, processarFila, type ItemFilaSync } from '@/lib/syncQueue'
import { puxarDoServidor } from '@/lib/pullSync'

export type StatusConexao = 'offline' | 'sincronizando' | 'pendente' | 'sincronizado'

export function useSyncStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [fila, setFila] = useState<ItemFilaSync[]>([])
  const [sincronizando, setSincronizando] = useState(false)

  const recarregarFila = useCallback(() => {
    listarFila().then(setFila)
  }, [])

  useEffect(() => {
    recarregarFila()
    const cancelarAssinatura = assinarMudancasDaFila(recarregarFila)

    const handleOnline = () => {
      setOnline(true)
      setSincronizando(true)
      processarFila().finally(() => setSincronizando(false))
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelarAssinatura()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [recarregarFila])

  const pendentes = fila.filter((item) => item.status === 'pendente')
  const comErro = fila.filter((item) => item.status === 'erro')

  const status: StatusConexao = !online
    ? 'offline'
    : sincronizando
      ? 'sincronizando'
      : pendentes.length > 0
        ? 'pendente'
        : 'sincronizado'

  // "Sincronizar agora" = empurra o que está pendente E puxa o que mudou do
  // lado de fora (outro operador, outro aparelho) — as duas metades da
  // sincronização, uma atrás da outra, sob o mesmo indicador de "sincronizando".
  const sincronizarAgora = useCallback(() => {
    setSincronizando(true)
    return processarFila()
      .then(() => puxarDoServidor().catch(() => {}))
      .finally(() => setSincronizando(false))
  }, [])

  return { online, status, fila, pendentes, comErro, sincronizarAgora }
}
