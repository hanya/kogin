
import xml.etree.ElementTree as ET
import json
import hashlib
import os
from os.path import join
from operator import itemgetter
import argparse
from math import floor
from xml.sax.saxutils import escape

viewModeLineGrain = 0;
viewModeFillGrain = 1;
viewModeOverGrain = 2;
viewModeOverWarp = 3;

class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def clone(self):
        return Point(self.x, self.y)

class Rectangle:
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height

class PositionCalculator:
    def __init__(self, op, strokeCap, name):
        self.name = name
        self.update(op.gridWidth, op.gridHeight, op.gridLineWidth)
        self.strokeWidth = 0
        self.strokeCap = strokeCap

    def update(self, gridWidth, gridHeight, gridLineWidth):
        self.gridWidth = gridWidth
        self.gridHeight = gridHeight
        self.gridLineWidth = gridLineWidth

    def calc(self, x, y, length, pixelCorrection=True):
        return [Point(0, 0), Point(0, 0)]

    def gridToPoint(self, x, y):
        return Point(
            floor(x * self.gridWidth),
            floor(y * self.gridHeight)
        )

    def gridToGridVertCenterPoint(self, x, y):
        point = self.gridToPoint(x, y)
        point.y += self.gridHeight / 2
        return point

    def gridToGridCenterPoint(self, x, y):
        point = self.gridToPoint(x, y)
        return self.toGridCenter(point)

    def toGridCenter(self, point):
        point.x += self.gridWidth / 2
        point.y += self.gridHeight / 2
        return point

    @classmethod
    def choose(cls, op):
        return cls.CLASSES[op.viewMode](op)


class LineGrain(PositionCalculator):
    def __init__(self, op):
        super().__init__(op, 'butt', 'LineGrain')
        self.strokeWidth = op.lineGrainLineWidth

    def calc(self, x, y, length, pixelCorrection=True):
        point1 = self.gridToGridVertCenterPoint(x, y)
        if pixelCorrection:
            point1.y += 0.5
        point2 = point1.clone()
        point1.x += self.gridLineWidth
        point2.x += self.gridWidth * length
        return [point1, point2]

class FillGrain(PositionCalculator):
    def __init__(self, op):
        super().__init__(op, 'butt', 'FillGrain')

    def calc(self, x, y, length, pixelCorrection=True):
        point1 = self.gridToGridVertCenterPoint(x, y)
        if pixelCorrection:
            point1.y += 0.5
        point2 = point1.clone()
        point1.x += self.gridLineWidth
        point2.x += self.gridWidth * length
        return [point1, point2]

class OverGrain(PositionCalculator):
    def __init__(self, op):
        super().__init__(op, 'round', 'OverGrain')
        self.strokeWidth = op.overGrainLineWidth
        self.offset = op.overGrainOffsetRatio * self.gridWidth

    def calc(self, x, y, length, pixelCorrection=True):
        point1 = self.gridToGridVertCenterPoint(x, y)
        if pixelCorrection:
            point1.y += 0.5
        point2 = self.gridToGridVertCenterPoint(x, + length, y)
        point2.y = point1.y
        point1.x -= self.offset
        point2.x += self.offset + self.gridLineWidth
        return [point1, point2]

class OverWarp(PositionCalculator):
    def __init__(self, op):
        super().__init__(op, 'round', 'OverWarp')
        self.strokeWidth = op.overWarpLineWidth
        self.offset = op.overWarpOffsetRatio * self.gridWidth

    def calc(self, x, y, length, pixelCorrection=True):
        point1 = self.gridToGridCenterPoint(x, y)
        if pixelCorrection:
            point1.y += 0.5
        point2 = self.gridToGridCenterPoint(x + length, y)
        point2.y = point1.y
        point1.x += self.offset
        point2.x += - self.offset + self.gridLineWidth
        return [point1, point2]

PositionCalculator.CLASSES = {
    viewModeLineGrain: LineGrain,
    viewModeFillGrain: FillGrain,
    viewModeOverGrain: OverGrain,
    viewModeOverWarp: OverWarp,
}

class SVGDOMElement:
    def __init__(self, name):
        self.tagName = name
        self.attributes = {}
        self.children = []

    def setAttribute(self, name, value):
        self.attributes[name] = value

    def appendChild(self, child):
        self.children.append(child)

    def _writeAttribute(self):
        if self.attributes:
            return ' '.join(['{}="{}"'.format(key, escape(value)) for key, value in self.attributes.items()])
        else:
            return ''

    def _writeStart(self):
        end = '>' if self.children or hasattr(self, 'textContent') else '/>'
        attr = self._writeAttribute()
        if attr:
            return '<{} {}{}'.format(self.tagName, attr, end)
        else:
            return '<{}{}'.format(self.tagName, end)

    def _writeEnd(self):
        return '</{}>'.format(self.tagName)

    def write(self, indent='', newl=''):
        lines = []
        lines.append(self._writeStart())
        if self.children:
            lines.append(newl.join([child.write(indent, newl) for child in self.children]))
            lines.append(self._writeEnd())
        elif hasattr(self, 'textContent'):
            lines.append(self.textContent)
            lines.append(self._writeEnd())
        return newl.join(lines)


