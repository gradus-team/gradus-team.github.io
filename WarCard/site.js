// ========== WAR CARDS v9 ==========
// Полная версия с рангами, бонусами бота, магазином, кристаллами и улучшенным ИИ

const CONFIG = {
    FIELD_W: 5,
    FIELD_H: 6,
    MAX_CARDS_PER_TYPE: 4,
    BASE_HP: 100,
    STARTING_COINS: 15,
    COINS_MIN: 5,
    COINS_MAX: 15,
    CARDS_PER_TURN_MIN: 1,
    CARDS_PER_TURN_MAX: 3,
    PLAYER_ROWS: [3,4,5],
    BOT_ROWS: [0,1,2],
    SPRITE_PATH: 'sprites/',
    // Кристаллы
    CRYSTALS_PER_KILL_BASE: 1,
    CRYSTALS_PER_10_DMG: 5,
    SHOP_COST_RANDOM: 3,
    SHOP_COST_RANK_2_3: 5,
    SHOP_COST_RANK_5: 10,
    // Штрафы и бонусы
    PENALTY_HARD: 0.05,
    PENALTY_EXTREME: 0.15,
    BONUS_TURN_25_COINS: 10,
    BONUS_TURN_25_CARDS: 2,
    // Опыт за победы/поражения
    XP_WIN_EASY: 50,
    XP_WIN_MEDIUM: 150,
    XP_WIN_HARD: 300,
    XP_WIN_EXTREME: 700,
    XP_LOSS_PENALTY: 0.5, // 50% от опыта за победу
};

// ---------- СИСТЕМА РАНГОВ ----------
const RANK_SYSTEM = [
    { name: 'Bronze 1', emoji: '🥉', xpRequired: 0 },
    { name: 'Bronze 2', emoji: '🥉', xpRequired: 50 },
    { name: 'Bronze 3', emoji: '🥉', xpRequired: 150 },
    { name: 'Bronze 4', emoji: '🥉', xpRequired: 300 },
    { name: 'Bronze 5', emoji: '🥉', xpRequired: 500 },
    { name: 'Silver 1', emoji: '🥈', xpRequired: 1000 },
    { name: 'Silver 2', emoji: '🥈', xpRequired: 1500 },
    { name: 'Silver 3', emoji: '🥈', xpRequired: 2100 },
    { name: 'Silver 4', emoji: '🥈', xpRequired: 2800 },
    { name: 'Silver 5', emoji: '🥈', xpRequired: 3600 },
    { name: 'Gold 1', emoji: '🥇', xpRequired: 4500 },
    { name: 'Gold 2', emoji: '🥇', xpRequired: 5500 },
    { name: 'Gold 3', emoji: '🥇', xpRequired: 6600 },
    { name: 'Gold 4', emoji: '🥇', xpRequired: 7800 },
    { name: 'Gold 5', emoji: '🥇', xpRequired: 9100 },
    { name: 'Platinum 1', emoji: '💠', xpRequired: 10500 },
    { name: 'Platinum 2', emoji: '💠', xpRequired: 12000 },
    { name: 'Platinum 3', emoji: '💠', xpRequired: 13600 },
    { name: 'Platinum 4', emoji: '💠', xpRequired: 15300 },
    { name: 'Diamond 1', emoji: '💎', xpRequired: 17100 },
    { name: 'Diamond 2', emoji: '💎', xpRequired: 19000 },
    { name: 'Diamond 3', emoji: '💎', xpRequired: 21000 },
    { name: 'Champion 1', emoji: '🏆', xpRequired: 30000 },
    { name: 'Champion 2', emoji: '🏆', xpRequired: 50000 },
    { name: 'The Legend', emoji: '🌍', xpRequired: 100000 },
];

// ---------- ГЕНЕРАЦИЯ КАРТ ----------
function generateCardPool() {
    const pool = [];
    const spriteMap = {
        'Танк': 'tank.png', 'Солдат': 'soldier.png', 'Штурмовик': 'assault.png',
        'Десантник': 'paratrooper.png', 'Снайпер': 'sniper.png', 'БТР': 'apc.png',
        'Бункер': 'bunker.png', 'Щит': 'shield.png', 'Крепость': 'fortress.png',
        'Броня': 'armor.png', 'Укрытие': 'shelter.png', 'ДОТ': 'pillbox.png',
        'ПВО': 'aa.png', 'Зенитка': 'aa.png',
        'Ракета': 'rocket.png', 'Истребитель': 'fighter.png', 'Бомбардировщик': 'bomber.png',
        'Дрон': 'drone.png', 'Артиллерия': 'artillery.png', 'Кинжал': 'dagger.png',
        'АЭС': 'nuclear.png', 'Банк': 'bank.png', 'Нефтяная вышка': 'oilrig.png',
        'Фабрика': 'factory.png', 'Порт': 'port.png', 'Рынок': 'market.png',
    };

    const types = [
        { id: 'attack',   names: ['Танк', 'Солдат', 'Штурмовик', 'Десантник', 'Снайпер', 'БТР'] },
        { id: 'defense',  names: ['Бункер', 'Щит', 'Крепость', 'Броня', 'Укрытие', 'ДОТ', 'ПВО', 'Зенитка'] },
        { id: 'support',  names: ['Ракета', 'Истребитель', 'Бомбардировщик', 'Дрон', 'Артиллерия', 'Кинжал'] },
        { id: 'economy',  names: ['АЭС', 'Банк', 'Нефтяная вышка', 'Фабрика', 'Порт', 'Рынок'] }
    ];

    for (const t of types) {
        for (let rank = 0; rank <= 5; rank++) {
            for (let variant = 0; variant < 3; variant++) {
                const nameIndex = (rank * 3 + variant) % t.names.length;
                let baseName = t.names[nameIndex];
                let isAA = false;
                if (t.id === 'defense' && (baseName === 'ПВО' || baseName === 'Зенитка')) {
                    isAA = true;
                    if (rank < 3) continue;
                }
                let name = baseName;
                if (variant > 0) name += ` ${variant+1}`;
                let spriteFile = spriteMap[baseName] || 'default.png';
                let baseAtk = 0, baseDef = 0, baseHp = 0, baseCost = 0;
                const randomFactor = () => 0.8 + Math.random() * 0.4;
                switch (t.id) {
                    case 'attack':
                        baseAtk = Math.round((3 + rank * 2.5) * randomFactor());
                        baseDef = Math.round((0 + rank * 0.5) * randomFactor());
                        baseHp = Math.round((2 + rank * 1.5) * randomFactor());
                        baseCost = Math.round((3 + rank * 2) * randomFactor());
                        break;
                    case 'defense':
                        baseAtk = Math.round((1 + rank * 0.8) * randomFactor());
                        baseDef = Math.round((3 + rank * 2.5) * randomFactor());
                        baseHp = Math.round((5 + rank * 3) * randomFactor());
                        baseCost = Math.round((4 + rank * 2) * randomFactor());
                        break;
                    case 'support':
                        baseAtk = Math.round((5 + rank * 3) * randomFactor());
                        baseDef = 0;
                        baseHp = 1;
                        baseCost = Math.round((5 + rank * 3) * randomFactor());
                        break;
                    case 'economy':
                        baseAtk = 0;
                        baseDef = Math.round((1 + rank * 1) * randomFactor());
                        baseHp = Math.round((6 + rank * 4) * randomFactor());
                        baseCost = Math.round((6 + rank * 2) * randomFactor());
                        break;
                }
                pool.push({
                    id: `${t.id}_${rank}_${variant}`,
                    type: t.id,
                    rank: rank,
                    name: name,
                    baseName: baseName,
                    sprite: spriteFile,
                    attack: Math.max(0, baseAtk),
                    defense: Math.max(0, baseDef),
                    hp: Math.max(1, baseHp),
                    maxHp: Math.max(1, baseHp),
                    cost: Math.max(1, baseCost),
                    isAA: isAA,
                });
            }
        }
    }
    return pool;
}

// ---------- ОСНОВНОЙ КЛАСС ИГРЫ ----------
class WarCardsGame {
    constructor() {
        this.cardPool = generateCardPool();
        this.field = this.initField();
        this.player = { hand: [], coins: 0, baseHp: CONFIG.BASE_HP, placedCards: [] };
        this.bot = { hand: [], coins: 0, baseHp: CONFIG.BASE_HP, placedCards: [] };
        this.turn = 0;
        this.phase = 'idle';
        this.selectedCardId = null;
        this.gameOver = false;
        this.isAnimating = false;
        this.logs = [];
        this.logsPerTurn = {};
        this.difficulty = 'medium';
        this.win = false;

        // Кристаллы и магазин
        this.crystals = 0;
        this.damageToBotBase = 0;

        // Бонусные карты для бота
        this.botKillCounter = 0;
        this.botPendingBonusCard = null;

        // Ранги и опыт
        this.xp = 0;
        this.rankIndex = 0; // индекс в RANK_SYSTEM

        this.initField();
        this.loadProgress();
    }

