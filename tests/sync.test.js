const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeActions } = require('../server.js');

test('mergeActions keeps the latest version of each action', () => {
  const existing = [
    { id: 'a1', title: 'Old task', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'a2', title: 'Keep me', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' },
  ];

  const incoming = [
    { id: 'a1', title: 'Updated task', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' },
    { id: 'a3', title: 'New task', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' },
  ];

  const merged = mergeActions(existing, incoming);

  assert.equal(merged.length, 3);
  assert.equal(merged.find((action) => action.id === 'a1').title, 'Updated task');
  assert.equal(merged.find((action) => action.id === 'a2').title, 'Keep me');
  assert.equal(merged.find((action) => action.id === 'a3').title, 'New task');
});
