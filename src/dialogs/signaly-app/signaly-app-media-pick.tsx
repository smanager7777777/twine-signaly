// «Twine СИГНАЛЫ», сессия 41 (ответ Т32-4 А): картинка и mp3 события (окно «Приложение» → «Сеть и события» →
// «Уведомления») — выбор из файлов media/app/ папки игры, как у блока, и предпросмотр: картинка — сразу под списком,
// звук — плеером. Папка игры не выбрана — прежнее поле имени файла.

import * as React from 'react';
import {appMediaDir} from '../../util/signaly/signaly-app';
import {Story} from '../../store/stories';
import {TwineElectronWindow} from '../../electron/shared';
import {ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {useAppFiles} from '../passage-edit/signaly-app-block-form';
import {usePhoneL} from './signaly-app-fields';

export const isAppImage = (f: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f);
export const isAppAudio = (f: string) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f);

function mimeOf(f: string) {
	const e = (/\.([a-z0-9]+)$/i.exec(f)?.[1] ?? '').toLowerCase();

	return (
		{png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac'}[e] ??
		'application/octet-stream'
	);
}

/** Файл из media/app/ — адрес для предпросмотра (blob:), пока файл выбран. */
export function useAppFileUrl(folder: string | undefined, file: string) {
	return useMediaUrl(folder, file ? appMediaDir + file : '');
}

/** Файл папки игры (путь от неё, «media/…») — адрес для предпросмотра (blob:). */
export function useMediaUrl(folder: string | undefined, file: string) {
	const [url, setUrl] = React.useState('');

	React.useEffect(() => {
		const b = (window as TwineElectronWindow).twineElectron;
		let made = '';
		let cancelled = false;

		setUrl('');
		if (folder && file && b?.signalyReadMedia) {
			b.signalyReadMedia(folder, file)
				.then(data => {
					if (!cancelled && data && data.length) {
						made = URL.createObjectURL(new Blob([data as BlobPart], {type: mimeOf(file)}));
						setUrl(made);
					}
				})
				.catch(() => undefined);
		}
		return () => {
			cancelled = true;
			if (made) {
				URL.revokeObjectURL(made);
			}
		};
	}, [folder, file]);

	return url;
}

export const AppMediaPick: React.FC<{
	story: Story;
	type: 'image' | 'audio';
	label: string;
	hint?: string;
	value: string;
	onChange: (file: string) => void;
}> = ({hint, label, onChange, story, type, value}) => {
	const l = usePhoneL();
	const {files, folder, refresh} = useAppFiles(story);
	const url = useAppFileUrl(folder, value);

	if (!folder) {
		return (
			<>
				<TextField hint={hint} label={label} onChange={v => onChange(v.trim())} value={value} />
				<div className="signaly-field-hint">{l('block.noFolder')}</div>
			</>
		);
	}

	const list = files.filter(type === 'image' ? isAppImage : isAppAudio);
	const options = [
		{label: l('block.noFile'), value: ''},
		...list.map(f => ({label: f, value: f})),
		...(value && !list.includes(value) ? [{label: l('block.missingFile', {file: value}), value}] : [])
	];

	return (
		<div className="signaly-app-media-pick" data-type={type}>
			<ChoiceField hint={hint} label={label} onChange={onChange} options={options} value={value} />
			<button className="signaly-button" onClick={refresh} type="button">
				{l('notices.refreshFiles')}
			</button>
			{value !== '' && url !== '' && type === 'image' && (
				<img alt={value} className="signaly-app-media-preview" src={url} style={{display: 'block', maxWidth: 240, maxHeight: 180, marginTop: 6}} />
			)}
			{value !== '' && url !== '' && type === 'audio' && <audio className="signaly-app-media-preview" controls src={url} style={{display: 'block', marginTop: 6}} />}
			{value !== '' && url === '' && !list.includes(value) && <div className="signaly-field-hint">{l('notices.fileMissing', {file: value})}</div>}
		</div>
	);
};
