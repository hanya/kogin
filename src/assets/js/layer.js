
import { Broadcaster } from "./broadcaster.js";

// Layer index
// length - 1: UI top layer
// length - 2: UI layer
// length - 3: Cursor layer
// length - 4: Grid upper
// length - 5: Control layer, selection, bounds
// length - 6: Pivot layer
// length - 7: Preview layer
// 2: Root layer, could not removed, just clear its contents
// 1: Grid lower
// 0: Background layer

export class LayerManager extends Broadcaster {
    /**
     * Constructor.
     *
     * @param {paper.Project} project Project of paper.js for this document.
     */
    constructor(project) {
        super();
        this.project = project;
        Object.defineProperties(this, {
            PreviewLayerOffset: { value: -7 },
            PivotLayerOffset: { value: -6 },
            ControlLayerOffset: { value: -5 },
            GridUpperLayerOffset: { value: -4 },
            CursorLayerOffset: { value: -3 },
            UILayerOffset: { value: -2 },
            UITopLayerOffset: { value: -1 },
        });
        Object.defineProperties(this, {
            GridLowerLayerIndex: { value: 1 },
            RootLayerIndex: { value: 2 },
            BackgroundLayerIndex: { value: 0 },
        });
        this.controlLayer = null;
        this.pivotLayer = null;
        this.previewLayer = null;
        this.overGrid = false;
        this.userLayers = [];
        this.groupEditStack = [];
        this.layerStack = [];
    }

    /// Adds layers.
    addInitialLayers() {
        const project = this.project;
        const Layer = paper.Layer;
        // Add grid and default layers, these layers should not be removed
        const pivotLayer = new Layer({
            name: "__Pivot",
            visible: false,
        });
        const previewLayer = new Layer({ name: "__Preview" });
        const controlLayer = new Layer({ name: "__Control" });
        const uiTopLayer = new Layer({ name: "__UITop" });
        const uiLayer = new Layer({ name: "__UI" });
        const gridLowerLayer = new Layer({ name: "__GridLower" });
        const gridUpperLayer = new Layer({ name: "__GridUpper" });
        const cursorLayer = new Layer({
            name: "__Cursor",
            locked: true,
            visible: false,
        });
        const backgroundLayer = new Layer({ name: '__Background' });
        const rootLayer = (new paper.Layer({ name: "(root)" }));

        backgroundLayer.visible = false;
        gridLowerLayer.visible = false;
        gridUpperLayer.visible = false;

        project.addLayer(backgroundLayer);
        project.addLayer(gridLowerLayer);
        project.addLayer(rootLayer);
        project.addLayer(previewLayer);
        project.addLayer(pivotLayer);
        project.addLayer(controlLayer);
        project.addLayer(gridUpperLayer);
        project.addLayer(cursorLayer);
        project.addLayer(uiLayer);
        project.addLayer(uiTopLayer);
        project.layers[this.RootLayerIndex].activate();
        this.controlLayer = controlLayer;
        this.previewLayer = previewLayer;
        this.pivotLayer = pivotLayer;

        this.layerStack.push(rootLayer);

        const layer = this.addLayer('Layer 1');
        // as active layer
        this.layerStack.push(layer);

        // add background rectangle
        this.backgroundRect = new paper.Path.Rectangle({
            point: [0, 0],
            size: [10, 10],
            fillColor: '#ffffff',
            name: '__background-rectangle',
        });
        backgroundLayer.addChild(this.backgroundRect);
    }

    broadcast() {
        this._broadcast({ layer: this.getActiveLayer() });
    }

    /// Clears managed layers.
    clear() {
        this._clearGroupEdit();
        while (this.layerStack.length >= 2) {
            this.layerStack.pop();
        }
        this._clearUserLayer();
        this._clearPivotLayer();
    }

    /// Removes all user layers.
    _clearUserLayer() {
        while (this.userLayers.length > 0) {
            this.userLayers.pop();
        }
        this.getRootLayer().removeChildren();
    }

    /// Removes all pivots from pivot layer.
    _clearPivotLayer() {
        const layer = this.pivotLayer;
        while (layer.firstChild) {
            layer.firstChild.remove();
        }
    }

    isGroupEdit() {
        return this.groupEditStack.length > 0;
    }

    /// Checks stack of group edit is not empty.
    hasGroupEdit() {
        return this.groupEditStack.length > 0;
    }

    setGroupEditStack(groups, broadcast = true) {
        this._clearGroupEdit();
        for (const group of groups) {
            this.groupEditStack.push(group);
        }

        if (broadcast) {
            this.broadcast();
        }
    }

    /// Pushes a group into stack of group edit.
    pushGroupEdit(group, broadcast = true) {
        this.groupEditStack.push(group);

        if (broadcast) {
            this.broadcast();
        }
    }

