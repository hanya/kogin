
import { WebBackend } from "./backend.js";

/**
 * Loading data from gitlab.
 */
 export class GitlabBackend extends WebBackend {
    /**
     * Constructor.
     *
     * @param {Object} op Options for gitlab repository.
     */
    constructor(op) {
        super('gitlab');
        this.initialized = true;
        this.projectid = op.projectid;
        this.subdirectory = op.subdirectory;
        if (!this.subdirectory.endsWith('/')) {
            this.subdirectory += '/';
        }
        this.baseURL = `https://gitlab.com/api/v4/projects/${this.projectid}/repository/`;
    }

    loadAll(requestOp, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsLoading, cbLoadingDone, folder, folderKey, cbFolderFound) {

        let url = this.baseURL + 'tree' + '?path=' + folderKey +
            '&pagination=keyset&per_page=100&order_by=name&sort=asc';
        if (folder == '/') {
            url = this.baseURL + 'tree' + '?path=' + this.subdirectory +
                '&pagination=keyset&per_page=100&order_by=name&sort=asc';
        }

        const pages = [];
        let loadFinished = false;
        let dataCount = new Uint32Array(1);

        const loadPage = (url) => {
            fetch(url)
                .then((response) => {
                    if (response.status != 200) {
                        throw response.status;
                    }
                    const nextLink = this._getNextLink(response.headers);
                    if (nextLink) {
                        pages.push(nextLink);
                    } else {
                        loadFinished = true;
                    }
                    return response.json();
                })
                .then((data) => {
                    let count = 0;
                    for (const entry of data) {
                        if (entry.type == 'blob' && fnNameFilter(entry.name)) {
                            const [loadingNeeded, key] = fnNeedsLoading(requestOp, this.join(folder, entry.name), entry.id);
                            if (loadingNeeded) {
                                count += 1;
                                this.loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key);
                            }
                        } else if (entry.type == 'tree') {
                            const path = folder.endsWith('/') ? folder + entry.path : folder + '/' + entry.path;
                            cbFolderFound(requestOp, path, path.substring(1));
                        }
                    }
                    Atomics.add(dataCount, 0, count);
                    const nextLink = pages.pop();
                    if (nextLink) {
                        loadPage(nextLink);
                    }
                    if (loadFinished && cbLoadFinished) {
                        cbLoadFinished(requestOp, dataCount[0]);
                    }
                })
                .catch((error) => {
                    console.log(error);
                    if (cbError) {
                        cbError(requestOp, error, 'repository');
                    }
                });
        }
        loadPage(url);
    }

    _getNextLink(headers) {
        const links = headers.get('link').split(',');
        for (const link of links) {
            if (link.lastIndexOf('; rel="next"') > 0) {
                let s = link.trimStart();
                return s.substring(1, s.lastIndexOf('>'));
            }
        }
        return null;
    }

    loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key) {
        const url = this.baseURL + 'blobs/' + entry.id;

        fetch(url)
            .then((response) => {
                if (response.status != 200) {
                    throw response.status;
                }
                return response.json();
            })
            .then((data) => {
                if (cbDataLoaded) {
                    if (data.encoding == 'base64') {
                        const text = this.decode(window.atob(data.content));
                        if (cbDataLoaded) {
                            const op = { hash: data.sha, key: key, };
                            cbDataLoaded(requestOp, entry.name, text, op, cbLoadingDone);
                        }
                    }
                }
            })
            .catch((error) => {
                console.log(error);
            });
    }

    downloadArchive(id, cbDownloader) {
        const url = this.baseURL + 'archive.zip';
        cbDownloader(url, 'archive.zip');
    }

    static async getRepositoryUrl(id) {
        const url = `https://gitlab.com/api/v4/projects/${id}`;
        const response = await fetch(url);
        const data = await response.json();
        return data.web_url;
    }

    async getWebUrl() {
        const url = await GitlabBackend.getRepositoryUrl(this.projectid);
        return url;
    }
}
