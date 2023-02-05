
import { ElementTool } from "./elements.js";
import { GoogleDriveBackend, googleapiLoader } from "./backend_googledrive.js";
import { View } from "./view.js";
import { DropboxBackend, isInDropbox } from "./backend_dropbox.js";
import { getTemplateSize, TemplateElements } from "./templates.js";
import { NoticeManager } from "./tool.js";
import { DummyBackend } from "./backend.js";


function addOption(parent, label) {
    const option = document.createElement('option');
    option.textContent = label;
    parent.appendChild(option);
    return option;
}

function addImage(parent, src, width) {
    const img = document.createElement('img');
    img.setAttribute('src', src);
    img.setAttribute('width', width);
    parent.appendChild(img);
    return img;
}

function addSpan(parent, text) {
    const span = document.createElement('span');
    span.textContent = text;
    parent.appendChild(span);
    return span;
}

function addDiv(parent) {
    const div = document.createElement('div');
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

function addBr(parent) {
    const br = document.createElement('br');
    parent.appendChild(br);
}

function addButton(parent, label) {
    const button = document.createElement('input');
    button.setAttribute('type', 'button');
    button.value = label;
    parent.appendChild(button);
    return button;
}

function addStorageEntry(parent, name) {
    const div = addDiv(parent);
    div.classList.add('storage-fp-storage-entry');
    const span = addSpan(div, name);
    span.classList.add('storage-fp-name');
    return div;
}

function addEntry(parent, entry, cbSelected, cbChoosen, isFolder) {
    let icon = './img_base/file.svg';
    if (isFolder) {
        icon = './img_base/folder.svg';
    }
    const div = addDiv(parent);
    div.classList.add('storage-fp-entry');
    div.setAttribute('id', entry.id);
    div.setAttribute('folder', isFolder);
    const img = addImage(div, icon, 24);
    img.classList.add('storage-file-icon');
    const span = addSpan(div, entry.name);
    span.classList.add('storage-file-name');
    div.addEventListener('click', (ev) => {
        if (cbSelected) {
            cbSelected(div, entry.id, isFolder);
        }
    });
    div.addEventListener('dblclick', (ev) => {
        if (cbChoosen) {
            cbChoosen(div, entry.id, entry.name, isFolder);
        }
    });
    return div;
}

function addLocation(parent, entry, cbSelected) {
    const span = addSpan(parent);
    span.classList.add('storage-fp-location-item');
    span.textContent = entry.name;
    span.setAttribute('id', entry.id);
    span.addEventListener('click', (ev) => {
        if (cbSelected) {
            cbSelected(span, entry.id, entry.name);
        }
    });
    return span;
}

class Path {
    constructor(path, listener) {
        this.listener = listener;
        this.activeIndex = null;
        this.path = path;
    }

    getCount() {
        return this.path.length;
    }

    getRootPath() {
        return this.path[0];
    }

    getPath() {
        return this.path;
    }

    setPath(path) {
        this.path = path;
        this.activeIndex = this.path.length - 1;
    }

    setActiveIndex(index) {
        this.activeIndex = index;
    }

    getActivePart() {
        if (this.path) {
            return this.path[this.activeIndex];
        } else {
            return null;
        }
    }

    getLastPart() {
        if (this.path) {
            return this.path[this.path.length - 1];
        } else {
            return null;
        }
    }

    getPart(id) {
        for (const part of this.path) {
            if (part.id == id) {
                return part;
            }
        }
        return null;
    }

    updatePart(id, name, oldId=null) {
        const part = this.getPart(oldId ? oldId : id);
        if (part) {
            part.id = id;
            part.name = name;
            this.listener.changed('part', { id: id, name: name, oldId: oldId });
        }
    }

    push(parents, id, name, activate=false) {
        // find parent
        if (!parents) {
            return;
        }
        for (const parent of parents) {
            const parentIndex = this.path.findIndex((element) => element.id == parent);
            if (parentIndex >= 0) {
                const childIndex = parentIndex + 1;
                const child = this.path[childIndex];
                if (child) {
                    if (child.id != id) {
                        // remove children
                        this.path.splice(childIndex);
                        this.path.push({ id: id, name: name, });
                        this.setActiveIndex(childIndex);
                        this.listener.changed('replacePart', { id: id, name: name, index: childIndex, activate: true });
                    }
                } else {
                    this.path.push({ id: id, name: name, });
                    this.listener.changed('pushPart', { id: id, name: name, activate: true });
                    this.setActiveIndex(childIndex);
                }
            }
        }
    }
}

class Location {
    constructor(picker, id) {
        this.picker = picker;
        this.location = document.getElementById(id);
        this.selectedElement = null;
        this.path = null;
    }

    clear() {
        while (this.location.lastElementChild) {
            this.location.lastElementChild.remove();
        }
    }

    setPath(path) {
        this.path = path;
        this.clear();
        let index = 0;
        for (const pathItem of this.path.getPath()) {
            this.addPathItem(pathItem, index);
            index += 1;
        }
        this.activateElement(this.location.lastElementChild);
    }

    activateElement(element, index) {
        const SELECTED = 'selected';
        if (element != this.selectedElement) {
            if (this.selectedElement) {
                this.selectedElement.classList.remove(SELECTED);
            }
            if (element) {
                element.classList.add(SELECTED);
                this.selectedElement = element;
                if (index) {
                    this.path.setActiveIndex(index);
                }
            }
            return true;
        }
        return false;
    }

    addPathItem(item, index=null) {
        const span = addLocation(this.location, item, (span, id, name) => {
            if (this.activateElement(span, index)) {
                this.picker.cbLocationChoosen(id, name);
            }
        });
        return span;
    }

    setLabel(id, label) {
        const child = this.findElement(id);
        if (child) {
            child.textContent = label;
        }
    }

    setId(oldId, newId) {
        const child = this.findElement(oldId);
        if (child) {
            child.setAttribute('id', newId);
        }
    }

    changed(type, op) {
        switch (type) {
            case 'part': {
                if (op.oldId) {
                    this.setId(op.oldId, op.id);
                }
                this.setLabel(op.id, op.name);
                break;
            }
            case 'pushPart': {
                const span = this.addPathItem(op, null);
                this.activateElement(span);
                break;
            }
            case 'replacePart': {
                const child = this.findElementByIndex(op.index);
                if (child) {
                    while (child.nextSibling) {
                        child.nextSibling.remove();
                    }
                    child.remove();
                    const span = this.addPathItem(op, null);
                    this.activateElement(span);
                }
                break;
            }
            default: {
                break;
            }
        }
    }

    findElement(id) {
        for (const child of this.location.childNodes) {
            if (child.getAttribute('id') == id) {
                return child;
            }
        }
        return null;
    }

    findElementByIndex(index) {
        return this.location.childNodes[index];
    }
}

class Selector {
    constructor(container) {
        this.container = container;
        this.activeItem = null;
        this.selectionChangeListener = null;
    }

    getChildNodes() {
        return this.container.childNodes;
    }

    hasItems() {
        return this.container.hasChildNodes();
    }

    setSelectionChangeListener(listener) {
        this.selectionChangeListener = listener;
    }

    clearContents() {
        while (this.container.lastElementChild) {
            this.container.lastElementChild.remove();
        }
        this.activeItem = null;
    }

    findItem(func) {
        for (const item of this.container.childNodes) {
            if (func(item)) {
                return item;
            }
        }
        return null;
    }

    setActiveItemByIndex(index) {
        const item = this.container.childNodes[index];
        if (item) {
            this.setActiveItem(item);
        }
    }

    getActiveItem() {
        return this.activeItem;
    }

    setActiveItem(item) {
        const SELECTED = 'selected';
        if (item != this.activeItem) {
            if (this.activeItem) {
                this.activeItem.classList.remove(SELECTED);
            }
            this.activeItem = item;
            if (this.activeItem) {
                this.activeItem.classList.add(SELECTED);
            }
            this.selectionChangeListener(this.activeItem);
        }
    }

    getActiveIndex() {
        const item = this.activeItem;
        if (item) {
            let index = 0;
            for (const child of this.container.childNodes) {
                if (child == item) {
                    return index;
                }
                index += 1;
            }
        } else {
            return -1;
        }
    }

    removeActive() {
        const index = this.getActiveIndex();
        if (index >= 0) {
            this.activeItem.remove();
            this.setActiveItemByIndex(index);
        }
        return index;
    }

    append(item) {
        this.container.appendChild(item);
        item.addEventListener('click', this.cbItemClicked);
    }

    insertSorted(item, select=false) {
        const beforeItem = this.getSortBeforeItem(item);
        if (beforeItem) {
            this.container.insertBefore(item, beforeItem);
            item.addEventListener('click', this.cbItemClicked);
        } else {
            this.append(item);
        }
        if (select) {
            this.setActiveItem(item);
        }
    }

    getSortBeforeItem(item) {
        const label = item.lastElementChild.textContent;
        let n = 0;
        for (; n < this.container.childNodes.length; n++) {
            const child = this.container.childNodes[n];
            if (child.lastElementChild.textContent < label) {
                break;
            }
        }
        for (; n < this.container.childNodes.length; n++) {
            const child = this.container.childNodes[n];
            if (child.lastElementChild.textContent > label) {
                return child;
            }
        }
        return null;
    }

    insertAfter(target, item) {
        if (target) {
            this.container.insertBefore(item, target.nextSibling);
        } else {
            this.container.insertBefore(item, this.container.childNodes[0]);
        }
        item.addEventListener('click', this.cbItemClicked);
    }

    cbItemClicked = (ev) => {
        let target = ev.target;
        while (target.parentNode != this.container) {
            target = target.parentNode;
        }
        this.setActiveItem(target);
    }
}


export class FilePicker extends ElementTool {
    constructor(settings, type, view, fileType='SVG') {
        super();
        /** {View} */
        this.view = view;
        this.model = null;
        this.size = getTemplateSize('medium');
        this.type = type;
        this.isFolderPicker = type == 'folder';
        this.fileType = fileType;
        this.settings = settings;
        this.initialized = false;
        this.overWriteConfirmed = false;

        this.currentId = null;
        this.storages = [];
        this.backend = null;

        this.itemSelector = new Selector(document.getElementById('storage-fp-files-contents'));
        this.itemSelector.clearContents();
        this.itemSelector.setSelectionChangeListener(this.cbItemSelected);
        this.storageSelector = new Selector(document.getElementById('storage-fp-storages-contents'));
        this.storageSelector.clearContents();
        this.storageSelector.setSelectionChangeListener(this.cbStorageChange);
        this.location = new Location(this, 'storage-fp-location-bar');
        this.canvas = document.getElementById('storage-fp-preview-canvas');

        switch (type) {
            case 'open': {
                this.setDisplay('storage-fp-open-title', true);
                this.setDisplay('storage-fp-save-title', false);
                this.setDisplay('storage-fp-folder-title', false);
                this.setDisplay('storage-fp-save-options', false);
                this.setDisplay('storage-fp-save-name', false);
                break;
            }
            case 'save': {
                this.setDisplay('storage-fp-open-title', false);
                this.setDisplay('storage-fp-save-title', true);
                this.setDisplay('storage-fp-folder-title', false);
                this.setDisplay('storage-fp-save-options', true);
                this.setDisplay('storage-fp-save-name', true);
                break;
            }
            case 'folder': {
                this.setDisplay('storage-fp-open-title', false);
                this.setDisplay('storage-fp-save-title', false);
                this.setDisplay('storage-fp-folder-title', true);
                this.setDisplay('storage-fp-save-options', false);
                this.setDisplay('storage-fp-save-name', false);
                break;
            }
        }
    }

    showSaveOption(state) {
        this.setDisplay('storage-fp-save-options', state);
    }

    getResult() {
        const storageIndex = this.storageSelector.getActiveIndex();
        if (0 <= storageIndex && storageIndex < this.settings.storages.length) {
            const storage = this.settings.storages[storageIndex];
            if (storage) {
                const data = {
                    storageType: storage.type, storageName: storage.name,
                    type: this.type,
                };
                const item = this.itemSelector.getActiveItem();
                if (item) {
                    data.id = item.getAttribute('id');
                    data.parentId = this.currentId;
                } else {
                    if (this.isFolderPicker) {
                        data.id = this.currentId;
                    } else {
                        data.parentId = this.currentId;
                    }
                }
                data.name = this.getItemName(item);
                if (this.type == 'save') {
                    data.nameInput = this.getInputName();
                }
                return data;
            }
        }
        return null;
    }

    checkNameConflict() {
        const nameInput = this.getInputName();
        for (const item of this.itemSelector.getChildNodes()) {
            const name = this.getItemName(item);
            if (name == nameInput) {
                return true;
            }
        }
        return false;
    }

    getInputName() {
        return this.getValue('storage-fp-filename');
    }

    setInputName(name) {
        this.setValue('storage-fp-filename', name);
    }

    isItemSelected() {
        const item = this.itemSelector.getActiveItem();
        return !!item;
    }

    getItemName(item) {
        if (item) {
            for (const child of item.childNodes) {
                if (child.tagName == 'SPAN') {
                    return child.textContent;
                }
            }
        }
        return '';
    }

    prepare(op={}) {
        if (!this.initialized) {
            if (!this.settings) {
                // todo, load settings
            }
            this.setEvents(op);
            this.createStorages();
        }

    }

    closed() {
        this.removeEvents();
        if (this.model) {
            this.model.clear();
        }
        this.setFileInfo('', '', '');
    }

    setEvents(op) {
        if (!op.disableAddStorage) {
            this.addListener('storage-fp-add', 'click', this.cbAddStorage);
        } else {
            this.setVisible('storage-fp-add', false);
        }
        if (!op.disableRemoveStorage) {
            this.addListener('storage-fp-remove', 'click', this.cbRemoveStorage);
        } else {
            this.setVisible('storage-fp-remove', false);
        }
        this.addListener('storage-fp-new-folder', 'click', this.cbCreateFolder);
        this.addListener('storage-fp-rename', 'click', this.cbRenameFile);
        this.addListener('storage-fp-remove-file', 'click', this.cbRemoveFile);
    }

    removeEvents() {
        this.setVisible('storage-fp-add', true);
        this.setVisible('storage-fp-remove', true);
        this.removeListener('storage-fp-add', 'click', this.cbAddStorage);
        this.removeListener('storage-fp-remove', 'click', this.cbRemoveStorage);
        this.removeListener('storage-fp-new-folder', 'click', this.cbCreateFolder);
        this.removeListener('storage-fp-rename', 'click', this.cbRenameFile);
        this.removeListener('storage-fp-remove-file', 'click', this.cbRemoveFile);
    }

    addStorageSetting(setting) {
        this.settings.storages.push(setting);
    }

    removeStorageSetting(index) {
        this.settings.storages.splice(index, 1);
    }

    initStorage(backend, cbInitialized) {
        switch (backend.getType()) {
            case 'googledrive': {
                backend.init();
                this.storageInitialized(backend);
                if (cbInitialized) {
                    cbInitialized(backend);
                }
                break;
            }
            case 'dropbox': {
                backend.init();
                this.storageInitialized(backend);
                if (cbInitialized) {
                    cbInitialized(backend);
                }
                break;
            }
        }
    }

    createStorage(setting, activate=false, cbInitialized=null) {
        let backend = null;
        const entry = this.addStorageEntry(setting);

        switch (setting.type) {
            case 'googledrive': {
                backend = new GoogleDriveBackend({});
                if (setting.path.length == 0) {
                    setting.path = backend.getRootPath();
                }
                const path = new Path(setting.path, this.location);
                backend.setPath(path);
                if (activate) {
                    this.itemSelector.clearContents();
                    this.setBackend(backend);
                    this.initStorage(backend, cbInitialized);
                }
                break;
            }
            case 'dropbox': {
                if (isInDropbox()) {
                    backend = new DropboxBackend({});
                    if (setting.path.length == 0) {
                        setting.path = backend.getRootPath();
                    }
                    const path = new Path(setting.path, this.location);

                    backend.setPath(path);
                    if (activate) {
                        this.itemSelector.clearContents();
                        this.setBackend(backend);
                        this.initStorage(backend, cbInitialized);
                    }
                } else {
                    backend = new DummyBackend({});
                    entry.setAttribute('disabled', '');
                }
                break;
            }
        }
        if (backend) {
            this.storages.push(backend);
            return backend;
        } else {
            entry.remove();
            return null;
        }
    }

    createStorages() {
        if (this.settings.storages.length == 0) {
            return;
        }
        let activeIndex = this.settings.activeIndex;
        if (!activeIndex || activeIndex < 0 || activeIndex >= this.settings.storages.length) {
            activeIndex = 0;
        }

        for (const setting of this.settings.storages) {
            const activated = this.storages.length == activeIndex;
            this.createStorage(setting, activated);
        }

        this.storageSelector.setActiveItemByIndex(activeIndex);
    }

    setBackend(backend) {
        if (backend != this.backend) {
            if (this.backend) {
                this.backend.active = false;
            }
            this.backend = backend;
            this.backend.active = true;
            return true;
        }
        return false;
    }

    addStorageEntry(obj) {
        const entry = addStorageEntry(null, obj.name);
        this.storageSelector.append(entry);
        return entry;
    }

    storageInitialized(backend) {
        if (backend.active) {
            const path = backend.getPath();
            this.location.setPath(path);
            this.updateLocation();
            const part = path.getLastPart();
            if (part) {
                this.loadFileList(part.id, part.name, false, this.isFolderPicker);
            }
        }
    }

    updateLocation() {
        // update renamed or trashed path
    }

    cbStorageChange = (ev) => {
        if (this.model) {
            this.model.clear();
        }
        const index = this.storageSelector.getActiveIndex();
        if (0 <= index && index < this.storages.length) {
            if (this.setBackend(this.storages[index])) {
                if (this.backend && !this.backend.invalid) {
                    if (this.backend.initialized) {
                        this.itemSelector.clearContents();
                        this.storageInitialized(this.backend);
                    } else {
                        if (this.backend.op) {
                            this.setVisibleElement(this.backend.op.signin, true);
                            this.setVisibleElement(this.backend.op.signout, true);
                        }
                        this.itemSelector.clearContents();
                        this.initStorage(this.backend);
                    }
                }
            }
        } else {
            this.itemSelector.clearContents();
        }
    }

    clearContents() {
        this.itemSelector.clearContents();
    }

    fileDataLoaded = (id, name, data) => {
        this.model = TemplateElements.makeTemplateObject(this.canvas, this.view.viewMode, this.view.sashi);
        TemplateElements.loadFromData(0, id, name, data, this.size, this.model);
        this.setFileInfo(name, this.model.metadata.title, this.model.metadata['title-en']);
    }

    setFileInfo(name, title, title_en) {
        this.setText('storage-fp-preview-name', name);
        this.setText('storage-fp-preview-title', title);
        this.setText('storage-fp-preview-title-en', title_en);
    }

    cbItemSelected = (element) => {
        const isFile = element.getAttribute('folder') == 'false';
        if (isFile) {
            if (this.fileType == 'SVG') {
                const id = element.getAttribute('id');
                this.backend.readFile(id, this.fileDataLoaded, (error) => { console.log(error) });
            }
        } else {
            // clear preview
            if (this.model) {
                this.model.clear();
            }
        }
    }

    cbItemChoosen = (element, id, name, isFolder) => {
        if (isFolder) {
            this.clearContents();
            this.loadFileList(id, name, false, this.isFolderPicker);
        } else {
            this.itemSelector.cbItemClicked({ target: element });
            this.view.fireCommand('storage-fp-ok');
        }
    }

    folderLoaded = (id, name) => {
        const backend = this.backend;
        this.backend.readInfo(id, (id, name, parents) => {
            backend.path.updatePart(id, name);
            backend.path.push(parents, id, name, true);
            this.currentId = id;
        });
    }

    loadFileList(id=null, name='', fromLocationBar=false, folderOnly=false) {
        const backend = this.backend;
        let folderId = id ? id : backend.getRootId();
        backend.listFiles(
            {}, // requestOp
            folderId,
            (requestOp, file, id) => {
                const entry = addEntry(null, file, this.cbItemSelected, this.cbItemChoosen, backend.isFolder(file));
                this.itemSelector.append(entry);
            },
            () => {}, // error
            () => {
                this.folderLoaded(folderId, name);
            }, // finished
            this.getFileFilter(this.fileType),
            (op, name, id) => [true, id], // listing
            folderOnly, // folder only
            this.fileType,
        );
    }

    getFileFilter(fileType) {
        switch (fileType) {
            case 'PDF': return this.fnPDFFilter;
            default: return this.fnSVGFilter;
        }
    }

    fnSVGFilter(name) {
        return name.endsWith('.svg');
    }

    fnPDFFilter(name) {
        return name.endsWith('.pdf');
    }

    getCurrentId() {
        const item = this.itemSelector.getActiveItem();
        return item ? item.getAttribute('id') : null;
    }

    getCurrentName() {
        const item = this.itemSelector.getActiveItem();
        if (item) {
            for (const child of item.childNodes) {
                if (child.tagName == 'SPAN') {
                    return child.textContent;
                }
            }
        } else {
            return null;
        }
    }

    getItem(id) {
        return this.itemSelector.findItem((item) => item.getAttribute('id') == id);
    }

    renameItem(id, name) {
        const item = this.getItem(id);
        if (item) {
            for (const child of item.childNodes) {
                if (child.classList.contains('storage-file-name')) {
                    child.textContent = name;
                    break;
                }
            }
        }
    }

    removeItem(id) {
        const item = this.getItem(id);
        if (item) {
            item.remove();
        }
    }

    cbAddStorage = (ev) => {
        this.view.toolManager.showDropboxStorage(isInDropbox());
        this.view.toolManager.showDialog('storage-selection-dialog', 'storage-selection-name-input');
    }

    addCurrentStorage(data) {
        if (data.name != '') {
            const setting = { type: data.backend_type, name: data.name,
                              path: [], };
            this.createStorage(setting, true, (backend) => {
                const rootId = backend.path.getRootPath().id;
                backend.readInfo(rootId, (id, name, parents) => {
                    setting.path[0].id = id;
                    setting.path[0].name = name;
                    this.addStorageSetting(setting);
                    this.view.sashi.storeStoragesSettings(this.settings);
                    this.backend.path.updatePart(id, name, rootId);
                });
            });
        }
    }

    cbRemoveStorage = (ev) => {
        this.view.toolManager.showMessage('Selected storage will be removed.', 'Remove storage', 'storage-fp-storage-remove');
    }

    removeCurrentStorage() {
        const index = this.storageSelector.removeActive();
        if (index >= 0) {
            this.removeStorageSetting(index);
            if (!this.storageSelector.hasItems()) {
                this.itemSelector.clearContents();
                this.location.clear();
            }
            this.view.sashi.storeStoragesSettings(this.settings);
        }
    }

    cbCreateFolder = (ev) => {
        this.view.toolManager.showNameInput('', 'Folder name', 'storage-fp-new-folder');
    }

    createFolder(name) {
        this.backend.createFolder(this.currentId, name, (id, file) => {
            const entry = addEntry(null, file, this.cbItemSelected, this.cbItemChoosen);
            this.itemSelector.insertSorted(entry, true);
        });
    }

    cbRenameFile = (ev) => {
        const id = this.getCurrentId();
        if (id) {
            this.view.toolManager.showNameInput('', 'Rename', 'storage-fp-rename');
        }
    }

    renameFile(name) {
        const id = this.getCurrentId();
        if (id) {
            this.backend.renameFile(id, name, (id, name) => {
                this.renameItem(id, name);
            });
        }
    }

    cbRemoveFile = (ev) => {
        const id = this.getCurrentId();
        if (id) {
            this.view.toolManager.showMessage('This entry will be removed.', 'Remove', 'storage-fp-entry-remove');
        }
    }

    removeFile() {
        const id = this.getCurrentId();
        if (id) {
            this.backend.deleteFile(id, (id) => {
                this.removeItem(id);
            });
        }
    }

    cbLocationChoosen = (id, name) => {
        this.clearContents();
        // todo, check current id or not or update?
        this.loadFileList(id, name, true, this.isFolderPicker);
    }
}
