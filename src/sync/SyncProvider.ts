export interface EncryptedSyncChange {
  id: string
  version: number
  updatedAt: string
  ciphertext: string
  encryptionVersion: string
}

export interface SyncReceipt {
  acceptedIds: string[]
  cursor?: string
}

export interface SyncBatch {
  changes: EncryptedSyncChange[]
  cursor?: string
}

export interface SyncStatus {
  state: 'disabled' | 'offline' | 'ready' | 'syncing' | 'error'
  detail?: string
}

export interface SyncProvider {
  getStatus(): Promise<SyncStatus>
  push(changes: EncryptedSyncChange[]): Promise<SyncReceipt>
  pull(cursor?: string): Promise<SyncBatch>
}
