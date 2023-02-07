
import { Sashi } from "./sashi.js";
import { Preview } from "./preview.js";
import { Reader } from "./filter.js";
import {
    jszipLoader, startDownloadForBlob,
    getDate, startDownloadURL, startDownloadForData, openSome
} from './tools.js';
import { ToolManager } from "./tool.js";
import { viewModeOverWarp } from './mode.js';
import { View } from "./view.js";
import { ElementTool } from './elements.js';
import { Normalizer } from "./normalize.js";

let isWebkit = false;
if (window.parent && window.parent.__TAURI__) {
    isWebkit = window.parent.__TAURI__.path.sep == '/';
}


const SIZE_PREVIEW = 300;
const SIZE_SMALL = 350;
const SIZE_MEDIUM = 550;
const SIZE_LARGE = 750;
const MARGIN = 5;
const TEMPLATE_SIZE = {
    'small': SIZE_SMALL, 'medium': SIZE_MEDIUM, 'large': SIZE_LARGE,
    'preview': SIZE_PREVIEW,
};

/**
 * Returns size specified in numeric.
 *
 * @param {string} size Size in string.
 * @returns {number} Size value.
 */
export function getTemplateSize(size) {
    const value = TEMPLATE_SIZE[size];
    return value ? value : SIZE_SMALL;
}

export function toKey(key) {
    const intKey = parseInt(key, 10);
    return Number.isNaN(intKey) ? key : intKey;
}


export class TemplateElements {
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

    static addSelector(parent, id) {
        const selector = document.createElement('select');
        if (id) {
            selector.id = id;
        }
        parent.appendChild(selector);
        return selector;
    }

    static createOption(text) {
        const option = document.createElement('option');
        option.textContent = text;
        return option;
    }

    /// Adds dropdown arrow.
    static addArrowSVG(parent) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('os-svg-icon');
        svg.classList.add('os-icon-xsmall');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 7 6');
        svg.setAttribute('height', '6');
        svg.setAttribute('width', '7');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'm 0.5,0 a 0.5,0.5 0 0 0 -0.4,0.8 l 3,5 a 0.5,0.5 0 0 0 0.9,0 l 3,-5 A 0.5,0.5 0 1 0 6.1,0.2 L 3.5,4.5 0.9,0.2 a 0.5,0.5 0 0 0 -0.5,-0.2 z');
        svg.appendChild(path);
        parent.appendChild(svg);
        return svg;
    }

    /// Adds folder icon.
    static addFolderSVG(parent) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('os-svg-icon');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 2 20 20');
        svg.setAttribute('height', '18');
        svg.setAttribute('width', '20');
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M 1.5,8 A 0.5,0.5 0 0 0 1,8.5 v 9 A 0.5,0.5 0 0 0 1.5,18 h 16 A 0.5,0.5 0 0 0 18,17.5 v -9 A 0.5,0.5 0 0 0 17.5,8 Z M 2,9 h 15 v 8 H 2 Z');
        svg.appendChild(path1);
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'M 2.5,2 A 0.5,0.5 0 0 0 2,2.4 L 1,8.2 a 0.5,0.5 0 1 0 1,0.2 L 2.9,3 H 8.1 L 9,5.7 A 0.5,0.5 0 0 0 9.5,6 H 17 l 0,2.3 a 0.5,0.5 0 1 0 1,0 L 18,5.5 A 0.5,0.5 0 0 0 17.5,5 H 9.9 L 9,2.3 A 0.5,0.5 0 0 0 8.5,2 Z');
        svg.appendChild(path2);
        parent.appendChild(svg);
        return svg;
    }

    static calculateZoomValue(bbox, canvasSize, gridManager) {
        const leftTop = gridManager.gridToPoint(bbox[0], bbox[1]);
        const rightBottom = gridManager.gridToPoint(bbox[0] + bbox[2] - 1 + 2, bbox[1] + bbox[3] - 1 + 2);
        const widthOnCanvas = rightBottom.x - leftTop.x;
        const heightOnCanvas = rightBottom.y - leftTop.y;
        const sizeOnCanvas = Math.max(widthOnCanvas, heightOnCanvas);
        const contentsSize = canvasSize - MARGIN * 2;

        return contentsSize < sizeOnCanvas ? contentsSize / sizeOnCanvas : 1;
    }

    /// Loads template from data into new preview.
    static loadFromData(locationId, key, name, data, canvasSize, sashi) {
        const gridManager = sashi.gridManager;
        // todo, error listener, to remove problematic item
        const reader = new Reader(sashi, true, true); // as template, no reading settings
        let template = null;
        try {
            template = reader.read(data);
            sashi.template = template;
        } catch (e) {
            console.log(e);
            return null;
        }
        // update title
        const titleItem = sashi.canvas.parentNode.querySelector('span.template-title');
        if (titleItem) {
            titleItem.textContent = sashi.metadata.title;
        }
        const titleEnItem = sashi.canvas.parentNode.querySelector('span.template-title-en');
        if (titleEnItem) {
            titleEnItem.textContent = sashi.metadata['title-en'];
        }

        if (template) {
            // left, top, width, height
            const bbox = template.bbox;
            let width = bbox[2];
            let height = bbox[3];

            let gridHoriCount = SIZE_LARGE / sashi.viewGrid.gridWidth + 10;
            let gridVertCount = SIZE_LARGE / sashi.viewGrid.gridHeight + 10;

            const zoomValue = TemplateElements.calculateZoomValue(bbox, canvasSize, gridManager);
            if (zoomValue != 1) {
                sashi.project.view.zoom = zoomValue;
                gridHoriCount /= zoomValue;
                gridVertCount /= zoomValue;
            }
            gridHoriCount = Math.floor(gridHoriCount);
            gridVertCount = Math.floor(gridVertCount);
            sashi.viewGrid.horiCount = gridHoriCount;
            sashi.viewGrid.vertCount = gridVertCount;
            gridManager.setGridCount(gridHoriCount, gridVertCount);

            const viewMode = sashi.stitchManager.viewMode;
            const centerX = bbox[0] + width / 2 + (viewMode == viewModeOverWarp ? 0.5 : 0);
            const centerY = bbox[1] + height / 2 + 0.5;
            const centerPoint = gridManager.gridToPoint(centerX, centerY);
            sashi.project.view.center = centerPoint;

            sashi.view.prepareGrid();
            sashi.view.gridShow(true);

            const gridShift = gridManager.gridToPoint(
                bbox[0] - Math.floor((gridHoriCount - width) / 2),
                bbox[1] - Math.floor((gridVertCount - height) / 2)
            );
            sashi.layerManager.getUpperGridLayer().translate(gridShift);
            sashi.layerManager.getLowerGridLayer().translate(gridShift);
            sashi.project.view.update();
            return sashi;
        }
        return null;
    }

    /// Makes internal object for preview of template.
    static makeTemplateObject(canvas, viewMode, baseModel = null) {
        const sashi = new Sashi(canvas, false, baseModel);
        sashi.stitchManager.setViewMode(viewMode);
        const view = new Preview(sashi, sashi.viewOption);
        sashi.setView(view);
        return sashi;
    }

    /// Returns class name for specified size of template.
    static sizeCSS(size) {
        switch (size) {
            case SIZE_PREVIEW: return 'template-size-preview';
            case SIZE_SMALL: return 'template-size-small';
            case SIZE_MEDIUM: return 'template-size-medium';
            case SIZE_LARGE: return 'template-size-large';
            default: return 'template-size-small';
        }
    }

    static entryId(locationId, key) {
        return `${locationId}-${key}-entry`;
    }

    static makeTemplateElementBase(locationId, key, size, folder) {
        const outer = document.createElement('div');
        outer.id = TemplateElements.entryId(locationId, key);
        outer.setAttribute('locationid', locationId);
        outer.setAttribute('key', key);
        outer.setAttribute('folder', folder);
        outer.classList.add('template');
        outer.classList.add(TemplateElements.sizeCSS(size));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.classList.add('template-canvas');
        outer.appendChild(canvas);
        return outer;
    }

    static makeTemplateTitle(outer, locationId, key, name, title = '', title_en = '') {
        const nameItem = TemplateElements.addSpan(outer, name);
        nameItem.classList.add('template-overitem');
        nameItem.classList.add('template-file-name');
        const titleItem = TemplateElements.addSpan(outer, title);
        titleItem.classList.add('template-overitem');
        titleItem.classList.add('template-title');
        const titileEnItem = TemplateElements.addSpan(outer, title_en);
        titileEnItem.classList.add('template-overitem');
        titileEnItem.classList.add('template-title-en');
    }

    static addCanvas(parent, id) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('id', id);
        parent.appendChild(canvas);
        return canvas;
    }
}

class TabOrder {
    constructor(view, templatesSetting) {
        this.view = view;
        this.tabOrder = templatesSetting.tabOrder;
        this.templatesSetting = templatesSetting;
    }

    store() {
        this.view.sashi.storeTemplateSettingsPart(this.templatesSetting, ['tabOrder']);
    }

    move(id, direction) {
        const index = this.tabOrder.findIndex((element) => element == id);
        if (index >= 0) {
            if (direction == 'left') {
                this.tabOrder.splice(index, 1);
                this.tabOrder.splice(index - 1, 0, id);
            } else if (direction == 'right') {
                this.tabOrder.splice(index, 1);
                this.tabOrder.splice(index + 1, 0, id);
            }
            this.store();
        }
    }

    get(index) {
        return this.tabOrder[index];
    }

    add(id, noStore = false) {
        const index = this.tabOrder.indexOf(id, (element) => element == id);
        if (index < 0) {
            this.tabOrder.push(id);
            if (!noStore) {
                this.store();
            }
        }
    }

