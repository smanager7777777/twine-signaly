// «Twine СИГНАЛЫ»: форма «Доступ» (шаг 4.3, ответы 1А, 2Б, 3А, 5А). Условие, при
// котором экран открыт; пассаж блокировки; всё, что ведёт на этот экран, и что
// каждый источник делает, пока экран закрыт. Каждое изменение сразу
// переписывает команду <<sg-access>> в тексте.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Passage, Story} from '../../store/stories';
import {
	accessActions,
	AccessAction,
	AccessHead,
	AccessKind,
	accessKinds,
	AccessRule,
	AccessSource,
	accessSources,
	lockTag,
	sameSource,
	setAccess,
	withRule
} from '../../util/signaly/signaly-access';
import {eventTag} from '../../util/signaly/signaly-events';
import {writeExpr} from '../../util/signaly/signaly-logic';
import {KnownVariable} from '../../util/signaly/signaly-variables';
import {ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {CondListsContext, CondRows} from './signaly-logic-form';

export const AccessForm: React.FC<{
	head: AccessHead;
	text: string;
	passage: Passage;
	story: Story;
	tagged: boolean;
	onText: (text: string) => void;
	onTag: () => void;
	onRemove: () => void;
	/** Сделать пассаж общим пассажем блокировки ('' — общего нет). */
	onSharedLock: (name: string) => void;
	variables: KnownVariable[];
}> = ({head, onRemove, onSharedLock, onTag, onText, passage, story, tagged, text, variables}) => {
	const {t} = useTranslation();
	const {passages} = React.useContext(CondListsContext);
	const l = (key: string, options?: Record<string, string>) => t(`signaly.access.${key}`, options ?? {});
	const write = (patch: Partial<AccessHead>) => onText(setAccess(text, {...head, ...patch}));
	const sources = React.useMemo(() => accessSources(story.passages, passage.name), [story.passages, passage.name]);
	const shared = story.passages.find(p => p.tags.includes(lockTag))?.name ?? '';
	const screens = passages.filter(name => name !== passage.name).map(name => ({label: name, value: name}));
	const actionName = (kind: AccessKind, action: AccessAction) => l(`action.${kind}.${action}`);
	const sourceName = (s: Pick<AccessSource, 'kind' | 'label' | 'from' | 'note'>) =>
		s.kind === 'link'
			? l(s.note === 'button' ? 'source.button' : 'source.link', {label: s.label, from: s.from ?? ''})
			: s.note
			? l(`source.${s.note}`, {label: s.label})
			: s.label;
	const usesBlock = accessKinds.some(k => head.groups[k] === 'block') || head.rules.some(r => r.action === 'block');
	const missingLock = usesBlock && !head.lock && !shared;

	// Правила, чей источник уже убрали из игры, тоже видны: их можно снять.
	const stale: AccessSource[] = head.rules
		.filter(r => !sources.some(s => sameSource(s, r)))
		.map(r => ({kind: r.kind, id: r.id, from: r.from, label: r.id}));

	function row(s: AccessSource, gone: boolean) {
		const rule: AccessRule | undefined = head.rules.find(r => sameSource(r, s));
		const name = gone ? `${sourceName(s)} ${l('stale')}` : sourceName(s);

		return (
			<React.Fragment key={`${s.kind}|${s.from ?? ''}|${s.id}`}>
				<ChoiceField
					label={name}
					onChange={value =>
						write({rules: withRule(head.rules, s, value === '' ? undefined : (value as AccessAction), rule?.to)})
					}
					options={[
						{label: l('same', {action: actionName(s.kind, head.groups[s.kind])}), value: ''},
						...accessActions[s.kind].map(action => ({label: actionName(s.kind, action), value: action}))
					]}
					value={rule?.action ?? ''}
				/>
				{rule?.action === 'block' && (
					<ChoiceField
						label={l('to', {name: s.label})}
						onChange={value => write({rules: withRule(head.rules, s, 'block', value)})}
						options={[{label: l('toScreen'), value: ''}, ...screens]}
						value={rule.to ?? ''}
					/>
				)}
			</React.Fragment>
		);
	}

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
			<h5 className="signaly-block-subtitle">{l('lockTitle')}</h5>
			<ChoiceField
				label={l('lock')}
				onChange={lock => write({lock})}
				options={[
					{label: shared ? l('lockShared', {name: shared}) : l('lockSharedNone'), value: ''},
					...screens
				]}
				value={head.lock}
			/>
			<ChoiceField
				hint={l('sharedHint')}
				label={l('shared')}
				onChange={onSharedLock}
				options={[{label: l('sharedNone'), value: ''}, ...screens]}
				value={shared}
			/>
			{missingLock && <div className="signaly-notice">{l('noLock')}</div>}
			<h5 className="signaly-block-subtitle">{l('sources')}</h5>
			<div className="signaly-field-hint">{l('sourcesHint')}</div>
			{accessKinds
				.filter(kind => kind !== 'event' || passage.tags.includes(eventTag))
				.map(kind => (
					<div className="signaly-access-group" key={kind}>
						<ChoiceField
							label={l(`group.${kind}`)}
							onChange={value => write({groups: {...head.groups, [kind]: value as AccessAction}})}
							options={accessActions[kind].map(action => ({label: actionName(kind, action), value: action}))}
							value={head.groups[kind]}
						/>
						{sources.filter(s => s.kind === kind).map(s => row(s, false))}
						{stale.filter(s => s.kind === kind).map(s => row(s, true))}
					</div>
				))}
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
