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
// Код написан без обратных кавычек и без «${», потому что хранится в шаблонной
// строке.

/** Версия движка. Увеличивать при каждом изменении кода ниже. */
export const signalyEngineVersion = 2;

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
		lineScroll: opt('line-scroll', 0) === 1
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
		});
	}

	/* ----- Новая игра: Shift+Z+N ----- */

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

	var zDown = false;

	document.addEventListener('keydown', function (ev) {
		if (ev.code === 'KeyZ') {
			zDown = true;
		}
		if (zDown && ev.shiftKey && ev.code === 'KeyN') {
			ev.preventDefault();
			askNewGame();
		}
	});
	document.addEventListener('keyup', function (ev) {
		if (ev.code === 'KeyZ') {
			zDown = false;
		}
	});
	window.addEventListener('blur', function () {
		zDown = false;
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
