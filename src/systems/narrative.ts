export type RollOutcome = 'critical-fail' | 'fail' | 'partial' | 'success' | 'critical'

export type Choice = {
  id: string
  description: string
  primaryAttribute: string
  difficulty: number
  riskLevel: 'low' | 'medium' | 'high'
}

export type Scene = {
  title: string
  description: string
  choices: Choice[]
}

export function formatOutcome(outcome: RollOutcome) {
  switch (outcome) {
    case 'critical-fail':
      return 'Falha critica com consequencias duradouras.'
    case 'fail':
      return 'Falha. O mundo reage contra voce.'
    case 'partial':
      return 'Sucesso parcial. Voce ganha, mas paga um preco.'
    case 'success':
      return 'Sucesso. A historia se inclina a seu favor.'
    case 'critical':
      return 'Sucesso critico. Uma porta se abre mais.'
    default:
      return 'O resultado nao esta claro.'
  }
}

export function buildScene(locationName: string, questTitles: string[]): Scene {
  const choices: Choice[] = questTitles.slice(0, 3).map((title, index) => ({
    id: `choice-${index + 1}`,
    description: `Investigar: ${title}`,
    primaryAttribute: 'intelecto',
    difficulty: 12 + index * 2,
    riskLevel: index === 2 ? 'high' : index === 1 ? 'medium' : 'low',
  }))

  if (choices.length === 0) {
    choices.push({
      id: 'choice-1',
      description: 'Explorar o local com cautela',
      primaryAttribute: 'percepcao',
      difficulty: 12,
      riskLevel: 'medium',
    })
  }

  return {
    title: `Cena em ${locationName}`,
    description:
      'A atmosfera pesa e cada detalhe importa. Escolha uma acao para seguir.',
    choices,
  }
}

export function summarizeChoice(choice: Choice, outcome: RollOutcome) {
  return `${choice.description} -> ${formatOutcome(outcome)}`
}
