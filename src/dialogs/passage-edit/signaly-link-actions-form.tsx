// «Twine СИГНАЛЫ»: форма «Ссылка / кнопка» — надпись, вид, ссылка или кнопка,
// действия по порядку и экран, на который перейти после них (шаг 3.2, ответы
// автора 1А–6А). Каждое изменение сразу переписывает ссылку в тексте пассажа;
// всё — обычные команды SugarCube (см. util/signaly/signaly-actions.ts).

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {LinkItem, writeLink} from '../../util/signaly/signaly-actions';
import {applyKind, kindAt} from '../../util/signaly/signaly-format';
import {findBlocks, writeBlock} from '../../util/signaly/signaly-screen-blocks';
import {ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {ActionContext, ActionList} from './signaly-action-list';

type L = (key: string, options?: Record<string, unknown>) => string;

export interface LinkActionsFormProps extends ActionContext {
	link: LinkItem;
	text: string;
	onText: (text: string) => void;
	kinds: Array<{cls: string; name: string}>;
}

export const LinkActionsForm: React.FC<LinkActionsFormProps> = props => {
	const {audio, audioFiles, current, fileChoice, kinds, link, onText, passages, text, variables} = props;
	const {t} = useTranslation();
	const l: L = (key, options) => t(`signaly.actions.${key}`, options);
	const write = (next: Partial<LinkItem>) =>
		onText(text.slice(0, link.from) + writeLink({...link, ...next}) + text.slice(link.to));
	const passageChoice = (label: string, value: string, onChange: (v: string) => void, none?: string) => (
		<ChoiceField
			label={label}
			onChange={onChange}
			options={[...(none !== undefined ? [{label: none, value: ''}] : []), ...passages.map(p => ({label: p, value: p}))]}
			value={value}
		/>
	);

	/* ----- Вид: обёртка <span class> или кнопка на экране ----- */

	const kindClasses = kinds.map(k => k.cls).filter(Boolean);
	const place = findBlocks(text).find(
		b => b.type === 'place' && b.headTo !== undefined && b.headTo <= link.from && b.to - '<</sg-place>>'.length >= link.to
	);
	const kind = place ? String(place.values.kind ?? '') : kindAt(text, link.from, link.to, kindClasses);
	const setKind = (cls: string) => {
		if (place) {
			onText(
				text.slice(0, place.from) +
					writeBlock({...place, values: {...place.values, kind: cls || undefined}}) +
					text.slice(place.to)
			);
			return;
		}

		const made = applyKind(text, link.from, link.to, cls, kindClasses, '');

		if (made) {
			onText(text.slice(0, made.from) + made.insert + text.slice(made.to));
		}
	};

	return (
		<>
			{link.label !== undefined ? (
				<TextField label={l('label')} onChange={label => write({label})} value={link.label} />
			) : (
				<div className="signaly-field-hint">{l('labelCode')}</div>
			)}
			<ChoiceField
				hint={place ? l('kindPlace') : undefined}
				label={l('kind')}
				onChange={setKind}
				options={kinds.map(k => ({label: k.name, value: k.cls}))}
				value={kind}
			/>
			<ChoiceField
				label={l('form')}
				onChange={form => write({form: form as 'link' | 'button'})}
				options={[
					{label: l('forms.link'), value: 'link'},
					{label: l('forms.button'), value: 'button'}
				]}
				value={link.form}
			/>
			<h4 className="signaly-block-subtitle">{l('list')}</h4>
			<ActionList
				actions={link.actions}
				audio={audio}
				audioFiles={audioFiles}
				current={current}
				fileChoice={fileChoice}
				onChange={actions => write({actions})}
				passages={passages}
				variables={variables}
			/>
			{link.headCode === undefined &&
				passageChoice(l('goto'), link.passage, passage => write({passage}), l('gotoNone'))}
			<div className="signaly-field-hint">{l(link.markup ? 'hintMarkup' : 'hint')}</div>
		</>
	);
};
