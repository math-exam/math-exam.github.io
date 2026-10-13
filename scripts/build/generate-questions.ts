// @ts-nocheck
/* =========================================================
   Question-bank generator.
   Produces data/questions/questions.json: ~500 unique, parameterized
   6th-grade (MAP Growth Math style) questions across 5
   domains x 5 difficulty levels, with randomized numbers
   and multiple phrasing "styles" per skill so repeated
   test attempts rarely see the same question twice.

   Run with: npm run generate
   ========================================================= */
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const DOMAINS = {
  NS: {
    name: 'Number System',
    color: '#4F46E5',
    study: 'Practice fraction and decimal operations, factors/multiples, and positive/negative numbers.'
  },
  RP: {
    name: 'Ratios & Rates',
    color: '#0E9488',
    study: 'Work on ratios in simplest form, unit rates, and percent problems.'
  },
  EE: {
    name: 'Expressions & Equations',
    color: '#B45309',
    study: 'Practice order of operations, evaluating expressions, and solving equations.'
  },
  G: {
    name: 'Geometry',
    color: '#9333EA',
    study: 'Review area, volume, and finding points and distances on the coordinate plane.'
  },
  SP: {
    name: 'Statistics',
    color: '#DB2777',
    study: 'Practice mean, median, mode, and range with different data sets.'
  }
};

/* ---------------- helpers ---------------- */
function ri(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[ri(0, arr.length - 1)];
}
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}
function nf(n) {
  return n.toLocaleString('en-US');
}
function money(n) {
  n = Math.round(n * 100) / 100;
  return '$' + (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2));
}
/* Build the 4-option set: correct first, then up to 3 unique wrongs.
   Returns null (caller should retry with new random numbers) if we
   couldn't scrape together 3 distinct wrong strings. */
