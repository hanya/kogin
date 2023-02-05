
import {
    BoundsOption, GridOption, GridOptionForPrinting,
    GridOptionForView, Metadata,
    OutputOptionForDisplay, OutputOptionForPrinting,
    PDFOption,
    ViewOption
} from "./option.js";
import { PositionCalculator } from "./mode.js";
import { Sashi } from "./sashi.js";
import {
    viewModeLineGrain, viewModeFillGrain,
    viewModeOverGrain, viewModeOverWarp
} from "./mode.js";

const APP_ID = 'kogin';
const DATA_ID = 'kogin-data';
const OPTION_ID = 'kogin-option';
const MEATA_ID = 'kogin-metadata';
const CLIP_ID = 'clip-path';


export class WriterBase {
    constructor(sashi) {
        this.sashi = sashi;
    }

    /**
     * Calculates total size from grid dimension.
     * @param {[number, number, number, number]} param0
     * @returns {[number, number, number, number]}
     */
     _gridTotalSize({ x, y, width, height }) {
        return [x * this.op.gridWidth,
                y * this.op.gridHeight,
                width * this.op.gridWidth + this.op.gridLineWidth,
                height * this.op.gridHeight + this.op.gridLineWidth];
    }

    _getRealBoundingBox(rect) {
        return [rect.x, rect.y, rect.width, rect.height];
    }

    /// Calculates bounding box of this document.
    _getGridBoundingBox(rect) {
        if (this.op.useOutputBounds) {
            return {
                x: this.op.boundsLeft - this.op.leftMargin,
                y: this.op.boundsTop - this.op.topMargin,
                width: this.op.boundsRight - this.op.boundsLeft + this.op.rightMargin + 1,
                height: this.op.boundsBottom - this.op.boundsTop + this.op.bottomMargin + 1
            };
        }
        if (rect) {
            const viewMode = this.op.viewMode;
            const x1 = rect.x;
            const y1 = rect.y;
            const x2 = rect.topRight.x;
            const y2 = rect.bottomRight.y;
            const left = x1 - this.op.leftMargin -
                (viewMode == viewModeOverGrain ? 1 : 0);
            const top = y1 - this.op.topMargin;
            const right = x2 + this.op.rightMargin +
                (viewMode == viewModeFillGrain ||
                 viewMode == viewModeLineGrain ? 0 : 1);
            const bottom = y2 + this.op.bottomMargin;
            return { x: left, y: top, width: right - left, height: bottom - top };
        } else {
            return { x: 0, y: 0, width: 0, height: 0};
        }
    }

    /// Calculates bounding box of the group from its children.
    _calculateGroupGridBoundingBox(children) {
        let rect = null;
        if (children.length == 0) {
            return new paper.Rectangle(0, 0, 1, 1);
        }
        for (const child of children) {
            let childRect = null;
            switch (child.className) {
                case 'Group': {
                    childRect = this._calculateGroupGridBoundingBox(child.children);
                    // Calculates translation
                    if (child.data.x !== undefined) {
                        childRect.x += child.data.x;
                        childRect.y += child.data.y;
                    }
                    break;
                }
                case 'SymbolItem': {
                    const data = child.data;
                    const length = data.stitchLength;
                    childRect = new paper.Rectangle(data.x, data.y, length, 1);
                    break;
                }
                default:
                    continue;
                    break;
            }
            if (rect == null) {
                rect = childRect;
            } else {
                rect = rect.unite(childRect);
            }
        }
        return rect;
    }

    readOptions(sashi, forPrinting) {
        const op = {
            forPrinting: forPrinting,
            viewModeLineGrain: viewModeLineGrain,
            viewModeFillGrain: viewModeFillGrain,
            viewModeOverWarp: viewModeOverWarp,
            viewModeOverGrain: viewModeOverGrain,
        };
        if (forPrinting) {
            for (const [key, value] of Object.entries(sashi.printSetting)) {
                op[key] = value;
            }
            for (const [key, value] of Object.entries(sashi.printGrid)) {
                op[key] = value;
            }
        } else {
            for (const [key, value] of Object.entries(sashi.imageSetting)) {
                op[key] = value;
            }
            for (const [key, _value] of Object.entries(GridOption)) {
                op[key] = sashi.viewGrid[key];
            }
        }
        op['viewMode'] = sashi.viewOption.viewMode;
        for (const [key, value] of Object.entries(sashi.boundsSetting)) {
            op[key] = value;
        }
        switch (op.viewMode) {
            case viewModeLineGrain:
                op.strokeWidth = op.lineGrainLineWidth;
                break;
            case viewModeFillGrain:
                op.strokeWidth = op.gridHeight - op.gridLineWidth;
                break;
            case viewModeOverWarp:
                op.strokeWidth = op.overWarpLineWidth;
                break;
            case viewModeOverGrain:
                op.strokeWidth = op.overGrainLineWidth;
                break;
        }

        op.halfStrokeWidth = op.strokeWidth / 2;
        op.posCalc = PositionCalculator.choose(op);
        op.lineCap = op.posCalc.strokeCap;

        return op;
    }
}


