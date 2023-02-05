import { nameSort } from "./tools.js";

const DB_TS_NAME = 'KoginTemplates';
const DB_TS_VERSION = 1;
const DB_TS_STORE = 'information';
/*
{
    name: 'Kogin', size: 'small', id: 1,
    type: 'cached', lastload: 0,

    backend_type: 'github',
    user: , repository: , subdirectory: ,

    backend_type: 'gitlab',
    projectid: , subdirectory: ,

    backend_type: 'googledrive',
    folderid: ,

    backend_type: 'dropbox',
    path: ,
},
{
    name: 'Local', size: 'small', id: 2,
    type: 'local',
},
*/
// attributes to be copied

export class TemplateLocationInfo {
    constructor() {
        this.db = null;
    }

    init(cbInitDone) {
        let exists = true;
        const request = window.indexedDB.open(DB_TS_NAME, DB_TS_VERSION);
        request.onerror = (error) => {
            console.log(error);
        };
        request.onsuccess = (ev) => {
            this.db = ev.target.result;
            if (cbInitDone) {
                cbInitDone(exists);
            }
        };
        request.onupgradeneeded = (ev) => {
            exists = false;
            const db = ev.target.result;
            let store = db.createObjectStore(
                DB_TS_STORE, { autoIncrement: true });
            store.createIndex('id', 'id', { unique: true });
        };
    }

    getStore(mode) {
        const transaction = this.db.transaction(DB_TS_STORE, mode);
        transaction.oncomplete = (ev) => {};
        transaction.onerror = (ev) => { console.log(ev) };
        return transaction.objectStore(DB_TS_STORE);
    }

    loadLocations(cbLocationsLoaded) {
        const locations = new Map();
        const store = this.getStore('readonly');
        const request = store.openCursor();
        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const key = cursor.primaryKey;
                const value = cursor.value;
                const obj = {
                    key: key,
                };
                Object.assign(obj, value);
                locations.set(value.id, obj);
                cursor.continue();
            }
        };
        request.transaction.oncomplete = (ev) => {
            cbLocationsLoaded(locations);
        };
    }

    addLocation(id, location, cbAddLocation) {
        const store = this.getStore('readwrite');
        const request = store.add(location);
        request.onsuccess = (ev) => {
            if (cbAddLocation) {
                const key = ev.target.result;
                cbAddLocation(key, id, location);
            }
        };
    }

    removeLocation(key, id, cbRemoveLocation) {
        const store = this.getStore('readwrite');
        const request = store.delete(key);
        request.onsuccess = (ev) => {
            if (cbRemoveLocation) {
                cbRemoveLocation(id);
            }
        };
    }

    // name, size, backend: { lastload }

    updateLocation(key, id, updateValues, cbUpdated, mode) {
        const store = this.getStore('readwrite');
        const request = store.get(key);
        request.onsuccess = (ev) => {
            const value = ev.target.result;
            const obj = Object.assign({}, value);
            Object.assign(obj, updateValues);

            const rq = store.put(obj, key);
            rq.onsuccess = (ev) => {
                if (cbUpdated) {
                    cbUpdated(id, mode);
                }
            };
        };
        request.onerror = (ev) => {
            console.log("rename error", ev);
        };
    }
}


const DB_NAME_PREFIX = 'KoginDB';
const DB_VERSION = 1;
const DB_STORE = 'templates';


export function getDBName(id) {
    return DB_NAME_PREFIX + id;
}

export class IndexedDBStoreChecker {
    static check(id, op, cbDatabaseExists) {
        const name = getDBName(id);
        if (window.indexedDB.databases) {
            window.indexedDB.databases()
                .then((databases) => {
                    let found = false;
                    for (const [dbName, version] of databases) {
                        if (name == dbName) {
                            cbDatabaseExists(true, op);
                            continue;
                        }
                    }
                    if (!found) {
                        cbDatabaseExists(false, op);
                    }
                });
        } else {
            // firefox does not support databases method
            const request = window.indexedDB.open(name, DB_VERSION);
            request.onerror = (error) => {
                cbDatabaseExists(false, op);
            };
            request.onsuccess = (ev) => {
                cbDatabaseExists(true, op);
            };
            request.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (db.objectStoreNames.contains(DB_STORE)) {
                    cbDatabaseExists(true, op);
                } else {
                    // store have never created, so this database did not exist.
                    createStore(db);
                    cbDatabaseExists(false, op);
                }
            };
        }
    }
}

function createStore(db) {
    let store = db.createObjectStore(
        DB_STORE, { autoIncrement: true });
    store.createIndex("name", "name", { unique: false });
}

/// { name: identical, data: , [key: ,] }
/**
 * Template storage which stores data into indexed DB.
 */
export class IndexedDBStorage {
    /**
     * Constructor.
     *
     * @param {number} folderID Some ID.
     * @param {string} name Name of this storage.
     */
    constructor(folderID, name) {
        this.name = name;
        this.dbName = getDBName(folderID);
        this.db = null;
        this.valid = false;
        this.initialized = false;
    }

    /// Initialize internal.
    init(cbInitialized) {
        this._openDB(cbInitialized);
    }