class SVGDOM(SVGDOMElement):
    def __init__(self, namespace, name):
        super().__init__(name)
        self.setAttribute('xmlns', namespace)

    def createElement(self, name):
        return SVGDOMElement(name)


class Writer:
    def __init__(self, kogin):
        self.kogin = kogin

    def write(self, forPrinting=False):
        self.op = self.readOptions(self.kogin.getOption(), forPrinting)
        op = self.op
        viewMode = op.viewMode
        if viewMode == viewModeLineGrain:
            op.strokeWidth = op.lineGrainLineWidth
        elif viewMode == viewModeFillGrain:
            op.strokeWidth = op.gridHeight - op.gridLineWidth
        elif viewMode == viewModeOverWarp:
            op.strokeWidth = op.overWarpLineWidth
        elif viewMode == viewModeOverGrain:
            op.strokeWidth = op.overGrainLineWidth

        op.halfStrokeWidth = op.strokeWidth / 2
        op.posCalc = PositionCalculator.choose(op)
        op.lineCap = op.posCalc.strokeCap

        self.bboxRect = self._bboxToRectangle(self.kogin.data.bbox())
        self.gridRect = self._getGridBoundingBox(self.bboxRect)
        offsetX, offsetY, width, height = self._gridTotalSize(self.gridRect)
        self.op.offsetX = offsetX
        self.op.offsetY = offsetY
        self.op.width = width
        self.op.height = height
        if self.op.forPrinting:
            # font size in pt
            fontSize = 9
            self.horiMargin = 10
            self.vertMargin = 10
            self.numberingSize = fontSize * 25.4 / 72
        else:
            self.horiMargin = 30
            self.vertMargin = 30
            self.numberingSize = 12

        self.dom = self._createDom(offsetX, offsetY, width, height, op.useXLink)
        parent = self.dom

        # draw background as rectangle
        if self.op.setBackground:
            self._addBackground(parent)

        # prepare margin for grid numbering
        if self.op.gridNumber:
            g = self.dom.createElement('g')
            g.setAttribute('transform', 'translate({} {})'.format(self.horiMargin, self.vertMargin))
            parent.appendChild(g)
            parent = g

        # under grid
        if self.op.showGrid and not self.op.overGrid:
            self._writeGridByPath(parent, width, height)

        # writes stitches
        self._writeElements(parent, offsetX, offsetY, width, height)

        # write clipPath for output bounds
        if self.op.useOutputBounds:
            self._writeClipPath(dom)

        # over grid
        if self.op.showGrid and self.op.overGrid:
            self._writeGridByPath(parent, width, height)

        # grid numbering
        if self.op.gridNumber:
            self._writeGridNumbering(parent.parentNode)

        # write title and copyright
        if not self.op.forPrinting:
            if self.op.showTitle:
                self._writeTitle(parent)
            if self.op.showCopyright:
                self._writeCopyright(parent)

        # data
        if not self.op.noData:
            self._writeOption(self.dom)
            self._writeData(self.dom)
            self._writeMetadata(self.dom)

        return self.dom.write(newl='\n')

    def _createDom(self, offsetX, offsetY, width, height, useXLink):
        unit = 'mm' if self.op.forPrinting else ''
        dom = SVGDOM('http://www.w3.org/2000/svg', 'svg')
        dom.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        if useXLink:
            dom.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
        imageWidth = width + self.horiMargin * 2 if self.op.gridNumber else width
        imageHeight = height + self.vertMargin * 2 if self.op.gridNumber else height
        dom.setAttribute('viewBox', '0 0 {} {}'.format(imageWidth, imageHeight))
        dom.setAttribute('width', '{}{}'.format(imageWidth, unit))
        dom.setAttribute('height', '{}{}'.format(imageHeight, unit))
        return dom

    def _addBackground(self, parent):
        rect = self.dom.createElement('rect')
        rect.setAttribute('id', 'background')
        rect.setAttribute('x', '0')
        rect.setAttribute('y', '0')
        rect.setAttribute('width', str(self.op.width + (self.horiMargin * 2 if self.op.gridNumber else 0)))
        rect.setAttribute('height', str(self.op.height + (self.vertMargin * 2 if self.op.gridNumber else 0)))
        rect.setAttribute('fill', self.op.backgroundColor)
        parent.appendChild(rect)

    def _writeElements(self, parent, offsetX, offsetY, width, height):
        defs = self.dom.createElement('defs')

        # layers
        g = self.dom.createElement('g')
        g.setAttribute('id', 'layers')
        if self.op.useOutputBounds:
            g.setAttribute('clip-path', 'url(#{})'.format('clip-path'))
        data = self.kogin.getData().data()
        for layer in data:
            self._writeGroup(g, layer)

        self.dom.appendChild(g)

        for d in self.kogin.getData().defs().get('single', []):
            length = int(d.get('length', 0), 10)
            if length <= 0:
                continue
            for color in d.get('colors', []):
                id = '{}-{}'.format(length, color[1:])
                self._addDef(defs, id, length, color)

        self.dom.appendChild(defs)

    def _writeGroup(self, parent, group):
        g = self.dom.createElement('g')

        if group.get('layer', False):
            g.setAttribute('id', group.get('name', 'group'))
            if not group.get('visible', True):
                g.setAttribute('visibility', 'hidden')

        useXLink = self.op.useXLink
        offsetX = self.op.offsetX
        offsetY = self.op.offsetY
        strokeWidth = self.op.strokeWidth
        halfStrokeWidth = self.op.halfStrokeWidth
        gridWidth = self.op.gridWidth
        gridHeight = self.op.gridHeight
        cor = 0 if self.op.forPrinting else 0.5

        if group.get('x', 0) != 0 or group.get('y', 0) != 0:
            x = group.get('x', 0) * gridWidth
            y = group.get('y', 0) * gridHeight
            g.setAttribute('transform', 'translate({} {})'.format(x, y))

        children = group.get('children', [])
        for child in children:
            ref = child.get('ref')
            if ref:
                coords = child.get('coords', [])
                for coord in coords:
                    x = floor(coord[0] * gridWidth)
                    y = floor(coord[1] * gridHeight)
                    use = self.dom.createElement('use')
                    if useXLink:
                        use.setAttribute('xlink:href', '#{}'.format(ref))
                    use.setAttribute('href', '#{}'.format(ref)) # SVG2
                    use.setAttribute('x', str(x - offsetX))
                    use.setAttribute('y', str(y - offsetY))
                    g.appendChild(use)
            else:
                self._writeGroup(g, child)

        parent.appendChild(g)

    def _addLine(self, parent, id, x1, y1, x2, y2, stroke, strokeWidth):
        line = self.dom.createElement('line')
        if id:
            line.setAttribute('id', id)
        line.setAttribute('x1', str(x1))
        line.setAttribute('y1', str(y1))
        line.setAttribute('x2', str(x2))
        line.setAttribute('y2', str(y2))
        line.setAttribute('stroke', stroke)
        line.setAttribute('stroke-width', str(strokeWidth))
        line.setAttribute('stroke-linecap', self.op.lineCap)
        parent.appendChild(line)

    def _addDef(self, parent, id, length, color):
        strokeColor = '#000000' if self.op.monochrome else color
        strokeWidth = self.op.strokeWidth

        start, end = self.op.posCalc.calc(0, 0, length, self.op.forPrinting)
        self._addLine(parent, id, start.x, start.y, end.x, end.y, strokeColor, strokeWidth)

    def _writeClipPath(self, parent):
        x = self.op.leftMargin * self.op.gridWidth
        y = self.op.topMargin * self.op.gridHeight
        width = self.op.width - (self.op.leftMargin + self.op.rightMargin) * self.op.gridWidth
        height = self.op.height - (self.op.topMargin + self.op.bottomMargin) * self.op.gridHeight
        g = self.dom.createElement('g')
        obj = self.dom.createElement('clipPath')
        obj.setAttribute('id', 'clip-path')
        g.appendChild(obj)
        rect = self.dom.createElement('rect')
        rect.setAttribute('x', str(x))
        rect.setAttribute('y', str(y))
        rect.setAttribute('width', str(width))
        rect.setAttribute('height', str(height))
        obj.appendChild(rect)
        parent.appendChild(g)

    def _writeTitle(self, parent):
        text = self.dom.createElement('text')
        text.setAttribute('x', '5')
        text.setAttribute('y', '13')
        text.setAttribute('font-size', '9')
        text.setAttribute('fill', '#000000')
        text.textContent = self.kogin.metadata['title']
        parent.appendChild(text)

    def _writeCopyright(self, parent):
        text = self.dom.createElement('text')
        text.setAttribute('x', str(self.op.width - 5))
        text.setAttribute('y', str(self.op.height - 5))
        text.setAttribute('font-size', '9')
        text.setAttribute('text-anchor', 'end')
        text.setAttribute('fill', '#000000')
        text.textContent = self.kogin.metadata['copyright']
        parent.appendChild(text)

    def _writeGridNumbering(self, parent):
        forPrinting = self.op.forPrinting
        margin = 2 if forPrinting else 5
        color, alpha = self._convertColor(self.op.gridMajorLineColor)

        g = self.dom.createElement('g')
        g.setAttribute('id', 'numbering')
        g.setAttribute('font-size', '{}{}'.format(self.numberingSize, ('pt' if forPrinting else 'px')))
        g.setAttribute('fill', color)
        if alpha:
            g.setAttribute('fill-opacity', alpha)
        parent.appendChild(g)

        def createNumbering(parent, id, anchor):
            numbers = self.dom.createElement('g')
            numbers.setAttribute('id', id)
            numbers.setAttribute('text-anchor', anchor)
            parent.appendChild(numbers)
            return numbers

        def createText(parent, x, y, label):
            text = self.dom.createElement('text')
            text.setAttribute('x', '{:.2f}'.format(x) if forPrinting else str(x))
            text.setAttribute('y', '{:.2f}'.format(y) if forPrinting else str(y))
            text.textContent = label
            parent.appendChild(text)
            return text

        majorFrequency = self.op.gridMajorLineFrequency
        gridHeight = self.op.gridHeight
        gridWidth = self.op.gridWidth
        totalHeight = self.op.height + gridHeight

        startY = self.vertmargin + self.op.topMargin * gridHeight + gridHeight -\
            (gridHeight / 2 - self.numberingSize / 2) / 2
        leftX = self.horiMargin - margin - (1 if forPrinting else 0)
        rightX = self.horiMargin + self.op.width + margin

        number = 1
        # left and right
        leftNumbering = createNumbering(g, 'left-numbering', 'end')
        rightNumbering = createNumbering(g, 'right-numbering', 'start')

        y = startY
        while y < totalHeight:
            label = str(number)
            createText(leftNumbering, leftX, y, label, 'end')
            createText(rightNumbering, rightX, y, label, 'start')

            if number != 1:
                number += majorFrequency
                y += majorFrequency * gridHeight
            else:
                number += majorFrequency - 1
                y += (majorFrequency - 1) * gridHeight

        startX = self.horiMargin + self.op.leftMargin * gridWidth + gridWidth
        totalWidth = self.op.width + gridWidth
        topY = self.vertMargin - margin
        bottomY = self.vertMargin + self.op.height + margin + self.numberingSize

        number = 1
        # top and bottom
        topNumbering = createNumbering(g, 'top-numbering', 'middle')
        bottomNumbering = createNumbering(g, 'bottom-numbering', 'middle')

        x = startX
        while x < totalWidth:
            label = str(number)
            createText(topNumbering, x, topY, label)
            createText(bottomNumbering, x, bottomY, label)

            if number != 1:
                number += majorFrequency
                x += majorFrequency * gridWidth
            else:
                number += majorFrequency - 1
                x += (majorFrequency - 1) * gridWidth

    def _writeGridByPath(self, dom, width, height):
        gridWidth = self.op.gridWidth
        gridHeight = self.op.gridHeight

        if gridWidth <= 0 or gridHeight <= 0 or width <= 0 or height <= 0:
            return

        # for printing purpose
        gridLineWidth = self.op.gridLineWidth
        gridLineColor = self.op.gridLineColor
        gridMajorLineColor = self.op.gridMajorLineColor
        lineEndX = width
        lineEndY = height

        # pixel correction
        cor = 0 if self.op.forPrinting else 0#.5
        gridStart = gridLineWidth / 2

        def createPath(id, d, stroke, strokeWidth, major=False):
            path = self.dom.createElement('path')
            path.setAttribute('id', id)
            rgb, alpha = self._convertColor(stroke)
            path.setAttribute('stroke', rgb)
            if alpha:
                path.setAttribute('opacity', str(alpha))
            path.setAttribute('stroke-width', str(strokeWidth))
            path.setAttribute('d', d)
            return path

        g = self.dom.createElement('g')
        g.setAttribute('id', 'grid')

        vd = []
        vd.append('M {},{}'.format(gridStart + cor, gridStart + cor))
        vertLine = 'V {}'.format(lineEndY)
        horiMove = 'm {},-{}'.format(gridWidth, lineEndY)
        x = 0
        while x <= lineEndX:
            x += gridWidth
            vd.append(vertLine)
            vd.append(horiMove)
        vd.pop() # remove last movement
        vpath = createPath('grid-vert-lines', ' '.join(vd), gridLineColor, gridLineWidth)
        g.appendChild(vpath)

        hd = []
        hd.append('M {},{}'.format(gridStart + cor, gridStart + cor))
        horiLine = 'H {}'.format(lineEndX)
        vertMove = 'm -{},{}'.format(lineEndX, gridHeight)
        y = 0
        while y <= lineEndY:
            y += gridHeight
            hd.append(horiLine)
            hd.append(vertMove)
        hd.pop()
        hpath = createPath('grid-hori-lines', ' '.join(hd), gridLineColor, gridLineWidth)
        g.appendChild(hpath)

        if self.op.showGridFrame:
            frame = []
            frame.append('M {},{}'.format(gridStart + cor, gridStart + cor))
            frame.append('H {}'.format(lineEndX - cor - gridStart))
            frame.append('V {}'.format(lineEndY - cor - gridStart))
            frame.append('H {}'.format(gridStart + cor))
            frame.append('V {} z'.format(gridStart + cor))
            framePath = createPath('grid-frame', ' '.join(frame), gridMajorLineColor, gridLineWidth, True)
            framePath.setAttribute('fill', 'none')
            g.appendChild(framePath)

        if self.op.showGridMajorLine and self.op.gridMajorLineFrequency > 0:
            horiMajorMoveDistance = gridWidth * self.op.gridMajorLineFrequency
            if horiMajorMoveDistance <= 0:
                return
            horiMajorStart = gridStart + gridWidth * self.op.gridMajorHoriOffset + cor
            vmd = []
            vmd.append('M {},{}'.format(horiMajorStart, gridStart + cor))
            vertMajorLine = 'V {}'.format(lineEndY)
            horiMajorMove = 'm {},-{}'.format(horiMajorMoveDistance, lineEndY)
            x = horiMajorStart
            while x <= lineEndX:
                x += horiMajorMoveDistance
                vmd.append(vertMajorLine)
                vmd.append(horiMajorMove)
            vmd.pop()
            vmpath = createPath('grid-vert-major-lines', ' '.join(vmd), gridMajorLineColor, gridLineWidth, True)
            g.appendChild(vmpath)

            vertMajorMoveDistance = gridHeight * self.op.gridMajorLineFrequency
            if vertMajorMoveDistance <= 0:
                return
            vertMajorStart = gridStart + gridHeight * self.op.gridMajorVertOffset + cor
            hmd = []
            hmd.append('M {},{}'.format(gridStart + cor, vertMajorStart))
            horiMajorLine = 'H {}'.format(lineEndX)
            vertMajorMove = 'm -{},{}'.format(lineEndX, vertMajorMoveDistance)
            y = vertMajorStart
            while y <= lineEndY:
                y += vertMajorMoveDistance
                hmd.append(horiMajorLine)
                hmd.append(vertMajorMove)
            hmd.pop()
            hmpath = createPath('grid-hori-major-lines', ' '.join(hmd), gridMajorLineColor, gridLineWidth, True)
            g.appendChild(hmpath)

        dom.appendChild(g)

    def _writeOption(self, dom):
        obj = self.dom.createElement('foreignObject')
        obj.setAttribute('id', 'kogin-option')
        obj.setAttribute('visibility', 'hidden')
        obj.textContent = json.dumps(self.kogin.getOption().getData())
        self.dom.appendChild(obj)

    def _writeData(self, dom):
        obj = self.dom.createElement('foreignObject')
        obj.setAttribute('id', 'kogin-data')
        obj.setAttribute('visibility', 'hidden')
        obj.textContent = json.dumps(self.kogin.getData().getData())
        self.dom.appendChild(obj)

    def _writeMetadata(self, dom):
        obj = self.dom.createElement('foreignObject')
        obj.setAttribute('id', 'kogin-metadata')
        obj.setAttribute('visibility', 'hidden')
        obj.textContent = json.dumps(self.kogin.getMetadata())
        self.dom.appendChild(obj)

    def _convertColor(self, color):
        if len(color):
            rgb = color[0:7]
            alphaPart = color[7:]
            alpha = int(alphaPart, 16) if alphaPart else 0xFF
            return (rgb, '{:.4f}'.format(alpha / 0xFF))
        else:
            return (color, '')

    def _getGridBoundingBox(self, rect):
        if self.op.useOutputBounds:
            return Rectangle(
                self.op.boundsLeft - self.op.leftMargin,
                self.op.boundsTop - self.op.topMargin,
                self.op.boundsRight - self.op.boundsLeft + self.op.rightMargin + 1,
                self.op.boundsBottom - self.op.boundsTop + self.op.bottomMargin + 1
            )
        else:
            viewMode = self.op.viewMode
            x1 = rect.x
            y1 = rect.y
            x2 = rect.x + rect.width
            y2 = rect.y + rect.height
            left = x1 - self.op.leftMargin - (1 if viewMode == viewModeOverGrain else 0)
            top = y1 - self.op.topMargin
            right = x2 + self.op.rightMargin + (
                0 if viewMode == viewModeFillGrain or viewMode == viewModeLineGrain else 1)
            bottom = y2 + self.op.bottomMargin
            return Rectangle(left, top, right - left, bottom - top)

    def _gridTotalSize(self, rect):
        return [
            rect.x * self.op.gridWidth,
            rect.y * self.op.gridHeight,
            rect.width * self.op.gridWidth + self.op.gridLineWidth,
            rect.height * self.op.gridHeight + self.op.gridLineWidth
        ]
    def _bboxToRectangle(self, bbox):
        return Rectangle(bbox[0], bbox[1], bbox[2], bbox[3])

    def readOptions(self, option, forPrinting):
        class Op:
            def __init__(self):
                pass

            def merge(self, d):
                for key, value in d.items():
                    setattr(self, key, value)

            def _merge_from(self, op, keys):
                for key in keys.keys():
                    setattr(self, key, op[key])

            def merge_from_op(self, op, options):
                if op.forPrinting:
                    self._merge_from(op, options.outputPrint())
                    self._merge_from(op, options.gridPrint())
                else:
                    self._merge_from(op, options.outputScreen())
                    self._merge_from(op, options.gridScreen())
                self.viewMode = op.viewMode

        op = Op()
        op.merge({
            'forPrinting': forPrinting,
            'viewModeLineGrain': viewModeLineGrain,
            'viewModeFillGrain': viewModeFillGrain,
            'viewModeOverGrain': viewModeOverGrain,
            'viewModeOverWarp': viewModeOverWarp,
            'viewMode': option.view()['viewMode']
        })
        if forPrinting:
            op.merge(option.outputPrint())
            op.merge(option.gridPrint())
        else:
            op.merge(option.outputScreen())
            op.merge(option.gridScreen())

        op.merge(option.bounds())

        if not hasattr(op, 'numberingColor'):
            op.numberingColor = op.gridMajorLineColor
        return op


