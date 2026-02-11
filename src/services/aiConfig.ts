export type ReasoningEffort = 'low' | 'medium' | 'high'

export type AiConfig = {
  apiUrl: string
  apiKey: string
  model: string
  maxCompletionTokens: number
  reasoningEffort: ReasoningEffort
}

const defaultConfig: AiConfig = {
  apiUrl: import.meta.env.VITE_AI_URL ?? '',
  apiKey: import.meta.env.VITE_AI_TOKEN ?? '',
  model: import.meta.env.VITE_AI_MODEL ?? 'gpt-5-nano',
  maxCompletionTokens: Number(import.meta.env.VITE_AI_MAX_TOKENS ?? 10000),
  reasoningEffort: (import.meta.env.VITE_AI_REASONING_EFFORT ??
    'medium') as ReasoningEffort,
}

let currentConfig: AiConfig = { ...defaultConfig }

export function getAiConfig() {
  return currentConfig
}

export function updateAiConfig(partial: Partial<AiConfig>) {
  currentConfig = { ...currentConfig, ...partial }
}

export function resetAiConfig() {
  currentConfig = { ...defaultConfig }
}
