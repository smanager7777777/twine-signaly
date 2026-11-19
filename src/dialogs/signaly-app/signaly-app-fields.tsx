// «Twine СИГНАЛЫ»: общие поля форм приложения для телефонов (сессия 33, этап Т3):
// персонажи, блоки, главы, списки строк, действия телефона. Списки для выбора — AppRefs
// (signaly-app-model.ts) через AppRefsContext.

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {AppGame} from '../../util/signaly/signaly-app';
import {actionTypes, appModules, AppRefs, defaultPalette, defaultVoice} from '../../util/signaly/signaly-app-model';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const AppRefsContext = React.createContext<AppRefs>({
	chapters: [{n: 1, name: 'Глава 1'}],
	accounts: [],
	blocks: [],
	notices: [],
	alarms: [],
	glitches: [],
	apps: [],
	votes: [],
	palette: defaultPalette,
	voice: defaultVoice,
	shared: []
});

export function usePhoneL() {
	const {t} = useTranslation();

	return (key: string, options?: Record<string, unknown>) => t(`signaly.phone.${key}`, options);
}

let areaCounter = 0;

/** id поля: подпись — через htmlFor (иначе в имя поля попадает набранный текст). */
function useAreaId() {
	const [id] = React.useState(() => `signaly-phone-area-${++areaCounter}`);

	return id;
}

export const accountLabel = (a: {num: string; name: string}) => `№${a.num}${a.name ? ` ${a.name}` : ''}`;

/** Число в текстовом поле: пишется, когда введено целое (или пусто — 0). */
export const NumField: React.FC<{
	hint?: string;
	label: string;
	min?: number;
	max?: number;
	onChange: (value: number) => void;
	value: number | undefined;
}> = ({hint, label, max, min = 0, onChange, value}) => {
	const [text, setText] = React.useState(String(value ?? 0));

	React.useEffect(() => {
		if (Number(text) !== (value ?? 0) && !(text.trim() === '' && !value)) {
			setText(String(value ?? 0));
		}
	}, [value]); // eslint-disable-line

	return (
		<TextField
			hint={hint}
			label={label}
			onChange={input => {
				setText(input);

				const n = input.trim() === '' ? 0 : Number(input.replace(',', '.'));

				if (isFinite(n)) {
					onChange(Math.max(min, max === undefined ? n : Math.min(max, n)));
				}
			}}
			value={text}
		/>
	);
};

/** Галочки по списку: values — выбранные id. */
const Checks: React.FC<{
	hint?: string;
	label: string;
	items: Array<{id: string; label: string}>;
	empty?: string;
	onChange: (value: string[]) => void;
	value: string[];
}> = ({empty, hint, items, label, onChange, value}) => {
	const missing = value.filter(v => !items.some(i => i.id === v));

	return (
		<div className="signaly-field">
			<div className="signaly-field-label">{label}</div>
			<div className="signaly-codes-people signaly-phone-checks" role="group" aria-label={label}>
				{items.length === 0 && empty && <div className="signaly-field-hint">{empty}</div>}
				{items.map(i => (
					<CheckField
						key={i.id}
						label={i.label}
						onChange={on => onChange(on ? [...value, i.id] : value.filter(v => v !== i.id))}
						value={value.includes(i.id)}
					/>
				))}
				{missing.map(v => (
					<CheckField key={v} label={`? ${v}`} onChange={() => onChange(value.filter(x => x !== v))} value />
				))}
			</div>
			{hint && <div className="signaly-field-hint">{hint}</div>}
		</div>
	);
};

/** Персонажи приложения (id аккаунтов); ничего не отмечено — все. */
export const AccountsField: React.FC<{
	hint?: string;
	label: string;
	onChange: (value: string[]) => void;
	value: unknown;
}> = ({hint, label, onChange, value}) => {
	const refs = React.useContext(AppRefsContext);
	const l = usePhoneL();
	const list = Array.isArray(value) ? value.map(String) : [];

	return (
		<Checks
			empty={l('noAccounts')}
			hint={hint ?? (list.length ? undefined : l('allAccounts'))}
			items={refs.accounts.map(a => ({id: a.id, label: accountLabel(a)}))}
			label={label}
			onChange={onChange}
			value={list}
		/>
	);
};

