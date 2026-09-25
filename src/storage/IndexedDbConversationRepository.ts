import type { Conversation, Message } from '../domain/conversation.ts'
import { createId } from '../utils/id.ts'
import type {
  ConversationRepository,
  CreateConversationInput,
} from './ConversationRepository.ts'

const DATABASE_NAME = 'crownkeep-local'
const DATABASE_VERSION = 1
const CONVERSATIONS_STORE = 'conversations'
const MESSAGES_STORE = 'messages'
const CONVERSATION_MESSAGE_INDEX = 'conversationId'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const conversations = database.createObjectStore(CONVERSATIONS_STORE, {
          keyPath: 'id',
        })
        conversations.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      if (!database.objectStoreNames.contains(MESSAGES_STORE)) {
        const messages = database.createObjectStore(MESSAGES_STORE, {
          keyPath: 'id',
        })
        messages.createIndex(CONVERSATION_MESSAGE_INDEX, 'conversationId', {
          unique: false,
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local database.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local database request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Local database transaction failed.'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Local database transaction was aborted.'))
  })
}

export class IndexedDbConversationRepository implements ConversationRepository {
  private readonly databasePromise = openDatabase()

  async create(input: CreateConversationInput = {}): Promise<Conversation> {
    const database = await this.databasePromise
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: createId('conversation'),
      title: input.title?.trim() || 'New conversation',
      createdAt: now,
      updatedAt: now,
      syncState: 'local-only',
      syncVersion: 0,
    }

    const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
    transaction.objectStore(CONVERSATIONS_STORE).add(conversation)
    await transactionComplete(transaction)

    return conversation
  }

  async get(id: string): Promise<Conversation | undefined> {
    const database = await this.databasePromise
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readonly')
    const request = transaction
      .objectStore(CONVERSATIONS_STORE)
      .get(id) as IDBRequest<Conversation | undefined>

    return requestResult(request)
  }

  async list(): Promise<Conversation[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readonly')
    const request = transaction
      .objectStore(CONVERSATIONS_STORE)
      .getAll() as IDBRequest<Conversation[]>

    const conversations = await requestResult(request)
    return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async rename(id: string, title: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.get(id) as IDBRequest<Conversation | undefined>

    request.onsuccess = () => {
      const conversation = request.result
      if (!conversation) return

      store.put({
        ...conversation,
        title: title.trim() || conversation.title,
        updatedAt: new Date().toISOString(),
      })
    }

    await transactionComplete(transaction)
  }

  async delete(id: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(
      [CONVERSATIONS_STORE, MESSAGES_STORE],
      'readwrite',
    )

    transaction.objectStore(CONVERSATIONS_STORE).delete(id)

    const messageStore = transaction.objectStore(MESSAGES_STORE)
    const index = messageStore.index(CONVERSATION_MESSAGE_INDEX)
    const request = index.getAll(IDBKeyRange.only(id)) as IDBRequest<Message[]>

    request.onsuccess = () => {
      for (const message of request.result) {
        messageStore.delete(message.id)
      }
    }

    await transactionComplete(transaction)
  }

  async saveMessage(message: Message): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(
      [CONVERSATIONS_STORE, MESSAGES_STORE],
      'readwrite',
    )

    transaction.objectStore(MESSAGES_STORE).put(message)

    const conversationStore = transaction.objectStore(CONVERSATIONS_STORE)
    const conversationRequest = conversationStore.get(
      message.conversationId,
    ) as IDBRequest<Conversation | undefined>

    conversationRequest.onsuccess = () => {
      const conversation = conversationRequest.result
      if (!conversation) return

      conversationStore.put({
        ...conversation,
        updatedAt: message.createdAt,
      })
    }

    await transactionComplete(transaction)
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(MESSAGES_STORE, 'readonly')
    const request = transaction
      .objectStore(MESSAGES_STORE)
      .index(CONVERSATION_MESSAGE_INDEX)
      .getAll(IDBKeyRange.only(conversationId)) as IDBRequest<Message[]>

    const messages = await requestResult(request)
    return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
}
