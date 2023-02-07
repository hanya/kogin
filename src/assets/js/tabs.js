
import { Clipboard } from "./clipboard.js";
import { TemplateManager } from "./template_manager.js";
import { initPath } from "./tools.js";
import { PROJECT } from "./project.js";


let isWebkit = false;


class Elements {
    static addDiv(parent, id = null) {
        const div = document.createElement('div');
        if (id) {
            div.id = id;
        }
        parent.appendChild(div);
        return div;
    }

    static addSpan(parent, text) {
        const span = document.createElement('span');
        span.textContent = text;
        parent.appendChild(span);
        return span;
    }

    static addCloseSVG(parent) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('close-icon');
        svg.setAttribute('stroke', 'black');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 18 18');
        svg.setAttribute('height', '18');
        svg.setAttribute('width', '18');
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'm 4.1,13.8 10,-10');
        svg.appendChild(path1);
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'm 4.1,3.8 10,10');
        svg.appendChild(path2);
        parent.appendChild(svg);
        return svg;
    }

    static addRadio(parent, id, name) {
        const radio = document.createElement('input');
        radio.setAttribute('id', id);
        radio.setAttribute('type', 'radio');
        radio.setAttribute('name', name);
        parent.appendChild(radio);
        return radio;
    }

    static addLabel(parent, id, forId) {
        const label = document.createElement('label');
        label.setAttribute('id', id);
        label.classList.add('tab');
        label.setAttribute('for', forId);
        parent.appendChild(label);
        return label;
    }

    static addTab(parent, target, num, title) {
        const div = document.createElement('div');
        //div.draggable = true;
        div.setAttribute('id', `tab-header-${num}`);
        div.setAttribute('title', title);
        div.setAttribute('data-tauri-drag-region', '');
        parent.insertBefore(div, target);
        const input = Elements.addRadio(div, `tab-input-${num}`, 'tabs');
        input.setAttribute('index', num);
        const label = Elements.addLabel(div, `tab-label-${num}`, `tab-input-${num}`);
        label.draggable = true;
        const span = Elements.addSpan(label, title);
        span.setAttribute('id', `tab-title-${num}`);
        span.classList.add('tab-title');
        if (isWebkit) {
            span.classList.add('webkit-vertical-align');
        }
        const close = Elements.addCloseSVG(label);
        return div;
    }

    static addFrame(parent, num) {
        const frame = document.createElement('iframe');
        frame.setAttribute('id', `frame-${num}`);
        frame.classList.add('frame');
        frame.setAttribute('index', num);
        parent.appendChild(frame);
        return frame;
    }

    static clear(parent) {
        while (parent.lastElementChild) {
            parent.lastElementChild.remove();
        }
    }

    static setDisplay(item, state) {
        if (state) {
            item.classList.remove('hidden-item');
        } else {
            item.classList.add('hidden-item');
        }
    }

    static hideIfShown(item) {
        if (!item.classList.contains('hidden-item')) {
            item.classList.add('hidden-item');
            return true;
        }
        return false;
    }
}

class Tabs {
    constructor() {
        this.tabHeaders = document.getElementById('tab-headers');
        this.tabContents = document.getElementById('tab-contents');
        this.newTab = document.getElementById('new-tab');
        this.tabListing = document.getElementById('tab-listing');
        this.tabList = document.getElementById('tab-list');
        this.activeIndex = -1;
        this.tabCount = 0;
        this.tabListing.addEventListener('click', (ev) => {
            if (Elements.hideIfShown(this.tabList)) {
                return;
            }
            Elements.clear(this.tabList);
            for (const tab of this.tabHeaders.querySelectorAll('div[title]')) {
                const title = tab.getAttribute('title');
                const entryDiv = Elements.addDiv(this.tabList);
                entryDiv.textContent = title;
                entryDiv.setAttribute('index', tab.firstElementChild.getAttribute('index'));
                entryDiv.classList.add('tab-list-entry');
                entryDiv.addEventListener('click', (ev) => {
                    Elements.setDisplay(this.tabList, false);
                    const index = ev.target.getAttribute('index');
                    this.activateTab(parseInt(index));
                });
            }
            Elements.setDisplay(this.tabList, true);
        });

        this.dragging = null;
    }

    setAddNewCallback(cbAddNewTab) {
        this.newTab.addEventListener('click', cbAddNewTab);
    }

    setActiveTabChangeCallback(cbActiveTabChanged) {
        this.cbActiveTabChanged = cbActiveTabChanged;
    }

    setTabCloseRequestCallback(cbTabCloseRequest) {
        this.cbTabCloseRequest = cbTabCloseRequest;
    }

