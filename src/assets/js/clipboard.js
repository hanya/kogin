
import { Broadcaster } from "./broadcaster.js";

//'kogin:{ JSON data }'

const CT_PREFIX = 'kogin:';

/**
 * Manages copied contents.
 */
export class Clipboard extends Broadcaster {
    constructor() {
        super();
        this.items = null;
    }

    broadcast() {
        this._broadcast({ valid: this.isValid() });
    }

    /// Clear clipboard.
    clear() {
        this.items = null;
        this.pasteMode = 'default';

        this.broadcast();
    }

    /// Checks clipboard content is valid.
    isValid() {
        return this.items !== null;
    }

    /// Pushes items to clipboard.
    push(items) {
        this.clear();
        this.items = this._cloneItems(items);

        this.broadcast();
    }

    /// Clones items.
    _cloneItems(items) {
        const cloneOptions = {
            insert: false,
            deep: true,
        };
        const elements = [];

        for (const item of items) {
            const element = item.clone(cloneOptions);
            elements.push(element);
        }
        return elements;
    }

    /// Gets items from clipboard.
    get() {
        if (this.isValid()) {
            return this._cloneItems(this.items);
        } else {
            return null;
        }
    }
}
