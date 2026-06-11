// Motor de pontuação de risco
// Retorna { score: 0-100, level: 'low'|'medium'|'high'|'critical', flags: [] }

const AVIATOR_DOMINANCE_THRESHOLD = parseInt(process.env.AVIATOR_DOMINANCE_THRESHOLD || '70');
const MAX_HOURS_TO_WITHDRAW = parseInt(process.env.MAX_HOURS_TO_WITHDRAW || '48');
const MIN_UNIQUE_GAMES = parseInt(process.env.MIN_UNIQUE_GAMES || '2');

function calculateRisk(analysis) {
  let score = 0;
  const flags = [];

  // 1. Dominância no Aviator (peso: até 45 pontos)
  if (analysis.aviatorPct >= 90) {
    score += 45;
    flags.push(`🚨 ${analysis.aviatorPct}% das sessões foram no Aviator`);
  } else if (analysis.aviatorPct >= AVIATOR_DOMINANCE_THRESHOLD) {
    score += 30;
    flags.push(`⚠️ ${analysis.aviatorPct}% das sessões foram no Aviator`);
  } else if (analysis.aviatorPct >= 50) {
    score += 15;
    flags.push(`📊 ${analysis.aviatorPct}% das sessões no Aviator (acima da média)`);
  }

  // 2. Poucos jogos únicos (peso: até 25 pontos)
  if (analysis.uniqueGames === 1) {
    score += 25;
    flags.push(`🚨 Jogou em apenas 1 jogo durante todo o bônus`);
  } else if (analysis.uniqueGames < MIN_UNIQUE_GAMES) {
    score += 15;
    flags.push(`⚠️ Apenas ${analysis.uniqueGames} jogos diferentes durante o bônus`);
  }

  // 3. Saque muito rápido (peso: até 20 pontos)
  if (analysis.hoursActive < 2) {
    score += 20;
    flags.push(`🚨 Saque solicitado ${analysis.hoursActive}h após ativar o bônus`);
  } else if (analysis.hoursActive < MAX_HOURS_TO_WITHDRAW) {
    score += 10;
    flags.push(`⚠️ Saque em ${analysis.hoursActive}h (padrão rápido)`);
  }

  // 4. Poucas sessões totais (peso: até 10 pontos)
  if (analysis.totalSessions <= 3 && analysis.aviatorSessions > 0) {
    score += 10;
    flags.push(`📊 Apenas ${analysis.totalSessions} sessão(ões) total durante o bônus`);
  }

  // Sem nenhuma sessão registrada
  if (analysis.totalSessions === 0) {
    score = 5;
    flags.push(`ℹ️ Nenhuma sessão de jogo registrada durante o bônus`);
  }

  // Determina nível
  let level;
  if (score >= 70) level = 'critical';
  else if (score >= 45) level = 'high';
  else if (score >= 20) level = 'medium';
  else level = 'low';

  return { score: Math.min(score, 100), level, flags };
}

module.exports = { calculateRisk };
