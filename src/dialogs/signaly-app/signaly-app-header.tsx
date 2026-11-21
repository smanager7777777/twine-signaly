// «Twine СИГНАЛЫ»: вкладка «Шапка и меню» окна «Приложение» (сессия 36, ответ Т4-6 Б).
// Шапка телефона: строки (пусто — имя и профессия; {name} {prof} {chapter}, {{имя}}), глава справа,
// показатели общих переменных (подпись или без, числом или квадратиками), окно-сводка по нажатию
// (разделы: заголовок, текст, кому, с главы). Нижнее меню: порядок, свои названия, скрытые вкладки.
// Хранится в пакете как game.header и game.menu (как SG.normHeader приложения).
// Сессия 37 (П15): строки шапки по главам (header.chapters, Т6-3 Б), у показателя — порог тревоги
// (low, lowColor, Т6-4 Б), вид делений (look), по ширине экрана (fit), перегрузка (over); пределы общих
// переменных (game.limits); у вкладки меню — с главы и кому (Т6-5 Б).
// Сессия 38 (П16): слои перезаполнения шкалы (layers — эффект и цвет; предел — деления × слои), нажатие на части
// шапки (header.taps.who / .chapter, у показателя tap — {kind, title, text, block}, Т6-8 Б), текст окна главы (about).

