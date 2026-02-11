export type ImageAiConfig = {
  apiUrl: string
  apiKey: string
  model: string
  aspectRatio: string
}

const defaultConfig: ImageAiConfig = {
  apiUrl: import.meta.env.VITE_IMG_AI_URL ?? '',
  apiKey: import.meta.env.VITE_IMG_AI_TOKEN ?? '',
  model: import.meta.env.VITE_IMG_AI_MODEL ?? 'grok-imagine-image',
  aspectRatio: import.meta.env.VITE_IMG_AI_ASPECT_RATIO ?? '9:16',
}

let currentConfig: ImageAiConfig = { ...defaultConfig }

export function getImageAiConfig() {
  return currentConfig
}

export function updateImageAiConfig(partial: Partial<ImageAiConfig>) {
  currentConfig = { ...currentConfig, ...partial }
}

export function resetImageAiConfig() {
  currentConfig = { ...defaultConfig }
}
