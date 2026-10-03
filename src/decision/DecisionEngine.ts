export type DecisionJob = 'model-route' | 'tool-choice' | 'tool-arguments' | 'tool-result'
export type ToolChoice = 'NONE' | 'WEB_SEARCH' | 'WEB_READ' | 'KEEP_SEARCH' | 'IMAGE_READ' | 'IMAGE_GENERATE'
export type ChatRole = 'Quick' | 'Balanced' | 'Deep'
export interface DecisionRequest {
  job: DecisionJob
  state: string
  question: string
  options: Array<{ id: string; description: string }>
}
export interface DecisionResult {
  selected: string
  confidence: number
  scores: Record<string, number>
  latencyMs: number
}
export interface DecisionStatus {
  available: boolean
  version: string
  backend: string
  loadState: 'unavailable' | 'unloaded' | 'loaded'
  qualifiedJobs: DecisionJob[]
  detail: string
}
export interface DecisionEngine {
  status(): Promise<DecisionStatus>
  decide(request: DecisionRequest): Promise<DecisionResult>
  release(): Promise<void>
}
export const DECISION_THRESHOLD = 0.8
/** Advisory decisions are usable only for measured categories and explicit opt-in.
 * Probabilities are model scores, not calibrated certainty. */
export class DecisionAssist {
  enabled = false
  last: { job: DecisionJob; result?: DecisionResult; reason: string } | undefined
  readonly engine: DecisionEngine
  constructor(engine: DecisionEngine) { this.engine = engine }
  async setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) await this.engine.release()
  }
  async judge(request: DecisionRequest): Promise<DecisionResult | undefined> {
    const fallback = (reason: string) => { this.last = { job: request.job, reason }; return undefined }
    if (!this.enabled) return fallback('disabled')
    try {
      const status = await this.engine.status()
      if (!status.available || !status.qualifiedJobs.includes(request.job)) return fallback(status.available ? 'category not qualified' : 'unavailable')
      const result = await this.engine.decide(request)
      // Recheck opt-in after asynchronous loading/inference.
      if (!this.enabled) return fallback('disabled during evaluation')
      if (!Number.isFinite(result.confidence) || result.confidence < DECISION_THRESHOLD || result.confidence > 1 || !request.options.some(x => x.id === result.selected)) return fallback('low confidence or invalid choice')
      this.last = { job: request.job, result, reason: 'qualified local judgment' }
      return result
    } catch { return fallback('local engine failed; deterministic fallback') }
  }
  async route(mode: 'Auto' | ChatRole, prompt: string, qualified: ChatRole[]): Promise<ChatRole> {
    if (mode !== 'Auto') return mode
    const options = qualified.map(id => ({ id, description: ({ Quick: 'Simple everyday questions and concise answers', Balanced: 'Moderate analysis, planning and multi-part explanations', Deep: 'Difficult reasoning, complex tradeoffs and detailed technical analysis' })[id] }))
    if (options.length < 2) { this.last = { job: 'model-route', reason: 'Quick fallback; fewer than two qualified roles' }; return 'Quick' }
    const result = await this.judge({ job: 'model-route', state: prompt, question: 'Which available reasoning role is appropriate for this request?', options })
    return result && qualified.includes(result.selected as ChatRole) ? result.selected as ChatRole : 'Quick'
  }
  async toolChoice(state: string): Promise<ToolChoice | undefined> {
    const labels: ToolChoice[] = ['NONE', 'WEB_SEARCH', 'WEB_READ', 'KEEP_SEARCH', 'IMAGE_READ', 'IMAGE_GENERATE']
    return (await this.judge({ job: 'tool-choice', state, question: 'Which tool is needed for this request?', options: labels.map(id => ({ id, description: ({ NONE: 'Answer using local knowledge or retained evidence without a tool', WEB_SEARCH: 'Find current public information online', WEB_READ: 'Read a specified public webpage', KEEP_SEARCH: 'Search local Keep knowledge', IMAGE_READ: 'Understand a currently attached image', IMAGE_GENERATE: 'Create a new image locally' })[id] })) }))?.selected as ToolChoice | undefined
  }
  async relevant(job: 'tool-arguments' | 'tool-result', state: string): Promise<boolean | undefined> {
    const result = await this.judge({ job, state, question: job === 'tool-arguments' ? 'Does the proposed tool argument preserve the actual user request and prior topic?' : 'Is the tool evidence relevant to the actual user request and prior topic?', options: [{ id: 'RELEVANT', description: 'Relevant to the request and resolved topic' }, { id: 'IRRELEVANT', description: 'Wrong topic, generic unresolved follow-up, or irrelevant evidence' }] })
    return result ? result.selected === 'RELEVANT' : undefined
  }
}
