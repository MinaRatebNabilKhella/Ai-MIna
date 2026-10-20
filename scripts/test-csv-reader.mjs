import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {}, Blob, Response, TextDecoder, DecompressionStream };
vm.createContext(context);
vm.runInContext(fs.readFileSync('xlsx-reader.js', 'utf8'), context, { filename: 'xlsx-reader.js' });

const sample = '\uFEFFاليوم,التاريخ,المادة,الدرس/الموضوع,من,إلى,النوع,ملاحظات\r\nالسبت,,الفيزياء,"الكهربية, الدرس الأول",16:00,18:00,حصة,"سنتر ""النور"""\r\n';
const rows = await context.window.readSpreadsheetFile({ name: 'نموذج-الجدول.csv', text: async () => sample });
assert.equal(rows.length, 2, 'two CSV rows should be parsed');
assert.equal(rows[0][0], 'اليوم', 'UTF-8 BOM should be stripped from the first header');
assert.equal(rows[1][3], 'الكهربية, الدرس الأول', 'commas inside quoted cells should be preserved');
assert.equal(rows[1][7], 'سنتر "النور"', 'escaped quotes should be unescaped');
console.log('CSV reader test passed: Arabic UTF-8 BOM, quoted commas, and escaped quotes.');
