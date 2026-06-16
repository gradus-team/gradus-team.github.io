#!/usr/bin/env python3
"""
GradusCore – антивирусное ядро (Python).
Кроссплатформенная поддержка: Windows, Linux, macOS.
Использование:
    python graduscore.py scan <путь>
    python graduscore.py url-scan <url>
    python graduscore.py sandbox-scan <файл>
    python graduscore.py rootkit
    python graduscore.py stealth
    python graduscore.py custom-scan [--signatures] [--sandbox] <путь>
    python graduscore.py docs
"""
import os
import sys
import json
import time
import hashlib
import subprocess
import tempfile
import shutil
import signal
import platform
import urllib.request
import urllib.parse
import re
import ctypes
from pathlib import Path
from typing import List, Dict, Tuple, Set, Optional

# ---------- встроенные сигнатуры ----------
SIGNATURES: Dict[str, List[Tuple[str, int]]] = {
    "bat-checker": [
        (r"format\s+c:", 15), (r"del\s+/f\s+/s", 12), (r"rd\s+/s\s+/q", 10),
        (r"powershell\s+-command", 15), (r"cscript", 10), (r"erase", 8),
        (r"rmdir", 8), (r"attrib\s+-r\s+-s\s+-h", 10), (r"reg\s+add", 12),
        (r"reg\s+delete", 14), (r"schtasks", 15), (r"curl", 8), (r"wget", 8),
        (r"bitsadmin", 12), (r"powershell\s+-enc", 20), (r"invoke-expression", 18),
        (r"iex", 15), (r"downloadstring", 15), (r"bitcoin", 10), (r"monero", 10),
        (r"miner", 15), (r"xmrig", 15), (r"worm", 20), (r"self-replicate", 18),
        (r"startup", 8), (r"taskkill", 6), (r"net\s+user", 10),
        (r"net\s+localgroup", 10), (r"vssadmin\s+delete\s+shadows", 20)
    ],
    "js-checker": [
        (r"document\.location", 10), (r"eval\s*\(.*\)", 12), (r"steal", 15),
        (r"send\s+credentials", 20), (r"XMLHttpRequest", 6), (r"fetch\(", 5),
        (r"WebSocket", 6), (r"exec\(", 14), (r"require\s*\(", 10), (r"process\.env", 8)
    ],
    "exe-checker": [
        (r"CreateRemoteThread", 15), (r"WriteProcessMemory", 18), (r"VirtualAllocEx", 12),
        (r"SetWindowsHookEx", 14), (r"ShellExecute", 12), (r"RegSetValueEx", 12),
        (r"URLDownloadToFile", 15), (r"socket", 8), (r"connect", 8), (r"send", 8),
        (r"recv", 6), (r"bind", 8), (r"listen", 8), (r"accept", 8), (r"WSAStartup", 5),
        (r"GetProcAddress", 6)
    ],
    "url-checker": [
        (r"paypal-verify\.com", 20), (r"secure-login\.net", 18), (r"appleid-fake\.com", 20),
        (r"bit\.ly", 5), (r"verify-account", 15), (r"webscr", 15)
    ],
    "py-checker": [
        (r"os\.system", 12), (r"subprocess\.Popen", 10), (r"requests\.post", 8),
        (r"base64\.b64decode", 14), (r"eval\s*\(", 8), (r"exec\s*\(", 10)
    ],
    "other-checker": [
        (r"delete", 5), (r"remove", 4), (r"exec", 6), (r"write", 3)
    ],
    "obfuscation-checker": [
        (r"base64_decode", 15), (r"str_rot13", 10), (r"gzinflate", 20)
    ],
    "rootkit-checker": [
        (r"NtQuerySystemInformation", 18), (r"ZwQuerySystemInformation", 18),
        (r"\\[hidden\\]", 25), (r"stealth", 30), (r"filterdriver", 20)
    ]
}

