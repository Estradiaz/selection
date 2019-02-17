/**
 * Selection, library to realize visual DOM-Selection like on your Desktop.
 *
 * @author  Simon Reinisch - TypeScripted: Samuel Ueberle
 * @license MIT
 */
import {Options, Utils} from './types'
import * as utils from './utils'


export class Selection {

    constructor(options: Options = {}){
        Object.assign(this.options, options)
        this.init()
    }

    private options: Options = {
        class: 'selection-area',
        mode: 'cover',
        startThreshold: 0,
        singleClick: false,
        disableTouch: true,
        validateStart: () => null,
        containers: [],
        selectables: [],
        scrollSpeedDivider: 10,
        startareas: ['html'],
        boundaries: ['html'],
        selectionAreaContainer: 'body'
    }
    private selectedStore: any[]
    = []
    private areaElement: HTMLDivElement
    = document.createElement('div')
    private clippingElement: HTMLDivElement 
    = document.createElement('div')
    private scrollAvailable: boolean 
    = true
    private scrollSpeed: {x: number, y: number} 
    = {x: null, y: null}
    private selectionAreaContainer: Element = null
    private areaStartX: number = 0
    private areaStartY: number = 0
    private areaEndX: number = 0
    private areaEndY: number = 0
    private boundaries: Element[] = []
    private touchedElements: Element[] = []
    private targetBoundary:  ClientRect | DOMRect
    private targetContainer: Element
    private selectables: Element[]
    private singleClick: boolean = false
    private changedElements: {
        added: Element[],
        removed: Element[]
    }

    private init() {

        // Append area to container
        if (this.utils.isElement(this.options.selectionAreaContainer)) {
            this.selectionAreaContainer = <Element>this.options.selectionAreaContainer;
        } else {
            this.selectionAreaContainer = document.querySelector(<string>this.options.selectionAreaContainer);
        }

        this.clippingElement.appendChild(this.areaElement);
        this.selectionAreaContainer.appendChild(this.clippingElement);

        // Apply basic styles to the area element
        this.utils.css(
            this.areaElement, 
            {
                top: 0,
                left: 0,
                position: 'fixed'
            }
        );

        this.utils.css(
            this.clippingElement,
            {
                overflow: 'hidden',
                position: 'fixed',
                transform: 'translate3d(0, 0, 0)', // https://stackoverflow.com/a/38268846
                'pointer-events': 'none'
            }
        );

        this.enable();
    }

