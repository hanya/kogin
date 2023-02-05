
import { WriterBase } from "./filter.js";

// for tauri
let mpFontData = null;
let mpFontPath = null;


export class PDFExport extends WriterBase {
    constructor(sashi, options) {
        super(sashi);
        this.options = options;
        this.mmToPtCoef = 72. / 25.4;

        this.op = this.readOptions(this.sashi, true);
        // override useOutputBounds
        this.op.useOutputBounds = this.options.useOutputBounds;
        this.layerManager = this.sashi.layerManager;
        this.stitchManager = this.sashi.stitchManager;

        // bounding box of stitches, bounds applied
        this.bboxRect = this._calculateGroupGridBoundingBox(this.layerManager.getUserLayers());
        // grid rectangle including both bounds and margin
        this.gridRect = this._getGridBoundingBox(this.bboxRect);

        this.originX = this.gridRect.x;
        this.originY = this.gridRect.y;

        this.colors = new Map();
    }

    getContentSize(pageWidth=null, pageHeight=null) {
        if (!pageWidth || !pageHeight) {
            [pageWidth, pageHeight] = this.getPageSize(this.options);
        }
        return [
            pageWidth - this.mmToPt(this.options.leftMargin) - this.mmToPt(this.options.rightMargin),
            pageHeight - this.mmToPt(this.options.topMargin) - this.mmToPt(this.options.bottomMargin),
        ];
    }

    getCountPages() {
        const [contentWidth, contentHeight] = this.getContentSize();
        return [
            Math.ceil(this.mmToPt(this.gridRect.width * this.op.gridWidth) / contentWidth),
            Math.ceil(this.mmToPt(this.gridRect.height * this.op.gridHeight) / contentHeight),
        ];
    }

    export(cbGenerated) {
        const countPages = this.getCountPages();
        if (countPages[0] <= 0 || countPages[1] <= 0) {
            throw 'Margin is too wide.';
        }
        this.pageRows = countPages[1];
        this.pageColumns = countPages[0];
        this.lineCap = this.getLineCap(this.op.posCalc.strokeCap);
        this.stitchWidth = this.mmToPt(this.getLineWidth(this.op.viewMode));

        PDFLib.PDFDocument.create()
            .then(async (doc) => {
                this.doc = doc;
                await this.doc.registerFontkit(fontkit);
                this.helveticaFont = await this.doc.embedFont(
                    PDFLib.StandardFonts.Helvetica);
                this.font = this.helveticaFont;

                if (window.__TAURI__) {
                    if (this.options.multibyteFont) {
                        if (!mpFontData || mpFontPath != this.options.multibyteFont) {
                            const data = await window.__TAURI__.invoke('file_read_binary',
                                { name: this.options.multibyteFont }
                            );
                            mpFontData = new Uint8Array(data)
                            mpFontPath = this.options.multibyteFont;
                        }
                        this.MpFont = await this.doc.embedFont(mpFontData, { subset: true });
                    }
                } else {
                    try {
                        const url = "http://mplus-webfonts.sourceforge.jp/mplus-2m-thin.woff";
                        const fontBytes = await fetch(url).then(res => res.arrayBuffer());
                        this.MpFont = await this.doc.embedFont(fontBytes, { subset: true });
                    } catch (e) {
                        console.log(e);
                    }
                }

                this.page = null;
                this.rgb = PDFLib.rgb;
                this.lineCapStyleRound = PDFLib.LineCapStyle.Round;

                if (this.sashi.metadata.title) {
                    this.doc.setTitle(this.sashi.metadata.title);
                } else if (this.sashi.metadata['title-en']) {
                    this.doc.setTitle(this.sashi.metadata['title-en']);
                }
                if (this.sashi.metadata.author) {
                    this.doc.setAuthor(this.sashi.metadata.author);
                }

                if (this.sashi.metadata.keyword) {
                    const words = this.sashi.metadata.keyword.split(',');
                    const keys = Array.from(words, (element) => element.trim());
                    this.doc.setKeywords(keys);
                }

                this.generate(this.options);

                cbGenerated(this);
            });
    }

