(() => {
  'use strict';

  window.mountFarmOperations = farm => {
    const operations = window.FrogOperations;
    const panel = document.getElementById('farm-operations');
    const monthInput = document.getElementById('farm-month');
    const gradeInput = document.getElementById('farm-grade');
    const gradeBadge = document.getElementById('detail-grade');
    const message = document.getElementById('operation-message');
    const dialog = document.getElementById('operation-dialog');
    const form = document.getElementById('operation-form');
    const amount = document.getElementById('operation-amount');
    const errorMessage = document.getElementById('operation-error');
    const saleField = document.getElementById('operation-record-sale');
    const sold = document.getElementById('operation-sold');
    const saveButton = document.getElementById('save-operation');
    const cancelButton = document.getElementById('cancel-operation');
    let activeAction;

    function showMessage(text, isError = false) {
      message.textContent = text;
      message.classList.toggle('is-error', isError);
      message.hidden = !text;
    }

    function renderValue(id, value) {
      const element = document.getElementById(id);
      element.textContent = operations.format(value);
      element.nextElementSibling.hidden = !Number.isFinite(value);
    }

    function renderFarm() {
      const month = operations.getMonth();
      const record = operations.readFarm(farm.id);
      monthInput.value = month;
      gradeInput.value = record.grade;
      operations.setGradeBadge(gradeBadge, record.grade);
      renderValue('farm-area', record.area);
      for (const product of Object.keys(operations.products)) {
        renderValue('farm-' + product + '-stock', record.stock[product]);
        renderValue('farm-' + product + '-sold', record.sales[month]?.[product]);
      }
    }

    function openEditor(action, product) {
      const record = operations.readFarm(farm.id);
      const month = operations.getMonth();
      const { name, unit, step } = operations.products[product] || { name: '场地面积', unit: '亩', step: 0.01 };
      const descriptions = {
        area: { title: '编辑场地面积', label: '面积', value: record.area, context: '' },
        sales: {
          title: '编辑' + name + '销量', label: '当月累计销量',
          value: record.sales[month]?.[product], context: operations.monthText(month),
        },
        increase: { title: '增加' + name + '存量', label: '增加数量' },
        decrease: { title: '减少' + name + '存量', label: '减少数量' },
      };
      const isStockChange = action === 'increase' || action === 'decrease';
      const context = isStockChange
        ? '当前存量 ' + operations.format(record.stock[product]) + ' ' + unit
        : descriptions[action].context;
      activeAction = { action, product, month, name, unit };
      document.getElementById('operation-title').textContent = descriptions[action].title;
      document.getElementById('operation-amount-label').textContent = descriptions[action].label + '（' + unit + '）';
      const hint = document.getElementById('operation-context');
      hint.textContent = context;
      hint.hidden = !context;
      saleField.hidden = action !== 'decrease';
      sold.checked = false;
      errorMessage.hidden = true;
      amount.step = String(step);
      amount.min = isStockChange ? String(step) : '0';
      amount.inputMode = step === 1 ? 'numeric' : 'decimal';
      amount.value = descriptions[action].value ?? '';
      dialog.showModal();
      amount.focus();
      amount.select();
    }

    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-operation]');
      if (button) openEditor(button.dataset.operation, button.dataset.product);
    });
    cancelButton.addEventListener('click', () => { dialog.close(); });
    dialog.addEventListener('cancel', event => {
      if (saveButton.disabled) event.preventDefault();
    });
    amount.addEventListener('input', () => { errorMessage.hidden = true; });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saveButton.disabled || !activeAction) return;
      const { action, product, month, name, unit } = activeAction;
      const value = amount.valueAsNumber;
      const countAsSold = action === 'decrease' && sold.checked;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      try {
        let savedMessage;
        if (action === 'area') {
          await operations.setArea(farm.id, value);
          savedMessage = '场地面积已保存。';
        } else if (action === 'sales') {
          await operations.setSales(farm.id, product, month, value);
          savedMessage = name + '销量已保存到 ' + operations.monthText(month) + '。';
        } else {
          await operations.changeStock(farm.id, product, action, value, countAsSold ? month : '');
          const verb = action === 'increase' ? '增加' : '减少';
          const quantity = operations.format(value) + ' ' + unit;
          savedMessage = name + '存量已' + verb + ' ' + quantity + '。';
          if (countAsSold) savedMessage += '已计入 ' + operations.monthText(month) + '销量。';
        }
        dialog.close();
        renderFarm();
        showMessage(savedMessage);
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.hidden = false;
        amount.focus();
      } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });

    gradeInput.addEventListener('change', async () => {
      gradeInput.disabled = true;
      try {
        await operations.setGrade(farm.id, gradeInput.value);
        showMessage('场地标记已保存。');
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        gradeInput.disabled = false;
        renderFarm();
      }
    });

    monthInput.addEventListener('change', () => {
      try {
        operations.setMonth(monthInput.value);
        showMessage('');
      } catch (error) {
        showMessage(error.message, true);
      }
      renderFarm();
    });

    if (location.protocol === 'file:') {
      panel.querySelectorAll('button, input, select').forEach(element => { element.disabled = true; });
      const link = document.createElement('a');
      link.href = 'http://127.0.0.1:8766/farm.html?id=' + encodeURIComponent(farm.id);
      link.textContent = '打开本机预览录入养殖数据';
      message.append(link);
      message.hidden = false;
    }

    window.addEventListener('pageshow', renderFarm);
    window.addEventListener('storage', event => {
      if (operations.affectsOperations(event)) renderFarm();
    });
    renderFarm();
  };
})();
