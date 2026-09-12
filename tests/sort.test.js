const test = require('node:test');
const assert = require('node:assert/strict');

const { sortActions, buildDemoActions } = require('../sort-logic.js');

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