    mmToPt = (v) => {
        return v * this.mmToPtCoef;
    }

    toY = (y) => {
        return this.pageHeight - y;
    }

    output = (callback) => {
        this.doc.save().then((data) => {
            callback(data);
        });
    }

    outputAsBase64 = (callback) => {
        this.doc.saveAsBase64().then((data) => {
            callback(data);
        });
    }

    getPageSize(options) {
        const pageSize = PDFLib.PageSizes[options.pageSize];
        if (options.landscape) {
            return [pageSize[1], pageSize[0]];
        } else {
            return pageSize;
        }
    }

    generate = (options) => {
        this.pageSize = this.getPageSize(options);
        const contentSize = this.getContentSize();
        this.contentPageWidth = Math.floor(contentSize[0] / this.mmToPt(this.op.gridWidth));
        this.contentPageHeight = Math.floor(contentSize[1] / this.mmToPt(this.op.gridHeight));
        this.pageRow = 0;
        this.pageColumn = 0;
        for (; this.pageRow < this.pageRows; this.pageRow += 1) {
            for (; this.pageColumn < this.pageColumns; this.pageColumn += 1) {
                this.writePage();
            }
            this.pageColumn = 0;
        }

        if (!(this.pageRows == 1 && this.pageColumns == 1)) {
            this.writeDescriptionPage();
        }
    }

    addPage() {
        this.page = this.doc.addPage(this.pageSize);
        this.page.setFont(this.helveticaFont);
        const size = this.page.getSize();
        this.pageWidth = size.width;
        this.pageHeight = size.height;
    }

    writeDescriptionPage() {
        this.addPage();

        this.addTitleIfRequired();
        this.addPageOrdering();
    }

    addPageOrdering() {
        const cellWidth = this.mmToPt(10);
        const cellHeight = this.mmToPt(14);
        const color = this.rgb(0, 0, 0);

        const startX = this.mmToPt(this.options.leftMargin);
        let y = this.toY(this.mmToPt(this.options.topMargin)) - 40;
        let x = startX;

        for (let row = 0; row < this.pageRows; row++) {
            for (let column = 0; column < this.pageColumns; column++) {
                this.page.drawRectangle({
                    x: x,
                    y: y,
                    width: cellWidth,
                    height: cellHeight,
                    borderWidth: 1,
                    borderColor: color,
                });
                const pageNumber = (row * this.pageColumns + column + 1).toString();
                const textWidth = this.font.widthOfTextAtSize(pageNumber, 10);
                this.page.drawText(
                    pageNumber,
                    {
                        x: x + cellWidth / 2 - textWidth / 2,
                        y: y + cellHeight / 2,
                        color: color,
                        size: 10,
                    }
                );
                x += cellWidth;
            }
            x = startX;
            y -= cellHeight;
        }
    }

    writePage() {
        this.addPage();

        const startX = this.pageColumn * this.contentPageWidth;
        const startY = this.pageRow * this.contentPageHeight;
        const width = this.pageColumn != this.pageColumns - 1 && !(this.pageRows == 1 && this.pageColumns == 1) ?
            this.contentPageWidth : this.gridRect.width % this.contentPageWidth;
        const height = this.pageRow != this.pageRows - 1 ?
            this.contentPageHeight : this.gridRect.height % this.contentPageHeight;

        // centering if only a page in the pattern
        this.gridStartX = this.pageRows == 1 && this.pageColumns == 1 ?
            (this.pageWidth - this.mmToPt(width * this.op.gridWidth)) / 2 :
            this.mmToPt(this.options.leftMargin);
        this.gridStartY = this.toY(this.mmToPt(this.options.topMargin));
        this.gridEndX = this.gridStartX + this.mmToPt(width * this.op.gridWidth);
        this.gridEndY = this.gridStartY - this.mmToPt(height * this.op.gridHeight);

        // under grid
        if (this.op.showGrid && !this.op.overGrid) {
            this.addGrid(startX, startY, width, height);
        }

        // stitches
        this.writeElements(startX, startY, width, height);

        // over grid
        if (this.op.showGrid && this.op.overGrid) {
            this.addGrid(startX, startY, width, height);
        }

        if (!(this.pageColumns == 1 && this.pageRows == 1)) {
            this.addPageNumber();
        }

        this.addTitleIfRequired();

        if (this.op.showCopyright && this.sashi.metadata.copyright) {
            this.addCopyright(this.sashi.metadata.copyright);
        }
    }

