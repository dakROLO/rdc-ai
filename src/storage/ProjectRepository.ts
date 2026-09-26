import type { Project } from '../domain/project.ts'

export interface CreateProjectInput {
  title: string
  description?: string
}

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<Project>
  listProjects(): Promise<Project[]>
  renameProject(id: string, title: string): Promise<void>
  deleteProject(id: string): Promise<void>
  assignConversationToProject(
    conversationId: string,
    projectId?: string,
  ): Promise<void>
}
