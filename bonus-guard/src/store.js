const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/db.json');

// Garante que o diretório existe
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    return { bonusUsers: {}, gameSessions: {}, alerts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { bonusUsers: {}, gameSessions: {}, alerts: [] };
  }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Interface simples
const db = {
  // Registra usuário com bônus ativo
  activateBonus(userId, data) {
    const state = load();
    state.bonusUsers[userId] = {
      userId,
      email: data.email,
      bonusId: data.bonusId,
      bonusName: data.bonusName,
      amount: data.amount,
      wagerRequirement: data.wagerRequirement,
      activatedAt: data.activatedAt,
      expiresAt: data.expiresAt,
      triggerType: data.triggerType,
      ip: data.ip_address,
      status: 'active',
    };
    if (!state.gameSessions[userId]) state.gameSessions[userId] = [];
    save(state);
  },

  // Registra sessão de jogo
  addGameSession(userId, gameData) {
    const state = load();
    if (!state.gameSessions[userId]) state.gameSessions[userId] = [];

    // Só registra sessões APÓS ativação do bônus
    const bonus = state.bonusUsers[userId];
    if (!bonus) return false; // usuário sem bônus, ignora

    state.gameSessions[userId].push({
      gameId: gameData.gameId,
      gameName: gameData.gameName,
      gameProvider: gameData.gameProvider,
      category: gameData.category,
      startedAt: gameData.startedAt,
      device: gameData.device,
    });
    save(state);
    return true;
  },

  // Retorna análise completa do usuário
  analyzeUser(userId) {
    const state = load();
    const bonus = state.bonusUsers[userId];
    const sessions = state.gameSessions[userId] || [];

    if (!bonus) return null;

    const totalSessions = sessions.length;
    const aviatorSessions = sessions.filter(s =>
      s.gameId?.toLowerCase().includes('aviator') ||
      s.gameName?.toLowerCase().includes('aviator')
    );
    const uniqueGames = [...new Set(sessions.map(s => s.gameId))];
    const uniqueProviders = [...new Set(sessions.map(s => s.gameProvider))];

    const aviatorPct = totalSessions > 0
      ? Math.round((aviatorSessions.length / totalSessions) * 100)
      : 0;

    const activatedAt = new Date(bonus.activatedAt);
    const hoursActive = (Date.now() - activatedAt.getTime()) / (1000 * 60 * 60);

    // Game breakdown para o relatório
    const gameCounts = {};
    sessions.forEach(s => {
      const key = s.gameName || s.gameId;
      gameCounts[key] = (gameCounts[key] || 0) + 1;
    });
    const gameBreakdown = Object.entries(gameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      bonus,
      sessions,
      totalSessions,
      aviatorSessions: aviatorSessions.length,
      aviatorPct,
      uniqueGames: uniqueGames.length,
      uniqueProviders: uniqueProviders.length,
      hoursActive: Math.round(hoursActive),
      gameBreakdown,
    };
  },

  // Marca como alertado (evita spam)
  markAlerted(userId, withdrawalData) {
    const state = load();
    state.alerts.push({
      userId,
      alertedAt: new Date().toISOString(),
      withdrawal: withdrawalData,
    });
    if (state.bonusUsers[userId]) {
      state.bonusUsers[userId].status = 'flagged';
    }
    save(state);
  },

  wasAlerted(userId) {
    const state = load();
    return state.alerts.some(a => a.userId === userId);
  },

  getBonusUser(userId) {
    return load().bonusUsers[userId] || null;
  },
};

module.exports = db;
