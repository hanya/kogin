
import { TemplateElements, getTemplateSize, toKey } from "./templates.js";
import { ElementTool } from './elements.js';

/**
 * File picker for template.
 */
export class TemplateFilePicker extends ElementTool {
    /**
     * Constructor.
     *
     * @param {View} view
     */
    constructor(view) {
        super();
        this.view = view;
        /** @type {Sashi} */
        this.model = null;
        /** @type {number} */
        this.size = getTemplateSize('medium');
        /** @type {string} */
        this.mode = 'open';
        this.nameDownwards = true;
        this.previousStorageIndex = this.view.sashi.templatesSetting.activeTabIdForPicker;
        this.getFileSelector().addEventListener('dblclick', this.onDoubleClickOnFileSelector);
        this.getNameInput().addEventListener('keypress', this.onKeypressInNameInput);
        document.getElementById('templates-fp-name').addEventListener('click', this.onClickName);
        /** @type {boolean} */
        this.initialized = false;
    }

    /**
     * Initialize internal state.
     */
    _init() {
        if (!this.initialized) {
            /** @type {ToolManager} */
            this.toolManager = this.view.toolManager;
            this.initialized = true;
            this.canvas = document.getElementById('templates-fp-preview-canvas');
            this.getLocationSelector()
                .addEventListener('change', this.cbTemplatesSelectorChanged);
            this.getFileSelector()
                .addEventListener('change', this.cbTemplatesNameSelectorChanged);
            this.nameDownwards = this.view.sashi.templatesSetting.nameDownwards;
        }
    }

    _getLoader(id) {
        return this.view.sashi.templateManager.getLoader(id);
    }

    onKeypressInNameInput = (ev) => {
        switch (ev.keyCode) {
            case 13: {
                // Enter
                ev.preventDefault();
                this.view.fireCommand('templates-fp-ok');
                break;
            }
            case 27: {
                // Escape
                this.view.fireCommand('templates-fp-cancel');
                break;
            }
        }
    }

    onClickName = (ev) => {
        this.flipNameOrder();
    }

    flipNameOrder() {
        const selector = this.getFileSelector();
        const newIndex = selector.options.length - selector.selectedIndex;

        // flip order
        const items = [];
        while (selector.lastElementChild) {
            const item = selector.lastElementChild;
            items.push(item);
            item.remove();
        }
        for (const item of items) {
            selector.appendChild(item);
        }
        selector.selectedIndex = newIndex;
        selector.scrollIntoView(selector.options[newIndex]);
        this.nameDownwards = !this.nameDownwards;

        this.setDisplay('templates-fp-name-downward-icon', this.nameDownwards);
        this.setDisplay('templates-fp-name-upward-icon', !this.nameDownwards);
    }

    /// Returns current mode of the file picker, open or save.
    getCurrentMode() {
        return this.mode;
    }

    /// Shows file picker as open or save.
    show = (type) => {
        this.mode = type;
        const state = type == 'open';
        this.setDisplay('templates-fp-open-title', state);
        this.setDisplay('templates-fp-save-title', !state);
        this.setDisplay('templates-fp-save-name', !state);
        this.toolManager.showSpecialDialog('templates-fp');
        if (this.mode == 'save' || this.mode == 'export-selection') {
            this.getNameInput().focus();
        }
        this.previousNameOrder = this.nameDownwards;
    }

    hide = () => {
        this.toolManager.hideSpecialDialog('templates-fp');
        const index = this.getLocationSelector().selectedIndex;
        if (index != this.previousStorageIndex || this.nameDownwards != this.previousNameOrder) {
            this.previousStorageIndex = index;
            this.view.sashi.templatesSetting.activeTabIdForPicker = index;
            this.view.sashi.templatesSetting.nameDownwards = this.nameDownwards;
            this.view.sashi.storeTemplateSettingsPart(this.view.sashi.templatesSetting, ['activeTabIdForPicker', 'nameDownwards']);
        }
    }

    onDoubleClickOnFileSelector = (event) => {
        this.view.fireCommand('templates-fp-ok');
    }

    /// Update to initial state.
    updateSaveAsTemplateUI = (option = null) => {
        this._init();
        const localLocations = [];

        const tabOrder = this.view.sashi.templatesSetting.tabOrder;
        const templateManager = this.view.sashi.templateManager;
        const loaderIds = new Set(Array.from(templateManager.iterLoaderIds()));

        const addLoader = (id) => {
            const loader = templateManager.getLoader(id);
            if (loader) {
                localLocations.push({
                    name: loader.getName(), id: loader.getId(),
                    loader: loader,
                });
            }
        };

        for (const id of tabOrder) {
            addLoader(id);
            loaderIds.delete(id);
        }
        // remained tabs later
        for (const id of loaderIds.keys()) {
            addLoader(id);
            tabOrder.push(id);
        }
        if (loaderIds.size) {
            this.view.sashi.storeTemplateSettingsPart(this.view.sashi.templatesSetting, ['tabOrder']);
        }

        this.setTemplatesLocation(localLocations);
        if (option && option.locationId) {
            const index = this.findLocation(option.locationId, option.folder);
            if (index) {
                this.getLocationSelector().selectedIndex = index;
            }
        } else {
            if (this.previousStorageIndex) {
                this.getLocationSelector().selectedIndex = this.previousStorageIndex;
            } else {
                this.getLocationSelector().selectedIndex = 0;
            }
        }
        this.cbTemplatesSelectorChanged({ target: this.getLocationSelector() });
    }

