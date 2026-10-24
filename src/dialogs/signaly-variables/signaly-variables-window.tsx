// «Twine СИГНАЛЫ»: окно «Переменные» (шаг 3.1, ответ автора 2А). Слева —
// список переменных, справа — выбранная: имя латиницей, подпись по-русски, тип,
// начальное значение и где она используется. Начальные значения — обычные
// <<set>> в StoryInit (раздел окна, signaly-variables.ts). Ничего не
// записывается в историю до «Сохранить».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, updatePassage, updateStory, useStoriesContext} from '../../store/stories';
import {
	readVariables,
	renameVariable,
	typeOf,
	Variable,
	variableNameRe,
	variablesInTexts,
	variableTitle,
	variableUsage,
	VarType,
	withVariables
} from '../../util/signaly/signaly-variables';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import './signaly-variables.css';

export interface SignalyVariablesWindowProps {
	onClose: () => void;
	story: Story;
}

const initName = 'StoryInit';

/** Переменная в окне: name — новое имя, origin — имя в истории (для переименования). */
interface Row extends Variable {
	origin?: string;
}

function convert(value: Variable['value'], type: VarType): Variable['value'] {
	if (type === 'number') {
		const n = typeof value === 'boolean' ? Number(value) : Number(String(value).replace(',', '.'));

		return isNaN(n) ? 0 : n;
	}
	if (type === 'bool') {
		return typeof value === 'string' ? value !== '' && value !== '0' && value !== 'false' : Boolean(value);
	}
	return String(value);
}