    initField() {
        const field = [];
        for (let r = 0; r < CONFIG.FIELD_H; r++) {
            field[r] = [];
            for (let c = 0; c < CONFIG.FIELD_W; c++) {
                field[r][c] = null;
            }
        }
        return field;
    }

    // ---------- ВСПОМОГАТЕЛЬНЫЕ ----------
    getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

    drawRandomCards(count, excludeTypes = [], minRank = 0, maxRank = 5) {
        const available = this.cardPool.filter(c =>
            !excludeTypes.includes(c.type) && c.rank >= minRank && c.rank <= maxRank
        );
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (available.length === 0) break;
            const idx = this.getRandomInt(0, available.length - 1);
            const card = { ...available[idx] };
            card.hp = card.maxHp;
            drawn.push(card);
        }
        return drawn;
    }

    canAddCardToHand(player, cardType) {
        const count = player.hand.filter(c => c.type === cardType).length;
        return count < CONFIG.MAX_CARDS_PER_TYPE;
    }

    addCardsToPlayer(player, cards) {
        for (const card of cards) {
            if (this.canAddCardToHand(player, card.type)) {
                player.hand.push(card);
            }
        }
    }

    getStartingCards() {
        const types = ['attack', 'defense', 'support', 'economy'];
        const cards = [];
        for (const type of types) {
            const rank = this.getRandomInt(0, 1);
            const pool = this.cardPool.filter(c => c.type === type && c.rank === rank);
            if (pool.length > 0) {
                const idx = this.getRandomInt(0, pool.length - 1);
                const card = { ...pool[idx] };
                card.hp = card.maxHp;
                cards.push(card);
            }
        }
        return cards;
    }

    // ---------- ЗАГРУЗКА / СОХРАНЕНИЕ ПРОГРЕССА ----------
    async loadProgress() {
        try {
            const data = await GradusDB.get('warcards_progress') || {
                xp: 0,
                rankIndex: 0,
                stats: {
                    easy: { wins: 0, losses: 0 },
                    medium: { wins: 0, losses: 0 },
                    hard: { wins: 0, losses: 0 },
                    extreme: { wins: 0, losses: 0 },
                    total: { wins: 0, losses: 0 }
                }
            };
            this.xp = data.xp || 0;
            this.rankIndex = data.rankIndex || 0;
            this.stats = data.stats || {
                easy: { wins: 0, losses: 0 },
                medium: { wins: 0, losses: 0 },
                hard: { wins: 0, losses: 0 },
                extreme: { wins: 0, losses: 0 },
                total: { wins: 0, losses: 0 }
            };
            // Обновляем ранг, если он изменился
            this.updateRank();
        } catch(e) {
            console.warn('Не удалось загрузить прогресс:', e);
            this.xp = 0;
            this.rankIndex = 0;
            this.stats = {
                easy: { wins: 0, losses: 0 },
                medium: { wins: 0, losses: 0 },
                hard: { wins: 0, losses: 0 },
                extreme: { wins: 0, losses: 0 },
                total: { wins: 0, losses: 0 }
            };
        }
        this.updateProfileModal();
        this.updateRankDisplay();
    }

    async saveProgress() {
        try {
            const data = {
                xp: this.xp,
                rankIndex: this.rankIndex,
                stats: this.stats,
            };
            await GradusDB.set('warcards_progress', data);
        } catch(e) {
            console.warn('Не удалось сохранить прогресс:', e);
        }
    }

    // ---------- СИСТЕМА РАНГОВ ----------
    getCurrentRank() {
        return RANK_SYSTEM[this.rankIndex] || RANK_SYSTEM[0];
    }

    updateRank() {
        let newIndex = 0;
        for (let i = RANK_SYSTEM.length - 1; i >= 0; i--) {
            if (this.xp >= RANK_SYSTEM[i].xpRequired) {
                newIndex = i;
                break;
            }
        }
        if (newIndex !== this.rankIndex) {
            const oldRank = this.getCurrentRank();
            this.rankIndex = newIndex;
            const newRank = this.getCurrentRank();
            if (newRank.xpRequired > oldRank.xpRequired) {
                GradusWeb.notify.success(`🏆 Повышение ранга! ${newRank.emoji} ${newRank.name}`, 4000);
                this.addLog(`🏆 Повышение ранга: ${oldRank.name} → ${newRank.name}`, this.turn);
            }
            this.saveProgress();
        }
        this.updateRankDisplay();
    }

    updateRankDisplay() {
        const rank = this.getCurrentRank();
        const span = document.getElementById('rank-display');
        if (span) span.textContent = `${rank.emoji} ${rank.name}`;
        const xpSpan = document.getElementById('xp-display');
        if (xpSpan) xpSpan.textContent = `${this.xp} XP`;
        // XP прогресс
        const nextRank = RANK_SYSTEM[Math.min(this.rankIndex + 1, RANK_SYSTEM.length - 1)];
        const currentReq = RANK_SYSTEM[this.rankIndex].xpRequired;
        const nextReq = nextRank.xpRequired;
        const progress = nextReq > currentReq ? (this.xp - currentReq) / (nextReq - currentReq) : 1;
        const bar = document.getElementById('xp-progress-bar');
        if (bar) {
            bar.style.width = Math.min(100, Math.round(progress * 100)) + '%';
        }
        const label = document.getElementById('xp-progress-label');
        if (label) {
            label.textContent = `${this.xp} / ${nextReq} XP`;
        }
    }

    addXP(amount) {
        this.xp = Math.max(0, this.xp + amount);
        this.updateRank();
        this.saveProgress();
        this.updateRankDisplay();
        this.updateProfileModal();
    }

    // ---------- СТАТИСТИКА (обновлена для работы с рангами) ----------
    async updateStats(won) {
        const diff = this.difficulty;
        if (!this.stats[diff]) this.stats[diff] = { wins: 0, losses: 0 };
        if (won) {
            this.stats[diff].wins++;
            this.stats.total.wins++;
            // Начисляем опыт за победу
            let xpEarned = 0;
            switch (diff) {
                case 'easy': xpEarned = CONFIG.XP_WIN_EASY; break;
                case 'medium': xpEarned = CONFIG.XP_WIN_MEDIUM; break;
                case 'hard': xpEarned = CONFIG.XP_WIN_HARD; break;
                case 'extreme': xpEarned = CONFIG.XP_WIN_EXTREME; break;
                default: xpEarned = 0;
            }
            this.addXP(xpEarned);
            GradusWeb.notify.success(`✨ +${xpEarned} опыта!`, 2000);
        } else {
            this.stats[diff].losses++;
            this.stats.total.losses++;
            // Штраф за поражение (50% от опыта за победу на этой сложности)
            let xpLost = 0;
            switch (diff) {
                case 'easy': xpLost = Math.floor(CONFIG.XP_WIN_EASY * CONFIG.XP_LOSS_PENALTY); break;
                case 'medium': xpLost = Math.floor(CONFIG.XP_WIN_MEDIUM * CONFIG.XP_LOSS_PENALTY); break;
                case 'hard': xpLost = Math.floor(CONFIG.XP_WIN_HARD * CONFIG.XP_LOSS_PENALTY); break;
                case 'extreme': xpLost = Math.floor(CONFIG.XP_WIN_EXTREME * CONFIG.XP_LOSS_PENALTY); break;
                default: xpLost = 0;
            }
            if (xpLost > 0) {
                this.addXP(-xpLost);
                GradusWeb.notify.warning(`💔 -${xpLost} опыта за поражение`, 2000);
            }
        }
        await this.saveProgress();
        this.updateProfileModal();
    }

    // ---------- НАЧАЛО ХОДА ----------
    startTurn() {
        if (this.gameOver || this.phase === 'battle' || this.isAnimating) return;
        this.turn++;
        this.phase = 'placement';
        this.selectedCardId = null;

        if (this.turn === 1) {
            this.addLog(`--- Ход ${this.turn} (стартовый) ---`, this.turn);
            this.addLog('Стартовый ход: ресурсы не выдаются.', this.turn);
        } else {
            let pCoins = this.getRandomInt(CONFIG.COINS_MIN, CONFIG.COINS_MAX);
            let bCoins = this.getRandomInt(CONFIG.COINS_MIN, CONFIG.COINS_MAX);

            if (this.difficulty === 'hard') {
                pCoins = Math.floor(pCoins * (1 - CONFIG.PENALTY_HARD));
                bCoins = Math.floor(bCoins * (1 - CONFIG.PENALTY_HARD));
            } else if (this.difficulty === 'extreme') {
                pCoins = Math.floor(pCoins * (1 - CONFIG.PENALTY_EXTREME));
                bCoins = Math.floor(bCoins * (1 - CONFIG.PENALTY_EXTREME));
            }

            this.player.coins += pCoins;
            const pCards = this.drawRandomCards(this.getRandomInt(CONFIG.CARDS_PER_TURN_MIN, CONFIG.CARDS_PER_TURN_MAX));
            this.addCardsToPlayer(this.player, pCards);

            this.bot.coins += bCoins;
            const bCards = this.drawRandomCards(this.getRandomInt(CONFIG.CARDS_PER_TURN_MIN, CONFIG.CARDS_PER_TURN_MAX));
            this.addCardsToPlayer(this.bot, bCards);

            this.addLog(`--- Ход ${this.turn} ---`, this.turn);
            this.addLog(`Игрок: +${pCoins} монет, +${pCards.length} карт`, this.turn);
            this.addLog(`Бот: +${bCoins} монет, +${bCards.length} карт`, this.turn);

            if (this.turn === 25) {
                this.player.coins += CONFIG.BONUS_TURN_25_COINS;
                this.bot.coins += CONFIG.BONUS_TURN_25_COINS;
                const bonusCards = this.drawRandomCards(CONFIG.BONUS_TURN_25_CARDS);
                this.addCardsToPlayer(this.player, bonusCards);
                const bonusBotCards = this.drawRandomCards(CONFIG.BONUS_TURN_25_CARDS);
                this.addCardsToPlayer(this.bot, bonusBotCards);
                this.addLog(`🎁 Бонус 25-го хода! +${CONFIG.BONUS_TURN_25_COINS} монет и +${CONFIG.BONUS_TURN_25_CARDS} карт каждому.`, this.turn);
                GradusWeb.notify.success('🎁 Бонусный ход 25!', 3000);
            }
        }

        this.botTurn();

        this.render();
        document.getElementById('btn-start-turn').disabled = true;
        document.getElementById('btn-end-turn').disabled = false;
        document.getElementById('btn-end-turn').textContent = '⚔️ Завершить размещение';
        document.getElementById('btn-support').disabled = false;
        document.getElementById('btn-shop').disabled = false;
        this.updateShopCrystals();
        GradusWeb.notify.info('Бот сделал ход. Ваш ход!', 2500);
    }

    // ---------- ХОД БОТА (с бонусными картами) ----------
    botTurn() {
        if (this.difficulty === 'easy' && Math.random() < 0.2) {
            this.addLog('Бот пропускает ход (лёгкая сложность)', this.turn);
            return;
        }
        if (this.difficulty === 'hard' || this.difficulty === 'extreme') {
            this.botReplaceWeakCards();
        }
        this.botPlaceCards();
        if (this.difficulty !== 'easy') {
            this.botUseSupport();
        }
        // Проверяем, есть ли отложенная бонусная карта
        this.checkPendingBonusCard();
    }

    // ---------- БОНУСНЫЕ КАРТЫ ДЛЯ БОТА ----------
    checkBotBonusCard() {
        if (this.gameOver) return;
        const difficulty = this.difficulty;
        let threshold = Infinity;
        if (difficulty === 'easy') threshold = 999;
        else if (difficulty === 'medium') threshold = 5;
        else if (difficulty === 'hard') threshold = 3;
        else if (difficulty === 'extreme') threshold = 2;

        if (this.botKillCounter >= threshold) {
            this.botKillCounter = this.botKillCounter % threshold;
            this.giveBotBonusCard();
        }
    }

    giveBotBonusCard() {
        const pool = this.cardPool.filter(c => c.rank === 5 && c.type !== 'support');
        if (pool.length === 0) return;
        const card = { ...pool[this.getRandomInt(0, pool.length-1)] };
        card.hp = card.maxHp;
        card.owner = 'bot';

        const freeCells = [];
        for (const r of CONFIG.BOT_ROWS) {
            for (let c=0; c<CONFIG.FIELD_W; c++) {
                if (this.field[r][c] === null) freeCells.push({row:r, col:c});
            }
        }
        if (freeCells.length === 0) {
            this.botPendingBonusCard = card;
            this.addLog('Бот получил бонусную карту, но нет места – она будет размещена позже.', this.turn);
            return;
        }

        const cell = freeCells[this.getRandomInt(0, freeCells.length-1)];
        card.row = cell.row;
        card.col = cell.col;
        this.field[cell.row][cell.col] = card;
        this.bot.placedCards.push(card);
        GradusWeb.notify.error(`💀 Бот получил усиление: ${card.name} (⭐5)!`, 3000);
        this.addLog(`Бот разместил бонусную карту ${card.name} на (${cell.row},${cell.col})`, this.turn);
        this.render();
    }

    checkPendingBonusCard() {
        if (!this.botPendingBonusCard) return;
        const free = [];
        for (const r of CONFIG.BOT_ROWS) {
            for (let c=0; c<CONFIG.FIELD_W; c++) {
                if (this.field[r][c] === null) free.push({row:r, col:c});
            }
        }
        if (free.length > 0) {
            const cell = free[this.getRandomInt(0, free.length-1)];
            const card = this.botPendingBonusCard;
            card.row = cell.row;
            card.col = cell.col;
            this.field[cell.row][cell.col] = card;
            this.bot.placedCards.push(card);
            this.botPendingBonusCard = null;
            this.addLog(`Бот разместил отложенную бонусную карту ${card.name}`, this.turn);
            this.render();
        }
    }

    // ---------- ЗАМЕНА СЛАБЫХ КАРТ (hard/extreme) ----------
    botReplaceWeakCards() {
        const botCards = this.field.flat().filter(c => c && c.owner === 'bot' && c.hp > 0);
        if (botCards.length < 4) return;

        const sortedBot = [...botCards].sort((a,b) => (a.attack + a.defense + a.hp) - (b.attack + b.defense + b.hp));
        const weakest = sortedBot[0];
        const handCards = this.bot.hand.filter(c => c.type !== 'support');
        if (handCards.length === 0) return;
        const bestInHand = handCards.reduce((a,b) => (a.attack + a.defense + a.hp) > (b.attack + b.defense + b.hp) ? a : b);
        const weakPower = weakest.attack + weakest.defense + weakest.hp;
        const bestPower = bestInHand.attack + bestInHand.defense + bestInHand.hp;
        if (bestPower - weakPower >= 3) {
            const refund = Math.floor(weakest.cost * 0.5);
            this.bot.coins += refund;
            this.removeCardFromField(weakest);
            const idx = this.bot.hand.indexOf(weakest);
            if (idx !== -1) this.bot.hand.splice(idx, 1);
            const newCard = { ...bestInHand, owner: 'bot', row: weakest.row, col: weakest.col };
            this.field[weakest.row][weakest.col] = newCard;
            this.bot.placedCards.push(newCard);
            const handIdx = this.bot.hand.indexOf(bestInHand);
            if (handIdx !== -1) this.bot.hand.splice(handIdx, 1);
            if (this.bot.coins < newCard.cost) {
                this.field[weakest.row][weakest.col] = weakest;
                this.bot.placedCards.pop();
                this.bot.coins -= refund;
                const idx2 = this.bot.hand.indexOf(newCard);
                if (idx2 !== -1) this.bot.hand.splice(idx2, 1);
                this.bot.hand.push(bestInHand);
                return;
            }
            this.bot.coins -= newCard.cost;
            this.addLog(`Бот заменил ${weakest.name} на ${newCard.name} (улучшение)`, this.turn);
            this.render();
        }
    }

    // ---------- БОТ РАЗМЕЩАЕТ КАРТЫ (с умным выбором рядов) ----------
    botPlaceCards() {
        const botRows = CONFIG.BOT_ROWS;
        let availableCards = this.bot.hand.filter(c => c.type !== 'support');

        if (this.difficulty === 'extreme') {
            availableCards.sort((a,b) => (b.attack + b.defense + b.hp) - (a.attack + a.defense + a.hp));
            availableCards = availableCards.map(c => {
                return { ...c, attack: c.attack + 1, defense: c.defense + 1 };
            });
        } else {
            availableCards.sort((a,b) => b.rank - a.rank);
        }

        const botCells = this.field.flat().filter(c => c && c.owner === 'bot').length;
        const maxCells = 5;
        if (botCells >= maxCells) {
            this.addLog('Бот не ставит карты – поле почти занято', this.turn);
            return;
        }

        const getPreferredRow = (card) => {
            if (card.type === 'economy') return 0;
            if (card.type === 'support') return 1;
            return 2;
        };

        if (this.difficulty === 'extreme') {
            for (const card of availableCards) {
                if (this.bot.coins < card.cost) continue;
                const free = [];
                for (const r of botRows) {
                    for (let c=0; c<CONFIG.FIELD_W; c++) {
                        if (this.field[r][c] === null) free.push({row:r, col:c});
                    }
                }
                if (free.length === 0) break;
                const preferred = getPreferredRow(card);
                let candidates = free.filter(f => f.row === preferred);
                if (candidates.length === 0) candidates = free;
                const cell = candidates[this.getRandomInt(0, candidates.length-1)];
                this.bot.coins -= card.cost;
                const placed = { ...card, owner: 'bot', row: cell.row, col: cell.col };
                this.field[cell.row][cell.col] = placed;
                this.bot.placedCards.push(placed);
                const idx = this.bot.hand.indexOf(card);
                if (idx !== -1) this.bot.hand.splice(idx, 1);
                this.addLog(`Бот (экстрим) разместил ${card.name} на (${cell.row},${cell.col})`, this.turn);
                if (this.field.flat().filter(c => c && c.owner === 'bot').length >= maxCells) break;
            }
        } else {
            const hasExpensive = availableCards.some(c => c.rank >= 4);
            if (hasExpensive && this.bot.coins < 12) {
                this.addLog('Бот копит монеты на дорогую карту', this.turn);
                return;
            }
            for (const card of availableCards) {
                if (this.bot.coins < card.cost) continue;
                const free = [];
                for (const r of botRows) {
                    for (let c=0; c<CONFIG.FIELD_W; c++) {
                        if (this.field[r][c] === null) free.push({row:r, col:c});
                    }
                }
                if (free.length === 0) break;
                const preferred = getPreferredRow(card);
                let candidates = free.filter(f => f.row === preferred);
                if (candidates.length === 0) candidates = free;
                let cell;
                if (this.difficulty === 'hard') {
                    if (Math.random() < 0.6 && candidates.length > 0) {
                        cell = candidates[this.getRandomInt(0, candidates.length-1)];
                    } else {
                        cell = free[this.getRandomInt(0, free.length-1)];
                    }
                } else {
                    cell = candidates[this.getRandomInt(0, candidates.length-1)] || free[this.getRandomInt(0, free.length-1)];
                }
                this.bot.coins -= card.cost;
                const placed = { ...card, owner: 'bot', row: cell.row, col: cell.col };
                this.field[cell.row][cell.col] = placed;
                this.bot.placedCards.push(placed);
                const idx = this.bot.hand.indexOf(card);
                if (idx !== -1) this.bot.hand.splice(idx, 1);
                this.addLog(`Бот разместил ${card.name} на (${cell.row},${cell.col})`, this.turn);
                if (this.field.flat().filter(c => c && c.owner === 'bot').length >= maxCells) break;
            }
        }
        this.render();
        // Проверяем отложенную бонусную карту после размещения
        this.checkPendingBonusCard();
    }

    // ---------- БОТ ИСПОЛЬЗУЕТ ПОДДЕРЖКУ (с учётом ПВО) ----------
    botUseSupport() {
        const supportCards = this.bot.hand.filter(c => c.type === 'support');
        if (supportCards.length === 0) return;

        let useChance = 1.0;
        if (this.difficulty === 'easy') return;
        else if (this.difficulty === 'medium') useChance = 0.85;
        else if (this.difficulty === 'hard') useChance = 0.95;
        else if (this.difficulty === 'extreme') useChance = 1.0;

        if (Math.random() > useChance) {
            this.addLog('Бот решил не использовать поддержку', this.turn);
            return;
        }

        const card = supportCards.reduce((a,b) => a.attack > b.attack ? a : b);
        if (this.bot.coins < card.cost) return;

        const playerCards = this.field.flat().filter(c => c && c.owner === 'player' && c.hp > 0);
        let target = null;
        const hasPlayerAA = this.hasAAOnField('player');

        if (this.difficulty === 'extreme') {
            if (hasPlayerAA) {
                if (playerCards.length > 0) {
                    const sorted = [...playerCards].sort((a,b) => a.hp - b.hp);
                    target = sorted[0];
                }
            } else {
                this.botUseSupportOnBase(card);
                return;
            }
        } else if (this.difficulty === 'hard') {
            if (hasPlayerAA && Math.random() < 0.6) {
                if (playerCards.length > 0) {
                    const sorted = [...playerCards].sort((a,b) => a.hp - b.hp);
                    target = sorted[0];
                }
            } else if (!hasPlayerAA) {
                this.botUseSupportOnBase(card);
                return;
            } else {
                if (playerCards.length > 0) {
                    const sorted = [...playerCards].sort((a,b) => a.hp - b.hp);
                    target = sorted[0];
                }
            }
        } else {
            if (playerCards.length > 0 && Math.random() < 0.6) {
                target = playerCards[this.getRandomInt(0, playerCards.length-1)];
            } else if (!hasPlayerAA) {
                this.botUseSupportOnBase(card);
                return;
            }
        }

        if (target) {
            let dmg = Math.max(1, card.attack);
            if (hasPlayerAA) {
                dmg = Math.ceil(dmg * 0.25);
                this.addLog(`ПВО игрока уменьшило урон поддержки до ${dmg}`, this.turn);
            }
            const def = target.defense || 0;
            const actualDmg = Math.max(1, dmg - def);
            target.hp = Math.max(0, target.hp - actualDmg);
            GradusWeb.notify.error(`Бот использует ${card.name} против ${target.name} (урон ${actualDmg})`, 2000);
            this.addLog(`Бот: поддержка ${card.name} атакует ${target.name}, урон ${actualDmg}`, this.turn);
            if (target.hp <= 0) {
                this.removeCardFromField(target);
                // Увеличиваем счётчик убийств бота
                this.botKillCounter++;
                this.addLog(`Бот убил ${target.name} (всего убийств: ${this.botKillCounter})`, this.turn);
                this.checkBotBonusCard();
                GradusWeb.notify.error(`${target.name} уничтожена ботом!`, 1500);
            }
            const idx = this.bot.hand.indexOf(card);
            if (idx !== -1) this.bot.hand.splice(idx, 1);
            this.bot.coins -= card.cost;
            this.render();
            this.checkGameOver();
        } else {
            this.addLog('Бот не нашёл цель для поддержки', this.turn);
        }
    }

    botUseSupportOnBase(card) {
        if (this.hasAAOnField('player')) {
            this.addLog('ПВО игрока блокирует атаку базы ботом', this.turn);
            return;
        }
        const dmg = Math.max(1, card.attack);
        this.player.baseHp = Math.max(0, this.player.baseHp - dmg);
        GradusWeb.notify.error(`Бот атакует вашу базу поддержкой на ${dmg} урона!`, 2500);
        this.addLog(`Бот: поддержка ${card.name} атакует базу игрока, урон ${dmg}`, this.turn);
        const idx = this.bot.hand.indexOf(card);
        if (idx !== -1) this.bot.hand.splice(idx, 1);
        this.bot.coins -= card.cost;
        this.render();
        this.checkGameOver();
    }

    // ---------- ПРОВЕРКА ПВО ----------
    hasAAOnField(owner) {
        for (const card of this.field.flat()) {
            if (card && card.owner === owner && card.isAA && card.hp > 0) {
                return true;
            }
        }
        return false;
    }

    // ---------- РАЗМЕЩЕНИЕ КАРТЫ ИГРОКОМ ----------
    placeCard(player, cardId, row, col) {
        if (this.phase !== 'placement') return false;
        if (player !== 'player') return false;
        if (row < CONFIG.PLAYER_ROWS[0] || row > CONFIG.PLAYER_ROWS[CONFIG.PLAYER_ROWS.length-1]) {
            GradusWeb.notify.warning('Можно размещать только на своей половине!', 2000);
            return false;
        }
        if (this.field[row][col] !== null) {
            GradusWeb.notify.warning('Клетка занята!', 2000);
            return false;
        }
        const cardIndex = this.player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return false;
        const card = this.player.hand[cardIndex];
        let isFree = false;
        if (card._free) {
            isFree = true;
            delete card._free;
        }
        if (!isFree && this.player.coins < card.cost) {
            GradusWeb.notify.warning('Недостаточно монет!', 2000);
            return false;
        }
        if (!isFree) this.player.coins -= card.cost;
        this.player.hand.splice(cardIndex, 1);
        const placed = { ...card, owner: 'player', row, col };
        this.field[row][col] = placed;
        this.player.placedCards.push(placed);
        GradusWeb.notify.success(`${card.name} размещён!`, 1500);
        this.addLog(`Игрок разместил ${card.name} (⭐${card.rank}) на (${row},${col})`, this.turn);
        this.render();
        return true;
    }

    // ---------- ИСПОЛЬЗОВАНИЕ ПОДДЕРЖКИ ИГРОКОМ ----------
    useSupport(cardId, targetRow, targetCol) {
        if (this.phase !== 'placement') return false;
        const cardIndex = this.player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return false;
        const card = this.player.hand[cardIndex];
        if (card.type !== 'support') {
            GradusWeb.notify.warning('Это не поддержка!', 2000);
            return false;
        }
        if (this.player.coins < card.cost) {
            GradusWeb.notify.warning('Недостаточно монет!', 2000);
            return false;
        }

        if (targetRow === -1 && targetCol === -1) {
            if (this.hasAAOnField('bot')) {
                GradusWeb.notify.warning('ПВО бота сбила ракету! Урон по базе заблокирован.', 2500);
                this.addLog(`Поддержка ${card.name} сбита ПВО бота`, this.turn);
                this.player.hand.splice(cardIndex, 1);
                this.player.coins -= card.cost;
                this.render();
                return true;
            }
            const dmg = Math.max(1, card.attack);
            this.bot.baseHp = Math.max(0, this.bot.baseHp - dmg);
            this.addDamageToBotBase(dmg);
            GradusWeb.notify.error(`Поддержка ${card.name} нанесла ${dmg} урона базе бота!`, 2500);
            this.addLog(`Поддержка ${card.name} атакует базу бота, урон ${dmg}`, this.turn);
            this.player.hand.splice(cardIndex, 1);
            this.player.coins -= card.cost;
            this.render();
            this.checkGameOver();
            return true;
        }

        const targetCard = this.field[targetRow][targetCol];
        if (!targetCard || targetCard.owner !== 'bot') {
            GradusWeb.notify.warning('Цель должна быть вражеской картой!', 2000);
            return false;
        }
        let dmg = Math.max(1, card.attack);
        if (this.hasAAOnField('bot')) {
            dmg = Math.ceil(dmg * 0.25);
            GradusWeb.notify.info('ПВО бота уменьшило урон поддержки на 75%', 2000);
            this.addLog(`ПВО бота уменьшило урон до ${dmg}`, this.turn);
        }
        const def = targetCard.defense || 0;
        const actualDmg = Math.max(1, dmg - def);
        targetCard.hp = Math.max(0, targetCard.hp - actualDmg);
        GradusWeb.notify.error(`Поддержка ${card.name} нанесла ${actualDmg} урона ${targetCard.name}!`, 2500);
        this.addLog(`Поддержка ${card.name} атакует ${targetCard.name}, урон ${actualDmg}`, this.turn);
        if (targetCard.hp <= 0) {
            GradusWeb.notify.error(`${targetCard.name} уничтожена!`, 2000);
            this.removeCardFromField(targetCard);
            this.addCrystalsForKill(targetCard);
        }
        this.player.hand.splice(cardIndex, 1);
        this.player.coins -= card.cost;
        this.render();
        this.checkGameOver();
        return true;
    }

    // ---------- КРИСТАЛЛЫ ----------
    addCrystalsForKill(card) {
        const crystals = card.rank + CONFIG.CRYSTALS_PER_KILL_BASE;
        this.crystals += crystals;
        GradusWeb.notify.success(`💎 +${crystals} кристаллов за уничтожение ${card.name}`, 2000);
        this.addLog(`💎 +${crystals} кристаллов (убийство ${card.name})`, this.turn);
        this.updateShopCrystals();
    }

    addDamageToBotBase(dmg) {
        this.damageToBotBase += dmg;
        if (this.damageToBotBase >= 10) {
            const bonus = Math.floor(this.damageToBotBase / 10) * CONFIG.CRYSTALS_PER_10_DMG;
            const actualBonus = Math.min(bonus, 50);
            this.crystals += actualBonus;
            this.damageToBotBase = this.damageToBotBase % 10;
            GradusWeb.notify.success(`💎 +${actualBonus} кристаллов за урон по базе!`, 2000);
            this.addLog(`💎 +${actualBonus} кристаллов (урон по базе)`, this.turn);
            this.updateShopCrystals();
        }
    }

    updateShopCrystals() {
        const span = document.getElementById('shop-crystals');
        if (span) span.textContent = this.crystals;
        const modalSpan = document.getElementById('shop-crystals-modal');
        if (modalSpan) modalSpan.textContent = this.crystals;
        const counter = document.getElementById('crystal-counter');
        if (counter) counter.textContent = this.crystals;
    }

    // ---------- МАГАЗИН ----------
    openShop() {
        if (this.phase !== 'placement') {
            GradusWeb.notify.warning('Магазин доступен только в фазе размещения!', 2000);
            return;
        }
        document.getElementById('shopModal').classList.add('active');
        this.updateShopCrystals();
    }

    closeShop() {
        document.getElementById('shopModal').classList.remove('active');
    }

    buyCard(option) {
        if (this.phase !== 'placement') return;
        let cost = 0;
        let type = document.getElementById('shop-type-select').value;
        let rankMin = 0, rankMax = 5;
        let isFree = false;

        switch (option) {
            case 'random':
                cost = CONFIG.SHOP_COST_RANDOM;
                break;
            case 'rank2-3':
                cost = CONFIG.SHOP_COST_RANK_2_3;
                rankMin = 2; rankMax = 3;
                break;
            case 'rank5':
                cost = CONFIG.SHOP_COST_RANK_5;
                rankMin = 5; rankMax = 5;
                isFree = true;
                break;
            default: return;
        }

        if (this.crystals < cost) {
            GradusWeb.notify.warning('Недостаточно кристаллов!', 2000);
            return;
        }

        let card;
        if (option === 'random') {
            const types = ['attack', 'defense', 'support', 'economy'];
            const randType = types[this.getRandomInt(0, 3)];
            const randRank = this.getRandomInt(0, 5);
            const pool = this.cardPool.filter(c => c.type === randType && c.rank === randRank);
            if (pool.length === 0) { GradusWeb.notify.warning('Нет подходящих карт', 2000); return; }
            card = { ...pool[this.getRandomInt(0, pool.length-1)] };
        } else {
            const pool = this.cardPool.filter(c => c.type === type && c.rank >= rankMin && c.rank <= rankMax);
            if (pool.length === 0) { GradusWeb.notify.warning('Нет подходящих карт', 2000); return; }
            card = { ...pool[this.getRandomInt(0, pool.length-1)] };
        }

        card.hp = card.maxHp;
        if (isFree) {
            card._free = true;
            card.cost = 0;
        }
        if (this.canAddCardToHand(this.player, card.type)) {
            this.player.hand.push(card);
            this.crystals -= cost;
            GradusWeb.notify.success(`🛒 Куплена карта ${card.name}!`, 2000);
            this.addLog(`Магазин: куплена ${card.name} (⭐${card.rank}) за ${cost} кристаллов`, this.turn);
            this.render();
            this.updateShopCrystals();
        } else {
            GradusWeb.notify.warning('У вас слишком много карт этого типа!', 2000);
        }
    }

    // ---------- ОТЗЫВ ЮНИТА ----------
    recallUnit(row, col) {
        if (this.phase !== 'placement') {
            GradusWeb.notify.warning('Отзывать можно только в фазе размещения!', 2000);
            return;
        }
        const card = this.field[row][col];
        if (!card || card.owner !== 'player') {
            GradusWeb.notify.warning('Это не ваш юнит!', 2000);
            return;
        }
        const maxHp = card.maxHp;
        const currentHp = card.hp;
        let refund = 0;
        if (currentHp >= maxHp) {
            refund = card.cost;
        } else {
            const ratio = currentHp / maxHp;
            refund = Math.floor(card.cost * ratio);
        }
        const returnedCard = { ...card, hp: maxHp };
        if (this.canAddCardToHand(this.player, returnedCard.type)) {
            this.player.hand.push(returnedCard);
            this.player.coins += refund;
            this.field[row][col] = null;
            const idx = this.player.placedCards.indexOf(card);
            if (idx !== -1) this.player.placedCards.splice(idx, 1);
            GradusWeb.notify.success(`Юнит ${card.name} отозван. Возвращено ${refund} монет.`, 2000);
            this.addLog(`Игрок отозвал ${card.name}, возвращено ${refund} монет`, this.turn);
            this.render();
        } else {
            GradusWeb.notify.warning('У вас слишком много карт этого типа!', 2000);
        }
    }

    // ---------- БОЕВАЯ ФАЗА ----------
    async endTurn() {
        if (this.phase !== 'placement' || this.isAnimating) return;
        this.phase = 'battle';
        document.getElementById('btn-end-turn').disabled = true;
        document.getElementById('btn-end-turn').textContent = '⏳ Битва...';
        document.getElementById('btn-support').disabled = true;
        document.getElementById('btn-shop').disabled = true;
        this.addLog('=== ⚔️ БИТВА ===', this.turn);
        GradusWeb.notify.info('Битва начинается!', 2000);

        await this.runBattle();
        this.collectEconomy();
        this.checkGameOver();

        this.phase = 'idle';
        document.getElementById('btn-start-turn').disabled = false;
        document.getElementById('btn-end-turn').disabled = true;
        document.getElementById('btn-end-turn').textContent = '⚔️ Завершить размещение';
        this.render();
        this.addLog('--- Ход завершён ---', this.turn);
        if (!this.gameOver) {
            GradusWeb.notify.info('Ход завершён. Нажмите "Начать ход"', 2000);
        }
        this.updateControls();
        this.renderLogs();
        this.updateShopCrystals();
    }

    async runBattle() {
        this.isAnimating = true;
        const getAlive = (owner) => this.field.flat().filter(c => c && c.owner === owner && c.hp > 0);

        const playerAttackers = getAlive('player').filter(c => c.type === 'attack' || c.type === 'defense');
        const botAttackers = getAlive('bot').filter(c => c.type === 'attack' || c.type === 'defense');

        for (const attacker of playerAttackers) {
            await this.attackAlongLine(attacker);
        }
        for (const attacker of botAttackers) {
            await this.attackAlongLine(attacker);
        }

        this.cleanDeadCards();
        this.isAnimating = false;
        this.render();
    }

    async attackAlongLine(attacker) {
        const col = attacker.col;
        let enemies = [];
        if (attacker.owner === 'player') {
            enemies = this.field.flat()
                .filter(c => c && c.owner === 'bot' && c.col === col && c.hp > 0)
                .sort((a,b) => b.row - a.row);
        } else {
            enemies = this.field.flat()
                .filter(c => c && c.owner === 'player' && c.col === col && c.hp > 0)
                .sort((a,b) => a.row - b.row);
        }
        let target = enemies.length > 0 ? enemies[0] : null;

        if (!target) {
            let dmg = Math.max(1, attacker.attack);
            if (attacker.owner === 'player') {
                if (this.hasAAOnField('bot')) {
                    GradusWeb.notify.warning('ПВО бота блокирует урон по базе!', 2000);
                    this.addLog(`${attacker.name} атака по базе заблокирована ПВО`, this.turn);
                    return;
                }
                this.bot.baseHp = Math.max(0, this.bot.baseHp - dmg);
                this.addDamageToBotBase(dmg);
                GradusWeb.notify.error(`${attacker.name} атакует базу бота на ${dmg} урона!`, 2000);
                this.addLog(`${attacker.name} атакует базу бота, урон ${dmg}`, this.turn);
            } else {
                if (this.hasAAOnField('player')) {
                    GradusWeb.notify.warning('Ваше ПВО блокирует урон по базе!', 2000);
                    this.addLog(`${attacker.name} атака по базе заблокирована ПВО`, this.turn);
                    return;
                }
                this.player.baseHp = Math.max(0, this.player.baseHp - dmg);
                GradusWeb.notify.error(`${attacker.name} атакует базу игрока на ${dmg} урона!`, 2000);
                this.addLog(`${attacker.name} атакует базу игрока, урон ${dmg}`, this.turn);
            }
            await this.sleep(400);
            this.render();
            this.checkGameOver();
            return;
        }

        await this.executeAttack(attacker, target);
    }

    async executeAttack(attacker, target) {
        this.highlightCard(attacker, 'attacking');
        this.highlightCard(target, 'defending');
        await this.sleep(400);

        let dmg = Math.max(1, attacker.attack);
        const def = target.defense || 0;
        let actualDmg = Math.max(1, dmg - def);
        const targetOwner = target.owner;
        if (this.hasAAOnField(targetOwner)) {
            actualDmg = Math.ceil(actualDmg * 0.25);
            GradusWeb.notify.info(`ПВО ${targetOwner === 'player' ? 'игрока' : 'бота'} уменьшило урон до ${actualDmg}`, 1500);
            this.addLog(`ПВО уменьшило урон до ${actualDmg}`, this.turn);
        }
        target.hp = Math.max(0, target.hp - actualDmg);
        GradusWeb.notify.error(`${attacker.name} наносит ${actualDmg} урона ${target.name}`, 1500);
        this.addLog(`${attacker.name} атакует ${target.name}, урон ${actualDmg} (защита ${def})`, this.turn);

        if (target.hp <= 0) {
            GradusWeb.notify.error(`${target.name} уничтожена!`, 1500);
            if (attacker.owner === 'player') {
                this.addCrystalsForKill(target);
            } else {
                // Бот убил карту игрока
                this.botKillCounter++;
                this.addLog(`Бот убил ${target.name} (всего убийств: ${this.botKillCounter})`, this.turn);
                this.checkBotBonusCard();
            }
            this.removeCardFromField(target);
            this.clearHighlights();
            await this.sleep(300);
            this.render();
        } else {
            if (target.type === 'defense') {
                const counterDmg = Math.max(1, target.attack - (attacker.defense || 0));
                attacker.hp = Math.max(0, attacker.hp - counterDmg);
                GradusWeb.notify.warning(`${target.name} контратакует на ${counterDmg} урона!`, 1500);
                this.addLog(`${target.name} контратакует ${attacker.name}, урон ${counterDmg}`, this.turn);
                if (attacker.hp <= 0) {
                    GradusWeb.notify.error(`${attacker.name} уничтожена!`, 1500);
                    this.removeCardFromField(attacker);
                    // Если бот убил карту игрока (контратакой защиты)
                    if (attacker.owner === 'player') {
                        this.botKillCounter++;
                        this.addLog(`Бот убил ${attacker.name} (всего убийств: ${this.botKillCounter})`, this.turn);
                        this.checkBotBonusCard();
                    }
                }
            }
        }
        this.clearHighlights();
        await this.sleep(300);
        this.render();
        this.checkGameOver();
    }

    highlightCard(card, type) {
        if (!card || card.isBase) return;
        const el = document.querySelector(`.cell[data-row="${card.row}"][data-col="${card.col}"]`);
        if (el) {
            if (type === 'attacking') el.style.boxShadow = '0 0 20px yellow';
            else if (type === 'defending') el.style.boxShadow = '0 0 20px red';
        }
    }
    clearHighlights() {
        document.querySelectorAll('.cell').forEach(el => el.style.boxShadow = '');
    }
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    removeCardFromField(card) {
        const { row, col } = card;
        if (row !== undefined && col !== undefined) {
            this.field[row][col] = null;
        }
        const list = card.owner === 'player' ? this.player.placedCards : this.bot.placedCards;
        const idx = list.indexOf(card);
        if (idx !== -1) list.splice(idx, 1);
    }

    cleanDeadCards() {
        for (let r=0; r<CONFIG.FIELD_H; r++) {
            for (let c=0; c<CONFIG.FIELD_W; c++) {
                const card = this.field[r][c];
                if (card && card.hp <= 0) {
                    this.field[r][c] = null;
                    const list = card.owner === 'player' ? this.player.placedCards : this.bot.placedCards;
                    const idx = list.indexOf(card);
                    if (idx !== -1) list.splice(idx, 1);
                }
            }
        }
    }

    collectEconomy() {
        for (const card of this.player.placedCards) {
            if (card.type === 'economy' && card.hp > 0) {
                const bonus = card.rank + 1;
                this.player.coins += bonus;
                GradusWeb.notify.success(`Экономика ${card.name} даёт +${bonus} монет`, 1500);
                this.addLog(`Экономика ${card.name} даёт +${bonus} монет игроку`, this.turn);
            }
        }
        for (const card of this.bot.placedCards) {
            if (card.type === 'economy' && card.hp > 0) {
                const bonus = card.rank + 1;
                this.bot.coins += bonus;
                this.addLog(`Экономика ${card.name} даёт +${bonus} монет боту`, this.turn);
            }
        }
    }

    checkGameOver() {
        if (this.gameOver) return; // защита от повторных вызовов
        if (this.player.baseHp <= 0) {
            this.gameOver = true;
            this.win = false;
            GradusWeb.notify.error('ВАША БАЗА РАЗРУШЕНА! Поражение.', 4000);
            this.addLog('💀 ВАША БАЗА РАЗРУШЕНА! Вы проиграли.', this.turn);
            this.updateStats(false);
            this.showCelebration(false);
        } else if (this.bot.baseHp <= 0) {
            this.gameOver = true;
            this.win = true;
            GradusWeb.notify.success('БАЗА БОТА РАЗРУШЕНА! Победа!', 4000);
            this.addLog('🏆 БАЗА БОТА РАЗРУШЕНА! Вы победили!', this.turn);
            this.updateStats(true);
            this.showCelebration(true);
        }
        if (this.gameOver) {
            this.phase = 'ended';
            document.getElementById('btn-start-turn').disabled = true;
            document.getElementById('btn-end-turn').disabled = true;
            document.getElementById('btn-support').disabled = true;
            document.getElementById('btn-shop').disabled = true;
            document.getElementById('btn-reset').textContent = '🔄 Сыграть ещё';
        }
    }

    showCelebration(won) {
        if (!won) return;
        const container = document.getElementById('confetti-container');
        const colors = ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#ff8800', '#ff44aa'];
        for (let i = 0; i < 150; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            const size = 6 + Math.random() * 8;
            piece.style.width = size + 'px';
            piece.style.height = size + 'px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.left = Math.random() * 100 + '%';
            piece.style.animationDuration = 2 + Math.random() * 3 + 's';
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(piece);
        }
        setTimeout(() => {
            container.innerHTML = '';
        }, 6000);
    }

    // ---------- ЛОГИ ----------
    addLog(msg, turn) {
        const turnKey = turn || this.turn;
        if (!this.logsPerTurn[turnKey]) this.logsPerTurn[turnKey] = [];
        this.logsPerTurn[turnKey].push(msg);
        this.logs.push({ turn: turnKey, msg });
        if (this.logs.length > 1000) this.logs.shift();
        this.renderLogs();
    }

    renderLogs() {
        const logDiv = document.getElementById('log-content');
        if (!logDiv) return;
        const turnKeys = Object.keys(this.logsPerTurn).sort((a,b) => a - b);
        let html = '';
        for (const t of turnKeys) {
            const msgs = this.logsPerTurn[t] || [];
            html += `<div class="log-turn"><div class="log-turn-header">=== Ход ${t} ===</div>`;
            for (const msg of msgs) {
                html += `<div class="log-msg">${msg}</div>`;
            }
            html += `</div>`;
        }
        logDiv.innerHTML = html || 'Логов пока нет.';
        logDiv.parentElement.scrollTop = logDiv.parentElement.scrollHeight;
    }

    // ---------- ПРОФИЛЬ (с рангами и медалями) ----------
    updateProfileModal() {
        const stats = this.stats;
        const diffNames = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Любитель', extreme: 'Экстрим' };
        const rank = this.getCurrentRank();
        let html = `<div class="stat-block"><span>🏆 Ранг:</span><span>${rank.emoji} ${rank.name}</span></div>
                    <div class="stat-block"><span>✨ Опыт:</span><span>${this.xp} XP</span></div>
                    <div class="stat-block"><span>Всего побед:</span><span>${stats.total.wins}</span></div>
                    <div class="stat-block"><span>Всего поражений:</span><span>${stats.total.losses}</span></div>`;
        for (const d of ['easy','medium','hard','extreme']) {
            const s = stats[d] || { wins:0, losses:0 };
            html += `<div class="stat-block"><span>${diffNames[d]}:</span><span>Побед ${s.wins} / Поражений ${s.losses}</span></div>`;
        }
        document.getElementById('stats-display').innerHTML = html;

        const medals = [];
        const thresholds = [5, 10, 25, 50, 100];
        const emojis = ['🥉', '🥈', '🥇', '💎', '👑'];
        for (const d of ['easy','medium','hard','extreme']) {
            const s = stats[d] || { wins:0 };
            for (let i = 0; i < thresholds.length; i++) {
                if (s.wins >= thresholds[i]) {
                    medals.push(`${emojis[i]} ${thresholds[i]} побед на ${diffNames[d]}`);
                }
            }
        }
        if (medals.length === 0) medals.push('Пока нет медалей. Играйте и побеждайте!');
        document.getElementById('medals-display').innerHTML = medals.map(m => `<div class="medal">${m}</div>`).join('');
    }

    // ---------- РЕНДЕРИНГ ----------
    renderStars(rank) {
        return '<span style="color:gold;">' + '★'.repeat(rank) + '☆'.repeat(5 - rank) + '</span>';
    }

    getCategoryClass(type) {
        const map = { attack: 'cat-attack', defense: 'cat-defense', support: 'cat-support', economy: 'cat-economy' };
        return map[type] || '';
    }

    render() {
        this.renderField();
        this.renderHand();
        this.renderTopPanel();
        this.renderLogs();
        this.updateControls();
        this.updateProfileModal();
        this.updateShopCrystals();
        this.updateRankDisplay();
    }

    renderField() {
        const fieldDiv = document.getElementById('field');
        fieldDiv.innerHTML = '';
        for (let r = 0; r < CONFIG.FIELD_H; r++) {
            for (let c = 0; c < CONFIG.FIELD_W; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                if (CONFIG.PLAYER_ROWS.includes(r)) cell.classList.add('player');
                if (CONFIG.BOT_ROWS.includes(r)) cell.classList.add('bot');
                cell.dataset.row = r;
                cell.dataset.col = c;
                const card = this.field[r][c];
                if (card && card.hp > 0) {
                    const spritePath = CONFIG.SPRITE_PATH + card.sprite;
                    const stars = this.renderStars(card.rank);
                    const catClass = this.getCategoryClass(card.type);
                    cell.innerHTML = `
                        <div class="card-info">
                            <img src="${spritePath}" class="card-sprite" alt="${card.name}" onerror="this.style.display='none'">
                            <div class="card-name">${card.name}</div>
                            <div class="card-stars">${stars}</div>
                            <div class="card-stats">⚔${card.attack} 🛡${card.defense}</div>
                            <div class="card-hp">❤️${card.hp}</div>
                            <div class="category-bar ${catClass}"></div>
                        </div>
                    `;
                    cell.style.background = card.owner === 'player' ? '#1a3a1a' : '#3a1a1a';
                    if (card.owner === 'player' && this.phase === 'placement') {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (confirm(`Отозвать ${card.name}? Вернётся часть монет.`)) {
                                this.recallUnit(r, c);
                            }
                        });
                    } else if (card.owner === 'bot' && this.phase === 'placement') {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (this.selectedCardId) {
                                const selected = this.player.hand.find(c => c.id === this.selectedCardId);
                                if (selected && selected.type === 'support') {
                                    this.useSupport(this.selectedCardId, r, c);
                                    this.selectedCardId = null;
                                    this.render();
                                }
                            }
                        });
                    } else {
                        cell.style.cursor = 'default';
                    }
                } else {
                    cell.textContent = '';
                    cell.style.background = '#2a2a4a';
                    if (CONFIG.PLAYER_ROWS.includes(r) && this.phase === 'placement') {
                        cell.addEventListener('click', () => this.onCellClick(r, c));
                    }
                }
                fieldDiv.appendChild(cell);
            }
        }
    }

    renderHand() {
        const handDiv = document.getElementById('hand');
        const activeType = document.querySelector('.tab.active')?.dataset.type || 'all';
        let cards = this.player.hand;
        if (activeType !== 'all') cards = cards.filter(c => c.type === activeType);
        handDiv.innerHTML = '';
        cards.forEach((card) => {
            const el = document.createElement('div');
            el.className = 'hand-card';
            if (this.selectedCardId === card.id) el.classList.add('selected');
            const stars = this.renderStars(card.rank);
            const spritePath = CONFIG.SPRITE_PATH + card.sprite;
            const catClass = this.getCategoryClass(card.type);
            el.innerHTML = `
                <img src="${spritePath}" class="hand-sprite" alt="${card.name}" onerror="this.style.display='none'">
                <div style="font-weight:bold; font-size:0.8rem;">${card.name}</div>
                <div class="hand-stars">${stars}</div>
                <div class="hand-stats">⚔${card.attack} 🛡${card.defense} ❤️${card.hp}</div>
                <div class="hand-cost">💰${card.cost}</div>
                <div class="category-bar ${catClass}"></div>
            `;
            el.addEventListener('click', () => this.selectCard(card.id));
            handDiv.appendChild(el);
        });
    }

    renderTopPanel() {
        document.getElementById('player-coins').textContent = this.player.coins;
        document.getElementById('bot-coins').textContent = this.bot.coins;
        document.getElementById('player-base').textContent = this.player.baseHp;
        document.getElementById('bot-base').textContent = this.bot.baseHp;
        document.getElementById('hand-count').textContent = this.player.hand.length;
        document.getElementById('turn-counter').textContent = this.turn;
        document.getElementById('crystal-counter').textContent = this.crystals;
    }

    updateControls() {
        const startBtn = document.getElementById('btn-start-turn');
        const endBtn = document.getElementById('btn-end-turn');
        const supportBtn = document.getElementById('btn-support');
        const shopBtn = document.getElementById('btn-shop');
        if (this.gameOver) {
            startBtn.disabled = true;
            endBtn.disabled = true;
            supportBtn.disabled = true;
            shopBtn.disabled = true;
        } else {
            startBtn.disabled = (this.phase !== 'idle' && this.phase !== 'ended');
            endBtn.disabled = (this.phase !== 'placement');
            supportBtn.disabled = (this.phase !== 'placement');
            shopBtn.disabled = (this.phase !== 'placement');
        }
    }

    // ---------- ОБРАБОТЧИКИ ----------
    selectCard(cardId) {
        if (this.phase !== 'placement') return;
        const card = this.player.hand.find(c => c.id === cardId);
        if (!card) return;
        if (card.type === 'support') {
            this.selectedCardId = cardId;
            GradusWeb.notify.info('Выберите вражескую карту для атаки поддержкой (или кликните по базе бота)', 3000);
            this.renderHand();
            return;
        }
        if (this.selectedCardId === cardId) {
            this.selectedCardId = null;
        } else {
            this.selectedCardId = cardId;
        }
        this.renderHand();
    }

    onCellClick(row, col) {
        if (this.phase !== 'placement') return;
        if (!CONFIG.PLAYER_ROWS.includes(row)) {
            GradusWeb.notify.warning('Это не ваша половина поля!', 1500);
            return;
        }
        if (this.field[row][col] !== null) {
            GradusWeb.notify.warning('Клетка занята!', 1500);
            return;
        }
        if (!this.selectedCardId) {
            GradusWeb.notify.warning('Сначала выберите карту в руке', 1500);
            return;
        }
        const card = this.player.hand.find(c => c.id === this.selectedCardId);
        if (!card) return;
        if (card.type === 'support') {
            GradusWeb.notify.warning('Поддержку нельзя разместить, выберите вражескую карту или используйте кнопку "Атаковать базу"', 2000);
            return;
        }
        const success = this.placeCard('player', this.selectedCardId, row, col);
        if (success) {
            this.selectedCardId = null;
            this.render();
        }
    }

    attackBaseWithSupport() {
        if (this.phase !== 'placement') return;
        if (!this.selectedCardId) {
            GradusWeb.notify.warning('Сначала выберите карту поддержки', 1500);
            return;
        }
        const card = this.player.hand.find(c => c.id === this.selectedCardId);
        if (!card || card.type !== 'support') {
            GradusWeb.notify.warning('Выбрана не поддержка', 1500);
            return;
        }
        if (this.player.coins < card.cost) {
            GradusWeb.notify.warning('Недостаточно монет!', 2000);
            return;
        }
        if (confirm(`Нанести ${card.attack} урона базе бота за ${card.cost} монет?`)) {
            this.useSupport(this.selectedCardId, -1, -1);
            this.selectedCardId = null;
            this.render();
        }
    }

    // ---------- НОВАЯ ИГРА ----------
    resetGame() {
        this.field = this.initField();
        this.player = { hand: [], coins: CONFIG.STARTING_COINS, baseHp: CONFIG.BASE_HP, placedCards: [] };
        this.bot = { hand: [], coins: CONFIG.STARTING_COINS, baseHp: CONFIG.BASE_HP, placedCards: [] };
        const starterCards = this.getStartingCards();
        this.addCardsToPlayer(this.player, starterCards);
        const botStarter = this.getStartingCards();
        this.addCardsToPlayer(this.bot, botStarter);
        this.turn = 0;
        this.phase = 'idle';
        this.gameOver = false;
        this.logs = [];
        this.logsPerTurn = {};
        this.selectedCardId = null;
        this.isAnimating = false;
        this.win = false;
        this.crystals = 0;
        this.damageToBotBase = 0;
        this.botKillCounter = 0;
        this.botPendingBonusCard = null;

        this.addLog('🔄 Новая игра! Нажмите "Начать ход".', 0);
        GradusWeb.notify.info('Новая игра начата!', 3000);
        this.render();
        document.getElementById('btn-start-turn').disabled = false;
        document.getElementById('btn-end-turn').disabled = true;
        document.getElementById('btn-support').disabled = true;
        document.getElementById('btn-shop').disabled = true;
        document.getElementById('btn-reset').textContent = '🔄 Новая игра';
        document.getElementById('confetti-container').innerHTML = '';
        this.updateShopCrystals();
        this.updateRankDisplay();
    }

    // ---------- СТАРТ ----------
    start() {
        this.resetGame();

        document.getElementById('btn-start-turn').addEventListener('click', () => this.startTurn());
        document.getElementById('btn-end-turn').addEventListener('click', () => this.endTurn());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetGame());
        document.getElementById('btn-support').addEventListener('click', () => this.attackBaseWithSupport());

        document.getElementById('btn-shop').addEventListener('click', () => this.openShop());
        document.getElementById('closeShopModal').addEventListener('click', () => this.closeShop());
        document.querySelectorAll('.shop-option').forEach(el => {
            el.addEventListener('click', (e) => {
                const option = el.dataset.shop;
                if (option) this.buyCard(option);
            });
        });

        document.getElementById('btn-log-toggle').addEventListener('click', function() {
            const container = document.getElementById('log-container');
            if (container.style.display === 'none') {
                container.style.display = 'block';
                this.textContent = '📜 Скрыть логи';
            } else {
                container.style.display = 'none';
                this.textContent = '📜 Показать логи';
            }
        });

        document.getElementById('btn-profile').addEventListener('click', () => {
            document.getElementById('profile-modal').classList.add('active');
            this.updateProfileModal();
        });
        document.querySelector('.close-modal')?.addEventListener('click', () => {
            document.getElementById('profile-modal').classList.remove('active');
        });
        window.onclick = function(e) {
            const modal = document.getElementById('profile-modal');
            if (e.target === modal) modal.classList.remove('active');
        };

        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.diff;
                GradusWeb.notify.info(`Сложность изменена на ${btn.textContent}`, 2000);
                if (this.phase === 'idle' && !this.gameOver) {
                    this.resetGame();
                } else {
                    GradusWeb.notify.info('Новая сложность будет применена в следующей игре.', 2000);
                }
            });
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderHand();
            });
        });

        this.render();
        this.addLog('Добро пожаловать в WarCards!', 0);
        GradusWeb.notify.info('Добро пожаловать в WarCards!', 3000);
        this.updateShopCrystals();
        this.updateRankDisplay();
    }
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
let game;

async function initSite() {
    GradusStatic.registerHandler('game:player_coins', () => game ? game.player.coins : 0);
    GradusStatic.registerHandler('game:bot_coins', () => game ? game.bot.coins : 0);
    GradusStatic.registerHandler('game:player_base_hp', () => game ? game.player.baseHp : CONFIG.BASE_HP);
    GradusStatic.registerHandler('game:bot_base_hp', () => game ? game.bot.baseHp : CONFIG.BASE_HP);
    GradusStatic.registerHandler('game:hand_count', () => game ? game.player.hand.length : 0);
    GradusStatic.registerHandler('game:turn', () => game ? game.turn : 0);
    GradusStatic.registerHandler('game:crystals', () => game ? game.crystals : 0);

    game = new WarCardsGame();
    await game.loadProgress();
    game.start();
}