/** Блоки приложения (id). */
export const BlocksField: React.FC<{
	hint?: string;
	label: string;
	onChange: (value: string[]) => void;
	value: unknown;
}> = ({hint, label, onChange, value}) => {
	const refs = React.useContext(AppRefsContext);
	const l = usePhoneL();

	return (
		<Checks
			empty={l('noBlocks')}
			hint={hint}
			items={refs.blocks.map(b => ({id: b.id, label: b.name}))}
			label={label}
			onChange={onChange}
			value={Array.isArray(value) ? value.map(String) : []}
		/>
	);
};

/** Номера глав галочками; ничего не отмечено — во всех. */
export const ChaptersChecks: React.FC<{
	label: string;
	onChange: (value: number[]) => void;
	value: unknown;
}> = ({label, onChange, value}) => {
	const refs = React.useContext(AppRefsContext);
	const list = Array.isArray(value) ? value.map(Number) : [];

	return (
		<Checks
			items={refs.chapters.map(c => ({id: String(c.n), label: `${c.n}. ${c.name}`}))}
			label={label}
			onChange={v => onChange(v.map(Number).sort((a, b) => a - b))}
			value={list.map(String)}
		/>
	);
};

/** Глава списком; zero — подпись для 0 («нет»). */
export const ChapterField: React.FC<{
	hint?: string;
	label: string;
	onChange: (value: number) => void;
	value: unknown;
	zero?: string;
}> = ({hint, label, onChange, value, zero}) => {
	const refs = React.useContext(AppRefsContext);

	return (
		<ChoiceField
			hint={hint}
			label={label}
			onChange={v => onChange(Number(v))}
			options={[
				...(zero ? [{label: zero, value: '0'}] : []),
				...refs.chapters.map(c => ({label: `${c.n}. ${c.name}`, value: String(c.n)}))
			]}
			value={String(Number(value) || (zero ? 0 : 1))}
		/>
	);
};

/** Список строк (ответы по счёту, варианты голосования). */
export const StringsField: React.FC<{
	addLabel: string;
	itemLabel: (i: number) => string;
	label: string;
	onChange: (value: string[]) => void;
	value: unknown;
}> = ({addLabel, itemLabel, label, onChange, value}) => {
	const {t} = useTranslation();
	const list = Array.isArray(value) ? value.map(String) : [];

	return (
		<div className="signaly-field">
			<div className="signaly-field-label">{label}</div>
			{list.map((s, i) => (
				<div className="signaly-phone-string" key={i}>
					<textarea
						aria-label={itemLabel(i)}
						className="signaly-text signaly-area"
						onChange={e => onChange(list.map((x, k) => (k === i ? e.target.value : x)))}
						placeholder={itemLabel(i)}
						rows={2}
						value={s}
					/>
					<IconButton
						icon={<IconTrash />}
						iconOnly
						label={t('signaly.logic.remove')}
						onClick={() => onChange(list.filter((_, k) => k !== i))}
					/>
				</div>
			))}
			<button className="signaly-button" onClick={() => onChange([...list, ''])} type="button">
				{addLabel}
			</button>
		</div>
	);
};

export const AreaInput: React.FC<{
	hint?: string;
	label: string;
	onChange: (value: string) => void;
	rows?: number;
	value: unknown;
}> = ({hint, label, onChange, rows = 3, value}) => {
	const id = useAreaId();

	return (
		<div className="signaly-field">
			<label className="signaly-field-label" htmlFor={id}>
				{label}
			</label>
			<textarea
				className="signaly-text signaly-area"
				id={id}
				onChange={e => onChange(e.target.value)}
				rows={rows}
				value={String(value ?? '')}
			/>
			{hint && <div className="signaly-field-hint">{hint}</div>}
		</div>
	);
};

export const ColorInput: React.FC<{
	label: string;
	onChange: (value: string) => void;
	value: string;
	extra?: React.ReactNode;
}> = ({extra, label, onChange, value}) => (
	<div className="signaly-field signaly-phone-color">
		<label>
			<input onChange={e => onChange(e.target.value)} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#33ff66'} />{' '}
			{label}
		</label>
		{extra}
	</div>
);

/** Цвета палитры списком; first — подпись пустого значения. */
export function paletteOptions(palette: AppGame[], first: string) {
	return [{label: first, value: ''}, ...palette.map(p => ({label: String(p.name ?? p.id), value: String(p.id)}))];
}