class KoginOption:
    def __init__(self, data):
        self._data = data

    def getData(self):
        return self._data

    def outputScreen(self):
        return self._data['output-screen']

    def outputPrint(self):
        return self._data['output-print']

    def gridScreen(self):
        return self._data['grid-screen']

    def gridPrint(self):
        return self._data['grid-print']

    def bounds(self):
        return self._data['bounds']

    def pdfExport(self):
        return self._data['pdf-export']

    def view(self):
        return self._data['view']

class KoginData:
    def __init__(self, data):
        if data['application'] != 'kogin':
            raise Exception('Non-kogin data')
        self._data = data

    def getData(self):
        return self._data

    def defs(self):
        return self._data['defs']

    def pivots(self):
        return self._data['pivots']

    def data(self):
        return self._data['data']

    def bbox(self):
        return self._data['bbox']

class Kogin:
    def __init__(self, path):
        self.path = path
        tree = ET.parse(path)
        root = tree.getroot()
        for obj in root.findall('{http://www.w3.org/2000/svg}foreignObject'):
            if obj.get('id') == 'kogin-data':
                self.data = KoginData(json.loads(obj.text))
            elif obj.get('id') == 'kogin-option':
                self.option = KoginOption(json.loads(obj.text))
            elif obj.get('id') == 'kogin-metadata':
                self.metadata = json.loads(obj.text)

    def getData(self):
        return self.data

    def getOption(self):
        return self.option

    def getMetadata(self):
        return self.metadata

    def normalizer(self):
        return Normalizer(self.data)

    def mergeOption(self, other):
        op = self.getOption().getData()
        for key, value in other.getOption().getData().items():
            if key == 'bounds':
                continue
            op[key] = value