/// File writer.
class Writer extends WriterBase {
    /**
     *
     * @param {Sashi} sashi Document model.
     */
    constructor(sashi) {
        super(sashi);
        this.layerManager = sashi.layerManager;
        this.stitchManager = sashi.stitchManager;
    }

    /// Writes into SVG file.
    write(op) {
        this.stitchManager.clearUsed();
        this.op = this.readOptions(this.sashi, op.forPrinting);
        this.op.noData = op.noData;
        this.op.gridNumber = op.gridNumber;

        // calculates size of image
        this.bboxRect = this._calculateGroupGridBoundingBox(this.layerManager.getUserLayers());
        this.gridRect = this._getGridBoundingBox(this.bboxRect);
        const [offsetX, offsetY, width, height] = this._gridTotalSize(this.gridRect);
        if (width == 0 && height == 0) {
            return "";
        }
        this.op.offsetX = offsetX;
        this.op.offsetY = offsetY;
        this.op.width = width;
        this.op.height = height;
        if (this.op.forPrinting) {
            // font size in pt
            const fontSize = 9;
            this.horiMargin = 10;
            this.vertMargin = 10;
            // 1pixel -> 1mm
            this.numberingSize = fontSize * 25.4 / 72;
        } else {
            this.horiMargin = 30;
            this.vertMargin = 30;
            this.numberingSize = 12;
        }

        const dom = this._createDom(offsetX, offsetY, width, height, this.op.useXLink);

        let parent = dom;

        // draw background as rectangle
        if (this.op.setBackground) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.id = 'background';
            rect.setAttribute('x', 0);
            rect.setAttribute('y', 0);
            rect.setAttribute('width', this.op.width + (this.op.gridNumber ? this.horiMargin * 2 : 0 ));
            rect.setAttribute('height', this.op.height + (this.op.gridNumber ? this.vertMargin * 2 : 0));
            rect.setAttribute('fill', `${this.op.backgroundColor}`);
            parent.appendChild(rect);
        }

