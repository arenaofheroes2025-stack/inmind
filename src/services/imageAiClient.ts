import { getImageAiConfig } from './imageAiConfig'

export type ImageGenerationResponse = {
  data: Array<{
    url: string
    revised_prompt?: string
  }>
}

const MAX_IMAGE_RETRIES = 4

export async function createImage(prompt: string, options?: { aspectRatio?: string }) {
  const config = getImageAiConfig()

  if (!config.apiUrl || !config.apiKey) {
    throw new Error('Configuracao de IA de imagem incompleta. Verifique o .env.local.')
  }

  const payload = {
    model: config.model,
    prompt,
    aspect_ratio: options?.aspectRatio ?? config.aspectRatio,
  }

  for (let attempt = 1; attempt <= MAX_IMAGE_RETRIES; attempt++) {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return response.json() as Promise<ImageGenerationResponse>
    }

    const errorText = await response.text()

    // Retry on 429 (rate limit) with exponential backoff
    if (response.status === 429 && attempt < MAX_IMAGE_RETRIES) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000) // 2s, 4s, 8s, max 30s
      console.warn(`[ImageAI] 429 rate-limited (attempt ${attempt}/${MAX_IMAGE_RETRIES}), retrying in ${delay / 1000}s...`)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }

    throw new Error(`Falha na IA de imagem (${response.status}): ${errorText}`)
  }

  throw new Error('Falha na IA de imagem: tentativas esgotadas.')
}
