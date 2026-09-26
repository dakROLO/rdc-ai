export type MobileLocalMode =
  | 'apple-native-ready'
  | 'apple-native-unavailable'
  | 'ios-browser'
  | 'not-ios'

export interface MobileCapabilitySnapshot {
  mode: MobileLocalMode
  isIOS: boolean
  isStandaloneWebApp: boolean
  hasNativeAIHost: boolean
  detail: string
}

function detectIOS(): boolean {
  const userAgent = navigator.userAgent
  const platform = navigator.platform
  const maxTouchPoints = navigator.maxTouchPoints ?? 0

  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
}

export function getMobileCapabilitySnapshot(): MobileCapabilitySnapshot {
  const isIOS = detectIOS()
  const isStandaloneWebApp =
    window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const hasNativeAIHost = Boolean(window.crownKeepNativeAI)

  if (!isIOS) {
    return {
      mode: 'not-ios',
      isIOS,
      isStandaloneWebApp,
      hasNativeAIHost,
      detail: 'This device is not using the iPhone/iPad local-AI path.',
    }
  }

  if (hasNativeAIHost) {
    return {
      mode: 'apple-native-ready',
      isIOS,
      isStandaloneWebApp,
      hasNativeAIHost,
      detail:
        'CrownKeep is running inside its native Apple host and can inspect the on-device Foundation Model.',
    }
  }

  return {
    mode: 'ios-browser',
    isIOS,
    isStandaloneWebApp,
    hasNativeAIHost,
    detail:
      'Safari/PWA mode can use CrownKeep conversations, but Apple Foundation Models requires the native CrownKeep host.',
  }
}
