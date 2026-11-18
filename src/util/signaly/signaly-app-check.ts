// «Twine СИГНАЛЫ»: общая «Проверка истории» с данными приложения (сессия 34, ответ Т3-8 А) —
// то же, что вкладка «Проверка» редактора приложения (`SG.problems` в signaly-app, MIT):
// пустые и повторяющиеся коды, коды входа, коды на удалённые блоки и приборы, закрытые блоки
// и приборы, которые ничего не открывает, главы без кода, файлы профиля и блоков.

import {AppGame, StoryPassage, storyToGame} from './signaly-app';
import {blockEntries, voiceNorm} from './signaly-app-model';

export interface AppProblem {
	level: 'error' | 'warn';
	text: string;
	/** Где поправить: пассаж «Коды», «Приложение» или блок (имя пассажа). */
	where: 'codes' | 'settings' | string;
}

const arr = (x: unknown): AppGame[] => (Array.isArray(x) ? x : []);
const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toUpperCase();

/**
 * Ошибки и предупреждения данных приложения. files — файлы пакета (имена как в game.json,
 * «plan.png»); undefined — папка игры не выбрана, файлы не проверяются.
 */
export function appProblems(game: AppGame, files?: Set<string>, blockPassage: (id: string) => string = () => 'settings'): AppProblem[] {
	const out: AppProblem[] = [];
	const seen = new Map<string, string>();
	const err = (text: string, where = 'codes') => out.push({level: 'error', text, where});
	const warn = (text: string, where = 'codes') => out.push({level: 'warn', text, where});
	const claim = (code: unknown, what: string, where: string, app?: string) => {
		const c = (app ? app + '|' : '') + norm(code);

		if (!norm(code)) {
			return;
		}
		if (seen.has(c)) {
			err(`Код «${code}» повторяется: ${seen.get(c)} и ${what}`, where);
		} else {
			seen.set(c, what);
		}
	};
	const chapters = arr(game.chapters);
	const accounts = arr(game.accounts);
	const codes = arr(game.codes);
	const blocks = arr(game.blocks);
	const apps = arr(game.apps);
	const rules = arr(game.rules);

	if (!norm(game.masterCode)) {
		err('Не задан мастерский код', 'settings');
	} else if (norm(game.masterCode).length < 6) {
		warn('Мастерский код короче 6 знаков: игроки могут подобрать его случайно', 'settings');
	}
	claim(game.masterCode, 'мастерский код', 'settings');
	claim(game.settingsCode ?? '0000', 'код настроек игрока', 'settings');
	chapters.forEach((c, i) => {
		const name = String(c.name ?? `Глава ${i + 1}`);

		if (i > 0 && !norm(c.code)) {
			warn(`У главы «${name}» нет кода перехода`, 'settings');
		}
		claim(c.code, `переход в «${name}»`, 'settings');
	});
	if (!accounts.length) {
		warn('Нет ни одного персонажа приложения (окно «Коды» → «Сотрудники» → «Персонаж приложения на телефоне»)');
	}
	accounts.forEach(a => {
		if (!norm(a.login)) {
			err(`У персонажа «${a.name || '?'}» нет кода входа`);
		}
		claim(a.login, `вход «${a.name || '?'}»`, 'codes');
	});

	const voiceSeen = new Set<string>();

	codes.forEach(c => {
		const label = String(c.note || c.comment || c.code || (c.voice ? `«${c.voice}»` : '?'));
		const vn = voiceNorm(String(c.voice ?? ''));
		const app = c.app ? apps.find(x => x.id === c.app) : undefined;

		if (vn && voiceSeen.has(vn)) {
			warn(`Фраза голосом «${c.voice}» повторяется: срабатывает первый код из подходящих персонажу`);
		}
		if (vn) {
			voiceSeen.add(vn);
		}
		if (c.app && !app) {
			err(`Код «${label}»: прибор удалён`);
		}
		if (!norm(c.code) && !vn) {
			err(`Пустой код телефона${c.comment ? ` («${c.comment}»)` : ''}`);
		}
		if (c.voice && c.app) {
			warn(`Код «${label}»: фраза голосом у прибора не срабатывает`);
		}
		claim(c.code, `код «${label}»${app ? ` (прибор «${app.name}»)` : ''}`, 'codes', c.app ? String(c.app) : undefined);
		if (!arr(c.opens).length && !c.answer && !arr(c.actions).length && !arr(c.variants).length && !c.term) {
			warn(`Код «${label}» ничего не открывает, без ответа и действий`);
		}
		[...arr(c.opens), ...arr(c.deniedOpens)].forEach(id => {
			if (!blocks.some(b => b.id === id)) {
				err(`Код «${label}» открывает удалённый блок`);
			}
		});
		if (Number(c.chapter) > chapters.length) {
			err(`Код «${label}»: глава ${c.chapter} не существует`);
		}
	});

	const opensBlock = (id: string) =>
		codes.some(
			c =>
				arr(c.opens).includes(id as never) ||
				arr(c.deniedOpens).includes(id as never) ||
				arr(c.variants).some(v => arr(v.opens).includes(id as never)) ||
				arr(c.actions).some(a => a.type === 'open' && arr(a.blocks).includes(id as never))
		) || rules.some(r => arr(r.actions).some(a => a.type === 'open' && arr(a.blocks).includes(id as never)));

	blocks.forEach(b => {
		const name = String(b.title || '(без названия)');
		const where = blockPassage(String(b.id));

		if (!b.title) {
			warn('Блок без названия', where);
		}
		if (Number(b.chapter) > chapters.length) {
			err(`Блок «${name}»: глава ${b.chapter} не существует`, where);
		}
		if (!b.start && !b.share && !opensBlock(String(b.id))) {
			warn(`Блок «${name}» закрыт, но ни один код его не открывает`, where);
		}
	});
	apps.forEach(a => {
		if (!a.start && !codes.some(c => arr(c.actions).some(x => x.type === 'app' && x.app === a.id))) {
			warn(`Прибор «${a.name}» закрыт, но ни один код его не открывает`, 'settings');
		}
	});

	const items = (list: unknown, owner: string, where: string) =>
		arr(list).forEach(it => {
			if ((it.type === 'image' || it.type === 'audio') && it.file && files && !files.has(String(it.file))) {
				err(`${owner}: нет файла media/app/${it.file}`, where);
			}
			if ((it.type === 'image' || it.type === 'audio') && !it.file) {
				warn(`${owner}: не выбран файл`, where);
			}
		});

	accounts.forEach(a => items(a.items, `Профиль «${a.name || '?'}»`, 'codes'));
	blocks.forEach(b => items(b.items, `Блок «${b.title || '?'}»`, blockPassage(String(b.id))));
	return out;
}

/** Проблемы данных приложения в истории: имя пассажа, где поправить, и текст. */
export function storyAppProblems(passages: StoryPassage[], appFiles?: string[]) {
	const built = storyToGame(passages);
	const names = new Map(blockEntries(passages).map(b => [b.id, b.passage.name]));
	const settings = passages.find(p => p.tags.includes('app-settings'))?.name ?? 'Приложение';
	const codes = passages.find(p => p.tags.includes('sg-codes'))?.name ?? 'Коды';
	const files = appFiles ? new Set(appFiles.filter(f => f.startsWith('media/app/')).map(f => f.slice('media/app/'.length))) : undefined;
	const list = appProblems(built.game, files, id => names.get(id) ?? settings).map(p => ({
		level: p.level,
		text: p.text,
		passage: p.where === 'codes' ? codes : p.where === 'settings' ? settings : p.where
	}));

	return [...built.problems.map(text => ({level: 'error' as const, text, passage: settings})), ...list];
}
