// «Twine СИГНАЛЫ», сессия 41 (ответ Т32-3 А, П-28): у трека с картинками SSTV (помехи и передачи радио с декодером) —
// какую картинку набирает окно декодера: расшифрованную из звука (как раньше) или свою из media/img/ папки игры
// (например, чистую или другую). Пишется сразу в пассаж «SSTV» (show "…" у строки <<sg-sstv>>); телефоны звук
// расшифровывают честно. Картинок ещё нет — они появятся после «Сохранить» (программа разбирает звук).

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {TwineElectronWindow} from '../../electron/shared';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {readSstv, SstvFile, sstvFolder, sstvTag, writeSstv} from '../../util/signaly/signaly-sstv-store';
import {ChoiceField} from '../signaly-appearance/signaly-appearance-fields';
import {useMediaUrl} from '../signaly-app/signaly-app-media-pick';

const isImage = (f: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(f);
const clean = (src: string) => src.replace(/^\.\//, '');

const Preview: React.FC<{folder?: string; file: string; label: string}> = ({file, folder, label}) => {
	const url = useMediaUrl(folder, file);

	return url ? (
		<figure className="signaly-sstv-show-preview" style={{display: 'inline-block', margin: '4px 12px 4px 0'}}>
			<img alt={file} src={url} style={{display: 'block', maxWidth: 160, maxHeight: 128, imageRendering: 'pixelated'}} />
			<figcaption className="signaly-field-hint">{label}</figcaption>
		</figure>
	) : null;
};

export const SstvShowPick: React.FC<{story: Story; src: string}> = ({src, story}) => {
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.music.sstvShow.${key}`, options);
	const {dispatch} = useStoriesContext();
	const {available, gameFolder} = useGameFolder();
	const folder = available ? gameFolder(story.id) : undefined;
	const passage = story.passages.find(p => p.tags.includes(sstvTag));
	const files = React.useMemo(() => (passage ? readSstv(passage.text) : new Map<string, SstvFile>()), [passage]);
	const file = files.get(clean(src)) ?? files.get(src);
	const [imgs, setImgs] = React.useState<string[]>([]);

	React.useEffect(() => {
		const b = (window as TwineElectronWindow).twineElectron;

		if (folder && b?.signalyListMedia && file?.images.length) {
			b.signalyListMedia(folder, 'img').then(list =>
				setImgs(list.filter(p => isImage(p) && !p.startsWith(sstvFolder)).sort((x, y) => x.localeCompare(y, 'ru')))
			);
		}
	}, [folder, file]);

	if (!passage || !file || !file.images.length) {
		return null;
	}

	function setShow(n: number, show: string) {
		if (!passage || !file) {
			return;
		}

		const next = new Map(files);

		next.set(file.src, {...file, images: file.images.map((r, i) => (i === n ? {...r, show: show || undefined} : r))});

		const text = writeSstv(passage.text, next);

		if (text !== passage.text) {
			dispatch(updatePassage(story, passage, {text}));
		}
	}

	return (
		<div className="signaly-sstv-show" data-src={file.src}>
			<h4 className="signaly-block-subtitle">{l('title')}</h4>
			<div className="signaly-field-hint">{l('hint')}</div>
			{file.images.map((r, n) => (
				<div className="signaly-sstv-show-row" key={n}>
					<ChoiceField
						label={l('picture', {n: n + 1, mode: r.mode, at: r.at.toFixed(1)})}
						onChange={show => setShow(n, show)}
						options={[
							{label: l('decoded'), value: ''},
							...imgs.map(f => ({label: f.replace(/^media\/img\//, ''), value: f})),
							...(r.show && !imgs.includes(r.show) ? [{label: l('missing', {file: r.show}), value: r.show}] : [])
						]}
						value={r.show ?? ''}
					/>
					<Preview file={r.img} folder={folder} label={l('fromSound')} />
					{r.show && <Preview file={r.show} folder={folder} label={l('own')} />}
				</div>
			))}
			{!folder && <div className="signaly-field-hint">{l('noFolder')}</div>}
		</div>
	);
};
