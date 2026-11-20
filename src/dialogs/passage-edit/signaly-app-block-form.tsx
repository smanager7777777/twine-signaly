// «Twine СИГНАЛЫ»: форма «Блок приложения» (сессия 33, этап Т3-1 — claude/13 раздел 6б).
// Пассаж — блок данных приложения для телефонов: первой строкой <<app-block "id" …>> и тег
// app-block (11_APP_IN_STORY.md). Форма правит первую строку (кому, с главы, сразу, передать,
// искажён) и строки картинок и звука <<app-img>> / <<app-audio>> (файлы — media/app/ папки
// игры); остальной текст пассажа — текст блока. Каждое изменение сразу переписывает текст.

import * as React from 'react';
import {TwineElectronWindow} from '../../electron/shared';
import {Passage, Story} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {appMediaDir, codesPassageOf} from '../../util/signaly/signaly-app';
import {
	accountsOf,
	addBlockMedia,
	appRefs,
	BlockHead,
	blockMedia,
	codesOpening,
	readBlockHead,
	setBlockMedia,
	writeBlockHead
} from '../../util/signaly/signaly-app-model';
import {readCodes} from '../../util/signaly/signaly-codes';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {accountLabel, AppRefsContext, ChapterField, usePhoneL} from '../signaly-app/signaly-app-fields';

/** Файлы media/app/ папки игры (имена без «media/app/»). */
export function useAppFiles(story: Story) {
	const {available, gameFolder} = useGameFolder();
	const folder = available ? gameFolder(story.id) : undefined;
	const [files, setFiles] = React.useState<string[]>([]);
	const [tick, setTick] = React.useState(0);

	React.useEffect(() => {
		let cancelled = false;
		const b = (window as TwineElectronWindow).twineElectron;

		if (folder && b?.signalyListAppFiles) {
			b.signalyListAppFiles(folder).then(list => {
				if (!cancelled) {
					setFiles(
						list
							.filter(p => p.startsWith(appMediaDir))
							.map(p => p.slice(appMediaDir.length))
							.sort((x, y) => x.localeCompare(y, 'ru'))
					);
				}
			});
		}
		return () => {
			cancelled = true;
		};
	}, [folder, tick]);

	return {files, folder, refresh: () => setTick(n => n + 1)};
}

const isImage = (f: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f);
const isAudio = (f: string) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f);

