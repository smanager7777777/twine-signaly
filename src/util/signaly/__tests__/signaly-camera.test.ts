import fs from 'fs';
import path from 'path';
import {cameraBlocks, moveTemplateCamera} from '../signaly-camera';
import {
	cameraDefaults,
	findBlocks,
	newBlock,
	writeBlock
} from '../signaly-screen-blocks';

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/template-camera.txt'), 'utf8');
const part = (name: string) => new RegExp(`^@@${name}\\n([^]*?)(?=\\n?^@@|$(?![^]))`, 'm').exec(fixture)![1];
const web = part('web');
const win = part('window');
const init = `${part('init').replace(/\n?$/, '\n')}`;
const script = `${part('script').replace(/\n?$/, '\n')}`;

describe('блок «Камера»', () => {
	it('читает и пишет слова', () => {
		const text = 'Перед <<sg-camera source "window" width 800 height 400 vwidth 1200 vheight 900 shiftx -5 shifty -270 button "Связь" nosignal "ПОМЕХИ" nocolor "#ff0000" nonoise 50 place screen corner tr x 10 y 20 border 3 color "#00ff00" glow 4>> после';
		const [block] = findBlocks(text);

		expect(block.type).toBe('camera');
		expect(block.values).toMatchObject({
			source: 'window',
			width: 800,
			height: 400,
			vwidth: 1200,
			vheight: 900,
			shiftx: -5,
			shifty: -270,
			button: 'Связь',
			nosignal: 'ПОМЕХИ',
			nocolor: '#ff0000',
			nonoise: 50,
			place: 'screen',
			corner: 'tr',
			x: 10,
			y: 20,
			border: 3,
			color: '#00ff00',
			glow: 4
		});
		expect(text.slice(block.from, block.to)).toBe(writeBlock(block));
	});

	it('заготовка: окно 1000×1000 с рамкой, веб-камера', () => {
		const made = newBlock('camera');

		expect(made.values).toEqual({width: cameraDefaults.width, height: cameraDefaults.height, border: 2});
		expect(writeBlock(made)).toBe('<<sg-camera width 1000 height 1000 border 2>>');
	});
});

describe('перенос камер шаблона', () => {
	it('CAMERATEST и XIAOMICAM становятся блоками', () => {
		expect(cameraBlocks(web)).toBe('<<sg-camera width 1000 height 1000 place center border 2 color "#00cc00">>');
		expect(cameraBlocks(win)).toBe(
			'<<sg-camera source "window" width 1000 height 490 vwidth 1000 vheight 1000 shifty -270 border 2 color "#00cc00">>'
		);
	});

	it('свои числа, цвет, надпись и окружающий текст сохраняются', () => {
		const own = win
			.replace('height: 490px', 'height: 300px')
			.replace('margin-left: 0px', 'margin-left: -40px')
			.replace('"Подключить камеру"', '"Связь с камерой"')
			.replace('#00cc00', '#ff0000');
		const moved = cameraBlocks(`До\n${own}\nПосле`);

		expect(moved).toBe(
			'До\n<<sg-camera source "window" width 1000 height 300 vwidth 1000 vheight 1000 shiftx -40 shifty -270 button "Связь с камерой" border 2 color "#ff0000">>\nПосле'
		);
	});

	it('изменённый код не трогается', () => {
		const own = win.replace('video.srcObject = stream;', 'video.srcObject = stream; alert(1);');

		expect(cameraBlocks(own)).toBe(own);
		expect(cameraBlocks('Обычный текст')).toBe('Обычный текст');
	});

	it('код истории и запуск в StoryInit убираются', () => {
		const moved = moveTemplateCamera(`до\n${script}после`, [
			{name: 'StoryInit', text: `<<set $a to 1>>\n${init}<<set $b to 2>>`},
			{name: 'CAMERATEST', text: web},
			{name: 'XIAOMICAM', text: win}
		]);

		expect(moved.script).toBe('до\n/* СИГНАЛЫ: камера и захват окна перенесены в блок «Камера» (шаг 5.3). */\nпосле');
		expect(moved.texts.get(0)).toBe('<<set $a to 1>>\n<<set $b to 2>>');
		expect([...moved.texts.keys()].sort()).toEqual([0, 1, 2]);
	});

	it('повторный перенос ничего не меняет', () => {
		const first = moveTemplateCamera(script, [{name: 'CAMERATEST', text: web}]);
		const again = moveTemplateCamera(first.script, [{name: 'CAMERATEST', text: first.texts.get(0)!}]);

		expect(again.script).toBe(first.script);
		expect(again.texts.size).toBe(0);
	});

	it('код остаётся, пока им кто-то пользуется', () => {
		const passages = [
			{name: 'StoryInit', text: init},
			{name: 'CAMERATEST', text: web},
			{name: 'Свой экран', text: '<<run setup.initWebcam()>>'}
		];
		const moved = moveTemplateCamera(script, passages);

		expect(moved.script).toBe(script);
		expect(moved.texts.has(0)).toBe(false);
		expect(moved.texts.has(1)).toBe(true);
	});

	it('экран, открытый в редакторе, ждёт следующего раза, код остаётся', () => {
		const moved = moveTemplateCamera(script, [{name: 'CAMERATEST', text: web}], 'CAMERATEST');

		expect(moved.script).toBe(script);
		expect(moved.texts.size).toBe(0);
	});

	it('чужой код истории не трогается, запуск в StoryInit тоже', () => {
		const own = script.replace('video: true', 'video: {width: 640}');
		const moved = moveTemplateCamera(own, [{name: 'StoryInit', text: init}]);

		expect(moved.script).toBe(own);
		expect(moved.texts.size).toBe(0);
	});

	it('шаблон уже перенесён', () => {
		const template = fs.readFileSync(path.join(process.cwd(), 'signaly/template/27_03_2025.twee'), 'utf8');

		expect(template).not.toMatch(/setup\.(initWebcam|initXiaomi)/);
		expect(template).toContain('<<sg-camera width 1000 height 1000 place center');
	});
});
