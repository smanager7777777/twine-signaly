// «Twine СИГНАЛЫ»: движок терминала — код, который программа вставляет в
// «JavaScript истории» между метками. Он одинаков для всех историй; все
// настройки он читает из CSS-переменных блока оформления (signaly-appearance.ts),
// поэтому история работает и в обычном Twine.
//
// Что делает (решения автора 12, 20, 21 и ответы к шагу 1.2):
// - стартовый экран «Нажмите, чтобы запустить систему»: SugarCube не
//   запускается до клика (LoadScreen.lock), после клика — полный экран, звук
//   запуска, игра;
// - автокопия прогресса в памяти браузера (localStorage) — при входе на экран
//   и после каждого действия; после сбоя игра продолжается с того же места
//   (музыку после сбоя включает мастер — ответ 2б);
// - «Новая игра» — Shift+Z+N с вопросом;
// - защита экрана: правая кнопка мыши, Ctrl+колесо, скрытие курсора;
// - прокрутка колесом по одной строке (по галочке);
// - история в один шаг (Config.history.maxStates = 1).
//
// - эффекты текста (шаг 2.1): печать — пропуск щелчком, на уже виденном экране
//   сразу весь текст; мигание; глитч по умолчанию;
// - кнопки на экране <<sg-place>> (сессия 6);
// - сессия 7: эффекты «после эффектов выше» (слово after, data-sg-after),
//   начало глитча и мигания (data-sg-start), ссылки в печатающемся тексте
//   нажимаются после допечатки, «тени» глитча печатаются вместе с текстом;
// - шаг 2.2: звуки наведения и нажатия по наборам (setup.signalySounds);
// - шаг 2.3: таймеры <<sg-timer>> (идут в фоне, переживают сбой) и цепочка
//   видео <<sg-chain>>;
// - шаг 3.2: <<sg-open>>, <<sg-timer-stop>>;
// - шаг 3.3: горячие клавиши мастера <<sg-key>> (пассаж с тегом sg-keys) и
//   звук-сигнал <<sg-sound>>;
// - шаг 3.4: общая таблица кодов (пассаж с тегом sg-codes): поле кода со
//   словом table, личный код во втором поле, права, одноразовые коды ($sgUsed),
//   «прогресс вводящего» <<sg-progress>>, _who — кто ввёл;
// - шаг 3.5: события (пассажи с тегом sg-event, <<sg-event условие>>), свой
//   счётчик заходов на экраны setup.visits(), коды, введённые сотрудниками,
//   setup.entered(), «Вернуться на экран, где были» <<sg-back>>;
// - сессия 15: звук цикла — когда игроки видят счётчик; цифры останавливаются
//   справа налево, у каждой своя скорость в начале и в конце;
// - сессия 14: событие ждёт, пока закроют окно-сообщение; шаг 4.1 — строка
//   событий и цикл на главном экране (пассаж с тегом sg-ticker).
//
// Код написан без обратных кавычек и без «${», потому что хранится в шаблонной
// строке.

import {defaultGlitch, glitchKeyframes, glitchRules} from './signaly-glitch';
import {timerDefaults} from './signaly-screen-blocks';

/** Глитч по умолчанию — правила с нулевой силой (их перекрывает всё остальное). */
const glitchBase = [...glitchRules(defaultGlitch, ':where(.glitchy)'), glitchKeyframes].join('\n');

/** Версия движка. Увеличивать при каждом изменении кода ниже. */
export const signalyEngineVersion = 12;

export const signalyEngineStart =
	'/* ===== СИГНАЛЫ: движок терминала — не редактировать вручную ===== */';
export const signalyEngineEnd =
	'/* ===== СИГНАЛЫ: конец движка терминала ===== */';

