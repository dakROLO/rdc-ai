export interface AuthUser {
  id: string
  displayName?: string
  username?: string
}

export interface AccessTokenRequest {
  scopes: string[]
}

export interface AuthProvider {
  getUser(): Promise<AuthUser | undefined>
  signIn(): Promise<AuthUser>
  signOut(): Promise<void>
  getAccessToken(request: AccessTokenRequest): Promise<string>
}
