
const JISKeys = `
[
  {
    "name": "JIS108"
  },
  [
    "Esc\\n\\n\\n\\nESCAPE",
    {
      "x": 1
    },
    "F1\\n\\n\\n\\nF1",
    "F2\\n\\n\\n\\nF2",
    "F3\\n\\n\\n\\nF3",
    "F4\\n\\n\\n\\nF4",
    {
      "x": 0.5
    },
    "F5\\n\\n\\n\\nF5",
    "F6\\n\\n\\n\\nF6",
    "F7\\n\\n\\n\\nF7",
    "F8\\n\\n\\n\\nF8",
    {
      "x": 0.5
    },
    "F9\\n\\n\\n\\nF9",
    "F10\\n\\n\\n\\nF10",
    "F11\\n\\n\\n\\nF11",
    "F12\\n\\n\\n\\nF12",
    {
      "x": 0.25
    },
    " \\n\\n\\n\\n",
    "Scroll Lock\\n\\n\\n\\nSCROLLLOCK",
    "Pause\\n\\n\\n\\nPAUSE"
  ],
  [
    {
      "y": 0.5
    },
    " \\n\\n\\n\\n",
    "!\\n1\\n\\n\\n1",
    "\\u0022\\n2\\n\\n\\n2",
    "#\\n3\\n\\n\\n3",
    "$\\n4\\n\\n\\n4",
    "%\\n5\\n\\n\\n5",
    "&\\n6\\n\\n\\n6",
    "'\\n7\\n\\n\\n7",
    "(\\n8\\n\\n\\n8",
    ")\\n9\\n\\n\\n9",
    "\\n0\\n\\n\\n0",
    "=\\n-\\n\\n\\n-",
    "~\\n^\\n\\n\\n~",
    "|\\n\\u005c\\n\\n\\n\\u005c",
    "Back Space\\n\\n\\n\\nBACKSPACE",
    {
      "x": 0.25
    },
    "Insert\\n\\n\\n\\nINSERT",
    "Home\\n\\n\\n\\nHOME",
    "Page Up\\n\\n\\n\\nPAGEUP"
  ],
  [
    {
      "w": 1.5
    },
    "Tab\\n\\n\\n\\nTAB",
    "Q\\n\\n\\n\\nQ",
    "W\\n\\n\\n\\nW",
    "E\\n\\n\\n\\nE",
    "R\\n\\n\\n\\nR",
    "T\\n\\n\\n\\nT",
    "Y\\n\\n\\n\\nY",
    "U\\n\\n\\n\\nU",
    "I\\n\\n\\n\\nI",
    "O\\n\\n\\n\\nO",
    "P\\n\\n\\n\\nP",
    "\\u0060\\n@\\n\\n\\n@",
    "{\\n[\\n\\n\\n[",
    {
      "x": 0,
      "w": 1.5,
      "h": 2,
      "w2": 1.5,
      "h2": 1,
      "x2": -0.25
    },
    "Enter\\n\\n\\n\\nENTER",
    {
      "x": 0.25
    },
    "Delete\\n\\n\\n\\nDELETE",
    "End\\n\\n\\n\\nEND",
    "Page Down\\n\\n\\n\\nPAGEDOWN"
  ],
  [
    {
      "w": 1.75
    },
    " \\n\\n\\n\\n",
    "A\\n\\n\\n\\nA",
    "S\\n\\n\\n\\nS",
    "D\\n\\n\\n\\nD",
    "F\\n\\n\\n\\nF",
    "G\\n\\n\\n\\nG",
    "H\\n\\n\\n\\nH",
    "J\\n\\n\\n\\nJ",
    "K\\n\\n\\n\\nK",
    "L\\n\\n\\n\\nL",
    "+\\n;\\n\\n\\n;",
    "*\\n:\\n\\n\\n:",
    "}\\n]\\n\\n\\n]"
  ],
  [
    {
      "w": 2.25
    },
    "Shift\\n\\n\\n\\nSHIFT",
    "Z\\n\\n\\n\\nZ",
    "X\\n\\n\\n\\nX",
    "C\\n\\n\\n\\nC",
    "V\\n\\n\\n\\nV",
    "B\\n\\n\\n\\nB",
    "N\\n\\n\\n\\nN",
    "M\\n\\n\\n\\nM",
    "<\\n,\\n\\n\\n,",
    ">\\n.\\n\\n\\n.",
    "?\\n/\\n\\n\\n/",
    "_\\n\\u005c\\n\\n\\n\\u005c",
    {
      "w": 1.75
    },
    "Shift\\n\\n\\n\\nSHIFT",
    {
      "x": 1.25
    },
    "Up\\n\\n\\n\\nARROWUP"
  ],
  [
    {
      "w": 1.25
    },
    "Ctrl\\n\\n\\n\\nCTRL",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\n",
    {
      "w": 1.25
    },
    "Alt\\n\\n\\n\\nALT",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\nNONCONVERT",
    {
      "w": 2.5
    },
    "Space\\n\\n\\n\\nSPACE",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\nCONVERT",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\nHIRAGANAKATAKANA",
    {
      "w": 1.25
    },
    "Alt\\n\\n\\n\\nALT",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\n",
    {
      "w": 1.25
    },
    " \\n\\n\\n\\n",
    {
      "w": 1.25
    },
    "Ctrl\\n\\n\\n\\nCTRL",
    {
      "x": 0.25
    },
    "Left\\n\\n\\n\\nARROWLEFT",
    "Down\\n\\n\\n\\nARROWDOWN",
    "Right\\n\\n\\n\\nARROWRIGHT"
  ]
]
`;


