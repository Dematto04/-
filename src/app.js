import { CARDS, DECK_SIZE } from './data.generated.js';
import { answerCard, createSession, shuffleRemaining, undoAnswer } from './study-engine.js';

const STORAGE_KEY = 'n2-flashcards:state:v1';
const DECK_COUNT = Math.ceil(CARDS.length / DECK_SIZE);
const DECKS = Array.from({ length: DECK_COUNT }, (_, deckId) => (
  CARDS.slice(deckId * DECK_SIZE, (deckId + 1) * DECK_SIZE)
));
const DECK_ID_SETS = DECKS.map((deck) => new Set(deck.map((card) => card.i)));
const EMPTY_ID_SET = new Set();
const NUMBER_FORMATTER = new Intl.NumberFormat('vi-VN');
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  home: $('#home-screen'),
  study: $('#study-screen'),
  summary: $('#summary-screen'),
  deckList: $('#deck-list'),
  overallRing: $('#overall-ring'),
  overallPercent: $('#overall-percent'),
  overallCount: $('#overall-count'),
  continuePanel: $('#continue-panel'),
  continueTitle: $('#continue-title'),
  continueDetail: $('#continue-detail'),
  continueButton: $('#continue-button'),
  installButton: $('#install-button'),
  resetAllButton: $('#reset-all-button'),
  leaveStudyButton: $('#leave-study-button'),
  studyDeckLabel: $('#study-deck-label'),
  studyCountLabel: $('#study-count-label'),
  studyProgressBar: $('#study-progress-bar'),
  flashcard: $('#flashcard'),
  cardIndex: $('#card-index'),
  cardFront: $('#card-front'),
  readingBlock: $('#reading-block'),
  cardReading: $('#card-reading'),
  sinoBlock: $('#sino-block'),
  cardSino: $('#card-sino'),
  cardMeaning: $('#card-meaning'),
  againButton: $('#again-button'),
  knownButton: $('#known-button'),
  undoButton: $('#undo-button'),
  shuffleButton: $('#shuffle-button'),
  answerAnnouncer: $('#answer-announcer'),
  feedbackLeft: $('#swipe-feedback-left'),
  feedbackRight: $('#swipe-feedback-right'),
  summaryTitle: $('#summary-title'),
  summaryMessage: $('#summary-message'),
  summaryKnown: $('#summary-known'),
  summaryRemaining: $('#summary-remaining'),
  reviewButton: $('#review-button'),
  summaryHomeButton: $('#summary-home-button'),
  summaryResetButton: $('#summary-reset-button'),
  confirmDialog: $('#confirm-dialog'),
  confirmTitle: $('#confirm-title'),
  confirmMessage: $('#confirm-message'),
  confirmAction: $('#confirm-action'),
  installDialog: $('#install-dialog'),
  installMessage: $('#install-message'),
  toast: $('#toast')
};

function freshState() {
  return { version: 1, theme: null, lastDeckId: null, decks: {} };
}

let storageFailed = false;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || parsed.version !== 1 || typeof parsed.decks !== 'object') return freshState();
    return {
      version: 1,
      theme: parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : null,
      lastDeckId: Number.isInteger(parsed.lastDeckId) ? parsed.lastDeckId : null,
      decks: parsed.decks || {}
    };
  } catch {
    storageFailed = true;
    return freshState();
  }
}

let state = loadState();
let currentDeckId = null;
let currentDeckCards = [];
let session = null;
let flipped = false;
let interactionLocked = false;
let pendingConfirm = null;
let deferredInstallPrompt = null;
let toastTimer = null;
let answerAnimationTimer = null;

function deckCards(deckId) {
  return DECKS[deckId] || [];
}

function normalizedDeckState(deckId) {
  const validIds = DECK_ID_SETS[deckId] || EMPTY_ID_SET;
  const source = state.decks[deckId] || {};
  const known = Array.isArray(source.known)
    ? [...new Set(source.known.filter((id) => validIds.has(id)))]
    : [];
  return {
    known,
    misses: Number.isFinite(source.misses) && source.misses > 0 ? Math.floor(source.misses) : 0,
    updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : 0
  };
}

function saveState(showFailure = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    storageFailed = true;
    if (showFailure) showToast('Không thể lưu tiến độ trên thiết bị này.');
    return false;
  }
}

