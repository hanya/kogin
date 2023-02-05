
import { TT } from "./ja.js";
import { colors } from "./color.js";
import { View } from "./view.js";
import { ElementTool } from "./elements.js";


class Stack {
    constructor() {
        this.stack = [];
    }

    push(value) {
        this.stack.push(value);
    }

    pop(value) {
        return this.stack.pop(value);
    }

    has() {
        return this.stack.length != 0;
    }

    last() {
        return this.has() ? this.stack[this.stack.length - 1] : null;
    }
}


/// Manages UI state.
export class ToolManager extends ElementTool {
    /**
     *
     * @param {View} view View for this UI.
     */
    constructor(view) {
        super();
        this.colors = colors;
        Object.defineProperties(this, {
            viewModeIds: {
                value: ['view-mode-line-grain', 'view-mode-fill-grain',
                    'view-mode-over-grain', 'view-mode-over-warp']
            },
            viewModeIconIds: {
                value: ['view-mode-line-grain-icon', 'view-mode-fill-grain-icon',
                    'view-mode-over-grain-icon', 'view-mode-over-warp-icon']
            },
            editModeIds: {
                value: ['select-tool', 'template-tool', 'click-delete-tool',
                    'stitch1-tool', 'stitch2-tool', 'stitch3-tool', 'stitch4-tool', 'stitch5-tool', 'stitch6-tool',
                    'stitch7-tool', 'stitch8-tool', 'stitch9-tool', 'stitchn-tool',
                    'paste-tool', 'bounds-tool', 'points-select-tool',
                    'pivot-insert-tool', 'pivot-delete-tool']
            },
            templatesSizeIds: {
                value: ['templates-small-tool', 'templates-medium-tool', 'templates-large-tool']
            },
            specialDialogs: {
                value: ['templates', 'templates-fp']
            },
        });
        this.view = view;
        this.gridManager = view.gridManager;
        this.layerManager = view.layerManager;
        this.noticeManager = new NoticeManager();
        this.currentDialog = new Stack();
        this.currentPopup = null;
        this.localX = 0;
        this.localY = 0;
        this.inputType = "";
        this.eventDisableOwner = null;
        this.initColorPalette();
    }

    initParts() {
        // add events for click on tools button
        const handler = this.view.toolEventHandler;
        const tools = document.querySelectorAll('.is-button');
        for (let i = 0; i < tools.length; i++) {
            tools[i].addEventListener('click', handler, true);
        }
        const inputs = document.querySelectorAll('.input-value');
        for (const input of inputs) {
            input.addEventListener('focus', this.inputOnFocus, true);
            input.addEventListener('blur', this.inputOnBlur, true);
        }

        this.noticeManager.enableNoticeButton(false);

        this.addListener('template-file-input', 'change', this.view.cbFileInputForTemplateChanged);
        this.addListener('file-input', 'change', this.view.cbFileInputForFileChanged);
        this.addListener('save-name-input', 'keydown', this.view.cbFileNameInputKeydown);

        this.addListener('move-hori-offset', 'change', this.view.moveInputChanged);
        this.addListener('move-vert-offset', 'change', this.view.moveInputChanged);

        this.addListener('array-hori-count', 'change', this.view.cbArrayInputChanged);
        this.addListener('array-vert-count', 'change', this.view.cbArrayInputChanged);
        this.addListener('array-hori-spacing', 'change', this.view.cbArrayInputChanged);
        this.addListener('array-vert-spacing', 'change', this.view.cbArrayInputChanged);
        this.addListener('array-hori-offset', 'change', this.view.cbArrayInputChanged);
        this.addListener('array-vert-offset', 'change', this.view.cbArrayInputChanged);

        this.addListener('overlay', 'click', this.onClickOverlay);

        this.addListener('metadata-title', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-title-en', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-creation-date', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-author', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-license', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-keyword', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-description', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-version', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-copyright', 'keydown', this.view.cbMetadataKeydown);
        this.addListener('metadata-type', 'keydown', this.view.cbMetadataKeydown);

        const color = this.view.sashi.viewOption.stitchColor;
        const colorName = this.findColorName(color);
        this.setCurrentColor(colorName, color);

        const dropdowns = [
            ['layer-dropdown', 'layer-current-tool'],
            ['layer-menu-dropdown', 'layer-menu-tool'],
            ['view-mode-dropdown', 'view-mode-tool'],
            ['stitchn-dropdown', 'stitchn-tool'],
            ['katako-dropdown', 'katako-tool'],
            ['modoko-dropdown', 'modoko-tool'],
            ['notice-dropdown', 'notice-tool'],
            ['template-history-dropdown', 'template-history-tool'],
            ['stitch-color-dropdown', 'stitch-color-tool'],
            ['move-dialog', 'move-tool'],
            ['array-dialog', 'array-tool'],
        ];
        for (const [dropdownId, buttonId] of dropdowns) {
            const button = document.getElementById(buttonId);
            if (button) {
                const dropdown = document.getElementById(dropdownId);
                dropdown.style = 'left: ' + Math.floor(button.getBoundingClientRect().x) + 'px;';
            }
        }

        if (window.__TAURI__) {
            this.setDisplay('save-fp-name', false);
            this.setDisplay('save-as-storage-tool', false);
            this.setDisplay('open-from-storage-tool', false);
            this.setDisplay('pdf-export-storage-tool', false);
            this.remove('view-setting-open-from-toolbar-storage');
            this.remove('view-setting-save-from-toolbar-storage');
            this.setDisplay('view-setting-templates-dialog', true);
            this.setDisplay('auto-scroll-on-templates', true);
            this.setDisplay('templates-googledrive-row-name', false);
            this.setDisplay('templates-googledrive-row-folder', false);
            this.setDisplay('templates-context-download-tool', false);
            this.setDisplay('pdf-export-name-part', false);
            this.addListener('pdf-export-font-multibyte', 'click', (ev) => {
                window.__TAURI__.dialog.open({
                    multiple: false,
                    filters: [{
                        name: this.translate("Font"),
                        extensions: ['otf', 'ttf', 'ttc'],
                    }]
                }).then((selected) => {
                    if (selected) {
                        const name = selected.substring(selected.lastIndexOf(window.__TAURI__.path.sep) + 1);
                        const button = document.getElementById('pdf-export-font-multibyte');
                        button.value = name;
                        button.title = selected;
                    }
                });
            });
        } else {
            this.setDisplay('templates-context-open-tool', false);
            this.setDisplay('pdf-font', false);
            this.setDisplay('pdf-font-multibyte', false);
        }

        this.updateEditMode('select-tool');
    }