STATE_SAME = 0
STATE_INSIDE = 1
STATE_OVERLAP = 2
STATE_UNKNOWN = 3

class Normalizer:
    def __init__(self, data):
        self.data = data
        self._stitches = []

    def _addStitch(self, length, coord):
        if len(self._stitches) <= length:
            while len(self._stitches) <= length:
                self._stitches.append([])
        coords = self._stitches[length]
        coords.append(coord)

    def normalize(self):
        self._parse()
        self._solveConfliction(STATE_SAME, STATE_INSIDE)
        self._solveConfliction(STATE_OVERLAP, STATE_UNKNOWN)
        self._align()
        return self._hash()

    def _hash(self):
        # length:X,Y...\n
        lines = []
        for length, coords in enumerate(self._stitches):
            if coords:
                entries = ['{},{}'.format(x, y) for x, y in coords]
                lines.append('{}:{}'.format(length, ';'.join(entries)))
        self.base = '\n'.join(lines)
        hash = hashlib.sha1(self.base.encode('utf-8'))
        return hash.hexdigest()

    def _parse(self):
        self._stitches.clear()
        for _ in range(10):
            self._stitches.append([])

        for layer in self.data.data():
            self._parseGroup(layer, 0, 0)

    def _align(self):
        bbox = self.data.bbox()
        left = bbox[0]
        top = bbox[1]
        for length, coords in enumerate(self._stitches):
            if coords:
                entries = [(x - left, y - top) for x, y in coords]
                entries.sort(key=itemgetter(0, 1))
                self._stitches[length] = entries

    def _parseGroup(self, group, offsetX, offsetY):
        for child in group['children']:
            ref = child.get('ref')
            if ref:
                length, _ = self._parseRef(ref)
                for coord in child['coords']:
                    self._addStitch(length, (coord[0] + offsetX, coord[1] + offsetY))
            else:
                if child.get('children'):
                    self._parseGroup(child, offsetX + child['x'], offsetY + child['y'])

    def _parseRef(self, ref):
        length, color = ref.split('-', 1)
        return int(length, 10), color

    def _solveConfliction(self, state1, state2):
        # if another stitch starts inside the stitch, error
        confliction = []

        def checkConfliction(x1, y1, length1, index1, x2, y2, length2, index2):
            # stitch2 starts inside of stitch1
            if x1 <= x2 and x2 <= x1 + length1:
                confliction.append(Confliction(
                    Entry(x1, y1, length1, index1), Entry(x2, y2, length2, index2)
                ))
            elif x2 <= x1 and x1 <= x2 + length2:
                confliction.append(Confliction(
                    Entry(x2, y2, length2, index2), Entry(x1, y1, length1, index1)
                ))

        rev = len(self._stitches) - 1
        for i in range(len(self._stitches)):
            length = rev - i
            coords = self._stitches[length]
            if not coords:
                continue
            for index, (x, y) in enumerate(coords):
                endX = x + length
                for j, (cx, cy) in enumerate(self._stitches[length][index + 1:]):
                    if y == cy:
                        checkConfliction(x, y, length, index, cx, cy, length, index + 1 + j)
                for checkLength in range(length):
                    checkCoords = self._stitches[checkLength]
                    if not checkCoords:
                        continue
                    for m, (cx, cy) in enumerate(checkCoords):
                        if y == cy:
                            checkConfliction(x, y, length, index, cx, cy, checkLength, m)

        if not confliction:
            return False

        overlapping = []
        for cf in confliction:
            if cf.state == STATE_OVERLAP:
                overlapping.append(cf)
        overlapping.sort(key=lambda entry: entry.entry1.x)

        def removeFrom(container, item):
            index = contaienr.index(item)
            if index >= 0:
                container.pop(index)

        i = 0
        while i < len(overlapping):
            cfs = []
            cf = overlapping[i]
            j = i
            while j < len(overlapping):
                subCf = overlapping[j]
                if cf.entry2.isEqual(subCf.entry1):
                    cfs.append(subCf)
                j += 1

            ovCf = OverlapConfliction(cf.entry1, cf.entry2)
            overlapping[i] = ovCf
            confliction[confliction.index(cf)] = ovCf

            for subCf in cfs:
                ovCf.add(subCf.entry2)
                overlapping.remove(subCf)
                confliction.remove(subCf)

            i += 1

        self._solve(state1, state2, confliction)
        return True

    def _solve(self, state1, state2, confliction):
        removeEntries = []
        for i in range(len(self._stitches)):
            removeEntries.append([])

        for conflict in confliction:
            state = conflict.state
            if not (state == state1 or state == state2):
                continue
            if state == STATE_OVERLAP:
                removeEntries[conflict.entry1.length].append(conflict.entry1)
                # make entry1 longer
                self._addStitch(conflict.getOverlapTotalLength(), conflict.entry1.getCoord())
            else:
                removeEntries[conflict.entry2.length].append(conflict.entry2)

        if state1 == STATE_OVERLAP or state2 == STATE_OVERLAP:
            for cf in confliction:
                if cf.state == STATE_OVERLAP:
                    for entry in cf.entries:
                        removeEntries[entry.length].append(entry)

        for coords, entries in zip(self._stitches, removeEntries):
            if not entries:
                continue
            tagged = []
            for entry in entries:
                tagged.append(entry.index)
            tagged = list(set(tagged))
            tagged.sort(reverse=True)
            for index in tagged:
                coords.pop(index)


