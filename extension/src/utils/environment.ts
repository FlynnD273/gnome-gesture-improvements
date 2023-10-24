/* eslint-disable @typescript-eslint/no-explicit-any */

import { Actor, AnimationMode } from 'gi://Clutter';
import GObject from 'gi://GObject';
import { Adjustment } from 'gi://St';

declare type EaseParamsType<T extends GObject.Object> = {
	duration: number;
	mode: AnimationMode;
	repeatCount?: number;
	autoReverse?: boolean;
	onStopped?: (isFinished?: boolean) => void;
} & { [P in KeysOfType<T, number>]?: number };

export function easeActor<T extends Actor>(actor: T, params: EaseParamsType<T>): void {
	(actor as any).ease(params);
}

export function easeAdjustment(actor: Adjustment, value: number, params: EaseParamsType<Adjustment>): void {
	(actor as any).ease(value, params);
}