    resetInputType() {
        this.inputType = '';
    }

    /// Event handler when focus is in.
    /// Removes keydown events to make input working well on some input fields.
    inputOnFocus = (event) => {
        this.view.disableKeydownEvent();
    }

    /// Event handler when focus is out.
    inputOnBlur = (event) => {
        this.view.enableKeydownEvent();
    }

    /// Updates to match current state.
    update() {
        this.setActive('cursor-crosshair-tool', this.view.sashi.viewOption.crosshair);
        this.setActive('cursor-1to1-line-tool', this.view.sashi.viewOption.oneToOne);
        this.setActive('cursor-1to2-line-tool', this.view.sashi.viewOption.oneToTwo);
    }

    /// Translates text.
    translate(text) {
        return TT[text];
    }

    /// Translates some text in the UI.
    translateUI() {
        const tt = TT;
        for (const item of document.querySelectorAll('.is-button, .tool-label')) {
            const title = item.title;
            if (title == "") {
                const localized = tt[item.textContent];
                if (localized) {
                    item.textContent = localized;
                }
            } else {
                const localized = tt[title];
                if (localized) {
                    item.title = localized
                }
            }
        }
        for (const item of document.getElementsByTagName('input')) {
            const placeholder = item.placeholder;
            if (placeholder != '') {
                const localized = tt[placeholder];
                if (localized) {
                    item.placeholder = localized;
                }
            }
        }
    }

    addShortcutKeyLabel(keys, aliasMap) {
        const valueMap = new Map();
        for (const [key, value] of keys.entries()) {
            let keyString = key.toUpperCase();
            keyString = keyString.replace('CTRL-', 'Ctrl+');
            keyString = keyString.replace('ALT-', 'Alt+');
            keyString = keyString.replace('SHIFT-', 'Shift+');
            let shortcut = valueMap.get(value);
            if (shortcut) {
                keyString = shortcut + '/' + keyString;
            }
            valueMap.set(value, keyString);
        }
        for (const [key, value] of aliasMap.entries()) {
            const keyString = valueMap.get(value);
            if (keyString) {
                valueMap.set(key, keyString);
            }
        }

        const tools = document.querySelectorAll('.is-button');
        for (const entry of tools) {
            const sid = entry.id;
            let shortcut = valueMap.get(sid.substring(0, sid.length - 5));
            if (shortcut) {
                let title = entry.title;
                if (title == '') {
                    const span = document.getElementById(sid + '-key');
                    if (span) {
                        span.textContent = shortcut;
                    }
                } else {
                    entry.title = title + ' (' + shortcut + ')';
                }
            }
        }
    }

