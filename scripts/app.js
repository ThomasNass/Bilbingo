const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbw43i0MOHgQLfcShdq5HjbQauz6HJ2FOhmpMuLjfHoTnfE22gwm-092lWdVH92Zufg1cw/exec';

const AGE_LABELS = {
  both: 'Båda',
  children: 'Barn',
  adult: 'Vuxen',
};

const state = {
  items: [],
  categories: [],
  selectedItemId: null,
};

const elements = {
  navItems: document.getElementById('nav-items'),
  navCategories: document.getElementById('nav-categories'),
  navGenerator: document.getElementById('nav-generator'),
  logoutBtn: document.getElementById('logout-btn'),
  itemPage: document.getElementById('item-page'),
  categoryPage: document.getElementById('category-page'),
  generatorPage: document.getElementById('generator-page'),
  openAddModal: document.getElementById('open-add-modal'),
  addModal: document.getElementById('add-modal'),
  addForm: document.getElementById('add-form'),
  addText: document.getElementById('add-text'),
  addCategoryCheckboxes: document.getElementById('add-category-checkboxes'),
  addAge: document.getElementById('add-age'),
  itemList: document.getElementById('item-list'),
  openAddCategoryModal: document.getElementById('open-add-category-modal'),
  addCategoryModal: document.getElementById('add-category-modal'),
  addCategoryForm: document.getElementById('add-category-form'),
  addCategoryName: document.getElementById('add-category-name'),
  categoryList: document.getElementById('category-list'),
  editForm: document.getElementById('edit-form'),
  editText: document.getElementById('edit-text'),
  editCategoryCheckboxes: document.getElementById('edit-category-checkboxes'),
  editAge: document.getElementById('edit-age'),
  cancelEdit: document.getElementById('cancel-edit'),
  generatorForm: document.getElementById('generator-form'),
  gridSize: document.getElementById('grid-size'),
  rowRulesContainer: document.getElementById('row-rules-container'),
  generatorAge: document.getElementById('generator-age'),
  boardContainer: document.getElementById('board-container'),
  clearBoardButton: document.getElementById('clear-board'),
  loginModal: document.getElementById('login-modal'),
  loginForm: document.getElementById('login-form'),
  loginName: document.getElementById('login-name'),
  loginPassword: document.getElementById('login-password'),
};

function showPage(page) {
  elements.itemPage.classList.toggle('hidden', page !== 'items');
  elements.categoryPage.classList.toggle('hidden', page !== 'categories');
  elements.generatorPage.classList.toggle('hidden', page !== 'generator');
}

function normalizeCategories(text) {
  return text
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
}

function getCategoryNameById(id) {
  const category = state.categories.find((category) => category.id === id);
  return category ? category.name : id;
}

function getCategoryIdByName(name) {
  const category = state.categories.find((category) => category.name === name);
  return category ? category.id : null;
}

function normalizeItemCategories(value) {
  return value
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean)
    .map((category) => getCategoryIdByName(category) || category);
}

async function apiRequest(action, payload = {}) {
  const userId = sessionStorage.getItem('bilbingo_userId') || '';
  const token = sessionStorage.getItem('bilbingo_token') || '';
  const body = { action, payload, auth: {} };
  if (userId) body.auth.userId = userId;
  if (token) body.auth.token = token;

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'API-fel');
  }

  return result;
}

async function apiGetAllData() {
  const res = await apiRequest('readAll', {});
  return res.result;
}

async function loadRemoteData() {
  try {
    const data = await apiGetAllData();
    state.items = data.items || [];
    state.categories = data.categories || [];
    renderItems();
    renderCategories();
    renderCategoryCheckboxes(elements.addCategoryCheckboxes);
    renderCategoryCheckboxes(elements.editCategoryCheckboxes);
    renderRowRulesForm(getRowRulesFromForm());
  } catch (error) {
    alert(`Kunde inte läsa data: ${error.message}`);
  }
}