function persistCurrentSession() {
  if (currentDeckId === null || !session) return;
  const previous = normalizedDeckState(currentDeckId);
  state.decks[currentDeckId] = {
    ...previous,
    known: [...session.known].sort((a, b) => a - b),
    updatedAt: Date.now()
  };
  state.lastDeckId = currentDeckId;
  saveState();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2600);
}

function formatNumber(value) {
  return NUMBER_FORMATTER.format(value);
}

function deckLabel(deckId) {
  return `Bài ${String(deckId + 1).padStart(2, '0')}`;
}

function setScreen(name) {
  const isStudying = name === 'study';
  elements.home.hidden = name !== 'home';
  elements.study.hidden = !isStudying;
  elements.summary.hidden = name !== 'summary';
  document.documentElement.classList.toggle('study-scroll-locked', isStudying);
  document.body.classList.toggle('study-scroll-locked', isStudying);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderHome() {
  let totalKnown = 0;
  const cards = [];

  for (let deckId = 0; deckId < DECK_COUNT; deckId += 1) {
    const items = deckCards(deckId);
    const progress = normalizedDeckState(deckId);
    const knownCount = progress.known.length;
    const percent = Math.round((knownCount / items.length) * 100);
    const complete = knownCount === items.length;
    const active = knownCount > 0 && !complete;
    totalKnown += knownCount;

    cards.push(`
      <article class="deck-item${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}">
        <span class="deck-number" aria-hidden="true">
          ${complete ? '<span class="paw-icon" aria-hidden="true"></span>' : String(deckId + 1).padStart(2, '0')}
        </span>
        <button class="deck-main" type="button" data-start-deck="${deckId}" aria-label="${deckLabel(deckId)}, ${knownCount} trên ${items.length} từ đã nhớ">
          <strong>${deckLabel(deckId)}</strong>
          <span>${knownCount}/${items.length} từ đã nhớ</span>
          <span class="deck-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>
        </button>
        ${knownCount > 0 ? `
          <button class="deck-reset" type="button" data-reset-deck="${deckId}" aria-label="Đặt lại ${deckLabel(deckId)}" title="Đặt lại bài">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
          </button>` : '<span class="h-11 w-2" aria-hidden="true"></span>'}
      </article>
    `);
  }

  elements.deckList.innerHTML = cards.join('');
  const overallPercent = Math.round((totalKnown / CARDS.length) * 100);
  elements.overallPercent.textContent = `${overallPercent}%`;
  elements.overallCount.textContent = `${formatNumber(totalKnown)} / ${formatNumber(CARDS.length)}`;
  elements.overallRing.style.setProperty('--progress', `${overallPercent * 3.6}deg`);
  elements.overallRing.setAttribute('aria-label', `Tiến độ tổng ${overallPercent} phần trăm`);

  if (state.lastDeckId !== null && state.lastDeckId >= 0 && state.lastDeckId < DECK_COUNT) {
    const lastDeck = normalizedDeckState(state.lastDeckId);
    const count = deckCards(state.lastDeckId).length;
    elements.continuePanel.hidden = false;
    elements.continueTitle.textContent = deckLabel(state.lastDeckId);
    elements.continueDetail.textContent = lastDeck.known.length === count
      ? `${count}/${count} từ đã nhớ`
      : `${lastDeck.known.length}/${count} từ đã nhớ`;
  } else {
    elements.continuePanel.hidden = true;
  }
}

function renderCard() {
  const card = session?.queue[0];
  if (!card) return finishSession();

  flipped = false;
  elements.flashcard.classList.remove('is-flipped', 'is-dragging', 'is-answering-known', 'is-answering-again');
  elements.feedbackLeft.classList.remove('is-visible', 'is-committed');
  elements.feedbackRight.classList.remove('is-visible', 'is-committed');
  elements.flashcard.style.removeProperty('--drag-x');
  elements.flashcard.style.removeProperty('--drag-rotate');
  elements.flashcard.setAttribute('aria-pressed', 'false');
  elements.flashcard.setAttribute('aria-label', `Từ ${card.f}. Mở đáp án`);
  elements.cardIndex.textContent = String(card.i).padStart(3, '0');
  elements.cardFront.textContent = card.f;
  elements.cardReading.textContent = card.r;
  elements.cardSino.textContent = card.s;
  elements.cardMeaning.textContent = card.m;
  elements.readingBlock.hidden = !card.r;
  elements.sinoBlock.hidden = !card.s;
  elements.againButton.disabled = false;
  elements.knownButton.disabled = false;
  elements.undoButton.disabled = session.history.length === 0;
  elements.shuffleButton.classList.toggle('is-active', session.shuffled);
  elements.shuffleButton.setAttribute('aria-pressed', String(session.shuffled));
  renderStudyProgress();
}

function renderStudyProgress() {
  const completed = Math.min(session.answered, session.total);
  const percent = session.total > 0 ? (completed / session.total) * 100 : 100;
  elements.studyDeckLabel.textContent = deckLabel(currentDeckId);
  elements.studyCountLabel.textContent = `${completed} / ${session.total} đã học`;
  elements.studyProgressBar.style.width = `${percent}%`;
  elements.studyProgressBar.classList.toggle('is-empty', completed === 0);
}

function flipCard() {
  if (!session?.queue.length || interactionLocked) return;
  flipped = !flipped;
  elements.flashcard.classList.toggle('is-flipped', flipped);
  elements.flashcard.setAttribute('aria-pressed', String(flipped));
  elements.flashcard.setAttribute('aria-label', flipped ? 'Đáp án đang hiển thị' : `Từ ${session.queue[0].f}. Mở đáp án`);
}

function startDeck(deckId, { reviewAll = false } = {}) {
  currentDeckId = deckId;
  currentDeckCards = deckCards(deckId);
  const progress = normalizedDeckState(deckId);
  const isComplete = progress.known.length === currentDeckCards.length;
  session = createSession(currentDeckCards, progress.known, { reviewAll: reviewAll || isComplete });
  state.lastDeckId = deckId;
  saveState(false);
  setScreen('study');
  renderCard();
  requestAnimationFrame(() => elements.flashcard.focus({ preventScroll: true }));
}

function startRemediation() {
  const progress = normalizedDeckState(currentDeckId);
  const remainingCards = currentDeckCards.filter((card) => !progress.known.includes(card.i));
  if (remainingCards.length === 0) {
    startDeck(currentDeckId, { reviewAll: true });
    return;
  }

  session = createSession(remainingCards, progress.known, { reviewAll: true });
  state.lastDeckId = currentDeckId;
  saveState(false);
  setScreen('study');
  renderCard();
  requestAnimationFrame(() => elements.flashcard.focus({ preventScroll: true }));
}

function submitAnswer(remembered) {
  if (interactionLocked || !session?.queue.length) return;
  interactionLocked = true;
  elements.againButton.disabled = true;
  elements.knownButton.disabled = true;
  elements.undoButton.disabled = true;

  const feedback = remembered ? elements.feedbackRight : elements.feedbackLeft;
  elements.flashcard.classList.add(remembered ? 'is-answering-known' : 'is-answering-again');
  feedback.classList.add('is-visible', 'is-committed');
  elements.answerAnnouncer.textContent = remembered
    ? 'Đã nhớ. Chuyển sang thẻ tiếp theo.'
    : 'Chưa nhớ. Đã ghi nhận để học tiếp ở lượt sau.';

  answerCard(session, remembered);
  renderStudyProgress();

  if (!remembered) {
    const progress = normalizedDeckState(currentDeckId);
    state.decks[currentDeckId] = { ...progress, misses: progress.misses + 1 };
  }

  persistCurrentSession();
  const animationDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260;
  answerAnimationTimer = setTimeout(() => {
    answerAnimationTimer = null;
    if (elements.study.hidden) {
      interactionLocked = false;
      return;
    }
    if (session.queue.length === 0) finishSession();
    else renderCard();
    interactionLocked = false;
  }, animationDuration);
}

function undoPrevious() {
  if (interactionLocked || !session?.history.length) return;
  const previous = session.history.at(-1);
  undoAnswer(session);

  if (!previous.remembered) {
    const progress = normalizedDeckState(currentDeckId);
    state.decks[currentDeckId] = { ...progress, misses: Math.max(0, progress.misses - 1) };
  }

  persistCurrentSession();
  renderCard();
  showToast('Đã quay lại thẻ trước.');
}

function finishSession() {
  if (!session || currentDeckId === null) return;
  persistCurrentSession();
  const knownCount = currentDeckCards.filter((card) => session.known.has(card.i)).length;
  const remainingCount = currentDeckCards.length - knownCount;
  elements.summaryKnown.textContent = String(knownCount);
  elements.summaryRemaining.textContent = String(remainingCount);
  elements.summary.classList.toggle('has-remaining', remainingCount > 0);

  if (remainingCount > 0) {
    elements.summaryTitle.textContent = `${deckLabel(currentDeckId)} · Hết lượt`;
    elements.summaryMessage.textContent = `Đã học ${session.total} từ trong lượt này. Còn ${remainingCount} từ cần ôn lại.`;
    elements.reviewButton.textContent = `Học tiếp ${remainingCount} từ chưa nhớ`;
  } else {
    elements.summaryTitle.textContent = `${deckLabel(currentDeckId)} đã hoàn thành`;
    elements.summaryMessage.textContent = `Đã nhớ ${knownCount}/${currentDeckCards.length} từ. Có thể ôn lại khi cần.`;
    elements.reviewButton.textContent = 'Ôn lại bài này';
  }
  setScreen('summary');
}

function leaveStudy() {
  if (answerAnimationTimer) {
    clearTimeout(answerAnimationTimer);
    answerAnimationTimer = null;
  }
  interactionLocked = false;
  persistCurrentSession();
  renderHome();
  setScreen('home');
}

function applyTheme(theme, persist = true) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  $$('meta[name="theme-color"]').forEach((meta) => { meta.content = isDark ? '#1b171f' : '#f9f6ee'; });
  $$('.theme-toggle').forEach((button) => {
    button.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  });
  if (persist) {
    state.theme = theme;
    saveState(false);
  }
}

