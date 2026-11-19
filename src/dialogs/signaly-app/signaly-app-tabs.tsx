// «Twine СИГНАЛЫ»: вкладки окна «Приложение» (сессия 33, этап Т3 — claude/13 раздел 6б,
// ответы Т3-1 А, Т3-3 А): Общее, Главы и стили, Приборы, Сеть и события, Голос. Формы правят
// общие настройки пакета (пассаж «Приложение», JSON по строке на запись) и — где нужно —
// персонажей и коды телефона в таблице «Коды». Поля — как во вкладках редактора приложения.

import * as React from 'react';
import {AppGame, jsonText} from '../../util/signaly/signaly-app';
import {
	defaultChat,
	defaultPalette,
	defaultPhoto,
	defaultTexts,
	defaultTheme,
	defaultVoice,
	glitchEffects,
	newChapter,
	newItem,
	normCode,
	parseObject,
	randomDigits,
	themeColors,
	uid,
	voiceHints,
	voiceModes
} from '../../util/signaly/signaly-app-model';
import {CodeTable, newEntry, TableCode} from '../../util/signaly/signaly-codes';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {withVoiceMode, voiceModeOf} from '../signaly-codes/signaly-phone-person-form';
import {
	accountLabel,
	AccountsField,
	AppActions,
	AppRefsContext,
	AreaInput,
	ChapterField,
	ChaptersChecks,
	ColorInput,
	ItemList,
	NumField,
	paletteOptions,
	StringsField,
	usePhoneL
} from './signaly-app-fields';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Сессия 34: «Блоки» (Т3-11 А), «QR» и «SSTV» (Т3-8 А) — signaly-app-blocks.tsx, signaly-app-media-tabs.tsx.
export type AppTab = 'pack' | 'general' | 'chapters' | 'blocks' | 'apps' | 'events' | 'voice' | 'qr' | 'sstv';
export const appTabs: AppTab[] = ['pack', 'general', 'chapters', 'blocks', 'apps', 'events', 'voice', 'qr', 'sstv'];
export type EventsSub = 'notices' | 'alarms' | 'glitches' | 'rules' | 'votes';
export const eventsSubs: EventsSub[] = ['notices', 'alarms', 'glitches', 'rules', 'votes'];

export interface TabProps {
	game: AppGame;
	setGame: (game: AppGame) => void;
	table: CodeTable;
	setTable: (table: CodeTable) => void;
	sel: Record<string, number>;
	setSel: (key: string, i: number) => void;
}

const list = (game: AppGame, key: string): AppGame[] => (Array.isArray(game[key]) ? game[key] : []);

/** Код телефона для таблицы «Коды» (только телефон). */
export function phoneEntry(code: string, label: string, data: AppGame): TableCode {
	return {...newEntry(), code, label, where: 'phone', phone: jsonText({id: uid('k'), ...data})};
}

function usedCodes(game: AppGame, table: CodeTable) {
	return new Set<string>([
		normCode(game.masterCode),
		normCode(game.settingsCode),
		...list(game, 'chapters').map(c => normCode(c.code)),
		...table.codes.map(c => normCode(c.code)),
		...table.people.map(p => normCode(parseObject(p.phone)?.login))
	]);
}

/* ----- Общее ----- */