class Entry:
    def __init__(self, x, y, length, index):
        self.x = x
        self.y = y
        self.length = length
        self.index = index
        self.endX = x + length

    def getCoord(self):
        return [self.x, self.y]

    def same(self, target):
        return self.x == target.x and self.length == target.length

    def inside(self, target):
        return target.endX <= self.endX

    def overlap(self, target):
        return self.endX <= target.endX

    def __repr__(self):
        return '({}, {}, len: {}, i: {})'.format(self.x, self.y, self.length, self.index)

    def isEqual(self, a):
        return (self.x == a.x and self.y == a.y and
                self.length == a.length and self.index == a.index)

class Confliction:
    STATE = ('same', 'inside', 'overlap')

    def __init__(self, entry1, entry2):
        self.entry1 = entry1
        self.entry2 = entry2
        self.state = self.getState()

    def isInside(self):
        return self.entry1.inside(self.entry2)

    def isSame(self):
        return self.entry1.same(self.entry2)

    def isOverlap(self):
        return self.entry1.overlap(self.entry2)

    def getOverlapTotalLength(self):
        return self.entry2.endX - self.entry1.x

    def getState(self):
        if self.isSame():
            return STATE_SAME
        if self.isInside():
            return STATE_INSIDE
        if self.isOverlap():
            return STATE_OVERLAP
        return STATE_UNKNOWN

    def __repr__(self):
        return '[{}, {}, {}]'.format(self.entry1, self.entry2, self.STATE[self.state])

