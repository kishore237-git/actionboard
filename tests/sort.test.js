const test = require('node:test');
const assert = require('node:assert/strict');

const { sortActions, buildDemoActions, sortFocusSuggestions, getFocusReason } = require('../sort-logic.js');

test('priority sort ranks high urgency and importance first', () => {
  const actions = buildDemoActions();
  const sorted = sortActions(actions, 'priority');
  assert.equal(sorted[0].title, 'Launch the new client rollout');
  assert.equal(sorted[1].title, 'Fix the billing outage');
});

test('urgent sort prioritizes urgency above everything else', () => {
  const actions = buildDemoActions();
  const sorted = sortActions(actions, 'urgent');
  assert.equal(sorted[0].title, 'Fix the billing outage');
  assert.equal(sorted[1].title, 'Launch the new client rollout');
});

test('overdue sort brings overdue items to the top', () => {
  const actions = buildDemoActions();
  const sorted = sortActions(actions, 'overdue');
  assert.equal(sorted[0].title, 'Follow up with the landlord');
});

test('focus suggestions favor deadlines, then saved priority', () => {
  const referenceDate = new Date(2026, 9, 28, 12);
  const actions = [
    { id: 'priority', importance: 3, urgency: 3, createdAt: '2026-10-28T08:00:00.000Z' },
    { id: 'today', importance: 1, urgency: 1, dueDate: new Date(2026, 9, 28).toISOString(), createdAt: '2026-10-27T08:00:00.000Z' },
    { id: 'overdue', importance: 2, urgency: 2, dueDate: new Date(2026, 9, 27).toISOString(), createdAt: '2026-10-26T08:00:00.000Z' },
  ];

  assert.deepEqual(
    sortFocusSuggestions(actions, referenceDate).map((action) => action.id),
    ['overdue', 'today', 'priority'],
  );
});

test('focus suggestions explain deadline and priority signals', () => {
  const referenceDate = new Date(2026, 9, 28, 12);
  assert.equal(getFocusReason({
    importance: 2,
    urgency: 2,
    dueDate: new Date(2026, 9, 29).toISOString(),
  }, referenceDate), 'Due tomorrow');
  assert.equal(getFocusReason({ importance: 3, urgency: 3 }, referenceDate), 'High importance and urgency');
});
