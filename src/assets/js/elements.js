
/**
 * Helper class to edit HTML Element.
 */
export class ElementTool {
    constructor() {
    }

    addListener(id, type, func, useCapture=false) {
        document.getElementById(id).addEventListener(type, func, useCapture);
    }

    removeListener(id, type, func) {
        document.getElementById(id).removeEventListener(type, func);
    }

    /// Sets or removes 'is-active' class to the specified element for single tool.
    setActive(id, state) {
        const CLASS_NAME = 'is-active';
        const element = document.getElementById(id);
        if (element) {
            if (state) {
                element.classList.add(CLASS_NAME);
            } else {
                element.classList.remove(CLASS_NAME);
            }
        }
    }

    setDisplay(id, state) {
        const CLASS_NAME = 'is-no-display';
        const element = document.getElementById(id);
        if (element) {
            if (state) {
                element.classList.remove(CLASS_NAME);
            } else {
                element.classList.add(CLASS_NAME);
            }
        }
    }

    setiDisplayElement(element, state) {
        const CLASS_NAME = 'is-no-display';
        if (state) {
            element.classList.remove(CLASS_NAME);
        } else {
            element.classList.add(CLASS_NAME);
        }
    }

    /**
     * Returns true if specified element is shown, otherwise false.
     *
     * @param {string} id Element id.
     * @returns {boolean}
     */
     isVisible(id) {
        const CLASS_NAME = 'is-hidden';
        const CLASS_NAME2 = 'is-no-display';
        const element = document.getElementById(id);
        if (element) {
            return !element.classList.contains(CLASS_NAME) ||
                   !element.classList.contains(CLASS_NAME2);
        }
        return false;
    }

    /// Sets or removes 'is-hidden' class.
    setVisible(id, state) {
        const CLASS_NAME = 'is-hidden';
        const element = document.getElementById(id);
        if (element) {
            if (state) {
                element.classList.remove(CLASS_NAME);
            } else {
                element.classList.add(CLASS_NAME);
            }
        }
    }

    setVisibleElement(element, state) {
        const CLASS_NAME = 'is-hidden';
        if (state) {
            element.classList.remove(CLASS_NAME);
        } else {
            element.classList.add(CLASS_NAME);
        }
    }

    /// Sets disabled attribute to the element.
    setDisabled(id, state) {
        const element = document.getElementById(id);
        if (element) {
            if (!state) {
                element.removeAttribute('disabled');
            } else {
                element.setAttribute('disabled', '');
            }
        }
    }

    getElement(id) {
        return document.getElementById(id);;
    }

    /// Returns value as integer.
    getIntValue(id) {
        const element = document.getElementById(id);
        if (element) {
            return parseInt(element.value);
        }
        return null;
    }

    /// Sets integer value.
    setIntValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    setFloatValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    /// Returns value as float.
    getFloatValue(id) {
        const element = document.getElementById(id);
        if (element) {
            return parseFloat(element.value);
        }
        return null;
    }

    /// Returns boolean value from checkbox input.
    getBoolValue(id) {
        const element = document.getElementById(id);
        if (element) {
            return element.checked;
        }
        return null;
    }

    /// Gets value from input.
    getValue(id) {
        const element = document.getElementById(id);
        if (element) {
            return element.value;
        }
        return "";
    }

    /// Sets value to input.
    setValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    /// Sets boolean value to checkbox input.
    setBoolValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.checked = value;
        }
    }

    setText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    getElementTitle(id) {
        const element = document.getElementById(id);
        if (element) {
            return element.title;
        }
        return '';
    }

    setElementTitle(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.title = value;
        }
    }

    setSelectOption(id, value) {
        const targetId = `${id}-${value}`;
        const selector = document.getElementById(id);
        let index = 0;
        for (const option of selector.childNodes) {
            if (option.tagName == 'OPTION') {
                if (option.id == targetId) {
                    selector.selectedIndex = index;
                    break;
                }
                index += 1;
            }
        }
    }

    getSelectOption(id) {
        const selector = document.getElementById(id);
        const index = selector.selectedIndex;
        if (index >= 0) {
            return selector.item(index).id.substring(id.length + 1);
        } else {
            return '';
        }
    }

    getSelectedOption(id) {
        const selector = document.getElementById(id);
        const index = selector.selectedIndex;
        if (index >= 0) {
            return selector.item(index).textContent;
        } else {
            return '';
        }
    }

    /// Checks the item is active element.
    isActiveElement(id) {
        return document.getElementById(id) == document.activeElement;
    }

    focusElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.focus();
            element.select();
        }
    }

    clearSelector(id) {
        const selector = document.getElementById(id);
        while (selector.lastChild) {
            selector.lastChild.remove();
        }
    }

    addOption(parent, text) {
        const option = document.createElement('option');
        option.textContent = text;
        parent.appendChild(option);
        return option;
    }

    addButton(parent, label) {
        const button = document.createElement('input');
        button.setAttribute('type', 'button');
        button.value = label;
        parent.appendChild(button);
        return button;
    }

    remove(id) {
        const item = document.getElementById(id);
        if (item) {
            item.remove();
        }
    }
}
