
import { Config } from './config'

export type AsrCallbacks = {
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onStop?: () => void
  onError?: (err: string) => void
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const m of candidates) {
    try { if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m } catch {}
  }
  return ''
}

export async function captureAndTranscribe(cb: AsrCallbacks, ms: number = 4000) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: BlobPart[] = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onerror = (e: any) => cb.onError?.(e?.error?.message || 'recorder error')
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks)
        const fd = new FormData()
        fd.append('audio', blob, 'speech.webm')
        const r = await fetch(`${Config.proxyBase}/asr`, { method: 'POST', body: fd })
        if (!r.ok) throw new Error(`ASR upstream ${r.status}`)
        const data = await r.json()
        const text = data?.text || ''
        cb.onFinal(text)
      } catch (e: any) {
        cb.onError?.(e.message || 'transcription failed')
      } finally {
        cb.onStop?.()
        stream.getTracks().forEach(t => t.stop())
      }
    }
    rec.start()
    setTimeout(() => { if (rec.state === 'recording') rec.stop() }, ms)
  } catch (e: any) {
    cb.onError?.(e.message || 'mic failed')
    cb.onStop?.()
  }
}
