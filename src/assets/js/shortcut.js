
import { Commands } from "./commands.js";
import { addKeycodes } from "./keyselector.js";
import { ElementTool } from "./elements.js";


const SHORTCUT_ITEM = 'shortcutkeys';

/**
 * Shortcut key setting stored in local storage.
 */
export class ShortcutManager {

    /**
     * Removes shortcut keys.
     */
    static clear() {
        const storage = localStorage;
        storage.removeItem(SHORTCUT_ITEM);
    }

    /**
     * Load shortcut keys and returns them.
     * @returns {Map}
     */
    static load() {
        const storage = localStorage;
        const text = storage.getItem(SHORTCUT_ITEM);
        const keys = new Map();
        JSON.parse(text, (key, value) => {
            if (key != '') {
                keys.set(key, value);
            }
            return undefined;
        });
        return keys;
    }

    /**
     * Stores shortcut keys.
     * @param {Map} keys Map contains shortcut keys.
     */
    static store(keys) {
        const storage = localStorage;
        const obj = {};
        for (const [key, value] of keys.entries()) {
            obj[key] = value;
        }
        const s = JSON.stringify(obj);
        storage.setItem(SHORTCUT_ITEM, s);
    }

}

export class ShortcutWindow extends ElementTool {
    constructor(view) {
        super();
        this.view = view;
        this.modified = true;
        this.defaultKeys = this.view.defaultShortcutKeys();
        this.contents = document.getElementById('shortcut-keys-container');
        const toLabel = new Map();
        const tt = view.toolManager.translate;
        for (const [key, value] of Commands) {
            toLabel.set(key, tt(value));
        }
        this.commands = toLabel;

        const functions = document.getElementById('shortcut-functions');
        while (functions.lastElementChild) {
            functions.lastElementChild.remove();
        }
        function fillCommands(parent) {
            for (const [key, value] of Commands) {
                const option = document.createElement('option');
                option.textContent = tt(value);
                option.setAttribute('function', key);
                parent.appendChild(option);
            }
        }
        fillCommands(functions);
        this.functions = functions;

        this.functionSelector = document.createElement('select');
        fillCommands(this.functionSelector);
        this.functionSelector.setAttribute('style', 'height: 24px;');
        this.functionSelector.addEventListener('change', this.cbFunctionSelectorChange);
    }

    enableKeySelector(state) {
        if (state) {
            this.setVisible('key-selector', true);
            this.setVisible('name-input-title', true);
        } else {
            this.setVisible('key-selector', false);
            this.setVisible('name-input-title', false);
        }
    }

    prepare(keys) {
        this.addKeys = new Map();
        this.removeKeys = new Map();
        this.activeItem = null;
        this.contents.textContent = '';
        const entries = [];
        keys.forEach((value, key, map) => entries.push([key, value]));
        entries.sort((a, b) => a[0] > b[0]);

        for (const [key, value] of entries) {
            this.appendEntry(key, value);
        }

        this.selector = addKeycodes('key-selector');
    }

    appendEntry(key, value) {
        const entry = this.makeEntry(key, value);
        this.contents.appendChild(entry);
    }

    insertEntry(key, value, beforeItem) {
        let selectItem = null;
        if (beforeItem && beforeItem.getAttribute('key') == key) {
            for (const span of beforeItem.getElementsByTagName('span')) {
                if (span.getAttribute('function')) {
                    span.setAttribute('funciton', value);
                    span.textContent = this.commandToLabel(value);
                    break;
                }
            }
            selectItem = beforeItem;
        } else {
            const entry = this.makeEntry(key, value);
            if (beforeItem) {
                this.contents.insertBefore(entry, beforeItem.nextSibling);
            } else {
                this.contents.appendChild(entry);
            }
            selectItem = entry;
        }
        this.addKeys.set(key, value);
        return selectItem;
    }

    makeEntry(key, value) {
        const div = document.createElement('div');

        const keySpan = document.createElement('span');
        div.setAttribute('key', key);
        keySpan.textContent = this.keyToText(key);
        keySpan.classList.add('shortcut-entry-key');

        const valueSpan = document.createElement('span');
        div.setAttribute('function', value);
        valueSpan.textContent = this.commandToLabel(value);
        valueSpan.classList.add('shortcut-entry-function');

        div.appendChild(keySpan);
        div.appendChild(valueSpan);
        div.addEventListener('click', (ev) => {
            let target = ev.target;
            if (target.tagName != 'DIV') {
                target = target.parentNode;
            }
            this.setActiveItem(target);
        });
        return div;
    }