    getTemplateLocation() {
        const obj = {};
        obj.name = this.getValue('templates-name');
        if (this.getBoolValue('templates-local')) {
            obj.type = 'local';
        } else if (this.getBoolValue('templates-github')) {
            obj.type = 'cached';
            obj.backend_type = 'github';
            obj.user = this.getValue('templates-github-user');
            obj.repository = this.getValue('templates-github-repository');
            obj.subdirectory = this.getValue('templates-github-subdirectory');
        } else if (this.getBoolValue('templates-gitlab')) {
            obj.type = 'cached';
            obj.backend_type = 'gitlab';
            obj.projectid = this.getValue('templates-gitlab-projectid');
            obj.subdirectory = this.getValue('templates-gitlab-subdirectory');
        } else if (this.getBoolValue('templates-googledrive')) {
            obj.type = 'cached';
            obj.backend_type = 'googledrive';
            const pickerResult = this.view.pickerResult;
            obj.folder_name = pickerResult.name;
            obj.folderid = pickerResult.id;
        } else if (this.getBoolValue('templates-dropbox')) {
            obj.type = 'cached';
            obj.backend_type = 'dropbox';
            const pickerResult = this.view.pickerResult;
            obj.path = pickerResult.id;
        }
        return obj;
    }

    getStorageSelection() {
        const obj = {};
        obj.name = this.getValue('storage-selection-name-input');
        if (this.getBoolValue('storage-selection-googledrive')) {
            obj.backend_type = 'googledrive';
        } else if (this.getBoolValue('storage-selection-dropbox')) {
            obj.backend_type = 'dropbox';
        }
        return obj;
    }

    getTemplatesContainerSize() {
        const headersHeight = document.getElementById('templates-tab-headers').clientHeight;
        const templates = document.getElementById('templates');
        return [templates.offsetWidth, templates.offsetHeight - headersHeight - 53];
    }

    getPDFExportOptions() {
        return {
            fileName: this.getValue('pdf-export-name-input'),
            pageSize: this.getSelectedOption('pdf-export-paper-size'),
            landscape: this.getBoolValue('pdf-export-landscape'),
            leftMargin: this.getValue('pdf-export-margin-left'),
            rightMargin: this.getValue('pdf-export-margin-right'),
            topMargin: this.getValue('pdf-export-margin-top'),
            bottomMargin: this.getValue('pdf-export-margin-bottom'),
            useOutputBounds: this.getBoolValue('pdf-export-use-bounds'),
            gridNumber: this.getBoolValue('pdf-export-grid-number'),
            multibyteFont: this.getElementTitle('pdf-export-font-multibyte'),
        };
    }

    setPDFExportOptions(obj) {
        const pageSize = obj.pageSize;
        const selector = document.getElementById('pdf-export-paper-size');
        for (let index in selector.options) {
            if (selector.options[index].tagName == 'OPTION') {
                if (selector.options[index].textContent == pageSize) {
                    selector.selectedIndex = index;
                    break;
                }
            }
        }
        this.setBoolValue('pdf-export-landscape', obj.landscape);
        this.setValue('pdf-export-margin-left', obj.leftMargin);
        this.setValue('pdf-export-margin-right', obj.rightMargin);
        this.setValue('pdf-export-margin-top', obj.topMargin);
        this.setValue('pdf-export-margin-bottom', obj.bottomMargin);
        this.setBoolValue('pdf-export-use-bounds', obj.useOutputBounds);
        this.setBoolValue('pdf-export-grid-number', obj.gridNumber);
        if (window.__TAURI__) {
            const name = obj.multibyteFont.substring(obj.multibyteFont.lastIndexOf(window.__TAURI__.path.sep) + 1);
            this.setValue('pdf-export-font-multibyte', name);
            this.setElementTitle('pdf-export-font-multibyte', obj.multibyteFont);
        }
    }

    /// Initialize color paltette.
    initColorPalette() {
        const parent = document.getElementById('color-palette');
        let count = 0;
        let tr = null;
        for (const [name, color] of this.colors) {
            if (count == 0) {
                tr = document.createElement('tr');
                parent.appendChild(tr);
            }
            const td = document.createElement('td');
            tr.appendChild(td);
            const frame = document.createElement('div');
            td.appendChild(frame);
            frame.classList.add('color-frame', 'color-frame-in-table');
            frame.title = name;
            frame.addEventListener('click', this.colorClick);
            const button = document.createElement('div');
            frame.appendChild(button);
            button.classList.add('color-button');
            button.style.background = color;
            button.setAttribute('color-name', name);
            button.setAttribute('color', color);

            count += 1;
            if (count > 5) {
                count = 0;
            }
        }
    }