function getOrDefault(obj, key, defaultValue) {
    let value = obj[key];
    return value !== undefined ? value : defaultValue;
}

/// Converts layout data into simple data structure.
function parseLayoutData(data) {
    const layout = JSON.parse(data);
    const keys = [];
    let x = 0, y = 0;
    let w = 1, h = 1;
    let r = 0, rx = 0, ry = 0;

    for (let column of layout) {
        if (!Array.isArray(column)) {
            continue; // ignore first object
        }
        for (let item of column) {
            if (typeof(item) == 'object') {
                const arg = item;
                r = getOrDefault(arg, 'r', r);
                let new_rx = arg['rx'];
                let new_ry = arg['ry'];
                if (new_rx !== undefined || new_ry !== undefined) {
                    if (new_rx !== undefined) {
                        rx = new_rx;
                        x = rx + getOrDefault(arg, 'x', 0);
                    } else {
                        x = rx; // todo
                    }
                    if (new_ry !== undefined) {
                        ry = new_ry;
                        y = ry + getOrDefault(arg, 'y', 0);
                    } else {
                        y = ry + getOrDefault(arg, 'y', 0);
                    }
                } else {
                    x += getOrDefault(arg, 'x', 0);
                    y += getOrDefault(arg, 'y', 0);
                }
                w = getOrDefault(arg, 'w', w);
                h = getOrDefault(arg, 'h', h);

                // empty key
                if (arg['x'] !== undefined) {
                    keys.push({spacer: arg['x']});
                }
                if (arg['y'] !== undefined) {
                    keys.push({vertspacer: arg['y'], newrow: true});
                }
                continue;
            }

            const parts = item.split("\n");
            const label = parts[0] + (parts[1] != '' ? "\n" + parts[1] : "");
            const keycode = parts[parts.length - 1];
            let entry = {x: x, y: y, width: w, height: h, label: label, keycode: keycode};
            if (r != 0) {
                entry['r'] = r;
                entry['rx'] = rx;
                entry['ry'] = ry;
            }
            keys.push(entry);

            x += w;
            w = 1; h = 1;
        }
        keys.push({spacer: 0, newrow: true});
        x = rx;
        y += h;
    }
    return keys;
}

function addTextSection(parentId, content) {
    const keycodes = document.getElementById(parentId);
    const text = document.createElement('div');
    text.innerText = content;
    text.classList.add('keycode-subsection');
    keycodes.appendChild(text);
}

export function addKeycodes(parentId) {
    const keySelector = new KeySelector();
    const selector = document.getElementById(parentId);
    if (selector.hasChildNodes()) {
        while (selector.lastElementChild) {
            selector.lastElementChild.remove();
        }
    }
    const cbClicked = keySelector.cbKeyClicked;

    const keys = parseLayoutData(JISKeys);
    const keycodes = document.getElementById(parentId);

    const u = 40; // + 2 // border
    const sep = 1;

    // todo, calculate bbox of the contents
    //       and set it to the parent

    for (let key of keys) {
        const keycode = document.createElement('div');
        const label = key['label'];
        if (label) {
            keycode.innerText = key['label'];
            keycode.setAttribute('keycode', key['keycode']);
            keycode.classList.add('keycode');
            const width = key['width'];
            if (width != 1) {
                const widthName = (width * 100).toString().replace('.', '');
                keycode.classList.add(`keycode-${widthName}`);
            }
            if (width == 1 && label.length > 5) {
                keycode.classList.add('keycode-smaller');
            }
            if (width == 1.25 && label.startsWith('カタカナ')) {
                keycode.classList.add('keycode-smaller');
            }
        } else {
            // spacer
            let width = key['spacer'];
            if (key['newrow']) {
                keycode.classList.add('spacer-newrow');
                if (key['vertspacer']) {
                    const spacer = document.createElement('div');
                    const heightName = (key['vertspacer'] * 100).toString().replace('.', '');
                    keycode.classList.add(`vertspacer-${heightName}`);
                }
            } else {
                while (width > 1) {
                    const spacer = document.createElement('div');
                    spacer.classList.add('spacer-100');
                    keycodes.appendChild(spacer);
                    width -= 1;
                }
                const widthName = (width * 100).toString().replace('.', '');
                keycode.classList.add(`spacer-${widthName}`);
            }

        }
        keycodes.appendChild(keycode);
        keycode.addEventListener('click', cbClicked);
    }

    return keySelector;
}


