// «Twine СИГНАЛЫ»: вкладка «Кнопки на экране» окна «Виды кнопок и ссылок».
// Каждая кнопка стоит на месте, заданном от угла окна терминала, и не
// прокручивается с текстом. В пассаж её вставляет панель над текстом.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	Kind,
	Place,
	placePrefix,
	slugify,
	uniqueName
} from '../../util/signaly/signaly-kinds';
import {
	ChoiceField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';

export interface PlacesEditorProps {
	kinds: Kind[];
	onChange: (places: Place[]) => void;
	onSelect: (id: string | undefined) => void;
	places: Place[];
	selected?: string;
	/** Сколько пассажей используют место (по id). */
	useCount: (id: string) => number;
}

export const PlacesEditor: React.FC<PlacesEditorProps> = props => {
	const {kinds, onChange, onSelect, places, selected, useCount} = props;
	const {t} = useTranslation();
	const [newName, setNewName] = React.useState('');
	const place = places.find(p => p.id === selected);
	const px = t('signaly.appearance.units.px');
	const label = (key: string) => t(`signaly.kinds.places.${key}`);

	function update(changes: Partial<Place>) {
		onChange(places.map(p => (p.id === selected ? {...p, ...changes} : p)));
	}

	function add() {
		const name = newName.trim();

		if (name === '') {
			return;
		}

		const id = uniqueName(
			slugify(name),
			places.map(p => p.id)
		);
		const base = place ?? {corner: 'tr' as const, x: 20, y: 20, kind: ''};

		onChange([...places, {...base, id, name, y: base.y + 60}]);
		onSelect(id);
		setNewName('');
	}

	function remove() {
		if (!place) {
			return;
		}

		const count = useCount(place.id);

		if (
			count > 0 &&
			!window.confirm(t('signaly.kinds.places.confirmDelete', {count}))
		) {
			return;
		}
		onChange(places.filter(p => p.id !== place.id));
		onSelect(undefined);
	}

	return (
		<>
			<section>
				<p className="signaly-field-hint">{label('intro')}</p>
				<div className="signaly-kinds-list">
					{places.map(p => (
						<button
							aria-pressed={p.id === selected}
							className="signaly-kinds-item"
							key={p.id}
							onClick={() => onSelect(p.id)}
							type="button"
						>
							{p.name}
						</button>
					))}
				</div>
				<div className="signaly-kinds-add">
					<input
						aria-label={label('newName')}
						className="signaly-text"
						onChange={e => setNewName(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && add()}
						placeholder={label('newName')}
						value={newName}
					/>
					<button
						className="signaly-button"
						disabled={newName.trim() === ''}
						onClick={add}
						type="button"
					>
						{label('add')}
					</button>
				</div>
			</section>
			{place && (
				<section>
					<h3>{place.name}</h3>
					<TextField
						label={label('name')}
						onChange={name => update({name})}
						value={place.name}
					/>
					<p className="signaly-field-hint">
						{t('signaly.kinds.places.code', {
							code: `<span class="${placePrefix}${place.id}">…</span>`
						})}
					</p>
					<ChoiceField
						label={label('kind')}
						onChange={kind => update({kind})}
						options={kinds.map(k => ({label: k.name, value: k.cls}))}
						value={place.kind}
					/>
					<ChoiceField
						hint={label('cornerHint')}
						label={label('corner')}
						onChange={corner => update({corner: corner as Place['corner']})}
						options={(['tl', 'tr', 'bl', 'br'] as const).map(c => ({
							label: label(`corners.${c}`),
							value: c
						}))}
						value={place.corner}
					/>
					<RangeField
						hint={label('xHint')}
						label={label(place.corner.endsWith('r') ? 'xRight' : 'xLeft')}
						max={1000}
						min={-500}
						onChange={x => update({x})}
						step={0.25}
						unit={px}
						value={place.x}
					/>
					<RangeField
						label={label(place.corner.startsWith('b') ? 'yBottom' : 'yTop')}
						max={1100}
						min={-500}
						onChange={y => update({y})}
						step={0.25}
						unit={px}
						value={place.y}
					/>
					<button className="signaly-button" onClick={remove} type="button">
						{label('delete')}
					</button>
				</section>
			)}
		</>
	);
};
