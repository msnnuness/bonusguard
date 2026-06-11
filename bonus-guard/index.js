require('dotenv').config();
const express = require('express');
const db = require('./src/store');
const { calculateRisk } = require('./src/risk');
const { sendWithdrawalAlert } = require('./src/telegram');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// ─── Middleware de autenticação ───────────────────────────────────────────────
app.use('/webhook', (req, res, next) => {
  if (!WEBHOOK_SECRET) return next(); // sem secret configurado, passa

  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  if (secret !== WEBHOOK_SECRET) {
    console.warn(`[Auth] Requisição rejeitada — secret inválido de ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ─── Roteador de eventos ──────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: 'Payload inválido: faltam event ou data' });
  }

  console.log(`[Webhook] Recebido: ${event} — usuário: ${data.userId || 'desconhecido'}`);

  try {
    switch (event) {
      case 'bonus.activated':
        await handleBonusActivated(data);
        break;

      case 'game.started':
        await handleGameStarted(data);
        break;

      case 'payment.withdrawal.request':
        await handleWithdrawalRequest(data);
        break;

      default:
        console.log(`[Webhook] Evento ignorado: ${event}`);
    }

    res.json({ ok: true, event });
  } catch (err) {
    console.error(`[Webhook] Erro ao processar ${event}:`, err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleBonusActivated(data) {
  db.activateBonus(data.userId, data);
  console.log(`[BonusGuard] Bônus ativado — usuário ${data.userId} (${data.email}) — rollover R$${data.wagerRequirement}`);
}

async function handleGameStarted(data) {
  const registered = db.addGameSession(data.userId, data);

  if (registered) {
    const isAviator = data.gameId?.toLowerCase().includes('aviator') ||
                      data.gameName?.toLowerCase().includes('aviator');

    console.log(`[BonusGuard] Sessão registrada — ${data.gameName} — usuário ${data.userId}${isAviator ? ' ⚠️ AVIATOR' : ''}`);
  }
  // Se usuário não tem bônus ativo, ignora silenciosamente
}

async function handleWithdrawalRequest(data) {
  const userId = data.userId;
  const bonus = db.getBonusUser(userId);

  // Usuário sem bônus ativo → não interessa
  if (!bonus) {
    console.log(`[BonusGuard] Saque de usuário sem bônus ativo — ignorado (${userId})`);
    return;
  }

  // Já foi alertado nesta sessão de bônus → evita spam
  if (db.wasAlerted(userId)) {
    console.log(`[BonusGuard] Usuário ${userId} já foi alertado anteriormente — pulando`);
    return;
  }

  const analysis = db.analyzeUser(userId);
  const risk = calculateRisk(analysis);

  console.log(`[BonusGuard] Análise de risco — usuário ${userId} — score ${risk.score} (${risk.level})`);

  // Alerta para todos os níveis exceto baixo
  if (risk.level !== 'low') {
    await sendWithdrawalAlert({ analysis, risk, withdrawal: data });
    db.markAlerted(userId, data);
  } else {
    console.log(`[BonusGuard] Risco baixo — saque liberado sem alerta`);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BonusGuard',
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║         BONUS GUARD v1.0             ║
║  Detector de abuso de bônus Aviator  ║
╚══════════════════════════════════════╝
🚀 Rodando na porta ${PORT}
📡 Webhook: POST /webhook
❤️  Health: GET /health

Configurações ativas:
  Aviator dominance threshold: ${process.env.AVIATOR_DOMINANCE_THRESHOLD || 70}%
  Saque suspeito em até: ${process.env.MAX_HOURS_TO_WITHDRAW || 48}h
  Mínimo de jogos únicos: ${process.env.MIN_UNIQUE_GAMES || 2}
`);
});
