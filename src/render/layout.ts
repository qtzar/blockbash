import { FIELD_H, FIELD_W } from '../sim/tuning';
import { VIEW_H, VIEW_W } from './canvas';

/** Where the playfield sits in the 1280×720 view. The side panels hold the HUD. */
export const FIELD_X = (VIEW_W - FIELD_W) / 2;
export const FIELD_Y = VIEW_H - FIELD_H - 24;
export const FIELD_CX = FIELD_X + FIELD_W / 2;
export const LEFT_PANEL_X = 28;
export const RIGHT_PANEL_X = FIELD_X + FIELD_W + 28;