        // prepare margin for grid numbering
        if (this.op.gridNumber) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', 'translate(' + this.horiMargin + ' ' + this.vertMargin + ')');
            parent.appendChild(g);
            parent = g;
        }

        // under grid
        if (this.op.showGrid && !this.op.overGrid) {
            this._writeGridByPath(parent, width, height);
        }

        // writes stitches
        this._writeElements(parent, offsetX, offsetY, width, height);

        // write clipPath for output bounds
        if (this.op.useOutputBounds) {
            this._writeClipPath(dom);
        }

        // over grid
        if (this.op.showGrid && this.op.overGrid) {
            this._writeGridByPath(parent, width, height);
        }

        // grid numbering
        if (this.op.gridNumber) {
            this._writeGridNumbering(parent.parentNode);
        }

        // write title and copyright
        if (!this.op.forPrinting) {
            if (this.op.showTitle) {
                this._writeTitle(parent);
            }
            if (this.op.showCopyright) {
                this._writeCopyright(parent);
            }
        }

        // data
        if (!this.op.noData) {
            this._writeOption(dom);
            this._writeData(dom);
            this._writeMetadata(dom);
        }

        // replace tags
        this.stitchManager.clearUsed();
        let v = dom.outerHTML;
        v = v.replaceAll('></use>', '/>');
        v = v.replaceAll('></line>', '/>');
        v = v.replaceAll('></path>', '/>');
        v = v.replaceAll('></rect>', '/>');
        v = v.replaceAll('>', '>\n');
        return v;
    }

    /// Creates SVG dom.
    _createDom(offsetX, offsetY, width, height, useXLink) {
        const unit = this.op.forPrinting ? 'mm' : '';
        const dom = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (useXLink) {
            dom.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        }
        const imageWidth = this.op.gridNumber ? width + this.horiMargin * 2 : width;
        const imageHeight = this.op.gridNumber ? height + this.vertMargin * 2 : height;
        dom.setAttribute('viewBox', `0 0 ${imageWidth} ${imageHeight}`);
        dom.setAttribute('width', `${imageWidth}${unit}`);
        dom.setAttribute('height', `${imageHeight}${unit}`);
        return dom;
    }

    /// Adds option in hidden foreginObject.
    _writeOption(dom) {
        const sashi = this.sashi;
        const obj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        obj.id = OPTION_ID;
        obj.setAttribute('visibility', 'hidden');
        const sashiOption = {
            'output-screen': this._copyOptions(OutputOptionForDisplay, sashi.imageSetting),
            'output-print': this._copyOptions(OutputOptionForPrinting, sashi.printSetting),
            'grid-screen': this._copyOptions(GridOptionForView, sashi.viewGrid),
            'grid-print': this._copyOptions(GridOptionForPrinting, sashi.printGrid),
            bounds: this._copyOptions(BoundsOption, sashi.boundsSetting),
            'pdf-export': this._copyOptions(PDFOption, sashi.pdfSetting),
        };
        if (sashi.view) {
            sashiOption.view = this._copyOptions(ViewOption, sashi.viewOption,
                new Set(['defaultFileName', ]));
            sashiOption.view.viewMode = sashi.view.viewMode;
        }
        obj.textContent = JSON.stringify(sashiOption, null, 1);
        dom.appendChild(obj);
    }

    /// Adds data in hidden foreignObject.
    _writeData(dom) {
        const sashi = this.sashi;
        const obj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        obj.id = DATA_ID;
        obj.setAttribute('visibility', 'hidden');
        const sashiData = {
            application: APP_ID,
            data: this._constructGroupData(this.layerManager.getUserLayers()),
            defs: this._constructDefs(),
            pivots: this._constructPivot(this.layerManager.getPivotLayer()),
            bbox: this._getRealBoundingBox(this.bboxRect),
        };
        obj.textContent = JSON.stringify(sashiData);
        dom.appendChild(obj);
    }

    /// Adds metadata in hidden foreignObject.
    _writeMetadata(dom) {
        const obj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        obj.id = MEATA_ID;
        obj.setAttribute('visibility', 'hidden');
        obj.textContent = JSON.stringify(this.sashi.metadata, null, 1);
        dom.appendChild(obj);
    }

    /// Adds copyright text.
    _writeCopyright(parent) {
        const text = document.createElement('text');
        // todo, font-size
        text.setAttribute('x', (this.op.width - 5).toString());
        text.setAttribute('y', (this.op.height - 5).toString());
        text.setAttribute('font-size', '9');
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('fill', '#000000');
        text.textContent = this.sashi.metadata.copyright;
        parent.appendChild(text);
    }

    /// Adds title text.
    _writeTitle(parent) {
        const text = document.createElement('text');
        // todo, x, y, font-size
        text.setAttribute('x', '5');
        text.setAttribute('y', '13');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#000000');
        text.textContent = this.sashi.metadata.title;
        parent.appendChild(text);
    }

    _writeClipPath(parent) {
        const x = this.op.leftMargin * this.op.gridWidth;
        const y = this.op.topMargin * this.op.gridHeight;
        const width = this.op.width - (this.op.leftMargin + this.op.rightMargin) * this.op.gridWidth;
        const height = this.op.height - (this.op.topMargin + this.op.bottomMargin) * this.op.gridHeight;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const obj = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        obj.id = CLIP_ID;
        g.appendChild(obj);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        obj.appendChild(rect);
        parent.appendChild(g);
    }

    /// Copies set of key and value from base to target.
    _copyOptions(base, target, ignoreList=null) {
        const option = {};
        for (const [key, _value] of Object.entries(base)) {
            if (!ignoreList || (ignoreList && !ignoreList.has(key))) {
                option[key] = target[key];
            }
        }
        return option;
    }

    /// Adds group data.
    _constructGroupData(children) {
        // todo, way to set visibility or other attribute to the group
        const items = [];
        const singles = {};
        for (const child of children) {
            switch (child.className) {
                case 'SymbolItem': {
                    const ref = child.data.stitchLength + '-'+
                        child.definition.item.strokeColor.toCSS(true).substr(1);
                    let coords = singles[ref];
                    if (!coords) {
                        coords = [];
                        singles[ref] = coords;
                    }
                    coords.push([child.data.x, child.data.y]);
                    break;
                }
                case 'Group': {
                    const obj = {};
                    if (child.data.asLayer) {
                        obj['layer'] = true;//child.data.asLayer;
                        obj['name'] = child.name;
                        obj['visible'] = child.visible;
                        obj['locked'] = child.locked;
                    }
                    // translation
                    if (child.data.x !== undefined) {
                        obj['x'] = child.data.x;
                        obj['y'] = child.data.y;
                    }
                    obj['children'] = this._constructGroupData(child.children);
                    items.push(obj);
                    break;
                }
                default:
                    break;
            }
        }

        for (const [key, value] of Object.entries(singles)) {
            items.push({
                ref: key,
                coords: value,
            });
        }
        return items;
    }

    /// Adds defs.
    _constructDefs() {
        const singles = {};
        for (const id of this.stitchManager.getUsedIds()) {
            const count = this.stitchManager.used.get(id);
            if (count) {
                const def = this.stitchManager.getById(id);
                const item = def.item;
                // this way losts order of stitch insertion
                const length = item.data.stitchLength;
                let colors = singles[length];
                if (!colors) {
                    colors = [];
                    singles[length] = colors;
                }
                colors.push(item.data.color);
            }
        }
        const singleDefs = [];
        for (const [key, value] of Object.entries(singles)) {
            singleDefs.push({
                length: key,
                colors: value,
            });
        }
        const defs = {
            single: singleDefs,
        };
        return defs;
    }

    _constructPivot(pivotLayer) {
        const pivots = [];
        for (const child of pivotLayer.children) {
            if (child.className == 'SymbolItem' && child.data.pivot) {
                pivots.push(child);
            }
        }
        pivots.sort((a, b) => a.data.pivot_index - b.data.pivot_index );
        const sortedPivots = [];
        for (const pivot of pivots) {
            sortedPivots.push([pivot.data.x, pivot.data.y]);
        }
        return sortedPivots;
    }

    /// Adds group.
    _writeGroup(parent, group, defs, stitchDefs) {
        const g = document.createElement('g');
        if (group.className == 'Layer' || group.data.asLayer) {
            g.id = group.name;
            if (!group.visible) {
                g.setAttribute('visibility', 'hidden');
            }
        }

        const useXLink = this.op.useXLink;
        const offsetX = this.op.offsetX;
        const offsetY = this.op.offsetY;
        const strokeWidth = this.op.strokeWidth;
        const halfStrokeWidth = this.op.halfStrokeWidth;
        const gridWidth = this.op.gridWidth;
        const gridHeight = this.op.gridHeight;
        const cor = this.op.forPrinting ? 0 : 0.5;

        if (group.data.x !== undefined) {
            const x = Math.floor(group.data.x * gridWidth);
            const y = Math.floor(group.data.y * gridHeight);
            if (x != 0 || y != 0) {
                g.setAttribute('transform', `translate(${x} ${y})`);
            }
        }

        for (const child of group.children) {
            switch (child.className) {
                case 'Group': {
                    this._writeGroup(g, child, defs, stitchDefs);
                    break;
                }
                case 'SymbolItem': {
                    const length = child.data.stitchLength;
                    const id = this.stitchManager.has(length, child.definition.item.strokeColor.toCSS(true));
                    if (id !== null) {
                        const x = Math.floor(child.data.x * gridWidth);
                        const y = Math.floor(child.data.y * gridHeight);
                        const use = document.createElement('use');
                        if (useXLink) {
                            use.setAttribute('xlink:href', `#${id}`);
                        }
                        use.setAttribute('href', `#${id}`); // SVG2
                        use.setAttribute('x', x - offsetX);
                        use.setAttribute('y', y - offsetY);
                        g.appendChild(use);
                    }
                    break;
                }
                default:
                    break;
            }
        }
        parent.appendChild(g);
    }

    /// Adds contents of this document..
    _writeElements(dom, offsetX, offsetY, width, height) {
        const defs = document.createElement('defs');
        const stitchDefs = {};

        // layers
        const g = document.createElement('g');
        g.id = 'layers';
        if (this.op.useOutputBounds) {
            g.setAttribute('clip-path', `url(#${CLIP_ID})`);
        }
        for (const layer of this.layerManager.getUserLayers()) {
            this._writeGroup(g, layer, defs, stitchDefs);
        }

        // put used defs
        const strokeWidth = this.op.strokeWidth;
        const usedIds = this.stitchManager.getUsedIds();
        for (const id of usedIds) {
            const count = this.stitchManager.used.get(id);
            if (count) {
                const definition = this.stitchManager.getById(id);
                this._addDef(defs, id, definition.item);
            }
        }
        dom.appendChild(g);

        if (dom.tagName == 'svg') {
            dom.appendChild(defs);
        } else if (dom.parentNode.tagName == 'svg') {
            dom.parentNode.appendChild(defs);
        } else {
            // group all
            dom.parentNode.parentNode.appendChild(defs);
        }
    }

    /// Adds single line.
    _addLine(dom, id, x1, y1, x2, y2, stroke, strokeWidth) {
        const line = document.createElement('line');
        if (id !== null) {
            line.id = id;
        }
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', stroke);
        line.setAttribute('stroke-width', strokeWidth);
        line.setAttribute('stroke-linecap', this.op.lineCap);
        dom.appendChild(line);
    }

    /// Adds one def.
    _addDef(dom, id, item) {
        const strokeColor = this.op.monochrome ? '#000000' : item.strokeColor.toCSS(true);
        const strokeWidth = this.op.strokeWidth;

        if (this.op.forPrinting) {
            const [start, end] = this.op.posCalc.calc(0, 0, item.data.stitchLength, false);
            const x1 = start.x;
            const y1 = start.y;
            const x2 = end.x;
            const y2 = end.y;
            this._addLine(dom, id, x1, y1, x2, y2, strokeColor, strokeWidth);
        } else {
            const segments = item.segments;
            const x1 = segments[0].point.x;
            const y1 = segments[0].point.y;
            const x2 = segments[1].point.x;
            const y2 = segments[1].point.y;
            this._addLine(dom, id, x1, y1, x2, y2, strokeColor, strokeWidth);
        }
    }

    /// Inkscape does not recognize RGBA in color value.
    /// So we have to split RGBA into RGB and A for opacity attribute.
    _convertColor(color) {
        if (color.length > 6) {
            const rgb = color.substring(0, 7);
            const alphaPart = color.substring(7);
            const alpha = alphaPart ? parseInt(alphaPart, 16) : 0xff;
            return [rgb, (alpha / 0xff).toFixed(4)];
        } else {
            return [color, ''];
        }
    }

    /// Adds grid as path.
    _writeGridByPath(dom, width, height) {
        const gridWidth = this.op.gridWidth;
        const gridHeight = this.op.gridHeight;

        if (gridWidth <= 0 || gridHeight <= 0 || width <= 0 || height <= 0) {
            return;
        }

        // for printing purpose
        const gridLineWidth = this.op.gridLineWidth;
        const gridLineColor = this.op.gridLineColor;
        const gridMajorLineColor = this.op.gridMajorLineColor;

        const lineEndX = width;
        const lineEndY = height;
        // pixel correction
        const cor = this.op.forPrinting ? 0 : 0;//.5;
        const gridStart = gridLineWidth / 2;

        const createPath = (id, d, stroke, strokeWidth, major = false) => {
            const path = document.createElement('path');
            path.id = id;
            const [rgb, alpha] = this._convertColor(stroke);
            path.setAttribute('stroke', rgb);
            if (alpha) {
                path.setAttribute('opacity', alpha);
            }
            path.setAttribute('stroke-width', strokeWidth);
            path.setAttribute('d', d);
            return path;
        }

        const g = document.createElement('g');
        g.id = 'grid';

        const vd = [];
        vd.push(`M ${gridStart + cor},${gridStart + cor}`);
        const vertLine = `V ${lineEndY}`;
        const horiMove = `m ${gridWidth},-${lineEndY}`;
        for (let x = 0; x <= lineEndX; x += gridWidth) {
            vd.push(vertLine);
            vd.push(horiMove);
        }
        vd.pop(); // remove last movement
        const vpath = createPath('grid-vert-lines', vd.join(' '), gridLineColor, gridLineWidth);
        g.appendChild(vpath);

        const hd = [];
        hd.push(`M ${gridStart + cor},${gridStart + cor}`);
        const horiLine = `H ${lineEndX}`;
        const vertMove = `m -${lineEndX},${gridHeight}`;
        for (let y = 0; y <= lineEndY; y += gridHeight) {
            hd.push(horiLine);
            hd.push(vertMove);
        }
        hd.pop(); // remove unuseful last movement
        const hpath = createPath('grid-hori-lines', hd.join(' '), gridLineColor, gridLineWidth);
        g.appendChild(hpath);

        if (this.op.showGridFrame) {
            const frame = [];
            frame.push(`M ${gridStart + cor},${gridStart + cor}`);
            frame.push(`H ${lineEndX - cor - gridStart}`);
            frame.push(`V ${lineEndY - cor - gridStart}`);
            frame.push(`H ${gridStart + cor}`);
            frame.push(`V ${gridStart + cor} z`);
            const framePath = createPath('grid-frame', frame.join(' '), gridMajorLineColor, gridLineWidth, true);
            framePath.setAttribute('fill', 'none');
            g.appendChild(framePath);
        }

        if (this.op.showGridMajorLine && this.op.gridMajorLineFrequency > 0) {
            const horiMajorMoveDistance = gridWidth * this.op.gridMajorLineFrequency;
            if (horiMajorMoveDistance <= 0) {
                return;
            }
            const horiMajorStart = gridStart + gridWidth * this.op.gridMajorHoriOffset + cor;
            const vmd = [];
            vmd.push(`M ${horiMajorStart},${gridStart + cor}`);
            const vertMajorLine = `V ${lineEndY}`;
            const horiMajorMove = `m ${horiMajorMoveDistance},-${lineEndY}`;
            for (let x = horiMajorStart; x <= lineEndX; x += horiMajorMoveDistance) {
                vmd.push(vertMajorLine);
                vmd.push(horiMajorMove);
            }
            vmd.pop();
            const vmpath = createPath('grid-vert-major-lines', vmd.join(' '), gridMajorLineColor, gridLineWidth, true);
            g.appendChild(vmpath);

            const vertMajorMoveDistance = gridHeight * this.op.gridMajorLineFrequency;
            if (vertMajorMoveDistance <= 0) {
                return;
            }
            const vertMajorStart = gridStart + gridHeight * this.op.gridMajorVertOffset + cor;
            const hmd = [];
            hmd.push(`M ${gridStart + cor},${vertMajorStart}`);
            const horiMajorLine = `H ${lineEndX}`;
            const vertMajorMove = `m -${lineEndX},${vertMajorMoveDistance}`;
            for (let y = vertMajorStart; y <= lineEndY; y += vertMajorMoveDistance) {
                hmd.push(horiMajorLine);
                hmd.push(vertMajorMove);
            }
            hmd.pop();
            const hmpath = createPath('grid-hori-major-lines', hmd.join(' '), gridMajorLineColor, gridLineWidth, true);
            g.appendChild(hmpath);
        }

        dom.appendChild(g);
    }

    _writeGridNumbering(parent) {
        const forPrinting = this.op.forPrinting;
        const margin = forPrinting ? 2 : 5;
        const [color, alpha] = this._convertColor(this.op.numberingColor);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', 'numbering');
        g.setAttribute('font-size', this.numberingSize + (forPrinting ? 'pt' : 'px'));
        g.setAttribute('fill', color);
        if (alpha.length > 0) {
            g.setAttribute('fill-opacity', alpha);
        }
        parent.appendChild(g);

        function createNumbering(parent, id, anchor) {
            const numbers = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            numbers.setAttribute('id', id);
            numbers.setAttribute('text-anchor', anchor);
            parent.appendChild(numbers);
            return numbers;
        }

        function createText(parent, x, y, label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', forPrinting ? x.toFixed(4) : x);
            text.setAttribute('y', forPrinting ? y.toFixed(4) : y);
            text.textContent = label;
            parent.appendChild(text);
            return text;
        }

        const majorFrequency = this.op.gridMajorLineFrequency;
        const gridHeight = this.op.gridHeight;
        const gridWidth = this.op.gridWidth;
        const totalHeight = this.op.height + gridHeight;

        let startY = this.vertMargin + this.op.topMargin * gridHeight + gridHeight -
            (gridHeight / 2 - this.numberingSize / 2) / 2;
        const leftX = this.horiMargin - margin - (forPrinting ? 1 : 0);
        const rightX = this.horiMargin + this.op.width + margin;

        let number = 1;
        // left and right
        const leftNumbering = createNumbering(g, 'left-numbering', 'end');
        const rightNumbering = createNumbering(g, 'right-numbering', 'start');

        for (let y = startY; y < totalHeight;) {
            const label = number.toString();
            createText(leftNumbering, leftX, y, label);
            createText(rightNumbering, rightX, y, label);

            if (number != 1) {
                number += majorFrequency;
                y += majorFrequency * gridHeight;
            } else {
                number += majorFrequency - 1;
                y += (majorFrequency - 1) * gridHeight;
            }
        }

        let startX = this.horiMargin + this.op.leftMargin * gridWidth + gridWidth;
        let totalWidth = this.op.width + gridWidth;
        let topY = this.vertMargin - margin;
        let bottomY = this.vertMargin + this.op.height + margin + this.numberingSize;

        number = 1;
        // top and bottom
        const topNumbering = createNumbering(g, 'top-numbering', 'middle');
        const bottomNumbering = createNumbering(g, 'bottom-numbering', 'middle');

        for (let x = startX; x < totalWidth;) {
            const label = number.toString();
            createText(topNumbering, x, topY, label);
            createText(bottomNumbering, x, bottomY, label);

            if (number != 1) {
                number += majorFrequency;
                x += majorFrequency * gridWidth;
            } else {
                number += majorFrequency - 1;
                x += (majorFrequency - 1) * gridWidth;
            }
        }
    }
}

