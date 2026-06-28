function getBilbingoData() {
  var ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  var sheet = ss.getSheetByName('Items');
  var rows = sheet.getDataRange().getValues();
  var header = rows.shift();
  var items = rows.map(function(row) {
    return {
      text: row[0],
      categories: row[1] ? row[1].split(',').map(function(value) { return value.trim(); }) : [],
      age: row[2] || 'both'
    };
  });
  return ContentService.createTextOutput(JSON.stringify(items)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return getBilbingoData();
}
