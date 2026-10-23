// «Twine СИГНАЛЫ»: перенос таймеров и иллюминатора шаблона в блоки (шаг 2.3,
// ответы автора 5А и 6А). Узнаются только куски исправленного шаблона —
// остальной код автора не трогается.
//
// - Таймер экрана Clocks: код в «JavaScript истории» (setup.timerText +
//   setInterval) убирается, а экраны становятся блоками:
//     Clocktest5 — <<sg-timer "Clocks" minutes 0 seconds 5 goto "Start">>
//     Clocks, Clocktimer — <<sg-timer "Clocks" start running>> (только табло)
//   Табло по умолчанию выглядит как #timer-display автора.
// - Скрытый таймер TERRAFORM_FAIL (<<timed 30s>><<goto …>>) —
//   <<sg-timer "TERRAFORM_FAIL" seconds 30 goto "TERRAFORM" hidden>>.
// - Иллюминатор (WINDOWDESSERT, WINDOWSSHUTTERS, Videotest2): видео и
//   <<script>> с переключением — <<sg-chain>> с шагами.

import {quote, writeBlock} from './signaly-screen-blocks';

const timerScriptRe =
	/\n*\/\* ===== Таймер \(экран Clocks\) =====[^]*?setup\.timerText = function \(\) \{[^]*?setInterval\(function \(\) \{[^]*?Engine\.play\("([^"]+)"\);\s*\}\s*\}, 250\);\n?/;

export const timerMovedNote =
	'/* СИГНАЛЫ: таймер экрана Clocks перенесён в блок «Таймер» (шаг 2.3). */\n';

const startRe =
	/<<silent>>\s*<<set \$timerstarted to 1>>\s*<<set \$minutes to (\d+)>>\s*<<set \$seconds to (\d+)>>\s*(?:\/\*[^]*?\*\/\s*)?<<set \$timerEnd to Date\.now\(\) \+ \(\$minutes \* 60 \+ \$seconds\) \* 1000>>\s*<<\/silent>>\s*\\<<include "Clocktimer">>/;

const showRe = /<<if \$timerstarted is 1>>\n<<include "Clocktimer">>\n<<\/if>>/;

const displayRe =
	/^(?:\/\*[^\n]*\*\/\\\n)?<div id="timer-display">\n\\<span id="countdown"><<print setup\.timerText\(\)>><\/span>\n\\<\/div>\s*$/;

const hiddenRe =
	/\/\* СИГНАЛЫ: скрытый таймер[^\n]*\*\/\\\n<<silent>>\n<<timed (\d+(?:\.\d+)?)s>><<goto "([^"]+)">><<\/timed>>\n<<\/silent>>/;

const initVarsRe = /^<<set \$timer(?:started|End) to 0>>\n/gm;

const clockName = 'Clocks';

function timerBlock(values: Record<string, string | number | boolean | undefined>) {
	return writeBlock({type: 'timer', values, extra: []});
}

/** Есть ли в «JavaScript истории» код таймера шаблона. */
export function hasTemplateTimer(script: string) {
	return timerScriptRe.test(script);
}

export interface PassageText {
	name: string;
	text: string;
}

/**
 * Новые тексты пассажей (только изменившиеся, по номеру) и новый код истории.
 * Таймер Clocks переносится целиком или не переносится вовсе; exclude —
 * пассаж, открытый в редакторе (его текст сейчас правит автор).
 */
export function moveTemplateTimers(script: string, passages: PassageText[], exclude?: string) {
	const texts = new Map<number, string>();
	const match = timerScriptRe.exec(script);
	let newScript = script;
	const moved: string[] = [];

	if (match) {
		const target = match[1];
		const changes = new Map<number, string>();

		passages.forEach((p, index) => {
			let text = p.text;
			const start = startRe.exec(text);

			if (start) {
				text =
					text.slice(0, start.index) +
					timerBlock({
						name: clockName,
						minutes: Number(start[1]),
						seconds: Number(start[2]),
						goto: target
					}) +
					text.slice(start.index + start[0].length);
			}
			// Переносы строк вокруг — как были у <<if>> с <<include>>.
			text = text.replace(showRe, () => '\n' + timerBlock({name: clockName, start: 'running'}) + '\n');
			if (displayRe.test(text)) {
				text = timerBlock({name: clockName, start: 'running'});
			}
			if (p.name === 'StoryInit') {
				text = text.replace(initVarsRe, '');
			}
			if (text !== p.text) {
				changes.set(index, text);
			}
		});

		const blocked = exclude !== undefined && [...changes.keys()].some(i => passages[i].name === exclude);

		if (!blocked && /<<include "Clocktimer">>/.test([...passages.map((p, i) => changes.get(i) ?? p.text)].join('\n')) === false) {
			changes.forEach((text, index) => texts.set(index, text));
			newScript = script.replace(timerScriptRe, '\n\n' + timerMovedNote);
			moved.push('таймер Clocks → блок «Таймер»');
		}
	}

	passages.forEach((p, index) => {
		if (p.name === exclude) {
			return;
		}

		let text = texts.get(index) ?? p.text;
		const hidden = hiddenRe.exec(text);

		if (hidden) {
			text =
				text.slice(0, hidden.index) +
				timerBlock({name: p.name, seconds: Number(hidden[1]), goto: hidden[2], hidden: true}) +
				text.slice(hidden.index + hidden[0].length);
			moved.push(`скрытый таймер ${p.name} → блок «Таймер»`);
		}

		const chain = moveChain(text);

		if (chain !== undefined) {
			text = chain;
			moved.push(`${p.name}: видео → блок «Цепочка видео»`);
		}
		if (text !== p.text) {
			texts.set(index, text);
		}
	});

	return {script: newScript, texts, moved};
}

