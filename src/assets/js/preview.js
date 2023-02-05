
import { viewModeLineGrain, viewModeFillGrain,
    viewModeOverGrain, viewModeOverWarp,
    FillGrain, OverGrain, OverWarp } from "./mode.js";
import { Sashi } from "./sashi.js";

/**
 * View for preview which does not provide manipulation of the document.
 */
export class Preview {
    /**
     * Constructor.
     *
     * @param {Sashi} sashi Instance of sashi.
     * @param {Object} viewOption View options.
     */
    constructor(sashi, viewOption) {
        Object.defineProperties(this, {
            viewModeLineGrain: { value: viewModeLineGrain },
            viewModeFillGrain: { value: viewModeFillGrain },
            viewModeOverGrain: { value: viewModeOverGrain },
            viewModeOverWarp: { value: viewModeOverWarp },
        });
        const viewModes = new Map([
            [this.viewModeLineGrain, 'line-grain-tool'],
            [this.viewModeFillGrain, 'fill-grain-tool'],
            [this.viewModeOverGrain, 'over-grain-tool'],
            [this.viewModeOverWarp, 'over-warp-tool'],
        ]);
        Object.defineProperties(this, {
            viewModes: { value: viewModes },
        });

        /** @type {Sashi} */
        this.sashi = sashi;
        /** @type {GridManager} */
        this.gridManager = this.sashi.gridManager;
        this.layerManager = this.sashi.layerManager;
        this.viewMode = viewOption.viewMode;
    }

    /// Re-draws view.
    update() {
        this.sashi.project.view.draw();
    }

    updateUI() {
    }

    clear() {
        this.update();
    }

    fileNameChanged(fileName) {
    }

    modifiedStateChanged = (ev) => {
    }

    setViewMode(viewMode, force=false) {
        if (force || this.viewMode != viewMode) {
            this.viewMode = viewMode;
            this.sashi.viewOption.viewMode = viewMode;
            this.sashi.stitchManager.setViewMode(viewMode, force);
        }
    }

    cbGridChanged = () => {
        const MARGIN = 1.2;
        this.clearGrid();
        // set canvas size
        const [width, height] = this.gridManager.canvasSize();
        const canvasWidth = Math.floor(width * MARGIN);
        const canvasHeight = Math.floor(height * MARGIN);
        this.sashi.project.view.viewSize = new paper.Point(canvasWidth, canvasHeight);

        this.prepareGrid();
    }

    /// Shows grid or hide.
    gridShow(state) {
        if (state) {
            this.sashi.gridManager.show();
        } else {
            this.sashi.gridManager.hide();
        }
        this.update();
    }

    /// Clears grid layers.
    clearGrid = () => {
        this.layerManager.getLowerGridLayer().removeChildren();
        this.layerManager.getUpperGridLayer().removeChildren();
    }

    /// Prepares grid.
    prepareGrid = (originX=0, originY=0) => {
        const Point = paper.Point;
        this.clearGrid();
        const viewGrid = this.sashi.viewGrid;
        const lineColor = viewGrid.gridLineColor;
        const majorLineColor = viewGrid.gridMajorLineColor;
        const gridManager = this.gridManager;
        const gridLines = [];
        const gridHeight = viewGrid.gridHeight;
        const gridWidth = viewGrid.gridWidth;
        const majorGridFrequency = viewGrid.gridMajorLineFrequency;
        const canvasWidth = this.sashi.canvas.width;
        const canvasHeight = this.sashi.canvas.height;
        const xbase = originX + ((canvasWidth % 2) == 0 ? 0 : 0.5);
        const ybase = originY + ((canvasHeight % 2) == 0 ? 0.5 : 0);

        const vertCount = viewGrid.vertCount;
        const horiCount = viewGrid.horiCount;

        let majorGridCounter = 0;

        // vertical line
        const gridTotalHeight = vertCount * gridHeight + 1;
        const vertLine = new paper.Path.Line({
            from: [xbase, ybase],
            to: [xbase, canvasHeight],
            strokeColor: lineColor,
            strokeWidth: 1,
            strokeScaling: false,
            name: "_grid_vertline",
        });
        const vertMajorLine = vertLine.clone();
        vertMajorLine.name = "_grid_vertmajorline";
        vertMajorLine.style.strokeColor = majorLineColor;
        const vertDefinition = new paper.SymbolDefinition(vertLine, false);
        // fix position of each segments, to show clear grid
        vertLine.segments[0].point.y = ybase;
        vertLine.segments[1].point.y = gridTotalHeight;
        let vertMajorDefinition = new paper.SymbolDefinition(vertMajorLine, false);
        vertMajorLine.segments[0].point.y = ybase;
        vertMajorLine.segments[1].point.y = gridTotalHeight;

        for (let x = xbase, n = 0; n <= horiCount; x += gridWidth, n += 1) {
            if (majorGridCounter == 0) {
                let instance = vertMajorDefinition.place(new Point(x, 0));
                gridLines.push(instance);
            } else {
                let instance = vertDefinition.place(new Point(x, 0));
                gridLines.push(instance);
            }

            majorGridCounter += 1;
            if (majorGridCounter == majorGridFrequency) {
                majorGridCounter = 0;
            }
        }
        majorGridCounter = 0;

        // horizontal line
        const gridTotalWidth = horiCount * gridWidth + 1;
        const horiLine = new paper.Path.Line({
            from: [0, ybase],
            to: [canvasWidth, ybase],
            strokeColor: lineColor,
            strokeWidth: 1,
            strokeScaling: false,
            name: "_grid_horiline",
        });
        const horiMajorLine = horiLine.clone();
        horiMajorLine.name = "_grid_horimajorline";
        horiMajorLine.style.strokeColor = majorLineColor;
        const horiDefinition = new paper.SymbolDefinition(horiLine, false);
        // fix position of each segments
        horiLine.segments[0].point.x = xbase;
        horiLine.segments[1].point.x = gridTotalWidth;
        const horiMajorDefinition = new paper.SymbolDefinition(horiMajorLine, false);
        horiMajorLine.segments[0].point.x = xbase;
        horiMajorLine.segments[1].point.x = gridTotalWidth;

        for (let y = ybase, n = 0; n <= vertCount; y += gridHeight, n += 1) {
            if (majorGridCounter == 0) {
                const instance = horiMajorDefinition.place(new Point(0, y));
                gridLines.push(instance);
            } else {
                const instance = horiDefinition.place(new Point(0, y));
                gridLines.push(instance);
            }

            majorGridCounter += 1;
            if (majorGridCounter == majorGridFrequency) {
                majorGridCounter = 0;
            }
        }

        const group = new paper.Group(gridLines);
        const cloneGroup = group.clone();
        this.layerManager.getLowerGridLayer().addChild(group);
        this.layerManager.getUpperGridLayer().addChild(cloneGroup);
    }
}