    private bindStartEvents(type: string){
        this.utils[type]
        (document, 'mousedown', this.onTapStart)
        if(!this.options.disableTouch){
            this.utils[type]
            (document, 'touchstart', this.onTapStart, {passive: false})
        }
    }
    private onTapStart(e: TouchEvent){
        const {x, y, target} = this.utils.simplifyEvent(e)
        const targetBondaryClientRect = target.getBoundingClientRect()

        if(this.options.validateStart(e)){
            return undefined;
        }

        const startAreas = this.utils.selectAll(this.options.startareas)
        this.boundaries = this.utils.selectAll(this.options.boundaries)

        const evtpath = this.utils.eventPath(e)
        if(
            !startAreas.find(el => evtpath.includes(el)) ||
            !this.boundaries.find(el => evtpath.includes(el))
        ) return undefined;

        this.areaStartX = x;
        this.areaStartY = y;

        this.areaEndX = 0;
        this.areaEndY = 0;

        this.singleClick = true

        this.resolveSelectables()

        this.targetContainer = this.boundaries.find(
            el => this.utils.intersects(
                el.getBoundingClientRect(),
                targetBondaryClientRect
            )
        )

        this.targetBoundary = this.targetContainer.getBoundingClientRect()
        this.touchedElements = []
        this.changedElements = {
            added: [],
            removed: []
        }

        if(
            Math.round(
                this.targetContainer.scrollHeight
            ) 
            !== Math.round(
                this.targetBoundary.height
            ) ||
            Math.round(
                this.targetContainer.scrollWidth
            )
            !== Math.round(
                this.targetBoundary.width
            )
        ) {
            this.scrollAvailable = true

            this.utils.on(window, 'wheel', this.manualScroll)
            this.selectables = this.selectables.filter(s => this.targetContainer.contains(s))

            let {top, left, width, height} = this.targetBoundary
            this.utils.css(
                this.clippingElement, {
                    top, left, width, height
                }
            )

            this.utils.css(
                this.areaElement, {
                    'margin-top': -top,
                    'margin-left': -left
                }
            )
        } else {
            this.scrollAvailable = false

            this.utils.css(
                this.clippingElement,
                {
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }
            )
            this.utils.css(
                this.areaElement, {
                    'margin-top': 0,
                    'margin-left': 0
                }
            )
        }

        this.areaElement.classList.add(this.options.class);

        this.utils.on(document, 'mousemove', this.delayedTapMove)
        this.utils.on(document, 'touchmove', this.delayedTapMove, {
            passive: false
        })

        this.utils.on(document, ['mouseup', 'touchcancel', 'touchend'], this.onTapStop)

        e.preventDefault()
    }
    private onSingleTap(e: TouchEvent){
        let {target} = this.utils.simplifyEvent(e)

        while(this.selectables.includes(target)){
            if(target.parentElement){
                target = target.parentElement
            } else {
                return undefined;
            }
        }

        this.touchedElements.push(target);
        this.dispatchEvent('onSelect', e, {target})
    }
    private delayedTapMove(e: TouchEvent){
        let {x , y} = this.utils.simplifyEvent(e)

        if(Math.abs(x + y) - (this.areaStartX + this.areaStartY) >= this.options.startThreshold){

            this.utils.off(document, ['mousemove', 'touchmove'], this.delayedTapMove)
            this.utils.on(document, ['mousemove', 'touchmove'], this.onTapMove)
            this.utils.css(
                this.areaElement,
                'display',
                'block'
            )
            this.onTapMove(e)
            this.dispatchEvent('onStart', e)
            this.singleClick = false
        }
    }
    private onTapMove(e: TouchEvent){
        let {x , y} = this.utils.simplifyEvent(e)
        this.areaEndX = x;
        this.areaEndY = y;
        
        if(this.scrollAvailable && (this.scrollSpeed.y !== null || this.scrollSpeed.x !== null)){
            const scrollContainer = this.targetContainer
            
            let scroll = (t: number) => {
        
                if(this.scrollSpeed.y === null && this.scrollSpeed.x === null){
        
                    return undefined;
                }
        
                const {scrollTop, scrollLeft} = scrollContainer
                if(this.scrollSpeed.y !== null){
                    scrollContainer.scrollLeft += Math.ceil(this.scrollSpeed.y / this.options.scrollSpeedDivider)
                    this.areaStartY -= scrollContainer.scrollTop - scrollTop
                }

                if(this.scrollSpeed.x !== null){
                    scrollContainer.scrollLeft += Math.ceil(this.scrollSpeed.x / this.options.scrollSpeedDivider)
                    this.areaStartX -= scrollContainer.scrollLeft - scrollLeft
                }

                this.redrawArea()
                this.updatedTouchingElements()
                this.dispatchEvent('onMove', e)

                requestAnimationFrame(scroll)
            }
            requestAnimationFrame(scroll)
        } else {

            this.redrawArea()
            this.updatedTouchingElements()
            this.dispatchEvent('onMove', e)
        }
    }
    private manualScroll(e: WheelEvent){

        this.scrollSpeed.x += this.options.scrollSpeedDivider * e.deltaX
        this.scrollSpeed.y += this.options.scrollSpeedDivider * e.deltaY
        this.onTapMove(
            <TouchEvent>Object.assign(
                e, 
                {
                    changedTouches: new TouchList(),
                    targetTouches: new TouchList(),
                    touches:  new TouchList()
                }
            )
        )
        e.preventDefault()
    }
    private redrawArea(){
        const {
            scrollHeight,
            scrollWidth,
            scrollLeft,
            scrollTop,
            clientHeight,
            clientWidth,
        } = this.targetContainer    

        const boundaryRect = this.targetBoundary
        let x = this.areaEndX, y = this.areaEndY

        if(x < boundaryRect.left){
            this.scrollSpeed.x = scrollLeft ? -Math.abs(boundaryRect.left - x) : null
            x = boundaryRect.left
        } else
        if(x > boundaryRect.left + boundaryRect.width){
            this.scrollSpeed.x = scrollWidth - scrollLeft - clientWidth ? -Math.abs(boundaryRect.left + boundaryRect.width - x) : null
            x = boundaryRect.left + boundaryRect.width
        } else
        if(true){
            this.scrollSpeed.x = null
        }
        
        if(y < boundaryRect.top){
            this.scrollSpeed.y = scrollTop ? -Math.abs(boundaryRect.top - y) : null
            y = boundaryRect.top
        } else
        if(y > boundaryRect.top + boundaryRect.height){
            this.scrollSpeed.y = scrollHeight - scrollTop - clientHeight ? -Math.abs(boundaryRect.top + boundaryRect.height - y) : null
            y = boundaryRect.top + boundaryRect.height
        } else
        if(true){
            this.scrollSpeed.y = null
        }
            
        this.utils.css(
            this.areaElement,
            {
                top: Math.min(this.areaStartX, x),
                left: Math.min(this.areaStartY, y),
                width: Math.max(this.areaStartX, x),
                height: Math.max(this.areaStartY, y)
            }
        )
    }
    private preventDefault(e: Event){
        e.preventDefault()
    }
    private onTapStop(e: TouchEvent, noEvent: boolean){

        this.utils.off(
            document,
            ['mousemove', 'touchmove'],
            this.delayedTapMove
        )
        this.utils.off(
            document,
            ['mousemove', 'touchmove'],
            this.onTapMove
        )
        this.utils.off(
            document,
            ['mouseup', 'touchcancel', 'touchend'],
            this.onTapStop
        )

        if(this.singleClick && this.options.singleClick){
            this.onSingleTap(e)
        } else
        if(!this.singleClick && !noEvent){
            this.updatedTouchingElements()
            this.dispatchEvent('onStop', e)
        }
        this.scrollSpeed = {x: null, y: null}

        this.utils.off(window, 'wheel', this.manualScroll)

        this.utils.off(document, 'selectstart', this.preventDefault(e))

        this.utils.css(
            this.areaElement,
            'display',
            'none'
        )
    }
    private updatedTouchingElements(){
        const touched = [], 
            changed = {added: [], removed: []},
            mode = this.options.mode,
            selectables = this.selectables,
            areaRect = this.areaElement.getBoundingClientRect(),
            intersects = this.utils.intersects

            for(let selectable of selectables){

                if(intersects(areaRect, selectable.getBoundingClientRect(), mode)){
                    if(this.dispatchFilterEvent('selectionFilter', selectable) !== false){

                        if(!this.touchedElements.includes(selectable)){
                            changed.added.push(selectable)
                        }
                        touched.push(selectable)
                    }
                }
            }

            for(let touchedElement of this.touchedElements){
                if(!touched.includes(touchedElement)){
                    changed.removed.push(touchedElement)
                }
            }
        
            this.touchedElements = touched
            this.changedElements = changed
    }
    private dispatchFilterEvent(eventName: string, element: Element): boolean {
    
        const event = this.options[eventName]
        if(typeof event === 'function'){

            return event.call(this, {selection: this, eventName, element})
        }
    }
    private dispatchEvent(eventName: string, originalEvent: Event, additional?: Object){
        const event = this.options[eventName]

        if(typeof event === 'function'){
            return event.call(
                this, 
                {
                    selection: this,
                    areaElement: this.areaElement,
                    selectedElements: this.touchedElements.concat(this.selectedStore),
                    changedElements: this.changedElements,
                    eventName,
                    originalEvent,
                    ...additional
                }
            )
        }
    }

