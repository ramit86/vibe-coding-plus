
import express from 'express'
import multer from 'multer'
import { exec } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const app = express()
const upload = multer()
app.use(express.json({ limit: '10mb' }))

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  const allow = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)
  if (allow) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const WHISPER_HTTP = process.env.WHISPER_HTTP || 'http://127.0.0.1:8080/transcribe'
const LLAMA_CHAT = process.env.LLAMA_CHAT || 'http://127.0.0.1:8081/v1/chat/completions'

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/asr', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' })
    const file = new File([req.file.buffer], 'audio.webm', { type: req.file.mimetype })
    const form = new FormData()
    form.append('file', file)
    const r = await fetch(WHISPER_HTTP, { method: 'POST', body: form })
    if (!r.ok) return res.status(502).json({ error: 'whisper upstream', detail: await r.text() })
    let data; try { data = await r.json() } catch { data = { text: await r.text() } }
    const text = (data.text || data.result || data.transcript || '').toString()
    res.json({ text, raw: data })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'asr failed' })
  }
})

app.post('/chat', async (req, res) => {
  try {
    const body = req.body || {}
    const target = LLAMA_CHAT
    if (target.includes('/api/chat')) {
      const ollamaReq = { model: body.model, messages: body.messages || [], stream: false }
      const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ollamaReq) })
      if (!r.ok) return res.status(502).json({ error: 'ollama upstream', detail: await r.text() })
      const data = await r.json()
      const text = data?.message?.content || ''
      return res.json({ text, raw: data })
    }
    const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) return res.status(502).json({ error: 'llm upstream', detail: await r.text() })
    const data = await r.json()
    const text = data?.choices?.[0]?.message?.content || ''
    res.json({ text, raw: data })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'chat failed' })
  }
})

const PROJECT_ROOT = process.cwd()
const SAFE_PREFIX = path.join(PROJECT_ROOT, 'src') + path.sep
function safeResolve(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath)
  if (!abs.startsWith(SAFE_PREFIX)) throw new Error('outside-allowed-path')
  return abs
}

app.post('/patch/preview', async (req, res) => {
  try {
    const patches = req.body?.patches || []
    const results = []
    for (const p of patches) {
      const abs = safeResolve(p.file)
      let before = ''
      try { await access(abs, constants.F_OK); before = await readFile(abs, 'utf-8') } catch { before = '' }
      results.push({ file: p.file, before, after: p.after })
    }
    res.json({ ok: true, results })
  } catch (e) {
    res.status(400).json({ error: e?.message || 'preview failed' })
  }
})

app.post('/patch/apply', async (req, res) => {
  try {
    const patches = req.body?.patches || []
    for (const p of patches) {
      const abs = safeResolve(p.file)
      await writeFile(abs, p.after, 'utf-8')
    }
    res.json({ ok: true, applied: patches.map(p => p.file) })
  } catch (e) {
    res.status(400).json({ error: e?.message || 'apply failed' })
  }
})

app.post('/test/run', async (req, res) => {
  const cmd = req.body?.cmd || 'npx vitest run --reporter=basic'
  const child = exec(cmd, { cwd: PROJECT_ROOT, env: process.env })
  let out = '', err = ''
  child.stdout.on('data', d => out += d)
  child.stderr.on('data', d => err += d)
  child.on('close', code => { res.json({ ok: code === 0, code, stdout: out, stderr: err }) })
})

const PORT = process.env.PORT || 8787	
// ---- ASR healthcheck ----
app.get('/asr/health', async (_req, res) => {
  try {
    // Try a lightweight GET first. Many servers return 405 for GET,
    // which still proves reachability.
    const r = await fetch(WHISPER_HTTP, { method: 'GET' }).catch(() => null)
    if (r) return res.json({ ok: true, status: r.status })
    // If GET isn't supported, try OPTIONS
    const o = await fetch(WHISPER_HTTP, { method: 'OPTIONS' }).catch(() => null)
    if (o) return res.json({ ok: true, status: o.status })
    return res.status(502).json({ ok: false, error: 'unreachable' })
  } catch (e) {
    res.status(502).json({ ok: false, error: e?.message || 'asr health failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[private-proxy] listening on http://127.0.0.1:${PORT}`)
  console.log(`[private-proxy] whisper http: ${WHISPER_HTTP}`)
  console.log(`[private-proxy] llama chat: ${LLAMA_CHAT}`)
})
