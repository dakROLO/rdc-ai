import { unrelatedChecksResult } from './webRelevance.ts'
import type { DecisionAssist } from '../decision/DecisionEngine.ts'
export type ToolAccess = 'read' | 'write'

export interface ToolResultSource {
  url: string
  title?: string
}

export interface ToolResultMetadata {
  /** True only when this execution crossed CrownKeep's local device boundary. */
  dataLeftDevice: boolean
  sources?: ToolResultSource[]
  detail?: string
}

export interface CrownKeepToolResult {
  text: string
  data?: unknown
  metadata?: ToolResultMetadata
}

export interface CrownKeepToolDefinition {
  id: string
  name: string
  description: string
  requiresNetwork: boolean
  access: ToolAccess
  inputSchema?: Record<string, unknown>
}

export interface CrownKeepTool<Input = unknown> extends CrownKeepToolDefinition {
  readonly requiresAuthentication?: boolean
  readonly requiresCameraOrPhoto?: boolean
  isAvailable(): Promise<boolean>
  execute(input: Input): Promise<CrownKeepToolResult>
}

export type WebAccessMode = 'off' | 'on'

export interface ToolExecutionPolicy {
  webAccess: WebAccessMode
  /** Write tools require a future explicit approval flow. Read-only is the default. */
  allowWriteTools: boolean
  /** Separately opt in to local image generation; never authorizes other writes. */
  allowImageGeneration?: boolean
}

const DEFAULT_POLICY: ToolExecutionPolicy = {
  webAccess: 'off',
  allowWriteTools: false,
}

export class ToolPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolPolicyError'
  }
}

/** Calling a tool never changes the selected local language-model runtime. */
export class ToolRegistry {
  private readonly tools = new Map<string, CrownKeepTool>()
  private steward?: { assist: DecisionAssist; context: string }
  setSteward(assist: DecisionAssist, context: string): void { this.steward = { assist, context } }

  private policy: ToolExecutionPolicy = { ...DEFAULT_POLICY }

  register(tool: CrownKeepTool): void {
    if (this.tools.has(tool.id)) throw new Error(`Tool '${tool.id}' is already registered.`)
    this.tools.set(tool.id, tool)
  }

  get(id: string): CrownKeepTool | undefined {
    return this.tools.get(({ 'web-search': 'web.search', 'web-read': 'web.read', 'local-crownkeep-search': 'keep.search' } as Record<string, string>)[id] ?? id)
  }

  list(): CrownKeepTool[] {
    return [...this.tools.values()]
  }

  definitions(): CrownKeepToolDefinition[] {
    return this.list().map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      requiresNetwork: tool.requiresNetwork,
      access: tool.access,
      inputSchema: tool.inputSchema,
    }))
  }

  setPolicy(policy: Partial<ToolExecutionPolicy>): void {
    this.policy = { ...this.policy, ...policy }
  }

  getPolicy(): ToolExecutionPolicy {
    return { ...this.policy }
  }

  async availableDefinitions(): Promise<CrownKeepToolDefinition[]> {
    const allowed = this.list().filter((tool) =>
      (!tool.requiresNetwork || this.policy.webAccess === 'on') &&
      (tool.access === 'read' || (tool.id === 'image.generate' ? this.policy.allowImageGeneration : this.policy.allowWriteTools)),
    )
    const available = await Promise.all(allowed.map(async (tool) => {
      try { return await tool.isAvailable() ? tool : undefined } catch { return undefined }
    }))
    return available.filter((tool): tool is CrownKeepTool => Boolean(tool))
  }

  async execute(id: string, input: unknown): Promise<CrownKeepToolResult> {
    const tool = this.get(id)
    if (!tool) throw new Error(`Tool '${id}' is not registered.`)

    // Policy is checked before availability or execution so Web Access OFF
    // cannot cause a hidden network probe through a tool implementation.
    if (tool.requiresNetwork && this.policy.webAccess !== 'on') {
      throw new ToolPolicyError(
        `Web Access is OFF. CrownKeep blocked network tool '${tool.name}'.`,
      )
    }

    if (tool.access === 'write' && !(tool.id === 'image.generate' ? this.policy.allowImageGeneration : this.policy.allowWriteTools)) {
      throw new ToolPolicyError(
        `Write tool '${tool.name}' requires an explicit approval flow.`,
      )
    }

    if (!(await tool.isAvailable())) {
      throw new Error(`Tool '${tool.name}' is unavailable.`)
    }

    if (this.steward) {
      const relevant = await this.steward.assist.relevant('tool-arguments', `Request/topic: ${this.steward.context}\nTool: ${tool.id}\nProposed arguments: ${JSON.stringify(input)}`)
      if (relevant === false) throw new Error('Tool arguments do not preserve the request/topic. Retry using the resolved topic.')
    }
    // Permission may change while availability or local advice is awaited.
    // Recheck at the actual execution boundary; advice cannot preserve stale consent.
    if (tool.requiresNetwork && this.policy.webAccess !== 'on') throw new ToolPolicyError('Web Access is OFF. CrownKeep blocked the network tool.')
    if (tool.access === 'write' && !(tool.id === 'image.generate' ? this.policy.allowImageGeneration : this.policy.allowWriteTools)) throw new ToolPolicyError('Tool permission was revoked before execution.')
    const result = await tool.execute(input)
    const query = tool.id === 'web.search' && input && typeof input === 'object' ? (input as { query?: unknown }).query : undefined
    if (typeof query === 'string' && unrelatedChecksResult(query, result.text)) return { text: 'Search returned unrelated checks/checkers results. Retry using the resolved topic; do not use this evidence.', metadata: { dataLeftDevice: true, detail: 'irrelevant-result' } }
    if (this.steward) {
      const relevant = await this.steward.assist.relevant('tool-result', `Request/topic: ${this.steward.context}\nTool: ${tool.id}\nEvidence: ${result.text.slice(0, 6000)}`)
      if (relevant === false) return { text: 'Tool evidence was rejected as irrelevant. Retry with the resolved topic; do not use this evidence.', metadata: { dataLeftDevice: tool.requiresNetwork, detail: 'irrelevant-result' } }
    }
    return {
      ...result,
      metadata: {
        ...result.metadata,
        dataLeftDevice: tool.requiresNetwork || result.metadata?.dataLeftDevice === true,
      },
    }
  }
}