    /// Sets properties to UI from the object.
    setToolProperties(prefix, props, obj) {
        for (const [key, id, valueType] of props) {
            const value = obj[key];
            const itemId = `${prefix}-${id}`;
            switch (valueType) {
                case 'string':
                    this.setValue(itemId, value);
                    break;
                case 'integer':
                    this.setIntValue(itemId, value);
                    break;
                case 'float':
                    this.setFloatValue(itemId, value);
                    break;
                case 'boolean':
                    this.setBoolValue(itemId, value);
                    break;
                case 'select':
                    this.setSelectOption(itemId, value);
                    break;
                default:
                    break;
            }
        }
    }

    /// Reads properties from UI to the object.
    getToolProperties(prefix, props, obj) {
        for (const [key, id, valueType] of props) {
            const value = obj[key];
            const itemId = `${prefix}-${id}`;
            switch (valueType) {
                case 'string':
                    obj[key] = this.getValue(itemId);
                    break;
                case 'integer':
                    obj[key] = this.getIntValue(itemId);
                    break;
                case 'float':
                    obj[key] = this.getFloatValue(itemId);
                    break;
                case 'boolean':
                    obj[key] = this.getBoolValue(itemId);
                    break;
                case 'select':
                    obj[key] = this.getSelectOption(itemId);
                    break;
                default:
                    break;
            }
        }
    }

    setTitle(text, tooltip) {
        if (window.docs) {
            window.docs.setTitle(window, text, tooltip);
        } else {
            this.setText('document-title', text);
        }
    }

    setCanvasProperties(props) {
        this.setIntValue('canvas-size-hori-count', props['horiCount']);
        this.setIntValue('canvas-size-vert-count', props['vertCount']);
    }

    getCanvasProperties() {
        return {
            horiCount: this.getIntValue('canvas-size-hori-count'),
            vertCount: this.getIntValue('canvas-size-vert-count'),
        };
    }

    /// Color has been choosen.
    colorClick = (event) => {
        const [name, color] = event.target.classList.contains('color-frame') ?
            [event.target.firstChild.getAttribute('color-name'), event.target.firstChild.getAttribute('color')] :
            [event.target.getAttribute('color-name'), event.target.getAttribute('color')];
        this.view.chooseColor(name, color);
    }

    /// Returns color name defined in the color list. Empty string is returned if color is not found.
    findColorName(color) {
        for (const colorItem of this.colors) {
            if (colorItem[1] == color) {
                return colorItem[0];
            }
        }
        return '';
    }

    /// Sets current color.
    setCurrentColor(name, color) {
        const button = document.getElementById('stitch-color-button-tool');
        button.title = name;
        //button.style['background-color'] = color;
        button.style['background'] = color;
        button.setAttribute('color', color);
    }

    /// Returns current color.
    getCurrentColor() {
        const button = document.getElementById('stitch-color-button-tool');
        return button.getAttribute('color');
    }

    /// Updates coordinate value.
    updateCoordinate(x, y) {
        document.getElementById('x-coord').innerText = x.toString();
        document.getElementById('y-coord').innerText = y.toString();
        document.getElementById('x-local-coord').innerText = (x - this.localX).toString();
        document.getElementById('y-local-coord').innerText = (y - this.localY).toString();
    }

    /// Sets origin for local coordinate.
    setLocalOrigin(x, y) {
        this.localX = x;
        this.localY = y;
        this.updateCoordinate(x, y);
    }

    /// Selection has been changed.
    selectionChanged = (ev) => {
        const count = ev.count;
        const selected = count > 0;
        this.setDisabled('copy-copy-tool', !selected);
        this.setDisabled('copy-cut-tool', !selected);
        this.setDisabled('move-tool', !selected);
        this.setDisabled('context-copy-tool', !selected);
        this.setDisabled('context-cut-tool', !selected);
        this.setDisabled('array-tool', !selected);
        this.setDisabled('group-group-tool', count < 2);
        this.setDisabled('group-ungroup-tool', !selected);
        this.setDisabled('z-front-tool', !selected);
        this.setDisabled('z-front-step-tool', !selected);
        this.setDisabled('z-back-step-tool', !selected);
        this.setDisabled('z-back-tool', !selected);
        this.setDisabled('context-delete-tool', !selected);
        this.setDisabled('context-selection-as-template-tool', !selected);
        this.setDisabled('move-to-layer-tool',
            !(selected && !this.view.layerManager.hasGroupEdit()));
    }

    /// Broadcasted from the undo manager.
    undoStateChanged = () => {
        this.updateUndoState(this.view);
    }

    /// Updates undo state.
    updateUndoState(view) {
        this.setDisabled('undo-undo-tool', !view.sashi.undoManager.isUndoPossible());
        this.setDisabled('undo-redo-tool', !view.sashi.undoManager.isRedoPossible());
        this.setDisabled('context-undo-tool', !view.sashi.undoManager.isUndoPossible());
        this.setDisabled('context-redo-tool', !view.sashi.undoManager.isRedoPossible());
    }

