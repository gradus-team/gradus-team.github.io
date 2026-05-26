const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const https = require('https');
const { Readable } = require('stream');

// ======================== СИГНАТУРЫ ========================
const SIGNATURES = {
    "bat-checker": [
        [/format\s+c:/i, 15], [/del\s+\/f\s+\/s/i, 12], [/rd\s+\/s\s+\/q/i, 10],
        [/powershell\s+-command/i, 15], [/cscript/i, 10], [/erase/i, 8], [/rmdir/i, 8],
        [/attrib\s+-r\s+-s\s+-h/i, 10], [/reg\s+add/i, 12], [/reg\s+delete/i, 14],
        [/schtasks/i, 15], [/curl/i, 8], [/wget/i, 8], [/bitsadmin/i, 12],
        [/powershell\s+-enc/i, 20], [/invoke-expression/i, 18], [/iex/i, 15],
        [/downloadstring/i, 15], [/bitcoin/i, 10], [/monero/i, 10], [/miner/i, 15],
        [/xmrig/i, 15], [/worm/i, 20], [/self-replicate/i, 18], [/startup/i, 8],
        [/taskkill/i, 6], [/net\s+user/i, 10], [/net\s+localgroup/i, 10],
        [/vssadmin\s+delete\s+shadows/i, 20]
    ],
    "js-checker": [
        [/document\.location/i, 10], [/eval\s*\(/i, 12], [/steal/i, 15],
        [/send\s+credentials/i, 20], [/XMLHttpRequest/i, 6], [/fetch/i, 5],
        [/WebSocket/i, 6], [/exec/i, 14], [/require\s*\(/i, 10], [/process\.env/i, 8]
    ],
    "exe-checker": [
        [/CreateRemoteThread/i, 15], [/WriteProcessMemory/i, 18], [/VirtualAllocEx/i, 12],
        [/SetWindowsHookEx/i, 14], [/ShellExecute/i, 12], [/RegSetValueEx/i, 12],
        [/URLDownloadToFile/i, 15], [/socket/i, 8], [/connect/i, 8], [/send/i, 8],
        [/recv/i, 6], [/bind/i, 8], [/listen/i, 8], [/accept/i, 8],
        [/WSAStartup/i, 5], [/GetProcAddress/i, 6]
    ],
    "url-checker": [
        [/paypal-verify\.com/i, 20], [/secure-login\.net/i, 18],
        [/appleid-fake\.com/i, 20], [/bit\.ly/i, 5], [/verify-account/i, 15], [/webscr/i, 15]
    ],
    "py-checker": [
        [/os\.system/i, 12], [/subprocess\.Popen/i, 10], [/requests\.post/i, 8],
        [/base64\.b64decode/i, 14], [/eval\s*\(/i, 8], [/exec\s*\(/i, 10]
    ],
    "other-checker": [
        [/\bdelete\b/i, 5], [/\bremove\b/i, 4], [/\bexec\b/i, 6], [/\bwrite\b/i, 3]
    ],
    "obfuscation-checker": [
        [/base64_decode/i, 15], [/str_rot13/i, 10], [/gzinflate/i, 20]
    ],
    "rootkit-checker": [
        [/NtQuerySystemInformation/i, 18], [/ZwQuerySystemInformation/i, 18],
        [/\[hidden\]/i, 25], [/stealth/i, 30], [/filterdriver/i, 20]
    ]
};

// ======================== НАСТРОЙКИ ========================
class Settings {
    constructor() {
        this.notifications = false;
        this.useSignatures = true;
        this.useMalwareBazaar = false;
    }
}

// ======================== ЯДРО ========================
class GradusCore {
    constructor(settings = new Settings()) {
        this.settings = settings;
    }

    /**
     * Сканирует файл или папку по пути и возвращает максимальный процент угрозы (0-100).
     */
    scan(targetPath) {
        const stat = fs.statSync(targetPath);
        if (!stat) {
            if (this.settings.notifications) console.error(`[GradusCore] Путь не найден: ${targetPath}`);
            return 0;
        }
        if (stat.isDirectory()) {
            return this._scanDir(targetPath);
        } else {
            return this._scanFile(targetPath);
        }
    }

    /**
     * Сканирует буфер (содержимое файла, например из Telegram) и возвращает процент угрозы.
     * @param {Buffer} buffer - содержимое файла
     * @param {string} filename - оригинальное имя файла (для определения расширения)
     */
    scanBuffer(buffer, filename) {
        return this._scanData(buffer, filename);
    }

    /**
     * Сканирует переданный текст как содержимое файла.
     */
    scanText(text, filename) {
        const ext = path.extname(filename).toLowerCase();
        return this._scanByText(text, ext);
    }

    /**
     * Возвращает текст из файла (UTF-8).
     */
    getTextFromFile(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }

    // ================ ВНУТРЕННИЕ МЕТОДЫ ================
    _scanDir(dirPath) {
        let maxThreat = 0;
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else {
                    const threat = this._scanFile(fullPath);
                    if (threat > maxThreat) maxThreat = threat;
                }
            }
        };
        walk(dirPath);
        return maxThreat;
    }

    _scanFile(filePath) {
        let threat = 0;
        try {
            const buffer = fs.readFileSync(filePath);
            threat = this._scanData(buffer, path.basename(filePath));
        } catch (err) {
            // ignore
        }
        return threat;
    }

    _scanData(buffer, filename) {
        let threat = 0;
        const ext = path.extname(filename).toLowerCase();

        if (this.settings.useSignatures) {
            threat = Math.max(threat, this._signatureScanBuffer(buffer, ext));
        }

        if (this.settings.useMalwareBazaar && threat < 100) {
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
            if (this._checkMalwareBazaarSync(sha256)) {
                threat = 100;
                if (this.settings.notifications) console.log(`[MalwareBazaar] ${filename} найден в базе MalwareBazaar`);
            }
        }

        if (this.settings.notifications && threat > 0) {
            console.log(`${filename} – угроза ${threat}%`);
        }

        return Math.min(threat, 100);
    }

    _signatureScanBuffer(buffer, ext) {
        // PE анализ (exe/dll)
        if (ext === '.exe' || ext === '.dll') {
            return this._analyzePE(buffer);
        }
        // JAR – упрощённо
        if (ext === '.jar') {
            return this._analyzeJar(buffer);
        }

        // Текстовые форматы
        let text;
        try {
            text = buffer.toString('utf-8');
        } catch {
            text = buffer.toString('latin1');
        }
        return this._scanByText(text, ext);
    }

    _scanByText(text, ext) {
        let signatures = SIGNATURES[ext];
        if (!signatures) signatures = SIGNATURES['other-checker'];
        if (!signatures) return 0;

        const normalized = this._normalizeCode(text);
        let weight = 0;
        for (const [regex, w] of signatures) {
            if (regex.test(normalized)) {
                weight += w;
            }
        }
        return Math.min(weight, 100);
    }

    _normalizeCode(code) {
        let result = code.replace(/\/\/.*/g, '');
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        result = result.replace(/\s+/g, ' ');
        return result.toLowerCase();
    }

    _analyzePE(buffer) {
        if (buffer.length < 64) return 0;
        const suspicious = ['CreateRemoteThread', 'WriteProcessMemory', 'VirtualAllocEx'];
        let weight = 0;
        for (const s of suspicious) {
            if (buffer.includes(Buffer.from(s, 'ascii'))) {
                weight += 15;
            }
        }
        return Math.min(weight, 100);
    }

    _analyzeJar(buffer) {
        // JAR - это ZIP, ищем .class файлы
        try {
            // Простейший поиск строки ".class" в центральном каталоге
            const text = buffer.toString('latin1');
            const matches = text.match(/\.classPK/g);
            const count = matches ? matches.length : 0;
            return Math.min(count * 5, 100);
        } catch {
            return 0;
        }
    }

    // Синхронная проверка MalwareBazaar (для простоты, можно сделать асинхронной)
    _checkMalwareBazaarSync(sha256) {
        // Node.js не имеет синхронного HTTP, поэтому возвращаем false.
        // В реальном боте следует использовать асинхронную версию scanBufferAsync.
        return false;
    }

    // Асинхронная версия для использования в ботах
    async scanBufferAsync(buffer, filename) {
        let threat = 0;
        const ext = path.extname(filename).toLowerCase();

        if (this.settings.useSignatures) {
            threat = Math.max(threat, this._signatureScanBuffer(buffer, ext));
        }

        if (this.settings.useMalwareBazaar && threat < 100) {
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
            try {
                const isMalware = await this._checkMalwareBazaar(sha256);
                if (isMalware) {
                    threat = 100;
                    if (this.settings.notifications) console.log(`[MalwareBazaar] ${filename} найден в базе MalwareBazaar`);
                }
            } catch (e) { /* ignore */ }
        }

        if (this.settings.notifications && threat > 0) {
            console.log(`${filename} – угроза ${threat}%`);
        }

        return Math.min(threat, 100);
    }

    async _checkMalwareBazaar(sha256) {
        return new Promise((resolve) => {
            const postData = `query=get_info&hash=${sha256}`;
            const options = {
                hostname: 'mb-api.abuse.ch',
                path: '/api/v1/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data.toLowerCase().includes('malware')));
            });
            req.on('error', () => resolve(false));
            req.write(postData);
            req.end();
        });
    }
}

// ======================== КОНСОЛЬНЫЙ ЗАПУСК ========================
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0].toLowerCase() === 'docs') {
        console.log('=== GradusCore Node.js – Антивирусное ядро ===\n');
        console.log('Использование из командной строки:');
        console.log('  node graduscore_js.js <путь к файлу или папке>');
        console.log('  node graduscore_js.js docs\n');
        console.log('Использование как библиотека:');
        console.log('  const { GradusCore, Settings } = require("./graduscore_js");');
        console.log('  const settings = new Settings();');
        console.log('  settings.useSignatures = true;');
        console.log('  const core = new GradusCore(settings);');
        console.log('  const threat = core.scan("путь/к/файлу");');
        console.log('  // или для данных из бота:');
        console.log('  const threat = core.scanBuffer(fileBuffer, "имя_файла.exe");');
        console.log('  const threat = core.scanText(fileText, "script.bat");');
        console.log('  // асинхронно с MalwareBazaar:');
        console.log('  const threat = await core.scanBufferAsync(buffer, "file.exe");');
        console.log('\nНастройки (Settings):');
        console.log('  notifications : bool (по умолчанию false)');
        console.log('  useSignatures : bool (по умолчанию true)');
        console.log('  useMalwareBazaar : bool (по умолчанию false)');
        process.exit(0);
    }

    const targetPath = args[0];
    const settings = new Settings();
    settings.useSignatures = true;
    settings.notifications = true;
    const core = new GradusCore(settings);
    const result = core.scan(targetPath);
    console.log(`\nМаксимальный уровень угрозы: ${result}%`);
}

module.exports = { GradusCore, Settings };