export const SignalyVariablesWindow: React.FC<SignalyVariablesWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.variables.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const init = story.passages.find(p => p.name === initName);
	const [read] = React.useState(() => readVariables(init?.text ?? ''));
	const [rows, setRows] = React.useState<Row[]>(() => read.variables.map(v => ({...v, origin: v.name})));
	const [selected, setSelected] = React.useState(0);
	const [saved, setSaved] = React.useState(true);
	const others = React.useMemo(
		() =>
			story.passages.filter(
				p => p.name !== initName && !p.tags.includes('script') && !p.tags.includes('stylesheet')
			),
		[story.passages]
	);
	const scriptLabel = l('script');

	function change(next: Row[]) {
		setRows(next);
		setSaved(false);
	}

	const usage = (name: string) => variableUsage(name, others, story.script, scriptLabel);
	// Есть в тексте экранов, но без начального значения.
	const loose = variablesInTexts(others.map(p => p.text)).filter(
		name =>
			!rows.some(r => r.name === name || r.origin === name) &&
			!read.byCode.includes(name) &&
			!/^sg[A-Z]/.test(name)
	);

	const problems: string[] = [];
	const names = rows.map(r => r.name);

	if (rows.some(r => !variableNameRe.test(r.name))) {
		problems.push(l('problems.name'));
	}
	if (names.some((n, i) => names.indexOf(n) !== i) || rows.some(r => read.byCode.includes(r.name) && r.origin !== r.name)) {
		problems.push(l('problems.duplicate'));
	}

	function save() {
		const variables = rows.map(({name, label, value}) => ({name, label, value}));
		const renames = rows.filter(r => r.origin && r.origin !== r.name);

		if (init) {
			const text = withVariables(init.text, variables);

			if (text !== init.text) {
				dispatch(updatePassage(story, init, {text}));
			}
		} else if (variables.length) {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: initName, story: story.id, text: withVariables('', variables), left: 0, top: 0}
			});
		}
		// Переименованные переменные — во всём тексте истории.
		if (renames.length) {
			others.forEach(p => {
				const text = renames.reduce((s, r) => renameVariable(s, r.origin!, r.name), p.text);

				if (text !== p.text) {
					dispatch(updatePassage(story, p, {text}));
				}
			});

			const script = renames.reduce((s, r) => renameVariable(s, r.origin!, r.name), story.script);

			if (script !== story.script) {
				dispatch(updateStory(stories, story, {script}));
			}
			setRows(rows.map(r => ({...r, origin: r.name})));
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

	function add(name?: string) {
		let base = name ?? 'variable';
		let n = 2;

		while (!name && rows.some(r => r.name === base)) {
			base = `variable${n++}`;
		}
		// Тип найденной переменной — по тому, как её сравнивают и задают в тексте.
		const sample = name
			? others
					.map(p => new RegExp(`\\$${name}\\s+(?:is|to|eq|gt|lt|==|=)\\s+(-?\\d|"|')`).exec(p.text)?.[1])
					.find(Boolean)
			: undefined;
		const value = !name ? 0 : sample === undefined ? false : /\d/.test(sample) ? 0 : '';

		change([...rows, {name: base, label: '', value}]);
		setSelected(rows.length);
	}

	function remove() {
		const row = rows[selected];

		if (!row) {
			return;
		}

		const used = usage(row.origin ?? row.name);

		if (
			window.confirm(
				used.length ? l('confirmDeleteUsed', {name: row.name, count: used.length}) : l('confirmDelete', {name: row.name})
			)
		) {
			change(rows.filter((_, i) => i !== selected));
			setSelected(0);
		}
	}

	const row = rows[selected];
	const setRow = (changes: Partial<Row>) => change(rows.map((r, i) => (i === selected ? {...r, ...changes} : r)));

	function editor() {
		if (!row) {
			return <p className="signaly-field-hint">{l('empty')}</p>;
		}

		const type = typeOf(row.value);
		const used = usage(row.origin ?? row.name);

		return (
			<>
				<TextField
					hint={
						row.origin && row.origin !== row.name && used.length
							? l('renameHint', {count: used.length, from: row.origin})
							: l('nameHint')
					}
					label={l('name')}
					onChange={name => setRow({name: name.trim().replace(/^\$/, '')})}
					value={row.name}
				/>
				<TextField hint={l('labelHint')} label={l('label')} onChange={label => setRow({label})} value={row.label} />
				<ChoiceField
					label={l('type')}
					onChange={next => setRow({value: convert(row.value, next as VarType)})}
					options={(['number', 'bool', 'text'] as const).map(value => ({label: l(`types.${value}`), value}))}
					value={type}
				/>
				{type === 'bool' ? (
					<CheckField label={l('valueOn')} onChange={value => setRow({value})} value={row.value === true} />
				) : (
					<TextField
						hint={type === 'number' && typeof row.value !== 'number' ? l('notNumber') : undefined}
						label={l('value')}
						onChange={input => {
							if (type === 'number') {
								const n = Number(input.replace(',', '.'));

								setRow({value: input.trim() === '' || isNaN(n) ? (input.trim() === '' ? 0 : row.value) : n});
							} else {
								setRow({value: input});
							}
						}}
						value={String(row.value)}
					/>
				)}
				<h3>{l('usedIn')}</h3>
				{used.length ? (
					<ul className="signaly-variables-used">
						{used.map(name => (
							<li key={name}>{name}</li>
						))}
					</ul>
				) : (
					<p className="signaly-field-hint">{l('unused')}</p>
				)}
				<p className="signaly-field-hint">
					{l('codeHint', {code: `$${row.name}`})}
				</p>
			</>
		);
	}

	return (
		<div aria-label={l('title')} aria-modal="true" className="signaly-appearance-window signaly-sounds-window" role="dialog">
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
			<div className="signaly-appearance-body signaly-sounds-body">
				<div className="signaly-appearance-settings">
					<p className="signaly-field-hint">{l('intro')}</p>
					<div className="signaly-kinds-list">
						{rows.map((r, i) => (
							<button
								aria-pressed={i === selected}
								className="signaly-kinds-item"
								key={i}
								onClick={() => setSelected(i)}
								type="button"
							>
								{variableTitle(r)}
								<span className="signaly-sound-file">{l(`types.${typeOf(r.value)}`)}</span>
							</button>
						))}
					</div>
					<div className="signaly-sound-actions">
						<button className="signaly-button" onClick={() => add()} type="button">
							{l('add')}
						</button>
						<button className="signaly-button" disabled={!row} onClick={remove} type="button">
							{l('delete')}
						</button>
					</div>
					{loose.length > 0 && (
						<>
							<h3>{l('loose')}</h3>
							<p className="signaly-field-hint">{l('looseHint')}</p>
							<div className="signaly-variables-loose">
								{loose.map(name => (
									<button className="signaly-button" key={name} onClick={() => add(name)} type="button">
										+ ${name}
									</button>
								))}
							</div>
						</>
					)}
					{read.byCode.length > 0 && (
						<p className="signaly-field-hint">{l('byCode', {names: read.byCode.map(n => `$${n}`).join(', ')})}</p>
					)}
				</div>
				<div className="signaly-sounds-editor">
					{problems.map(p => (
						<div className="signaly-notice" key={p}>
							{p}
						</div>
					))}
					{editor()}
				</div>
			</div>
		</div>
	);
};
