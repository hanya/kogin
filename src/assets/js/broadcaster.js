

/**
 * Broadcasts events.
 */
export class Broadcaster {
    constructor() {
        this.listeners = [];
    }

    addListener = (listener) => {
        this.listeners.push(listener);
    }

    /// Broadcasts to all listeners with event object.
    _broadcast = (ev) => {
        for (const listener of this.listeners) {
            listener(ev);
        }
    }
}
