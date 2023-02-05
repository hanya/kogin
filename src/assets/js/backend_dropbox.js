
import { WebBackend } from "./backend.js";
import {
    scriptLoader, startDownloadForBlob,
    getDateForFileName, getURL
} from "./tools.js";

const DROPBOX_SDK_SRC = "https://cdn.jsdelivr.net/npm/dropbox@10.32.0/dist/Dropbox-sdk.min.js";
let dropboxScriptLoaded = false;

export function dropboxsdkLoader(cbScriptLoaded) {
    if (!dropboxScriptLoaded) {
        scriptLoader(DROPBOX_SDK_SRC, () => {
            dropboxScriptLoaded = true;
            cbScriptLoaded();
        });
    } else {
        cbScriptLoaded();
    }
}

const SVG_MIME_TYPE = 'image/svg+xml';

const REDIRECT_URI = getURL();
const APP_KEY = '1tyr13mlz2dxqcl';

let auth = null;

function createAuth() {
    if (!auth) {
        auth = new Dropbox.DropboxAuth({
            clientId: APP_KEY,
        });
    }
}

export function isInDropbox() {
    return !!auth;
}

export function isDropboxVerified() {
    return !!localStorage.getItem('dropboxAccessToken');
}

export function authDropbox(op) {
    dropboxsdkLoader(() => {
        createAuth();

        auth.getAuthenticationUrl(REDIRECT_URI, undefined, 'code', 'offline', undefined, undefined, true)
            .then(authUrl => {
                window.sessionStorage.clear();
                // store file_id here
                window.sessionStorage.setItem('op', JSON.stringify(op));
                window.sessionStorage.setItem('codeVerifier', auth.codeVerifier);
                window.location.href = authUrl;
            })
            .catch((error) => console.error(error));
    });
}

export function initDropboxAuth(op, cbInitialized) {
    dropboxsdkLoader(() => {
        createAuth();

        if (isDropboxVerified()) {
            auth.setAccessToken(localStorage.getItem('dropboxAccessToken'));
            auth.setRefreshToken(localStorage.getItem('dropboxRefreshToken'));
            auth.setAccessTokenExpiresAt(Date.parse(localStorage.getItem('dropboxExpiresAt')));

            if (cbInitialized) {
                cbInitialized(op);
            }
        } else {
            auth.setCodeVerifier(window.sessionStorage.getItem('codeVerifier'));
            auth.getAccessTokenFromCode(REDIRECT_URI, op.code)
                .then((response) => {
                    auth.setAccessToken(response.result.access_token);
                    auth.setRefreshToken(response.result.refresh_token);
                    auth.setAccessTokenExpiresAt(new Date(Date.now() + response.result.expires_in * 1000));

                    storeToken(response.result.access_token, auth.getAccessTokenExpiresAt(), response.result.refresh_token);

                    const op = JSON.parse(window.sessionStorage.getItem('op'));
                    window.sessionStorage.removeItem('op');
                    if (cbInitialized) {
                        cbInitialized(op);
                    }
                })
                .catch((error) => {
                    console.error(error)
                    localStorage.removeItem('dropboxAccessToken');
                });
        }
    });
}

function storeToken(accessToken, expiresAt, refreshToken=null) {
    localStorage.setItem('dropboxAccessToken', accessToken);
    localStorage.setItem('dropboxExpiresAt', expiresAt.toISOString());
    if (refreshToken) {
        localStorage.setItem('dropboxRefreshToken', refreshToken);
    }
}

function updateTokenIfRequired(obj, func, args) {
    const needsRefresh = !auth.getAccessTokenExpiresAt()
            || (new Date(Date.now() + 300 * 1000)) >= auth.getAccessTokenExpiresAt();
    if (needsRefresh) {
        auth.refreshAccessToken()
            .then(() => {
                storeToken(auth.getAccessToken(), auth.getAccessTokenExpiresAt(), null);

                func.apply(obj, args);
            });
    } else {
        func.apply(obj, args);
    }
}


export class DropboxBackend extends WebBackend {
    constructor(op) {
        super('dropbox');
        if (op) {
            this.basePath = op.path;
        }
        this.active = false;
        this.initialized = false;
        this.path = [];
        if (isInDropbox()) {
            this.db = new Dropbox.Dropbox({
                auth: auth
            });
        }
    }

    isFolder(mimeType) {
        return mimeType == 'folder';
    }

    getRootPath() {
        return [{ id: '/', name: '/' }];
    }

