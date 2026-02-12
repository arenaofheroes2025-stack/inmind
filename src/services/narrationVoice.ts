/**
 * Narration Voice Service
 *
 * Connects to Azure OpenAI Realtime API via WebSocket to convert
 * narrative text into spoken audio for immersive RPG narration.
 *
 * Uses the same Azure credentials as the chat AI (from env vars).
 *
 * Flow:
 *   1. Connect WSS with api-key as query param
 *   2. Server sends session.created
 *   3. Client sends session.update (voice, instructions, etc.)
 *   4. Client sends conversation.item.create (text to narrate)
 *   5. Client sends response.create (trigger audio generation)
 *   6. Server streams response.audio.delta (base64 PCM16 chunks)
 *   7. Server sends response.audio.done → play assembled WAV
 */

import { getAiConfig } from './aiConfig'

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
export type NarrationStatus = 'idle' | 'connecting' | 'speaking' | 'error'

export interface NarrationCallbacks {
  onStatusChange?: (status: NarrationStatus) => void
  onError?: (error: string) => void
  onComplete?: () => void
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

/** Build the Realtime WebSocket URL from the existing Azure endpoint */
function buildRealtimeUrl(): string {
  const envUrl = import.meta.env.VITE_REALTIME_URL as string | undefined
  if (envUrl) return envUrl

  // Derive from the chat endpoint
  const config = getAiConfig()
  const url = new URL(config.apiUrl)
  const host = url.hostname
  const deployment = import.meta.env.VITE_REALTIME_DEPLOYMENT ?? 'gpt-realtime-mini'
  const apiVersion = import.meta.env.VITE_REALTIME_API_VERSION ?? '2025-04-01-preview'
  return `wss://${host}/openai/realtime?api-version=${apiVersion}&deployment=${deployment}`
}

/** Strip markdown/formatting but KEEP the visible text inside narrative tags [tag:texto] */
function cleanTextForVoice(text: string): string {
  return text
    // [tag:texto visível] → keep only the visible text
    .replace(/\[(\w+):([^\]]+)\]/g, '$2')
    // Remove markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown headers
    .replace(/^#+\s*/gm, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/** Convert base64 PCM16 audio chunks into playable WAV */
function pcm16ToWav(pcmChunks: ArrayBuffer[], sampleRate = 24000): Blob {
  const totalLength = pcmChunks.reduce((sum, c) => sum + c.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = merged.byteLength
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  view.setUint32(0, 0x52494646, false)        // "RIFF"
  view.setUint32(4, 36 + dataSize, true)
  view.setUint32(8, 0x57415645, false)        // "WAVE"
  view.setUint32(12, 0x666d7420, false)       // "fmt "
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)                 // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  view.setUint32(36, 0x64617461, false)       // "data"
  view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, headerSize).set(merged)

  return new Blob([buffer], { type: 'audio/wav' })
}

/* ──────────────────────────────────────────────
   Main narration function
   ────────────────────────────────────────────── */

let activeSocket: WebSocket | null = null
let activeAudio: HTMLAudioElement | null = null

/** Stop any currently playing narration */
export function stopNarration() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }
  if (activeSocket) {
    try { activeSocket.close() } catch { /* ignore */ }
    activeSocket = null
  }
}

/**
 * Narrate a text passage using Azure OpenAI Realtime API.
 * Returns a cleanup function to abort if needed.
 */