    /// Pops last group from the stack of group edit.
    popGroupEdit(count = 1, broadcast = true) {
        let changed = false;
        for (let n = 0; n < count; n++) {
            this.groupEditStack.pop();
            changed = true;
        }

        if (broadcast && changed) {
            this.broadcast();
        }
    }

    /// Clears stack of group edit.
    _clearGroupEdit() {
        while (this.groupEditStack.length > 0) {
            this.groupEditStack.pop();
        }
    }

    /// Clears stack of group edit.
    clearGroupEdit() {
        if (this.hasGroupEdit()) {
            this._clearGroupEdit();

            this.broadcast();
        }
    }

    /// Returns stack of group edit.
    getEditGroups() {
        return this.groupEditStack;
    }

    /// Returns current group of group edit.
    getCurrentEditGroup() {
        const groups = this.getEditGroups();
        const count = groups.length;
        if (count > 0) {
            return groups[count - 1];
        } else {
            return null;
        }
    }

    isGroupSingleStep(stack) {
        for (let index = 0; index < this.groupEditStack.length; index++) {
            if (this.groupEditStack[index] != stack[index]) {
                return false;
            }
        }
        return true;
    }

    /// Returns pivot layer.
    getPivotLayer() {
        return this.pivotLayer;
    }

    /// Shows pivot layer.
    showPivotLayer() {
        this.pivotLayer.visible = true;
    }

    /// Hides pivot layer.
    hidePivotLayer() {
        this.pivotLayer.visible = false;
    }

    /// Returns root layer for user layer.
    getRootLayer() {
        return this.project.layers[this.RootLayerIndex];
    }

    /// Returns user layers.
    getUserLayers() {
        return this.userLayers;
    }

    /// Tries to find next Layer name with unused number.
    getNextLayerName() {
        for (let n = 1; ; n++) {
            const name = "Layer " + n;
            const layer = this.getLayerByName(name);
            if (layer === null) {
                return name;
            }
        }
        return 'Layer';
    }

    /// Returns layer specified by its name if exists.
    getLayerByName(name) {
        for (let layer of this.userLayers) {
            if (layer.name == name) {
                return layer;
            }
        }
        return null;
    }

    /// Adds new layer with name.
    addLayer(name) {
        const activeIndex = this.getLayerIndex(this.getActiveLayer());
        const layer = new paper.Group({
            name: name,
            locked: false,
            visible: true,
        });
        layer.data.asLayer = true;
        layer.data.x = 0;
        layer.data.y = 0;

        this.getRootLayer().addChild(layer);
        // Flag to indicate this group is used as layer.

        this.userLayers.splice(activeIndex + 1, 0, layer);
        return layer;
    }

    /// Inserts layer at specified index.
    insertLayer(index, layer) {
        this.userLayers.splice(index, 0, layer);
    }

    /// Returns layer specified by its index.
    getLayer(index) {
        return 0 <= index && index < this.userLayers.length ? this.userLayers[index] : null;
    }

    /// Returns index of the layer in the container.
    getLayerIndex(layer) {
        return this.userLayers.findIndex((element) => layer === element);
    }

    /// Removes layer specified by it index.
    removeLayer(index) {
        const layer = this.getLayer(index);
        if (layer) {
            const isActive = layer == this.getActiveLayer();
            if (this.getCount() == 1) {
                layer.removeChildren();
            } else {
                const index = this.getLayerIndex(layer);
                this.userLayers.splice(index, 1);
                if (isActive) {
                    let nextLayer = this.getLayer(index);
                    if (nextLayer === null && index >= 1) {
                        nextLayer = this.getLayer(index - 1);
                    }
                    this.setActiveLayer(nextLayer);
                }
                layer.remove();
            }
        }
    }

    /// Toggles visibility of active layer.
    toggleVisibleActiveLayer() {
        const layer = this.getActiveLayer();
        if (layer) {
            layer.visible = !layer.visible;
            return layer.visible;
        }
        return null;
    }

    /// Shows layer specified by its index.
    showLayer(index) {
        const layer = this.get(index);
        if (layer && !layer.visible) {
            layer.visible = true;
        }
    }

    /// Hides layer specified by its index.
    hideLayer(index) {
        const layer = this.get(index);
        if (layer && layer.visible) {
            layer.visible = false;
        }
    }

    /// Toggles lock state of active layer.
    toggleLockActiveLayer() {
        const layer = this.getActiveLayer();
        if (layer) {
            layer.locked = !layer.locked;
            return layer.locked;
        }
        return null;
    }

    /// Locks layer.
    lockLayer(index) {
        const layer = this.get(index);
        if (layer && !layer.locked) {
            layer.locked = true;
        }
    }