/*
children: [
    // stitch
    {
        ref: "",
        coords: [],
    },
    // group
    {
        x, y,
        children: [],
    },
]
*/

/**
 * File reader.
 */
export class Reader {
    /**
     *
     * @param {Sashi} sashi
     * @param {boolean} asTemplate
     */
    constructor(sashi, asTemplate, noLoadingSettings=false) {
        this.sashi = sashi;
        this.asTemplate = asTemplate;
        this.noLoadingSettings = noLoadingSettings;
        this.layerManager = sashi.layerManager;
        this.stitchManager = sashi.stitchManager;
        this.gridManager = sashi.gridManager;
    }

    /**
     * Reads data.
     *
     * @param {string} data SVG data to load.
     * @returns Template is returned if this reader is initialized for loading template.
     */
    read(data) {
        if (this.asTemplate) {
            this.template = {
                defs: [],
                pivots: [],
                bbox: [0, 0, 0, 0],
                valid: false,
            };
            this._resetOffset();
        }

        const domparser = new DOMParser();
        try {
            const svg = domparser.parseFromString(data, 'image/svg+xml');

            // Check parse error.
            if (svg.documentElement.tagName == 'parsererror') {
                throw svg.documentElement.textContent;
            }

            this._parseForeignObjects(svg);
        } catch (error) {
            throw error;
            //console.log(error);
            //return 'This file can not be loaded.';
        }
        return this.asTemplate ? this.template : null;
    }

