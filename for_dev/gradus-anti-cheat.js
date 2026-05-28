class GradusAntiCheat {
    constructor() {
        console.log("[GRADUS-AC] Анти-чит создан, документация на официальном сайте");
        this.monitoring = false;
        this.variables = {};

        this._randInt = Math.floor(10000 + Math.random() * 90000);
        this._randFloat = Math.round((100000 + Math.random() * 900000)) / 10;
        const words = ["cocoon", "melon", "apple", "orange", "banana", "pineapple", "grape", "juice"];
        this._randStr = words[Math.floor(Math.random() * words.length)];
    }

    _sysInt(name, value) {
        this.variables[name] = { type: "int", value: value + this._randInt };
        return true;
    }
    _sysStr(name, value) {
        this.variables[name] = { type: "str", value: value + this._randStr };
        return true;
    }
    _sysBool(name, value) {
        this.variables[name] = { type: "bool", value: !value };
        return true;
    }
    _sysFloat(name, value) {
        this.variables[name] = { type: "float", value: value + this._randFloat };
        return true;
    }
    _sysDict(name, value) {
        this.variables[name] = { type: "dict", value: value };
        return true;
    }
    _sysList(name, value) {
        this.variables[name] = { type: "list", value: value };
        return true;
    }
    _sysOther(name) {
        console.log(`[GRADUS-AC] Неподдерживаемый тип у "${name}", поддерживаются: int, str, bool, float, dict, list`);
        return false;
    }

    startMonitoring() {
        this.monitoring = true;
        console.log("[GRADUS-AC] Античит включён!");
        return true;
    }

    stopMonitoring() {
        this.monitoring = false;
        console.log("[GRADUS-AC] Античит выключен!");
        return true;
    }

    addVariable(name = "VARIABLE", value) {
        if (name === "VARIABLE") {
            name = "VARIABLE" + Math.floor(10000 + Math.random() * 90000);
        }

        const t = typeof value;
        if (t === "number") {
            if (Number.isInteger(value)) {
                this._sysInt(name, value);
            } else {
                this._sysFloat(name, value);
            }
        } else if (t === "string") {
            this._sysStr(name, value);
        } else if (t === "boolean") {
            this._sysBool(name, value);
        } else if (value instanceof Map || (value && typeof value === "object" && value.constructor === Object)) {
            this._sysDict(name, value);
        } else if (Array.isArray(value)) {
            this._sysList(name, value);
        } else {
            this._sysOther(name);
            throw new Error(`Неподдерживаемый тип переменной '${name}'`);
        }
        return name;
    }

    getVariable(name) {
        const v = this.variables[name];
        if (!v) return null;

        switch (v.type) {
            case "int":
                return v.value - this._randInt;
            case "str":
                return v.value.replace(this._randStr, "");
            case "bool":
                return !v.value;
            case "float":
                return v.value - this._randFloat;
            case "dict":
            case "list":
                return v.value;
            default:
                return null;
        }
    }

    isHacked(name, value) {
        if (!this.monitoring) return false;
        const stored = this.getVariable(name);
        if (stored === null) return true;
        return stored !== value;
    }
}

// Для Node.js:
module.exports = GradusAntiCheat;