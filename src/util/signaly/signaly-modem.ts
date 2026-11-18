// «Twine СИГНАЛЫ»: код звуком (М1) и метка перед картинкой SSTV (Д2) — сессия 34, вкладка «SSTV»
// окна «Приложение». Перенос `src/common/modem.js` из signaly-app (MIT, тот же автор; переносить
// в GPL-движок можно, обратно — нельзя). Формат тот же, что понимает приложение:
// вступление 3700 + 800 Гц (по 150 мс), затем полубайты — 16 тонов 1500…3375 Гц (шаг 125),
// тон 60 мс + тишина 20 мс; данные — длина, байты (UTF-8, до 48), CRC-8.

const F0 = 1500;
const STEP = 125;
const TONE = 0.06;
const GAP = 0.02;
const SYM = TONE + GAP;
const PRE1 = 3700;
const PRE2 = 800;
const PRE = 0.15;

export function crc8(bytes: number[]) {
	let c = 0;

	for (const b of bytes) {
		c ^= b;
		for (let k = 0; k < 8; k++) {
			c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255;
		}
	}
	return c;
}

const utf8 = (s: string) => Array.from(new TextEncoder().encode(String(s)));

/** Текст (код) → звук. */
export function encodeModem(text: string, rate = 44100, volume = 0.8) {
	const data = utf8(text).slice(0, 48);
	const bytes = [data.length, ...data, crc8(data)];
	const nib: number[] = [];

	bytes.forEach(b => nib.push(b >> 4, b & 15));

	const n = Math.ceil((PRE * 2 + nib.length * SYM + 0.1) * rate);
	const out = new Float32Array(n);
	let pos = 0;
	let ph = 0;
	const tone = (f: number, sec: number) => {
		const len = Math.round(sec * rate);
		const ramp = Math.round(0.005 * rate);

		for (let i = 0; i < len; i++) {
			ph += (2 * Math.PI * f) / rate;
			out[pos++] = Math.sin(ph) * volume * Math.min(1, i / ramp, (len - i) / ramp);
		}
	};

	tone(PRE1, PRE);
	tone(PRE2, PRE);
	nib.forEach(v => {
		tone(F0 + STEP * v, TONE);
		pos += Math.round(GAP * rate);
	});
	return out.subarray(0, Math.min(n, pos + Math.round(0.05 * rate)));
}

export const modemSeconds = (text: string) => PRE * 2 + (utf8(text).slice(0, 48).length + 2) * 2 * SYM + 0.05;

function goertzel(buf: Float32Array, len: number, f: number, rate: number) {
	const w = (2 * Math.PI * f) / rate;
	const c = 2 * Math.cos(w);
	let s1 = 0;
	let s2 = 0;

	for (let i = 0; i < len; i++) {
		const s0 = buf[i] + c * s1 - s2;

		s2 = s1;
		s1 = s0;
	}
	return s1 * s1 + s2 * s2 - c * s1 * s2;
}

/** Все коды, записанные в звуке (самопроверка; в приложении — потоковый приём). */
export function decodeModem(x: Float32Array, rate: number): string[] {
	const out: string[] = [];
	const hop = Math.round(rate * 0.01);
	let at = 0;

	while (at + hop <= x.length) {
		// вступление: ≥ 8 окон 3700 Гц, затем ≥ 8 окон 800 Гц
		let st = 0;
		let run = 0;
		let miss = 0;
		let t0 = -1;

		for (; at + hop <= x.length; at += hop) {
			const fr = x.subarray(at, at + hop);
			let en = 0;

			for (let k = 0; k < hop; k++) {
				en += fr[k] * fr[k];
			}

			const loud = en / hop > 1e-6;
			const norm = (en * hop) / 2 + 1e-9;

			if (st === 0) {
				run = loud && goertzel(fr, hop, PRE1, rate) / norm > 0.45 ? run + 1 : 0;
				if (run >= 8) {
					st = 1;
					run = 0;
					miss = 0;
				}
			} else if (loud && goertzel(fr, hop, PRE2, rate) / norm > 0.45) {
				run++;
				miss = 0;
			} else if (run >= 8) {
				t0 = at;
				break;
			} else if (++miss > 20) {
				st = 0;
				run = 0;
			}
		}
		if (t0 < 0) {
			break;
		}

		const nib: number[] = [];
		let need = 0;
		let ok = false;
		const len = Math.round(0.04 * rate);

		for (;;) {
			const start = t0 + Math.round((nib.length * SYM + 0.01) * rate);

			if (start + len > x.length) {
				break;
			}

			const w = x.subarray(start, start + len);
			let best = 0;
			let bp = -1;

			for (let v = 0; v < 16; v++) {
				const pw = goertzel(w, len, F0 + STEP * v, rate);

				if (pw > bp) {
					bp = pw;
					best = v;
				}
			}
			nib.push(best);
			if (nib.length === 2) {
				const ln = nib[0] * 16 + nib[1];

				if (ln < 1 || ln > 48) {
					break;
				}
				need = 2 + ln * 2 + 2;
			}
			if (nib.length >= 2 && nib.length === need) {
				const bytes: number[] = [];

				for (let k = 0; k < nib.length; k += 2) {
					bytes.push(nib[k] * 16 + nib[k + 1]);
				}

				const data = bytes.slice(1, -1);

				if (crc8(data) === bytes[bytes.length - 1]) {
					try {
						const text = new TextDecoder().decode(new Uint8Array(data));

						if (text) {
							out.push(text);
						}
					} catch {
						/* не текст */
					}
				}
				ok = true;
				break;
			}
		}
		at = ok ? t0 + Math.round(nib.length * SYM * rate) : t0 + hop;
	}
	return out;
}
