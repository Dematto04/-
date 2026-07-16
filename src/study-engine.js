export function shuffleInPlace(items, random = Math.random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

export function createSession(cards, knownIds = [], { reviewAll = false } = {}) {
  const known = new Set(knownIds);
  const queue = reviewAll ? [...cards] : cards.filter((card) => !known.has(card.i));
  return {
    queue,
    history: [],
    known,
    misses: 0,
    answered: 0,
    shuffled: false,
    total: queue.length
  };
}

export function answerCard(session, remembered) {
  const card = session.queue.shift();
  if (!card) return null;

  const wasKnown = session.known.has(card.i);
  session.history.push({ card, wasKnown, remembered });
  session.answered += 1;

  if (remembered) {
    session.known.add(card.i);
  } else {
    session.known.delete(card.i);
    session.misses += 1;
  }

  return card;
}

export function undoAnswer(session) {
  const previous = session.history.pop();
  if (!previous) return null;

  const queuedIndex = session.queue.findIndex((card) => card.i === previous.card.i);
  if (queuedIndex >= 0) session.queue.splice(queuedIndex, 1);
  session.queue.unshift(previous.card);

  if (previous.wasKnown) session.known.add(previous.card.i);
  else session.known.delete(previous.card.i);

  session.answered = Math.max(0, session.answered - 1);
  if (!previous.remembered) session.misses = Math.max(0, session.misses - 1);
  return previous.card;
}

export function shuffleRemaining(session, random = Math.random) {
  shuffleInPlace(session.queue, random);
  session.shuffled = true;
  return session.queue;
}
