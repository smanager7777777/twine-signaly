// «Twine СИГНАЛЫ»: декодер и кодировщик SSTV (сессия 30, радио с декодером).
//
// Своя реализация по описанию режимов SSTV (JL Barber, «Proposal for SSTV Mode Specifications»;
// те же режимы понимает Robot36): заголовок VIS (код режима), затем строки — синхроимпульс 1200 Гц,
// яркость или цвет — частота 1500 (чёрный) … 2300 Гц (белый).
//
// Игра, открытая из папки, звук своих файлов прочитать не может (Chrome отдаёт нули), поэтому
// декодирует программа: при «Сохранить» в окне «Музыка» она раскладывает помехи и передачи в
// картинки (signaly-sstv-images.ts в окнах), а движок в игре набирает картинку строка за строкой
// точно в такт звуку. Кодировщик нужен проверкам (и может пригодиться автору).
//
// Чистые функции, без DOM: работают в программе, в тестах и в Node.

export type SstvChannel = 'Y' | 'Y0' | 'Y1' | 'U' | 'V' | 'C' | 'R' | 'G' | 'B';
export type SstvColor = 'rgb' | 'robot36' | 'yuv' | 'pd';

/** Часть строки: тон (f, Гц) или развёртка канала (ch), длительность — мс. */
export interface SstvSegment {
	ms: number;
	f?: number;
	ch?: SstvChannel;
	/** Синхроимпульс строки — по нему выравниваются строки. */
	sync?: boolean;
	/** Разделитель Robot 36: 1500 Гц — дальше R-Y, 2300 Гц — B-Y. */
	sep?: boolean;
}

export interface SstvMode {
	name: string;
	vis: number;
	width: number;
	/** Строк картинки. */
	height: number;
	/** Строк картинки на одну строку передачи (PD — 2). */
	per: number;
	color: SstvColor;
	/** Перед первой строкой, один раз (Scottie — синхроимпульс). */
	prefix: SstvSegment[];
	/** Одна строка передачи; k — её номер (Robot 36 чередует разделитель). */
	line: (k: number) => SstvSegment[];
}

const sync = (ms: number): SstvSegment => ({ms, f: 1200, sync: true});
const tone = (ms: number, f: number): SstvSegment => ({ms, f});
const scan = (ms: number, ch: SstvChannel): SstvSegment => ({ms, ch});

function martin(name: string, vis: number, s: number): SstvMode {
	return {
		name,
		vis,
		width: 320,
		height: 256,
		per: 1,
		color: 'rgb',
		prefix: [],
		line: () => [sync(4.862), tone(0.572, 1500), scan(s, 'G'), tone(0.572, 1500), scan(s, 'B'), tone(0.572, 1500), scan(s, 'R'), tone(0.572, 1500)]
	};
}

function scottie(name: string, vis: number, s: number): SstvMode {
	return {
		name,
		vis,
		width: 320,
		height: 256,
		per: 1,
		color: 'rgb',
		prefix: [sync(9)],
		line: () => [tone(1.5, 1500), scan(s, 'G'), tone(1.5, 1500), scan(s, 'B'), sync(9), tone(1.5, 1500), scan(s, 'R')]
	};
}

function pd(name: string, vis: number, width: number, height: number, s: number): SstvMode {
	return {
		name,
		vis,
		width,
		height,
		per: 2,
		color: 'pd',
		prefix: [],
		line: () => [sync(20), tone(2.08, 1500), scan(s, 'Y0'), scan(s, 'V'), scan(s, 'U'), scan(s, 'Y1')]
	};
}

export const sstvModes: SstvMode[] = [
	{
		name: 'Robot 36',
		vis: 8,
		width: 320,
		height: 240,
		per: 1,
		color: 'robot36',
		prefix: [],
		line: k => [sync(9), tone(3, 1500), scan(88, 'Y'), {ms: 4.5, f: k % 2 ? 2300 : 1500, sep: true}, tone(1.5, 1900), scan(44, 'C')]
	},
	{
		name: 'Robot 72',
		vis: 12,
		width: 320,
		height: 240,
		per: 1,
		color: 'yuv',
		prefix: [],
		line: () => [sync(9), tone(3, 1500), scan(138, 'Y'), tone(4.5, 1500), tone(1.5, 1900), scan(69, 'V'), tone(4.5, 2300), tone(1.5, 1900), scan(69, 'U')]
	},
	martin('Martin 1', 44, 146.432),
	martin('Martin 2', 40, 73.216),
	scottie('Scottie 1', 60, 138.24),
	scottie('Scottie 2', 56, 88.064),
	scottie('Scottie DX', 76, 345.6),
	pd('PD 50', 93, 320, 256, 91.52),
	pd('PD 90', 99, 320, 256, 170.24),
	pd('PD 120', 95, 640, 496, 121.6),
	pd('PD 160', 98, 512, 400, 195.584),
	pd('PD 180', 96, 640, 496, 183.04),
	pd('PD 240', 97, 640, 496, 244.48),
	pd('PD 290', 94, 800, 616, 228.8)
];