    getArrayOptions() {
        return {
            'hori-count': this.getIntValue('array-hori-count'),
            'vert-count': this.getIntValue('array-vert-count'),
            'hori-spacing': this.getIntValue('array-hori-spacing'),
            'vert-spacing': this.getIntValue('array-vert-spacing'),
            'hori-offset': this.getIntValue('array-hori-offset'),
            'vert-offset': this.getIntValue('array-vert-offset'),
            'group': this.getBoolValue('array-group'),
        };
    }

    resetArrayOptions() {
        this.setIntValue('array-hori-count', 1);
        this.setIntValue('array-vert-count', 1);
        this.setIntValue('array-hori-spacing', 0);
        this.setIntValue('array-vert-spacing', 0);
        this.setIntValue('array-hori-offset', 0);
        this.setIntValue('array-vert-offset', 0);
        this.setBoolValue('array-group', false);
    }

    // todo, localize
    setViewMode(view, viewMode) {
        let activeId = null;
        let activeIconId = null;
        let title = null;
        switch (viewMode) {
            case view.viewModeLineGrain:
                activeId = 'view-mode-line-grain';
                activeIconId = 'view-mode-line-grain-icon';
                title = 'Line grain';
                break;
            case view.viewModeFillGrain:
                activeId = 'view-mode-fill-grain';
                activeIconId = 'view-mode-fill-grain-icon';
                title = 'Fill grain';
                break;
            case view.viewModeOverGrain:
                activeId = 'view-mode-over-grain';
                activeIconId = 'view-mode-over-grain-icon';
                title = 'Over grain';
                break;
            case view.viewModeOverWarp:
                activeId = 'view-mode-over-warp';
                activeIconId = 'view-mode-over-warp-icon';
                title = 'Over warp';
                break;
            default:
                break;
        }
        if (activeId) {
            for (const nid of this.viewModeIds) {
                this.setVisible(nid, nid == activeId);
            }
            for (const nid of this.viewModeIconIds) {
                this.setVisible(nid, nid == activeIconId);
            }
            document.getElementById('view-mode-tool').title = title;
        }
    }

    /// Sets edit mode.
    setEditMode(id, state, stitch = null) {
        const elementId = id == 'stitch-tool' && stitch != null ? `stitch${stitch}-tool` : id;
        for (const nid of this.editModeIds) {
            this.setActive(nid, false);
        }
        this.setActive(elementId, state);
    }

    /// Returns values for file save input.
    getSaveFileValue() {
        return {
            fileName: this.getValue('save-name-input'),
            boundsUse: this.getBoolValue('save-bounds-setting-use'),
            forPrinting: this.getBoolValue('save-for-printing'),
            noData: this.getBoolValue('save-no-data'),
            gridNumber: this.getBoolValue('save-grid-number'),
        };
    }

    getStorageSaveFileValue() {
        return {
            fileName: this.getValue('storage-fp-filename'),
            boundsUse: this.getBoolValue('storage-fp-save-bounds-setting-use'),
            forPrinting: this.getBoolValue('storage-fp-save-for-printing'),
            noData: this.getBoolValue('storage-fp-save-no-data'),
            gridNumber: this.getBoolValue('storage-fp-grid-number'),
        };
    }

    clearStorageFileName() {
        this.setValue('storage-fp-filename', '');
    }

    /// Shows file name input.
    showSaveNameInput(defaultName, boundsUse) {
        const id = 'save-name-input';
        this.setValue(id, defaultName ? defaultName : '');
        this.setBoolValue('save-bounds-setting-use', boundsUse);
        this.showDialog('save-fp-dialog', id);
    }

    /// Shows name input.
    showNameInput(defaultText, title = '', type = '') {
        const id = 'name-input';
        this.inputType = type;
        this.setText('name-input-title', this.translate(title));
        this.setValue(id, defaultText);
        this.showDialog('input-dialog', id);
    }

    setInputMessage(message) {
        const id = 'name-input';
        this.setText('name-input-message', this.translate(message));
    }

    /// Shows message.
    showMessage(text, title = '', type = '') {
        const id = 'msgbox-text';
        this.inputType = type;
        this.setText('msgbox-title', this.translate(title));
        const s = this.translate(text);
        this.setText(id, (s ? s : text));
        this.showDialog('msgbox-dialog');
    }

    /// Returns value of name input.
    getNameValue() {
        const id = 'name-input';
        return this.getValue(id);
    }

    /// Returns current type of input.
    getInputType() {
        return this.inputType;
    }

