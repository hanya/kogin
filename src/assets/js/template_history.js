
import { TemplateElements, toKey, getTemplateSize } from "./templates.js";
import { ElementTool } from './elements.js';


export class TemplateHistoryManager {
    constructor(view) {
        this.view = view;
        this.templateManager = view.sashi.templateManager;
        this.canvasSize = getTemplateSize('preview');
        this.models = new Map();
        this.lastKey = null;
    }

    _modelKey(locationId, key) {
        return `${locationId}-${key}`;
    }

    _addModel(locationId, key, model) {
        this.models.set(this._modelKey(locationId, key), model);
    }

    _getModel(locationId, key) {
        return this.models.get(this._modelKey(locationId, key));
    }

    cbEntryLoaded(requestOp, entryKey, value) {
        const locationId = value.locationId;
        const key = value.key;

        this.loadDataBy(locationId, key);
    }

    loadDataBy(locationId, key) {
        const requestOp = { locationId: locationId, key: key };
        this.templateManager.loadData(locationId, key,
            this.cbEntryAdded, requestOp,
            (op, key) => {
                console.log(`${locationId}-${key} not found`);
            });
    }

    selectEntry(entry) {
        const id = entry.id;
        const contents = this.getContents();
        for (const item of contents.childNodes) {
            if (item.id == id) {
                item.classList.add('template-selected');
            } else {
                item.classList.remove('template-selected');
            }
        }
    }

    cbEntryAdded = (op, key, name, data) => {
        const outer = TemplateElements.makeTemplateElementBase(op.locationId, op.key, this.canvasSize, '', true);
        const model = TemplateElements.makeTemplateObject(outer.firstElementChild, this.view.viewMode, this.view.sashi);
        this._addModel(op.locationId, op.key, model);
        TemplateElements.loadFromData(op.locationId, op.key, name, data, this.canvasSize, model);
        this.addToContents(outer);

        // click entry
        outer.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.selectEntry(outer);
        });
        // double click entry
        outer.addEventListener('dblclick', (ev) => {
            ev.preventDefault();
            const keepColor = this.view.toolManager.getBoolValue('template-history-keep-color');
            this.view.addToTemplateHistory(op.locationId, op.key);

            const point = { x: ev.clientX, y: ev.clientY };
            this.view.setMouseLocation(point, true);

            this.view.setTemplate(model.template, this.view.editModeTemplate, 0, keepColor);
            this.view.fireCommand('template-history-close');
        });
    }

    addToContents(entry) {
        const contents = this.getContents();
        if (contents.firstElementChild) {
            contents.firstElementChild.before(entry);
        } else {
            contents.appendChild(entry);
        }
    }

    addTemplate(locationId, key) {
        const id = TemplateElements.entryId(locationId, key);
        let entry = this.findSameEntry(id);
        if (entry) {
            entry.remove();
            this.addToContents(entry);
        } else {
            this.loadDataBy(locationId, key);
        }
    }

    getContents() {
        return document.getElementById('template-history-contents');
    }

    findSameEntry(id) {
        const contents = this.getContents();
        let found = null;
        for (const entry of contents.childNodes) {
            if (entry.id == id) {
                found = entry;
                break;
            }
        }
        return found;
    }
}
