import re
import hashlib
import zipfile
import io
import os
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Union

# ======================== СИГНАТУРЫ ========================
SIGNATURES = {
    "bat-checker": [
        ("format\\s+c:", 15), ("del\\s+/f\\s+/s", 12), ("rd\\s+/s\\s+/q", 10),
        ("powershell\\s+-command", 15), ("cscript", 10), ("erase", 8), ("rmdir", 8),
        ("attrib\\s+-r\\s+-s\\s+-h", 10), ("reg\\s+add", 12), ("reg\\s+delete", 14),
        ("schtasks", 15), ("curl", 8), ("wget", 8), ("bitsadmin", 12),
        ("powershell\\s+-enc", 20), ("invoke-expression", 18), ("iex", 15),
        ("downloadstring", 15), ("bitcoin", 10), ("monero", 10), ("miner", 15),
        ("xmrig", 15), ("worm", 20), ("self-replicate", 18), ("startup", 8),
        ("taskkill", 6), ("net\\s+user", 10), ("net\\s+localgroup", 10),
        ("vssadmin\\s+delete\\s+shadows", 20)
    ],
    "js-checker": [
        ("document\\.location", 10), ("eval\\s*\\(", 12), ("steal", 15),
        ("send\\s+credentials", 20), ("XMLHttpRequest", 6), ("fetch", 5),
        ("WebSocket", 6), ("exec", 14), ("require\\s*\\(", 10), ("process\\.env", 8)
    ],
    "exe-checker": [
        ("CreateRemoteThread", 15), ("WriteProcessMemory", 18), ("VirtualAllocEx", 12),
        ("SetWindowsHookEx", 14), ("ShellExecute", 12), ("RegSetValueEx", 12),
        ("URLDownloadToFile", 15), ("socket", 8), ("connect", 8), ("send", 8),
        ("recv", 6), ("bind", 8), ("listen", 8), ("accept", 8),
        ("WSAStartup", 5), ("GetProcAddress", 6)
    ],
    "url-checker": [
        ("paypal-verify\\.com", 20), ("secure-login\\.net", 18),
        ("appleid-fake\\.com", 20), ("bit\\.ly", 5), ("verify-account", 15), ("webscr", 15)
    ],
    "py-checker": [
        ("os\\.system", 12), ("subprocess\\.Popen", 10), ("requests\\.post", 8),
        ("base64\\.b64decode", 14), ("eval\\s*\\(", 8), ("exec\\s*\\(", 10)
    ],
    "other-checker": [
        ("delete", 5), ("remove", 4), ("exec", 6), ("write", 3)
    ],
    "obfuscation-checker": [
        ("base64_decode", 15), ("str_rot13", 10), ("gzinflate", 20)
    ],
    "rootkit-checker": [
        ("NtQuerySystemInformation", 18), ("ZwQuerySystemInformation", 18),
        ("\\[hidden\\]", 25), ("stealth", 30), ("filterdriver", 20)
    ]
}

# ======================== НАСТРОЙКИ ========================
class Settings:
    def __init__(self):
        self.notifications = False
        self.use_signatures = True
        self.use_malwarebazaar = False

