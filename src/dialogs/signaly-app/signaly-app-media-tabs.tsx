// «Twine СИГНАЛЫ»: вкладки «QR» и «SSTV» окна «Приложение» (сессия 34, ответ Т3-8 А) — как
// вкладки «QR-коды» и «SSTV (звук для терминала)» редактора приложения: после них старый
// редактор нужен только для мелочей.
// QR — картинки JPG в папку игры QR/ (в веб-версии — архив .zip). SSTV — картинка → звук WAV
// (метка-код перед картинкой — по желанию) в media/audio/sstv/ (его видит окно «Музыка», для
// радио с декодером) или в media/app/ (звук в блок приложения); «Код звуком» — короткий писк с кодом.

import * as React from 'react';
import {zipSync} from 'fflate';
import {TwineElectronWindow} from '../../electron/shared';
import {Story} from '../../store/stories';
import {AppGame, appMediaDir} from '../../util/signaly/signaly-app';
import {
	defaultQrLook,
	qrCaption,
	qrColors,
	qrFileName,
	QrGroup,
	qrList,
	QrLook,
	qrMatrix,
	qrSchemes
} from '../../util/signaly/signaly-app-qr';
import {decodeModem, encodeModem} from '../../util/signaly/signaly-modem';
import {encodeWav} from '../../util/signaly/signaly-reverse';
import {decodeSstv, encodeSstv, sstvMode, sstvModes} from '../../util/signaly/signaly-sstv';
import {CodeTable} from '../../util/signaly/signaly-codes';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {useAppFiles} from '../passage-edit/signaly-app-block-form';
import {usePhoneL} from './signaly-app-fields';

function bridge() {
	return (window as TwineElectronWindow).twineElectron;
}

async function download(data: Uint8Array, name: string, type: string) {
	const {saveAs} = await import('file-saver');

	saveAs(new Blob([data], {type}), name);
}

/* ----- QR ----- */

/** Нарисовать QR на холсте (как qrCanvas редактора приложения). */
export function drawQr(canvas: HTMLCanvasElement, text: string, look: QrLook, caption: string) {
	const m = qrMatrix(text);
	const n = m.length;
	const quiet = 4;
	const cell = Math.max(2, Math.floor(look.size / (n + quiet * 2)));
	const side = Math.max(look.size, cell * (n + quiet * 2));
	const off = Math.floor((side - cell * n) / 2);
	const capH = caption ? Math.round(side * 0.14) : 0;
	const x = canvas.getContext('2d');
	const col = qrColors(look);

	canvas.width = side;
	canvas.height = side + capH;
	if (!x) {
		return canvas;
	}
	x.fillStyle = col.bg;
	x.fillRect(0, 0, canvas.width, canvas.height);
	x.fillStyle = col.fg;
	m.forEach((row, r) =>
		row.forEach((dark, k) => {
			if (dark) {
				x.fillRect(off + k * cell, off + r * cell, cell, cell);
			}
		})
	);
	if (caption) {
		let fs = Math.round(capH * 0.55);
		const font = () => `bold ${fs}px Consolas, "Courier New", monospace`;

		x.font = font();
		x.textAlign = 'center';
		x.textBaseline = 'middle';
		while (x.measureText(caption).width > side * 0.92 && fs > 8) {
			fs--;
			x.font = font();
		}
		x.fillText(caption, side / 2, side + capH * 0.35);
	}
	return canvas;
}

async function qrJpg(text: string, look: QrLook, caption: string) {
	const c = drawQr(document.createElement('canvas'), text, look, caption);
	const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/jpeg', 0.95));

	return new Uint8Array(await (blob ?? new Blob()).arrayBuffer());
}

const groups: QrGroup[] = ['codes', 'devices', 'logins', 'chapters', 'master'];