    getRootId() {
        return '/';
    }

    needsAuth() {
        return true;
    }

    setPath(path) {
        this.path = path;
    }

    getPath() {
        return this.path;
    }

    isFolder(entry) {
        return entry['.tag'] == 'folder';
    }

    init() {
    }

    /**
     * Request to load all data.
     *
     * @param {Object} requestOp Contains data which
     * @param {function} cbDataLoaded Called when data is loaded.
     * @param {function} cbError Called when error happen.
     * @param {function} cbLoadFinished Called when loading of list of file is loaded.
     */
    loadAll(requestOp, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsLoading, cbLoadingDone, folder, folderKey, cbFolderFound) {
        updateTokenIfRequired(this, this._loadAll,
            [requestOp, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsLoading, cbLoadingDone, folder, folderKey, cbFolderFound]);
    }

    _loadAll(requestOp, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsLoading, cbLoadingDone, folder, folderKey, cbFolderFound) {
        let dataCount = new Uint32Array(1);

        const loadEntries = (entries) => {
            let count = 0;
            for (const entry of entries) {
                if (entry['.tag'] == 'file') {
                    // file only
                    if (entry.is_downloadable && fnNameFilter(entry.name)) {
                        const [loadingNeeded, key] = fnNeedsLoading(requestOp, this.join(folder, entry.name), entry.id);
                        if (loadingNeeded) {
                            this.loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key);
                            count += 1;
                        }
                    }
                } else if (entry['.tag'] == 'folder') {
                    const path = folder.endsWith('/') ? folder + entry.name : folder + '/' + entry.name;
                    cbFolderFound(requestOp, path, entry.path_display);
                }
            }
            Atomics.add(dataCount, 0, count);
        };

        const parseResult = (result) => {
            loadEntries(result.entries);
            if (result.has_more) {
                load(result.cursor);
            } else {
                if (cbLoadFinished) {
                    cbLoadFinished(requestOp, dataCount[0]);
                }
            }
        };

        const load = (cursor) => {
            this.db.filesListFolderContinue({
                cursor: cursor,
            }).then((data) => {
                if (data.error) {
                    throw data.error_summary;
                }
                parseResult(response.result);
            }).catch((error) => {
                console.log(error);
            });
        };

        let path = folderKey;
        if (folder == '/') {
            path = this.basePath;
        }