class OverlapConfliction(Confliction):
    def __init__(self, entry1, entry2):
        super().__init__(entry1, entry2)
        self.entries = [entry2]

    def getOverlapTotalLength(self):
        maxX = 0
        for entry in self.entries:
            maxX = max(maxX, entry.endX)
        return maxX - self.entry1.x

    def add(self, entry):
        self.entries.append(entry)

    def __repr__(self):
        return '[{}, {}, {}]'.format(self.entry1, self.entries, self.STATE[self.state])


def hash(path):
    return Kogin(path).normalizer().normalize()

def get_hash_list(path):
    listing = []
    for name in os.listdir(path):
        if name.endswith('.svg'):
            h = hash(join(path, name))
            if not h:
                print('Warning: {} is broken or wrong format'.format(name))
                continue
            listing.append((name, h))
    listing.sort(key=itemgetter(0))
    return listing

def func_list(args):
    cmd_list(args.path, args.list)

def cmd_list(path, listFile):
    listing = get_hash_list(path)
    lines = ['{}\t{}'.format(name, h) for name, h in listing]
    with open(listFile, 'w') as f:
        f.write('\n'.join(lines))

def func_check(args):
    cmd_check(args.path, args.list)

def cmd_check(path, listFile):
    with open(listFile) as f:
        lines = f.read().split('\n')
    listing = [tuple(reversed(line.split('\t', 1))) for line in lines]
    hashMap = dict(listing)

    h = hash(path)
    if not h:
        print('Error: {} is broken'.format(path))
        os.exit(1)

    if h in hashMap:
        'exists'
    else:
        'not exists'

