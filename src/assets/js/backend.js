
/**
 * Web based backend.
 */
export class WebBackend {
    constructor(type) {
        this.type = type;
    }

    getType() {
        return this.type;
    }

    /**
     * Decode string from UTF-8 encoded which is caused by processing before base64 encoding.
     *
     * @param {string} text String to be decoded.
     * @returns {string} Decoded string.
     */
    decode(text) {
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            bytes[i] = text.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }

    join(folder, name) {
        if (!folder) {
            folder = '/';
        }
        if (folder.endsWith('/')) {
            return folder + name;
        } else {
            return folder + '/' + name;
        }
    }
}

export class DummyBackend extends WebBackend {
    constructor(op) {
        super('dummy');
        this.initialized = true;
        this.invalid = true;
    }

    init() {
    }
}
