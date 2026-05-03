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

function flashCopySuccess(sectionId?: string): void {
  const active = document.activeElement;
  let btn: HTMLElement | null =
    active instanceof HTMLElement && active.classList.contains("copy-icon-btn") ? active : null;

  if (!btn && sectionId) {
    btn = document.querySelector(
      `[data-section="${sectionId}"] .copy-icon-btn`
    ) as HTMLElement | null;
  }
  if (!btn) return;

  const original = btn.innerHTML;
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  btn.style.color = "#16a34a";
  btn.style.transition = "color 150ms ease";
  btn.setAttribute("title", "Kopyalandı");

  window.setTimeout(() => {
    btn!.innerHTML = original;
    btn!.style.color = "";
    btn!.setAttribute("title", "Word'e kopyala");
  }, 1200);
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
    flashCopySuccess();
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
    flashCopySuccess(sectionId);
    return true;
  } catch (err) {
    console.error("copySectionForWord error:", err);
    return false;
  }
}
