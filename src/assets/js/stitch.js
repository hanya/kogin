
import { PositionCalculator, FillGrain, OverGrain, OverWarp } from "./mode.js";
import { GridManager } from "./grid.js";
import { Sashi } from "./sashi.js";


/// Manages stitch related things.
export class StitchManager {
    /**
     *
     * @param {GridManager} gridManager
     * @param {Sashi} sashi
     * @param {number} viewMode
     */
    constructor(gridManager, sashi, viewMode, pivotColor) {
        this.gridManager = gridManager;
        this.sashi = sashi;
        this.viewMode = viewMode;
        this.single = new Map();
        this.used = new Map(); // name: count used
        this.pivotColor = pivotColor;
        this.calcPos = this.updatePosCalc();
        this.updatePosCalc(this.viewMode);
    }

    _createPivotItem(radius) {
        return new paper.Path.Ellipse({
            center: [0, 0],
            size: [radius, radius],
            fillColor: this.pivotColor,
            data: {
                pivot: true,
            },
        });
    }

    updatePosCalc() {
        const op = {
            viewMode: this.viewMode,
            gridWidth: this.sashi.viewGrid.gridWidth,
            gridHeight: this.sashi.viewGrid.gridHeight,
            gridLineWidth: this.sashi.viewGrid.gridLineWidth,
            overGrainLineWidth: this.sashi.imageSetting.overGrainLineWidth,
            overWarpLineWidth: this.sashi.imageSetting.overWarpLineWidth,
            lineGrainLineWidth: this.sashi.imageSetting.lineGrainLineWidth,
            overGrainOffsetRatio: this.sashi.imageSetting.overGrainOffsetRatio,
            overWarpOffsetRatio: this.sashi.imageSetting.overWarpOffsetRatio,
        };
        this.calcPos = PositionCalculator.choose(op);
        const radius = Math.min(this.gridManager.getVertCenterOffset(), this.gridManager.getHoriCenterOffset()) * 2 - 4;
        const pivot = this._createPivotItem(radius);
        if (this.pivotDef) {
            this.pivotDef.item = pivot;
        } else {
            this.pivotDef = new paper.SymbolDefinition(pivot, true);
        }
    }

    /// Clears all.
    clear() {
        this.single.clear();
        this.clearUsed();
    }

    /// Clears container for used stitches.
    clearUsed() {
        this.used.clear();
    }

    setPivotColor(color) {
        this.pivotDef.item.fillColor = color;
    }

    /// Sets current view mode.
    setViewMode(viewMode, force=false) {
        if (force || viewMode != this.viewMode) {
            this.viewMode = viewMode;
            this.updatePosCalc();
            // todo, update selection

            this.update();
        }
    }

    /// Replace current def with new length and color.
    replace(currentDef, length, newColor) {
        if (currentDef.item.data.stitchLength == length &&
            currentDef.item.data.color == newColor) {
            return;
        }
        const newDef = this.get(length, newColor);
        return newDef;
    }

    /// Generates identifier from length and color.
    toId(length, color) {
        // remove # from color name
        return `${length}-${color.substr(1)}`;
    }

    /// Splits id into length and color.
    fromId(id) {
        const parts = id.split('-', 2);
        const length = parseInt(parts[0]);
        const color = '#' + parts[1];
        return [length, color];
    }

    /// Returns list of used ids.
    getUsedIds() {
        return this.used.keys();
    }

