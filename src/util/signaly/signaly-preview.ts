// «Twine СИГНАЛЫ»: предпросмотр терминала в окне «Оформление терминала».
// Игра публикуется как обычно и открывается во фрейме; перед ней ставится
// маленький скрипт: режим предпросмотра для движка, звук выключен, камера и
// захват окна не включаются.

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

function previewScript(mode: PreviewMode) {
	return [
		`window.SIGNALY_PREVIEW = ${JSON.stringify(mode)};`,
		'(function () {',
		'\tvar play = HTMLMediaElement.prototype.play;',
		'\tHTMLMediaElement.prototype.play = function () {',
		'\t\tthis.muted = true;',
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
	{baseUrl, mode}: {baseUrl?: string; mode: PreviewMode}
) {
	const head =
		(baseUrl ? `<base href="${attr(baseUrl)}">` : '') +
		`<script>${previewScript(mode)}</script>`;

	return html.replace(/<head[^>]*>/i, match => match + head);
}
