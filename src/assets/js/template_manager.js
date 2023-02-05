
import {
    IndexedDBStorage, IndexedDBStoreChecker, TemplateLocationInfo
} from "./local_storage.js";
import {
    FsLocationInfo, FSStorage
} from "./fs_storage.js";
import { GithubBackend } from './backend_github.js';
import { GitlabBackend } from './backend_gitlab.js';
import { GoogleDriveBackend } from "./backend_googledrive.js";
import { DropboxBackend, isInDropbox } from "./backend_dropbox.js";
import { PROJECT } from './project.js';
import {
    getLang,
    jszipLoader, startDownloadForBlob,
    getDate, startDownloadURL, startDownloadForData
} from './tools.js';


const BACKENDS = {
    github: GithubBackend,
    gitlab: GitlabBackend,
    googledrive: GoogleDriveBackend,
    dropbox: DropboxBackend,
};

/**
 * Wrapper for set of location and storage.
 */
class Loader {
    /**
     * Constructor.
     *
     * @param {Object} location Location information.
     * @param {IndexedDBStorage} storage Storage instance.
     * @param {GithubBackend|GitlabBackend|GoogleDriveBackend} backend Backend instance.
     */
    constructor(location, storage, backend, templateManager, isValid = true) {
        this.location = location;
        this.storage = storage;
        this.backend = backend;
        this.templateManager = templateManager;
        this.folderLoaded = new Map();
        this.valid = isValid;

        if (!this.location.folders || this.location.folders.length == 0) {
            this.location.folders = ['/'];
        }
        if (this.location.folders.indexOf('/') != 0) {
            this.location.folders.splice(0, 0, '/');
        }
        if (!this.location.activeFolder) {
            this.location.activeFolder = '/';
        }
        this.reservedFolder = [];
    }

    isValid() {
        return this.valid;
    }

    getBackendLastload() {
        return this.location.lastload;
    }

    updateBackendLastload() {
        this.setBackendLastload(Date.now());
    }

    temporalyResetBackendLastload() {
        this.location.lastload = 0;
    }

    setBackendLastload(time) {
        this.location.lastload = time;
        this.templateManager.info.updateLocation(
            this.location.key,
            this.getId(),
            { lastload: time },
            (id, mode) => this.location.lastload = time,
            'lastload'
        );
    }

    isLoaded(folder) {
        return this.folderLoaded.get(folder);
    }

    setLoaded(folder) {
        this.folderLoaded.set(folder, true);
    }

    clearLoaded() {
        this.folderLoaded.clear();
    }

    isLocal() {
        return this.location.type == 'local';
    }

    isCached() {
        return this.location.type == 'cached';
    }

    isSupportedType() {
        return this.location.type == 'local' ||
            this.location.type == 'cached';
    }

    getId() {
        return this.location.id;
    }

    getName() {
        return this.location.name;
    }

