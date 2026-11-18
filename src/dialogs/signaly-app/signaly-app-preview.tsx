// «Twine СИГНАЛЫ»: предпросмотр телефона в окне «Приложение» (сессия 33, ответ Т3-2 А):
// справа — плеер приложения signaly-app (MIT, public/signaly-app/player.html, скрипт
// signaly/tools/sync-app-player.py) в iframe с name="sg-preview": вход любым персонажем,
// глава, «открыть все блоки», без сети. Пакет собирается из того, что сейчас в окне (в том
// числе несохранённое), файлы — из media/app/ папки игры. Протокол — как у предпросмотра
// редактора приложения: плеер шлёт sg-preview-ready, окно — {type: 'sg-pack', data, account,
// chapter, unlockAll}.

import * as React from 'react';
import {TwineElectronWindow} from '../../electron/shared';
import {Story} from '../../store/stories';
import {
	AppFiles,
	AppGame,
	appSettingsTag,
	codesPassageOf,
	settingsPassageOf,
	StoryPassage,
	storyToGame,
	writeSettings,
	writeSgpack
} from '../../util/signaly/signaly-app';
import {accountsOf} from '../../util/signaly/signaly-app-model';
import {CodeTable, codesHeader, codesPassageName, codesTag, writeCodes} from '../../util/signaly/signaly-codes';
import {CheckField, ChoiceField} from '../signaly-appearance/signaly-appearance-fields';
import {accountLabel, usePhoneL} from './signaly-app-fields';

/** Пассажи истории с тем, что сейчас в окне: общие настройки и таблица «Коды». */
export function passagesWith(story: Story, game: AppGame, table: CodeTable): StoryPassage[] {
	const settings = settingsPassageOf(story.passages);
	const codes = codesPassageOf(story.passages);
	const out: StoryPassage[] = story.passages.map(p =>
		p === settings ? {...p, text: writeSettings(game)} : p === codes ? {...p, text: writeCodes(p.text, table)} : p
	);

	if (!settings) {
		out.push({name: 'Приложение', tags: [appSettingsTag], text: writeSettings(game)});
	}
	if (!codes) {
		out.push({name: codesPassageName, tags: [codesTag], text: writeCodes(codesHeader, table)});
	}
	return out;
}

/** Пакет .sgpack из того, что в окне; missing — файлы, которых нет в папке игры. */
export async function buildPack(story: Story, game: AppGame, table: CodeTable, folder: string | undefined) {
	const b = (window as TwineElectronWindow).twineElectron;
	const appFiles = folder && b?.signalyListAppFiles ? await b.signalyListAppFiles(folder) : [];
	const built = storyToGame(passagesWith(story, game, table), appFiles);
	const files: AppFiles = {};
	const missing: string[] = [];

	for (const f of built.files) {
		try {
			if (!folder || !b) {
				throw new Error('no folder');
			}
			files[f.name] = await b.signalyReadMedia(folder, f.path);
		} catch {
			missing.push(f.path);
		}
	}
	return {game: built.game, data: writeSgpack(built.game, files), missing, problems: built.problems};
}

export const AppPreview: React.FC<{
	folder?: string;
	game: AppGame;
	story: Story;
	table: CodeTable;
	/** Растёт после «Сохранить» — пакет отправляется заново. */
	version: number;
}> = ({folder, game, story, table, version}) => {
	const l = usePhoneL();
	const frame = React.useRef<HTMLIFrameElement>(null);
	const [ready, setReady] = React.useState(false);
	const [account, setAccount] = React.useState('');
	const [chapter, setChapter] = React.useState(1);
	const [all, setAll] = React.useState(false);
	const [note, setNote] = React.useState('');
	const accounts = accountsOf(table);
	const chapters: AppGame[] = Array.isArray(game.chapters) && game.chapters.length ? game.chapters : [{name: 'Глава 1'}];
	const latest = React.useRef({game, table, account, chapter, all});

	latest.current = {game, table, account, chapter, all};

	const send = React.useCallback(async () => {
		const win = frame.current?.contentWindow;

		if (!win) {
			return;
		}

		const now = latest.current;

		try {
			const pack = await buildPack(story, now.game, now.table, folder);
			const data = pack.data.buffer.slice(pack.data.byteOffset, pack.data.byteOffset + pack.data.byteLength);

			win.postMessage({type: 'sg-pack', data, account: now.account || null, chapter: now.chapter, unlockAll: now.all}, '*');
			setNote(pack.missing.length ? l('preview.missing', {list: pack.missing.join(', ')}) : '');
		} catch (e) {
			setNote(String((e as Error).message ?? e));
		}
	}, [folder, l, story]);

	React.useEffect(() => {
		const onMessage = (ev: MessageEvent) => {
			if (ev.data?.type === 'sg-preview-ready' && ev.source === frame.current?.contentWindow) {
				setReady(true);
				send();
			}
		};

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [send]);

	React.useEffect(() => {
		if (ready) {
			send();
		}
	}, [account, chapter, all, version]); // eslint-disable-line

	return (
		<div className="signaly-phone-preview">
			<ChoiceField
				label={l('preview.account')}
				onChange={setAccount}
				options={[{label: l('preview.login'), value: ''}, ...accounts.map(a => ({label: accountLabel(a), value: a.id}))]}
				value={account}
			/>
			<ChoiceField
				label={l('preview.chapter')}
				onChange={v => setChapter(Number(v))}
				options={chapters.map((c, i) => ({label: `${i + 1}. ${c.name ?? ''}`, value: String(i + 1)}))}
				value={String(chapter)}
			/>
			<CheckField label={l('preview.all')} onChange={setAll} value={all} />
			<button className="signaly-button" disabled={!ready} onClick={send} type="button">
				{l('preview.refresh')}
			</button>
			{note && <div className="signaly-field-hint">{note}</div>}
			<div className="signaly-phone-frame">
				<iframe
					allow="camera; autoplay"
					name="sg-preview"
					ref={frame}
					src="signaly-app/player.html#preview"
					title={l('preview.title')}
				/>
			</div>
			<div className="signaly-field-hint">{l('preview.hint')}</div>
		</div>
	);
};
