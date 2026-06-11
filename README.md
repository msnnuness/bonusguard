# 🛡️ BonusGuard

Sistema de detecção automática de abuso de bônus no Aviator.

## Como funciona

```
[Plataforma] → webhook → [BonusGuard] → análise → [Telegram]
```

1. **`bonus.activated`** → marca o usuário como "em monitoramento"
2. **`game.started`** → registra cada jogo aberto durante o período de bônus
3. **`payment.withdrawal.request`** → calcula score de risco e envia alerta no Telegram

---

## Instalação

### 1. Pré-requisitos
- Node.js 18+ instalado no servidor
- Um bot do Telegram criado (via [@BotFather](https://t.me/BotFather))

### 2. Criar o bot no Telegram

1. Abra o Telegram e fale com `@BotFather`
2. Digite `/newbot` e siga as instruções
3. Copie o **token** gerado (formato: `123456:ABCdef...`)
4. Para pegar o **Chat ID**: fale com `@userinfobot` ou adicione o bot a um grupo e use a API

### 3. Configurar o ambiente

```bash
cp .env.example .env
nano .env
```

Preencha:
```env
TELEGRAM_BOT_TOKEN=123456:SeuTokenAqui
TELEGRAM_CHAT_ID=-100123456789   # ID do grupo ou chat
WEBHOOK_SECRET=uma_senha_segura_qualquer
PORT=3000
```

### 4. Instalar e iniciar

```bash
npm install
node index.js
```

Para rodar em produção com reinício automático:
```bash
npm install -g pm2
pm2 start index.js --name bonus-guard
pm2 save
pm2 startup
```

---

## Configurar os Webhooks na plataforma

Na sua white label, configure 3 webhooks apontando para:

```
URL: http://SEU_SERVIDOR:3000/webhook
Header: x-webhook-secret: sua_senha_configurada
```

Eventos a configurar:
- `bonus.activated`
- `game.started`
- `payment.withdrawal.request`

---

## Score de Risco

| Score | Nível | Ação |
|-------|-------|------|
| 0–19 | 🟢 Baixo | Sem alerta |
| 20–44 | 🟡 Médio | Alerta no Telegram |
| 45–69 | 🟠 Alto | Alerta no Telegram |
| 70–100 | 🔴 Crítico | Alerta urgente |

### Fatores analisados

| Fator | Peso máximo |
|-------|-------------|
| % de sessões no Aviator | 45 pts |
| Poucos jogos únicos | 25 pts |
| Saque muito rápido | 20 pts |
| Poucas sessões totais | 10 pts |

---

## Ajustar os limites

No arquivo `.env`:

```env
# Aviator: % de sessões para considerar suspeito
AVIATOR_DOMINANCE_THRESHOLD=70

# Quantas horas para saque ser "suspeito"
MAX_HOURS_TO_WITHDRAW=48

# Mínimo de jogos diferentes para não suspeitar
MIN_UNIQUE_GAMES=2
```

---

## Exemplo de alerta no Telegram

```
🔴 ALERTA DE SAQUE SUSPEITO — BÔNUS
━━━━━━━━━━━━━━━━━━━━━━━━
👤 Usuário: usuario@email.com
🆔 ID: 507f1f77bcf86cd799439011

💰 SAQUE SOLICITADO
  Valor: R$ 150.00
  Método: PIX
  Status: pending

🎁 BÔNUS ATIVO
  Nome: Bônus de Boas-vindas
  Valor: R$ 50
  Rollover: R$ 500
  Ativado há: 3h

🎮 COMPORTAMENTO DE JOGO
  Sessões totais: 4
  Sessões no Aviator: 4 (100%)
  Jogos únicos: 1

📊 TOP JOGOS:
  • Aviator: 4x

⚠️ FATORES DE RISCO:
  🚨 100% das sessões foram no Aviator
  🚨 Jogou em apenas 1 jogo durante todo o bônus
  🚨 Saque solicitado 3h após ativar o bônus

🔴 RISCO: CRÍTICO (90/100)
━━━━━━━━━━━━━━━━━━━━━━━━
Revise e decida no painel antes de aprovar.
```
