
import { View } from "./view.js";


export class CursorManager {
    /**
     * Constructor.
     * @param {View} view
     */
    constructor(view) {
        this.view = view;
        this.prepareCursors();
    }

    setCursorColor(color) {
        const layer = this.view.layerManager.getCursorLayer();
        for (const name of ['crosshair', '1to1', '1to2']) {
            const group = layer.children[name];
            for (const line of group.children) {
                line.strokeColor = color;
            }
        }
    }

    /// Changes visibility of cross hair cursor.
    crosshairSwitchVisible(new_state = null, oneToOne = null, oneToTwo = null) {
        if (new_state !== null) {
            this.view.sashi.viewOption.crosshair = new_state;
            this.view.layerManager.getCursor('crosshair').visible = new_state;
        }
        if (oneToOne !== null) {
            this.view.sashi.viewOption.oneToOne = oneToOne;
            this.view.layerManager.getCursor('1to1').visible = oneToOne;
        }
        if (oneToTwo !== null) {
            this.view.sashi.viewOption.oneToTwo = oneToTwo;
            this.view.layerManager.getCursor('1to2').visible = oneToTwo;
        }
        // todo, update tool status
        this.view.update();
    }

    /// Places cross hair cursor.
    crosshairSetPosition(point) {
        if (!(this.view.sashi.viewOption.crosshair || this.view.sashi.viewOption.oneToOne || this.view.sashi.viewOption.oneToTwo)) {
            return false;
        }
        const gridPoint = this.view.gridManager.pointToGridCenterPoint(point);
        const layer = this.view.layerManager.getCursorLayer();
        const group = layer.firstChild;
        if (this.view.sashi.viewOption.crosshair) {
            const vertLine = group.firstChild;
            const horiLine = vertLine.nextSibling;
            const bounds = this.view.sashi.project.view.bounds;
            vertLine.segments[0].point.x = gridPoint.x + 0.5;
            vertLine.segments[0].point.y = bounds.y + 0.5;
            vertLine.segments[1].point.x = gridPoint.x + 0.5;
            vertLine.segments[1].point.y = bounds.y + bounds.height + 0.5;
            horiLine.segments[0].point.x = bounds.x + 0.5;
            horiLine.segments[0].point.y = gridPoint.y + 0.5;
            horiLine.segments[1].point.x = bounds.x + bounds.width + 0.5;
            horiLine.segments[1].point.y = gridPoint.y + 0.5;
        }

        if (this.view.sashi.viewOption.oneToOne) {
            const oneToOne = group.nextSibling;
            oneToOne.position = gridPoint;
        }
        if (this.view.sashi.viewOption.oneToTwo) {
            const oneToTwo = group.nextSibling.nextSibling;
            oneToTwo.position = gridPoint;
        }
        return true;
    }

    clearCursors() {
        const layer = this.view.layerManager.getCursorLayer();
        layer.removeChildren();
    }

    /// Prepares cross hair cursors.
    prepareCursors() {
        const layer = this.view.layerManager.getCursorLayer();
        const color = this.view.sashi.viewOption.cursorColor;
        // add crosshair cursor, todo, move them
        const vertLine = new paper.Path.Line({
            from: [0, 0],
            to: [0, 0],
            strokeColor: this.view.sashi.viewOption.cursorColor,
            strokeWidth: 1,
            strokeScaling: false,
            visible: true,
            name: "CursorVerticalLine",
        });
        const horiLine = new paper.Path.Line({
            from: [0, 0],
            to: [0, 0],
            strokeColor: color,
            strokeWidth: 1,
            strokeScaling: false,
            visible: true,
            name: "CursorHorizontalLIne",
        });

        const crosshairGroup = new paper.Group([vertLine, horiLine], false);
        crosshairGroup.visible = this.view.sashi.viewOption.crosshair;
        crosshairGroup.name = 'crosshair';
        layer.addChild(crosshairGroup);
        this.view.toolManager.setActive('crosshair-tool', this.view.sashi.viewOption.crosshair);

        // 1to1
        const gridWidth = this.view.sashi.viewGrid.gridWidth;
        const gridHeight = this.view.sashi.viewGrid.gridHeight;
        const count = 10;
        const ltrb = new paper.Path.Line({
            from: [- gridWidth * count, - gridHeight * count],
            to: [gridWidth * count, gridHeight * count],
            strokeColor: color,
            strokeWidth: 1,
            strokeScaling: false,
            visible: true,
            name: "CursorLeftTopToRightBottom",
        });
        const lbrt = new paper.Path.Line({
            from: [- gridWidth * count, gridHeight * count],
            to: [gridWidth * count, - gridHeight * count],
            strokeColor: color,
            strokeWidth: 1,
            strokeScaling: false,
            visible: true,
            name: "CursorLeftBottomToRightTop",
        });
        const oneToOne = new paper.Group([ltrb, lbrt], false);
        oneToOne.visible = this.view.sashi.viewOption.oneToOne;
        oneToOne.name = '1to1';
        layer.addChild(oneToOne);

        // 1to2
        const count2 = 20;
        const ltrb2 = new paper.Path.Line({
            from: [- gridWidth * count2, - gridHeight * count],
            to: [gridWidth * count2, gridHeight * count],
            strokeColor: color,
            strokeWidth: 0.7,
            strokeScaling: false,
            visible: true,
            name: "CursorLeftTopToRightBottom2",
        });
        const lbrt2 = new paper.Path.Line({
            from: [- gridWidth * count2, gridHeight * count],
            to: [gridWidth * count2, - gridHeight * count],
            strokeColor: this.view.sashi.viewOption.cursorColor,
            strokeWidth: 0.7,
            strokeScaling: false,
            visible: true,
            name: "CursorLeftBottomToRightTop2",
        });
        const oneToTwo = new paper.Group([ltrb2, lbrt2], false);
        oneToTwo.position = new paper.Point(0.5, 0.5);
        oneToTwo.visible = this.view.sashi.viewOption.oneToTwo;
        oneToTwo.name = '1to2';
        layer.addChild(oneToTwo);

        layer.visible = true;
    }
}
