// «Twine СИГНАЛЫ»: глитч-текст (шаг 2.1, ответ автора 7А). В пассаже —
// <span class="glitchy" data-text="подменный">текст</span>, как в шаблоне
// автора. Цвета «теней», сдвиг и скорость — общие настройки в окне «Оформление
// терминала» (блок оформления); движок ставит те же правила с нулевой силой
// (:where), чтобы глитч работал и без блока оформления и не спорил со стилями
// автора. Ключевые кадры — копия кадров шаблона (noise-animY, noise-animY-2).

export interface GlitchSettings {
	/** Цвет текста и полос. */
	glitchColor: string;
	/** Фон полос. */
	glitchBg: string;
	/** Цвет первой и второй «тени». */
	glitchShadow1: string;
	glitchShadow2: string;
	/** Сдвиг полос, px. */
	glitchShift: number;
	/** Один цикл второй полосы, с (первая — в 1,5 раза медленнее). */
	glitchSpeed: number;
}

/** Как в шаблоне автора. */
export const defaultGlitch: GlitchSettings = {
	glitchColor: '#00cc00',
	glitchBg: '#111111',
	glitchShadow1: '#0000ff',
	glitchShadow2: '#ff0000',
	glitchShift: 5,
	glitchSpeed: 2
};

export const glitchKeyframes = [
	'@keyframes sg-glitch-1 {' +
		' 0% { clip-path: polygon(0 80px, 100% 80px, 100% 16px, 0 16px); }' +
		' 5% { clip-path: polygon(0 94px, 100% 94px, 100% 17px, 0 17px); }' +
		' 10% { clip-path: polygon(0 9px, 100% 9px, 100% 92px, 0 92px); }' +
		' 15.0% { clip-path: polygon(0 37px, 100% 37px, 100% 4px, 0 4px); }' +
		' 20% { clip-path: polygon(0 53px, 100% 53px, 100% 47px, 0 47px); }' +
		' 25% { clip-path: polygon(0 99px, 100% 99px, 100% 69px, 0 69px); }' +
		' 30.0% { clip-path: polygon(0 15px, 100% 15px, 100% 49px, 0 49px); }' +
		' 35% { clip-path: polygon(0 83px, 100% 83px, 100% 81px, 0 81px); }' +
		' 40% { clip-path: polygon(0 55px, 100% 55px, 100% 43px, 0 43px); }' +
		' 45% { clip-path: polygon(0 28px, 100% 28px, 100% 27px, 0 27px); }' +
		' 50% { clip-path: polygon(0 64px, 100% 64px, 100% 28px, 0 28px); }' +
		' 55.0% { clip-path: polygon(0 76px, 100% 76px, 100% 91px, 0 91px); }' +
		' 60.0% { clip-path: polygon(0 29px, 100% 29px, 100% 72px, 0 72px); }' +
		' 65% { clip-path: polygon(0 70px, 100% 70px, 100% 10px, 0 10px); }' +
		' 70% { clip-path: polygon(0 5px, 100% 5px, 100% 84px, 0 84px); }' +
		' 75% { clip-path: polygon(0 46px, 100% 46px, 100% 81px, 0 81px); }' +
		' 80% { clip-path: polygon(0 7px, 100% 7px, 100% 85px, 0 85px); }' +
		' 85.0% { clip-path: polygon(0 17px, 100% 17px, 100% 89px, 0 89px); }' +
		' 90% { clip-path: polygon(0 41px, 100% 41px, 100% 59px, 0 59px); }' +
		' 95% { clip-path: polygon(0 53px, 100% 53px, 100% 90px, 0 90px); }' +
		' 100% { clip-path: polygon(0 10px, 100% 10px, 100% 30px, 0 30px); }' +
		' }',
	'@keyframes sg-glitch-2 {' +
		' 0% { clip-path: polygon(0 84px, 100% 84px, 100% 3px, 0 3px); }' +
		' 5% { clip-path: polygon(0 31px, 100% 31px, 100% 69px, 0 69px); }' +
		' 10% { clip-path: polygon(0 37px, 100% 37px, 100% 33px, 0 33px); }' +
		' 15.0% { clip-path: polygon(0 18px, 100% 18px, 100% 6px, 0 6px); }' +
		' 20% { clip-path: polygon(0 25px, 100% 25px, 100% 87px, 0 87px); }' +
		' 25% { clip-path: polygon(0 100px, 100% 100px, 100% 8px, 0 8px); }' +
		' 30.0% { clip-path: polygon(0 24px, 100% 24px, 100% 87px, 0 87px); }' +
		' 35% { clip-path: polygon(0 39px, 100% 39px, 100% 16px, 0 16px); }' +
		' 40% { clip-path: polygon(0 96px, 100% 96px, 100% 25px, 0 25px); }' +
		' 45% { clip-path: polygon(0 16px, 100% 16px, 100% 100px, 0 100px); }' +
		' 50% { clip-path: polygon(0 92px, 100% 92px, 100% 76px, 0 76px); }' +
		' 55.0% { clip-path: polygon(0 29px, 100% 29px, 100% 40px, 0 40px); }' +
		' 60.0% { clip-path: polygon(0 40px, 100% 40px, 100% 39px, 0 39px); }' +
		' 65% { clip-path: polygon(0 94px, 100% 94px, 100% 44px, 0 44px); }' +
		' 70% { clip-path: polygon(0 2px, 100% 2px, 100% 78px, 0 78px); }' +
		' 75% { clip-path: polygon(0 86px, 100% 86px, 100% 50px, 0 50px); }' +
		' 80% { clip-path: polygon(0 2px, 100% 2px, 100% 46px, 0 46px); }' +
		' 85.0% { clip-path: polygon(0 41px, 100% 41px, 100% 71px, 0 71px); }' +
		' 90% { clip-path: polygon(0 75px, 100% 75px, 100% 15px, 0 15px); }' +
		' 95% { clip-path: polygon(0 41px, 100% 41px, 100% 8px, 0 8px); }' +
		' 100% { clip-path: polygon(0 23px, 100% 23px, 100% 75px, 0 75px); }' +
		' }',
].join('\n');

