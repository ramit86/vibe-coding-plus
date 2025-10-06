const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const upload = multer();
app.use(express.json({ limit: '5mb' }));

// Config (local-only targets)
const WHISPER_HTTP = process.env.WHISPER_HTTP || 'http://127.0.0.1:8080/transcribe';
const LLAMA_CHAT = process.env.LLAMA_CHAT || 'http://127.0.0.1:8081/v1/chat/completions';

app.get('/health', (_req, res) => res.json({ ok: true }));

// POST /asr -> forwards audio blob to whisper.cpp HTTP server, returns { text }
app.post('/asr', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    // Forward as multipart/form-data to whisper.cpp (common pattern for demo servers)
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: 'audio.webm', contentType: req.file.mimetype });
    // Some whisper.cpp servers accept 'temperature' 'language' etc.; keep minimal
    const r = await fetch(WHISPER_HTTP, { method: 'POST', body: form });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'whisper upstream', detail: t });
    }
    const data = await r.json().catch(async () => ({ text: await r.text() }));
    // Normalize
    const text = (data.text || data.result || data.transcript || '').toString();
    res.json({ text, raw: data });
  } catch (e) {
    res.status(500).json({ error: e.message || 'asr failed' });
  }
});

// POST /chat -> forwards JSON to llama.cpp (OpenAI-style) and returns the text
app.post('/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const r = await fetch(LLAMA_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'llama upstream', detail: t });
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '';
    res.json({ text, raw: data });
  } catch (e) {
    res.status(500).json({ error: e.message || 'chat failed' });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`[private-proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[private-proxy] whisper http: ${WHISPER_HTTP}`);
  console.log(`[private-proxy] llama chat: ${LLAMA_CHAT}`);
});
