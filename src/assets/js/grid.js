
import { GridOption, GridOptionForPrinting, GridOptionForView, Metadata,
         OutputOption, OutputOptionForDisplay, OutputOptionForPrinting,
         ViewOption } from "./option.js";


/// Manages grid related things.
export class GridManager {
    constructor(layerManager, gridOption) {
        this.defaultSettings = GridOptionForView;
        this.readSettings(gridOption);
        this.layerManager = layerManager;
    }

    setGridChangedListener(cbGridChanged) {
        this.cbGridChanged = cbGridChanged;
    }

    readSettings(settings) {
        Object.assign(this, settings);
    }

    /// Returns grid horizontal and vertical count.
    getGridCount() {
        return [this.horiCount, this.vertCount];
    }

    /// Sets grid count.
    setGridCount(hori, vert) {
        this.horiCount = hori;
        this.vertCount = vert;

        if (this.cbGridChanged) {
            this.cbGridChanged();
        }
    }

    getGridSize() {
        return [this.gridWidth, this.gridHeight];
    }

    setGridSize(width, height) {
        this.gridWidth = width;
        this.gridHeight = height;
    }

    /// Checks grid is shown.
    isVisible() {
        return this.showGrid;
    }

    /// Shows grid.
    show() {
        const overGrid = this.overGrid;
        this.layerManager.getLowerGridLayer().visible = !overGrid;
        this.layerManager.getUpperGridLayer().visible = overGrid;
        this.showGrid = true;
    }

    /// Hides grid.
    hide() {
        this.layerManager.getLowerGridLayer().visible = false;
        this.layerManager.getUpperGridLayer().visible = false;
        this.showGrid = false;
    }

    /// Switches grid visibility.
    switchVisible() {
        if (this.layerManager.getLowerGridLayer().visible ||
            this.layerManager.getUpperGridLayer().visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /// Returns half of grid height.
    getVertCenterOffset() {
        return this.gridHeight / 2;
    }

    /// Returns half of grid width.
    getHoriCenterOffset() {
        return this.gridWidth / 2;
    }

    /// Returns total dimension of the canvas.
    canvasSize() {
        const width = this.horiCount * this.gridWidth + this.gridLineWidth;
        const height = this.vertCount * this.gridHeight + this.gridLineWidth;
        return [width, height];
    }

    /// Converts from physical coordinate to logical coordinate of grid.
    pointToGrid = (point) => {
        return [Math.floor(point.x / this.gridWidth), Math.floor(point.y / this.gridHeight)];
    }

    /// Converts from logical coordinate of grid to physical coordinate.
    gridToPoint = (x, y) => {
        return new paper.Point(Math.floor(x * this.gridWidth), Math.floor(y * this.gridHeight));
    }

    /// Converts from physical coordinate to logical coordinate of grid near the specified point.
    pointToGridPoint = (point) => {
        return new paper.Point(
            Math.floor(point.x / this.gridWidth) * this.gridWidth,
            Math.floor(point.y / this.gridHeight) * this.gridHeight
        );
    }

    /// Converts left top point into grid center point.
    toGridCenter = (point) => {
        point.x += this.gridWidth / 2;
        point.y += this.gridHeight / 2;
        return point;
    }

    /// Converts point to center point of the grid.
    pointToGridCenterPoint = (point) => {
        const gridPoint = this.pointToGridPoint(point);
        return this.toGridCenter(gridPoint);
    }

    /// Converts grid to center point of the grid.
    gridToGridCenterPoint = (x, y) => {
        const point = this.gridToPoint(x, y);
        return this.toGridCenter(point);
    }

    /// Converts grid to point of vertical center.
    gridToGridVertCenterPoint = (x, y) => {
        const point = this.gridToPoint(x, y);
        point.y += this.gridHeight / 2;
        return point;
    }

    gridPositionToPosition(x, y) {
        switch (this.options.viewMode) {
            case this.viewModeLineGrain:
                break;
            case this.viewModeFillGrain:

                break;
            case this.viewModeOverGrain:

                break;
            case this.viewModeOverWarp:

                break;
            default:
                return new paper.Point(0, 0);
        }
    }

    /// Calculates distance between two points as resulting grid coordinate.
    distanceXY(p1, p2) {
        const gp1 = this.pointToGrid(p1);
        const gp2 = this.pointToGrid(p2);
        return [gp2[0] - gp1[0], gp2[1] - gp1[1]];
    }

    getFullSize() {
        return new paper.Size(
            this.horiCount * this.gridWidth,
            this.vertCount * this.gridHeight);
    }
}
