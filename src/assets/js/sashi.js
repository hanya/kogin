'use strict';

import { LayerManager } from "./layer.js";
import { GridManager } from "./grid.js";
import { SettingsManager } from "./settings.js";
import { StitchManager } from "./stitch.js";
import { UndoManager } from "./undo.js";
import {
    BoundsOption, GridOptionForPrinting, GridOptionForView,
    TemplatesOption, Metadata,
    OutputOption, OutputOptionForDisplay, OutputOptionForPrinting,
    ViewOption, StorageViewOption, StorageOption, PDFOption
} from "./option.js";
import { View } from "./view.js";
import { Filter } from "./filter.js";
import { TemplateManager } from "./template_manager.js";
import { getDate } from "./tools.js";
import { Storage } from "./storage.js";


export class Sashi {
    /**
     * Constructor.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} isApp
     */
    constructor(canvas, isApp=false, settingsBase=null, settingsManager=null) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;
        /** @type {paper.Project} */
        this.project = this._initPaperJS(isApp);
        this.settingsManager = settingsManager;
        this._init(isApp, settingsBase);
    }

    _init(isApp, settingsBase) {
        this.project.clear();

        this.movementValue = null;
        this.moveTimeoutID = null;

        /** @type {string} */
        this.fileName = '';
        /** @type {boolean} */
        this.modified = false;
        this.dataInfo = {};
        /** @type {Object} */
        this.saveOption = {};

        // Loads settings from browser.
        if (!this.settingsManager) {
            this.settingsManager = new SettingsManager();
        }

        // Load or init settings.
        if (settingsBase) {
            this.loadSettingsFromModel(settingsBase);
        } else {
            this.loadSettings();
        }
        this.metadata = this.loadMetadataDefault();

        this.undoManager = new UndoManager();
        this.layerManager = new LayerManager(this.project);
        this.layerManager.addInitialLayers();
        this.gridManager = new GridManager(this.layerManager, this.viewGrid);
        this.gridManager.setGridCount(
            this.viewGrid.horiCount, this.viewGrid.vertCount);

        this.stitchManager = new StitchManager(
            this.gridManager, this, this.viewOption.viewMode, this.viewOption.pivotColor);
        if (isApp) {
            this.templateManager = window.docs ? window.docs.templateManager : new TemplateManager(this.templatesSetting.dirPath);
            this.initForStorage();
        }
        this.filter = new Filter(this);
    }

    /**
     * Initialize paper.js related settings.
     * @param {boolean} isApp
     * @return {paper.Project}
     */
    _initPaperJS(isApp) {
        if (typeof this.canvas == 'string') {
            this.canvas = document.getElementById(this.canvas);
        }
        const project = new paper.Project(this.canvas);
        project.view.autoUpdate = false;

        if (isApp) {
            project.activate();
        }
        return project;
    }

    getDataInfo() {
        return this.dataInfo;
    }

    clearDataInfo() {
        this.dataInfo = {
            saved: true,
        };
    }

    /**
     * Sets both location ID and entry ID for template entry.
     *
     * @param {numeric} locationId Location ID.
     * @param {numeric} key Entry ID.
     */
    setLocationData(locationId, key, folder) {
        this.dataInfo = {
            isTemplate: true,
            locationId: locationId,
            key: key,
            folder: folder,
        };
    }

    /**
     * Returns true if this document is template, otherwise false.
     *
     * @return {boolean}
     */
    isTemplate() {
        return this.dataInfo.isTemplate;
    }

    canSaveAsTemplate() {
        return this.fileName != '' && this.dataInfo.isTemplate;
    }

    /// Returns true if this document can be over written by new document or opened document, otherwise false.
    canOverride() {
        return !this.modified && this.fileName == '' &&
                !this.dataInfo.isTemplate && !this.dataInfo.isStorage;
        // todo, no filename means not from template or storage?
    }

    setStorageData(op) {
        this.dataInfo = {
            isStorageData: true,
            op: op,
        };
    }

    isStorageData() {
        return this.dataInfo.isStorageData;
    }

    canSaveInStorage() {
        return this.fileName != '' && this.dataInfo.isStorageData;
    }

    /**
     * Sets new view to this model.
     *
     * @param {View} view View instance.
     */
    setView(view) {
        this.view = view;

        view.updateUI(true);
        view.gridShow(this.gridManager.showGrid);
        if (view.checkPermission) {
            view.checkPermission();
        }
    }

    initForStorage() {
        this.templateManager.init();
    }

    /// Clears document.
    clear() {
        this.fileName = '';
        this.modified = true;
        this.setModified(false);
        this.loadSettings();
        this.metadata = this.loadMetadataDefault();

        this.undoManager.clear();
        this.layerManager.clear();
        this.stitchManager.clear();
        this.view.clear();
    }

    /// Returns file name.
    getFileName() {
        return this.fileName;
    }

    /// Sets file name.
    setFileName(fileName) {
        this.fileName = fileName;
        this.view.fileNameChanged(this.fileName);
    }

    /// Sets use bounds or not.
    setBoundsUse(boundsUse) {
        const changed = this.boundsSetting.useOutputBounds != boundsUse;
        this.boundsSetting.useOutputBounds = boundsUse;
        if (changed && this.view) {
            this.view.settingChanged('useBounds');
        }
    }

    setSaveOption(op) {
        this.saveOption = op;
    }

    isForPrinting() {
        return !!this.saveOption.forPrinting;
    }

    /// Generates data.
    write(op) {
        return this.filter.write(op);
    }

    /// Reads data.
    read(data, fileName) {
        this.undoManager.clear();
        this.filter.read(data);
        this.setFileName(fileName);
        this.setModified(false);
    }

    postViewUpdate() {
        if (this.view) {
            this.view.initEditMode();
            this.view.prepareGrid();
            this.view.setViewMode(this.viewOption.viewMode, true);
            this.view.zoom(this.viewOption.zoomValue);
            this.view.updateUI(true);
        }
    }

    canClose() {
        const state = !(this.view && window.app.viewOption.askWhenClosing &&
                        window.app.isModified());
        if (!state) {
            this.view.askForClosing();
        }
        return state;
    }

    openData(data, fileName) {
        try {
            this.read(data, fileName);
        } catch (error) {
            if (this.view) {
                this.view.toolManager.showMessage(
                    this.view.toolManager.translate(
                        "This file could not be opened.") + " " + fileName, 'Error');
            } else {
                console.log(error);
            }
            return;
        }
        this.postViewUpdate();
    }

    openFromStorage(type, id) {
        const storage = new Storage(type);
        storage.readFile(id, (key, name, data) => {
            try {
                this.read(data, name);
            } catch (error) {
                //this.toolManager.showMessage(error, 'Error');
                console.log(error);
                return;
            }
            this.setStorageData({ type: type, key: key });
            this.postViewUpdate();
        }, (error) => {
            //this.toolManager.showMessage(error.toString(), 'Error');
            console.log(error);
        });
    }

    openTemplate(locationId, key) {
        // wait for loading indexedDB or other storage.
        if (!this.view) {
            return;
        }
        let count = 0;
        const timeout = () => {
            if (this.templateManager.isInitialized(locationId)) {
                this.templateManager.loadData(
                    locationId, key, this.cbTemplateDataLoaded,
                    { locationId: locationId, key: key, }
                );
            } else if (count < 10) {
                count += 1;
                setTimeout(timeout, 150);
            }
        };
        setTimeout(timeout, 150);
    }

    cbTemplateDataLoaded = (op, key, fileName, data, folder) => {
        try {
            this.read(data, fileName);
        } catch (error) {
            console.log(error);
            this.view.toolManager.showMessage(error, 'error');
            return;
        }
        this.setLocationData(op.locationId, op.key, folder);
        this.postViewUpdate();
    }

    /// Loads settings.
    loadSettings() {
        this.imageSetting = this.loadImageSettings();
        this.viewGrid = this.loadViewGridSettings();
        this.printSetting = this.loadPrintSettings();
        this.printGrid = this.loadPrintGridSettings();
        this.viewOption = this.loadViewSettings();
        this.boundsSetting = this.settingsManager.load('bounds.', BoundsOption);
        this.templatesSetting = this.settingsManager.load('templates.', TemplatesOption);
        this.pdfSetting = this.settingsManager.load('pdf.', PDFOption);
    }

    /// Loads settings from another instance.
    loadSettingsFromModel(base) {
        this.imageSetting = SettingsManager.loadFrom({}, base.imageSetting, OutputOptionForDisplay);
        this.viewGrid = SettingsManager.loadFrom({}, base.viewGrid, GridOptionForView);
        //this.printSetting = SettingsManager.loadFrom({}, base.printSetting, OutputOptionForPrinting);
        //this.printGrid = SettingsManager.loadFrom({}, base.printGrid, GridOptionForPrinting);
        const viewOption = this.loadViewSettings();
        this.viewOption = SettingsManager.loadFrom({}, base.viewOption, ViewOption);
        // overwrite some view options
        for (const key of ['crosshair', 'oneToOne', 'oneToTwo', 'openFromToolbar', 'saveFromToolbar', 'autoScrollOnTemplates']) {
            this.viewOption[key] = viewOption[key];
        }
        this.boundsSetting = SettingsManager.loadFrom({}, base.boundsSetting, BoundsOption);
        //this.pdfSetting = SettingsManager.loadFrom({}, base.pdfSetting, PDFOption);
    }

    storeImageSettings(imageValue, gridValue) {
        this.settingsManager.store(
            'image.', imageValue, OutputOptionForDisplay);
        this.settingsManager.store(
            'view-grid.', gridValue, GridOptionForView);
    }

    loadImageSettings() {
        return this.settingsManager.load('image.', OutputOptionForDisplay);
    }

    loadViewGridSettings() {
        return this.settingsManager.load('view-grid.', GridOptionForView);
    }

    storePrintSettings(printValue, gridValue) {
        this.settingsManager.store(
            'print.', printValue, OutputOptionForPrinting);
        this.settingsManager.store(
            'print-grid.', gridValue, GridOptionForPrinting);
    }

    loadPrintSettings() {
        return this.settingsManager.load('print.', OutputOptionForPrinting);
    }

    loadPrintGridSettings() {
        return this.settingsManager.load('print-grid.', GridOptionForPrinting);
    }

    storeViewSettings(viewValue) {
        this.settingsManager.store('view.', viewValue, ViewOption);
    }

    storeViewSettingsPart(viewValue, name) {
        const obj = {};
        obj[name] = ViewOption[name];
        this.settingsManager.store('view.', viewValue, obj);
    }

    storePDFSettings(options) {
        this.settingsManager.store('pdf.', options, PDFOption);
    }

    /**
     * Returns default view option.
     *
     * @returns {ViewOption}
     */
    loadViewSettings() {
        return this.settingsManager.load('view.', ViewOption);
    }

    storeTemplateSettings() {
        this.settingsManager.store('templates.', this.templatesSetting, TemplatesOption);
    }

    storeTemplateSettingsPart(value, names) {
        const obj = {};
        for (const name of names) {
            obj[name] = TemplatesOption[name];
        }
        this.settingsManager.store('templates.', value, obj);
    }

    loadStorageSettings() {
        const viewOp = this.settingsManager.load('storage.', StorageViewOption);
        const op = this.settingsManager.load('storage.', StorageOption);
        return {
            activeIndex: viewOp.activeIndex,
            storages: op.storages,
        };
    }

    storeStoragesSettings(storages) {
        this.settingsManager.store('storage.', storages, StorageOption);
    }

    /// Stores metadata as default.
    storeMetadataAsDefault(metadata) {
        this.settingsManager.store('metadata.', metadata, Metadata);
    }

    /// Loads metadata from settings, creation date is now.
    loadMetadataDefault() {
        const metadata = this.settingsManager.load('metadata.', Metadata);
        metadata.creationDate = getDate();
        return metadata;
    }

    /// Resets ouput bounds.
    resetBounds() {
        const settings = this.boundsSetting;
        const props = ['boundsLeft', 'boundsRight', 'boundsTop', 'boundsBottom'];
        for (const prop of props) {
            settings[prop] = OutputOption[prop];
        }
    }

    /// Adds undo entry.
    addUndoEntry(entry) {
        this.undoManager.push(entry);
        this.setModified(true);
    }

    /// Checks is modified.
    isModified() {
        return this.modified;
    }

    /// Set modified status.
    setModified(state) {
        const changed = state != this.modified;
        this.modified = state;
        if (changed && this.view) {
            this.view.modifiedStateChanged();
        }
    }

    /// Calculates coordinate of parent group.
    _calcParentCoord(parent) {
        let x = 0;
        let y = 0;
        if (parent && !parent.data.asLayer) {
            x += parent.data.x;
            y += parent.data.y;
            const [px, py] = this._calcParentCoord(parent.parent);
            x += px;
            y += py;
        }
        return [x, y];
    }

    addPivot(items, layer) {
        const entries = [];
        let index = 0;
        for (const item of items) {
            entries.push({
                item: item,
                index: index,
                parent: layer,
            });
            index += 0;
        }
        const op = {
            op: 'pivot_insert',
            items: entries,
        };
        this.undoManager.redo_pivot_insert(op);
        this.addUndoEntry(op);
        return items;
    }

    deletePivot(items) {
        const entries = [];
        for (const item of items) {
            entries.push({
                item: item,
                index: item.index,
                parent: item.parent,
            });
        }
        const op = {
            op: 'pivot_delete',
            items: entries,
        };
        this.undoManager.redo_pivot_delete(op);
        this.addUndoEntry(op);
    }

    /// Adds items into the layer or group.
    addItems(items, layer) {
        const entries = [];
        let index = 0;
        const [px, py] = this._calcParentCoord(layer);
        for (const item of items) {
            item.data.x -= px;
            item.data.y -= py;
            entries.push({
                item: item,
                index: index,
                parent: layer,
            });
            index += 1;
        }

        const op = {
            op: 'insert',
            items: entries,
        };
        this.undoManager.redo_insert(op);
        this.addUndoEntry(op);
        return items;
    }

    /// Adds items to own parent.
    addItemSequence(items) {
        const entries = [];
        const indexMap = new Map();
        for (const item of items) {
            const parentId = item.parent.id;
            let nextIndex = indexMap.get(parentId);
            if (nextIndex) {
                indexMap.set(parentId, nextIndex + 1);
            } else {
                indexMap.set(parentId, 1);
                nextIndex = 0;
            }
            entries.push({
                item: item,
                index: nextIndex,
                parent: item.parent,
            });
        }

        const op = {
            op: 'insert',
            items: entries,
        };
        this.undoManager.redo_insert(op);
        this.addUndoEntry(op);
        return items;
    }

    /// Deletes items.
    deleteItems(items) {
        const entries = [];
        for (const item of items) {
            entries.push({
                item: item,
                index: item.index,
                parent: item.parent,
            });
        }

        const op = {
            op: 'delete',
            items: entries,
        };
        this.undoManager.redo_delete(op);
        this.addUndoEntry(op);
    }

    /// Find top left coordinate.
    findLeftTop(items) {
        const min = Math.min;
        let x = 1000000;
        let y = 1000000;
        for (const item of items) {
            x = min(x, item.data.x);
            y = min(y, item.data.y);
        }
        return [x, y];
    }

    /// Makes new group which contains passed items.
    groupItems(items) {
        if (items.length == 0) {
            return null;
        }
        const layer = items[0].parent;

        const [x, y] = this.findLeftTop(items);

        const entries = [];
        for (const item of items) {
            const newX = item.data.x - x;
            const newY = item.data.y - y;
            const newPosition = this.gridManager.gridToPoint(newX, newY);
            entries.push({
                item: item,
                index: item.index,
                parent: item.parent,
                oldX: item.data.x,
                oldY: item.data.y,
                newX: newX,
                newY: newY,
                oldPosition: item.position.clone(),
                newPosition: newPosition.clone(),
            });
            item.data.x = newX;
            item.data.y = newY;
            item.position = newPosition;
        }
        const group = new paper.Group(items);
        group.data.x = x;
        group.data.y = y;
        group.pivot = new paper.Point(0, 0);
        group.position = this.gridManager.gridToPoint(x, y);
        layer.addChild(group);

        this.addUndoEntry({
            op: 'group',
            group: group,
            layer: layer,
            items: entries,
        });
        return group;
    }

    /// Dissolve groups.
    dissolveGroup(items) {
        if (items.length == 0) {
            return null;
        }

        const selection = [];
        const groups = [];
        for (const group of items) {
            if (group.className == 'Group') {
                const x = group.data.x;
                const y = group.data.y;
                const entries = [];
                const parent = group.parent;
                const children = group.children;
                const length = children.length;
                for (let n = 0; n < length; n++) {
                    const child = children[0]; // always 0
                    const newX = child.data.x + x;
                    const newY = child.data.y + y;
                    entries.push({
                        item: child,
                        oldX: child.data.x,
                        oldY: child.data.y,
                        newX: newX,
                        newY: newY,
                    });
                    child.remove();
                    parent.addChild(child);
                    selection.push(child);
                    child.data.x = newX;
                    child.data.y = newY;
                }
                groups.push({
                    group: group,
                    parent: parent,
                    index: group.index,
                    items: entries,

                });
                group.remove();
            }
        }

        this.addUndoEntry({
            op: 'ungroup',
            groups: groups,
        });
        return selection;
    }

    /// Adds new layer with its name.
    addLayer(newName) {
        const layer = this.layerManager.addLayer(newName);
        // todo, update layer state buttons
        const op = {
            op: 'layer_add',
            manager: this.layerManager,
            layer: layer,
            index: this.layerManager.getLayerIndex(layer),
        };

        // the layer is already adde, do not add here again
        this.addUndoEntry(op);
        return layer;
    }

    /// Removes specified layer.
    removeLayer(layer) {
        const index = this.layerManager.getLayerIndex(layer);
        const op = {
            op: 'layer_delete',
            manager: this.layerManager,
            layer: layer,
            index: index,
        };
        this.undoManager.redo_layer_delete(op);
        this.addUndoEntry(op);
    }

    /// Renames specified layer.
    renameLayer(layer, newName) {
        const oldName = layer.name;
        const op = {
            op: 'layer_rename',
            layer: layer,
            newName: newName,
            oldName: oldName,
        };
        this.undoManager.redo_layer_rename(op);
        this.addUndoEntry(op);
        return layer;
    }

    /// Resize canvas.
    resizeCanvas(width, height, base) {
        const needsMovement = base != 'base-top-left';

        const oldWidth = this.viewGrid.horiCount;
        const oldHeight = this.viewGrid.vertCount;
        let dx = 0;
        let dy = 0;
        if (needsMovement) {
            if (base == 'base-top-right') {
                dx = width - oldWidth;
            } else if (base == 'base-bottom-left') {
                dy = height - oldHeight;
            } else if (base == 'base-bottom-right') {
                dx = width - oldWidth;
                dy = height - oldHeight;
            } else if (base == 'base-center') {
                dx = Math.ceil((width - oldWidth) / 2);
                dy = Math.ceil((height - oldHeight) / 2);
            }
        }
        const op = {
            op: 'canvas_resize',
            dx: dx,
            dy: dy,
            base: base,
            items: this.layerManager.getUserLayers(),
            pivots: this.layerManager.getPivotLayer(),
            gridManager: this.gridManager,
            newWidth: width,
            newHeight: height,
            oldWidth: oldWidth,
            oldHeight: oldHeight,
        };
        this.undoManager.redo_canvas_resize(op);
        this.addUndoEntry(op);
    }

    /// Sets color to items.
    _setColorToItems(items, color) {
        const entries = [];
        for (const item of items) {
            if (item.className == 'SymbolItem') {
                const definition = item.definition;
                const newDef = this.stitchManager.replace(
                    item.definition, item.definition.item.data.stitchLength, color);
                item.definition = newDef;
                entries.push({
                    item: item,
                    oldDefinition: definition,
                    newDefinition: newDef,
                });
            } else if (item.className == 'Group') {
                const ets = this._setColorToItems(item.children, color);
                for (const entry of ets) {
                    entries.push(entry);
                }
            }
        }
        return entries;
    }

    /// Sets color to items.
    setColor(items, color) {
        const entries = this._setColorToItems(items, color);

        this.addUndoEntry({
            op: 'color',
            items: entries,
        });
    }

    /// Moves items to the layer.
    moveToLayer(items, layer) {
        const entries = [];
        for (const item of items) {
            entries.push({
                item: item,
                index: item.index,
                oldLayer: item.layer,
            });
            //item.remove();
            //layer.addChild(item);
        }

        const op = {
            op: 'move_to_layer',
            items: entries,
            newLayer: layer,
        };
        this.undoManager.redo_move_to_layer(op);
        this.addUndoEntry(op);
    }

    /// Tells to start movement of items.
    moveStart(items) {
        for (const item of items) {
            const [px, py] = this._calcParentCoord(item.parent);
            const data = item.data;
            data.moveStartX = data.x;
            data.moveStartY = data.y;
            data.startPosition = item.position.clone();
            data.parentCoordX = px;
            data.parentCoordY = py;
        }
    }

    /// While moving items, no undo entry published.
    moveInterval(items, offsetX, offsetY) {
        for (const item of items) {
            const data = item.data;
            const x = data.moveStartX + offsetX + data.parentCoordX;
            const y = data.moveStartY + offsetY + data.parentCoordY;
            const point = this.gridManager.gridToPoint(x, y);
            item.position = point;
        }
    }

    /// Tells to end movement of items with undo entry.
    moveEnd(items, offsetX, offsetY) {
        const moveItems = [];
        for (const item of items) {
            const data = item.data;
            const oldPosition = data.startPosition;
            delete data.startPosition;
            const oldX = data.moveStartX + data.parentCoordX;
            const oldY = data.moveStartY + data.parentCoordY;
            const x = oldX + offsetX;
            const y = oldY + offsetY;
            const point = this.gridManager.gridToPoint(x, y);
            item.position = point;
            data.x = x - data.parentCoordX;
            data.y = y - data.parentCoordY;
            delete data.moveStartX;
            delete data.moveStartY;
            delete data.parentCoordX;
            delete data.parentCoordY;
            moveItems.push({
                item: item,
                oldPosition: oldPosition,
                newPosition: item.position.clone(),
                oldX: oldX,
                oldY: oldY,
                newX: x,
                newY: y,
            });
        }

        this.addUndoEntry({
            op: 'move',
            items: moveItems,
        });
    }

    /// Moves items.
    moveItems(items, offsetX, offsetY, undo=true) {
        //const isAddition = this.movementValue && this.movementValue.items == items;
        const moveItems = [];
        for (const item of items) {
            switch (item.className) {
                case 'Group':
                    //this.moveItems(item.children, offsetX, offsetY);
                    // todo
                    const oldPosition = item.position.clone();
                    const data = item.data;
                    const x = data.x + offsetX;
                    const y = data.y + offsetY;
                    const point = this.gridManager.gridToPoint(x, y);
                    item.position = point;
                    data.x = x;
                    data.y = y;
                    moveItems.push({
                        item: item,
                        oldPosition: oldPosition,
                        newPosition: item.position.clone(),
                    });
                    break;
                case 'SymbolItem': {
                    const oldPosition = item.position.clone();
                    const data = item.data;
                    const x = data.x + offsetX;
                    const y = data.y + offsetY;
                    const point = this.gridManager.gridToPoint(x, y);
                    item.position = point;
                    data.x = x;
                    data.y = y;
                    moveItems.push({
                        item: item,
                        oldPosition: oldPosition,
                        newPosition: item.position.clone(),
                    });
                    break;
                }
                default:
                    break;
            }
        }

        if (undo) {
            this.addUndoEntry({
                op: 'move',
                items: moveItems,
            });
        }
    }

    replaceItems(sourceItems, destinationItems) {
        const entries = [];
        for (const i in sourceItems) {
            const oldItem = sourceItems[i];
            const newItem = destinationItems[i];
            entries.push({
                index: oldItem.index,
                oldItem: oldItem,
                newItem: newItem,
            });
        }

        const op = {
            op: 'replace',
            items: entries,
        };
        this.undoManager.redo_replace(op);
        this.addUndoEntry(op);
    }

    moveToLayer(items, layer) {
        const entries = [];
        for (const item of items) {
            entries.push({
                item: item,
                index: item.index,
                oldLayer: item.parent,
                newLayer: layer,
            });
        }
        const op = {
            op: 'move_to_layer',
            items: entries,
        };
        this.undoManager.redo_move_to_layer(op);
        this.addUndoEntry(op);
    }

    moveZ(mode, items) {
        const entries = [];
        const op = {
            op: 'move_z',
            mode: mode,
        }
        if (mode == 'front' || mode == 'back') {
            const groupMap = new Map();
            for (const item of items) {
                let groupList = groupMap.get(item.parent.id);
                if (!groupList) {
                    groupList = [];
                    groupMap.set(item.parent.id, groupList);
                }
                groupList.push([item.index, item]);
            }
            for (const group of groupMap.values()) {
                group.sort((a, b) => a[0] - b[0]);
            }
            op.groups = Array.from(groupMap.values());
        } else if (mode == 'front-step' || mode == 'back-step') {
            const diff = mode == 'front-step' ? -1 : 1;
            const groupMap = new Map();
            for (const item of items) {
                let groupList = groupMap.get(item.parent.id);
                if (!groupList) {
                    groupList = [];
                    groupMap.set(item.parent.id, groupList);
                }
                // todo, index after moved?
                groupList.push([item.index, item.index + diff, item]);
            }
            if (mode == 'front-step') {
                for (const group of groupMap.values()) {
                    // reverse order
                    group.sort((a, b) => b[0] - a[0]);
                }
            } else {
                for (const group of groupMap.values()) {
                    group.sort((a, b) => a[0] - b[0]);
                }
            }

            op.groups = Array.from(groupMap.values());
        }

        this.undoManager.redo_move_z(op);
        this.addUndoEntry(op);
    }
}