    setName(name, cbRenamed) {
        if (name != this.location.name) {
            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { name: name },
                (id, mode) => {
                    this.location.name = name;
                    if (cbRenamed) {
                        cbRenamed();
                    }
                }, 'rename'
            )
        }
    }

    getSize() {
        return this.location.size;
    }

    setSize(size, cbResized) {
        if (size != this.location.size) {
            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { size: size },
                (id, mode) => {
                    this.location.size = size;
                    if (cbResized) {
                        cbResized();
                    }
                }, 'size'
            )
        }
    }

    getActiveFolder() {
        return this.location.activeFolder;
    }

    setActiveFolder(folder) {
        this.location.activeFolder = folder;
    }

    hasFolder() {
        return this.location.folders.length > 1;
    }

    getFolders() {
        return this.location.folders;
    }

    renameFolder(name, newName, cbFolderRenamed) {
        // checks name conflict
        if (this.location.folders.indexOf(newName)) {
            return false;
        }
        const index = this.location.folders.indexOf(name);
        if (index >= 0) {
            this.location.folders[index] = newName;

            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { folders: this.location.folders },
                (id, mode) => {
                    cbFolderRenamed(id, index);
                }, 'rename'
            );
            return true;
        }
        return false;
    }

    removeFolder(name, cbFolderRemoved) {
        const index = this.location.folders.indexOf(name);
        if (index >= 0) {
            this.location.folders.splice(index, 1);

            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { folders: this.location.folders },
                (id, mode) => {
                    cbFolderRemoved(id, index);
                }, 'remove'
            );
            return true;
        }
        return false;
    }

    addFolder(name, cbFolderAdded) {
        if (!this.location.folders) {
            this.location.folders = [];
        }
        if (this.location.folders.indexOf(name) < 0) {
            this.location.folders.push(name);
            this.location.folders.sort();

            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { folders: this.location.folders },
                (id, mode) => {
                    if (cbFolderAdded) {
                        cbFolderAdded(id, name, this.location.folders.indexOf(name));
                    }
                }, 'folders'
            );
        }
    }

    addReservedFolder(value) {
        this.reservedFolder.push(value);
    }

    getReservedFolder() {
        return this.reservedFolder.pop();
    }

    removeFolder(name, cbFolderRemoved) {
        if (!this.location.folders) {
            this.location.folders = [];
        }

        const index = this.location.folders.indexOf(name);
        if (index > 0) {
            this.location.folders.splice(index, 1);
            // remove subfolders
            const subfolderPrefix = name + '/';
            while (true) {
                const i = this.location.folders.findIndex((item) => item.startsWith(subfolderPrefix));
                if (i > 0) {
                    this.location.folders.splice(i, 1);
                } else {
                    break;
                }
            }

            this.templateManager.info.updateLocation(
                this.location.key, this.getId(), { folders: this.location.folders },
                (id, mode) => {
                    cbFolderRemoved(id, index);
                }, 'folders'
            );
        }
    }

    // todo, show number of files
    async getInfo() {
        const info = [];
        if (this.isLocal()) {
            info.push(['Local storage', this.location.name]);
        } else if (this.isCached()) {
            if (this.backend.type == 'github') {
                info.push(['Github storage', this.location.name]);
                info.push(['User', this.location.user]);
                info.push(['Repository', this.location.repository]);
                info.push(['Subdirectory', this.location.subdirectory]);
                info.push(['Link',
                    `https://github.com/${this.location.user}/${this.location.repository}`]);
            } else if (this.backend.type == 'gitlab') {
                info.push(['Gitlab storage', this.location.name]);
                info.push(['Project ID', this.location.projectid]);
                info.push(['Subdirectory', this.location.subdirectory]);
                const url = await GitlabBackend.getRepositoryUrl(this.location.projectid);
                info.push(['Link', url]);
            } else if (this.backend.type == 'googledrive') {
                info.push(['Google Drive storage', this.location.name]);
                info.push(['Folder name', this.location.folder_name]);
                info.push(['Folder ID', this.location.folderid]);
                info.push(['Link', `https://drive.google.com/drive/folders/${this.location.folderid}`]);
            } else if (this.backend.type == 'dropbox') {
                info.push(['Dropbox storage', this.location.name]);
                info.push(['Path', this.location.path]);
                info.push(['Link', `https://www.dropbox.com/${this.location.path}`]);
            }
        }
        return info;
    }
}

const INITIAL_TEMPLATES = [
    {
        name: 'Local', size: 'small',
        type: 'local', lastload: 0,
    },
    {
        name: 'Kogin', size: 'small',
        type: 'cached', lastload: 0,
        backend_type: 'github',
        user: PROJECT.ORG,
        repository: PROJECT.KOGIN_TEMPLATES,
        subdirectory: '',
    }
];

/**
 * Manager for templates.
 */
