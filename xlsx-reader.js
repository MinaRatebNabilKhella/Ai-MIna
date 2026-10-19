// قارئ ملفات Excel (.xlsx) و CSV بدون أي مكتبات خارجية.
// بيرجّع مصفوفة صفوف: [[خلية, خلية, ...], ...] من أول شيت فيه بيانات.
(function () {
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function openZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let i = u8.length - 22;
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('الملف مش xlsx صحيح');
    const count = dv.getUint16(i + 10, true);
    let off = dv.getUint32(i + 16, true);
    const files = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true);
      const elen = dv.getUint16(off + 30, true);
      const clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      files[name] = { method, csize, lho };
      off += 46 + nlen + elen + clen;
    }
    return {
      names: Object.keys(files),
      async text(name) {
        const f = files[name];
        if (!f) return null;
        const ln = dv.getUint16(f.lho + 26, true);
        const le = dv.getUint16(f.lho + 28, true);
        const start = f.lho + 30 + ln + le;
        const data = u8.subarray(start, start + f.csize);
        const out = f.method === 0 ? data : await inflateRaw(data);
        return new TextDecoder().decode(out);
      }
    };
  }

  function colIndex(ref) {
    const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  function xmlDoc(text) {
    return new DOMParser().parseFromString(text, 'application/xml');
  }

  async function readXlsx(buf) {
    const zip = openZip(buf);
    // النصوص المشتركة
    let shared = [];
    const ss = await zip.text('xl/sharedStrings.xml');
    if (ss) {
      const d = xmlDoc(ss);
      shared = [...d.getElementsByTagName('si')].map(si => {
        // نتجاهل النطق الصوتي (rPh) ونجمع النصوص العادية بس
        let s = '';
        const walk = node => {
          for (const c of node.childNodes) {
            if (c.nodeType !== 1) continue;
            if (c.nodeName === 'rPh') continue;
            if (c.nodeName === 't') s += c.textContent;
            else walk(c);
          }
        };
        walk(si);
        return s;
      });
    }
    const sheetNames = zip.names
      .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    for (const name of sheetNames) {
      const d = xmlDoc(await zip.text(name));
      const rows = [];
      for (const r of d.getElementsByTagName('row')) {
        const row = [];
        for (const c of r.getElementsByTagName('c')) {
          const idx = colIndex(c.getAttribute('r') || '');
          const t = c.getAttribute('t');
          const vEl = c.getElementsByTagName('v')[0];
          let val = '';
          if (t === 'inlineStr') {
            val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
          } else if (vEl) {
            const raw = vEl.textContent;
            if (t === 's') val = shared[parseInt(raw)] ?? '';
            else if (t === 'str' || t === 'e') val = raw;
            else if (t === 'b') val = raw === '1' ? 'TRUE' : 'FALSE';
            else val = isNaN(Number(raw)) ? raw : Number(raw);
          }
          row[idx >= 0 ? idx : row.length] = val;
        }
        for (let k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = '';
        rows.push(row);
      }
      if (rows.some(r => r.some(v => String(v).trim() !== ''))) return rows;
    }
    return [];
  }

  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        rows.push(row); row = [];
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  window.readSpreadsheetFile = async function (file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
      return readCsv(await file.text());
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('المتصفح قديم ومش بيدعم قراءة الإكسل. استخدم Chrome أو Edge حديث، أو ارفع الجدول كـ CSV.');
      }
      return readXlsx(await file.arrayBuffer());
    }
    throw new Error('نوع الملف مش مدعوم. ارفع ملف .xlsx أو .csv');
  };
})();
