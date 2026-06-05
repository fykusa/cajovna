// Částka v Kč s mezerou jako oddělovačem tisíců (1 388 Kč). Prohlížeč použije
// pro cs-CZ pevnou mezeru (NBSP) mezi tisíci.
export const fmtKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`