function renderCategoryCheckboxes(container, selectedCategories = []) {
  container.innerHTML = '';
  if (!state.categories.length) {
    container.innerHTML = '<small>Inga kategorier tillgängliga. Lägg till någon kategori först.</small>';
    return;
  }

  const selectedSet = new Set((selectedCategories || []).map((value) => value && value.toString().trim()));

  state.categories.forEach((category) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category.id;
    checkbox.checked = selectedSet.has(category.id && category.id.toString().trim());
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(category.name));
    container.appendChild(label);
  });
}

function renderRowCategoryOptions(select, selectedCategory = '') {
  select.innerHTML = '';
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = state.categories.length ? 'Ingen' : 'Inga kategorier';
  select.appendChild(noneOption);

  state.categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  });

  select.value = selectedCategory || '';
  select.disabled = !state.categories.length;
}

function renderRowRulesForm(savedRows = []) {
  const container = elements.rowRulesContainer;
  if (!container) return;

  const size = Number(elements.gridSize.value) || 5;
  container.innerHTML = '';

  for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
    const savedRule = savedRows[rowIndex] || { rule: 'random', category: '' };

    const rowGroup = document.createElement('div');
    rowGroup.className = 'row-rule-row';

    const label = document.createElement('label');
    label.textContent = `Rad ${rowIndex + 1}`;
    rowGroup.appendChild(label);

    const ruleSelect = document.createElement('select');
    ruleSelect.name = 'row-rule';
    ruleSelect.innerHTML = `
      <option value="random">Slumpat</option>
      <option value="single-category">Kategori per rad</option>
    `;
    ruleSelect.value = savedRule.rule;
    rowGroup.appendChild(ruleSelect);

    const categorySelect = document.createElement('select');
    categorySelect.name = 'row-category';
    renderRowCategoryOptions(categorySelect, savedRule.category);
    categorySelect.disabled = ruleSelect.value !== 'single-category';
    rowGroup.appendChild(categorySelect);

    ruleSelect.addEventListener('change', () => {
      categorySelect.disabled = ruleSelect.value !== 'single-category';
    });

    container.appendChild(rowGroup);
  }
}

function getRowRulesFromForm() {
  const container = elements.rowRulesContainer;
  if (!container) return [];

  return Array.from(container.querySelectorAll('.row-rule-row')).map((rowGroup) => {
    const ruleSelect = rowGroup.querySelector('select[name="row-rule"]');
    const categorySelect = rowGroup.querySelector('select[name="row-category"]');
    return {
      rule: ruleSelect ? ruleSelect.value : 'random',
      category: categorySelect ? categorySelect.value : '',
    };
  });
}

function getSelectedCategories(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value,
  );
}

function renderCategories() {
  const table = elements.categoryList;
  table.innerHTML = '';

  const headerRow = document.createElement('tr');
  ['Kategori', 'Åtgärder'].forEach((heading) => {
    const th = document.createElement('th');
    th.textContent = heading;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  if (!state.categories.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 2;
    emptyCell.textContent = 'Inga kategorier ännu';
    emptyCell.className = 'empty-cell';
    emptyRow.appendChild(emptyCell);
    table.appendChild(emptyRow);
    return;
  }

  state.categories.forEach((category) => {
    const row = document.createElement('tr');
    const categoryCell = document.createElement('td');
    categoryCell.textContent = category.name;
    row.appendChild(categoryCell);

    const actionsCell = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.textContent = 'Redigera';
    editButton.className = 'btn-edit';
    editButton.addEventListener('click', () => enterCategoryEdit(row, category));
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Ta bort kategori';
    removeButton.className = 'btn-delete';
    removeButton.addEventListener('click', async () => {
      if (!confirm(`Ta bort kategori “${category.name}”? Detta tar bort kategorin från alla bingoföremål.`)) {
        return;
      }
      try {
        await apiRequest('deleteCategory', { id: category.id });
        await loadRemoteData();
      } catch (error) {
        alert(`Kunde inte ta bort kategori: ${error.message}`);
      }
    });
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(removeButton);
    row.appendChild(actionsCell);

    table.appendChild(row);
  });
}

function enterCategoryEdit(row, category) {
  row.innerHTML = '';

  const nameCell = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = category.name;
  input.className = 'category-edit-input';
  nameCell.appendChild(input);
  row.appendChild(nameCell);

  const actionsCell = document.createElement('td');
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Spara';
  saveButton.className = 'btn-add';
  saveButton.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name || name === category.name) {
      renderCategories();
      return;
    }
    try {
      await updateCategory(category.id, name);
      await loadRemoteData();
    } catch (error) {
      alert(`Kunde inte uppdatera kategori: ${error.message}`);
    }
  });

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Avbryt';
  cancelButton.addEventListener('click', () => renderCategories());

  actionsCell.appendChild(saveButton);
  actionsCell.appendChild(cancelButton);
  row.appendChild(actionsCell);
}

