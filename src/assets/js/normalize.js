
import { ShortcutWindow } from "./shortcut.js";
import { sha1 } from "./tools.js";


class Entry {
    constructor(x, y, length, index, item) {
        this.x = x;
        this.y = y;
        this.length = length;
        this.index = index;
        this.endX = x + length;
        this.item = item;
    }

    getCoord() {
        return [this.x, this.y, this.item];
    }

    // both position and length of the targets are the same
    same(target) {
        return this.x == target.x && this.length == target.length;
    }

    inside(target) {
        return target.endX <= this.endX;
    }

    overlap(target) {
        return this.endX <= target.endX;
    }

    toString() {
        return `(${this.x}, ${this.y}, len: ${this.length}, i: ${this.index})`;
    }

    isEqual(another) {
        return this.item == another.item;
    }
}

const STATE_SAME = 0;
const STATE_INSIDE = 1;
const STATE_OVERLAP = 2;
const STATE_UNKNOWN = 3;

class Confliction {
    constructor(entry1, entry2) {
        this.entry1 = entry1;
        this.entry2 = entry2;
        this.state = this.getState();
    }

    isInside() {
        return this.entry1.inside(this.entry2);
    }

    isSame() {
        return this.entry1.same(this.entry2);
    }

    isOverlap() {
        return this.entry1.overlap(this.entry2);
    }

    getOverlapTotalLength() {
        return this.entry2.endX - this.entry1.x;
    }

    getState() {
        if (this.isSame()) {
            return STATE_SAME;
        } else if (this.isInside()) {
            return STATE_INSIDE;
        } else if (this.isOverlap()) {
            return STATE_OVERLAP;
        }
        return STATE_UNKNOWN;
    }

    toString() {
        const state = ['same', 'inside', 'overlap'][this.state];
        return `[${this.entry1.toString()}, ${this.entry2.toString()}, ${state}]`;
    }
}

class OverlapConfliction extends Confliction {
    constructor(entry1, entry2) {
        super(entry1, entry2);
        this.entries = [entry2];
    }

    getOverlapTotalLength() {
        let maxX = 0;
        for (const entry of this.entries) {
            maxX = Math.max(maxX, entry.endX);
        }
        return maxX - this.entry1.x;
    }

    add(entry) {
        this.entries.push(entry);
    }

    isLastOverlap(entry) {
        return this.entries[this.entries.length - 1].isEqual(entry);
    }
}

export class Normalizer {
    constructor(sashi) {
        this.sashi = sashi;
        this.undoCount = 0;
    }

    addStitch(length, coord) {
        if (this.stitches.length <= length) {
            while (this.stitches.length <= length) {
                this.stitches.push([]);
            }
        }
        this.stitches[length].push(coord);
    }

    solve() {
        this.undoCount = 0;
        this.parse();
        this.checkConfliction();
        this.solveOnModel(STATE_SAME, STATE_INSIDE);

        this.checkConfliction();
        this.solveOnModel(STATE_OVERLAP, STATE_UNKNOWN);

        if (this.undoCount > 1) {
            this.sashi.undoManager.merge(this.undoCount);
        }
    }

    async normalize(fileName) {
        this.parse();
        this.checkConfliction();
        this.solveInData(STATE_SAME, STATE_INSIDE);

        this.checkConfliction();
        this.solveInData(STATE_OVERLAP, STATE_UNKNOWN)

        this.align();

        const lines = [];
        for (const [length, coords] of this.stitches.entries()) {
            if (coords.length > 0) {
                const entries = [];
                for (const [x, y, _] of coords) {
                    entries.push(`${x},${y}`);
                }
                lines.push(`${length}:${entries.join(';')}`);
            }
        }

        const base = lines.join('\n');
        return await sha1(base);
    }

    parse() {
        this.stitches = [];
        for (let i = 0; i < 10; i++) {
            this.stitches.push([]);
        }
        for (const layer of this.sashi.layerManager.getUserLayers()) {
            this.parseGroup(layer, 0, 0);
        }
    }

    parseGroup(group, offsetX, offsetY) {
        for (const child of group.children) {
            switch (child.className) {
                case 'SymbolItem': {
                    const data = child.data;
                    this.addStitch(data.stitchLength, [offsetX + data.x, offsetY + data.y, child]);
                    break;
                }
                case 'Group': {
                    this.parseGroup(child, offsetX + child.data.x, offsetY + child.data.y);
                    break;
                }
            }
        }
    }

