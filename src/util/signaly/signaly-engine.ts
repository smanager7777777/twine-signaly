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
export const signalyEngineVersion = 3;

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

	/* ----- Блоки экрана (шаг 1.4) ----- */

	// Команды: <<sg-image>>, <<sg-video>>, <<sg-alarm>>, <<sg-dialog>>,
	// <<sg-code>> (с <<sg-case>> и <<sg-wrong>>), окно KR2. Их вставляет панель
	// «Добавить блок»; в обычном Twine они работают так же.

	var engineStyle = document.createElement('style');

	engineStyle.id = 'sg-engine-style';
	engineStyle.textContent =
		'@keyframes sg-alarm-blink { 50% { filter: brightness(0.45); } }\n' +
		'html[data-sg-dialog="noclose"] #ui-dialog-close { display: none; }\n' +
		'.sg-dialog-ok { margin-top: 1em; text-align: center; }';
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
				: 'calc(50% - ' + halfH + ' + ' + offY + ' + ' + y + ')';
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

	Macro.add('sg-code', {
		tags: ['sg-case', 'sg-wrong'],
		handler: function () {
			var a = blockArgs(this, [], ['var', 'button', 'gap'], ['password', 'focus', 'clear']);
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

			function confirm() {
				var value = input.value;
				var found = null;

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
				if (found) {
					codeAction(found, value);
				} else if (wrong) {
					codeAction(wrong, value);
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
		// Shift+Z+X — мастер закрывает экран тревоги.
		if (zDown && ev.shiftKey && ev.code === 'KeyX') {
			ev.preventDefault();
			setup.signaly.closeAlarm();
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
