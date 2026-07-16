import test from 'node:test';
import assert from 'node:assert/strict';
import { answerCard, createSession, shuffleRemaining, undoAnswer } from '../src/study-engine.js';

const cards = [
  { i: 1, f: '一' },
  { i: 2, f: '二' },
  { i: 3, f: '三' }
];

test('tiếp tục chỉ đưa thẻ chưa nhớ vào hàng đợi', () => {
  const session = createSession(cards, [1, 3]);
  assert.deepEqual(session.queue.map((card) => card.i), [2]);
});

test('ôn toàn bộ giữ đủ thẻ kể cả thẻ đã nhớ', () => {
  const session = createSession(cards, [1, 2, 3], { reviewAll: true });
  assert.deepEqual(session.queue.map((card) => card.i), [1, 2, 3]);
});

test('lượt đầu ghi nhận chưa nhớ nhưng không lặp lại ngay', () => {
  const session = createSession(cards, [1], { reviewAll: true });
  answerCard(session, false);
  assert.deepEqual(session.queue.map((card) => card.i), [2, 3]);
  assert.equal(session.known.has(1), false);
  assert.equal(session.misses, 1);
  assert.equal(session.answered, 1);
  assert.equal(session.total, 3);
});

test('lượt học tiếp đưa từ chưa nhớ xuống cuối cho tới khi nhớ', () => {
  const session = createSession(cards, [], { reviewAll: true, requeueMisses: true });
  answerCard(session, false);
  assert.deepEqual(session.queue.map((card) => card.i), [2, 3, 1]);
  assert.equal(session.requeueMisses, true);
});

test('đã nhớ loại thẻ khỏi hàng đợi và lưu trạng thái', () => {
  const session = createSession(cards);
  answerCard(session, true);
  assert.deepEqual(session.queue.map((card) => card.i), [2, 3]);
  assert.equal(session.known.has(1), true);
});

test('hoàn tác phục hồi hàng đợi, known và số lần sai', () => {
  const session = createSession(cards);
  answerCard(session, false);
  const restored = undoAnswer(session);
  assert.equal(restored.i, 1);
  assert.deepEqual(session.queue.map((card) => card.i), [1, 2, 3]);
  assert.equal(session.known.has(1), false);
  assert.equal(session.misses, 0);
});

test('trộn chỉ thay đổi hàng đợi còn lại', () => {
  const session = createSession(cards);
  shuffleRemaining(session, () => 0);
  assert.deepEqual(session.queue.map((card) => card.i), [2, 3, 1]);
  assert.equal(session.shuffled, true);
});