    writeElements(startX, startY, width, height) {
        const {
            clip,
            closePath,
            endPath,
            lineTo,
            moveTo,
            popGraphicsState,
            pushGraphicsState,
        } = PDFLib;

        const ops = [
            pushGraphicsState(),
            // clipping
            moveTo(
                this.gridStartX + (this.pageColumn == 0 ? this.mmToPt(this.op.gridWidth * this.op.leftMargin) : 0),
                this.gridStartY - (this.pageRow == 0 ? this.mmToPt(this.op.gridHeight * this.op.topMargin) : 0)
            ),
            lineTo(
                this.gridEndX - (this.pageColumn == this.pageColumns - 1 ? this.mmToPt(this.op.gridWidth * this.op.rightMargin) : 0),
                this.gridStartY - (this.pageRow == 0 ? this.mmToPt(this.op.gridHeight * this.op.topMargin) : 0)
            ),
            lineTo(
                this.gridEndX - (this.pageColumn == this.pageColumns - 1 ? this.mmToPt(this.op.gridWidth * this.op.rightMargin) : 0),
                this.gridEndY + (this.pageRow == this.pageRows - 1 ? this.mmToPt(this.op.gridHeight * this.op.bottomMargin) : 0)
            ),
            lineTo(
                this.gridStartX + (this.pageColumn == 0 ? this.mmToPt(this.op.gridWidth * this.op.leftMargin) : 0),
                this.gridEndY + (this.pageRow == this.pageRows - 1 ? this.mmToPt(this.op.gridHeight * this.op.bottomMargin) : 0)
            ),
            closePath(),
            clip(),
            endPath(),
        ];
        this.page.pushOperators.apply(this.page, ops);

        for (const layer of this.layerManager.getUserLayers()) {
            this.writeGroup(layer, 0, 0, startX, startY, width, height);
        }

        this.page.pushOperators.apply(this.page, [popGraphicsState()]);
    }

    inRange(x, y, length, startX, startY, width, height) {
        if (startY <= y && y <= startY + height - 1) {
            if (startX <= x && x <= startX + width - 1) {
                return true;
            } else if (x <= startX && startX <= x + length) {
                return true;
            }
        }
        return false;
    }

    writeGroup(group, offsetX, offsetY, startX, startY, width, height) {
        const {
            drawLine,
        } = PDFLib;

        const lineCap = this.lineCap;
        let ops = [];
        const addOps = () => {
            if (ops.length > 0) {
                this.page.pushOperators.apply(this.page, ops);
                ops = [];
            }
        }

        for (const child of group.children) {
            switch (child.className) {
                case 'Group': {
                    this.writeGroup(child, offsetX + child.data.x, offsetY + child.data.y,
                        startX, startY, width, height);
                    break;
                }
                case 'SymbolItem': {
                    const hexColor = child.definition.item.strokeColor.toCSS(true);
                    const color = this.getColor(hexColor);

                    const x = offsetX + child.data.x - this.originX;
                    const y = offsetY + child.data.y - this.originY;

                    if (!this.inRange(x, y, child.data.stitchLength, startX, startY, width, height)) {
                        continue;
                    }
                    const [startPoint, endPoint] = this.op.posCalc.calc(
                        x - startX, y - startY, child.data.stitchLength, false);

                    const start = {
                        x: this.gridStartX + this.mmToPt(startPoint.x),
                        y: this.gridStartY - this.mmToPt(startPoint.y),
                    };
                    const end = {
                        x: this.gridStartX + this.mmToPt(endPoint.x),
                        y: this.gridStartY - this.mmToPt(endPoint.y),
                    };

                    ops.push(...drawLine({
                        start: start,
                        end: end,
                        thickness: this.stitchWidth,
                        color: color,
                        dashArray: undefined,
                        dashPhase: undefined,
                        lineCap: lineCap,
                    }));
                    break;
                }
            }
        }
        addOps();
    }