/** Строки списка с кнопками «выше», «ниже», «удалить» (для окна «Приложение»). */
export const ItemList: React.FC<{
	addLabel: string;
	items: AppGame[];
	label: (item: AppGame, i: number) => React.ReactNode;
	onAdd: () => void;
	onChange: (items: AppGame[]) => void;
	onSelect: (i: number) => void;
	selected: number;
	confirmDelete: (item: AppGame) => string;
	canDelete?: (item: AppGame, i: number) => boolean;
	/** Только список, без кнопок (сессия 35: правила — в окне «События»). */
	readOnly?: boolean;
}> = ({addLabel, canDelete, confirmDelete, items, label, onAdd, onChange, onSelect, readOnly, selected}) => {
	const {t} = useTranslation();
	const move = (d: number) => {
		const next = items.slice();
		const [x] = next.splice(selected, 1);

		next.splice(selected + d, 0, x);
		onChange(next);
		onSelect(selected + d);
	};

	return (
		<>
			<div className="signaly-kinds-list">
				{items.map((item, i) => (
					<button
						aria-pressed={i === selected}
						className="signaly-kinds-item"
						key={i}
						onClick={() => onSelect(i)}
						type="button"
					>
						{label(item, i)}
					</button>
				))}
			</div>
			<div className="signaly-sound-actions" hidden={readOnly}>
				<button className="signaly-button" onClick={onAdd} type="button">
					{addLabel}
				</button>
				<IconButton
					disabled={selected <= 0 || selected >= items.length}
					icon={<IconArrowUp />}
					iconOnly
					label={t('signaly.logic.up')}
					onClick={() => move(-1)}
				/>
				<IconButton
					disabled={selected >= items.length - 1}
					icon={<IconArrowDown />}
					iconOnly
					label={t('signaly.logic.down')}
					onClick={() => move(1)}
				/>
				<button
					className="signaly-button"
					disabled={!items[selected] || (canDelete ? !canDelete(items[selected], selected) : false)}
					onClick={() => {
						if (window.confirm(confirmDelete(items[selected]))) {
							onChange(items.filter((_, i) => i !== selected));
							onSelect(Math.max(0, selected - 1));
						}
					}}
					type="button"
				>
					{t('signaly.codes.delete')}
				</button>
			</div>
		</>
	);
};

/* ----- действия телефона (кода или правила) ----- */

/** Новое действие с теми же начальными значениями, что у редактора приложения. */
export function newAction(type: string, self: boolean, refs: AppRefs): AppGame {
	const a: AppGame = {type};

	if (['open', 'notify', 'glitch', 'fix', 'module', 'app', 'color'].includes(type)) {
		a.to = self ? 'self' : [];
	}
	if (type === 'open') {
		a.blocks = [];
	}
	if (type === 'color') {
		a.mode = 'offer';
	}
	if (type === 'glitch' && refs.glitches[0]) {
		a.glitch = refs.glitches[0].id;
	}
	if (type === 'module') {
		a.module = appModules[0];
		a.on = 'on';
	}
	if (type === 'app' && refs.apps[0]) {
		a.app = refs.apps[0].id;
	}
	if (type === 'vote' && refs.votes[0]) {
		a.vote = refs.votes[0].id;
	}
	if (type === 'alarm') {
		a.on = true;
	}
	if (type === 'chapter') {
		a.n = 2;
	}
	if (type === 'countdown') {
		a.seconds = 600;
		a.on = true;
	}
	return a;
}

/** Кому: тому, кто ввёл код (self), всем ([]), выбранным (список id). */
const ToField: React.FC<{a: AppGame; self: boolean; set: (patch: AppGame) => void}> = ({a, self, set}) => {
	const l = usePhoneL();
	const mode =
		a.to === 'self' || (a.to == null && self) ? (self ? 'self' : 'all') : Array.isArray(a.to) && a.to.length ? 'some' : 'all';
	const [some, setSome] = React.useState(mode === 'some');
	const shown = some && mode !== 'self' ? 'some' : mode;

	return (
		<>
			<ChoiceField
				label={l('act.to')}
				onChange={v => {
					setSome(v === 'some');
					set({to: v === 'self' ? 'self' : []});
				}}
				options={[
					...(self ? [{label: l('act.toSelf'), value: 'self'}] : []),
					{label: l('act.toAll'), value: 'all'},
					{label: l('act.toSome'), value: 'some'}
				]}
				value={shown}
			/>
			{shown === 'some' && (
				<AccountsField hint="" label={l('act.toWho')} onChange={to => set({to})} value={Array.isArray(a.to) ? a.to : []} />
			)}
		</>
	);
};