    /// Unlocks layer.
    unlockLayer(index) {
        const layer = this.get(index);
        if (layer && layer.locked) {
            layer.locked = false;
        }
    }

    /// Renames layer.
    renameLayer(index, name) {
        const layer = this.get(index);
        if (layer && layer.name != name) {
            layer.name = name;
        }
    }

    /// Renames active layer.
    renameActiveLayer(name) {
        const layer = this.getActiveLayer();
        const index = this.getLayerIndex(layer);
        this.renameLayer(index, name);
    }

    /// Returns number of layers in user layers.
    getCount() {
        return this.userLayers.length;
    }

    /// Returns current active layer of user layers.
    getActiveLayer(groupEdit = true) {
        if (groupEdit && this.groupEditStack.length > 0) {
            return this.groupEditStack[this.groupEditStack.length - 1];
        } else {
            if (this.layerStack.length == 2) {
                return this.layerStack[1];
            } else {
                return this.layerStack[0];
            }
        }
    }

    /// Sets active layer.
    setActiveLayer(group, broadcast = true) {
        if (group.className != 'Group') {
            return;
        }
        if (group.data.asLayer) {
            const activeLayer = this.getActiveLayer(false);
            if (group == activeLayer && !this.isGroupEdit()) {
                return;
            }
            if (this.isGroupEdit()) {
                this._clearGroupEdit();
            }
            while (this.layerStack.length >= 2) {
                this.layerStack.pop();
            }
            this.layerStack.push(group);
        } else {
            if (this.isGroupEdit()) {
                if (group == this.getActiveLayer(true)) {
                    return;
                }
            }
        }

        if (broadcast) {
            this.broadcast();
        }
    }

    /// Sets active layer specified by its index.
    setActiveLayerByIndex(index) {
        const layer = this.getLayer(index);
        if (layer) {
            this.setActiveLayer(layer);
        }
    }

    /// Returns active layer if passed layer is null.
    getTargetLayer(layer = null) {
        return layer === null ? this.getActiveLayer() : layer;
    }

    setOverGrid(newOverGrid) {
        if (this.overGrid != newOverGrid) {
            this.overGrid = newOverGrid;
            this.project.layers[this.GridLowerLayerIndex].visible = !newOverGrid;
            this.project.layers[this.project.layers.length + this.GridUpperLayerOffset].visible = newOverGrid;
        }
    }

    getParentTopLayer(items) {
        const index = items.reduce((acc, value) => {
            if (acc < value.parent.index) {
                acc = value.parent.index;
            }
        }, this.RootLayerIndex);
        return this.project.layers[index];
    }

    /// Returns top layer.
    getTopLayer() {
        return this.getRootLayer();
    }

    /// Returns control layer.
    getControlLayer() {
        return this.controlLayer;
    }

    /// Clears control layer.
    clearControlLayer() {
        this.controlLayer.removeChildren();
    }

    /// Return preview layer.
    getPreviewLayer() {
        return this.previewLayer;
    }

    /// Clears preview layer.
    clearPreviewLayer() {
        this.previewLayer.removeChildren();
    }

    /// Clears preview layer and then returns it.
    clearAndGetPreviewLayer() {
        this.previewLayer.removeChildren();
        return this.previewLayer;
    }

    /// Returns lower grid layer.
    getLowerGridLayer() {
        return this.project.layers[this.GridLowerLayerIndex];
    }

    /// Returns upper grid layer.
    getUpperGridLayer() {
        return this.project.layers[this.project.layers.length + this.GridUpperLayerOffset];
    }

    /// Returns cursor layer.
    getCursorLayer() {
        return this.project.layers[this.project.layers.length + this.CursorLayerOffset];
    }

    getCursor(name) {
        return this.getCursorLayer().children[name];
    }

    /// Sets visible the cursor layer.
    setCursorLayerVisible(state) {
        this.getCursorLayer().visible = state;
    }

    /// Returns UI top layer.
    getUITopLayer() {
        return this.project.layers[this.project.layers.length + this.UITopLayerOffset];
    }

    getUILayer() {
        return this.project.layers[this.project.layers.length + this.UILayerOffset];
    }

    getBackgroundLayer() {
        return this.project.layers[this.BackgroundLayerIndex];
    }

    setBackgroundLayerVisible(state) {
        this.getBackgroundLayer().visible = state;
    }

    setBackgroundColor(color) {
        this.backgroundRect.fillColor = color;
        this.setBackgroundLayerVisible(color != '#ffffff');
    }

    setBackgroundSize(size) {
        const segments = this.backgroundRect.segments;
        segments[0].point.y = size.height;
        segments[2].point.x = size.width;
        segments[3].point.x = size.width;
        segments[3].point.y = size.height;
    }

    getUserLayerNames() {
        return Array.from(this.getUserLayers(), (layer) => layer.name);

    }
}