    addTitleIfRequired() {
        if (this.op.showTitle) {
            const lang = navigator.language;
            if (lang == 'ja' || lang == 'ja_JP') {
                if (this.sashi.metadata.title) {
                    this.addTitle(this.sashi.metadata.title);
                }
            } else {
                if (this.sashi.metadata['title-en']) {
                    this.addTitle(this.sashi.metadata['title-en']);
                }
            }
        }
    }

    addTitle(s) {
        this.writeLine(s, this.gridStartX, this.gridStartY + 13, 10);
    }

    addCopyright(s) {
        this.writeLine(s,
            this.pageWidth - this.mmToPt(this.options.rightMargin),
            this.gridEndY - 17, 7, 'right');
    }

    writeLine(s, x, startY, fontSize, align='left') {
        const color = this.rgb(0, 0, 0);
        const spans = this.splitTextToSpan(s);
        if (align == 'left') {
            for (const span of spans) {
                const spanText = s.substring(span.start, span.start + span.len);
                const spanWidth = span.font.widthOfTextAtSize(spanText, fontSize);
                this.page.drawText(
                    spanText,
                    {
                        x: x,
                        y: startY,
                        color: color,
                        size: fontSize,
                        font: span.font,
                    }
                );
                x += spanWidth;
            }
        } else {
            for (let n = spans.length - 1; n >= 0; n--) {
                const span = spans[n];
                const spanText = s.substring(span.start, span.start + span.len);
                const spanWidth = span.font.widthOfTextAtSize(spanText, fontSize);
                this.page.drawText(
                    spanText,
                    {
                        x: x - spanWidth,
                        y: startY,
                        color: color,
                        size: fontSize,
                        font: span.font,
                    }
                );
                x -= spanWidth;
            }
        }
    }

    addPageNumber() {
        const pageNumber = (this.pageRow * this.pageColumns + this.pageColumn + 1).toString();
        const pageNumberWidth = this.font.widthOfTextAtSize(pageNumber, 10);
        this.page.drawText(
            pageNumber,
            {
                x: 25,
                y: 20,
                color: this.rgb(0, 0, 0),
                size: 10,
            }
        );
    }

