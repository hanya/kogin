
const SETTINGS_NAME = 'settings.json';

class LocalSettings {
    constructor() {
        this.obj = {};
        this.fs = window.__TAURI__.fs;
    }

    async load() {
        const s = await this.fs.readTextFile(
            SETTINGS_NAME, { dir: this.fs.BaseDirectory.AppConfig }
        );
        try {
            if (s) {
                const items = JSON.parse(s);
                for (const [key, value] of Object.entries(items)) {
                    this.obj[key] = value;
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    async store() {
        try {
            const s = JSON.stringify(this.obj);
            await this.fs.writeTextFile(
                SETTINGS_NAME, s,
                { dir: this.fs.BaseDirectory.AppConfig }
            );
        } catch (error) {
            console.log(error);
        }
    }

    clear() {
        this.obj = {};
    }

    getItem(name) {
        return this.obj[name];
    }

    setItem(name, value) {
        this.obj[name] = value;
    }
}


// allow to use cookie like storage
let allowToStore = false;

export function isAllowedToStore () {
    return allowToStore;
}

/// Stores and loads settings.
export class SettingsManager {
    constructor() {
        this.storeDataId = null;
        if (window.__TAURI__) {
            this.notStoreSettings = false;
            this.askForPermission = false;
            this.storage = new LocalSettings();
            //this.storage.load();
        } else {
            this.notStoreSettings = true;
            this.askForPermission = true;
            this.storage = localStorage;
            const state = this.loadValue('permission.', 'agreed');
            if (typeof state == 'string') {
                this.notStoreSettings = state == 'false';
                this.askForPermission = false;
                allowToStore = !this.notStoreSettings;
            }
        }
    }

    async loadData() {
        if (window.__TAURI__) {
            await this.storage.load();
        }
    }

    storeData = () => {
        if (window.__TAURI__) {
            this.storage.store();
        }
    }

    /// Clears storage.
    clearSettings() {
        localStorage.clear();
    }

    /// Do not store settings if true is specified.
    setNotStoreSettings(state) {
        this.notStoreSettings = state;
        this.storeValue('permission.', 'agreed', !state);
    }

    loadValue(prefix, key) {
        return this.storage.getItem(prefix + key);
    }

    storeValue(prefix, key, value) {
        if (this.notStoreSettings) {
            return;
        }
        this.storage.setItem(prefix + key, value.toString());
    }

    /// Loads value from the storage.
    load(prefix, defaultValues) {
        const op = {};
        for (const [key, defaultValue] of Object.entries(defaultValues)) {
            const value = this.storage.getItem(prefix + key);
            if (value === null) {
                op[key] = defaultValue;
            } else {
                op[key] = SettingsManager._to(value, defaultValue);
            }
        }
        return op;
    }

    /// Stores value into the storage.
    store(prefix, values, defaultValues) {
        if (this.notStoreSettings) {
            return;
        }
        if (window.__TAURI__ && this.storeDataId) {
            clearTimeout(this.storeDataId);
        }

        for (const [key, defaultValue] of Object.entries(defaultValues)) {
            const value = values[key];
            if (value === null) {
                this.storage.setItem(prefix + key, defaultValue);
            } else {
                this.storage.setItem(prefix + key, this._from(value));
            }
        }

        if (window.__TAURI__) {
            this.storeDataId = setTimeout(this.storeData, 300);
        }
    }

    static loadFrom(obj, source, defaultValues) {
        for (const [key, defaultValue] of Object.entries(defaultValues)) {
            const value = source[key];
            if (value === undefined) {
                obj[key] = defaultValue;
            } else {
                obj[key] = value;
            }
        }
        return obj;
    }

    /// Checks this storage contains specified value.
    hasSetting(prefix, key) {
        return this.storage.getItem(prefix + key) != null;
    }

    _from(value) {
        const t = typeof value;
        if (t == 'object') {
            return JSON.stringify(value);
        } else {
            return value.toString();
        }
    }

    /// Converts value as string into the same type of default value.
    static _to(valueString, defaultValue) {
        const t = typeof defaultValue;
        if (valueString === undefined) {
            return defaultValue;
        }
        if (t === 'boolean') {
            return valueString == 'true';
        } else if (t === 'number') {
            if (valueString.indexOf('.') != -1) {
                try {
                    return parseFloat(valueString);
                } catch (e) {
                    return defaultValue;
                }
            } else {
                try {
                    return parseInt(valueString);
                } catch (e) {
                    return defaultValue;
                }
            }
        } else if (t === 'string') {
            return valueString;
        } else if (Array.isArray(defaultValue)) {
            try {
                return JSON.parse(valueString);
            } catch (e) {
            }
            return [];
        } else if (t === 'object') {
            try {
                return JSON.parse(valueString);
            } catch (e) {
            }
            return {};
        }
        return defaultValue;
    }
}
