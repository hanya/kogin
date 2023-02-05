
import { WebBackend } from "./backend.js";
import { scriptLoader, jszipLoader, startDownloadForBlob, getDateForFileName } from "./tools.js";
import { NoticeManager } from "./tool.js";

const SVG_MIME_TYPE = 'image/svg+xml';
const PDF_MIME_TYPE = 'application/pdf';

const API_KEY = "AIzaSyCUoKvBCoyMcnnfjwp0RcNCoK2xQizibgs";
const CLIENT_ID = "21402115652-6cuepgvaihme7o26ac157t4119ned6u6.apps.googleusercontent.com";

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive';


const GOOGLE_API_SRC = "https://apis.google.com/js/api.js";
let googleapiScriptLoaded = false;
let googleapiSigned = false;

export function googleapiLoader(cbScriptLoaded) {
    if (!googleapiScriptLoaded) {
        scriptLoader(GOOGLE_API_SRC, () => {
            googleapiScriptLoaded = true;
            cbScriptLoaded();
        })
    } else {
        cbScriptLoaded();
    }
}

function initGoogleDriveAPI() {
    const noticeID = 'googledrive-notice';
    const noticeManager = new NoticeManager();
    const [notice, signInElement, signOutElement, exists] =
        noticeManager.getOrCreateAuthElement(noticeID, 'Google Drive');

    const cbSigninStatus = (state) => {
        if (state) {
            googleapiSigned = true;
            signInElement.disabled = true;
            signOutElement.disabled = false;
            noticeManager.showNotices(false);
        } else {
            googleapiSigned = false;
            signInElement.disabled = false;
            signOutElement.disabled = true;
            noticeManager.showNotices(true);
        }
    };

    gapi.load('client:auth2', () => {
        gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES,
            })
            .then(() => {
                if (signInElement) {
                    signInElement.addEventListener(
                        'click', () => gapi.auth2.getAuthInstance().signIn());
                }
                if (signOutElement) {
                    signOutElement.addEventListener(
                        'click', () => gapi.auth2.getAuthInstance().signOut());
                }

                gapi.auth2.getAuthInstance().isSignedIn.listen(cbSigninStatus);
                cbSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        }, (error) => {
            console.log(error);
        });
    });
}