export const sstvMode = (name: string) => sstvModes.find(m => m.name.toLowerCase() === name.trim().toLowerCase());

const lineMs = (mode: SstvMode, k = 0) => mode.line(k).reduce((sum, s) => sum + s.ms, 0);
const prefixMs = (mode: SstvMode) => mode.prefix.reduce((sum, s) => sum + s.ms, 0);

/** Где в строке синхроимпульс, мс от начала строки. */
function syncOffset(mode: SstvMode) {
	let at = 0;

	for (const s of mode.line(0)) {
		if (s.sync) {
			return {at, ms: s.ms};
		}
		at += s.ms;
	}
	return {at: 0, ms: 0};
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/* ----- Кодировщик ----- */

/**
 * Звук SSTV из картинки (RGBA, width × height — как у режима; иначе картинка растягивается).
 * lead — секунд тишины в начале и в конце.
 */
export function encodeSstv(mode: SstvMode, rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, rate: number, lead = 0) {
	const W = mode.width;
	const H = mode.height;
	const pix = (x: number, y: number, c: number) => {
		const sx = Math.min(width - 1, Math.floor((x * width) / W));
		const sy = Math.min(height - 1, Math.floor((y * height) / H));

		return rgba[(sy * width + sx) * 4 + c];
	};
	const yuv = (x: number, y: number) => {
		const r = pix(x, y, 0);
		const g = pix(x, y, 1);
		const b = pix(x, y, 2);

		return [0.299 * r + 0.587 * g + 0.114 * b, 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b];
	};
	// Значение канала ch строки передачи k в точке x (0…W−1).
	const value = (ch: SstvChannel, k: number, x: number) => {
		const row = mode.per === 2 ? k * 2 : k;

		switch (ch) {
			case 'R':
				return pix(x, row, 0);
			case 'G':
				return pix(x, row, 1);
			case 'B':
				return pix(x, row, 2);
			case 'Y':
				return yuv(x, row)[0];
			case 'Y0':
				return yuv(x, row)[0];
			case 'Y1':
				return yuv(x, Math.min(H - 1, row + 1))[0];
			case 'U':
			case 'V': {
				const i = ch === 'U' ? 1 : 2;

				return mode.per === 2 ? (yuv(x, row)[i] + yuv(x, Math.min(H - 1, row + 1))[i]) / 2 : yuv(x, row)[i];
			}
			case 'C': {
				// Robot 36: чётная строка — R-Y пары строк, нечётная — B-Y.
				const top = k - (k % 2);
				const i = k % 2 ? 1 : 2;

				return (yuv(x, top)[i] + yuv(x, Math.min(H - 1, top + 1))[i]) / 2;
			}
		}
	};

	interface Part {
		t0: number;
		t1: number;
		f?: number;
		ch?: SstvChannel;
		k: number;
	}

	const parts: Part[] = [];
	let t = lead;
	const push = (ms: number, f: number | undefined, ch: SstvChannel | undefined, k: number) => {
		parts.push({t0: t, t1: t + ms / 1000, f, ch, k});
		t += ms / 1000;
	};

	// VIS: 1900 300 мс, 1200 10 мс, 1900 300 мс, старт 1200 30 мс, 7 бит (1 — 1100, 0 — 1300) младшим вперёд,
	// бит чётности (чётное число единиц), стоп 1200 30 мс.
	push(300, 1900, undefined, 0);
	push(10, 1200, undefined, 0);
	push(300, 1900, undefined, 0);
	push(30, 1200, undefined, 0);

	let ones = 0;

	for (let i = 0; i < 7; i++) {
		const bit = (mode.vis >> i) & 1;

		ones += bit;
		push(30, bit ? 1100 : 1300, undefined, 0);
	}
	push(30, ones % 2 ? 1100 : 1300, undefined, 0);
	push(30, 1200, undefined, 0);
	for (const s of mode.prefix) {
		push(s.ms, s.f, s.ch, 0);
	}

	const lines = Math.ceil(H / mode.per);

	for (let k = 0; k < lines; k++) {
		for (const s of mode.line(k)) {
			push(s.ms, s.f, s.ch, k);
		}
	}

	const total = Math.ceil((t + lead) * rate);
	const out = new Float32Array(total);
	let phase = 0;
	let p = 0;

	for (let n = 0; n < total; n++) {
		const time = n / rate;

		while (p < parts.length && time >= parts[p].t1) {
			p++;
		}

		let f = 0;

		if (p < parts.length && time >= parts[p].t0) {
			const part = parts[p];

			if (part.f !== undefined) {
				f = part.f;
			} else if (part.ch) {
				const x = Math.min(W - 1, Math.floor(((time - part.t0) / (part.t1 - part.t0)) * W));

				f = 1500 + (clamp255(value(part.ch, part.k, x)) * 800) / 255;
			}
		}
		if (f > 0) {
			phase += (2 * Math.PI * f) / rate;
			if (phase > 2 * Math.PI) {
				phase -= 2 * Math.PI;
			}
			out[n] = 0.7 * Math.sin(phase);
		}
	}
	return out;
}

/* ----- Декодер ----- */

export interface SstvImage {
	mode: string;
	width: number;
	/** Строк картинки, которые удалось разобрать. */
	height: number;
	rgba: Uint8ClampedArray;
	/** Начало первой строки передачи, секунды от начала файла. */
	at: number;
	/** Длина строки передачи, секунды (с поправкой на часы передатчика). */
	line: number;
	/** Строк картинки на строку передачи. */
	per: number;
	/** Строк передачи. */
	rows: number;
}

/** Мгновенная частота, Гц: смешивание с 1900 Гц, фильтр, разность фаз. */
export function sstvFrequency(x: Float32Array, rate: number) {
	const f0 = 1900;
	const taps = Math.max(5, Math.round(rate * 0.0013) | 1);
	const half = (taps - 1) / 2;
	const fc = 1300 / rate;
	const h = new Float64Array(taps);
	let sum = 0;

	for (let i = 0; i < taps; i++) {
		const m = i - half;
		const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
		const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1));

		h[i] = sinc * w;
		sum += h[i];
	}
	for (let i = 0; i < taps; i++) {
		h[i] /= sum;
	}

	const n = x.length;
	const re = new Float32Array(n);
	const im = new Float32Array(n);
	const step = (2 * Math.PI * f0) / rate;
	const cs = Math.cos(step);
	const sn = Math.sin(step);
	let c = 1;
	let s = 0;

	for (let i = 0; i < n; i++) {
		re[i] = x[i] * c;
		im[i] = -x[i] * s;

		const nc = c * cs - s * sn;

		s = s * cs + c * sn;
		c = nc;
		if ((i & 1023) === 0) {
			const r = Math.hypot(c, s);

			c /= r;
			s /= r;
		}
	}

	const fr = new Float32Array(n);
	let pr = 0;
	let pi = 0;

	for (let i = 0; i < n; i++) {
		let a = 0;
		let b = 0;
		const from = Math.max(0, i - half);
		const to = Math.min(n - 1, i + half);

		for (let j = from; j <= to; j++) {
			const k = h[j - i + half];

			a += re[j] * k;
			b += im[j] * k;
		}

		// Разность фаз соседних отсчётов: z[i] · conj(z[i−1]).
		const dr = a * pr + b * pi;
		const di = b * pr - a * pi;

		fr[i] = f0 + (Math.atan2(di, dr) * rate) / (2 * Math.PI);
		pr = a;
		pi = b;
	}
	if (n > 1) {
		fr[0] = fr[1];
	}
	return fr;
}