    remove(id) {
        const index = this.tabOrder.indexOf(id, (element) => element == id);
        if (index >= 0) {
            this.tabOrder.splice(index, 1);
            this.store();
        }
        return index;
    }

    removeAll() {
        this.tabOrder.splice(0);
    }

    preserve() {
        this.preserved = [];
        for (const v of this.tabOrder) {
            this.preserved.push(v);
        }
    }

    rollback() {
        if (this.preserved) {
            this.removeAll();
            for (const v of this.preserved) {
                this.tabOrder.push(v);
            }
            this.preserved = null;
        }
    }
}

class Folder {
    constructor(key, outer, scroller) {
        this.key = key;
        this.outer = outer;
        this.container = outer.lastElementChild;
        this.scroller = scroller;
    }

    hasEntries() {
        return this.container.childNodes.length > 0;
    }

    add(item) {
        this.container.appendChild(item);
    }

    show(state) {
        if (state) {
            this.outer.classList.remove('is-no-display');
        } else {
            this.outer.classList.add('is-no-display');
        }
    }

    query(q) {
        return this.container.querySelector(q);
    }

    getEntries() {
        return this.container.childNodes;
    }

    removeOwn() {
        this.outer.parentNode.remove();
    }

    clear() {
        const container = this.container;
        while (container.lastElementChild) {
            container.lastElementChild.remove();
        }
    }

    clearFilter() {
        for (const entry of this.container.childNodes) {
            entry.classList.remove('is-no-display');
        }
    }