export const QrTab: React.FC<{game: AppGame; table: CodeTable; folder?: string}> = ({folder, game, table}) => {
	const l = usePhoneL();
	const [look, setLook] = React.useState<QrLook>(defaultQrLook);
	const [text, setText] = React.useState('');
	const rows = React.useMemo(() => qrList(game, table), [game, table]);
	const [picked, setPicked] = React.useState<Record<string, boolean>>({});
	const [note, setNote] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const canvas = React.useRef<HTMLCanvasElement>(null);
	const isPicked = (key: string, group: QrGroup) => picked[key] ?? group !== 'master';
	const set = (patch: Partial<QrLook>) => setLook(x => ({...x, ...patch}));
	const code = text.trim();

	React.useEffect(() => {
		if (canvas.current && code) {
			drawQr(canvas.current, code, look, qrCaption(look, code, ''));
		}
	}, [code, look]);

	async function save(list: Array<{code: string; label: string}>) {
		setBusy(true);
		setNote('');
		try {
			const files: Record<string, Uint8Array> = {};

			for (const r of list) {
				let name = qrFileName(r.code, r.label);
				let i = 2;

				while (files[name]) {
					name = name.replace(/( \(\d+\))?\.jpg$/, ` (${i++}).jpg`);
				}
				files[name] = await qrJpg(r.code, look, qrCaption(look, r.code, r.label));
			}

			const b = bridge();
			const names = Object.keys(files);

			if (folder && b?.signalyWriteOutput) {
				let path = '';

				for (const name of names) {
					path = await b.signalyWriteOutput(folder, `QR/${name}`, files[name]);
				}
				setNote(l('qr.saved', {n: names.length, path: path.replace(/[\\/][^\\/]+$/, '')}));
			} else if (names.length === 1) {
				await download(files[names[0]], names[0], 'image/jpeg');
				setNote(l('qr.downloaded', {name: names[0]}));
			} else {
				const name = `QR-${String(game.title || 'signaly').replace(/[\\/:*?"<>|]+/g, '_')}.zip`;

				await download(zipSync(files, {level: 0}), name, 'application/zip');
				setNote(l('qr.downloaded', {name}));
			}
		} catch (e) {
			setNote(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	}

	const chosen = rows.filter(r => isPicked(r.key, r.group));

	return (
		<>
			<h3>{l('qr.title')}</h3>
			<div className="signaly-field-hint">{l('qr.hint')}</div>
			<div className="signaly-phone-split">
				<div className="signaly-phone-form">
					<TextField label={l('qr.code')} onChange={setText} value={text} />
					<ChoiceField
						label={l('qr.colors')}
						onChange={scheme => set({scheme})}
						options={qrSchemes.map(s => ({label: l(`qr.scheme.${s.id}`), value: s.id}))}
						value={look.scheme}
					/>
					{look.scheme === 'custom' && (
						<div className="signaly-block-buttons">
							<label>
								{l('qr.bg')} <input onChange={e => set({bg: e.target.value})} type="color" value={look.bg} />
							</label>{' '}
							<label>
								{l('qr.fg')} <input onChange={e => set({fg: e.target.value})} type="color" value={look.fg} />
							</label>
						</div>
					)}
					<ChoiceField
						label={l('qr.size')}
						onChange={v => set({size: Number(v)})}
						options={[256, 512, 1024].map(n => ({label: l('qr.points', {n}), value: String(n)}))}
						value={String(look.size)}
					/>
					<ChoiceField
						label={l('qr.caption')}
						onChange={v => set({caption: v as QrLook['caption']})}
						options={(['none', 'code', 'label', 'own'] as const).map(c => ({label: l(`qr.captions.${c}`), value: c}))}
						value={look.caption}
					/>
					{look.caption === 'own' && <TextField label={l('qr.own')} onChange={own => set({own})} value={look.own} />}
					<button className="signaly-button primary" disabled={!code || busy} onClick={() => save([{code, label: ''}])} type="button">
						{l('qr.saveOne')}
					</button>
					<div className="signaly-field-hint">{l('qr.colorsHint')}</div>
				</div>
				<div>{code ? <canvas className="signaly-app-qr" ref={canvas} /> : <div className="signaly-field-hint">{l('qr.empty')}</div>}</div>
			</div>
			<h3>{l('qr.list')}</h3>
			{rows.length === 0 ? (
				<p>{l('qr.none')}</p>
			) : (
				<>
					<button className="signaly-button" disabled={!chosen.length || busy} onClick={() => save(chosen)} type="button">
						{l('qr.saveAll', {n: chosen.length})}
					</button>
					{groups
						.filter(g => rows.some(r => r.group === g))
						.map(g => {
							const of = rows.filter(r => r.group === g);

							return (
								<fieldset className="signaly-app-qr-group" key={g}>
									<legend>
										<CheckField
											label={l(`qr.groups.${g}`)}
											onChange={on => setPicked(p => ({...p, ...Object.fromEntries(of.map(r => [r.key, on]))}))}
											value={of.every(r => isPicked(r.key, r.group))}
										/>
									</legend>
									<table className="signaly-phone-table">
										<tbody>
											{of.map(r => (
												<tr key={r.key}>
													<td>
														<CheckField label={r.code} onChange={on => setPicked(p => ({...p, [r.key]: on}))} value={isPicked(r.key, r.group)} />
													</td>
													<td>{r.label}</td>
													<td>
														<button className="signaly-button" onClick={() => setText(r.code)} type="button">
															{l('qr.show')}
														</button>{' '}
														<button className="signaly-button" disabled={busy} onClick={() => save([r])} type="button">
															JPG
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</fieldset>
							);
						})}
				</>
			)}
			{note && <div className="signaly-notice">{note}</div>}
		</>
	);
};

/* ----- SSTV ----- */

type Fit = 'cover' | 'contain' | 'stretch';

async function loadBitmap(data: Uint8Array) {
	const url = URL.createObjectURL(new Blob([data]));

	try {
		return await new Promise<HTMLImageElement>((ok, fail) => {
			const im = new Image();

			im.onload = () => ok(im);
			im.onerror = () => fail(new Error('картинка не читается'));
			im.src = url;
		});
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 5000);
	}
}

interface SstvResult {
	wav: Uint8Array;
	name: string;
	seconds: number;
	got?: {mode: string; rows: number; width: number; height: number; rgba: Uint8ClampedArray};
	label: string;
	heard: string[];
}

interface CodeResult {
	wav: Uint8Array;
	name: string;
	seconds: number;
	code: string;
	heard: string[];
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim();

export const SstvTab: React.FC<{story: Story; folder?: string}> = ({folder, story}) => {
	const l = usePhoneL();
	const {files} = useAppFiles(story);
	const [imgFiles, setImgFiles] = React.useState<string[]>([]);
	const [file, setFile] = React.useState('');
	const [own, setOwn] = React.useState<{name: string; data: Uint8Array}>();
	const [mode, setMode] = React.useState('Robot 36');
	const [fit, setFit] = React.useState<Fit>('cover');
	const [rate, setRate] = React.useState(22050);
	const [label, setLabel] = React.useState('');
	const [result, setResult] = React.useState<SstvResult>();
	const [code, setCode] = React.useState('');
	const [codeRes, setCodeRes] = React.useState<CodeResult>();
	const [note, setNote] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const src = React.useRef<HTMLCanvasElement>(null);
	const check = React.useRef<HTMLCanvasElement>(null);
	const input = React.useRef<HTMLInputElement>(null);
	const m = sstvMode(mode) ?? sstvModes[0];

	React.useEffect(() => {
		const b = bridge();

		if (folder && b?.signalyListMedia) {
			b.signalyListMedia(folder, 'img').then(list => setImgFiles(list.filter(p => !p.startsWith('media/img/sstv/'))));
		}
	}, [folder]);

	const images = [
		...files.filter(f => /\.(png|jpe?g|gif|webp|bmp)$/i.test(f)).map(f => appMediaDir + f),
		...imgFiles.filter(f => /\.(png|jpe?g|gif|webp|bmp)$/i.test(f))
	];

	async function source(): Promise<Uint8Array | undefined> {
		if (own && file === '') {
			return own.data;
		}

		const b = bridge();

		return file && folder && b ? b.signalyReadMedia(folder, file) : undefined;
	}

	async function drawSource() {
		const c = src.current;

		if (!c) {
			return false;
		}
		c.width = m.width;
		c.height = m.height;

		const x = c.getContext('2d')!;

		x.fillStyle = '#000';
		x.fillRect(0, 0, m.width, m.height);

		const data = await source();

		if (!data) {
			return false;
		}

		const im = await loadBitmap(data);
		const sw = im.naturalWidth;
		const sh = im.naturalHeight;

		if (fit === 'stretch') {
			x.drawImage(im, 0, 0, m.width, m.height);
		} else {
			const k = fit === 'cover' ? Math.max(m.width / sw, m.height / sh) : Math.min(m.width / sw, m.height / sh);

			x.drawImage(im, (m.width - sw * k) / 2, (m.height - sh * k) / 2, sw * k, sh * k);
		}
		return true;
	}

	React.useEffect(() => {
		setResult(undefined);
		drawSource().catch(e => setNote(String((e as Error).message ?? e)));
	}, [file, own, mode, fit]); // eslint-disable-line

	React.useEffect(() => {
		const c = check.current;
		const g = result?.got;

		if (c && g) {
			c.width = g.width;
			c.height = g.height;
			c.getContext('2d')!.putImageData(new ImageData(g.rgba.slice(0, g.width * g.height * 4), g.width, g.height), 0, 0);
		}
	}, [result]);

	async function make() {
		setBusy(true);
		setNote('');
		try {
			if (!(await drawSource())) {
				setNote(l('sstv.noImage'));
				return;
			}

			const rgba = src.current!.getContext('2d')!.getImageData(0, 0, m.width, m.height).data;
			let snd = encodeSstv(m, rgba, m.width, m.height, rate, 0.5);
			const mark = label.trim();

			if (mark) {
				// метка перед картинкой: код звуком, пауза, затем SSTV (Д2)
				const mk = encodeModem(mark, rate, 0.6);
				const gap = Math.round(rate * 0.4);
				const both = new Float32Array(mk.length + gap + snd.length);

				both.set(mk);
				both.set(snd, mk.length + gap);
				snd = both;
			}

			// самопроверка: декодер терминала на чистом звуке
			const got = decodeSstv(snd, rate)[0];
			const base = (own && file === '' ? own.name : file.split('/').pop() ?? 'signal').replace(/\.[^.]+$/, '') || 'signal';

			setResult({
				wav: encodeWav([snd], rate),
				name: `${safe(`${base} ${m.name.replace(/\s+/g, '')}${mark ? ` метка ${mark}` : ''}`)}.wav`,
				seconds: snd.length / rate,
				got: got ? {mode: got.mode, rows: got.height, width: got.width, height: got.height, rgba: got.rgba} : undefined,
				label: mark,
				heard: mark ? decodeModem(snd.subarray(0, Math.min(snd.length, Math.round(rate * 8))), rate) : []
			});
		} catch (e) {
			setNote(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	}

	function makeCode() {
		const c = code.trim();

		if (!c) {
			return;
		}

		const r = 44100;
		const snd = encodeModem(c, r, 0.7);
		const lead = Math.round(r * 0.3);
		const all = new Float32Array(lead * 2 + snd.length);

		all.set(snd, lead);
		setCodeRes({wav: encodeWav([all], r), name: `${safe(`Код ${c}`)}.wav`, seconds: all.length / r, code: c, heard: decodeModem(all, r)});
	}

	async function put(wav: Uint8Array, name: string, where: 'terminal' | 'app') {
		setNote('');
		try {
			const b = bridge();

			if (folder && b) {
				const path =
					where === 'terminal'
						? await b.signalyWriteOutput(folder, `media/audio/sstv/${name}`, wav)
						: await b.signalyWriteAppFile(folder, `${appMediaDir}${name}`, wav);

				setNote(l(where === 'terminal' ? 'sstv.savedTerminal' : 'sstv.savedApp', {path}));
			} else {
				await download(wav, name, 'audio/wav');
				setNote(l('qr.downloaded', {name}));
			}
		} catch (e) {
			setNote(String((e as Error).message ?? e));
		}
	}

	const audioUrl = React.useMemo(() => (result ? URL.createObjectURL(new Blob([result.wav], {type: 'audio/wav'})) : ''), [result]);
	const codeUrl = React.useMemo(() => (codeRes ? URL.createObjectURL(new Blob([codeRes.wav], {type: 'audio/wav'})) : ''), [codeRes]);
	const saveButtons = (wav: Uint8Array, name: string) => (
		<div className="signaly-block-buttons">
			<button className="signaly-button primary" onClick={() => put(wav, name, 'terminal')} type="button">
				{folder ? l('sstv.toTerminal') : l('sstv.download')}
			</button>
			{folder && (
				<button className="signaly-button" onClick={() => put(wav, name, 'app')} type="button">
					{l('sstv.toApp')}
				</button>
			)}
		</div>
	);

	return (
		<>
			<h3>{l('sstv.title')}</h3>
			<div className="signaly-field-hint">{l('sstv.hint')}</div>
			<div className="signaly-phone-split">
				<div className="signaly-phone-form">
					<ChoiceField
						label={l('sstv.file')}
						onChange={v => setFile(v)}
						options={[
							{label: own ? l('sstv.own', {name: own.name}) : l('block.noFile'), value: ''},
							...images.map(f => ({label: f, value: f}))
						]}
						value={file}
					/>
					<button className="signaly-button" onClick={() => input.current?.click()} type="button">
						{l('sstv.pick')}
					</button>
					<input
						accept="image/*"
						hidden
						onChange={async e => {
							const f = e.target.files?.[0];

							e.target.value = '';
							if (f) {
								setOwn({name: f.name, data: new Uint8Array(await f.arrayBuffer())});
								setFile('');
							}
						}}
						ref={input}
						type="file"
					/>
					<ChoiceField
						label={l('sstv.mode')}
						onChange={setMode}
						options={sstvModes.map(x => ({label: `${x.name} — ${x.width}×${x.height}`, value: x.name}))}
						value={m.name}
					/>
					<ChoiceField
						label={l('sstv.fit')}
						onChange={v => setFit(v as Fit)}
						options={(['cover', 'contain', 'stretch'] as const).map(f => ({label: l(`sstv.fits.${f}`), value: f}))}
						value={fit}
					/>
					<ChoiceField
						label={l('sstv.rate')}
						onChange={v => setRate(Number(v))}
						options={[22050, 44100, 48000].map(r => ({label: l('sstv.hz', {n: r.toLocaleString('ru')}), value: String(r)}))}
						value={String(rate)}
					/>
					<TextField hint={l('sstv.labelHint')} label={l('sstv.label')} onChange={setLabel} value={label} />
					<button className="signaly-button primary" disabled={busy} onClick={make} type="button">
						{busy ? l('sstv.working') : l('sstv.make')}
					</button>
				</div>
				<div>
					<div className="signaly-field-hint">{l('sstv.frame', {mode: m.name, w: m.width, h: m.height})}</div>
					<canvas className="signaly-app-sstv" ref={src} />
				</div>
			</div>
			{result && (
				<section className="signaly-check-group">
					<p>
						{l('sstv.result', {name: result.name, s: result.seconds.toFixed(0), kb: Math.round(result.wav.length / 1024)})}{' '}
						{result.got ? l('sstv.checkOk', {mode: result.got.mode, rows: result.got.rows}) : l('sstv.checkFail')}{' '}
						{result.label && (result.heard.includes(result.label) ? l('sstv.labelOk', {label: result.label}) : l('sstv.labelFail'))}
					</p>
					<audio controls src={audioUrl} />
					<div className="signaly-field-hint">{l('sstv.decoded')}</div>
					<canvas className="signaly-app-sstv" ref={check} />
					{saveButtons(result.wav, result.name)}
				</section>
			)}
			<h3>{l('sstv.codeTitle')}</h3>
			<div className="signaly-field-hint">{l('sstv.codeHint')}</div>
			<TextField label={l('sstv.code')} onChange={setCode} value={code} />
			<button className="signaly-button" disabled={!code.trim()} onClick={makeCode} type="button">
				{l('sstv.makeCode')}
			</button>
			{codeRes && (
				<section className="signaly-check-group">
					<p>
						{l('sstv.codeResult', {name: codeRes.name, s: codeRes.seconds.toFixed(1)})}{' '}
						{codeRes.heard.includes(codeRes.code) ? l('sstv.codeOk') : l('sstv.checkFail')}
					</p>
					<audio controls src={codeUrl} />
					{saveButtons(codeRes.wav, codeRes.name)}
				</section>
			)}
			{note && <div className="signaly-notice">{note}</div>}
		</>
	);
};
