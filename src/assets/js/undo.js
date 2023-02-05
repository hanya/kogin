
import { Broadcaster } from "./broadcaster.js";


/// Manages undo and redo.
///
/// Each undo entry is instance of object with op entry.
/// It indicates operation and specifies function for both
/// undo and redo.
/// Multiple undo entries can be merged with merge method,
/// which contains sequence op and multiple entries as entries member.
export class UndoManager extends Broadcaster {
    constructor() {
        super();
        this.stack = [];
        /// 0 1 2 3 4: currentIndex
        ///  a b c d : entries
        this.currentIndex = 0;
        this.view = null;
    }

    broadcast() {
        this._broadcast(null);
    }

    /// Sets view.
    setView(view) {
        this.view = view;
    }

    /// Pushes new undo entry.
    push(entry) {
        if (this.currentIndex < this.getCount()) {
            // 0 a 1 b 2 c 3 d 4
            this.stack.splice(this.currentIndex);
        }
        this.stack.push(entry);
        this.currentIndex += 1;

        this.broadcast();
    }

    /// Clears undo stack.
    clear() {
        this.stack = [];
        this.currentIndex = 0;

        this.broadcast();
    }

    /// Returns number of undo entries.
    getCount() {
        return this.stack.length;
    }

    /// Returns label of the undo entry.
    getLabel(index) {
        if (0 <= index && index < this.stack.length) {
            return this.stack[index].label;
        } else {
            return null;
        }
    }

    /// Merge multiple undo entries from last in the stack.
    merge = (count) => {
        if (this.stack.length >= count) {
            const entries = [];
            for (let i = this.stack.length - count; i < this.stack.length; i++) {
                entries.push(this.stack[i]);
            }
            for (let i = 0; i < count; i++) {
                this.stack.pop();
                this.currentIndex -= 1;
            }
            this.push({ op: 'sequence', entries: entries });
        }
    }

    /// Checks undo is possible.
    isUndoPossible() {
        return 0 < this.currentIndex && this.currentIndex <= this.getCount();
    }

    /// Checks redo is possible.
    isRedoPossible() {
        return 0 <= this.currentIndex && this.currentIndex < this.getCount();
    }

    /// Undo.
    undo = () => {
        if (this.isUndoPossible()) {
            const entry = this.stack[this.currentIndex - 1];
            if (entry) {
                const fn = this[`undo_${entry.op}`];
                fn(entry);
            }
            this.currentIndex -= 1;

            this.broadcast();
        }
    }

    /// Redo.
    redo = () => {
        if (this.isRedoPossible()) {
            const entry = this.stack[this.currentIndex];
            if (entry) {
                const fn = this[`redo_${entry.op}`];
                fn(entry);
            }
            this.currentIndex += 1;

            this.broadcast();
        }
    }

    /// Undo sequence of undo entries.
    undo_sequence = (op) => {
        // { op: 'sequence', entries: [] }
        for (let i = op.entries.length - 1; i >= 0; i--) {
            const entry = op.entries[i];
            const fn = this[`undo_${entry.op}`];
            fn(entry);
        }
    }

    /// Redo sequence of undo entries.
    redo_sequence = (op) => {
        for (let i = 0; i < op.entries.length; i++) {
            const entry = op.entries[i];
            const fn = this[`redo_${entry.op}`];
            fn(entry);
        }
    }

    undo_pivot_insert = (op) => {
        for (const item of op.items) {
            item.item.remove();
        }
    }

    redo_pivot_insert = (op) => {
        for (const item of op.items) {
            item.parent.insertChild(item.index, item.item);
        }
    }

    undo_pivot_delete = (op) => {
        this.redo_pivot_insert(op);
    }

    redo_pivot_delete = (op) => {
        this.undo_pivot_insert(op);
    }

    undo_insert = (op) => {
        for (const item of op.items) {
            item.item.remove();
            if (item.item.data.selection) {
                item.item.data.selection.remove();
                item.item.data.selection = null;
            }
        }
    }

    redo_insert = (op) => {
        for (const item of op.items) {
            item.parent.insertChild(item.index, item.item);
        }
    }

    undo_delete = (op) => {
        this.redo_insert(op);
    }

    redo_delete = (op) => {
        this.undo_insert(op);
    }

    undo_move = (op) => {
        for (const item of op.items) {
            item.item.position = item.oldPosition;
            item.item.data.x = item.oldX;
            item.item.data.y = item.oldY;
        }
    }

    redo_move = (op) => {
        for (const item of op.items) {
            item.item.position = item.newPosition;
            item.item.data.x = item.newX;
            item.item.data.y = item.newY;
        }
    }

