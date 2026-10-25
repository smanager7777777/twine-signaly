// «Twine СИГНАЛЫ»: форма «Событие» (шаг 3.5, ответы 1А–6А). Пассаж становится
// событием: первой строкой <<sg-event условие>> и тег sg-event. Каждое
// изменение сразу переписывает команду в тексте.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {EventHead, setEventHead} from '../../util/signaly/signaly-events';
import {writeExpr} from '../../util/signaly/signaly-logic';
import {KnownVariable} from '../../util/signaly/signaly-variables';
import {CheckField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {CondRows} from './signaly-logic-form';

function numberOf(input: string) {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : undefined;
}

export const EventForm: React.FC<{
	head: EventHead;
	text: string;
	tagged: boolean;
	onText: (text: string) => void;
	onTag: () => void;
	onRemove: () => void;
	variables: KnownVariable[];
}> = ({head, onRemove, onTag, onText, tagged, text, variables}) => {
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.events.${key}`);
	const write = (patch: Partial<EventHead>) => onText(setEventHead(text, {...head, ...patch}));

	return (
		<>
			{!tagged && (
				<div className="signaly-notice">
					{l('noTag')}{' '}
					<button className="signaly-button" onClick={onTag} type="button">
						{l('addTag')}
					</button>
				</div>
			)}
			<h5 className="signaly-block-subtitle">{l('when')}</h5>
			{head.conds && head.conds.length > 0 ? (
				<CondRows
					conds={head.conds}
					join={head.join}
					onChange={(conds, join) => write({expr: writeExpr(conds, join)})}
					variables={variables}
				/>
			) : (
				<>
					<div className="signaly-field-hint">{t('signaly.logic.cond.code')}</div>
					<TextField label={t('signaly.logic.cond.expr')} onChange={expr => write({expr})} value={head.expr} />
				</>
			)}
			<CheckField hint={l('repeatHint')} label={l('repeat')} onChange={repeat => write({repeat})} value={head.repeat} />
			<TextField
				hint={l('delayHint')}
				label={l('delay')}
				onChange={input => {
					const n = numberOf(input);

					if (n !== undefined && n >= 0) {
						write({delay: n});
					}
				}}
				value={String(head.delay)}
			/>
			<TextField
				hint={l('priorityHint')}
				label={l('priority')}
				onChange={input => {
					const n = numberOf(input);

					if (n !== undefined) {
						write({priority: n});
					}
				}}
				value={String(head.priority)}
			/>
			<div className="signaly-field-hint">{l('hint')}</div>
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => {
						if (window.confirm(l('confirmRemove'))) {
							onRemove();
						}
					}}
					type="button"
				>
					{l('remove')}
				</button>
			</div>
		</>
	);
};