    addGrid(startX, startY, width, height) {
        const {
            drawLine,
            popGraphicsState,
            pushGraphicsState,
        } = PDFLib;

        const ops = [];
        this.page.pushOperators.apply(this.page, [pushGraphicsState()]);

        const gridWidth = this.op.gridWidth;
        const gridHeight = this.op.gridHeight;

        if (gridWidth <= 0 || gridHeight <= 0 || width <= 0 || height <= 0) {
            return;
        }

        const showGridMajorLine = this.op.showGridMajorLine;
        const majorFrequency = this.op.gridMajorLineFrequency;
        const showGridFrame = this.op.showGridFrame;

        const gridLineWidth = this.mmToPt(this.op.gridLineWidth);
        const gridLineColor = this.colorToRGB(this.op.gridLineColor);
        const gridMajorLineColor = this.colorToRGB(this.op.gridMajorLineColor);
        const gridLineCap = PDFLib.LineCapStyle.Butt;

        const {
            gridStartX, gridStartY, gridEndX, gridEndY,
        } = this;
        const lineEndY = height * gridHeight;

        const horiLineCount = height;
        let majorNumber = this.pageRow == 0 ?
            this.op.gridMajorVertOffset :
            majorFrequency - ((startY - this.op.gridMajorVertOffset) % majorFrequency);

        // horizontal lines
        for (let y = 0, lineCount = 0; y <= lineEndY; y += gridHeight, lineCount += 1) {
            const ypt = gridStartY - this.mmToPt(y);
            const color =
                (lineCount == majorNumber) ||
                (showGridFrame &&
                    ((this.pageRow == 0 && lineCount == 0) ||
                    (this.pageRow == this.pageRows - 1 && horiLineCount <= lineCount))) ?
                gridMajorLineColor : gridLineColor;

            ops.push(...drawLine({
                start: { x: gridStartX, y: ypt },
                end: { x: gridEndX, y: ypt },
                thickness: gridLineWidth,
                color: color,
                dashArray: undefined,
                dashPhase: undefined,
                lineCap: gridLineCap,
            }));
            if (lineCount == majorNumber) {
                majorNumber += majorFrequency;
            }
        }

        const lineEndX = width * gridWidth;

        const vertLineCount = width;
        majorNumber = this.pageColumn == 0 ?
            this.op.gridMajorHoriOffset :
            majorFrequency - ((startX - this.op.gridMajorHoriOffset) % majorFrequency);
        // vertical lines
        for (let x = 0, lineCount = 0; x <= lineEndX; x += gridWidth, lineCount += 1) {
            const xpt = gridStartX + this.mmToPt(x);
            const color =
                (lineCount == majorNumber) ||
                (showGridFrame &&
                    ((this.pageColumn == 0 && lineCount == 0) ||
                    (this.pageColumn == this.pageColumns - 1 && vertLineCount <= lineCount))) ?
                gridMajorLineColor : gridLineColor;

            ops.push(...drawLine({
                start: { x: xpt, y: gridStartY },
                end: { x: xpt, y: gridEndY },
                thickness: gridLineWidth,
                color: color,
                dashArray: undefined,
                dashPhase: undefined,
                lineCap: gridLineCap,
            }));
            if (lineCount == majorNumber) {
                majorNumber += majorFrequency;
            }
        }

        this.page.pushOperators.apply(this.page, ops);
        this.page.pushOperators.apply(this.page, [popGraphicsState()]);

        // numbering
        if (this.options.gridNumber) {
            const numberingSize = 7;
            const numberingColor = this.rgb(0, 0, 0);
            const numberingFrequency = 5;
            const vertOffset = gridHeight / 2;

            let majorNumber = this.pageRow == 0 ?
                1 : (Math.floor(startY / numberingFrequency) + 1) * numberingFrequency;

            let numberingStartY = this.pageRow == 0 ?
                this.op.gridMajorVertOffset + 1 :
                majorNumber - startY + this.op.gridMajorVertOffset;

            for (let y = gridHeight * numberingStartY; y <= lineEndY;) {
                const ypt = gridStartY - this.mmToPt(y);
                const label = majorNumber.toString();
                const textWidth = this.font.widthOfTextAtSize(label, numberingSize);
                // left side
                this.page.drawText(
                    label,
                    {
                        x: gridStartX - textWidth - 5,
                        y: ypt + vertOffset,
                        color: numberingColor,
                        size: numberingSize,
                    }
                );
                // right side
                this.page.drawText(
                    label,
                    {
                        x: gridEndX + 5,
                        y: ypt + vertOffset,
                        color: numberingColor,
                        size: numberingSize,
                    }
                );

                if (majorNumber != 1) {
                    majorNumber += numberingFrequency;
                    y += gridHeight * numberingFrequency;
                } else {
                    majorNumber += numberingFrequency - 1;
                    y += gridHeight * (numberingFrequency - 1);
                }
            }

            majorNumber = this.pageColumn == 0 ?
                1 : (Math.floor(startX / numberingFrequency) + 1) * numberingFrequency;

            let numberingStartX = (this.pageColumn == 0 ?
                this.op.gridMajorHoriOffset + 1 :
                majorNumber - startX + this.op.gridMajorHoriOffset);
            const numberingStartOffset = this.op.viewMode != this.op.viewModeOverGrain ? gridWidth / 2 : 0;

            for (let x = gridWidth * numberingStartX - numberingStartOffset; x <= lineEndX;) {
                const xpt = gridStartX + this.mmToPt(x);
                const label = majorNumber.toString();
                const textWidth = this.font.widthOfTextAtSize(label, numberingSize);

                // top
                this.page.drawText(
                    label,
                    {
                        x: xpt - textWidth / 2,
                        y: gridStartY + 4,
                        color: numberingColor,
                        size: numberingSize,
                    }
                );
                // bottom
                this.page.drawText(
                    label,
                    {
                        x: xpt - textWidth / 2,
                        y: gridEndY - 10,
                        color: numberingColor,
                        size: numberingSize,
                    }
                );

                if (majorNumber != 1) {
                    majorNumber += numberingFrequency;
                    x += gridWidth * numberingFrequency;
                } else {
                    majorNumber += numberingFrequency - 1;
                    x += gridWidth * (numberingFrequency - 1);
                }
            }
        }
    }