        this.db.filesListFolder({
            path: path
        }).then((response) => {
            parseResult(response.result);
        }).catch((error) => {
            console.log(error);
        });
    }

    loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key) {
        this.db.filesDownload({
            path: entry.id,
        }).then((data) => {
            const entry = data.result;
            if (entry.is_downloadable) {
                entry.fileBlob.text().then((text) => {
                    if (cbDataLoaded) {
                        const op = { hash: entry.content_hash, key: key };
                        cbDataLoaded(requestOp, entry.name, text, op, cbLoadingDone);
                    }
                });
            }
        }).catch((error) => {
            if (cbError) {
                cbError(requestOp, error, 'data');
            }
        });
    }

    readFile(key, cbDataLoaded, cbError) {
        updateTokenIfRequired(this, this._readFile, [key, cbDataLoaded, cbError]);
    }

    _readFile(key, cbDataLoaded, cbError) {
        this.db.filesDownload({
            path: key,
        }).then((response) => {
            const entry = response.result;
            if (entry.is_downloadable) {
                entry.fileBlob.text().then((text) => {
                    if (cbDataLoaded) {
                        cbDataLoaded(entry.path_display, entry.name, text);
                    }
                });
            }
        }).catch((error) => {
            if (cbError) {
                cbError(requestOp, error, 'data');
            }
        });
    }

    downloadArchive(id, cbDownloader) {
        updateTokenIfRequired(this, this._downloadArchive, [id, cbDownloader]);
    }

    _downloadArchive(id, cbDownloader) {
        this.db.filesDownloadZip({
            path: this.basePath,
        })
        .then((response) => {
            startDownloadForBlob(
                response.result.fileBlob,
                response.result.metadata.name + '-' + getDateForFileName() + '.zip');
        });
    }

    listFiles(requestOp, parentId, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsListing, folderOnly=false) {
        updateTokenIfRequired(this, this._listFiles,
            [requestOp, parentId, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsListing, folderOnly]);
    }

    _listFiles(requestOp, parentId, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsListing, folderOnly=false) {
        const loadEntries = (entries) => {
            for (const entry of entries) {
                const isFolder = entry['.tag'] == 'folder';
                if (folderOnly && !isFolder) {
                    continue;
                }
                if (!isFolder && !fnNameFilter(entry.name)) {
                    continue;
                }
                const [loadingNeeded, key] = fnNeedsListing(requestOp, entry.name, entry.path_display);
                if (loadingNeeded) {
                    cbDataLoaded(requestOp, { id: entry.path_display, name: entry.name, '.tag': entry['.tag'] });
                }
            }
        };

        const parseResult = (result) => {
            loadEntries(result.entries);
            if (result.has_more) {
                load(result.cursor);
            } else {
                cbLoadFinished(requestOp, 0);
            }
        };

        const load = (cursor) => {
            this.db.filesListFolderContinue({
                cursor: cursor,
            }).then((response) => {
                if (response.error) {
                    throw data.error_summary;
                }
                parseResult(response.result);
            }).catch((error) => {
                console.log(error);
            });
        }

        this.db.filesListFolder({
            path: parentId != '/' ? parentId : '',
        }).then((response) => {
            parseResult(response.result);
        }).catch((error) => {
            console.log(error);
        });
    }

    readInfo(id, cbReaded) {
        updateTokenIfRequired(this, this._readInfo, [id, cbReaded]);
    }

    _readInfo(id, cbReaded) {
        // get metadata for root folder is not supported
        if (id == '' || id == '/') {
            if (cbReaded) {
                cbReaded('/', '/', []);
            }
            return;
        }
        this.db.filesGetMetadata({
            path: id,
        })
        .then((response) => {
            if (cbReaded) {
                const result = response.result;
                const path = result.path_display != '' ? result.path_display : '/';
                cbReaded(path, result.name, [this.getPathFolder(path)]);
            }
        });
    }

    createFolder(parentId, name, cbFolderCreated) {
        updateTokenIfRequired(this, this._createFolder, [parentId, name, cbFolderCreated]);
    }

    _createFolder(parentId, name, cbFolderCreated) {
        const folderPath = parentId + '/' + name;
        this.db.filesCreateFolderV2({
            path: folderPath,
        })
        .then((response) => {
            if (cbFolderCreated) {
                cbFolderCreated(folderPath, { id: folderPath, name: name, '.tag': 'folder' });
            }
        });
    }

    createFile(name, parentId, data, cbWritten, cbError) {
        updateTokenIfRequired(this, this._createFile, [name, parentId, data, cbWritten, cbError]);
    }

    _createFile(name, parentId, data, cbWritten, cbError) {
        const path = parentId + '/' + name;
        this.db.filesUpload({
            contents: data,
            path: path,
            mode: {
                '.tag': 'overwrite',
            },
        })
        .then((response) => {
            if (cbWritten) {
                cbWritten(response.result.path_display);
            }
        });
    }

    updateFile(key, data, cbWritten, cbError) {
        updateTokenIfRequired(this, this._updateFile, [key, data, cbWritten, cbError]);
    }

    _updateFile(key, data, cbWritten, cbError) {
        this.db.filesUpload({
            contents: data,
            path: key,
            mode: {
                '.tag': 'overwrite',
            },
        })
        .then((response) => {
            if (cbWritten) {
                cbWritten(response.result.path_display, response.result.name);
            }
        });
    }

    renameFile(id, name, cbRenamed) {
        updateTokenIfRequired(this, this._renameFile, [id, name, cbRenamed]);
    }

    _renameFile(id, name, cbRenamed) {
        const newPath = this.getPathFolder(id) + '/' + name;
        this.db.filesMoveV2({
            from_path: id,
            to_path: newPath,
        })
        .then((response) => {
            if (cbRenamed) {
                cbRenamed(id, name);
            }
        });
    }

    deleteFile(id, cbDeleted) {
        updateTokenIfRequired(this, this._deleteFile, [id, cbDeleted]);
    }

    _deleteFile(id, cbDeleted) {
        this.db.filesDeleteV2({
            path: id,
        })
        .then((response) => {
            if (cbDeleted) {
                cbDeleted(id);
            }
        });
    }

    /**
     *
     * @param {string} path
     */
    getPathFolder(path) {
        const folderPath = path.substring(0, path.lastIndexOf('/'));
        if (folderPath == '') {
            return '/';
        } else {
            return folderPath;
        }
    }

    async getWebUrl() {
        return `https://www.dropbox.com/${this.path}`
    }
}
