
import { DropboxBackend } from "./backend_dropbox.js";
import { GoogleDriveBackend } from "./backend_googledrive.js";


export class Storage {
    constructor(type) {
        this.backend = this.createBackend(type);
    }

    createBackend(type) {
        switch (type) {
            case 'googledrive': {
                const backend = new GoogleDriveBackend({});
                backend.init();
                return backend;
                break;
            }
            case 'dropbox': {
                const backend = new DropboxBackend();
                backend.init();
                return backend;
                break;
            }
        }
    }

    readFile(key, cbDataLoaded, cbError) {
        this.backend.readFile(key, cbDataLoaded, cbError);
    }

    writeFile(key, data, name, parentId, cbWritten, cbError, mimeType=SVG_MIME_TYPE) {
        if (key) {
            this.updateFile(key, data, cbWritten, cbError, mimeType);
        } else {
            this.createFile(name, parentId, data, cbWritten, cbError, mimeType);
        }
    }

    createFile(name, parentId, data, cbWritten, cbError, mimeType) {
        this.backend.createFile(name, parentId, data, cbWritten, cbError, mimeType);
    }

    updateFile(key, data, cbWritten, cbError, mimeType) {
        this.backend.updateFile(key, data, cbWritten, cbError, mimeType);
    }

    readInfo(key, cbReaded) {
        this.backend.readInfo(key, cbReaded);
    }
}
