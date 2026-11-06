// «Twine СИГНАЛЫ»: форма блока «Терминал взлома» (шаг 5.2, решение 103).

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {parseAction, splitBody, writeActions} from '../../util/signaly/signaly-actions';
import {hackLengths, hackWords} from '../../util/signaly/signaly-hack';
import {hackDefaults, HackActions, ScreenBlock, Value} from '../../util/signaly/signaly-screen-blocks';
import {
	CheckField,
	ChoiceField,
	ColorField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {ActionContext, ActionList} from './signaly-action-list';
import {AreaField} from './signaly-block-panel';

export interface HackFormProps extends ActionContext {
	block: ScreenBlock;
	savedColors: string[];
	/** Окно терминала и размер шрифта: не поместится ли поле. */
	winWidth: number;
	fontSize: number;
	write: (next: Omit<ScreenBlock, 'from' | 'to'>) => void;
}

const places = ['top', 'bottom', 'left', 'right'];

export const HackForm: React.FC<HackFormProps> = props => {
	const {block, fileChoice, fontSize, audioFiles, passages, savedColors, winWidth, write} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.blocks.hack.${key}`, options);
	const v = block.values;
	const actions: HackActions = block.hack ?? {win: '', fail: '', miss: ''};
	const set = (key: string, value: Value | undefined) => write({...block, values: {...v, [key]: value}});
	const num = (key: keyof typeof hackDefaults, fallback?: number) =>
		typeof v[key] === 'number' ? (v[key] as number) : fallback ?? (hackDefaults[key] as number);
	const text = (key: keyof typeof hackDefaults) => (v[key] === undefined ? String(hackDefaults[key]) : String(v[key]));
	const range = (
		key: keyof typeof hackDefaults | 'size' | 'misssize',
		label: string,
		min: number,
		max: number,
		value: number,
		unit = '',
		step = 1
	) => <RangeField label={label} max={max} min={min} onChange={next => set(key, next)} step={step} unit={unit} value={value} />;
	const label = (key: keyof typeof hackDefaults, title: string, hint?: string) => (
		<TextField
			hint={hint}
			label={title}
			onChange={value => set(key, value === hackDefaults[key] ? undefined : value)}
			value={text(key).replace(/\n/g, ' / ')}
		/>
	);
	// Две строки итоговой надписи пишутся в поле через « / ».
	const twoLines = (key: 'wintext' | 'failtext', title: string, hint?: string) => (
		<TextField
			hint={hint}
			label={title}
			onChange={value => {
				const next = value.replace(/ ?\/ ?/g, '\n');

				set(key, next === hackDefaults[key] ? undefined : next);
			}}
			value={text(key).replace(/\n/g, ' / ')}
		/>
	);
	const place = (key: string, title: string, value: string) => (
		<ChoiceField
			label={title}
			onChange={next => set(key, next)}
			options={places.map(p => ({label: l(`places.${p}`), value: p}))}
			value={value}
		/>
	);
	const screen = (key: 'win' | 'fail', title: string) => (
		<ChoiceField
			label={title}
			onChange={value => set(key, value || undefined)}
			options={[{label: l('stay'), value: ''}, ...passages.map(p => ({label: p, value: p}))]}
			value={String(v[key] ?? '')}
		/>
	);
	const list = (part: keyof HackActions) => (
		<ActionList
			{...props}
			actions={splitBody(actions[part]).map(parseAction)}
			onChange={next => write({...block, hack: {...actions, [part]: writeActions(next, false).trim()}})}
		/>
	);
	const words = hackWords(v.words);
	const count = num('count');
	const lengths = hackLengths(words, count);
	const rare = lengths.filter(item => !item.usable).map(item => item.size);
	const key = String(v.key ?? '').trim();
	const missPlace = String(v.missplace ?? '');
	const textSize = typeof v.size === 'number' ? v.size : fontSize;
	// Ширина символа моноширинного шрифта — около 0,6 размера текста.
	const fieldWidth = Math.round(
		(num('cols') * num('columns') + num('gap') * (num('columns') - 1)) * textSize * 0.6
	);

	return (
		<>
			<h4 className="signaly-block-subtitle">{l('wordsTitle')}</h4>
			<AreaField hint={l('wordsHint')} label={l('words')} onChange={value => set('words', value)} value={String(v.words ?? '')} />
			<div className="signaly-field-hint">
				{l('stats', {
					list: lengths.map(item => l('statsItem', {size: item.size, found: item.found})).join(', ') || '—'
				})}
			</div>
			{rare.length > 0 && <div className="signaly-field-hint">{l('rare', {list: rare.join(', '), count})}</div>}
			<TextField hint={l('keyHint')} label={l('key')} onChange={value => set('key', value.trim() || undefined)} value={key} />
			{range('count', l('count'), 2, 30, count)}
			{range('attempts', l('attempts'), 1, 12, num('attempts'))}

			<h4 className="signaly-block-subtitle">{l('fieldTitle')}</h4>
			{range('columns', l('columns'), 1, 6, num('columns'))}
			{range('rows', l('rows'), 2, 40, num('rows'))}
			{range('cols', l('cols'), 8, 120, num('cols'))}
			{range('gap', l('gap'), 0, 20, num('gap'))}
			{range('size', l('size'), 8, 60, textSize, 'px')}
			{fieldWidth > winWidth && <div className="signaly-field-hint">{l('tooWide', {width: fieldWidth, win: winWidth})}</div>}
			<TextField
				label={l('chars')}
				onChange={value => set('chars', value === hackDefaults.chars ? undefined : value)}
				value={text('chars')}
			/>
			<CheckField label={l('ownLight')} onChange={on => set('light', on ? '#00cc00' : undefined)} value={v.light !== undefined} />
			{v.light !== undefined && (
				<ColorField
					label={l('light')}
					onChange={value => set('light', value)}
					onSaveColor={() => {}}
					savedColors={savedColors}
					value={String(v.light)}
				/>
			)}
			<CheckField label={l('frame')} onChange={on => set('frame', on || undefined)} value={v.frame === true} />
			<CheckField label={l('usedglitch')} onChange={on => set('usedglitch', on || undefined)} value={v.usedglitch === true} />

			<h4 className="signaly-block-subtitle">{l('hintTitle')}</h4>
			{place('hint', l('hintPlace'), String(v.hint ?? 'bottom'))}
			{label('hinttext', l('hinttext'), l('hinttextHint'))}
			{place('tries', l('triesPlace'), String(v.tries ?? 'bottom'))}
			<ChoiceField
				label={l('triesshow')}
				onChange={value => set('triesshow', value === 'text' ? undefined : value)}
				options={['text', 'boxes', 'both'].map(value => ({label: l(`shows.${value}`), value}))}
				value={String(v.triesshow ?? 'text')}
			/>
			{label('triestext', l('triestext'), l('triestextHint'))}

			<h4 className="signaly-block-subtitle">{l('missTitle')}</h4>
			<div className="signaly-field-hint">{l('missHint')}</div>
			{fileChoice(l('misssound'), String(v.misssound ?? ''), audioFiles, value => set('misssound', value || undefined), l('none'))}
			{v.misssound !== undefined && range('missvolume', l('missvolume'), 0, 100, num('missvolume'), '%')}
			<ChoiceField
				label={l('missfx')}
				onChange={value => set('missfx', value || undefined)}
				options={['', 'flicker', 'flash', 'ripple'].map(value => ({label: l(`fx.${value || 'none'}`), value}))}
				value={String(v.missfx ?? '')}
			/>
			<ChoiceField
				label={l('missplace')}
				onChange={value => set('missplace', value || undefined)}
				options={['', ...places, 'over'].map(value => ({label: l(`labels.${value || 'none'}`), value}))}
				value={missPlace}
			/>
			{missPlace !== '' && label('misslabel', l('misslabel'))}
			{missPlace !== '' &&
				range(
					'misssize',
					l('misssize'),
					16,
					500,
					num('misssize' as keyof typeof hackDefaults, missPlace === 'over' ? hackDefaults.missover : hackDefaults.misssize),
					'px'
				)}
			{missPlace !== '' && (
				<ColorField
					label={l('misscolor')}
					onChange={value => set('misscolor', value)}
					onSaveColor={() => {}}
					savedColors={savedColors}
					value={text('misscolor')}
				/>
			)}
			{(v.missfx === 'flash' || v.missfx === 'flicker') && (
				<ColorField
					label={l('fxcolor')}
					onChange={value => set('fxcolor', value)}
					onSaveColor={() => {}}
					savedColors={savedColors}
					value={text('fxcolor')}
				/>
			)}
			{range('misstime', l('misstime'), 0.2, 5, num('misstime'), l('seconds'), 0.1)}
			<div className="signaly-field-hint">{l('missActions')}</div>
			{list('miss')}

			<h4 className="signaly-block-subtitle">{l('winTitle')}</h4>
			{twoLines('wintext', l('wintext'), l('wintextHint'))}
			{label('winnote', l('winnote'))}
			{list('win')}
			{screen('win', l('win'))}

			<h4 className="signaly-block-subtitle">{l('failTitle')}</h4>
			{twoLines('failtext', l('failtext'), l('failtextHint'))}
			{list('fail')}
			{screen('fail', l('fail'))}
			{range('delay', l('delay'), 0, 10, num('delay'), l('seconds'), 0.5)}
			<div className="signaly-field-hint">{l('hint')}</div>
		</>
	);
};
