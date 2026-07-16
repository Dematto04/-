import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'tu_vung_tat_ca.csv');
const outputPath = path.join(root, 'src', 'data.generated.js');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV không hợp lệ: thiếu dấu ngoặc kép đóng.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

const csv = await readFile(sourcePath, 'utf8');
const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
const header = rows.shift()?.map((value) => value.trim());
const expectedHeader = ['KANJI', 'hiragana', 'hán tự', 'nghĩa'];

if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
  throw new Error(`Header CSV không đúng. Nhận được: ${header?.join(', ')}`);
}

const cards = rows.map((columns, index) => {
  if (columns.length !== 4) {
    throw new Error(`Dòng ${index + 2} phải có 4 cột, nhận được ${columns.length}.`);
  }

  const [kanjiRaw, readingRaw, sinoRaw, meaningRaw] = columns;
  const kanji = kanjiRaw.trim();
  const hiragana = readingRaw.trim();
  const front = kanji || hiragana;
  const meaning = meaningRaw.trim();

  if (!front) throw new Error(`Dòng ${index + 2} không có từ vựng.`);
  if (!meaning) throw new Error(`Dòng ${index + 2} không có nghĩa tiếng Việt.`);

  return {
    i: index + 1,
    f: front,
    r: kanji ? hiragana : '',
    s: sinoRaw.trim(),
    m: meaning
  };
});

const fallbackCount = cards.filter((card) => card.r === '').length;
const deckCount = Math.ceil(cards.length / 20);

if (cards.length !== 1045) throw new Error(`Cần 1045 thẻ, nhận được ${cards.length}.`);
if (fallbackCount !== 162) throw new Error(`Cần 162 thẻ fallback hiragana, nhận được ${fallbackCount}.`);
if (cards.slice(-5).length !== 5 || deckCount !== 53) throw new Error('Cấu trúc 53 bài không hợp lệ.');

const banner = '// Tự động tạo từ tu_vung_tat_ca.csv — không chỉnh sửa thủ công.\n';
const moduleText = `${banner}export const CARDS=${JSON.stringify(cards)};\nexport const DECK_SIZE=20;\n`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, moduleText, 'utf8');

console.log(`Đã tạo ${cards.length} thẻ / ${deckCount} bài (${fallbackCount} thẻ dùng hiragana).`);

export { parseCsv };