/** Скользящее среднее (окно — отсчётов) — для поиска заголовка и синхроимпульсов. */
function smooth(f: Float32Array, window: number) {
	const out = new Float32Array(f.length);
	const half = Math.max(1, Math.floor(window / 2));
	const acc = new Float64Array(f.length + 1);

	for (let i = 0; i < f.length; i++) {
		acc[i + 1] = acc[i] + f[i];
	}
	for (let i = 0; i < f.length; i++) {
		const a = Math.max(0, i - half);
		const b = Math.min(f.length, i + half + 1);

		out[i] = (acc[b] - acc[a]) / (b - a);
	}
	return out;
}

function mean(f: Float32Array, from: number, to: number) {
	const a = Math.max(0, Math.floor(from));
	const b = Math.min(f.length, Math.max(a + 1, Math.ceil(to)));
	let sum = 0;

	for (let i = a; i < b; i++) {
		sum += f[i];
	}
	return b > a ? sum / (b - a) : 0;
}

interface Vis {
	mode: SstvMode;
	/** Конец стоп-бита, отсчёт. */
	end: number;
}

/** Заголовок VIS начиная с отсчёта from: стартовый бит после ведущего тона 1900 Гц, 8 бит, стоп. */
function findVis(f: Float32Array, sm: Float32Array, rate: number, from: number): Vis | undefined {
	const ms = rate / 1000;
	const lo = (v: number) => v > 1080 && v < 1320;

	for (let i = Math.max(from, Math.round(160 * ms)); i < f.length - 300 * ms; i++) {
		// Перепад 1900 → 1200 Гц: начало стартового бита.
		if (!(sm[i] < 1550 && sm[i - 1] >= 1550)) {
			continue;
		}

		const lead = mean(sm, i - 150 * ms, i - 12 * ms);

		if (Math.abs(lead - 1900) > 90 || !lo(mean(f, i + 6 * ms, i + 24 * ms))) {
			continue;
		}

		let code = 0;
		let ok = true;

		for (let b = 0; b < 8 && ok; b++) {
			const m = mean(f, i + (30 + 30 * b + 6) * ms, i + (30 + 30 * b + 24) * ms);

			if (m > 1040 && m < 1160) {
				if (b < 7) {
					code |= 1 << b;
				}
			} else if (!(m > 1240 && m < 1360)) {
				ok = false;
			}
		}
		if (!ok || !lo(mean(f, i + 276 * ms, i + 294 * ms))) {
			continue;
		}

		const mode = sstvModes.find(m => m.vis === code);

		if (mode) {
			return {mode, end: i + 300 * ms};
		}
	}
	return undefined;
}

