'use client'

import { useState, useCallback } from 'react'

import { SendResult } from '@/lib/gateway/client'

interface UseOpenClawSendResult {
  loading: boolean
  error: string | null
  lastResult: SendResult | null
  sendToAgent: (sessionKey: string, message: string) => Promise<SendResult | null>
}

export function useOpenClawSend(): UseOpenClawSendResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SendResult | null>(null)

  const sendToAgent = useCallback(async (sessionKey: string, message: string): Promise<SendResult | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/openclaw/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey, message }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errMsg = data.error || `HTTP ${response.status}`
        setError(errMsg)
        return null
      }

      setLastResult(data.result)
      return data.result as SendResult
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errMsg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, lastResult, sendToAgent }
}