    _resetOffset() {
        this.offsetX = 0;
        this.offsetY = 0;
    }

    _pushGroupOffset(x, y) {
        this.offsetX += x;
        this.offsetY += y;
    }

    _popGroupOffset(x, y) {
        this.offsetX -= x;
        this.offsetY -= y;
    }

    _parseForeignObjects(svg) {
        const store = {};
        for (const obj of svg.querySelectorAll('foreignObject')) {
            const data = JSON.parse(obj.textContent);
            if (obj.id == OPTION_ID) {
                store.option = data;
            } else if (obj.id == DATA_ID) {
                store.data = data;
            } else if (obj.id == MEATA_ID) {
                store.metadata = data;
            }
        }
        if (!this.noLoadingSettings) {
            this._readOptions(store.option);
            this._applySettings();
        }
        this._readMetadata(store.metadata);
        this._readData(store.data);
    }

    _applySettings() {
        const sashi = this.sashi;
        sashi.gridManager.setGridCount(sashi.viewGrid.horiCount, sashi.viewGrid.vertCount);
        sashi.gridManager.gridLineWidth = sashi.viewGrid.gridLineWidth;
        sashi.gridManager.setGridSize(sashi.viewGrid.gridWidth, sashi.viewGrid.gridHeight);
        sashi.view.setViewMode(sashi.viewOption.viewMode, true);

        // view option
        // grid option
    }