    getCanvasSizeBase() {
        const names = [
            'base-top-left', 'base-top-right',
            'base-center',
            'base-bottom-left', 'base-bottom-right',
        ];
        for (const name of names) {
            if (this.getBoolValue(name)) {
                return name;
            }
        }
        return '';
    }

    isCurrentDialog(id) {
        return id == this.currentDialog.last();
    }

    showDialog(id, focusId = null) {
        this.setVisible(id, true);
        this.currentDialog.push(id);
        if (focusId) {
            this.focusElement(focusId);
        }
        this.showOverlay();
    }

    closeDialog(id) {
        if (this.isCurrentDialog(id)) {
            this.setVisible(id, false);
            this.currentDialog.pop();
            if (!this.currentDialog.has()) {
                this.hideOverlay();
            }
        }
    }

    /// Checks specified popup is shown now.
    isCurrentPopup(id) {
        return id == this.currentPopup;
    }

    /// Shows specified popup.
    showPopup(id, closeIfShown = true, focusId = null, context = false) {
        if (this.currentPopup !== null) {
            const isShown = this.currentPopup == id;
            if (isShown) {
                if (closeIfShown) {
                    this.closeAnyPopup();
                }
                return;
            } else {
                this.closeAnyPopup();
            }
        }
        const element = document.getElementById(id);
        if (element) {
            this.setVisibleElement(element, true);
            this.currentPopup = id;
            if (focusId !== null) {
                const focusElement = document.getElementById(focusId);
                if (focusElement) {
                    focusElement.focus();
                    focusElement.select();
                }
            }
            if (context) {
                window.addEventListener('mouseup', this.onMouseUpForTemplates);
            }
            this.showOverlay();
        }
    }

    /// Closes only specified drop down.
    closePopup(id) {
        if (this.currentPopup == id) {
            this.setVisible(id);
            this.currentPopup = null;
            window.removeEventListener('mouseup', this.onMouseUpForTemplates);
            if (!this.currentDialog.has()) {
                this.hideOverlay();
            }
        }
    }

    /// Closes any popup shown now.
    closeAnyPopup() {
        if (this.currentPopup !== null) {
            this.setVisible(this.currentPopup);
            this.currentPopup = null;
            window.removeEventListener('mouseup', this.onMouseUpForTemplates);
            if (!this.currentDialog.has()) {
                this.hideOverlay();
            }
        }
    }

    /// Shows context menu at the specified position.
    showContextMenu = (id, position, showGroupMenu = true) => {
        this.setDisplay('context-group-menu', showGroupMenu);
        const menu = document.getElementById(id);
        menu.style.left = position.x + 'px';
        menu.style.top = position.y + 'px';
        this.showPopup(id);
    }

    showTemplatesItemDropdown(id, position) {
        this.closeAnyPopup();
        const menu = document.getElementById(id);
        menu.style.left = position.x + 'px';
        menu.style.top = position.y + 'px';
        this.showPopup(id, true, null, true);
    }

    showTemplatesDropdown(id, position) {
        this.closeAnyPopup();
        const menu = document.getElementById(id);
        menu.style.left = position.x + 'px';
        menu.style.top = position.y + 'px';
        this.showPopup(id, true, null, true);
    }

    onMouseUpForTemplates = (ev) => {
        if (ev.button == 0) {
            this.closeAnyPopup();
        }
    }

    showOverwriteDialog(id, name) {
        this.setText('overwrite-name', name);
        this.setVisible(id, true);
        this.currentDialog.push(id);
        this.showOverlay();
    }

    hideOverwriteDialog(id) {
        this.setVisible(id, false);
        this.currentDialog.pop();
        if (!this.currentDialog.has()) {
            this.hideOverlay();
        }
    }

    setVisibleEntryTool(state) {
        this.setDisplay('templates-item-rename-tool', state);
        this.setDisplay('templates-item-duplicate-tool', state);
    }

    /// Clipboard content changed.
    updateCopyAndPasteState = (ev) => {
        const valid = ev.valid;
        this.setDisabled('copy-paste-tool', !valid);
        this.setDisabled('context-paste-tool', !valid);
    }

    updateEditMode = (mode) => {
        if (mode == 'template-tool') {
            this.setDisabled('template-hmirror-tool', false);
            this.setDisabled('template-vmirror-tool', false);
            this.setDisabled('template-hvmirror-tool', false);
        } else {
            this.setDisabled('template-hmirror-tool', true);
            this.setDisabled('template-vmirror-tool', true);
            this.setDisabled('template-hvmirror-tool', true);
        }
    }