    /// Opens database.
    _openDB = (cbInitialized) => {
        if (this.db) {
            return;
        }

        const rq = window.indexedDB.open(this.dbName, DB_VERSION);
        rq.onsuccess = (ev) => {
            this.db = ev.target.result;
            this.valid = true;
            this.initialized = true;
            if (cbInitialized) {
                cbInitialized();
            }
        };
        rq.onerror = (ev) => { console.log('error', ev) };
        rq.blocked = (ev) => { console.log('blocked', ev) };
        rq.onupgradeneeded = (ev) => {
            createStore(ev.target.result);

            //store.transaction.oncomplete = function(ev) {};
        };
    }

    supportsFolderFunction() {
        return false;
    }

    /// Returns true if this storage is readonly, otherwise false.
    isReadOnly() {
        return false;
    }

    /// Returns true if this storage is valid, otherwise false.
    isValid() {
        return this.valid;
    }

    /// Return true if this storage is initialized, otherwise false.
    isInitialized() {
        return this.initialized;
    }

    /**
     * Returns store for the specified store and mode.
     *
     * @param {string} storeName Name of store.
     * @param {string} mode Open mode.
     * @returns {}
     */
    getStore(storeName, mode) {
        const transaction = this.db.transaction(storeName, mode);
        transaction.oncomplete = (ev) => {};
        transaction.onerror = (ev) => { console.log(ev) };
        return transaction.objectStore(storeName);
    }




