/**
 * Selection, library to realize visual DOM-Selection like on your Desktop.
 *
 * @author  Simon Reinisch - TypeScripted: Samuel Ueberle
 * @license MIT
 */
import {Options, Utils, ChangedElements} from './types'
import * as utils from './utils'




export class Selection {

    

    private options: Options = {
        class: 'selection-area',
        startThreshold: 10,
        disableTouch: false,
        mode: 'touch',
        singleClick: true,
        containers: [],
        selectables: [],
        startareas: ['html'],
        boundaries: ['html'],
        selectionAreaContainer: 'body',
        scrollSpeedDivider: 10,
        validateStart(evt) {
            evt; // MouseEvent or TouchEvent
            console.log(evt)
            return true;
        },
        onStart(evt) {
            evt.selection;
            evt.eventName;
            evt.areaElement;
            evt.originalEvent;
            evt.selectedElements;
            evt.changedElements;
        },
        onSelect(evt) {
        evt.target; // Clicked element
        },
        onMove(evt) {
        },
        onStop(evt) {
        },
        selectionFilter(evt) {
            evt.selection; // This selection instance
            evt.eventName; // The event name
            evt.element;   // The element which is in the current selection
            return true
        }
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
    private changedElements: ChangedElements

    constructor(options: Options){
        if(options)
        Object.assign(this.options, options)
        console.log(options, this.options)
        this.init()
    }


    private init() {


        this.onTapMove = this.onTapMove.bind(this)
        this.onTapStart = this.onTapStart.bind(this)
        this.onTapStop = this.onTapStop.bind(this)
        this.onSingleTap = this.onSingleTap.bind(this)
        this.manualScroll = this.manualScroll.bind(this)
        this.delayedTapMove = this.delayedTapMove.bind(this)
        
        
        // Append area to container
        if (utils.isElement(this.options.selectionAreaContainer)) {
            this.selectionAreaContainer = <Element>this.options.selectionAreaContainer;
        } else {
            this.selectionAreaContainer = document.querySelector(<string>this.options.selectionAreaContainer);
        }

        this.clippingElement.appendChild(this.areaElement);
        this.selectionAreaContainer.appendChild(this.clippingElement);

        // Apply basic styles to the area element
        utils.css(
            this.areaElement, 
            {
                top: 0,
                left: 0,
                position: 'fixed'
            }
        );

        utils.css(
            this.clippingElement,
            {
                overflow: 'hidden',
                position: 'fixed',
                transform: 'translate3d(0, 0, 0)', // https://stackoverflow.com/a/38268846
                pointerEvents: 'none'
            }
        );

        this.enable();
    }

    private bindStartEvents(type: keyof Utils){
        utils[type]
        (document, 'mousedown', this.onTapStart)
        if(!this.options.disableTouch){
            utils[type]
            (document, 'touchstart', this.onTapStart, {passive: false})
        }
    }
    private onTapStart(e: TouchEvent): undefined{
        console.log(this)
        const {x, y, target} = utils.simplifyEvent(e)
        const targetBondaryClientRect = target.getBoundingClientRect()

        if(!this.options.validateStart(e)){
            return undefined;
        }

        const startAreas = utils.selectAll(this.options.startareas)
        this.boundaries = utils.selectAll(this.options.boundaries)

        const evtpath = utils.eventPath(e)
        if(
            !startAreas.find(el => evtpath.includes(el)) ||
            !this.boundaries.find(el => evtpath.includes(el))
        ) return undefined;

        this.areaStartX = x;
        this.areaStartY = y;
            console.log(x, y, this.areaStartX, this.areaStartY)
        this.areaEndX = 0;
        this.areaEndY = 0;

        this.singleClick = true

        this.resolveSelectables()

        this.targetContainer = this.boundaries.find(
            el => utils.intersects(
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

            
            utils.on(window, 'wheel', this.manualScroll)
            this.selectables = this.selectables.filter(s => this.targetContainer.contains(s))

            let {top, left, width, height} = this.targetBoundary
            utils.css(
                this.clippingElement, {
                    "top": top, 
                    left, width, height
                }
            )

            utils.css(
                this.areaElement, {
                    marginTop: -top,
                    marginLeft: -left
                }
            )
        } else {
            this.scrollAvailable = false

            utils.css(
                this.clippingElement,
                {
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }
            )
            utils.css(
                this.areaElement, {
                    marginTop: 0,
                    marginLeft: 0
                }
            )
        }

        this.areaElement.classList.add(this.options.class);

        
        utils.on(document, 'mousemove', this.delayedTapMove)
        utils.on(document, 'touchmove', this.delayedTapMove, {
            passive: false
        })

        
        utils.on(document, ['mouseup', 'touchcancel', 'touchend'], this.onTapStop)

        e.preventDefault()
    }
    private onSingleTap(e: TouchEvent): void{
        let {target} = utils.simplifyEvent(e)

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
        let {x , y} = utils.simplifyEvent(e)

        if(Math.abs(x + y) - (this.areaStartX + this.areaStartY) >= this.options.startThreshold){

            utils.off(document, ['mousemove', 'touchmove'], this.delayedTapMove);
            utils.on(document, ['mousemove', 'touchmove'], this.onTapMove);
            utils.css(
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
        let {x , y} = utils.simplifyEvent(e)
        this.areaEndX = x;
        this.areaEndY = y;
        
        if(this.scrollAvailable && (this.scrollSpeed.y !== null || this.scrollSpeed.x !== null)){
            const scrollContainer = this.targetContainer
            
            let scroll = (t: number):void => {
        
                if(this.scrollSpeed.y === null && this.scrollSpeed.x === null){
        
                    return undefined;
                }
        
                const {scrollTop, scrollLeft} = scrollContainer
                if(this.scrollSpeed.y !== null){
                    scrollContainer.scrollTop += Math.ceil(this.scrollSpeed.y / this.options.scrollSpeedDivider)
                    this.areaStartY -= scrollContainer.scrollTop - scrollTop
                }

                if(this.scrollSpeed.x !== null){
                    scrollContainer.scrollLeft += Math.ceil(this.scrollSpeed.x / this.options.scrollSpeedDivider)
                    this.areaStartX -= scrollContainer.scrollLeft - scrollLeft
                }

                this.redrawArea()
                this.updatedTouchingElements()
                this.dispatchEvent('onMove', e)

                requestAnimationFrame(scroll.bind(this))
            }
            requestAnimationFrame(scroll.bind(this))
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
            this.scrollSpeed.x = scrollWidth - scrollLeft - clientWidth ? Math.abs(boundaryRect.left + boundaryRect.width - x) : null
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
            this.scrollSpeed.y = scrollHeight - scrollTop - clientHeight ? Math.abs(boundaryRect.top + boundaryRect.height - y) : null
            y = boundaryRect.top + boundaryRect.height
        } else
        if(true){
            this.scrollSpeed.y = null
        }
            
        utils.css(
            this.areaElement,
            {
                left: Math.min(this.areaStartX, x),
                top: Math.min(this.areaStartY, y),
                width: Math.max(this.areaStartX, x) - Math.min(this.areaStartX, x),
                height: Math.max(this.areaStartY, y) - Math.min(this.areaStartY, y)
            }
        )
    }
    private preventDefault(e: Event){
        e.preventDefault()
    }
    private onTapStop(e: TouchEvent, noEvent: boolean){

        console.log('tabstop', utils)
        utils.off(
            document,
            ['mousemove', 'touchmove'],
            this.delayedTapMove
        )
        utils.off(
            document,
            ['mousemove', 'touchmove'],
            this.onTapMove
        )
        utils.off(
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

        utils.off(window, 'wheel', this.manualScroll)

        utils.off(document, 'selectstart', this.preventDefault(e))

        utils.css(
            this.areaElement,
            'display',
            'none'
        )
    }
    private updatedTouchingElements(){
        const touched = [], 
            changed: ChangedElements = {added: [], removed: []},
            mode = this.options.mode,
            selectables = this.selectables,
            areaRect = this.areaElement.getBoundingClientRect(),
            intersects = utils.intersects

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
    private dispatchFilterEvent(eventName: keyof Options, element: Element): boolean {
    
        const event = this.options[eventName]
        if(typeof event === 'function'){

            return event.call(this, {selection: this, eventName, element})
        }
    }
    private dispatchEvent(eventName: keyof Options, originalEvent: Event, additional?: Object){
        const event = this.options[eventName]

        if(typeof event === 'function'){
            return event.call(
                this, 
                {
                    selection: this,
                    eventName,
                    areaElement: this.areaElement,
                    originalEvent,
                    selectedElements: this.touchedElements.concat(this.selectedStore),
                    changedElements: this.changedElements,
                    ...additional
                }
            )
        }
    }

    public resolveSelectables(): void{
        this.selectables = utils.selectAll(this.options.selectables)
        const containers = utils.selectAll(this.options.containers)
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
        utils.removeElement(this.selectedStore, element)
        utils.removeElement(this.touchedElements, element)
    }
    public get Selection(){

        return this.selectedStore
    }
    public cancel(keepEvent = false){
        this.onTapStop(null, !keepEvent)
    }
    public option(name: keyof Options, value?: any) {
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
    public static create(options?: Options){
        return new Selection(options)
    }

    public utils: Utils = utils
    public readonly version: string = '0.2.2'

    
}
export function create(options?: Options){
    return new Selection(options)
}
export default Selection