/**
 * Loading data from Google Drive.
 */
 export class GoogleDriveBackend extends WebBackend {
    constructor(op) {
        super('googledrive');
        this.folderID = op.folderid;
        this.active = false;
        this.initialized = true;
        this.path = [];
        if (!googleapiSigned) {
            googleapiLoader(() => initGoogleDriveAPI());
        }
    }

    isFolder(file) {
        return file.mimeType == 'application/vnd.google-apps.folder';
    }

    getRootPath() {
        return [{ id: 'root', name: '/'}];
    }

    getRootId() {
        return 'root';
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

    needsInit() {
        return gapi.client === undefined;
    }

    init() {
    }

    loadAll(requestOp, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsLoading, cbLoadingDone, folder, folderKey, cbFolderFound) {
        const pages = [];
        let loadFinished = false;
        let dataCount = new Uint32Array(1);

        const load = (pageToken) => {
            const args = {
                'corpora': "user",
                'pageSize': 1000,
                'fields': "nextPageToken, files(id, name, trashed, modifiedTime, mimeType, sha1Checksum)",
                'orderBy': "name",
            };
            /*
            let q = "(mimeType = '" + 'image/svg+xml' + "')";
            if (this.folderID) {
                q += " and " + `'${this.folderID}' in parents`;
            }*/
            let q = `'${folderKey}' in parents`;
            if (folder == '/') {
                q = `'${this.folderID}' in parents`;
            }
            args.q = q;

            if (pageToken) {
                args.pageToken = pageToken;
            }

            gapi.client.drive.files.list(args)
                .then((response) => {
                    const nextPageToken = response.result.nextPageToken;
                    if (nextPageToken) {
                        pages.push(nextPageToken);
                    } else {
                        loadFinished = true;
                    }
                    let count = 0;
                    for (const file of response.result.files) {
                        if (!file.trashed && fnNameFilter(file.name)) {
                            const [loadingNeeded, key] = fnNeedsLoading(requestOp, this.join(folder, file.name), file.sha1Checksum);
                            if (loadingNeeded) {
                                count += 1;
                                this.loadEntry(requestOp, file, cbDataLoaded, cbError, cbLoadingDone, key);
                            }
                        } else {
                            const path = folder.endsWith('/') ? folder + file.name : folder + '/' + file.name;
                            cbFolderFound(requestOp, path, file.id);
                        }
                    }

                    Atomics.add(dataCount, 0, count);
                    const nextToken = pages.pop();
                    if (nextToken) {
                        load(nextToken);
                    }
                    if (loadFinished && cbLoadFinished) {
                        cbLoadFinished(requestOp, dataCount[0]);
                    }
                })
                .catch((error) => {
                    console.log(error);
                });
        }
        load();
    }

    loadEntry(requestOp, entry, cbDataLoaded, cbError, cbLoadingDone, key) {
        gapi.client.drive.files.get({
            fileId: entry.id,
            alt: 'media',
        })
        .then((response) => {
            if (cbDataLoaded) {
                const op = { hash: entry.sha1Checksum, key: key };
                cbDataLoaded(requestOp, entry.name, this.decode(response.body), op, cbLoadingDone);
            }
        });
    }

    readFile(key, cbDataLoaded, cbError) {
        this.readInfo(key, (id, name, parents) => {
            gapi.client.drive.files.get({
                fileId: id,
                alt: 'media',
            })
            .then((response) => {
                if (cbDataLoaded) {
                    cbDataLoaded(id, name, this.decode(response.body));
                }
            });
        });
    }

    downloadArchive(id, cbDownloader) {
        jszipLoader(() => {
            let totalCount = -1;
            let dataCount = new Uint32Array(1);
            let zip = new JSZip();

            function download() {
                zip.generateAsync({
                    type: 'blob'
                }).then((blob) => {
                    const date = getDateForFileName();
                    startDownloadForBlob(blob,
                        `googledrive-${date}.zip`);
                });
            }

            this.listFiles({}, this.folderID,
                (requestOp, file) => {
                    this.readFile(file.id, (id, name, data) => {
                        zip.file(name, data);
                        Atomics.add(dataCount, 0, 1);
                        if (totalCount != -1 &&
                            totalCount <= Atomics.load(dataCount, 0)) {
                            download();
                        }
                    },
                    (error) => {});
            },
            (error) => {
            },
            (requestOp, count) => {
                totalCount = count;
            },
            () => {
                return true;
            },
            () => {
                return [true, null];
            },
            false);
        });
    }

    getMimeType(fileType) {
        switch (fileType) {
            case 'SVG': return 'image/svg+xml';
            case 'PDF': return 'application/pdf';
            default: return 'image/svg+xml';
        }
    }

    listFiles(requestOp, parentId, cbDataLoaded, cbError, cbLoadFinished, fnNameFilter, fnNeedsListing, folderOnly=false, fileType='SVG') {
        const pages = [];
        let loadFinished = false;
        let dataCount = new Uint32Array(1);

        const load = (pageToken) => {
            const args = {
                'corpora': "user",
                'pageSize': 1000,
                'fields': "nextPageToken, files(id, name, trashed, modifiedTime, mimeType, parents)",
                'orderBy': "name",
            };
            let q = "(mimeType = 'application/vnd.google-apps.folder')";
            if (!folderOnly) {
                q = "(" + q + " or " + "(mimeType = '" + this.getMimeType(fileType) + "')" + ")";
            }
            if (parentId) {
                q += " and " + `'${parentId}' in parents`;
            }
            args.q = q;

            if (pageToken) {
                args.pageToken = pageToken;
            }

            gapi.client.drive.files.list(args)
                .then((response) => {
                    const nextPageToken = response.result.nextPageToken;
                    if (nextPageToken) {
                        pages.push(nextPageToken);
                    } else {
                        loadFinished = true;
                    }

                    let count = 0;
                    for (const file of response.result.files) {
                        if (!file.trashed) {
                            const [loadingNeeded, key] = fnNeedsListing(requestOp, file.name, file.id);
                            if (loadingNeeded) {
                                count += 1;
                                cbDataLoaded(requestOp, file);
                            }
                        }
                    }

                    Atomics.add(dataCount, 0, count);
                    const nextToken = pages.pop();
                    if (nextToken) {
                        load(nextToken);
                    }
                    if (loadFinished && cbLoadFinished) {
                        cbLoadFinished(requestOp, dataCount[0]);
                    }
                });
        }
        load();
    }

    readInfo(id, cbReaded) {
        gapi.client.drive.files.get({
            fileId: id,
            'fields': "id, name, trashed, modifiedTime, mimeType, parents",
        })
        .then((response) => {
            if (cbReaded) {
                const result = response.result;
                cbReaded(result.id, result.name, result.parents);
            }
        });
    }

    createFolder(parentId, name, cbFolderCreated) {
        gapi.client.drive.files.create({
            resource: {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            },
            fields: 'id, name, mimeType',
        })
        .then((response) => {
            if (cbFolderCreated) {
                cbFolderCreated(response.result.id, response.result);
            }
        });
    }

    createFile(name, parentId, data, cbWritten, cbError, mimeType=SVG_MIME_TYPE) {
        const boundary = '-*-1234567890987654321-*-';
        const delimiter = "\r\n--" + boundary + "\r\n";
		const close_delim = "\r\n--" + boundary + "--";

        const metadata = {
            name: name,
            mimeType: 'Content-Type: ' + mimeType,
            parents: [parentId],
        };
        const body =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            (mimeType == SVG_MIME_TYPE ?
                'Content-Type: ' + mimeType :
                'Content-Transfer-Encoding: ' + 'base64') + '\r\n\r\n' +
            data +
            close_delim;
        gapi.client.request({
            path: 'https://www.googleapis.com/upload/drive/v3/files',
            method: 'POST',
            params: {
                uploadType: 'multipart',
                fields: 'id,name,mimeType',
            },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
            },
            body: body,
        })
        .then((response) => {
            if (cbWritten) {
                cbWritten(response.result.id);
            }
        }, (error) => {
            console.log(error);
        });
    }

    updateFile(key, data, cbWritten, cbError, mimeType=SVG_MIME_TYPE) {
        const boundary = '-*-1234567890987654321-*-';
        const delimiter = "\r\n--" + boundary + "\r\n";
		const close_delim = "\r\n--" + boundary + "--";

        const metadata = {
            mimeType: 'Content-Type: ' + mimeType,
        };
        const body =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            (mimeType == SVG_MIME_TYPE ?
                'Content-Type: ' + mimeType :
                'Content-Transfer-Encoding: ' + 'base64') + '\r\n\r\n' +
            data +
            close_delim;
            //'Content-Transfer-Encoding: ' + 'base64' + '\r\n\r\n'
        gapi.client.request({
            path: 'https://www.googleapis.com/upload/drive/v3/files/' + key,
            method: 'PATCH',
            params: {
                uploadType: 'multipart',
                fields: 'id,name,mimeType',
            },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
            },
            body: body,
        })
        .then((response) => {
            if (cbWritten) {
                cbWritten(response.result.id, response.result.name);
            }
        }, (error) => {
            console.log(error);
        });
    }

    renameFile(id, name, cbRenamed) {
        gapi.client.drive.files.update({
            fileId: id,
            resource: {
                name: name,
            },
            'fields': "id, name, trashed, modifiedTime, mimeType, parents",
        })
        .then((response) => {
            if (cbRenamed) {
                cbRenamed(id, name);
            }
        });
    }

    deleteFile(id, cbDeleted) {
        // set file to trash flag
        gapi.client.drive.files.update({
            fileId: id,
            resource: {
                trashed: true,
            },
            fields: 'id, name, mimeType',
        })
        .then((response) => {
            if (cbDeleted) {
                cbDeleted(id);
            }
        });
    }

    async getWebUrl() {
        return `https://drive.google.com/drive/folders/${this.folderID}`;
    }
}