function renderItems() {
  const table = elements.itemList;
  table.innerHTML = '';

  const headerRow = document.createElement('tr');
  ['Föremål', 'Kategorier', 'Ålder', 'Åtgärder'].forEach((heading) => {
    const th = document.createElement('th');
    th.textContent = heading;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  if (!state.items.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.textContent = 'Inga bingoföremål ännu';
    emptyCell.className = 'empty-cell';
    emptyRow.appendChild(emptyCell);
    table.appendChild(emptyRow);
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement('tr');
    const ageLabel = AGE_LABELS[item.age] || item.age;

    const textCell = document.createElement('td');
    textCell.textContent = item.text;
    row.appendChild(textCell);

    const categoryCell = document.createElement('td');
    categoryCell.textContent = item.categories
      .map((id) => getCategoryNameById(id))
      .join(', ') || 'Ingen kategori';
    row.appendChild(categoryCell);

    const ageCell = document.createElement('td');
    ageCell.textContent = ageLabel;
    row.appendChild(ageCell);

      const actionsCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.textContent = 'Redigera';
        editButton.className = 'btn-edit';
      editButton.addEventListener('click', () => openEdit(item.id));
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Ta bort';
        removeButton.className = 'btn-delete';
        removeButton.addEventListener('click', () => deleteItem(item.id));
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(removeButton);
    row.appendChild(actionsCell);

    table.appendChild(row);
  });
}

async function addItem(text, categories, age) {
  try {
    await apiRequest('addItem', { text, categories: categories.map((id) => id.toString()), age });
    await loadRemoteData();
  } catch (error) {
    alert(`Kunde inte spara bingoföremålet: ${error.message}`);
  }
}

async function addCategory(name) {
  try {
    await apiRequest('addCategory', { name });
    await loadRemoteData();
  } catch (error) {
    alert(`Kunde inte lägga till kategori: ${error.message}`);
  }
}

async function updateCategory(id, name) {
  try {
    await apiRequest('updateCategory', { id, name });
    await loadRemoteData();
  } catch (error) {
    alert(`Kunde inte uppdatera kategori: ${error.message}`);
  }
}

async function deleteItem(itemId) {
  const item = state.items.find((item) => item.id === itemId);
  if (!item) return;
  if (!confirm(`Ta bort bingoföremålet “${item.text}”?`)) {
    return;
  }
  try {
    await apiRequest('deleteItem', { id: itemId });
    await loadRemoteData();
  } catch (error) {
    alert(`Kunde inte ta bort bingoföremålet: ${error.message}`);
  }
}

function openEdit(itemId) {
  const item = state.items.find((item) => item.id === itemId);
  if (!item) return;
  state.selectedItemId = itemId;
  elements.editText.value = item.text;

  const selectedCategories = Array.isArray(item.categories)
    ? item.categories
    : item.categories && item.categories.toString().split(',').map((value) => value.trim()).filter(Boolean);

  renderCategoryCheckboxes(elements.editCategoryCheckboxes, selectedCategories);
  elements.editAge.value = item.age;

  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeEdit() {
  state.selectedItemId = null;
  elements.editForm.reset();
  elements.editCategoryCheckboxes.innerHTML = '';
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function closeAdd() {
  if (elements.addForm) elements.addForm.reset();
  if (elements.addCategoryCheckboxes) elements.addCategoryCheckboxes.innerHTML = '';
  const modal = document.getElementById('add-modal');
  if (modal) modal.classList.add('hidden');
}

function closeAddCategory() {
  if (elements.addCategoryForm) elements.addCategoryForm.reset();
  const modal = document.getElementById('add-category-modal');
  if (modal) modal.classList.add('hidden');
}

async function updateItem(itemId, text, categories, age) {
  try {
    await apiRequest('updateItem', { id: itemId, text, categories, age });
    await loadRemoteData();
  } catch (error) {
    alert(`Kunde inte uppdatera bingoföremålet: ${error.message}`);
  }
}

function filterByAge(items, age) {
  return items.filter((item) => age === 'both' || item.age === age || item.age === 'both');
}

function createBoard(size, rowRules, age) {
  const filteredItems = filterByAge(state.items, age);
  if (!filteredItems.length) {
    elements.boardContainer.textContent = 'Inga bingoföremål matchar urvalet.';
    return;
  }

  const board = document.createElement('div');
  board.className = 'board';
  board.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

  const items = [...filteredItems];
  const used = new Set();
  const rules = Array.isArray(rowRules) ? rowRules : [];

  for (let row = 0; row < size; row += 1) {
    const rowRule = rules[row] || { rule: 'random', category: '' };
    const rowItems = [];
    const availableItems = items.filter((item) => !used.has(item.id));

    if (rowRule.rule === 'single-category' && rowRule.category) {
      const categoryItems = availableItems.filter((item) => item.categories.includes(rowRule.category));
      if (categoryItems.length >= size) {
        shuffle(categoryItems);
        rowItems.push(...categoryItems.slice(0, size));
      } else {
        shuffle(availableItems);
        rowItems.push(...availableItems.slice(0, size));
      }
    } else {
      shuffle(availableItems);
      rowItems.push(...availableItems.slice(0, size));
    }

    rowItems.forEach((item) => {
      if (item) {
        used.add(item.id);
        const button = document.createElement('button');
        button.textContent = item.text;
        board.appendChild(button);
      } else {
        const button = document.createElement('button');
        button.textContent = '...';
        board.appendChild(button);
      }
    });
  }

  elements.boardContainer.innerHTML = '';
  elements.boardContainer.appendChild(board);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function setupEventListeners() {
  elements.navItems.addEventListener('click', () => showPage('items'));
  elements.navCategories.addEventListener('click', () => showPage('categories'));
  elements.navGenerator.addEventListener('click', () => showPage('generator'));

  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('bilbingo_userId');
      sessionStorage.removeItem('bilbingo_token');
      elements.logoutBtn.classList.add('hidden');
      showLoginModal();
    });
  }

  // Open add modal
  if (elements.openAddModal) {
    elements.openAddModal.addEventListener('click', () => {
      renderCategoryCheckboxes(elements.addCategoryCheckboxes);
      const modal = document.getElementById('add-modal');
      if (modal) modal.classList.remove('hidden');
      if (elements.addText) elements.addText.focus();
    });
  }

  // Open add-category modal
  if (elements.openAddCategoryModal) {
    elements.openAddCategoryModal.addEventListener('click', () => {
      const modal = document.getElementById('add-category-modal');
      if (modal) modal.classList.remove('hidden');
      if (elements.addCategoryName) elements.addCategoryName.focus();
    });
  }

  // Add-category form submit (modal)
  if (elements.addCategoryForm) {
    elements.addCategoryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = elements.addCategoryName ? elements.addCategoryName.value.trim() : '';
      if (!name || state.categories.some((item) => item.name === name)) return;
      try {
        await addCategory(name);
        closeAddCategory();
      } catch (error) {
        alert(`Kunde inte lägga till kategori: ${error.message}`);
      }
    });
  }

  // Add form submit (modal)
  if (elements.addForm) {
    elements.addForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = elements.addText.value.trim();
      if (!text) return;
      await addItem(
        text,
        getSelectedCategories(elements.addCategoryCheckboxes),
        elements.addAge.value,
      );
      closeAdd();
    });
  }

  elements.editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedItemId) return;
    await updateItem(
      state.selectedItemId,
      elements.editText.value.trim(),
      getSelectedCategories(elements.editCategoryCheckboxes),
      elements.editAge.value,
    );
    closeEdit();
  });

  elements.cancelEdit.addEventListener('click', closeEdit);
  const closeModalButton = document.getElementById('close-edit-modal');
  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeEdit);
  }

  const editModal = document.getElementById('edit-modal');
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) {
        closeEdit();
      }
    });
  }

  const closeAddButton = document.getElementById('close-add-modal');
  if (closeAddButton) {
    closeAddButton.addEventListener('click', closeAdd);
  }

  const cancelAddBtn = document.getElementById('cancel-add');
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', closeAdd);
  }

  const addModalEl = document.getElementById('add-modal');
  if (addModalEl) {
    addModalEl.addEventListener('click', (event) => {
      if (event.target === addModalEl) {
        closeAdd();
      }
    });
  }

  const closeAddCategoryBtn = document.getElementById('close-add-category-modal');
  if (closeAddCategoryBtn) {
    closeAddCategoryBtn.addEventListener('click', closeAddCategory);
  }

  const cancelAddCategoryBtn = document.getElementById('cancel-add-category');
  if (cancelAddCategoryBtn) {
    cancelAddCategoryBtn.addEventListener('click', closeAddCategory);
  }

  const addCategoryModalEl = document.getElementById('add-category-modal');
  if (addCategoryModalEl) {
    addCategoryModalEl.addEventListener('click', (event) => {
      if (event.target === addCategoryModalEl) {
        closeAddCategory();
      }
    });
  }

  // Login form submit
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = elements.loginName.value.trim();
      const password = elements.loginPassword.value;
      if (!name || !password) return;
      try {
        const res = await apiRequest('login', { name, password });
        const loginRes = res.result;
        if (loginRes && loginRes.success && loginRes.userId) {
          sessionStorage.setItem('bilbingo_userId', loginRes.userId);
          if (loginRes.token) sessionStorage.setItem('bilbingo_token', loginRes.token);
          if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
          hideLoginModal();
          await loadRemoteData();
        } else {
          alert('Inloggning misslyckades');
        }
      } catch (err) {
        alert(`Inloggning misslyckades: ${err.message}`);
      }
    });
  }

  if (elements.gridSize) {
    elements.gridSize.addEventListener('change', () => {
      renderRowRulesForm(getRowRulesFromForm());
    });
  }

  elements.generatorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createBoard(
      Number(elements.gridSize.value),
      getRowRulesFromForm(),
      elements.generatorAge.value,
    );
  });

  if (elements.clearBoardButton) {
    elements.clearBoardButton.addEventListener('click', () => {
      if (elements.boardContainer) {
        elements.boardContainer.innerHTML = '';
      }
    });
  }
}

function initialize() {
  showPage('items');
  setupEventListeners();
  const userId = sessionStorage.getItem('bilbingo_userId');
  if (userId) {
    if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
    loadRemoteData();
  } else {
    showLoginModal();
  }
}

function showLoginModal() {
  if (elements.loginModal) elements.loginModal.classList.remove('hidden');
}

function hideLoginModal() {
  if (elements.loginModal) elements.loginModal.classList.add('hidden');
  if (elements.loginForm) elements.loginForm.reset();
}

initialize();
