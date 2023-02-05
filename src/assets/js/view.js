
import { Clipboard } from "./clipboard.js";
import { SelectionManager } from "./selection.js";
import { ToolManager } from "./tool.js";
import { Template, TemplateGenerator } from "./template.js";
import {
    GridOptionForPrinting, GridOptionForView, OutputOptionForDisplay, OutputOptionForPrinting,
    ViewOption
} from "./option.js";
import { BoundsManager } from "./bounds.js";
import { Preview } from "./preview.js";
import { TemplatesWindow } from "./templates.js";
import { TemplateHistoryManager } from "./template_history.js";
import { TemplateFilePicker } from "./template_fp.js";
import {
    getURL, startDownloadForData,
    openTemplate, openData, openFileFromStorage, openURL, pdflibLoader,
    getLang, openSome
} from "./tools.js";
import { Sashi } from "./sashi.js";
import { CursorManager } from "./cursor.js";
import { ShortcutManager, ShortcutWindow } from "./shortcut.js";
import { FilePicker } from "./picker.js";
import { Storage } from "./storage.js";
import { googleapiLoader } from "./backend_googledrive.js";
import { isInDropbox } from "./backend_dropbox.js";
import { PDFExport } from "./pdf.js";
import { PROJECT } from "./project.js";
import { Normalizer } from "./normalize.js";


function copyValues(target, source, props) {
    for (const [key, id, valueType] of props) {
        target[key] = source[key];
    }
    return target;
}

function compareProperties(older, newer, props) {
    for (const name of props) {
        if (older[name] != newer[name]) {
            return true;
        }
    }
    return false;
}

export class View extends Preview {
    /**
     * Constructor.
     *
     * @param {Sashi} sashi
     * @param {Object} viewOption
     */
    constructor(sashi, viewOption) {
        super(sashi, viewOption);

        Object.defineProperties(this, {
            editModeSelect: { value: 0 },
            editModeStitch: { value: 1 },
            editModeTemplate: { value: 2 },
            editModePreview: { value: 3 },
            editModeClickDelete: { value: 4 },
            editModeMovement: { value: 7 },
            editModeOutputBounds: { value: 8 },
            editModeMultiplePointsSelection: { value: 9 },
            editModePivotInsert: { value: 10 },
            editModePivotDelete: { value: 11 },
        });
        const editModes = new Map([
            [this.editModeSelect, 'select-tool'],
            [this.editModeStitch, 'stitch-tool'],
            [this.editModeTemplate, 'template-tool'],
            [this.editModePreview, 'preview-tool'],
            [this.editModeClickDelete, 'click-delete-tool'],
            [this.editModeMovement, ''],
            [this.editModeOutputBounds, 'bounds-tool'],
            [this.editModeMultiplePointsSelection, 'points-select-tool'],
            [this.editModePivotInsert, 'pivot-insert-tool'],
            [this.editModePivotDelete, 'pivot-delete-tool'],
        ]);
        Object.defineProperties(this, {
            editModes: { value: editModes },
        });
        Object.defineProperties(this, {
            mouseDragModeNone: { value: 0 },
            mouseDragModeSelection: { value: 1 },
            mouseDragModeMovement: { value: 2 },
            mouseDragModePan: { value: 3 },
            mouseDragModeBoundsEdit: { value: 4 },
        });
        Object.defineProperties(this, {
            ZoomStep: { value: 1.1 },
            ZoomMin: { value: 0.1 },
            ZoomMax: { value: 6.0 },
        });

        this.layerManager = sashi.layerManager;
        this.templateHistory = new TemplateHistoryManager(this);
        this.templatesWindow = new TemplatesWindow(this, sashi.templateManager);
        this.templateFilePicker = new TemplateFilePicker(this); // needs toolManager
        /** @type {ToolManager} */
        this.toolManager = new ToolManager(this);
        this.sashi.undoManager.addListener(this.toolManager.undoStateChanged);
        this.sashi.layerManager.addListener(this.toolManager.activeLayerChanged);

        this.editMode = this.editModeSelect;
        this.template = new Template();

        this.selectionManager = new SelectionManager(this.sashi.layerManager, this.sashi.viewOption);
        this.selectionManager.addListener(this.toolManager.selectionChanged);
        this.selectionManager.broadcast();
        this.selectionManager.addListener(this.selectionChanged);

        // to be updated when user click some mouse buttons
        this.mouseLastLocation = new paper.Point(0, 0);
        this.mouseDragStart = new paper.Point(0, 0);
        this.mouseButtons = 0;
        this.mouseDragStarted = false;
        this.mouseDragMode = this.mouseDragModeNone;

        this._init();

        this.clipboard = window.docs ? window.docs.clipboard : new Clipboard();
        this.clipboard.addListener(this.toolManager.updateCopyAndPasteState);
        this.clipboard.broadcast();

        this.gridManager.setGridChangedListener(this.cbGridChanged);
        this.prepareGrid();
        this.cursorManager = new CursorManager(this);

        this.toolManager.setViewMode(this, this.viewMode);
        this.toolManager.setEditMode(this.editModes.get(this.editMode), true, this.stitchLength);
        this.toolManager.updateUndoState(this);
        this.toolManager.updateLayers();
        this.toolManager.updateLayerState();

        this.boundsManager = new BoundsManager(this, this.sashi.boundsSetting);
        this.boundsManager.update();
        if (this.sashi.boundsSetting.useOutputBounds) {
            this.boundsManager.drawOutputBounds(this, false);
        }

        window.addEventListener('resize', this.onResize);
        // Supports drag and drop to open files, both drop and dragover events are required
        this.sashi.canvas.addEventListener('drop', this.onDrop);
        this.sashi.canvas.addEventListener('dragover', this.onDragover);

        if (getLang() == 'jp') {
            this.toolManager.translateUI();
            const hasTemplatesSetting = this.sashi.settingsManager.hasSetting('templates.', 'locations');
            if (!hasTemplatesSetting) {
                const locations = this.sashi.templatesSetting.locations;
                try {
                    if (locations[0] && locations[0].name == 'Kogin') {
                        locations[0].name = TT['Kogin'];
                    }
                    if (locations[1] && locations[1].name == 'Hishi') {
                        locations[1].name = TT['Hishi'];
                    }
                    if (locations[2] && locations[2].name == 'Local') {
                        locations[2].name = TT['Local'];
                    }
                } catch (e) {
                }
            }
        }

        const aliasMap = new Map();
        for (const [key, value] of Object.entries(this.operations)) {
            if (typeof key == 'string' && typeof value == 'string') {
                aliasMap.set(key, value);
            }
        }
        this.toolManager.addShortcutKeyLabel(this.shortcutKeys, aliasMap);
    }

    defaultShortcutKeys() {
        // do not add any key combination to value
        const keys = new Map([
            ['ctrl-a', 'select-all'],
            ['ctrl-b', 'template-vmirror'],
            ['c', 'modoko'],
            ['ctrl-c', 'copy-copy'],
            ['d', 'pivot-previous'],
            ['ctrl-d', 'save-as-storage'],
            ['e', 'click-delete'],
            ['ctrl-e', 'open-from-storage'],
            ['f', 'pivot-next'],
            ['g', 'group-group'],
            ['ctrl-g', 'metadata'],
            ['h', 'kata-increment'],
            ['ctrl-h', 'template-hmirror'],
            ['j', 'move'],
            ['k', 'katako'],
            ['m', 'modoko'],
            ['ctrl-m', 'new'],
            ['n', 'kata-decrement'],
            ['ctrl-o', 'open'],
            ['ctrl-shift-o', 'open-template'],
            ['ctrl-p', 'normalized'],
            ['r', 'template-history'],
            ['s', 'stitch-mode'],
            ['ctrl-s', 'save'],
            ['ctrl-shift-s', 'save-as'],
            ['t', 'template'],
            ['ctrl-t', 'solve-overlapping'],
            ['u', 'grid'],
            ['ctrl-u', 'template-hvmirror'],
            ['v', 'select'],
            ['ctrl-v', 'copy-paste'],
            ['w', 'array'],
            ['x', 'katako'],
            ['ctrl-x', 'copy-cut'],
            ['y', 'save-as-template'],
            ['ctrl-y', 'undo-redo'],
            ['z', 'group-ungroup'],
            ['ctrl-z', 'undo-undo'],
            [' ', 'set-local-origin'],
            ['arrowleft', 'move-left'],
            ['arrowright', 'move-right'],
            ['arrowup', 'move-up'],
            ['arrowdown', 'move-down'],
            ['delete', 'selection-delete'],
            ['backspace', 'selection-delete'],
            ['escape', 'escape-all'],
            ['1', 'stitch1'],
            ['2', 'stitch2'],
            ['3', 'stitch3'],
            ['4', 'stitch4'],
            ['5', 'stitch5'],
            ['6', 'stitch6'],
            ['7', 'stitch7'],
            ['8', 'stitch8'],
            ['9', 'stitch9'],
            ['ctrl-1', 'stitch1'],
            ['ctrl-2', 'stitch2'],
            ['ctrl-3', 'stitch3'],
            ['ctrl-4', 'stitch4'],
            ['ctrl-5', 'stitch5'],
            ['ctrl-6', 'stitch6'],
            ['ctrl-7', 'stitch7'],
            ['ctrl-8', 'stitch8'],
            ['ctrl-9', 'stitch9'],
            ['alt-1', 'stitch1'],
            ['alt-2', 'stitch2'],
            ['alt-3', 'stitch3'],
            ['alt-4', 'stitch4'],
            ['alt-5', 'stitch5'],
            ['alt-6', 'stitch6'],
            ['alt-7', 'stitch7'],
            ['alt-8', 'stitch8'],
            ['alt-9', 'stitch9'],
        ]);
        if (window.__TAURI__) {
            const subst = [
            ];
            for (const [target, repl] of subst) {
                const value = keys.get(target);
                if (value) {
                    keys.set(repl, value);
                }
                keys.delete(target);
            }
        }
        return keys;
    }