    filter(text) {
        for (const entry of this.container.childNodes) {
            let matched = false;
            for (const span of entry.childNodes) {
                if (span.tagName == 'SPAN') {
                    if (span.textContent.indexOf(text) >= 0) {
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) {
                entry.classList.remove('is-no-display');
            } else {
                entry.classList.add('is-no-display');
            }
        }
    }

    resizeScroller(width, height) {
        this.container.style.height = height + 'px';
        this.scroller.resize(width, height);
        this.scroller.setUpdateRequest();
    }
}

// div: contents
//   - div: subfolder
//   - div: folders
//     - div: container
class Tab {
    constructor(locationId, header, contents) {
        this.header = header;
        this.contents = contents;
        this.selector = document.getElementById(`${locationId}-subfolder-selector`);
        this.folders = new Map();
        this.filterString = '';
    }

    removeOwn() {
        this.header.remove();
        this.contents.remove();
    }

    clear() {
        // remove all folders except '/'
        for (const [key, folder] of this.folders.entries()) {
            if (key != '/') {
                this.folders.delete(key);
                folder.removeOwn();
            } else {
                folder.clear();
            }
        }
        // clear selector
        for (const option of this.selector.childNodes) {
            if (option.textContent != '/') {
                option.remove();
            }
        }
        this.selector.selectedIndex = 0;
    }

    addFolder(key, folder) {
        this.folders.set(key, folder);
    }

    removeFolder(key) {
        this.folders.delete(key);
    }

    addToFolder(folder, item) {
        const f = this.folders.get(folder);
        if (f) {
            f.add(item);
            return true;
        }
        return false;
    }

    showFolder(key) {
        for (const [entryKey, folder] of this.folders.entries()) {
            folder.show(entryKey == key);
        }
    }

    getActiveFolderName() {
        if (this.selector.selectedOptions.length > 0) {
            return this.selector.selectedOptions[0].textContent;
        }
        return '/';
    }

    getActiveFolder() {
        const name = this.getActiveFolderName();
        return this.folders.get(name);
    }

    getActiveFolderContent() {
        const folder = this.getActiveFolder();
        if (folder) {
            return folder.getEntries();
        }
        return [];
    }

    workWithActiveFolder(fn) {
        const folder = this.getActiveFolder();
        if (folder) {
            return fn(folder);
        }
        return null;
    }

    queryFromActiveFolder(q) {
        return this.workWithActiveFolder((folder) => folder.query(q));
    }

    findEntryByNameFromActiveFolder(name) {
        return this.workWithActiveFolder((folder) => {
            for (const item of folder.getEntries()) {
                if (item.firstElementChild.nextElementSibling.textContent == name) {
                    return item;
                }
            }
            return null;
        });
    }

    _removeFromSelector(key) {
        for (const option of this.selector.childNodes) {
            if (option.textContent == key) {
                option.remove();
            }
        }
    }

    removeActiveFolder() {
        this.workWithActiveFolder((folder) => {
            const key = folder.key;
            this.removeFolder(key);
            this._removeFromSelector(key);
            folder.removeOwn();
        });
    }

    setFilter(text, update = false) {
        this.fitlerString = text;
        if (update) {
            if (text == '') {
                for (const folder of this.folders.values()) {
                    folder.clearFilter(text);
                }
            } else {
                for (const folder of this.folders.values()) {
                    folder.filter(text);
                }
            }
        }
    }

    updateScroller() {
        for (const folder of this.folders.values()) {
            folder.scroller.update();
        }
    }

    updateScrollerIfRequired() {
        for (const folder of this.folders.values()) {
            folder.scroller.updateIfRequired();
        }
    }

    resizeScrollers(width, height) {
        for (const folder of this.folders.values()) {
            folder.resizeScroller(width, height);
        }
    }

    requestUpdate(folderKey) {
        const folder = this.folders.get(folderKey);
        if (folder) {
            folder.scroller.updateTimeout();
        }
    }

    folderLoaded(folderKey) {
        const folder = this.folders.get(folderKey);
        if (folder) {
            return folder.hasEntries();
        } else {
            return false;
        }
    }
}

/**
 * Manages tabs.
 */
class TabManager {
    /**
     * Constructor.
     *
     * @param {View} view View instance.
     * @param {Object} templatesSetting Settings about templates.
     */
    constructor(view, templatesSetting) {
        this.activeTabIdChanged = false;
        this.templatesSetting = templatesSetting;
        this.tabOrder = new TabOrder(view, templatesSetting);
        this.view = view;
        this.tabs = new Map(); // locationId: Tab
    }

    storeSettings() {
        if (this.activeTabIdChanged) {
            this.view.sashi.storeTemplateSettings();
            this.activeTabIdChanged = false;
        }
    }

    storeActiveTabId() {
        if (this.activeTabIdChanged) {
            this.view.sashi.storeTemplateSettingsPart(this.templatesSetting, ['activeTabId']);
            this.activeTabIdChanged = false;
        }
    }

    updateTimestamp() {
        this.templatesSetting.timestamp = Date.now();
    }

    setTabChangedEventListener(fn) {
        this.tabChangedListener = fn;
    }

    setFolderClickEventListener(fn) {
        this.folderClickListener = fn;
    }

    setTabHeaderArrowClickEventListener(fn) {
        this.tabHeaderArrowClickListener = fn;
    }

    setFolderChangeListener(fn) {
        this.folderChangeListener = fn;
    }

    setFolderArrowClickEventListener(fn) {
        this.folderArrowClickListener = fn;
    }

    removeAllTabs() {
        this.tabOrder.removeAll();
        this.tabChanged = true;
        this.setActiveTabId(0);
        const tabContents = document.getElementById('templates-tab-contents');
        while (tabContents.lastElementChild) {
            tabContents.lastElementChild.remove();
        }
        const tabHeaders = this.getTabHeaders();
        while (tabHeaders.lastElementChild) {
            tabHeaders.lastElementChild.remove();
        }
    }

    getTab(locationId) {
        return this.tabs.get(locationId);
    }

    _removeTab(locationId) {
        return this.tabs.delete(locationId);
    }

    hasTab() {
        return this.getCount() > 0;
    }

    getCount() {
        return this.getTabHeaders().childNodes.length;
    }

    getTabOrder() {
        return this.tabOrder.tabOrder;
    }

    getActiveTabId() {
        return this.templatesSetting.activeTabId;
    }

    setActiveTabId(id, noEvent = false) {
        this.templatesSetting.activeTabId = id;
        this.activeTabIdChanged = true;
        if (!noEvent) {
            this.tabChangedListener(id);
        }
    }

    getTabIdByIndex(index) {
        return this.tabOrder.get(index);
    }

    getFirstTabId() {
        const child = this.getTabHeaders().firstElementChild;
        return child ? this.getTabId(child) : null;
    }

    makeTabActive(id) {
        const tabHeader = this.getTabHeader(id);
        if (tabHeader) {
            // click input element to activate tab
            tabHeader.firstChild.firstChild.click();
        }
    }

    getTabId(entry) {
        return parseInt(entry.getAttribute('locationid'), 10);
    }

    _contentsId(locationId) {
        return `${locationId}-contents`;
    }

    _containerId(locationId, key) {
        return `${locationId}-${key}-container`;
    }

    _subfolderSelectorId(locationId) {
        return `${locationId}-subfolder-selector`;
    }

    _subfolderId(locationId, key) {
        return `${locationId}-${key}-subfolder`;
    }

    _subfolderArrow(locationId) {
        return `${locationId}-subfolder-arrow`;
    }

    _tabHeadersId() {
        return `templates-tab-headers`;
    }

    _tabNameId(locationId) {
        return `${locationId}-tab-name`;
    }

    _tabHeaderId(locationId) {
        return `${locationId}-header`;
    }

    _subfolderHeaderId(locationId) {
        return `${locationId}-subfolder-header`;
    }

    _getTabName(locationId) {
        return document.getElementById(this._tabNameId(locationId));
    }

    _getTab(locationId) {
        return document.getElementById(this._tabHeaderId(locationId));
    }

    getTabHeader(id) {
        const tabHeaderId = this._tabHeaderId(id);
        return document.getElementById(tabHeaderId);
    }

    getTabHeaders() {
        return document.getElementById(this._tabHeadersId());
    }

    getContainer(id, key) {
        return document.getElementById(this._containerId(id, key));
    }

    queryFromTab(id, q) {
        const tab = this.getTab(id);
        if (tab) {

        }
    }

    getSubfolderSelector(locationId) {
        return document.getElementById(this._subfolderSelectorId(locationId));
    }

    getFolderSelectorPart(locationId) {
        return document.getElementById(this._subfolderHeaderId(locationId));
    }

    setTabName(id, name) {
        const element = this._getTabName(id);
        if (element) {
            element.textContent = name;
        }
    }

    addToFolder(id, folder, item) {
        const tab = this.getTab(id);
        if (tab) {
            return tab.addToFolder(folder, item);
        }
        return false;
    }

    showFolder(id, folder) {
        const tab = this.getTab(id);
        if (tab) {
            tab.showFolder(folder);
        }
    }

    /// Event when tab changed.
    tabChangedEvent(id) {
        this.setActiveTabId(id);
    }

    getActiveTabContents() {
        const container = this.getContainer(this.getActiveTabId());
        if (container) {
            return container.childNodes;
        } else {
            return [];
        }
    }

    clearTabContents(id) {
        const tab = this.getTab(id);
        if (tab) {
            tab.clear();
        }
    }

    moveTab(id, direction) {
        const tabHeader = this._getTab(id);
        const headers = this.getTabHeaders();
        if (direction == 'left') {
            if (headers.firstElementChild != tabHeader) {
                const prevElement = tabHeader.previousElementSibling;
                tabHeader.remove();
                prevElement.before(tabHeader);
                this.tabOrder.move(id, direction);
            }
        } else if (direction == 'right') {
            if (headers.lastElementChild != tabHeader) {
                const nextElement = tabHeader.nextElementSibling;
                tabHeader.remove();
                nextElement.after(tabHeader);
                this.tabOrder.move(id, direction);
            }
        }
    }

    removeTab(id) {
        const tab = this._removeTab(id);
        if (tab) {
            tab.removeOwn();
        }

        const index = this.tabOrder.remove(id);
        const activeIndex = index <= 0 ? 0 : index - 1;
        const activeId = this.getTabIdByIndex(activeIndex);
        if (activeId) {
            this.makeTabActive(activeId);
        } else {
            this.makeTabActive(0);
            this.setActiveTabId(0);
        }
    }

    tabExists(id) {
        return !!this._getTab(id);
    }

    fillFolderList(locationId, subfolders, folder) {
        const selector = document.getElementById(this._subfolderSelectorId(locationId));
        while (selector.lastElementChild) {
            selector.lastElementChild.remove();
        }
        let folderIndex = 0;
        let n = 0;
        for (const subfolder of subfolders) {
            const option = TemplateElements.createOption(subfolder);
            selector.add(option);
            if (subfolder == folder) {
                folderIndex = n;
            }
            n += 1;
        }
        selector.selectedIndex = folderIndex;

        this.showFolderSelector(locationId, subfolders.length > 1);
    }

    addFolder(locationId, folderPath, index) {
        const option = TemplateElements.createOption(folderPath);
        const selector = document.getElementById(this._subfolderSelectorId(locationId));
        selector.add(option, selector.options[index]);

        //selector.selectedIndex = index;
        // todo, switch to subfolder?
        this.showFolderSelector(locationId, true);
    }

    renameFolder(locationId, index, newPath) {
        const selector = document.getElementById(this._subfolderSelectorId(locationId));
        const option = selector.item(index);
        if (option) {
            option.textContent = newPath;

            this.folderChangeListener(locationId);
        }
    }

    removeFolder(locationId, index) {
        const selector = document.getElementById(this._subfolderSelectorId(locationId));
        const option = selector.item(index);
        if (option) {
            option.remove();

            selector.selectedIndex = 0;
            if (selector.options.length <= 1) {
                this.showFolderSelector(locationId, false);
            }
            this.folderChangeListener(locationId);
        }
    }

    getCurrentFolder(locationId) {
        const selector = this.getSubfolderSelector(locationId);
        if (selector && selector.selectedOptions.length > 0) {
            return selector.selectedOptions[0].textContent;
        }
        return '/';
    }

    clearFolderSelector(locationId) {
        const selector = this.getSubfolderSelector(locationId);
        while (selector.lastElementChild) {
            selector.lastElementChild.remove();
        }
    }

    showFolderSelector(locationId, state) {
        const div = this.getFolderSelectorPart(locationId);
        if (state) {
            div.classList.remove('is-no-display');
        } else {
            div.classList.add('is-no-display');
        }
    }

    updateScroller(locationId, ifRequired = false) {
        const tab = this.getTab(locationId);
        if (tab) {
            if (ifRequired) {
                tab.updateScrollerIfRequired();
            } else {
                tab.updateScroller();
            }
        }
    }

    updateContainers() {
        let [width, height] = this.view.toolManager.getTemplatesContainerSize();
        const contents = document.getElementById('templates-tab-contents');

        for (const tab of this.tabs.values()) {
            tab.resizeScrollers(width, height);
            tab.updateScroller();
        }
    }

    hideFolderArrow(locationId) {
        const arrow = document.getElementById(this._subfolderArrow(locationId));
        if (arrow) {
            arrow.classList.add('is-hidden');
        }
    }

    addFolderToTab(locationId, key) {
        const tab = this.tabs.get(locationId);
        if (tab) {
            const folder = this.makeFolder(locationId, key, tab.contents,
                this.view.sashi.viewOption.autoScrollOnTemplates);
            tab.addFolder(key, folder);
        }
    }

    _addTab(locationId, tab) {
        this.tabs.set(locationId, tab);
    }

    /// Makes new tab for location.
    addTab(locationId, type, name, noStore = false) {
        this.tabOrder.add(locationId, noStore);
        const tabHeader = this.makeTabHeader(locationId, name, type == 'local');
        const tabContents = this.makeTabContainer(locationId);
        const tab = new Tab(locationId, tabHeader, tabContents);
        this._addTab(locationId, tab);
        this.addFolderToTab(locationId, '/');
    }

    /// Makes header part of tab.
    makeTabHeader(locationId, name, isLocal = false) {
        const parent = this.getTabHeaders();
        const outer = TemplateElements.addDiv(parent, this._tabHeaderId(locationId));
        outer.setAttribute('locationId', locationId);
        this.addTabHeaderInput(outer, locationId, name, isLocal);
        return outer;
    }

    /// Adds input part of tab header.
    addTabHeaderInput(parent, locationId, name, isLocal = false) {
        const outer = TemplateElements.addDiv(parent, locationId + '-tab');
        outer.classList.add('templates-tab-outer');
        const input = document.createElement('input');
        input.type = 'radio';
        input.id = locationId + '-input';
        input.name = 'templates-tab';

        outer.appendChild(input);
        const label = document.createElement('label');
        label.classList.add('templates-tab');
        label.setAttribute('for', locationId + '-input');
        const nameSpan = TemplateElements.addSpan(label, name);
        nameSpan.id = this._tabNameId(locationId);
        /* nameSpan.classList.add('tab-name'); */
        if (isWebkit) {
            nameSpan.classList.add('webkit-vertical-align');
        }

        if (isLocal) {
            const folderSpan = TemplateElements.addSpan(label, '');
            folderSpan.classList.add('is-button');
            folderSpan.classList.add('tab-dropdown');
            if (isWebkit) {
                folderSpan.classList.add('webkit-vertical-align');
            }
            TemplateElements.addFolderSVG(folderSpan);
            // load from local, folder icon
            folderSpan.addEventListener('click', (ev) => {
                if (this.folderClickListener) {
                    this.folderClickListener(locationId);
                }
            });
        }
        const arrowSpan = TemplateElements.addSpan(label, '');
        TemplateElements.addArrowSVG(arrowSpan);
        arrowSpan.classList.add('is-button');
        arrowSpan.classList.add('tab-dropdown');
        if (isWebkit) {
            arrowSpan.classList.add('webkit-vertical-align');
        }
        // dropdown menu
        arrowSpan.addEventListener('click', (ev) => {
            if (this.tabHeaderArrowClickListener) {
                this.tabHeaderArrowClickListener(ev);
            }
        });

        outer.appendChild(label);

        const contentsId = locationId + '-contents';
        // change of active tab
        input.addEventListener('change', (ev) => {
            const list = document.getElementById('templates-tab-contents');
            for (const item of list.childNodes) {
                if (item.id == contentsId) {
                    item.classList.add('templates-tab-show');
                } else {
                    item.classList.remove('templates-tab-show');
                }
            }
            this.tabChangedEvent(locationId);
        });
        return outer;
    }

    makeFolder(locationId, key, parent, enableScroll) {
        const folder = TemplateElements.addDiv(parent, this._subfolderId(locationId, key));
        folder.classList.add('folders');

        const scrollerOuter = TemplateElements.addDiv(folder, `${locationId}-scroller-outer`);
        scrollerOuter.classList.add('scroller-outer');
        const canvas = TemplateElements.addCanvas(scrollerOuter, `${locationId}-scroller`);
        canvas.classList.add('scroller-canvas');
        const scrollerWindow = TemplateElements.addCanvas(scrollerOuter, `${locationId}-scroller-window`);
        scrollerWindow.classList.add('scroller-window');
        scrollerWindow.classList.add('is-no-display');

        const container = TemplateElements.addDiv(folder, this._containerId(locationId, key));
        container.classList.add('templates-container');
        const [width, height] = this.view.toolManager.getTemplatesContainerSize();
        container.style.height = height.toString() + 'px';

        scrollerOuter.style.height = height.toString() + 'px';

        const scroller = new Scroller(this.view, locationId, container, canvas, scrollerWindow);

        if (enableScroll) {
            function showScrollMark(state, ev) {
                const mark = document.getElementById('scroll-mark');
                if (mark) {
                    if (state) {
                        mark.style.top = ev.clientY - 32 + 'px';
                        mark.style.left = ev.clientX - 32 + 'px';
                        mark.classList.remove('is-no-display');
                    } else {
                        mark.classList.add('is-no-display');
                    }
                }
            }
            let startY = null;
            let yDiff = 0;
            let timerId = null;
            const SCROLL_INTERVAL = 15;
            const cancelDragScroll = (ev) => {
                clearInterval(timerId);
                startY = null;
                window.removeEventListener('mousedown', cancelDragScroll);
                window.removeEventListener('mousemove', mouseMove);
                showScrollMark(false);
                ev.preventDefault();
                ev.stopPropagation();
            };
            const scroll = () => {
                const movement = yDiff / 6;
                if ((movement < 0 && container.scrollTop > 0) ||
                    (movement > 0 && (Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) > 1))) {
                    container.scrollTo(0, container.scrollTop + movement);
                }
            };
            const mouseMove = (ev) => {
                if (!startY) {
                    startY = ev.clientY;
                    timerId = setInterval(scroll, SCROLL_INTERVAL);
                    return;
                }
                yDiff = ev.clientY - startY;
            };
            container.addEventListener('mousedown', (ev) => {
                if (!startY && ev.button == 1) {
                    if (container.scrollHeight - container.clientHeight > 0) {
                        window.addEventListener('mousedown', cancelDragScroll);
                        window.addEventListener('mousemove', mouseMove);
                        showScrollMark(true, ev);
                        ev.stopPropagation();
                        ev.preventDefault();
                    }
                }
            });
        }

        const wrapper = new Folder(key, folder, scroller);
        return wrapper;
    }

    /// Makes container part of tab.
    makeTabContainer(locationId, enableScroll = false) {
        const parent = document.getElementById('templates-tab-contents');
        const contents = TemplateElements.addDiv(parent, this._contentsId(locationId));
        contents.classList.add('templates-contents');
        const subfolder = TemplateElements.addDiv(contents, this._subfolderHeaderId(locationId));
        subfolder.classList.add('templates-subfolder');
        subfolder.classList.add('is-no-display');
        const label = TemplateElements.addSpan(subfolder, this.view.toolManager.translate('Folder'));
        label.classList.add('templates-subfolder-label');
        const selector = TemplateElements.addSelector(subfolder, this._subfolderSelectorId(locationId));
        selector.addEventListener('change', (ev) => {
            this.folderChangeListener(locationId);
        });
        const arrowSpan = TemplateElements.addSpan(subfolder);
        arrowSpan.id = this._subfolderArrow(locationId);
        arrowSpan.classList.add('folder-dropdown');
        const arrow = TemplateElements.addArrowSVG(arrowSpan);
        arrowSpan.addEventListener('click', this.folderArrowClickListener);

        return contents;
    }
}

class FileLoadManager {
    constructor(window, storage, requestOp, entries, fps) {
        this.window = window;
        this.storage = storage;
        this.requestOp = requestOp;
        this.fps = fps;

        const array = [];
        for (const entry of entries) {
            array.push([entry.name, entry.key]);
        }
        this.entries = new Map(array);
        this.index = 0;
        this.overwriteAll = false;
    }

