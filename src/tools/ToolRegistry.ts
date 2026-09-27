export type ToolAccess = 'read' | 'write'

export interface CrownKeepToolResult { text: string; data?: unknown }

export interface CrownKeepTool<Input = unknown> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly requiresNetwork: boolean
  readonly access: ToolAccess
  readonly requiresAuthentication?: boolean
  readonly requiresCameraOrPhoto?: boolean
  isAvailable(): Promise<boolean>
  execute(input: Input): Promise<CrownKeepToolResult>
}

/** Calling a tool never changes the selected local language-model runtime. */
export class ToolRegistry {
  private readonly tools = new Map<string, CrownKeepTool>()
  register(tool: CrownKeepTool): void {
    if (this.tools.has(tool.id)) throw new Error(`Tool '${tool.id}' is already registered.`)
    this.tools.set(tool.id, tool)
  }
  get(id: string): CrownKeepTool | undefined { return this.tools.get(id) }
  list(): CrownKeepTool[] { return [...this.tools.values()] }
  async execute(id: string, input: unknown): Promise<CrownKeepToolResult> {
    const tool = this.get(id)
    if (!tool) throw new Error(`Tool '${id}' is not registered.`)
    if (!(await tool.isAvailable())) throw new Error(`Tool '${tool.name}' is unavailable.`)
    return tool.execute(input)
  }
}
