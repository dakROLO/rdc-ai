export interface ContextRequest {
  query: string
  projectId?: string
  customerId?: string
}

export interface ContextPacket {
  sourceId: string
  summary: string
  payload: unknown
}

export interface ContextProvider {
  readonly id: string
  isAvailable(): Promise<boolean>
  getContext(request: ContextRequest): Promise<ContextPacket>
}