def func_hash(args):
    cmd_hash(args.path)

def cmd_hash(path):
    h = hash(path)
    if not h:
        print('Error: {} is broken'.format(path))
        os.exit(1)
    print(h)

def func_repeated(args):
    cmd_repeated(args.path)

def cmd_repeated(path):
    listing = get_hash_list(path)
    checker = {}
    for (name, h) in listing:
        entries = checker.get(h, [])
        entries.append(name)
        if len(entries) == 1:
            checker[h] = entries

    if len(listing) == len(checker):
        print('Nothing repeated.')
        return
    print('Repeated')
    for h, entries in checker.items():
        if len(entries) > 1:
            print(', '.join(entries))

def func_pivots(args):
    cmd_pivots(args.path)

def cmd_pivots(path):
    for name in os.listdir(path):
        if name.endswith('.svg'):
            kogin = Kogin(join(path, name))
            if not kogin.getData().pivots():
                print(name)

def func_update(args):
    cmd_update(args.path, args.dir_path, args.print)

def cmd_update(path, dir_path, forPrinting):
    base = Kogin(path)
    for name in os.listdir(dir_path):
        if name.endswith('.svg'):
            file_path = join(dir_path, name)
            kogin = Kogin(file_path)
            kogin.mergeOption(base)
            try:
                s = Writer(kogin).write()
            except Exception as e:
                print(e)
                print(file_path)
                continue
            with open(file_path, 'w') as f:
                f.write(s)