function askConfirmation({ title, message, actionLabel, onConfirm }) {
  if (typeof elements.confirmDialog.showModal !== 'function') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAction.textContent = actionLabel;
  pendingConfirm = onConfirm;
  elements.confirmDialog.showModal();
}

function resetDeck(deckId) {
  delete state.decks[deckId];
  if (state.lastDeckId === deckId) state.lastDeckId = null;
  saveState();
  renderHome();
  showToast(`${deckLabel(deckId)} đã được đặt lại.`);
}

function resetAll() {
  const theme = state.theme;
  state = freshState();
  state.theme = theme;
  saveState();
  renderHome();
  showToast('Đã đặt lại toàn bộ tiến độ.');
}

function openInstallHelp() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  elements.installMessage.innerHTML = isIOS
    ? 'Trên Safari, chạm nút <strong>Chia sẻ</strong>, sau đó chọn <strong>Thêm vào MH chính</strong>.'
    : 'Mở menu của trình duyệt và chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.';
  if (typeof elements.installDialog.showModal === 'function') elements.installDialog.showModal();
}

elements.deckList.addEventListener('click', (event) => {
  const reset = event.target.closest('[data-reset-deck]');
  if (reset) {
    const deckId = Number(reset.dataset.resetDeck);
    askConfirmation({
      title: `Đặt lại ${deckLabel(deckId)}?`,
      message: 'Toàn bộ tiến độ và số lần ôn của bài này sẽ bị xóa.',
      actionLabel: 'Đặt lại bài',
      onConfirm: () => resetDeck(deckId)
    });
    return;
  }
  const start = event.target.closest('[data-start-deck]');
  if (start) startDeck(Number(start.dataset.startDeck));
});

