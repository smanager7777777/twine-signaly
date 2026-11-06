// «Twine СИГНАЛЫ»: вкладка «Первое посещение» окна «Оформление терминала»
// (шаг 4.5, ответ 6А с дополнением автора). Слева список способов появления,
// под ним настройки выбранного. Способ ставится экрану кнопкой над текстом.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {firstModes, FirstPart, firstParts, FirstPartMode, FirstWay, newFirstWay} from '../../util/signaly/signaly-first';
import {copyNamed} from '../../util/signaly/signaly-screens';
import {CheckField, ChoiceField, ColorField, RangeField, TextField} from './signaly-appearance-fields';
import {NamedList} from './signaly-screens-tabs';

export interface FirstWaysTabProps {
	onChange: (ways: FirstWay[]) => void;
	onSaveColor: (color: string) => void;
	onSelect: (index: number) => void;
	savedColors: string[];
	selected: number;
	/** Сколько экранов пользуются способом — для предупреждения об удалении. */
	used: (id: string) => number;
	ways: FirstWay[];
}

export const FirstWaysTab: React.FC<FirstWaysTabProps> = props => {
	const {onChange, onSaveColor, onSelect, savedColors, selected, used, ways} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.first.${key}`, options);
	const way = ways[selected];
	const set = (patch: Partial<FirstWay>) => onChange(ways.map((w, i) => (i === selected ? {...w, ...patch} : w)));
	const seconds = t('signaly.appearance.units.seconds');
	const modes = firstModes.map(mode => ({label: l(`modes.${mode}`), value: mode as string}));
	const present = way ? [way.mode, ...firstParts.map(part => way[part])] : [];
	const noisy = present.includes('noise') || present.includes('wave');
	const strong = noisy || present.includes('glitch');

	return (
		<>
			<p className="signaly-field-hint">{l('intro')}</p>
			<NamedList
				items={ways}
				l={key => l(`list.${key}`)}
				onAdd={() => {
					onChange([...ways, newFirstWay(ways, l('newName'))]);
					onSelect(ways.length);
				}}
				onChange={onChange}
				onCopy={() => {
					const next = ways.slice();

					next.splice(selected + 1, 0, copyNamed(ways, way, l('copySuffix')));
					onChange(next);
					onSelect(selected + 1);
				}}
				onSelect={onSelect}
				selected={selected}
				used={used}
			/>
			{!way && <p className="signaly-field-hint">{l('empty')}</p>}
			{way && (
				<>
					<TextField label={l('name')} onChange={name => set({name})} value={way.name} />
					<ChoiceField label={l('mode')} onChange={mode => set({mode: mode as FirstWay['mode']})} options={modes} value={way.mode} />
					<h3>{l('partsTitle')}</h3>
					{firstParts.map((part: FirstPart) => (
						<ChoiceField
							key={part}
							label={l(`parts.${part}`)}
							onChange={value => set({[part]: value as FirstPartMode})}
							options={[{label: l('same'), value: ''}, {label: l('now'), value: 'now'}, ...modes]}
							value={way[part]}
						/>
					))}
					<h3>{l('timing')}</h3>
					<RangeField hint={l('timeHint')} label={l('time')} max={10} min={0.1} onChange={time => set({time})} step={0.1} unit={seconds} value={way.time} />
					<RangeField hint={l('stepHint')} label={l('step')} max={5} min={0} onChange={step => set({step})} step={0.05} unit={seconds} value={way.step} />
					<RangeField label={l('delay')} max={10} min={0} onChange={delay => set({delay})} step={0.1} unit={seconds} value={way.delay} />
					{strong && <RangeField label={l('power')} max={100} min={0} onChange={power => set({power})} unit="%" value={way.power} />}
					{noisy && (
						<ColorField label={l('color')} onChange={color => set({color})} onSaveColor={onSaveColor} savedColors={savedColors} value={way.color} />
					)}
					<CheckField hint={l('skipHint')} label={l('skip')} onChange={skip => set({skip})} value={way.skip} />
					<p className="signaly-field-hint">{l('howTo')}</p>
				</>
			)}
		</>
	);
};
