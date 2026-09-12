function priorityScore(action) {
  return (Number(action.importance) || 2) * 10 + (Number(action.urgency) || 2) * 7 + (action.completed ? -100 : 0);
}

function isOverdue(action) {
  if (action.completed) return false;

  if (action.dueDate) {
    return new Date(action.dueDate).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  }

  const hoursSinceCreated = (Date.now() - new Date(action.createdAt).getTime()) / (1000 * 60 * 60);
  return (Number(action.urgency) || 2) >= 3 && hoursSinceCreated >= 24;
}

function isDueToday(action) {
  if (!action.dueDate) return false;
  return new Date(action.dueDate).toDateString() === new Date().toDateString();
}

function buildDemoActions() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'demo-1',
      title: 'Launch the new client rollout',
      category: 'work',
      importance: 3,
      urgency: 3,
      notes: 'Need final approval before 10 AM',
      createdAt: new Date(now - 6 * day).toISOString(),
      updatedAt: new Date(now - 6 * day).toISOString(),
      dueDate: new Date(now - 1 * day).toISOString(),
      completed: false,
    },
    {
      id: 'demo-2',
      title: 'Fix the billing outage',
      category: 'work',
      importance: 3,
      urgency: 3,
      notes: 'Customer tickets are increasing quickly',
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 2 * day).toISOString(),
      dueDate: new Date(now - 2 * day).toISOString(),
      completed: false,
    },
    {
      id: 'demo-3',
      title: 'Follow up with the landlord',
      category: 'personal',
      importance: 2,
      urgency: 3,
      notes: 'Need to confirm the repair window',
      createdAt: new Date(now - 4 * day).toISOString(),
      updatedAt: new Date(now - 4 * day).toISOString(),
      dueDate: new Date(now - 1 * day).toISOString(),
      completed: false,
    },
    {
      id: 'demo-4',
      title: 'Book the dentist checkup',
      category: 'personal',
      importance: 1,
      urgency: 2,
      notes: 'Call and confirm the earliest slot',
      createdAt: new Date(now - 10 * day).toISOString(),
      updatedAt: new Date(now - 10 * day).toISOString(),
      dueDate: new Date(now + 2 * day).toISOString(),
      completed: false,
    },
    {
      id: 'demo-5',
      title: 'Plan the weekend workout routine',
      category: 'personal',
      importance: 1,
      urgency: 1,
      notes: 'Light recovery block and stretch plan',
      createdAt: new Date(now - 12 * day).toISOString(),
      updatedAt: new Date(now - 12 * day).toISOString(),
      dueDate: new Date(now + 3 * day).toISOString(),
      completed: false,
    },
  ];
}

function sortActions(actions, sortKey = 'priority') {
  return [...actions].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);

    if (sortKey === 'recent') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (sortKey === 'urgent') {
      const urgencyDiff = (Number(b.urgency) || 2) - (Number(a.urgency) || 2);
      if (urgencyDiff !== 0) return urgencyDiff;
      const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDiff !== 0) return overdueDiff;
      const importanceDiff = (Number(b.importance) || 2) - (Number(a.importance) || 2);
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (sortKey === 'overdue') {
      const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDiff !== 0) return overdueDiff;
      const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
      const scoreDiff = priorityScore(b) - priorityScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (sortKey === 'done') {
      const doneDiff = Number(b.completed) - Number(a.completed);
      if (doneDiff !== 0) return doneDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    const scoreDiff = priorityScore(b) - priorityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

if (typeof window !== 'undefined') {
  window.priorityScore = priorityScore;
  window.isOverdue = isOverdue;
  window.isDueToday = isDueToday;
  window.buildDemoActions = buildDemoActions;
  window.sortActions = sortActions;
}

if (typeof module !== 'undefined') {
  module.exports = {
    priorityScore,
    isOverdue,
    isDueToday,
    buildDemoActions,
    sortActions,
  };
}