    align() {
        const bbox = this.getBBox();
        const left = bbox[0];
        const top = bbox[1];

        function cmp(a, b) {
            if (a[0] < b[0]) {
                return -1;
            }
            if (a[0] > b[0]) {
                return 1;
            }
            if (a[1] < b[1]) {
                return -1;
            }
            if (a[1] > b[1]) {
                return 1;
            }
            return 0;
        }

        for (const coords of this.stitches) {
            if (coords.length > 0) {
                for (const [index, coord] of coords.entries()) {
                    coords[index] = [coord[0] - left, coord[1] - top];
                }
                coords.sort(cmp);
            }
        }
    }

    getBBox() {
        const [minFn, maxFn] = [Math.min, Math.max];
        let [left, right, top, bottom] = [1000000, -100000, 100000, -100000];
        for (const [length, coords] of this.stitches.entries()) {
            for (const coord of coords) {
                left = minFn(left, coord[0]);
                right = maxFn(right, coord[0] + length);
                top = minFn(top, coord[1]);
                bottom = maxFn(bottom, coord[1]);
            }
        }
        return [left, top, right - left, bottom - top];
    }

    checkConfliction() {
        const confliction = [];

        function checkConfliction(x1, y1, length1, index1, item1, x2, y2, length2, index2, item2) {
            if (x1 <= x2 && x2 <= x1 + length1) {
                confliction.push(new Confliction(
                    new Entry(x1, y1, length1, index1, item1), new Entry(x2, y2, length2, index2, item2)
                ));
            } else if (x2 <= x1 && x1 <= x2 + length2) {
                confliction.push(new Confliction(
                    new Entry(x2, y2, length2, index2, item2), new Entry(x1, y1, length1, index1, item1)
                ));
            }
        }

        const rev = this.stitches.length - 1;
        for (let i = 0; i < this.stitches.length; i++) {
            const length = rev - i;
            const coords = this.stitches[length];
            if (coords.length <= 0) {
                continue;
            }
            for (const [index, [x, y, item1]] of coords.entries()) {
                for (let j = index + 1; j < coords.length; j++) {
                    const [cx, cy, item2] = coords[j];
                    if (y == cy) {
                        checkConfliction(x, y, length, index, item1, cx, cy, length, j, item2);
                    }
                }
                for (let checkLength = 0; checkLength < length; checkLength++) {
                    const checkCoords = this.stitches[checkLength];
                    if (checkCoords.length <= 0) {
                        continue;
                    }
                    for (const [m, [cx, cy, item2]] of checkCoords.entries()) {
                        if (y == cy) {
                            checkConfliction(x, y, length, index, item1, cx, cy, checkLength, m, item2);
                        }
                    }
                }
            }
        }

        function cmp(a, b) {
            if (a.entry1.x < b.entry1.x) {
                return -1;
            } else if (a.entry1.x > b.entry1.x) {
                return 1;
            }
            return 0;
        }

        // sort overlapping confliction by start position of entry1
        const overlapping = [];
        for (const cf of confliction) {
            if (cf.state == STATE_OVERLAP) {
                overlapping.push(cf);
            }
        }
        overlapping.sort(cmp);

        function removeFrom(container, item) {
            const index = container.indexOf(item);
            if (index >= 0) {
                container.splice(index, 1);
            }
        }

        // merge sequencial confliction of overlapping
        for (let i = 0; i < overlapping.length; i++) {
            const cfs = [];
            const cf = overlapping[i];
            if (cf.removed) {
                continue;
            }
            for (let j = i + 1; j < overlapping.length; j++) {
                const subCf = overlapping[j];
                if (subCf.removed) {
                    continue;
                }
                if (cf.entry2.isEqual(subCf.entry1) ||
                    (cf instanceof OverlapConfliction &&
                     cf.isLastOverlap(subCf.entry1))) {
                    cfs.push(subCf);
                }
            }

            let ovCf;
            if (cf instanceof OverlapConfliction) {
                ovCf = cf;
            } else {
                ovCf = new OverlapConfliction(cf.entry1, cf.entry2);
                overlapping[i] = ovCf;
                const index = confliction.indexOf(cf);
                if (index >= 0) {
                    confliction[index] = ovCf;
                }
            }

            for (const subCf of cfs) {
                ovCf.add(subCf.entry2);
                // todo, remove later
                //removeFrom(overlapping, subCf);
                subCf.removed = true;
                removeFrom(confliction, subCf);
            }
            if (cfs.length > 0) {
                // check current again if conflict with the next item
                i -= 1;
            }
        }

        this.confliction = confliction;
    }

