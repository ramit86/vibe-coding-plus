import { Config } from './config'

export type ChatMessage = { role: 'system' | 'user' | 'assistant', content: string }
export type Plan = { steps: string[], estTime: string, risks: string[] }

export async function makePlan(task: string, context: string[]): Promise<Plan> {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a senior engineer that produces short, actionable implementation plans for code edits.' },
    { role: 'user', content: `Task: ${task}\nContext files: ${context.join(', ')}` }
  ]
  try {
    const body = { model: Config.llamaModel, temperature: 0.2, messages }
    const r = await fetch(`${Config.proxyBase}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    if (!r.ok) throw new Error('LLM server not reachable')
    const data = await r.json()
    const text = data?.text || '1) Analyze files\n2) Implement change\n3) Run tests'
    const steps = text.split(/\n+/).map(s => s.replace(/^\d+\)\s*/, '').trim()).filter(Boolean).slice(0, 6)
    return { steps, estTime: '~1m', risks: ['validate test coverage'] }
  } catch {
    return { steps: ['Open target file', 'Implement change', 'Run unit tests', 'Review diff'], estTime: '~45s', risks: ['possible type errors'] }
  }
}
