// Lógica de permissão de câmera + abertura do scanner, extraída do fluxo que
// já existia em register.tsx — reaproveitada aqui pra não duplicar os ~80
// linhas de tratamento de permissão/erro em cada tela que precisar ler EAN
// pela câmera. A tela continua responsável por renderizar o <Scanner> e o
// Dialog (cada uma pode querer um layout diferente), esse hook só cuida do
// estado: permissão, abrir/fechar, e validar o código lido.

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface ScanResult {
  rawValue: string
}

export function useBarcodeScanner(onCodigoLido: (codigoEAN: string) => void) {
  const { toast } = useToast()
  const [showScanner, setShowScanner] = useState(false)
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null)
  const hasCheckedPermission = useRef(false)

  useEffect(() => {
    const cachedPermission = localStorage.getItem('camera-permission')
    if (cachedPermission) {
      setCameraPermissionGranted(cachedPermission === 'granted')
      hasCheckedPermission.current = true
    }
  }, [])

  const requestCameraPermission = async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Câmera não disponível',
        description: 'Use HTTPS ou localhost para acessar a câmera. Você pode digitar o código manualmente.',
        variant: 'destructive'
      })
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      stream.getTracks().forEach((track) => track.stop())

      localStorage.setItem('camera-permission', 'granted')
      setCameraPermissionGranted(true)
      hasCheckedPermission.current = true
      return true
    } catch (error: any) {
      localStorage.setItem('camera-permission', 'denied')
      setCameraPermissionGranted(false)
      hasCheckedPermission.current = true

      let errorMessage = 'Não foi possível acessar a câmera.'
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Permissão negada. Permita o acesso à câmera nas configurações.'
      } else if (error?.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.'
      } else if (error?.name === 'NotReadableError') {
        errorMessage = 'Câmera já está em uso por outro aplicativo.'
      } else if (error?.name === 'NotSupportedError' || error?.name === 'TypeError') {
        errorMessage = 'Acesso à câmera requer HTTPS. Use localhost ou digite o código manualmente.'
      }

      toast({ title: 'Erro na câmera', description: errorMessage, variant: 'destructive' })
      return false
    }
  }

  const openScanner = async () => {
    if (hasCheckedPermission.current && cameraPermissionGranted) {
      setShowScanner(true)
      return
    }
    const granted = await requestCameraPermission()
    if (granted) setShowScanner(true)
  }

  const handleScan = (result: ScanResult[] | undefined) => {
    if (!result || !result[0]?.rawValue) return

    const cleanEAN = result[0].rawValue.replace(/\D/g, '')
    if (cleanEAN.length >= 8) {
      setShowScanner(false)
      onCodigoLido(cleanEAN)
    } else {
      toast({ title: 'Código inválido', description: 'O código escaneado não é um EAN válido.', variant: 'destructive' })
    }
  }

  const handleScanError = (error: any) => {
    console.error('Erro no scanner:', error)
    setShowScanner(false)
    const errorMsg = error?.message || error?.toString() || 'Erro desconhecido'
    toast({ title: 'Erro na câmera', description: errorMsg, variant: 'destructive' })
  }

  return { showScanner, setShowScanner, openScanner, handleScan, handleScanError }
}
