// «Twine СИГНАЛЫ»: предпросмотр терминала в окне «Оформление терминала».
// Игра публикуется как обычно и открывается во фрейме; перед ней ставится
// маленький скрипт: режим предпросмотра для движка, звук выключен (кроме
// звуков наведения и нажатия — шаг 2.2), камера и захват окна не включаются.

export type PreviewMode = 'passage' | 'start';

/** Путь к папке → адрес file:///…/ для <base>, чтобы находились media/…. */
export function folderToFileUrl(folder: string) {
	let path = folder.replace(/\\/g, '/');

	if (!path.endsWith('/')) {
		path += '/';
	}

	const encoded = path
		.split('/')
		.map((segment, index) =>
			index === 0 && /^[A-Za-z]:$/.test(segment)
				? segment
				: encodeURIComponent(segment)
		)
		.join('/');

	return encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`;
}

function attr(value: string) {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function previewScript(mode: PreviewMode, uiSound: boolean) {
	return [
		`window.SIGNALY_PREVIEW = ${JSON.stringify(mode)};`,
		// Шаг 2.2 (ответ 7А): звуки наведения и нажатия звучат, если не стоит
		// галочка «Без звука»; музыка и видео в предпросмотре — без звука.
		`window.SIGNALY_UI_SOUND = ${uiSound ? 'true' : 'false'};`,
		'(function () {',
		'\tvar play = HTMLMediaElement.prototype.play;',
		'\tHTMLMediaElement.prototype.play = function () {',
		'\t\tif (!this.sgUi) {',
		'\t\t\tthis.muted = true;',
		'\t\t}',
		'\t\treturn play.apply(this, arguments);',
		'\t};',
		'\tif (navigator.mediaDevices) {',
		'\t\tvar off = function () { return Promise.reject(new Error("предпросмотр")); };',
		'\t\tnavigator.mediaDevices.getUserMedia = off;',
		'\t\tnavigator.mediaDevices.getDisplayMedia = off;',
		'\t}',
		'})();'
	].join('\n');
}

/** HTML игры для фрейма предпросмотра. */
export function previewHtml(
	html: string,
	{baseUrl, mode, uiSound = false}: {baseUrl?: string; mode: PreviewMode; uiSound?: boolean}
) {
	const head =
		(baseUrl ? `<base href="${attr(baseUrl)}">` : '') +
		`<script>${previewScript(mode, uiSound)}</script>`;

	return html.replace(/<head[^>]*>/i, match => match + head);
}