function round(value: number) {
	return String(Math.round(value * 100) / 100);
}

/** Правила глитча; scope — селектор (например, «html .glitchy» или «:where(.glitchy)»). */
export function glitchRules(g: GlitchSettings, scope: string) {
	const layer = (side: 'before' | 'after') => {
		const first = side === 'before';
		const left = first ? g.glitchShift * 1.8 : g.glitchShift;

		return (
			`${scope}::${side} { content: attr(data-text); width: calc(100% + 0.5em); ` +
			`position: absolute; left: ${round(-left)}px; ` +
			`text-shadow: ${first ? '1px' : '-1px'} 0 ${first ? g.glitchShadow1 : g.glitchShadow2}; ` +
			`top: ${round(-g.glitchShift)}px; color: ${g.glitchColor}; background: ${g.glitchBg}; ` +
			`overflow: hidden; clip-path: polygon(0 0); ` +
			`animation: ${first ? 'sg-glitch-2' : 'sg-glitch-1'} ${round(first ? g.glitchSpeed * 1.5 : g.glitchSpeed)}s infinite linear alternate-reverse; }`
		);
	};

	return [
		`${scope} { color: ${g.glitchColor}; position: relative; }`,
		layer('before'),
		layer('after')
	];
}

const named: Record<string, string> = {
	blue: '#0000ff',
	red: '#ff0000',
	green: '#008000',
	lime: '#00ff00',
	yellow: '#ffff00',
	cyan: '#00ffff',
	aqua: '#00ffff',
	magenta: '#ff00ff',
	fuchsia: '#ff00ff',
	white: '#ffffff',
	black: '#000000'
};

/** Цвет #rrggbb из CSS (#abc, #aabbcc или простое имя). */
export function cssColor(value: string | undefined) {
	if (!value) {
		return undefined;
	}

	const v = value.trim().toLowerCase();

	if (named[v]) {
		return named[v];
	}

	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);

	if (short) {
		return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
	}
	return /^#[0-9a-f]{6}$/.test(v) ? v : undefined;
}