    _readData(data) {
        if (data.application != APP_ID) {
            return;
        }

        const sashiDefs = data.defs;
        if (sashiDefs) {
            this._readDefs(sashiDefs);
        }

        const sashiData = data.data;
        if (sashiData) {
            this.layerManager.clear();
            this._readObjects(null, sashiData);
            this.layerManager.setActiveLayer(this.layerManager.getUserLayers()[0]);

            const sashiBBox = data.bbox;
            if (sashiBBox && this.asTemplate) {
                this._readBBox(sashiBBox);
            }

            if (this.asTemplate) {
                this._readObjectsAsTemplate(this.template.defs, sashiData);
            }

            const sashiPivots = data.pivots;
            if (sashiPivots) {
                this._readPivots(sashiPivots);
            }

            if (this.asTemplate) {
                this.template.valid = true;
            }
        }
    }

    _readBBox(data) {
        this.template.bbox = data;
    }

    _readObjectsAsTemplate(container, objects) {
        for (const object of objects) {
            const children = object.children;
            if (children) {
                const isLayer = object.layer;
                if (isLayer) {
                    // layer
                    this._resetOffset();
                    if (object.visible) {
                        this._pushGroupOffset(0, 0);
                        const items = [];
                        this._readObjectsAsTemplate(items, children);
                        this._popGroupOffset(0, 0);
                        container.push([[0, 0], items]);
                    }
                } else {
                    // group
                    this._pushGroupOffset(0, 0);
                    const items = [];
                    this._readObjectsAsTemplate(items, children);
                    this._popGroupOffset(0, 0);
                    container.push([[object.x, object.y], items]);
                }
            } else {
                const [length, color] = this.parseId(object.ref);
                for (const coord of object.coords) {
                    container.push([coord[0] + this.offsetX, coord[1] + this.offsetY, length, color]);
                }
            }
        }
    }