export const AppBlockForm: React.FC<{
	passage: Passage;
	story: Story;
	text: string;
	tagged: boolean;
	onText: (text: string) => void;
	onTag: () => void;
	onRemove: () => void;
	/** Где курсор в тексте пассажа (ответ Т3-10 А: «+ Картинка» и «+ Звук» — туда). */
	cursor?: () => {line: number; ch: number} | undefined;
}> = ({cursor, onRemove, onTag, onText, passage, story, tagged, text}) => {
	const l = usePhoneL();
	const head = readBlockHead(text);
	const table = React.useMemo(() => readCodes(codesPassageOf(story.passages)?.text ?? ''), [story.passages]);
	const refs = React.useMemo(() => appRefs(story.passages, table), [story.passages, table]);
	const people = accountsOf(table);
	const {files, folder} = useAppFiles(story);
	const media = blockMedia(text);

	if (!head) {
		return null;
	}

	const write = (patch: Partial<BlockHead>) => onText(writeBlockHead(text, {...head, ...patch}));
	const parts = passage.name.split('/');
	const title = parts.pop();
	const opening = codesOpening(table, head.id);
	const fileOptions = (type: 'image' | 'audio', current: string) => {
		const list = files.filter(type === 'image' ? isImage : isAudio);

		return [
			{label: l('block.noFile'), value: ''},
			...list.map(f => ({label: f, value: f})),
			...(current && !list.includes(current) ? [{label: l('block.missingFile', {file: current}), value: current}] : [])
		];
	};

	return (
		<AppRefsContext.Provider value={refs}>
			{!tagged && (
				<div className="signaly-notice">
					{l('block.noTag')}{' '}
					<button className="signaly-button" onClick={onTag} type="button">
						{l('block.addTag')}
					</button>
				</div>
			)}
			<div className="signaly-field-hint">
				{l('block.name', {folder: parts.join('/') || '—', title})} {l('block.nameHint')}
			</div>
			<div className="signaly-field-hint">{l('block.textHint')}</div>
			<div className="signaly-field-hint">{l('block.id', {id: head.id})}</div>
			<div className="signaly-field">
				<div className="signaly-field-label">{l('block.who')}</div>
				<div className="signaly-codes-people" role="group" aria-label={l('block.who')}>
					{people.length === 0 && <div className="signaly-field-hint">{l('noAccounts')}</div>}
					{people.map(p => (
						<CheckField
							key={p.num}
							label={accountLabel(p)}
							onChange={on => write({who: on ? [...head.who, p.num] : head.who.filter(w => w !== p.num)})}
							value={head.who.includes(p.num)}
						/>
					))}
					{head.who
						.filter(w => !people.some(p => p.num === w))
						.map(w => (
							<CheckField key={w} label={`? №${w}`} onChange={() => write({who: head.who.filter(x => x !== w)})} value />
						))}
				</div>
				<div className="signaly-field-hint">{head.who.length ? l('block.whoHint') : l('allAccounts')}</div>
			</div>
			<ChapterField label={l('block.chapter')} onChange={chapter => write({chapter})} value={head.chapter} />
			<CheckField hint={l('block.startHint')} label={l('block.start')} onChange={start => write({start})} value={head.start} />
			<CheckField label={l('block.share')} onChange={share => write({share})} value={head.share} />
			<CheckField label={l('block.hidden')} onChange={hidden => write({hidden})} value={!!head.hidden} />
			<ChoiceField
				hint={l('block.garbleHint')}
				label={l('block.garble')}
				onChange={v => write({garble: Number(v)})}
				options={[
					{label: l('block.garbleNo'), value: '0'},
					...refs.chapters.slice(1).map(c => ({label: l('block.garbleTo', {name: c.name}), value: String(c.n)}))
				]}
				value={String(head.garble || 0)}
			/>
			<div className="signaly-field">
				<div className="signaly-field-label">{l('block.codes')}</div>
				<div className="signaly-field-hint">
					{opening.length ? opening.join('; ') : head.start ? l('block.codesStart') : l('block.codesNone')}
				</div>
			</div>
			<h5 className="signaly-block-subtitle">{l('block.media')}</h5>
			{!folder && <div className="signaly-field-hint">{l('block.noFolder')}</div>}
			{media.map(m => (
				<fieldset className="signaly-block-row" key={m.line}>
					<legend>{l(m.type === 'image' ? 'block.image' : 'block.audio')}</legend>
					<ChoiceField
						label={l('block.file')}
						onChange={file => onText(setBlockMedia(text, m.line, {...m, file}))}
						options={fileOptions(m.type, m.file)}
						value={m.file}
					/>
					<TextField
						label={l(m.type === 'image' ? 'block.caption' : 'block.audioTitle')}
						onChange={caption => onText(setBlockMedia(text, m.line, {...m, caption}))}
						value={m.caption}
					/>
					<button className="signaly-button" onClick={() => onText(setBlockMedia(text, m.line, undefined))} type="button">
						{l('block.removeMedia')}
					</button>
				</fieldset>
			))}
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => onText(addBlockMedia(text, {type: 'image', file: files.find(isImage) ?? '', caption: ''}, cursor?.()))}
					type="button"
				>
					{l('block.addImage')}
				</button>
				<button
					className="signaly-button"
					onClick={() => onText(addBlockMedia(text, {type: 'audio', file: files.find(isAudio) ?? '', caption: ''}, cursor?.()))}
					type="button"
				>
					{l('block.addAudio')}
				</button>
			</div>
			<div className="signaly-field-hint">{l('block.mediaHint')}</div>
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => {
						if (window.confirm(l('block.confirmRemove'))) {
							onRemove();
						}
					}}
					type="button"
				>
					{l('block.remove')}
				</button>
			</div>
		</AppRefsContext.Provider>
	);
};