    setLastTabClosedCallback(cbLastTabClosed) {
        this.cbLastTabClosed = cbLastTabClosed;
    }

    getFrame(index) {
        return this.tabContents.querySelector(`iframe[index="${index}"]`);
    }

    addTab(index, activate = false) {
        const tab = Elements.addTab(this.tabHeaders, this.newTab, index, '');
        const label = tab.lastElementChild;
        const frame = Elements.addFrame(this.tabContents, index);
        tab.firstElementChild.addEventListener('change', (ev) => {
            if (ev.target.checked) {
                const index = ev.target.getAttribute('index');
                this._activateFrame(index);
                this.cbActiveTabChanged(index);
            }
        });

        // label related
        label.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
        });
        label.addEventListener('mouseup', (ev) => {
            if (ev.button == 1) {
                this.cbTabCloseRequest(index);
                ev.preventDefault();
                ev.stopPropagation();
            }
        });
        // close button
        label.lastElementChild.addEventListener('click', (ev) => {
            this.cbTabCloseRequest(index);
        });
        if (activate) {
            label.click();
        }
        this.tabCount += 1;
        return frame;
    }

    setTitleText(index, text, tooltip) {
        const span = this.tabHeaders.querySelector(`input[index="${index}"] + label > span`);
        if (span) {
            span.textContent = text;
            span.parentNode.parentNode.setAttribute('title', tooltip);
        }
    }

    _findTabDiv(item) {
        while (item && item.tagName != 'DIV') {
            item = item.parentNode;
        }
        return item;
    }

    // 1: tab1 is back, -1: tab1 is behind
    _cmpTabOrder(tab1, tab2) {
        if (tab1 == tab2) {
            return 0;
        }
        let index1 = -1;
        let index2 = -1;
        let n = 0;
        for (const tab of this.tabHeaders.childNodes) {
            if (tab == tab1) {
                index1 = n;
            }
            if (tab == tab2) {
                index2 = n;
            }
            if (index1 != -1 && index2 != -1) {
                break;
            }

            n += 1;
        }
        return index1 > index2 ? 1 : -1;
    }

    activateTab(index) {
        const activeRadio = document.querySelector('input:checked');
        if (activeRadio) {
            if (activeRadio.getAttribute('index') == index) {
                return;
            }
        }
        const label = document.getElementById(`tab-label-${index}`);
        if (label) {
            label.click();
        }
    }

    removeTab(index) {
        const tab = document.getElementById(`tab-header-${index}`);
        let nextTab = tab.previousElementSibling;
        if (!nextTab) {
            nextTab = tab.nextElementSibling;
            if (nextTab.id == 'new-tab') {
                nextTab = null;
            }
        }
        const frame = document.getElementById(`frame-${index}`);
        if (frame) {
            frame.remove();
        }
        if (tab) {
            tab.remove();
        }
        this.tabCount -= 1

        if (nextTab) {
            this.activateTab(nextTab.firstElementChild.getAttribute('index'));
        } else {
            this.cbLastTabClosed();
        }
    }

    _activateFrame(index) {
        // avoid removed frame activated
        if (!this.getFrame(index)) {
            return;
        }
        for (const frame of this.tabContents.childNodes) {
            this._showFrame(frame, frame.getAttribute('index') == index);
        }
        this.activeIndex = index;
    }

    _showFrame(frame, state) {
        if (state) {
            frame.classList.remove('hidden-frame');
            frame.focus();
        } else {
            frame.classList.add('hidden-frame');
        }
    }

    findFrameForWindow(win) {
        for (const frame of this.tabContents.childNodes) {
            if (frame.contentWindow == win) {
                return frame;
            }
        }
        return null;
    }
}

class Documents {
    constructor(tabs) {
        this.index = 1;
        this.tabs = tabs;
        this.clipboard = new Clipboard();
        this.templateManager = new TemplateManager();
        this.templateManager.init();
        tabs.setAddNewCallback(this.cbAddNewTab);
        tabs.setActiveTabChangeCallback(this.cbActiveTabChanged);
        tabs.setTabCloseRequestCallback(this.cbTabCloseRequest);
        tabs.setLastTabClosedCallback(this.cbLastTabClosed);
        this.eventAssigned = false;
    }

    nextIndex() {
        const n = this.index;
        this.index += 1;
        return n.toString();
    }

    currentIndex() {
        return this.index - 1;
    }

    addDefault(activate = true) {
        return this.addNew('./frame.html', activate);
    }

    addNew(url = './frame.html', activate = false, title = null) {
        const index = this.nextIndex();
        const frame = this.tabs.addTab(index, activate);
        frame.setAttribute('src', url);
        if (title) {
            this.tabs.setTitleText(index, title, title);
        }
        return index;
    }

