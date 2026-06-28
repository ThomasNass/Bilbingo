const ITEM_SHEET_NAME = 'Items';
const CATEGORY_SHEET_NAME = 'Categories';
const USERS_SHEET_NAME = 'Users';

function doGet(e) {
  const action = (e.parameter.action || 'readAll').toString();
  try {
    // Require credentials on GET to avoid exposing all data.
    const name = e.parameter.name;
    const password = e.parameter.password;
    if (!name || !password) {
      return jsonResponse({ success: false, error: 'Unauthorized. Provide name and password or use POST with auth' }, 401);
    }
    const loginResult = login(name, password);
    if (!loginResult || !loginResult.success) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    const auth = { userId: loginResult.userId };
    const data = getAllData(auth);
    return jsonResponse({ success: true, action, data });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function doPost(e) {
  const body = parseRequestBody(e);
  if (!body || !body.action) {
    return jsonResponse({ success: false, error: 'Missing action in request body' }, 400);
  }

  try {
    ensureSheets();
    let result;
    const auth = body.auth || {};
    // ensure payload has userid when possible
    if (!body.payload) body.payload = {};
    if (!body.payload.userid && auth.userId) body.payload.userid = auth.userId;

    // Validate token for protected actions
    const protectedActions = ['readAll', 'addItem', 'updateItem', 'deleteItem', 'addCategory', 'updateCategory', 'deleteCategory'];
    if (protectedActions.includes(body.action)) {
      const valid = validateAuth(auth);
      if (!valid) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
    }

    switch (body.action) {
      case 'readAll':
        result = getAllData(auth);
        break;
      case 'addItem':
        result = addItem(body.payload);
        break;
      case 'updateItem':
        result = updateItem(body.payload);
        break;
      case 'deleteItem':
        result = deleteItem(body.payload.id, auth);
        break;
      case 'addCategory':
        result = addCategory(body.payload.name, body.payload.userid);
        break;
      case 'updateCategory':
        result = updateCategory(body.payload);
        break;
      case 'deleteCategory':
        result = deleteCategory(body.payload.id, auth);
        break;
      case 'login':
        result = login(body.payload.name, body.payload.password);
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return jsonResponse({ success: true, action: body.action, result });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(ITEM_SHEET_NAME)) {
    const sheet = ss.insertSheet(ITEM_SHEET_NAME);
    sheet.appendRow(['id', 'text', 'categories', 'age', 'userid']);
  } else {
    const sheet = ss.getSheetByName(ITEM_SHEET_NAME);
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (header.length < 5 || header[4].toString().toLowerCase() !== 'userid') {
      // rewrite items to include userid column (empty)
      const rows = sheet.getDataRange().getValues();
      const newRows = [];
      const headerRow = ['id', 'text', 'categories', 'age', 'userid'];
      newRows.push(headerRow);
      rows.slice(1).forEach((row) => {
        if (!row || !row[0]) return;
        const id = row[0];
        const text = row[1] || '';
        const cats = row[2] || '';
        const age = row[3] || 'both';
        newRows.push([id, text, cats, age, '']);
      });
      sheet.clear();
      sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
  }

  if (!ss.getSheetByName(CATEGORY_SHEET_NAME)) {
    const sheet = ss.insertSheet(CATEGORY_SHEET_NAME);
    sheet.appendRow(['id', 'name', 'userid']);
  } else {
    const sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // If header is old single-column 'name', migrate to id,name,userid
    if (header.length === 1 && header[0].toString().toLowerCase() === 'name') {
      const rows = sheet.getDataRange().getValues().slice(1);
      sheet.clear();
      sheet.appendRow(['id', 'name', 'userid']);
      rows.forEach((row) => {
        const name = row[0] ? row[0].toString().trim() : '';
        if (name) {
          sheet.appendRow([Utilities.getUuid(), name, '']);
        }
      });
    } else {
      // ensure userid column exists
      if (header.length < 3 || header[2].toString().toLowerCase() !== 'userid') {
        const rows = sheet.getDataRange().getValues();
        const newRows = [];
        newRows.push(['id', 'name', 'userid']);
        rows.slice(1).forEach((row) => {
          if (!row || !row[0]) return;
          const id = row[0];
          const name = row[1] || '';
          const userid = row[2] || '';
          newRows.push([id, name, userid]);
        });
        sheet.clear();
        sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
      }
    }
  }

  // Ensure users sheet
  if (!ss.getSheetByName(USERS_SHEET_NAME)) {
    const sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(['id', 'name', 'password', 'token', 'tokenExpiry']);
  } else {
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (header.length < 5 || header[3].toString().toLowerCase() !== 'token' || header[4].toString().toLowerCase() !== 'tokenexpiry') {
      const rows = sheet.getDataRange().getValues();
      const newRows = [];
      newRows.push(['id', 'name', 'password', 'token', 'tokenExpiry']);
      rows.slice(1).forEach((row) => {
        if (!row || !row[0]) return;
        const id = row[0];
        const name = row[1] || '';
        const password = row[2] || '';
        const token = row[3] || '';
        const tokenExpiry = row[4] || '';
        newRows.push([id, name, password, token, tokenExpiry]);
      });
      sheet.clear();
      sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
  }
}

function getAllData(auth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets();

  const itemSheet = ss.getSheetByName(ITEM_SHEET_NAME);
  const categorySheet = ss.getSheetByName(CATEGORY_SHEET_NAME);

  const itemRows = itemSheet.getDataRange().getValues();
  const categoryRows = categorySheet.getDataRange().getValues();

  // Normalize categories and include userid
  const categories = categoryRows.slice(1)
    .map((row) => {
      if (!row || !row[0]) return null;
      return {
        id: row[0].toString(),
        name: row[1] ? row[1].toString() : '',
        userid: row[2] ? row[2].toString() : '',
      };
    })
    .filter((c) => c && c.name);

  // Map of name->id per userid and global id map
  const categoriesByNameAndUser = {};
  const categoriesById = {};
  categories.forEach((c) => {
    categoriesById[c.id] = c;
    const key = `${c.userid}::${c.name}`;
    categoriesByNameAndUser[key] = c.id;
  });

  const items = itemRows.slice(1)
    .filter((row) => row[0])
    .map((row) => {
      const rawCategories = row[2]
        ? row[2].toString().split(',').map((value) => value.trim()).filter(Boolean)
        : [];
      const userid = row[4] ? row[4].toString() : '';
      const categoriesForItem = rawCategories.map((categoryValue) => {
        // categoryValue may be id or name
        if (categoriesById[categoryValue]) return categoryValue;
        const key = `${userid}::${categoryValue}`;
        return categoriesByNameAndUser[key] || categoryValue;
      });
      return {
        id: row[0],
        text: row[1],
        categories: categoriesForItem,
        age: row[3] || 'both',
        userid,
      };
    });

  const normalizedCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    userid: category.userid,
  }));

  if (needsCategorySheetRewrite(categoryRows, categories)) {
    rewriteCategorySheet(categorySheet, normalizedCategories);
  }

  // If no auth or no userId provided, don't return any user-scoped data
  const userId = auth && auth.userId ? auth.userId.toString() : '';
  if (!userId) {
    return { items: [], categories: [] };
  }

  const filteredItems = items.filter((it) => (it.userid || '') === userId);
  const filteredCategories = normalizedCategories.filter((c) => (c.userid || '') === userId);

  return { items: filteredItems, categories: filteredCategories };
}

function normalizeCategoryRow(row) {
  if (!row || !row[0]) {
    return null;
  }

  const first = row[0].toString().trim();
  const second = row[1] ? row[1].toString().trim() : '';

  if (second) {
    return {
      id: first,
      name: second,
    };
  }

  const uuidPattern = /^[0-9a-fA-F-]{36}$/;
  if (uuidPattern.test(first)) {
    return null;
  }

  return {
    id: Utilities.getUuid(),
    name: first,
  };
}

function needsCategorySheetRewrite(categoryRows, normalizedCategories) {
  if (categoryRows.length - 1 !== normalizedCategories.length) {
    return true;
  }
  for (let i = 0; i < normalizedCategories.length; i += 1) {
    const row = categoryRows[i + 1];
    const normalized = normalizedCategories[i];
    if (!row || row.length < 2 || row[0] !== normalized.id || row[1] !== normalized.name) {
      return true;
    }
  }
  return false;
}

function rewriteCategorySheet(sheet, normalizedCategories) {
  const headerRow = ['id', 'name'];
  const values = [headerRow].concat(normalizedCategories.map((category) => [category.id, category.name]));
  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function addItem(payload) {
  validateItemPayload(payload);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ITEM_SHEET_NAME);
  ensureSheets();

  const id = payload.id || Utilities.getUuid();
  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const categories = resolveCategoryIds(rawCategories, payload.userid);
  const text = payload.text ? payload.text.toString().trim() : '';

  // Check for existing item by text (case-insensitive) to avoid duplicates
  const rows = sheet.getDataRange().getValues();
  // Check for existing item by text + userid (case-insensitive)
  const existingIndex = rows.findIndex((row, index) => {
    if (index === 0) return false;
    const rowText = row[1] ? row[1].toString().trim().toLowerCase() : '';
    const rowUser = row[4] ? row[4].toString() : '';
    return rowText === text.toLowerCase() && rowUser === (payload.userid || '');
  });
  if (existingIndex !== -1) {
    const existingId = rows[existingIndex][0];
    sheet.getRange(existingIndex + 1, 1, 1, 5).setValues([[existingId, text, categories.join(', '), payload.age || 'both', payload.userid || '']]);
    return { id: existingId, text: text, categories, age: payload.age || 'both', existed: true };
  }

  const row = [id, text, categories.join(', '), payload.age || 'both', payload.userid || ''];
  sheet.appendRow(row);

  return { id, text: text, categories, age: payload.age || 'both', existed: false };
}

function updateItem(payload) {
  if (!payload || !payload.id) {
    throw new Error('Missing id for updateItem');
  }
  validateItemPayload(payload);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ITEM_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === payload.id);
  if (rowIndex === -1) {
    throw new Error(`Item not found: ${payload.id}`);
  }

  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const categories = resolveCategoryIds(rawCategories, payload.userid);
  sheet.getRange(rowIndex + 1, 1, 1, 5).setValues([[payload.id, payload.text, categories.join(', '), payload.age || 'both', payload.userid || '']]);

  return { id: payload.id, text: payload.text, categories, age: payload.age || 'both' };
}

function resolveCategoryIds(categories, userid) {
  if (!Array.isArray(categories)) return [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets();
  const sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
  const rows = sheet.getDataRange().getValues().slice(1);
  const byId = {};
  const byNameAndUser = {};
  rows.forEach((row) => {
    const id = row[0] ? row[0].toString() : '';
    const name = row[1] ? row[1].toString() : '';
    const rowUser = row[2] ? row[2].toString() : '';
    if (id) byId[id] = id;
    if (name) byNameAndUser[`${rowUser}::${name}`] = id || '';
  });

  const result = [];
  categories.forEach((value) => {
    if (!value) return;
    const s = value.toString();
    if (byId[s]) {
      result.push(byId[s]);
      return;
    }
    const key = `${userid || ''}::${s}`;
    if (byNameAndUser[key]) {
      result.push(byNameAndUser[key]);
      return;
    }
    // create a new category scoped to userid
    const created = addCategory(s, userid);
    if (created && created.id) {
      result.push(created.id);
      // update maps for subsequent entries
      byId[created.id] = created.id;
      byNameAndUser[`${created.userid || ''}::${created.name}`] = created.id;
    }
  });
  return result;
}

function deleteItem(id) {
  if (!id) {
    throw new Error('Missing id for deleteItem');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ITEM_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);
  if (rowIndex === -1) {
    throw new Error(`Item not found: ${id}`);
  }

  sheet.deleteRow(rowIndex + 1);
  return { deletedId: id };
}

function addCategory(name, userid) {
  if (!name || typeof name !== 'string') {
    throw new Error('Missing or invalid name for addCategory');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const userIdStr = userid || '';
  const existing = rows.slice(1).find((row) => (row[1] === name) && ((row[2] ? row[2].toString() : '') === userIdStr));

  if (existing) {
    return { id: existing[0], name, userid: userIdStr, existed: true };
  }

  const id = Utilities.getUuid();
  sheet.appendRow([id, name, userIdStr]);
  return { id, name, userid: userIdStr, existed: false };
}

function getUserRowById(userId) {
  if (!userId) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row[0] && row[0].toString() === userId.toString()) {
      return { row, rowIndex: i };
    }
  }
  return null;
}

function validateAuth(auth) {
  if (!auth || !auth.userId || !auth.token) return false;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  const found = rows.slice(1).find((r) => (r[0] && r[0].toString() === auth.userId.toString()));
  if (!found) return false;
  const token = found[3] ? found[3].toString() : '';
  const expiry = found[4] ? Number(found[4]) : 0;
  if (!token || token !== auth.token) return false;
  if (!expiry || expiry < now) return false;
  return true;
}

function updateCategory(payload) {
  if (!payload || !payload.id || !payload.name) {
    throw new Error('Missing id or name for updateCategory');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === payload.id);
  if (rowIndex === -1) {
    throw new Error(`Category not found: ${payload.id}`);
  }

  // If userid provided, ensure uniqueness for that user
  const newName = payload.name;
  const newUser = payload.userid ? payload.userid.toString() : '';
  // Check for another category with same name+userid
  const conflict = rows.slice(1).find((row) => (row[1] === newName) && ((row[2] ? row[2].toString() : '') === newUser) && row[0] !== payload.id);
  if (conflict) {
    throw new Error('Another category with the same name exists for this user');
  }

  sheet.getRange(rowIndex + 1, 2).setValue(newName);
  sheet.getRange(rowIndex + 1, 3).setValue(newUser);
  return { id: payload.id, name: newName, userid: newUser };
}

function deleteCategory(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Missing or invalid id for deleteCategory');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const categorySheet = ss.getSheetByName(CATEGORY_SHEET_NAME);
  const rows = categorySheet.getDataRange().getValues();

  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);
  if (rowIndex === -1) {
    throw new Error(`Category not found: ${id}`);
  }

  categorySheet.deleteRow(rowIndex + 1);

  const itemSheet = ss.getSheetByName(ITEM_SHEET_NAME);
  const itemRows = itemSheet.getDataRange().getValues();
  const updatedRows = [itemRows[0]];

  itemRows.slice(1).forEach((row) => {
    if (!row[0]) {
      return;
    }
    const categories = row[2]
      ? row[2].toString().split(',').map((value) => value.trim()).filter(Boolean).filter((categoryId) => categoryId !== id)
      : [];
    updatedRows.push([row[0], row[1], categories.join(', '), row[3]]);
  });

  itemSheet.clear();
  itemSheet.getRange(1, 1, updatedRows.length, updatedRows[0].length).setValues(updatedRows);

  return { deletedCategoryId: id };
}

