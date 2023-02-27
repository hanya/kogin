
// tauri only

import { nameSort, pathContainer } from './tools.js';

const TEMPLATES_SETTING_NAME = 'templates.json';


export class FsLocationInfo {
    constructor(dirPath = '') {
        this.dirPath = dirPath != '' ? dirPath : pathContainer.configDir;
        this.fs = window.__TAURI__.fs;
        this.invoke = window.__TAURI__.invoke;
    }

    init(cbInitDone) {
        if (cbInitDone) {
            cbInitDone(true);
        }
    }

    loadLocations(cbLocationsLoaded) {
        const locations = new Map();
        this.invoke('template_file_read',
            { name: TEMPLATES_SETTING_NAME, folder: '/', dir: this.dirPath }
        ).then((s) => {
            try {
                const items = JSON.parse(s);
                for (const [_, item] of Object.entries(items)) {
                    const obj = {
                        key: item.key,
                    };
                    Object.assign(obj, item);
                    locations.set(item.id, obj);
                }
            } catch (e) {
                console.log(e);
            }
            cbLocationsLoaded(locations);
        }).catch((e) => {
            cbLocationsLoaded(locations);
        });
    }

    addLocation(_id, location, cbAddLocation, cbError) {
        this.loadLocations((locations) => {
            let id = 1;
            while (locations.has(id)) {
                id += 1;
            }
            location.key = location.folder_name;
            delete location.folder_name;
            locations.set(id, location);

            this.invoke('dir_create', {
                name: location.key.toString(), dir: this.dirPath,
            }).then((path) => {
                this.storeLocations(locations);

                if (cbAddLocation) {
                    cbAddLocation(location.key, id, location);
                }
            });
        });
    }

    removeLocation(key, id, cbRemoveLocation) {
        this.loadLocations((locations) => {
            locations.delete(id);

            this.storeLocations(locations);

            if (cbRemoveLocation) {
                cbRemoveLocation(id);
            }
        });
    }

    updateLocation(key, id, updateValues, cbUpdated, mode) {
        this.loadLocations((locations) => {
            const location = locations.get(id);
            if (location) {
                Object.assign(location, updateValues);

                this.storeLocations(locations, cbUpdated);
            } else {
                console.log("no location found: " + id.toString());
            }
        });
    }

    storeLocations(locations, cbStored) {
        try {
            const obj = {};
            for (const [id, value] of locations.entries()) {
                obj[id] = value;
            }
            const s = JSON.stringify(obj);
            this.invoke('template_file_write',
                { name: TEMPLATES_SETTING_NAME, folder: '/', dir: this.dirPath, data: s }
            ).catch((e) => {
                console.log(e);
            });
            if (cbStored) {
                cbStored();
            }
        } catch (e) {
            console.log(e);
        }
    }
}

const TEMPLATES_FOLDER_PREFIX = 'folder';

function getName(id) {
    return `${TEMPLATES_FOLDER_PREFIX}-${id}`;
}


export class FSStorage {
    constructor(folderId, name, dirName, dirPath = '') {
        this.name = name;
        this.folderName = dirName;
        this.dirPath = dirPath != '' ? dirPath : pathContainer.templatesDir;
        this.valid = false;
        this.initialized = false;
        this.fs = window.__TAURI__.fs;
        this.invoke = window.__TAURI__.invoke;
        this.clearDataInfo();
    }

    init(cbInitialized) {
        this.initialized = true;
        this.invoke('dir_create', {
            name: this.folderName, dir: this.dirPath,
        }).then((path) => {
            this.path = path;
            this.valid = true;
            if (cbInitialized) {
                cbInitialized();
            }
        });
    }

    supportsFolderFunction() {
        return true;
    }

    isReadOnly() {
        return false;
    }

    isValid() {
        return this.valid;
    }

    isInitialized() {
        return this.initialized;
    }

    listEntries(requestOp, cbDone) {
        const join = this._join;
        const folder = requestOp.folder;
        this.invoke("template_dir_list",
            { folder: folder, dir: this.path }
        ).then((entries) => {
            const ret = [];
            for (const name of entries) {
                ret.push({
                    key: join(folder, name),
                    name: name,
                    folder: folder,
                });
            }
            cbDone(requestOp, ret);
        }).catch((e) => {
            console.log(e);
        });
    }

    findEntry(name, folder, callback) {
        this.invoke("template_file_exists",
            { name: name, folder: folder, dir: this.path }
        ).then((exists) => {
            if (callback) {
                if (exists) {
                    const key = this._join(folder, name);
                    callback(name, key);
                } else {
                    callback(name, null);
                }
            }
        });
    }

    openEntry(requestOp, key, cbDataLoaded, cbError) {
        const [folder, name] = this._splitKey(key);
        this.invoke('template_file_read',
            { name: name, folder: folder, dir: this.path }
        ).then((data) => {
            cbDataLoaded(requestOp, key, name, data, folder);
        }).catch((e) => {
            console.log(e);
            if (cbError) {
                cbError(requestOp, key);
            }
        });
    }

