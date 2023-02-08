
// tauri
export const pathContainer = {
    configDir: '',
    templatesDir: '',
    homeDir: '',
};

export async function initPath() {
    if (window.__TAURI__) {
        const path = window.__TAURI__.path;
        pathContainer.configDir = await path.appConfigDir();
        pathContainer.templatesDir = await path.join(pathContainer.configDir, 'templates');
        pathContainer.homeDir = await path.homeDir();
    }
}


let windowIndex = 1;

function nextWindowIndex() {
    const v = windowIndex;
    windowIndex += 1;
    return v;
}

export function openSome(url, frame='_blank') {
    if (window.__TAURI__) {
        window.__TAURI__.shell.open(url);
    } else {
        window.open(url, frame);
    }
}

/**
 * Opens URL in some frame.
 *
 * @param {string} url URL to open.
 * @param {string} target Target to be opened in.
 */
export function openURL(url, frame='_blank', callback) {
    if (window.docs) {
        window.docs.openURL(url);
    } else {
        const win = window.open(url, frame);
        if (callback) {
            callback(win);
        }
    }
}

const OPEN_DELAY = 100;
const OPEN_RETRY = 10;

/**
 * Opens data in another frame.
 *
 * @param {string} url URL to open.
 * @param {string} fileName File name for opened document.
 * @param {string} data Document data.
 */
export function openData(url, fileName, data, frame='_blank') {
    if (window.docs) {
        window.docs.openFromData(fileName, data);
        return;
    }
    openURL(url, frame, (window) => {
        let n = 0;
        function open() {
            if (window.app) {
                const app = window.app;
                try {
                    app.openData(data, fileName);
                } catch (error) {
                    alert(error);
                }
            } else if (n < OPEN_RETRY) {
                n += 1;
                setTimeout(open, OPEN_DELAY);
            }
        }
        setTimeout(open, 200);
    });
}

/**
 * Opens template from location in another frame.
 *
 * @param {string} url URL to open.
 * @param {number} locationId Location ID of templates.
 * @param {number} key Key ID of template to specify.
 */
export function openTemplate(url, locationId, key, frame='_blank', viewMode=null) {
    if (window.docs) {
        const fullUrl = `./frame.html?folder=${encodeURIComponent(locationId)}&key=${encodeURIComponent(key)}&view_mode=${encodeURIComponent(viewMode)}`;
        openURL(fullUrl);
        return;
    }
    openURL(url, frame, (window) => {
        let n = 0;
        function open() {
            if (window.app) {
                const app = window.app;
                try {
                    app.openTemplate(locationId, key);
                    if (viewMode) {
                        app.view.setViewMode(viewMode);
                    }
                } catch (error) {
                    alert(error);
                }
            } else if (n < OPEN_RETRY) {
                n += 1;
                setTimeout(open, OPEN_DELAY);
            }
        }
        setTimeout(open, 200);
    });
}

export function openFileFromStorage(url, type, key, target, viewMode) {
    if (window.docs) {
        const fullUrl = `./frame.html?storage_type=${encodeURIComponent(type)}&key=${encodeURIComponent(key)}&view_mode=${encodeURIComponent(viewMode)}`;
        openURL(fullUrl);
        return;
    }
    openURL(url, '_blank', (window) => {
        let n = 0;
        function open() {
            if (window.app) {
                const app = window.app;
                try {
                    app.openFromStorage(type, key);
                    if (viewMode) {
                        app.view.setViewMode(viewMode);
                    }
                } catch (error) {
                    alert(error);
                }
            } else if (n < OPEN_RETRY) {
                n += 1;
                setTimeout(open, OPEN_DELAY);
            }
        }
        setTimeout(open, 200);
    });
}

/**
 * Returns page URL without any queries.
 * @returns {string} URL.
 */
export function getURL() {
    if (window.docs) {
        return window.location.pathname;
    } else {
        return window.location.origin + window.location.pathname;
    }
}

/**
 * Download from URL.
 *
 * @param {string} saveURL URL to be downloaded.
 */
export function startDownloadURL(saveURL, fileName) {
    const a = document.getElementById('save-url');
    a.download = fileName;
    a.href = saveURL;
    a.click();
}

/**
 * Download blob data.
 *
 * @param {Blob} blob Blob data to be downloaded.
 * @param {string} fileName File name.
 */
export function startDownloadForBlob(blob, fileName) {
    const saveURL = URL.createObjectURL(blob);
    startDownloadURL(saveURL, fileName);
    setTimeout(() => URL.revokeObjectURL(saveURL), 100);
}

