// «Twine СИГНАЛЫ»: вкладка «Шапка и меню» окна «Приложение» (сессия 36, ответ Т4-6 Б).
// Шапка телефона: строки (пусто — имя и профессия; {name} {prof} {chapter}, {{имя}}), глава справа,
// показатели общих переменных (подпись или без, числом или квадратиками), окно-сводка по нажатию
// (разделы: заголовок, текст, кому, с главы). Нижнее меню: порядок, свои названия, скрытые вкладки.
// Хранится в пакете как game.header и game.menu (как SG.normHeader приложения).

import * as React from 'react';
import {AppGame} from '../../util/signaly/signaly-app';
import {defaultHeader, fullMenu, menuValue, uid} from '../../util/signaly/signaly-app-model';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {AccountsField, AppRefsContext, AreaInput, ChapterField, NumField, usePhoneL} from './signaly-app-fields';
import {TabProps} from './signaly-app-tabs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const HeaderTab: React.FC<TabProps> = ({game, setGame}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const header: AppGame = {...defaultHeader, ...(game.header ?? {})};
	const items: any[] = Array.isArray(header.items) ? header.items : [];
	const info: any[] = Array.isArray(header.info) ? header.info : [];
	const setHeader = (patch: AppGame) => setGame({...game, header: {...header, ...patch}});
	const setItem = (i: number, patch: AppGame) => setHeader({items: items.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const setInfo = (i: number, patch: AppGame) => setHeader({info: info.map((x, k) => (k === i ? {...x, ...patch} : x))});
	const up = (list: any[], i: number) => {
		const next = list.slice();
		const [x] = next.splice(i, 1);

		next.splice(i - 1, 0, x);
		return next;
	};
	const menu = fullMenu(game.menu);
	const setMenu = (list: typeof menu) => setGame({...game, menu: menuValue(list)});
	const varOptions = (cur: string) => [
		{label: '—', value: ''},
		...refs.shared.map(v => ({label: `${v.label || v.name} ($${v.name})`, value: v.name})),
		...(cur && !refs.shared.some(v => v.name === cur) ? [{label: `$${cur} ?`, value: cur}] : [])
	];

	return (
		<>
			<h3>{l('header.lines')}</h3>
			<TextField hint={l('header.titleHint', {v: '{{имя}}', interpolation: {skipOnVariables: true}})} label={l('header.title')} onChange={title => setHeader({title})} value={String(header.title ?? '')} />
			<TextField hint={l('header.subHint')} label={l('header.sub')} onChange={sub => setHeader({sub})} value={String(header.sub ?? '')} />
			<CheckField label={l('header.chapter')} onChange={chapter => setHeader({chapter})} value={header.chapter !== false} />
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
						max={40}
						min={0}
						onChange={max => setItem(i, {max: Math.round(max)})}
						value={Number(it.max) || 0}
					/>
					{it.show !== 'cells' && <TextField label={l('header.unit')} onChange={unit => setItem(i, {unit})} value={String(it.unit ?? '')} />}
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
					<CheckField label={l('header.menuHide')} onChange={hidden => setMenu(menu.map((x, k) => (k === i ? {...x, hidden} : x)))} value={m.hidden} />
				</fieldset>
			))}
			<button className="signaly-button" onClick={() => setGame({...game, menu: []})} type="button">
				{l('header.menuReset')}
			</button>
		</>
	);
};