    findLocation(locationId, folder) {
        const strId = locationId.toString();
        let idFound = false;
        let index = 0;
        const selector = document.getElementById('templates-fp-templates');
        for (const option of selector.childNodes) {
            if (idFound) {
                if (option.getAttribute('folder') == folder) {
                    return index;
                }
            } else {
                const id = option.getAttribute('locationid');
                if (option.getAttribute('locationid') == strId) {
                    if (option.getAttribute('folder') == folder) {
                        return index;
                    }
                    idFound = true;
                }
            }
            index += 1;
        }
        return null;
    }

    setTemplatesLocation(locations) {
        this.toolManager.clearSelector('templates-fp-templates');
        this.toolManager.clearSelector('templates-fp-files');
        const selector = document.getElementById('templates-fp-templates');
        for (const location of locations) {
            for (const folder of location.loader.getFolders()) {
                let name = location.name;
                let indent = 0;
                const folderParts = folder.split('/');
                if (folderParts.length >= 2 && folderParts[0] == '') {
                    if (folderParts[1] != '') {
                        name = folderParts[folderParts.length - 1];
                        indent = (folderParts.length - 1) * 0.6;
                    }
                } else {
                    continue;
                }
                const option = this.toolManager.addOption(selector, name);
                option.setAttribute('locationid', location.id);
                option.setAttribute('folder', folder);
                if (indent > 0) {
                    option.style = `text-indent: ${indent}em;`;
                }
            }
        }
        // select first location
        if (selector.firstElementChild) {
            selector.firstElementChild.setAttribute('selected', true);
        }
    }

    /// Selected location of templates is changed.
    cbTemplatesSelectorChanged = (ev) => {
        const target = ev.target;
        const index = target.selectedIndex;
        this.setFileInfo('', '', '');
        if (index >= 0) {
            this.clearSelector('templates-fp-files');
            if (this.model) {
                this.model.clear();
            }

            const option = target.childNodes[index];
            const locationId = parseInt(option.getAttribute('locationid', 10));
            this.getFileSelector().setAttribute('locationid', locationId);
            const folder = option.getAttribute('folder');
            this.getFileSelector().setAttribute('folder', folder);
            const loader = this._getLoader(locationId);
            if (loader) {
                const requestOp = { locationId: locationId, folder: folder };
                loader.storage.listEntries(
                    requestOp,
                    (requestOp, values) => {
                        this.toolManager.addTemplateNames(values, requestOp.locationId, this.nameDownwards);
                    }
                );
            }
        }
    }

    /// Selected name changed.
    cbTemplatesNameSelectorChanged = (ev) => {
        // update preview
        const target = ev.target;
        const index = target.selectedIndex;
        if (index >= 0) {
            const option = target.childNodes[index];
            const key = toKey(option.getAttribute('key'));
            const locationId = parseInt(target.getAttribute('locationid'), 10);
            const op = { locationId: locationId, key: key, };
            this.view.sashi.templateManager.loadData(locationId, key, this.cbTemplateFileLoaded, op);
        } else {
            // clear preview
            if (this.model) {
                this.model.clear();
            }
        }
    }

    /// Data loaded from storage.
    cbTemplateFileLoaded = (op, key, name, data) => {
        this.setFileName(name);
        this.model = TemplateElements.makeTemplateObject(this.canvas, this.view.viewMode, this.view.sashi);
        TemplateElements.loadFromData(op.locationId, op.key, name, data, this.size, this.model);
        this.setFileInfo(name, this.model.metadata.title, this.model.metadata['title-en']);
    }

    setFileInfo(name, title, title_en) {
        this.setText('templates-fp-preview-name', name);
        this.setText('templates-fp-preview-title', title);
        this.setText('templates-fp-preview-title-en', title_en);
    }

    getNameInput() {
        return document.getElementById('templates-fp-filename');
    }

    /**
     *
     * @returns {HTMLSelectElement}
     */
    getLocationSelector() {
        return document.getElementById('templates-fp-templates');
    }

    /**
     * Returns element of file selector for file picker.
     *
     * @returns {HTMLSelectElement}
     */
    getFileSelector() {
        return document.getElementById('templates-fp-files');
    }

    /// Returns file name.
    getFileName() {
        return this.getValue('templates-fp-filename');
    }

    /// Set file name.
    setFileName(name) {
        if (name.endsWith('.svg')) {
            name = name.substring(0, name.length - 4);
        }
        this.setValue('templates-fp-filename', name);
    }

    /// Returns selected location id.
    getLocationId() {
        const option = this.getSelectedOption('templates-fp-templates');
        return option ? parseInt(option.getAttribute('locationid'), 10) : null;
    }

    getFolder() {
        const option = this.getSelectedOption('templates-fp-templates');
        return option ? option.getAttribute('folder') : '/';
    }

    /// Returns selected key.
    getKey() {
        const option = this.getSelectedOption('templates-fp-files');
        return option ? toKey(option.getAttribute('key')) : null;
    }

    /// Returns name for selected option. This value might be different from name field.
    getSelectedName() {
        const option = this.getSelectedOption('templates-fp-files');
        return option ? option.textContent : null;
    }

    /// Returns selected option for specified selector by its id.
    getSelectedOption(id) {
        const selector = document.getElementById(id);
        const index = selector.selectedIndex;
        return index >= 0 ? selector.childNodes[index] : null;
    }
}
