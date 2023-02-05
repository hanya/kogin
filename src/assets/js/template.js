
/**
 * Wrapper for template.
 */
export class Template {
    /**
     * Constructor.
     */
    constructor() {
        this.template = null;
        this.pivots = null;
        this.bboxData = [0, 0, 0, 0];
        this.pivotIndex = 0;
        this.single = true;
        this.keepColor = false;
        this.type = 'single';
        // normal, hmirror, vmirror
        this.state = 'normal';
        this.templateNormal = null;
        this.asGroup = false;
    }

    /// Replaces template.
    update(template, keepColor = false, pivotIndex = 0, state = 'normal') {
        if (state == 'normal') {
            this.templateNormal = template;
            this.asGroup = template.asGroup;
        }
        this.state = state;
        this.template = template;
        this.pivots = template.pivots;
        this.pivotIndex = 0;
        this.pivotSetIndex(pivotIndex);
        this.single = template.type == 'single';
        this.type = template.type;
        this.bboxData = template.bbox;
        this.keepColor = keepColor;
    }

    static objectToTemplate(items) {
        /*
        const template = {
            defs: [
                [2, 0, 2, 0], [0, 1, 6, 0], [2, 2, 2, 0],
                [[x, y], [children]], // group
            ],
            pivots: [
                [0, 1, 0], [2, 2, 0], [5, 1, 1], [2, 0, 0], [2, 1, 0],
            ],
            bbox: [0, 0, 3, 6],
            type: 'katako',
            size: 3, // for katako, modoko
            asGroup: true,
        };*/
        const defs = [];
        for (const item of items) {
            if (item.className == 'Group') {
                Template._fromGroup(defs, item);
            } else {
                defs.push([item.data.x, item.data.y, item.data.stitchLength, item.definition.item.strokeColor.toCSS(true)]);
            }
        }

        const bbox = Template._calculateBBox(defs, 0, 0);
        const isSingle = defs.length == 1 && !Array.isArray(defs[0][0]);
        // left top as pivot
        const pivots = [[bbox[0], bbox[1]]];
        if (isSingle) {
            bbox[0] = 0;
            bbox[1] = 0;
            pivots[0][0] = 0;
            pivots[0][1] = 0;
            pivots.push([defs[0][2] - 1, 0]);
        }

        const template = {
            defs: defs,
            pivots: pivots,
            bbox: bbox,
            single: isSingle,
            type: isSingle ? 'single' : 'copy',
        };
        return template;
    }

    updateFromObject(items, keepColor = false, pivotIndex = 0) {
        this.update(
            Template.objectToTemplate(items),
            keepColor, pivotIndex, 'normal'
        );
    }

    static _fromGroup(defs, group) {
        const subDefs = [];
        for (const item of group.children) {
            if (item.className == 'Group') {
                Template._fromGroup(subDefs, item);
            } else {
                subDefs.push([item.data.x, item.data.y, item.data.stitchLength, item.definition.item.strokeColor.toCSS(true)]);
            }
        }
        defs.push([[group.data.x, group.data.y], subDefs]);
    }

    static _calculateBBox(defs, x, y) {
        let xmin = 1000000;
        let ymin = 1000000;
        let xmax = -1000000;
        let ymax = -1000000;
        for (const item of defs) {
            if (Array.isArray(item[0])) {
                const bbox = Template._calculateBBox(item[1], item[0][0], item[0][1]);
                xmin = Math.min(bbox[0] + x, xmin);
                ymin = Math.min(bbox[1] + y, ymin);
                xmax = Math.max(bbox[0] + bbox[2] - 1 + x, xmax);
                ymax = Math.max(bbox[1] + bbox[3] - 1 + y, ymax);
            } else {
                xmin = Math.min(item[0] + x, xmin);
                ymin = Math.min(item[1] + y, ymin);
                xmax = Math.max(item[0] + item[2] + x - 1, xmax);
                ymax = Math.max(item[1] + y, ymax);
            }
        }
        return [xmin, ymin, xmax - xmin + 1, ymax - ymin + 1];
    }