    cancel() {
        this.index = this.fps.length;
        this.window.overwriteManager = null;
    }

    toNext() {
        this.index += 1;
        this.run();
    }

    setOverwriteAll() {
        this.overwriteAll = true;
        this.run();
    }

    run(overwrite = false) {
        for (; this.index < this.fps.length;) {
            const fp = this.fps.item(this.index);
            const key = this.entries.get(fp.name);
            if (key) {
                if (this.overwriteAll || overwrite) {
                    fp.text().then((data) => {
                        this.storage.updateEntry(
                            this.requestOp, key, fp.name, data, {}, this.window.itemReloaded
                        );
                    });
                    this.index += 1;
                } else {
                    this.window.view.toolManager.showOverwriteDialog('overwrite-dialog', fp.name);
                    break;
                }
            } else {
                fp.text().then((data) => {
                    this.storage.addEntry(
                        this.requestOp, fp.name, data, {}, this.window.dataLoaded);
                });
                this.index += 1;
            }
        }
        if (this.index >= this.fps.length) {
            this.cancel();
        }
    }
}

class Scroller {
    constructor(view, locationId, container, canvas, scrollerWindow) {
        this.needsUpdate = false;
        this.view = view;
        this.locationId = locationId;
        this.container = container;
        this.outer = canvas.parentNode;
        this.canvas = canvas;
        this.window = scrollerWindow;
        this.timeoutID = null;
        this.dragStarted = false;
        this.mouseLeave = false;
        this.startY = 0;
        this.canvasY = 0;
        this.outerHeight = this.outer.offsetHeight;
        this.totalHeight = 0;
        this.windowHeight = 0;
        this.windowY = 0;
        this.windowMaxY = 0;
        this.window.style.top = this.windowY + 'px';
        this.container.addEventListener('scroll', (ev) => {
            const y = this._calculateWindowY();
            this._setWindowY(y, false);
        });
        this.outer.addEventListener('mouseenter', (ev) => {
            this.window.classList.remove('is-no-display');
            this.mouseLeave = false;
        });
        this.outer.addEventListener('mouseleave', (ev) => {
            if (!this.dragStarted) {
                this.window.classList.add('is-no-display');
            } else {
                this.mouseLeave = true;
            }
        });
        this.outer.addEventListener('mousedown', (ev) => {
            let y = ev.offsetY;
            if (y > this.windowY && y < this.windowY + this.windowHeight) {
            } else {
                const diff = y - this.windowY;
                const n = diff > this.totalHeight / 4 ? 5 : 1;
                this._setWindowY(this.windowY + Math.floor(diff / n));
            }
        });
        this.window.addEventListener('mousedown', (ev) => {
            this.dragStarted = true;
            this.startY = null;
            ev.stopPropagation();
            window.addEventListener('mousemove', mouseMove);
            window.addEventListener('mouseup', mouseUp);
        });
        const mouseUp = (ev) => {
            this.dragStarted = false;
            window.removeEventListener('mousemove', mouseMove);
            if (this.mouseLeave) {
                this.window.classList.add('is-no-display');
            }
        };
        const mouseMove = (ev) => {
            let y = ev.clientY;
            y = y < 0 ? 0 : y;
            if (!this.startY) {
                this.startY = y;
            }
            const diff = y - this.startY;
            this.startY = y;

            this._setWindowY(this.windowY + diff);

            ev.stopPropagation();
        };
    }

    _calculateWindowY() {
        const y = this.windowMaxY * (this.container.scrollTop / (this.container.scrollHeight - this.container.offsetHeight));
        return Number.isNaN(y) ? 0 : y;
    }

    _setWindowY(value, scroll = true) {
        let y = value;
        if (y > this.windowMaxY) {
            y = this.windowMaxY;
        }
        if (y < 0) {
            y = 0;
        }

        this.windowY = y;
        this.window.style.top = this.windowY.toString() + 'px';
        if (this.canvasOverflowHeight > 0) {
            this.canvasY = -Math.floor(this.canvasOverflowHeight * (this.windowY / this.windowMaxY));
            this.canvas.style.top = this.canvasY + 'px';
        }
        if (scroll) {
            this.scrollContents();
        }
    }

    scrollContents() {
        const position = (this.container.scrollHeight - this.container.offsetHeight) * (this.windowY / this.windowMaxY);
        this.container.scrollTo(0, position);
    }

    resize(width, height) {
        this.outer.style.height = height + 'px';
        this.canvas.width = this.outer.offsetWidth;
        this.windowHeight = Math.floor(height / 10);
        this.window.style.height = this.windowHeight + 'px';
        // todo, recalculate window position
        this.window.style.top = '0px';

        this.updateSize();
    }

    updateSize() {
        this.windowHeight = Math.floor(this.outer.offsetHeight / 10);
        this.window.style.height = this.windowHeight + 'px';
        this.totalHeight = this.calculateHeight() / 10;
        this.outerHeight = this.outer.offsetHeight;
        this.windowMaxY = Math.min(this.totalHeight, this.outerHeight) - this.windowHeight;
        this.canvas.height = this.totalHeight;
        if (this.canvas.width <= 0) {
            this.canvas.width = this.outer.offsetWidth;
        }
        // todo, move window to match position with scroll top
        if (this.totalHeight < this.outerHeight) {
            this.canvas.style.top = '0px';
            this.canvasOverflowHeight = 0;
        } else {
            this.canvasOverflowHeight = this.totalHeight - this.outerHeight;
        }
    }

    calculateHeight() {
        if (this.container.hasChildNodes()) {
            let item = null;
            let lastY = 0;
            for (const content of this.container.childNodes) {
                lastY = Math.max(content.offsetTop, lastY);
                item = content;
            }
            const totalHeight = lastY + item.clientHeight + 8 - this.container.offsetTop;
            return totalHeight;
        } else {
            return 0;
        }
    }

    _getItemHeight() {
        for (const content of this.container.childNodes) {
            return content.clientHeight;
        }
        return 0;
    }

