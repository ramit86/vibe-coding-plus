import React, { useEffect, useMemo, useState } from 'react'
import {
  Mic, Square, Settings, Sparkles, FileCode2, Diff as DiffIcon, Play,
  CheckCircle2, XCircle, Gauge, Lock, TimerReset, Bot, ClipboardList,
  Search, TriangleAlert, Save, GitBranch, ChevronDown, TestTube2
} from 'lucide-react'

/** === Minimal inline Config (self-contained) ===
 * If you prefer your shared config file, delete this block
 * and keep:  import { Config } from '../lib/config'
 */
const Config = {
  proxyBase: 'http://127.0.0.1:8787',
  llamaModel: 'gpt-4.1-mini',
} as const

/** === mic capture + /asr post === */
async function captureAndTranscribe(
  cb: {
    onPartial?: (t: string) => void
    onFinal: (t: string) => void
    onStop?: () => void
    onError?: (e: string) => void
  },
  ms: number = 4000
) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    let mimeType = ''
    for (const m of candidates) {
      try {
        // @ts-ignore
        if (window.MediaRecorder?.isTypeSupported?.(m)) { mimeType = m; break }
      } catch {}
    }
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: BlobPart[] = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    // @ts-ignore
    rec.onerror = (e) => cb.onError?.(e?.error?.message || 'recorder error')
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks)
        const fd = new FormData()
        // The proxy accepts `audio`; it forwards as `file` to Whisper
        fd.append('audio', blob, 'speech.webm')

        const r = await fetch(`${Config.proxyBase}/asr`, { method: 'POST', body: fd })
        if (!r.ok) throw new Error(`ASR upstream ${r.status}`)
        let text = ''
        try {
          const data = await r.json()
          text = data?.text || ''
        } catch {
          text = await r.text()
        }
        cb.onFinal(text)
      } catch (e: any) {
        cb.onError?.(e?.message || 'transcription failed')
      } finally {
        cb.onStop?.()
        stream.getTracks().forEach(t => t.stop())
      }
    }
    rec.start()
    setTimeout(() => { if (rec.state === 'recording') rec.stop() }, ms)
  } catch (e: any) {
    cb.onError?.(e?.message || 'mic failed')
    cb.onStop?.()
  }
}

/** === simple OpenAI-style planner via proxy === */
async function planWithLLM(task: string, files: string[]) {
  const body = {
    model: Config.llamaModel,
    messages: [
      { role: 'system', content: 'You are a senior engineer. Return a short, numbered plan. Do NOT include <think> text.' },
      { role: 'user', content: `Task: ${task}\nFiles: ${files.join(', ')}` }
    ],
    temperature: 0.2
  }
  const r = await fetch(`${Config.proxyBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!r.ok) throw new Error(await r.text().catch(()=>'planner upstream error'))
  const data = await r.json().catch(()=> ({} as any))
  const text: string = data?.text
    || data?.choices?.[0]?.message?.content
    || ''
  const steps = text
    .split('\n')
    .map(s => s.replace(/^\s*\d+\)\s*|\s*\d+\.\s*/, '').trim())
    .filter(Boolean)
  return {
    steps: steps.length ? steps : ['Locate component', 'Introduce debounce', 'Add loading indicator', 'Update tests'],
    estTime: '~45s',
    risks: ['debounce can swallow keystrokes']
  }
}

/** === UI atoms with proper typing === */
type CardProps = { children: React.ReactNode; className?: string }
function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-2xl shadow-lg border border-gray-200 bg-white p-4 ${className}`}>{children}</div>
}