const ActionBody: React.FC<{a: AppGame; self: boolean; set: (patch: AppGame) => void}> = ({a, self, set}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const pick = (list: AppGame[], first?: string) => [
		...(first !== undefined ? [{label: first, value: ''}] : []),
		...list.map(x => ({label: String(x.name || x.title || x.id), value: String(x.id)}))
	];
	const to = <ToField a={a} self={self} set={set} />;
	const text = (key: string, label: string) => (
		<TextField label={label} onChange={v => set({[key]: v})} value={String(a[key] ?? '')} />
	);

	switch (a.type) {
		case 'open':
			return (
				<>
					<BlocksField label={l('act.blocks')} onChange={blocks => set({blocks})} value={a.blocks} />
					{text('title', l('act.openTitle'))}
					{to}
				</>
			);
		case 'notify':
			return (
				<>
					<ChoiceField
						label={l('act.notice')}
						onChange={notice => set({notice})}
						options={pick(refs.notices, l('act.ownText'))}
						value={String(a.notice ?? '')}
					/>
					{text('title', l('act.noticeTitle'))}
					{text('text', l('act.noticeText'))}
					{to}
				</>
			);
		case 'alarm':
			return (
				<>
					<ChoiceField
						label={l('act.alarm')}
						onChange={alarm => set({alarm})}
						options={pick(refs.alarms, l('act.alarmCommon'))}
						value={String(a.alarm ?? '')}
					/>
					<ChoiceField
						label={l('act.what')}
						onChange={v => set({on: v === 'on'})}
						options={[
							{label: l('act.alarmOn'), value: 'on'},
							{label: l('act.alarmOff'), value: 'off'}
						]}
						value={a.on === false ? 'off' : 'on'}
					/>
				</>
			);
		case 'glitch':
		case 'fix':
			return (
				<>
					<ChoiceField
						label={l(a.type === 'glitch' ? 'act.glitch' : 'act.fix')}
						onChange={glitch => set({glitch})}
						options={pick(refs.glitches, a.type === 'fix' ? l('act.fixAll') : undefined)}
						value={String(a.glitch ?? '')}
					/>
					{to}
					{a.type === 'fix' && <div className="signaly-field-hint">{l('act.fixHint')}</div>}
				</>
			);
		case 'module':
			return (
				<>
					<ChoiceField
						label={l('act.module')}
						onChange={module => set({module})}
						options={appModules.map(m => ({label: l(`modules.${m}`), value: m}))}
						value={String(a.module ?? appModules[0])}
					/>
					<ChoiceField
						label={l('act.what')}
						onChange={on => set({on})}
						options={['on', 'broken', 'denied', 'hidden'].map(v => ({label: l(`act.moduleOn.${v}`), value: v}))}
						value={String(a.on ?? 'on')}
					/>
					{to}
				</>
			);
		case 'app':
			return (
				<>
					<ChoiceField label={l('act.app')} onChange={app => set({app})} options={pick(refs.apps)} value={String(a.app ?? '')} />
					{to}
					<div className="signaly-field-hint">{l('act.appHint')}</div>
				</>
			);
		case 'chapter':
			return <ChapterField label={l('act.chapter')} onChange={n => set({n})} value={a.n} />;
		case 'term': {
			const name = String(a.name ?? '').replace(/^\$/, '');
			const shared = refs.shared.some(v => v.name === name);

			return (
				<>
					<ChoiceField
						label={l('act.termName')}
						onChange={n => set({name: n})}
						options={[
							...refs.shared.map(v => ({label: `${v.label || v.name} ($${v.name}) — ${l('act.shared')}`, value: v.name})),
							...(name && !shared ? [{label: `$${name}`, value: name}] : []),
							{label: l('act.termOther'), value: ''}
						]}
						value={name}
					/>
					{!shared && text('name', l('act.termNameOwn'))}
					<ChoiceField
						label={l('act.termOp')}
						onChange={op => set({op: op || undefined})}
						options={[
							{label: l('act.termOps.set'), value: ''},
							{label: l('act.termOps.add'), value: 'add'}
						]}
						value={a.op === 'add' ? 'add' : ''}
					/>
					{text('value', l(a.op === 'add' ? 'act.termAdd' : 'act.termValue'))}
					<div className="signaly-field-hint">{l(shared ? 'act.termSharedHint' : 'act.termHint', {example: `{{${name}}}`})}</div>
				</>
			);
		}
		case 'event':
			return (
				<>
					{text('name', l('act.eventName'))}
					<div className="signaly-field-hint">{l('act.eventHint')}</div>
				</>
			);
		case 'countdown':
			return (
				<>
					<ChoiceField
						label={l('act.what')}
						onChange={v => set({on: v === 'on'})}
						options={[
							{label: l('act.countOn'), value: 'on'},
							{label: l('act.countOff'), value: 'off'}
						]}
						value={a.on === false ? 'off' : 'on'}
					/>
					<NumField label={l('act.seconds')} onChange={seconds => set({seconds})} value={Number(a.seconds) || 0} />
					{text('title', l('act.countTitle'))}
				</>
			);
		case 'vote':
			return <ChoiceField label={l('act.vote')} onChange={vote => set({vote})} options={pick(refs.votes)} value={String(a.vote ?? '')} />;
		case 'color':
			return (
				<>
					<ChoiceField
						label={l('act.what')}
						onChange={mode => set({mode})}
						options={['offer', 'set', 'any-on', 'any-off'].map(v => ({label: l(`act.color.${v}`), value: v}))}
						value={String(a.mode ?? 'offer')}
					/>
					{a.mode === 'set' && (
						<ChoiceField
							label={l('act.colorPick')}
							onChange={color => set({color})}
							options={paletteOptions(refs.palette, l('act.colorDefault'))}
							value={String(a.color ?? '')}
						/>
					)}
					{to}
				</>
			);
	}
	return <div className="signaly-field-hint">{l('act.unknown', {type: a.type})}</div>;
};