    update = () => {
        const ctx = this.canvas.getContext('2d');
        // clear
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const size = this._getItemHeight();
        if (size <= 0) {
            return;
        }
        this.updateSize();

        const baseX = this.container.offsetLeft;
        const baseY = this.container.offsetTop;

        const miniSize = Math.floor(size / 10);

        const [gridWidth, gridHeight] = this.view.sashi.gridManager.getGridSize();
        const stitchCount = Math.floor(size / Math.max(gridWidth, gridHeight));
        const [miniGridWidth, miniGridHeight] = [gridWidth / 10, gridHeight / 10];

        const drawDefs = (defs, x, y, f, offsetX, offsetY) => {
            for (const d of defs) {
                if (Array.isArray(d[0])) {
                    drawDefs(d[1], x - d[0][0], y - d[0][1], f, offsetX, offsetY);
                } else {
                    const tx = (d[0] - x) * f + offsetX;
                    const ty = (d[1] - y) * f + offsetY;
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(tx + d[2] * f, ty);
                }
            }
        };

        for (const content of this.container.childNodes) {
            const x = Math.floor((content.offsetLeft - baseX) / 10) + 2.5;
            const y = Math.floor((content.offsetTop - baseY) / 10);
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1.0;
            ctx.strokeRect(x, y, miniSize, miniSize);

            const model = this.view.templatesWindow._getModel(content.getAttribute('locationid'), content.getAttribute('key'));
            if (model) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 0.8;
                const template = model.template;
                const [width, height] = [template.bbox[2], template.bbox[3]];
                let f = stitchCount < width ? size / (width * gridWidth) : size / (height * gridHeight);
                if (f > 1.0) {
                    f = 1.0;
                }
                const hs = miniSize / 2;
                const [hw, hh] = [width / 2, height / 2];
                const [bx, by] = [template.bbox[0], template.bbox[1]];
                ctx.beginPath();
                drawDefs(template.defs, bx + hw, by + hh, f, x + hs, y + hs);
                ctx.stroke();
            }
        }
        this.timeoutID = null;
    }

    setUpdateRequest() {
        this.needsUpdate = true;
    }

    updateIfRequired() {
        if (this.needsUpdate) {
            this.needsUpdate = false;
            this.update();
        }
    }

    setUpdateTimeout() {
        this.timeoutID = setTimeout(this.update, 300);
    }

    updateTimeout() {
        if (this.timeoutID) {
            clearTimeout(this.timeoutID);

        }
        this.setUpdateTimeout();
    }
}

export class TemplatesWindow {
    /**
     * Constructor.
     *
     * @param {View} view
     * @param {TemplateManager} templateManager
     */
    constructor(view, templateManager) {
        this.view = view;
        this.templateManager = templateManager;
        this.models = new Map();
        this.filterString = '';
        this.addFileId = null;
        this.loaded = false;


        this.tabManager = new TabManager(this.view, view.sashi.templatesSetting);
        this.tabManager.setTabChangedEventListener((id) => this.loadTab(id));
        this.tabManager.setFolderClickEventListener((id) => this.addLocalFile(id));
        this.tabManager.setTabHeaderArrowClickEventListener(this.cbTabHeaderArrowDropDownClicked);
        this.tabManager.setFolderChangeListener(this.cbFolderChanged);
        this.tabManager.setFolderArrowClickEventListener(this.cbFolderArrowDropDownClicked);

        this.getFilterInput().addEventListener('input', this.onChangeFilterInput);
        this.getFilterInput().addEventListener('keydown', this.onKeypressFilterInput);
    }

    _modelKey(locationId, key) {
        return `${locationId}-${key}`;
    }

    _addModel(locationId, key, model) {
        const modelKey = this._modelKey(locationId, key);
        this.models.set(modelKey, model);
    }

    _getModel(locationId, key) {
        const modelKey = this._modelKey(locationId, key);
        return this.models.get(modelKey);
    }

    _removeModel(locationId, key) {
        const modelKey = this._modelKey(locationId, key);
        return this.models.delete(modelKey);
    }

    /**
     * Returns current active loader in tab.
     *
     * @returns {Loader} Loader instance.
     */
    getCurrentLoader() {
        return this._getLoader(this.tabManager.getActiveTabId());
    }

    _getLoader(id) {
        return this.templateManager.getLoader(id);
    }

    getCurrentLocationId() {
        return this.tabManager.getActiveTabId();
    }

    /// Prepare contents before open the templates selector.
    prepareToOpen(reload = false) {
        if (this.loaded) {
            return;
        }
        this.loaded = true;

        const addLoaderToTab = (id) => {
            const loader = this.templateManager.getLoader(id);
            if (loader) {
                if (reload) {
                    loader.clearLoaded();
                }
                if (loader.isSupportedType()) {
                    this.tabManager.addTab(loader.getId(), loader.location.type, loader.getName(), reload);
                } else {
                    console.log('Unknown type of loader: ' + loader.location.type);
                }
            }
        }

        // correct id for all loaders which includes non-ordered tabs
        const loaderIds = new Set();
        for (const loader of this.templateManager.iterLoaders()) {
            loaderIds.add(loader.getId());
        }

        // add ordered tabs first
        for (const id of this.tabManager.getTabOrder()) {
            loaderIds.delete(id);
            addLoaderToTab(id);
        }

        // remained loaders should be added after the ordered tabs
        for (const id of loaderIds.values()) {
            addLoaderToTab(id);
        }

        if (reload) {
            this.tabManager.makeTabActive(this.tabManager.getFirstTabId());
            this.tabManager.tabOrder.store();
        } else {
            let activeTabId = this.tabManager.getActiveTabId();
            activeTabId = this.tabManager.tabExists(activeTabId) ? activeTabId : this.tabManager.getFirstTabId();
            if (activeTabId >= 0) {
                this.tabManager.makeTabActive(activeTabId);
            } else if (this.tabManager.getCount() > 0) {
                this.tabManager.makeTabActive(this.tabManager.getFirstTabId());
            }
        }
    }

    /**
     * Returns current filter value.
     *
     * @returns {HTMLInputElement} Filter value.
     */
    getFilterInput() {
        return document.getElementById('templates-filter-input');
    }

    onKeypressFilterInput = (ev) => {
        if (ev.keyCode == 27) {
            // escape
            this.filterChanged('');
            this.getFilterInput().value = '';
            ev.preventDefault();
        }
    }

    onChangeFilterInput = (ev) => {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(this.applyFilter, 300);
    }

    applyFilter = () => {
        this.filterTimeout = null;
        if (this.filterString != this.getFilterInput().value) {
            this.filterChanged(this.getFilterInput().value);
        }
    }

    clearFilter() {
        this.getFilterInput().value = '';
        this.filterChanged('');
    }

    filterChanged = (text) => {
        this.filterString = text;
        const activeId = this.tabManager.getActiveTabId();

        for (const [id, tab] of this.tabManager.tabs) {
            tab.setFilter(text, activeId == id);
        }

        this.tabManager.updateScroller(activeId);
    }

    initBackend(loader, cbInitialized) {
        switch (loader.backend.getType()) {
            case 'googledrive': {
                if (cbInitialized) {
                    cbInitialized(loader.backend);
                }
                break;
            }
            case 'dropbox': {
                loader.backend.init();
                if (cbInitialized) {
                    cbInitialized(loader.backend);
                }
                break;
            }
            default: {
                loader.backend.init(() => {
                    if (cbInitialized) {
                        cbInitialized(loader.backend);
                    }
                });
                break;
            }
        }
    }

    /**
     * Tries to load specified tab for location.
     *
     * @param {number} locationId Location ID.
     */
    loadTab(locationId) {
        const folder = this.tabManager.getCurrentFolder(locationId);
        const load = () => {
            if (loader.backend) {
                if (this.templateManager.needsUpdate(locationId)) {
                    const requestOp = { locationId: locationId, folder: folder };
                    loader.storage.prepareForUpdate(requestOp, this.updateStorageFromBackend);
                    return;
                }
            }
            this._loadFromStorage(loader, folder);
        };

        const loader = this.templateManager.getLoader(locationId);
        if (loader && loader.isValid()) {
            // for common template manager, we checks contents of the tab
            const tab = this.tabManager.getTab(locationId);
            if (!loader.isLoaded(folder) || !tab.folderLoaded(folder)) {
                loader.setLoaded(folder);
                if (loader.backend && !loader.backend.initialized) {
                    this.initBackend(loader, load);
                } else {
                    load();
                }
            } else {
                let isUpdated = false;
                if (loader.clearFilter) {
                    this.filterChanged('')
                    isUpdated = true;
                }
                if (!loader.filtered) {
                    this.filterChanged(this.filterString);
                    isUpdated = true;
                }
                if (!isUpdated) {
                    this.tabManager.updateScroller(locationId, true);
                } else {
                    tab.updateScrollerIfRequired();
                }
            }
        }
    }

    _loadFromStorage(loader, folder) {
        this.tabManager.fillFolderList(loader.getId(), loader.getFolders(), loader.getActiveFolder());
        if (loader.hasFolder()) {
            this.cbFolderChanged(loader.getId());
        }
        if (!loader.isLocal()) {
            this.tabManager.hideFolderArrow(loader.getId());
        }
        const requestOp = { locationId: loader.getId(), folder: folder, activeFolder: loader.getActiveFolder() };
        loader.storage.openAllEntries(requestOp, this.dataLoaded, this.onLoadTabComplete);
    }

    updateStorageFromBackend = (requestOp, value) => {
        const loader = this._getLoader(requestOp.locationId);
        if (loader && loader.backend) {
            this.prepareForLoading(loader);
            const folder = value ? value.name : '/';
            const requestOp2 = { locationId: loader.getId(), folder: folder };
            loader.backend.loadAll(requestOp2,
                loader.storage.addOrUpdateEntry,
                this.cbError, this.cbLoadFinished,
                this.fnSVGNameFilter, loader.storage.fnNeedsLoading,
                this.cbLoadingDone,
                folder,
                value ? value.key : null,
                (requestOp, folder, folderKey) => {
                    loader.addReservedFolder({ name: folder, key: folderKey });
                }
            );
        }
    }

    onLoadTabComplete = (op, lastRead = null) => {
        const locationId = op.locationId;
        const loader = this._getLoader(locationId);
        loader.lastRead = lastRead;

        if (loader && this.filterString != '') {
            this.filterChanged(this.filterString);
        } else {
            this.tabManager.getTab(locationId).requestUpdate();
        }
    }