    public resolveSelectables(): void{
        this.selectables = this.utils.selectAll(this.options.selectables)
        const containers = this.utils.selectAll(this.options.containers)
        for (let container of containers){
            this.selectables.push(...container.querySelectorAll('*'))
        }
    }
    public keepSelection(){
        for(let touchedElement of this.touchedElements){
            if(!this.selectedStore.includes(touchedElement)){
                this.selectedStore.push(touchedElement)
            }
        }
    }
    public clearSelection(){
        this.selectedStore = []
    }
    public removeFromSelection(element: Element){
        this.utils.removeElement(this.selectedStore, element)
        this.utils.removeElement(this.touchedElements, element)
    }
    public get Selection(){

        return this.selectedStore
    }
    public cancel(keepEvent = false){
        this.onTapStop(null, !keepEvent)
    }
    public option(name: string, value?: any) {
        const {options} = this
        return value == null ? options[name] : (options[name] = value)
    }
    public disable(){
        this.bindStartEvents('off')
    }
    public destroy(){
        this.disable()
        this.selectionAreaContainer.removeChild(this.clippingElement)
    }
    public enable(){
        this.bindStartEvents('on')
    }

    public utils: Utils = {...utils}
    public readonly version: string = '0.2.2'
}
export function create(options?: Options){
    return new Selection(options || {})
}
export default Selection