# ======================== ЯДРО ========================
class GradusCore:
    def __init__(self, settings: Settings = None):
        self.settings = settings if settings else Settings()

    def scan(self, target: Union[str, Path]) -> int:
        """Сканирует файл или папку (по пути) и возвращает максимальный процент угрозы (0-100)."""
        path = Path(target)
        if not path.exists():
            if self.settings.notifications:
                print(f"[GradusCore] Файл/папка не найден: {target}")
            return 0
        if path.is_dir():
            return self._scan_dir(path)
        else:
            return self._scan_file(path)

    def scan_bytes(self, data: bytes, filename: str) -> int:
        """Сканирует файл, представленный байтами (например, загруженный в бота).
        data - содержимое файла, filename - его оригинальное имя для определения расширения."""
        return self._scan_data(data, filename)

    def get_text_from_file(self, path: Union[str, Path]) -> str:
        """Возвращает текстовое содержимое файла (для последующей передачи в scan_text)."""
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    def scan_text(self, text: str, filename: str) -> int:
        """Сканирует переданный текст как содержимое файла (без сохранения на диск)."""
        ext = Path(filename).suffix.lower()
        return self._scan_by_text(text, ext)

    # ================ ВНУТРЕННИЕ МЕТОДЫ ================
    def _scan_dir(self, folder: Path) -> int:
        max_threat = 0
        for item in folder.rglob("*"):
            if item.is_file():
                threat = self._scan_file(item)
                if threat > max_threat:
                    max_threat = threat
        return max_threat

    def _scan_file(self, filepath: Path) -> int:
        threat = 0
        try:
            data = filepath.read_bytes()
            threat = self._scan_data(data, filepath.name)
        except Exception:
            pass
        return threat

    def _scan_data(self, data: bytes, filename: str) -> int:
        threat = 0
        ext = Path(filename).suffix.lower()

        if self.settings.use_signatures:
            threat = max(threat, self._signature_scan_bytes(data, ext))

        if self.settings.use_malwarebazaar and threat < 100:
            sha256 = hashlib.sha256(data).hexdigest()
            if self._check_malwarebazaar(sha256):
                threat = 100
                if self.settings.notifications:
                    print(f"[MalwareBazaar] {filename} найден в базе MalwareBazaar")

        if self.settings.notifications and threat > 0:
            print(f"{filename} – угроза {threat}%")

        return min(threat, 100)

    def _signature_scan_bytes(self, data: bytes, ext: str) -> int:
        # Специальная обработка PE (exe/dll)
        if ext in (".exe", ".dll"):
            return self._analyze_pe(data)
        # JAR – zip-архив с классами
        if ext == ".jar":
            return self._analyze_jar(data)

        # Для текстовых расширений пытаемся декодировать
        try:
            text = data.decode("utf-8", errors="ignore")
        except Exception:
            text = data.decode("latin-1", errors="ignore")
        return self._scan_by_text(text, ext)

    def _scan_by_text(self, text: str, ext: str) -> int:
        # Определяем набор сигнатур
        signatures = SIGNATURES.get(ext, None)
        if signatures is None:
            signatures = SIGNATURES.get("other-checker", [])
        if not signatures:
            return 0

        text_lower = self._normalize_code(text)
        weight = 0
        for pattern, w in signatures:
            if re.search(pattern, text_lower, re.IGNORECASE):
                weight += w
        return min(weight, 100)

    def _normalize_code(self, code: str) -> str:
        # Убираем комментарии и лишние пробелы
        code = re.sub(r"//.*", "", code)
        code = re.sub(r"/\*.*?\*/", "", code, flags=re.DOTALL)
        code = re.sub(r"\s+", " ", code)
        return code.lower()

    def _analyze_pe(self, data: bytes) -> int:
        if len(data) < 64:
            return 0
        # Ищем подозрительные строки в бинарном файле
        suspicious = ["CreateRemoteThread", "WriteProcessMemory", "VirtualAllocEx"]
        weight = 0
        for s in suspicious:
            if s.encode("ascii") in data:
                weight += 15
        return min(weight, 100)

    def _analyze_jar(self, data: bytes) -> int:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                class_count = sum(1 for name in zf.namelist() if name.endswith(".class"))
                return min(class_count * 5, 100)
        except Exception:
            return 0

    def _check_malwarebazaar(self, sha256: str) -> bool:
        try:
            url = "https://mb-api.abuse.ch/api/v1/"
            post_data = urllib.parse.urlencode({"query": "get_info", "hash": sha256}).encode("ascii")
            req = urllib.request.Request(url, data=post_data)
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode("utf-8").lower()
                return "malware" in content
        except Exception:
            return False


# ======================== КОНСОЛЬНЫЙ ЗАПУСК ========================
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2 or sys.argv[1].lower() == "docs":
        print("=== GradusCore Python – Антивирусное ядро ===\n")
        print("Использование из командной строки:")
        print("  python graduscore_py.py <путь к файлу или папке>")
        print("  python graduscore_py.py docs\n")
        print("Использование как библиотека:")
        print("  from graduscore_py import GradusCore, Settings")
        print("  settings = Settings()")
        print("  settings.use_signatures = True")
        print("  core = GradusCore(settings)")
        print("  threat = core.scan('путь/к/файлу')")
        print("  # или для данных из бота:")
        print("  threat = core.scan_bytes(file_bytes, 'имя_файла.exe')")
        print("  threat = core.scan_text(file_text, 'script.bat')")
        print("\nНастройки (Settings):")
        print("  notifications : bool (по умолчанию False)")
        print("  use_signatures : bool (по умолчанию True)")
        print("  use_malwarebazaar : bool (по умолчанию False)")
        sys.exit(0)

    target_path = sys.argv[1]
    settings = Settings()
    settings.use_signatures = True
    settings.notifications = True
    core = GradusCore(settings)
    result = core.scan(target_path)
    print(f"\nМаксимальный уровень угрозы: {result}%")