    /// Updates layer switcher.
    updateLayers() {
        const layersDOM = document.getElementById('layers');
        {
            // Clear layers container.
            let element = layersDOM;
            while (element.lastElementChild) {
                element.lastElementChild.remove();
            }
        }

        const addElement = (name, index, groupIndex = null) => {
            const element = document.createElement('div');
            element.textContent = name;
            element.classList.add('tool', 'is-button', 'layer-entry');
            element.setAttribute('index', index);
            if (groupIndex !== null) {
                element.setAttribute('group-index', groupIndex);
            }
            element.onclick = this.layerChoose;
            layersDOM.appendChild(element);
        };

        const addGroups = (parentIndex) => {
            const currentEditGroup = this.layerManager.getCurrentEditGroup();
            for (let i = 0; i < editGroups.length; i++) {
                const group = editGroups[i];
                const name = ' '.repeat() + (group === currentEditGroup ? "・" : "") + 'group-' + group.id;
                addElement(name, parentIndex, i);
            }
        };

        let addGroup = false;
        const editGroups = this.layerManager.getEditGroups();
        const groupParent = editGroups.length > 0 ? editGroups[0].parent : null;
        if (groupParent) {
            if (this.layerManager.getRootLayer() == groupParent) {
                addGroups(-1);
            } else {
                addGroup = true;
            }
        }

        const activeLayer = this.layerManager.getActiveLayer(false);
        let index = 0;
        for (const layer of this.layerManager.getUserLayers()) {
            const name = (layer == activeLayer && !addGroup) ? "・" + layer.name : layer.name;
            addElement(name, index);
            if (addGroup && layer == groupParent) {
                addGroups(index);
                addGroup = false;
            }
            index += 1;
        }

        if (layersDOM.children.length == 0) {
            const layer = this.layerManager.getRootLayer();
            addElement(layer.name, -1);
        }

        // update indicator for current layer
        if (!this.layerManager.hasGroupEdit()) {
            this.setCurrentLayerName(activeLayer.name);
        }
    }

    setCurrentLayerName(name) {
        const div = document.getElementById('layer-current-name');
        div.textContent = name;
    }

    /// Layer switcher has been changed.
    layerChoose = (ev) => {
        const index = parseInt(ev.target.getAttribute('index'));
        this.layerManager.setActiveLayerByIndex(index);
        this.closeAnyPopup();
    }

    /// Active layer has been changed.
    activeLayerChanged = (ev) => {
        const name = ev.layer.data.asLayer ? ev.layer.name : ' group-' + ev.layer.id;
        this.setCurrentLayerName(name);
        this.updateLayerState();
        this.view.activeLayerChanged();
    }

