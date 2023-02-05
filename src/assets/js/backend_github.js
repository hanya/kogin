
import { WebBackend } from "./backend.js";


/**
 * Loading data from github repository.
 */
 export class GithubBackend extends WebBackend {
    /**
     * Constructor.
     *
     * @param {Object} op Options for github repository.
     */
    constructor(op, cbInitialized) {
        super('github');
        this.user = op.user;
        this.repository = op.repository;
        this.subdirectory = op.subdirectory || '';
        this.subdirectorySHA = '';
        this.baseURL = `https://api.github.com/repos/${this.user}/${this.repository}/git/`;
        this.initialized = false;
        if (this.subdirectory != '') {
            this._findSubdirectorySHA(this.subdirectory)
                .then((ev) => {
                    this.initialized = true;
                    if (cbInitialized) {
                        cbInitialized();
                    }
                });
        } else {
            this.initialized = true;
        }
    }

    async _findSubdirectorySHA(subdirectory) {
        let error = false;
        const findPath = (data, path) => {
            let found = false;
            for (const value of data.tree) {
                if (value.path == path) {
                    this.subdirectorySHA = value.sha;
                    found = true;
                    break;
                }
            }
            if (!found) {
                error = true;
            }
        }

        const list = subdirectory.split('/');
        this.subdirectorySHA = '';
        for (const path of list) {
            const url = this.baseURL + 'trees/' + (this.subdirectorySHA ? this.subdirectorySHA : 'master');
            const r = await fetch(url);
            if (r.ok && r.status == 200) {
                const data = await r.json();
                findPath(data, path);
            } else {
                error = true;
                break;
            }
        }
        if (error) {
            this.subdirectorySHA = '';
        }
    }

    isInitialized() {
        return this.initialized;
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
        let url = folderKey;
        if (folder == '/') {
            url = this.baseURL + 'trees/' + (this.subdirectorySHA ? this.subdirectorySHA : 'master');
        }

        fetch(url)
            .then((response) => {
                if (response.status != 200) {
                    throw response.status;
                }
                return response.json();
            })
            .then(data => {
                let dataCount = 0;
                for (const entry of data.tree) {
                    if (entry.type == 'blob' && fnNameFilter(entry.path)) {
                        const [loadingNeeded, key] = fnNeedsLoading(requestOp, this.join(folder, entry.path), entry.sha);
                        if (loadingNeeded) {
                            dataCount += 1;
                            this.loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key);
                        }
                    } else if (entry.type == 'tree') {
                        const path = folder.endsWith('/') ? folder + entry.path : folder + '/' + entry.path;
                        cbFolderFound(requestOp, path, entry.url);
                    }
                }
                if (cbLoadFinished) {
                    cbLoadFinished(requestOp, dataCount);
                }
            })
            .catch((error) => {
                if (cbError) {
                    cbError(requestOp, error, 'repository');
                }
            });
    }

    loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key) {
        fetch(entry.url)
            .then((response) => {
                if (response.status != 200) {
                    throw response.status;
                }
                return response.json();
            })
            .then(data => {
                if (cbDataLoaded) {
                    let text = null;
                    const op = { hash: data.sha, key: key, };
                    if (data.encoding == 'base64') {
                        text = this.decode(window.atob(data.content));
                    } else if (data.encoding == 'utf-8') {
                        text = data.content;
                    }
                    cbDataLoaded(requestOp, entry.path, text, op, cbLoadingDone);
                }
            })
            .catch((error) => {
                if (cbError) {
                    cbError(requestOp, error, 'data');
                }
            });
    }

    downloadArchive(id, cbDownloader) {
        const url = `https://github.com/${this.user}/${this.repository}/archive/refs/heads/master.zip`;
        cbDownloader(url, 'master.zip');
    }

    async getWebUrl() {
        return `https://github.com/${this.user}/${this.repository}`;
    }
}