    setActiveItem(target, showItem=false) {
        const SELECTED = 'shortcut-key-entry-selected';
        if (this.activeItem == target || target.tagName == 'SELECT') {
            return;
        }
        this.functionSelector.remove();
        if (this.activeItem) {
            this.setiDisplayElement(this.activeItem.lastElementChild, true);
            this.activeItem.classList.remove(SELECTED);
        }

        this.activeItem = target;
        this.activeItem.classList.add(SELECTED);
        this.setiDisplayElement(this.activeItem.lastElementChild, false);
        this.activeItem.appendChild(this.functionSelector);
        this.setFunctionSelector(target.getAttribute('function'));
        if (showItem) {
            this.activeItem.scrollIntoView({ block: 'center' });
        }
    }

    setFunctionSelector(func) {
        let n = 0;
        for (const option of this.functionSelector.childNodes) {
            if (option.getAttribute('function') == func) {
                this.functionSelector.selectedIndex = n;
                break;
            }
            n += 1;
        }
    }

    cbFunctionSelectorChange = (ev) => {
        const index = ev.target.selectedIndex;
        if (index >= 0) {
            const option = this.functionSelector.childNodes[index];
            if (option) {
                const func = option.getAttribute('function');
                this.activeItem.setAttribute('function', func);
                this.setLabel(this.activeItem, this.commands.get(func));
                // todo, changed
                const key = this.activeItem.getAttribute('key');
                this.addKeys.set(key, func);
            }
        }
    }

    setLabel(entry, label) {
        for (const child of entry.childNodes) {
            if (child.tagName == 'SPAN' &&
                child.classList.contains('shortcut-entry-function')) {
                child.textContent = label;
                break;
            }
        }
    }

    /**
     *
     * @param {string} key
     */
    keyToText(key) {
        let s = key.toUpperCase();
        s = s.replace('CTRL-', 'CTRL+')
             .replace('ALT-', 'ALT+')
             .replace('SHIFT-', 'SHIFT+')
             .replace(' ', 'SPACE');
        return s;
    }

    commandToLabel(key) {
        const label = this.commands.get(key);
        return label ? label : key;
    }

    showAddItemWindow() {
        this.selector.clearSelected();
    }

    addItem(cbAskforReplace, forceReplace=false) {
        const key = this.selector.getKey();
        const functionIndex = this.functions.selectedIndex;
        if (functionIndex >= 0) {
            const command = Commands[functionIndex];
            if (command) {
                const func = command[0];
                const beforeElement = this.findBeforeElement(key);
                if (beforeElement) {
                    if (beforeElement.getAttribute('key') == key) {
                        if (forceReplace) {
                            this.setActiveItem(beforeElement);
                            this.setFunctionToActiveItem(func);
                            this.setActiveItem(beforeElement, true);
                        } else {
                            if (cbAskforReplace) {
                                cbAskforReplace();
                            }
                        }
                    } else {
                        const entry = this.insertEntry(key, func, beforeElement);
                        this.setActiveItem(entry, true);
                        this.modified = true;
                        return true;
                    }
                } else {
                    const entry = this.insertEntry(key, func, null);
                    this.setActiveItem(entry, true);
                    this.modified = true;
                    return true;
                }
            }
        }
    }

    findBeforeElement(key) {
        for (const child of this.contents.childNodes) {
            const itemKey = child.getAttribute('key');
            if (itemKey > key) {
                return child.previousSibling;
            }
        }
        return null;
    }

    setFunctionToActiveItem(func) {
        this.setFunctionSelector(func);
        this.setLabel(this.activeItem, this.commands.get(func));
        this.modified = true;
    }

    removeItem() {
        this.functionSelector.remove();
        const key = this.activeItem.getAttribute('key');
        const item = this.activeItem.nextSibling;
        this.activeItem.remove();
        this.removeKeys.set(key, true);
        this.activeItem = null;
        this.setActiveItem(item);
        this.modified = true;
    }

    defaultItem(cbAskForDefault, force=false) {
        if (this.activeItem) {
            if (!force && cbAskForDefault) {
                cbAskForDefault();
                return;
            }
            const key = this.activeItem.getAttribute('key');
            const func = this.defaultKeys.get(key);
            if (func) {
                this.setFunctionToActiveItem(func);
                this.modified = true;
            }
        }
    }

    defaultAll() {
        this.prepare(this.defaultKeys);
        this.modified = false;
    }

    updateKeys(keys) {
        for (const [key, value] of this.removeKeys.entries()) {
            keys.delete(key);
        }
        for (const [key, value] of this.addKeys.entries()) {
            keys.set(key, value);
        }
        this.addKeys = null;
        this.removeKeys = null;
    }

    save() {
        if (this.modified) {
            this.updateKeys(this.view.shortcutKeys);
            ShortcutManager.store(this.view.shortcutKeys);
        } else {
            ShortcutManager.clear();
        }
    }
}
