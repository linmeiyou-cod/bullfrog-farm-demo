(() => {
  'use strict';

  const exampleMonth = '2026-11';
  const keyPrefix = 'frog-farm-operations:';
  const monthKey = keyPrefix + 'month';
  const products = {
    feed: { name: '饲料', unit: '包', step: 1 },
    frog: { name: '牛蛙', unit: '斤', step: 0.01 },
  };
  const grades = { red: '红', yellow: '黄', green: '绿' };
  const sampleRows = [
    // 场地编号、面积、饲料存量和销量、牛蛙存量和销量、标记。
    ['JY-01', 18.5, 126, 44, 24600, 8300, 'green'],
    ['JY-02', 12, 82, 26, 15800, 5100, 'yellow'],
    ['JY-03', 9.5, 48, 18, 11200, 3600, 'red'],
    ['ZJ-01', 15, 104, 32, 20500, 6400, 'green'],
    ['ZJ-02', 21, 165, 58, 31800, 10900, 'green'],
    ['ZJ-03', 10.5, 66, 20, 13200, 3700, 'yellow'],
    ['NN-01', 24, 190, 72, 36500, 12800, 'green'],
    ['NN-02', 16, 118, 38, 22400, 7100, 'yellow'],
    ['NN-03', 8, 42, 0, 9200, 2800, 'red'],
    ['NN-04', 13.5, 96, 31, 18900, 5700, 'green'],
    ['CD-01', 14, 87, 25, 18200, 5400, 'green'],
    ['WH-01', 11, 73, 22, 14600, 4200, 'yellow'],
    ['WF-01', 10, 61, 17, 11900, 0, 'red'],
    ['LYG-01', 12.5, 91, 27, 16700, 4800, 'green'],
  ];
  const sampleRecords = new Map(sampleRows.map(([id, area, feedStock, feedSold, frogStock, frogSold, grade]) => [
    id, {
      area, grade,
      stock: { feed: feedStock, frog: frogStock },
      sales: { [exampleMonth]: { feed: feedSold, frog: frogSold } },
    },
  ]));
  const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      throw new Error('当前浏览器无法保存，请确认浏览器允许本机预览保存数据。');
    }
  }

  function validMonth(month) {
    return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('0000');
  }

  function getMonth() {
    const month = readStorage(monthKey);
    return validMonth(month) ? month : exampleMonth;
  }

  function setMonth(month) {
    if (!validMonth(month)) throw new Error('请选择有效的销量月份。');
    writeStorage(monthKey, month);
  }

  function monthText(month) {
    return month.slice(0, 4) + ' 年 ' + Number(month.slice(5)) + ' 月';
  }

  function format(value) {
    return Number.isFinite(value) ? numberFormat.format(value) : '未录入';
  }

  function readFarm(id) {
    const saved = readStorage(keyPrefix + id);
    if (saved) {
      try {
        const record = JSON.parse(saved);
        if (record && record.stock && record.sales) return record;
      } catch {
        // A broken local draft should still let the sample page open.
      }
    }

    const sample = sampleRecords.get(id);
    return sample ? structuredClone(sample)
      : { area: null, grade: '', stock: { feed: null, frog: null }, sales: {} };
  }

  function updateFarm(id, change) {
    const key = keyPrefix + id;
    const save = () => {
      const record = readFarm(id);
      change(record);
      writeStorage(key, JSON.stringify(record));
    };
    return navigator.locks ? navigator.locks.request(key, save) : save();
  }

  function requireAmount(amount, step, positive = false) {
    const scale = step === 1 ? 1 : 100;
    const scaled = Math.round(amount * scale);
    if (!Number.isSafeInteger(scaled) || amount < 0 || (positive && scaled === 0)) {
      throw new Error(positive ? '请输入大于 0 的数量。' : '请输入 0 或大于 0 的数值。');
    }
    if (Math.abs(amount * scale - scaled) > 0.000001) {
      throw new Error(step === 1 ? '请填写整包数量。' : '最多可填写两位小数。');
    }
    return scaled === 0 ? 0 : scaled / scale;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function setArea(id, amount) {
    const area = requireAmount(amount, 0.01);
    return updateFarm(id, record => { record.area = area; });
  }

  function setGrade(id, grade) {
    if (grade && !Object.hasOwn(grades, grade)) throw new Error('请选择红、黄或绿。');
    return updateFarm(id, record => { record.grade = grade; });
  }

  function setSales(id, product, month, amount) {
    if (!validMonth(month)) throw new Error('请选择有效的销量月份。');
    const value = requireAmount(amount, products[product].step);
    return updateFarm(id, record => {
      record.sales[month] = { ...record.sales[month], [product]: value };
    });
  }

  function changeStock(id, product, direction, amount, soldMonth = '') {
    const { name, unit, step } = products[product];
    const value = requireAmount(amount, step, true);
    if (soldMonth && !validMonth(soldMonth)) throw new Error('请选择有效的销量月份。');
    return updateFarm(id, record => {
      const current = record.stock[product] ?? 0;
      if (direction === 'decrease' && value > current) {
        throw new Error(name + '目前剩 ' + format(current) + ' ' + unit + '，请填写库存范围内的数量。');
      }
      const next = round(current + (direction === 'increase' ? value : -value));
      record.stock[product] = requireAmount(next, step);
      if (direction === 'decrease' && soldMonth) {
        const monthSales = { ...record.sales[soldMonth] };
        monthSales[product] = requireAmount(round((monthSales[product] ?? 0) + value), step);
        record.sales[soldMonth] = monthSales;
      }
    });
  }

  function summarize(farms, month) {
    const entries = farms.map(farm => readFarm(farm.id));
    function sum(getValue) {
      const amounts = entries.map(getValue).filter(Number.isFinite);
      return {
        value: amounts.length ? round(amounts.reduce((total, amount) => total + amount, 0)) : null,
        missing: entries.length - amounts.length,
      };
    }
    const counts = { red: 0, yellow: 0, green: 0, unmarked: 0 };
    for (const entry of entries) {
      counts[Object.hasOwn(grades, entry.grade) ? entry.grade : 'unmarked'] += 1;
    }
    return {
      area: sum(entry => entry.area),
      feedStock: sum(entry => entry.stock.feed),
      feedSold: sum(entry => entry.sales[month]?.feed),
      frogStock: sum(entry => entry.stock.frog),
      frogSold: sum(entry => entry.sales[month]?.frog),
      counts,
    };
  }

  function setGradeBadge(badge, grade) {
    badge.dataset.grade = Object.hasOwn(grades, grade) ? grade : '';
    badge.textContent = grades[badge.dataset.grade] || '未标记';
    badge.title = '场地标记';
  }

  function affectsOperations(event) {
    return event.key === null || event.key.startsWith(keyPrefix);
  }

  window.FrogOperations = {
    products, grades, format, monthText, getMonth, setMonth, readFarm,
    setArea, setGrade, setSales, changeStock, summarize, setGradeBadge, affectsOperations,
  };
})();
