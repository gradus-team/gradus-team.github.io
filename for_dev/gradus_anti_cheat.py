import random
from typing import Any, Dict, Union

class AntiCheat:
    def __init__(self, variables: Dict[str, Any] = None):
        print("[GRADUS-AC] Анти-чит создан, документация на официальном сайте")
        self.monitoring = False
        self.variables: Dict[str, dict] = variables if variables else {}
        self._randint = random.randint(10000, 99999)
        self._randfloat = random.randint(100000, 999999) / 10.0
        _words = ["cocoon", "melon", "apple", "orange", "banana", "pineapple", "grape", "juice"]
        self._randstr = random.choice(_words)

    def _sys_int(self, name: str, value: int) -> bool:
        self.variables[name] = {"value": value + self._randint, "type": "int"}
        return True

    def _sys_str(self, name: str, value: str) -> bool:
        self.variables[name] = {"value": value + self._randstr, "type": "str"}
        return True

    def _sys_bool(self, name: str, value: bool) -> bool:
        self.variables[name] = {"value": not value, "type": "bool"}
        return True

    def _sys_float(self, name: str, value: float) -> bool:
        self.variables[name] = {"value": value + self._randfloat, "type": "float"}
        return True

    def _sys_dict(self, name: str, value: dict) -> bool:
        self.variables[name] = {"value": value, "type": "dict"}
        return True

    def _sys_list(self, name: str, value: list) -> bool:
        self.variables[name] = {"value": value, "type": "list"}
        return True

    def _sys_other(self, name: str, value) -> bool:
        print(f"[GRADUS-AC] Неподдерживаемый тип у '{name}', поддерживаются: int, str, bool, float, dict, list")
        return False

    def start_monitoring(self) -> bool:
        self.monitoring = True
        print("[GRADUS-AC] Античит включён!")
        return True

    def stop_monitoring(self) -> bool:
        self.monitoring = False
        print("[GRADUS-AC] Античит выключен!")
        return True

    def add_variable(self, name: str = "VARIABLE", value=None) -> str:
        if name == "VARIABLE":
            name = f"VARIABLE{random.randint(10000, 99999)}"

        t = type(value)
        if t == int:
            self._sys_int(name, value)
        elif t == str:
            self._sys_str(name, value)
        elif t == bool:
            self._sys_bool(name, value)
        elif t == float:
            self._sys_float(name, value)
        elif t == dict:
            self._sys_dict(name, value)
        elif t == list:
            self._sys_list(name, value)
        else:
            self._sys_other(name, value)
            raise ValueError(f"Неподдерживаемый тип переменной '{name}'")
        return name

    def get_variable(self, name: str) -> Any:
        if name not in self.variables:
            return None
        var = self.variables[name]
        t = var["type"]
        v = var["value"]
        if t == "int":
            return v - self._randint
        elif t == "str":
            return v.replace(self._randstr, "")
        elif t == "bool":
            return not v
        elif t == "float":
            return v - self._randfloat
        elif t in ("dict", "list"):
            return v
        else:
            return None

    def is_hacked(self, name: str, value) -> bool:
        if not self.monitoring:
            return False
        stored = self.get_variable(name)
        if stored is None:
            return True
        return stored != value