    static horizontalMirror(template) {
        const x = template.bbox[0];
        const mirrored = [];
        Template._horizontalMirror(template.defs, mirrored, x);
        const pivots = [];
        for (const p of template.pivots) {
            pivots.push([x - (p[0] - x), p[1], p[2]]);
        }
        const bbox = template.bbox;
        const t = {
            defs: mirrored,
            pivots: pivots,
            bbox: [bbox[0] - bbox[2], bbox[1], bbox[2], bbox[3]],
            single: template.single,
            type: template.type,
        };
        return t;
    }

    static _horizontalMirror(defs, mirrored, x) {
        for (const item of defs) {
            if (Array.isArray(item[0])) {
                const subMirrored = [];
                Template._horizontalMirror(item[1], subMirrored, 0);
                mirrored.push([[x - (item[0][0] - x), item[0][1]], subMirrored]);
            } else {
                mirrored.push([x - (item[0] - x) - item[2], item[1], item[2], item[3]]);
            }
        }
    }

    static verticalMirror(template) {
        const y = template.bbox[1];
        const mirrored = [];
        Template._verticalMirror(template.defs, mirrored, y);
        const pivots = [];
        for (const p of template.pivots) {
            pivots.push([p[0], y - (p[1] - y), p[2]]);
        }
        const bbox = template.bbox;
        const t = {
            defs: mirrored,
            pivots: pivots,
            bbox: [bbox[0], bbox[1] - bbox[3] + 1, bbox[2], bbox[3]],
            single: template.single,
            type: template.type,
        };
        return t;
    }

    static _verticalMirror(defs, mirrored, y) {
        for (const item of defs) {
            if (Array.isArray(item[0])) {
                const subMirrored = [];
                Template._verticalMirror(item[1], subMirrored, 0);
                mirrored.push([[item[0][0], y - (item[0][1] - y)], subMirrored]);
            } else {
                mirrored.push([item[0], y - (item[1] - y), item[2], item[3]]);
            }
        }
    }

    hvMirror() {
        const template = this.templateNormal;
        const hmirrored = [];
        const x = template.bbox[0];
        this._horizontalMirror(template.defs, hmirrored, x);
        const vmirrored = [];
        const y = template.bbox[1];
        this._verticalMirror(hmirrored.defs, vmirrored, y);
        const pivots = [];
        for (const p of template.pivots) {
            pivots.push([x - (p[0] - x), y - (p[1] - y), p[2]]);
        }

        // todo

    }

    _hvMirror() {
        for (const item of defs) {
            if (Array.isArray(item[0])) {
                const subMirrored = [];
                this._horizontalMirror(item[1], subMirrored, item[0][0]);
                mirrored.push([[x - (item[0][0] - x), item[0][1]], subMirrored]);
            } else {
                mirrored.push([x - (item[0] - x), item[1], item[2], item[3]]);
            }
        }
    }

    /**
     * Returns bounding box contains x, y, width and height.
     * @returns {array}
     */
    bbox() {
        return this.bboxData;
    }

    /// Checks this template is valid.
    isValid() {
        return this.template !== null;
    }

    /// Checks this template is single stitch.
    isSingle() {
        return this.single;
    }

    getType() {
        return this.type;
    }

    getSize() {
        const size = this.template.size;
        if (size) {
            return size;
        }
        return 1;
    }

    /// Returns length of the template.
    getSingleLength() {
        if (this.single) {
            return this.template.defs[0][2];
        } else {
            return 0;
        }
    }

    /// Returns wrapped template.
    getTemplate() {
        return this.template;
    }

    getNormalTemplate() {
        return this.templateNormal ? this.templateNormal : this.template;
    }

    isKeepColor() {
        return this.keepColor;
    }

    /// Returns number of pivot.
    pivotsCount() {
        if (this.pivots !== null) {
            return this.pivots.length;
        } else {
            return 0;
        }
    }

    /// Returns current index of the pivot.
    pivotGetIndex() {
        return this.pivotIndex;
    }

    /// Sets pivot index.
    pivotSetIndex(index) {
        if (0 <= index && index < this.pivotsCount()) {
            this.pivotIndex = index;
        }
    }

    /// Returns current pivot.
    pivot() {
        if (this.pivots !== null) {
            if (0 <= this.pivotIndex && this.pivotIndex < this.pivotsCount()) {
                return this.pivots[this.pivotIndex];
            }
        }
        return [0, 0, 0];
    }

