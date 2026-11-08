// Só o perfil de demo acompanha a navegação. Parâmetros como auto e id pertencem à tela de origem.
export function screenHref(href: string, search = location.search): string {
  const profile = new URLSearchParams(search).get("perfil");
  if (!profile) return href;
  const params = new URLSearchParams({ perfil: profile });
  return `${href}${href.includes("?") ? "&" : "?"}${params}`;
}

export function preserveProfileLinks(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-orbis-link]")) {
    link.href = screenHref(link.getAttribute("href") ?? "");
  }
}