    addLine(startX, startY, endX, endY, thickness, color, lineCap) {
        this.page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: thickness,
            color: color,
            lineCap: lineCap,
        });
    }

    colorToRGB(color) {
        if (color.length > 6) {
            const r = parseInt(color.substring(1, 3), 16) / 255;
            const g = parseInt(color.substring(3, 5), 16) / 255;
            const b = parseInt(color.substring(5, 7), 16) / 255;
            return this.rgb(r, g, b);
        } else {
            return this.rgb(0, 0, 0);
        }
    }

    getColor(color) {
        let rgbColor = this.colors.get(color);
        if (!rgbColor) {
            rgbColor = this.colorToRGB(color);
            this.colors.set(color, rgbColor);
        }
        return rgbColor;
    }

    getLineCap(lineCap) {
        switch (lineCap) {
            case 'butt': return PDFLib.LineCapStyle.Butt;
            case 'round': return PDFLib.LineCapStyle.Round;
            default: return PDFLib.LineCapStyle.Butt;
        }
    }

    getLineWidth(viewMode) {
        switch (viewMode) {
            case this.op.viewModeLineGrain: return this.op.lineGrainLineWidth;
            case this.op.viewModeFillGrain: return this.op.gridHeight;
            case this.op.viewModeOverWarp: return this.op.overWarpLineWidth;
            case this.op.viewModeOverGrain: return this.op.overGrainLineWidth;
            default: return this.op.lineGrainLineWidth;
        }
    }

    splitTextToSpan(s) {
        if (s.length == 0) {
            return [];
        }
        const spanList = [];
        let totalLength = s.length;
        let start = 0;
        let len = 0;
        let winAnsi = s.charCodeAt(0) <= 255;
        while (start + len < totalLength) {
            const code = s.charCodeAt(start + len);
            const isWinAnsi = 0 <= code && code <= 255;
            if (winAnsi == isWinAnsi) {
                len += 1;
                continue;
            }
            const span = s.substring(start, start + len);
            spanList.push({start: start, len: len, font: !isWinAnsi ? this.helveticaFont : this.MpFont});
            winAnsi = isWinAnsi;
            start = start + len;
            len = 0;
        }

        spanList.push({start: start, len: len, font: winAnsi ? this.helveticaFont : this.MpFont});
        return spanList;
    }
}
