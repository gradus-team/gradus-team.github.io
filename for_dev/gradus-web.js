/**
 * Gradus Web — Утилиты для статических сайтов (JavaScript)
 * Версия 1.1 — расширенное кодирование по таблице Gradus
 * Включает: Gradus Cache, Gradus Encoder, Gradus Captcha,
 *           Gradus DDoS-Protection, Gradus Notify, генераторы
 * Использование: <script src="gradus-web.js"></script>
 *                и вызывайте GradusWeb.метод(...)
 */
(function (window) {
    'use strict';

    // Основной объект
    const GradusWeb = {
        version: '1.1.0',

        // Служебный логгер
        _log(type, msg) {
            const prefix = '[GRADUS-WEB]';
            if (type === 'error') console.error(prefix, msg);
            else if (type === 'warn') console.warn(prefix, msg);
            else console.log(prefix, msg);
        },

        // ========== 1. КЭШ (LocalStorage с TTL) ==========
        cache: {
            set(key, value, ttlSeconds = 3600) {
                try {
                    const item = {
                        value: value,
                        expires: Date.now() + ttlSeconds * 1000
                    };
                    localStorage.setItem('gradus_cache_' + key, JSON.stringify(item));
                    return true;
                } catch (e) {
                    GradusWeb._log('error', 'Cache set failed: ' + e.message);
                    return false;
                }
            },
            get(key) {
                try {
                    const raw = localStorage.getItem('gradus_cache_' + key);
                    if (!raw) return null;
                    const item = JSON.parse(raw);
                    if (Date.now() > item.expires) {
                        localStorage.removeItem('gradus_cache_' + key);
                        return null;
                    }
                    return item.value;
                } catch (e) {
                    return null;
                }
            },
            remove(key) { localStorage.removeItem('gradus_cache_' + key); },
            clear() {
                Object.keys(localStorage)
                    .filter(k => k.startsWith('gradus_cache_'))
                    .forEach(k => localStorage.removeItem(k));
            }
        },

        // ========== 2. КОДИРОВАНИЕ (таблица Gradus) ==========
        _charMap: {
            ' ': '_000', 'а': '_001', 'б': '_002', 'в': '_003', 'г': '_004', 'д': '_005',
            'е': '_006', 'ё': '_007', 'ж': '_008', 'з': '_009', 'и': '_010', 'й': '_011',
            'к': '_012', 'л': '_013', 'м': '_014', 'н': '_015', 'о': '_016', 'п': '_017',
            'р': '_018', 'с': '_019', 'т': '_020', 'у': '_021', 'ф': '_022', 'х': '_023',
            'ц': '_024', 'ч': '_025', 'ш': '_026', 'щ': '_027', 'ъ': '_028', 'ы': '_029',
            'ь': '_030', 'э': '_031', 'ю': '_032', 'я': '_033',
            'А': '_034', 'Б': '_035', 'В': '_036', 'Г': '_037', 'Д': '_038', 'Е': '_039',
            'Ё': '_040', 'Ж': '_041', 'З': '_042', 'И': '_043', 'Й': '_044', 'К': '_045',
            'Л': '_046', 'М': '_047', 'Н': '_048', 'О': '_049', 'П': '_050', 'Р': '_051',
            'С': '_052', 'Т': '_053', 'У': '_054', 'Ф': '_055', 'Х': '_056', 'Ц': '_057',
            'Ч': '_058', 'Ш': '_059', 'Щ': '_060', 'Ъ': '_061', 'Ы': '_062', 'Ь': '_063',
            'Э': '_064', 'Ю': '_065', 'Я': '_066',
            'A': '_067', 'B': '_068', 'C': '_069', 'D': '_070', 'E': '_071', 'F': '_072',
            'G': '_073', 'H': '_074', 'I': '_075', 'J': '_076', 'K': '_077', 'L': '_078',
            'M': '_079', 'N': '_080', 'O': '_081', 'P': '_082', 'Q': '_083', 'R': '_084',
            'S': '_085', 'T': '_086', 'U': '_087', 'V': '_088', 'W': '_089', 'X': '_090',
            'Y': '_091', 'Z': '_092',
            'a': '_093', 'b': '_094', 'c': '_095', 'd': '_096', 'e': '_097', 'f': '_098',
            'g': '_099', 'h': '_100', 'i': '_101', 'j': '_102', 'k': '_103', 'l': '_104',
            'm': '_105', 'n': '_106', 'o': '_107', 'p': '_108', 'q': '_109', 'r': '_110',
            's': '_111', 't': '_112', 'u': '_113', 'v': '_114', 'w': '_115', 'x': '_116',
            'y': '_117', 'z': '_118',
            '0': '_119', '1': '_120', '2': '_121', '3': '_122', '4': '_123',
            '5': '_124', '6': '_125', '7': '_126', '8': '_127', '9': '_128',
            ',': '_129', '.': '_130',
            '~': '_131', '!': '_132', '?': '_133', '=': '_134', '-': '_135',
            '+': '_136', ':': '_137', '%': '_138', '&': '_139', '*': '_140',
            '(': '_141', ')': '_142', '@': '_143', '`': '_144', '$': '_145',
            ';': '_146', '"': '_147', "'": '_148', '{': '_149', '}': '_150',
            '\\': '_151', '\n': '_152', '\r': '_153', '#': '_154', '/': '_155'
        },
        _decodeMap: null,

        _buildDecodeMap() {
            if (this._decodeMap) return;
            this._decodeMap = {};
            for (let char in this._charMap) {
                this._decodeMap[this._charMap[char]] = char;
            }
        },

        // Кодировать строку по таблице
        encode(text) {
            if (!text && text !== '') return '';
            this._buildDecodeMap();
            let result = '';
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (this._charMap.hasOwnProperty(ch)) {
                    result += this._charMap[ch];
                } else {
                    // Символы, которых нет в таблице, оставляем как есть
                    result += ch;
                }
            }
            return result;
        },

        // Декодировать строку из кодов _xxx обратно в символы
        decode(encoded) {
            if (!encoded && encoded !== '') return '';
            this._buildDecodeMap();
            let result = '';
            let i = 0;
            while (i < encoded.length) {
                // Ищем подстроку вида _xxx (4 символа, начинается с '_')
                if (encoded[i] === '_' && i + 3 < encoded.length) {
                    const code = encoded.substr(i, 4);
                    if (this._decodeMap.hasOwnProperty(code)) {
                        result += this._decodeMap[code];
                        i += 4;
                        continue;
                    }
                }
                // Иначе просто добавляем символ
                result += encoded[i];
                i++;
            }
            return result;
        },

        // ========== 3. GRADUS CAPTCHA ==========
        captcha: {
            generate() {
                const a = Math.floor(Math.random() * 10) + 1;
                const b = Math.floor(Math.random() * 10) + 1;
                const ops = ['+', '-', '*'];
                const op = ops[Math.floor(Math.random() * ops.length)];
                let answer;
                switch (op) {
                    case '+': answer = a + b; break;
                    case '-': answer = a - b; break;
                    case '*': answer = a * b; break;
                }
                return { question: `${a} ${op} ${b} = ?`, answer };
            },
            check(generated, userAnswer) {
                if (!generated || userAnswer === undefined) return false;
                return parseInt(userAnswer) === generated.answer;
            },
            render(elementId) {
                const el = document.getElementById(elementId);
                if (!el) return null;
                const cap = this.generate();
                el.innerHTML = `
                    <div class="gradus-captcha">
                        <span>${cap.question}</span>
                        <input type="text" class="gradus-captcha-input" placeholder="Ответ" />
                        <input type="hidden" class="gradus-captcha-answer" value="${cap.answer}" />
                    </div>
                `;
                return cap;
            },
            verify(elementId) {
                const el = document.getElementById(elementId);
                if (!el) return false;
                const input = el.querySelector('.gradus-captcha-input');
                const hidden = el.querySelector('.gradus-captcha-answer');
                if (!input || !hidden) return false;
                return parseInt(input.value) === parseInt(hidden.value);
            }
        },

        // ========== 4. DDoS PROTECTION (rate limiter) ==========
        ddos: {
            _store: {},
            isAllowed(id, maxRequests = 5, intervalSeconds = 10) {
                const now = Date.now();
                if (!this._store[id]) {
                    this._store[id] = { count: 1, resetTime: now + intervalSeconds * 1000 };
                    return true;
                }
                const record = this._store[id];
                if (now > record.resetTime) {
                    record.count = 1;
                    record.resetTime = now + intervalSeconds * 1000;
                    return true;
                }
                if (record.count >= maxRequests) return false;
                record.count++;
                return true;
            },
            reset(id) { delete this._store[id]; },
            clear() { this._store = {}; }
        },

        // ========== 5. ГЕНЕРАТОРЫ ==========
        generate: {
            uuid() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
            password(length = 12) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
                const array = new Uint32Array(length);
                if (window.crypto && window.crypto.getRandomValues) {
                    window.crypto.getRandomValues(array);
                } else {
                    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 0x100000000);
                }
                let pass = '';
                for (let i = 0; i < length; i++) pass += chars[array[i] % chars.length];
                return pass;
            },
            randomInt(min, max) {
                const range = max - min + 1;
                const array = new Uint32Array(1);
                if (window.crypto && window.crypto.getRandomValues) {
                    window.crypto.getRandomValues(array);
                } else {
                    array[0] = Math.floor(Math.random() * 0x100000000);
                }
                return min + (array[0] % range);
            }
        },

        // ========== 6. УВЕДОМЛЕНИЯ ==========
        notify: {
            _ensureContainer() {
                if (!document.getElementById('gradus-notify-container')) {
                    const div = document.createElement('div');
                    div.id = 'gradus-notify-container';
                    div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
                    document.body.appendChild(div);
                }
                return document.getElementById('gradus-notify-container');
            },
            show(message, type = 'info', duration = 3000) {
                const container = this._ensureContainer();
                const toast = document.createElement('div');
                const colors = { success: '#4caf50', error: '#f44336', info: '#2196f3', warning: '#ff9800' };
                toast.style.cssText = `
                    background-color:${colors[type] || colors.info};
                    color:#fff;padding:12px 20px;border-radius:8px;
                    box-shadow:0 4px 12px rgba(0,0,0,0.15);
                    font-family:Segoe UI,system-ui,sans-serif;font-size:14px;
                    min-width:200px;opacity:0;transition:opacity 0.3s;
                `;
                toast.textContent = message;
                container.appendChild(toast);
                setTimeout(() => toast.style.opacity = '1', 10);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
                }, duration);
            },
            success(msg, d) { this.show(msg, 'success', d); },
            error(msg, d) { this.show(msg, 'error', d); },
            info(msg, d) { this.show(msg, 'info', d); },
            warning(msg, d) { this.show(msg, 'warning', d); }
        },

        // ========== 7. ИНИЦИАЛИЗАЦИЯ ==========
        init() {
            this._log('info', 'Gradus Web v' + this.version + ' загружен');
        }
    };

    window.GradusWeb = GradusWeb;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => GradusWeb.init());
    } else {
        GradusWeb.init();
    }
})(window);