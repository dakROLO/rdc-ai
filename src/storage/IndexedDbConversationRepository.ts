import type { Conversation, Message, MessageRole } from '../domain/conversation.ts'
import type { Project } from '../domain/project.ts'
import { createId } from '../utils/id.ts'
import type {
  ConversationRepository,
  CreateConversationInput,
} from './ConversationRepository.ts'
import type {
  CreateProjectInput,
  ProjectRepository,
} from './ProjectRepository.ts'

const DATABASE_NAME = 'crownkeep-local'
const DATABASE_VERSION = 3
const CONVERSATIONS_STORE = 'conversations'
const MESSAGES_STORE = 'messages'
const PROJECTS_STORE = 'projects'
const CONVERSATION_MESSAGE_INDEX = 'conversationId'

const ROLE_TIE_BREAK: Record<MessageRole, number> = {
  system: 0,
  user: 1,
  assistant: 2,
}

function legacyMessageCompare(a: Message, b: Message): number {
  const timestamp = a.createdAt.localeCompare(b.createdAt)
  if (timestamp !== 0) return timestamp

  const role = ROLE_TIE_BREAK[a.role] - ROLE_TIE_BREAK[b.role]
  if (role !== 0) return role

  return a.id.localeCompare(b.id)
}

function messageCompare(a: Message, b: Message): number {
  if (a.sequence !== undefined && b.sequence !== undefined) {
    return a.sequence - b.sequence
  }

  if (a.sequence !== undefined) return -1
  if (b.sequence !== undefined) return 1

  return legacyMessageCompare(a, b)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = (event) => {
      const database = request.result
      const transaction = request.transaction
      if (!transaction) return

      if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const conversations = database.createObjectStore(CONVERSATIONS_STORE, {
          keyPath: 'id',
        })
        conversations.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        const projects = database.createObjectStore(PROJECTS_STORE, {
          keyPath: 'id',
        })
        projects.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      let messages: IDBObjectStore

      if (!database.objectStoreNames.contains(MESSAGES_STORE)) {
        messages = database.createObjectStore(MESSAGES_STORE, {
          keyPath: 'id',
        })
        messages.createIndex(CONVERSATION_MESSAGE_INDEX, 'conversationId', {
          unique: false,
        })
      } else {
        messages = transaction.objectStore(MESSAGES_STORE)
      }

      // Version 2 gives every legacy message a deterministic conversation position.
      // Old records were ordered only by millisecond timestamps, so a user message and
      // its assistant response could swap after reload when both were created in the
      // same millisecond.
      if (event.oldVersion < 2) {
        const existingRequest = messages.getAll() as IDBRequest<Message[]>

        existingRequest.onsuccess = () => {
          const byConversation = new Map<string, Message[]>()

          for (const message of existingRequest.result) {
            const group = byConversation.get(message.conversationId) ?? []
            group.push(message)
            byConversation.set(message.conversationId, group)
          }

          for (const group of byConversation.values()) {
            group.sort(legacyMessageCompare)

            group.forEach((message, index) => {
              messages.put({
                ...message,
                sequence: index + 1,
              })
            })
          }
        }
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

export class IndexedDbConversationRepository
  implements ConversationRepository, ProjectRepository
{
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
      projectId: input.projectId,
    }

    const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
    transaction.objectStore(CONVERSATIONS_STORE).add(conversation)
    await transactionComplete(transaction)

    return conversation
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const database = await this.databasePromise
    const now = new Date().toISOString()
    const project: Project = {
      id: createId('project'),
      title: input.title.trim() || 'Untitled project',
      description: input.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }

    const transaction = database.transaction(PROJECTS_STORE, 'readwrite')
    transaction.objectStore(PROJECTS_STORE).add(project)
    await transactionComplete(transaction)

    return project
  }

  async listProjects(): Promise<Project[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(PROJECTS_STORE, 'readonly')
    const request = transaction
      .objectStore(PROJECTS_STORE)
      .getAll() as IDBRequest<Project[]>

    const projects = await requestResult(request)
    return projects.sort((a, b) => a.title.localeCompare(b.title))
  }

  async renameProject(id: string, title: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(PROJECTS_STORE, 'readwrite')
    const store = transaction.objectStore(PROJECTS_STORE)
    const request = store.get(id) as IDBRequest<Project | undefined>

    request.onsuccess = () => {
      const project = request.result
      if (!project) return

      store.put({
        ...project,
        title: title.trim() || project.title,
        updatedAt: new Date().toISOString(),
      })
    }

    await transactionComplete(transaction)
  }

  async deleteProject(id: string): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(
      [PROJECTS_STORE, CONVERSATIONS_STORE],
      'readwrite',
    )

    transaction.objectStore(PROJECTS_STORE).delete(id)

    const conversationStore = transaction.objectStore(CONVERSATIONS_STORE)
    const request = conversationStore.getAll() as IDBRequest<Conversation[]>

    request.onsuccess = () => {
      for (const conversation of request.result) {
        if (conversation.projectId !== id) continue

        const { projectId: _projectId, ...withoutProject } = conversation
        conversationStore.put(withoutProject)
      }
    }

    await transactionComplete(transaction)
  }

  async assignConversationToProject(
    conversationId: string,
    projectId?: string,
  ): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.get(conversationId) as IDBRequest<Conversation | undefined>

    request.onsuccess = () => {
      const conversation = request.result
      if (!conversation) return

      if (projectId) {
        store.put({ ...conversation, projectId })
        return
      }

      const { projectId: _projectId, ...withoutProject } = conversation
      store.put(withoutProject)
    }

    await transactionComplete(transaction)
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

    const messageStore = transaction.objectStore(MESSAGES_STORE)
    const conversationMessagesRequest = messageStore
      .index(CONVERSATION_MESSAGE_INDEX)
      .getAll(IDBKeyRange.only(message.conversationId)) as IDBRequest<Message[]>

    conversationMessagesRequest.onsuccess = () => {
      const existingMessages = conversationMessagesRequest.result
      const existing = existingMessages.find((item) => item.id === message.id)
      const maxSequence = existingMessages.reduce(
        (max, item) => Math.max(max, item.sequence ?? 0),
        0,
      )

      messageStore.put({
        ...message,
        sequence: message.sequence ?? existing?.sequence ?? maxSequence + 1,
      })
    }

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

  async setMessageContextExcluded(messageId: string, excluded: boolean): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(MESSAGES_STORE, 'readwrite')
    const store = transaction.objectStore(MESSAGES_STORE)
    const request = store.get(messageId) as IDBRequest<Message | undefined>

    request.onsuccess = () => {
      const message = request.result
      if (!message) return

      store.put({
        ...message,
        excludedFromContext: excluded || undefined,
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
    return messages.sort(messageCompare)
  }
}