    undo_move_to_layer = (op) => {
        for (const item of op.items) {
            item.item.remove();
            item.oldLayer.insertChild(item.index, item.item);
        }
    }

    redo_move_to_layer = (op) => {
        const layer = op.newLayer;
        const items = [];
        for (const item of op.items) {
            item.item.remove();
            items.push(item.item);
        }
        layer.insertChildren(0, items);
    }

    undo_group = (op) => {
        for (const item of op.items) {
            item.item.remove();
            item.parent.insertChild(item.index, item.item);
            item.item.data.x = item.oldX;
            item.item.data.y = item.oldY;
            item.item.position = item.oldPosition;
        }
        op.group.remove();
    }

    redo_group = (op) => {
        const items = [];
        for (const item of op.items) {
            item.item.data.x = item.newX;
            item.item.data.y = item.newY;
            items.push(item.item);
        }
        op.group.insertChildren(0, items);
        op.layer.insertChild(0, op.group);
    }

    undo_ungroup = (op) => {
        for (const group of op.groups) {
            const parent = group.group;
            for (const item of group.items) {
                item.item.data.x = item.oldX;
                item.item.data.y = item.oldY;
                parent.insertChild(item.index, item.item);
            }
            group.parent.insertChild(group.index, group.group);
        }
    }

    redo_ungroup = (op) => {
        for (const group of op.groups) {
            for (const item of group.items) {
                item.item.remove();
                group.parent.insertChild(item.index, item.item);
                item.item.data.x = item.newX;
                item.item.data.y = item.newY;
            }
            group.group.remove();
        }
    }

    undo_color = (op) => {
        for (const entry of op.items) {
            entry.item.definition = entry.oldDefinition;
        }
    }

    redo_color = (op) => {
        for (const entry of op.items) {
            entry.item.definition = entry.newDefinition;
        }
    }

    undo_layer_add = (op) => {
        op.manager.removeLayer(op.index);
    }

    redo_layer_add = (op) => {
        op.manager.insertLayer(op.index, op.layer);
    }

    undo_layer_delete = (op) => {
        op.manager.insertLayer(op.index, op.layer);
    }

    redo_layer_delete = (op) => {
        op.manager.removeLayer(op.index);
    }

    undo_layer_rename = (op) => {
        op.layer.name = op.oldName;
    }

    redo_layer_rename = (op) => {
        op.layer.name = op.newName;
    }

    undo_canvas_resize = (op) => {
        const dx = op.dx;
        const dy = op.dy;

        function moveItems(children) {
            for (const child of children) {
                child.position.x -= dx;
                child.position.y -= dy;
            }
        }
        for (const layer of op.items) {
            moveItems(layer.children);
        }
        moveItems(op.pivots.children);
        op.gridManager.setGridCount(op.oldWidth, op.oldHeight);
    }

    redo_canvas_resize = (op) => {
        const dx = op.dx;
        const dy = op.dy;

        function moveItems(children) {
            for (const child of children) {
                child.position.x += dx;
                child.position.y += dy;
            }
        }
        for (const layer of op.items) {
            moveItems(layer.children);
        }
        moveItems(op.pivots.children);
        op.gridManager.setGridCount(op.newWidth, op.newHeight);
    }

    undo_replace = (op) => {
        for (const item of op.items) {
            const group = item.newItem.parent;
            item.newItem.remove();
            group.insertChild(item.index, item.oldItem);
        }
    }

    redo_replace = (op) => {
        for (const item of op.items) {
            const group = item.oldItem.parent;
            item.oldItem.remove();
            group.insertChild(item.index, item.newItem);
        }
    }

    undo_move_z = (op) => {
        if (op.mode == 'front' || op.mode == 'back') {
            for (const group of op.groups) {
                const parent = group[0].parent;
                // remove all first
                for (const [index, item] of group) {
                    item.remove();
                }
                // then add each items
                for (const [index, item] of group) {
                    parent.insertChild(index, item);
                }
            }
        }
    }

    redo_move_z = (op) => {
        if (op.mode == 'front' || op.mode == 'back') {
            for (const group of op.groups) {
                const items = [];
                const parent = group[0][1].parent;
                for (const [index, item] of group) {
                    item.remove();
                    items.push(item)
                }
                console.log(group[0]);
                if (op.mode == 'front') {
                    parent.insertChildren(0, items);
                } else {
                    parent.addChildren(items);
                }
            }
        } else if (op.mode == 'front-step' || op.mode == 'back-step') {
            for (const group of op.groups) {
                const parent = group[0][1].parent;
                // items should be sorted in reverse order of the index
                for (const [oldIndex, newIndex, item] of group) {
                    item.remove();
                    parent.insertChild(newIndex, item);
                }
            }
        }
    }
}