    _init() {
        this.shortcutKeys = ShortcutManager.load();
        if (this.shortcutKeys.size == 0) {
            this.shortcutKeys = this.defaultShortcutKeys();
        }
        // Commands and shortcuts.
        // - context- and -tool are removed before matching.
        // - string can be used to specify shortcut
        this.operations = {
            // + ctrl gives 5 grid movement?
            'move-left': () => this.moveSelection(-1, 0),
            'move-right': () => this.moveSelection(1, 0),
            'move-up': () => this.moveSelection(0, -1),
            'move-down': () => this.moveSelection(0, 1),
            'selection-delete': () => this.selectionDelete(),
            'escape-all': () => {
                // close dialogs and back to select mode
                const previousMode = this.editMode;
                this.setEditMode(this.editModeSelect);
                this.toolManager.closeAnyPopup();
                if (this.selectionManager.hasPoints()) {
                    this.selectionManager.clearPoints();
                    this.selectionManager.clearPointsSelection();
                    this.update();
                } else if (previousMode == this.editModeSelect &&
                    this.selectionManager.hasSelection()) {
                    this.selectionManager.clear();
                    this.update();
                }
            },
            'stitch-mode': () => this.setEditMode(this.editModeStitch),
            stitch: (strSize, index) => {
                if (strSize) {
                    const size = typeof strSize == 'string' ? parseInt(strSize, 10) : strSize;
                    if (size > 0) {
                        this.setStitchLength(size, false, false);
                    }
                }
                this.toolManager.closePopup('stitchn-dropdown');
            },
            stitch1: (ctrl, alt) => this.setStitchLength(1, ctrl, alt),
            stitch2: (ctrl, alt) => this.setStitchLength(2, ctrl, alt),
            stitch3: (ctrl, alt) => this.setStitchLength(3, ctrl, alt),
            stitch4: (ctrl, alt) => this.setStitchLength(4, ctrl, alt),
            stitch5: (ctrl, alt) => this.setStitchLength(5, ctrl, alt),
            stitch6: (ctrl, alt) => this.setStitchLength(6, ctrl, alt),
            stitch7: (ctrl, alt) => {
                this.setStitchLength(7, ctrl, alt);
                this.toolManager.closePopup('stitchn-dropdown');
            },
            stitch8: (ctrl, alt) => {
                this.setStitchLength(8, ctrl, alt);
                this.toolManager.closePopup('stitchn-dropdown');
            },
            stitch9: (ctrl, alt) => {
                this.setStitchLength(9, ctrl, alt);
                this.toolManager.closePopup('stitchn-dropdown');
            },
            stitchn: () => this.toolManager.showPopup('stitchn-dropdown'),
            stitchnn: (ctrl, alt) => {
                if (this.toolManager.isActiveElement('stitchn-input-value')) {
                    return;
                }
                const length = this.toolManager.getIntValue('stitchn-input-value');
                if (1 <= length) {
                    this.setStitchLength(length, ctrl, alt);
                }
                this.toolManager.closePopup('stitchn-dropdown');
            },
            'stitch1-moved': 'stitch1',
            'stitch2-moved': 'stitch2',
            'stitch3-moved': 'stitch3',
            'stitch4-moved': 'stitch4',
            'stitch5-moved': 'stitch5',
            'stitch6-moved': 'stitch6',
            'kataxsized': () => {
                const inputName = 'katax-input-value';
                if (this.toolManager.isActiveElement(inputName)) {
                    return;
                }
                const rows = this.toolManager.getIntValue(inputName);
                this.toolManager.closePopup('stitchn-dropdown');
                this.fireCommandWithArgs('katax', [rows, 0]);
            },
            'katax': (rows, index) => this.prepareXorV('X', rows, index),
            'katavsized': () => {
                const inputName = 'katav-input-value';
                if (this.toolManager.isActiveElement(inputName)) {
                    return;
                }
                const rows = this.toolManager.getIntValue(inputName);
                this.toolManager.closePopup('stitchn-dropdown');
                this.fireCommandWithArgs('katav', [rows, 0]);
            },
            'katav': (rows, index) => this.prepareXorV('V', rows, index),
            'katareversevsized': () => {
                const inputName = 'katareversev-input-value';
                if (this.toolManager.isActiveElement(inputName)) {
                    return;
                }
                const rows = this.toolManager.getIntValue(inputName);
                this.toolManager.closePopup('stitchn-dropdown');
                this.fireCommandWithArgs('katareversev', [rows, 0]);
            },
            'katareversev': (rows, index) => this.prepareXorV('reverseV', rows, index),
            'modokosized': () => {
                // avoid click when input field is clicked to gain focus
                if (this.toolManager.isActiveElement('modoko-input-value')) {
                    return;
                }
                const size = this.toolManager.getIntValue('modoko-input-value');
                if (3 <= size && size % 2 == 1) {
                    this.fireCommand('modoko-' + size);
                }
            },
            modoko: (strSize, index) => {
                if (strSize) {
                    const size = typeof strSize == 'string' ? parseInt(strSize, 10) : strSize;
                    if (3 <= size && size % 2 == 1) {
                        const template = TemplateGenerator.Modoko(size);
                        this.setTemplate(template, this.editModeTemplate,
                            index ? index : 0);
                        this.toolManager.closePopup('modoko-dropdown');
                    }
                } else {
                    this.toolManager.showPopup('modoko-dropdown');
                }
            },
            'katakosized': () => {
                if (this.toolManager.isActiveElement('katako-input-value')) {
                    return;
                }
                const size = this.toolManager.getIntValue('katako-input-value');
                if (3 <= size && size % 2 == 1) {
                    this.fireCommand('katako-' + size);
                }
            },
            katako: (strSize, index) => {
                if (strSize) {
                    const size = typeof strSize == 'string' ? parseInt(strSize, 10) : strSize;
                    if (3 <= size && size % 2 == 1) {
                        const template = TemplateGenerator.Katako(size);
                        this.setTemplate(template, this.editModeTemplate,
                            index ? index : 0);
                        this.toolManager.closePopup('katako-dropdown');
                    }
                } else {
                    this.toolManager.showPopup('katako-dropdown');
                }
            },
            'modoko-moved': 'modoko',
            'katako-moved': 'katako',
            'kata-increment': () => {
                if (this.editMode == this.editModeTemplate) {
                    const type = this.template.getType();
                    if (type == 'modoko' || type == 'katako') {
                        const size = this.template.getSize();
                        if (size && size + 2 >= 3) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs(type, [size + 2, index]);
                        }
                    } else if (type == 'X' || type == 'V' || type == 'reverseV') {
                        const size = this.template.getSize();
                        if (size && size + 1 >= 2) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs('kata' + type.toLowerCase(), [size + 1, index]);
                        }
                    }
                } else if (this.editMode == this.editModeStitch) {
                    if (this.template.getType() == 'single') {
                        const size = this.template.getSize();
                        if (size && size + 1 >= 0) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs('stitch', [size + 1, index]);
                        }
                    }
                }
            },
            'kata-decrement': () => {
                if (this.editMode == this.editModeTemplate) {
                    const type = this.template.getType();
                    if (type == 'modoko' || type == 'katako') {
                        const size = this.template.getSize();
                        if (size && size - 2 >= 3) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs(type, [size - 2, index]);
                        }
                    } else if (type == 'X' || type == 'V' || type == 'reverseV') {
                        const size = this.template.getSize();
                        if (size && size - 1 >= 2) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs('kata' + type.toLowerCase(), [size - 1, index]);
                        }
                    }
                } else if (this.editMode == this.editModeStitch) {
                    if (this.template.getType() == 'single') {
                        const size = this.template.getSize();
                        if (size && size - 1 >= 0) {
                            const index = this.template.pivotGetIndex();
                            this.fireCommandWithArgs('stitch', [size - 1, index]);
                        }
                    }
                }
            },
            color: () => {
                const color = this.toolManager.getCurrentColor();
                this.selectionSetColor(color);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'stitchColor');
            },
            'z-front': () => this.changeZ('front'),
            'z-front-step': () => this.changeZ('front-step'),
            'z-back-step': () => this.changeZ('back-step'),
            'z-back': () => this.changeZ('back'),
            'set-local-origin': () => {
                const [x, y] = this.gridManager.pointToGrid(this.mouseLastLocation);
                this.toolManager.setLocalOrigin(x, y);
            },
            'local-origin': () => {
                const point = this.contextMenuPosition;
                // substract toolbar height
                point.y -= 32;
                const [x, y] = this.gridManager.pointToGrid(point);
                this.toolManager.setLocalOrigin(x, y);
                this.toolManager.closeAnyPopup();
            },
            'template': () => {
                if (this.checkForPermission()) {
                    return;
                }
                this.templatesWindow.prepareToOpen();
                this.toolManager.showSpecialDialog('templates');
            },
            'template-history': () => {
                if (this.checkForPermission()) {
                    return;
                }
                this.disableEvents();
                this.toolManager.showPopup('template-history-dropdown');
            },
            'template-history-close': () => {
                this.enableEvents();
                this.toolManager.closeAnyPopup();
            },
            'templates-choose': () => {
                this.templatesWindow.selectCurrentItem();
            },
            'templates-close': () => {
                this.templatesWindow.hide();
                this.toolManager.closeAnyPopup();
            },
            'templates-add-location': () => {
                if (isInDropbox()) {
                    this.toolManager.showDropboxLocation(true);
                }
                this.pickerResult = null;
                this.toolManager.showDialog(
                    'templates-add-location-dialog', 'templates-name');
            },
            'templates-add-location-ok': () => {
                if (!this.templatesWindow.addCurrentLocation()) {
                    this.toolManager.showMessage('Input name', 'Error');
                }
            },
            'templates-add-location-ok-close': () => this.toolManager.closeDialog('templates-add-location-dialog'),
            'templates-add-location-cancel': () => {
                this.toolManager.closeDialog('templates-add-location-dialog');
            },
            'templates-context-download': () => this.templatesWindow.downloadLocation(),
            'templates-context-open': () => this.templatesWindow.openLocation(),
            'templates-context-open-web': () => {
                console.log("openweb");
                this.templatesWindow.openWebLocation();
            },
            'templates-context-clear': () => {
                const name = this.templatesWindow.getNameForCurrentLocation();
                this.toolManager.showMessage(name,
                    'Clear location?', 'templates-context-clear');
            },
            'templates-context-reload': () => this.templatesWindow.reloadLocation(),
            'templates-context-remove': () => {
                const name = this.templatesWindow.getNameForCurrentLocation();
                this.toolManager.showMessage(name, 'Remove location', 'templates-remove');
            },
            'templates-context-rename': () => {
                const name = this.templatesWindow.getNameForCurrentLocation();
                this.toolManager.showNameInput(name, 'Input name', 'templates-location-name');
            },
            'templates-context-add-subfolder': () => {
                this.toolManager.showNameInput('', 'Input name', 'templates-location-add-subfolder');
            },
            'templates-context-add-new-file': () => {
                this.toolManager.showNameInput('', 'Input name', 'templates-location-add-new-file');
            },
            'templates-context-move-left': () => this.templatesWindow.moveTabLeft(),
            'templates-context-move-right': () => this.templatesWindow.moveTabRight(),
            'templates-context-information': () => this.templatesWindow.showLocationInformation(),
            'templates-small': () => this.templatesWindow.changeTemplateSize('small'),
            'templates-medium': () => this.templatesWindow.changeTemplateSize('medium'),
            'templates-large': () => this.templatesWindow.changeTemplateSize('large'),
            'templates-reload': () => this.templatesWindow.reloadAll(),
            'templates-filter-clear': () => this.templatesWindow.clearFilter(),
            'templates-item-edit': () => this.templatesWindow.editItem(),
            'templates-webitem-edit': 'templates-item-edit',
            'templates-item-duplicate': () => {
                const name = this.templatesWindow.getNameForActiveEntry();
                if (name) {
                    this.toolManager.showNameInput(name, 'Duplicate item', 'templates-item-duplicate-name');
                }
            },
            'templates-item-rename': () => {
                const name = this.templatesWindow.getNameForActiveEntry();
                if (name) {
                    this.toolManager.showNameInput(name, 'Input name', 'templates-item-name');
                }
            },
            'templates-item-download': () => this.templatesWindow.downloadItem(),
            'templates-webitem-download': 'templates-item-download',
            'templates-item-reload': () => this.templatesWindow.reloadItem(),
            'templates-item-remove': () => {
                const name = this.templatesWindow.getNameForActiveEntry();
                if (name) {
                    this.toolManager.showMessage(name, 'Remove item', 'templates-item-remove');
                }
            },
            'templates-folder-reload': () => {
                this.templatesWindow.reloadFolder();
            },
            'templates-folder-rename': () => {
                const name = this.templatesWindow.getCurrentFolder();
                this.toolManager.showNameInput(name, 'Input name', 'templates-folder-rename');
            },
            'templates-folder-remove': () => {
                const name = this.templatesWindow.getCurrentFolder();
                this.toolManager.showMessage(name, 'Remove folder', 'templates-folder-remove');
            },
            'templates-googledrive-folder': () => {
                googleapiLoader(() => {
                    this.picker = new FilePicker({
                        activeIndex: 0,
                        storages: [{
                            type: 'googledrive', name: 'Google Drive',
                            path: [{ id: 'root', name: '/' }],
                        }],
                    }, 'folder', this);
                    this.picker.mode = 'templates-googledrive-folder';
                    this.picker.prepare({ disableAddStorage: true, disableRemoveStorage: true });
                    this.toolManager.showSpecialDialog('storage-fp');
                });
            },
            'templates-dropbox-folder': () => {
                this.picker = new FilePicker({
                    activeIndex: 0,
                    storages: [{
                        type: 'dropbox', name: 'Dropbox',
                        path: [{ id: '/', name: '/' }],
                    }],
                }, 'folder', this);
                this.picker.mode = 'templates-dropbox-folder';
                this.picker.prepare({ disableAddStorage: true, disableRemoveStorage: true });
                this.toolManager.showSpecialDialog('storage-fp');
            },
            'overwrite-all-ok': () => {
                if (this.templatesWindow.overwriteManager) {
                    this.templatesWindow.overwriteManager.setOverwriteAll();
                }
                this.toolManager.hideOverwriteDialog('overwrite-dialog');
            },
            'overwrite-this-ok': () => {
                if (this.templatesWindow.overwriteManager) {
                    this.templatesWindow.overwriteManager.run(true);
                }
                this.toolManager.hideOverwriteDialog('overwrite-dialog');
            },
            'overwrite-skip-ok': () => {
                if (this.templatesWindow.overwriteManager) {
                    this.templatesWindow.overwriteManager.toNext();
                }
                this.toolManager.hideOverwriteDialog('overwrite-dialog');
            },
            'overwrite-skip-all-ok': () => {
                if (this.templatesWindow.overwriteManager) {
                    this.templatesWindow.overwriteManager.cancel();
                }
                this.toolManager.hideOverwriteDialog('overwrite-dialog');
            },
            'storage-selection-ok': () => {
                const data = this.toolManager.getStorageSelection();
                if (data.name == '') {
                    this.toolManager.showMessage('Input name', 'Select storage');
                } else {
                    this.toolManager.closeDialog('storage-selection-dialog');
                    this.picker.addCurrentStorage(data);
                }
            },
            'storage-selection-cancel': () => {
                this.toolManager.closeDialog('storage-selection-dialog');
            },
            'storage-fp-ok': () => {
                if (this.picker) {
                    const closePicker = (noStoreSettings = false) => {
                        this.toolManager.hideSpecialDialog('storage-fp');
                        this.picker.closed();
                        const pickerResult = this.picker.getResult();
                        if (!noStoreSettings) {
                            this.sashi.storeStoragesSettings(this.picker.settings);
                        }
                        this.picker = null;
                        return pickerResult;
                    };

                    if (this.picker.type == 'save' && !this.picker.overWriteConfirmed) {
                        // check overwrite
                        if (this.picker.checkNameConflict()) {
                            this.toolManager.showMessage('Overwrite file?', 'Confirm', 'storage-fp-save-overwrite');
                            return;
                        }
                    }

                    switch (this.picker.mode) {
                        case 'save-in-storage': {
                            const saveOp = this.toolManager.getStorageSaveFileValue();
                            if (saveOp.fileName || this.picker.isItemSelected()) {
                                const result = closePicker();
                                this.saveAsInStorage(result, saveOp, true);
                                this.toolManager.clearStorageFileName();
                            }
                            break;
                        }
                        case 'open-from-storage': {
                            if (this.picker.isItemSelected()) {
                                const result = closePicker();
                                this.openFromStorage(result.storageType, result.id, result.name);
                            }
                            break;
                        }
                        case 'templates-googledrive-folder': {
                            // current folder is valid selection
                            this.pickerResult = closePicker(true);
                            break;
                        }
                        case 'templates-dropbox-folder': {
                            this.pickerResult = closePicker(true);
                            break;
                        }
                        case 'pdf-export-storage': {
                            const saveOp = this.toolManager.getStorageSaveFileValue();
                            if (saveOp.fileName || this.picker.isItemSelected()) {
                                this.pickerResult = closePicker(true);
                                this.fireCommand('pdf-export-storage-option');
                            }
                            break;
                        }
                        default:
                            break;
                    }
                }
            },
            'storage-fp-cancel': () => {
                this.toolManager.hideSpecialDialog('storage-fp');
                if (this.picker) {
                    this.picker.closed();
                    this.picker = null;
                }
            },
            select: () => this.setEditMode(this.editModeSelect),
            'select-all': () => this.selectAll(),
            'points-select': () => this.setEditMode(this.editModeMultiplePointsSelection),
            'click-delete': () => this.setEditMode(this.editModeClickDelete),
            array: () => {
                if (this.selectionManager.hasSelection()) {
                    this.toolManager.closeAnyPopup();
                    this.toolManager.showDialog('array-dialog', 'array-count');
                    this.arrayPlacePreview();
                }
                return true;
            },
            'array-ok': () => {
                if (this.selectionManager.hasSelection()) {
                    const op = this.toolManager.getArrayOptions();
                    this.arraySelection(
                        op['hori-count'], op['vert-count'],
                        op['hori-spacing'], op['vert-spacing'],
                        op['hori-offset'], op['vert-offset'],
                        op['group']
                    );
                }
                this.setEditMode(this.editModeSelect);
                this.toolManager.closeDialog('array-dialog');
            },
            'array-cancel': () => {
                this.setEditMode(this.editModeSelect);
                this.clearPreviewLayerAndUpdate();
                this.toolManager.closeDialog('array-dialog');
            },
            'array-reset': () => {
                this.toolManager.resetArrayOptions();
                this.arrayPlacePreview();
            },
            move: () => {
                if (this.selectionManager.hasSelection()) {
                    this.toolManager.closeAnyPopup();
                    this.toolManager.showDialog('move-dialog', 'move-hori-offset');
                    this.movePrepare();
                }
                return true;
            },
            'move-ok': () => {
                if (this.selectionManager.hasSelection()) {
                    const dx = this.toolManager.getIntValue('move-hori-offset');
                    const dy = this.toolManager.getIntValue('move-vert-offset');
                    if (dx !== null && dy !== null) {
                        this.moveSelection(dx, dy);
                    }
                }
                this.setEditMode(this.editModeSelect);
                this.toolManager.closeDialog('move-dialog');
            },
            'move-cancel': () => {
                this.setEditMode(this.editModeSelect);
                this.clearPreviewLayerAndUpdate();
                this.toolManager.closeDialog('move-dialog');
            },
            menu: () => this.toolManager.showPopup('menu-dropdown'),
            'stitch-color-button': 'stitch-color',
            'stitch-color': () => {
                if (this.selectionManager.hasSelection()) {
                    const color = this.toolManager.getCurrentColor();
                    this.selectionSetColor(color);
                } else {
                    this.toolManager.showPopup('stitch-color-dropdown');
                }
                return true;
            },
            'stitch-color-dropdown': () => this.toolManager.showPopup('stitch-color-dropdown'),
            'context-group-group': 'group-group',
            'context-group-ungroup': 'group-ungroup',
            'group-group': () => this.makeGroupFromSelection(),
            'group-ungroup': () => this.dissolveSelectedGroup(),
            'pivot-insert': () => this.setEditMode(this.editModePivotInsert),
            'pivot-delete': () => this.setEditMode(this.editModePivotDelete),
            'pivot-next': () => this.nextPivot(),
            'pivot-previous': () => this.previousPivot(),
            'cursor-crosshair': () => {
                this.cursorManager.crosshairSwitchVisible(!this.sashi.viewOption.crosshair);
                this.toolManager.setActive('cursor-crosshair-tool', this.sashi.viewOption.crosshair);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'crosshair');
            },
            'cursor-1to1-line': () => {
                this.cursorManager.crosshairSwitchVisible(null, !this.sashi.viewOption.oneToOne);
                this.toolManager.setActive('cursor-1to1-line-tool', this.sashi.viewOption.oneToOne);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'oneToOne');
            },
            'cursor-1to2-line': () => {
                this.cursorManager.crosshairSwitchVisible(null, null, !this.sashi.viewOption.oneToTwo);
                this.toolManager.setActive('cursor-1to2-line-tool', this.sashi.viewOption.oneToTwo);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'oneToTwo');
            },
            'view-mode': () => this.toolManager.showPopup('view-mode-dropdown'),
            'view-mode-line-grain': () => {
                this.toolManager.closeAnyPopup();
                this.setViewMode(this.viewModeLineGrain);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'viewMode');
            },
            'view-mode-fill-grain': () => {
                this.toolManager.closeAnyPopup();
                this.setViewMode(this.viewModeFillGrain);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'viewMode');
            },
            'view-mode-over-grain': () => {
                this.toolManager.closeAnyPopup();
                this.setViewMode(this.viewModeOverGrain);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'viewMode');
            },
            'view-mode-over-warp': () => {
                this.toolManager.closeAnyPopup();
                this.setViewMode(this.viewModeOverWarp);
                this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'viewMode');
            },
            grid: () => {
                this.gridManager.switchVisible();
                this.toolManager.setActive('grid-tool', this.gridManager.isVisible());
                this.update();
            },
            'new-from-toolbar': 'new',
            'new': () => {
                this.toolManager.closeAnyPopup();
                openURL(getURL(), '_blank');
            },
            'open-from-menu': 'open',
            'open-from-toolbar': () => {
                let command = 'open';
                switch (this.sashi.viewOption.openFromToolbar) {
                    case 'storage': {
                        command = 'open-from-storage';
                        break;
                    }
                    case 'templates': {
                        command = 'open-template';
                        break;
                    }
                }
                googleapiLoader(() => {
                    this.fireCommand(command);
                });
            },
            open: () => {
                this.toolManager.closeAnyPopup();
                if (window.__TAURI__) {
                    window.__TAURI__.dialog.open({
                        multiple: false,
                        filters: [{
                            name: this.toolManager.translate("Kogin data"),
                            extensions: ['svg'],
                        }]
                    }).then((selected) => {
                        if (!Array.isArray(selected) && selected && selected.endsWith('.svg')) {
                            window.__TAURI__.invoke('file_read', { name: selected }).then((data) => {
                                this.openForData(data, selected);
                            }).catch((e) => {
                                console.log(e);
                            });
                        }
                    });
                } else {
                    document.getElementById('file-input').click();
                }
            },
            'open-template': () => {
                if (this.checkForPermission()) {
                    return;
                }
                this.templateFilePicker.updateSaveAsTemplateUI();
                this.templateFilePicker.show('open');
            },
            'open-from-storage': () => {
                if (this.checkForPermission()) {
                    return;
                }
                googleapiLoader(() => {
                    this.picker = new FilePicker(this.sashi.loadStorageSettings(), 'open', this);
                    this.picker.mode = 'open-from-storage';
                    this.picker.prepare();
                    this.toolManager.showSpecialDialog('storage-fp');
                });
            },
            'save-from-menu': () => {
                this.toolManager.closeAnyPopup();
                this.save();
            },
            'save-from-toolbar': 'save',
            save: () => {
                const saveType = this.sashi.viewOption.saveFromToolbar;
                if (saveType.endsWith('-save-as')) {
                    switch (saveType) {
                        case 'local-save-as': {
                            this.fireCommand('save-as');
                            break;
                        }
                        case 'storage-save-as': {
                            this.fireCommand('save-as-storage');
                            break;
                        }
                        case 'templates-save-as': {
                            this.fireCommand('save-as-template');
                            break;
                        }
                    }
                } else {
                    this.save()
                }
            },
            'save-as': () => {
                this.toolManager.closeAnyPopup();
                if (window.__TAURI__) {
                    let name = this.sashi.fileName;
                    name = name == '' ? 'untitled.svg' : name;
                    window.__TAURI__.dialog.save({
                        defaultPath: name,
                        filters: [{
                            name: this.toolManager.translate("Kogin data"),
                            extensions: ['svg'],
                        }]
                    }).then((selected) => {
                        if (selected) {
                            // store selected file name into hidden input
                            this.toolManager.showSaveNameInput(
                                selected,
                                this.sashi.boundsSetting.useOutputBounds);
                        }
                    });
                } else {
                    this.saveAs();
                }
            },
            'save-ok': () => {
                if (this.saveAs(true)) {
                    this.toolManager.closeDialog('save-fp-dialog');
                }
            },
            'save-cancel': () => {
                this.toolManager.closeDialog('save-fp-dialog');
            },
            'selection-as-template': () => {
                if (this.selectionManager.hasSelection()) {
                    this.templateFilePicker.updateSaveAsTemplateUI();
                    this.templateFilePicker.setFileName(this.sashi.getFileName());
                    this.templateFilePicker.show('export-selection');
                }
            },
            'save-as-template': () => {
                if (this.checkForPermission()) {
                    return;
                }
                this.templateFilePicker.updateSaveAsTemplateUI(
                    this.sashi.isTemplate() ? this.sashi.getDataInfo() : null
                );
                this.templateFilePicker.setFileName(this.sashi.getFileName());
                this.templateFilePicker.show('save');
            },
            'save-as-storage': () => {
                if (this.checkForPermission()) {
                    return;
                }
                googleapiLoader(() => {
                    this.picker = new FilePicker(this.sashi.loadStorageSettings(), 'save', this);
                    this.picker.mode = 'save-in-storage';
                    this.picker.prepare();
                    this.toolManager.showSpecialDialog('storage-fp', 'storage-fp-filename');
                });
            },
            'templates-fp-ok': () => {
                const mode = this.templateFilePicker.getCurrentMode();
                if (mode == 'open') {
                    this.openFromTemplates();
                    this.templateFilePicker.hide();
                } else if (mode == 'save') {
                    this.saveAsTemplate(false, true);
                } else if (mode == 'export-selection') {
                    this.exportSelectionAsTemplate(false, true);
                } else {
                    return;
                }
            },
            'templates-fp-cancel': () => {
                this.templateFilePicker.hide();
            },
            'undo-undo': () => {
                const hasSelection = this.selectionManager.hasSelection();
                this.sashi.undoManager.undo();
                this.toolManager.updateUndoState(this);
                if (hasSelection) {
                    this.selectionManager.updateSelection();
                    this.selectionManager.updateSelectionRectangles();
                }
                this.update();
            },
            'undo-redo': () => {
                const hasSelection = this.selectionManager.hasSelection();
                this.sashi.undoManager.redo();
                this.toolManager.updateUndoState(this);
                if (hasSelection) {
                    this.selectionManager.updateSelection();
                    this.selectionManager.updateSelectionRectangles();
                }
                this.update();
            },
            'copy-copy': () => this.copySelection(),
            'copy-cut': () => this.cutSelection(),
            'copy-paste': () => this.pastePrepare(),
            'template-hmirror': () => this.templateMirror('horizontal'),
            'template-vmirror': () => this.templateMirror('vertical'),
            'template-hvmirror': () => this.templateMirror('hv'),
            'zoom-in': () => this.zoomIn(),
            'zoom-out': () => this.zoomOut(),
            'zoom-reset': () => this.zoomReset(),
            'canvas-size': () => {
                this.toolManager.setCanvasProperties(this.gridManager);
                this.toolManager.setBoolValue('base-top-left', true);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('canvas-size-dialog', 'canvas-size-hori-count');
            },
            'canvas-size-ok': () => {
                const base = this.toolManager.getCanvasSizeBase();
                if (base != '') {
                    const props = this.toolManager.getCanvasProperties();
                    if (this.gridManager.horiCount != props.horiCount ||
                        this.gridManager.vertCount != props.vertCount) {
                        this.changeCanvasSize(props.horiCount, props.vertCount, base);
                    }
                    this.toolManager.closeDialog('canvas-size-dialog');
                }
            },
            'canvas-size-cancel': () => this.toolManager.closeDialog('canvas-size-dialog'),
            metadata: () => {
                this.toolManager.setToolProperties('metadata', metadataProps, this.sashi.metadata);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('metadata-dialog', 'metadata-title');
            },
            'metadata-store': () => {
                const metadata = Object.assign({}, this.sashi.metadata);
                this.toolManager.getToolProperties('metadata', metadataProps, metadata);
                this.sashi.storeMetadataAsDefault(metadata);
            },
            'metadata-ok': () => {
                this.toolManager.getToolProperties('metadata', metadataProps, this.sashi.metadata);
                this.toolManager.closeDialog('metadata-dialog');
            },
            'metadata-cancel': () => this.toolManager.closeDialog('metadata-dialog'),
            'print-setting': () => {
                this.toolManager.setToolProperties('print-setting', imageProps, this.sashi.printSetting);
                this.toolManager.setToolProperties('print-setting', gridPrintProps, this.sashi.printGrid);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('print-setting-dialog', 'print-setting-xlink');
            },
            'print-setting-default-ok': () => {
                this.toolManager.getToolProperties('print-setting', imageProps, this.sashi.printSetting);
                this.toolManager.getToolProperties('print-setting', gridPrintProps, this.sashi.printGrid);
                this.sashi.storePrintSettings(this.sashi.printSetting, this.sashi.printGrid);
            },
            'print-setting-document-ok': () => {
                this.toolManager.getToolProperties('print-setting', imageProps, this.sashi.printSetting);
                this.toolManager.getToolProperties('print-setting', gridPrintProps, this.sashi.printGrid);
            },
            'print-setting-load-initial': () => {
                this.toolManager.setToolProperties('print-setting', imageProps, OutputOptionForPrinting);
                this.toolManager.setToolProperties('print-setting', gridPrintProps, GridOptionForPrinting);
            },
            'print-setting-load-default': () => {
                const printObj = this.sashi.loadPrintSettings();
                const gridObj = this.sashi.loadPrintGridSettings();
                this.toolManager.setToolProperties('print-setting', imageProps, printObj);
                this.toolManager.setToolProperties('print-setting', gridPrintProps, gridObj);
            },
            'print-setting-close': () => this.toolManager.closeDialog('print-setting-dialog'),
            'image-setting': () => {
                this.toolManager.setToolProperties('image-setting', imageProps, this.sashi.imageSetting);
                this.toolManager.setToolProperties('image-setting', gridProps, this.sashi.viewGrid);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('image-setting-dialog', 'image-setting-xlink');
            },
            'image-setting-default-ok': () => {
                const imageValue = Object.assign({}, OutputOptionForDisplay);
                const gridValue = Object.assign({}, GridOptionForView);
                this.toolManager.getToolProperties('image-setting', imageProps, imageValue);
                this.toolManager.getToolProperties('image-setting', gridProps, gridValue);
                this.sashi.storeImageSettings(imageValue, gridValue);
            },
            'image-setting-document-ok': () => {
                const stitchProps = ['lineGrainLineWidth', 'overGrainLineWidth', 'overWarpLineWidth',
                    'overGrainOffsetRatio', 'overWarpOffsetRatio'];
                const canvasProps = ['horiCount', 'vertCount'];
                const gridPropsComp = ['gridWidth', 'gridHeight'];
                const gridColorComp = ['gridLineColor', 'gridMajorLineColor', 'gridMajorLineFrequency'];
                const older = copyValues({}, this.sashi.imageSetting, imageProps);
                copyValues(older, this.sashi.viewGrid, gridProps);
                this.toolManager.getToolProperties('image-setting', imageProps, this.sashi.imageSetting);
                this.toolManager.getToolProperties('image-setting', gridProps, this.sashi.viewGrid);
                const canvasChanged = compareProperties(older, this.sashi.viewGrid, canvasProps);
                const gridSizeChanged = compareProperties(older, this.sashi.viewGrid, gridPropsComp);

                if (compareProperties(older, this.sashi.viewGrid, gridColorComp) ||
                    gridSizeChanged || canvasChanged) {
                    this.gridManager.setGridCount(this.sashi.viewGrid.horiCount, this.sashi.viewGrid.vertCount);
                    this.gridManager.setGridSize(this.sashi.viewGrid.gridWidth, this.sashi.viewGrid.gridHeight);
                    this.prepareGrid();
                    if (gridSizeChanged) {
                        this.sashi.stitchManager.updatePosCalc();
                        this.sashi.stitchManager.update();
                        this.cursorManager.clearCursors();
                        this.cursorManager.prepareCursors();
                        if (this.editMode == this.editModeOutputBounds) {
                            this.boundsManager.update();
                            this.boundsManager.drawOutputBounds(this, true);
                        }
                        this.sashi.stitchManager.updatePivotPosition();
                    }
                    this.update();
                } else if (compareProperties(older, this.sashi.imageSetting, stitchProps)) {
                    this.sashi.stitchManager.updatePosCalc();
                    this.sashi.stitchManager.update();
                }
                if (older.overGrid != this.sashi.viewGrid.overGrid) {
                    if (this.gridManager.isVisible()) {
                        this.gridManager.show();
                    }
                }
                // update stitch position according to their coordinate
                for (const layer of this.sashi.layerManager.getUserLayers()) {
                    this.assignPosition(layer.children, 0, 0);
                }
                this.updateUI();
            },
            'image-setting-load-initial': () => {
                this.toolManager.setToolProperties('image-setting', imageProps, OutputOptionForDisplay);
                this.toolManager.setToolProperties('image-setting', gridProps, GridOptionForView);
            },
            'image-setting-load-default': () => {
                const viewObj = this.sashi.loadImageSettings();
                const gridObj = this.sashi.loadViewGridSettings();
                this.toolManager.setToolProperties('image-setting', imageProps, viewObj);
                this.toolManager.setToolProperties('image-setting', gridProps, gridObj);
            },
            'image-setting-close': () => this.toolManager.closeDialog('image-setting-dialog'),
            'view-setting': () => {
                this.toolManager.setToolProperties('view-setting', viewProps, this.sashi.viewOption);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('view-setting-dialog', 'view-setting-selection-color');
            },
            'view-setting-default-ok': () => {
                const currentValue = Object.assign({}, this.sashi.viewOption);
                const viewValue = Object.assign(currentValue, ViewOption);
                this.toolManager.getToolProperties('view-setting', viewProps, viewValue);
                this.sashi.storeViewSettings(viewValue);
            },
            'view-setting-document-ok': () => {
                const older = copyValues({}, this.sashi.viewOption, viewProps);
                this.toolManager.getToolProperties('view-setting', viewProps, this.sashi.viewOption);
                if (this.sashi.viewOption.cursorColor != older.cursorColor) {
                    this.cursorManager.setCursorColor(this.sashi.viewOption.cursorColor);
                }
                if (this.sashi.viewOption.pivotColor != older.pivotColor) {
                    this.sashi.stitchManager.setPivotColor(this.sashi.viewOption.pivotColor);
                }
            },
            'view-setting-load-initial': () => {
                this.toolManager.setToolProperties('view-setting', viewProps, ViewOption);
            },
            'view-setting-load-default': () => {
                const op = this.sashi.loadViewSettings();
                this.toolManager.setToolProperties('view-setting', viewProps, op);
            },
            'view-setting-close': () => this.toolManager.closeDialog('view-setting-dialog'),
            'layer-current': () => {
                if (this.toolManager.isCurrentPopup('layer-dropdown')) {
                    this.toolManager.closeAnyPopup();
                } else {
                    this.toolManager.updateLayers(this.layerManager);
                    this.toolManager.showPopup('layer-dropdown');
                }
            },
            'layer-dropdown': () => {
                if (this.toolManager.isCurrentPopup('layer-dropdown')) {
                    this.toolManager.closeAnyPopup();
                } else {
                    this.toolManager.updateLayers(this.layerManager);
                    this.toolManager.showPopup('layer-dropdown');
                }
            },
            'layer-menu': () => this.toolManager.showPopup('layer-menu-dropdown'),
            'layer-new': () => {
                this.toolManager.closeAnyPopup();
                const name = this.layerManager.getNextLayerName();
                this.toolManager.showNameInput(name, 'New layer', 'layer-new');
            },
            'layer-rename': () => {
                const layer = this.layerManager.getActiveLayer();
                if (layer.data.asLayer) {
                    this.toolManager.showNameInput(layer.name, 'Rename layer', 'layer-rename');
                }
                this.toolManager.closeAnyPopup();
            },
            'move-to-layer': () => {
                // todo, avoid if group edit mode
                this.toolManager.closeAnyPopup();
                this.toolManager.setLayerList(this.layerManager.getUserLayerNames());
                this.toolManager.showDialog('move-to-layer-dialog');
            },
            'move-to-layer-ok': () => {
                const index = this.toolManager.getSelectedLayerIndex();
                if (index >= 0) {
                    this.toolManager.closeDialog('move-to-layer-dialog');
                    this.moveSelectionToLayer(index);
                }
            },
            'move-to-layer-cancel': () => {
                this.toolManager.closeDialog('move-to-layer-dialog');
            },
            'msgbox-cancel': () => {
                this.toolManager.closeDialog('msgbox-dialog');
            },
            'msgbox-ok': () => {
                switch (this.toolManager.getInputType()) {
                    case 'save-as-template-overwrite': {
                        //this.toolManager.hideTemplatePicker();
                        this.templateFilePicker.hide();
                        this.saveAsTemplate(true, true);
                        break;
                    }
                    case 'export-as-template-overwrite': {
                        this.templateFilePicker.hide();
                        this.exportSelectionAsTemplate(true, true);
                        break;
                    }
                    case 'templates-remove': {
                        this.templatesWindow.removeLocation();
                        break;
                    }
                    case 'templates-context-clear': {
                        this.templatesWindow.clearLocation();
                        break;
                    }
                    case 'templates-item-remove': {
                        this.templatesWindow.removeItem();
                        break;
                    }
                    case 'templates-folder-remove': {
                        this.templatesWindow.removeCurrentFolder();
                        break;
                    }
                    case 'shortcut-remove-item': {
                        this.shortcutWindow.removeItem();
                        break;
                    }
                    case 'shortcut-default-item': {
                        this.shortcutWindow.defaultItem(null, true);
                        break;
                    }
                    case 'shortcut-default-all': {
                        this.shortcutWindow.defaultAll();
                        break;
                    }
                    case 'shortcut-input-replace': {
                        this.shortcutWindow.addItem(null, true);
                        this.toolManager.hideSpecialDialog('shortcut-input-dialog');
                        break;
                    }
                    case 'storage-fp-storage-remove': {
                        this.picker.removeCurrentStorage();
                        break;
                    }
                    case 'storage-fp-entry-remove': {
                        this.picker.removeFile();
                        break;
                    }
                    case 'storage-fp-save-overwrite': {
                        this.picker.overWriteConfirmed = true;
                        this.fireCommand('storage-fp-ok');
                        break;
                    }
                    case 'solve-overlapping': {
                        const normalizer = new Normalizer(this.sashi)
                        normalizer.solve();
                        break;
                    }
                    case 'ask-for-permission': {
                        this.sashi.settingsManager.setNotStoreSettings(false);
                        this.sashi.initForStorage();
                        break;
                    }
                    case 'ask-for-closing': {
                        if (window.docs) {
                            window.docs.closeDocument(window);
                        }
                        break;
                    }
                }
                this.toolManager.resetInputType();
                this.toolManager.closeDialog('msgbox-dialog')
            },
            'name-cancel': () => {
                this.toolManager.resetInputType();
                this.toolManager.closeDialog('input-dialog');
                this.toolManager.setInputMessage('');
            },
            'name-ok': () => {
                const newName = this.toolManager.getNameValue();
                if (newName == '') {
                    let text = '';
                    if (this.toolManager.getInputType().startsWith('layer-')) {
                        text = this.toolManager.translate('Invalid layer name.');
                    } else {
                        text = this.toolManager.translate('Input name');
                    }
                    this.toolManager.showMessage(text + '\n' + newName);
                } else {
                    switch (this.toolManager.getInputType()) {
                        case 'layer-new': {
                            const layer = this.sashi.addLayer(newName);
                            this.layerManager.setActiveLayer(layer);
                            break;
                        }
                        case 'layer-rename': {
                            const layer = this.layerManager.getActiveLayer();
                            this.sashi.renameLayer(layer, newName);
                            break;
                        }
                        case 'templates-location-name': {
                            this.templatesWindow.renameLocation(newName);
                            break;
                        }
                        case 'templates-item-name': {
                            this.templatesWindow.renameItem(newName);
                            break;
                        }
                        case 'templates-item-duplicate-name': {
                            if (!this.templatesWindow.checkNameConflict(newName)) {
                                this.templatesWindow.duplicateItem(newName);
                            } else {
                                this.toolManager.setInputMessage('Name conflict.');
                                return;
                            }
                            break;
                        }
                        case 'templates-location-add-subfolder': {
                            this.templatesWindow.addSubfolderToLocation(newName);
                            break;
                        }
                        case 'templates-location-add-new-file': {
                            this.templatesWindow.newToCurrentFolder(newName);
                            break;
                        }
                        case 'templates-folder-rename': {
                            this.templatesWindow.renameCurrentFolder(newName);
                            break;
                        }
                        case 'storage-fp-new-folder': {
                            this.picker.createFolder(newName);
                            break;
                        }
                        case 'storage-fp-rename': {
                            this.picker.renameFile(newName);
                            break;
                        }
                    }
                }
                this.toolManager.resetInputType();
                this.toolManager.closeDialog('input-dialog');
                this.toolManager.setInputMessage('');
            },
            'layer-delete': () => {
                const layer = this.layerManager.getActiveLayer();
                this.sashi.removeLayer(layer);
                this.toolManager.closeAnyPopup();
            },
            'layer-lock': () => {
                const state = this.layerManager.toggleLockActiveLayer();
                if (state != null) {
                    this.toolManager.setLayerLock(state);
                }
            },
            'layer-visible': () => {
                const state = this.layerManager.toggleVisibleActiveLayer();
                if (state != null) {
                    this.toolManager.setLayerVisible(state);
                    this.update();
                }
            },
            'bounds-setting': () => {
                this.toolManager.setToolProperties('bounds-setting', boundsProps, this.sashi.boundsSetting);
                this.toolManager.closeAnyPopup();
                this.toolManager.showDialog('bounds-setting-dialog', 'bounds-setting-use');
            },
            'bounds-setting-ok': () => {
                this.toolManager.getToolProperties('bounds-setting', boundsProps, this.sashi.boundsSetting);
                if (this._resetBoundsSetting) {
                    this.sashi.resetBounds();
                    this._resetBoundsSetting = false;
                }
                this.toolManager.closeDialog('bounds-setting-dialog');
                this.updateUI();
            },
            'bounds-setting-reset': () => this._resetBoundsSetting = true,
            'bounds-setting-cancel': () => this.toolManager.closeDialog('bounds-setting-dialog'),
            'bounds': () => {
                if (this.editMode == this.editModeOutputBounds) {
                    this.setEditMode(this.editModeSelect);
                    if (this.sashi.boundsSetting.useOutputBounds) {
                        this.boundsManager.drawOutputBounds(this, false);
                        this.update();
                    }
                } else {
                    this.boundsManager.clearBounds(this, false);
                    this.boundsManager.update();
                    this.setEditMode(this.editModeOutputBounds);
                }
            },
            'solve-overlapping': () => {
                this.toolManager.showMessage('Solve overlapping', 'Overlapping', 'solve-overlapping');
                this.toolManager.closeAnyPopup();
            },
            'normalized': () => {
                const normalizer = new Normalizer(this.sashi)
                normalizer.normalize().then((hash) => {
                    this.toolManager.showMessage(hash, 'Hash');
                });
            },
            'notice': () => {
                this.toolManager.noticeManager.showNotices();
            },
            'shortcut-key-dialog': () => {
                this.shortcutWindow = new ShortcutWindow(this);
                this.shortcutWindow.prepare(this.shortcutKeys);
                this.toolManager.showSpecialDialog('shortcut-dialog');
            },
            'shortcut-add': () => {
                this.shortcutWindow.showAddItemWindow();
                this.toolManager.showSpecialDialog('shortcut-input-dialog');
            },
            'shortcut-remove': () => {
                this.toolManager.showMessage('This entry will be removed.',
                    'Remove item',
                    'shortcut-remove-item');
            },
            'shortcut-default': () => {
                this.shortcutWindow.defaultItem(() => {
                    this.toolManager.showMessage('The key will be set to default.',
                        'Initialize item',
                        'shortcut-default-item');
                }, false);
            },
            'shortcut-default-all': () => {
                this.toolManager.showMessage('All entries will be initialized.',
                    'Default all',
                    'shortcut-default-all');
            },
            'shortcut-save': () => this.shortcutWindow.save(),
            'shortcut-close': () =>
                this.toolManager.hideSpecialDialog('shortcut-dialog'),
            'shortcut-input-ok': () => {
                if (this.shortcutWindow.addItem(() => {
                    this.toolManager.showMessage('Defined key will be replaced.',
                        'Replace item',
                        'shortcut-input-replace');
                }, false)) {
                    this.toolManager.hideSpecialDialog('shortcut-input-dialog');
                }
            },
            'shortcut-input-cancel': () =>
                this.toolManager.hideSpecialDialog('shortcut-input-dialog'),
            'pdf-export-local': () => {
                this._pdfExportMode = 'local';
                this.fireCommand('pdf-export');
            },
            'pdf-export-storage': () => {
                if (this.checkForPermission()) {
                    return;
                }
                this._pdfExportMode = 'storage';

                let fileName = 'pattern.pdf';
                const name = this.sashi.getFileName();
                if (name) {
                    if (name.endsWith('.svg')) {
                        fileName = name.substring(0, name.length - 4) + '.pdf';
                    } else {
                        fileName = name + '.pdf';
                    }
                }

                this.picker = new FilePicker(this.sashi.loadStorageSettings(), 'save', this, 'PDF');
                this.picker.mode = 'pdf-export-storage';
                this.picker.prepare();
                this.picker.setInputName(fileName);
                this.picker.showSaveOption(false);
                this.toolManager.showSpecialDialog('storage-fp', 'storage-fp-filename');
            },
            'pdf-export-storage-option': () => {
                if (this.pickerResult) {
                    this.fireCommand('pdf-export');
                }
            },
            'pdf-export': () => {
                this.toolManager.closeAnyPopup();

                const getName = () => {
                    let fileName = 'pattern.pdf';
                    const name = this.sashi.getFileName();
                    if (name) {
                        if (name.endsWith('.svg')) {
                            fileName = name.substring(0, name.length - 4) + '.pdf';
                        } else {
                            fileName = name + '.pdf';
                        }
                    }
                    return fileName;
                };

                const exportOption = (fileName) => {
                    this.toolManager.setPDFExportOptions(this.sashi.pdfSetting);

                    if (!window.__TAURI__) {
                        this.toolManager.setDisplay('pdf-export-name-part', this._pdfExportMode == 'local');
                    }

                    this.toolManager.setValue('pdf-export-name-input', fileName);
                    this.toolManager.showDialog('pdf-export-dialog', 'pdf-export-name-input');
                };

                if (window.__TAURI__) {
                    window.__TAURI__.dialog.save({
                        defaultPath: getName(),
                        filters: [{
                            name: this.toolManager.translate('PDF file'),
                            extensions: ['pdf']
                        }]
                    }).then((selected) => {
                        if (selected) {
                            // store selected file name into hidden input
                            exportOption(selected);
                        }
                    });
                } else {
                    exportOption(getName());
                }
            },
            'pdf-export-ok': () => {
                const options = this.toolManager.getPDFExportOptions();
                let fileName;
                if (this._pdfExportMode == 'local') {
                    fileName = options.fileName;
                    if (fileName == '') {
                        this.toolManager.showMessage('Input name', 'Error');
                        return;
                    }
                } else if (this.pickerResult) {
                    if (!this.pickerResult.id) {
                        fileName = this.pickerResult.nameInput;
                    }
                } else {
                    return; // error
                }
                if (fileName && !fileName.endsWith('.pdf')) {
                    fileName += '.pdf';
                }

                this.toolManager.closeDialog('pdf-export-dialog');
                Object.assign(this.sashi.pdfSetting, options);

                this.pdfExport(fileName, options);
            },
            'pdf-export-cancel': () => {
                this.toolManager.closeDialog('pdf-export-dialog');
            },
            'pdf-export-load-default': () => {
                this.toolManager.setPDFExportOptions(PDFOption);
            },
            'pdf-export-default': () => {
                const options = this.toolManager.getPDFExportOptions();
                this.sashi.storePDFSettings(options);
            },
            'ask-for-closing': () => {
                this.toolManager.showMessage('Dispose modification?', 'Close document', 'ask-for-closing');
            },
            'about': () => {
                this.toolManager.closeAnyPopup();
                if (window.__TAURI__) {
                    window.docs.parentCommand('about');
                    /*
                    this.toolManager.setDisplay('about-tauri', true);
                    this.toolManager.setDisplay('about-jszip', false);
                    this.toolManager.setDisplay('about-google-api', false);
                    this.toolManager.setDisplay('about-dropbox', false);
                    */
                } else {
                    document.getElementById('project-url').href = PROJECT.URL;
                    this.toolManager.showDialog('about-dialog');
                }
            },
            'about-close': () => {
                this.toolManager.closeDialog('about-dialog');
            },
            'shortcut-keys': () => {
                openSome(PROJECT.HELP_BASE + '/key_' + getLang() + '.md', '_blank');
                this.toolManager.closeAnyPopup();
            },
            'help': () => {
                openSome(PROJECT.HELP_BASE + '/help_' + getLang() + '.md', '_blank')
                this.toolManager.closeAnyPopup();
            },
            'ask-for-permission': () => {
                this.toolManager.showMessage('We use Web storage to store settings, Indexed DB for user data and Cookie is used to store session information.', 'Permission', 'ask-for-permission');
            },
        };

        // [element name in options.js, id for HTMLElement]
        const metadataProps = [
            ['title', 'title', 'string'],
            ['title-en', 'title-en', 'string'],
            ['creationDate', 'creation-date', 'string'],
            ['author', 'author', 'string'],
            ['license', 'license', 'string'],
            ['keyword', 'keyword', 'string'],
            ['description', 'description', 'string'],
            ['version', 'version', 'string'],
            ['copyright', 'copyright', 'string'],
            ['type', 'type', 'string'],
        ];

        const gridProps = [
            ['overGrid', 'over-grid', 'boolean'],
            ['horiCount', 'hori-count', 'integer'],
            ['vertCount', 'vert-count', 'integer'],
            ['gridWidth', 'width', 'integer'],
            ['gridHeight', 'height', 'integer'],
            ['gridLineColor', 'line-color', 'string'],
            ['gridMajorLineColor', 'major-line-color', 'string'],
            ['gridMajorLineFrequency', 'major-frequency', 'integer'],
            ['numberingColor', 'numbering-color', 'string'],
        ];

        const gridPrintProps = [
            ['showGrid', 'show-grid', 'boolean'],
            ['overGrid', 'over-grid', 'boolean'],
            ['gridWidth', 'width', 'float'],
            ['gridHeight', 'height', 'float'],
            ['gridLineWidth', 'line-width', 'float'],
            ['gridLineColor', 'line-color', 'string'],
            ['gridMajorLineColor', 'major-color', 'string'],
            ['showGridMajorLine', 'show-major', 'boolean'],
            ['gridMajorLineFrequency', 'major-frequency', 'integer'],
            ['showGridFrame', 'outer-frame', 'boolean'],
            ['gridMajorVertOffset', 'major-vert-offset', 'integer'],
            ['gridMajorHoriOffset', 'major-hori-offset', 'integer'],
            ['numberingColor', 'numbering-color', 'string'],
        ];

        const imageProps = [
            ['useXLink', 'xlink', 'boolean'],
            ['setBackground', 'background', 'boolean'],
            ['backgroundColor', 'background-color', 'string'],
            ['leftMargin', 'left-margin', 'integer'],
            ['rightMargin', 'right-margin', 'integer'],
            ['topMargin', 'top-margin', 'integer'],
            ['bottomMargin', 'bottom-margin', 'integer'],
            ['showTitle', 'show-title', 'boolean'],
            ['showCopyright', 'show-copyright', 'boolean'],
            ['lineGrainLineWidth', 'linegrain-line-width', 'float'],
            ['overGrainLineWidth', 'overgrain-line-width', 'float'],
            ['overWarpLineWidth', 'overwarp-line-width', 'float'],
            ['overGrainOffsetRatio', 'overgrain-offset-ratio', 'float'],
            ['overWarpOffsetRatio', 'overwarp-offset-ratio', 'float'],
        ];

        const viewProps = [
            ['selectionColor', 'selection-color', 'string'],
            ['cursorColor', 'cursor-color', 'string'],
            ['overlayStitchColor', 'overlay-stitch-color', 'string'],
            ['pivotColor', 'pivot-color', 'string'],
            ['openFromToolbar', 'open-from-toolbar', 'select'],
            ['saveFromToolbar', 'save-from-toolbar', 'select'],
            ['askWhenClosing', 'ask-when-closing', 'boolean'],
            ['autoScrollOnTemplates', 'auto-scroll', 'boolean'],
        ];

        const boundsProps = [
            ['useOutputBounds', 'use', 'boolean'],
        ];

        this.tool = new paper.Tool();
        this.tool.minDistance = 2;
        this.enableEvents();

        this.toolManager.initParts();
    }

    printCommands() {
        const expel = new Set([
            'bounds-setting-reset', 'local-origin', 'metadata-store', 'view-mode',
            'layer-dropdown', 'stitchnn'
        ]);
        const keys = [];
        for (const [key, value] of Object.entries(this.operations)) {
            if (key.endsWith('-ok') ||
                key.endsWith('-cancel') ||
                key.startsWith('templates-') ||
                key.endsWith('-moved') ||
                key.endsWith('-load-initial') ||
                key.endsWith('-load-default') ||
                key.endsWith('-from-toolbar') ||
                key.endsWith('-from-menu') ||
                key.endsWith('sized') ||
                expel.has(key)) {
                continue;
            }
            keys.push(key);
        }
        keys.sort();
        for (const key of keys) {
            const element = document.getElementById(`${key}-tool`);
            /*
            if (element) {
                const content = element.textContent;
                console.log(`["${key}", "${content}"],`);
            } else {*/
            console.log(`["${key}", ""],`);
            //}
        }
    }

    enableEvents() {
        if (this.eventEnabled) {
            return;
        }
        this.eventEnabled = true;
        const tool = this.tool;
        this.sashi.canvas.onwheel = this.onwheel;
        tool.onMouseDown = this.onMouseDown;
        tool.onMouseUp = this.onMouseUp;
        tool.onMouseMove = this.onMouseMove;
        tool.onMouseDrag = this.onMouseDrag;
        this.sashi.canvas.oncontextmenu = this.onContextMenu;
        window.removeEventListener('keydown', this.onKeyDownForSpecialDialogs);
        window.addEventListener('keydown', this.onKeyDown);
        tool.activate();
    }

    disableEvents() {
        if (!this.eventEnabled) {
            return;
        }
        this.eventEnabled = false;
        const tool = this.tool;
        this.sashi.canvas.onwheel = null;
        tool.onMouseDown = null;
        tool.onMouseUp = null;
        tool.onMouseMove = null;
        tool.onMouseDrag = null;
        this.sashi.canvas.oncontextmenu = null;
        window.removeEventListener('keydown', this.onKeyDown);
        window.addEventListener('keydown', this.onKeyDownForSpecialDialogs);
    }

    enableKeydownEvent() {
        window.addEventListener('keydown', this.onKeyDown);
    }

    disableKeydownEvent() {
        window.removeEventListener('keydown', this.onKeyDown);
    }

    setMouseLocation(point, fixScroll = false) {
        if (fixScroll) {
            const bounds = this.sashi.project.view.bounds;
            const parent = this.sashi.canvas.parentNode;
            let x = point.x + parent.scrollLeft + bounds.x;
            let y = point.y + parent.scrollTop + bounds.y - 32;
            this.mouseLastLocation = { x: x, y: y };
        } else {
            this.mouseLastLocation = point;
        }
    }

    /// Event hander for *-tool items.
    toolEventHandler = (event) => {
        const node = this.toolManager.findToolDivParent(event.target);
        if (node) {
            const id = node['id'];
            if (id.endsWith('-tool')) {
                // remove context-
                const isContext = id.startsWith('context-');
                const sid = isContext ? id.substring(8) : id;
                //console.log("sid: " + sid);
                // remove -tool
                const command = sid.substring(0, sid.length - 5);
                this.fireCommand(command, isContext, event);
            }
        }
    }

    fireCommand = (command, isContext = false, event = null, args = null) => {
        if (command.startsWith('modoko-') || command.startsWith('katako-')) {
            args = [command.substring(7)];
            command = command.substring(0, 6);
        }
        let func = this.operations[command];
        if (typeof func == 'string') {
            for (let i = 0; i < 5; i++) {
                func = this.operations[func];
                if (typeof func != 'string') {
                    break;
                }
            }
        }

        if (func) {
            let prevent = false;
            if (args) {
                prevent = func.apply(this, args);
            } else {
                prevent = func();
            }
            if (event && prevent) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (isContext) {
                this.toolManager.closeAnyPopup();
            }
        }
    }

    fireCommandWithArgs(command, args) {
        this.fireCommand(command, false, null, args);
    }

    fileNameChanged(fileName) {
        let name = fileName;
        if (window.__TAURI__) {
            const index = name.lastIndexOf(window.__TAURI__.path.sep);
            if (index >= 0) {
                name = name.substring(index + window.__TAURI__.path.sep.length);
            }
        }
        if (name == '') {
            name = this.sashi.index ? `Untitled-${this.sashi.index}` : 'Untitled';
        }
        let s = this.sashi.isModified() ? `*${name}` : `${name}`;
        if (!window.docs) {
            s += '- Kogin';
        }
        if (fileName == '') {
            fileName = name;
        }
        this.toolManager.setTitle(s, fileName);
    }

    checkPermission() {
        if (window.__TAURI__) {
            return;
        }
        if (this.sashi.settingsManager.askForPermission) {
            this.fireCommand('ask-for-permission');
        }
    }

    checkForPermission() {
        if (window.__TAURI__) {
            return false;
        }
        const state = this.sashi.settingsManager.notStoreSettings;
        if (state) {
            this.toolManager.showMessage('No permission for storages.', 'Error');
        }
        return state;
    }

    modifiedStateChanged = (ev) => {
        this.fileNameChanged(this.sashi.getFileName());
    }

    /// Clears this view.
    clear() {
        this.selectionManager.clear();
        this.update();
    }

    askForClosing() {
        this.fireCommand('ask-for-closing');
    }

    cbFileInputForTemplateChanged = (event) => {
        const files = document.getElementById('template-file-input').files;
        if (files.length > 0) {
            this.templatesWindow.loadFromLocal(files);
        }
    }

    /// Reads file if file opened.
    cbFileInputForFileChanged = (event) => {
        const files = document.getElementById('file-input').files;
        if (files.length > 0) {
            this.openFromFile(files[0], false);
        }
    }

    openFromFile(file, forceNewWindow = false) {
        if (file.type != 'image/svg+xml') {
            this.toolManager.showMessage('This file can not be loaded.', 'Error');
            return;
        }

        file.text()
            .then((data) => {
                this.openForData(data, file.name, forceNewWindow);
            }, (error) => {
                this.toolManager.showMessage(error.toString(), 'Error');
            });
    }

    openForData(data, name, forceNewWindow = false) {
        if (!forceNewWindow && this.sashi.canOverride()) {
            try {
                this.sashi.openData(data, name);
                this.toolManager.updateLayers();
            } catch (error) {
                this.toolManager.showMessage(error, 'Error');
            }
        } else {
            openData(getURL(), name, data, '_blank');
        }
    }

    cbFileNameInputKeydown = (event) => {
        if (event.key == 'Enter') {
            this.fireCommand('save-ok');
        }
    }

    cbMetadataKeydown = (event) => {
        if (event.key == 'Enter') {
            this.fireCommand('metadata-ok');
        } else if (event.key == 'Escape') {
            this.fireCommand('metadata-cancel');
        }
    }

    openFromStorage(type, key, name) {
        if (this.sashi.canOverride()) {
            this.sashi.openFromStorage(type, key);
        } else {
            openFileFromStorage(getURL(), type, key, '_blank', this.sashi.viewOption.viewMode);
        }
    }

    /// Opens file from template.
    openFromTemplates(locationId, key) {
        if (!locationId || !key) {
            locationId = this.templateFilePicker.getLocationId();
            key = this.templateFilePicker.getKey();
        }
        // always _blank
        const target = '_blank';
        openTemplate(getURL(), locationId, key, target, this.viewMode);
    }

    save() {
        const fileName = this.sashi.getFileName();
        if (this.sashi.isTemplate()) {
            if (this.sashi.canSaveAsTemplate()) {
                this.saveAsTemplate(true, false);
            } else {
                this.fireCommand('save-as-template');
            }
        } else if (this.sashi.isStorageData()) {
            if (this.sashi.canSaveInStorage()) {
                this.saveAsInStorage(this.sashi.getDataInfo().op, this.sashi.saveOption, false);
            } else {
                this.fireCommand('save-as-storage');
            }
        } else {
            if (fileName != '') {
                this.sashi.clearDataInfo();
                if (window.__TAURI__) {
                    this.saveForLocal(fileName, this.sashi.saveOption, false);
                } else {
                    this.saveForDownload(fileName, this.sashi.saveOption, false);
                }
            } else {
                // needs name input
                switch (this.sashi.viewOption.saveFromToolbar) {
                    case 'local': {
                        this.fireCommand('save-as');
                        break;
                    }
                    case 'storage': {
                        this.fireCommand('save-as-storage');
                        break;
                    }
                    case 'templates': {
                        this.fireCommand('save-as-template');
                        break;
                    }
                    default: {
                        this.saveAs(false);
                        break;
                    }
                }
            }
        }
    }

    saveAs(dialog_ok = false) {
        const name = this.sashi.getFileName();
        if (dialog_ok) {
            const op = this.toolManager.getSaveFileValue();
            let fileName = op.fileName;
            if (fileName) {
                if (!fileName.endsWith('.svg')) {
                    fileName += '.svg';
                }
                this.sashi.setFileName(fileName);
                this.sashi.setBoundsUse(op.boundsUse);
                const saveOp = {
                    boundsUse: op.boundsUse, noData: op.noData,
                    forPrinting: op.forPrinting, gridNumber: op.gridNumber
                };
                if (window.__TAURI__) {
                    this.saveForLocal(fileName, saveOp, true);
                } else {
                    this.saveForDownload(fileName, saveOp, true);
                }
                return true;
            } else {
                return false;
            }
        } else {
            this.toolManager.showSaveNameInput(
                name ? name : this.sashi.viewOption.defaultFileName,
                this.sashi.boundsSetting.useOutputBounds);
        }
    }

    saveForLocal(fileName, saveOp, saveOption = false) {
        const data = this.sashi.write(saveOp);
        if (saveOption) {
            this.sashi.setSaveOption(saveOp);
        }
        this.sashi.setModified(false);
        window.__TAURI__.invoke('file_write', {
            name: fileName, data: data,
        }).then(() => {
        }).catch((e) => {
            console.log(e);
        });
    }

    /**
     * Saves file into local file.
     *
     * @param {string} fileName File name to save into.
     */
    saveForDownload(fileName, saveOp, saveOption = false) {
        const data = this.sashi.write(saveOp);
        if (saveOption) {
            this.sashi.setSaveOption(saveOp);
        }
        startDownloadForData(data, fileName, 'image/svg+xml');
        this.sashi.setModified(false);
    }

    saveAsInStorage(op, saveOp, saveOption = false) {
        let fileName = saveOp.fileName;
        if (op.id) {
        } else if (fileName) {
            if (!fileName.endsWith('.svg')) {
                fileName += '.svg';
            }
        } else {
            return false;
        }
        this.sashi.setBoundsUse(saveOp.boundsUse);
        this.saveAsForStorage(op, fileName, saveOp, saveOption);
    }

    saveAsForStorage(op, fileName, saveOp, saveOption = false) {
        //noData=false, forPrinting=false, gridNumber=false) {
        if (!op) {
            op = this.sashi.getDataInfo().op;
        }

        const data = this.sashi.write(saveOp);
        if (saveOption) {
            this.sashi.setSaveOption(saveOp);
        }
        /*
            {
            forPrinting: forPrinting, noData: noData, gridNumber: gridNumber });*/
        const storage = new Storage(op.storageType);

        if (op.id) {
            // update
            storage.updateFile(op.id, data,
                (id, name) => {
                    this.sashi.setFileName(name);
                    this.sashi.setModified(false);
                    this.sashi.setStorageData({
                        storageType: op.storageType,
                        id: id,
                    });
                }, (error) => {
                    console.log(error);
                });
        } else {
            // create new file
            storage.createFile(fileName, op.parentId, data,
                (id) => {
                    this.sashi.setFileName(fileName);
                    this.sashi.setModified(false);
                    this.sashi.setStorageData({
                        storageType: op.storageType,
                        id: id,
                    });
                }, (error) => {
                    console.log(error);
                });
        }
    }

    /// Saves file from templates.
    saveAsTemplate(overwrite = false, dialog_ok = false) {
        // todo, overwrite but name change to another file
        let fileName = '';
        let locationId = null;
        let folder = '/';
        if (dialog_ok) {
            fileName = this.templateFilePicker.getFileName();
            if (fileName == '') {
                //this.toolManager.showMessage('Input file name to save.', 'Error');
                return false;
            }
            if (!fileName.endsWith('.svg')) {
                fileName += '.svg';
            }
            locationId = this.templateFilePicker.getLocationId();
            folder = this.templateFilePicker.getFolder();
        } else {
            // overwrite from save menu, ignore overwrite flag
            fileName = this.sashi.getFileName();
            locationId = this.sashi.getDataInfo().locationId;
            folder = this.sashi.getDataInfo().folder;
        }

        this.templatesWindow.findEntryByName(locationId, fileName, folder, (name, key) => {
            if (key && !overwrite) {
                // ask for overwrite
                this.toolManager.showMessage(
                    'Overwrite file?', 'Save as template', 'save-as-template-overwrite', { key: key, });
            } else {
                if (dialog_ok) {
                    this.templateFilePicker.hide();
                    this.sashi.setFileName(fileName);
                }
                this.sashi.setLocationData(locationId, key, folder);
                const data = this.sashi.write({ forPrinting: false, noData: false, gridNumber: false });
                this.templatesWindow.loadLocalData(fileName, folder, data, locationId, key);
                this.sashi.setModified(false);
            }
        });
    }

    pdfExport(fileName, options) {
        pdflibLoader(() => {
            const exporter = new PDFExport(this.sashi, options);
            try {
                exporter.export(
                    (exporter) => {
                        if (this._pdfExportMode == 'local') {
                            exporter.output((data) => {
                                if (window.__TAURI__) {
                                    window.__TAURI__.fs.writeBinaryFile(fileName, data)
                                        .then(() => { })
                                        .catch((e) => {
                                            console.log(e);
                                        });
                                } else {
                                    startDownloadForData(data, fileName, 'application/pdf');
                                }
                            });
                        } else if (this._pdfExportMode == 'storage') {
                            const result = this.pickerResult;
                            this.pickerResult = null;
                            const isBase64 = result.storageType == 'googledrive';
                            function store(data) {
                                const storage = new Storage(result.storageType);
                                storage.writeFile(result.id, data, fileName, result.parentId,
                                    () => { },
                                    (error) => {
                                        console.log(error);
                                    }, 'application/pdf'
                                );
                            }

                            if (isBase64) {
                                exporter.outputAsBase64((data) => {
                                    store(data);
                                });
                            } else {
                                exporter.output((data) => {
                                    store(data);
                                });
                            }
                        }
                    });
            } catch (error) {
                this.toolManager.showMessage(error, 'Error');
            }
        });
    }

    exportSelectionAsTemplate(overwrite = false, dialog_ok = false) {
        let fileName = '';
        let locationId = null;
        let folder = '/';
        if (dialog_ok) {
            fileName = this.templateFilePicker.getFileName();
            if (fileName == '') {
                return false;
            }
            if (!fileName.endsWith('.svg')) {
                fileName += '.svg';
            }
            locationId = this.templateFilePicker.getLocationId();
            folder = this.templateFilePicker.getFolder();
        } else {
            // no save because this is export
            return;
        }
        const items = this.selectionManager.clone();
        const data = this.dataFromItems(items);
        if (data) {
            this.templatesWindow.findEntryByName(locationId, fileName, folder, (name, key) => {
                if (key && !overwrite) {
                    // ask for overwrite
                    this.toolManager.showMessage(
                        'Overwrite file?', 'Export selection as template', 'export-as-template-overwrite', { key: key, });
                } else {
                    if (dialog_ok) {
                        this.templateFilePicker.hide();
                    }
                    this.templatesWindow.loadLocalData(fileName, folder, data, locationId, key);
                }
            });
        } else {
            console.log('no data');
        }
    }

    /**
     * Generates data for some stitches such as selected items.
     *
     * @param {array} items Stitches.
     * @returns {string|null} Data.
     */
    dataFromItems(items) {
        if (items) {
            const canvas = document.createElement('canvas');
            canvas.style = 'visibility: hidden;';
            canvas.setAttribute('width', '100');
            canvas.setAttribute('height', '100');
            document.getElementById('working-box').appendChild(canvas);
            const app = new Sashi(canvas, false, null, this.sashi.settingsManager);
            app.stitchManager.registerAll(items);
            app.addItems(items, app.layerManager.getActiveLayer());
            const data = app.write(false);
            canvas.remove();
            return data;
        }
        return null;
    }

    /// Copies selection into the clipboard.
    copySelection() {
        if (this.selectionManager.hasSelection()) {
            this.clipboard.push(this.selectionManager.stack);
        }
    }

    /// Cuts selection into the clipboard.
    cutSelection() {
        if (this.selectionManager.hasSelection()) {
            const items = this.selectionManager.stack
            this.clipboard.push(items);
            this.sashi.deleteItems(this.selectionManager.copyStack());
            this.clearSelection();
            this.update();
        }
    }

    setPreviewPosition(item, viewPoint) {
        const point = this.gridManager.pointToGridPoint(viewPoint);
        if (item.position != point) {
            item.position = point;
            return true;
        }
        return false;
    }

    /// Switch to specified edit mode and put items on the preview layer.
    prepareForPreview(editMode, items) {
        this.setEditMode(editMode);
        this.layerManager.clearPreviewLayer();
        const layer = this.layerManager.getPreviewLayer();
        const group = new paper.Group(items);
        const [x, y] = this._findLeftTopMostGridPoint(items);
        group.data.x = x;
        group.data.y = y;
        const pivot = this.gridManager.gridToPoint(x, y);
        group.pivot = pivot;
        layer.addChild(group);
    }

    /// Prepare to put items from clipboard to preview layer.
    pastePrepare() {
        const items = this.clipboard.get();
        if (items) {
            let template = Template.objectToTemplate(items);
            this.setTemplate(template, this.editModeTemplate, 0, true, 'normal');
        }
    }

    templateMirror(mode) {
        let template = this.template.getNormalTemplate();
        switch (mode) {
            case 'horizontal': {
                template = Template.horizontalMirror(template);
                break;
            }
            case 'vertical': {
                template = Template.verticalMirror(template);
                break;
            }
            case 'hv': {
                template = Template.horizontalMirror(template);
                template = Template.verticalMirror(template);
                break;
            }
            default:
                return;
        }
        this.setTemplate(template, this.editModeTemplate, 0, this.template.keepColor, mode);
    }

    assignPosition(items, px, py) {
        for (const item of items) {
            const point = this.gridManager.gridToPoint(item.data.x, item.data.y);
            point.x += px;
            point.y += py;
            item.position = point;
            if (item.className == 'Group') {
                this.assignPosition(item.children, point.x, point.y);
            }
        }
    }

    // todo, group
    /// Pastes item from the clipboard.
    paste(x, y) {
        const items = this.clipboard.get();
        if (items) {
            this.assignPosition(items, 0, 0);
            const layer = this.layerManager.getActiveLayer();
            const [dx, dy] = this._findLeftTopMostGridPoint(items);
            for (const item of items) {
                const ix = item.data.x - dx + x;
                const iy = item.data.y - dy + y;
                const point = this.gridManager.gridToPoint(ix, iy);
                item.position = point;
                item.data.x = ix;
                item.data.y = iy;
            }
            this.sashi.addItems(items, layer);
            this.update();
        }
    }

    // todo, item.data.x and y
    _findLeftTopMostGridPoint(items) {
        let x = 1000000000;
        let y = 1000000000;
        for (const item of items) {
            switch (item.className) {
                case 'Group': {
                    const [cx, cy] = this._findLeftTopMostGridPoint(item.children);
                    x = Math.min(x, item.data.x + cx);
                    y = Math.min(y, item.data.y + cy);
                    break;
                }
                case 'SymbolItem': {
                    x = Math.min(x, item.data.x);
                    y = Math.min(y, item.data.y);
                    break;
                }
                default:
                    break;
            }
        }
        return [x, y];
    }

    changeZ(mode) {
        if (!this.selectionManager.hasSelection()) {
            return;
        }
        const selection = this.selectionManager.copyStack();
        const items = [];

        if (mode == 'front' || mode == 'front-step') {
            if (selection.length == 1) {
                if (selection[0].index != 0) {
                    items.push(selection[0]);
                }
            } else {
                for (const item of selection) {
                    items.push(item);
                }
            }
        } else if (mode == 'back' || mode == 'back-step') {
            if (selection.length == 1) {
                if (selection[0].index < selection[0].parent.children.length - 1) {
                    items.push(selection[0]);
                }
            } else {
                for (const item of selection) {
                    items.push(item);
                }
            }
        }
        if (items.length > 0) {
            this.sashi.moveZ(mode, items);
        }
    }

    /// Event handler for selection changed.
    selectionChanged = (ev) => {
        const isGroupEdit = this.layerManager.isGroupEdit();
        if (!isGroupEdit && ev.prevCount == 0 && ev.count == 1) {
            // change to the layer if newly selected item is on the other layer
            const item = this.selectionManager.get(0);
            const layer = this.layerManager.getActiveLayer(false);
            if (isGroupEdit && item.parent != layer) {
                this.layerManager.setActiveLayer(item.parent);
            }
        }
    }

    /// Returns true if not selected yet and the item is added to the stack.
    /// Otherwise, false returned.
    selectionAdd(item, toggle, addition = false) {
        return this.selectionManager.selectItemOrDeselect(item, toggle, addition);
    }

    selectionAddItems(items, addition = false) {
        this.selectionManager.selectItems(items, addition);
    }

    /// Deselect item.
    selectionDeselect(item) {
        this.selectionManager.deselect(item);
    }

    /// Deselect all items.
    selectionDeselectAll() {
        this.selectionManager.clear();
    }

    /// Draws ranges while selecting.
    selectionDrawSelecting(point1, point2) {
        this.selectionManager.selectionDrawSelecting(point1, point2);
        this.update(false);
    }

    /// Deletes selection.
    selectionDelete() {
        if (this.selectionManager.hasSelection()) {
            this.sashi.deleteItems(this.selectionManager.copyStack());
            this.selectionManager.clearSelection();
            this.update();
        }
    }

    selectAll() {
        this.selectionDeselectAll();
        if (this.layerManager.hasGroupEdit()) {
            const group = this.layerManager.getActiveLayer(true);
            this.selectionAddItems(group.children, false);
        } else {
            const items = [];
            for (const layer of this.layerManager.getUserLayers()) {
                if (layer.visible && !layer.locked) {
                    for (const child of layer.children) {
                        items.push(child);
                    }
                }
            }
            if (items.length > 0) {
                this.selectionAddItems(items, false);
            }
        }

        this.update();
    }

    selectByPoints() {
        const path = this.selectionManager.getPathForPoints();
        if (path) {
            const groupEditStack = this.layerManager.groupEditStack;
            const isGroupEdit = this.layerManager.isGroupEdit();
            const items = [];
            function isInPath(path, item) {
                if (item.className == 'Group') {
                    // all items must be in the path
                    for (const child of item.children) {
                        if (!isInPath(path, child)) {
                            return false;
                        }
                    }
                    return true;
                } else {
                    const r = item.strokeBounds;
                    return path.contains(r.topLeft) &&
                        path.contains(r.bottomRight);
                }
                return false;
            }
            const isInPathRange = (group) => {
                for (const child of group.children) {
                    if (isGroupEdit && child.className == 'Group' &&
                        groupEditStack.indexOf(child) >= 0) {
                        isInPathRange(child);
                    } else {
                        if (isInPath(path, child)) {
                            items.push(child);
                        }
                    }
                }
            };
            for (const layer of this.layerManager.getUserLayers()) {
                if (!layer.visible || layer.locked) {
                    continue;
                }
                isInPathRange(layer);
            }

            if (items.length > 0) {
                this.selectionAddItems(items, false);
                if (this.selectionManager.count() == 1) {
                    // change to layer which item belong to
                    const item = this.selectionManager.get(0);
                    if (item) {
                        this.layerManager.setActiveLayer(item.parent);
                    }
                }
            }
        }
        this.selectionManager.clearPoints();
        this.selectionManager.clearPointsSelection();

        this.update();
    }

    /// Select items in the rectanble specified by two points.
    /// Always additional selection.
    selectByRange(point1, point2, modifiers, forceFull = false, end = false) {
        // left to right rectangle selects whole objects
        // right to left rectangle can select object by partially selection
        const fullSelection = forceFull ? true : point1.x <= point2.x;
        const rectangle = new paper.Rectangle(point1, point2);
        const addition = modifiers.shift;

        const groupEditStack = this.layerManager.groupEditStack;
        const isGroupEdit = this.layerManager.isGroupEdit();

        const items = [];
        if (fullSelection) {
            const isContains = (group) => {
                for (const child of group.children) {
                    if (isGroupEdit && child.className == 'Group' &&
                        groupEditStack.indexOf(child) >= 0) {
                        isContains(child);
                    } else {
                        if (rectangle.contains(child.strokeBounds)) {
                            items.push(child);
                        }
                    }
                }
            };
            for (const layer of this.layerManager.getUserLayers()) {
                if (!layer.visible || layer.locked) {
                    continue;
                }
                isContains(layer);
            }
        } else {
            const isIntersects = (group) => {
                for (const child of group.children) {
                    if (isGroupEdit && child.className == 'Group' &&
                        groupEditStack.indexOf(child) >= 0) {
                        isIntersects(child);
                    } else {
                        if (rectangle.intersects(child.strokeBounds)) {
                            if (child.className == 'Group') {
                                if (child.children.some((item) => rectangle.intersects(item.strokeBounds))) {
                                    items.push(child);
                                }
                            } else {
                                items.push(child);
                            }
                        }
                    }
                }
            };
            for (const layer of this.layerManager.getUserLayers()) {
                if (!layer.visible || layer.locked) {
                    continue;
                }
                isIntersects(layer);
            }
        }
        if (items.length > 0) {
            this.selectionAddItems(items, addition);
            if (this.selectionManager.count() == 1) {
                // change to layer which item belong to
                const item = this.selectionManager.get(0);
                if (item) {
                    this.layerManager.setActiveLayer(item.parent);
                }
            }
        } else if (!addition) {
            this.selectionDeselectAll();
        }

        this.selectionManager.clearSelecting();
        this.update();
    }

    selectAt = (point, modifiers, redraw = true) => {
        const addition = modifiers.shift;
        const groupEditStack = this.layerManager.groupEditStack;
        const isGroupEdit = this.layerManager.isGroupEdit();

        let found = null;
        const isOnAnyChildren = (group) => {
            for (const child of group.children) {
                if (child.strokeBounds.contains(point)) {
                    if (child.className == 'Group') {
                        if (isOnAnyChildren(child)) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
            return false;
        };
        const isAt = (group) => {
            for (const child of group.children) {
                if (child.strokeBounds.contains(point)) {
                    if (isGroupEdit && child.className == 'Group' &&
                        groupEditStack.indexOf(child) >= 0) {
                        if (isAt(child)) {
                            return true;
                        }
                    } else if (child.className == 'Group') {
                        if (isOnAnyChildren(child)) {
                            found = child;
                            return true;
                        }
                    } else {
                        found = child;
                        return true;
                    }
                }
            }
            return false;
        }
        for (const layer of this.layerManager.getUserLayers()) {
            if (!layer.visible || layer.locked) {
                continue;
            }
            if (isAt(layer)) {
                break;
            }
        }

        if (found) {
            this.selectionAdd(found, addition);
            if (this.selectionManager.count() == 1) {
                // change to layer which item belong to
                const item = this.selectionManager.get(0);
                if (item) {
                    this.layerManager.setActiveLayer(item.parent);
                }
            }
        } else if (!addition) {
            this.selectionDeselectAll();
        }

        if (redraw) {
            this.update();
        }
    }

    deleteAt(point) {
        const hitOptions = {
            stroke: true,
            tolerance: paper.settings.hitTolerance,
        };
        const removeItems = [];

        function findGroup(item, targetParent) {
            if (item == null) {
                return null;
            } else if (item.parent == targetParent) {
                return item;
            } else {
                return findGroup(item.parent, targetParent);
            }
        }

        function findInGroup(layer) {
            let ret = false;
            const result = layer.hitTest(point, hitOptions);
            if (result) {

                if (result.item.parent.data.asLayer) {
                    removeItems.push(result.item);
                    ret = true;
                } else {
                    // in group
                    const group = findGroup(result.item, layer);
                    if (group) {
                        removeItems.push(group);
                        ret = true;
                    }
                }
            }
            return ret;
        }

        if (this.layerManager.hasGroupEdit()) {
            const group = this.layerManager.getCurrentEditGroup();
            if (group) {
                findInGroup(group);
            }
        } else {
            for (const layer of this.layerManager.getUserLayers()) {
                if (findInGroup(layer)) {
                    break;
                }
            }
        }

        if (removeItems.length > 0) {
            this.sashi.deleteItems(removeItems);
            this.update();
        }
    }

    selectionToTemplate() {
        if (this.selectionManager.hasSelection()) {
            if (this.selectionManager.count() == 1) {
                return this.selectionManager.stack[0].data.template;
            } else {
                // todo, pivots
                const defs = [];
                for (const item of this.selectionManager.stack) {
                    defs.push(item.data.template);
                }
                return {
                    defs: defs,
                    pivots: [[0, 0]],
                    noGroup: true,
                };
            }
        }
    }

    moveSelectionToLayer(layerIndex) {
        const targetLayer = this.layerManager.getUserLayers()[layerIndex];
        if (!targetLayer) {
            return;
        }
        if (this.selectionManager.hasSelection()) {
            this.sashi.moveToLayer(this.selectionManager.stack, targetLayer);
        }
    }

    changeCanvasSize(width, height, base) {
        if (width <= 0 || height <= 0) {
            return;
        }
        this.sashi.resizeCanvas(width, height, base);
        this.update();
    }

    /// Starts drag to move selection.
    dragMoveStart(startPoint) {
        this.sashi.moveStart(this.selectionManager.stack);
    }

    /// Moving selection while dragging.
    dragMoveItems(startPoint, endPoint) {
        const [offsetX, offsetY] = this.gridManager.distanceXY(startPoint, endPoint);
        this.sashi.moveInterval(this.selectionManager.stack, offsetX, offsetY);
        this.selectionManager.updateSelectionRectangles();
        this.update();
    }

    /// Ends drag to move selection.
    dragMoveEnd(startPoint, endPoint) {
        const [offsetX, offsetY] = this.gridManager.distanceXY(startPoint, endPoint);
        this.sashi.moveEnd(this.selectionManager.copyStack(), offsetX, offsetY);
        this.update();
    }

    /// Clears control layer.
    clearControlLayer() {
        this.layerManager.clearControlLayer();
    }

    /// Clears preview layer.
    clearPreviewLayerAndUpdate() {
        this.layerManager.clearPreviewLayer();
        this.update();
    }

    /// Makes group from selected items.
    makeGroupFromSelection() {
        if (this.selectionManager.hasSelection()) {
            const group = this.sashi.groupItems(this.selectionManager.copyStack());
            this.clearSelection();
            if (group) {
                this.selectionManager.selectItemOrDeselect(group);
            }
            this.update();
        }
    }

    /// Dissolve selected groups.
    dissolveSelectedGroup() {
        if (this.selectionManager.hasSelection()) {
            const items = this.sashi.dissolveGroup(this.selectionManager.copyStack());
            this.clearSelection();
            for (const item of items) {
                this.selectionManager.selectItemOrDeselect(item, true);
            }
            this.update();
        }
    }

    // todo, update selection drawing
    setViewMode(viewMode, force = false) {
        if (force || this.viewMode != viewMode) {
            super.setViewMode(viewMode, force);
            this.toolManager.setViewMode(this, this.viewMode);
            if (this.selectionManager.hasSelection()) {
                this.selectionManager.updateSelectionRectangles();
            }

            this.update();
        }
    }

    /// Sets to edit mode.
    setEditMode(editMode) {
        let isClearPreviewLayer = true;
        if (this.editMode != editMode) {
            const prevMode = this.editMode;
            this.editMode = editMode;
            if (!(prevMode == this.editModeSelect ||
                  prevMode == this.editModeMultiplePointsSelection)) {
                // delete content on the control layer
                this.clearSelection();
            }
            if (prevMode == this.editModeOutputBounds) {
                this.boundsManager.clear();
            }
            let cursor = 'canvas-cursor-default';
            switch (editMode) {
                case this.editModeSelect:
                    break;
                case this.editModeStitch:
                    cursor = 'canvas-cursor-stitch';
                    this.setTemplate(
                        this.template.getTemplate(),
                        this.editModeStitch,
                        this.template.pivotGetIndex(),
                        this.template.isKeepColor());
                    //this.update();
                    break;
                case this.editModeTemplate:
                    cursor = 'canvas-cursor-stitch';
                    break;
                case this.editModeClickDelete:
                    break;
                case this.editModeOutputBounds:
                    this.boundsManager.drawOutputBounds(this, true);
                    break;
                case this.editModeMultiplePointsSelection:
                    break;
                case this.editModePivotInsert:
                    cursor = 'canvas-cursor-stitch';
                    this.layerManager.showPivotLayer();
                    break;
                case this.editModePivotDelete:
                    cursor = 'canvas-cursor-stitch';
                    this.layerManager.showPivotLayer();
                    break;
                default:
                    break;
            }
            this.sashi.canvas.classList.remove('canvas-cursor-default');
            this.sashi.canvas.classList.remove('canvas-cursor-stitch');
            this.sashi.canvas.classList.add(cursor);

            if (!(this.editMode == this.editModePivotInsert ||
                this.editMode == this.editModePivotDelete)) {
                this.layerManager.hidePivotLayer();
            }
            this.toolManager.setEditMode(
                this.editModes.get(this.editMode), true, this.stitchLength);
        } else if (editMode == this.editModeStitch) {
            isClearPreviewLayer = false;
            this.toolManager.setEditMode(
                this.editModes.get(this.editMode), true, this.stitchLength);
        }
        if (isClearPreviewLayer) {
            this.layerManager.clearPreviewLayer();
        }
        this.toolManager.updateEditMode(this.editModes.get(this.editMode));
        this.update();
    }

    /// Clears selection.
    clearSelection() {
        this.selectionManager.clear();
    }

    _isGroupAsLayer(item) {
        return item.className == 'Group' && !!item.data.asLayer;
    }

    _findItemOnParent(item, parent) {
        while (true) {
            let itemParent = item.parent;
            if (itemParent == parent) {
                return item;
                break;
            } else {
                item = itemParent;
                if (!item) {
                    break;
                }
            }
        }
        return null;
    }

    /// Generates array from selected items.
    arraySelection(horiCount, vertCount, horiSpacing, vertSpacing, horiOffset, vertOffset, makeGroup) {
        if (this.selectionManager.hasSelection()) {
            const items = this.arrayItems(
                this.selectionManager.stack,
                horiCount, vertCount, horiSpacing, vertSpacing, horiOffset, vertOffset, makeGroup);
            if (makeGroup) {
                const groupItems = [];
                for (const item of this.selectionManager.stack) {
                    groupItems.push(item);
                }
                for (const item of items) {
                    groupItems.push(item);
                }
                const layer = this.selectionManager.stack[0].parent;
                this.sashi.addItems(items, layer);
                const group = this.sashi.groupItems(groupItems);
                // Merges add and group undo entries.
                this.sashi.undoManager.merge(2);
            } else {
                this.sashi.addItemSequence(items);
            }
            this.update();
        }
    }

    cbArrayInputChanged = (ev) => {
        this.arrayPlacePreview();
    }

    /// Draws preview for array.
    arrayPlacePreview() {
        const op = this.toolManager.getArrayOptions();
        const layer = this.layerManager.getPreviewLayer();

        const items = this.arrayItems(this.selectionManager.stack,
            op['hori-count'], op['vert-count'],
            op['hori-spacing'], op['vert-spacing'],
            op['hori-offset'], op['vert-offset'], false
        );
        this.prepareForPreview(this.editModePreview, items);

        const x = layer.firstChild.data.x;
        const y = layer.firstChild.data.y;
        const point = this.gridManager.gridToPoint(x, y);
        layer.firstChild.position = point;
        this.update();
    }

    /// Makes array.
    arrayItems(items, horiCount, vertCount, horiSpacing, vertSpacing, horiOffset, vertOffset, makeGroup) {
        const itemsCount = items.length;
        if (itemsCount == 0) {
            return [];
        }
        const cloneOptions = {
            insert: false,
            deep: true,
        };
        const copiedItems = [];
        const parent = items[0].parent;
        const gridManager = this.gridManager;

        function copyItem(item, horiShift, vertShift) {
            const copied = item.clone(cloneOptions);
            if (!makeGroup) {
                copied.parent = parent;
            }
            const x = copied.data.x + horiShift;
            const y = copied.data.y + vertShift;
            const point = gridManager.gridToPoint(x, y);
            copied.position = point;
            copied.data.x = x;
            copied.data.y = y;
            copiedItems.push(copied);
            return copied;
        }

        const horiItems = [];

        // horizontal
        if (horiCount > 1) {
            for (const item of items) {
                horiItems.push(item);
                let horiShift = 0;
                let vertShift = 0;
                for (let n = 1; n < horiCount; n++) {
                    horiShift += horiSpacing;
                    vertShift += vertOffset;
                    const copied = copyItem(item, horiShift, vertShift);
                    horiItems.push(copied);
                }
            }
        } else if (horiCount == 1) {
            for (const item of items) {
                horiItems.push(item.clone(cloneOptions));
            }
        }

        // vertical
        if (vertCount > 1) {
            for (const item of horiItems) {
                let horiShift = 0;
                let vertShift = 0;
                for (let n = 1; n < vertCount; n++) {
                    horiShift += horiOffset;
                    vertShift += vertSpacing;
                    copyItem(item, horiShift, vertShift);
                }
            }
        }

        return copiedItems;
    }

    prepareXorV(type, rows, pivotIndex) {
        if (2 <= rows) {
            const template = TemplateGenerator.XorV(type, rows);
            this.setTemplate(template, this.editModeTemplate, pivotIndex);
        }
    }

    moveInputChanged = (ev) => {
        this.movePlacePreview();
    }

    movePrepare() {
        this.prepareForPreview(this.editModePreview, this.selectionManager.clone());
        this.movePlacePreview();
    }

    movePlacePreview() {
        const offsetX = this.toolManager.getIntValue('move-hori-offset');
        const offsetY = this.toolManager.getIntValue('move-vert-offset');
        const layer = this.layerManager.getPreviewLayer();
        const x = layer.firstChild.data.x + offsetX;
        const y = layer.firstChild.data.y + offsetY;
        const point = this.gridManager.gridToPoint(x, y);
        layer.firstChild.position = point;
        this.update();
    }

    /// Moves selected items.
    moveSelection(offsetX, offsetY) {
        this.sashi.moveItems(this.selectionManager.copyStack(), offsetX, offsetY);
        this.update();
    }

    /// Changes to next pivot.
    nextPivot() {
        if (this.template.isValid()) {
            this.template.nextPivot();
            const index = this.template.pivotGetIndex();
            this.setTemplate(this.template.getTemplate(), this.editModeTemplate, index);
            this.update();
        }
    }

    /// Changes to previous pivot.
    previousPivot() {
        if (this.template.isValid()) {
            this.template.previousPivot();
            const index = this.template.pivotGetIndex();
            this.setTemplate(this.template.getTemplate(), this.editModeTemplate, index);
            this.update();
        }
    }

    setStitchLength(length, replace, replaceRight) {
        const stitchLength = length === null || length < 1 ? 1 : length;
        if ((replace || replaceRight) &&
            this.isSingleStitchOnlySelection()) {
            if (this.replaceStitch(length, replace, replaceRight)) {
                return;
            }
        }
        this.stitchLength = stitchLength;
        const template = TemplateGenerator.singleGen(length);
        this.setTemplate(template, this.editModeStitch);
        this.update();
    }

    isSingleStitchOnlySelection() {
        return this.selectionManager.stack.every((item) => {
            return item.className == 'SymbolItem' &&
                item.definition.item.data.singleStitch;
        });
    }

    replaceStitch(length, replace, replaceRight) {
        if (!replace && !replaceRight) {
            return false;
        }
        const source = [];
        const destination = [];
        for (const i in this.selectionManager.stack) {
            const item = this.selectionManager.stack[i];
            const currentLength = item.data.stitchLength;
            if (length == currentLength) {
                return;
            }
            const x = item.data.x + (replaceRight ? (currentLength - length) : 0);
            const y = item.data.y;
            const color = item.definition.item.data.color;
            const newItem = this.sashi.stitchManager.singleStitch(length, color, x, y);
            if (!item.parent.data.asLayer) {
                // in group
                const point = this.gridManager.gridToPoint(
                    newItem.data.x + item.parent.data.x,
                    newItem.data.y + item.parent.data.y
                );
                newItem.position = point;
            }

            source.push(item);
            destination.push(newItem);
        }
        this.sashi.replaceItems(source, destination);
        this.selectionManager.clearSelection();
        this.selectionManager.pushItems(destination);
        this.update();
        return true;
    }

    getTemplateItem() {
        return this.layerManager.getPreviewLayer().firstChild;
    }

    setTemplate(template, editMode, pivotIndex = 0, keepColor = false, state = 'normal') {
        this.template.update(template, keepColor, pivotIndex, state);
        this.setEditMode(editMode);
        const layer = this.layerManager.clearAndGetPreviewLayer();
        this.insertTemplate(this.template,
            this.sashi.viewOption.overlayStitchColor,
            layer, 0, 0, true);
        const previewItem = this.layerManager.getPreviewLayer().firstChild;
        this.setPreviewPosition(previewItem, this.mouseLastLocation);
        this.update();
    }

    /// Insertes current template to specified position.
    insertCurrentTemplate(x, y) {
        if (this.editMode == this.editModeStitch ||
            this.editMode == this.editModeTemplate) {
            if (this.template.isValid()) {
                const pivot = this.template.pivot();
                const bbox = this.template.bbox();
                const xs = x + (this.template.isSingle() && this.viewMode == this.viewModeOverWarp && this.template.pivotGetIndex() == 1 ? -1 : 0);
                const xpos = xs - pivot[0] - bbox[0];
                const ypos = y - pivot[1] - bbox[1];
                this.insertTemplate(this.template, this.sashi.viewOption.stitchColor,
                    this.layerManager.getActiveLayer(), xpos, ypos);
                this.update();
            }
        }
    }

    insertSingleTemplate(template, color, targetLayer, x, y, preview) {
        const item = this.sashi.stitchManager.singleStitch(
            template.getSingleLength(), color, x, y);
        if (preview) {
            const pivot = template.pivot();
            const xpos = pivot[0] + (this.viewMode == this.viewModeOverWarp && this.template.pivotGetIndex() == 1 ? 1 : 0);
            item.pivot = this.gridManager.gridToPoint(xpos, pivot[1]);
            targetLayer.addChild(item);
        } else {
            this.sashi.addItems([item], targetLayer);
        }
    }

    /// Inserts template.
    insertTemplate(template, color, layer, x, y, preview = false) {
        const targetLayer = this.layerManager.getTargetLayer(layer);
        if (targetLayer.locked || !targetLayer.visible) {
            return;
        }

        if (template.isSingle()) {
            this.insertSingleTemplate(template, color, targetLayer, x, y, preview);
        } else {
            const keepColor = template.keepColor;

            const addItems = (container, a, baseX, baseY) => {
                for (const t of a) {
                    if (Array.isArray(t[0])) {
                        const items = [];
                        addItems(items, t[1], 0, 0);
                        const group = new paper.Group(items);
                        group.data.x = baseX + t[0][0];
                        group.data.y = baseY + t[0][1];
                        group.pivot = new paper.Point(0, 0);
                        const position = this.gridManager.gridToPoint(group.data.x, group.data.y);
                        group.position = position;
                        container.push(group);
                    } else {
                        const item = this.sashi.stitchManager.singleStitch(
                            t[2], !preview && keepColor ? t[3] : color, baseX + t[0], baseY + t[1]);
                        container.push(item);
                    }
                }
            };

            const asGroup = template.asGroup;
            const defs = template.getTemplate().defs;
            const pivot = template.pivot();

            const [leftTopX, leftTopY] = this.getLeftTopFortemplate(defs);

            const items = [];

            if (preview || asGroup) {
                addItems(items, defs, asGroup ? 0 : x, asGroup ? 0 : y);
                const group = new paper.Group(items);
                group.data.x = x - leftTopX;
                group.data.y = y - leftTopY;

                if (preview) {
                    group.pivot = this.gridManager.gridToPoint(pivot[0], pivot[1]);
                } else {
                    group.pivot = new paper.Point(0, 0);
                }
                group.position = this.gridManager.gridToPoint(x - leftTopX, y - leftTopY);
                if (preview) {
                    targetLayer.addChild(group);
                } else {
                    this.sashi.addItems([group], targetLayer);
                }
            } else {
                addItems(items, defs, asGroup ? 0 : x + leftTopX, asGroup ? 0 : y + leftTopY);
                this.sashi.addItems(items, targetLayer);
            }
        }
    }

    addToTemplateHistory(locationId, key, keepColor) {
        this.templateHistory.addTemplate(locationId, key, keepColor);
    }

    /// Returns left top coordinate of the item.
    getLeftTopFortemplate(a) {
        let x = 1000000;
        let y = 1000000;
        for (const t of a) {
            if (Array.isArray(t[0])) {
                const [xg, yg] = this.getLeftTopFortemplate(t[1]);
                x = Math.min(x, t[0][0] + xg);
                y = Math.min(y, t[0][1] + yg);
            } else {
                x = Math.min(x, t[0]);
                y = Math.min(y, t[1]);
            }
        }
        return [x, y];
    }

    /// Choose new color.
    chooseColor(name, color) {
        this.toolManager.setCurrentColor(name, color);
        this.sashi.viewOption.stitchColor = color;
        this.sashi.storeViewSettingsPart(this.sashi.viewOption, 'stitchColor');
        this.selectionSetColor(color);
    }

    /// Set color to the current selection.
    selectionSetColor(color) {
        if (this.selectionManager.hasSelection()) {
            this.sashi.setColor(this.selectionManager.copyStack(), color);
            this.update();
        }
    }

    updateSize() {
        this.prepareGrid();
        this.templatesWindow.tabManager.updateContainers();
    }

    /// Forces update user interface.
    updateUI(updateBackground = false) {
        this.updateSize();
        this.toolManager.update();
        this.sashi.stitchManager.setPivotColor(this.sashi.viewOption.pivotColor);
        this.cursorManager.setCursorColor(this.sashi.viewOption.cursorColor);
        const color = this.sashi.viewOption.stitchColor;
        this.toolManager.setCurrentColor(this.toolManager.findColorName(color), color);
        if (updateBackground) {
            this.layerManager.setBackgroundColor(this.sashi.imageSetting.backgroundColor);
            this.layerManager.setBackgroundLayerVisible(this.sashi.imageSetting.setBackground);
            const size = this.gridManager.getFullSize();
            this.layerManager.setBackgroundSize(size);
        }
        if (this.sashi.boundsSetting.useOutputBounds) {
            this.boundsManager.drawOutputBounds(this, false);
        } else {
            this.boundsManager.clearBounds(this, false);
        }
        this.update(true);
    }

    /// Re-draws view.
    update() {
        this.sashi.project.view.draw();
    }

    settingChanged(name) {
        if (name == 'useBounds') {
            this.updateUI();
        }
    }

    /// Prepares grid.
    prepareGrid() {
        super.prepareGrid();
        this.toolManager.setActive('grid-tool', this.gridManager.isVisible());
    }

    initEditMode() {
        this.setEditMode(this.editModeSelect);
    }

    // todo, count number of stitches in the item or selection?
    updateViewCoordinate(point) {
        const [x, y] = this.gridManager.pointToGrid(point);
        this.toolManager.updateCoordinate(x, y);
    }

    /// Inserts pivot at the specified coordinate.
    insertPivot(x, y) {
        const targetLayer = this.layerManager.getPivotLayer();
        const item = this.sashi.stitchManager.newPivot(x, y);
        this.sashi.addPivot([item], targetLayer);
        this.update();
    }

    /// Removes pivot if exists at the specified coordinate.
    deletePivot(x, y) {
        const point = this.gridManager.gridToGridCenterPoint(x, y);
        const hitOptions = {
            center: true,
            tolerance: paper.settings.hitTolerance,
        };
        const removeItems = [];
        const layer = this.layerManager.getPivotLayer();
        const result = layer.hitTest(point, hitOptions);
        if (result) {
            removeItems.push(result.item);
        }
        if (removeItems.length > 0) {
            this.sashi.deletePivot(removeItems);
            this.update();
        }
    }

    /// Context menu event handler.
    onContextMenu = (event) => {
        const point = new paper.Point(event.clientX, event.clientY);
        this.contextMenuPosition = point;
        this.toolManager.showContextMenu('context-dropdown', point, this.selectionManager.hasSelection());
        event.preventDefault();
        return false;
    }

    /// Mosue button down event handler.
    onMouseDown = (event) => {
        const point = event.point;
        this.mouseDragStart.x = point.x;
        this.mouseDragStart.y = point.y;
        this.mouseButtons = event.event.buttons;
    }

    /// Mosue button up event handler.
    onMouseUp = (event) => {
        //const point = new paper.Point(event.layerX, event.layerY);
        const point = event.point;
        if (event.event.detail >= 2) {
            // end of double click
            this.onDoubleClick(event);
            this.mouseDragStarted = false;
            this.mouseDragMode = this.mouseDragModeNone;
            return;
        }
        if (this.mouseDragStarted) {
            // finish of current drag motion.
            if (this.mouseButtons == 1) {
                switch (this.mouseDragMode) {
                    case this.mouseDragModeSelection:
                        this.selectByRange(this.mouseDragStart,
                            point, event.modifiers, false, true);
                        break;
                    case this.mouseDragModeMovement:
                        // keep selection, nothing to do?
                        this.editMode = this.editModeSelect;
                        this.dragMoveEnd(this.mouseDragStart, point);
                        break;
                    case this.mouseDragModeBoundsEdit:
                        this.boundsManager.update();
                        break;
                    default:
                        break;
                }
            }
        } else if (this.mouseButtons == 1) {
            // left click
            switch (this.editMode) {
                case this.editModeSelect:
                    this.selectAt(point, event.modifiers);
                    break;
                case this.editModeStitch: {
                    const [x, y] = this.gridManager.pointToGrid(point);
                    this.insertCurrentTemplate(x, y);
                    break;
                }
                case this.editModeTemplate: {
                    const [x, y] = this.gridManager.pointToGrid(point);
                    this.insertCurrentTemplate(x, y);
                    break;
                }
                case this.editModePreview: {
                    // no insertion
                    break;
                }
                case this.editModeClickDelete: {
                    this.deleteAt(point);
                    break;
                }
                case this.editModeMultiplePointsSelection: {
                    this.selectionManager.pushPoint(this.pointToPoint(point));
                    this.updatesPointsSelect(this.pointToPoint(point));
                    break;
                }
                case this.editModePivotInsert: {
                    const [x, y] = this.gridManager.pointToGrid(point);
                    this.insertPivot(x, y);
                    break;
                }
                case this.editModePivotDelete: {
                    const [x, y] = this.gridManager.pointToGrid(point);
                    this.deletePivot(x, y);
                    break;
                }
                default:
                    break;
            }
            this.toolManager.closePopup('context-dropdown');
        }
        this.mouseDragStarted = false;
        this.mouseDragMode = this.mouseDragModeNone;
    }

    _eventToModifiers(event) {
        return {
            control: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
        };
    }

    activeLayerChanged = () => {
    }

    getItemAt = (point) => {
        const options = {
            stroke: true,
            tolerance: paper.settings.hitTolerance,
        };
        for (const layer of this.layerManager.getUserLayers()) {
            const result = layer.hitTest(point, options);
            if (result) {
                return result.item;
            }
        }
        return null;
    }

    goToGroupEdit = (point) => {
        const parentStack = [];
        const isAt = (group) => {
            for (const child of group.children) {
                if (child.strokeBounds.contains(point)) {
                    if (child.className == 'Group') {
                        if (isAt(child)) {
                            return true;
                        }
                    } else {
                        let parent = child.parent;
                        while (parent) {
                            parentStack.push(parent);
                            parent = parent.parent;
                        }
                        return true;
                    }
                }
            }
            return false;
        };

        for (const layer of this.layerManager.getUserLayers()) {
            if (!layer.visible || layer.locked) {
                continue;
            }
            if (isAt(layer)) {
                break;
            }
        }

        const isGroupEdit = this.layerManager.isGroupEdit();
        // root (real layer) - layer (group asLayer) - group
        if (parentStack.length >= 3) {
            // remove both layer and root
            parentStack.pop();
            parentStack.pop();
            parentStack.reverse();

            if (!isGroupEdit ||
                (isGroupEdit && !this.layerManager.isGroupSingleStep(parentStack))) {
                while (parentStack.length > 1) {
                    parentStack.pop();
                }
            }
            this.layerManager.setGroupEditStack(parentStack);
            this.toolManager.updateLayers();
            this.clearSelection();
            this.update();
        } else {
            // up sigle step
            if (this.layerManager.hasGroupEdit()) {
                this.layerManager.popGroupEdit(1, true);
            }
            if (this.layerManager.hasGroupEdit()) {
            } else if (isGroupEdit) {
                // cancel group edit mode
                this.layerManager.clearGroupEdit();
            } else {
                return;
            }
            this.toolManager.updateLayers();
        }
    }

    // - if item is the child of current layer or group edit,
    //   go into the group
    // - if
    goToGroupEdit2 = (point) => {
        const item = this.getItemAt(point);

        if (this.layerManager.isGroupEdit()) {
            if (!item) {
                // back to normal mode
                this.layerManager.clearGroupEdit();
                return;
            } else {
                const group = item.parent;
                // maybe one of parent group
                const groupEditStack = this.layerManager.getEditGroups();
                const length = groupEditStack.length;
                let count = 0;
                for (let i = length - 1; i >= 0; i--) {
                    if (groupEditStack[i] == item.parent) {
                        if (count == 0) {
                            // into child group of current group
                            this.layerManager.pushGroupEdit(group);
                        } else {
                            // some group is the new parent
                            this.layerManager.popGroupEdit(count);
                        }
                        return;
                    }
                    count += 1;
                }
                // out of tree of this group
            }
        }
        if (item) {
            // todo, only single step go into the group
            // todo, maybe layer change
            const root = this.layerManager.getRootLayer();
            let parent = item.parent;
            let layer = null;
            const groups = [];
            while (true) {
                if (parent.className == 'Group') {
                    if (parent.data.asLayer) {
                        layer = parent;
                        break;
                    } else {
                        groups.push(parent);
                        parent = parent.parent;
                    }
                } else if (parent == root) {
                    layer = parent;
                    break;
                } else {
                    // todo, what to do
                    break;
                }
            }
            // enter group edit mode
            this.layerManager.clearGroupEdit();
            this.layerManager.setActiveLayer(layer);
            for (let i = groups.length - 1; i >= 0; i--) {
                this.layerManager.pushGroupEdit(groups[i], i == 0);
            }
            this.clearSelection();
            this.update();
        }
    }

    pointToPoint(p) {
        return new paper.Point(p.x, p.y);
    }

    endMultiplePointsSelection = (modifiers) => {
        const addition = modifiers.shift;
        if (!addition) {
            this.selectionManager.clearSelection(false);
        }
        if (this.selectionManager.hasPoints()) {
            this.selectByPoints();
            this.setEditMode(this.editModeSelect);
        }
    }

    /// Double click event handler.
    onDoubleClick = (event) => {
        switch (this.editMode) {
            case this.editModeSelect: {
                this.goToGroupEdit(event.point);
                break;
            }
            case this.editModeMultiplePointsSelection: {
                // end points-selection mode
                this.endMultiplePointsSelection(event.modifiers);
                break;
            }
            default:
                break;
        }
    }

    zoom(value) {
        if (value < this.ZoomMin || value > this.ZoomMax) {
            return;
        }
        this.sashi.project.view.zoom = value;
        const center = this.sashi.project.view.center;
        center.x = Math.floor(center.x) + 0.5;
        center.y = Math.floor(center.y);
        this.sashi.project.view.center = center;
        this.sashi.viewOption.zoomValue = value;

        this.update();
    }

    /// Maginfy.
    zoomIn() {
        this.zoom(this.sashi.project.view.zoom * this.ZoomStep);
    }

    /// Reduce zoom factor.
    zoomOut() {
        this.zoom(this.sashi.project.view.zoom / this.ZoomStep);
    }

    /// Resets zoom state.
    zoomReset() {
        this.zoom(1.0);
    }

    /// Zoom.
    zoomAt(isZoomIn, centerX, centerY) {
        // todo, scroll center
        const point = new paper.Point(centerX, centerY);
        const currentCenter = this.sashi.project.view.center;

        const distance = point.subtract(currentCenter);
        const center = currentCenter.add(distance.multiply((this.ZoomStep - 1.0) / this.ZoomStep));

        let zoom = isZoomIn ?
            this.sashi.project.view.zoom * this.ZoomStep :
            this.sashi.project.view.zoom / this.ZoomStep;

        if (zoom < this.ZoomMin || zoom > this.ZoomMax) {
            return;
        }

        this.sashi.project.view.zoom = zoom;
        this.sashi.project.view.center = center;
        this.sashi.viewOption.zoomValue = zoom;

        this.update();
    }

    /// Wheel event handler.
    onwheel = (event) => {
        if (event.ctrlKey) {
            if (event.deltaY == 0) {
                return;
            }
            event.preventDefault();
            this.zoomAt(event.deltaY < 0, event.offsetX, event.offsetY);
        }
    }

    /// Adds point to points to select to draw shape to be selected.
    updatesPointsSelect(point) {
        if (this.selectionManager.updatesPointsSelectPath(point, this.mouseLastLocation)) {
            this.update();
        }
    }

    /// Moves last point for points to select at mouse cursor.
    drawPointsSelect(point) {
        if (this.selectionManager.hasPoints()) {
            this.selectionManager.pointsSelectMoveLastPoint(point);
            this.update();
        }
    }

    // todo, ctrl + mouse move: move canvas
    /// Mouse move event handler.
    onMouseMove = (event) => {
        if (event.event.target.id !== 'canvas') {
            return;
        }
        this.mouseLastLocation = event.point;
        let updateRequest = false;

        const previewItem = this.layerManager.getPreviewLayer().firstChild;
        if (previewItem) {
            switch (this.editMode) {
                case this.editModeStitch: {
                    updateRequest = this.setPreviewPosition(previewItem, event.point);
                    break;
                }
                case this.editModeTemplate: {
                    updateRequest = this.setPreviewPosition(previewItem, event.point);
                    break;
                }
                default:
                    break;
            }
        } else if (this.editMode == this.editModeMultiplePointsSelection) {
            if (this.selectionManager.hasPoints()) {
                this.drawPointsSelect(this.pointToPoint(event.point));
            }
        }
        if (this.sashi.viewOption.crosshair || this.sashi.viewOption.oneToOne || this.sashi.viewOption.oneToTwo) {
            if (this.cursorManager.crosshairSetPosition(this.mouseLastLocation)) {
                updateRequest = true;
            }
        }
        if (updateRequest) {
            this.update();
        }
        this.updateViewCoordinate(event.point);
    }

    /// Move drag event handler.
    onMouseDrag = (event) => {
        this.cursorManager.crosshairSetPosition(event.point);
        this.updateViewCoordinate(event.point);
        // todo, ignore drag mode while non-selection edit mode.
        if (!this.mouseDragStarted) {
            // drag is just started
            // todo, if drag is started on an item, movement function is choosen.
            switch (this.mouseButtons) {
                case 1:
                    // left button
                    if (this.selectionManager.hasSelection()) {
                        if (this.selectionManager.isInside(this.mouseDragStart)) {
                            this.editMode = this.editModeMovement;
                            this.mouseDragMode = this.mouseDragModeMovement;
                            this.dragMoveStart(this.mouseDragStart);
                            break;
                        }
                    }
                    if (this.editMode == this.editModeSelect) {
                        this.mouseDragMode = this.mouseDragModeSelection;
                    } else if (this.editMode == this.editModeOutputBounds) {
                        if (this.boundsManager.isDragStart(event.point)) {
                            this.mouseDragMode = this.mouseDragModeBoundsEdit;
                        }
                    }
                    break;
                case 2:
                    // right button: nothing to do
                    return;
                    break;
                case 4:
                    // todo, middle button, pan mode
                    this.mouseDragMode = this.mouseDragModePan;
                    this.mouseDragStarted = true;
                    return;
                    break;
                default:
                    break;
            }
        }
        this.mouseDragStarted = true;
        switch (this.mouseDragMode) {
            case this.mouseDragModeSelection:
                this.selectionDrawSelecting(this.mouseDragStart, event.point);
                break;
            case this.mouseDragModeMovement:
                this.dragMoveItems(this.mouseDragStart, event.point);
                break;
            case this.mouseDragModePan:
                this.moveCanvas(this.mouseDragStart.clone(), event.point);
                break;
            case this.mouseDragModeBoundsEdit:
                this.boundsManager.drag(event.point);
                break;
            default:
                break;
        }
    }

    moveCanvas = (p1, p2) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        this.sashi.project.view.translate(dx, dy);
        this.update();
    }

    /// Key down event handler.
    onKeyDown = (event) => {
        const character = event.key.toLowerCase();
        const code = character.charCodeAt(0);

        const isCtrl = event.ctrlKey;
        const isAlt = event.altKey;
        const isShift = event.shiftKey;

        let command = (isCtrl ? 'ctrl-' : '') +
            (isAlt ? 'alt-' : '') +
            (isShift ? 'shift-' : '') +
            character;
        // from shortcut to command
        let converted = this.shortcutKeys.get(command);
        if (converted) {
            command = converted;
        }
        let func = this.operations[command];
        if (typeof func == 'string') {
            for (let i = 0; i < 3; i++) {
                func = this.operations[func];
                if (typeof func != 'string') {
                    break;
                }
            }
        }
        if (func) {
            event.preventDefault();
            func(isCtrl, isAlt, isShift);
        }
    }

    onKeyDownForSpecialDialogs = (event) => {
        switch (event.keyCode) {
            case 27: {
                // escape
                const element = document.activeElement;
                if (element.id != 'templates-filter-input') {
                    this.toolManager.closeDialog('msgbox-dialog');
                    this.toolManager.closeDialog('name-input');
                    this.toolManager.closeSpecialDialogs();
                }
                break;
            }
            case 13: {
                // enter
                const element = document.activeElement;
                if (element.id == 'name-input') {
                    this.fireCommand('name-ok');
                }
                break;
            }
        }
    }

    /// Resizing event handler.
    onResize = (event) => {
        this.updateSize();
    }

    onDrop = (event) => {
        event.preventDefault();
        let n = 0;
        for (const file of event.dataTransfer.files) {
            if (file.type == 'image/svg+xml') {
                this.openFromFile(file, n != 0);
                n += 1;
            }
        }
    }

    onDragover = (event) => {
        event.preventDefault();
    }
}
