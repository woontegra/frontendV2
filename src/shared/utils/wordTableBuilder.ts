/**
 * Merkezi Word uyumlu tablo üretim sistemi
 * - border, cellpadding, cellspacing attribute ile (CSS değil)
 * - style, class, div, inline CSS yok
 * - Word'e yapıştırıldığında punto/satır aralığı değiştirilebilir, çizgiler korunur
 */

export function buildWordTable(headers: string[], rows: (string | number)[][]): string {
  let table = '<table border="1" cellpadding="2" cellspacing="0">';

  if (headers && headers.length > 0) {
    table += "<tr>";
    headers.forEach((h) => {
      table += `<td><strong>${h}</strong></td>`;
    });
    table += "</tr>";
  }

  rows.forEach((row) => {
    table += "<tr>";
    row.forEach((cell) => {
      table += `<td>${cell ?? ""}</td>`;
    });
    table += "</tr>";
  });

  table += "</table>";
  return table + "<p>&nbsp;</p>";
}
