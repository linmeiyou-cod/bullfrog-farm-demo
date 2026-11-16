(() => {
  'use strict';

  const operations = window.FrogOperations;
  const farms = window.DEMO_FARMS;
  const monthInput = document.getElementById('overview-month');
  const message = document.getElementById('overview-message');
  const metrics = {
    area: 'overview-area',
    feedStock: 'overview-feed-stock',
    feedSold: 'overview-feed-sold',
    frogStock: 'overview-frog-stock',
    frogSold: 'overview-frog-sold',
  };

  function renderOverview() {
    const month = operations.getMonth();
    const summary = operations.summarize(farms, month);
    monthInput.value = month;
    document.getElementById('overview-farm-count').textContent = farms.length + ' 个场';
    for (const [field, id] of Object.entries(metrics)) {
      const number = document.getElementById(id);
      const missing = document.getElementById(id + '-missing');
      number.textContent = operations.format(summary[field].value);
      number.nextElementSibling.hidden = summary[field].value === null;
      missing.textContent = summary[field].missing + ' 场未录入';
      missing.hidden = summary[field].missing === 0;
    }
    for (const grade of Object.keys(operations.grades)) {
      document.getElementById('overview-' + grade).textContent = summary.counts[grade];
    }
    const unmarked = document.getElementById('overview-unmarked');
    unmarked.textContent = '未标记 ' + summary.counts.unmarked;
    unmarked.hidden = summary.counts.unmarked === 0;
  }

  monthInput.addEventListener('change', () => {
    try {
      operations.setMonth(monthInput.value);
      message.hidden = true;
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
    }
    renderOverview();
  });

  if (location.protocol === 'file:') {
    monthInput.disabled = true;
    const link = document.createElement('a');
    link.href = 'http://127.0.0.1:8766/' + location.hash;
    link.textContent = '打开本机预览查看已保存的养殖数据';
    message.append(link);
    message.hidden = false;
  }

  window.addEventListener('pageshow', renderOverview);
  window.addEventListener('storage', event => {
    if (operations.affectsOperations(event)) renderOverview();
  });
  renderOverview();
})();
