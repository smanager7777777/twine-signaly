// «Twine СИГНАЛЫ»: камера (шаг 5.3, ответы автора — решение 108). Блок
// <<sg-camera>> разбирает и пишет signaly-screen-blocks.ts, в игре работает
// движок. Здесь — перенос шаблона: экраны CAMERATEST, XIAOMICAM, запуск камеры в
// StoryInit и код камер в «JavaScript истории». Переносится только узнанное
// целиком (как у горячих клавиш и терминала взлома); числа, цвета и надпись
// кнопки могут быть своими. Код истории убирается, только если им больше никто
// не пользуется.

import {cameraDefaults, Values, writeBlock} from './signaly-screen-blocks';

// Метки в образцах: @ — число, % — число со знаком, ~ — цвет, ^ — надпись.
function pattern(sample: string) {
	return new RegExp(
		sample
			.replace(/[.*+?${}()|[\]\\]/g, '\\$&')
			.replace(/@/g, String.raw`(\d+)`)
			.replace(/%/g, String.raw`(-?\d+)`)
			.replace(/~/g, '(#[0-9a-fA-F]{3,8})')
			.replace(/\^/g, '([^"\\n]+)')
	);
}

const webRe = pattern(`<div class="center-text">\\
<video id="webcam" autoplay playsinline muted width="@" height="@" style="border: @px solid ~;">\\</video>\\
</div>\\

<<script>>
$(document).one(':passagedisplay', function () {
    var video = document.getElementById('webcam');
    if (setup.webcamStream) {
        video.srcObject = setup.webcamStream;
    } else {
        // fallback (если вдруг не успело)
        setup.initWebcam().then(function(stream) {
            video.srcObject = stream;
        });
    }
});
<</script>>`);

const windowRe = pattern(`<div style="overflow: hidden; width: @px; height: @px; border: @px solid ~;">\\
<video id="xiaomi" autoplay playsinline muted width="@" height="@" style="margin-top: %px; margin-left: %px;">\\</video>\\
</div>\\

/* СИГНАЛЫ: браузер разрешает захват окна только после нажатия кнопки */\\
<<button "^">>
<<run setup.initXiaomi().then(function (stream) {
    var video = document.getElementById('xiaomi');
    if (video && stream) {
        video.srcObject = stream;
    }
})>>
<</button>>

<<script>>
$(document).one(':passagedisplay', function () {
    var video = document.getElementById('xiaomi');
    if (setup.xiaomiStream) {
        video.srcObject = setup.xiaomiStream;
    }
});
<</script>>`);

const initCode = `/* СИГНАЛЫ: камера включается один раз; захват окна Xiaomi — кнопкой на экране XIAOMICAM */
<<script>>
setup.initWebcam();
<</script>>`;

const scriptCode = `/* ===== Камера и захват окна ===== */
setup.webcamStream = null;

setup.initWebcam = function () {
    if (setup.webcamStream) return Promise.resolve(setup.webcamStream);

    return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(stream) {
            setup.webcamStream = stream;
            return stream;
        })
        .catch(function(err) {
            console.log("Ошибка доступа к камере:", err);
        });
};


setup.xiaomiStream = null;
setup.initXiaomi = function () {
    if (setup.xiaomiStream) return Promise.resolve(setup.xiaomiStream);
    return navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
    })
        .then(function(stream) {
            setup.xiaomiStream = stream;
            // Если захват остановлен — следующее нажатие кнопки запросит его заново
            stream.getVideoTracks().forEach(function (track) {
                track.addEventListener('ended', function () {
                    setup.xiaomiStream = null;
                });
            });
            return stream;
        })
        .catch(function(err) {
            console.log("Ошибка захвата экрана:", err);
        });
};
`;

const scriptNote = '/* СИГНАЛЫ: камера и захват окна перенесены в блок «Камера» (шаг 5.3). */\n';
const usesCode = /setup\.(initWebcam|initXiaomi|webcamStream|xiaomiStream)\b/;

function block(values: Values) {
	return writeBlock({type: 'camera', values, extra: []});
}

/** Экраны CAMERATEST и XIAOMICAM → блоки. Чужой код не трогается. */
export function cameraBlocks(text: string) {
	const plain = text.replace(/\r\n/g, '\n');
	const moved = plain
		.replace(webRe, (_, width, height, border, color) =>
			block({width: Number(width), height: Number(height), place: 'center', border: Number(border), color})
		)
		.replace(windowRe, (_, width, height, border, color, vwidth, vheight, top, left, button) =>
			block({
				source: 'window',
				width: Number(width),
				height: Number(height),
				vwidth: Number(vwidth),
				vheight: Number(vheight),
				shiftx: Number(left) || undefined,
				shifty: Number(top) || undefined,
				button: button === cameraDefaults.button ? undefined : button,
				border: Number(border),
				color
			})
		);

	return moved === plain ? text : moved;
}

export interface CameraPassage {
	name: string;
	text: string;
}

/**
 * Перенос камер шаблона. texts — только изменённые пассажи (ключ — номер в списке).
 * exclude — пассаж, открытый в редакторе: его текст сейчас правит автор.
 */
export function moveTemplateCamera(script: string, passages: CameraPassage[], exclude?: string) {
	const texts = new Map<number, string>();

	passages.forEach((p, index) => {
		const moved = p.name === exclude ? p.text : cameraBlocks(p.text);

		if (moved !== p.text) {
			texts.set(index, moved);
		}
	});

	const code = script.replace(/\r\n/g, '\n');

	if (!code.includes(scriptCode)) {
		return {script, texts};
	}

	const clean = (text: string) => text.replace(/\r\n/g, '\n').replace(`${initCode}\n`, '').replace(initCode, '');
	const used = passages.some((p, index) => usesCode.test(clean(texts.get(index) ?? p.text)));

	if (used) {
		return {script, texts};
	}
	passages.forEach((p, index) => {
		const text = texts.get(index) ?? p.text;

		if (text.replace(/\r\n/g, '\n').includes(initCode)) {
			texts.set(index, clean(text).replace(/\s+$/, ''));
		}
	});
	return {script: code.replace(scriptCode, scriptNote), texts};
}