    openAllEntries(requestOp, cbDataLoaded, cbComplete = null) {
        const join = this._join;
        const folder = requestOp.folder;
        this.invoke('template_dir_read',
            { folder: folder, dir: this.path }
        ).then((data) => {
            for (const entry of data.entries) {
                const key = join(folder, entry.name);
                cbDataLoaded(requestOp, key, entry.name, folder, entry.data);
            }
            cbComplete(requestOp, data.last_read);
        }).catch((e) => {
            console.log(e);
        });
    }

    reloadAllEntries(requestOp, cbDataLoaded, cbComplete = null) {
        const join = this._join;
        const folder = requestOp.folder;
        this.invoke('template_dir_reload',
            { folder: folder, dir: this.path }
        ).then((entries) => {
            for (const entry of entries) {
                const key = join(folder, entry.name);
                cbDataLoaded(requestOp, key, entry.name, folder, entry.data, entry.modified);
            }
            cbComplete(requestOp, );
        }).catch((e) => {
            console.log(e);
        });
    }

    duplicateEntry(requestOp, key, name, callback, errorCallback = null) {
        const [folder, thisName] = this._splitKey(key);
        this.invoke('template_file_copy',
            { name: thisName, folder: folder, dir: this.path, another: name }
        ).then((path) => {
            if (callback) {
                const newKey = this._join(folder, name);
                callback(requestOp, newKey, name, folder, data);
            }
        }).catch((e) => {
            if (errorCallback) {
                errorCallback(requestOp, key, name);
            }
        });
    }

    addOrUpdateEntry = (requestOp, name, data, op, cbDataStored) => {
        if (op.key) {
            this.updateEntry(requestOp, op.key, name, data, op, cbDataStored);
        } else {
            this.addEntry(requestOp, name, data, op, cbDataStored);
        }
    }

    addEntry = (requestOp, name, data, op, cbDataStored) => {
        this.invoke('template_file_write',
            { name: name, folder: requestOp.folder, dir: this.path, data: data }
        ).then(() => {
            if (cbDataStored) {
                const key = this._join(requestOp.folder, name);
                cbDataStored(requestOp, key, name, requestOp.folder, data);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    updateEntry = (requestOp, key, name, data, op, cbDataStored) => {
        this.invoke('template_file_write',
            { name: name, folder: requestOp.folder, dir: this.path, data: data }
        ).then(() => {
            if (cbDataStored) {
                cbDataStored(requestOp, name);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    renameEntry(requestOp, key, name, cbRenameDone) {
        const [folder, this_name] = this._splitKey(key);
        this.invoke('template_file_rename',
            { name: this_name, folder: folder, dir: this.path, newName: name }
        ).then(() => {
            if (cbRenameDone) {
                const newKey = this._join(folder, name);
                cbRenameDone(requestOp, name, newKey);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    removeEntry(requestOp, key, cbRemoveDone) {
        const [folder, name] = this._splitKey(key);
        this.invoke('template_file_remove',
            { name: name, folder: requestOp.folder, dir: this.path }
        ).then(() => {
            if (cbRemoveDone) {
                cbRemoveDone(requestOp);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    removeFolder(requestOp, folder, cbRemoveDone) {
        this.invoke('template_dir_remove',
            { folder: folder, dir: this.path }
        ).then(() => {
            if (cbRemoveDone) {
                cbRemoveDone(requestOp);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    removeOwn(cbRemoveOwnDone, op) {
        this.fs.removeDir(this.path, { recursive: true }
        ).then(() => {
            if (cbRemoveOwnDone) {
                cbRemoveOwnDone(op);
            }
        }).catch((e) => {
            console.log(e);
        });
    }

    clearRemovedData() {
        for (const obj of this.dataInfo.values()) {
            const key = obj.key;
            this.removeEntry(null, key);
        }
    }

    clearData(requestOp, cbClear) {
        this.invoke('template_dir_clear',
            { dir: this.path }
        ).then(() => {
            if (cbClear) {
                cbClear(requestOp);
            }
        }).catch((e) => {
            console.log(e);
        });
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
        this.clearDataInfo();
        this.invoke('template_list_hash',
            { dir: this.path }
        ).then((entries) => {
            const dirPathLength = this.path.length;
            const sep = window.__TAURI__.path.sep;
            const replaceSep = sep != '/';

            for (const entry of entries) {
                let path = entry.path.substring(dirPathLength);
                if (replaceSep) {
                    path = path.replaceAll(sep, '/');
                }
                const obj = { hash: entry.hash, key: path };
                this.dataInfo.set(path, obj);
            }
            if (cbPrepared) {
                cbPrepared(requestOp);
            }
        }).catch((e) => {
            console.log(e);
        });
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

    _splitKey(key) {
        const index = key.lastIndexOf('/');
        if (index >= 0) {
            return [index == 0 ? '/' : key.substring(0, index), key.substring(index + 1)];
        } else {
            return ['/', key];
        }
    }
}