def main():
    parser = argparse.ArgumentParser(
                prog = 'kogin',
                description = 'Checks template confliction')
    subparsers = parser.add_subparsers(help='check, hash, or list')

    # kogin check path list_path
    parser_check = subparsers.add_parser('check',
        help='Checks specified template is exist or not.')
    parser_check.add_argument('path',
        help='Path to kogin file.')
    parser_check.add_argument('list',
        help='Path to listing file.')
    parser_check.set_defaults(func=func_check)

    # kogin hash path
    parser_hash = subparsers.add_parser('hash',
        help='Calculates hash value for specified file.')
    parser_hash.add_argument('path',
        help='Path to kogin file.')
    parser_hash.set_defaults(func=func_hash)

    # kogin list dir_path list_path
    parser_list = subparsers.add_parser('list',
        help='Makes list of hash for files in specified directory.')
    parser_list.add_argument('path',
        help='Path to directory.')
    parser_list.add_argument('list',
        help='Path to listing file.')
    parser_list.set_defaults(func=func_list)

    # kogin repeated dir_path
    parser_repeated = subparsers.add_parser('repeated',
        help='Checks repeated templates in the directory.')
    parser_repeated.add_argument('path',
        help='Path to directory.')
    parser_repeated.set_defaults(func=func_repeated)

    # kogin pivots dir_path
    parser_pivots = subparsers.add_parser('pivots',
        help='Checks pivots not specified.')
    parser_pivots.add_argument('path',
        help='Path to directory.')
    parser_pivots.set_defaults(func=func_pivots)

    # kogin update dir_path base_path
    parser_update = subparsers.add_parser('update',
        help='Updates SVG image based on settings from specified file.')
    parser_update.add_argument('dir_path',
        help='Path to directory which contains files to be updated.')
    parser_update.add_argument('path',
        help='Path to file for settings.')
    parser_update.add_argument('-p', '--print',
        help='Image mode for print.',
        action='store_true')

    parser_update.set_defaults(func=func_update)

    args = parser.parse_args()
    args.func(args)

def main2():
    kogin = Kogin('./katako-17-1.svg')
    Writer(kogin).write(False)

main()