    /**
     * Listing all entries.
     *
     * @param {Object} requestOp Value contains request information.
     * @param {function} cbDone Function called when loading data finished.
     */
    listEntries(requestOp, cbDone) {
        if (!this.db) {
            return;
        }

        const folder = requestOp.folder;
        const entries = [];
        const store = this.getStore(DB_STORE, 'readonly');
        const indexed = store.index('name');
        const request = indexed.openCursor();
        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const key = cursor.primaryKey;
                const value = cursor.value;
                if (value.folder == folder || (!value.folder && folder == '/')) {
                    entries.push({ key: key, name: value.name, folder: value.folder });
                }
                cursor.continue();
            }
        };
        if(cbDone) {
            request.transaction.oncomplete = (ev) => {
                entries.sort((a, b) => nameSort(a.name, b.name));
                cbDone(requestOp, entries);
            };
        }
    }

    findEntry(name, folder, callback) {
        if (!this.db) {
            return;
        }

        const store = this.getStore(DB_STORE, 'readonly');
        const indexed = store.index('name');
        const request = indexed.getKey(name);
        request.onsuccess = (ev) => {
            if (callback) {
                const key = ev.target.result;
                callback(name, key);
            }
        };
        request.onerror = (ev) => {
            callback(name, null);
        };
    }

    /**
     * Opens single entry.
     * @param {Object} requestOp Contains request information.
     * @param {number} key Key ID for entry.
     * @param {function} cbDataLoaded Function called when entry is loaded.
     */
    openEntry(requestOp, key, cbDataLoaded, cbError) {
        if (!this.db) {
            return;
        }

        const store = this.getStore(DB_STORE, 'readonly');
        const request = store.get(key);
        request.onsuccess = (ev) => {
            const value = ev.target.result;
            cbDataLoaded(requestOp, key, value.name, value.data, value.folder);
        };
        request.onerror = (ev) => {
            if (cbError) {
                cbError(requestOp, key);
            }
        };
    }

    /**
     * Opens all entries.
     *
     * @param {Object} requestOp Contains request information.
     * @param {function} cbDataLoaded Function called with loaded data for each entry.
     * @param {function} cbComplete Function called when all entries are loaded.
     */
    openAllEntries(requestOp, cbDataLoaded, cbComplete=null) {
        if (!this.db) {
            return;
        }

        const folder = requestOp.folder;
        const entries = [];
        const store = this.getStore(DB_STORE, 'readonly');
        const indexed = store.index('name');
        const request = indexed.openCursor();
        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const value = cursor.value;
                if (!folder || value.folder == folder) {
                    const key = cursor.primaryKey;
                    entries.push({ key: key, name: value.name, folder: value.folder, data: value.data });
                }
                cursor.continue();
            }
        };
        if (cbComplete) {
            store.transaction.oncomplete = (ev) => {
                entries.sort((a, b) => nameSort(a.name, b.name));
                for (const entry of entries) {
                    cbDataLoaded(requestOp, entry.key, entry.name, entry.folder, entry.data);
                }
                cbComplete(requestOp);
            };
        }
    }

    /// Duplicate item.
    duplicateEntry(requestOp, key, name, callback, errorCallback=null) {
        const store = this.getStore(DB_STORE, 'readwrite');
        const request = store.get(key);
        request.onsuccess = (ev) => {
            const value = ev.target.result;
            const rq = store.add({
                name: name, data: value.data, folder: value.folder,
            });
            rq.onsuccess = (ev) => {
                const key = ev.target.result;
                if (callback) {
                    callback(requestOp, key, name, value.folder, value.data);
                }
            };
            rq.onerror = (ev) => {
                if (errorCallback) {
                    // name conflict?
                    errorCallback(requestOp, key, name);
                }
            };
        };
    }

    addOrUpdateEntry = (requestOp, name, data, op, cbDataStored) => {
        if (op.key) {
            this.updateEntry(requestOp, op.key, name, data, op, cbDataStored);
        } else {
            this.addEntry(requestOp, name, data, op, cbDataStored);
        }
    }

    /// Adds new entry.
    addEntry = (requestOp, name, data, op, cbDataStored) => {
        if (!this.db) {
            return;
        }

        const store = this.getStore(DB_STORE, 'readwrite');
        const obj = { name: name, folder: requestOp.folder, data: data };
        Object.assign(obj, op);
        const request = store.add(obj);
        request.onsuccess = (ev) => {
            if (cbDataStored) {
                const key = ev.target.result;
                cbDataStored(requestOp, key, name, requestOp.folder, data);
            }
        };
    }

    /// Updates entry of data.
    updateEntry = (requestOp, key, name, data, op, cbDataStored) => {
        if (!this.db) {
            return;
        }

        const store = this.getStore(DB_STORE, 'readwrite');
        const request = store.get(key);
        request.onsuccess = (ev) => {
            const value = ev.target.result;
            const obj = {
                name: name ? name : value.name,
                folder: requestOp.folder ? requestOp.folder : value.folder,
                data: data ? data : value.data,
            };
            if (op && op.hash) {
                obj.hash = op.hash;
            }
            const rq = store.put(obj, key);
            rq.onsuccess = (ev) => {
                if (cbDataStored) {
                    cbDataStored(requestOp, name);
                }
            }
        };
        request.onerror = (ev) => {
            console.log("update error", ev);
        }
    }

    /**
     * Renames entry.
     *
     * @param {Object} requestOp Value to be passed to callback function.
     * @param {number} key Key ID.
     * @param {string} name New name for the entry.
     * @param {function} cbRenameDone Function called when rename has been done.
     */
    renameEntry(requestOp, key, name, cbRenameDone) {
        const store = this.getStore(DB_STORE, 'readwrite');
        const request = store.get(key);
        request.onsuccess = (ev) => {
            const value = ev.target.result;
            const rq = store.put({
                name: name, data: value.data, folder: value.folder,
            }, key);
            rq.onsuccess = (ev) => {
                if (cbRenameDone) {
                    cbRenameDone(requestOp, name);
                }
            }
        };
    }

    /**
     * Removes entry.
     *
     * @param {Object} requestOp Value to be passed to callback function.
     * @param {number} key Key ID.
     * @param {function} cbRemoveDone Function called when remove has been done.
     */
    removeEntry(requestOp, key, cbRemoveDone) {
        const store = this.getStore(DB_STORE, 'readwrite');
        const request = store.delete(key);
        request.onsuccess = (ev) => {
            if (cbRemoveDone) {
                cbRemoveDone(requestOp);
            }
        };
    }

    /**
     * Removes own database.
     * @param {function} cbRemoveOwnDone Function called when remove has been done.
     * @param {Object} op Value to be passed to callback function.
     */
    removeOwn(cbRemoveOwnDone, op) {
        const rq = window.indexedDB.deleteDatabase(this.dbName);
        rq.onerror = (ev) => { console.log(ev) };
        rq.onsuccess = (ev) => {
            if (cbRemoveOwnDone) {
                cbRemoveOwnDone(op);
            }
        };
    }

    /**
     * Removes data which is not found in updated repository.
     */
    clearRemovedData() {
        for (const obj of this.dataInfo.values()) {
            const key = obj.key;
            this.removeEntry(null, key);
        }
    }

    clearData(requestOp, cbClear) {
        const store = this.getStore(DB_STORE, 'readwrite');
        const request = store.clear();
        store.transaction.oncomplete = (ev) => {
            if (cbClear) {
                cbClear(requestOp);
            }
        };
    }

    clearDataInfo() {
        this.dataInfo = new Map();
    }

    fnNeedsLoading = (requestOp, name, hash) => {
        const obj = this.dataInfo.get(name);
        if (obj && hash) {
            // avoid removeing from the database.
            this.dataInfo.delete(name);
            if (obj.hash != hash) {
                return [true, obj.key];
            } else {
                return [false, null];
            }
        }
        return [true, null];
    }

    prepareForUpdate(requestOp, cbPrepared) {
        if (!this.db) {
            return;
        }

        this.clearDataInfo();
        const store = this.getStore(DB_STORE, 'readonly');
        const request = store.openCursor();
        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const key = cursor.primaryKey;
                const value = cursor.value;
                const path = this._join(value.folder, value.name);
                const obj = { key: key, path: path };
                if (cursor.value.hash) {
                    obj.hash = cursor.value.hash;
                }
                this.dataInfo.set(path, obj);
                cursor.continue();
            }
        };
        if (cbPrepared) {
            store.transaction.oncomplete = (ev) => {
                if (cbPrepared) {
                    cbPrepared(requestOp);
                }
            };
        }
    }

    _join(folder, name) {
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