    _readObjects(container, objects) {
        for (const object of objects) {
            const children = object.children;
            if (children !== undefined) {
                let parent = container;
                const isLayer = object.layer;
                if (isLayer !== undefined && isLayer) {
                    // layer
                    const layer = this.layerManager.addLayer(object.name);
                    layer.locked = object.locked;
                    layer.visible = object.visible;
                    parent = layer;
                } else {
                    // group
                    const group = new paper.Group();
                    group.data.x = object.x;
                    group.data.y = object.y;
                    group.pivot = new paper.Point(0, 0);
                    container.addChild(group);
                    parent = group;
                }
                this._readObjects(parent, children);
                if (isLayer === undefined || !isLayer) {
                    parent.translate(this.gridManager.gridToPoint(object.x, object.y));
                }
            } else {
                const ref = object.ref;
                const coords = object.coords;
                for (const coord of coords) {
                    const x = coord[0];
                    const y = coord[1];
                    const item = this.stitchManager.singleStitchFromId(ref, x, y);
                    container.addChild(item);
                }
            }
        }
    }

    _readChildren(children) {
        const items = [];
        for (const child of children) {
            if (child.ref) {
                const [length, color] = this.parseId(child.ref);
                for (const coord of child.coords) {
                    items.push([coord[0] + this.offsetX, coord[1] + this.offsetY, length, color]);
                }
            } else if (child.children) {
                this._pushGroupOffset(child.x, child.y);
                const ret = this._readChildren(child.children);
                items.push(ret);
                this._popGroupOffset(child.x, child.y);
            }
        }
        return items;
    }