function opt(correctStr, wrongCandidates) {
  const seen = new Set([correctStr]);
  const out = [];
  for (const w of wrongCandidates) {
    const s = String(w);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  if (out.length < 3) return null;
  return [correctStr, ...out.slice(0, 3)];
}

/* ================= NUMBER SYSTEM (NS) ================= */

function T_NS1a() {
  // add/sub fractions, same denominator
  const d = pick([4, 5, 6, 8, 9, 10, 12]);
  const op = pick(['+', '-']);
  let a, b, result;
  if (op === '+') {
    a = ri(1, d - 2);
    b = ri(1, d - 1 - a);
    result = a + b;
  } else {
    a = ri(2, d - 1);
    b = ri(1, a - 1);
    result = a - b;
  }
  const q = `What is ${a}/${d} ${op} ${b}/${d}?`;
  const correctStr = `${result}/${d}`;
  const wrongs = [`${a + b}/${d + 1}`, op === '+' ? `${Math.abs(a - b)}/${d}` : `${a + b}/${d}`, `${result}/${d + 2}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why =
    op === '+'
      ? `When denominators are the same, add the top numbers and keep the bottom: ${a} + ${b} = ${result}, so ${result}/${d}.`
      : `When denominators are the same, subtract the top numbers and keep the bottom: ${a} − ${b} = ${result}, so ${result}/${d}.`;
  const tip = `${op === '+' ? 'Add' : 'Subtract'} fractions with the same denominator by only ${op === '+' ? 'adding' : 'subtracting'} the numerators — the denominator stays put.`;
  return { dom: 'NS', diff: 1, q, opts, correct: 0, why, tip };
}

function T_NS1b() {
  // compare decimals OR round to nearest ten/hundred
  const style = pick(['compare', 'round']);
  if (style === 'compare') {
    const build = () => {
      const whole = ri(0, 4);
      const places = pick([1, 2]);
      const digits = places === 1 ? ri(1, 9) : ri(1, 99);
      const value = whole + digits / Math.pow(10, places);
      const str = places === 1 ? `${whole}.${digits}` : `${whole}.${String(digits).padStart(2, '0')}`;
      return { value, str };
    };
    let A = build(),
      B = build(),
      tries = 0;
    while (Math.abs(A.value - B.value) < 0.001 && tries < 15) {
      B = build();
      tries++;
    }
    if (Math.abs(A.value - B.value) < 0.001) return null;
    const greater = A.value > B.value ? A : B,
      lesser = A.value > B.value ? B : A;
    const q = `Which number is greater, ${A.str} or ${B.str}?`;
    const wrongs = [lesser.str, 'They are equal', "Can't tell without more information"];
    const opts = opt(greater.str, wrongs);
    if (!opts) return null;
    const why = `Line up the decimal places: ${greater.str} is greater than ${lesser.str}.`;
    const tip = `Give decimals the same number of decimal places before comparing digit by digit.`;
    return { dom: 'NS', diff: 1, q, opts, correct: 0, why, tip };
  } else {
    const base = ri(120, 9899);
    const place = pick([10, 100]);
    const rounded = Math.round(base / place) * place;
    const wrongDown = Math.floor(base / place) * place;
    const wrongUp = Math.ceil(base / place) * place + place;
    const placeWord = place === 10 ? 'ten' : 'hundred';
    const q = `Round ${nf(base)} to the nearest ${placeWord}.`;
    const wrongs = [wrongDown, wrongUp, rounded + place].map(nf);
    const opts = opt(nf(rounded), wrongs);
    if (!opts) return null;
    const why = `Look at the digit just past the ${placeWord}s place. ${nf(base)} rounds to ${nf(rounded)}.`;
    const tip = `0–4 rounds down, 5–9 rounds up — check the digit right after the place you're rounding to.`;
    return { dom: 'NS', diff: 1, q, opts, correct: 0, why, tip };
  }
}

function T_NS2a() {
  // add fractions, unlike denominators (one a multiple of the other)
  const d1 = pick([2, 3, 4, 5, 6, 8]);
  const k = ri(2, 3);
  const d2 = d1 * k;
  if (d2 > 24) return null;
  const a = ri(1, d1 - 1);
  const b = ri(1, d2 - 1);
  const num = a * k + b;
  const g = gcd(num, d2);
  const rn = num / g,
    rd = d2 / g;
  const correctStr = rd === 1 ? `${rn}` : `${rn}/${rd}`;
  const q = `What is ${a}/${d1} + ${b}/${d2}?`;
  const wrongs = [`${num}/${d1 + d2}`, `${a + b}/${d2}`, rd === 1 ? `${rn + 1}` : `${rn + 1}/${rd}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Rewrite ${a}/${d1} as ${a * k}/${d2}. Then ${a * k}/${d2} + ${b}/${d2} = ${num}/${d2}${g > 1 ? ` = ${correctStr}` : ''}.`;
  const tip = `To add fractions with different denominators, rewrite them with a common denominator first.`;
  return { dom: 'NS', diff: 2, q, opts, correct: 0, why, tip };
}

function T_NS2b() {
  // add/sub decimals
  const op = pick(['+', '-']);
  const build = () => {
    const whole = ri(0, 12);
    const cents = ri(1, 99);
    return { v: whole + cents / 100, s: `${whole}.${String(cents).padStart(2, '0')}` };
  };
  let A = build(),
    B = build();
  if (op === '-' && A.v < B.v) {
    [A, B] = [B, A];
  }
  const result = Math.round((op === '+' ? A.v + B.v : A.v - B.v) * 100) / 100;
  const q = `What is ${A.s} ${op} ${B.s}?`;
  const correctStr = result.toFixed(2);
  const wrongs = [(op === '+' ? A.v - B.v : A.v + B.v).toFixed(2), (result + 1).toFixed(2), (result / 10).toFixed(2)];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Line up the decimal points, then ${op === '+' ? 'add' : 'subtract'} column by column: ${A.s} ${op} ${B.s} = ${correctStr}.`;
  const tip = `Stack decimals so the points line up before you add or subtract.`;
  return { dom: 'NS', diff: 2, q, opts, correct: 0, why, tip };
}

function T_NS3a() {
  // multiply two decimals (one decimal place each)
  const ta = ri(11, 49),
    tb = ri(2, 9);
  const product = (ta * tb) / 100;
  const A = (ta / 10).toFixed(1),
    B = (tb / 10).toFixed(1);
  const correctStr = Number.isInteger(product) ? `${product}` : product.toFixed(2).replace(/0$/, '');
  const q = `What is ${A} × ${B}?`;
  const wrongs = [`${ta * tb}`, (product / 10).toFixed(3), (product + 1).toFixed(2)];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Multiply as whole numbers first: ${ta} × ${tb} = ${ta * tb}. Then place the decimal point: two decimal places total, so ${A} × ${B} = ${correctStr}.`;
  const tip = `Multiply ignoring the decimal points, then count total decimal places in both factors to place the point.`;
  return { dom: 'NS', diff: 3, q, opts, correct: 0, why, tip };
}

function T_NS3b() {
  // GCF or LCM
  const style = pick(['gcf', 'lcm']);
  const a = ri(4, 30),
    b = ri(4, 30);
  if (a === b) return null;
  if (style === 'gcf') {
    const g = gcd(a, b);
    const q = `What is the greatest common factor (GCF) of ${a} and ${b}?`;
    const wrongs = [a * b, g === 1 ? 2 : 1, Math.min(a, b)];
    const opts = opt(`${g}`, wrongs);
    if (!opts) return null;
    const why = `List the factors of ${a} and ${b} — the largest one they share is ${g}.`;
    const tip = `The GCF is the largest number that divides evenly into both numbers.`;
    return { dom: 'NS', diff: 3, q, opts, correct: 0, why, tip };
  } else {
    const l = (a * b) / gcd(a, b);
    if (l > 400) return null;
    const q = `What is the least common multiple (LCM) of ${a} and ${b}?`;
    const wrongs = [a * b, Math.max(a, b), l + Math.min(a, b)];
    const opts = opt(`${l}`, wrongs);
    if (!opts) return null;
    const why = `List multiples of ${a} and ${b} until one matches — the smallest shared multiple is ${l}.`;
    const tip = `The LCM is the smallest number both values divide into evenly.`;
    return { dom: 'NS', diff: 3, q, opts, correct: 0, why, tip };
  }
}

function T_NS2c() {
  // long division of larger whole numbers
  const divisor = ri(12, 89);
  const quotient = ri(100, 2000);
  const dividend = divisor * quotient;
  if (dividend > 99999) return null;
  const q = `What is the value of ${nf(dividend)} ÷ ${divisor}?`;
  const wrongs = [`${nf(quotient * 10)}`, `${nf(quotient + divisor)}`, `${nf(Math.floor(dividend / (divisor + 1)))}`];
  const opts = opt(nf(quotient), wrongs);
  if (!opts) return null;
  const why = `${nf(dividend)} ÷ ${divisor} = ${nf(quotient)}, since ${divisor} × ${nf(quotient)} = ${nf(dividend)}.`;
  const tip = `Check long division by multiplying the quotient by the divisor — it should give back the original dividend.`;
  return { dom: 'NS', diff: 2, q, opts, correct: 0, why, tip };
}

const NUMLINE_LETTERS = ['A', 'B', 'C', 'D'];
function T_NS2d() {
  // identify which labeled point on a number line matches an absolute value
  const target = ri(1, 6) * pick([1, -1]);
  const targetAbs = Math.abs(target);
  const points = new Set([targetAbs]);
  while (points.size < 4) points.add(ri(-6, 6));
  const sorted = [...points].sort((a, b) => a - b);
  const idx = sorted.indexOf(targetAbs);
  const labeled = sorted.map((v, i) => `${NUMLINE_LETTERS[i]} at ${v}`).join(', ');
  const q = `Points ${NUMLINE_LETTERS.slice(0, sorted.length).join(', ')} are plotted on a number line: ${labeled}. Which point represents the value of |${target}|?`;
  const correctStr = `point ${NUMLINE_LETTERS[idx]}`;
  const wrongs = NUMLINE_LETTERS.slice(0, sorted.length)
    .filter((_, i) => i !== idx)
    .map(l => `point ${l}`);
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `|${target}| means the distance from ${target} to 0, which is ${targetAbs}. Point ${NUMLINE_LETTERS[idx]} is at ${targetAbs}.`;
  const tip = `Absolute value is always the distance from zero, so it's never negative — find which labeled point sits at that positive value.`;
  return { dom: 'NS', diff: 2, q, opts, correct: 0, why, tip };
}

function T_NS4a() {
  // integer add/sub with negatives
  const op = pick(['+', '-']);
  let a = ri(-20, 20),
    b = ri(-20, 20);
  if (a === 0) a = ri(1, 20);
  if (b === 0) b = ri(1, 20);
  if (a > 0 && b > 0) b = -b; // guarantee at least one negative involved
  const result = op === '+' ? a + b : a - b;
  const fmt = n => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
  const cleanQ = `What is ${fmt(a)} ${op === '+' ? (b < 0 ? `+ (${fmt(b)})` : `+ ${fmt(b)}`) : `− ${fmt(b)}`}?`;
  const wrongs = [fmt(-result), fmt(result + 2), fmt(a), fmt(b)];
  const opts = opt(fmt(result), wrongs);
  if (!opts) return null;
  const why = `Think of a number line starting at ${fmt(a)}. ${op === '+' ? `Adding ${fmt(b)} moves ${b >= 0 ? 'right' : 'left'}` : `Subtracting ${fmt(b)} moves ${b >= 0 ? 'left' : 'right'}`}, landing on ${fmt(result)}.`;
  const tip = `On a number line, adding a positive moves right and adding a negative moves left; subtracting flips that direction.`;
  return { dom: 'NS', diff: 4, q: cleanQ, opts, correct: 0, why, tip };
}

function T_NS4c() {
  // number-line reasoning: position of a negative mixed number vs its whole number
  const whole = ri(2, 15);
  const [fn, fd] = pick([
    ['1', '2'],
    ['1', '4'],
    ['3', '4']
  ]);
  const mixedStr = `−${whole} ${fn}/${fd}`;
  const wholeStr = `−${whole}`;
  const correctStr = `The number ${mixedStr} would be positioned to the left of ${wholeStr} on a horizontal number line because ${mixedStr} < ${wholeStr}.`;
  const wrongs = [
    `The number ${mixedStr} would be positioned to the left of ${wholeStr} on a horizontal number line because ${mixedStr} > ${wholeStr}.`,
    `The number ${mixedStr} would be positioned to the right of ${wholeStr} on a horizontal number line because ${mixedStr} < ${wholeStr}.`,
    `The number ${mixedStr} would be positioned to the right of ${wholeStr} on a horizontal number line because ${mixedStr} > ${wholeStr}.`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `${mixedStr} is farther from zero than ${wholeStr} in the negative direction, so it's actually the smaller (more negative) value: ${mixedStr} < ${wholeStr}. On a number line, smaller values sit to the left.`;
  const tip = `For negative numbers, "more negative" means farther left on the number line, even though the digits look bigger.`;
  return {
    dom: 'NS',
    diff: 4,
    q: `Describe how the numbers ${mixedStr} and ${wholeStr} would be positioned relative to each other on a horizontal number line.`,
    opts,
    correct: 0,
    why,
    tip
  };
}

function T_NS4b() {
  // fraction ÷ whole number
  const b = pick([3, 4, 5, 6, 8]);
  const a = ri(1, b - 1);
  const n = ri(2, 6);
  const num = a,
    den = b * n;
  const g = gcd(num, den);
  const rn = num / g,
    rd = den / g;
  const correctStr = `${rn}/${rd}`;
  const q = `What is ${a}/${b} ÷ ${n}?`;
  const wrongs = [`${a * n}/${b}`, `${a}/${b + n}`, `${rn}/${rd + 2}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Dividing by ${n} is the same as multiplying by 1/${n}: ${a}/${b} × 1/${n} = ${num}/${den}${g > 1 ? ` = ${correctStr}` : ''}.`;
  const tip = `Dividing a fraction by a whole number: multiply by 1 over that number.`;
  return { dom: 'NS', diff: 4, q, opts, correct: 0, why, tip };
}

function T_NS5a() {
  // integer multiply/divide, signs vary
  const style = pick(['mult', 'div']);
  if (style === 'mult') {
    let a = ri(2, 12) * pick([1, -1]);
    let b = ri(2, 12) * pick([1, -1]);
    const result = a * b;
    const fmt = n => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
    const q = `What is ${fmt(a)} × ${fmt(b)}?`;
    const wrongs = [fmt(-result), fmt(a + b), fmt(Math.abs(a) + Math.abs(b)), fmt(result + a)];
    const opts = opt(fmt(result), wrongs);
    if (!opts) return null;
    const sameSign = a < 0 === b < 0;
    const why = `${sameSign ? 'Same signs multiply to a positive' : 'Different signs multiply to a negative'}: ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(result)}, so the answer is ${fmt(result)}.`;
    const tip = `Same signs multiply to a positive; different signs multiply to a negative.`;
    return { dom: 'NS', diff: 5, q, opts, correct: 0, why, tip };
  } else {
    const bAbs = ri(2, 12);
    const qAbs = ri(2, 10);
    const aAbs = bAbs * qAbs;
    const a = aAbs * pick([1, -1]);
    const b = bAbs * pick([1, -1]);
    const result = a / b;
    const fmt = n => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
    const q = `What is ${fmt(a)} ÷ ${fmt(b)}?`;
    const wrongs = [fmt(-result), fmt(result + 1), fmt(aAbs)];
    const opts = opt(fmt(result), wrongs);
    if (!opts) return null;
    const sameSign = a < 0 === b < 0;
    const why = `${sameSign ? 'Same signs divide to a positive' : 'Different signs divide to a negative'}: ${aAbs} ÷ ${bAbs} = ${qAbs}, so the answer is ${fmt(result)}.`;
    const tip = `Divide the same way you would with positive numbers, then apply the sign rule: same signs → positive, different signs → negative.`;
    return { dom: 'NS', diff: 5, q, opts, correct: 0, why, tip };
  }
}

function T_NS5b() {
  // fraction ÷ fraction OR absolute value sum
  const style = pick(['fracdiv', 'abs']);
  if (style === 'fracdiv') {
    const d1 = pick([3, 4, 5, 6]),
      d2 = pick([3, 4, 5, 6, 7, 8]);
    const a = ri(1, d1 - 1),
      b = ri(1, d2 - 1);
    const num = a * d2,
      den = d1 * b;
    const g = gcd(num, den);
    const rn = num / g,
      rd = den / g;
    const correctStr = rd === 1 ? `${rn}` : `${rn}/${rd}`;
    const q = `What is (${a}/${d1}) ÷ (${b}/${d2})?`;
    const wrongs = [`${a * b}/${d1 * d2}`, `${a}/${d1}`, rd === 1 ? `${rn + 1}` : `${rn + 1}/${rd}`];
    const opts = opt(correctStr, wrongs);
    if (!opts) return null;
    const why = `Multiply by the reciprocal: ${a}/${d1} × ${d2}/${b} = ${num}/${den}${g > 1 ? ` = ${correctStr}` : ''}.`;
    const tip = `Keep the first fraction, flip the second, then multiply — and simplify the result.`;
    return { dom: 'NS', diff: 5, q, opts, correct: 0, why, tip };
  } else {
    const a = ri(-15, -1),
      b = ri(-12, 12) || 1;
    const result = Math.abs(a) + Math.abs(b);
    const q = `What is |${a}| + |${b}|?`;
    const wrongs = [`${a + b}`, `${-result}`, `${result - 2}`];
    const opts = opt(`${result}`, wrongs);
    if (!opts) return null;
    const why = `Absolute value is distance from zero: |${a}| = ${Math.abs(a)} and |${b}| = ${Math.abs(b)}, so ${Math.abs(a)} + ${Math.abs(b)} = ${result}.`;
    const tip = `Absolute value is always non-negative — find each absolute value first, then do the operation.`;
    return { dom: 'NS', diff: 5, q, opts, correct: 0, why, tip };
  }
}

function T_NS5c() {
  // multi-step fraction rate: find the unit rate, then scale it by a count
  const q_ = pick([2, 3, 4, 5]),
    p = ri(1, q_ - 1); // p/q_ of a cycle
  const t2 = pick([2, 3, 4, 5, 6]),
    t1 = ri(1, t2 - 1); // t1/t2 of an hour
  const uNum = t1 * q_,
    uDen = t2 * p; // unit rate = (t1/t2) ÷ (p/q_) hours per cycle
  const ug = gcd(uNum, uDen);
  const urn = uNum / ug,
    urd = uDen / ug;
  const n = ri(2, 8);
  const totNum = urn * n,
    totDen = urd;
  const tg = gcd(totNum, totDen);
  const fn = totNum / tg,
    fd = totDen / tg;
  if (fd > 10) return null;
  const whole = Math.floor(fn / fd),
    rem = fn - whole * fd;
  const correctStr = fd === 1 ? `${fn}` : whole > 0 ? `${whole} ${rem}/${fd}` : `${fn}/${fd}`;
  const unitStr = urd === 1 ? `${urn}` : `${urn}/${urd}`;
  const q = `A machine completes ${p}/${q_} of a print cycle every ${t1}/${t2} of an hour. At this constant rate, how many hours will it take to complete ${n} full cycles?`;
  const wrongs = [unitStr, `${n}/${urd === 1 ? urn : urd}`, fd === 1 ? `${fn + n}` : `${fn + fd}/${fd}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `First find the unit rate: (${t1}/${t2}) ÷ (${p}/${q_}) = (${t1}/${t2}) × (${q_}/${p}) = ${unitStr} hours per cycle. Then multiply by ${n} cycles: ${unitStr} × ${n} = ${correctStr}.`;
  const tip = `For multi-step rate problems, first find the unit rate (divide), then scale it by however many you need (multiply).`;
  return { dom: 'NS', diff: 5, q, opts, correct: 0, why, tip };
}

/* ================= RATIOS & RATES (RP) ================= */

const RP_ITEMS = [
  ['red marbles', 'blue marbles', 'a jar'],
  ['apples', 'oranges', 'a basket'],
  ['dogs', 'cats', 'the shelter'],
  ['pencils', 'erasers', 'a pencil box'],
  ['boys', 'girls', 'the chess club'],
  ['stickers', 'stamps', 'a collection'],
  ['blue shirts', 'red shirts', 'a closet']
];
function T_RP1a() {
  // ratio from counts, in a given order
  const [x, y, place] = pick(RP_ITEMS);
  const a = ri(2, 12),
    b = ri(2, 12);
  if (a === b) return null;
  const askFirst = pick([true, false]);
  const q = `In ${place} there are ${a} ${x} and ${b} ${y}. What is the ratio of ${askFirst ? x : y} to ${askFirst ? y : x}?`;
  const correctStr = askFirst ? `${a} : ${b}` : `${b} : ${a}`;
  const wrongs = [askFirst ? `${b} : ${a}` : `${a} : ${b}`, `${a} : ${a + b}`, `${a + b} : ${askFirst ? b : a}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `A ratio of "${askFirst ? x : y} to ${askFirst ? y : x}" lists that group first: ${correctStr}.`;
  const tip = `Write ratios in the order the words are given — the first word named comes first.`;
  return { dom: 'RP', diff: 1, q, opts, correct: 0, why, tip };
}

function T_RP1b() {
  // total + one part -> ratio of part to remainder
  const [x, y, place] = pick(RP_ITEMS);
  const total = ri(10, 30);
  const partX = ri(3, total - 3);
  const partY = total - partX;
  const q = `${place[0].toUpperCase() + place.slice(1)} has ${total} ${x.split(' ').slice(-1)[0] === y.split(' ').slice(-1)[0] ? 'items' : x + ' and ' + y} in all. ${partX} are ${x}. What is the ratio of ${x} to ${y}?`;
  const correctStr = `${partX} : ${partY}`;
  const wrongs = [`${partY} : ${partX}`, `${partX} : ${total}`, `${total} : ${partX}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `If ${total} total are ${x} or ${y}, and ${partX} are ${x}, then ${total} − ${partX} = ${partY} are ${y}. So the ratio is ${partX} : ${partY}.`;
  const tip = `When you're only given a total and one part, subtract to find the other part before writing the ratio.`;
  return { dom: 'RP', diff: 1, q, opts, correct: 0, why, tip };
}

function T_RP2a() {
  // simplify a ratio
  const g = ri(2, 6);
  const rn = ri(1, 9),
    rd = ri(1, 9);
  if (rn === rd || gcd(rn, rd) !== 1) return null;
  const a = rn * g,
    b = rd * g;
  const q = `What is the ratio ${a} : ${b} written in simplest form?`;
  const correctStr = `${rn} : ${rd}`;
  const wrongs = [`${a} : ${b}`, `${rn + 1} : ${rd}`, `${rd} : ${rn}`];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Divide both parts of ${a} : ${b} by their greatest common factor, ${g}, to get ${rn} : ${rd}.`;
  const tip = `Simplify a ratio the same way you simplify a fraction — divide both sides by a common factor.`;
  return { dom: 'RP', diff: 2, q, opts, correct: 0, why, tip };
}

const RP_UNIT_ITEMS = ['pencils', 'markers', 'notebooks', 'granola bars', 'stickers', 'oranges'];
function T_RP2b() {
  // unit price
  const count = ri(2, 8);
  const unit = pick([25, 50, 75, 100, 125, 150, 200]) / 100;
  const total = Math.round(count * unit * 100) / 100;
  const item = pick(RP_UNIT_ITEMS);
  const q = `${count} ${item} cost ${money(total)}. How much does 1 ${item.replace(/s$/, '')} cost?`;
  const correctStr = money(unit);
  const wrongs = [money(total * count), money(unit + 1), money(total / (count + 1))];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `Divide the total by the number of items: ${money(total)} ÷ ${count} = ${money(unit)}.`;
  const tip = `To find the cost of one item (the unit rate), divide the total cost by the number of items.`;
  return { dom: 'RP', diff: 2, q, opts, correct: 0, why, tip };
}

function T_RP3a() {
  // percent of a number
  const pct = pick([5, 10, 15, 20, 25, 50, 75]);
  const n = pick([20, 40, 60, 80, 100, 120, 160, 200]);
  const result = (pct / 100) * n;
  if (!Number.isInteger(result)) return null;
  const q = `What is ${pct}% of ${n}?`;
  const wrongs = [`${result * 2}`, `${n - result}`, `${result + pct}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `Turn the percent into a decimal and multiply: ${pct}% × ${n} = ${pct / 100} × ${n} = ${result}.`;
  const tip = `Turn the percent into a fraction or decimal first, then multiply by the number.`;
  return { dom: 'RP', diff: 3, q, opts, correct: 0, why, tip };
}

const RP_SPEED_CTX = [
  ['car', 'miles', 'mph'],
  ['cyclist', 'miles', 'mph'],
  ['train', 'kilometers', 'km/h'],
  ['runner', 'miles', 'mph']
];
function T_RP3b() {
  // speed rate
  const [subj, unit, rateUnit] = pick(RP_SPEED_CTX);
  const time = ri(2, 6);
  const speed = ri(20, 70);
  const dist = time * speed;
  const q = `A ${subj} travels ${dist} ${unit} in ${time} hours. What is its speed in ${rateUnit}?`;
  const wrongs = [`${dist * time}`, `${dist + time}`, `${speed + time}`];
  const opts = opt(`${speed}`, wrongs);
  if (!opts) return null;
  const why = `Speed = distance ÷ time = ${dist} ÷ ${time} = ${speed} ${rateUnit}.`;
  const tip = `A unit rate is the amount per 1 unit — divide the total distance by the total time.`;
  return { dom: 'RP', diff: 3, q, opts, correct: 0, why, tip };
}

function T_RP4a() {
  // discount price
  const pct = pick([10, 15, 20, 25, 30, 40, 50]);
  const price = pick([20, 30, 40, 50, 60, 80, 100, 120]);
  const off = (pct / 100) * price;
  if (!Number.isInteger(off)) return null;
  const sale = price - off;
  const q = `A shirt costs $${price} and is ${pct}% off. What is the sale price?`;
  const wrongs = [money(off), money(price + off), money(price - off / 2)];
  const opts = opt(money(sale), wrongs);
  if (!opts) return null;
  const why = `${pct}% of $${price} is $${off} off, so $${price} − $${off} = ${money(sale)}.`;
  const tip = `Find the discount amount first, then subtract it from the original price.`;
  return { dom: 'RP', diff: 4, q, opts, correct: 0, why, tip };
}

function T_RP4b() {
  // scale conversion or part-to-part scaling
  const style = pick(['scale', 'partscale']);
  if (style === 'scale') {
    const rate = pick([10, 20, 25, 50, 75, 100]);
    const inches = pick([2, 2.5, 3, 3.5, 4, 4.5, 5]);
    const miles = rate * inches;
    const q = `A map scale is 1 inch = ${rate} miles. How many miles is ${inches} inches?`;
    const wrongs = [`${miles + rate}`, `${rate / inches}`, `${miles + inches}`];
    const opts = opt(`${miles}`, wrongs);
    if (!opts) return null;
    const why = `Multiply: ${inches} × ${rate} = ${miles} miles.`;
    const tip = `With a map scale, multiply the measured distance by the miles-per-inch rate.`;
    return { dom: 'RP', diff: 4, q, opts, correct: 0, why, tip };
  } else {
    const [x, y] = pick([
      ['boys', 'girls'],
      ['red beads', 'blue beads'],
      ['cats', 'dogs'],
      ['apples', 'pears']
    ]);
    const rn = ri(2, 5),
      rd = ri(2, 5);
    if (rn === rd) return null;
    const scale = ri(2, 6);
    const xCount = rn * scale,
      yCount = rd * scale;
    const q = `The ratio of ${x} to ${y} is ${rn} : ${rd}. If there are ${xCount} ${x}, how many ${y} are there?`;
    const wrongs = [`${xCount + rd}`, `${yCount + scale}`, `${xCount}`];
    const opts = opt(`${yCount}`, wrongs);
    if (!opts) return null;
    const why = `${rn} scales up to ${xCount} by multiplying by ${scale}, so ${y} = ${rd} × ${scale} = ${yCount}.`;
    const tip = `Find the scale factor from the known part, then apply that same factor to the other part.`;
    return { dom: 'RP', diff: 4, q, opts, correct: 0, why, tip };
  }
}

function T_RP4c() {
  // percent of an unknown whole: "n is p% of what number?"
  const pct = pick([4, 5, 8, 10, 12, 15, 20, 24, 25, 40, 50, 60, 75, 80]);
  const whole = pick([15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 250]);
  const part = (pct / 100) * whole;
  if (!Number.isInteger(part) || part < 1) return null;
  const q = `${part} is ${pct}% of what number?`;
  const wrongs = [`${part * pct}`, `${Math.round(part * (pct / 100))}`, `${whole + pct}`];
  const opts = opt(`${whole}`, wrongs);
  if (!opts) return null;
  const why = `${part} = ${pct}% × (the number). Divide by the percent written as a decimal: ${part} ÷ ${pct / 100} = ${whole}.`;
  const tip = `To find the whole when you know a part and its percent, divide the part by the percent written as a decimal.`;
  return { dom: 'RP', diff: 4, q, opts, correct: 0, why, tip };
}

function T_RP4d() {
  // decimal scale proportion, solved by cross-multiplication
  const inches1 = pick([1.5, 2, 2.5, 3, 4]);
  const feet1 = pick([4, 6, 8, 9, 10, 12, 16, 20]);
  const inches2 = pick([2.25, 3.75, 4.25, 5.25, 6.5, 7.75, 8.25, 9.5]);
  const feet2 = (feet1 * inches2) / inches1;
  const rounded = Math.round(feet2 * 10) / 10;
  if (Math.abs(feet2 - rounded) > 0.001) return null;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const q = `A blueprint uses a scale where ${inches1} inches represents ${feet1} feet of the actual building. If a wall measures ${inches2} inches on the blueprint, what is its actual length, in feet?`;
  const wrongs = [fmtNum((inches1 * inches2) / feet1), fmtNum(feet1 * inches2), fmtNum(rounded + inches1)];
  const opts = opt(fmtNum(rounded), wrongs);
  if (!opts) return null;
  const why = `Set up a proportion: ${inches1} in / ${feet1} ft = ${inches2} in / x ft. Cross-multiply: ${inches1} × x = ${feet1} × ${inches2}, so x = (${feet1} × ${inches2}) ÷ ${inches1} = ${fmtNum(rounded)} ft.`;
  const tip = `Set up equal ratios and cross-multiply — it works the same way whether the numbers are whole or decimal.`;
  return { dom: 'RP', diff: 4, q, opts, correct: 0, why, tip };
}

function T_RP3c() {
  // interpret a non-whole-number division quotient in a real-world context
  const perItem = pick([2, 4, 5, 10, 20]);
  const itemsMade = ri(4, 15);
  const leftover = ri(1, perItem - 1);
  const total = perItem * itemsMade + leftover;
  const decQuotient = total / perItem;
  const item = pick(['ribbon', 'rope', 'wire', 'fabric']);
  const unit = pick(['feet', 'yards', 'meters']);
  const use = pick(['bows', 'flags', 'bracelets', 'banners']);
  const useSingular = use.replace(/s$/, '');
  const q = `A worker has ${total} ${unit} of ${item} to make ${use}. Each ${useSingular} uses ${perItem} ${unit}. The worker divides ${total} by ${perItem} and gets ${decQuotient} as an answer. What does the worker's answer mean in this context?`;
  const correctStr = `The worker can make ${itemsMade} ${use} and have ${leftover} ${unit} of ${item} left.`;
  const wrongs = [
    `The worker can make ${itemsMade} ${use} and have ${perItem - leftover} ${unit} of ${item} left.`,
    `The worker can make ${leftover} ${use} and have ${itemsMade} ${unit} of ${item} left.`,
    `The worker can make ${Math.ceil(decQuotient)} ${use} and have ${leftover} ${unit} of ${item} left.`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `${total} ÷ ${perItem} = ${itemsMade} with ${leftover} left over, since ${perItem} × ${itemsMade} = ${perItem * itemsMade} and ${total} − ${perItem * itemsMade} = ${leftover}. The whole-number part counts complete ${use}, and the remainder is what's left over.`;
  const tip = `When a division answer isn't a whole number, the whole-number part counts complete groups, and the leftover amount is what remains — it isn't another group.`;
  return { dom: 'RP', diff: 3, q, opts, correct: 0, why, tip };
}

function T_RP5a() {
  // reverse percent
  const pct = pick([10, 20, 25, 30, 40, 50]);
  const original = pick([40, 60, 80, 100, 120, 150, 200]);
  const remain = (100 - pct) / 100;
  const sale = original * remain;
  if (!Number.isInteger(sale)) return null;
  const q = `A jacket costs $${sale} after a ${pct}% discount. What was the original price?`;
  const wrongs = [money(original + pct), money(sale + sale * (pct / 100)), money(original - pct)];
  const opts = opt(money(original), wrongs);
  if (!opts) return null;
  const why = `$${sale} is ${100 - pct}% of the original. Original = ${sale} ÷ ${remain} = ${money(original)}.`;
  const tip = `After an X% discount you pay (100 − X)% — divide the sale price by that decimal to work backwards.`;
  return { dom: 'RP', diff: 5, q, opts, correct: 0, why, tip };
}

function T_RP5b() {
  // two-step rate
  const machines = ri(2, 8);
  const perHour = ri(2, 10);
  const hours = ri(2, 5);
  const parts = machines * perHour * hours;
  const q = `${machines} machines make ${parts} parts in ${hours} hours. How many parts does 1 machine make in 1 hour?`;
  const wrongs = [`${parts / machines}`, `${parts / hours}`, `${perHour + 1}`];
  const opts = opt(`${perHour}`, wrongs);
  if (!opts) return null;
  const why = `${parts} ÷ ${machines} = ${parts / machines} parts per machine in ${hours} hours, then ÷ ${hours} = ${perHour} parts per hour.`;
  const tip = `Break multi-step rate problems into steps: first find the per-machine amount, then the per-hour amount.`;
  return { dom: 'RP', diff: 5, q, opts, correct: 0, why, tip };
}

/* ================= EXPRESSIONS & EQUATIONS (EE) ================= */

function T_EE1a() {
  // order of operations, basic
  const a = ri(1, 12),
    b = ri(1, 9),
    c = ri(2, 9);
  const op = pick(['+', '-']);
  const product = b * c;
  const result = op === '+' ? a + product : a - product;
  const q = `What is the value of ${a} ${op} ${b} × ${c}?`;
  const wrongOp = op === '+' ? (a + b) * c : (a - b) * c;
  const wrongs = [`${wrongOp}`, `${op === '+' ? a + b + c : a - b - c}`, `${result + b}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `Multiply before you ${op === '+' ? 'add' : 'subtract'}: ${b} × ${c} = ${product}, then ${a} ${op} ${product} = ${result}.`;
  const tip = `Order of operations: do multiplication and division before addition and subtraction.`;
  return { dom: 'EE', diff: 1, q, opts, correct: 0, why, tip };
}

const EE_PHRASES = [
  {
    tpl: (n, k) => `a number n increased by ${k}`,
    correct: (n, k) => `n + ${k}`,
    wrongs: (n, k) => [`n − ${k}`, `${k}n`, `${k} − n`]
  },
  {
    tpl: (n, k) => `a number n decreased by ${k}`,
    correct: (n, k) => `n − ${k}`,
    wrongs: (n, k) => [`n + ${k}`, `${k} − n`, `${k}n`]
  },
  {
    tpl: (n, k) => `${k} more than a number n`,
    correct: (n, k) => `n + ${k}`,
    wrongs: (n, k) => [`n − ${k}`, `${k} − n`, `${k}n`]
  },
  {
    tpl: (n, k) => `the product of a number n and ${k}`,
    correct: (n, k) => `${k}n`,
    wrongs: (n, k) => [`n + ${k}`, `n − ${k}`, `n ÷ ${k}`]
  },
  {
    tpl: (n, k) => `a number n divided by ${k}`,
    correct: (n, k) => `n ÷ ${k}`,
    wrongs: (n, k) => [`${k} ÷ n`, `${k}n`, `n − ${k}`]
  }
];
function T_EE1b() {
  // translate phrase to expression
  const k = ri(2, 15);
  const p = pick(EE_PHRASES);
  const q = `Which expression represents '${p.tpl('n', k)}'?`;
  const opts = opt(p.correct('n', k), p.wrongs('n', k));
  if (!opts) return null;
  const why = `Match the wording to an operation: '${p.tpl('n', k)}' means ${p.correct('n', k)}.`;
  const tip = `Watch clue words: 'increased by'/'more than' = add, 'decreased by' = subtract, 'product' = multiply, 'divided by' = divide.`;
  return { dom: 'EE', diff: 1, q, opts, correct: 0, why, tip };
}

function T_EE2a() {
  // evaluate kx at x=n
  const k = ri(2, 9),
    n = ri(2, 12);
  const result = k * n;
  const q = `Evaluate ${k}x when x = ${n}.`;
  const wrongs = [`${k + n}`, `${k * n + k}`, `${n * n}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `${k}x means ${k} × x. With x = ${n}: ${k} × ${n} = ${result}.`;
  const tip = `A number written next to a letter means multiply.`;
  return { dom: 'EE', diff: 2, q, opts, correct: 0, why, tip };
}

function T_EE2b() {
  // exponent evaluation
  const base = ri(2, 12);
  const exp = pick([2, 3]);
  const result = Math.pow(base, exp);
  const q = `What is the value of ${base}${exp === 2 ? '²' : '³'}?`;
  const wrongs = [`${base * exp}`, `${result + base}`, `${base * (exp - 1)}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `${base}${exp === 2 ? '²' : '³'} means ${Array(exp).fill(base).join(' × ')} = ${result}.`;
  const tip = `An exponent tells you how many times to multiply the base by itself — it's not the base times the exponent.`;
  return { dom: 'EE', diff: 2, q, opts, correct: 0, why, tip };
}

function T_EE2c() {
  // find the missing value in a linear input/output table
  const m = ri(2, 5),
    b = ri(-5, 10);
  const start = ri(1, 10),
    d = ri(2, 5);
  const inputs = [start, start + d, start + 2 * d, start + 3 * d];
  const outputs = inputs.map(x => m * x + b);
  const hideIdx = ri(1, 2);
  const missing = outputs[hideIdx];
  const shown = outputs.map((o, i) => (i === hideIdx ? '?' : o));
  const q = `What is the missing value in the table?\n\nInput: ${inputs.join(', ')}\nOutput: ${shown.join(', ')}`;
  const wrongs = [`${missing + d}`, `${missing - d}`, `${missing + m}`];
  const opts = opt(`${missing}`, wrongs);
  if (!opts) return null;
  const signWord = b >= 0 ? '+' : '−';
  const why = `Each output follows the rule y = ${m}x ${signWord} ${Math.abs(b)}. For input ${inputs[hideIdx]}: ${m} × ${inputs[hideIdx]} ${signWord} ${Math.abs(b)} = ${missing}.`;
  const tip = `Find the pattern relating each input to its output (multiply, then add or subtract), then apply it to the missing input.`;
  return { dom: 'EE', diff: 2, q, opts, correct: 0, why, tip };
}

function T_EE3a() {
  // evaluate ax+b at x=n
  const a = ri(2, 9),
    b = ri(1, 20),
    n = ri(1, 10);
  const result = a * n + b;
  const q = `Evaluate ${a}x + ${b} when x = ${n}.`;
  const wrongs = [`${a * (n + b)}`, `${a * n - b}`, `${a + n + b}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `${a} × ${n} = ${a * n}, then ${a * n} + ${b} = ${result}.`;
  const tip = `Substitute the value in for x, multiply first, then add.`;
  return { dom: 'EE', diff: 3, q, opts, correct: 0, why, tip };
}

function T_EE3b() {
  // solve one-step equation
  const op = pick(['+', '−']);
  const x = ri(2, 30),
    a = ri(2, 20);
  const b = op === '+' ? x + a : x - a;
  const q = `Solve for x: x ${op} ${a} = ${b}.`;
  const wrongs = [`${op === '+' ? b + a : b + a}`, `${a}`, `${x + 2}`];
  const opts = opt(`${x}`, wrongs);
  if (!opts) return null;
  const why =
    op === '+'
      ? `Subtract ${a} from both sides: x = ${b} − ${a} = ${x}.`
      : `Add ${a} to both sides: x = ${b} + ${a} = ${x}.`;
  const tip = `To solve an equation, do the opposite operation to both sides.`;
  return { dom: 'EE', diff: 3, q, opts, correct: 0, why, tip };
}

function T_EE4c() {
  // translate a bound ("does not exceed" / "exceeds") into a ray description
  const n = ri(5, 40);
  const style = pick(['atMost', 'moreThan']);
  const phrase = style === 'atMost' ? `do not exceed ${n}` : `exceed ${n}`;
  const dir = style === 'atMost' ? 'left' : 'right';
  const wrongDir = style === 'atMost' ? 'right' : 'left';
  const incl = style === 'atMost';
  const inclWord = incl ? '' : 'not ';
  const wrongInclWord = incl ? 'not ' : '';
  const correctStr = `The graph will be a ray that starts at ${n} and points to the ${dir}. The graph will ${inclWord}include the endpoint of the ray.`;
  const wrongs = [
    `The graph will be a ray that starts at ${n} and points to the ${wrongDir}. The graph will ${inclWord}include the endpoint of the ray.`,
    `The graph will be a ray that starts at ${n} and points to the ${dir}. The graph will ${wrongInclWord}include the endpoint of the ray.`,
    `The graph will be a ray that starts at ${n + 1} and points to the ${dir}. The graph will ${inclWord}include the endpoint of the ray.`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const q = `All of the numbers that ${phrase} will be graphed on a number line. Which statement best describes the graph of the numbers?`;
  const why = incl
    ? `"Do not exceed ${n}" means x ≤ ${n}, so the ray starts at ${n} (included, since ${n} itself qualifies) and points left toward smaller numbers.`
    : `"Exceed ${n}" means x > ${n}, so the ray starts at ${n} (not included, since ${n} itself doesn't qualify) and points right toward larger numbers.`;
  const tip = `"At most / does not exceed" means ≤ (closed endpoint, ray points left). "More than / exceeds" means > (open endpoint, ray points right).`;
  return { dom: 'EE', diff: 4, q, opts, correct: 0, why, tip };
}

function T_EE4d() {
  // critique a GCF-factoring attempt: numeric sum or algebraic monomial style
  const style = pick(['numeric', 'algebraic']);
  if (style === 'numeric') {
    const g = pick([4, 6, 8, 9, 10, 12]);
    const a = ri(2, 9),
      b = ri(2, 9);
    if (a === b || gcd(a, b) !== 1) return null;
    const x = a * g,
      y = b * g;
    const divs = [];
    for (let i = 2; i < g; i++) if (g % i === 0) divs.push(i);
    const wrongG = pick(divs);
    const wrongA = x / wrongG,
      wrongB = y / wrongG;
    const q = `A student is rewriting ${x} + ${y} as g × (m + n), using the greatest common factor g of ${x} and ${y}. The student wrote the answer as ${wrongG}(${wrongA} + ${wrongB}). Which statement best explains whether the student's answer is correct?`;
    const correctStr = `The student's answer is incorrect because the greatest common factor of ${x} and ${y} is ${g}, so the correct expression is ${g}(${a} + ${b}).`;
    const wrongs = [
      `The student's answer is correct because ${wrongG}(${wrongA} + ${wrongB}) equals ${x} + ${y}.`,
      `The student's answer is incorrect because the greatest common factor of ${x} and ${y} is ${x}, so the correct expression is ${x}(1 + ${Math.round(y / x)}).`,
      `The student's answer is incorrect because the greatest common factor of ${x} and ${y} is ${g * 2}, so the correct expression is ${g * 2}(${Math.round(x / (g * 2))} + ${Math.round(y / (g * 2))}).`
    ];
    const opts = opt(correctStr, wrongs);
    if (!opts) return null;
    const why = `The greatest common factor of ${x} and ${y} is ${g} (not ${wrongG}, which is a common factor but not the greatest one), so ${x} + ${y} = ${g}(${a} + ${b}).`;
    const tip = `Check that you used the GREATEST common factor, not just any common factor — and that the numbers left inside the parentheses have no common factor of their own.`;
    return { dom: 'EE', diff: 4, q, opts, correct: 0, why, tip };
  } else {
    const h = pick([6, 8, 10, 12]);
    const divs = [];
    for (let i = 2; i < h; i++) if (h % i === 0) divs.push(i);
    if (divs.length < 2) return null;
    const [wrongH1, wrongH2] = [divs[0], divs[1]];
    const p = ri(2, 9),
      qn = ri(2, 9);
    if (p === qn || gcd(p, qn) !== 1) return null;
    const coefX = p * h,
      constC = qn * h;
    const wrongP1 = coefX / wrongH1,
      wrongC1 = constC / wrongH1;
    const wrongP2 = coefX / wrongH2,
      wrongC2 = constC / wrongH2;
    const q = `The expression ${coefX}x + ${constC} is equivalent to the expression a(bx + c), where b and c are constants with no common factors. A student wrote the answer as ${wrongH1}(${wrongP1}x + ${wrongC1}). Which statement best explains whether the student's answer is correct?`;
    const correctStr = `The student's answer is incorrect because the greatest common factor of ${coefX}x and ${constC} is ${h}, so the correct expression is ${h}(${p}x + ${qn}).`;
    const wrongs = [
      `The student's answer is correct because ${wrongH1}(${wrongP1}x + ${wrongC1}) is equivalent to ${coefX}x + ${constC}.`,
      `The student's answer is incorrect because the greatest common factor of ${coefX}x and ${constC} is ${wrongH2}, so the correct expression is ${wrongH2}(${wrongP2}x + ${wrongC2}).`,
      `The student's answer is incorrect because the greatest common factor of ${coefX}x and ${constC} is ${coefX}, so the correct expression is ${coefX}(x + ${constC}).`
    ];
    const opts = opt(correctStr, wrongs);
    if (!opts) return null;
    const why = `The greatest common factor of ${coefX}x and ${constC} is ${h}, giving b = ${p} and c = ${qn} with no common factor left between them: ${h}(${p}x + ${qn}).`;
    const tip = `Check that you used the GREATEST common factor, not just any common factor — and that b and c left inside the parentheses share no common factor of their own.`;
    return { dom: 'EE', diff: 4, q, opts, correct: 0, why, tip };
  }
}

function T_EE4a() {
  // order of ops with exponent
  const a = ri(1, 15),
    b = ri(1, 9),
    n = pick([2, 3]);
  const nsq = Math.pow(n, 2 === n ? 2 : 2); // placeholder unused
  const powVal = Math.pow(n, 2);
  const result = a + b * powVal;
  const q = `What is the value of ${a} + ${b} × ${n}²?`;
  const wrongs = [`${(a + b) * powVal}`, `${a + b * n}`, `${a + b + powVal}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `Exponent first: ${n}² = ${powVal}. Then ${b} × ${powVal} = ${b * powVal}. Then ${a} + ${b * powVal} = ${result}.`;
  const tip = `Order of operations: exponents come before multiplication, which comes before addition.`;
  return { dom: 'EE', diff: 4, q, opts, correct: 0, why, tip };
}

function T_EE4b() {
  // solve one-step multiplicative equation
  const a = ri(2, 12),
    x = ri(2, 15);
  const b = a * x;
  const q = `Solve for x: ${a}x = ${b}.`;
  const wrongs = [`${b * a}`, `${b + a}`, `${x + 2}`];
  const opts = opt(`${x}`, wrongs);
  if (!opts) return null;
  const why = `Divide both sides by ${a}: x = ${b} ÷ ${a} = ${x}.`;
  const tip = `To undo multiplication, divide both sides by the same number.`;
  return { dom: 'EE', diff: 4, q, opts, correct: 0, why, tip };
}

function T_EE5a() {
  // solve two-step equation
  const a = ri(2, 9),
    x = ri(2, 15),
    b = ri(1, 20);
  const c = a * x + b;
  const q = `Solve for x: ${a}x + ${b} = ${c}.`;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const wrongs = [fmtNum(x + 1), fmtNum(c / a), fmtNum((c + b) / a)];
  const opts = opt(`${x}`, wrongs);
  if (!opts) return null;
  const why = `Subtract ${b}: ${a}x = ${c - b}. Divide by ${a}: x = ${x}.`;
  const tip = `Undo addition or subtraction first, then undo multiplication — reverse order of operations.`;
  return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
}

function T_EE5b() {
  // evaluate x^2 - kx OR a(x+b)-c
  const style = pick(['quad', 'distrib']);
  if (style === 'quad') {
    const n = ri(3, 12),
      k = ri(1, 9);
    const result = n * n - k * n;
    const q = `Evaluate x² − ${k}x when x = ${n}.`;
    const wrongs = [`${n * n - k}`, `${(n - k) * (n - k)}`, `${n * n + k * n}`];
    const opts = opt(`${result}`, wrongs);
    if (!opts) return null;
    const why = `${n}² = ${n * n} and ${k} × ${n} = ${k * n}, so ${n * n} − ${k * n} = ${result}.`;
    const tip = `Handle the exponent before the multiplication, then subtract.`;
    return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
  } else {
    const a = ri(2, 8),
      x = ri(1, 9),
      b = ri(1, 10),
      c = ri(1, 15);
    const result = a * (x + b) - c;
    const q = `What is the value of ${a}(x + ${b}) − ${c} when x = ${x}?`;
    const wrongs = [`${a * x + b - c}`, `${a * (x + b) + c}`, `${a * x + b}`];
    const opts = opt(`${result}`, wrongs);
    if (!opts) return null;
    const why = `First x + ${b} = ${x + b}. Then ${a} × ${x + b} = ${a * (x + b)}. Then subtract ${c}: ${result}.`;
    const tip = `Work inside the parentheses first, then multiply, then handle addition or subtraction.`;
    return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
  }
}

function T_EE5c() {
  // evaluate a two-variable linear model with a distributive term
  const a = pick([1.25, 1.5, 1.75, 2, 2.25, 2.5]);
  const b = ri(15, 40);
  const c = ri(10, 60);
  const m = ri(20, 150);
  const d = ri(2, 7);
  const result = a * m + b * (d - 1) + c;
  const q = `The total cost C (in dollars) of renting a moving truck is C = ${a}m + ${b}(d − 1) + ${c}, where m is the number of miles driven and d is the number of rental days. What is C when m = ${m} and d = ${d}?`;
  const w1 = a * m + b * d + c; // forgot the −1
  const w2 = a * m + b * (d - 1); // dropped the constant
  const w3 = a * m * d + c; // multiplied m by d by mistake
  const wrongs = [w1, w2, w3].map(money);
  const opts = opt(money(result), wrongs);
  if (!opts) return null;
  const why = `Substitute m = ${m} and d = ${d}: ${a} × ${m} = ${money(a * m)}, and ${b} × (${d} − 1) = ${b} × ${d - 1} = ${money(b * (d - 1))}. Add all three parts: ${money(a * m)} + ${money(b * (d - 1))} + ${money(c)} = ${money(result)}.`;
  const tip = `Plug in the given values first, then follow order of operations: parentheses, then multiplication, then addition.`;
  return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
}

function T_EE5d() {
  // multi-step linear inequality that may require flipping the sign
  const A = ri(2, 6),
    k = ri(1, 3),
    p = ri(2, 9);
  const qcoef = ri(1, 6);
  const B = ri(1, 5),
    r = ri(1, 9),
    s = ri(1, 15);
  const C = qcoef - A * k - B; // coefficient of x after combining like terms
  if (C === 0) return null;
  const rhsConst = -B * r - s - A * p;
  let num = rhsConst,
    den = C;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(Math.abs(num), den);
  const rn = num / g,
    rd = den / g;
  if (rd > 8) return null; // keep the boundary value's fraction readable
  const flip = C < 0;
  const fmtFrac = n => (rd === 1 ? `${n}` : `${n}/${rd}`);
  const boundStr = fmtFrac(rn);
  const correctStr = `x ${flip ? '>' : '<'} ${boundStr}`;
  const q = `Solve for x: −${A}(${k}x − ${p}) + ${qcoef}x < ${B}(x − ${r}) − ${s}`;
  const wrongSym = flip ? '<' : '>'; // forgot to flip the inequality
  const wrongs = [
    `x ${wrongSym} ${boundStr}`,
    `x ${flip ? '>' : '<'} ${fmtFrac(-rn)}`,
    `x ${flip ? '>' : '<'} ${fmtFrac(rn + 2 * rd)}`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = flip
    ? `Distribute and combine like terms to get ${C}x < ${rhsConst}. Since ${C} is negative, dividing both sides flips the inequality: ${correctStr}.`
    : `Distribute and combine like terms to get ${C}x < ${rhsConst}. Since ${C} is positive, dividing both sides keeps the inequality direction: ${correctStr}.`;
  const tip = `Distribute and combine like terms first. If you ever multiply or divide both sides by a negative number, flip the inequality sign.`;
  return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
}

function T_EE5f() {
  // nested fraction-bar expression combining exponents and order of operations
  const a = ri(2, 9),
    b = ri(2, 9),
    c = ri(2, 9),
    d = pick([1, 2]);
  const numerator = a * a + b * c - Math.pow(d, 3);
  const supMap = { 2: '²', 3: '³', 4: '⁴' };
  // work backward: try every (e,f) base so some divisor of numerator lands g in a sensible range
  const bases = [
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 2],
    [3, 3],
    [3, 4]
  ];
  const divisors = [];
  for (let i = 2; i <= numerator; i++) if (numerator % i === 0) divisors.push(i);
  const candidates = [];
  for (const [e, f] of bases) {
    const p = Math.pow(e, f);
    for (const div of divisors) {
      const g = p - div;
      if (g >= 1 && g <= 12) candidates.push({ e, f, g, denominator: div });
    }
  }
  if (!candidates.length) return null;
  const { e, f, g, denominator } = pick(candidates);
  const result = numerator / denominator;
  const q = `What is the value of the following expression? (${a}² + ${b} · ${c} − ${d}³) ÷ (${e}${supMap[f]} − ${g})`;
  const wrongs = [`${result + 1}`, `${numerator}`, `${Math.round(numerator / (denominator + 2))}`];
  const opts = opt(`${result}`, wrongs);
  if (!opts) return null;
  const why = `Numerator: ${a}² + ${b} · ${c} − ${d}³ = ${a * a} + ${b * c} − ${Math.pow(d, 3)} = ${numerator}. Denominator: ${e}${supMap[f]} − ${g} = ${Math.pow(e, f)} − ${g} = ${denominator}. So the expression equals ${numerator} ÷ ${denominator} = ${result}.`;
  const tip = `Simplify the numerator and denominator separately first (exponents, then multiplication, then addition/subtraction), then divide.`;
  return { dom: 'EE', diff: 5, q, opts, correct: 0, why, tip };
}

/* ================= GEOMETRY (G) ================= */

function T_G1a() {
  // perimeter of square/rectangle
  const shape = pick(['square', 'rectangle']);
  if (shape === 'square') {
    const s = ri(2, 25);
    const p = s * 4;
    const q = `What is the perimeter of a square with side length ${s}?`;
    const wrongs = [`${s * s}`, `${s * 2}`, `${p + s}`];
    const opts = opt(`${p}`, wrongs);
    if (!opts) return null;
    const why = `A square has 4 equal sides: ${s} + ${s} + ${s} + ${s} = ${p}.`;
    const tip = `Perimeter is the distance all the way around a shape — add every side.`;
    return { dom: 'G', diff: 1, q, opts, correct: 0, why, tip, tag: 'perimeter' };
  } else {
    const l = ri(3, 25),
      w = ri(2, l - 1);
    const p = 2 * (l + w);
    const q = `What is the perimeter of a rectangle with length ${l} and width ${w}?`;
    const wrongs = [`${l * w}`, `${l + w}`, `${p + w}`];
    const opts = opt(`${p}`, wrongs);
    if (!opts) return null;
    const why = `Add all four sides: ${l} + ${w} + ${l} + ${w} = ${p}.`;
    const tip = `A rectangle's perimeter is 2 × (length + width).`;
    return { dom: 'G', diff: 1, q, opts, correct: 0, why, tip, tag: 'perimeter' };
  }
}

const POLYGONS = [
  ['triangle', 3],
  ['quadrilateral', 4],
  ['pentagon', 5],
  ['hexagon', 6],
  ['heptagon', 7],
  ['octagon', 8],
  ['nonagon', 9],
  ['decagon', 10]
];
const POLY_PHRASINGS = [
  n => `How many sides does a ${n} have?`,
  n => `A ${n} has how many sides?`,
  n => `Which number of sides matches a ${n}?`
];
function T_G1b() {
  // polygon sides
  const [name, sides] = pick(POLYGONS);
  const phr = pick(POLY_PHRASINGS);
  const q = phr(name);
  const wrongs = [sides + 1, sides - 1, sides + 2].filter(v => v > 2).map(String);
  const opts = opt(`${sides}`, wrongs);
  if (!opts) return null;
  const why = `A ${name} has ${sides} sides.`;
  const tip = `Learn the prefixes: penta = 5, hexa = 6, hepta = 7, octa = 8, nona = 9, deca = 10.`;
  return { dom: 'G', diff: 1, q, opts, correct: 0, why, tip, tag: 'polygon' };
}

function T_G2a() {
  // area of rectangle
  const l = ri(2, 20),
    w = ri(2, 20);
  const a = l * w;
  const q = `What is the area of a rectangle with length ${l} and width ${w}?`;
  const wrongs = [`${2 * (l + w)}`, `${l + w}`, `${a + w}`];
  const opts = opt(`${a}`, wrongs);
  if (!opts) return null;
  const why = `Area of a rectangle = length × width = ${l} × ${w} = ${a}.`;
  const tip = `Area of a rectangle is length times width; perimeter is the sum of the sides.`;
  return { dom: 'G', diff: 2, q, opts, correct: 0, why, tip, tag: 'area' };
}

const ANGLE_FACTS = [
  {
    q: 'How many degrees are in a right angle?',
    a: '90°',
    wrongs: ['180°', '45°', '360°'],
    why: `A right angle — the square corner — measures 90°.`
  },
  {
    q: 'How many degrees are in a straight angle?',
    a: '180°',
    wrongs: ['90°', '360°', '270°'],
    why: `A straight angle forms a straight line, measuring 180°.`
  },
  {
    q: 'How many degrees are in a full turn?',
    a: '360°',
    wrongs: ['180°', '90°', '270°'],
    why: `A full turn all the way around measures 360°.`
  },
  {
    q: 'Two angles on a straight line add up to how many degrees?',
    a: '180°',
    wrongs: ['90°', '360°', '120°'],
    why: `Angles on a straight line are supplementary — they add up to 180°.`
  },
  {
    q: 'The three interior angles of any triangle add up to how many degrees?',
    a: '180°',
    wrongs: ['360°', '90°', '270°'],
    why: `The angles inside any triangle always sum to 180°.`
  }
];
function T_G2b() {
  // angle facts
  const f = pick(ANGLE_FACTS);
  const opts = opt(f.a, f.wrongs);
  if (!opts) return null;
  const tip = `Right angle = 90°, straight line = 180°, full turn = 360°, triangle angles sum to 180°.`;
  return { dom: 'G', diff: 2, q: f.q, opts, correct: 0, why: f.why, tip, tag: 'angles' };
}

const PARA_PHRASINGS = (base, height) => [
  `What is the area of a parallelogram with base ${base} and height ${height}?`,
  `A parallelogram has a base of ${base} and a height of ${height}. What is its area?`,
  `Find the area of a parallelogram: base = ${base}, height = ${height}.`
];
function T_G2c() {
  // area of parallelogram (base x height)
  const base = ri(3, 20),
    height = ri(2, 18);
  const area = base * height;
  const q = pick(PARA_PHRASINGS(base, height));
  const wrongs = [`${2 * (base + height)}`, `${base + height}`, `${area + base}`];
  const opts = opt(`${area}`, wrongs);
  if (!opts) return null;
  const why = `Area of a parallelogram = base × height = ${base} × ${height} = ${area}.`;
  const tip = `A parallelogram's area formula is the same as a rectangle's — base × height — no ½ needed.`;
  return { dom: 'G', diff: 2, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G3a() {
  // area of triangle
  const base = ri(2, 20),
    height = pick([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  const area = (base * height) / 2;
  if (!Number.isInteger(area)) return null;
  const q = `What is the area of a triangle with base ${base} and height ${height}?`;
  const wrongs = [`${base * height}`, `${base + height}`, `${area + base}`];
  const opts = opt(`${area}`, wrongs);
  if (!opts) return null;
  const why = `Area of a triangle = ½ × base × height = ½ × ${base} × ${height} = ${area}.`;
  const tip = `Don't forget the ½ in the triangle area formula.`;
  return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G3b() {
  // volume of rect prism OR quadrant id
  const style = pick(['volume', 'quadrant']);
  if (style === 'volume') {
    const l = ri(2, 10),
      w = ri(2, 10),
      h = ri(2, 10);
    const v = l * w * h;
    const q = `What is the volume of a box that is ${l} by ${w} by ${h}?`;
    const wrongs = [`${l + w + h}`, `${l * w + h}`, `${v + l}`];
    const opts = opt(`${v}`, wrongs);
    if (!opts) return null;
    const why = `Volume of a rectangular prism = length × width × height = ${l} × ${w} × ${h} = ${v}.`;
    const tip = `Volume multiplies all three dimensions together.`;
    return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'volume' };
  } else {
    const x = ri(1, 12) * pick([1, -1]);
    const y = ri(1, 12) * pick([1, -1]);
    const quad = x > 0 && y > 0 ? 'I' : x < 0 && y > 0 ? 'II' : x < 0 && y < 0 ? 'III' : 'IV';
    const all = ['I', 'II', 'III', 'IV'];
    const wrongs = all.filter(v => v !== quad).map(v => `Quadrant ${v}`);
    const q = `In which quadrant is the point (${x}, ${y})?`;
    const opts = opt(`Quadrant ${quad}`, wrongs);
    if (!opts) return null;
    const why = `${x < 0 ? 'Negative x moves left' : 'Positive x moves right'} and ${y < 0 ? 'negative y moves down' : 'positive y moves up'} — that's Quadrant ${quad}.`;
    const tip = `Quadrants go counter-clockwise from the upper right: I (+,+), II (−,+), III (−,−), IV (+,−).`;
    return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'coordinate' };
  }
}

const PARA_CONTEXTS = ['garden', 'patio', 'rug', 'banner', 'floor tile', 'solar panel', 'parking space', 'flower bed'];
function T_G3c() {
  // parallelogram area with an irrelevant slant-side distractor
  const base = ri(4, 24),
    height = ri(3, 18);
  const slant = height + ri(1, 6);
  const area = base * height;
  const ctx = pick(PARA_CONTEXTS);
  const q = `A ${ctx} shaped like a parallelogram has a base of ${base} ft, a slanted side of ${slant} ft, and a height of ${height} ft. What is its area, in square feet?`;
  const wrongs = [`${base * slant}`, `${slant * height}`, `${base + height + slant}`];
  const opts = opt(`${area}`, wrongs);
  if (!opts) return null;
  const why = `Area only uses the base and the perpendicular height: ${base} × ${height} = ${area}. The slanted side (${slant} ft) isn't needed.`;
  const tip = `For a parallelogram, area = base × height, where height is the straight up-and-down distance — not the slanted side length.`;
  return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G3d() {
  // area of a trapezoid
  const b1 = ri(3, 16),
    b2 = ri(3, 16);
  const height = pick([2, 4, 6, 8, 10, 12, 14]);
  const sum = b1 + b2;
  const area = (sum * height) / 2;
  if (!Number.isInteger(area)) return null;
  const q = `A trapezoid has parallel sides of ${b1} and ${b2}, and a height of ${height}. What is its area?`;
  const wrongs = [`${sum * height}`, `${b1 * height}`, `${b1 + b2 + height}`];
  const opts = opt(`${area}`, wrongs);
  if (!opts) return null;
  const why = `Area of a trapezoid = ½ × (base₁ + base₂) × height = ½ × (${b1} + ${b2}) × ${height} = ½ × ${sum} × ${height} = ${area}.`;
  const tip = `Add the two parallel sides first, multiply by the height, then take half — don't forget the ½.`;
  return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G3e() {
  // area of a right triangle formed by a rectangle's diagonal
  const l = ri(4, 20),
    w = ri(3, 16);
  const area = (l * w) / 2;
  if (!Number.isInteger(area)) return null;
  const q = `A rectangle is ${l} m by ${w} m. A diagonal line cuts it into two matching right triangles. What is the area of one triangle, in square meters?`;
  const wrongs = [`${l * w}`, `${l + w}`, `${area + w}`];
  const opts = opt(`${area}`, wrongs);
  if (!opts) return null;
  const why = `A rectangle's diagonal always splits it into two equal-area triangles, so one triangle's area is (${l} × ${w}) ÷ 2 = ${l * w} ÷ 2 = ${area} m².`;
  const tip = `A diagonal cuts a rectangle into two equal right triangles — just take half the rectangle's area.`;
  return { dom: 'G', diff: 3, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G4a() {
  // missing dimension
  const l = ri(3, 20),
    w = ri(2, 15);
  const area = l * w;
  const askLength = pick([true, false]);
  const known = askLength ? w : l;
  const target = askLength ? l : w;
  const q = `A rectangle has an area of ${area} and a ${askLength ? 'width' : 'length'} of ${known}. What is its ${askLength ? 'length' : 'width'}?`;
  const wrongs = [`${area * known}`, `${area - known}`, `${target + known}`];
  const opts = opt(`${target}`, wrongs);
  if (!opts) return null;
  const why = `${askLength ? 'Length' : 'Width'} = area ÷ ${askLength ? 'width' : 'length'} = ${area} ÷ ${known} = ${target}.`;
  const tip = `If area = length × width, then the missing side = area ÷ the known side.`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G4b() {
  // distance between points sharing a coordinate
  const shareX = pick([true, false]);
  const fixed = ri(-10, 10);
  const a = ri(-10, 10),
    b = ri(-10, 10);
  if (a === b) return null;
  const dist = Math.abs(a - b);
  const p1 = shareX ? `(${fixed}, ${a})` : `(${a}, ${fixed})`;
  const p2 = shareX ? `(${fixed}, ${b})` : `(${b}, ${fixed})`;
  const q = `What is the distance between the points ${p1} and ${p2}?`;
  const wrongs = [`${a + b}`, `${dist + 2}`, `${Math.abs(fixed)}`];
  const opts = opt(`${dist}`, wrongs);
  if (!opts) return null;
  const why = `The ${shareX ? 'x' : 'y'}-values match, so it's a ${shareX ? 'vertical' : 'horizontal'} line. Distance = |${a} − ${b}| = ${dist}.`;
  const tip = `When two points share an x (or y) value, subtract the coordinates that differ to get the distance.`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'coordinate' };
}

function T_G4c() {
  // missing base or height of a parallelogram, given area
  const base = ri(3, 20),
    height = ri(2, 18);
  const area = base * height;
  const askBase = pick([true, false]);
  const known = askBase ? height : base;
  const target = askBase ? base : height;
  const q = `A parallelogram has an area of ${area} and a ${askBase ? 'height' : 'base'} of ${known}. What is its ${askBase ? 'base' : 'height'}?`;
  const wrongs = [`${area * known}`, `${area - known}`, `${target + known}`];
  const opts = opt(`${target}`, wrongs);
  if (!opts) return null;
  const why = `${askBase ? 'Base' : 'Height'} = area ÷ ${askBase ? 'height' : 'base'} = ${area} ÷ ${known} = ${target}.`;
  const tip = `Since area = base × height, the missing dimension = area ÷ the one you already know.`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G4d() {
  // surface area of a rectangular prism
  const l = ri(2, 12),
    w = ri(2, 10),
    h = ri(2, 10);
  const sa = 2 * (l * w + l * h + w * h);
  const q = `A rectangular box is ${l} by ${w} by ${h}. What is its total surface area?`;
  const wrongs = [`${l * w * h}`, `${l * w + l * h + w * h}`, `${sa - 2 * l * w}`];
  const opts = opt(`${sa}`, wrongs);
  if (!opts) return null;
  const why = `Add the area of all 6 faces: 2(${l}×${w}) + 2(${l}×${h}) + 2(${w}×${h}) = ${2 * l * w} + ${2 * l * h} + ${2 * w * h} = ${sa}.`;
  const tip = `Surface area = the sum of every face's area. A box has 3 pairs of matching faces: 2(lw + lh + wh).`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'surface-area' };
}

function T_G4e() {
  // composite area: two rectangles combined
  const l1 = ri(3, 14),
    w1 = ri(2, 10);
  const l2 = ri(3, 14),
    w2 = ri(2, 10);
  const a1 = l1 * w1,
    a2 = l2 * w2;
  const total = a1 + a2;
  const q = `A room is made of two rectangular sections: one is ${l1} ft by ${w1} ft, and the other is ${l2} ft by ${w2} ft. What is the total floor area, in square feet?`;
  const wrongs = [`${a1}`, `${a2}`, `${(l1 + l2) * (w1 + w2)}`];
  const opts = opt(`${total}`, wrongs);
  if (!opts) return null;
  const why = `Find each rectangle's area separately, then add them: (${l1}×${w1}) + (${l2}×${w2}) = ${a1} + ${a2} = ${total}.`;
  const tip = `Break a composite shape into simple rectangles, find each area, then add them together.`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G4f() {
  // circumference or area of a circle from its radius, in terms of π
  const r = ri(2, 20);
  const style = pick(['circumference', 'area']);
  if (style === 'circumference') {
    const c = 2 * r;
    const q = `A circle has a radius of ${r} m. What is its circumference, in terms of π?`;
    const wrongs = [`${r}π m`, `${r * r}π m`, `${c + 2}π m`];
    const opts = opt(`${c}π m`, wrongs);
    if (!opts) return null;
    const why = `Circumference = 2πr = 2 × π × ${r} = ${c}π m.`;
    const tip = `Circumference = 2 × π × radius. Leave your answer in terms of π unless told to use 3.14.`;
    return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'circle' };
  } else {
    const a = r * r;
    const q = `A circle has a radius of ${r} m. What is its area, in terms of π?`;
    const wrongs = [`${2 * r}π m²`, `${r}π m²`, `${a + r}π m²`];
    const opts = opt(`${a}π m²`, wrongs);
    if (!opts) return null;
    const why = `Area = πr² = π × ${r}² = ${a}π m².`;
    const tip = `Area = π × radius² — square the radius, then attach π.`;
    return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'circle' };
  }
}

function T_G4g() {
  // count identical cubes that fill a rectangular prism
  const edge = pick([0.5, 0.25, 1.5, 2]);
  const nl = ri(2, 8),
    nw = ri(2, 8),
    nh = ri(2, 6);
  const l = nl * edge,
    w = nw * edge,
    h = nh * edge;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(2).replace(/0$/, ''));
  const totalCubes = nl * nw * nh;
  const q = `A rectangular prism is made up of identical cubes with no gaps between them, each with a side length of ${fmtNum(edge)} in. The prism measures ${fmtNum(l)} in by ${fmtNum(w)} in by ${fmtNum(h)} in. What is the total number of cubes used to make up the prism?`;
  const wrongs = [`${Math.round(l * w * h)}`, `${nl + nw + nh}`, `${nl * nw * nh * 2}`];
  const opts = opt(`${totalCubes}`, wrongs);
  if (!opts) return null;
  const why = `Divide each dimension by the cube's side length: ${fmtNum(l)} ÷ ${fmtNum(edge)} = ${nl}, ${fmtNum(w)} ÷ ${fmtNum(edge)} = ${nw}, and ${fmtNum(h)} ÷ ${fmtNum(edge)} = ${nh}. Multiply: ${nl} × ${nw} × ${nh} = ${totalCubes} cubes.`;
  const tip = `Find how many cube-lengths fit along each dimension, then multiply those three counts together.`;
  return { dom: 'G', diff: 4, q, opts, correct: 0, why, tip, tag: 'volume' };
}

function T_G5a() {
  // volume of cube
  const s = ri(2, 12);
  const v = s ** 3;
  const q = `A cube has a side length of ${s}. What is its volume?`;
  const wrongs = [`${s * 3}`, `${s * s}`, `${v + s}`];
  const opts = opt(`${v}`, wrongs);
  if (!opts) return null;
  const why = `Volume of a cube = side³ = ${s} × ${s} × ${s} = ${v}.`;
  const tip = `A cube's volume is the side length cubed, not tripled.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'volume' };
}

function T_G5b() {
  // find height given area & base of triangle
  const base = ri(2, 16);
  const h = ri(2, 16);
  const area = (base * h) / 2;
  if (!Number.isInteger(area)) return null;
  const q = `A triangle has an area of ${area} and a base of ${base}. What is its height?`;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const wrongs = [fmtNum(area / base), fmtNum(base), fmtNum(h + 2)];
  const opts = opt(`${h}`, wrongs);
  if (!opts) return null;
  const why = `Area = ½ × base × height, so ${area} = ½ × ${base} × h = ${base / 2}h, giving h = ${h}.`;
  const tip = `Rearrange the area formula: height = (2 × area) ÷ base.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G5c() {
  // parallelogram area with a decimal height
  const base = ri(4, 24);
  const height = ri(15, 95) / 10; // 1.5–9.5
  const area = Math.round(base * height * 10) / 10;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const q = `What is the area of a parallelogram with base ${base} cm and height ${height} cm?`;
  const wrongCands = [base + height, area + base, area + 1, Math.round(base * (height + 1) * 10) / 10];
  const wrongs = wrongCands.map(fmtNum);
  const opts = opt(fmtNum(area), wrongs);
  if (!opts) return null;
  const why = `Area of a parallelogram = base × height = ${base} × ${height} = ${fmtNum(area)} cm².`;
  const tip = `Multiply base by height even when the height is a decimal — line up the decimal point carefully.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G5d() {
  // side length of a cube given its surface area
  const s = ri(2, 12);
  const sa = 6 * s * s;
  const q = `A cube has a total surface area of ${sa}. What is the length of one side?`;
  const wrongs = [`${sa / 6}`, `${Math.round(Math.sqrt(sa))}`, `${s + 2}`];
  const opts = opt(`${s}`, wrongs);
  if (!opts) return null;
  const why = `Surface area of a cube = 6 × side², so side² = ${sa} ÷ 6 = ${s * s}, and side = √${s * s} = ${s}.`;
  const tip = `Work backwards: divide the surface area by 6 to get one face's area, then take the square root.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'surface-area' };
}

const PRISM_TRIPLES = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
  [7, 24, 25]
];
function T_G5e() {
  // surface area of a right triangular prism
  const [a, b, c] = pick(PRISM_TRIPLES);
  const depth = ri(4, 20);
  const triArea = (a * b) / 2;
  const sa = 2 * triArea + (a + b + c) * depth;
  const q = `A triangular prism has a right-triangle cross-section with legs ${a} and ${b} (hypotenuse ${c}), and the prism is ${depth} units long. What is its total surface area?`;
  const wrongs = [`${a * b * depth}`, `${(a + b + c) * depth}`, `${sa - triArea}`];
  const opts = opt(`${sa}`, wrongs);
  if (!opts) return null;
  const why = `Add the two triangular ends and the three rectangular sides: 2 × (½ × ${a} × ${b}) + (${a} + ${b} + ${c}) × ${depth} = ${2 * triArea} + ${(a + b + c) * depth} = ${sa}.`;
  const tip = `A triangular prism's surface area = 2 × (triangle area) + (triangle's perimeter × prism length) — picture unfolding it into a net.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'surface-area' };
}

function T_G5f() {
  // radius or diameter of a circle given its area or circumference, in terms of π
  const r = ri(3, 20);
  const style = pick(['fromArea', 'fromCircumference']);
  if (style === 'fromArea') {
    const a = r * r;
    const q = `The area of a circle is ${a}π m². What is its radius?`;
    const wrongs = [`${a} m`, `${2 * r} m`, `${Math.round(a / 2)} m`];
    const opts = opt(`${r} m`, wrongs);
    if (!opts) return null;
    const why = `Area = πr², so r² = ${a}, and r = √${a} = ${r} m.`;
    const tip = `Working backwards from area: cancel the π, then take the square root to undo the square.`;
    return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'circle' };
  } else {
    const c = 2 * r;
    const d = 2 * r;
    const q = `The circumference of a circle is ${c}π m. What is its diameter?`;
    const wrongs = [`${r} m`, `${c} m`, `${c + 2} m`];
    const opts = opt(`${d} m`, wrongs);
    if (!opts) return null;
    const why = `Circumference = πd, so d = ${c}π ÷ π = ${d} m.`;
    const tip = `Circumference = π × diameter — cancel the π to find the diameter.`;
    return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'circle' };
  }
}

function T_G5g() {
  // triangle: solve for height given a decimal area and base (figure not drawn to scale)
  const base = pick([2, 2.5, 4, 4.5, 5, 6.25, 7.5, 8, 10, 12.5, 15, 16, 20]);
  const height = pick([2, 2.5, 3.2, 4, 4.8, 5, 6, 6.4, 8, 9.6, 10, 12]);
  const area = Math.round(((base * height) / 2) * 10) / 10;
  const fmtNum = v => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
  const q = `The area of the triangle shown is ${fmtNum(area)} cm². The base is ${fmtNum(base)} cm. What is the height? (Figure not drawn to scale.)`;
  const wrongs = [fmtNum(area / base), fmtNum(base), fmtNum(height + 2)];
  const opts = opt(fmtNum(height), wrongs);
  if (!opts) return null;
  const why = `Area = ½ × base × height, so height = (2 × area) ÷ base = (2 × ${fmtNum(area)}) ÷ ${fmtNum(base)} = ${fmtNum(height)} cm.`;
  const tip = `Rearrange the triangle area formula: height = (2 × area) ÷ base — this works the same way with decimals.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'area' };
}

function T_G5h() {
  // coordinate right triangle: hypotenuse (Pythagorean triple) + area, combined answer
  const [legA, legB, hyp] = pick(PRISM_TRIPLES);
  const x = ri(-8, 8),
    y = ri(-8, 8);
  const x2 = x + pick([1, -1]) * legA;
  const y2 = y + pick([1, -1]) * legB;
  const area = (legA * legB) / 2;
  const q = `A right triangle is plotted on a coordinate grid with vertices at A(${x}, ${y}), B(${x2}, ${y}), and C(${x}, ${y2}). What is the length of the hypotenuse BC, and what is the triangle's area?`;
  const correctStr = `Hypotenuse = ${hyp}, Area = ${area} sq units`;
  const wrongs = [
    `Hypotenuse = ${legA + legB}, Area = ${area} sq units`,
    `Hypotenuse = ${hyp}, Area = ${legA * legB} sq units`,
    `Hypotenuse = ${hyp + 2}, Area = ${area + 2} sq units`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `The horizontal leg AB has length ${legA} and the vertical leg AC has length ${legB}. By the Pythagorean theorem, ${legA}² + ${legB}² = ${hyp}², so the hypotenuse is ${hyp}. Area = ½ × ${legA} × ${legB} = ${area} sq units.`;
  const tip = `On a coordinate grid, legs parallel to the axes come from subtracting coordinates; then use the Pythagorean theorem for the hypotenuse and ½ × leg × leg for the area.`;
  return { dom: 'G', diff: 5, q, opts, correct: 0, why, tip, tag: 'coordinate' };
}

/* ================= STATISTICS (SP) ================= */

function buildDataset(n, min, max, forceRepeat) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(ri(min, max));
  if (forceRepeat) {
    arr[1] = arr[0];
  }
  return arr;
}

function T_SP1a() {
  // mode
  const n = ri(5, 7);
  const arr = buildDataset(n, 1, 15, true);
  const counts = {};
  arr.forEach(v => (counts[v] = (counts[v] || 0) + 1));
  const maxCount = Math.max(...Object.values(counts));
  const modes = Object.keys(counts).filter(k => counts[k] === maxCount);
  if (modes.length !== 1) return null;
  const mode = modes[0];
  const others = [...new Set(arr.map(String))].filter(v => v !== mode);
  if (others.length < 3) return null;
  const q = `What is the mode of ${arr.join(', ')}?`;
  const opts = opt(mode, others);
  if (!opts) return null;
  const why = `The mode is the value that appears most often. ${mode} appears ${maxCount} times, more than any other value.`;
  const tip = `The mode is the most frequent value — count how many times each number appears.`;
  return { dom: 'SP', diff: 1, q, opts, correct: 0, why, tip };
}

function T_SP1b() {
  // mode, different phrasing/size
  const n = ri(6, 8);
  const arr = buildDataset(n, 1, 20, true);
  const counts = {};
  arr.forEach(v => (counts[v] = (counts[v] || 0) + 1));
  const maxCount = Math.max(...Object.values(counts));
  const modes = Object.keys(counts).filter(k => counts[k] === maxCount);
  if (modes.length !== 1) return null;
  const mode = modes[0];
  const others = [...new Set(arr.map(String))].filter(v => v !== mode);
  if (others.length < 3) return null;
  const q = `Which value appears most often in this data set: ${arr.join(', ')}?`;
  const opts = opt(mode, others);
  if (!opts) return null;
  const why = `${mode} shows up ${maxCount} times — more than any other number in the set, so it's the mode.`;
  const tip = `Tally how many times each value shows up; the one with the highest tally is the mode.`;
  return { dom: 'SP', diff: 1, q, opts, correct: 0, why, tip };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function T_SP2a() {
  // median, 5 numbers
  const arr = buildDataset(5, 1, 20, false);
  if (new Set(arr).size < 5) return null;
  const med = median(arr);
  const q = `What is the median of ${arr.join(', ')}?`;
  const sorted = [...arr].sort((a, b) => a - b);
  const wrongs = [`${sorted[0]}`, `${sorted[4]}`, `${arr.reduce((a, b) => a + b, 0)}`];
  const opts = opt(`${med}`, wrongs);
  if (!opts) return null;
  const why = `Put them in order: ${sorted.join(', ')}. The middle value is ${med}.`;
  const tip = `Always sort the numbers first, then find the middle one for the median.`;
  return { dom: 'SP', diff: 2, q, opts, correct: 0, why, tip };
}

function T_SP2b() {
  // median, 5 numbers, different range/phrasing
  const arr = buildDataset(5, 5, 40, false);
  if (new Set(arr).size < 5) return null;
  const med = median(arr);
  const sorted = [...arr].sort((a, b) => a - b);
  const q = `A student recorded these test scores: ${arr.join(', ')}. What is the median score?`;
  const wrongs = [`${sorted[1]}`, `${sorted[3]}`, `${Math.round(arr.reduce((a, b) => a + b, 0) / 5)}`];
  const opts = opt(`${med}`, wrongs);
  if (!opts) return null;
  const why = `Sorted: ${sorted.join(', ')}. With 5 values, the median is the 3rd one: ${med}.`;
  const tip = `Sort first, then pick the middle number — for 5 values that's the 3rd one.`;
  return { dom: 'SP', diff: 2, q, opts, correct: 0, why, tip };
}

function T_SP3a() {
  // mean
  const n = pick([4, 5]);
  let arr, sum;
  let tries = 0;
  do {
    arr = buildDataset(n, 1, 20, false);
    sum = arr.reduce((a, b) => a + b, 0);
    tries++;
  } while (sum % n !== 0 && tries < 30);
  if (sum % n !== 0) return null;
  const mean = sum / n;
  const q = `What is the mean of ${arr.join(', ')}?`;
  const wrongs = [`${sum}`, `${mean + 1}`, `${Math.max(...arr)}`];
  const opts = opt(`${mean}`, wrongs);
  if (!opts) return null;
  const why = `Add them: ${arr.join('+')} = ${sum}. Divide by how many (${n}): ${sum} ÷ ${n} = ${mean}.`;
  const tip = `Mean = sum of values ÷ number of values.`;
  return { dom: 'SP', diff: 3, q, opts, correct: 0, why, tip };
}

function T_SP3b() {
  // median, 7 numbers
  const arr = buildDataset(7, 1, 30, false);
  if (new Set(arr).size < 7) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const med = sorted[3];
  const q = `What is the median of ${arr.join(', ')}?`;
  const wrongs = [`${sorted[2]}`, `${sorted[4]}`, `${Math.round(arr.reduce((a, b) => a + b, 0) / 7)}`];
  const opts = opt(`${med}`, wrongs);
  if (!opts) return null;
  const why = `Sorted: ${sorted.join(', ')}. With 7 values, the median is the 4th one: ${med}.`;
  const tip = `Sort first, then count into the middle — with an odd count there's exactly one middle value.`;
  return { dom: 'SP', diff: 3, q, opts, correct: 0, why, tip };
}

function T_SP4a() {
  // range
  const n = ri(5, 6);
  const arr = buildDataset(n, 1, 30, false);
  const max = Math.max(...arr),
    min = Math.min(...arr);
  if (max === min) return null;
  const range = max - min;
  const q = `What is the range of ${arr.join(', ')}?`;
  const wrongs = [`${max}`, `${min}`, `${max + min}`];
  const opts = opt(`${range}`, wrongs);
  if (!opts) return null;
  const why = `Range = greatest − least = ${max} − ${min} = ${range}.`;
  const tip = `Range measures spread: subtract the smallest value from the largest.`;
  return { dom: 'SP', diff: 4, q, opts, correct: 0, why, tip };
}

function T_SP4b() {
  // mean, 4-5 numbers larger range
  const n = pick([4, 5]);
  let arr,
    sum,
    tries = 0;
  do {
    arr = buildDataset(n, 5, 40, false);
    sum = arr.reduce((a, b) => a + b, 0);
    tries++;
  } while (sum % n !== 0 && tries < 30);
  if (sum % n !== 0) return null;
  const mean = sum / n;
  const q = `A set of numbers is ${arr.join(', ')}. What is their mean?`;
  const wrongs = [`${sum}`, `${Math.min(...arr)}`, `${mean + 2}`];
  const opts = opt(`${mean}`, wrongs);
  if (!opts) return null;
  const why = `Sum = ${arr.join('+')} = ${sum}. Divide by ${n}: ${sum} ÷ ${n} = ${mean}.`;
  const tip = `Add every value, then divide by how many values there are.`;
  return { dom: 'SP', diff: 4, q, opts, correct: 0, why, tip };
}

function T_SP5a() {
  // sum from mean, or missing value
  const style = pick(['sum', 'missing']);
  if (style === 'sum') {
    const count = ri(3, 8);
    const mean = ri(4, 20);
    const sum = mean * count;
    const q = `The mean of ${count} numbers is ${mean}. What is their sum?`;
    const wrongs = [`${mean}`, `${count}`, `${sum + count}`];
    const opts = opt(`${sum}`, wrongs);
    if (!opts) return null;
    const why = `Sum = mean × count = ${mean} × ${count} = ${sum}.`;
    const tip = `Work the mean formula backwards: sum = mean × number of values.`;
    return { dom: 'SP', diff: 5, q, opts, correct: 0, why, tip };
  } else {
    const n = ri(3, 5);
    const known = buildDataset(n, 1, 20, false);
    const mean = ri(5, 20);
    const total = mean * (n + 1);
    const missing = total - known.reduce((a, b) => a + b, 0);
    if (missing < 1 || missing > 60) return null;
    const q = `The numbers ${known.join(', ')}, and x have a mean of ${mean}. What is x?`;
    const wrongs = [`${mean}`, `${missing + 2}`, `${total}`];
    const opts = opt(`${missing}`, wrongs);
    if (!opts) return null;
    const why = `The sum of all ${n + 1} numbers must be ${mean} × ${n + 1} = ${total}. The known numbers add to ${known.reduce((a, b) => a + b, 0)}, so x = ${total} − ${known.reduce((a, b) => a + b, 0)} = ${missing}.`;
    const tip = `First find the total sum needed (mean × count), then subtract the known values to find the missing one.`;
    return { dom: 'SP', diff: 5, q, opts, correct: 0, why, tip };
  }
}

function T_SP5b() {
  // median of 5, larger unsorted range
  const arr = buildDataset(5, 1, 50, false);
  if (new Set(arr).size < 5) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const med = sorted[2];
  const q = `What is the median of ${arr.join(', ')}?`;
  const wrongs = [`${sorted[1]}`, `${sorted[3]}`, `${Math.round(arr.reduce((a, b) => a + b, 0) / 5)}`];
  const opts = opt(`${med}`, wrongs);
  if (!opts) return null;
  const why = `Sort the numbers first: ${sorted.join(', ')}. The middle value (3rd of 5) is ${med}.`;
  const tip = `With an odd count, the median is the exact middle value after sorting — don't forget to sort first.`;
  return { dom: 'SP', diff: 5, q, opts, correct: 0, why, tip };
}

function T_SP5c() {
  // median reasoning: classify two statements about an odd-sized data set
  const half = ri(6, 15);
  const n = half * 2 + 1;
  const med = ri(18, 35);
  const oldest = med + ri(3, 15);
  const below = med - ri(6, 15);
  if (below < 1) return null;
  const q = `There are ${n} students in a class. The median age of the students is ${med}. The oldest student is ${oldest}. Which pair of statements is correctly classified?`;
  const correctStr = `"At least one student is ${med}" — must be true. "Some students are younger than ${below}" — could be true.`;
  const wrongs = [
    `"At least one student is ${med}" — could be true. "Some students are younger than ${below}" — must be true.`,
    `"At least one student is ${med}" — cannot be true. "Some students are younger than ${below}" — could be true.`,
    `"At least one student is ${med}" — must be true. "Some students are younger than ${below}" — cannot be true.`
  ];
  const opts = opt(correctStr, wrongs);
  if (!opts) return null;
  const why = `With an odd number of students (${n}), the median is always one actual student's age, so "at least one student is ${med}" must be true. Nothing in the given facts forces any student to be younger than ${below} — it's possible but not guaranteed, so that statement could be true.`;
  const tip = `For an odd-sized data set, the median itself is always one of the real values in the set — that part is guaranteed. Anything not directly forced by the given facts is only "could be true," never "must be true."`;
  return { dom: 'SP', diff: 5, q, opts, correct: 0, why, tip };
}

/* ================= BUCKETS ================= */

const BUCKETS = [
  ['NS', 1, T_NS1a, T_NS1b],
  ['NS', 2, T_NS2a, T_NS2b, T_NS2c, T_NS2d],
  ['NS', 3, T_NS3a, T_NS3b],
  ['NS', 4, T_NS4a, T_NS4b, T_NS4c],
  ['NS', 5, T_NS5a, T_NS5b, T_NS5c],
  ['RP', 1, T_RP1a, T_RP1b],
  ['RP', 2, T_RP2a, T_RP2b],
  ['RP', 3, T_RP3a, T_RP3b, T_RP3c],
  ['RP', 4, T_RP4a, T_RP4b, T_RP4c, T_RP4d],
  ['RP', 5, T_RP5a, T_RP5b],
  ['EE', 1, T_EE1a, T_EE1b],
  ['EE', 2, T_EE2a, T_EE2b, T_EE2c],
  ['EE', 3, T_EE3a, T_EE3b],
  ['EE', 4, T_EE4a, T_EE4b, T_EE4c, T_EE4d],
  ['EE', 5, T_EE5a, T_EE5b, T_EE5c, T_EE5d, T_EE5f],
  ['G', 1, T_G1a, T_G1b],
  ['G', 2, T_G2a, T_G2b, T_G2c],
  ['G', 3, T_G3a, T_G3b, T_G3c, T_G3d, T_G3e],
  ['G', 4, T_G4a, T_G4b, T_G4c, T_G4d, T_G4e, T_G4f, T_G4g],
  ['G', 5, T_G5a, T_G5b, T_G5c, T_G5d, T_G5e, T_G5f, T_G5g, T_G5h],
  ['SP', 1, T_SP1a, T_SP1b],
  ['SP', 2, T_SP2a, T_SP2b],
  ['SP', 3, T_SP3a, T_SP3b],
  ['SP', 4, T_SP4a, T_SP4b],
  ['SP', 5, T_SP5a, T_SP5b, T_SP5c]
];

const TARGET_PER_BUCKET = 20;
// Buckets with a 3rd/4th generator (freshly-taught topics we want extra reps of)
// get a bigger pool so the new style isn't diluted down to a token few questions.
const TARGET_OVERRIDES = {
  NS2: 24,
  NS5: 28,
  RP3: 28,
  RP4: 32,
  EE2: 24,
  EE4: 40,
  EE5: 44,
  G2: 27,
  G3: 32,
  G4: 40,
  G5: 48,
  SP5: 24
};
const MAX_ATTEMPTS = 6000;

const all = [];
const seenQ = new Set();
let idCounters = {};

for (const [dom, diff, ...gens] of BUCKETS) {
  const target = TARGET_OVERRIDES[`${dom}${diff}`] || TARGET_PER_BUCKET;
  const bucketOut = [];
  let attempts = 0;
  while (bucketOut.length < target && attempts < MAX_ATTEMPTS) {
    attempts++;
    const gen = gens[attempts % gens.length];
    const item = gen();
    if (!item) continue;
    if (seenQ.has(item.q)) continue;
    seenQ.add(item.q);
    bucketOut.push(item);
  }
  if (bucketOut.length < target) {
    console.warn(`⚠ ${dom} L${diff}: only got ${bucketOut.length}/${target} unique questions`);
  }
  bucketOut.forEach(item => {
    const key = `${dom}${diff}`;
    idCounters[key] = (idCounters[key] || 0) + 1;
    item.id = `${key}-${String(idCounters[key]).padStart(3, '0')}`;
  });
  all.push(...bucketOut);
}

/* structural validation */
let bad = 0;
all.forEach(q => {
  if (
    !q.id ||
    !q.dom ||
    !q.diff ||
    !q.q ||
    !Array.isArray(q.opts) ||
    q.opts.length !== 4 ||
    q.correct !== 0 ||
    !q.why ||
    !q.tip
  ) {
    console.error('Malformed question:', q);
    bad++;
  }
  const uniqOpts = new Set(q.opts);
  if (uniqOpts.size !== 4) {
    console.error('Duplicate options in', q.id, q.opts);
    bad++;
  }
});
if (bad) {
  console.error(`${bad} malformed/bad questions found.`);
  process.exit(1);
}

/* Every templated question above is freshly randomized on each run, so it's
   stamped with today's date as the batch it belongs to. Hand-authored
   questions (module-1.json, test-review-1.json, ...) live in their own
   files in data/questions/ and are merged into the bank by the build, so
   regenerating only ever replaces this file. */
const today = new Date().toISOString().slice(0, 10);
all.forEach(q => {
  q.addedAt = today;
  q.source = 'generated';
});

const out = {
  schemaVersion: '1.0',
  generatedAt: new Date().toISOString(),
  domains: DOMAINS,
  count: all.length,
  questions: all
};

fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'questions', 'questions.json'), JSON.stringify(out, null, 2));

console.log(`Generated ${all.length} questions.`);
const byBucket = {};
all.forEach(q => {
  const k = `${q.dom} L${q.diff}`;
  byBucket[k] = (byBucket[k] || 0) + 1;
});
console.log(byBucket);