/**
 * Keeps state of key selected.
 */
export class KeySelector {
    /**
     * Constructor.
     *
     */
    constructor() {
        this.isCtrl = false;
        this.isAlt = false;
        this.isShift = false;
        this.keyCode = '';

        this.ctrlElement = null;
        this.altElement = null;
        this.shiftElement = null;
        this.keyElement = null;
    }

    /**
     * Returns key combination.
     *
     * @returns {string} Key combination.
     */
    getKey() {
        let s = '';
        if (this.isCtrl) {
            s += 'ctrl-';
        }
        if (this.isAlt) {
            s += 'alt-';
        }
        if (this.isShift) {
            s += 'shift-';
        }
        s += this.keyCode.toLowerCase();
        return s;
    }

    /**
     * Clear selected state.
     */
    clearSelected() {
        this.isCtrl = false;
        this.isAlt = false;
        this.isShift = false;
        this.keyCode = '';
        this.markSelected(this.ctrlElement, false);
        this.markSelected(this.altElement, false)
        this.markSelected(this.shiftElement, false);
        this.markSelected(this.keyElement, false);
    }

    /**
     * Call back function when key is clicked.
     *
     * @param {Object} ev Event object when clicked.
     */
    cbKeyClicked = (ev) => {
        const keycode = ev.target.getAttribute('keycode');
        if (keycode != '') {
            this.keyClicked(ev.target);
        }
    }

    /**
     * Process clicked element.
     *
     * @param {HTMLElement} element Clicked element.
     */
    keyClicked(element) {
        const SELECTED = 'shortcut-key-entry-selected';
        const keycode = element.getAttribute('keycode');
        switch (keycode) {
            case 'CTRL': {
                if (this.toggleOrSwitch(this.ctrlElement, element)) {
                    this.ctrlElement = element;
                    this.isCtrl = true;
                } else {
                    this.ctrlElement = null;
                    this.isCtrl = false;
                }
                break;
            }
            case 'ALT': {
                if (this.toggleOrSwitch(this.altElement, element)) {
                    this.altElement = element;
                    this.isAlt = true;
                } else {
                    this.altElement = null;
                    this.isAlt = false;
                }
                break;
            }
            case 'SHIFT': {
                if (this.toggleOrSwitch(this.shiftElement, element)) {
                    this.shiftElement = element;
                    this.isShift = true;
                } else {
                    this.shiftElement = null;
                    this.isShift = false;
                }
                break;
            }
            default: {
                this.keyCode = keycode;
                this.selectAndDeselect(this.keyElement, element);
                this.keyElement = element;
                break;
            }
        }
    }

    /**
     * Toggles selection state between older and new elements.
     *
     * @param {HTMLElement} oldElement Older element to be deselected.
     * @param {HTMLElement} newElement Newer element to be selected.
     * @returns {boolean} Selected or not.
     */
    toggleOrSwitch(oldElement, newElement) {
        if (oldElement == newElement) {
            this.markSelected(oldElement, false);
            return false;
        } else if (oldElement) {
            this.markSelected(oldElement, false);
            this.markSelected(newElement, true);
            return true;
        } else {
            this.markSelected(newElement, true);
            return true;
        }
    }

    /**
     * Select new element and deselect older element.
     *
     * @param {HTMLElement} oldElement Older element going to be deselected.
     * @param {HTMLElement} newElement Newer element going to be selected.
     */
    selectAndDeselect(oldElement, newElement) {
        const SELECTED = 'shortcut-key-entry-selected';
        if (oldElement) {
            this.markSelected(oldElement, false);
        }
        if (newElement) {
            this.markSelected(newElement, true);
        }
    }

    /**
     * Marks element selected.
     *
     * @param {HTMLElement} element Key entry.
     * @param {boolean} state `true` if selected, false otherwise.
     */
    markSelected(element, state) {
        const SELECTED = 'shortcut-key-entry-selected';
        if (element) {
            if (state) {
                element.classList.add(SELECTED);
            } else {
                element.classList.remove(SELECTED);
            }
        }
    }
}
