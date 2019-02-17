import * as utils from './utils'

export interface Options {
    class?: 'selection-area',
    mode?: Mode,
    startThreshold?: number,
    singleClick?: boolean,
    disableTouch?: boolean,
    validateStart?: (...any) => boolean,
    containers?: [],
    selectables?: [],
    scrollSpeedDivider?: number,
    startareas?: ['html'],
    boundaries?: ['html'],
    selectionAreaContainer?: Element | string
}

export type Mode ='touch' | 'cover' | 'center'
export type Utils = typeof utils