export function narrateText(
  text: string,
  callbacks?: NarrationCallbacks,
): () => void {
  stopNarration()

  const config = getAiConfig()
  const apiKey = config.apiKey
  if (!apiKey) {
    callbacks?.onError?.('API key não configurada')
    callbacks?.onStatusChange?.('error')
    return () => {}
  }

  const cleanText = cleanTextForVoice(text)
  if (!cleanText) {
    callbacks?.onComplete?.()
    return () => {}
  }

  callbacks?.onStatusChange?.('connecting')

  // Azure browser auth: api-key as query param (headers not available in browser WebSocket)
  const wsUrl = buildRealtimeUrl() + `&api-key=${encodeURIComponent(apiKey)}`
  console.log('[NarrationVoice] Connecting to:', wsUrl.replace(/api-key=[^&]+/, 'api-key=***'))

  let socket: WebSocket
  try {
    socket = new WebSocket(wsUrl)
  } catch (err) {
    console.error('[NarrationVoice] WebSocket constructor error:', err)
    callbacks?.onError?.('Falha ao conectar ao serviço de voz')
    callbacks?.onStatusChange?.('error')
    return () => {}
  }

  activeSocket = socket
  const audioChunks: ArrayBuffer[] = []
  let textSent = false

  socket.onopen = () => {
    console.log('[NarrationVoice] WebSocket conectado, aguardando session.created...')
  }

  /** Send the narration text after session is ready */
  function sendNarrationText() {
    if (textSent || socket.readyState !== WebSocket.OPEN) return
    textSent = true

    console.log('[NarrationVoice] Enviando texto para narrar...')

    // 1) Configure session
    socket.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: [
          'Você é um narrador profissional de histórias de RPG medieval em português brasileiro.',
          'Sua função é CONTAR A HISTÓRIA narrada no texto, como se estivesse contando para uma plateia ao redor de uma fogueira.',
          '',
          'REGRAS DE NARRAÇÃO:',
          '- Adapte sua emoção ao conteúdo: se é uma batalha, seja EMPOLGADO e INTENSO; se é suspense, use tom MISTERIOSO e LENTO; se é uma descoberta, demonstre ADMIRAÇÃO; se é tristeza ou perda, seja EMOTIVO e SOLENE.',
          '- Use pausas dramáticas naturais entre frases importantes.',
          '- Varie o ritmo: acelere em momentos de ação, desacelere em momentos de tensão e reflexão.',
          '- Dê ênfase emocional a palavras-chave como nomes de personagens, criaturas, lugares e acontecimentos marcantes.',
          '- Narre como um contador de histórias apaixonado — não como um robô lendo um texto.',
          '- Transmita a atmosfera da cena com sua voz: perigo, magia, esperança, medo, vitória.',
          '',
          'DIÁLOGOS:',
          '- Quando o texto tiver falas entre aspas (""), mude levemente o tom para diferenciar a fala do personagem da narração.',
          '- Retorne ao tom normal de narração após a fala.',
          '',
          'RESTRIÇÕES ABSOLUTAS:',
          '- Leia SOMENTE e EXATAMENTE o texto fornecido pelo usuário. NUNCA invente, adicione, resuma ou remova qualquer palavra.',
          '- NÃO faça introduções como "Bem-vindos" ou "Vamos lá". NÃO faça conclusões ou comentários.',
          '- NÃO repita o texto. Narre UMA única vez.',
          '- Sua única função é dar voz ao texto exato que receber — nada mais, nada menos.',
          '- Não quebre a imersão com comentários fora do contexto narrativo.',
          '- Fale apenas em português brasileiro.',
        ].join('\n'),
        voice: 'ash',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: null,
      },
    }))

    // 2) Create conversation item with the text
    socket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `LEIA EM VOZ ALTA SOMENTE O TEXTO ABAIXO. Não adicione nenhuma palavra antes, durante ou depois. Apenas narre com emoção o que está escrito:\n\n${cleanText}`,
        }],
      },
    }))

    // 3) Trigger response generation (audio only)
    socket.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
      },
    }))
  }

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)

      // Log all events except high-frequency deltas
      if (msg.type !== 'response.audio.delta' && msg.type !== 'response.audio_transcript.delta') {
        console.log('[NarrationVoice] Evento:', msg.type, msg.type === 'error' ? msg.error : '')
      }

      switch (msg.type) {
        case 'session.created':
          console.log('[NarrationVoice] Sessão criada, configurando...')
          sendNarrationText()
          break

        case 'session.updated':
          console.log('[NarrationVoice] Sessão atualizada')
          break

        case 'response.audio.delta':
          if (!audioChunks.length) {
            callbacks?.onStatusChange?.('speaking')
            console.log('[NarrationVoice] Primeiro chunk de áudio recebido')
          }
          if (msg.delta) {
            const binary = atob(msg.delta)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            audioChunks.push(bytes.buffer)
          }
          break

        case 'response.audio.done': {
          console.log('[NarrationVoice] Áudio completo, chunks:', audioChunks.length, 'bytes totais:', audioChunks.reduce((s, c) => s + c.byteLength, 0))
          
          if (audioChunks.length > 0) {
            try {
              // Use AudioContext for reliable PCM16 playback
              const actx = new AudioContext({ sampleRate: 24000 })
              const totalLen = audioChunks.reduce((s, c) => s + c.byteLength, 0)
              const merged = new Uint8Array(totalLen)
              let off = 0
              for (const chunk of audioChunks) {
                merged.set(new Uint8Array(chunk), off)
                off += chunk.byteLength
              }

              // PCM16 → Float32 for Web Audio API
              const samples = totalLen / 2
              const float32 = new Float32Array(samples)
              const dv = new DataView(merged.buffer)
              for (let i = 0; i < samples; i++) {
                float32[i] = dv.getInt16(i * 2, true) / 32768
              }

              const audioBuffer = actx.createBuffer(1, samples, 24000)
              audioBuffer.getChannelData(0).set(float32)

              const source = actx.createBufferSource()
              source.buffer = audioBuffer
              source.connect(actx.destination)

              console.log('[NarrationVoice] Reproduzindo áudio, duração:', (samples / 24000).toFixed(1), 's')

              source.onended = () => {
                actx.close()
                activeAudio = null
                callbacks?.onStatusChange?.('idle')
                callbacks?.onComplete?.()
              }

              source.start()
              // Store reference for stop functionality
              activeAudio = { pause: () => { source.stop(); actx.close() }, src: '' } as unknown as HTMLAudioElement
            } catch (audioErr) {
              console.error('[NarrationVoice] Erro AudioContext:', audioErr)
              // Fallback: WAV blob
              const wavBlob = pcm16ToWav(audioChunks)
              const url = URL.createObjectURL(wavBlob)
              const audio = new Audio(url)
              activeAudio = audio
              audio.volume = 1.0
              audio.onended = () => {
                URL.revokeObjectURL(url)
                activeAudio = null
                callbacks?.onStatusChange?.('idle')
                callbacks?.onComplete?.()
              }
              audio.onerror = (e) => {
                console.error('[NarrationVoice] Audio playback error:', e)
                URL.revokeObjectURL(url)
                activeAudio = null
                callbacks?.onStatusChange?.('error')
                callbacks?.onError?.('Erro ao reproduzir áudio')
              }
              audio.play().catch((e) => {
                console.error('[NarrationVoice] Play blocked:', e)
                callbacks?.onStatusChange?.('error')
                callbacks?.onError?.('Navegador bloqueou reprodução de áudio')
              })
            }
          } else {
            console.warn('[NarrationVoice] Nenhum chunk de áudio recebido')
            callbacks?.onStatusChange?.('idle')
            callbacks?.onComplete?.()
          }
          try { socket.close() } catch { /* ignore */ }
          activeSocket = null
          break
        }

        case 'response.done':
          console.log('[NarrationVoice] Response finalizada, chunks acumulados:', audioChunks.length)
          if (audioChunks.length === 0) {
            callbacks?.onStatusChange?.('idle')
            callbacks?.onComplete?.()
            try { socket.close() } catch { /* ignore */ }
            activeSocket = null
          }
          break

        case 'error':
          console.error('[NarrationVoice] API error:', msg.error)
          callbacks?.onError?.(msg.error?.message || 'Erro na API de voz')
          callbacks?.onStatusChange?.('error')
          try { socket.close() } catch { /* ignore */ }
          activeSocket = null
          break
      }
    } catch (err) {
      console.error('[NarrationVoice] Parse error:', err)
    }
  }

  socket.onerror = (ev) => {
    console.error('[NarrationVoice] WebSocket error:', ev)
    callbacks?.onError?.('Erro de conexão com o serviço de voz')
    callbacks?.onStatusChange?.('error')
    activeSocket = null
  }

  socket.onclose = (ev) => {
    console.log('[NarrationVoice] WebSocket fechado, code:', ev.code, 'reason:', ev.reason)
    activeSocket = null
  }

  return () => stopNarration()
}