import * as React from 'react';
import {AppGame} from '../../util/signaly/signaly-app';
import {defaultHeader, fullMenu, menuValue, uid} from '../../util/signaly/signaly-app-model';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {AccountsField, AppRefsContext, AreaInput, ChapterField, ColorInput, NumField, usePhoneL} from './signaly-app-fields';
import {TabProps} from './signaly-app-tabs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const HeaderTab: React.FC<TabProps> = ({game, setGame}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const header: AppGame = {...defaultHeader, ...(game.header ?? {})};
	const items: any[] = Array.isArray(header.items) ? header.items : [];
	const info: any[] = Array.isArray(header.info) ? header.info : [];
	const setHeader = (patch: AppGame) => {
		const next: AppGame = {...header, ...patch};

		// undefined — поле убрать (значение по умолчанию не пишется).
		Object.keys(patch).forEach(k => patch[k] === undefined && delete next[k]);
		setGame({...game, header: next});
	};
	const setItem = (i: number, patch: AppGame) => setHeader({items: items.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const setInfo = (i: number, patch: AppGame) => setHeader({info: info.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const chapters: any[] = Array.isArray(header.chapters) ? header.chapters : [];
	const setChapter = (i: number, patch: AppGame) => setHeader({chapters: chapters.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const limits: any[] = Array.isArray(game.limits) ? game.limits : [];
	const limitOf = (name: string) => limits.find(x => x.var === name) ?? {var: name, min: '', max: ''};
	const numOrEmpty = (input: string) => {
		const t = input.trim().replace(',', '.');

		return t === '' || !isFinite(Number(t)) ? '' : Number(t);
	};
	const setLimit = (name: string, patch: AppGame) => {
		const next = {...limitOf(name), ...patch};
		const rest = limits.filter(x => x.var !== name);
		const all = next.min === '' && next.max === '' ? rest : [...rest, next];

		setGame({...game, limits: all});
	};
	const up = (list: any[], i: number) => {
		const next = list.slice();
		const [x] = next.splice(i, 1);

		next.splice(i - 1, 0, x);
		return next;
	};
	const menu = fullMenu(game.menu);
	const setMenu = (list: typeof menu) => setGame({...game, menu: menuValue(list)});
	const taps: AppGame = header.taps ?? {};
	const tapOptions = [
		{label: l('header.tapAuto'), value: 'auto'},
		{label: l('header.tapInfo'), value: 'info'},
		{label: l('header.tapText'), value: 'text'},
		{label: l('header.tapBlock'), value: 'block'},
		{label: l('header.tapNone'), value: 'none'}
	];
	const tapFields = (t: AppGame | undefined, label: string, onChange: (t: AppGame) => void, cls: string) => {
		const cur = {kind: 'auto', title: '', text: '', block: '', ...(t ?? {})};
	
		return (
			<div className={'signaly-header-tap ' + cls}>
				<ChoiceField label={label} onChange={kind => onChange({...cur, kind})} options={tapOptions} value={String(cur.kind)} />
				{cur.kind === 'text' && (
					<>
						<TextField label={l('header.tapTitle')} onChange={title => onChange({...cur, title})} value={String(cur.title)} />
						<AreaInput label={l('header.tapBody')} onChange={text => onChange({...cur, text})} value={cur.text} />
					</>
				)}
				{cur.kind === 'block' && (
					<ChoiceField
						label={l('header.tapBlockSel')}
						onChange={block => onChange({...cur, block})}
						options={[{label: '—', value: ''}, ...refs.blocks.map(b => ({label: b.name, value: b.id}))]}
						value={String(cur.block)}
					/>
				)}
			</div>
		);
	};
	const fxOptions = [
		{label: l('header.fxFill'), value: 'fill'},
		{label: l('header.fxColor'), value: 'color'},
		{label: l('header.fxGlitch'), value: 'glitch'},
		{label: l('header.fxGlow'), value: 'glow'},
		{label: l('header.fxBlink'), value: 'blink'}
	];
	const varOptions = (cur: string) => [
		{label: '—', value: ''},
		...refs.shared.map(v => ({label: `${v.label || v.name} ($${v.name})`, value: v.name})),
		...(cur && !refs.shared.some(v => v.name === cur) ? [{label: `$${cur} ?`, value: cur}] : [])
	];

	return (
		<>
			<h3>{l('header.lines')}</h3>
			<TextField hint={l('header.titleHint', {v: '{{имя}}', interpolation: {skipOnVariables: true}})} label={l('header.title')} onChange={title => setHeader({title})} value={String(header.title ?? '')} />
			<TextField hint={l('header.subHint') + ' ' + l('header.subDash')} label={l('header.sub')} onChange={sub => setHeader({sub})} value={String(header.sub ?? '')} />
			<CheckField label={l('header.chapter')} onChange={chapter => setHeader({chapter})} value={header.chapter !== false} />
			{/* Сессия 40 (долги П19): размер шапки и «в шапке не больше N показателей». */}
			<ChoiceField
				hint={l('header.sizeHint')}
				label={l('header.size')}
				onChange={size => setHeader({size: size === 'normal' ? undefined : size})}
				options={['compact', 'normal', 'large'].map(v => ({label: l(`header.sizes.${v}`), value: v}))}
				value={header.size === 'compact' || header.size === 'large' ? header.size : 'normal'}
			/>
			<NumField
				hint={l('header.maxItemsHint')}
				label={l('header.maxItems')}
				max={50}
				onChange={n => setHeader({maxItems: Math.round(n) || undefined})}
				value={Number(header.maxItems) || 0}
			/>
			<h3>{l('header.chapters')}</h3>
			<div className="signaly-field-hint">{l('header.chaptersHint')}</div>
			{chapters.map((c, i) => (
				<fieldset className="signaly-block-row signaly-header-ch" key={String(c.id ?? i)}>
					<legend>
						{l('header.chapterLines', {n: Number(c.chapter) || 1})}{' '}
						<button className="signaly-button" onClick={() => setHeader({chapters: chapters.filter((_, k) => k !== i)})} type="button">
							{l('header.remove')}
						</button>
					</legend>
					<ChapterField label={l('header.fromChapter')} onChange={chapter => setChapter(i, {chapter})} value={c.chapter} />
					<TextField hint={l('header.asCommon')} label={l('header.title')} onChange={title => setChapter(i, {title})} value={String(c.title ?? '')} />
					<TextField hint={l('header.asCommon')} label={l('header.sub')} onChange={sub => setChapter(i, {sub})} value={String(c.sub ?? '')} />
					<TextField hint={l('header.asCommon')} label={l('header.infoTitleCh')} onChange={infoTitle => setChapter(i, {infoTitle})} value={String(c.infoTitle ?? '')} />
					<AreaInput hint={l('header.aboutHint')} label={l('header.about')} onChange={about => setChapter(i, {about})} value={c.about ?? ''} />
				</fieldset>
			))}
			<button
				className="signaly-button"
				onClick={() => setHeader({chapters: [...chapters, {id: uid('hc'), chapter: Math.min(2, Math.max(1, refs.chapters.length)), title: '', sub: '', infoTitle: ''}]})}
				type="button"
			>
				{l('header.addChapter')}
			</button>
			<h3>{l('header.items')}</h3>
			<div className="signaly-field-hint">{l(refs.shared.length ? 'header.itemsHint' : 'header.noShared')}</div>
			{items.map((it, i) => (
				<fieldset className="signaly-block-row signaly-header-item" key={String(it.id ?? i)}>
					<legend>
						{l('header.item', {n: i + 1})}{' '}
						<button className="signaly-button" disabled={i === 0} onClick={() => setHeader({items: up(items, i)})} type="button">
							↑
						</button>{' '}
						<button className="signaly-button" onClick={() => setHeader({items: items.filter((_, k) => k !== i)})} type="button">
							{l('header.remove')}
						</button>
					</legend>
					<ChoiceField label={l('header.var')} onChange={v => setItem(i, {var: v})} options={varOptions(String(it.var ?? ''))} value={String(it.var ?? '')} />
					<TextField hint={l('header.labelHint')} label={l('header.label')} onChange={label => setItem(i, {label})} value={String(it.label ?? '')} />
					{/* Сессия 40 (П-79, Т13-5 А): показатель «за N мин» — сумма прибавлений за окно. */}
					<NumField hint={l('header.winHint')} label={l('rules.win')} max={720} onChange={win => setItem(i, {win: Math.round(win) || undefined})} value={Number(it.win) || 0} />
					<ChoiceField
						label={l('header.show')}
						onChange={show => setItem(i, {show})}
						options={[
							{label: l('header.showNum'), value: 'num'},
							{label: l('header.showCells'), value: 'cells'}
						]}
						value={it.show === 'cells' ? 'cells' : 'num'}
					/>
					<NumField
						hint={l(it.show === 'cells' ? 'header.cellsHint' : 'header.maxHint')}
						label={l(it.show === 'cells' ? 'header.cells' : 'header.max')}
						max={200}
						min={0}
						onChange={max => setItem(i, {max: Math.round(max)})}
						value={Number(it.max) || 0}
					/>
					{it.show !== 'cells' && <TextField label={l('header.unit')} onChange={unit => setItem(i, {unit})} value={String(it.unit ?? '')} />}
					{it.show === 'cells' && (
						<>
							<ChoiceField
								label={l('header.look')}
								onChange={look => setItem(i, {look})}
								options={[
									{label: l('header.lookCell'), value: 'cell'},
									{label: l('header.lookBar'), value: 'bar'}
								]}
								value={it.look === 'bar' ? 'bar' : 'cell'}
							/>
							<CheckField hint={l('header.fitHint')} label={l('header.fit')} onChange={fit => setItem(i, {fit})} value={!!it.fit} />
							{!(Array.isArray(it.layers) && it.layers.length) && (
								<CheckField hint={l('header.overHint')} label={l('header.over')} onChange={over => setItem(i, {over})} value={!!it.over} />
							)}
							<fieldset className="signaly-header-layers">
								<legend>{l('header.layers')}</legend>
								<div className="signaly-field-hint">
									{l('header.layersHint')}
									{Array.isArray(it.layers) && it.layers.length && Number(it.max) ? ' ' + l('header.layerMax', {max: Number(it.max) * it.layers.length}) : ''}
								</div>
								{(Array.isArray(it.layers) ? it.layers : []).map((ly: AppGame, k: number) => {
									const n = Number(it.max) || 0;
									const setLy = (patch: AppGame) => setItem(i, {layers: it.layers.map((x: AppGame, j: number) => (j === k ? {...x, ...patch} : x))});
							
									return (
										<div className="signaly-header-layer" key={k}>
											<ChoiceField
												label={l('header.layer', {n: k + 1, from: k * n + 1, to: (k + 1) * n})}
												onChange={fx => setLy({fx, ...(fx === 'color' && !ly.color ? {color: '#ffaa00'} : {})})}
												options={fxOptions}
												value={String(ly.fx || 'fill')}
											/>
											{ly.fx === 'color' && <ColorInput label={l('header.layerColor')} onChange={color => setLy({color})} value={String(ly.color || '#ffaa00')} />}
											<button className="signaly-button" onClick={() => setItem(i, {layers: it.layers.filter((_: AppGame, j: number) => j !== k)})} type="button">
												{l('header.remove')}
											</button>
										</div>
									);
								})}
								<button
									className="signaly-button"
									disabled={!Number(it.max) || (Array.isArray(it.layers) && it.layers.length >= 20)}
									onClick={() => {
										const cur: AppGame[] = Array.isArray(it.layers) ? it.layers : [];
										const base = cur.length ? cur : [{fx: 'fill', color: ''}];
										const fx = base.length === 1 ? 'color' : base.length === 2 ? 'glitch' : 'glow';
							
										setItem(i, {layers: [...base, {fx, color: fx === 'color' ? '#ffaa00' : ''}]});
									}}
									type="button"
								>
									{l('header.addLayer')}
								</button>
							</fieldset>
						</>
					)}
					<TextField
						hint={l('header.lowHint')}
						label={l('header.low')}
						onChange={input => setItem(i, {low: numOrEmpty(input)})}
						value={it.low === '' || it.low === undefined || it.low === null ? '' : String(it.low)}
					/>
					{it.low !== '' && it.low !== undefined && it.low !== null && (
						<ColorInput label={l('header.lowColor')} onChange={lowColor => setItem(i, {lowColor})} value={String(it.lowColor || '#ff3b3b')} />
					)}
					{tapFields(it.tap, l('header.tapItem'), tap => setItem(i, {tap}), 'signaly-tap-item')}
					<ChapterField label={l('header.fromChapter')} onChange={chapter => setItem(i, {chapter})} value={it.chapter} />
					<AccountsField label={l('header.who')} onChange={who => setItem(i, {who})} value={it.who} />
				</fieldset>
			))}
			<button
				className="signaly-button"
				disabled={!refs.shared.length}
				onClick={() =>
					setHeader({items: [...items, {id: uid('h'), var: refs.shared[0]?.name ?? '', label: '', show: 'num', max: 0, chapter: 1, who: [], unit: ''}]})
				}
				type="button"
			>
				{l('header.addItem')}
			</button>
			<h3>{l('header.taps')}</h3>
			<div className="signaly-field-hint">{l('header.tapsHint')}</div>
			{tapFields(taps.who, l('header.tapWho'), who => setHeader({taps: {...taps, who}}), 'signaly-tap-who')}
			{tapFields(taps.chapter, l('header.tapChapter'), chapter => setHeader({taps: {...taps, chapter}}), 'signaly-tap-chapter')}
			<h3>{l('header.limits')}</h3>
			<div className="signaly-field-hint">{l(refs.shared.length ? 'header.limitsHint' : 'header.noShared')}</div>
			{refs.shared.map(v => (
				<fieldset className="signaly-block-row signaly-limit-row" data-var={v.name} key={v.name}>
					<legend>{`${v.label || v.name} ($${v.name})`}</legend>
					<TextField
						label={l('header.limitMin')}
						onChange={input => setLimit(v.name, {min: numOrEmpty(input)})}
						value={limitOf(v.name).min === '' ? '' : String(limitOf(v.name).min)}
					/>
					<TextField
						label={l('header.limitMax')}
						onChange={input => setLimit(v.name, {max: numOrEmpty(input)})}
						value={limitOf(v.name).max === '' ? '' : String(limitOf(v.name).max)}
					/>
				</fieldset>
			))}
			<h3>{l('header.info')}</h3>
			<div className="signaly-field-hint">{l('header.infoHint')}</div>
			<TextField label={l('header.infoTitle')} onChange={infoTitle => setHeader({infoTitle})} value={String(header.infoTitle ?? '')} />
			{info.map((s, i) => (
				<fieldset className="signaly-block-row signaly-header-sec" key={String(s.id ?? i)}>
					<legend>
						{l('header.section', {n: i + 1})}{' '}
						<button className="signaly-button" disabled={i === 0} onClick={() => setHeader({info: up(info, i)})} type="button">
							↑
						</button>{' '}
						<button className="signaly-button" onClick={() => setHeader({info: info.filter((_, k) => k !== i)})} type="button">
							{l('header.remove')}
						</button>
					</legend>
					<TextField label={l('header.secTitle')} onChange={title => setInfo(i, {title})} value={String(s.title ?? '')} />
					<AreaInput hint={l('header.secTextHint', {v: '{{имя}}', interpolation: {skipOnVariables: true}})} label={l('header.secText')} onChange={text => setInfo(i, {text})} value={s.text} />
					<ChapterField label={l('header.fromChapter')} onChange={chapter => setInfo(i, {chapter})} value={s.chapter} />
					<AccountsField label={l('header.who')} onChange={who => setInfo(i, {who})} value={s.who} />
				</fieldset>
			))}
			<button
				className="signaly-button"
				onClick={() => setHeader({info: [...info, {id: uid('i'), title: '', text: '', chapter: 1, who: []}]})}
				type="button"
			>
				{l('header.addSection')}
			</button>
			<h3>{l('header.menu')}</h3>
			<div className="signaly-field-hint">{l('header.menuHint')}</div>
			{menu.map((m, i) => (
				<fieldset className="signaly-block-row signaly-menu-row" data-tab={m.tab} key={m.tab}>
					<legend>
						{m.def}{' '}
						<button
							className="signaly-button"
							disabled={i === 0}
							onClick={() => {
								const next = menu.slice();
								const [x] = next.splice(i, 1);

								next.splice(i - 1, 0, x);
								setMenu(next);
							}}
							type="button"
						>
							↑
						</button>
					</legend>
					<TextField
						hint={l('header.menuLabelHint', {def: m.def})}
						label={l('header.menuLabel')}
						onChange={label => setMenu(menu.map((x, k) => (k === i ? {...x, label} : x)))}
						value={m.label}
					/>
					<ChapterField label={l('header.fromChapter')} onChange={chapter => setMenu(menu.map((x, k) => (k === i ? {...x, chapter} : x)))} value={m.chapter} />
					<AccountsField label={l('header.who')} onChange={who => setMenu(menu.map((x, k) => (k === i ? {...x, who} : x)))} value={m.who} />
					<CheckField label={l('header.menuHide')} onChange={hidden => setMenu(menu.map((x, k) => (k === i ? {...x, hidden} : x)))} value={m.hidden} />
				</fieldset>
			))}
			<button className="signaly-button" onClick={() => setGame({...game, menu: []})} type="button">
				{l('header.menuReset')}
			</button>
		</>
	);
};
