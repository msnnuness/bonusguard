const TelegramBot = require('node-telegram-bot-api');

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
}

function riskEmoji(level) {
  return { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[level] || '⚪';
}

function riskLabel(level) {
  return { low: 'BAIXO', medium: 'MÉDIO', high: 'ALTO', critical: 'CRÍTICO' }[level] || level;
}

async function sendWithdrawalAlert({ analysis, risk, withdrawal }) {
  const b = getBot();
  if (!b) {
    console.warn('[Telegram] Bot não configurado — alerta não enviado');
    return;
  }

  const { bonus, gameBreakdown, totalSessions, aviatorSessions, aviatorPct, uniqueGames, hoursActive } = analysis;

  // Tabela de jogos
  const gameTable = gameBreakdown.length > 0
    ? gameBreakdown.map(([name, count]) => `  • ${name}: ${count}x`).join('\n')
    : '  (nenhuma sessão registrada)';

  const message = `
${riskEmoji(risk.level)} *ALERTA DE SAQUE SUSPEITO — BÔNUS*
━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Usuário:* ${bonus.email}
🆔 *ID:* \`${bonus.userId}\`

💰 *SAQUE SOLICITADO*
  Valor: R$ ${withdrawal.amount?.toFixed(2)}
  Método: ${withdrawal.paymentMethod?.toUpperCase()}
  Status: ${withdrawal.status}

🎁 *BÔNUS ATIVO*
  Nome: ${bonus.bonusName}
  Valor: R$ ${bonus.amount}
  Rollover: R$ ${bonus.wagerRequirement}
  Ativado há: ${hoursActive}h

🎮 *COMPORTAMENTO DE JOGO*
  Sessões totais: ${totalSessions}
  Sessões no Aviator: ${aviatorSessions} (${aviatorPct}%)
  Jogos únicos: ${uniqueGames}

📊 *TOP JOGOS:*
${gameTable}

⚠️ *FATORES DE RISCO:*
${risk.flags.map(f => `  ${f}`).join('\n')}

${riskEmoji(risk.level)} *RISCO: ${riskLabel(risk.level)} (${risk.score}/100)*
━━━━━━━━━━━━━━━━━━━━━━━━
Revise e decida no painel antes de aprovar.
`.trim();

  await b.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
    parse_mode: 'Markdown',
  });

  console.log(`[Telegram] Alerta enviado para usuário ${bonus.userId} — risco ${risk.level} (${risk.score})`);
}

module.exports = { sendWithdrawalAlert };