    /// Checks stitch def is exists in defs and count up used stitches if exists.
    has(length, color) {
        if (0 <= length) {
            const id = this.toId(length, color);
            const definition = this.single.get(id);
            if (definition) {
                if (this.used.get(id) === undefined) {
                    this.used.set(id, 0);
                }
                this.used.set(id, this.used.get(id) + 1);
                return id;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    /// Gets def from stitch id.
    getById(id) {
        //return this.single.get(id);
        const definition = this.single.get(id);
        if (definition) {
            return definition;
        } else {
            const [length, color] = this.fromId(id);
            return this._prepare(length, color);
        }
    }

    /// Gets def from stitch length and color.
    get(length, color) {
        if (0 <= length) {
            const id = this.toId(length, color);
            return this.getById(id);
        } else {
            return null;
        }
    }

    /// Returns def from its id.
    getBase(id) {
        const definition = this.single.get(id);
        if (definition) {
            return definition;
        } else {
            return null;
        }
    }

    /// Updates all stitch defs to match the current view mode.
    update() {
        for (const definition of this.single.values()) {
            const item = definition.item;
            if (item.data && item.data.singleStitch === true) {
                const length = item.data.stitchLength;
                const [p1, p2] = this.calcPos.calc(0, 0, length, true);
                item.segments[0].point = p1;
                item.segments[1].point = p2;
                item.strokeWidth = this.calcPos.strokeWidth;
                item.strokeCap = this.calcPos.strokeCap;
            }
        }
    }

    /// Prepare to define new def for stitch.
    _prepare(length, color) {
        const id = this.toId(length, color);
        const [p1, p2] = this.calcPos.calc(0, 0, length, true);
        const line = new paper.Path.Line({
            from: p1,
            to: p2,
            strokeColor: color,
            strokeWidth: this.calcPos.strokeWidth,
            strokeCap: this.calcPos.strokeCap,
            data: {
                singleStitch: true,
                stitchLength: length,
                color: color,
            },
        });
        const definition = new paper.SymbolDefinition(line, true);
        this.single.set(id, definition);
        return definition;
    }

    /// Generates single stitch from id and coordinate.
    singleStitchFromId(id, x, y) {
        const [length, color] = this.fromId(id);
        return this.singleStitch(length, color, x, y);
    }

    /// Generates single stitch from length, color and coordinate.
    singleStitch(length, color, x, y) {
        const definition = this.get(length, color);
        if (definition) {
            const point = this.gridManager.gridToPoint(x, y);
            const item = definition.place();
            item.pivot = new paper.Point(0, 0);
            item.position = point;
            item.data.template = [0, 0, length, 0];
            item.data.x = x;
            item.data.y = y;
            item.data.stitchLength = length;
            return item;
        }
        return null;
    }

    /// Generates new pivot.
    newPivot(x, y, index=null) {
        const point = this.gridManager.gridToGridCenterPoint(x, y);
        const item = this.pivotDef.place();
        item.pivot = new paper.Point(0, 0);
        item.position = point;
        item.data.x = x;
        item.data.y = y;
        item.data.pivot = true;
        if (index) {
            item.data.pivot_index = index;
        } else {
            item.data.pivot_index = this.getPivotNextIndex();
        }
        return item;
    }

    getPivotNextIndex() {
        const pivot_indices = [0, 0];
        for (const pivot of this.sashi.layerManager.getPivotLayer().children) {
            let index = pivot.data.pivot_index;
            index = (index && index >= 0) ? index : 0;
            pivot_indices.push(index);
        }
        const maxIndex = Math.max(...pivot_indices);
        return maxIndex + 1;
    }

    updatePivotPosition() {
        for (const pivot of this.sashi.layerManager.getPivotLayer().children) {
            const point = this.gridManager.gridToGridCenterPoint(pivot.data.x, pivot.data.y);
            pivot.position = point;
        }
    }

    _groupPosition(group, coord) {
        if (group && group.className == 'Group' && !group.data.asLayer) {
            coord[0] += group.data.x;
            coord[1] += group.data.y;
            this._groupPosition(group.parent, coord);
        }
        return false;
    }

    updatePositionInGroup(item, group) {
        const coord = [0, 0];
        this._groupPosition(group, coord);
        const point = this.gridManager.gridToPoint(item.data.x + coord[0], item.data.y + coord[1]);
        item.position = point;
    }

    registerAll(items) {
        for (const child of items) {
            switch (child.className) {
                case 'SymbolItem': {
                    const length = child.data.stitchLength;
                    const color = child.definition.item.strokeColor.toCSS(true);
                    this.get(length, color);
                    break;
                }
                case 'Group': {
                    this.registerAll(child.children);
                    break;
                }
                default:
                    break;
            }
        }
    }
}