export const GeneralTab: React.FC<TabProps> = ({game, setGame, table}) => {
	const l = usePhoneL();
	const set = (patch: AppGame) => setGame({...game, ...patch});
	const sub = (key: string, defaults: AppGame) => ({...defaults, ...(game[key] ?? {})});
	const setSub = (key: string, patch: AppGame) => set({[key]: {...(game[key] ?? {}), ...patch}});
	const chat = sub('chat', defaultChat);
	const photo = sub('photo', defaultPhoto);
	const texts = sub('texts', defaultTexts);
	const palette: AppGame[] = list(game, 'palette').length ? list(game, 'palette') : defaultPalette;
	const chatColors = [
		{label: l('general.colorReader'), value: ''},
		{label: l('general.colorWhite'), value: '#ffffff'},
		{label: l('general.colorBlack'), value: '#000000'},
		...palette.map(p => ({label: String(p.name), value: String(p.id)}))
	];

	return (
		<>
			<h3>{l('general.pack')}</h3>
			<TextField label={l('general.title')} onChange={title => set({title})} value={String(game.title ?? '')} />
			<NumField hint={l('general.versionHint')} label={l('general.version')} min={1} onChange={version => set({version: Math.round(version)})} value={Number(game.version) || 1} />
			<TextField hint={l('general.masterCodeHint')} label={l('general.masterCode')} onChange={masterCode => set({masterCode})} value={String(game.masterCode ?? '')} />
			<button className="signaly-button" onClick={() => set({masterCode: randomDigits(8, usedCodes(game, table))})} type="button">
				{l('person.random')}
			</button>
			<TextField label={l('general.masterComment')} onChange={masterComment => set({masterComment})} value={String(game.masterComment ?? '')} />
			<h3>{l('general.sounds')}</h3>
			<CheckField label={l('general.soundsOn')} onChange={sounds => set({sounds})} value={game.sounds !== false} />
			<TextField hint={l('general.settingsCodeHint')} label={l('general.settingsCode')} onChange={settingsCode => set({settingsCode})} value={String(game.settingsCode ?? '0000')} />
			<h3>{l('general.chat')}</h3>
			<TextField hint={l('general.masterHint')} label={l('general.master')} onChange={master => setSub('chat', {master})} value={String(chat.master)} />
			<TextField label={l('general.masterProf')} onChange={masterProf => setSub('chat', {masterProf})} value={String(chat.masterProf)} />
			<CheckField label={l('general.masterContact')} onChange={masterContact => setSub('chat', {masterContact})} value={!!chat.masterContact} />
			<TextField hint={l('general.anonHint')} label={l('general.anon')} onChange={anon => setSub('chat', {anon})} value={String(chat.anon)} />
			<NumField label={l('general.delayMax')} max={240} min={1} onChange={delayMax => setSub('chat', {delayMax: Math.round(delayMax)})} value={Number(chat.delayMax) || 60} />
			<CheckField label={l('general.noPaste')} onChange={noPaste => setSub('chat', {noPaste})} value={chat.noPaste !== false} />
			<ChoiceField label={l('general.bossColor')} onChange={bossColor => setSub('chat', {bossColor})} options={chatColors} value={String(chat.bossColor ?? '')} />
			<ChoiceField hint={l('general.anonColorHint')} label={l('general.anonColor')} onChange={anonColor => setSub('chat', {anonColor})} options={chatColors} value={String(chat.anonColor ?? '')} />
			<h3>{l('general.palette')}</h3>
			<div className="signaly-field-hint">{l('general.paletteHint')}</div>
			{palette.map((p, i) => (
				<ColorInput
					extra={
						<>
							<input
								aria-label={l('general.colorName', {n: i + 1})}
								className="signaly-text"
								onChange={e => set({palette: palette.map((x, k) => (k === i ? {...x, name: e.target.value} : x))})}
								value={String(p.name ?? '')}
							/>
							<button
								className="signaly-button"
								disabled={palette.length < 2}
								onClick={() => set({palette: palette.filter((_, k) => k !== i)})}
								type="button"
							>
								{l('general.colorRemove')}
							</button>
						</>
					}
					key={String(p.id) + i}
					label=""
					onChange={color => set({palette: palette.map((x, k) => (k === i ? {...x, color} : x))})}
					value={String(p.color)}
				/>
			))}
			<div className="signaly-sound-actions">
				<button className="signaly-button" onClick={() => set({palette: [...palette, {id: uid('k'), name: l('general.newColor'), color: '#ffffff'}]})} type="button">
					{l('general.colorAdd')}
				</button>
				<button className="signaly-button" onClick={() => set({palette: defaultPalette.map(p => ({...p}))})} type="button">
					{l('general.paletteDefault')}
				</button>
			</div>
			<h3>{l('general.keyboardTitle')}</h3>
			<ChoiceField
				hint={l('general.keyboardHint')}
				label={l('general.keyboard')}
				onChange={keyboard => set({keyboard})}
				options={[
					{label: l('general.keyboardOwn'), value: 'own'},
					{label: l('general.keyboardSys'), value: 'sys'}
				]}
				value={game.keyboard === 'sys' ? 'sys' : 'own'}
			/>
			<CheckField hint={l('general.firstRunHint')} label={l('general.firstRun')} onChange={firstRun => set({firstRun})} value={game.firstRun !== false} />
			<h3>{l('general.photo')}</h3>
			<ColorInput label={l('general.photoTint')} onChange={tint => setSub('photo', {tint})} value={String(photo.tint)} />
			<ChoiceField
				label={l('general.photoPixel')}
				onChange={v => setSub('photo', {pixel: Number(v)})}
				options={['1', '2', '3', '5', '8'].map(v => ({label: l(`general.pixel.${v}`), value: v}))}
				value={String(photo.pixel ?? 3)}
			/>
			<TextField label={l('general.photoStamp')} onChange={stampText => setSub('photo', {stampText})} value={String(photo.stampText ?? '')} />
			{(['mono', 'grain', 'scan', 'stamp'] as const).map(k => (
				<CheckField key={k} label={l(`general.photoFlag.${k}`)} onChange={v => setSub('photo', {[k]: v})} value={photo[k] !== false} />
			))}
			<h3>{l('general.texts')}</h3>
			{Object.keys(defaultTexts).map(k => (
				<TextField key={k} label={l(`general.text.${k}`)} onChange={v => setSub('texts', {[k]: v})} value={String(texts[k] ?? '')} />
			))}
		</>
	);
};