/**
 * Download string data.
 *
 * @param {string} data Data to be downloaded.
 * @param {string} fileName File name.
 * @param {string} mimeType Mime type for the data.
 */
export function startDownloadForData(data, fileName, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    startDownloadForBlob(blob, fileName);
}

export function scriptLoader(src, cbOnload) {
    const element = document.createElement('script');
    element.setAttribute('src', src);
    element.onload = cbOnload
    document.head.appendChild(element);
}

const JSZIP_SRC = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const JSZIP_TAURI_SRC = './assets/extjs/jszip.min.js';
let jsScriptLoaded = false;

/**
 * Tries to load JSZip script.
 *
 * @param {function} cbScriptLoaded Callback function when script loaded.
 */
export function jszipLoader(cbScriptLoaded) {
    if (!jsScriptLoaded) {
        scriptLoader(window.__TAURI__ ? JSZIP_TAURI_SRC : JSZIP_SRC, () => {
            jsScriptLoaded = true;
            cbScriptLoaded();
        });
    } else {
        cbScriptLoaded();
    }
}

const PDFLIB_SRC = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const PDFLIB_TAURI_SRC = './assets/extjs/pdf-lib.min.js';
const FONTKIT_SRC = 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
const FONTKIT_TAURI_SRC = './assets/extjs/fontkit.umd.min.js';
let pdfScriptLoaded = false;

export function pdflibLoader(cbScriptLoaded) {
    if (!pdfScriptLoaded) {
        scriptLoader(window.__TAURI__ ? PDFLIB_TAURI_SRC : PDFLIB_SRC, () => {
            scriptLoader(window.__TAURI__ ? FONTKIT_TAURI_SRC : FONTKIT_SRC, () => {
                pdfScriptLoaded = true;
                cbScriptLoaded();
            });
        });
    } else {
        cbScriptLoaded();
    }
}

/**
 * Returns current date description.
 *
 * @returns {string} Date.
 */
export function getDate() {
    const d = new Date();
    d.setTime(Date.now());
    const date = d.getFullYear() + '-' +
        d.getMonth().toString().padStart(2, '0') + '-' +
        d.getDate().toString().padStart(2, '0') + ' ' +
        d.getHours().toString().padStart(2, '0') + ':' +
        d.getMinutes().toString().padStart(2, '0');
    return date;
}

export function getDateForFileName() {
    return getDate().replace(' ', '-').replace(':', '-');
}

export function getLang() {
    const lang = navigator.language;
    if (lang == 'ja' || lang == 'ja_JP' || lang == 'ja-JP') {
        return 'ja';
    } else {
        return 'en';
    }
}

export async function sha1(text) {
    const bytes = new TextEncoder().encode(text);
    const buffer = await crypto.subtle.digest('SHA-1', bytes);
    const hash = Array.from(new Uint8Array(buffer));
    return hash.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sorts file names which contains numbers in them.
export function nameSort(a, b) {
    let [startA, lengthA] = [0, a.length];
    let [startB, lengthB] = [0, b.length];

    function nextSection(s, start, length) {
        const n = s.charCodeAt(start);
        const isNumber = 0x30 <= n && n <= 0x39;
        for (let i = start + 1; i < length; i++) {
            const m = s.charCodeAt(i);
            const isNum = 0x30 <= m && m <= 0x39;
            if (isNum !== isNumber) {
                return isNumber ? [parseInt(s.substring(start, i), 10), i, true] : [s.substring(start, i), i, false];
            }
        }
        return isNumber ? [parseInt(s.substring(start), 10), length, true] : [s.substring(start), length, false];
    }

    while (startA < lengthA && startB < lengthB) {
        let [sectionA, nextStartA, isNumA] = nextSection(a, startA, lengthA);
        let [sectionB, nextStartB, isNumB] = nextSection(b, startB, lengthB);
        if (nextStartA >= lengthA || nextStartB >= lengthB) {
            sectionA = a.substring(startA);
            sectionB = b.substring(startB);
            startA = lengthA;
            startB = lengthB;
        } else {
            startA = nextStartA;
            startB = nextStartB;
        }
        if (isNumA != isNumB) {
            if (isNumA) {
                sectionA = sectionA.toString();
            }
            if (isNumB) {
                sectionB = sectionB.toString();
            }
        }

        if (sectionA != sectionB) {
            return sectionA > sectionB ? 1 : -1;
        }
    }
    // we have to check empty strings, but file name must not be empty
    return 0;
}
