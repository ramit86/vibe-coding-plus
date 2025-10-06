import express from 'express'
import multer from 'multer'

const app = express()
const upload = multer()
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 8787
const LLAMA_CHAT = process.env.LLAMA_CHAT
const WHISPER_HTTP = process.env.WHISPER_HTTP
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)
const REQUIRE_API_KEY = !!(process.env.API_KEY && process.env.API_KEY.length > 0)
const PUBLIC_BUILD = process.env.PUBLIC_BUILD === '1'

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  if (CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,*')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use((req, res, next) => {
  if (!REQUIRE_API_KEY) return next()
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== process.env.API_KEY) return res.status(401).json({ error: 'unauthorized' })
  next()
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/asr/health', async (_req, res) => {
  try {
    if (!WHISPER_HTTP) return res.status(500).json({ ok:false, error:'WHISPER_HTTP not set' })
    const ping = await fetch(WHISPER_HTTP, { method: 'GET' }).catch(()=>null)
    if (ping) return res.json({ ok:true, status: ping.status })
    const opt = await fetch(WHISPER_HTTP, { method: 'OPTIONS' }).catch(()=>null)
    if (opt) return res.json({ ok:true, status: opt.status })
    res.status(502).json({ ok:false, error:'unreachable' })
  } catch (e) {
    res.status(502).json({ ok:false, error: e?.message || 'asr health failed' })
  }
})

app.post('/asr', upload.single('audio'), async (req, res) => {
  try {
    if (!WHISPER_HTTP) return res.status(500).json({ error: 'WHISPER_HTTP not configured' })
    if (!req.file) return res.status(400).json({ error: 'no file' })
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' })
    const form = new FormData()
    form.append('file', blob, 'speech.webm')
    const r = await fetch(WHISPER_HTTP, { method: 'POST', body: form })
    if (!r.ok) return res.status(502).json({ error: 'asr upstream', detail: await r.text() })
    let data; try { data = await r.json() } catch { data = { text: await r.text() } }
    const text = (data.text || data.result || data.transcript || '').toString()
    res.json({ text })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'asr failed' })
  }
})

app.post('/chat', async (req, res) => {
  try {
    if (!LLAMA_CHAT) return res.status(500).json({ error: 'LLAMA_CHAT not configured' })
    const body = req.body || {}
    const headers = { 'Content-Type': 'application/json' }
    if (process.env.LLM_API_KEY) headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`
    const r = await fetch(LLAMA_CHAT, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!r.ok) return res.status(502).json({ error: 'llm upstream', detail: await r.text() })
    const data = await r.json()
    const text = data?.choices?.[0]?.message?.content || ''
    res.json({ text, raw: data })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'chat failed' })
  }
})

if (!PUBLIC_BUILD) {
  // private-only routes would go here in a private build
}

app.listen(PORT, () => console.log(`[proxy] listening on :${PORT})`))