    prepareForLoading(loader) {
        loader.counter = new Uint32Array(1);
        loader.counter[0] = 0;
    }

    fnSVGNameFilter = (name) => {
        return name.endsWith('.svg');
    }

    cbError = (requestOp, error, type) => {
        console.log("error", error);
    }

    cbLoadingDone = (requestOp, key, name, data) => {
        const loader = this._getLoader(requestOp.locationId);
        if (loader && loader.backend) {
            Atomics.add(loader.counter, 0, 1);
            if (Atomics.load(loader.counter, 0) >= loader.maxCount) {
                this.loadingFinished(loader);
            }
        }
    }

    cbLoadFinished = (requestOp, count) => {
        const loader = this._getLoader(requestOp.locationId);
        if (loader && loader.backend) {

            loader.maxCount = count;
            if (Atomics.load(loader.counter, 0) >= count) {
                this.loadingFinished(loader);
            }
        }
    }

    loadingFinished(loader) {
        const value = loader.getReservedFolder();
        if (value) {
            loader.addFolder(value.name, null);
            this.updateStorageFromBackend(
                { locationId: loader.getId() },
                value
            );
        } else {
            loader.storage.clearRemovedData();
            loader.storage.clearDataInfo();
            // update last load time
            loader.updateBackendLastload();
            this._loadFromStorage(loader);
        }
    }

    /// Request to add file from local into specified location.
    addLocalFile(locationId) {
        this.addFileId = locationId;
        document.getElementById('template-file-input').click();
    }

