'use strict';

import { Sashi } from './sashi.js';
import { View } from './view.js';
import {
    authDropbox, initDropboxAuth,
    isDropboxVerified
} from './backend_dropbox.js';
import { initPath  } from './tools.js';
import { SettingsManager } from './settings.js';


/// Parses query.
export function parseQS() {
    const op = {};
    const search = window.location.search;
    if (search.length <= 0) {
        return op;
    }
    const qs = search.slice(1);
    for (const q of qs.split('&')) {
        const kv = q.split('=');
        const key = kv[0];
        const value = kv[1];
        switch (key) {
            case 'folder': {
                // folder id
                op['locationId'] = parseInt(decodeURIComponent(value));
                break;
            }
            case 'key': {
                let key = parseInt(decodeURIComponent(value));
                if (Number.isNaN(key)) {
                    key = decodeURIComponent(value);
                }
                op['key'] = key;
                break;
            }
            case 'view_mode': {
                const viewMode = parseInt(decodeURIComponent(value));
                if (viewMode !== NaN) {
                    op['viewMode'] = viewMode;
                }
                break;
            }
            default: {
                op[key] = decodeURIComponent(value);
                break;
            }
        }
    }
    return op;
}

window.addEventListener('load', function () {
    // disable auto insertion of new item to the active layer
    paper.settings.insertItems = false;

    if (window.parent && window.parent.__TAURI__) {
        window.__TAURI__ = window.parent.__TAURI__;
    }
    if (window.parent && window.parent.docs) {
        window.docs = window.parent.docs;
    }
    if (window.__TAURI__) {
        initPath();
    }

    const op = parseQS();
    const isDropboxAppNeedsAuth = !window.__TAURI__ && !!op.file_id;
    const dropboxVerified = !window.__TAURI__ && isDropboxVerified();

    if (isDropboxAppNeedsAuth && !dropboxVerified) {
        authDropbox(op);
    } else {
        const startApp = (op) => {
            const settingsManager = new SettingsManager();
            settingsManager.loadData().then(() => {
                const app = new Sashi('canvas', true, null, settingsManager);
                window.app = app;
                if (window.docs) {
                    app.index = window.docs.currentIndex();
                }
                app.setView(new View(app, app.viewOption));

                if (op.locationId && op.key) {
                    app.openTemplate(op.locationId, op.key);
                } else if (op.storage_type && op.id) {
                    app.openFromStorage(op.type, op.id);
                } else if (op.file_id) {
                    app.openFromStorage('dropbox', op.file_id);
                }
                if (op.view_mode) {
                    app.view.setViewMode(op.view_mode);
                }
                app.view.fileNameChanged(app.getFileName());
            });
        };

        if (dropboxVerified) {
            initDropboxAuth(op, startApp);
        } else {
            startApp(op);
        }
    }
});


window.addEventListener('beforeunload', (ev) => {
    if (window.app &&
        window.app.viewOption.askWhenClosing &&
        window.app.isModified()) {
        ev.preventDefault();
        ev.returnValue = '';
    }
});