elements.continueButton.addEventListener('click', () => {
  if (state.lastDeckId !== null) startDeck(state.lastDeckId);
});
elements.flashcard.addEventListener('click', flipCard);
elements.againButton.addEventListener('click', () => submitAnswer(false));
elements.knownButton.addEventListener('click', () => submitAnswer(true));
elements.undoButton.addEventListener('click', undoPrevious);
elements.leaveStudyButton.addEventListener('click', leaveStudy);
elements.shuffleButton.addEventListener('click', () => {
  if (!session || session.queue.length < 2) {
    showToast('Không còn đủ thẻ để trộn.');
    return;
  }
  shuffleRemaining(session);
  renderCard();
  showToast('Đã trộn các thẻ còn lại.');
});
elements.reviewButton.addEventListener('click', () => {
  const progress = normalizedDeckState(currentDeckId);
  const hasRemaining = currentDeckCards.some((card) => !progress.known.includes(card.i));
  if (hasRemaining) startRemediation();
  else startDeck(currentDeckId, { reviewAll: true });
});
elements.summaryHomeButton.addEventListener('click', leaveStudy);
elements.summaryResetButton.addEventListener('click', () => {
  const deckId = currentDeckId;
  askConfirmation({
    title: `Đặt lại ${deckLabel(deckId)}?`,
    message: 'Toàn bộ tiến độ của bài sẽ bị xóa và bạn sẽ học lại từ thẻ đầu tiên.',
    actionLabel: 'Đặt lại & học lại',
    onConfirm: () => {
      delete state.decks[deckId];
      state.lastDeckId = deckId;
      saveState();
      startDeck(deckId);
      showToast(`${deckLabel(deckId)} đã được đặt lại.`);
    }
  });
});
elements.resetAllButton.addEventListener('click', () => askConfirmation({
  title: 'Đặt lại toàn bộ?',
  message: 'Tiến độ của cả 53 bài sẽ bị xóa. Lựa chọn giao diện vẫn được giữ lại.',
  actionLabel: 'Xóa tiến độ',
  onConfirm: resetAll
}));