function addCategories(categories) {
  if (!Array.isArray(categories)) {
    return;
  }
  categories.forEach((category) => addCategory(category));
}

function login(name, password) {
  if (!name || !password) {
    throw new Error('Missing name or password for login');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  // find matching user by name+password
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowName = row[1] ? row[1].toString() : '';
    const rowPassword = row[2] ? row[2].toString() : '';
    if (rowName === name && rowPassword === password) {
      const userId = row[0];
      const token = Utilities.getUuid();
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000); // 24h
      // write token and expiry to sheet
      sheet.getRange(i + 1, 4).setValue(token);
      sheet.getRange(i + 1, 5).setValue(expiry);
      return { success: true, userId: userId, token, expiry };
    }
  }
  return { success: false };
}

function validateItemPayload(payload) {
  if (!payload || typeof payload.text !== 'string' || payload.text.trim() === '') {
    throw new Error('Missing or invalid text for bingoföremål');
  }
  if (payload.age && !['both', 'children', 'adult'].includes(payload.age)) {
    throw new Error('Invalid age value. Allowed: both, children, adult');
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return null;
  }
  return JSON.parse(e.postData.contents);
}

function jsonResponse(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    output.setContent(JSON.stringify({ ...payload, status: statusCode }));
  }
  return output;
}