# ---------- настройки ----------
class Settings:
    def __init__(self, **kwargs):
        self.notifications = kwargs.get("notifications", False)
        self.use_signatures = kwargs.get("use_signatures", True)
        self.use_malwarebazaar = kwargs.get("use_malwarebazaar", False)
        self.use_sandbox = kwargs.get("use_sandbox", False)
        self.check_rootkits = kwargs.get("check_rootkits", False)
        self.check_stealth = kwargs.get("check_stealth", False)
        self.use_advanced_sandbox = kwargs.get("use_advanced_sandbox", False)  # strace на Linux

# ---------- основное ядро ----------
class GradusCore:
    MALWAREBAZAAR_API = "https://mb-api.abuse.ch/api/v1/"
    OPENPHISH_URL = "https://openphish.com/feed.txt"
    _openphish_cache: Set[str] = set()
    _openphish_last_update: float = 0

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.temp_dir = tempfile.mkdtemp(prefix="graduscore_")
        import atexit
        atexit.register(self._cleanup)

    def _cleanup(self):
        try:
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        except Exception:
            pass

    # ---------- публичные методы ----------
    def scan(self, target: Path) -> int:
        """Сканирование файла или папки, возвращает максимальный процент угрозы (0-100)."""
        if not target.exists():
            self._log(f"[!] {target} не найден")
            return 0
        if target.is_dir():
            return self._scan_folder(target)
        else:
            return self._scan_file(target)

    def scan_url(self, url: str) -> str:
        """Проверка URL на фишинг (SAFE / PHISHING / SUSPICIOUS)."""
        try:
            host = urllib.parse.urlparse(url).hostname
            if not host:
                host = url
            host = host.lower().lstrip("www.")
            bad_domains = self._get_openphish_domains()
            if host in bad_domains:
                return "PHISHING"
            popular = ["google.com", "youtube.com", "facebook.com", "wikipedia.org",
                       "amazon.com", "paypal.com"]
            for p in popular:
                if self._levenshtein(host, p) <= 2:
                    return "SUSPICIOUS"
            return "SAFE"
        except Exception as e:
            return f"ERROR: {e}"

    def sandbox_scan(self, file_path: Path) -> int:
        """Изолированный анализ исполняемого файла."""
        if not file_path.is_file():
            self._log("[!] Файл не найден")
            return 0
        static_threat = self._static_sandbox_analysis(file_path)
        dynamic_threat = 0
        system = platform.system()
        if system == "Windows" and file_path.suffix.lower() in (".exe", ".com", ".bat", ".cmd"):
            dynamic_threat = self._dynamic_sandbox_run_windows(file_path)
        elif system == "Linux" and self.settings.use_advanced_sandbox:
            dynamic_threat = self._linux_sandbox_strace(file_path)
        threat = max(static_threat, dynamic_threat)
        self._log(f"[sandbox] Угроза: {threat}%")
        return threat

    def rootkit_scan(self) -> bool:
        """Проверка на скрытые процессы / драйверы. Возвращает True при подозрении."""
        system = platform.system()
        if system == "Windows":
            return self._rootkit_scan_windows()
        elif system == "Linux":
            return self._rootkit_scan_linux()
        elif system == "Darwin":
            return self._rootkit_scan_macos()
        else:
            self._log(f"[rootkit] Неподдерживаемая ОС: {system}")
            return False

    def stealth_launch_detected(self) -> bool:
        """Проверка, запущена ли программа скрыто с повышенными привилегиями."""
        system = platform.system()
        is_admin = self._is_running_as_admin()
        if not is_admin:
            return False

        current_path = Path(sys.executable).resolve()
        suspicious_dirs = {
            'Windows': ['\\temp\\', '\\downloads\\', '\\appdata\\', '\\users\\public\\'],
            'Linux': ['/tmp/', '/dev/shm/', '/var/tmp/'],
            'Darwin': ['/tmp/', '/private/tmp/', '/Users/Shared/']
        }.get(system, [])

        path_str = str(current_path).lower()
        for s in suspicious_dirs:
            if s.lower() in path_str:
                self._log(f"[stealth] Запуск из подозрительной папки с правами администратора: {current_path}")
                return True
        return False

    def custom_scan(self, target: Path, custom_settings: Settings) -> int:
        """Кастомный скан с выбором методов. Возвращает -1 при системной угрозе."""
        sys_threat = False
        if custom_settings.check_rootkits and self.rootkit_scan():
            sys_threat = True
        if custom_settings.check_stealth and self.stealth_launch_detected():
            sys_threat = True

        max_threat = 0
        if target.is_dir():
            max_threat = self._custom_scan_folder(target, custom_settings)
        else:
            max_threat = self._custom_scan_file(target, custom_settings)
        return -1 if sys_threat else max_threat

    # ---------- внутренние методы сканирования ----------
    def _scan_folder(self, folder: Path) -> int:
        max_threat = 0
        for entry in folder.iterdir():
            if entry.is_dir():
                max_threat = max(max_threat, self._scan_folder(entry))
            else:
                max_threat = max(max_threat, self._scan_file(entry))
        return max_threat

    def _scan_file(self, file_path: Path) -> int:
        threat = 0
        if self.settings.use_signatures:
            threat = max(threat, self._signature_scan(file_path))
        if self.settings.use_malwarebazaar:
            try:
                sha = self._sha256(file_path)
                if self._check_malwarebazaar(sha):
                    threat = max(threat, 100)
                    self._log(f"[MalwareBazaar] {file_path.name} найден в базе")
            except Exception:
                pass
        if threat > 0 and self.settings.notifications:
            print(f"{file_path.name} – угроза {threat}%")
        return threat

    def _custom_scan_folder(self, folder: Path, s: Settings) -> int:
        max_threat = 0
        for entry in folder.iterdir():
            if entry.is_dir():
                max_threat = max(max_threat, self._custom_scan_folder(entry, s))
            else:
                max_threat = max(max_threat, self._custom_scan_file(entry, s))
        return max_threat

    def _custom_scan_file(self, file_path: Path, s: Settings) -> int:
        threat = 0
        if s.use_signatures:
            threat = max(threat, self._signature_scan(file_path))
        if s.use_sandbox:
            threat = max(threat, self.sandbox_scan(file_path))
        if s.use_malwarebazaar:
            try:
                if self._check_malwarebazaar(self._sha256(file_path)):
                    threat = max(threat, 100)
            except Exception:
                pass
        if threat > 0 and s.notifications:
            print(f"{file_path.name} – угроза {threat}% (custom)")
        return min(threat, 100)

    # ---------- сигнатурный анализ ----------
    def _signature_scan(self, file_path: Path) -> int:
        ext = file_path.suffix.lower()
        if ext in (".exe", ".dll"):
            return self._analyze_pe(file_path)
        if ext == ".jar":
            return self._analyze_jar(file_path)
        if ext == ".java":
            return self._analyze_java(file_path)
        rule_key = ext.lstrip(".")
        rules = SIGNATURES.get(rule_key)
        if not rules:
            rules = SIGNATURES.get("other-checker", [])
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            norm = self._normalize_code(content)
        except Exception:
            return 0
        weight = 0
        for pattern, w in rules:
            if re.search(pattern, norm, re.IGNORECASE):
                weight += w
        return min(weight, 100)

    def _analyze_pe(self, file_path: Path) -> int:
        try:
            data = file_path.read_bytes()
            if len(data) < 64:
                return 0
            ascii_str = data.decode("latin-1", errors="ignore")
            suspicious = ["CreateRemoteThread", "WriteProcessMemory", "VirtualAllocEx"]
            weight = sum(15 for s in suspicious if s in ascii_str)
            return min(weight, 100)
        except Exception:
            return 0

    def _analyze_jar(self, file_path: Path) -> int:
        try:
            import zipfile
            with zipfile.ZipFile(file_path, 'r') as zf:
                class_count = sum(1 for name in zf.namelist() if name.endswith('.class'))
            return min(class_count * 5, 100)
        except Exception:
            return 0

    def _analyze_java(self, file_path: Path) -> int:
        content = file_path.read_text(encoding="utf-8", errors="ignore").lower()
        weight = 0
        if "runtime.exec" in content:
            weight += 20
        if "processbuilder" in content:
            weight += 15
        return min(weight, 100)

    # ---------- песочница ----------
    def _static_sandbox_analysis(self, file_path: Path) -> int:
        score = 0
        try:
            data = file_path.read_bytes()
            text = data.decode("latin-1", errors="ignore").lower()
            if re.search(r"https?://", text): score += 20
            if re.search(r"powershell", text): score += 25
            if re.search(r"cmd\.exe\s+/c", text): score += 20
            if re.search(r"createprocess|winexec|shell_execute", text): score += 15
            if re.search(r"regsvr32", text): score += 25
            if re.search(r"cryptacquirecontext", text): score += 20
        except Exception:
            pass
        return min(score, 100)

    def _dynamic_sandbox_run_windows(self, file_path: Path) -> int:
        if platform.system() != "Windows":
            return 0
        self._log(f"[sandbox] Динамический запуск {file_path.name}")
        try:
            rule_name = "GradusCore_Sandbox"
            subprocess.run(
                f'netsh advfirewall firewall add rule name="{rule_name}" dir=out program="{file_path}" action=block',
                shell=True, capture_output=True
            )
            proc = subprocess.Popen(
                [str(file_path)],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, shell=True
            )
            try:
                out, _ = proc.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                out = proc.stdout.read() if proc.stdout else ""
            finally:
                subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}"', shell=True, capture_output=True)

            score = 0
            lower_out = out.lower()
            if re.search(r"https?://", lower_out): score += 30
            if re.search(r"download|wget|curl", lower_out): score += 25
            if re.search(r"c:\\windows\\system32", lower_out): score += 35
            if re.search(r"c:\\program files", lower_out): score += 20
            if re.search(r"registry|hklm|hkcu", lower_out): score += 25
            if re.search(r"createfile|writefile", lower_out): score += 20
            if re.search(r"regsvr32|sc stop|sc delete", lower_out): score += 25
            if re.search(r"socket|connect", lower_out): score += 25
            if re.search(r"powershell|cmd.exe /c", lower_out): score += 30
            if re.search(r"base64|frombase64string", lower_out): score += 20
            if re.search(r"invoke|iex|bypass", lower_out): score += 25
            if re.search(r"hidden|windowstyle", lower_out): score += 20
            return min(score, 100)
        except Exception as e:
            self._log(f"[sandbox] Ошибка динамического запуска: {e}")
            return 0

    def _linux_sandbox_strace(self, file_path: Path) -> int:
        if not shutil.which('strace'):
            return 0
        self._log("[sandbox] Экспериментальный strace-анализ")
        try:
            proc = subprocess.run(
                ['strace', '-f', '-e', 'trace=network,file', str(file_path)],
                timeout=5, capture_output=True, text=True
            )
            output = proc.stderr.lower()
            score = 0
            if re.search(r'connect\(|socket\(', output): score += 30
            if re.search(r'openat\(.*/etc/passwd', output): score += 40
            if re.search(r'openat\(.*\.ssh/', output): score += 50
            return min(score, 100)
        except Exception as e:
            self._log(f"[sandbox/strace] Ошибка: {e}")
            return 0

    # ---------- проверка руткитов (кроссплатформенная) ----------
    def _rootkit_scan_windows(self) -> bool:
        found = False
        try:
            out = subprocess.check_output("tasklist /v /fo csv", shell=True, text=True)
            for line in out.splitlines():
                if any(x in line.lower() for x in ("rootkit", "hidden", "suspicious")):
                    found = True
                    self._log(f"[rootkit] Подозрительный процесс: {line.strip()}")
            out = subprocess.check_output("sc query type= driver state= all", shell=True, text=True)
            for line in out.splitlines():
                if "hidden" in line.lower() or "rootkit" in line.lower():
                    found = True
                    self._log(f"[rootkit] Подозрительный драйвер: {line.strip()}")
        except Exception as e:
            self._log(f"[rootkit] Ошибка Windows: {e}")
        return found

    def _rootkit_scan_linux(self) -> bool:
        found = False
        try:
            proc_pids = set()
            for entry in Path('/proc').iterdir():
                if entry.is_dir() and entry.name.isdigit():
                    proc_pids.add(int(entry.name))
            ps_out = subprocess.check_output(['ps', '-e', '-o', 'pid='], text=True)
            ps_pids = {int(pid) for pid in ps_out.split() if pid.strip().isdigit()}
            hidden_pids = proc_pids - ps_pids
            hidden_pids.discard(1)
            if hidden_pids:
                found = True
                self._log(f"[rootkit] Скрытые процессы (PID): {hidden_pids}")
        except Exception as e:
            self._log(f"[rootkit] Ошибка сканирования процессов: {e}")

        try:
            lsmod_out = subprocess.check_output(['lsmod'], text=True)
            lsmod_modules = set()
            for line in lsmod_out.splitlines()[1:]:
                mod = line.split()[0]
                lsmod_modules.add(mod)
            with open('/proc/modules', 'r') as f:
                proc_modules = {line.split()[0] for line in f}
            hidden_modules = lsmod_modules - proc_modules
            if hidden_modules:
                found = True
                self._log(f"[rootkit] Скрытые модули ядра: {hidden_modules}")
        except Exception as e:
            self._log(f"[rootkit] Ошибка проверки модулей: {e}")

        try:
            with open('/proc/1/mounts', 'r') as f:
                mounts = f.read()
            if 'proc' in mounts and 'hidepid=' in mounts:
                self._log("[rootkit] Обнаружена опция hidepid в /proc – возможно сокрытие процессов")
                found = True
        except Exception:
            pass

        return found

    def _rootkit_scan_macos(self) -> bool:
        found = False
        try:
            out = subprocess.check_output(['kextstat'], text=True)
            for line in out.splitlines():
                if 'com.apple' not in line and 'com.google' not in line and 'com.microsoft' not in line:
                    if 'kernel' in line or 'driver' in line:
                        self._log(f"[rootkit] Подозрительный kext: {line.strip()}")
                        found = True
        except Exception as e:
            self._log(f"[rootkit] Ошибка kextstat: {e}")

        try:
            ps_out = subprocess.check_output(['ps', 'aux'], text=True)
            for line in ps_out.splitlines()[1:]:
                parts = line.split(None, 10)
                if len(parts) > 10:
                    command = parts[10]
                    if command.startswith('[') and command.endswith(']'):
                        continue
                    if command == '' or command == '???':
                        self._log(f"[rootkit] Безымянный процесс: {line.strip()}")
                        found = True
        except Exception as e:
            self._log(f"[rootkit] Ошибка ps: {e}")

        return found

    # ---------- проверка прав администратора ----------
    def _is_running_as_admin(self) -> bool:
        system = platform.system()
        try:
            if system == "Windows":
                return ctypes.windll.shell32.IsUserAnAdmin() != 0
            else:
                return os.geteuid() == 0
        except Exception:
            return False

    # ---------- проверка URL (фишинг) ----------
    def _get_openphish_domains(self) -> Set[str]:
        now = time.time()
        if now - GradusCore._openphish_last_update < 3600 and GradusCore._openphish_cache:
            return GradusCore._openphish_cache
        domains = set()
        try:
            req = urllib.request.Request(GradusCore.OPENPHISH_URL, headers={"User-Agent": "GradusCore/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                for line in resp.read().decode().splitlines():
                    line = line.strip().lower()
                    if line:
                        try:
                            host = urllib.parse.urlparse(line).hostname
                            if host:
                                domains.add(host.lstrip("www."))
                        except Exception:
                            pass
            GradusCore._openphish_cache = domains
            GradusCore._openphish_last_update = now
        except Exception as e:
            self._log(f"[OpenPhish] Ошибка загрузки: {e}")
        return domains

    # ---------- MalwareBazaar ----------
    def _check_malwarebazaar(self, sha256: str) -> bool:
        url = self.MALWAREBAZAAR_API
        data = urllib.parse.urlencode({"query": "get_info", "hash": sha256}).encode()
        req = urllib.request.Request(url, data=data, headers={"User-Agent": "GradusCore/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode().lower()
                return "malware" in content
        except Exception:
            return False

    # ---------- утилиты ----------
    def _sha256(self, file_path: Path) -> str:
        h = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()

    def _normalize_code(self, code: str) -> str:
        code = re.sub(r'//.*', '', code)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        code = re.sub(r'\s+', ' ', code)
        return code.lower()

    @staticmethod
    def _levenshtein(s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return GradusCore._levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)
        prev_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            curr_row = [i + 1]
            for j, c2 in enumerate(s2):
                insert = prev_row[j + 1] + 1
                delete = curr_row[j] + 1
                subs = prev_row[j] + (c1 != c2)
                curr_row.append(min(insert, delete, subs))
            prev_row = curr_row
        return prev_row[-1]

    def _log(self, msg: str):
        if self.settings.notifications:
            print(msg)

# ==================== CLI ====================
def print_docs():
    print(__doc__)

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("docs", "--help", "-h"):
        print_docs()
        return

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    settings = Settings(notifications=True)
    core = GradusCore(settings)

    if cmd == "scan":
        if not args:
            print("Укажите путь: scan <файл/папка>")
            return
        threat = core.scan(Path(args[0]))
        print(f"\nМаксимальный уровень угрозы: {threat}%")

    elif cmd == "url-scan":
        if not args:
            print("Укажите URL: url-scan <url>")
            return
        result = core.scan_url(args[0])
        print(f"Результат проверки URL: {result}")

    elif cmd == "sandbox-scan":
        if not args:
            print("Укажите файл: sandbox-scan <файл>")
            return
        threat = core.sandbox_scan(Path(args[0]))
        print(f"Угроза (песочница): {threat}%")

    elif cmd == "rootkit":
        found = core.rootkit_scan()
        print("Обнаружены руткиты!" if found else "Руткиты не обнаружены.")

    elif cmd == "stealth":
        detected = core.stealth_launch_detected()
        print("Обнаружен скрытый запуск!" if detected else "Скрытый запуск не обнаружен.")

    elif cmd == "custom-scan":
        custom_set = Settings()
        i = 0
        while i < len(args) and args[i].startswith("--"):
            if args[i] == "--signatures":
                custom_set.use_signatures = True
            elif args[i] == "--sandbox":
                custom_set.use_sandbox = True
            elif args[i] == "--rootkit":
                custom_set.check_rootkits = True
            elif args[i] == "--stealth":
                custom_set.check_stealth = True
            i += 1
        if i >= len(args):
            print("Укажите путь после опций")
            return
        target = Path(args[i])
        custom_set.notifications = True
        core_custom = GradusCore(custom_set)
        res = core_custom.custom_scan(target, custom_set)
        if res == -1:
            print("ОБНАРУЖЕНЫ СИСТЕМНЫЕ АНОМАЛИИ (руткит/скрытый запуск)!")
        else:
            print(f"Максимальный уровень угрозы (custom): {res}%")
    else:
        print("Неизвестная команда. Используйте docs для справки.")

if __name__ == "__main__":
    main()