    /// Returns currently selected entry of active folder in the active tab.
    getCurrentSelected() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }
        return this.getSelected(loader.getId());
    }

    /// Returns selected entry in the location tab.
    getSelected(locationId) {
        const tab = this.tabManager.getTab(locationId);
        if (tab) {
            return tab.queryFromActiveFolder('.template-selected');
        }
        return null;
    }

    findEntryByName(locationId, name, folder, callback) {
        const loader = this._getLoader(locationId);
        if (!loader) {
            return;
        }

        loader.storage.findEntry(name, folder, callback);
    }

    /// Callback for loading data from storage.
    dataLoaded = (op, key, name, folder, data) => {
        if (!folder) {
            folder = '/';
        }
        const locationId = op.locationId;
        const loader = this._getLoader(locationId);
        const canvasSize = getTemplateSize(loader.getSize());
        const canvas = this.makeTemplateElement
            (locationId, key, canvasSize, name, folder ? folder : '/',
                true);
        const model = TemplateElements.makeTemplateObject(canvas, this.view.viewMode, this.view.sashi);
        TemplateElements.loadFromData(locationId, key, name, data, canvasSize, model);

        if (!this.tabManager.addToFolder(locationId, folder, canvas.parentNode)) {
            this.tabManager.addFolderToTab(locationId, folder);
            this.tabManager.addToFolder(locationId, folder, canvas.parentNode)
        }

        this._addModel(locationId, key, model);
        this.tabManager.getTab(locationId).requestUpdate(folder);
    }

    /// Loads from data.
    loadLocalData(name, folder, data, locationId = null, key = null, callback) {
        if (!locationId) {
            locationId = this.addFileId;
        }
        const loader = this._getLoader(locationId);
        if (!loader) {
            return;
        }

        const requestOp = { locationId: locationId, folder: folder };
        if (key) {
            loader.storage.updateEntry(requestOp, key, name, data, {});
        } else {
            loader.storage.addEntry(requestOp, name, data, callback);
        }
        // todo, modified state
    }

    /// Loads from files.
    loadFromLocal(fps) {
        const locationId = this.addFileId;
        const loader = this._getLoader(locationId);
        if (!loader) {
            return;
        }

        const storage = loader.storage;
        const folder = this.tabManager.getCurrentFolder(locationId);
        const requestOp = { locationId: locationId, folder: folder, activeFolder: folder };

        storage.listEntries(requestOp, (requestOp, entries) => {
            const manager = new FileLoadManager(this, storage, requestOp, entries, fps);
            this.overwriteManager = manager;
            this.overwriteManager.run();
        });
    }

    /// Resizes previes for specified location.
    resizeEntries(locationId, oldSize, canvasSize) {
        const oldStyle = TemplateElements.sizeCSS(oldSize);
        const newStyle = TemplateElements.sizeCSS(canvasSize);
        const container = this.tabManager.getContainer(locationId);
        for (const outer of container.childNodes) {
            const [locationId, key] = this.getEntryLocationIdAndKey(outer);
            const sashi = this._getModel(locationId, key);
            if (sashi) {
                outer.classList.replace(oldStyle, newStyle);

                const center = sashi.project.view.center.clone();
                sashi.project.activate();
                sashi.project.view.viewSize = new paper.Size(canvasSize, canvasSize);

                const bbox = sashi.template.bbox;
                const zoomValue = TemplateElements.calculateZoomValue(bbox, canvasSize, sashi.gridManager);
                sashi.project.view.zoom = zoomValue;
                sashi.project.view.center = center;
                sashi.view.update();
            }
        }
    }

    _entryId(locationId, key) {
        return `${locationId}-${key}-entry`;
    }

    _idToLocationId(id) {
        return parseInt(id.split('-')[0], 10);
    }

    _removeLocation(locationId) {
        const loader = this._getLoader(locationId);
        if (!loader) {
            return;
        }

        this.templateManager.removeLocation(locationId);
        // remove tab element
        this.tabManager.removeTab(locationId);
    }

    _getContents(locationId) {
        return document.getElementById(this.tabManager._contentsId(locationId));
    }

    getNameForCurrentLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return '';
        }

        return loader.getName();
    }

    /// Returns inner canvas of the entry.
    getCanvas(entry) {
        for (const child of entry.childNodes) {
            if (child.tagName == 'CANVAS') {
                return child;
            }
        }
        return null;
    }

    /// Returns entry.
    getEntry(locationId, key) {
        const id = this._entryId(locationId, key);
        return document.getElementById(id);
    }

    getEntryLocationId(entry) {
        return parseInt(entry.getAttribute('locationid'), 10);
    }

    getEntryLocationKey(entry) {
        return toKey(entry.getAttribute('key'));
    }

    getEntryLocationIdAndKey(entry) {
        return [
            parseInt(entry.getAttribute('locationid'), 10),
            toKey(entry.getAttribute('key')),
        ];
    }

    /// Return title of entry.
    getEntryTitle(entry) {
        return entry.firstElementChild.nextElementSibling.nextElementSibling.textContent;
    }

    /// Returns name for active entry.
    getNameForActiveEntry() {
        const entry = this.getCurrentSelected();
        if (entry) {
            return this.getEntryName(entry);
        } else {
            return null;
        }
    }

    /// Returns name of entry.
    getEntryName(entry) {
        return entry.firstElementChild.nextElementSibling.textContent;
    }

    /// Set name of entry.
    setEntryName(entry, name) {
        entry.firstElementChild.nextElementSibling.textContent = name;
    }

    resetEntry(entry, newKey, newName) {
        const [locationId, key] = this.getEntryLocationIdAndKey(entry);
        const id = this._entryId(locationId, newKey);
        entry.setAttribute('id', id);
        entry.setAttribute('key', entry.getAttribute('folder') + newName);
        entry.firstElementChild.nextElementSibling.textContent = newName;
    }

    /// Removes entry of template.
    removeEntry(locationId, key) {
        const entry = this.getEntry(locationId, key);
        if (entry) {
            entry.remove();
            return entry;
        }
        return null;
    }

    /// Open template to edit in another kogin.
    editItem() {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            this.view.openFromTemplates(locationId, key);
        }
    }

    /// Reloads current item.
    reloadItem() {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            const loader = this._getLoader(locationId);
            if (loader) {
                const op = { locationId: locationId, key: key, };
                loader.storage.openEntry(op, key, this.itemReloaded);
            }
        }
    }

    /// Data reloaded callback.
    itemReloaded = (op, key, name, data, folder) => {
        const locationId = op.locationId;
        const entry = this.getEntry(locationId, key);
        if (entry) {
            const sashi = this._getModel(locationId, key);
            if (sashi) {
                const loader = this._getLoader(locationId);
                if (loader) {
                    sashi.clear();

                    const canvas = this.getCanvas(entry);
                    const canvasSize = getTemplateSize(loader.getSize());
                    TemplateElements.loadFromData(locationId, key, name, data, canvasSize, sashi);
                    this.tabManager.updateScroller(locationId);
                }
            }
        }
    }

    /// Renames item.
    renameItem(name) {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            const loader = this._getLoader(locationId);
            if (loader.isLocal()) {
                const currentName = this.getEntryName(entry);
                if (name == currentName) {
                    return;
                }
                const op = { locationId: locationId, key: key, };
                loader.storage.renameEntry(op, key, name, this.itemRenamed);
            }
        }
    }

    /// Item name changed.
    itemRenamed = (op, name, key) => {
        const entry = this.getEntry(op.locationId, op.key);
        if (entry) {
            //this.setEntryName(entry, name);
            //entry.setAttribute('key', key);
            this.resetEntry(entry, key, name);
        }
    }

    duplicateItem(name) {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            const loader = this._getLoader(locationId);
            if (loader.isLocal()) {
                const currentFolder = this.tabManager.getCurrentFolder(locationId);
                const op = { locationId: locationId, key: key, activeFolder: currentFolder };
                loader.storage.duplicateEntry(
                    op, key, name,
                    this.cbEntryAddedNew,
                    (op, key, name) => {
                        this.view.toolManager.showMessage('Name conflict.', 'Error');
                    }
                );
            }
        }
    }

    checkNameConflict(name) {
        // checks only in the items loaded
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        const tab = this.tabManager.getTab(loader.getId());
        if (tab) {
            const item = tab.findEntryByNameFromActiveFolder(name);
            return !!item;
        }
        return null;
    }

    /// Downloads current entry.
    downloadItem() {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            const loader = this._getLoader(locationId);
            const op = { locationId: locationId, key: key, };
            loader.storage.openEntry(op, key, (op, key, name, data, folder) => {
                startDownloadForData(data, name, 'image/svg+xml');
            });
        }
    }

    /// Removes current entry.
    removeItem() {
        const entry = this.getCurrentSelected();
        if (entry) {
            const [locationId, key] = this.getEntryLocationIdAndKey(entry);
            const loader = this._getLoader(locationId);
            const currentFolder = this.tabManager.getCurrentFolder(locationId);
            const op = { locationId: locationId, folder: currentFolder, key: key, };
            loader.storage.removeEntry(op, key, this.itemRemoved);
        }
    }

    /// Callback for remove entry.
    itemRemoved = (op) => {
        const entry = this.removeEntry(op.locationId, op.key);
        if (entry) {
            this._removeModel(op.locationId, op.key);
            this._removeEntry(op.locationId, op.key);
            this.tabManager.updateScroller(op.locationId);
        }
    }

    _removeEntry(locationId, key) {
        const entry = document.getElementById(this._entryId(locationId, key));
        if (entry) {
            entry.remove();
        }
    }

    hide() {
        this.tabManager.updateTimestamp();
        this.view.toolManager.hideSpecialDialog('templates');
    }

    selectCurrentItem() {
        const entry = this.getCurrentSelected();
        if (entry) {
            const locationId = this.getEntryLocationId(entry);
            const key = this.getEntryLocationKey(entry);
            this.itemSelected(locationId, key);
        }
    }

    itemSelected = (locationId, key, point = null) => {
        const model = this._getModel(locationId, key);
        if (model) {
            const template = model.template;
            const keepColor = this.view.toolManager.getBoolValue('templates-keep-color');
            this.view.addToTemplateHistory(locationId, key);
            if (point) {
                this.view.setMouseLocation(point, true);
            }
            this.view.setTemplate(template, this.view.editModeTemplate, 0, keepColor);
            this.hide();
            this.tabManager.storeSettings();
        } else {
            console.log('template not found: ' + locationId + ', ' + key);
        }
    }

    cbFolderArrowDropDownClicked = (ev) => {
        if (this.view.toolManager.isCurrentPopup('templates-folder-dropdown')) {
            this.view.toolManager.closeAnyPopup();
            return;
        }

        let target = ev.target;
        if (target.tagName != 'SPAN') {
            target = target.tagName == 'path' ? target.parentNode.parentNode : target.parentNode;
        }

        const selector = target.previousSibling;
        const locationId = this._idToLocationId(selector.id);
        const loader = this._getLoader(locationId);
        if (!loader.isLocal()) {
            return;
        }
        const folder = selector.selectedOptions[0].textContent;
        // no rename, no remove for root folder
        if (folder == '/') {
            this.view.toolManager.setDisplay('templates-folder-rename-tool', false);
            this.view.toolManager.setDisplay('templates-folder-remove-tool', false);
        } else {
            this.view.toolManager.setDisplay('templates-folder-rename-tool', true);
            this.view.toolManager.setDisplay('templates-folder-remove-tool', true);
        }

        const rect = target.getBoundingClientRect();
        this.view.toolManager.showTemplatesDropdown(
            'templates-folder-dropdown', { x: rect['x'] - 12, y: rect['y'] + target.clientHeight });
    }

    cbTabHeaderArrowDropDownClicked = (ev) => {
        if (this.view.toolManager.isCurrentPopup('templates-dropdown')) {
            this.view.toolManager.closeAnyPopup();
            return;
        }
        let target = ev.target;
        if (target.tagName != 'SPAN') {
            target = target.tagName == 'path' ? target.parentNode.parentNode : target.parentNode;
        }

        const span = target.parentNode.parentNode;
        const locationId = this._idToLocationId(span.id);
        const loader = this._getLoader(locationId);
        if (!loader) {
            return;
        }

        // hide add subfolder entry for non-local
        this.view.toolManager.setDisplay('templates-context-add-subfolder-tool', loader.isLocal());

        this.view.toolManager.setDisplay('templates-context-open-web-tool', !loader.isLocal());

        const rect = target.getBoundingClientRect();
        this.view.toolManager.showTemplatesDropdown(
            'templates-dropdown', { x: rect['x'] - 12, y: rect['y'] + target.clientHeight });
    }

    clearLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }
        if (!loader.isLocal()) {
            return false;
        }

        const requestOp = { locationId: loader.getId() };
        loader.storage.clearData(requestOp, (requestOp) => {
            this.tabManager.clearTabContents(requestOp.locationId);
        });
    }

    /// Reloads contents.
    reloadLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        this.tabManager.clearFolderSelector(loader.getId());
        this.tabManager.clearTabContents(loader.getId());
        loader.clearLoaded();
        loader.temporalyResetBackendLastload();
        this.loadTab(loader.getId());
    }

    /// Renames current location.
    renameLocation(newName) {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        loader.setName(newName, () => {
            this.tabManager.setTabName(loader.getId(), newName);
        });
    }

    cbFolderChanged = (locationId) => {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        const folder = this.tabManager.getCurrentFolder(locationId);
        if (!loader.isLoaded(folder)) {
            loader.setLoaded(folder);
            const requestOp = { locationId: loader.getId(), folder: folder, activeFolder: loader.getActiveFolder() };
            loader.storage.openAllEntries(requestOp, this.dataLoaded, (op) => {
                this.onLoadTabComplete(op);
                this.tabManager.showFolder(locationId, folder);
            });
        } else {
            this.tabManager.showFolder(locationId, folder);
        }
    }

    getCurrentFolder() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        return this.tabManager.getCurrentFolder(loader.getId());
    }

    reloadCurrentFolder() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        const locationId = loader.getId();
        const currentFolder = this.tabManager.getCurrentFolder(locationId);


        // todo, reload folder
    }

    renameCurrentFolder(name) {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        if (!loader.isLocal()) {
            return;
        }

        if (!name.startsWith('/')) {
            name = '/' + name;
        }

        const locationId = loader.getId();
        const currentFolder = this.tabManager.getCurrentFolder(locationId);
        if (currentFolder == '/') {
            return false;
        }

        const state = loader.renameFolder(currentFolder, name, (id, index) => {
            // update folder for view
            const requestOp = { locationId: locationId, folder: name };

            const tab = this.tabManager.getTab(loader.getId());
            if (tab) {
                const needsUpdate = !loader.storage.supportsFolderFunction();
                const contents = this.tabManager.getContainer(loader.getId()).children;
                for (const content of contents) {
                    content.setAttribute('folder', name);

                    // rename data
                    if (needsUpdate) {
                        const key = toKey(content.getAttribute('key'));
                        loader.storage.updateEntry(
                            requestOp, key, null, null, null, (requestOp, name) => {
                        });
                    }
                }
            }

            this.tabManager.renameFolder(locationId, index, name);
        });
        return state;
    }

    removeCurrentFolder() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        if (!loader.isLocal()) {
            return;
        }

        const locationId = loader.getId();
        const currentFolder = this.tabManager.getCurrentFolder(locationId);
        if (currentFolder == '/') {
            return false;
        }

        loader.removeFolder(currentFolder, (id, index) => {
            this.tabManager.removeFolder(locationId, index);

            // update folder for view
            const tab = this.tabManager.getTab(loader.getId());
            if (tab) {
                const requestOp = { locationId: locationId };
                if (loader.storage.supportsFolderFunction()) {
                    const folder = tab.getActiveFolder();
                    loader.storage.removeFolder(requestOp, folder.key);
                } else {
                    for (const item of tab.getActiveFolderContent()) {
                        // remove data
                        const key = toKey(item.getAttribute('key'));
                        loader.storage.removeEntry(requestOp, key, (requestOp) => {
                        });
                    }
                }
            }
        });
        return true;
    }

    newToCurrentFolder(name) {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        if (!loader.isLocal()) {
            return;
        }

        const locationId = loader.getId();
        const currentFolder = this.tabManager.getCurrentFolder(locationId);

        if (!name.endsWith('.svg')) {
            name += '.svg';
        }

        const requestOp = { locationId: locationId, folder: currentFolder, activeFolder: currentFolder };

        const template =
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 743 487" width="743" height="487">' +
            '<foreignObject id="kogin-data" visibility="hidden">' +
            '{"application":"kogin","data":[{"layer":true,"name":"Layer 1","visible":true,"locked":false,"x":0,"y":0,"children":[]}],"defs":{"single":[]},"pivots":[],"bbox":[0,0,1,1]}' +
            '</foreignObject>' +
            '<foreignObject id="kogin-metadata" visibility="hidden">' +
            JSON.stringify(this.view.sashi.loadMetadataDefault()) +
            '</foreignObject>' +
            '</svg>';

        loader.storage.addEntry(
            requestOp, name, template, {}, this.cbEntryAddedNew
        );
    }

    cbEntryAddedNew = (op, key, name, folder, data) => {
        const locationId = op.locationId;
        this.dataLoaded(op, key, name, folder, data);
        const entry = document.getElementById(TemplateElements.entryId(locationId, key));
        this.tabManager.updateScroller(locationId);
        entry.scrollIntoView();
        entry.click();
    }

    addSubfolderToLocation(name) {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        const locationId = loader.getId();
        const currentFolder = this.tabManager.getCurrentFolder(locationId);
        if (!name.startsWith('/')) {
            name = currentFolder.startsWith('/') ? currentFolder + name : currentFolder + '/' + name;
        }

        loader.addFolder(name, (id, path, index) => {
            this.tabManager.addFolder(locationId, name, index);
        });
    }

    downloadLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }
        if (loader.isLocal()) {
            jszipLoader(() => {
                let zip = new JSZip();
                const requestOp = {};
                loader.storage.openAllEntries(
                    requestOp,
                    (requestOp, key, name, folder, data) => {
                        folder = folder ? folder : '/';
                        const path = (folder.endsWith('/') ? folder : folder + '/') + name;
                        zip.file(path, data);
                    },
                    (requestOp) => {
                        zip.generateAsync({
                            type: 'blob',
                        }).then((blob) => {
                            const date = getDate().replace(' ', '-').replace(':', '-');
                            startDownloadForBlob(blob,
                                `${loader.getName()}-${date}.zip`);
                        });
                    }
                );
            });
        } else {
            // todo, id for some backend
            loader.backend.downloadArchive('', (url, name) => {
                startDownloadURL(url, name);
            });
        }
    }

    openLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        openSome(loader.storage.path);
    }

    async openWebLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        const url = await loader.backend.getWebUrl();
        openSome(url);
    }

    /// Removes current location.
    removeLocation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }

        this._removeLocation(loader.getId());
        // activate first tab
        //this.tabManager.makeTabActive(this.tabManager.getFirstTabId());
    }

    /// Shows information of the current location.
    async showLocationInformation() {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }
        const info = await loader.getInfo();
        if (info.length > 0) {
            let s = '';
            for (const [term, value] of info) {
                s += `${this.view.toolManager.translate(term)}: ${value}\n`;
            }
            const pivotsInfo = this.checkNoPivots(loader);
            if (pivotsInfo.length > 0) {
                s += '\n';
                s += this.view.toolManager.translate('No pivots') + '\n' + pivotsInfo;
            }
            this.checkRepeat(loader).then((repeatInfo) => {
                if (repeatInfo.length > 0) {
                    s += '\n';
                    s += this.view.toolManager.translate('Repeated') + '\n' + repeatInfo;
                }
                this.view.toolManager.showMessage(s, 'Information');
            });
        }
    }

    checkNoPivots(loader) {
        const prefix = `${loader.getId()}-`;
        const entries = [];
        for (const key of this.models.keys()) {
            if (key.startsWith(prefix)) {
                const model = this.models.get(key);
                if (model.template.noPivots) {
                    const id = `${key}-entry`;
                    const entry = document.getElementById(id);
                    const folder = entry.getAttribute('folder');
                    const fileName = entry.querySelector('span.template-file-name').textContent;

                    const path = folder.endsWith('/') ? `${folder}${fileName}` : `${folder}/${fileName}`;
                    entries.push(path);
                }
            }
        }
        if (entries.length > 0) {
            entries.sort();
            return entries.join('\n');
        }
        return '';
    }

    async checkRepeat(loader) {
        const prefix = `${loader.getId()}-`;
        const conflictEntries = [];
        const entries = new Map();
        for (const key of this.models.keys()) {
            if (key.startsWith(prefix)) {
                const id = `${key}-entry`;
                const entry = document.getElementById(id);
                const folder = entry.getAttribute('folder');
                const fileName = entry.querySelector('span.template-file-name').textContent;
                const path = folder.endsWith('/') ? `${folder}${fileName}` : `${folder}/${fileName}`;

                const model = this.models.get(key);
                const normalizer = new Normalizer(model);
                const hash = await normalizer.normalize(path);

                const conflictPath = entries.get(hash);
                if (conflictPath) {
                    conflictEntries.push(`${conflictPath}, ${path}`);
                } else {
                    entries.set(hash, path);
                }
            }
        }
        if (conflictEntries.length > 0) {
            conflictEntries.sort();
            return conflictEntries.join('\n');
        }
        return '';
    }

    reloadAll() {
        // remove all tabs and reload
        this.tabManager.tabOrder.preserve();
        this.tabManager.removeAllTabs();
        this.tabManager.tabOrder.rollback();
        this.loaded = false;
        this.prepareToOpen(true);
    }

    /// Moves tab to left.
    moveTabLeft() {
        this.tabManager.moveTab(this.getCurrentLocationId(), 'left');
    }

    /// Moves tab to right.
    moveTabRight() {
        this.tabManager.moveTab(this.getCurrentLocationId(), 'right');
    }

    /**
     * Adds location from current input.
     */
    addCurrentLocation() {
        const data = this.view.toolManager.getTemplateLocation();
        if (!data.size) {
            data.size = 'small';
        }
        if (data.type == 'cached') {
            data.lastload = 0;
        }
        if (data.name == '') {
            return false;
        }
        if (data.type == 'local') {
            data.folders = ['/'];
            data.activeFolder = '/';
        }
        this.templateManager.addNewLocation(data, (location) => {
            this.view.fireCommand('templates-add-location-ok-close');
            this.tabManager.addTab(location.id, location.type, location.name);
            this.tabManager.makeTabActive(location.id);
        });
        return true;
    }

    checkLocation() {
        const data = this.toolManager.getTemplateLocation();

        return this.isLocationValid(data);
    }

    /*
    isLocationValid(data) {
        const toolManager = this.app.view.toolManager;
        function isEmpty(v) {
            return v && v != '';
        }

        if (!isEmpty(data.name)) {
            toolManager.showMessage('Input name', 'Error');
            return false;
        }
        if (data.type == 'cached') {
            if (data.backend_type == 'github') {
                if (!isEmpty(data.user)) {
                    toolManager.showMessage('Input user', 'Error');
                    return false;
                }
                if (!isEmpty(data.repository)) {
                    toolManager.showMessage('Input repository', 'Error');
                    return false;
                }
            } else if (data.backend_type == 'gitlab') {
                if (!isEmpty(data.projectid)) {
                    toolManager.showMessage('Input project ID', 'Error');
                    return false;
                }
            } else if (data.backend_type == 'googledrive') {
                if (!this.app.view.pickerResult) {
                    toolManager.showMessage('Choose folder', 'Error');
                    return false;
                }
            } else if (data.backend_type == 'dropbox') {
                if (!this.app.view.pickerResult) {
                    toolManager.showMessage('Choose folder', 'Error');
                    return false;
                }
            }
        }
        return true;
    }
*/
    /// Changes size of template preview for active tab.
    changeTemplateSize(size) {
        const loader = this.getCurrentLoader();
        if (!loader) {
            return;
        }
        const oldSize = loader.getSize();
        if (size == oldSize) {
            return;
        }
        loader.setSize(size);

        this.resizeEntries(loader.getId(), getTemplateSize(oldSize), getTemplateSize(size));
        this.tabManager.updateScroller(loader.getId());
    }

    /// Makes preview element.
    makeTemplateElement(locationId, key, size, name, folder, visible) {
        const outer = TemplateElements.makeTemplateElementBase(locationId, key, size, folder, visible);
        const canvas = outer.firstElementChild;
        function findTemplateParent(node) {
            if (!node) {
                return null;
            } else if (node.classList.contains('template')) {
                return node;
            } else {
                return findTemplateParent(node.parentNode);
            }
        }
        function selectItem(target) {
            for (const child of target.parentNode.childNodes) {
                if (child == target) {
                    child.classList.add('template-selected');
                } else {
                    child.classList.remove('template-selected');
                }
            }
        }
        // click event to select
        outer.addEventListener('click', (ev) => {
            if (ev.detail == 1) {
                const target = findTemplateParent(ev.target);
                selectItem(target);
            }
        });
        // double-click to decide to use this template
        outer.addEventListener('dblclick', (ev) => {
            let target = ev.target;
            if (target.tagName == 'CANVAS') {
                target = target.parentNode;
            } else if (target.tagName == 'DIV' && target.classList.contains('template')) {
            } else {
                // ignore some elements in template item
                return;
            }
            const locationId = parseInt(target.getAttribute('locationid'), 10);
            const key = toKey(target.getAttribute('key'));
            this.itemSelected(locationId, key, { x: ev.clientX, y: ev.clientY });
        });

        TemplateElements.makeTemplateTitle(outer, locationId, key, name);

        const menu = TemplateElements.addDiv(outer, null);
        TemplateElements.addArrowSVG(menu);
        menu.classList.add('template-menu');
        menu.classList.add('is-button');
        // dropdown menu for items
        menu.addEventListener('click', (ev) => {
            if (this.view.toolManager.isCurrentPopup('templates-item-dropdown')) {
                this.view.toolManager.closeAnyPopup();
                return;
            }
            let target = ev.target;
            if (target.tagName != 'DIV') {
                target = target.tagName == 'path' ? target.parentNode.parentNode : target.parentNode;
            }
            const rect = target.getBoundingClientRect();
            this.view.toolManager.setVisibleEntryTool(this._getLoader(locationId).isLocal());
            this.view.toolManager.showTemplatesItemDropdown(
                'templates-item-dropdown', { x: rect['x'] - 100, y: rect['y'] + target.clientHeight });
        });
        outer.addEventListener('contextmenu', (ev) => {
            if (this.view.toolManager.isCurrentPopup('templates-item-dropdown')) {
                this.view.toolManager.closeAnyPopup();
                return;
            }
            let [x, y] = [ev.clientX, ev.clientY];
            let target = ev.target;
            if (target.tagName != 'DIV') {
                target = target.tagName == 'SPAN' ? target.parentNode : target.parentNode;
                x += target.offsetX;
                y += target.offsetY;
            }
            if (target.classList.contains('template-menu')) {
                return;
            }
            selectItem(target);
            this.view.toolManager.setVisibleEntryTool(this._getLoader(locationId).isLocal());
            this.view.toolManager.showTemplatesItemDropdown(
                'templates-item-dropdown', { x: ev.clientX, y: ev.clientY });

            ev.preventDefault();
        });

        return canvas;
    }
}
