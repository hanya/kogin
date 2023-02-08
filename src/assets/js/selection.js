
import { Broadcaster } from "./broadcaster.js";


const PointsSelectPathName = 'points-select';
const SelectingRectangleName = "selecting";


/// Manages selected items.
export class SelectionManager extends Broadcaster {
    constructor(layerManager, viewOption) {
        super();
        this.layerManager = layerManager;
        this.stack = [];
        this.points = [];
        this.viewOption = viewOption;
    }

    broadcast(prevCount = 0) {
        this._broadcast({ count: this.count(), prevCount: prevCount });
    }

    /// Checks something selected.
    hasSelection() {
        return this.stack.length != 0;
    }

    /// Returns number of selected items.
    count() {
        return this.stack.length;
    }

    // todo, avoid call this function
    /// Clears selection.
    clear(noClearPoints=false) {
        const prevCount = this.count();
        this.clearSelection(false);

        if (!noClearPoints) {
            this.clearPoints();
        }

        this.broadcast(prevCount);
    }

    clearSelection(broadcast) {
        const prevCount = this.count();
        for (const item of this.stack) {
            if (item.data.selection) {
                item.data.selection.remove();
                item.data.selection = null;
            }
        }
        this.stack = [];
        if (broadcast) {
            this.broadcast(prevCount);
        }
    }

    clearForSelection() {
        const layer = this.layerManager.getControlLayer();
        for (const item of layer.children) {
            if (item.name.startsWith('selection-')) {
                item.remove();
            }
        }
    }

    clearPointsSelection() {
        const path = this.getPointsSelectionPath();
        if (path) {
            path.remove();
        }
    }

    /// Clears points stack for points selection.
    clearPoints() {
        this.points = [];
    }

    hasPoints() {
        return this.points.length != 0;
    }

    pushPoint(point) {
        this.points.push(point);
    }

    getPointsSelectionPath() {
        return this.layerManager.getControlLayer().children[PointsSelectPathName];
    }

    updatesPointsSelectPath(point, lastPoint) {
        if (this.hasPoints()) {
            let path = this.getPointsSelectionPath();
            if (!path) {
                path = new paper.Path({
                    strokeColor: this.viewOption.selectionColor,
                    strokeWidth: 1,
                    closed: true,
                    name: PointsSelectPathName,
                });
                this.layerManager.getControlLayer().addChild(path);
            }
            path.add(point);
            // next point for mouse location
            path.add(lastPoint);
            return true;
        }
        return false;
    }

    pointsSelectMoveLastPoint(point) {
        const path = this.getPointsSelectionPath();
        if (path) {
            // move last point to mouse location
            const segment = path.lastSegment;
            segment.point = point;
        }
    }

    getPathForPoints() {
        if (this.points.length < 3) {
            this.clearPoints();
            this.clearPointsSelection();
        } else {
            const path = this.getPointsSelectionPath();
            if (path && path.segments.length > 2) {
                return path;
            }
        }
        return null;
    }

    selectByPoints() {
        // todo, current group edit
        if (this.points.length < 3) {
            this.clearPoints();
            this.clearPointsSelection();
            return;
        }

        const path = this.getPointsSelectionPath();
        if (path && path.segments.length > 2) {
            const items = [];
            const root = this.layerManager.getRootLayer();
            for (const item of root.children) {
                if (item.visible) {
                    if (item.className == 'Group') {
                        if (item.data.asLayer) {
                            for (const child of item.children) {
                                if (this._isInPath(path, child)) {
                                    items.push(child);
                                }
                            }
                        }
                    } else {
                        if (this._isInPath(path, item)) {
                            items.push(item);
                        }
                    }
                }
            }
            if (items.length > 0) {
                path.remove();
                this.pushItems(items);
            }
        }
        this.clearPoints();
        this.clearPointsSelection();
    }

    findTopParent(item) {
        const parent = item.parent;
        if (parent.data.asLayer) {
            return item;
        } else {
            return this.findTopParent(parent);
        }
    }

    _isInPath(path, item) {
        switch (item.className) {
            case 'Group': {
                // all items must be in the path
                for (const child of item.children) {
                    if (!this._isInPath(path, child)) {
                        return false;
                    }
                }
                return true;
                break;
            }
            case 'SymbolItem': {
                const r = item.strokeBounds;
                const b = path.contains(r.topLeft) &&
                          path.contains(r.bottomRight);
                return b;
                break;
            }
            default:
                break;
        }
        return false;
    }

    /// Remove selected items if their parent layer item is locked or hidden;
    updateSelection() {
        const removeIndices = [];
        for (const index in this.stack) {
            const item = this.stack[index];
            if (!item.layer || item.layer.locked || !item.layer.visible) {
                removeIndices.push(index);
            }
            if (!item.parent) {
                removeIndices.push(index);
            }
        }
        for (let i = removeIndices.length - 1; i >= 0; i--) {
            const n = removeIndices[i];
            if (this.stack[n]) {
                if (this.stack[n].data.selection) {
                    this.stack[n].data.selection.remove();
                    this.stack[n].data.selection = null;
                }
                this.stack.splice(n, 1);
            }
        }
    }

    /// Selects item.
    push(item) {
        const prevCount = this.count();
        this.stack.push(item);
        this.selectionDrawRect(item, this.stack.length);
        this.broadcast(prevCount);
    }

    pushItems(items) {
        const prevCount = this.count();
        for (const item of items) {
            this.stack.push(item);
            this.selectionDrawRect(item, this.stack.length);
        }
        this.broadcast(prevCount);
    }