    /// Moves to next pivot.
    nextPivot() {
        const count = this.pivotsCount();
        if (count > 0) {
            const index = this.pivotIndex >= count - 1 ? 0 : this.pivotIndex + 1;
            this.pivotIndex = index;
            return this.pivots[this.pivotIndex];
        } else {
            return [0, 0, 0];
        }
    }

    /// Moves to previous pivot.
    previousPivot() {
        const count = this.pivotsCount();
        if (count > 0) {
            const index = this.pivotIndex <= 0 ? count - 1 : this.pivotIndex - 1;
            this.pivotIndex = index;
            return this.pivots[this.pivotIndex];
        } else {
            return [0, 0, 0];
        }
    }
}

/// Template have to contain defs and pivots.
/// defs: [[x, y, length, color], ...]
/// Optionally, single and length value.
/// pivot: [x, y, right_side = 1]
/// bbox: [x, y, width, height]
export class TemplateGenerator {
    /**
     * Generates single stitch template.
     *
     * @param {number} length Length of the stitch to be generated, must be positive value.
     * @returns {array|null} Template.
     */
    static singleGen(length) {
        if (length > 0) {
            return {
                defs: [
                    [0, 0, length, 0],
                ],
                pivots: [
                    [0, 0, 0], [length - 1, 0, 1],
                ],
                bbox: [0, 0, length, 1],
                asGroup: false,
                single: true,
                size: length,
                type: 'single',
            };
        } else {
            return null;
        }
    }

    static XorV(type, totalRows, offsetStep = 1) {
        // V, reverseV, X
        const rows = totalRows - 2;
        const stitchDefs = [];
        const step = offsetStep;
        let stitchLength = 3;
        let row = 0;
        let offset = 0;
        // center for X, top or bottom for V
        stitchDefs.push([offset, row, stitchLength]);
        stitchLength += 2;
        row = 1;
        offset += step;
        if (type != 'reverseV') {
            // upper
            stitchDefs.push([-offset, -row, stitchLength]);
        }
        if (type != 'V') {
            // lower
            stitchDefs.push([-offset, row, stitchLength]);
        }
        row = 2;
        stitchLength = 3;
        offset += step;
        for (let n = 0; n < rows; n++) {
            if (type != 'reverseV') {
                // upper
                stitchDefs.push([-offset, -(row + n), stitchLength]);
                stitchDefs.push([offset, -(row + n), stitchLength]);
            }
            if (type != 'V') {
                // lower
                stitchDefs.push([-offset, row + n, stitchLength]);
                stitchDefs.push([offset, row + n, stitchLength]);
            }
            offset += step;
        }
        const pivots = [
            [0, 0, 0], [stitchLength, 0, 1],
        ];
        if (type != 'reverseV') {
            pivots.push([-(rows + 1), -(rows + 1), 0]);
            pivots.push([rows + 2 + 2, -(rows + 1), 1]);
        }
        if (type != 'V') {
            pivots.push([-(rows + 1), rows + 1, 0]);
            pivots.push([rows + 2 + 2, rows + 1, 1]);
        }
        const bbox = type == 'X' ?
            [-(totalRows - 1) * step, -(totalRows - 1), step * 2 + stitchLength, rows * 2 + 3] :
            type == 'V' ?
                [-(totalRows - 1) * step, -(totalRows - 1), step * 2 + stitchLength, rows + 2] :
                [-(totalRows - 1) * step, 0, step * 2 + stitchLength, rows + 2];
        const template = {
            defs: stitchDefs,
            pivots: pivots,
            bbox: bbox,
            asGroup: true,
            type: type,
            size: totalRows,
        };
        return template;
    }