/** Синхроимпульс около отсчёта p (±window): начало отрезка ниже 1350 Гц длиной не меньше половины импульса. */
function findSync(sm: Float32Array, p: number, window: number, length: number) {
	const from = Math.max(1, Math.round(p - window));
	const to = Math.min(sm.length - length, Math.round(p + window));
	let best = -1;

	for (let i = from; i <= to; i++) {
		if (sm[i] < 1350 && sm[i - 1] >= 1350) {
			let low = 0;

			for (let j = i; j < i + length; j++) {
				if (sm[j] < 1400) {
					low++;
				}
			}
			if (low >= length * 0.85 && (best < 0 || Math.abs(i - p) < Math.abs(best - p))) {
				best = i;
			}
		}
	}
	return best;
}

/** Прямая t = a + b·k по точкам (k, t) — без выбросов. */
function fitLine(points: Array<[number, number]>, nominal: [number, number], tolerance: number): [number, number] {
	let [a, b] = nominal;
	let use = points;

	for (let pass = 0; pass < 3; pass++) {
		if (use.length < 6) {
			return nominal;
		}

		let sk = 0;
		let st = 0;
		let skk = 0;
		let skt = 0;

		for (const [k, t] of use) {
			sk += k;
			st += t;
			skk += k * k;
			skt += k * t;
		}

		const n = use.length;
		const d = n * skk - sk * sk;

		if (d === 0) {
			return nominal;
		}
		b = (n * skt - sk * st) / d;
		a = (st - b * sk) / n;
		use = points.filter(([k, t]) => Math.abs(a + b * k - t) <= tolerance);
	}
	// Часы передатчика не уходят больше чем на 2 %: иначе это не та прямая.
	return Math.abs(b / nominal[1] - 1) > 0.02 ? nominal : [a, b];
}

/** Все картинки SSTV в звуке (моно, rate Гц). */
export function decodeSstv(x: Float32Array, rate: number): SstvImage[] {
	const f = sstvFrequency(x, rate);
	const sm = smooth(f, Math.round(rate * 0.0015));
	const out: SstvImage[] = [];
	const ms = rate / 1000;
	let from = 0;

	for (;;) {
		const vis = findVis(f, sm, rate, from);

		if (!vis) {
			break;
		}

		const mode = vis.mode;
		const L = lineMs(mode) * ms;
		const so = syncOffset(mode);
		const lines = Math.ceil(mode.height / mode.per);
		const first = vis.end + prefixMs(mode) * ms + so.at * ms;
		const found: Array<[number, number]> = [];
		let a = first;
		let b = L;
		let misses = 0;
		let last = -1;

		for (let k = 0; k < lines; k++) {
			// Пока строк мало — от последнего найденного импульса (часы передатчика могут спешить).
			const p = found.length && found.length < 6 ? found[found.length - 1][1] + b * (k - found[found.length - 1][0]) : a + b * k;

			if (p - so.at * ms + L > f.length + 2 * ms) {
				break;
			}

			const s = findSync(sm, p, Math.min(L * 0.06, 12 * ms) + (found.length < 6 ? 3 * ms : 0), Math.max(2, Math.round(so.ms * ms * 0.6)));

			if (s >= 0) {
				found.push([k, s]);
				last = k;
				misses = 0;
				if (found.length >= 6) {
					[a, b] = fitLine(found, [first, L], 1.5 * ms);
				}
			} else if (++misses > 12) {
				break;
			}
		}

		[a, b] = fitLine(found, [first, L], 1.5 * ms);

		const rows = found.length >= 6 ? last + 1 : 0;

		if (rows > 0) {
			out.push(decodeLines(mode, f, rate, a - (so.at * b) / lineMs(mode), b, rows));
		}
		from = Math.round(rows > 0 ? a + b * rows : vis.end);
	}
	return out;
}

