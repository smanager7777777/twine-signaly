// «Twine СИГНАЛЫ»: вкладка «На телефоне» кода в окне «Коды» (сессия 33, этап Т3-1, ответы
// Т3-4 А и П-59 А4: у кода «оба» — свои ответ и действия на телефоне). Часть телефона —
// JSON кода приложения в <<sg-phone>> (11_APP_IN_STORY.md); поля — как в карточке кода
// редактора приложения: прибор, глава, голос, кому и что открывает, ответы по счёту,
// ограничения, подписи, особые ответы, «нет доступа», действия.

import * as React from 'react';
import {AppGame} from '../../util/signaly/signaly-app';
import {voiceHints} from '../../util/signaly/signaly-app-model';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {
	AccountsField,
	AppActions,
	AppRefsContext,
	AreaInput,
	BlocksField,
	ChapterField,
	NumField,
	StringsField,
	usePhoneL
} from '../signaly-app/signaly-app-fields';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PhoneCodeForm: React.FC<{
	data: AppGame;
	/** Код «оба»: комментарий — свой у телефона (у «только телефон» — подпись кода). */
	both: boolean;
	onChange: (data: AppGame) => void;
	texts?: AppGame;
}> = ({both, data, onChange}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);
	const set = (patch: AppGame) => onChange({...data, ...patch});
	const str = (key: string) => String(data[key] ?? '');
	const list = (key: string): any[] => (Array.isArray(data[key]) ? data[key] : []);
	const who = list('who');
	const answers = list('answers');
	const limit = Number(data.limit) || 0;
	const sign = Number(data.sign) || 0;
	const needNet = limit > 0 || !!data.perAcc || data.count === 'all' || sign > 1;
	const hints = voiceHints(refs.voice.unknown, str('voice'));
	const variants = list('variants');
	const setVariant = (i: number, patch: AppGame) => set({variants: variants.map((v, k) => (k === i ? {...v, ...patch} : v))});

	return (
		<>
			<ChoiceField
				hint={data.app ? l('code.appHint') : undefined}
				label={l('code.app')}
				onChange={app => set({app})}
				options={[
					{label: l('code.appNone'), value: ''},
					...refs.apps.map(a => ({label: l('code.appDevice', {name: a.name || a.id}), value: String(a.id)}))
				]}
				value={str('app')}
			/>
			<TextField hint={l('code.noteHint')} label={l('code.note')} onChange={note => set({note})} value={str('note')} />
			<ChapterField hint={l('code.chapterHint')} label={l('code.chapter')} onChange={chapter => set({chapter})} value={data.chapter} />
			{both && <TextField label={l('code.comment')} onChange={comment => set({comment})} value={str('comment')} />}
			{!data.app && (
				<>
					<h5 className="signaly-block-subtitle">{l('code.voiceTitle')}</h5>
					{hints.length > 0 && (
						<div className="signaly-notice">
							{hints.map(h => l(`voiceWhy.${h.why}`, {word: h.word})).join(' ')}
						</div>
					)}
					<TextField hint={l('code.voiceHint')} label={l('code.voice')} onChange={voice => set({voice})} value={str('voice')} />
					{str('voice').trim() !== '' && (
						<>
							<NumField hint={l('code.voiceMaxHint')} label={l('code.voiceMax')} onChange={voiceMax => set({voiceMax})} value={Number(data.voiceMax) || 0} />
							<NumField hint={l('code.voiceEveryHint')} label={l('code.voiceEvery')} onChange={voiceEvery => set({voiceEvery})} value={Number(data.voiceEvery) || 0} />
							<CheckField hint={l('code.termHint')} label={l('code.term')} onChange={term => set({term})} value={!!data.term} />
						</>
					)}
				</>
			)}
			<h5 className="signaly-block-subtitle">{l('code.opensTitle')}</h5>
			<AccountsField label={l('code.who')} onChange={v => set({who: v})} value={who} hint={who.length ? l('code.whoHint') : undefined} />
			<BlocksField label={l('code.opens')} onChange={opens => set({opens})} value={data.opens} />
			<AreaInput hint={l('code.answerHint')} label={l('code.answer')} onChange={answer => set({answer})} value={data.answer} />
			<StringsField
				addLabel={l('code.addAnswer')}
				itemLabel={i => l('code.nth', {n: i + 2})}
				label={l('code.answers')}
				onChange={v => set({answers: v})}
				value={answers}
			/>
			{answers.length > 0 && (
				<>
					<ChoiceField
						label={l('code.order')}
						onChange={order => set({order})}
						options={[
							{label: l('code.orderSeq'), value: 'seq'},
							{label: l('code.orderRandom'), value: 'random'}
						]}
						value={str('order') || 'seq'}
					/>
					<ChoiceField
						label={l('code.count')}
						onChange={count => set({count})}
						options={[
							{label: l('code.countAcc'), value: 'acc'},
							{label: l('code.countAll'), value: 'all'}
						]}
						value={str('count') || 'acc'}
					/>
				</>
			)}
			<h5 className="signaly-block-subtitle">{l(needNet ? 'code.limitsNet' : 'code.limits')}</h5>
			<NumField hint={l('code.limitHint')} label={l('code.limit')} onChange={v => set({limit: Math.round(v)})} value={limit} />
			<CheckField label={l('code.perAcc')} onChange={perAcc => set({perAcc})} value={!!data.perAcc} />
			<CheckField label={l('code.showLeft')} onChange={showLeft => set({showLeft})} value={!!data.showLeft} />
			{(limit > 0 || !!data.perAcc) && (
				<>
					<TextField label={l('code.emptyText')} onChange={emptyText => set({emptyText})} value={str('emptyText')} />
					<TextField label={l('code.mineText')} onChange={mineText => set({mineText})} value={str('mineText')} />
				</>
			)}
			<ChoiceField
				label={l('code.sign')}
				onChange={v => set({sign: Number(v)})}
				options={['0', '2', '3', '4'].map(v => ({label: l(`code.signN.${v}`), value: v}))}
				value={String(sign > 1 ? sign : 0)}
			/>
			{sign > 1 && (
				<NumField label={l('code.signWindow')} min={5} onChange={signWindow => set({signWindow})} value={Number(data.signWindow) || 60} />
			)}
			<div className="signaly-field-hint">{l(needNet ? 'code.netHint' : 'code.noNetHint')}</div>
			<h5 className="signaly-block-subtitle">{l('code.variants')}</h5>
			<div className="signaly-field-hint">{l('code.variantsHint')}</div>
			{variants.map((v, i) => (
				<fieldset className="signaly-block-row" key={i}>
					<legend>
						{l('code.variant', {n: i + 1})}{' '}
						<button className="signaly-button" onClick={() => set({variants: variants.filter((_, k) => k !== i)})} type="button">
							{l('code.removeVariant')}
						</button>
					</legend>
					<AccountsField label={l('code.variantWho')} onChange={w => setVariant(i, {who: w})} value={v.who} />
					<ChapterField label={l('code.variantChapter')} onChange={chapter => setVariant(i, {chapter})} value={v.chapter} />
					<AreaInput label={l('code.variantAnswer')} onChange={answer => setVariant(i, {answer})} value={v.answer} />
					<StringsField
						addLabel={l('code.addAnswer')}
						itemLabel={k => l('code.nth', {n: k + 2})}
						label={l('code.answers')}
						onChange={a => setVariant(i, {answers: a})}
						value={v.answers}
					/>
					<BlocksField label={l('code.opens')} onChange={opens => setVariant(i, {opens})} value={v.opens} />
				</fieldset>
			))}
			<button
				className="signaly-button"
				onClick={() =>
					set({variants: [...variants, {id: `w${Math.random().toString(36).slice(2, 8)}`, who: [], chapter: 1, answer: '', answers: [], order: 'seq', opens: []}]})
				}
				type="button"
			>
				{l('code.addVariant')}
			</button>
			<h5 className="signaly-block-subtitle">{l('code.others')}</h5>
			{who.length > 0 ? (
				<>
					<CheckField label={l('code.deniedAsWrong')} onChange={deniedAsWrong => set({deniedAsWrong})} value={!!data.deniedAsWrong} />
					{!data.deniedAsWrong && (
						<>
							<AreaInput label={l('code.denied')} onChange={denied => set({denied})} value={data.denied} />
							<BlocksField label={l('code.deniedOpens')} onChange={deniedOpens => set({deniedOpens})} value={data.deniedOpens} />
						</>
					)}
				</>
			) : (
				<div className="signaly-field-hint">{l('code.othersNone')}</div>
			)}
			<h5 className="signaly-block-subtitle">{l('code.actions')}</h5>
			<div className="signaly-field-hint">{l('code.actionsHint')}</div>
			<AppActions actions={data.actions} onChange={actions => set({actions})} self />
		</>
	);
};