const engineBody = String.raw`/* Версия движка: ${signalyEngineVersion}. Обновляется программой «Twine СИГНАЛЫ».
   Настройки — в окне «Оформление терминала» (они лежат в таблице стилей).
   Свой код пишите ниже конца этого блока. */
(function () {
	'use strict';

	// История в один шаг: «назад» в браузере не откатывает игру.
	Config.history.maxStates = 1;

	var rootStyle = getComputedStyle(document.documentElement);

	function opt(name, fallback) {
		var raw = rootStyle.getPropertyValue('--sg-' + name).trim();

		if (raw === '') {
			return fallback;
		}
		if (raw.charAt(0) === '"') {
			try {
				return JSON.parse(raw);
			} catch (e) {
				return fallback;
			}
		}

		var number = Number(raw);

		return isNaN(number) ? raw : number;
	}

	var settings = {
		startSound: opt('start-sound', ''),
		startVolume: opt('start-volume', 1),
		noContextMenu: opt('protect-menu', 0) === 1,
		noZoom: opt('protect-zoom', 0) === 1,
		hideCursorAfter: opt('hide-cursor', 0),
		lineScroll: opt('line-scroll', 0) === 1,
		// Печать текста (шаг 2.1): по умолчанию включено (ответ автора 6А).
		typeClick: opt('type-click', 1) === 1,
		typeSeen: opt('type-seen', 1) === 1
	};

	// Предпросмотр в программе: без стартового экрана, автокопии и защиты.
	var preview = window.SIGNALY_PREVIEW;

	setup.signaly = {engine: ${signalyEngineVersion}, preview: !!preview};

	function showStartScreen(onClick) {
		var screen = document.createElement('div');

		screen.id = 'sg-start';
		document.body.appendChild(screen);
		screen.addEventListener('click', function () {
			onClick(screen);
		});
		return screen;
	}

	/* ----- Прокрутка по одной строке ----- */

	function scrollTarget(element) {
		while (element && element !== document.documentElement) {
			var style = getComputedStyle(element);

			if (
				/(auto|scroll)/.test(style.overflowY) &&
				element.scrollHeight > element.clientHeight
			) {
				return element;
			}
			element = element.parentElement;
		}
		return null;
	}

	if (settings.lineScroll) {
		document.addEventListener(
			'wheel',
			function (ev) {
				if (ev.ctrlKey || ev.deltaY === 0) {
					return;
				}

				var target = scrollTarget(ev.target);

				if (!target) {
					return;
				}

				// Высота строки — меряем настоящую строку текста этого блока.
				var probe = document.createElement('div');

				probe.textContent = 'X';
				probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;';
				target.appendChild(probe);

				var line = probe.getBoundingClientRect().height;

				target.removeChild(probe);
				ev.preventDefault();
				target.scrollBy({top: ev.deltaY > 0 ? line : -line, behavior: 'instant'});
			},
			{passive: false}
		);
	}

	/* ----- Слой эффектов поверх терминала ----- */

	// Шум и затемнение углов — в слое #sg-fx точно по рамке #passages. Слой
	// живёт внутри #passages (мерцает вместе с ним, экран тревоги остаётся
	// сверху), но закреплён на экране и не прокручивается вместе с текстом.
	function placeEffects() {
		var passages = document.getElementById('passages');

		if (!passages) {
			return;
		}

		var fx = document.getElementById('sg-fx');

		if (!fx) {
			fx = document.createElement('div');
			fx.id = 'sg-fx';
			fx.setAttribute('aria-hidden', 'true');
		}
		if (fx.parentNode !== passages) {
			passages.appendChild(fx);
		}

		var rect = passages.getBoundingClientRect();

		fx.style.left = rect.left + 'px';
		fx.style.top = rect.top + 'px';
		fx.style.width = rect.width + 'px';
		fx.style.height = rect.height + 'px';
	}

	$(document).on(':passagedisplay', placeEffects);
	window.addEventListener('resize', placeEffects);
	document.addEventListener('fullscreenchange', placeEffects);
	setInterval(placeEffects, 1000);

	/* ----- Блоки экрана (шаг 1.4) ----- */

	// Команды: <<sg-image>>, <<sg-video>>, <<sg-alarm>>, <<sg-dialog>>,
	// <<sg-code>> (с <<sg-case>> и <<sg-wrong>>), окно KR2. Их вставляет панель
	// «Добавить блок»; в обычном Twine они работают так же.

	var engineStyle = document.createElement('style');

	engineStyle.id = 'sg-engine-style';
	engineStyle.textContent =
		'@keyframes sg-alarm-blink { 50% { filter: brightness(0.45); } }\n' +
		'html[data-sg-dialog="noclose"] #ui-dialog-close { display: none; }\n' +
		'.sg-dialog-ok { margin-top: 1em; text-align: center; }\n' +
		// Эффекты текста (шаг 2.1): мигание; глитч — с нулевой силой (:where),
		// его перекрывают и блок оформления, и стили автора.
		'@keyframes sg-text-blink { 50% { opacity: 0; } }\n' +
		'.sg-blink { animation: sg-text-blink 1s steps(1, end) infinite; }\n' +
		// Сессия 7: ссылка в печатающемся тексте ждёт конца своей надписи;
		// глитч и мигание до своего начала — обычный текст.
		'.sg-type-wait { pointer-events: none !important; }\n' +
		'.sg-blink.sg-off { animation: none; }\n' +
		'html .glitchy.sg-off { color: inherit; }\n' +
		'html .glitchy.sg-off::before, html .glitchy.sg-off::after { content: none; }\n' +
		${JSON.stringify(glitchBase)};
	document.head.appendChild(engineStyle);

	// Слова команды: сначала значения по порядку, потом «имя значение» и галочки.
	function blockArgs(ctx, positional, keys, flags) {
		var args = ctx.args.slice();
		var result = {};

		positional.forEach(function (name) {
			if (args.length) {
				result[name] = args.shift();
			}
		});
		while (args.length) {
			var word = String(args.shift());

			if (flags.indexOf(word) !== -1) {
				result[word] = true;
			} else if (keys.indexOf(word) !== -1 && args.length) {
				result[word] = args.shift();
			}
		}
		return result;
	}

	var placeKeys = ['place', 'corner', 'x', 'y', 'border', 'color', 'glow'];

	// Внешний вид картинки или видео: рамка, свечение, место «на экране» —
	// от угла окна терминала, как кнопки на экране.
	function placeStyle(el, a) {
		var color = a.color || 'var(--sg-text, #00cc00)';
		var border = Number(a.border) || 0;
		var glow = Number(a.glow) || 0;

		if (border > 0) {
			el.style.border = border + 'px solid ' + color;
		}
		if (glow > 0) {
			el.style.boxShadow = '0 0 ' + glow + 'px ' + color + ', 0 0 ' + glow * 2 + 'px ' + color;
		}
		if (a.place === 'screen') {
			var corner = String(a.corner || 'tl');
			var right = corner === 'tr' || corner === 'br';
			var bottom = corner === 'bl' || corner === 'br';
			var halfW = 'var(--sg-win-width, 1050px) / 2';
			var halfH = 'var(--sg-win-height, 1050px) / 2';
			var offX = 'var(--sg-win-offset-x, 0px)';
			var offY = 'var(--sg-win-offset-y, 0px)';
			var x = (Number(a.x) || 0) + 'px';
			var y = (Number(a.y) || 0) + 'px';

			el.style.position = 'fixed';
			el.style[right ? 'right' : 'left'] = right
				? 'calc(50% - ' + halfW + ' - ' + offX + ' + ' + x + ')'
				: 'calc(50% - ' + halfW + ' + ' + offX + ' + ' + x + ')';
			el.style[bottom ? 'bottom' : 'top'] = bottom
				? 'calc(50% - ' + halfH + ' - ' + offY + ' + ' + y + ')'
				: 'calc(50% - ' + halfH + ' + ' + offY + ' + ' + y + ' + var(--sg-place-shift, 0px))';
		}
	}

	// Вывод блока: «по центру» — в отдельной строке по центру.
	function putPlaced(ctx, el, a, type) {
		if (preview) {
			// Для перетаскивания мышью в предпросмотре программы.
			el.setAttribute('data-sg-block', type);
			el.setAttribute('data-sg-src', ctx.source);
		}
		if (a.place === 'center') {
			var wrap = document.createElement('div');

			wrap.style.textAlign = 'center';
			wrap.appendChild(el);
			ctx.output.appendChild(wrap);
		} else {
			ctx.output.appendChild(el);
		}
	}

	// Кнопка или ссылка SugarCube с действием (та же разметка, что у <<button>>).
	function actionControl(output, label, asButton, action) {
		var name = asButton ? 'button' : 'link';
		var holder = document.createElement('span');

		$(holder).wiki('<<' + name + ' ' + JSON.stringify(String(label)) + '>><</' + name + '>>');

		// В режиме «Тестировать» SugarCube оборачивает кнопку в рамку отладки.
		var control = holder.querySelector(asButton ? 'button' : 'a');

		$(control).on('click', action);
		while (holder.firstChild) {
			output.appendChild(holder.firstChild);
		}
		return control;
	}

	function videoType(src) {
		var ext = String(src).split('.').pop().toLowerCase();

		return ext === 'webm' ? 'video/webm' : ext === 'ogv' || ext === 'ogg' ? 'video/ogg' : 'video/mp4';
	}

	Macro.add('sg-image', {
		handler: function () {
			var a = blockArgs(this, ['src'], ['width'].concat(placeKeys), []);
			var img = document.createElement('img');

			img.src = a.src || '';
			img.alt = '';
			if (Number(a.width) > 0) {
				img.style.width = Number(a.width) + 'px';
			}
			placeStyle(img, a);
			putPlaced(this, img, a, 'image');
		}
	});

	Macro.add('sg-video', {
		handler: function () {
			var a = blockArgs(
				this,
				['src'],
				['width', 'height'].concat(placeKeys),
				['autoplay', 'loop', 'muted', 'controls', 'buttons']
			);
			var video = document.createElement('video');
			var source = document.createElement('source');

			['controls', 'autoplay', 'loop', 'muted'].forEach(function (flag) {
				if (a[flag]) {
					video.setAttribute(flag, '');
					video[flag] = true;
				}
			});
			video.setAttribute('playsinline', '');
			if (Number(a.width) > 0) {
				video.setAttribute('width', Number(a.width));
			}
			if (Number(a.height) > 0) {
				video.setAttribute('height', Number(a.height));
			}
			source.src = a.src || '';
			source.type = videoType(a.src || '');
			video.appendChild(source);
			placeStyle(video, a);

			if (!a.buttons) {
				putPlaced(this, video, a, 'video');
				return;
			}

			// С кнопками «Воспроизвести» и «Остановить» — как в Videotest.
			var box = document.createDocumentFragment();

			box.appendChild(video);
			box.appendChild(document.createElement('br'));
			actionControl(box, 'Воспроизвести', true, function () {
				video.play().catch(function () {});
			});
			box.appendChild(document.createElement('br'));
			actionControl(box, 'Остановить', true, function () {
				video.pause();
			});
			if (preview) {
				video.setAttribute('data-sg-block', 'video');
				video.setAttribute('data-sg-src', this.source);
			}
			if (a.place === 'center') {
				var wrap = document.createElement('div');

				wrap.style.textAlign = 'center';
				wrap.appendChild(box);
				this.output.appendChild(wrap);
			} else {
				this.output.appendChild(box);
			}
		}
	});

	/* Кнопка на экране (сессия 6): содержимое стоит на месте от угла окна
	   терминала и не прокручивается с текстом; kind — вид кнопок и ссылок. */

	Macro.add('sg-place', {
		tags: null,
		handler: function () {
			var a = blockArgs(this, [], ['kind', 'corner', 'x', 'y', 'hover', 'click'], []);
			var el = document.createElement('span');

			el.className = 'sg-place' + (a.kind ? ' ' + a.kind : '');
			// Шаг 2.2: свой звук наведения и нажатия (none — без звука).
			['hover', 'click'].forEach(function (which) {
				if (a[which] !== undefined) {
					el.setAttribute('data-sg-' + which, a[which] === 'none' ? '' : String(a[which]));
				}
			});
			placeStyle(el, {place: 'screen', corner: a.corner, x: a.x, y: a.y});
			if (preview) {
				el.setAttribute('data-sg-block', 'place');
				el.setAttribute('data-sg-src', this.source);
			}
			$(el).wiki(this.payload[0].contents);
			this.output.appendChild(el);
		}
	});

	/* ----- Таймеры (шаг 2.3) ----- */

	// Таймер именной и идёт в фоне: время окончания лежит в переменной
	// $sgTimers (попадает в автокопию), табло того же таймера можно поставить
	// на несколько экранов. По окончании — переход, окно-сообщение или звук.
	var timerDefaults = ${JSON.stringify(timerDefaults)};
	var timerFonts = {};
	var restoring = false;

	function timerStore() {
		var v = State.variables;

		if (!v.sgTimers || typeof v.sgTimers !== 'object') {
			v.sgTimers = {};
		}
		return v.sgTimers;
	}

	function timersChanged() {
		if (setup.signaly.saveTimers) {
			setup.signaly.saveTimers();
		}
	}

	function pad(n) {
		return n < 10 ? '0' + n : String(n);
	}

	function timerText(end, format) {
		var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));

		if (format === 'hms') {
			return pad(Math.floor(left / 3600)) + ':' + pad(Math.floor(left / 60) % 60) + ':' + pad(left % 60);
		}
		return pad(Math.floor(left / 60)) + ':' + pad(left % 60);
	}

	// Шрифт табло — файл из папки игры (свой @font-face на каждый файл).
	function timerFont(file) {
		if (file === 'none') {
			return '';
		}
		if (!timerFonts[file]) {
			var family = 'sg-timer-font-' + (Object.keys(timerFonts).length + 1);
			var style = document.createElement('style');

			style.textContent =
				'@font-face { font-family: "' + family + '"; src: url(' + JSON.stringify(file) +
				'); font-weight: normal; font-style: normal; }';
			document.head.appendChild(style);
			timerFonts[file] = family;
		}
		return '"' + timerFonts[file] + '", monospace';
	}

	function timerEnded(name, t) {
		var store = timerStore();

		delete store[name];
		timersChanged();
		if (t.sound) {
			try {
				new Audio(t.sound).play().catch(function () {});
			} catch (e) {
				console.error('СИГНАЛЫ: звук таймера', e);
			}
		}
		if (t.passage || t.text || t.title) {
			setup.signaly.openDialog({title: t.title, passage: t.passage, text: t.text});
		}
		if (t.goto && Story.has(t.goto)) {
			Engine.play(t.goto);
		}
	}

	function tickTimers() {
		var store = State.variables && State.variables.sgTimers;

		if (!store || restoring || (Engine.isIdle && !Engine.isIdle())) {
			return;
		}
		$('.sg-timer[data-sg-timer]').each(function () {
			var t = store[this.getAttribute('data-sg-timer')];

			if (t) {
				this.firstChild.textContent = timerText(t.end, this.getAttribute('data-sg-format'));
			}
		});
		Object.keys(store).forEach(function (name) {
			var t = store[name];

			if (t && Date.now() >= t.end && State.variables.sgTimers === store && store[name] === t) {
				timerEnded(name, t);
			}
		});
	}

	setInterval(tickTimers, 250);

	Macro.add('sg-timer', {
		handler: function () {
			var a = blockArgs(
				this,
				['name'],
				['hours', 'minutes', 'seconds', 'start', 'goto', 'title', 'passage', 'text', 'sound',
					'font', 'color', 'bg', 'size', 'border', 'glow', 'format'],
				['hidden']
			);
			var name = String(a.name || State.passage);
			var store = timerStore();

			if (a.start !== 'running' && !(restoring && store[name])) {
				var total =
					(Number(a.hours) || 0) * 3600 + (Number(a.minutes) || 0) * 60 + (Number(a.seconds) || 0);
				var t = {end: Date.now() + total * 1000};

				['goto', 'title', 'passage', 'text', 'sound'].forEach(function (key) {
					if (a[key] !== undefined && a[key] !== '') {
						t[key] = String(a[key]);
					}
				});
				store[name] = t;
				timersChanged();
			}

			var running = store[name];

			// Табло не видно: скрытый таймер или таймер ещё не идёт.
			if (a.hidden || !running) {
				return;
			}

			var color = a.color || timerDefaults.color;
			var border = a.border === undefined ? timerDefaults.border : Number(a.border) || 0;
			var glow = a.glow === undefined ? timerDefaults.glow : Number(a.glow) || 0;
			var el = document.createElement('div');
			var text = document.createElement('span');
			var s = el.style;
			var font = timerFont(a.font === undefined ? timerDefaults.font : String(a.font));

			el.className = 'sg-timer';
			el.setAttribute('data-sg-timer', name);
			if (a.format === 'hms') {
				el.setAttribute('data-sg-format', 'hms');
			}
			if (font) {
				s.fontFamily = font;
			}
			s.fontSize = (a.size === undefined ? timerDefaults.size : Number(a.size) || 0) + 'px';
			s.color = color;
			s.backgroundColor = a.bg || timerDefaults.bg;
			if (border > 0) {
				s.border = border + 'px solid ' + color;
			}
			if (glow > 0) {
				s.boxShadow = '0 0 ' + glow + 'px ' + color + ', 0 0 ' + glow * 2 + 'px ' + color;
			}
			s.padding = '10px 20px';
			s.width = 'fit-content';
			s.margin = '20px auto';
			s.textAlign = 'center';
			s.display = 'flex';
			s.justifyContent = 'center';
			s.alignItems = 'center';
			text.textContent = timerText(running.end, a.format);
			el.appendChild(text);
			this.output.appendChild(el);
		}
	});

	// Действие ссылки или кнопки (шаг 3.2): остановить таймер по имени.
	// Запустить — тот же <<sg-timer … hidden>> внутри ссылки.
	Macro.add('sg-timer-stop', {
		handler: function () {
			var store = timerStore();
			var name = String(this.args.length ? this.args[0] : State.passage);

			if (store[name]) {
				delete store[name];
				timersChanged();
			}
		}
	});

	/* ----- Цепочка видео (шаг 2.3) ----- */

	// Шаги по порядку; следующий включает щелчок по видео, окончание видео или
	// N секунд. Все видео загружаются сразу — переход мгновенный (ответ 7А).
	Macro.add('sg-chain', {
		tags: ['sg-step'],
		handler: function () {
			var a = blockArgs(this, [], ['width', 'height', 'goto'].concat(placeKeys), []);
			var steps = this.payload.slice(1).map(function (part) {
				return blockArgs({args: part.args}, ['src'], ['next', 'seconds'], ['loop', 'muted']);
			});
			var box = document.createElement('span');
			var current = 0;
			var stepTimer = null;
			var done = false;
			var look = {border: a.border, glow: a.glow, color: a.color};

			box.className = 'sg-chain';

			var videos = steps.map(function (step, index) {
				var video = document.createElement('video');
				var source = document.createElement('source');

				['loop', 'muted'].forEach(function (flag) {
					if (step[flag]) {
						video.setAttribute(flag, '');
						video[flag] = true;
					}
				});
				if (index === 0) {
					video.setAttribute('autoplay', '');
					video.autoplay = true;
				} else {
					video.setAttribute('preload', 'auto');
					video.style.display = 'none';
				}
				if (Number(a.width) > 0) {
					video.setAttribute('width', Number(a.width));
				}
				if (Number(a.height) > 0) {
					video.setAttribute('height', Number(a.height));
				}
				source.src = step.src || '';
				source.type = videoType(step.src || '');
				video.appendChild(source);
				placeStyle(video, look);
				video.addEventListener('click', function () {
					if ((step.next || 'end') === 'click') {
						advance(index);
					}
				});
				video.addEventListener('ended', function () {
					if ((step.next || 'end') === 'end') {
						advance(index);
					}
				});
				box.appendChild(video);
				if (index > 0) {
					video.load();
				}
				return video;
			});

			function arm(index) {
				var step = steps[index];

				clearTimeout(stepTimer);
				if (step && step.next === 'time') {
					stepTimer = setTimeout(function () {
						advance(index);
					}, Math.max(0, Number(step.seconds) || 0) * 1000);
				}
			}

			function advance(index) {
				if (index !== current || done || !box.isConnected) {
					return;
				}
				clearTimeout(stepTimer);
				if (index + 1 < videos.length) {
					var old = videos[index];
					var next = videos[index + 1];

					old.pause();
					old.style.display = 'none';
					current = index + 1;
					next.style.display = '';
					next.currentTime = 0;
					next.play().catch(function () {});
					arm(current);
					return;
				}
				done = true;
				if (a.goto && Story.has(a.goto)) {
					Engine.play(a.goto);
				}
			}

			placeStyle(box, {place: a.place, corner: a.corner, x: a.x, y: a.y});
			putPlaced(this, box, a, 'chain');
			if (videos.length) {
				$(document).one(':passagedisplay', function () {
					arm(0);
				});
			}
		}
	});

	/* ----- Эффекты текста (шаг 2.1) ----- */

	// Экраны, которые уже показывали: при возврате <<type>> печатает сразу
	// весь текст (ответ 6А). Список попадает в автокопию.
	var seen = {};
	var seenNow = false;

	setup.signaly.seen = seen;
	$(document).on(':passagestart', function (ev) {
		seenNow = settings.typeSeen && !preview && seen[ev.passage.title] === true;
		skipAll = false;
	});
	$(document).on(':passagedisplay', function (ev) {
		seen[ev.passage.title] = true;
	});

	/* ----- Звуки наведения и нажатия (шаг 2.2) ----- */

	// Наборы — в блоке «СИГНАЛЫ: звуки наведения и нажатия» (setup.signalySounds).
	// У ссылки или кнопки звучит набор её вида (ближайший класс вида у неё или
	// вокруг неё), у вида без своего — набор вида «Обычный». Свой звук у элемента
	// — data-sg-hover / data-sg-click ("" — без звука). Из набора — случайный
	// файл; новый звук наведения прерывает предыдущий.
	var uiAudio = {};
	var hoverNow = null;
	var hoverTimer = null;

	function uiSoundOn() {
		return !preview || window.SIGNALY_UI_SOUND === true;
	}

	function uiAudioFor(file) {
		if (!uiAudio[file]) {
			var audio = new Audio(file);

			audio.preload = 'auto';
			audio.sgUi = true;
			uiAudio[file] = audio;
		}
		return uiAudio[file];
	}

	$(document).one(':passagestart', function () {
		var data = setup.signalySounds;

		if (data && data.sets) {
			data.sets.forEach(function (set) {
				(set.files || []).forEach(uiAudioFor);
			});
		}
	});

	function uiSet(el, which) {
		var data = setup.signalySounds;

		if (!data || !data.sets || !data.kinds) {
			return null;
		}

		var own = $(el).closest('[data-sg-' + which + ']');
		var name;

		if (own.length) {
			name = own.attr('data-sg-' + which);
		} else {
			for (var node = el; node && node.nodeType === 1 && name === undefined; node = node.parentNode) {
				for (var i = 0; i < node.classList.length; i++) {
					var kind = data.kinds[node.classList[i]];

					if (kind && kind[which] !== undefined) {
						name = kind[which];
						break;
					}
				}
			}
			if (name === undefined && data.kinds['']) {
				name = data.kinds[''][which];
			}
		}
		if (!name) {
			return null;
		}
		return (
			data.sets.filter(function (set) {
				return set.name === name;
			})[0] || null
		);
	}

	function playSet(set) {
		var files = set.files || [];
		var file = files[Math.floor(Math.random() * files.length)];

		if (!file) {
			return null;
		}

		var audio = uiAudioFor(file);

		audio.volume = Math.max(0, Math.min(1, (set.volume === undefined ? 100 : set.volume) / 100));
		audio.currentTime = 0;
		audio.play().catch(function () {});
		return audio;
	}

	function later(set, play) {
		if (set.delay > 0) {
			return setTimeout(play, set.delay);
		}
		play();
		return null;
	}

	$(document).on('mouseenter', 'a, button', function () {
		if (!uiSoundOn()) {
			return;
		}

		var set = uiSet(this, 'hover');

		clearTimeout(hoverTimer);
		if (hoverNow) {
			hoverNow.pause();
			hoverNow.currentTime = 0;
			hoverNow = null;
		}
		if (set) {
			hoverTimer = later(set, function () {
				hoverNow = playSet(set);
			});
		}
	});
	$(document).on('click', 'a, button', function () {
		var set = uiSoundOn() && uiSet(this, 'click');

		if (set) {
			later(set, function () {
				playSet(set);
			});
		}
	});

	/* ----- Порядок эффектов (сессия 7): «после эффектов выше» ----- */

	// Эффект со словом after (<<type 40ms after>>, <<timed 2s after>>) или span
	// с data-sg-after="1" ждёт, пока всё, что выше по тексту на этом экране,
	// допечатается, появится, сменится или включится, и только потом отсчитывает
	// свою задержку. waits — что ещё не закончилось, waiters — кто ждёт.
	var waits = [];
	var waiters = [];
	var checkTimer = null;

	$(document).on(':passageinit', function () {
		waits = [];
		waiters = [];
	});

	function takeWord(args, word) {
		var at = args.indexOf(word);

		if (at < 1) {
			return false;
		}
		args.splice(at, 1);
		return true;
	}

	function rootOf(node) {
		var el = node.nodeType === 1 ? node : node.parentNode;

		return el && el.closest ? el.closest('#ui-dialog-body, #passages') : null;
	}

	function busyBefore(node) {
		var root = rootOf(node);

		return waits.some(function (w) {
			if (w.node === node || !w.node.isConnected || rootOf(w.node) !== root || !w.pending()) {
				return false;
			}

			var pos = node.compareDocumentPosition(w.node);

			return (pos & Node.DOCUMENT_POSITION_PRECEDING) !== 0 && (pos & Node.DOCUMENT_POSITION_CONTAINS) === 0;
		});
	}

	function runWaiters() {
		checkTimer = null;
		waiters = waiters.filter(function (w) {
			return !w.started && w.node.isConnected;
		});
		waiters.sort(function (a, b) {
			return a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
		});
		waiters.forEach(function (w) {
			if (!w.started && w.node.isConnected && !busyBefore(w.node)) {
				w.started = true;
				w.run();
			}
		});
	}

	function check() {
		if (waiters.length && checkTimer === null) {
			checkTimer = setTimeout(runWaiters, 0);
		}
	}

	$(document).on(':passageend :passagedisplay', check);
	setInterval(check, 500);

	function wait(node, run) {
		var waiter = {node: node, run: run, started: false};

		waiters.push(waiter);
		waits.push({
			node: node,
			pending: function () {
				return !waiter.started;
			}
		});
		check();
	}

	// Команда со словом after: на её месте — метка; когда подойдёт очередь,
	// команда выполняется в это место.
	function deferMacro(ctx, run, args) {
		var anchor = document.createComment('sg-after');

		ctx.output.appendChild(anchor);
		wait(anchor, function () {
			var holder = document.createElement('span');
			var parent = anchor.parentNode;

			parent.insertBefore(holder, anchor.nextSibling);
			run(
				Object.create(ctx, {
					_output: {value: holder},
					_debugView: {value: null, writable: true}
				}),
				args
			);
			while (holder.firstChild) {
				parent.insertBefore(holder.firstChild, holder);
			}
			parent.removeChild(holder);
		});
	}

	var typeMacro = Macro.get('type');

	if (typeMacro) {
		var typeHandler = typeMacro.handler;
		var runType = function (ctx, args) {
			var marker = document.createComment('sg-type');
			var was = ctx.self.typeId;

			ctx.output.appendChild(marker);

			var result = typeHandler.apply(ctx, args);
			var id = ctx.self.typeId;

			if (id !== was) {
				waits.push({
					node: marker,
					pending: function () {
						var queue = TempState.macroTypeQueue;

						return !!queue && queue.some(function (item) {
							return item.id === id;
						});
					}
				});
			} else if (marker.parentNode) {
				marker.parentNode.removeChild(marker);
			}
			return result;
		};

		typeMacro.handler = function () {
			var after = takeWord(this.args, 'after');

			if (seenNow && this.args.length) {
				this.args[0] = '0s';
			}
			return after ? deferMacro(this, runType, arguments) : runType(this, arguments);
		};
	}

	var timedMacro = Macro.get('timed');

	if (timedMacro) {
		var timedHandler = timedMacro.handler;
		var timedRegister = timedMacro.registerTimeout;
		var timedNow = null;

		// Появление закончилось — показан последний раздел (и прошла плавность).
		timedMacro.registerTimeout = function (callback, items) {
			var info = timedNow;
			var left = items.length;

			timedNow = null;
			if (!info) {
				return timedRegister.call(this, callback, items);
			}
			info.registered = true;
			return timedRegister.call(
				this,
				function () {
					var result = callback.apply(this, arguments);

					if (--left === 0) {
						setTimeout(function () {
							info.done = true;
							check();
						}, info.fade ? 450 : 0);
					}
					return result;
				},
				items
			);
		};

		var runTimed = function (ctx, args) {
			var info = {done: false, registered: false, fade: ctx.args.length > 1 && /^(?:transition|t8n)$/.test(ctx.args[1])};
			var out = ctx.output;
			var last = out.lastChild;
			var result;

			timedNow = info;
			try {
				result = timedHandler.apply(ctx, args);
			} finally {
				timedNow = null;
			}
			if (info.registered && out.lastChild && out.lastChild !== last) {
				waits.push({
					node: out.lastChild,
					pending: function () {
						return !info.done;
					}
				});
			}
			return result;
		};

		timedMacro.handler = function () {
			return takeWord(this.args, 'after') ? deferMacro(this, runTimed, arguments) : runTimed(this, arguments);
		};
	}

	// Глитч и мигание с началом: data-sg-start="2s" (через N с), data-sg-after="1"
	// (после эффектов выше). До начала — класс sg-off (обычный текст).
	function startSpans(root) {
		$(root)
			.find('[data-sg-start], [data-sg-after]')
			.addBack('[data-sg-start], [data-sg-after]')
			.each(function () {
				var el = this;

				if (el.sgOn !== undefined) {
					return;
				}
				el.sgOn = false;
				el.classList.add('sg-off');

				var go = function () {
					var delay = 0;

					try {
						delay = cssTimeToMS(el.getAttribute('data-sg-start') || '0s');
					} catch (e) {
						delay = 0;
					}
					setTimeout(function () {
						el.sgOn = true;
						el.classList.remove('sg-off');
						check();
					}, delay);
				};

				if (el.getAttribute('data-sg-after')) {
					wait(el, go);
				} else {
					go();
				}
				waits.push({
					node: el,
					pending: function () {
						return !el.sgOn;
					}
				});
			});
	}

	/* ----- Ссылки и глитч в печатающемся тексте (сессия 7) ----- */

	// Ссылка или кнопка внутри <<type>> нажимается, только когда допечатана
	// целиком (пока печатается — класс sg-type-wait). «Тени» глитча печатаются
	// вместе с текстом.
	var typingNow = [];

	function followed(el, wrap) {
		for (var node = el; node && node !== wrap; node = node.parentNode) {
			if (node.nextSibling) {
				return true;
			}
		}
		return false;
	}

	function typingAround(el) {
		return (
			typingNow.some(function (wrap) {
				return (wrap.contains(el) && !followed(el, wrap)) || el.contains(wrap);
			}) ||
			!!el.querySelector('.macro-type-target') ||
			$(el)
				.find('.macro-type:not(.macro-type-done)')
				.toArray()
				.some(function (wrap) {
					return wrap.textContent === '';
				})
		);
	}

	function syncTyping() {
		var waiting = [];

		typingNow.forEach(function (wrap) {
			$(wrap)
				.find('a, button')
				.each(function () {
					if (!followed(this, wrap)) {
						waiting.push(this);
					}
				});
		});
		$('.sg-type-wait').each(function () {
			if (waiting.indexOf(this) === -1) {
				this.classList.remove('sg-type-wait');
			}
		});
		waiting.forEach(function (el) {
			el.classList.add('sg-type-wait');
		});
		$('.glitchy').each(function () {
			var full = this.getAttribute('data-sg-text');

			if (typingAround(this)) {
				if (full === null) {
					full = this.getAttribute('data-text') || '';
					this.setAttribute('data-sg-text', full);
				}
				this.setAttribute('data-text', Array.from(full).slice(0, Array.from(this.textContent).length).join(''));
			} else if (full !== null) {
				this.setAttribute('data-text', full);
				this.removeAttribute('data-sg-text');
			}
		});
	}

	$(document).on(':typingstart', function (ev) {
		typingNow.push(ev.target);
		syncTyping();
	});
	$(document).on(':typingstop', function (ev) {
		setTimeout(function () {
			typingNow = typingNow.filter(function (wrap) {
				return wrap !== ev.target && wrap.isConnected;
			});
			syncTyping();
			check();
		}, 0);
	});
	$(document).on(':passageinit', function () {
		typingNow = [];
	});

	new MutationObserver(function (records) {
		records.forEach(function (record) {
			for (var i = 0; i < record.addedNodes.length; i++) {
				if (record.addedNodes[i].nodeType === 1) {
					startSpans(record.addedNodes[i]);
				}
			}
		});
		if (typingNow.length || document.querySelector('[data-sg-text], .glitchy .macro-type')) {
			syncTyping();
		}
	}).observe(document.body, {childList: true, subtree: true, characterData: true});

	// Щелчок мышью (не по ссылке, кнопке или полю) допечатывает текст сразу —
	// и всё, что на этом экране ещё будет печататься.
	var skipAll = false;

	function skipTyping() {
		setTimeout(function () {
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', {key: Config.macros.typeSkipKey, bubbles: true})
			);
		}, 0);
	}

	$(document).on(':typingstart', function () {
		if (skipAll) {
			skipTyping();
		}
	});
	if (settings.typeClick) {
		document.addEventListener(
			'click',
			function (ev) {
				if (
					!document.querySelector('.macro-type:not(.macro-type-done):not(.macro-type-target)') ||
					$(ev.target).closest('a, button, input, textarea, select, label, #ui-dialog').length
				) {
					return;
				}
				skipAll = true;
				skipTyping();
			},
			true
		);
	}

	/* Экран тревоги: поверх всего экрана, закрывается щелчком, через N секунд
	   или только мастером (Shift+Z+X закрывает любой). */

	var alarmSounds = [];

	function stopAlarmSound(sound) {
		if (sound) {
			sound.pause();
			alarmSounds = alarmSounds.filter(function (s) {
				return s !== sound;
			});
		}
	}

	$(document).on(':passagestart', function () {
		alarmSounds.slice().forEach(stopAlarmSound);
	});

	function closeAlarm(el) {
		if (!el || !el.parentNode || el.getAttribute('data-sg-closed')) {
			return;
		}
		el.setAttribute('data-sg-closed', '1');
		stopAlarmSound(el.sgSound);
		el.parentNode.removeChild(el);

		var target = el.getAttribute('data-sg-goto');

		if (target && Story.has(target)) {
			Engine.play(target);
		}
	}

	setup.signaly.closeAlarm = function () {
		var all = document.querySelectorAll('.sg-alarm');

		closeAlarm(all[all.length - 1]);
	};

	Macro.add('sg-alarm', {
		tags: null,
		handler: function () {
			var a = blockArgs(
				this,
				[],
				['bg', 'color', 'size', 'blink', 'sound', 'volume', 'close', 'seconds', 'goto'],
				['loop']
			);
			var el = document.createElement('div');
			var s = el.style;

			el.className = 'sg-alarm';
			s.position = 'fixed';
			s.top = '0';
			s.left = '0';
			s.width = '100%';
			s.height = '100%';
			s.backgroundColor = a.bg || '#cc0000';
			s.color = a.color || '#000000';
			s.display = 'flex';
			s.justifyContent = 'center';
			s.alignItems = 'center';
			s.fontSize = (Number(a.size) || 70) + 'px';
			s.zIndex = '1002';
			if (Number(a.blink) > 0) {
				s.animation = 'sg-alarm-blink ' + Number(a.blink) + 's steps(1, end) infinite';
			}
			if (a.goto) {
				el.setAttribute('data-sg-goto', a.goto);
			}
			$(el).wiki(this.payload[0].contents);
			this.output.appendChild(el);

			if (a.sound) {
				try {
					var sound = new Audio(a.sound);

					sound.loop = !!a.loop;
					sound.volume = Math.max(0, Math.min(1, (a.volume === undefined ? 100 : Number(a.volume)) / 100));
					sound.play().catch(function () {});
					el.sgSound = sound;
					alarmSounds.push(sound);
				} catch (e) {
					console.error('СИГНАЛЫ: звук тревоги', e);
				}
			}
			if (a.close === 'click') {
				el.style.cursor = 'pointer';
				el.addEventListener('click', function () {
					closeAlarm(el);
				});
			} else if (a.close === 'time') {
				setTimeout(function () {
					closeAlarm(el);
				}, Math.max(0, Number(a.seconds) || 5) * 1000);
			}
		}
	});

	/* Окно-сообщение: заголовок, текст или пассаж; закрывается крестиком,
	   только кнопкой «Принято» или само через N секунд. */

	var dialogTurn = 0;

	document.addEventListener(
		'click',
		function (ev) {
			// Пока окно закрывается только кнопкой, щелчок мимо окна его не закрывает.
			if (
				document.documentElement.getAttribute('data-sg-dialog') === 'noclose' &&
				ev.target &&
				ev.target.id === 'ui-overlay'
			) {
				ev.stopPropagation();
				ev.preventDefault();
			}
		},
		true
	);

	function trimContent(text) {
		return String(text || '').replace(/^[ \t]*\n/, '').replace(/\n\s*$/, '');
	}

	setup.signaly.openDialog = function (o) {
		var turn = ++dialogTurn;
		var html = document.documentElement;

		Dialog.create(o.title || '');
		if (o.passage) {
			Dialog.wikiPassage(o.passage);
		} else {
			Dialog.wiki(o.text || '');
		}
		if (o.close === 'ok') {
			html.setAttribute('data-sg-dialog', 'noclose');
			var box = $('<div class="sg-dialog-ok"></div>').appendTo(Dialog.body());

			$('<button type="button" class="ui-close"></button>')
				.text(o.ok || 'Принято')
				.appendTo(box);
		}
		Dialog.open(null, function () {
			if (turn === dialogTurn) {
				html.removeAttribute('data-sg-dialog');
			}
		});
		if (o.close === 'time') {
			setTimeout(function () {
				if (turn === dialogTurn && Dialog.isOpen()) {
					Dialog.close();
				}
			}, Math.max(0, Number(o.seconds) || 5) * 1000);
		}
	};

	Macro.add('sg-dialog', {
		tags: null,
		handler: function () {
			var a = blockArgs(this, ['label'], ['title', 'passage', 'close', 'seconds', 'ok'], ['button']);
			var text = trimContent(this.payload[0].contents);

			actionControl(this.output, a.label === undefined ? '' : a.label, !!a.button, function () {
				setup.signaly.openDialog({
					title: a.title,
					passage: a.passage,
					text: text,
					close: a.close,
					seconds: a.seconds,
					ok: a.ok
				});
			});
		}
	});

	// Действие ссылки или кнопки (шаг 3.2): открыть окно-сообщение —
	// <<sg-open "Заголовок" passage "Пассаж" close ok|time ok "Принято" seconds 5>>текст<</sg-open>>.
	Macro.add('sg-open', {
		tags: null,
		handler: function () {
			var a = blockArgs(this, ['title'], ['passage', 'close', 'seconds', 'ok'], []);

			setup.signaly.openDialog({
				title: a.title,
				passage: a.passage,
				text: trimContent(this.payload[0].contents),
				close: a.close,
				seconds: a.seconds,
				ok: a.ok
			});
		}
	});

	/* Поле кода: таблица «код → действие» прямо в команде. */

	function codeAction(o, code) {
		State.temporary.code = code;
		if (o.sound) {
			try {
				new Audio(o.sound).play().catch(function () {});
			} catch (e) {
				console.error('СИГНАЛЫ: звук поля кода', e);
			}
		}
		if (o.passage || o.text || o.title) {
			setup.signaly.openDialog(o);
		}
		if (o.goto && Story.has(o.goto)) {
			Engine.play(o.goto);
		}
	}

	/* ----- Общая таблица кодов (шаг 3.4) -----
	   Пассаж с тегом sg-codes («Коды»):
	     <<sg-replies title "Ошибка" wrong "…" denied "…" badpin "…" used "…" ask "…">>
	     <<sg-person "3" pin "417" var "$progress3">>
	     <<sg-entry "205" "Подпись" who "3, 5" once all|each title "…" goto "…" denied "…" used "…">>
	     действия<<sg-answer>>ответ<</sg-entry>>
	   Поле кода со словом table проверяет сначала свои коды, потом таблицу.
	   Если коду важно, кто вводит (who, once each, <<sg-progress>>, _who), —
	   под полем появляется второе поле для личного кода. Отметки одноразовых
	   кодов — в $sgUsed (попадают в автокопию, «Новая игра» их стирает). */

	var codeTable = null;
	var codeCollect = null;
	var codePerson = null;

	Macro.add('sg-person', {
		handler: function () {
			if (!codeCollect) {
				return;
			}

			var a = blockArgs(this, ['id'], ['pin', 'var'], []);

			codeCollect.people.push({
				id: a.id === undefined ? '' : String(a.id),
				pin: a.pin === undefined ? '' : String(a.pin).trim(),
				variable: a['var'] === undefined ? '' : String(a['var']).replace(/^\$/, '')
			});
		}
	});

	Macro.add('sg-replies', {
		handler: function () {
			if (!codeCollect) {
				return;
			}

			var a = blockArgs(this, [], ['title', 'wrong', 'denied', 'badpin', 'used', 'ask'], []);

			Object.keys(a).forEach(function (key) {
				codeCollect.texts[key] = String(a[key]);
			});
		}
	});

	Macro.add('sg-entry', {
		tags: ['sg-answer'],
		handler: function () {
			if (!codeCollect) {
				return;
			}

			var a = blockArgs(this, ['code', 'label'], ['who', 'once', 'title', 'goto', 'denied', 'used'], []);
			var actions = this.payload[0].contents;
			var answer = this.payload[1] ? trimContent(this.payload[1].contents) : '';
			var who = a.who === undefined ? [] : String(a.who).split(',').map(function (s) {
				return s.trim();
			}).filter(Boolean);

			codeCollect.codes.push({
				code: a.code === undefined ? '' : String(a.code).trim(),
				who: who,
				once: a.once === 'all' || a.once === 'each' ? a.once : '',
				title: a.title === undefined ? '' : String(a.title),
				goto: a.goto === undefined ? '' : String(a.goto),
				denied: a.denied === undefined ? '' : String(a.denied),
				used: a.used === undefined ? '' : String(a.used),
				run: actions,
				answer: answer,
				pin:
					who.length > 0 ||
					a.once === 'each' ||
					/<<sg-progress[\s>]|\b_who\b/.test(actions + answer + (a.title === undefined ? '' : a.title))
			});
		}
	});

	// Действие «Прогресс вводящего +N»: переменная прогресса того, кто ввёл код.
	Macro.add('sg-progress', {
		handler: function () {
			var n = this.args.length ? Number(this.args[0]) : 1;

			if (!codePerson || !codePerson.variable) {
				return;
			}
			State.variables[codePerson.variable] =
				(Number(State.variables[codePerson.variable]) || 0) + (isFinite(n) ? n : 0);
		}
	});

	function codes() {
		if (codeTable) {
			return codeTable;
		}
		codeTable = {
			people: [],
			codes: [],
			texts: {
				title: 'Ошибка',
				wrong: 'Неверный код',
				denied: 'Нет доступа',
				badpin: 'Неверный личный код',
				used: 'Пусто',
				ask: 'Введите личный код'
			}
		};
		codeCollect = codeTable;
		Story.filter(function (p) {
			return p.tags.indexOf('sg-codes') !== -1;
		}).forEach(function (p) {
			try {
				new Wikifier(document.createDocumentFragment(), p.text);
			} catch (e) {
				console.error('СИГНАЛЫ: таблица кодов', e);
			}
		});
		codeCollect = null;

		// Шаг 3.5: код упомянут в условии «сотрудник ввёл код» — терминал
		// спросит личный код, чтобы знать, кто ввёл.
		var referenced = {};
		var refRe = /setup\.entered\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\)/g;

		Story.filter(function () {
			return true;
		}).forEach(function (p) {
			var m;

			refRe.lastIndex = 0;
			while ((m = refRe.exec(p.text))) {
				referenced[unquoteArg(m[2]).trim()] = true;
			}
		});
		codeTable.codes.forEach(function (c) {
			if (referenced[c.code]) {
				c.pin = true;
			}
		});
		return codeTable;
	}

	function unquoteArg(s) {
		try {
			return s.charAt(0) === '"' ? JSON.parse(s) : s.slice(1, -1).replace(/\\(.)/g, '$1');
		} catch (e) {
			return s.slice(1, -1);
		}
	}

	function usedMarks() {
		var v = State.variables;

		if (!v.sgUsed || typeof v.sgUsed !== 'object') {
			v.sgUsed = {};
		}
		return v.sgUsed;
	}

	function codeMessage(text) {
		setup.signaly.openDialog({title: codes().texts.title, text: text});
	}

	// Код найден в таблице и проверен: действия, ответ, переход.
	function runTableCode(c, person, value) {
		if (c.once) {
			usedMarks()[c.once === 'each' ? c.code + '|' + person.id : c.code] = true;
		}
		// Шаг 3.5: какие коды ввёл сотрудник — для условий «сотрудник ввёл код».
		if (person) {
			var entered = State.variables.sgEntered;

			if (!entered || typeof entered !== 'object') {
				entered = State.variables.sgEntered = {};
			}
			if (!Array.isArray(entered[person.id])) {
				entered[person.id] = [];
			}
			if (entered[person.id].indexOf(c.code) === -1) {
				entered[person.id].push(c.code);
			}
		}
		State.temporary.code = value;
		State.temporary.who = person ? person.id : '';
		codePerson = person;
		try {
			if (c.run.trim() !== '') {
				Wikifier.wikifyEval(c.run);
			}
		} catch (e) {
			console.error('СИГНАЛЫ: код ' + c.code, e);
		}
		codePerson = null;
		if (c.title || c.answer) {
			setup.signaly.openDialog({title: c.title, text: c.answer});
		}
		if (c.goto && Story.has(c.goto)) {
			Engine.play(c.goto);
		}
	}

	// Проверка с известным вводящим (или без него, если коду это не важно).
	function checkTableCode(c, person, value) {
		var marks = usedMarks();

		if (person && c.who.length && c.who.indexOf(person.id) === -1) {
			codeMessage(c.denied || codes().texts.denied);
			return;
		}
		if ((c.once === 'all' && marks[c.code]) || (c.once === 'each' && person && marks[c.code + '|' + person.id])) {
			codeMessage(c.used || codes().texts.used);
			return;
		}
		runTableCode(c, person, value);
	}

	function findTableCode(value) {
		var found = null;

		codes().codes.forEach(function (c) {
			if (!found && c.code !== '' && c.code === value) {
				found = c;
			}
		});
		return found;
	}

	Macro.add('sg-code', {
		tags: ['sg-case', 'sg-wrong'],
		handler: function () {
			var a = blockArgs(this, [], ['var', 'button', 'gap'], ['password', 'focus', 'clear', 'table']);
			var cases = [];
			var wrong = null;

			this.payload.slice(1).forEach(function (part) {
				var isCase = part.name === 'sg-case';
				var o = blockArgs(
					{args: part.args},
					isCase ? ['code'] : [],
					['goto', 'title', 'passage', 'sound'],
					[]
				);

				o.text = trimContent(part.contents);
				if (isCase) {
					cases.push(o);
				} else {
					wrong = o;
				}
			});

			var input = document.createElement('input');
			var varName = a['var'] ? String(a['var']).replace(/^\$/, '') : '';

			input.type = a.password ? 'password' : 'text';
			input.className = 'sg-code';
			input.setAttribute('tabindex', '0');
			if (varName) {
				var start = State.variables[varName];

				input.value = start === undefined || start === null ? '' : String(start);
				input.addEventListener('input', function () {
					State.variables[varName] = input.value;
				});
			}

			// Шаг 3.4: второе поле — личный код того, кто вводит.
			var pinHolder = document.createElement('span');

			pinHolder.className = 'sg-code-pin';

			function closePin() {
				while (pinHolder.firstChild) {
					pinHolder.removeChild(pinHolder.firstChild);
				}
			}

			function askPin(entry, value) {
				var texts = codes().texts;
				var pin = document.createElement('input');

				function checkPin() {
					var typed = pin.value.trim();
					var person = null;

					codes().people.forEach(function (p) {
						if (!person && p.pin !== '' && p.pin === typed) {
							person = p;
						}
					});
					closePin();
					if (!person) {
						codeMessage(texts.badpin);
						return;
					}
					checkTableCode(entry, person, value);
				}

				pinHolder.appendChild(document.createElement('br'));
				if (texts.ask) {
					pinHolder.appendChild(document.createTextNode(texts.ask));
					pinHolder.appendChild(document.createElement('br'));
				}
				pin.type = a.password ? 'password' : 'text';
				pin.className = 'sg-code';
				pin.setAttribute('tabindex', '0');
				pin.addEventListener('keydown', function (ev) {
					if (ev.key === 'Enter') {
						ev.preventDefault();
						checkPin();
					}
				});
				pinHolder.appendChild(pin);
				if (a.button) {
					var gap = a.gap === undefined ? 1 : Math.max(0, Number(a.gap) || 0);

					if (gap === 0) {
						pinHolder.appendChild(document.createTextNode(' '));
					}
					for (var i = 0; i < gap; i++) {
						pinHolder.appendChild(document.createElement('br'));
					}
					actionControl(pinHolder, a.button, true, checkPin);
				}
				pin.focus();
			}

			function tableEntry(entry, value) {
				if (entry.once === 'all' && usedMarks()[entry.code]) {
					codeMessage(entry.used || codes().texts.used);
				} else if (entry.pin) {
					askPin(entry, value);
				} else {
					checkTableCode(entry, null, value);
				}
			}

			function confirm() {
				var value = input.value;
				var found = null;
				var entry = null;

				cases.forEach(function (c) {
					if (!found && String(c.code) === value) {
						found = c;
					}
				});
				if (a.clear) {
					input.value = '';
					if (varName) {
						State.variables[varName] = '';
					}
				}
				closePin();
				if (!found && a.table) {
					entry = findTableCode(value.trim());
				}
				if (found) {
					codeAction(found, value);
				} else if (entry) {
					tableEntry(entry, value.trim());
				} else if (wrong) {
					codeAction(wrong, value);
				} else if (a.table) {
					State.temporary.code = value;
					codeMessage(codes().texts.wrong);
				}
			}

			input.addEventListener('keydown', function (ev) {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					confirm();
				}
			});
			this.output.appendChild(input);

			if (a.button) {
				var gap = a.gap === undefined ? 1 : Math.max(0, Number(a.gap) || 0);

				if (gap === 0) {
					this.output.appendChild(document.createTextNode(' '));
				}
				for (var i = 0; i < gap; i++) {
					this.output.appendChild(document.createElement('br'));
				}
				actionControl(this.output, a.button, true, confirm);
			}
			if (a.table) {
				this.output.appendChild(pinHolder);
			}
			if (a.focus) {
				$(document).one(':passagedisplay', function () {
					input.focus();
				});
			}
		}
	});

	/* Окно KR2 (экран с тегом kr2): текст и навигация, картинка, статусы.
	   Если в JavaScript истории остался свой код KR2 — движок его не трогает. */

	$(document).one(':passageinit', function () {
		if (Macro.has('kr2image') || Macro.has('kr2vars') || Macro.has('kr2main')) {
			return;
		}

		var kr2 = null;

		function reset() {
			kr2 = {image: '', vars: null, main: null, cols: null, rows: null};
		}

		function render(contents) {
			var tmp = $('<div style="display:none"></div>').appendTo(document.body);
			var frag = document.createDocumentFragment();

			tmp.wiki(contents);
			while (tmp[0].firstChild) {
				frag.appendChild(tmp[0].firstChild);
			}
			tmp.remove();
			return frag;
		}

		reset();

		Macro.add('kr2image', {
			handler: function () {
				kr2.image = this.args[0] || '';
			}
		});
		Macro.add('kr2layout', {
			handler: function () {
				kr2.cols = Number(this.args[0]) || null;
				kr2.rows = Number(this.args[1]) || null;
			}
		});
		Macro.add('kr2vars', {
			tags: null,
			handler: function () {
				kr2.vars = render(this.payload[0].contents);
			}
		});
		Macro.add('kr2main', {
			tags: null,
			handler: function () {
				kr2.main = render(this.payload[0].contents);
			}
		});

		$(document).on(':passagestart', function () {
			reset();
			$('#kr2-overlay').remove();
		});

		$(document).on(':passageend', function () {
			var passage = Story.get(State.passage);
			var $passages = $('#passages');

			if (!passage.tags.includes('kr2')) {
				$passages.removeClass('kr2-layout').css({gridTemplateColumns: '', gridTemplateRows: ''});
				return;
			}

			$passages.addClass('kr2-layout').css({
				gridTemplateColumns: kr2.cols ? kr2.cols + '% ' + (100 - kr2.cols) + '%' : '',
				gridTemplateRows: kr2.rows ? kr2.rows + '% ' + (100 - kr2.rows) + '%' : ''
			});

			var $passageEl = $passages.find('.passage');
			var $main = $('<div id="kr2-main"></div>');
			var $nav = $('<div id="kr2-nav"></div>');
			var $vars = $('<div id="kr2-vars"></div>');
			var $img = $('<div id="kr2-image"></div>');
			var image = kr2.image;

			if (kr2.vars) {
				$vars.append(kr2.vars);
			}
			$passageEl.find('a, button').each(function () {
				$nav.append(this);
			});
			if (kr2.main) {
				$main.append(kr2.main);
			} else {
				$passageEl.find('p').each(function () {
					if ($(this).text().trim() === '' && $(this).children().length === 0) {
						$(this).remove();
					}
				});
				$main.append($passageEl.contents());
			}
			if (image) {
				$('<img>').attr('src', image).attr('alt', '').appendTo($img);
			}

			// Щелчок по картинке — во весь терминал; ещё щелчок — обратно.
			$img.on('click', function () {
				if ($('#kr2-overlay').length) {
					$('#kr2-overlay').remove();
					return;
				}
				if (!image) {
					return;
				}

				var $overlay = $('<div id="kr2-overlay"></div>');

				$('<img>').attr('src', image).attr('alt', '').appendTo($overlay);
				$overlay.on('click', function () {
					$(this).remove();
				});
				$passages.append($overlay);
			});

			$passageEl.empty().append($main, $nav, $img, $vars);
		});
	});

	/* ----- События, заходы на экраны, коды сотрудников (шаг 3.5) ----- */

	/* Событие — пассаж с тегом sg-event, первой строкой
	     <<sg-event [repeat] [delay N] [priority N] условие>>.
	   Терминал сам переходит на него, когда условие станет верным (проверка —
	   при каждом изменении и 4 раза в секунду). Отметки событий — $sgEvents,
	   откуда перешли — $sgEventFrom, заходы на экраны — $sgVisits, коды,
	   введённые сотрудниками, — $sgEntered (всё попадает в автокопию,
	   «Новая игра» стирает). */

	// В самом экране команда события ничего не показывает.
	Macro.add('sg-event', {
		skipArgs: true,
		handler: function () {}
	});

	function varObject(name) {
		var v = State.variables;

		if (!v[name] || typeof v[name] !== 'object') {
			v[name] = {};
		}
		return v[name];
	}

	// Сколько раз заходили на экран (свой счётчик: у SugarCube история в один
	// шаг, а после сбоя visited() начинает заново).
	setup.visits = function (title) {
		var visits = State.variables.sgVisits;

		return (visits && Number(visits[String(title)])) || 0;
	};

	// Ввёл ли сотрудник код общей таблицы кодов.
	setup.entered = function (person, code) {
		var entered = State.variables.sgEntered;
		var list = entered && entered[String(person).trim()];

		return Array.isArray(list) && list.indexOf(String(code).trim()) !== -1;
	};

	var prevPassage = '';

	$(document).on(':passageinit', function () {
		prevPassage = State.passage;
	});

	$(document).on(':passagestart', function (ev) {
		// После сбоя тот же экран показывается заново — это не новый заход.
		if (restoring) {
			return;
		}

		var visits = varObject('sgVisits');
		var title = ev.passage.title;

		visits[title] = (Number(visits[title]) || 0) + 1;
	});

	// «Вернуться на экран, где были»: туда, откуда терминал перешёл на
	// событие; если события не было — на предыдущий экран.
	Macro.add('sg-back', {
		handler: function () {
			var target = State.variables.sgEventFrom || prevPassage;

			if (target && Story.has(target)) {
				setTimeout(function () {
					Engine.play(target);
				}, Engine.DOM_DELAY || 40);
			}
		}
	});

	/* ----- Строка событий и цикл (шаг 4.1) ----- */

	// Настройки — пассаж с тегом sg-ticker: <<sg-ticker>>, <<sg-cycle>>,
	// <<sg-cycle-at>>, <<sg-news>>. Строка стоит только на одном экране
	// (главном); условия и смена цикла проверяются всё время, на любом экране.
	// $sgTicker = {msgs: {имя: {at, shown}}, cycle, seen}: когда сообщение
	// включилось и сколько раз показано; цикл сейчас; цикл, который видели.
	var tickerCollect = null;
	var tickerTable = null;
	var tickerStrip = null;
	var tickerLine = null;
	var tickerNum = null;
	var tickerSpin = null;
	var tk = {phase: 'idle', at: 0, cur: null, old: null, round: {}, active: [], live: {}, general: null};

	engineStyle.textContent +=
		'#sg-ticker { position: sticky; top: calc(-1 * var(--sg-win-padding, 20px)); z-index: 10; display: flex; gap: 6px; box-sizing: border-box; ' +
		'padding: 4px; margin: calc(-1 * var(--sg-win-padding, 20px)) calc(-1 * var(--sg-win-padding, 20px)) 8px; ' +
		'background: var(--sg-win-bg, #000); line-height: 1.2; }\n' +
		'.sg-tk-box { box-sizing: border-box; background: var(--sg-win-bg, #000); ' +
		'border: var(--sg-border-width, 2px) solid var(--sg-border-color, currentColor); ' +
		'box-shadow: 0 0 var(--sg-glow-size, 0) var(--sg-glow-color, transparent); }\n' +
		'.sg-tk-line { flex: 1 1 auto; min-width: 0; position: relative; overflow: hidden; }\n' +
		'.sg-tk-msg { position: absolute; left: 10px; top: 50%; white-space: nowrap; will-change: transform, opacity; }\n' +
		'.sg-tk-cycle { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5em; padding: 0 12px; white-space: nowrap; }\n' +
		'.sg-tk-num span { display: inline-block; width: 1ch; text-align: center; }\n';

	Macro.add('sg-ticker', {
		handler: function () {
			if (tickerCollect) {
				tickerCollect.line = blockArgs(this, [], ['screen', 'height', 'size', 'font', 'speed', 'pause', 'hold', 'change', 'mode', 'order'], []);
			}
		}
	});

	Macro.add('sg-cycle', {
		handler: function () {
			if (tickerCollect) {
				tickerCollect.cycle = blockArgs(this, [], ['var', 'spin', 'gap', 'from', 'to', 'rate', 'sound', 'volume'], []);
			}
		}
	});

	Macro.add('sg-cycle-at', {
		handler: function () {
			if (tickerCollect) {
				var a = blockArgs(this, ['progress', 'value'], [], []);

				tickerCollect.rows.push({progress: Number(a.progress) || 0, value: String(a.value === undefined ? '' : a.value)});
			}
		}
	});

	Macro.add('sg-news', {
		tags: ['sg-text'],
		handler: function () {
			if (!tickerCollect) {
				return;
			}

			var a = blockArgs(this, ['name'], ['priority', 'minutes', 'times', 'color', 'effect'], ['general', 'bold', 'italic']);

			a.name = String(a.name === undefined ? '' : a.name);
			a.expr = this.payload[0].contents.trim();
			a.text = this.payload[1] ? this.payload[1].contents.trim() : '';
			a.priority = Number(a.priority) || 0;
			a.minutes = Number(a.minutes) || 0;
			a.times = Number(a.times) || 0;
			a.index = tickerCollect.news.length;
			tickerCollect.news.push(a);
		}
	});

	function ticker() {
		if (tickerTable !== null) {
			return tickerTable;
		}

		var t = {line: null, cycle: null, rows: [], news: []};

		tickerCollect = t;
		Story.filter(function (p) {
			return p.tags.indexOf('sg-ticker') !== -1;
		}).forEach(function (p) {
			try {
				new Wikifier(document.createDocumentFragment(), p.text);
			} catch (e) {
				console.error('СИГНАЛЫ: строка событий', e);
			}
		});
		tickerCollect = null;
		if (!t.line) {
			tickerTable = false;
			return false;
		}

		var a = t.line;
		var number = function (value, fallback) {
			var n = Number(value);

			return value === undefined || isNaN(n) ? fallback : n;
		};

		t.line = {
			screen: String(a.screen || ''),
			height: number(a.height, 48),
			size: number(a.size, 22),
			font: String(a.font || ''),
			speed: Math.max(1, number(a.speed, 60)),
			pause: number(a.pause, 2),
			hold: number(a.hold, 8),
			change: number(a.change, 1.5),
			mode: a.mode === 'scroll' ? 'scroll' : 'fade',
			order: String(a.order || 'new,general,seen').split(',')
		};
		if (t.cycle) {
			t.cycle.name = String(t.cycle['var'] || '').replace(/^\$/, '');
			t.cycle.spin = number(t.cycle.spin, 10);
			t.cycle.gap = Math.max(0, number(t.cycle.gap, 0.5));
			// rate — запись сборок до сессии 15: одна скорость в начале на все цифры.
			var firstRate = number(t.cycle.rate, 20);

			t.cycle.from = digitRates(t.cycle.from, firstRate);
			t.cycle.to = digitRates(t.cycle.to, t.cycle.rate === undefined ? 2 : Math.max(1, Math.round(firstRate / 15)));
			t.cycle.volume = number(t.cycle.volume, 100);
			if (!preview && t.cycle.sound) {
				signalFor(String(t.cycle.sound));
			}
			t.rows.sort(function (x, y) {
				return x.progress - y.progress;
			});
		}
		tickerTable = t;
		return t;
	}

	// Скорости пяти цифр слева направо: «20,20,20,20,20», смен в секунду.
	function digitRates(list, fallback) {
		var words = String(list === undefined ? '' : list).split(',');
		var rates = [];

		for (var i = 0; i < 5; i++) {
			var rate = Number(words[i]);

			rates.push(words[i] !== undefined && words[i] !== '' && rate > 0 ? rate : Math.max(0.1, fallback));
		}
		return rates;
	}

	function padCycle(value, length) {
		return String(value).padStart(length, '0');
	}

	// Цикл — строка таблицы с наибольшим прогрессом, не больше текущего.
	function cycleTarget(t) {
		if (!t.cycle || !t.cycle.name) {
			return null;
		}

		var progress = Number(State.variables[t.cycle.name]) || 0;
		var value = '00000';

		t.rows.forEach(function (row) {
			if (row.progress <= progress) {
				value = row.value;
			}
		});
		return padCycle(value, 5);
	}

	function showCycle(value) {
		if (!tickerNum) {
			return;
		}
		tickerNum.textContent = '';
		String(value).split('').forEach(function (digit) {
			var cell = document.createElement('span');

			cell.textContent = digit;
			tickerNum.appendChild(cell);
		});
	}

	// Меняются только разряды, начиная с первого изменившегося слева. Самая
	// правая цифра останавливается через spin секунд, каждая следующая левее —
	// ещё через gap секунд. Скорость цифры идёт от from к to за всё её время.
	function startSpin(from, to, t) {
		var length = Math.max(from.length, to.length);
		var a = padCycle(from, length);
		var b = padCycle(to, length);
		var first = 0;
		var cells = [];
		var duration = Math.max(0, t.cycle.spin) * 1000;
		var gap = t.cycle.gap * 1000;

		while (first < length && a.charAt(first) === b.charAt(first)) {
			first++;
		}
		for (var i = first; i < length; i++) {
			var slot = i - length + 5;

			cells.push({
				index: i,
				stop: duration + (length - 1 - i) * gap,
				from: t.cycle.from[slot],
				to: t.cycle.to[slot],
				next: 0
			});
		}
		tickerSpin = {to: b, digits: a.split(''), cells: cells, start: performance.now()};
		showCycle(a);
	}

	function spinFrame(now) {
		var spin = tickerSpin;

		if (!spin) {
			return;
		}

		var elapsed = now - spin.start;
		var left = 0;
		var changed = false;

		spin.cells.forEach(function (cell) {
			if (cell.done) {
				return;
			}
			if (elapsed >= cell.stop) {
				cell.done = true;
				spin.digits[cell.index] = spin.to.charAt(cell.index);
				changed = true;
				return;
			}
			left++;
			if (now < cell.next) {
				return;
			}

			var digit = Math.floor(Math.random() * 9);

			spin.digits[cell.index] = String(digit >= Number(spin.digits[cell.index]) ? digit + 1 : digit);
			cell.next = now + 1000 / (cell.from + (cell.to - cell.from) * (elapsed / cell.stop));
			changed = true;
		});
		if (changed) {
			showCycle(spin.digits.join(''));
		}
		if (left === 0) {
			tickerSpin = null;
			showCycle(spin.to);
			varObject('sgTicker').seen = spin.to;
			saveVars();
		}
	}

	function newsTrue(n) {
		if (n.expr === '') {
			return true;
		}
		try {
			return !!Scripting.evalTwineScript(n.expr);
		} catch (e) {
			if (!n.failed) {
				n.failed = true;
				console.error('СИГНАЛЫ: условие сообщения «' + n.name + '»', e);
			}
			return false;
		}
	}

	// Какие сообщения можно показывать: из общих — только включившееся последним
	// (новое общее сменяет старое).
	function tickerRefresh(t, marks, now) {
		var live = {};
		var fresh = [];
		var general = null;

		t.news.forEach(function (n) {
			var m = marks[n.name];

			if (!m || (n.minutes > 0 && now >= m.at + n.minutes * 60000)) {
				return;
			}
			live[n.name] = true;
			if (n.times > 0 && m.shown >= n.times) {
				return;
			}
			if (n.general && (!general || m.at >= marks[general.name].at)) {
				general = n;
			}
			fresh.push(n);
		});
		tk.live = live;
		tk.general = general;
		tk.active = fresh.filter(function (n) {
			return !n.general || n === general;
		});
	}

	function tickerCheck() {
		if (restoring || !State.passage || (!preview && !started) || (Engine.isIdle && !Engine.isIdle())) {
			return;
		}

		var t = ticker();

		if (!t) {
			return;
		}

		var store = varObject('sgTicker');
		var marks = store.msgs || (store.msgs = {});
		var now = Date.now();
		var changed = false;

		t.news.forEach(function (n) {
			var on = newsTrue(n);

			if (on && !marks[n.name]) {
				marks[n.name] = {at: now, shown: 0};
				changed = true;
			} else if (!on && marks[n.name]) {
				delete marks[n.name];
				delete tk.round[n.name];
				changed = true;
			}
		});
		tickerRefresh(t, marks, now);

		var target = cycleTarget(t);

		if (target !== null) {
			if (store.cycle === undefined) {
				store.cycle = target;
				store.seen = target;
				changed = true;
			} else if (store.cycle !== target) {
				store.cycle = target;
				changed = true;
			}
			if (tickerStrip && tickerStrip.isConnected) {
				if (store.seen !== target && (!tickerSpin || tickerSpin.to !== target)) {
					startSpin(tickerSpin ? tickerNum.textContent : store.seen, target, t);
					// Звук — когда игроки видят счётчик (ответ 7б, сессия 15).
					if (!preview && t.cycle.sound) {
						var audio = signalFor(String(t.cycle.sound));

						audio.volume = Math.max(0, Math.min(1, t.cycle.volume / 100));
						audio.currentTime = 0;
						audio.play().catch(function () {});
					}
				} else if (store.seen === target && !tickerSpin && tickerNum.textContent !== target) {
					showCycle(target);
				}
			}
		}
		if (changed) {
			saveVars();
		}
	}

	function tickerFont(font) {
		return !font ? '' : /[\/\\]/.test(font) ? timerFont(font) : '"' + font + '", monospace';
	}

	function buildTicker(t) {
		var strip = document.createElement('div');

		strip.id = 'sg-ticker';
		strip.style.fontSize = t.line.size + 'px';
		strip.style.fontFamily = tickerFont(t.line.font);
		tickerLine = document.createElement('div');
		tickerLine.className = 'sg-tk-box sg-tk-line';
		tickerLine.style.height = t.line.height + 'px';
		strip.appendChild(tickerLine);
		if (t.cycle) {
			var cycle = document.createElement('div');

			cycle.className = 'sg-tk-box sg-tk-cycle';
			cycle.style.height = t.line.height + 'px';
			cycle.textContent = 'Цикл';
			tickerNum = document.createElement('span');
			tickerNum.className = 'sg-tk-num';
			cycle.appendChild(tickerNum);
			strip.appendChild(cycle);
		}
		tickerStrip = strip;
	}

	function tickerClear() {
		tk.phase = 'idle';
		tk.cur = null;
		tk.old = null;
		tickerSpin = null;
		if (tickerLine) {
			tickerLine.textContent = '';
		}
	}

	function placeTicker() {
		var t = ticker();

		if (!t) {
			return;
		}

		var root = document.documentElement;
		var passages = document.getElementById('passages');

		if (State.passage !== t.line.screen) {
			if (tickerStrip && tickerStrip.parentNode) {
				tickerStrip.parentNode.removeChild(tickerStrip);
			}
			tickerClear();
			root.style.removeProperty('--sg-place-shift');
			return;
		}
		if (!tickerStrip) {
			buildTicker(t);
		}

		var fresh = !tickerStrip.isConnected && tk.phase === 'idle';

		passages.insertBefore(tickerStrip, passages.firstChild);
		root.style.setProperty('--sg-place-shift', t.line.height + 12 + 'px');

		if (fresh && t.cycle) {
			var store = varObject('sgTicker');

			showCycle(store.seen !== undefined ? store.seen : cycleTarget(t));
		}
	}

	function msgPlace(item, x, opacity) {
		item.el.style.transform = 'translate(' + x + 'px, -50%)';
		item.el.style.opacity = opacity;
	}

	function buildMsg(n) {
		var el = document.createElement('span');
		var inner = document.createElement('span');

		el.className = 'sg-tk-msg';
		if (n.color) {
			inner.style.color = String(n.color);
		}
		if (n.bold) {
			inner.style.fontWeight = 'bold';
		}
		if (n.italic) {
			inner.style.fontStyle = 'italic';
		}
		$(inner).wiki(n.text);
		if (n.effect === 'blink') {
			inner.className = 'sg-blink';
		} else if (n.effect === 'glitch') {
			inner.className = 'glitchy';
			inner.setAttribute('data-text', inner.textContent);
		}
		el.appendChild(inner);
		tickerLine.appendChild(el);
		return {news: n, el: el, width: el.getBoundingClientRect().width, x: 0};
	}

	function tickerPick(t) {
		if (!tk.active.length) {
			return null;
		}

		var marks = varObject('sgTicker').msgs || {};
		var rank = function (n) {
			var name = !(marks[n.name] && marks[n.name].shown) ? 'new' : n.general ? 'general' : 'seen';

			return t.line.order.indexOf(name);
		};
		var list = tk.active.slice().sort(function (x, y) {
			return rank(x) - rank(y) || y.priority - x.priority || x.index - y.index;
		});

		for (var i = 0; i < list.length; i++) {
			if (!tk.round[list[i].name]) {
				return list[i];
			}
		}
		tk.round = {};
		return list[0];
	}

	function countShow(t, n) {
		var marks = varObject('sgTicker').msgs || {};

		tk.round[n.name] = 1;
		if (marks[n.name]) {
			marks[n.name].shown = (marks[n.name].shown || 0) + 1;
			tickerRefresh(t, marks, Date.now());
			saveVars();
		}
	}

	function tickerEnter(t, n, now) {
		tk.cur = buildMsg(n);
		countShow(t, n);
		tk.phase = 'in';
		tk.at = now;
		msgPlace(tk.cur, t.line.mode === 'scroll' ? tickerLine.clientWidth : 0, t.line.mode === 'scroll' ? 1 : 0);
	}

	function tickerDrop(item) {
		if (item && item.el.parentNode) {
			item.el.parentNode.removeChild(item.el);
		}
	}

	// Текущее сообщение отстояло или его пора убрать: следующее — через смену.
	function tickerNext(t, now) {
		var n = tickerPick(t);

		if (n && tk.cur && n === tk.cur.news && tk.cur.x === 0) {
			countShow(t, n);
			tickerDrop(tk.cur);
			tk.cur = buildMsg(n);
			msgPlace(tk.cur, 0, 1);
			tk.phase = 'hold';
			tk.at = now;
			return;
		}
		if (t.line.mode === 'scroll' && n) {
			tk.old = tk.cur;
			tickerEnter(t, n, now);
			return;
		}
		tk.phase = 'out';
		tk.at = now;
	}

	function tickerFrame(now) {
		requestAnimationFrame(tickerFrame);

		var t = tickerTable;

		if (!t || !tickerStrip || !tickerStrip.isConnected) {
			return;
		}
		spinFrame(now);

		var line = t.line;
		var width = tickerLine.clientWidth - 20;
		var half = (line.change * 1000) / 2 || 1;
		var full = line.change * 1000 || 1;
		var cur = tk.cur;

		if (tk.phase === 'idle') {
			var n = tickerPick(t);

			if (n) {
				tickerEnter(t, n, now);
			}
			return;
		}
		if (cur && (tk.phase === 'hold' || tk.phase === 'run')) {
			var gone = !tk.live[cur.news.name] || (cur.news.general && tk.general && tk.general !== cur.news);

			if (gone) {
				tickerNext(t, now);
				return;
			}
		}
		if (tk.phase === 'in') {
			var enter = (now - tk.at) / (line.mode === 'scroll' ? full : half);

			if (enter >= 1) {
				tickerDrop(tk.old);
				tk.old = null;
				msgPlace(cur, 0, 1);
				tk.phase = 'hold';
				tk.at = now;
			} else if (line.mode === 'scroll') {
				msgPlace(cur, (1 - enter) * tickerLine.clientWidth, 1);
				if (tk.old) {
					msgPlace(tk.old, tk.old.x - enter * tickerLine.clientWidth, 1);
				}
			} else {
				msgPlace(cur, 0, enter);
			}
		} else if (tk.phase === 'hold') {
			var over = cur.width > width;

			if (now - tk.at >= (over ? line.pause : line.hold) * 1000) {
				if (over) {
					tk.phase = 'run';
					tk.at = now;
				} else {
					tickerNext(t, now);
				}
			}
		} else if (tk.phase === 'run') {
			cur.x = -((now - tk.at) / 1000) * line.speed;
			if (cur.x <= -(cur.width + 10)) {
				tickerDrop(cur);
				tk.cur = null;
				tk.phase = 'idle';
			} else {
				msgPlace(cur, cur.x, 1);
			}
		} else if (tk.phase === 'out') {
			var leave = (now - tk.at) / half;

			if (leave >= 1 || !cur) {
				tickerDrop(cur);
				tk.cur = null;
				tk.phase = 'idle';
			} else {
				msgPlace(cur, cur.x, 1 - leave);
			}
		}
	}

	setup.signaly.tickerCheck = tickerCheck;
	// Предпросмотр окна «Строка событий»: показать смену цикла.
	setup.signaly.cycleDemo = function () {
		var t = ticker();

		if (!t || !t.cycle || !tickerNum) {
			return;
		}

		var to = cycleTarget(t);
		var list = t.rows.map(function (row) {
			return padCycle(row.value, 5);
		});
		var at = list.indexOf(to);
		var other = list[at - 1] || list[at + 1];

		startSpin(other && other !== to ? other : padCycle((Number(to) + 25) % 100000, 5), to, t);
	};
	$(document).on(':passagedisplay', placeTicker);
	$(document).on(':passageend', function () {
		setTimeout(tickerCheck, 0);
	});
	setInterval(tickerCheck, 250);
	requestAnimationFrame(tickerFrame);

	if (preview) {
		// Всегда с выбранного экрана, а не с того, что был в прошлый раз.
		State.reset();
		if (preview === 'start') {
			LoadScreen.lock();
			showStartScreen(function () {});
		}
		return;
	}

	/* ----- Полный экран и звук запуска ----- */

	function requestFullscreen() {
		var root = document.documentElement;

		if (document.fullscreenElement || !root.requestFullscreen) {
			return;
		}
		root.requestFullscreen().catch(function () {});
	}

	function playStartSound() {
		if (!settings.startSound) {
			return;
		}
		try {
			var sound = new Audio(settings.startSound);

			sound.volume = Math.max(0, Math.min(1, settings.startVolume));
			sound.play().catch(function () {});
		} catch (e) {
			console.error('СИГНАЛЫ: звук запуска', e);
		}
	}

	/* ----- Защита экрана ----- */

	if (settings.noContextMenu) {
		document.addEventListener('contextmenu', function (ev) {
			ev.preventDefault();
		});
	}

	if (settings.noZoom) {
		document.addEventListener(
			'wheel',
			function (ev) {
				if (ev.ctrlKey) {
					ev.preventDefault();
				}
			},
			{passive: false}
		);
	}

	if (settings.hideCursorAfter > 0) {
		var cursorTimer = null;
		var showCursor = function () {
			document.documentElement.classList.remove('sg-cursor-hidden');
			clearTimeout(cursorTimer);
			cursorTimer = setTimeout(function () {
				document.documentElement.classList.add('sg-cursor-hidden');
			}, settings.hideCursorAfter * 1000);
		};

		document.addEventListener('mousemove', showCursor);
		document.addEventListener('mousedown', showCursor);
		showCursor();
	}

	/* ----- Автокопия прогресса ----- */

	// В режиме «Тестировать» автокопии нет: проверка всегда начинается заново.
	var autocopyOn = Config.debug !== true;
	var fileName = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
	// У каждого файла игры своя автокопия.
	var storageKey = 'СИГНАЛЫ/автокопия/' + Story.ifId + '/' + fileName;
	var serial = typeof Serial !== 'undefined' ? Serial : JSON;
	var record = null;
	var stopped = false;
	var started = false;
	var navCount = 0;

	function readCopy() {
		try {
			var raw = localStorage.getItem(storageKey);

			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			return null;
		}
	}

	function writeCopy() {
		if (!autocopyOn || stopped || !record) {
			return;
		}
		try {
			localStorage.setItem(storageKey, JSON.stringify(record));
		} catch (e) {
			console.error('СИГНАЛЫ: автокопия не записана', e);
		}
	}

	function saveEntry() {
		// Состояние на входе в экран — как его запоминает сам SugarCube.
		record = {
			v: 1,
			passage: State.passage,
			vars: serial.stringify(State.variables),
			seen: Object.keys(seen).concat(State.passage),
			time: Date.now()
		};
		writeCopy();
	}

	function afterAction() {
		var turn = navCount;

		setTimeout(function () {
			// Если действие сменило экран, копию уже записал вход в экран.
			if (turn !== navCount || !record) {
				return;
			}
			record.vars = serial.stringify(State.variables);
			record.time = Date.now();
			writeCopy();
		}, 50);
	}

	function startAutocopy() {
		// Шаг 2.3: таймеры меняются не только при переходе — пишем их отдельно.
		setup.signaly.saveTimers = function () {
			if (!record) {
				return;
			}
			try {
				record.timers = JSON.parse(JSON.stringify(State.variables.sgTimers || {}));
			} catch (e) {
				record.timers = {};
			}
			writeCopy();
		};
		$(document).on(':passageinit', function () {
			navCount++;
		});
		$(document).on(':passagestart', saveEntry);
		document.addEventListener('click', afterAction, true);
		document.addEventListener('change', afterAction, true);
		document.addEventListener(
			'keyup',
			function (ev) {
				if (ev.key === 'Enter') {
					afterAction();
				}
			},
			true
		);
	}

	function prepareRestore(copy) {
		// Сеанс вкладки забываем — продолжаем по автокопии.
		State.reset();
		Config.passages.start = copy.passage;
		(copy.seen || []).forEach(function (title) {
			seen[title] = true;
		});
		$(document).one(':passageinit', function () {
			var variables = State.variables;

			Object.keys(variables).forEach(function (name) {
				delete variables[name];
			});
			try {
				Object.assign(variables, serial.parse(copy.vars));
			} catch (e) {
				console.error('СИГНАЛЫ: переменные не восстановлены', e);
			}
			// Таймеры — как были в момент сбоя: идущий таймер не начинается
			// заново, а продолжает по времени окончания.
			if (copy.timers) {
				variables.sgTimers = copy.timers;
			}
			restoring = true;
		});
		$(document).one(':passagedisplay', function () {
			restoring = false;
		});
	}

	/* ----- Новая игра: Shift+Z+N (клавиши можно поменять, шаг 3.3) ----- */

	function newGame() {
		stopped = true;
		try {
			localStorage.removeItem(storageKey);
		} catch (e) {
			console.error('СИГНАЛЫ: автокопия не стёрта', e);
		}
		Engine.restart();
	}

	function askNewGame() {
		if (!started) {
			return;
		}
		Dialog.create('Новая игра');

		var body = $(Dialog.body());

		$('<p></p>').text('Начать новую игру? Текущий прогресс будет стёрт.').appendTo(body);
		$('<button type="button" class="sg-new-game-yes"></button>')
			.text('Да')
			.on('click', newGame)
			.appendTo(body);
		body.append(' ');
		$('<button type="button" class="sg-new-game-no"></button>')
			.text('Нет')
			.on('click', function () {
				Dialog.close();
			})
			.appendTo(body);
		Dialog.open();
	}

	/* ----- Горячие клавиши мастера (шаг 3.3) ----- */

	// Таблица — пассаж с тегом sg-keys («Горячие клавиши»):
	//   <<sg-key "Shift+Z+A" "Подпись" [goto "Экран"] [ask]>>действия<</sg-key>>
	//   <<sg-key "Shift+Z+N" "Новая игра" builtin newgame>><</sg-key>>
	// Удерживать Z и нажать Shift + букву или цифру. Встроенные «новая игра»
	// (Shift+Z+N) и «закрыть тревогу» (Shift+Z+X) можно перевести на другие
	// клавиши (ответ 6Б). Комбинация срабатывает и в поле ввода, а Z и буква в
	// поле не попадают (ответ 5Б).
	var keyTable = null;
	var keyCollect = null;

	Macro.add('sg-key', {
		tags: null,
		handler: function () {
			if (!keyCollect) {
				return;
			}

			var a = blockArgs(this, ['combo', 'label'], ['goto', 'builtin'], ['ask']);

			keyCollect.push({
				combo: comboName(a.combo),
				label: a.label === undefined ? '' : String(a.label),
				goto: a.goto === undefined ? '' : String(a.goto),
				builtin: a.builtin === undefined ? '' : String(a.builtin),
				ask: a.ask === true,
				code: this.payload[0].contents
			});
		}
	});

	function comboName(combo) {
		return String(combo || '').replace(/\s+/g, '').toUpperCase();
	}

	function keys() {
		if (keyTable) {
			return keyTable;
		}
		keyTable = [];
		keyCollect = keyTable;
		Story.filter(function (p) {
			return p.tags.indexOf('sg-keys') !== -1;
		}).forEach(function (p) {
			try {
				new Wikifier(document.createDocumentFragment(), p.text);
			} catch (e) {
				console.error('СИГНАЛЫ: горячие клавиши', e);
			}
		});
		keyCollect = null;

		var builtins = {newgame: 'SHIFT+Z+N', alarm: 'SHIFT+Z+X'};

		keyTable.forEach(function (k) {
			if (builtins[k.builtin]) {
				builtins[k.builtin] = '';
			}
		});
		// Встроенных нет в таблице — они на своих местах.
		Object.keys(builtins).forEach(function (name) {
			if (builtins[name]) {
				keyTable.push({combo: builtins[name], builtin: name, code: ''});
			}
		});
		return keyTable;
	}

	function confirmKey(label, then) {
		Dialog.create(label || 'Горячая клавиша');

		var body = $(Dialog.body());

		$('<p></p>')
			.text('Выполнить «' + (label || 'горячая клавиша') + '»?')
			.appendTo(body);
		$('<button type="button" class="sg-key-yes"></button>')
			.text('Да')
			.on('click', function () {
				Dialog.close();
				then();
			})
			.appendTo(body);
		body.append(' ');
		$('<button type="button" class="sg-key-no"></button>')
			.text('Нет')
			.on('click', function () {
				Dialog.close();
			})
			.appendTo(body);
		Dialog.open();
	}

	function runKey(k) {
		if (k.builtin === 'newgame') {
			askNewGame();
			return;
		}
		if (k.builtin === 'alarm') {
			setup.signaly.closeAlarm();
			return;
		}

		var run = function () {
			try {
				if (k.code.trim() !== '') {
					Wikifier.wikifyEval(k.code);
				}
			} catch (e) {
				console.error('СИГНАЛЫ: горячая клавиша ' + k.combo, e);
			}
			if (k.goto) {
				Engine.play(k.goto);
			} else {
				afterAction();
			}
		};

		if (k.ask) {
			confirmKey(k.label, run);
		} else {
			run();
		}
	}

	var zDown = false;
	var zInput = null;

	function editable(el) {
		return (
			el &&
			(el.tagName === 'TEXTAREA' ||
				(el.tagName === 'INPUT' && /^(text|password|search|email|url|tel|number|)$/i.test(el.type || '')))
		);
	}

	// Что было в поле до нажатия Z: если Z окажется частью комбинации, поле
	// возвращается к этому виду (и переменная поля тоже).
	function restoreInput() {
		var snap = zInput;

		zInput = null;
		if (!snap || !snap.el.isConnected || snap.el.value === snap.value) {
			return;
		}
		snap.el.value = snap.value;
		try {
			snap.el.setSelectionRange(snap.start, snap.end);
		} catch (e) {
			/* У поля нет выделения. */
		}
		snap.el.dispatchEvent(new Event('input', {bubbles: true}));
	}

	document.addEventListener(
		'keydown',
		function (ev) {
			if (ev.code === 'KeyZ') {
				if (!zDown && editable(ev.target)) {
					zInput = {
						el: ev.target,
						value: ev.target.value,
						start: ev.target.selectionStart,
						end: ev.target.selectionEnd
					};
				}
				zDown = true;
				return;
			}
			if (!zDown || !ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) {
				return;
			}

			var m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(ev.code);

			if (!m) {
				return;
			}

			var combo = 'SHIFT+Z+' + (m[1] || m[2]);
			var found = null;

			keys().forEach(function (k) {
				if (!found && k.combo === combo) {
					found = k;
				}
			});
			if (!found) {
				return;
			}
			ev.preventDefault();
			ev.stopPropagation();
			restoreInput();
			if (ev.repeat || !started) {
				return;
			}
			runKey(found);
		},
		true
	);
	document.addEventListener('keyup', function (ev) {
		if (ev.code === 'KeyZ') {
			zDown = false;
			zInput = null;
		}
	});
	window.addEventListener('blur', function () {
		zDown = false;
		zInput = null;
	});

	/* ----- Звук-сигнал (шаг 3.3, ответ 3А) ----- */

	// <<sg-sound "media/audio/x.wav" volume 100 [keep]>> — отдельный звук мимо
	// SimpleAudio: его не задевают кнопки A–E, пауза и громкость групп.
	// keep — не начинать заново, если ещё звучит.
	var signalAudio = {};

	function signalFor(src) {
		if (!signalAudio[src]) {
			var audio = new Audio(src);

			audio.preload = 'auto';
			audio.sgUi = true;
			signalAudio[src] = audio;
		}
		return signalAudio[src];
	}

	Macro.add('sg-sound', {
		handler: function () {
			var a = blockArgs(this, ['src'], ['volume'], ['keep']);

			if (!a.src || !uiSoundOn()) {
				return;
			}

			var audio = signalFor(String(a.src));
			var volume = a.volume === undefined ? 100 : Number(a.volume);

			audio.volume = Math.max(0, Math.min(1, (isNaN(volume) ? 100 : volume) / 100));
			if (!a.keep) {
				audio.currentTime = 0;
			}
			audio.play().catch(function (e) {
				console.error('СИГНАЛЫ: звук-сигнал', e);
			});
		}
	});

	// Файлы звуков-сигналов загружаются заранее, как в коде шаблона.
	$(document).one(':passagestart', function () {
		var re = /<<sg-sound\s+(["'])((?:\\.|(?!\1).)*)\1/g;

		Story.filter(function () {
			return true;
		}).forEach(function (p) {
			var m;

			re.lastIndex = 0;
			while ((m = re.exec(p.text))) {
				signalFor(m[2]);
			}
		});
	});

	/* ----- События: проверка и переход (шаг 3.5) ----- */

	// Ответы автора: проверка сразу после любого изменения; по умолчанию один
	// раз (repeat — снова, когда условие было ложным и стало верным); delay N —
	// через N секунд после того, как условие стало верным (отсчёт в фоне,
	// переживает смену экрана и сбой; условие снова ложно — отсчёт отменяется);
	// несколько готовых событий — по очереди, по важности; с экрана события
	// терминал не уводит — следующее событие ждёт, пока игроки уйдут с него.
	var eventList = null;
	var eventBusy = false;

	function macroEnd(text, from) {
		var quote = '';

		for (var i = from; i < text.length - 1; i++) {
			var ch = text.charAt(i);

			if (quote) {
				if (ch === '\\') {
					i++;
				} else if (ch === quote) {
					quote = '';
				}
			} else if (ch === '"' || ch === "'") {
				quote = ch;
			} else if (ch === '>' && text.charAt(i + 1) === '>') {
				return i;
			}
		}
		return -1;
	}

	function eventArgs(args) {
		var rest = args.trim();
		var a = {repeat: false, delay: 0, priority: 0};
		var m;

		while ((m = /^(repeat|delay|priority)(?:\s+(-?\d+(?:[.,]\d+)?))?(?:\s+|$)/.exec(rest))) {
			if (m[1] !== 'repeat' && m[2] === undefined) {
				break;
			}
			if (m[1] === 'repeat') {
				a.repeat = true;
			} else if (m[1] === 'delay') {
				a.delay = Math.max(0, Number(m[2].replace(',', '.')) || 0);
			} else {
				a.priority = Number(m[2].replace(',', '.')) || 0;
			}
			rest = rest.slice(m[0].length);
		}
		a.expr = rest.trim();
		return a;
	}

	function events() {
		if (eventList) {
			return eventList;
		}
		eventList = [];
		Story.filter(function (p) {
			return p.tags.indexOf('sg-event') !== -1;
		}).forEach(function (p) {
			var m = /<<sg-event(?=[\s>])/.exec(p.text);
			var end = m ? macroEnd(p.text, m.index + 2) : -1;

			if (end === -1) {
				return;
			}

			var a = eventArgs(p.text.slice(m.index + '<<sg-event'.length, end));

			if (a.expr !== '') {
				a.name = p.title;
				eventList.push(a);
			}
		});
		eventList.sort(function (x, y) {
			return y.priority - x.priority || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0);
		});
		return eventList;
	}

	function eventTrue(ev) {
		try {
			return !!Scripting.evalTwineScript(ev.expr);
		} catch (e) {
			if (!ev.failed) {
				ev.failed = true;
				console.error('СИГНАЛЫ: условие события «' + ev.name + '»', e);
			}
			return false;
		}
	}

	function saveVars() {
		if (!record) {
			return;
		}
		record.vars = serial.stringify(State.variables);
		record.time = Date.now();
		writeCopy();
	}

	function checkEvents() {
		if (!started || restoring || eventBusy || !State.passage || (Engine.isIdle && !Engine.isIdle())) {
			return;
		}

		var list = events();

		if (!list.length) {
			return;
		}

		var marks = varObject('sgEvents');
		var now = Date.now();
		var changed = false;

		list.forEach(function (ev) {
			var m = marks[ev.name] || {};
			var before = JSON.stringify(m);

			if (m.done && !ev.repeat) {
				return;
			}
			if (!eventTrue(ev)) {
				delete m.due;
				delete m.was;
			} else if (!m.ready && !m.was) {
				if (ev.delay > 0 && !m.due) {
					m.due = now + ev.delay * 1000;
				}
				if (!m.due || now >= m.due) {
					delete m.due;
					m.ready = 1;
					if (ev.repeat) {
						m.was = 1;
					}
				}
			}
			if (JSON.stringify(m) !== before) {
				changed = true;
				if (Object.keys(m).length) {
					marks[ev.name] = m;
				} else {
					delete marks[ev.name];
				}
			}
		});

		var current = State.passage;
		var here = Story.has(current) && Story.get(current).tags.indexOf('sg-event') !== -1;
		var next = null;

		list.forEach(function (ev) {
			var m = marks[ev.name];

			if (!m || !m.ready) {
				return;
			}
			if (ev.name === current) {
				// Игроки уже на экране события.
				delete m.ready;
				if (!ev.repeat) {
					m.done = 1;
				}
				changed = true;
			} else if (!next && !here) {
				next = ev;
			}
		});

		if (!next) {
			if (changed) {
				saveVars();
			}
			return;
		}

		// Ответ 2А (сессия 14): открытое окно-сообщение успевают прочитать —
		// событие ждёт, пока окно закроют; тревога и поле ввода его не держат.
		if (Dialog.isOpen()) {
			if (changed) {
				saveVars();
			}
			return;
		}

		var mark = marks[next.name];

		delete mark.ready;
		if (!next.repeat) {
			mark.done = 1;
		}
		State.variables.sgEventFrom = current;
		eventBusy = true;
		try {
			Engine.play(next.name);
		} finally {
			eventBusy = false;
		}
	}

	setup.signaly.checkEvents = checkEvents;
	setInterval(checkEvents, 250);
	$(document).on(':passageend', function () {
		setTimeout(checkEvents, 0);
	});
	['click', 'change', 'keyup'].forEach(function (type) {
		document.addEventListener(
			type,
			function () {
				setTimeout(checkEvents, 60);
			},
			true
		);
	});

	/* ----- Стартовый экран ----- */

	// SugarCube ждёт, пока экран загрузки не будет отпущен, — до клика игра не
	// запускается, и звуки первого экрана не теряются.
	var lockId = LoadScreen.lock();

	showStartScreen(function (screen) {
		if (started) {
			return;
		}
		started = true;
		requestFullscreen();
		playStartSound();
		screen.parentNode.removeChild(screen);

		try {
			var copy = autocopyOn ? readCopy() : null;

			if (copy && copy.passage && Story.has(copy.passage)) {
				prepareRestore(copy);
			}
			if (autocopyOn) {
				startAutocopy();
			}
		} catch (e) {
			console.error('СИГНАЛЫ: автокопия', e);
		}

		LoadScreen.unlock(lockId);
	});
})();`;

/** Блок движка целиком, вместе с метками. */
export function signalyEngineBlock() {
	return `${signalyEngineStart}\n${engineBody}\n${signalyEngineEnd}`;
}