type ButtonProps = {
  children: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
}
function Button({ children, className = '', onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-2xl shadow border text-sm hover:shadow-md transition disabled:opacity-50 ${className}`}>{children}</button>
}

type ChipProps = {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  onRemove?: () => void
}
function Chip({ icon: Icon, label, onRemove }: ChipProps){
  return <span className='inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1 mr-2 mb-2'>
    {Icon && <Icon className='w-3 h-3'/>}{label}{onRemove && <button onClick={onRemove} className='ml-1 text-gray-500 hover:text-black'>×</button>}
  </span>
}

type DiffBlockProps = { file: string; before: string; after: string }
function DiffBlock({ file, before, after }: DiffBlockProps){
  return <div className='text-xs font-mono bg-gray-50 rounded-xl overflow-hidden border'>
    <div className='flex items-center justify-between px-3 py-2 bg-gray-100 border-b'>
      <div className='flex items-center gap-2 text-gray-700'><DiffIcon className='w-4 h-4'/> {file}</div>
      <div className='text-[10px] text-gray-500'>preview</div>
    </div>
    <div className='grid grid-cols-2 divide-x'>
      <pre className='p-3 whitespace-pre-wrap'>{before}</pre>
      <pre className='p-3 whitespace-pre-wrap'>{after}</pre>
    </div>
  </div>
}

export default function VibeCodingPlus(){
  // mic + transcript
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [finals, setFinals] = useState<string[]>([])
  // asr status pill
  const [asrOk, setAsrOk] = useState<boolean | null>(null)

  // intent + planning
  const [intent, setIntent] = useState({
    task: 'Add debounce to search input and show loading state',
    files: ['src/components/SearchBox.tsx'],
    constraints: ['typescript', 'no external deps'],
    model: 'Local (private)',
  })
  const [plan, setPlan] = useState({ steps: ['Locate component','Introduce debounce','Add loading indicator','Update tests'], estTime: '~45s', risks: ['debounce can swallow keystrokes'] })
  const [approved, setApproved] = useState(false)

  // draft patch (example; update as you like)
  const [draft, setDraft] = useState({
    patches: [{
      file: 'src/components/SearchBox.tsx',
      before: `function SearchBox(){
  const [q,setQ] = useState('');
  return (<input value={q} onChange={e=>setQ(e.target.value)} />);
}`,
      after: `function SearchBox(){
  const [q,setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    if (dq.trim() === '') return;
    setLoading(true);
    triggerSearch(dq).finally(()=>setLoading(false));
  }, [dq]);
  return (<div>
    <input aria-busy={loading} aria-live='polite' value={q} onChange={e=>setQ(e.target.value)} />
    {loading && <Spinner />}
  </div>);
}`
    }],
    tests: ['updates results after 250ms idle','announces busy state'],
    summary: 'Adds debounced search with a11y affordances'
  })
  const [applyStatus, setApplyStatus] = useState<string>('')
  const [testStatus, setTestStatus] = useState<string>('')

  /** mic effect */
  useEffect(()=>{
    if(!listening) return
    setPartial(''); setFinals([])
    captureAndTranscribe({
      onPartial: (t) => setPartial(t),
      onFinal:   (t) => setFinals(prev=>[...prev, t]),
      onStop:    () => setListening(false),
      onError:   (err) => { console.error(err); setListening(false) }
    }, 4000)
  }, [listening])

  /** asr health poll — proxy implements GET /asr returning { ok: true } */
  useEffect(()=>{
    let cancelled = false
    const ping = async () => {
      try {
        const r = await fetch(`${Config.proxyBase}/asr`, { method: 'GET' })
        if (!cancelled) setAsrOk(r.ok)
      } catch {
        if (!cancelled) setAsrOk(false)
      }
    }
    ping()
    const id = setInterval(ping, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const latency = useMemo(
    () => ({ asr: listening? '~rec' : (asrOk ? '~0ms' : '—'), nlu: '~250ms', codegen: approved? '~600ms' : '—' }),
    [listening, approved, asrOk]
  )

  async function handlePlan(){
    try {
      const p = await planWithLLM(intent.task, intent.files)
      setPlan(p as any)
    } catch (e:any) {
      console.error(e)
      setPlan({ steps: ['Locate component','Introduce debounce','Add loading indicator','Update tests'], estTime: '~45s', risks: ['planner error; using default plan'] })
    }
  }

  async function previewPatch(){
    setApplyStatus('')
    try {
      const r = await fetch(`${Config.proxyBase}/patch/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patches: draft.patches })
      })
      if (!r.ok) { setApplyStatus('Preview failed'); return }
      const data = await r.json().catch(()=> ({} as any))
      if (Array.isArray(data?.results)) {
        setDraft(d => ({ ...d, patches: data.results }))
        setApplyStatus('Preview refreshed from disk ✓')
      } else {
        setApplyStatus('Preview returned no results')
      }
    } catch {
      setApplyStatus('Preview failed')
    }
  }

  async function applyPatch(){
    setApplyStatus('Applying…')
    try {
      const r = await fetch(`${Config.proxyBase}/patch/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patches: draft.patches })
      })
      const j = await r.json().catch(()=>null)
      if (!r.ok || !j?.ok) { setApplyStatus('Apply failed'); return }
      setApplyStatus('Applied ✓')
    } catch {
      setApplyStatus('Apply failed')
    }
  }

  async function runTests(){
    setTestStatus('Running tests…')
    try {
      const r = await fetch(`${Config.proxyBase}/test/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const j = await r.json().catch(()=>null)
      if (!r.ok || !j) { setTestStatus('Tests failed to run'); return }
      setTestStatus((j.ok ? '✅' : '❌') + ` exit ${j.code}\n` + (j.stdout || j.stderr || ''))
    } catch {
      setTestStatus('Tests failed to run')
    }
  }

  return <div className='min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900'>
    {/* HEADER */}
    <div className='sticky top-0 z-10 border-b bg-white/80 backdrop-blur'>
      <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-5 h-5'/>
          <div className='font-semibold'>Vibe Coding+ (Private Mode)</div>
          <span className='text-xs text-gray-500'>Local only · no cloud calls</span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='text-xs text-gray-600 flex items-center gap-2'>
            <Gauge className='w-4 h-4'/> Latency: ASR {latency.asr} · NLU {latency.nlu} · Code {latency.codegen}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${
            asrOk === null ? 'text-gray-600 border-gray-300 bg-gray-100'
            : asrOk ? 'text-green-700 border-green-200 bg-green-50'
            : 'text-red-700 border-red-200 bg-red-50'
          }`}>
            ASR: {asrOk === null ? 'checking…' : asrOk ? 'online' : 'offline'}
          </span>
          <Button className='bg-black text-white flex items-center gap-2' onClick={()=>setListening(v=>!v)}>
            {listening ? (<><Square className='w-4 h-4'/> Stop</>) : (<><Mic className='w-4 h-4'/> Speak</>)}
          </Button>
          <Button className='flex items-center gap-2'><Settings className='w-4 h-4'/> Settings</Button>
        </div>
      </div>
      <div className='max-w-6xl mx-auto px-4 pb-2 text-xs text-gray-600'>
        Local LLM: <span className='font-medium'>({Config.llamaModel})</span> via proxy
      </div>
    </div>

    {/* BODY */}
    <div className='max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-4'>
      {/* Left: Transcript + Intent */}
      <div className='md:col-span-1 space-y-4'>
        <Card>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center gap-2 font-medium'><Bot className='w-4 h-4'/> Transcript</div>
            <span className='text-xs inline-flex items-center gap-1 text-green-700'><Lock className='w-3 h-3'/> Private</span>
          </div>
          <div className='min-h-[120px] rounded-xl border bg-gray-50 p-3'>
            {finals.map((t,i)=>(<div key={i} className='text-sm mb-1'>→ {t}</div>))}
            {partial && (<div className='text-sm text-gray-500 italic'>… {partial}</div>)}
            {!partial && finals.length===0 && (<div className='text-xs text-gray-400'>Press “Speak” and talk. (Private mic; needs Whisper or mock.)</div>)}
          </div>
          <div className='mt-3 text-right'>
            <Button className='text-gray-700' onClick={()=>{ setFinals([]); setPartial(''); }}>
              <TimerReset className='w-4 h-4 mr-2 inline'/> Reset
            </Button>
          </div>
        </Card>

        <Card>
          <div className='flex items-center gap-2 font-medium mb-2'><ClipboardList className='w-4 h-4'/> Intent</div>
          <div className='mb-2 text-xs text-gray-600'>Edit chips to refine before planning.</div>
          <div className='mb-2'>
            <div className='text-[11px] uppercase tracking-wide text-gray-500 mb-1'>Task</div>
            <Chip label={intent.task}/>
          </div>
          <div className='mb-2'>
            <div className='text-[11px] uppercase tracking-wide text-gray-500 mb-1'>Files</div>
            {intent.files.map((f,idx)=>(<Chip key={idx} icon={FileCode2} label={f} onRemove={()=>{ setIntent({...intent, files: intent.files.filter(x=>x!==f)}); }}/>))}
          </div>
          <div className='mb-2'>
            <div className='text-[11px] uppercase tracking-wide text-gray-500 mb-1'>Constraints</div>
            {intent.constraints.map((c,idx)=>(<Chip key={idx} label={c} onRemove={()=>{ setIntent({...intent, constraints: intent.constraints.filter(x=>x!==c)}); }}/>))}
          </div>
          <div className='grid grid-cols-2 gap-2 mt-2'>
            <Button className='bg-black text-white flex items-center justify-center gap-2' onClick={handlePlan}><Search className='w-4 h-4'/> Plan</Button>
            <Button className='flex items-center justify-center gap-2'><ChevronDown className='w-4 h-4'/> Commands</Button>
          </div>
        </Card>
      </div>

      {/* Middle: Plan + Patch */}
      <div className='space-y-4'>
        <Card>
          <div className='flex items-center gap-2 font-medium mb-1'><ClipboardList className='w-4 h-4'/> Plan <span className='text-xs text-gray-500'>{plan.estTime}</span></div>
          <ol className='list-decimal ml-5 text-sm space-y-1'>{plan.steps.map((s,i)=>(<li key={i}>{s}</li>))}</ol>
          {plan.risks.length>0 && (
            <div className='mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2'>
              <TriangleAlert className='w-4 h-4 mt-0.5'/> {plan.risks.join('; ')}
            </div>
          )}
          <div className='mt-3 flex items-center justify-between'>
            <Button className='bg-black text-white flex items-center gap-2' onClick={()=>setApproved(true)}><Play className='w-4 h-4'/> Generate Patch</Button>
            <div className='text-xs text-gray-500'>{applyStatus}</div>
          </div>
        </Card>

        <Card>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2 font-medium'><GitBranch className='w-4 h-4'/> Draft Patch</div>
            <div className='text-xs text-gray-500'>tests: {draft.tests.length}</div>
          </div>
          {draft.patches.map((p,idx)=>(<div key={idx} className='mb-3'><DiffBlock file={p.file} before={p.before} after={p.after}/></div>))}
          <div className='flex items-center gap-2 mt-3'>
            <Button onClick={previewPatch}>Refresh Preview</Button>
            <Button className='border-green-600 text-green-700' onClick={applyPatch}><CheckCircle2 className='w-4 h-4 mr-1 inline'/> Apply</Button>
            <Button className='border-red-600 text-red-700' onClick={()=>setDraft(d=>({ ...d, patches: [] }))}><XCircle className='w-4 h-4 mr-1 inline'/> Discard</Button>
          </div>
        </Card>
      </div>

      {/* Right: Telemetry + Tests + Export */}
      <div className='space-y-4'>
        <Card>
          <div className='flex items-center gap-2 font-medium mb-2'><Gauge className='w-4 h-4'/> Telemetry</div>
          <div className='text-xs grid grid-cols-2 gap-2'>
            <div className='bg-gray-50 rounded-lg p-2'><div className='text-[11px] text-gray-500'>ASR</div><div className='text-sm'>{latency.asr}</div></div>
            <div className='bg-gray-50 rounded-lg p-2'><div className='text-[11px] text-gray-500'>NLU</div><div className='text-sm'>{latency.nlu}</div></div>
            <div className='bg-gray-50 rounded-lg p-2'><div className='text-[11px] text-gray-500'>Codegen</div><div className='text-sm'>{latency.codegen}</div></div>
            <div className='bg-gray-50 rounded-lg p-2'><div className='text-[11px] text-gray-500'>Tokens</div><div className='text-sm'>local only</div></div>
          </div>
        </Card>

        <Card>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2 font-medium'><TestTube2 className='w-4 h-4'/> Tests</div>
            <div className='text-xs text-gray-500'>{testStatus ? 'see output below' : ''}</div>
          </div>
          <div className='flex items-center gap-2'>
            <Button onClick={runTests}>Run Tests</Button>
          </div>
          {testStatus && <pre className='mt-3 text-xs bg-gray-50 border rounded-xl p-3 whitespace-pre-wrap'>{testStatus}</pre>}
        </Card>

        <Card>
          <div className='flex items-center gap-2 font-medium mb-2'><Save className='w-4 h-4'/> Export</div>
          <div className='text-xs text-gray-600 mb-2'>Copy session state or save patch (simulated).</div>
          <div className='flex items-center gap-2'>
            <Button onClick={()=>navigator.clipboard.writeText('Vibe Coding+ session (local)')}>Copy Session</Button>
            <Button onClick={()=>alert('Patch saved (simulated)')}>Save Patch</Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
}
