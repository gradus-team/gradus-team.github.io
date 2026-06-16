#!/usr/bin/env node
/**
 * GradusCore – антивирусное ядро (Node.js)
 * Кроссплатформенная поддержка: Windows, Linux, macOS.
 * Использование:
 *   node graduscore.js scan <путь>
 *   node graduscore.js url-scan <url>
 *   node graduscore.js sandbox-scan <файл>
 *   node graduscore.js rootkit
 *   node graduscore.js stealth
 *   node graduscore.js custom-scan [--signatures] [--sandbox] [--rootkit] [--stealth] <путь>
 *   node graduscore.js docs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn, execFileSync } = require('child_process');
const https = require('https');
const { URL } = require('url');
const os = require('os');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// ---------- встроенные сигнатуры ----------
const SIGNATURES = {
  'bat-checker': [
    [/format\s+c:/i, 15], [/del\s+\/f\s+\/s/i, 12], [/rd\s+\/s\s+\/q/i, 10],
    [/powershell\s+-command/i, 15], [/cscript/i, 10], [/erase/i, 8],
    [/rmdir/i, 8], [/attrib\s+-r\s+-s\s+-h/i, 10], [/reg\s+add/i, 12],
    [/reg\s+delete/i, 14], [/schtasks/i, 15], [/curl/i, 8], [/wget/i, 8],
    [/bitsadmin/i, 12], [/powershell\s+-enc/i, 20], [/invoke-expression/i, 18],
    [/iex/i, 15], [/downloadstring/i, 15], [/bitcoin/i, 10], [/monero/i, 10],
    [/miner/i, 15], [/xmrig/i, 15], [/worm/i, 20], [/self-replicate/i, 18],
    [/startup/i, 8], [/taskkill/i, 6], [/net\s+user/i, 10],
    [/net\s+localgroup/i, 10], [/vssadmin\s+delete\s+shadows/i, 20]
  ],
  'js-checker': [
    [/document\.location/i, 10], [/eval\s*\(/i, 12], [/steal/i, 15],
    [/send\s+credentials/i, 20], [/XMLHttpRequest/i, 6], [/fetch\(/i, 5],
    [/WebSocket/i, 6], [/exec\(/i, 14], [/require\s*\(/i, 10], [/process\.env/i, 8]
  ],
  'exe-checker': [
    [/CreateRemoteThread/i, 15], [/WriteProcessMemory/i, 18], [/VirtualAllocEx/i, 12],
    [/SetWindowsHookEx/i, 14], [/ShellExecute/i, 12], [/RegSetValueEx/i, 12],
    [/URLDownloadToFile/i, 15], [/socket/i, 8], [/connect/i, 8], [/send/i, 8],
    [/recv/i, 6], [/bind/i, 8], [/listen/i, 8], [/accept/i, 8], [/WSAStartup/i, 5],
    [/GetProcAddress/i, 6]
  ],
  'url-checker': [
    [/paypal-verify\.com/i, 20], [/secure-login\.net/i, 18], [/appleid-fake\.com/i, 20],
    [/bit\.ly/i, 5], [/verify-account/i, 15], [/webscr/i, 15]
  ],
  'py-checker': [
    [/os\.system/i, 12], [/subprocess\.Popen/i, 10], [/requests\.post/i, 8],
    [/base64\.b64decode/i, 14], [/eval\s*\(/i, 8], [/exec\s*\(/i, 10]
  ],
  'other-checker': [
    [/delete/i, 5], [/remove/i, 4], [/exec/i, 6], [/write/i, 3]
  ],
  'obfuscation-checker': [
    [/base64_decode/i, 15], [/str_rot13/i, 10], [/gzinflate/i, 20]
  ],
  'rootkit-checker': [
    [/NtQuerySystemInformation/i, 18], [/ZwQuerySystemInformation/i, 18],
    [/\[hidden\]/i, 25], [/stealth/i, 30], [/filterdriver/i, 20]
  ]
};

// ---------- настройки ----------
class Settings {
  constructor(opts = {}) {
    this.notifications = opts.notifications || false;
    this.useSignatures = opts.useSignatures !== false;
    this.useMalwareBazaar = opts.useMalwareBazaar || false;
    this.useSandbox = opts.useSandbox || false;
    this.checkRootkits = opts.checkRootkits || false;
    this.checkStealth = opts.checkStealth || false;
    this.useAdvancedSandbox = opts.useAdvancedSandbox || false; // strace на Linux
  }
}

// ---------- основное ядро ----------
class GradusCore {
  static MALWAREBAZAAR_API = 'https://mb-api.abuse.ch/api/v1/';
  static OPENPHISH_URL = 'https://openphish.com/feed.txt';
  static _openphishCache = new Set();
  static _openphishLastUpdate = 0;

  constructor(settings = new Settings()) {
    this.settings = settings;
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graduscore-'));
    process.on('exit', () => this._cleanup());
  }

  _cleanup() {
    try { fs.rmSync(this.tempDir, { recursive: true, force: true }); } catch (e) {}
  }

  // ---------- публичные методы ----------
  /**
   * Сканирование файла или папки. Возвращает максимальный процент угрозы (0-100).
   */
  scan(target) {
    if (!fs.existsSync(target)) {
      this._log(`[!] ${target} не найден`);
      return 0;
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      return this._scanFolder(target);
    } else {
      return this._scanFile(target);
    }
  }

  /**
   * Проверка URL на фишинг (SAFE / PHISHING / SUSPICIOUS).
   */
  async scanURL(url) {
    try {
      const parsed = new URL(url);
      let host = parsed.hostname || url;
      host = host.toLowerCase().replace(/^www\./, '');
      const badDomains = await this._getOpenphishDomains();
      if (badDomains.has(host)) return 'PHISHING';
      const popular = ['google.com', 'youtube.com', 'facebook.com', 'wikipedia.org', 'amazon.com', 'paypal.com'];
      for (const p of popular) {
        if (this._levenshtein(host, p) <= 2) return 'SUSPICIOUS';
      }
      return 'SAFE';
    } catch (e) {
      return `ERROR: ${e.message}`;
    }
  }

  /**
   * Изолированный анализ файла (песочница).
   */
  sandboxScan(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      this._log('[!] Файл не найден');
      return 0;
    }
    const staticThreat = this._staticSandboxAnalysis(filePath);
    let dynamicThreat = 0;
    const ext = path.extname(filePath).toLowerCase();
    const platform = os.platform();
    if (platform === 'win32' && ['.exe', '.com', '.bat', '.cmd'].includes(ext)) {
      dynamicThreat = this._dynamicSandboxRunWindows(filePath);
    } else if (platform === 'linux' && this.settings.useAdvancedSandbox) {
      dynamicThreat = this._linuxSandboxStrace(filePath);
    }
    const threat = Math.max(staticThreat, dynamicThreat);
    this._log(`[sandbox] Угроза: ${threat}%`);
    return threat;
  }

  /**
   * Проверка системы на скрытые процессы / драйверы (руткиты).
   * Возвращает true при обнаружении подозрений.
   */
  rootkitScan() {
    const platform = os.platform();
    if (platform === 'win32') return this._rootkitScanWindows();
    else if (platform === 'linux') return this._rootkitScanLinux();
    else if (platform === 'darwin') return this._rootkitScanMacOS();
    else {
      this._log(`[rootkit] Неподдерживаемая ОС: ${platform}`);
      return false;
    }
  }

  /**
   * Проверка на скрытый запуск с правами администратора.
   */
  stealthLaunchDetected() {
    const isAdmin = this._isRunningAsAdmin();
    if (!isAdmin) return false;

    const currentPath = process.execPath.toLowerCase();
    const suspiciousDirs = {
      win32: ['\\temp\\', '\\downloads\\', '\\appdata\\', '\\users\\public\\'],
      linux: ['/tmp/', '/dev/shm/', '/var/tmp/'],
      darwin: ['/tmp/', '/private/tmp/', '/Users/Shared/']
    };
    const dirs = suspiciousDirs[os.platform()] || [];
    for (const dir of dirs) {
      if (currentPath.includes(dir.toLowerCase())) {
        this._log(`[stealth] Запуск из подозрительной папки с правами администратора: ${currentPath}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Кастомное сканирование с выбором методов. Возвращает -1 при системной угрозе.
   */
  customScan(target, customSettings) {
    let sysThreat = false;
    if (customSettings.checkRootkits && this.rootkitScan()) sysThreat = true;
    if (customSettings.checkStealth && this.stealthLaunchDetected()) sysThreat = true;

    const stat = fs.statSync(target);
    let maxThreat = 0;
    if (stat.isDirectory()) {
      maxThreat = this._customScanFolder(target, customSettings);
    } else {
      maxThreat = this._customScanFile(target, customSettings);
    }
    return sysThreat ? -1 : maxThreat;
  }

  // ---------- внутренние методы сканирования ----------
  _scanFolder(dir) {
    let maxThreat = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        maxThreat = Math.max(maxThreat, this._scanFolder(full));
      } else {
        maxThreat = Math.max(maxThreat, this._scanFile(full));
      }
    }
    return maxThreat;
  }

  _scanFile(filePath) {
    let threat = 0;
    if (this.settings.useSignatures) {
      threat = Math.max(threat, this._signatureScan(filePath));
    }
    if (this.settings.useMalwareBazaar) {
      try {
        const sha = this._sha256(filePath);
        if (this._checkMalwareBazaarSync(sha)) { // синхронная версия для удобства
          threat = 100;
          this._log(`[MalwareBazaar] ${path.basename(filePath)} найден в базе`);
        }
      } catch (e) { /* ignore */ }
    }
    if (threat > 0 && this.settings.notifications) {
      console.log(`${path.basename(filePath)} – угроза ${threat}%`);
    }
    return Math.min(threat, 100);
  }

  _customScanFolder(dir, s) {
    let maxThreat = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        maxThreat = Math.max(maxThreat, this._customScanFolder(full, s));
      } else {
        maxThreat = Math.max(maxThreat, this._customScanFile(full, s));
      }
    }
    return maxThreat;
  }

  _customScanFile(filePath, s) {
    let threat = 0;
    if (s.useSignatures) threat = Math.max(threat, this._signatureScan(filePath));
    if (s.useSandbox) threat = Math.max(threat, this.sandboxScan(filePath));
    if (s.useMalwareBazaar) {
      try {
        const sha = this._sha256(filePath);
        if (this._checkMalwareBazaarSync(sha)) threat = 100;
      } catch (e) {}
    }
    if (threat > 0 && s.notifications) {
      console.log(`${path.basename(filePath)} – угроза ${threat}% (custom)`);
    }
    return Math.min(threat, 100);
  }

  // ---------- сигнатурный анализ ----------
  _signatureScan(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.exe' || ext === '.dll') return this._analyzePE(filePath);
    if (ext === '.jar') return this._analyzeJar(filePath);
    if (ext === '.java') return this._analyzeJava(filePath);
    const ruleKey = ext.replace('.', '');
    let rules = SIGNATURES[ruleKey] || SIGNATURES['other-checker'] || [];
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      content = this._normalizeCode(content);
      let weight = 0;
      for (const [regex, w] of rules) {
        if (regex.test(content)) weight += w;
      }
      return Math.min(weight, 100);
    } catch (e) {
      return 0;
    }
  }

  _analyzePE(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      if (data.length < 64) return 0;
      const ascii = data.toString('latin1');
      const suspicious = ['CreateRemoteThread', 'WriteProcessMemory', 'VirtualAllocEx'];
      let weight = 0;
      for (const s of suspicious) if (ascii.includes(s)) weight += 15;
      return Math.min(weight, 100);
    } catch (e) { return 0; }
  }

  _analyzeJar(filePath) {
    try {
      // упрощённый анализ: количество .class файлов (требует модуль adm-zip для полноценного)
      return 0; // заглушка
    } catch (e) { return 0; }
  }

  _analyzeJava(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
    let weight = 0;
    if (content.includes('runtime.exec')) weight += 20;
    if (content.includes('processbuilder')) weight += 15;
    return Math.min(weight, 100);
  }

  // ---------- песочница ----------
  _staticSandboxAnalysis(filePath) {
    let score = 0;
    try {
      const buf = fs.readFileSync(filePath);
      const text = buf.toString('latin1').toLowerCase();
      if (/https?:\/\//.test(text)) score += 20;
      if (/powershell/.test(text)) score += 25;
      if (/cmd\.exe\s+\/c/.test(text)) score += 20;
      if (/createprocess|winexec|shell_execute/.test(text)) score += 15;
      if (/regsvr32/.test(text)) score += 25;
      if (/cryptacquirecontext/.test(text)) score += 20;
    } catch (e) {}
    return Math.min(score, 100);
  }

  _dynamicSandboxRunWindows(filePath) {
    if (os.platform() !== 'win32') return 0;
    this._log(`[sandbox] Динамический запуск ${path.basename(filePath)}`);
    try {
      const ruleName = 'GradusCore_Sandbox';
      execSync(`netsh advfirewall firewall add rule name="${ruleName}" dir=out program="${filePath}" action=block`);
      let output = '';
      try {
        output = execSync(`"${filePath}"`, { timeout: 10000, encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        output = e.stdout || '';
        if (e.stderr) output += e.stderr;
      }
      execSync(`netsh advfirewall firewall delete rule name="${ruleName}"`);

      let score = 0;
      const lower = output.toLowerCase();
      if (/https?:\/\//.test(lower)) score += 30;
      if (/download|wget|curl/.test(lower)) score += 25;
      if (/c:\\windows\\system32/.test(lower)) score += 35;
      if (/c:\\program files/.test(lower)) score += 20;
      if (/registry|hklm|hkcu/.test(lower)) score += 25;
      if (/createfile|writefile/.test(lower)) score += 20;
      if (/regsvr32|sc stop|sc delete/.test(lower)) score += 25;
      if (/socket|connect/.test(lower)) score += 25;
      if (/powershell|cmd.exe \/c/.test(lower)) score += 30;
      if (/base64|frombase64string/.test(lower)) score += 20;
      if (/invoke|iex|bypass/.test(lower)) score += 25;
      if (/hidden|windowstyle/.test(lower)) score += 20;
      return Math.min(score, 100);
    } catch (e) {
      this._log(`[sandbox] Ошибка динамического запуска: ${e.message}`);
      return 0;
    }
  }

  _linuxSandboxStrace(filePath) {
    if (!this._commandExists('strace')) return 0;
    this._log('[sandbox] Экспериментальный strace-анализ');
    try {
      const output = execSync(`strace -f -e trace=network,file "${filePath}"`, {
        timeout: 5000, encoding: 'utf8', stdio: 'pipe'
      });
      const lower = output.toLowerCase();
      let score = 0;
      if (/connect\(|socket\(/.test(lower)) score += 30;
      if (/openat\(.*\/etc\/passwd/.test(lower)) score += 40;
      if (/openat\(.*\.ssh\//.test(lower)) score += 50;
      return Math.min(score, 100);
    } catch (e) {
      this._log(`[sandbox/strace] Ошибка: ${e.message}`);
      return 0;
    }
  }

  // ---------- проверка руткитов (кроссплатформенная) ----------
  _rootkitScanWindows() {
    let found = false;
    try {
      const tasklist = execSync('tasklist /v /fo csv', { encoding: 'utf8' });
      tasklist.split('\n').forEach(line => {
        const lower = line.toLowerCase();
        if (lower.includes('rootkit') || lower.includes('hidden') || lower.includes('suspicious')) {
          found = true;
          this._log(`[rootkit] Подозрительный процесс: ${line.trim()}`);
        }
      });
      const drivers = execSync('sc query type= driver state= all', { encoding: 'utf8' });
      drivers.split('\n').forEach(line => {
        if (line.toLowerCase().includes('hidden') || line.toLowerCase().includes('rootkit')) {
          found = true;
          this._log(`[rootkit] Подозрительный драйвер: ${line.trim()}`);
        }
      });
    } catch (e) {
      this._log(`[rootkit] Ошибка Windows: ${e.message}`);
    }
    return found;
  }

  _rootkitScanLinux() {
    let found = false;
    try {
      // Скрытые процессы (сравнение /proc и ps)
      const procPids = new Set();
      const procDir = '/proc';
      if (fs.existsSync(procDir)) {
        const entries = fs.readdirSync(procDir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory() && /^\d+$/.test(ent.name)) {
            procPids.add(parseInt(ent.name, 10));
          }
        }
      }
      const psOutput = execSync('ps -e -o pid=', { encoding: 'utf8' });
      const psPids = new Set(psOutput.split('\n').filter(l => l.trim()).map(l => parseInt(l.trim(), 10)));
      const hiddenPids = new Set([...procPids].filter(x => !psPids.has(x)));
      hiddenPids.delete(1);
      if (hiddenPids.size > 0) {
        found = true;
        this._log(`[rootkit] Скрытые процессы (PID): ${[...hiddenPids].join(', ')}`);
      }
    } catch (e) {
      this._log(`[rootkit] Ошибка сканирования процессов: ${e.message}`);
    }

    try {
      // Скрытые модули ядра
      const lsmodOut = execSync('lsmod', { encoding: 'utf8' });
      const lsmodModules = new Set();
      lsmodOut.split('\n').slice(1).forEach(line => {
        const mod = line.split(/\s+/)[0];
        if (mod) lsmodModules.add(mod);
      });
      if (fs.existsSync('/proc/modules')) {
        const procModules = new Set(fs.readFileSync('/proc/modules', 'utf8').split('\n').map(l => l.split(/\s+/)[0]).filter(Boolean));
        const hiddenMods = new Set([...lsmodModules].filter(x => !procModules.has(x)));
        if (hiddenMods.size > 0) {
          found = true;
          this._log(`[rootkit] Скрытые модули ядра: ${[...hiddenMods].join(', ')}`);
        }
      }
    } catch (e) {
      this._log(`[rootkit] Ошибка проверки модулей: ${e.message}`);
    }

    try {
      const mounts = fs.readFileSync('/proc/1/mounts', 'utf8');
      if (mounts.includes('hidepid=')) {
        this._log('[rootkit] Обнаружена опция hidepid в /proc – возможно сокрытие процессов');
        found = true;
      }
    } catch (e) {}

    return found;
  }

  _rootkitScanMacOS() {
    let found = false;
    try {
      const kextstat = execSync('kextstat', { encoding: 'utf8' });
      kextstat.split('\n').forEach(line => {
        if (!line.includes('com.apple') && !line.includes('com.google') && !line.includes('com.microsoft')) {
          if (line.includes('kernel') || line.includes('driver')) {
            this._log(`[rootkit] Подозрительный kext: ${line.trim()}`);
            found = true;
          }
        }
      });
    } catch (e) {
      this._log(`[rootkit] Ошибка kextstat: ${e.message}`);
    }

    try {
      const psOut = execSync('ps aux', { encoding: 'utf8' });
      psOut.split('\n').slice(1).forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const command = parts.slice(10).join(' ');
          if (command === '' || command === '???') {
            this._log(`[rootkit] Безымянный процесс: ${line.trim()}`);
            found = true;
          }
        }
      });
    } catch (e) {
      this._log(`[rootkit] Ошибка ps: ${e.message}`);
    }
    return found;
  }

  // ---------- права администратора ----------
  _isRunningAsAdmin() {
    try {
      if (os.platform() === 'win32') {
        execSync('net session', { stdio: 'ignore' });
        return true;
      } else {
        return process.getuid && process.getuid() === 0;
      }
    } catch (e) {
      return false;
    }
  }

  _commandExists(cmd) {
    try {
      execSync(os.platform() === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- проверка URL (OpenPhish) ----------
  async _getOpenphishDomains() {
    const now = Date.now();
    if (now - GradusCore._openphishLastUpdate < 3600000 && GradusCore._openphishCache.size > 0) {
      return GradusCore._openphishCache;
    }
    return new Promise((resolve) => {
      https.get(GradusCore.OPENPHISH_URL, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const domains = new Set();
          data.split('\n').forEach(line => {
            line = line.trim().toLowerCase();
            if (!line) return;
            try {
              const host = new URL(line).hostname;
              if (host) domains.add(host.replace(/^www\./, ''));
            } catch (e) {}
          });
          GradusCore._openphishCache = domains;
          GradusCore._openphishLastUpdate = now;
          resolve(domains);
        });
      }).on('error', (e) => {
        resolve(GradusCore._openphishCache);
      });
    });
  }

  // ---------- MalwareBazaar (синхронная версия для CLI) ----------
  _checkMalwareBazaarSync(sha256) {
    // Простейшая синхронная проверка через execSync curl (зависит от окружения)
    if (!this._commandExists('curl')) return false;
    try {
      const result = execSync(
        `curl -s -X POST -d "query=get_info&hash=${sha256}" ${GradusCore.MALWAREBAZAAR_API}`,
        { encoding: 'utf8', timeout: 10000 }
      );
      return result.toLowerCase().includes('malware');
    } catch (e) {
      return false;
    }
  }

  // ---------- утилиты ----------
  _sha256(filePath) {
    const h = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    h.update(data);
    return h.digest('hex');
  }

  _normalizeCode(code) {
    code = code.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    return code.toLowerCase();
  }

  _levenshtein(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitute = matrix[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          substitute
        );
      }
    }
    return matrix[b.length][a.length];
  }

  _log(msg) {
    if (this.settings.notifications) console.log(msg);
  }
}

// ==================== CLI ====================
function printDocs() {
  console.log(`
GradusCore – антивирусное ядро (Node.js).
Использование:
  node graduscore.js scan <путь>
  node graduscore.js url-scan <url>
  node graduscore.js sandbox-scan <файл>
  node graduscore.js rootkit
  node graduscore.js stealth
  node graduscore.js custom-scan [--signatures] [--sandbox] [--rootkit] [--stealth] <путь>
  node graduscore.js docs
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'docs') {
    printDocs();
    return;
  }
  const cmd = args[0].toLowerCase();
  const rest = args.slice(1);
  const core = new GradusCore(new Settings({ notifications: true }));

  switch (cmd) {
    case 'scan':
      if (!rest[0]) return console.log('Укажите путь: scan <файл/папка>');
      console.log(`Макс. угроза: ${core.scan(rest[0])}%`);
      break;
    case 'url-scan':
      if (!rest[0]) return console.log('Укажите URL');
      core.scanURL(rest[0]).then(console.log);
      break;
    case 'sandbox-scan':
      if (!rest[0]) return console.log('Укажите файл');
      console.log(`Угроза (песочница): ${core.sandboxScan(rest[0])}%`);
      break;
    case 'rootkit':
      console.log(core.rootkitScan() ? 'Обнаружены руткиты!' : 'Руткиты не обнаружены.');
      break;
    case 'stealth':
      console.log(core.stealthLaunchDetected() ? 'Обнаружен скрытый запуск!' : 'Скрытый запуск не обнаружен.');
      break;
    case 'custom-scan': {
      const customSet = new Settings();
      let i = 0;
      while (i < rest.length && rest[i].startsWith('--')) {
        switch (rest[i]) {
          case '--signatures': customSet.useSignatures = true; break;
          case '--sandbox': customSet.useSandbox = true; break;
          case '--rootkit': customSet.checkRootkits = true; break;
          case '--stealth': customSet.checkStealth = true; break;
        }
        i++;
      }
      if (i >= rest.length) return console.log('Укажите путь после опций');
      const target = rest[i];
      const res = core.customScan(target, customSet);
      if (res === -1) console.log('ОБНАРУЖЕНЫ СИСТЕМНЫЕ АНОМАЛИИ!');
      else console.log(`Макс. угроза (custom): ${res}%`);
      break;
    }
    default:
      console.log('Неизвестная команда. Используйте docs.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GradusCore, Settings };