    _readDefs(defs) {
        const single = defs.single;
        if (single) {
            this._readSingleDefs(single);
        }
    }

    _readSingleDefs(singles) {
        const stitchManager = this.stitchManager;

        for (const single of singles) {
            const length = single.length;
            for (const color of single.colors) {
                stitchManager.get(length, color);
            }
        }
    }

    _readPivots(pivots) {
        const pivotLayer = this.layerManager.getPivotLayer();
        for (let index = 0; index < pivots.length; index++) {
            const pivot = pivots[index];
            const item = this.stitchManager.newPivot(pivot[0], pivot[1], index);
            pivotLayer.addChild(item);
        }

        if (this.asTemplate) {
            const items = [];
            for (const pivot of pivots) {
                items.push([pivot[0], pivot[1], 0]);
            }
            if (items.length == 0) {
                const bbox = this.template.bbox;
                items.push([bbox[0], bbox[1]]);
                this.template.noPivots = true;
            }
            this.template.pivots = items;
        }
    }

    _readOptions(option) {
        const sashi = this.sashi;
        // ignore some options loading from the file
        const ops = Object.assign({}, ViewOption);
        delete ops.crosshair;
        delete ops.oneToOne;
        delete ops.oneToTwo;
        delete ops.openFromToolbar;
        delete ops.saveFromToolbar;
        delete ops.autoScrollOnTemplates;
        if (!option) {
            option = {};
            option.view = ops;
            option['output-screen'] = OutputOptionForDisplay;
            option['output-print'] = OutputOptionForPrinting;
            option['grid-screen'] = GridOptionForView;
            option['grid-print'] = GridOptionForPrinting;
            option['bounds'] = BoundsOption;
            option['pdf-export'] = PDFOption;
        }
        this._readOption(sashi.viewOption, option['view'], ops);
        this._readOption(sashi.imageSetting, option['output-screen'], OutputOptionForDisplay);
        this._readOption(sashi.printSetting, option['output-print'], OutputOptionForPrinting);
        this._readOption(sashi.viewGrid, option['grid-screen'], GridOptionForView);
        this._readOption(sashi.printGrid, option['grid-print'], GridOptionForPrinting);
        this._readOption(sashi.boundsSetting, option['bounds'], BoundsOption);
        this._readOption(sashi.pdfSetting, option['pdf-export'], PDFOption);
    }

    _readOption(op, data, defaultOptions) {
        if (!data) {
            Object.assign(op, defaultOptions);
            return;
        }
        for (const [key, valueDefault] of Object.entries(defaultOptions)) {
            const value = data[key];
            if (value === undefined) {
                op[key] = valueDefault;
            } else {
                op[key] = value;
            }
        }
    }

    _setPivots() {
        this.tlx = 100000;
        this.tly = 100000;
        this.trx = -100000;
        this.try = -100000;
        this.blx = 100000;
        this.bly = 100000;
        this.brx = -100000;
        this.bry = -100000;

        this._findPosition(this.template.defs);
    }

    _findPosition(group) {
        for (const item of group) {
            if (Array.isArray(item) && Array.isArray(item[0])) {
                // group
                this._findPosition(item);
            } else {
                const x = item[0];
                const y = item[1];
                const length = item[2];

            }
        }
    }

    parseId(id) {
        const parts = id.split('-', 2);
        const length = parseInt(parts[0]);
        const color = '#' + parts[1];
        return [length, color];
    }

    _readMetadata(data) {
        const metadata = Object.assign(this.sashi.metadata, Metadata);

        for (const [key, valueDefault] of Object.entries(metadata)) {
            const value = data[key];
            if (value !== undefined) {
                metadata[key] = value;
            }
        }

        // todo, remove this
        if (this.asTemplate) {
            this.template.metadata = metadata;
        }
    }

    reDecode(text) {
        if (this.hasNonAscii(text)) {
            const bytes = new Uint8Array(text.length);
            for (let i = 0; i < title.length; i++) {
                bytes[i] = text.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        }
        return text;
    }

    hasNonAscii(text) {
        for (let i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) >= 128) {
                return true;
            }
        }
        return false;
    }
}

/// Filter for data write and read.
export class Filter {
    /**
     * Constructor.
     *
     * @param {Sashi} sashi
     */
    constructor(sashi) {
        this.sashi = sashi;

        this.writer = new Writer(sashi);
        this.reader = new Reader(sashi);
    }

    /**
     * Write current document into SVG string.
     *
     * @param {object} op Option for writing data.
     * @returns
     */
    write(op) {
        return this.writer.write(op);
    }

    /**
     * Read into current model from SVG string.
     *
     * @param {string} data
     * @returns
     */
    read(data) {
        return this.reader.read(data);
    }
}
