import * as utils from './utils'
import Selection from './selection';

export type ChangedElements = {
    added: Element[]
    removed: Element[]
}
export type TriggerEvent = {
    selection: Selection,
    eventName: string,
    areaElement: Element
    originalEvent: Event
    selectedElements: Element[]
    changedElements: ChangedElements
}
export type SelectEvent = {
    target: Element
} & TriggerEvent
export type FilterEvent = {
    selection: Selection
    eventName: string
    element: Element
}
export type Options = {
    class?: string,
    mode?: Mode,
    startThreshold?: number,
    singleClick?: boolean,
    disableTouch?: boolean,
    containers?: string[],
    selectables?: string[],
    scrollSpeedDivider?: number,
    startareas?: string[],
    boundaries?: string[],
    selectionAreaContainer?: Element | string
    onStart(e: TriggerEvent): void
    onSelect(e: SelectEvent): void
    onMove(e: TriggerEvent): void
    onStop(e: TriggerEvent): void
    validateStart(...any: any[]): boolean,
    selectionFilter(e: FilterEvent): boolean   
}

export type Mode ='touch' | 'cover' | 'center'
export type Utils = typeof utils
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type CSSWriteableStyleDeclarationProperties = Extract<keyof Omit<CSSStyleDeclaration ,'length' | 'parentRule'>, string>
export type FilterFlags<Base, Condition> = {
    [key in keyof Base]: Base[key] extends Condition ? key : never
}
export type AllowedNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base]

export type Subtype<Base, Condition> = Pick<Base, AllowedNames<Base, Condition>> 