elements.confirmDialog.addEventListener('close', () => {
  if (elements.confirmDialog.returnValue === 'confirm') pendingConfirm?.();
  pendingConfirm = null;
});

$$('.theme-toggle').forEach((button) => button.addEventListener('click', () => {
  applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
}));

elements.installButton.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    openInstallHelp();
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener('appinstalled', () => {
  elements.installButton.hidden = true;
  showToast('N2 Goi đã được cài đặt.');
});

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (standalone) elements.installButton.hidden = true;

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
systemTheme.addEventListener?.('change', (event) => {
  if (!state.theme) applyTheme(event.matches ? 'dark' : 'light', false);
});

let pointerStart = null;
let suppressCardClick = false;

function resetDrag() {
  elements.flashcard.classList.remove('is-dragging');
  elements.flashcard.style.removeProperty('--drag-x');
  elements.flashcard.style.removeProperty('--drag-rotate');
  elements.feedbackLeft.classList.remove('is-visible');
  elements.feedbackRight.classList.remove('is-visible');
  pointerStart = null;
}

elements.flashcard.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  elements.flashcard.setPointerCapture?.(event.pointerId);
});

elements.flashcard.addEventListener('pointermove', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (Math.abs(dy) > Math.abs(dx) && !elements.flashcard.classList.contains('is-dragging')) return;
  elements.flashcard.classList.add('is-dragging');
  const limited = Math.max(-130, Math.min(130, dx));
  elements.flashcard.style.setProperty('--drag-x', `${limited}px`);
  elements.flashcard.style.setProperty('--drag-rotate', `${limited / 28}deg`);
  elements.feedbackLeft.classList.toggle('is-visible', dx < -50);
  elements.feedbackRight.classList.toggle('is-visible', dx > 50);
});

elements.flashcard.addEventListener('pointerup', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dragged = elements.flashcard.classList.contains('is-dragging');
  resetDrag();
  if (!dragged) return;
  suppressCardClick = true;
  if (Math.abs(dx) >= 72) submitAnswer(dx > 0);
  setTimeout(() => { suppressCardClick = false; }, 80);
});
elements.flashcard.addEventListener('pointercancel', resetDrag);
elements.flashcard.addEventListener('click', (event) => {
  if (!suppressCardClick) return;
  event.stopImmediatePropagation();
}, true);

document.addEventListener('keydown', (event) => {
  if (elements.study.hidden || elements.confirmDialog.open || elements.installDialog.open) return;
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    submitAnswer(false);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    submitAnswer(true);
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    flipCard();
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    undoPrevious();
  } else if (event.key === 'Escape') {
    leaveStudy();
  } else if (event.key === ' ' && document.activeElement === document.body) {
    event.preventDefault();
    flipCard();
  }
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

applyTheme(state.theme || (systemTheme.matches ? 'dark' : 'light'), false);
renderHome();
if (storageFailed) showToast('Tiến độ cũ bị lỗi; app đang dùng phiên mới.');
