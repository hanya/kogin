
import { View } from "./view.js";

/**
 * Manages document bounds to shown in the SVG image.
 */
export class BoundsManager {
    /**
     * Constructor.
     *
     * @param {View} view
     * @param {Object} settings
     */
    constructor(view, settings) {
        this.arrows = [];
        this.view = view;
        this.gridManager = view.gridManager;
        this.dragStart = null;
        this.direction = null;
        this.settings = settings;

        // prepare arrow definition, width: 16, height: 12
        const arrow = new paper.Path([
            new paper.Point(-3, -6),
            new paper.Point(-8, 0),
            new paper.Point(-3, 6),

            new paper.Point(-3, 2),
            new paper.Point(3, 2),
            new paper.Point(3, 2),

            new paper.Point(3, 6),
            new paper.Point(8, 0),
            new paper.Point(3, -6),

            new paper.Point(3, -2),
            new paper.Point(-3, -2),
            new paper.Point(-3, -6),
        ]);
        const color = this.view.sashi.viewOption.cursorColor;
        arrow.strokeColor = color;
        arrow.fillColor = color;
        this.arrowDef = new paper.SymbolDefinition(arrow, true);
    }

    /**
     * Clears bounds.
     */
    clear() {
        this.direction = null;
        this.view.layerManager.clearControlLayer();
    }

    /**
     * Updates bounds.
     */
    update() {
        const settings = this.settings;
        this.arrows = [];
        const width = 30;
        const height = 30;
        const size = new paper.Size(width, height);

        const addArrow = (x, y, dx, dy) => {
            const arrow = {
                rect: new paper.Rectangle(new paper.Point(x, y), size),
                direction: [dx, dy],
            };
            this.arrows.push(arrow);
        }
        this.left = settings.boundsLeft;
        this.right = settings.boundsRight;
        this.top = settings.boundsTop;
        this.bottom = settings.boundsBottom;
        const p1 = this.gridManager.gridToPoint(this.left, this.top);
        const p2 = this.gridManager.gridToPoint(this.right, this.bottom);

        addArrow(p1.x - width, p1.y - height, -1, -1);
        addArrow(p1.x + (p2.x - p1.x) / 2, p1.y - height, 0, -1);
        addArrow(p2.x, p1.y - height, 1, -1);
        addArrow(p2.x, p1.y + (p2.y - p1.y) / 2, 1, 0);
        addArrow(p2.x, p2.y, 1, 1);
        addArrow(p1.x + (p2.x - p1.x) / 2, p2.y, 0, 1);
        addArrow(p1.x - width, p2.y, -1, 1);
        addArrow(p1.x - width, p1.y + (p2.y - p1.y) / 2, -1, 0);
    }

    /**
     * Check the point is starting of dragging.
     *
     * @param {paper.Point} point Cursor position to check.
     * @returns {boolean} `true` if the position is start of draggig, otherwise false.
     */
    isDragStart(point) {
        let found = false;
        for (const arrow of this.arrows) {
            if (arrow.rect.contains(point)) {
                this.direction = arrow.direction;
                this.dragStart = point;
                found = true;
                break;
            }
        }
        if (!found) {
            this.direction = null;
        }
        return this.direction != null;
    }

    /**
     * While dragging.
     *
     * @param {paper.Point} current Cursor position while dragging.
     * @returns
     */
    drag(current) {
        if (this.direction === null) {
            return;
        }
        let redraw = false;
        if (this.direction[0] != 0) {
            const dx = current.x - this.dragStart.x;
            const [dxg, _] = this.gridManager.pointToGrid(new paper.Point(dx, 0));
            if (this.direction[0] == -1) {
                // left side
                this.settings.boundsLeft = this.left + dxg;
            } else if (this.direction[0] == 1) {
                this.settings.boundsRight = this.right + dxg;
            }
            redraw = true;
        }
        if (this.direction[1] != 0) {
            const dy = current.y - this.dragStart.y;
            const [_, dyg] = this.gridManager.pointToGrid(new paper.Point(0, dy));
            if (this.direction[1] == -1) {
                // top
                this.settings.boundsTop = this.top + dyg;
            } else if (this.direction[1] == 1) {
                this.settings.boundsBottom = this.bottom + dyg;
            }
            redraw = true;
        }
        if (redraw) {
            this.drawOutputBounds(this.view);
        }
    }

    clearBounds(view, editMode) {
        if (editMode) {
            view.layerManager.clearControlLayer();
        } else {
            const layer = view.layerManager.getUILayer();
            const rect = layer.children['bounds'];
            if (rect) {
                rect.remove();
            }
        }
    }

    /**
     * Draws output bounds.
     *
     * @param {View} view View to draw bounds.
     */
    drawOutputBounds(view, editMode=true) {
        const viewModeOffset = 4;
        this.clearBounds(view, editMode);
        const settings = this.settings;
        const p1 = this.gridManager.gridToPoint(settings.boundsLeft, settings.boundsTop);
        const p2 = this.gridManager.gridToPoint(settings.boundsRight, settings.boundsBottom);
        if (editMode) {
            p1.x += 0.5;
            p1.y += 0.5;
            p2.x += 0.5;
            p2.y += 0.5;
        } else {
            p1.x -= viewModeOffset;
            p1.y -= viewModeOffset;
            p2.x += viewModeOffset;
            p2.y += viewModeOffset;
        }
        const rect = new paper.Path.Rectangle({
            from: p1, to: p2,
            name: 'bounds',
            strokeColor: editMode ?
                this.view.sashi.viewOption.selectionColor :
                this.view.sashi.viewOption.cursorColor,
        });
        const layer = editMode ?
            view.layerManager.getControlLayer() :
            view.layerManager.getUILayer();
        layer.addChild(rect);

        if (editMode) {
            const addArrow = (x, y, rotation) => {
                const a1 = this.arrowDef.place(new paper.Point(0, 0));
                layer.addChild(a1);
                a1.rotate(rotation);
                a1.translate(x, y);
            }
            addArrow(p1.x - 8, p1.y + (p2.y - p1.y) / 2, 0);
            addArrow(p2.x + 8, p1.y + (p2.y - p1.y) / 2, 0);
            addArrow(p1.x + (p2.x - p1.x) / 2, p1.y - 8, 90);
            addArrow(p1.x + (p2.x - p1.x) / 2, p2.y + 8, 90);
            addArrow(p1.x - 7, p1.y - 7, 45);
            addArrow(p2.x + 7, p1.y - 7, 135);
            addArrow(p2.x + 7, p2.y + 7, 45);
            addArrow(p1.x - 7, p2.y + 7, 135);
        }
    }
}