    cbAddNewTab = () => {
        this.addDefault();
    }

    cbActiveTabChanged = (index) => {
    }

    cbTabCloseRequest = (index) => {
        const frame = this.tabs.getFrame(index);
        const app = frame.contentWindow.app;
        if (app) {
            if (app.canClose()) {
                this.tabs.removeTab(index);
            } else {
                this.tabs.activateTab(index);
            }
        } else {
            this.tabs.removeTab(index);
        }
    }

    cbLastTabClosed = () => {
        this.addDefault();
    }

    setTitle(win, title, tooltip) {
        const frame = this.tabs.findFrameForWindow(win);
        if (frame) {
            const index = frame.getAttribute('index');
            this.tabs.setTitleText(index, title, tooltip);
        }
    }

    openURL(url, target = '_blank') {
        this.addNew(url, true);
    }

    openFromData(fileName, data) {
        const index = this.addDefault();
        const frame = this.tabs.getFrame(index);

        const OPEN_DELAY = 200;
        const OPEN_RETRY = 15;
        let n = 0;
        function open() {
            if (frame.contentWindow) {
                if (frame.contentWindow.app) {
                    const app = frame.contentWindow.app;
                    try {
                        app.openData(data, fileName);
                    } catch (error) {
                        console.log(error);
                    }
                } else if (n < OPEN_RETRY) {
                    n += 1;
                    setTimeout(open, OPEN_DELAY);
                }
            } else if (n < OPEN_RETRY) {
                n += 1;
                setTimeout(open, OPEN_DELAY);
            }
        }
        setTimeout(open, 200);
    }

    closeDocument(win) {
        const frame = this.tabs.findFrameForWindow(win);
        if (frame) {
            const index = frame.getAttribute('index');
            this.tabs.removeTab(index);
        }
    }

    parentCommand(cmd) {
        if (cmd == 'about') {
            this.cmd_about();
        }
    }

    cmd_about() {
        const dialog = document.getElementById('tabs-about-dialog');
        dialog.classList.remove('hidden-item');
        document.getElementById('project-url').href = PROJECT.URL;
        if (!this.eventAssigned) {
            document.getElementById('about-close-tool').addEventListener('click', this.hideItem);
            document.getElementById('about-license-ext-tool').addEventListener('click', this.openLicense);
            document.getElementById('about-license-kogin-tool').addEventListener('click', this.openLicense);
            document.getElementById('about-license-rust-tool').addEventListener('click', this.openLicense);
            this.eventAssigned = false;
        }
    }

    hideItem = (ev) => {
        const id = ev.target.getAttribute('target');
        document.getElementById(id).classList.add('hidden-item');
        ev.target.removeEventListener('click', this.hideItem);
    }

    openLicense = (ev) => {
        const target = ev.target.getAttribute('target');
        this.addNew(target, true, target.replace('.html', ''));
        ev.target.removeEventListener('click', this.openLicense);
        document.getElementById('about-close-tool').click();
    }
}

function print_string(s) {
    window.__TAURI__.invoke('print_string',
        { text: s }
    ).then(() => {}).catch(() => {});
}

window.onload = function () {
    if (window.__TAURI__) {
        isWebkit = window.__TAURI__.path.sep == '/';
        initPath();

        window.__TAURI__.event.listen("tauri://file-drop", (ev) => {
            for (const item of ev.payload) {
                openFromPath(item, false, true);
            }
        });
    }

    function init() {
        const tabs = new Tabs();
        const documents = new Documents(tabs);
        window.docs = documents;
    }

    function openFromPath(path, openIfFail = false, alertIfFail = false) {
        if (!path.endsWith('.svg')) {

        }
        window.__TAURI__.invoke('file_read',
            { name: path }
        ).then((data) => {
            window.docs.openFromData(path, data);
        }).catch((e) => {
            if (alertIfFail) {
                window.__TAURI__.dialog.message(`File not found: ${path}`,
                    { title: 'error', type: 'error'}
                );
            } else {
                print_string(`File not found: ${path}`);
                if (openIfFail) {
                    window.docs.addDefault();
                }
            }
        });
    }

    if (window.__TAURI__) {
        let openPath = null;
        window.__TAURI__.cli.getMatches().then((matches) => {
            if (matches.subcommand && matches.subcommand.name == 'open') {
                const path = matches.subcommand.matches.args.path;
                if (path && path.value) {
                    openPath = path.value;
                }
            }

            init();

            if (openPath && openPath.endsWith('.svg')) {
                openFromPath(openPath, true);
            } else {
                window.docs.addDefault();
            }

        }).catch((e) => {
            console.log(e);
        });
    } else {
        init();
        window.docs.addDefault();
    }
}