/* ----- Иллюминатор ----- */

const videoRe =
	/<video id="(\w+)"((?:\s+[a-z]+(?:="[^"]*")?)*)>\s*<source src="([^"]+)" type="video\/mp4">\s*<\/video>/g;

/** Код <<script>> без пробелов и комментариев. */
function squash(code: string) {
	return code.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
}

// Скрипты шаблона: четыре видео (щелчок → второе → по окончании третье →
// щелчок → четвёртое → по окончании переход) и одно видео (щелчок → переход).
const fourScript = squash(`$(document).one(':passagedisplay', function () {
var v1 = document.getElementById('vid1'); var v2 = document.getElementById('vid2');
var v3 = document.getElementById('vid3'); var v4 = document.getElementById('vid4');
v2.load(); v3.load(); v4.load();
v1.addEventListener('click', function () { v1.pause(); v1.style.display = "none"; v2.style.display = "block"; v2.play().catch(function(){}); });
v2.addEventListener('ended', function () { v2.style.display = "none"; v3.style.display = "block"; v3.play().catch(function(){}); });
v3.addEventListener('click', function () { v3.pause(); v3.style.display = "none"; v4.style.display = "block"; v4.play().catch(function(){}); });
v4.addEventListener('ended', function () { Engine.play("@"); });
});`);
const oneScript = squash(`$(document).one(':passagedisplay', function () {
var v1 = document.getElementById('vid1');
v1.addEventListener('click', function () { Engine.play("@"); });
});`);

function attrs(raw: string) {
	const result: Record<string, string> = {};

	raw.replace(/([a-z]+)(?:="([^"]*)")?/g, (_, name: string, value?: string) => {
		result[name] = value ?? '';
		return '';
	});
	return result;
}

/** Текст пассажа, где видео иллюминатора стали цепочкой (или undefined). */
export function moveChain(text: string): string | undefined {
	const scriptMatch = /<<script>>([^]*?)<<\/script>>/.exec(text);

	if (!scriptMatch) {
		return undefined;
	}

	const code = squash(scriptMatch[1]);
	const target = /Engine\.play\("([^"]+)"\)/.exec(scriptMatch[1])?.[1];

	if (!target) {
		return undefined;
	}

	const shape = code.replace(squash(`Engine.play(${quote(target)})`), squash('Engine.play("@")'));
	const nexts = shape === fourScript ? ['click', 'end', 'click', 'end'] : shape === oneScript ? ['click'] : undefined;

	if (!nexts) {
		return undefined;
	}

	const videos = [...text.matchAll(videoRe)];

	if (
		videos.length !== nexts.length ||
		videos.some((v, i) => v[1] !== `vid${i + 1}`) ||
		videos[0].index! > scriptMatch.index
	) {
		return undefined;
	}

	// Видео должны идти подряд (между ними только «\» и переносы строк).
	for (let i = 1; i < videos.length; i++) {
		const gap = text.slice(videos[i - 1].index! + videos[i - 1][0].length, videos[i].index!);

		if (!/^\\?\n?$/.test(gap)) {
			return undefined;
		}
	}

	const first = attrs(videos[0][2]);
	const block = writeBlock({
		type: 'chain',
		values: {
			width: Number(first.width) || undefined,
			height: Number(first.height) || undefined,
			goto: target
		},
		extra: [],
		steps: videos.map((v, i) => {
			const a = attrs(v[2]);

			return {
				values: {src: v[3], loop: 'loop' in a || undefined, muted: 'muted' in a || undefined, next: nexts[i]},
				extra: []
			};
		})
	});
	const last = videos[videos.length - 1];
	const from = videos[0].index!;
	const to = last.index! + last[0].length;

	const tail = text.slice(scriptMatch.index + scriptMatch[0].length);
	const result = text.slice(0, from) + block + text.slice(to, scriptMatch.index) + tail;

	// <<script>> стоял в конце: пустые строки и «\» перед ним больше не нужны
	// («\» в самом конце текста SugarCube показал бы как символ).
	return tail.trim() === '' ? result.replace(/\\?\s*$/, '') : result;
}