/** Строки передачи 0…rows−1: начало строки k — a + b·k (отсчёты). */
function decodeLines(mode: SstvMode, f: Float32Array, rate: number, a: number, b: number, rows: number): SstvImage {
	const W = mode.width;
	const H = Math.min(mode.height, rows * mode.per);
	const scale = b / (lineMs(mode) * (rate / 1000));
	const rgba = new Uint8ClampedArray(W * H * 4);
	const level = (v: number) => clamp255(((v - 1500) * 255) / 800);
	const channels: Array<Partial<Record<SstvChannel, Uint8ClampedArray>>> = [];
	const chromaU: boolean[] = [];

	for (let k = 0; k < rows; k++) {
		const segs = mode.line(k);
		const ch: Partial<Record<SstvChannel, Uint8ClampedArray>> = {};
		let t = a + b * k;

		for (const s of segs) {
			const len = s.ms * (rate / 1000) * scale;

			if (s.ch) {
				const values = new Uint8ClampedArray(W);

				for (let x = 0; x < W; x++) {
					values[x] = level(mean(f, t + (x * len) / W, t + ((x + 1) * len) / W));
				}
				// Крайние точки смазаны соседними тонами (фильтр, ±0,65 мс): как у ближайшей чистой.
				const edge = Math.min(Math.floor(W / 8), Math.ceil((0.65 * W) / (s.ms * scale)));

				for (let x = 0; x < edge; x++) {
					values[x] = values[edge];
					values[W - 1 - x] = values[W - 1 - edge];
				}
				ch[s.ch] = values;
			}
			if (s.sep) {
				// Robot 36: по разделителю видно, какая это строка цвета.
				chromaU[k] = mean(f, t + len * 0.2, t + len * 0.8) > 1900;
			}
			t += len;
		}
		channels.push(ch);
	}

	const put = (y: number, x: number, r: number, g: number, bl: number) => {
		const i = (y * W + x) * 4;

		rgba[i] = clamp255(r);
		rgba[i + 1] = clamp255(g);
		rgba[i + 2] = clamp255(bl);
		rgba[i + 3] = 255;
	};
	const fromYuv = (y: number, x: number, Y: number, U: number, V: number) =>
		put(y, x, Y + 1.402 * (V - 128), Y - 0.344136 * (U - 128) - 0.714136 * (V - 128), Y + 1.772 * (U - 128));

	for (let k = 0; k < rows; k++) {
		const ch = channels[k];

		for (let x = 0; x < W; x++) {
			switch (mode.color) {
				case 'rgb':
					put(k, x, ch.R?.[x] ?? 0, ch.G?.[x] ?? 0, ch.B?.[x] ?? 0);
					break;
				case 'yuv':
					fromYuv(k, x, ch.Y?.[x] ?? 0, ch.U?.[x] ?? 128, ch.V?.[x] ?? 128);
					break;
				case 'pd':
					for (const [row, key] of [
						[k * 2, 'Y0'],
						[k * 2 + 1, 'Y1']
					] as Array<[number, SstvChannel]>) {
						if (row < H) {
							fromYuv(row, x, ch[key]?.[x] ?? 0, ch.U?.[x] ?? 128, ch.V?.[x] ?? 128);
						}
					}
					break;
				case 'robot36': {
					// Пара строк: R-Y — у строки с разделителем 1500 Гц, B-Y — у строки с 2300 Гц.
					const top = k - (k % 2);
					const pick = (u: boolean) => {
						for (const j of [top, top + 1]) {
							if (j < rows && chromaU[j] === u) {
								return channels[j].C?.[x];
							}
						}
						return undefined;
					};

					fromYuv(k, x, ch.Y?.[x] ?? 0, pick(true) ?? 128, pick(false) ?? 128);
					break;
				}
			}
		}
	}
	return {mode: mode.name, width: W, height: H, rgba, at: a / rate, line: b / rate, per: mode.per, rows};
}
