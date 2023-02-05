
export const viewModeLineGrain = 0;
export const viewModeFillGrain = 1;
export const viewModeOverGrain = 2;
export const viewModeOverWarp = 3;


/**
 * Calculates position on the grid according to coordinate.
 */
export class PositionCalculator {
    constructor(op, strokeCap, name) {
        this.name = name;
        this.update(op.gridWidth, op.gridHeight, op.gridLineWidth);
        this.strokeWidth = 0;
        this.strokeCap = strokeCap;
    }

    /// Updates size.
    update(gridWidth, gridHeight, gridLineWidth) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.gridLineWidth = gridLineWidth;
    }

    /// Calculates start and end points.
    calc(x, y, length, pixelCorrection = true) {
        return [new paper.Point(0, 0), new paper.Point(0, 0)];
    }

    /// Converts from logical coordinate of grid to physical coordinate.
    gridToPoint = (x, y) => {
        return new paper.Point(
            Math.floor(x * this.gridWidth),
            Math.floor(y * this.gridHeight)
        );
    }

    /// Converts from grid coordindate to grid vertical center point.
    gridToGridVertCenterPoint = (x, y) => {
        const point = this.gridToPoint(x, y);
        point.y += this.gridHeight / 2;
        return point;
    }

    /// Converts from grid coordinate to grid center point.
    gridToGridCenterPoint = (x, y) => {
        const point = this.gridToPoint(x, y);
        return this.toGridCenter(point);
    }

    /// Converts left top point to center point of the grid.
    toGridCenter = (point) => {
        point.x += this.gridWidth / 2;
        point.y += this.gridHeight / 2;
        return point;
    }

    /**
     * Choose calculator to match to view mode.
     *
     * @param {number} viewMode
     * @param {number} gridWidth
     * @param {number} gridHeight
     * @param {number} gridLineWidth
     * @param {number} overGrainLineWidth
     * @param {number} overWarpLineWidth
     * @param {number} lineGrainLineWidth
     * @returns {PositionCalculator}
     */
    static choose(op) {
        switch (op.viewMode) {
            case viewModeLineGrain:
                return new LineGrain(op);
            case viewModeFillGrain:
                return new FillGrain(op);
            case viewModeOverGrain:
                return new OverGrain(op);
            case viewModeOverWarp:
                return new OverWarp(op);
            default:
                return null;
        }
    }
}

export class LineGrain extends PositionCalculator {
    constructor(op) {
        super(op, 'butt', 'LineGrain');
        this.strokeWidth = op.lineGrainLineWidth;
    }

    calc(x, y, length, pixelCorrection = true) {
        const point1 = this.gridToGridVertCenterPoint(x, y);
        if (pixelCorrection) {
            point1.y += 0.5;
        }
        const point2 = point1.clone();
        point1.x += this.gridLineWidth;
        point2.x += this.gridWidth * length;
        return [point1, point2]
    }
}

export class FillGrain extends PositionCalculator {
    constructor(op) {
        super(op, 'butt', 'FillGrain');
        this.strokeWidth = this.gridHeight - this.gridLineWidth;
    }

    calc(x, y, length, pixelCorrection = true) {
        const point1 = this.gridToGridVertCenterPoint(x, y);
        if (pixelCorrection) {
            point1.y += 0.5;
        }
        const point2 = point1.clone();
        point1.x += this.gridLineWidth;
        point2.x += this.gridWidth * length;
        return [point1, point2];
    }
}

export class OverGrain extends PositionCalculator {
    constructor(op) {
        super(op, 'round', 'OverGrain');
        this.strokeWidth = op.overGrainLineWidth;
        this.offset = op.overGrainOffsetRatio * this.gridWidth;
    }

    calc(x, y, length, pixelCorrection = true) {
        const point1 = this.gridToGridVertCenterPoint(x, y);
        if (pixelCorrection) {
            point1.y += 0.5;
        }
        const point2 = this.gridToGridVertCenterPoint(x + length, y);
        point2.y = point1.y;
        point1.x -= this.offset
        point2.x += this.offset + this.gridLineWidth;
        return [point1, point2];
    }
}

export class OverWarp extends PositionCalculator {
    constructor(op) {
        super(op, 'round', 'OverWarp');
        this.strokeWidth = op.overWarpLineWidth;
        this.offset = op.overWarpOffsetRatio * this.gridWidth;
    }

    calc(x, y, length, pixelCorrection = true) {
        const point1 = this.gridToGridCenterPoint(x, y);
        if (pixelCorrection) {
            point1.y += 0.5;
        }
        const point2 = this.gridToGridCenterPoint(x + length, y);
        point2.y = point1.y;
        point1.x += this.offset;
        point2.x += - this.offset + this.gridLineWidth;
        return [point1, point2];
    }
}
