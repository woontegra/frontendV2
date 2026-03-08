/**
 * DOM clone + temizleme ile Word'e uyumlu kopyalama
 * Mevcut tablo DOM'u klonlanır, style/class temizlenir, clipboard'a yazılır
 */

/**
 * Bir tabloyu Word uyumlu hale getirir (clone + temizleme)
 */
function cleanTableForWord(table: HTMLTableElement): HTMLTableElement {
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("style");
    el.removeAttribute("class");
  });
  clone.setAttribute("border", "1");
  clone.setAttribute("cellpadding", "2");
  clone.setAttribute("cellspacing", "0");
  return clone;
}

/**
 * Container içindeki tabloları Word formatına çevirir ve clipboard'a kopyalar
 * @param containerId - Tablo container element id (örn. copyTargetId)
 * @returns true başarılı, false hata
 */
export async function copyTableForWord(containerId: string): Promise<boolean> {
  try {
    const container = document.getElementById(containerId);
    if (!container) return false;

    const tables = container.querySelectorAll("table");
    if (!tables.length) return false;

    const cleanParts: string[] = [];
    tables.forEach((t) => {
      const clean = cleanTableForWord(t);
      cleanParts.push(clean.outerHTML);
    });
    const spacer = "<p>&nbsp;</p>";
    const html = cleanParts.join(spacer);

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return true;
  } catch (err) {
    console.error("copyTableForWord error:", err);
    return false;
  }
}

/**
 * Bölüm bazlı kopyalama – sadece ilgili section'ın tablosunu Word'e kopyalar
 * @param sectionId - data-section değeri (örn. "ust-bilgiler", "ana-hesap")
 */
export async function copySectionForWord(sectionId: string): Promise<boolean> {
  try {
    const section = document.querySelector(`[data-section="${sectionId}"] .section-content`);
    if (!section) return false;
    const table = section.querySelector("table");
    if (!table) return false;
    const clean = cleanTableForWord(table as HTMLTableElement);
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([clean.outerHTML], { type: "text/html" }),
      }),
    ]);
    return true;
  } catch (err) {
    console.error("copySectionForWord error:", err);
    return false;
  }
}
