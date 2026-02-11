import type { ReasoningEffort } from './aiConfig'
import { getAiConfig } from './aiConfig'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatRequest = {
  messages: ChatMessage[]
  maxCompletionTokens?: number
  model?: string
  reasoningEffort?: ReasoningEffort
  timeoutMs?: number
}

export async function createChatCompletion(request: ChatRequest) {
  const config = getAiConfig()

  if (!config.apiUrl || !config.apiKey) {
    throw new Error('Configuracao de IA incompleta. Verifique o .env.local.')
  }

  const payload = {
    messages: request.messages,
    max_completion_tokens: request.maxCompletionTokens ?? config.maxCompletionTokens,
    model: request.model ?? config.model,
    reasoning_effort: request.reasoningEffort ?? config.reasoningEffort,
  }

  // Detect Azure endpoints to use correct auth header
  const isAzure = config.apiUrl.includes('.cognitiveservices.azure.com') ||
    config.apiUrl.includes('.openai.azure.com')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (isAzure) {
    headers['api-key'] = config.apiKey
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  // Abort controller with timeout (default 25s)
  const timeoutMs = request.timeoutMs ?? 25000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Timeout: IA nao respondeu em ${timeoutMs / 1000}s`)
    }
    throw err
  }
  clearTimeout(timer)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Falha na IA (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  // Log only errors/warnings — skip normal filter results
  if (data.choices?.[0]) {
    const choice = data.choices[0]
    if (choice.finish_reason === 'content_filter') {
      console.error('[AI] Response BLOCKED by content filter')
    }
    if (choice.finish_reason === 'length') {
      console.warn('[AI] Response truncated — token limit reached')
    }
    if (choice.message?.refusal) {
      console.error('[AI] Model refused:', choice.message.refusal)
    }
  }
  if (!data.choices && !data.output) {
    console.error('[AI] Unexpected response:', JSON.stringify(data).slice(0, 500))
  }

  return data
}