    /// Updates layer state.
    updateLayerState() {
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            const isLayer = layer.data.asLayer;
            this.setVisible('layer-visible-part', layer.visible);
            this.setVisible('layer-hidden-part', !layer.visible);
            this.setVisible('layer-lock-part', layer.locked);
            this.setVisible('layer-unlock-part', !layer.locked);
            this.setDisabled('layer-lock-tool', !isLayer);
            this.setDisabled('layer-visible-tool', !isLayer);
        }
    }

    /// Sets layer is visible state or not.
    setLayerVisible(state) {
        this.setVisible('layer-visible-part', state);
        this.setVisible('layer-hidden-part', !state);
    }

    /// Sets layer is locked state or not.
    setLayerLock(state) {
        this.setVisible('layer-lock-part', state);
        this.setVisible('layer-unlock-part', !state);
    }

    /// Tries to find parent item without id.
    findToolDivParent = (node) => {
        if (node != null) {
            if (node.tagName == 'DIV' && node['id'] != '') {
                return node;
            } else {
                return this.findToolDivParent(node.parentNode);
            }
        } else {
            return null;
        }
    }

    onClickOverlay = (ev) => {
        if (this.currentPopup && !this.currentPopup.endsWith('-dialog')) {
            this.closeAnyPopup();
            this.view.enableEvents();
        }
    }

    showContentOverlay() {
        const CLASS_NAME = 'overlay-hidden';
        const element = document.getElementById('content-overlay');
        element.classList.remove(CLASS_NAME);
    }

    hideContentOverlay() {
        const CLASS_NAME = 'overlay-hidden';
        const element = document.getElementById('content-overlay');
        element.classList.add(CLASS_NAME);
    }

    showOverlay() {
        const CLASS_NAME = 'overlay-hidden';
        const element = document.getElementById('overlay');
        element.classList.remove(CLASS_NAME);
    }

    hideOverlay() {
        const CLASS_NAME = 'overlay-hidden';
        const element = document.getElementById('overlay');
        element.classList.add(CLASS_NAME);
    }

    enableViewEvent(owner) {
        if (owner == this.eventDisableOwner) {
            this.eventDisableOwner = null;
            this.view.enableEvents();
        }
    }

    disableViewEvent(owner) {
        if (!this.eventDisableOwner) {
            this.eventDisableOwner = owner;
            this.view.disableEvents();
        }
    }

    showSpecialDialog(id, focusId = null) {
        this.closeAnyPopup();
        this.disableViewEvent(id);
        this.showOverlay();
        this.setVisible(id, true);
        if (focusId) {
            this.focusElement(focusId);
        }
    }

    hideSpecialDialog(id) {
        this.closeAnyPopup();
        if (id == 'templates-fp') {
            this.closeDialog('templates-add-location-dialog');
        }
        if (!this.currentDialog.has()) {
            this.hideOverlay();
        }
        this.setVisible(id, false);
        this.enableViewEvent(id);
    }

    closeSpecialDialogs() {
        for (const name of this.specialDialogs) {
            if (this.isVisible(name)) {
                this.hideSpecialDialog(name);
            }
        }
    }

    getCurrentTemplateLocation() {
        const selector = document.getElementById('templates-fp-templates');
        const index = selector.selectedIndex;
        if (index >= 0) {
            return selector.childNodes[index].getAttribute('locationid');
        } else {
            return null;
        }
    }

    addTemplateName(value, locationId) {
        const selector = document.getElementById('templates-fp-files');
        const currentLocationId = this.getCurrentTemplateLocation();
        if (currentLocationId == locationId) {
            const name = value.name;
            const option = this.addOption(selector, name);
            option.setAttribute('key', value.key);
        }
    }

    addTemplateNames(values, locationId, isDownward) {
        const selector = document.getElementById('templates-fp-files');
        const currentLocationId = this.getCurrentTemplateLocation();
        if (currentLocationId == locationId) {
            if (!isDownward) {
                values.reverse();
            }
            for (const value of values) {
                const name = value.name;
                const option = this.addOption(selector, name);
                option.setAttribute('key', value.key);
            }
        }
    }

    showDropboxLocation(state) {
        this.setDisplay('templates-dropbox-row-type', state);
        this.setDisplay('templates-dropbox-row-folder', state);
    }

    showDropboxStorage(state) {
        this.setDisplay('storage-selection-dropbox-row', state);
    }

    setLayerList(names) {
        this.clearSelector('layer-list');
        const selector = document.getElementById('layer-list');
        for (let index in names) {
            const name = names[names.length - index - 1];
            this.addOption(selector, name);
        }
        if (names.length > 0) {
            selector.selectedIndex = 0;
        }
    }

    getSelectedLayerIndex() {
        const selector = document.getElementById('layer-list');
        const index = selector.selectedIndex;
        return selector.options.length - index - 1;
    }
}

export class NoticeManager extends ElementTool {
    constructor() {
        super();
        this.notices = document.getElementById('notices');
    }

    showNotices(show = null) {
        const noticeDropdown = document.getElementById('notice-dropdown');
        let state = show;
        if (show === null) {
            state = noticeDropdown.classList.contains('is-hidden');
        }
        this.setVisibleElement(noticeDropdown, state);
    }

    addNotice(element) {
        this.notices.appendChild(element);
        this.enableNoticeButton(true);
        this.showNotices(true);
    }

    removeNotice(id) {
        for (const element of this.notices.childNodes) {
            if (element.id == id) {
                element.remove();
            }
        }
        this.enableNoticeButton(false);
    }

    getNotice(id) {
        for (const element of this.notices.childNodes) {
            if (element.id == id) {
                return element;
            }
        }
        return null;
    }

    enableNoticeButton(state) {
        this.setDisabled('notice-tool', !state);
    }

    createAuthElement(id, text) {
        const div = document.createElement('div');
        div.id = id;
        div.classList.add('notice-item');
        const span = document.createElement('span');
        span.textContent = text;
        div.appendChild(span);
        const br = document.createElement('br');
        div.appendChild(br);

        const signInButton = this.addButton(div, 'Sign in');
        signInButton.id = `${id}-signin`;
        signInButton.disabled = true;
        const signOutButton = this.addButton(div, 'Sign out');
        signOutButton.id = `${id}-signout`;
        signOutButton.disabled = true;
        signOutButton.classList.add('signout-button');

        return [div, signInButton, signOutButton];
    }

    getOrCreateAuthElement(id, text) {
        let state = false;
        let signIn, signOut;
        let notice = this.getNotice(id);
        if (notice) {
            for (const item of notice.childNodes) {
                if (item.id == id + '-signin') {
                    signIn = item;
                } else if (item.id == id + 'signout') {
                    signOut = item;
                }
            }
            state = true;
        } else {
            const [element, signInButton, signOutButton] = this.createAuthElement(id, text);
            notice = element;
            signIn = signInButton;
            signOut = signOutButton;
            this.addNotice(notice);
        }
        return [notice, signIn, signOut, state];
    }
}