/** Список действий телефона; self — есть «тот, кто ввёл код» (у кода), у правила — нет. */
export const AppActions: React.FC<{
	actions: unknown;
	onChange: (actions: AppGame[]) => void;
	self: boolean;
}> = ({actions, onChange, self}) => {
	const {t} = useTranslation();
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const list: AppGame[] = Array.isArray(actions) ? actions : [];
	const move = (i: number, d: number) => {
		const next = list.slice();
		const [x] = next.splice(i, 1);

		next.splice(i + d, 0, x);
		onChange(next);
	};

	return (
		<div className="signaly-action-list signaly-phone-actions">
			{list.length === 0 && <div className="signaly-field-hint">{l('act.none')}</div>}
			{list.map((a, i) => (
				<fieldset className="signaly-block-row" key={i}>
					<legend>
						{`${i + 1}. ${actionTypes.includes(a.type) ? l(`act.types.${a.type}`) : a.type}`}
						<IconButton
							disabled={i === 0}
							icon={<IconArrowUp />}
							iconOnly
							label={t('signaly.logic.up')}
							onClick={() => move(i, -1)}
						/>
						<IconButton
							disabled={i === list.length - 1}
							icon={<IconArrowDown />}
							iconOnly
							label={t('signaly.logic.down')}
							onClick={() => move(i, 1)}
						/>
						<IconButton
							icon={<IconTrash />}
							iconOnly
							label={t('signaly.logic.remove')}
							onClick={() => onChange(list.filter((_, k) => k !== i))}
						/>
					</legend>
					<ActionBody a={a} self={self} set={patch => onChange(list.map((x, k) => (k === i ? {...x, ...patch} : x)))} />
				</fieldset>
			))}
			<ChoiceField
				label={l('act.add')}
				onChange={type => {
					if (type) {
						onChange([...list, newAction(type, self, refs)]);
					}
				}}
				options={[{label: l('act.addPick'), value: ''}, ...actionTypes.map(type => ({label: l(`act.types.${type}`), value: type}))]}
				value=""
			/>
		</div>
	);
};
