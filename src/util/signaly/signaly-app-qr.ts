// «Twine СИГНАЛЫ»: вкладка «QR» окна «Приложение» (сессия 34, ответ Т3-8 А) — как вкладка
// «QR-коды» редактора приложения: в QR записан сам код (тот же, что вводится руками).
// QR строит qrcode-generator (MIT). Чистые функции — без DOM (рисует окно).

import qrcode from 'qrcode-generator';
import {AppGame} from './signaly-app';
import {parseObject} from './signaly-app-model';
import {CodeTable} from './signaly-codes';

export type QrGroup = 'codes' | 'devices' | 'logins' | 'chapters' | 'master';

export interface QrCodeRow {
	key: string;
	code: string;
	label: string;
	group: QrGroup;
}

const list = (game: AppGame, key: string): AppGame[] => (Array.isArray(game[key]) ? game[key] : []);

/** Все коды игры для QR: коды «Кодов» (терминал и телефоны), коды приборов, входы, главы, мастер. */
export function qrList(game: AppGame, table: CodeTable): QrCodeRow[] {
	const out: QrCodeRow[] = [];
	const seen = new Set<string>();
	const add = (group: QrGroup, code: unknown, label: string) => {
		const c = String(code ?? '').trim();
		const key = `${group}:${c}`;

		if (!c || seen.has(key)) {
			return;
		}
		seen.add(key);
		out.push({key, code: c, label, group});
	};
	const apps = list(game, 'apps');

	table.codes.forEach(e => {
		const d = e.where === 'phone' || e.where === 'both' ? parseObject(e.phone) : undefined;

		if (d?.app) {
			const app = apps.find(a => a.id === d.app);

			add('devices', e.code, [app?.name, e.label].filter(Boolean).join(': '));
		} else {
			add('codes', e.code, e.label || (e.where === 'phone' ? String(d?.answer ?? '').slice(0, 40) : e.title));
		}
	});
	table.people.forEach(p => {
		const d = parseObject(p.phone);

		if (d) {
			add('logins', d.login, `№${p.id} ${String(d.name ?? '')}`.trim());
		}
	});
	list(game, 'chapters').forEach((c, i) => add('chapters', c.code, String(c.name ?? `Глава ${i + 1}`)));
	add('master', game.masterCode, 'мастерский код');
	add('master', game.settingsCode ?? '0000', 'код настроек');
	return out;
}

/** Матрица QR (true — тёмная точка). */
export function qrMatrix(text: string): boolean[][] {
	const q = qrcode(0, 'M');

	q.addData(String(text));
	q.make();

	const n = q.getModuleCount();

	return Array.from({length: n}, (_, r) => Array.from({length: n}, (_, k) => q.isDark(r, k)));
}

export const qrSchemes = [
	{id: 'gb', bg: '#030803', fg: '#33ff66'},
	{id: 'bg', bg: '#33ff66', fg: '#031003'},
	{id: 'bw', bg: '#ffffff', fg: '#000000'},
	{id: 'custom', bg: '', fg: ''}
];

export interface QrLook {
	scheme: string;
	bg: string;
	fg: string;
	size: number;
	/** none — без подписи, code — сам код, label — заметка, own — свой текст. */
	caption: 'none' | 'code' | 'label' | 'own';
	own: string;
}

export const defaultQrLook: QrLook = {scheme: 'gb', bg: '#030803', fg: '#33ff66', size: 512, caption: 'none', own: ''};

export function qrColors(look: QrLook) {
	const s = qrSchemes.find(x => x.id === look.scheme) ?? qrSchemes[0];

	return s.id === 'custom' ? {bg: look.bg, fg: look.fg} : {bg: s.bg, fg: s.fg};
}

export function qrCaption(look: QrLook, code: string, label: string) {
	return look.caption === 'code' ? code : look.caption === 'label' ? label || code : look.caption === 'own' ? look.own : '';
}

export function qrFileName(code: string, label = '') {
	return `${`QR-${code}${label ? `-${label}` : ''}`.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)}.jpg`;
}
