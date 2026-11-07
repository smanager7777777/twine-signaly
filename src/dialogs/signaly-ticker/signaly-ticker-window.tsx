// «Twine СИГНАЛЫ»: окно «Строка событий» (шаг 4.1). Вкладки «Сообщения»,
// «Строка», «Цикл»; справа — предпросмотр главного экрана настоящим SugarCube.
// Настройки хранятся в пассаже «Строка событий» с тегом sg-ticker
// (signaly-ticker.ts). Ничего не записывается в историю до «Сохранить».

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {
	defaultAppearance,
	engineVersionIn,
	readAppearance,
	systemFonts,
	withAppearance,
	withEngine
} from '../../util/signaly/signaly-appearance';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {writeExpr} from '../../util/signaly/signaly-logic';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';
import {
	copyNews,
	cycleDigits,
	News,
	newNews,
	newsConds,
	NewsRank,
	readTicker,
	TickerData,
	tickerPassageName,
	tickerProblems,
	tickerTag,
	writeTicker
} from '../../util/signaly/signaly-ticker';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {
	CheckField,
	ChoiceField,
	ColorField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {SignalyAppearancePreview} from '../signaly-appearance/signaly-appearance-preview';
import {useLists} from '../passage-edit/signaly-block-panel';
import {CondListsContext, CondRows, useCondLists} from '../passage-edit/signaly-logic-form';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';
import './signaly-ticker.css';

export interface SignalyTickerWindowProps {
	onClose: () => void;
	story: Story;
}

type Tab = 'news' | 'line' | 'cycle';

function numberOf(input: string) {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : undefined;
}

function move<T>(list: T[], from: number, to: number) {
	const next = list.slice();

	next.splice(to, 0, next.splice(from, 1)[0]);
	return next;
}

export const SignalyTickerWindow: React.FC<SignalyTickerWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.ticker.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {gameFolder} = useGameFolder();
	const {media, passages} = useLists(story);
	const condLists = useCondLists(story);
	const passage =
		story.passages.find(p => p.tags.includes(tickerTag)) ?? story.passages.find(p => p.name === tickerPassageName);
	const startScreen = story.passages.find(p => p.id === story.startPassage)?.name ?? '';
	const [data, setData] = React.useState<TickerData>(() => readTicker(passage?.text ?? '', startScreen));
	const [tab, setTab] = React.useState<Tab>('news');
	const [selected, setSelected] = React.useState(0);
	const [saved, setSaved] = React.useState(!!passage);
	const [refresh, setRefresh] = React.useState(0);
	const [demo, setDemo] = React.useState(0);
	const [colors, setColors] = React.useState(() => (readAppearance(story.stylesheet) ?? defaultAppearance).savedColors);
	const variables = React.useMemo(() => knownVariables(story.passages), [story.passages]);
	const row = data.news[selected];
	const seconds = t('signaly.appearance.units.seconds');
	const px = t('signaly.appearance.units.px');
	const folder = gameFolder(story.id);

	function change(next: Partial<TickerData>) {
		setData({...data, ...next});
		setSaved(false);
	}

	const setRow = (patch: Partial<News>) =>
		change({news: data.news.map((n, i) => (i === selected ? {...n, ...patch} : n))});
	const setLine = (patch: Partial<TickerData['line']>) => change({line: {...data.line, ...patch}});
	const setCycle = (patch: Partial<TickerData['cycle']>) => change({cycle: {...data.cycle, ...patch}});

	const found = tickerProblems(data);
	const problems = [
		...(found.emptyName ? [l('problems.emptyName')] : []),
		...(found.duplicateNames.length ? [l('problems.duplicateNames', {names: found.duplicateNames.join(', ')})] : []),
		...(found.badCycle ? [l('problems.badCycle')] : []),
		...(found.duplicateProgress.length ? [l('problems.duplicateProgress', {values: found.duplicateProgress.join(', ')})] : []),
		...(data.line.screen ? [] : [l('problems.noScreen')])
	];

	/* ----- Предпросмотр: история с несохранёнными настройками ----- */

	const previewText = writeTicker(passage?.text ?? '', data);
	const previewStory = React.useMemo(() => {
		const others = story.passages.filter(p => p !== passage);
		const base = passage ?? story.passages[0];

		return {
			...story,
			script: engineVersionIn(story.script) < signalyEngineVersion ? withEngine(story.script) : story.script,
			passages: [
				...others,
				{...base, id: passage?.id ?? 'signaly-ticker', name: passage?.name ?? tickerPassageName, tags: [tickerTag], text: previewText}
			]
		};
	}, [passage, previewText, story]);
	const screenId = story.passages.find(p => p.name === data.line.screen)?.id;

	React.useEffect(() => {
		const timer = setTimeout(() => setRefresh(n => n + 1), 500);

		return () => clearTimeout(timer);
	}, [previewText]);

	/* ----- Сохранить ----- */

	function save() {
		const text = writeTicker(passage?.text ?? '', data);
		const appearance = readAppearance(story.stylesheet);
		const script = engineVersionIn(story.script) < signalyEngineVersion ? withEngine(story.script) : story.script;
		const stylesheet =
			appearance && colors !== appearance.savedColors
				? withAppearance(story.stylesheet, {...appearance, savedColors: colors})
				: story.stylesheet;

		if (script !== story.script || stylesheet !== story.stylesheet) {
			saveStoryWithUpgrade(dispatch, stories, story, {script, stylesheet});
		}
		if (passage) {
			const tags = passage.tags.includes(tickerTag) ? passage.tags : [...passage.tags, tickerTag];

			if (text !== passage.text || tags !== passage.tags) {
				dispatch(updatePassage(story, passage, {text, tags}));
			}
		} else {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: tickerPassageName, story: story.id, tags: [tickerTag], text, ...freeSpot(story.passages)}
			});
		}
		setSaved(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				close();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	/* ----- Список сообщений ----- */

	function add() {
		change({news: [...data.news, newNews(data.news)]});
		setSelected(data.news.length);
	}

	function copy() {
		const next = data.news.slice();

		next.splice(selected + 1, 0, copyNews(data.news, row));
		change({news: next});
		setSelected(selected + 1);
	}

	function remove() {
		if (row && window.confirm(l('confirmDelete', {name: row.name}))) {
			change({news: data.news.filter((_, i) => i !== selected)});
			setSelected(Math.max(0, selected - 1));
		}
	}

	function shift(by: number) {
		change({news: move(data.news, selected, selected + by)});
		setSelected(selected + by);
	}

	function sort(by: 'name' | 'priority') {
		const list = data.news.slice().sort((a, b) =>
			by === 'name' ? a.name.localeCompare(b.name, 'ru') : b.priority - a.priority
		);

		change({news: list});
		setSelected(row ? list.indexOf(row) : 0);
	}

	const parsed = row ? newsConds(row.expr) : undefined;

	function newsForm() {
		if (!row) {
			return <p className="signaly-field-hint">{l('news.empty')}</p>;
		}

		const always = row.expr.trim() === '';
		const count = (label: string, hint: string, value: number, onChange: (n: number) => void) => (
			<TextField
				hint={hint}
				label={label}
				onChange={input => {
					const n = numberOf(input);

					if (n !== undefined && n >= 0) {
						onChange(n);
					}
				}}
				value={String(value)}
			/>
		);

		return (
			<>
				<TextField hint={l('news.nameHint')} label={l('news.name')} onChange={name => setRow({name})} value={row.name} />
				<TextField hint={l('news.textHint')} label={l('news.text')} onChange={text => setRow({text})} value={row.text} />
				<CheckField hint={l('news.generalHint')} label={l('news.general')} onChange={general => setRow({general})} value={row.general} />
				<h3>{l('news.when')}</h3>
				<ChoiceField
					label={l('news.whenChoice')}
					onChange={value => setRow({expr: value === 'always' ? '' : `$${variables[0]?.name ?? 'x'}`})}
					options={[
						{label: l('news.always'), value: 'always'},
						{label: l('news.byCond'), value: 'cond'}
					]}
					value={always ? 'always' : 'cond'}
				/>
				{!always &&
					(parsed && parsed.conds.length > 0 ? (
						<CondListsContext.Provider value={condLists}>
							<CondRows
								conds={parsed.conds}
								join={parsed.join}
								onChange={(conds, join) => setRow({expr: writeExpr(conds, join)})}
								variables={variables}
							/>
						</CondListsContext.Provider>
					) : (
						<>
							<div className="signaly-field-hint">{t('signaly.logic.cond.code')}</div>
							<TextField label={t('signaly.logic.cond.expr')} onChange={expr => setRow({expr})} value={row.expr} />
						</>
					))}
				<h3>{l('news.how')}</h3>
				{count(l('news.minutes'), l('news.minutesHint'), row.minutes, minutes => setRow({minutes}))}
				{count(l('news.times'), l('news.timesHint'), row.times, times => setRow({times}))}
				<TextField
					hint={l('news.priorityHint')}
					label={l('news.priority')}
					onChange={input => {
						const n = numberOf(input);

						if (n !== undefined) {
							setRow({priority: n});
						}
					}}
					value={String(row.priority)}
				/>
				<h3>{l('news.look')}</h3>
				<CheckField label={l('news.ownColor')} onChange={own => setRow({color: own ? '#ff0000' : ''})} value={row.color !== ''} />
				{row.color !== '' && (
					<ColorField
						label={l('news.color')}
						onChange={color => setRow({color})}
						onSaveColor={color => {
							setColors([...colors, color]);
							setSaved(false);
						}}
						savedColors={colors}
						value={row.color}
					/>
				)}
				<CheckField label={l('news.bold')} onChange={bold => setRow({bold})} value={row.bold} />
				<CheckField label={l('news.italic')} onChange={italic => setRow({italic})} value={row.italic} />
				<ChoiceField
					label={l('news.effect')}
					onChange={value => setRow({effect: value as News['effect']})}
					options={[
						{label: l('news.effects.none'), value: ''},
						{label: l('news.effects.blink'), value: 'blink'},
						{label: l('news.effects.glitch'), value: 'glitch'}
					]}
					value={row.effect}
				/>
			</>
		);
	}

	function newsTab() {
		return (
			<>
				<div className="signaly-kinds-list">
					{data.news.map((n, i) => (
						<button
							aria-pressed={i === selected}
							className="signaly-kinds-item"
							key={i}
							onClick={() => setSelected(i)}
							type="button"
						>
							{n.name || l('news.noName')}
							{n.general && <span className="signaly-sound-file">{l('news.generalMark')}</span>}
						</button>
					))}
				</div>
				<div className="signaly-sound-actions">
					<button className="signaly-button" onClick={add} type="button">
						{l('news.add')}
					</button>
					<button className="signaly-button" disabled={!row} onClick={copy} type="button">
						{l('news.copy')}
					</button>
					<button className="signaly-button" disabled={!row} onClick={remove} type="button">
						{l('news.delete')}
					</button>
					<IconButton disabled={selected < 1} icon={<IconArrowUp />} iconOnly label={l('up')} onClick={() => shift(-1)} />
					<IconButton
						disabled={selected >= data.news.length - 1}
						icon={<IconArrowDown />}
						iconOnly
						label={l('down')}
						onClick={() => shift(1)}
					/>
				</div>
				<div className="signaly-sound-actions">
					<button className="signaly-button" disabled={data.news.length < 2} onClick={() => sort('name')} type="button">
						{l('news.sortName')}
					</button>
					<button className="signaly-button" disabled={data.news.length < 2} onClick={() => sort('priority')} type="button">
						{l('news.sortPriority')}
					</button>
				</div>
				{newsForm()}
			</>
		);
	}

	function lineTab() {
		const line = data.line;
		const order = line.order;

		return (
			<>
				<ChoiceField
					hint={l('line.screenHint')}
					label={l('line.screen')}
					onChange={screen => setLine({screen})}
					options={passages.map(p => ({label: p, value: p}))}
					value={line.screen}
				/>
				<RangeField label={l('line.height')} max={120} min={24} onChange={height => setLine({height})} unit={px} value={line.height} />
				<RangeField label={l('line.size')} max={60} min={10} onChange={size => setLine({size})} unit={px} value={line.size} />
				<ChoiceField
					label={l('line.font')}
					onChange={font => setLine({font})}
					options={[
						{label: l('line.fontTerminal'), value: ''},
						...systemFonts.map(f => ({label: f, value: f})),
						...media.fonts.map(f => ({label: f, value: f}))
					]}
					value={line.font}
				/>
				<h3>{l('line.scroll')}</h3>
				<RangeField hint={l('line.speedHint')} label={l('line.speed')} max={300} min={10} onChange={speed => setLine({speed})} unit={l('line.speedUnit')} value={line.speed} />
				<RangeField hint={l('line.pauseHint')} label={l('line.pause')} max={30} min={0} onChange={pause => setLine({pause})} step={0.5} unit={seconds} value={line.pause} />
				<h3>{l('line.changeTitle')}</h3>
				<RangeField hint={l('line.holdHint')} label={l('line.hold')} max={60} min={1} onChange={hold => setLine({hold})} unit={seconds} value={line.hold} />
				<ChoiceField
					label={l('line.mode')}
					onChange={mode => setLine({mode: mode as 'fade' | 'scroll'})}
					options={[
						{label: l('line.modes.fade'), value: 'fade'},
						{label: l('line.modes.scroll'), value: 'scroll'}
					]}
					value={line.mode}
				/>
				<RangeField label={l('line.change')} max={10} min={0} onChange={changeTime => setLine({change: changeTime})} step={0.5} unit={seconds} value={line.change} />
				<h3>{l('line.order')}</h3>
				<p className="signaly-field-hint">{l('line.orderHint')}</p>
				{order.map((rank: NewsRank, i) => (
					<div className="signaly-ticker-order" key={rank}>
						<span>
							{i + 1}. {l(`line.ranks.${rank}`)}
						</span>
						<IconButton disabled={i === 0} icon={<IconArrowUp />} iconOnly label={l('up')} onClick={() => setLine({order: move(order, i, i - 1)})} />
						<IconButton disabled={i === order.length - 1} icon={<IconArrowDown />} iconOnly label={l('down')} onClick={() => setLine({order: move(order, i, i + 1)})} />
					</div>
				))}
			</>
		);
	}

	function cycleTab() {
		const cycle = data.cycle;
		const setCell = (index: number, patch: Partial<TickerData['cycle']['rows'][0]>) =>
			setCycle({rows: cycle.rows.map((r, i) => (i === index ? {...r, ...patch} : r))});
		const setRate = (key: 'from' | 'to', index: number, input: string) => {
			const n = numberOf(input);

			if (n !== undefined && n > 0) {
				setCycle({[key]: cycle[key].map((rate, i) => (i === index ? n : rate))});
			}
		};
		const addRow = () => {
			const last = cycle.rows[cycle.rows.length - 1];

			setCycle({rows: [...cycle.rows, {progress: last ? last.progress + 1 : 0, value: last ? last.value : '00001'}]});
		};

		return (
			<>
				<ChoiceField
					hint={l('cycle.variableHint')}
					label={l('cycle.variable')}
					onChange={variable => setCycle({variable})}
					options={[{label: l('cycle.none'), value: ''}, ...variables.map(v => ({label: v.label ? `${v.label} ($${v.name})` : `$${v.name}`, value: v.name}))]}
					value={cycle.variable}
				/>
				{cycle.variable && (
					<>
						<h3>{l('cycle.rows')}</h3>
						<p className="signaly-field-hint">{l('cycle.rowsHint')}</p>
						<div className="signaly-ticker-row">
							<strong>{l('cycle.progress')}</strong>
							<strong>{l('cycle.value')}</strong>
							<span />
						</div>
						{cycle.rows.map((r, i) => (
							<div className="signaly-ticker-row" key={i}>
								<input
									aria-label={l('cycle.progress')}
									onChange={e => setCell(i, {progress: numberOf(e.target.value) ?? 0})}
									type="number"
									value={r.progress}
								/>
								<input
									aria-label={l('cycle.value')}
									onChange={e => setCell(i, {value: e.target.value.replace(/\D/g, '').slice(0, 5)})}
									value={r.value}
								/>
								<IconButton
									icon={<IconTrash />}
									iconOnly
									label={l('cycle.deleteRow')}
									onClick={() => setCycle({rows: cycle.rows.filter((_, x) => x !== i)})}
								/>
							</div>
						))}
						<div className="signaly-sound-actions">
							<button className="signaly-button" onClick={addRow} type="button">
								{l('cycle.addRow')}
							</button>
						</div>
						<h3>{l('cycle.spinTitle')}</h3>
						<RangeField hint={l('cycle.spinHint')} label={l('cycle.spin')} max={60} min={0} onChange={spin => setCycle({spin})} step={0.5} unit={seconds} value={cycle.spin} />
						<RangeField hint={l('cycle.gapHint')} label={l('cycle.gap')} max={10} min={0} onChange={gap => setCycle({gap})} step={0.1} unit={seconds} value={cycle.gap} />
						<h3>{l('cycle.ratesTitle')}</h3>
						<p className="signaly-field-hint">{l('cycle.ratesHint')}</p>
						<div className="signaly-ticker-row signaly-ticker-rates">
							<strong>{l('cycle.digit')}</strong>
							<strong>{l('cycle.rateFrom')}</strong>
							<strong>{l('cycle.rateTo')}</strong>
						</div>
						{Array.from({length: cycleDigits}, (_, i) => (
							<div className="signaly-ticker-row signaly-ticker-rates" key={i}>
								<span>{l('cycle.digitName', {n: i + 1})}</span>
								<input
									aria-label={l('cycle.rateFromOf', {n: i + 1})}
									min={0.1}
									onChange={e => setRate('from', i, e.target.value)}
									step={1}
									type="number"
									value={cycle.from[i]}
								/>
								<input
									aria-label={l('cycle.rateToOf', {n: i + 1})}
									min={0.1}
									onChange={e => setRate('to', i, e.target.value)}
									step={1}
									type="number"
									value={cycle.to[i]}
								/>
							</div>
						))}
						<ChoiceField
							hint={l('cycle.fontHint')}
							label={l('cycle.font')}
							onChange={font => setCycle({font})}
							options={[
								{label: l('cycle.fontLine'), value: 'none'},
								...[...new Set([cycle.font, ...media.fonts])]
									.filter(f => f && f !== 'none')
									.map(f => ({label: f, value: f}))
							]}
							value={cycle.font || 'none'}
						/>
						<h3>{l('cycle.soundTitle')}</h3>
						<ChoiceField
							hint={media.audio.length === 0 ? t('signaly.blocks.noFiles') : l('cycle.soundHint')}
							label={l('cycle.sound')}
							onChange={sound => setCycle({sound})}
							options={[{label: l('cycle.noSound'), value: ''}, ...media.audio.map(f => ({label: f, value: f}))]}
							value={cycle.sound}
						/>
						{cycle.sound && (
							<RangeField label={l('cycle.volume')} max={100} min={0} onChange={volume => setCycle({volume})} unit="%" value={cycle.volume} />
						)}
					</>
				)}
			</>
		);
	}

	return (
		<div
			aria-label={l('title')}
			aria-modal="true"
			className="signaly-appearance-window signaly-ticker-window"
			role="dialog"
		>
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved ? t('signaly.appearance.saved') : t('signaly.appearance.unsaved')}
				</span>
				<button className="signaly-button primary" disabled={saved || problems.length > 0} onClick={save} type="button">
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body">
				<div className="signaly-appearance-settings">
					<div className="signaly-tabs" role="tablist">
						{(['news', 'line', 'cycle'] as const).map(name => (
							<button
								aria-selected={tab === name}
								className="signaly-tab"
								key={name}
								onClick={() => setTab(name)}
								role="tab"
								type="button"
							>
								{l(`tabs.${name}`)}
							</button>
						))}
					</div>
					<p className="signaly-field-hint">{l(`intro.${tab}`)}</p>
					{problems.map(p => (
						<div className="signaly-notice" key={p}>
							{p}
						</div>
					))}
					{tab === 'news' && newsTab()}
					{tab === 'line' && lineTab()}
					{tab === 'cycle' && cycleTab()}
				</div>
				<div className="signaly-ticker-preview">
					<div className="signaly-ticker-preview-bar">
						<button
							className="signaly-button"
							disabled={!data.cycle.variable || data.cycle.rows.length === 0}
							onClick={() => setDemo(demo + 1)}
							type="button"
						>
							{l('demo')}
						</button>
						<span className="signaly-field-hint">{l('demoHint')}</span>
					</div>
					<SignalyAppearancePreview
						baseUrl={folder ? folderToFileUrl(folder) : undefined}
						cycleDemo={demo}
						mode="passage"
						passageId={screenId}
						refresh={refresh}
						story={previewStory}
					/>
				</div>
			</div>
		</div>
	);
};