    solveInData(state1, state2) {
        if (this.confliction.length <= 0) {
            return false;
        }

        const removeEntries = [];
        for (let i = 0; i < this.stitches.length; i++) {
            removeEntries.push([]);
        }

        for (const conflict of this.confliction) {
            const state = conflict.state;
            if (!(state == state1 || state == state2)) {
                continue;
            }
            if (state == 2) {
                removeEntries[conflict.entry1.length].push(conflict.entry1);
                this.addStitch(conflict.getOverlapTotalLength(), conflict.entry1.getCoord());
            } else {
                removeEntries[conflict.entry2.length].push(conflict.entry2);
            }
        }

        if (state1 == STATE_OVERLAP || state2 == STATE_OVERLAP) {
            for (const cf of this.confliction) {
                if (cf.state == STATE_OVERLAP) {
                    if (!cf.entries) {
                        console.log(cf);
                    }
                    for (const entry of cf.entries) {
                        removeEntries[entry.length].push(entry);
                    }
                }
            }
        }

        for (let i = 0; i < this.stitches.length; i++) {
            if (removeEntries[i].length <= 0) {
                continue;
            }
            const coords = this.stitches[i];
            let tagged = [];
            for (const entry of removeEntries[i]) {
                tagged.push(entry.index);
            }
            tagged = Array.from(new Set(tagged).values());
            tagged.sort(function (a, b) { return a - b; });
            tagged.reverse();
            for (const index of tagged) {
                coords.splice(index, 1);
            }
        }

        return true;
    }

    solveOnModel(state1, state2) {
        if (this.confliction.length <= 0) {
            return false;
        }

        const replaceEntries = [];
        const removeEntries = [];
        for (let i = 0; i < this.stitches.length; i++) {
            removeEntries.push([]);
        }

        for (const conflict of this.confliction) {
            const state = conflict.state;
            if (!(state == state1 || state == state2)) {
                continue;
            }
            if (state == STATE_OVERLAP) {
                // overlap
                replaceEntries.push([conflict.getOverlapTotalLength(), conflict.entry1]);
            } else {
                removeEntries[conflict.entry2.length].push(conflict.entry2);
            }
        }

        const deleteItems = [];
        for (let i = 0; i < this.stitches.length; i++) {
            if (removeEntries[i].length <= 0) {
                continue;
            }
            const coords = this.stitches[i];
            let tagged = [];
            for (const entry of removeEntries[i]) {
                tagged.push(entry.index);
            }
            tagged = Array.from(new Set(tagged).values());
            tagged.sort(function (a, b) { return a - b; });
            for (let n = tagged.length - 1; n >= 0; n--) {
                const index = tagged[n];
                deleteItems.push(coords[index][2]);
                coords.splice(index, 1);
            }
        }

        // entries from overlapconfliction
        if (state1 == STATE_OVERLAP || state2 == STATE_OVERLAP) {
            for (const cf of this.confliction) {
                for (const entry of cf.entries) {
                    deleteItems.push(entry.item);
                }
            }
        }

        if (deleteItems.length > 0) {
            this.sashi.deleteItems(deleteItems);
            this.undoCount += 1;
        }

        const source = [];
        const dest = [];
        for (const [length, entry] of replaceEntries) {
            const color = entry.item.definition.item.strokeColor.toCSS(true).substring(1);
            const data = entry.item.data;
            const newItem = this.sashi.stitchManager.singleStitch(length, color, data.x, data.y);
            this.sashi.stitchManager.updatePositionInGroup(newItem, entry.item.parent);
            source.push(entry.item);
            dest.push(newItem);
        }

        if (source.length > 0) {
            this.sashi.replaceItems(source, dest);
            this.undoCount += 1;
        }

        return true;
    }
}
