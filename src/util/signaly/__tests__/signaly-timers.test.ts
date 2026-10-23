import {execSync} from 'child_process';
import {readFileSync} from 'fs';
import {findBlocks, newBlock, writeBlock} from '../signaly-screen-blocks';
import {hasTemplateTimer, moveChain, moveTemplateTimers, timerMovedNote} from '../signaly-timers';

describe('блок «Таймер»', () => {
	it('читает и пишет таймер со всеми словами', () => {
		const text =
			'До <<sg-timer "Clocks" hours 1 minutes 2 seconds 3 start running goto "Start" font none color "#00ff00" size 40 format hms hidden>> после';
		const [block] = findBlocks(text);

		expect(block.type).toBe('timer');
		expect(block.values).toEqual({
			name: 'Clocks',
			hours: 1,
			minutes: 2,
			seconds: 3,
			start: 'running',
			goto: 'Start',
			font: 'none',
			color: '#00ff00',
			size: 40,
			format: 'hms',
			hidden: true
		});
		expect(writeBlock(block)).toBe(text.slice(block.from, block.to));
	});

	it('пишет сообщение по окончании и сохраняет непонятые слова', () => {
		const [block] = findBlocks('<<sg-timer "Т" seconds 10 title "Конец" text "Время вышло" странное>>');

		expect(writeBlock(block)).toBe('<<sg-timer "Т" seconds 10 title "Конец" text "Время вышло" странное>>');
	});

	it('новый таймер — 5 минут', () => {
		expect(writeBlock(newBlock('timer'))).toBe('<<sg-timer "Таймер" minutes 5 seconds 0>>');
	});
});

describe('блок «Цепочка видео»', () => {
	const chain =
		'<<sg-chain width 1000 height 1000 goto "Start">>\n' +
		'<<sg-step "media/video/a.mp4" next click loop muted>>\n' +
		'<<sg-step "media/video/b.mp4" next time seconds 2.5>>\n' +
		'<</sg-chain>>';

	it('читает шаги и пишет обратно так же', () => {
		const [block] = findBlocks(`текст ${chain} текст`);

		expect(block.type).toBe('chain');
		expect(block.values).toEqual({width: 1000, height: 1000, goto: 'Start'});
		expect(block.steps).toEqual([
			{values: {src: 'media/video/a.mp4', next: 'click', loop: true, muted: true}, extra: []},
			{values: {src: 'media/video/b.mp4', next: 'time', seconds: 2.5}, extra: []}
		]);
		expect(writeBlock(block)).toBe(chain);
	});

	it('шаги не считаются отдельными блоками', () => {
		expect(findBlocks(chain)).toHaveLength(1);
	});

	it('новая цепочка — два шага', () => {
		expect(newBlock('chain').steps).toHaveLength(2);
	});
});