    /**
     * Generates modoko template.
     *
     * @param {number} rows Number of rows in modoko, must be positive odd number >= 3.
     * @param {number} offsetStep Offset value of each step.
     * @returns {array|null} Template.
     */
    static Modoko(rows, offsetStep = 1) {
        if (rows == 3) {
            const template = {
                defs: [
                    [1, 0, 1, 0], [0, 1, 3, 0], [1, 2, 1, 0],
                ],
                pivots: [
                    [0, 1, 0], [1, 2, 0], [2, 1, 1], [1, 0, 0], [1, 1, 0],
                ],
                bbox: [0, 0, 3, 3],
                asGroup: true,
                type: 'modoko',
                size: 3,
            };
            return template;
        }
        // Kacyarazu
        if (rows == 5) {
            const template = {
                defs: [
                    [2, 0, 1, 0], [1, 1, 3, 0], [0, 2, 5, 0],
                    [1, 3, 3, 0], [2, 4, 1, 0],
                ],
                pivots: [
                    [0, 2, 0], [2, 4, 0], [4, 2, 1], [2, 0, 0], [2, 2, 0],
                ],
                bbox: [0, 0, 5, 5],
                asGroup: true,
                type: 'modoko',
                size: 5,
            };
            return template;
        }
        if (rows % 2 == 1 && rows >= 7) {
            const step = offsetStep;
            const halfRows = Math.floor(rows / 2);
            let offset = halfRows * step;
            let offsetRight = offset;
            const stitchDefs = [];
            let row = 0;
            let stitchLength = 1;
            for (; row < 3; row++) {
                stitchDefs.push([offset, row, stitchLength]);
                offset -= step;
                stitchLength += step + step;
            }
            offsetRight += step;
            stitchLength = 1 + step + step;
            for (; row < halfRows; row++) {
                stitchDefs.push([offset, row, 3]);
                offset -= step;
                stitchDefs.push([offsetRight, row, 3]);
                offsetRight += step;
            }
            const stepRowMax = rows - 3;
            for (; row < stepRowMax; row++) {
                stitchDefs.push([offset, row, 3]);
                offset += step;
                stitchDefs.push([offsetRight, row, 3]);
                offsetRight -= step;
            }
            stitchLength = 1 + step * 4;
            for (; row < rows; row++) {
                stitchDefs.push([offset, row, stitchLength]);
                offset += step;
                stitchLength -= step + step;
            }
            const pivots = [
                [0, halfRows, 0],
                [halfRows * step, rows - 1, 0],
                [rows * step - 1, halfRows, 1],
                [halfRows * step, 0, 0],
                // center pivot
                [halfRows * step, halfRows, 0],
            ];
            const template = {
                defs: stitchDefs,
                pivots: pivots,
                bbox: [0, 0, rows, rows],
                asGroup: true,
                type: 'modoko',
                size: rows,
            };
            return template;
        } else {
            return null;
        }
    }

    /**
     * Generates katako template.
     *
     * @param {number} rows Number of rows in katako.
     * @param {number} offsetStep Offset step for each rows.
     * @returns {array|null} Template.
     */
    static Katako(rows, offsetStep = 2) {
        if (rows == 3) {
            const template = {
                defs: [
                    [2, 0, 2, 0], [0, 1, 6, 0], [2, 2, 2, 0],
                ],
                pivots: [
                    [0, 1, 0], [2, 2, 0], [5, 1, 1], [2, 0, 0], [2, 1, 0],
                ],
                bbox: [0, 0, 3, 6],
                asGroup: true,
                type: 'katako',
                size: 3,
            };
            return template;
        }
        if (rows % 2 == 1 && rows >= 5) {
            const step = offsetStep;
            const halfRows = Math.floor(rows / 2);
            let offset = halfRows * step;
            let offsetRight = offset;
            const stitchDefs = [];
            let row = 0;
            stitchDefs.push([offset, row++, 2]);
            offset -= step;
            stitchDefs.push([offset, row++, 6]);
            offset -= step;
            offsetRight += step;
            for (; row < halfRows; row++) {
                stitchDefs.push([offset, row, 4]);
                offset -= step;
                stitchDefs.push([offsetRight, row, 4]);
                offsetRight += step;
            }
            const stepRowMax = rows - 2;
            for (; row < stepRowMax; row++) {
                stitchDefs.push([offset, row, 4]);
                offset += step;
                stitchDefs.push([offsetRight, row, 4]);
                offsetRight -= step;
            }
            stitchDefs.push([offset, row++, 6]);
            offset += step;
            stitchDefs.push([offset, row++, 2]);
            const pivots = [
                [0, halfRows, 0],
                [halfRows * step, rows - 1, 0],
                [rows * step - 1, halfRows, 1],
                [halfRows * step, 0, 0],
                // center pivot
                [halfRows * step, halfRows, 0],
            ];
            const template = {
                defs: stitchDefs,
                pivots: pivots,
                bbox: [0, 0, rows, rows * 2],
                asGroup: true,
                type: 'katako',
                size: rows,
            };
            return template;
        } else {
            return nulll;
        }
    }
}