export class TemplateManager {
    /**
     * @param {Sashi} sashi
     */
    constructor() {
        this.loaded = false;
        this.lang = getLang();
        this.loaders = new Map();
        this.initialized = false;

        this.info = window.__TAURI__ ? new FsLocationInfo() : new TemplateLocationInfo();
    }

    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.info.init((exists) => {
            if (exists) {
                this.info.loadLocations((locations) => {
                    for (const location of locations.values()) {
                        this.setupLoader(location);
                    }
                });
            } else {
                for (const data of INITIAL_TEMPLATES) {
                    this.addNewLocation(data, () => { });
                }
            }
        });
    }

    /**
     * Add loader for the location.
     *
     * @param {Object} location Location data.
     */
    setupLoader(location, cbStorageInit) {
        let backend = null;
        let storage = window.__TAURI__ ? new FSStorage(location.id, location.name) :
                                         new IndexedDBStorage(location.id, location.name);
        storage.init(cbStorageInit);
        let valid = true;
        if (location.type == 'cached' && location.backend_type) {
            const backendClass = BACKENDS[location.backend_type];
            backend = new backendClass(location);
            if (location.backend_type == 'dropbox' && !isInDropbox()) {
                valid = false;
            }
        }
        const loader = new Loader(location, storage, backend, this, valid);
        this.loaders.set(location.id, loader);
    }

    /**
     * Checks the loader is initialized or not.
     *
     * @param {number} locationId Location ID.
     * @returns {boolean|null} Returns `true` if loader is initialized, otherwise `false`.
     */
    isInitialized(locationId) {
        const loader = this.getLoader(locationId);
        if (loader) {
            return loader.storage.isInitialized();
        } else {
            return null;
        }
    }

    checkForUpdateTime(lastload) {
        const UPDATE_DIFF = 7 * 24 * 60 * 60 * 1000;
        return Date.now() > lastload + UPDATE_DIFF;
    }

    needsUpdate(id) {
        const loader = this.getLoader(id);
        if (loader && loader.backend) {
            return this.checkForUpdateTime(loader.getBackendLastload());
        }
        return false;
    }

    forceReloadAllLoaders() {
        for (const loader of this.loaders.values()) {
            loader.temporalyResetBackendLastload();
        }
    }

    /**
     * Returns specified loader by its ID.
     *
     * @param {number} id Loader ID.
     * @returns {Loader} Specified loader.
     */
    getLoader(id) {
        return this.loaders.get(id);
    }

    iterLoaders() {
        return this.loaders.values();
    }

    iterLoaderIds() {
        return this.loaders.keys();
    }

    /**
     * Add new location and its loader.
     * @param {Object} data Location data without ID.
     */
    addNewLocation(data, cbAdded) {
        if (window.__TAURI__) {
            // id is provided by the info
            this.info.addLocation(null, data, (key, id, location) => {
                // key == id in this case
                data.id = id;
                location.key = key;
                this.setupLoader(data, () => {
                    const loader = this.getLoader(id);
                    cbAdded(loader.location);
                });
            });
        } else {
            this.findNextLocationID(data, cbAdded);
        }
    }

    /// Returns next ID for location.
    findNextLocationID(data, cbAdded, nextId = null) {
        const id = !nextId ? this._nextLocationId() : nextId;

        const op = { id: id, data: data };
        let added = false;
        IndexedDBStoreChecker.check(id, op, (exists, op) => {
            if (added) {
                return;
            }
            if (!exists) {
                added = true;
                data.id = id;
                this.info.addLocation(id, data, (key, id, location) => {
                    location.key = key;
                    this.setupLoader(data, () => {
                        const loader = this.getLoader(id);
                        cbAdded(loader.location);
                    });
                });
            } else {
                const nextId = op.id + 1;
                this.findNextLocationID(data, cbAdded, nextId);
            }
        });
    }

    _nextLocationId() {
        if (this.loaders.length > 0) {
            const ids = Array.from(this.loaders.keys());
            const n = Math.max(...ids);
            return n + 1;
        } else {
            return 1;
        }
    }

    /// Loads data of the template.
    loadData(locationId, key, callback, op, cbError) {
        const loader = this.getLoader(locationId);
        if (loader) {
            loader.storage.openEntry(op, key, callback, cbError);
        } else {
            // todo, location not found
        }
    }

    removeLocation(locationId) {
        const loader = this.getLoader(locationId);
        if (loader) {
            loader.storage.removeOwn();
            this.loaders.delete(locationId);
            this.info.removeLocation(loader.location.key, locationId, (id) => {
            });
        }
    }
}