/* ----- Главы и стили ----- */

export const ChaptersTab: React.FC<TabProps> = ({game, sel, setGame, setSel, table}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const chapters = list(game, 'chapters');
	const i = Math.min(sel.chapters ?? 0, chapters.length - 1);
	const c = chapters[i];
	const set = (patch: AppGame) => setGame({...game, chapters: chapters.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const theme = {...defaultTheme, ...(c?.theme ?? {})};
	const setTheme = (patch: AppGame) => set({theme: {...theme, ...patch}});
	const colors: string[] = Array.isArray(c?.colors) ? c.colors : [];

	return (
		<div className="signaly-phone-split">
			<div className="signaly-phone-list">
				<ItemList
					addLabel={l('chapters.add')}
					canDelete={() => chapters.length > 1}
					confirmDelete={x => l('confirmDelete', {name: x.name})}
					items={chapters}
					label={(x, k) => (
						<>
							<span className="signaly-keys-item-combo">{k === 0 ? l('chapters.first') : x.code || '—'}</span>
							{`${k + 1}. ${x.name ?? ''}`}
						</>
					)}
					onAdd={() => {
						setGame({...game, chapters: [...chapters, newChapter(chapters[chapters.length - 1], chapters.length + 1, usedCodes(game, table))]});
						setSel('chapters', chapters.length);
					}}
					onChange={next => setGame({...game, chapters: next})}
					onSelect={k => setSel('chapters', k)}
					selected={i}
				/>
				<div className="signaly-field-hint">{l('chapters.orderHint')}</div>
			</div>
			{c && (
				<div className="signaly-phone-form">
					<TextField label={l('chapters.name')} onChange={name => set({name})} value={String(c.name ?? '')} />
					{i === 0 ? (
						<div className="signaly-field-hint">{l('chapters.firstHint')}</div>
					) : (
						<>
							<TextField hint={l('chapters.codeHint')} label={l('chapters.code')} onChange={code => set({code})} value={String(c.code ?? '')} />
							<AreaInput label={l('chapters.message')} onChange={message => set({message})} value={c.message} />
						</>
					)}
					<ChoiceField
						hint={l('chapters.jamHint')}
						label={l('chapters.jam')}
						onChange={v => set({jam: Number(v)})}
						options={['0', '1', '2', '3'].map(v => ({label: l(`chapters.jamN.${v}`), value: v}))}
						value={String(Number(c.jam) || 0)}
					/>
					<h3>{l('chapters.colorsTitle')}</h3>
					<div className="signaly-field-hint">{l('chapters.colorsHint')}</div>
					<div className="signaly-codes-people" role="group" aria-label={l('chapters.colorsTitle')}>
						{refs.palette.map(p => (
							<CheckField
								key={String(p.id)}
								label={String(p.name)}
								onChange={on => set({colors: on ? [...colors, p.id] : colors.filter(x => x !== p.id)})}
								value={colors.includes(p.id)}
							/>
						))}
					</div>
					<ChoiceField hint={l('chapters.forceHint')} label={l('chapters.force')} onChange={force => set({force})} options={paletteOptions(refs.palette, l('chapters.forceNone'))} value={String(c.force ?? '')} />
					<CheckField label={l('chapters.senderColor')} onChange={senderColor => set({senderColor})} value={!!c.senderColor} />
					<CheckField label={l('chapters.colorReset')} onChange={colorReset => set({colorReset})} value={!!c.colorReset} />
					<NumField hint={l('chapters.decodeHint')} label={l('chapters.decode')} max={120} onChange={decode => set({decode: Math.round(decode)})} value={Number(c.decode) || 0} />
					<h3>{l('chapters.style')}</h3>
					<div className="signaly-phone-sample" style={{background: theme.bg, border: `1px solid ${theme.dim}`, color: theme.text}}>
						<div style={{background: theme.panel, color: theme.accent}}>{l('chapters.sampleName')}</div>
						<div style={{color: theme.dim}}>{l('chapters.sampleSection')}</div>
						<div>{l('chapters.sampleText')}</div>
						<div style={{color: theme.accent}}>{l('chapters.sampleAccent')}</div>
						<div style={{color: theme.warn}}>{l('chapters.sampleWarn')}</div>
					</div>
					{themeColors.map(k => (
						<ColorInput key={k} label={l(`chapters.theme.${k}`)} onChange={v => setTheme({[k]: v})} value={String(theme[k])} />
					))}
					{(['scanlines', 'glow', 'flicker'] as const).map(k => (
						<CheckField key={k} label={l(`chapters.theme.${k}`)} onChange={v => setTheme({[k]: v})} value={!!theme[k]} />
					))}
					<ChoiceField
						label={l('chapters.font')}
						onChange={font => setTheme({font})}
						options={['mono', 'courier', 'sans'].map(v => ({label: l(`chapters.fonts.${v}`), value: v}))}
						value={String(theme.font ?? 'mono')}
					/>
					<div className="signaly-sound-actions">
						<button className="signaly-button" disabled={i === 0} onClick={() => set({theme: {...defaultTheme, ...(chapters[0].theme ?? {})}})} type="button">
							{l('chapters.likeFirst')}
						</button>
						<button className="signaly-button" onClick={() => set({theme: {...defaultTheme}})} type="button">
							{l('chapters.themeDefault')}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

/* ----- Приборы ----- */

export const DevicesTab: React.FC<TabProps> = ({game, sel, setGame, setSel, setTable, table}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const apps = list(game, 'apps');
	const i = Math.min(sel.apps ?? 0, Math.max(0, apps.length - 1));
	const a = apps[i];
	const set = (patch: AppGame) => setGame({...game, apps: apps.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const phoneOf = (e: TableCode) => (e.where === 'phone' || e.where === 'both' ? parseObject(e.phone) : undefined);
	const codes = a ? table.codes.filter(e => phoneOf(e)?.app === a.id) : [];
	const openers = a
		? table.codes.filter(e => (phoneOf(e)?.actions ?? []).some((x: AppGame) => x?.type === 'app' && x.app === a.id))
		: [];
	const add = (entries: TableCode[]) => setTable({...table, codes: [...table.codes, ...entries]});

	return (
		<div className="signaly-phone-split">
			<div className="signaly-phone-list">
				<div className="signaly-field-hint">{l('apps.intro')}</div>
				<ItemList
					addLabel={l('apps.add')}
					confirmDelete={x => l('confirmDelete', {name: x.name})}
					items={apps}
					label={x => (
						<>
							{String(x.name ?? '')}
							<span className="signaly-sound-file">{l('apps.codesN', {n: table.codes.filter(e => phoneOf(e)?.app === x.id).length})}</span>
						</>
					)}
					onAdd={() => {
						setGame({...game, apps: [...apps, newItem.apps()]});
						setSel('apps', apps.length);
					}}
					onChange={next => setGame({...game, apps: next})}
					onSelect={k => setSel('apps', k)}
					selected={i}
				/>
			</div>
			{a && (
				<div className="signaly-phone-form">
					<TextField label={l('apps.name')} onChange={name => set({name})} value={String(a.name ?? '')} />
					<TextField label={l('apps.title')} onChange={title => set({title})} value={String(a.title ?? '')} />
					<TextField label={l('apps.hint')} onChange={hint => set({hint})} value={String(a.hint ?? '')} />
					<TextField hint={l('apps.unknownHint')} label={l('apps.unknown')} onChange={unknown => set({unknown})} value={String(a.unknown ?? '')} />
					<ColorInput
						extra={
							<button className="signaly-button" onClick={() => set({color: ''})} type="button">
								{l('apps.colorChapter')}
							</button>
						}
						label={a.color ? l('apps.color') : l('apps.colorNone')}
						onChange={color => set({color})}
						value={String(a.color || '#33ff66')}
					/>
					<h3>{l('apps.whoTitle')}</h3>
					<AccountsField label={l('apps.who')} onChange={who => set({who})} value={a.who} />
					<ChapterField label={l('apps.chapter')} onChange={chapter => set({chapter})} value={a.chapter} />
					<CheckField label={l('apps.start')} onChange={start => set({start})} value={a.start !== false} />
					{a.start === false && (
						<div className="signaly-field">
							<div className="signaly-field-label">{l('apps.openers')}</div>
							<div className="signaly-field-hint">{openers.length ? openers.map(e => e.code || '—').join(', ') : l('apps.openersNone')}</div>
							<button
								className="signaly-button"
								onClick={() =>
									add([
										phoneEntry(randomDigits(4, usedCodes(game, table)), l('apps.openNote', {name: a.name}), {
											who: Array.isArray(a.who) ? [...a.who] : [],
											deniedAsWrong: true,
											chapter: Number(a.chapter) || 1,
											actions: [{type: 'app', app: a.id, to: 'self'}]
										})
									])
								}
								type="button"
							>
								{l('apps.addOpener')}
							</button>
						</div>
					)}
					<h3>{l('apps.usesTitle')}</h3>
					<NumField hint={l('apps.usesHint')} label={l('apps.uses')} onChange={uses => set({uses: Math.round(uses)})} value={Number(a.uses) || 0} />
					<CheckField label={l('apps.showUses')} onChange={showUses => set({showUses})} value={!!a.showUses} />
					<TextField label={l('apps.emptyText')} onChange={emptyText => set({emptyText})} value={String(a.emptyText ?? '')} />
					<h3>{l('apps.codesTitle', {n: codes.length})}</h3>
					<div className="signaly-field-hint">{l('apps.codesHint')}</div>
					<table className="signaly-phone-table">
						<tbody>
							{codes.map((e, k) => (
								<tr key={k}>
									<td>
										<b>{e.code || '—'}</b>
									</td>
									<td>{e.label}</td>
									<td>{String(phoneOf(e)?.answer ?? '').slice(0, 40)}</td>
								</tr>
							))}
						</tbody>
					</table>
					<div className="signaly-sound-actions">
						<button className="signaly-button" onClick={() => add([phoneEntry(randomDigits(4, usedCodes(game, table)), String(a.name ?? ''), {app: a.id})])} type="button">
							{l('apps.addCode')}
						</button>
						<button
							className="signaly-button"
							onClick={() => {
								const made = table.people
									.map(p => parseObject(p.phone))
									.filter((acc): acc is AppGame => !!acc && !!acc.login)
									.filter(acc => !codes.some(e => normCode(e.code) === normCode(acc.login)))
									.map(acc => phoneEntry(String(acc.login), `${a.name}: ${acc.name ?? ''}`, {app: a.id}));

								add(made);
								window.alert(made.length ? l('apps.badgesMade', {n: made.length}) : l('apps.badgesNone'));
							}}
							type="button"
						>
							{l('apps.addBadges')}
						</button>
					</div>
					<div className="signaly-field-hint">{l('apps.codesWhere')}</div>
				</div>
			)}
			{!a && <div className="signaly-field-hint">{l('apps.none')}</div>}
			{refs.accounts.length === 0 && <div className="signaly-field-hint">{l('noAccounts')}</div>}
		</div>
	);
};

/* ----- Сеть и события ----- */

const eventLabel = (sub: EventsSub, x: AppGame, l: (k: string, o?: Record<string, unknown>) => string) => {
	if (sub === 'rules') {
		return `${x.name || x.event || '—'} · ${
			x.on === 'chapter'
				? l('rules.shortChapter', {n: x.chapter, m: x.minutes})
				: x.on === 'every'
				? l('rules.shortEvery', {m: x.minutes})
				: x.on === 'var'
				? l('rules.shortVar', {name: x.var, op: l(`rules.ops.${x.op || '='}`), value: x.value})
				: l('rules.shortEvent')
		}`;
	}
	if (sub === 'glitches') {
		return `${x.state ? '◆' : '⚠'} ${x.name ?? ''}`;
	}
	return String(x.name || x.title || x.id);
};

/** Сессия 35 (Т4-4 А): правило центра (условие на телефонах) — форма для окна «События». */
export const PhoneRuleForm: React.FC<{rule: AppGame; set: (patch: AppGame) => void}> = ({rule: x, set}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const str = (key: string) => String(x?.[key] ?? '');
	const on = str('on') || 'event';

	return (
		<>
			<TextField label={l('events.name')} onChange={name => set({name})} value={str('name')} />
			<ChoiceField
				label={l('rules.on')}
				onChange={v => set({on: v})}
				options={['event', 'chapter', 'every', 'var'].map(v => ({label: l(`rules.onN.${v}`), value: v}))}
				value={on}
			/>
			{on === 'event' && (
				<TextField hint={l('rules.eventHint')} label={l('rules.event')} onChange={event => set({event})} value={str('event')} />
			)}
			{on === 'chapter' && <ChapterField label={l('rules.chapter')} onChange={chapter => set({chapter})} value={x.chapter} />}
			{(on === 'chapter' || on === 'every') && (
				<NumField label={l('rules.minutes')} onChange={minutes => set({minutes})} value={Number(x.minutes) || 0} />
			)}
			{on === 'var' && (
				<>
					<ChoiceField
						hint={refs.shared.length ? undefined : l('rules.noShared')}
						label={l('rules.var')}
						onChange={v => set({var: v})}
						options={[
							{label: '—', value: ''},
							...refs.shared.map(v => ({label: `${v.label || v.name} ($${v.name})`, value: v.name})),
							...(str('var') && !refs.shared.some(v => v.name === str('var')) ? [{label: `$${str('var')} ?`, value: str('var')}] : [])
						]}
						value={str('var')}
					/>
					<ChoiceField
						label={l('rules.op')}
						onChange={op => set({op})}
						options={['=', '!=', '>', '>=', '<', '<='].map(v => ({label: l(`rules.ops.${v}`), value: v}))}
						value={str('op') || '='}
					/>
					<TextField hint={l('rules.valueHint')} label={l('rules.value')} onChange={value => set({value})} value={str('value')} />
				</>
			)}
			{on !== 'chapter' && <ChaptersChecks label={l('rules.chapters')} onChange={chapters => set({chapters})} value={x.chapters} />}
			<h3>{l('code.actions')}</h3>
			<AppActions actions={x.actions} onChange={actions => set({actions})} self={false} />
		</>
	);
};

/** Подпись правила центра в списке. */
export function ruleLabel(x: AppGame, l: (k: string, o?: Record<string, unknown>) => string) {
	return eventLabel('rules', x, l);
}

export const EventsTab: React.FC<TabProps & {sub: EventsSub; setSub: (s: EventsSub) => void}> = props => {
	const {game, sel, setGame, setSel, setSub, setTable, sub, table} = props;
	const l = usePhoneL();
	const items = list(game, sub);
	const i = Math.min(sel[sub] ?? 0, Math.max(0, items.length - 1));
	const x = items[i];
	const set = (patch: AppGame) => setGame({...game, [sub]: items.map((y, k) => (k === i ? {...y, ...patch} : y))});
	const addCode = (label: string, data: AppGame) =>
		setTable({...table, codes: [...table.codes, phoneEntry(randomDigits(4, usedCodes(game, table)), label, data)]});
	const str = (key: string) => String(x?.[key] ?? '');

	function form() {
		if (!x) {
			return <div className="signaly-field-hint">{l('events.none')}</div>;
		}
		switch (sub) {
			case 'notices':
				return (
					<>
						<TextField label={l('events.name')} onChange={name => set({name})} value={str('name')} />
						<TextField label={l('notices.title')} onChange={title => set({title})} value={str('title')} />
						<AreaInput label={l('notices.text')} onChange={text => set({text})} value={x.text} />
						<AccountsField label={l('notices.to')} onChange={to => set({to})} value={x.to} />
						<ChapterField label={l('notices.chapter')} onChange={chapter => set({chapter})} value={x.chapter} zero={l('notices.manual')} />
						<NumField label={l('notices.minutes')} onChange={minutes => set({minutes})} value={Number(x.minutes) || 0} />
						<div className="signaly-field-hint">{l('notices.hint')}</div>
					</>
				);
			case 'alarms':
				return (
					<>
						<TextField label={l('events.name')} onChange={name => set({name})} value={str('name')} />
						<TextField label={l('alarms.title')} onChange={title => set({title})} value={str('title')} />
						<AreaInput label={l('alarms.text')} onChange={text => set({text})} value={x.text} />
						{(['red', 'full', 'siren', 'vibrate', 'torch', 'jam'] as const).map(k => (
							<CheckField key={k} label={l(`alarms.flag.${k}`)} onChange={v => set({[k]: v})} value={x[k] !== false} />
						))}
						<div className="signaly-sound-actions">
							<button className="signaly-button" onClick={() => addCode(l('alarms.codeOnNote', {name: x.name}), {actions: [{type: 'alarm', alarm: x.id, on: true}]})} type="button">
								{l('alarms.addOn')}
							</button>
							<button className="signaly-button" onClick={() => addCode(l('alarms.codeOffNote'), {actions: [{type: 'alarm', on: false}]})} type="button">
								{l('alarms.addOff')}
							</button>
						</div>
					</>
				);
			case 'glitches': {
				const fx: string[] = Array.isArray(x.fx) ? x.fx : [];
				const kind = str('kind') || 'visual';

				return (
					<>
						<TextField label={l('glitches.name')} onChange={name => set({name})} value={str('name')} />
						<ChoiceField
							label={l('glitches.state')}
							onChange={v => set({state: v === 'true'})}
							options={[
								{label: l('glitches.isGlitch'), value: 'false'},
								{label: l('glitches.isState'), value: 'true'}
							]}
							value={x.state ? 'true' : 'false'}
						/>
						<ChoiceField
							label={l('glitches.kind')}
							onChange={v => set({kind: v})}
							options={['visual', 'scanner', 'fake'].map(v => ({label: l(`glitches.kinds.${v}`), value: v}))}
							value={kind}
						/>
						{kind === 'visual' && (
							<div className="signaly-codes-people" role="group" aria-label={l('glitches.fx')}>
								{glitchEffects.map(f => (
									<CheckField key={f} label={l(`glitches.fxN.${f}`)} onChange={on => set({fx: on ? [...fx, f] : fx.filter(y => y !== f)})} value={fx.includes(f)} />
								))}
							</div>
						)}
						<AreaInput label={l(kind === 'fake' ? 'glitches.fakeText' : 'glitches.text')} onChange={text => set({text})} rows={2} value={x.text} />
						{kind !== 'fake' && (
							<>
								<NumField hint={l('glitches.secondsHint')} label={l('glitches.seconds')} onChange={seconds => set({seconds: Math.round(seconds)})} value={x.seconds == null ? 20 : Number(x.seconds) || 0} />
								<ChoiceField
									label={l('glitches.fix')}
									onChange={fix => set({fix})}
									options={['time', 'shake', 'code'].map(v => ({label: l(`glitches.fixN.${v}`), value: v}))}
									value={str('fix') || 'time'}
								/>
							</>
						)}
						<h3>{l('glitches.random')}</h3>
						<NumField hint={l('glitches.everyHint')} label={l('glitches.every')} onChange={every => set({every: Math.round(every)})} value={Number(x.every) || 0} />
						<ChaptersChecks label={l('glitches.chapters')} onChange={chapters => set({chapters})} value={x.chapters} />
						<AccountsField label={l('glitches.who')} onChange={who => set({who})} value={x.who} />
						<div className="signaly-sound-actions">
							<button className="signaly-button" onClick={() => addCode(String(x.name ?? ''), {actions: [{type: 'glitch', glitch: x.id, to: 'self'}]})} type="button">
								{l('glitches.addCode')}
							</button>
							<button className="signaly-button" onClick={() => addCode(l('glitches.fixNote', {name: x.name}), {actions: [{type: 'fix', glitch: x.id}]})} type="button">
								{l('glitches.addFix')}
							</button>
						</div>
					</>
				);
			}
			case 'rules':
				// Сессия 35 (Т4-4 А): правила правятся в окне «События» — здесь только список.
				return <div className="signaly-field-hint">{l('rules.inEvents')}</div>;
			case 'votes':
				return (
					<>
						<TextField label={l('events.name')} onChange={name => set({name})} value={str('name')} />
						<TextField label={l('votes.title')} onChange={title => set({title})} value={str('title')} />
						<StringsField
							addLabel={l('votes.addOption')}
							itemLabel={k => l('votes.option', {n: k + 1})}
							label={l('votes.options')}
							onChange={options => set({options})}
							value={x.options}
						/>
						<NumField label={l('votes.seconds')} min={15} onChange={seconds => set({seconds: Math.round(seconds)})} value={Number(x.seconds) || 120} />
						<NumField hint={l('votes.everyHint')} label={l('votes.every')} onChange={every => set({every: Math.round(every)})} value={Number(x.every) || 0} />
						{Number(x.every) > 0 && <ChaptersChecks label={l('votes.chapters')} onChange={chapters => set({chapters})} value={x.chapters} />}
						<TextField hint={l('votes.termHint')} label={l('votes.term')} onChange={term => set({term})} value={str('term')} />
						<AccountsField label={l('votes.to')} onChange={to => set({to})} value={x.to} />
					</>
				);
		}
	}

	return (
		<>
			<div className="signaly-tabs" role="tablist">
				{eventsSubs.map(name => (
					<button aria-selected={sub === name} className="signaly-tab" key={name} onClick={() => setSub(name)} role="tab" type="button">
						{l(`events.subs.${name}`, {n: list(game, name).length})}
					</button>
				))}
			</div>
			<div className="signaly-field-hint">{l(`events.intro.${sub}`)}</div>
			<div className="signaly-phone-split">
				<div className="signaly-phone-list">
					<ItemList
						readOnly={sub === 'rules'}
						addLabel={l('events.add')}
						confirmDelete={y => l('confirmDelete', {name: y.name || y.id})}
						items={items}
						label={y => eventLabel(sub, y, l)}
						onAdd={() => {
							setGame({...game, [sub]: [...items, newItem[sub]()]});
							setSel(sub, items.length);
						}}
						onChange={next => setGame({...game, [sub]: next})}
						onSelect={k => setSel(sub, k)}
						selected={i}
					/>
				</div>
				<div className="signaly-phone-form">{form()}</div>
			</div>
		</>
	);
};

/* ----- Голос ----- */

export const VoiceTab: React.FC<TabProps> = ({game, setGame, setTable, table}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const voice = {...defaultVoice, ...(game.voice ?? {})};
	const setVoice = (patch: AppGame) => setGame({...game, voice: {...(game.voice ?? {}), ...patch}});
	const phrases = table.codes
		.map((e, index) => ({e, index, d: e.where === 'phone' || e.where === 'both' ? parseObject(e.phone) : undefined}))
		.filter(x => x.d && String(x.d.voice ?? '').trim() !== '');
	const setPhone = (index: number, patch: AppGame) =>
		setTable({
			...table,
			codes: table.codes.map((e, k) => (k === index ? {...e, phone: jsonText({...parseObject(e.phone), ...patch}), raw: undefined} : e))
		});
	const setPerson = (index: number, data: AppGame) =>
		setTable({...table, people: table.people.map((p, k) => (k === index ? {...p, phone: jsonText(data), raw: undefined} : p))});
	const whoShort = (who: unknown) =>
		Array.isArray(who) && who.length
			? who.map(id => refs.accounts.find(a => a.id === id)?.name || `?${id}`).join(', ')
			: l('voice.whoAll');

	return (
		<>
			<div className="signaly-field-hint">{l('voice.intro')}</div>
			<h3>{l('voice.general')}</h3>
			<ChoiceField
				hint={l('voice.minConfHint')}
				label={l('voice.minConf')}
				onChange={v => setVoice({minConf: Number(v)})}
				options={['0.4', '0.5', '0.6', '0.7', '0.8'].map(v => ({label: l(`voice.conf.${v.replace('.', '_')}`), value: v}))}
				value={String(Math.round(Number(voice.minConf) * 10) / 10)}
			/>
			<ChoiceField
				hint={l('voice.sensHint')}
				label={l('voice.sens')}
				onChange={v => setVoice({sens: Number(v)})}
				options={['0', '1', '2'].map(v => ({label: l(`voice.sensN.${v}`), value: v}))}
				value={String(voice.sens ?? 1)}
			/>
			<CheckField label={l('voice.digits')} onChange={digits => setVoice({digits})} value={voice.digits !== false} />
			<TextField label={l('voice.comment')} onChange={comment => setVoice({comment})} value={String(voice.comment ?? '')} />
			<h3>{l('voice.who')}</h3>
			<table className="signaly-phone-table">
				<tbody>
					{table.people.map((p, index) => {
						const d = parseObject(p.phone);

						if (!d) {
							return null;
						}

						const mode = voiceModeOf(d);
						const n = phrases.filter(x => x.d!.term || !Array.isArray(x.d!.who) || !x.d!.who.length || x.d!.who.includes(String(d.id || `n${p.id}`))).length;

						return (
							<tr key={p.id}>
								<td>
									<b>{accountLabel({num: p.id, name: String(d.name ?? '')})}</b>
								</td>
								<td>
									<ChoiceField
										label={l('voice.modeOf', {name: d.name || p.id})}
										onChange={v => setPerson(index, withVoiceMode(d, v))}
										options={voiceModes.map(v => ({label: l(`voiceModes.${v}`), value: v}))}
										value={mode}
									/>
								</td>
								<td>
									{mode !== 'off' && (
										<ChoiceField
											label={l('voice.chapterOf', {name: d.name || p.id})}
											onChange={v => setPerson(index, {...d, modChapter: {...(d.modChapter ?? {}), voice: Number(v)}})}
											options={refs.chapters.map(c => ({label: l('person.fromChapter', {n: c.n}), value: String(c.n)}))}
											value={String(d.modChapter?.voice || 1)}
										/>
									)}
								</td>
								<td>{l('voice.phrasesN', {n})}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<div className="signaly-field-hint">{l('voice.whoHint')}</div>
			<h3>{l('voice.phrases', {n: phrases.length})}</h3>
			{phrases.length === 0 && <div className="signaly-field-hint">{l('voice.noPhrases')}</div>}
			{phrases.map(({d, e, index}) => {
				const hints = voiceHints(voice.unknown, String(d!.voice));

				return (
					<fieldset className="signaly-block-row" key={index}>
						<legend>
							{`🎙 ${d!.voice}`}
							{e.code ? ` · ${e.code}` : ''}
						</legend>
						<TextField label={l('code.voice')} onChange={v => setPhone(index, {voice: v})} value={String(d!.voice ?? '')} />
						{hints.length > 0 && <div className="signaly-notice">{hints.map(h => l(`voiceWhy.${h.why}`, {word: h.word})).join(' ')}</div>}
						<div className="signaly-field-hint">
							{l('voice.phraseInfo', {who: whoShort(d!.who), chapter: d!.chapter || 1, code: e.code || l('voice.onlyVoice'), label: e.label || '—'})}
							{d!.term ? ` ${l('voice.forTerminal')}` : ''}
						</div>
						<NumField label={l('code.voiceMax')} onChange={voiceMax => setPhone(index, {voiceMax: Math.round(voiceMax)})} value={Number(d!.voiceMax) || 0} />
						<NumField label={l('code.voiceEvery')} onChange={voiceEvery => setPhone(index, {voiceEvery: Math.round(voiceEvery)})} value={Number(d!.voiceEvery) || 0} />
					</fieldset>
				);
			})}
			<button
				className="signaly-button"
				onClick={() => setTable({...table, codes: [...table.codes, phoneEntry('', l('voice.newPhraseNote'), {voice: l('voice.newPhrase')})]})}
				type="button"
			>
				{l('voice.addPhrase')}
			</button>
			<div className="signaly-field-hint">{l('voice.phrasesHint')}</div>
			<h3>{l('voice.unknownTitle')}</h3>
			<AreaInput hint={l('voice.unknownHint')} label={l('voice.unknown')} onChange={unknown => setVoice({unknown})} rows={2} value={voice.unknown} />
			<h3>{l('voice.battery')}</h3>
			<div className="signaly-field-hint signaly-pre">{l('voice.batteryText')}</div>
		</>
	);
};
