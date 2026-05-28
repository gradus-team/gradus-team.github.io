import java.util.*;

public class GradusAntiCheat {
    private boolean monitoring = false;
    private final Map<String, StoredVar> variables = new HashMap<>();
    private final int randInt;
    private final double randFloat;
    private final String randStr;

    private static class StoredVar {
        enum Type { INT, STR, BOOL, FLOAT, DICT, LIST }
        Type type;
        Object value;
        StoredVar(Type type, Object value) {
            this.type = type;
            this.value = value;
        }
    }

    public GradusAntiCheat() {
        System.out.println("[GRADUS-AC] Анти-чит создан, документация на официальном сайте");
        Random rng = new Random();
        this.randInt = 10000 + rng.nextInt(90000);
        this.randFloat = (100000 + rng.nextInt(900000)) / 10.0;
        String[] words = {"cocoon", "melon", "apple", "orange", "banana", "pineapple", "grape", "juice"};
        this.randStr = words[rng.nextInt(words.length)];
    }

    private boolean sysInt(String name, int value) {
        variables.put(name, new StoredVar(StoredVar.Type.INT, value + randInt));
        return true;
    }
    private boolean sysStr(String name, String value) {
        variables.put(name, new StoredVar(StoredVar.Type.STR, value + randStr));
        return true;
    }
    private boolean sysBool(String name, boolean value) {
        variables.put(name, new StoredVar(StoredVar.Type.BOOL, !value));
        return true;
    }
    private boolean sysFloat(String name, double value) {
        variables.put(name, new StoredVar(StoredVar.Type.FLOAT, value + randFloat));
        return true;
    }
    private boolean sysDict(String name, Map<String, Object> value) {
        variables.put(name, new StoredVar(StoredVar.Type.DICT, value));
        return true;
    }
    private boolean sysList(String name, List<Object> value) {
        variables.put(name, new StoredVar(StoredVar.Type.LIST, value));
        return true;
    }
    private boolean sysOther(String name) {
        System.out.println("[GRADUS-AC] Неподдерживаемый тип у \"" + name + "\", поддерживаются: int, str, bool, float, dict, list");
        return false;
    }

    public boolean startMonitoring() {
        monitoring = true;
        System.out.println("[GRADUS-AC] Античит включён!");
        return true;
    }

    public boolean stopMonitoring() {
        monitoring = false;
        System.out.println("[GRADUS-AC] Античит выключен!");
        return true;
    }

    public String addVariable(String name, Object value) {
        if (name == null || name.equals("VARIABLE")) {
            name = "VARIABLE" + (10000 + new Random().nextInt(90000));
        }

        if (value instanceof Integer) {
            sysInt(name, (Integer) value);
        } else if (value instanceof String) {
            sysStr(name, (String) value);
        } else if (value instanceof Boolean) {
            sysBool(name, (Boolean) value);
        } else if (value instanceof Double || value instanceof Float) {
            double v = (value instanceof Double) ? (Double) value : ((Float) value).doubleValue();
            sysFloat(name, v);
        } else if (value instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) value;
            sysDict(name, map);
        } else if (value instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> list = (List<Object>) value;
            sysList(name, list);
        } else {
            sysOther(name);
            throw new IllegalArgumentException("Неподдерживаемый тип переменной '" + name + "'");
        }
        return name;
    }

    public Object getVariable(String name) {
        StoredVar var = variables.get(name);
        if (var == null) return null;

        switch (var.type) {
            case INT:
                return ((Integer) var.value) - randInt;
            case STR:
                return ((String) var.value).replace(randStr, "");
            case BOOL:
                return !((Boolean) var.value);
            case FLOAT:
                return ((Double) var.value) - randFloat;
            case DICT:
            case LIST:
                return var.value;
            default:
                return null;
        }
    }

    public boolean isHacked(String name, Object value) {
        if (!monitoring) return false;
        Object stored = getVariable(name);
        if (stored == null) return true;
        return !stored.equals(value);
    }
}