    insert(index, item) {
        const prevCount = this.count();
        this.stack.splice(index, 1, item);
        this.selectionDrawRect(item, this.stack.length);
        this.broadcast(prevCount);
    }

    /// Removes items from selection.
    removeItems(index, count) {
        const prevCount = this.count();
        this.stack[index].data.selection.remove();
        this.stack[index].data.selection = null;
        this.stack.splice(index, count);
        this.broadcast(prevCount);
    }

    replace(index, item) {
        this.removeItems(index, 1);
        this.insert(index, item);
    }

    replaceAllSelection(items) {
        const prevCount = this.count();
        for (const item of this.stack) {
            item.data.selection.remove();
            item.data.selection = null;
        }
        this.stack.splice(0);
        for (const item of items) {
            this.stack.push(item);
            this.selectionDrawRect(item, this.stack.length);
        }
        this.broadcast(prevCount);
    }

    /// Selects or deselects item.
    selectItemOrDeselect(item, toggle=false, addition=false) {
        const index = this.stack.indexOf(item);
        if (0 <= index) {
            // already selected
            if (toggle) {
                // deselect when toggle mode
                this.removeItems(index, 1);
                return true;
            } else {
                // keep selection when non toggle mode
                return false;
            }
        } else {
            // no selection on locked or hidden layer
            if (item.layer.locked || !item.layer.visible) {
                return false;
            } else {
                // not selected yet, new selection
                if (!addition && !toggle) {
                    // clear selection when non toggle mode and then select new one
                    this.clearSelection();
                }
                this.push(item);
                return true;
            }
        }
    }

    // no toggle, no deselection
    selectItems(items, addition = false) {
        if (addition) {
            const addItems = [];
            for (const item of items) {
                const index = this.stack.indexOf(item);
                if (index < 0) {
                    addItems.push(item);
                }
            }
            this.pushItems(addItems);
        } else {
            this.replaceAllSelection(items);
        }
    }

    /// Deselect item.
    deselect(item) {
        const index = this.stack.indexOf(item);
        if (0 <= index) {
            this.removeItems(index, 1);
        }
    }

    /// Checks item is selected.
    isSelected(item) {
        return this.stack.includes(item);
    }

    /// Returns selected item specified by the index.
    get(index) {
        if (0 <= index && index < this.stack.length) {
            return this.stack[index];
        } else {
            return null;
        }
    }

    /// Copies stack, elements are just references to the original.
    copyStack() {
        return this._copyStackItems(this.stack);
    }

    _copyStackItems(items) {
        const elements = [];
        for (const item of items) {
            elements.push(item);
        }
        return elements;
    }

    /// Clones selections as indipendent items.
    clone() {
        return this._cloneItems(this.stack);
    }

    /// Clones items.
    _cloneItems(items) {
        const cloneOptions = {
            insert: false,
            deep: true,
        };
        const elements = [];
        for (const item of items) {
            elements.push(item.clone(cloneOptions));
        }
        return elements;
    }

    isInside(point) {
        if (this.hasSelection()) {
            for (const item of this.stack) {
                if (item.contains(point)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Removes selecting rectangle.
     */
    clearSelecting() {
        const layer = this.layerManager.getControlLayer();
        const item = layer.children[SelectingRectangleName];
        if (item) {
            item.remove();
        }
    }

    /// Draws ranges while selecting.
    selectionDrawSelecting(point1, point2) {
        const layer = this.layerManager.getControlLayer();
        let child = layer.children[SelectingRectangleName];
        if (child) {
            // reuse rectangle
            child.segments[1].point.x = point2.x + 0.5;
            child.segments[1].point.y = child.segments[0].point.y;
            child.segments[2].point.x = point2.x + 0.5;
            child.segments[2].point.y = point2.y + 0.5;
            child.segments[3].point.x = child.segments[0].point.x;
            child.segments[3].point.y = point2.y + 0.5;
        } else {
            const rect = new paper.Path.Rectangle({
                from: new paper.Point(point1.x + 0.5, point1.y + 0.5),
                to: new paper.Point(point2.x + 0.5, point2.y + 0.5),
                strokeColor: this.viewOption.selectionColor,
                strokeWidth: 1,
                strokeScaling: false,
                name: SelectingRectangleName,
            });
            layer.addChild(rect);
        }
    }

    selectionDraw() {
        const stack = this.stack;
        for (let i = 0; i < stack.length; i++) {
            this.selectionDrawRect(stack[i], i);
        }
    }

    updateSelectionRectangles() {
        const stack = this.stack;
        for (let i = 0; i < stack.length; i++) {
            const item = stack[i];
            if (item.data.selection) {
                item.data.selection.remove();
                item.data.selection = null;
            }
            this.selectionDrawRect(stack[i], i);
        }
    }

    /// Draws selection.
    selectionDrawRect(item, suffix, update=false) {
        const bounds = item.strokeBounds;
        const point = bounds.point;
        const size = bounds.size;
        const x = Math.floor(point.x) - 1 + 0.5;
        const y = Math.floor(point.y) - 1 + 0.5;
        const width = Math.floor(size.width) + 2;
        const height = Math.floor(size.height) + 2;
        const rect = new paper.Path.Rectangle({
            point: new paper.Point(x, y),
            size: new paper.Size(width, height),
            strokeColor: this.viewOption.selectionColor,
            strokeWidth: 1,
            strokeScaling: false,
            dashArray: [4, 4],
            name: 'selection-' + suffix,
        });
        if (update) {
            item.data.selection.remove();
        }
        item.data.selection = rect;
        this.layerManager.getControlLayer().addChild(rect);
        return rect;
    }
}
