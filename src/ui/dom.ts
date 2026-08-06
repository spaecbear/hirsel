export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) n.setAttribute(k, v);
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export function button(cls: string, html: string, onClick: () => void, disabled = false) {
  const b = el("button", { class: cls, type: "button" }, html);
  // the name span is the button's label; the description span is detail
  const name = b.querySelector(".n")?.textContent?.trim();
  if (name) b.setAttribute("aria-label", name);
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

let toastTimer = 0;
export function toast(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("on"), 2400);
}
