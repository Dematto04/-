import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, DECK_SIZE } from '../src/data.generated.js';

test('dữ liệu tạo đủ 1.045 thẻ và 53 bài', () => {
  assert.equal(CARDS.length, 1045);
  assert.equal(DECK_SIZE, 20);
  assert.equal(Math.ceil(CARDS.length / DECK_SIZE), 53);
  assert.equal(CARDS.slice(1040).length, 5);
});

test('thẻ đầu tiên giữ đúng ba trường mặt sau', () => {
  assert.deepEqual(CARDS[0], {
    i: 1,
    f: '人生',
    r: 'じんせい',
    s: 'NHÂN SINH',
    m: 'cuộc sống'
  });
});

test('162 mục thiếu Kanji dùng hiragana làm mặt trước', () => {
  const fallbacks = CARDS.filter((card) => card.r === '');
  assert.equal(fallbacks.length, 162);
  const wrinkles = fallbacks.find((card) => card.f === 'しわ');
  assert.ok(wrinkles);
  assert.equal(wrinkles.m, 'nếp nhăn');
});

test('nghĩa có dấu phẩy không bị tách và từ trùng có ID riêng', () => {
  assert.equal(CARDS.find((card) => card.f === '透き通る').m, 'trở nên rõ ràng, trở nên trong suốt');
  const duplicated = CARDS.filter((card) => card.f === '便');
  assert.equal(duplicated.length, 2);
  assert.notEqual(duplicated[0].i, duplicated[1].i);
  assert.notEqual(duplicated[0].r, duplicated[1].r);
});

test('không có thẻ thiếu mặt trước hoặc nghĩa', () => {
  assert.equal(CARDS.some((card) => !card.f || !card.m), false);
});
