/**
 * PDF/rapor için renkli tablo - mavi/yeşil arka plan, kırmızı negatif değerler
 */
export function buildStyledReportTable(
  headers: string[],
  rows: (string | number)[][],
  opts?: { lastRowBg?: "blue" | "green" }
): string {
  let html = '<table style="width:100%;border-collapse:collapse;border:1px solid #999;font-size:10px">';
  if (headers?.length) {
    html += '<tr style="background:#f3f4f6;font-weight:600">';
    headers.forEach((h, i) => {
      const align = i === headers.length - 1 ? ";text-align:right" : "";
      html += `<td style="border:1px solid #999;padding:5px 8px;font-size:10px${align}"><strong>${h}</strong></td>`;
    });
    html += "</tr>";
  }
  rows.forEach((row, rowIdx) => {
    const isLast = rowIdx === rows.length - 1;
    const bg = opts?.lastRowBg === "green" && isLast ? "#dcfce7" : opts?.lastRowBg === "blue" && isLast ? "#dbeafe" : undefined;
    const rowStyle = bg ? ` style="background:${bg};font-weight:600"` : "";
    html += `<tr${rowStyle}>`;
    row.forEach((cell, cellIdx) => {
      const val = String(cell ?? "");
      const isLastCol = cellIdx === row.length - 1;
      const extra: string[] = [];
      if (isLastCol) extra.push("text-align:right");
      if (val.trimStart().startsWith("-")) extra.push("color:#dc2626");
      else if (val.trimStart().startsWith("+") || (isLast && opts?.lastRowBg === "green" && isLastCol)) extra.push("color:#16a34a");
      const cellStyle = `border:1px solid #999;padding:5px 8px;font-size:10px;${extra.join(";")}`;
      html += `<td style="${cellStyle}">${val}</td>`;
    });
    html += "</tr>";
  });
  return html + "</table>";
}