describe('перенос шаблона', () => {
	// Шаблон build-9 — до переноса таймеров и иллюминатора.
	let template: string | undefined;

	try {
		template = execSync('git show 5a96fb2:signaly/template/27_03_2025.twee', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			maxBuffer: 20e6
		});
	} catch {
		template = undefined;
	}

	const passage = (twee: string, name: string) => {
		const at = twee.search(new RegExp(`^:: ${name.replace(/[[\]]/g, '\\$&')}[ \n]`, 'm'));
		const body = twee.slice(twee.indexOf('\n', at) + 1);

		return body.slice(0, body.search(/\n:: /)).replace(/\s+$/, '');
	};
	const names = ['Clocks', 'Clocktest5', 'Clocktimer', 'StoryInit', 'TERRAFORM_FAIL', 'WINDOWDESSERT', 'WINDOWSSHUTTERS', 'Videotest2', 'Start'];

	(template ? it : it.skip)('таймеры шаблона становятся блоками, код таймера уходит', () => {
		const script = passage(template!, 'StoryScript [script]');
		const passages = names.map(name => ({name, text: passage(template!, name)}));

		expect(hasTemplateTimer(script)).toBe(true);

		const result = moveTemplateTimers(script, passages);
		const text = (name: string) => result.texts.get(names.indexOf(name)) ?? passages[names.indexOf(name)].text;

		expect(hasTemplateTimer(result.script)).toBe(false);
		expect(result.script).toContain(timerMovedNote);
		expect(result.script).not.toContain('setup.timerText');
		expect(text('Clocktest5')).toBe('<<sg-timer "Clocks" minutes 0 seconds 5 goto "Start">>\n\n[[Clocks]]');
		expect(text('Clocks')).toContain('\n\n<<sg-timer "Clocks" start running>>\n');
		expect(text('Clocktimer')).toBe('<<sg-timer "Clocks" start running>>');
		expect(text('StoryInit')).not.toMatch(/\$timer(started|End)/);
		expect(text('TERRAFORM_FAIL')).toContain('<<sg-timer "TERRAFORM_FAIL" seconds 30 goto "TERRAFORM" hidden>>');
		expect(text('TERRAFORM_FAIL')).not.toContain('<<goto "TERRAFORM">>');
		expect(text('Start')).toBe(passages[names.indexOf('Start')].text);

		const [chain] = findBlocks(text('WINDOWDESSERT'));

		expect(chain.type).toBe('chain');
		expect(chain.values.goto).toBe('Start');
		expect(chain.steps!.map(s => s.values.next)).toEqual(['click', 'end', 'click', 'end']);
		expect(chain.steps!.map(s => !!s.values.loop)).toEqual([true, false, true, false]);
		expect(chain.steps!.map(s => !!s.values.muted)).toEqual([true, false, false, false]);
		expect(text('WINDOWDESSERT')).not.toContain('<<script>>');
		expect(text('WINDOWDESSERT')).not.toMatch(/\\$/);
		expect(text('WINDOWSSHUTTERS')).toBe(
			'<div class="center-text">\\\n<<sg-chain width 1000 height 1000 goto "Start">>\n<<sg-step "media/video/SHUTTERS.mp4" next click loop muted>>\n<</sg-chain>>\\\n</div>'
		);
		expect(findBlocks(text('Videotest2'))[0].steps).toHaveLength(4);

		// Повторный перенос ничего не меняет.
		const again = moveTemplateTimers(
			result.script,
			names.map(name => ({name, text: text(name)}))
		);

		expect(again.texts.size).toBe(0);
		expect(again.script).toBe(result.script);
	});

	(template ? it : it.skip)('открытый в редакторе экран таймера — перенос таймера откладывается', () => {
		const script = passage(template!, 'StoryScript [script]');
		const passages = names.map(name => ({name, text: passage(template!, name)}));
		const result = moveTemplateTimers(script, passages, 'Clocks');

		expect(result.script).toBe(script);
		expect(result.texts.has(names.indexOf('Clocks'))).toBe(false);
		expect(result.texts.has(names.indexOf('Clocktest5'))).toBe(false);
		// Иллюминатор и скрытый таймер других экранов переносятся.
		expect(result.texts.has(names.indexOf('WINDOWDESSERT'))).toBe(true);
		expect(result.texts.has(names.indexOf('TERRAFORM_FAIL'))).toBe(true);
	});

	it('шаблон в репозитории уже перенесён', () => {
		const twee = readFileSync('signaly/template/27_03_2025.twee', 'utf8');

		expect(twee).toContain('<<sg-timer "Clocks" minutes 0 seconds 5 goto "Start">>');
		expect(hasTemplateTimer(twee)).toBe(false);
		expect(moveChain(passage(twee, 'WINDOWDESSERT'))).toBeUndefined();
	});

	it('чужой код с видео не трогается', () => {
		const text =
			'<video id="vid1" loop autoplay muted width="1000" height="1000">\n<source src="a.mp4" type="video/mp4">\n</video>\n<<script>>\n$("#vid1").on("click", function () { Engine.play("X"); });\n<</script>>';

		expect(moveChain(text)).toBeUndefined();
	});
});
