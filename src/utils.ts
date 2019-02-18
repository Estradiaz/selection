import { Mode, CSSWriteableStyleDeclarationProperties, Subtype } from "./types";

function eventListener(method: "addEventListener" | "removeEventListener", elements: HTMLCollection | NodeList | Element, events: (keyof GlobalEventHandlersEventMap)[] | keyof GlobalEventHandlersEventMap, fn: EventListener, options: Object = {}) {

    let elements_: Iterable<Subtype<Node, Function>>
    // Normalize array
    if (elements instanceof HTMLCollection || elements instanceof NodeList) {
        elements_ = Array.from(<HTMLCollection | NodeList>elements);
    } else if (!Array.isArray(elements)) {
        elements_ = [elements];
    }

    if (!Array.isArray(events)) events = [events];

    for (const element of elements_) {
        for (const event of events) {
            element[method](event, fn, {capture: false, ...options});
        }
    }

    return Array.prototype.slice.call(arguments, 1);
}

/**
 * Add event(s) to element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
export const on = eventListener.bind(null, 'addEventListener');

/**
 * Remove event(s) from element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
export const off = eventListener.bind(null, 'removeEventListener');

const unitify = (val: string | number, unit = 'px') => typeof val === 'number' ? val + unit : '' + val;

/**
 * Add css to a DOM-Element or returns the current
 * value of a property.
 *
 * @param el The Element.
 * @param attr The attribute or a object which holds css key-properties.
 * @param val The value for a single attribute.
 * @returns {*}
 */
export function css(el: HTMLElement, attr: {[key in CSSWriteableStyleDeclarationProperties]?: string | number } | CSSWriteableStyleDeclarationProperties | null, val: number | string = null) {

    // what the heck is this function 

    const style = el && el.style;
    if (!style) return; //undefined

    if (typeof attr === 'object') {

        for (let prop in attr) {
            style[<CSSWriteableStyleDeclarationProperties>prop] = unitify(attr[<CSSWriteableStyleDeclarationProperties>prop]);
        }
        // undefined
    } else if (val == null) {

        let cssStyleDeclaration: CSSStyleDeclaration
        const dw = document.defaultView;
        if (dw && dw.getComputedStyle) {
            cssStyleDeclaration = dw.getComputedStyle(el, null);
        } 
        // IE6 - deprecated as outdated and unsecure - no need to support
        // else if (el.currentStyle) {
        //     val = el.currentStyle;
        // }

        return attr == null ? cssStyleDeclaration : cssStyleDeclaration[attr]; // CSSStyleDeclaration | string | number
    } else {
        style[attr] = unitify(val);
        // undefined
    }
}

/**
 * Check if two DOM-Elements intersects each other.
 * @param a BoundingClientRect of the first element.
 * @param b BoundingClientRect of the second element.
 * @param mode Options are center, cover or touch.
 * @returns {boolean} If both elements intersects each other.
 */
export function intersects(a: ClientRect | DOMRect, b: ClientRect | DOMRect, mode: Mode = 'touch') {

    if (mode === 'center') {
        const bxc = b.left + b.width / 2;
        const byc = b.top + b.height / 2;

        return bxc >= a.left
            && bxc <= a.right
            && byc >= a.top
            && byc <= a.bottom;
    } else if (mode === 'cover') {
        return b.left >= a.left
            && b.top >= a.top
            && b.right <= a.right
            && b.bottom <= a.bottom;
    } else if (mode === 'touch') {
        return a.right >= b.left
            && a.left <= b.right
            && a.bottom >= b.top
            && a.top <= b.bottom;
    }
}

/**
 * Takes a selector (or array of selectors) and returns the matched nodes.
 * @param selector The selector or an Array of selectors.
 * @returns {Array} Array of DOM-Nodes.
 */
export function selectAll(selector: string | Array<string>) {
    if (!Array.isArray(selector)) selector = [selector];

    const nodes: Array<Element> = [];
    for (const sel of selector) {
        nodes.push(...document.querySelectorAll(sel));
    }

    return nodes;
}

/**
 * Polyfill for safari & firefox for the eventPath event property.
 * @param evt The event object.
 * @return [String] event path.
 */
export function eventPath(evt: Event) {
    let path = /** evt.path  || */ (evt.composedPath && evt.composedPath()); // again ignore M$
    if (path) return path;

    // polyfill
    let el = (<Element>evt.target).parentElement
    path = [evt.target, el];
    while (el = el.parentElement) path.push(el);

    path.push(document, window);
    return path;
}

/**
 * Removes first instance of element from an Array by reference.
 */
export function removeElement(arr: Array<any>, el: Element) {
    const index = arr.indexOf(el);
    if (~index) arr.splice(index, 1);
}


export function simplifyEvent(evt: MouseEvent | TouchEvent) {
    const tap = ((<TouchEvent>evt).touches && (<TouchEvent>evt).touches[0]) || <MouseEvent>evt;
    return {
        tap,
        x: tap.clientX,   
        y: tap.clientY,
        target: <Element>tap.target
    };
}

/**
 * Checks if value is likely a DOM element.
 */
export function isElement(value: any) {
    return (
        typeof HTMLElement === "object"
            ? value instanceof HTMLElement
            : typeof value === "object" && value !== null && value.nodeType === 1 && typeof value.nodeName === "string"
    );
}