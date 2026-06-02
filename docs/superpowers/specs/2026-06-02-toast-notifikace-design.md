# Návrh: Toast notifikace

**Datum:** 2026-06-02
**Stav:** Schváleno k implementaci
**Větev:** `feat/edit-kategorie-pytliky` (toasty sahají do Items/Categories/Bags, které žijí jen tady)

## Cíl

Nahradit dosavadní inline hlášky (`error`/`success` renderované jako `<p>` přímo
v obsahu stránky) **globálním plovoucím toast systémem**. Toasty plují nahoře na
středu, nezasahují do toku stránky (žádné poposkakování obsahu), a aplikace jimi
komunikuje napříč všemi stránkami — úspěch i chyby.

## Výchozí stav

- Hlášky se dnes drží v lokálním stavu stránky (`const [error, setError]`,
  `const [success, setSuccess]`) a renderují inline:
  `{error && <p className={styles.error}>{error}</p>}`. To posouvá obsah stránky.
- Použito v 9 souborech: `Items.tsx`, `Categories.tsx`, `Bags.tsx`, `Users.tsx`,
  `Dashboard.tsx`, `Sales.tsx`, `POS.tsx`, `CheckoutDialog.tsx`, `Login.tsx`.
- `App.tsx` jen renderuje `<AppRouter />`.

## Rozhodnutí

- **Pozice:** nahoře uprostřed, stohované, nejnovější nahoře.
- **Trvání:** úspěch auto-zmizí po 3 s; chyba **nemá auto-dismiss**, zůstane dokud
  ji uživatel nezavře křížkem (×). Oba mají křížek pro ruční zavření.
- **Rozsah:** toasty jen pro **feedback akcí** (uložení/smazání/vytvoření/chyba
  operace, 409, chyby načítání). **Validace formulářů zůstává inline** —
  `Login.tsx` (špatné heslo) a `CheckoutDialog.tsx` (validace u pole) se nemění.

## 1. Architektura a API

Nové soubory v `frontend/src/components/toast/`:

- **`ToastProvider.tsx`** — React context provider. Drží `toasts: Toast[]` ve stavu,
  poskytuje `addToast` a `removeToast`. Obalí appku v `App.tsx`.
- **`useToast.ts`** — hook vracející `{ success, error }`:
  - `success(message: string)` → přidá toast typu `success` (auto-dismiss 3 s).
  - `error(message: string)` → přidá toast typu `error` (bez auto-dismiss).
  - Volání mimo `ToastProvider` → vyhodí srozumitelnou chybu
    (`useToast must be used within ToastProvider`).
- **`ToastContainer.tsx`** — renderuje toasty přes `createPortal(…, document.body)`.
  `position: fixed; top; left/right: 0; margin: 0 auto` (vystředěné), vysoký
  `z-index`, `pointer-events: none` na kontejneru a `pointer-events: auto` na
  jednotlivých toastech (aby klikání mimo toast neblokovalo stránku).
- **`Toast.module.css`** — styly kontejneru a toastů (success zelený, error červený),
  jemný fade/slide-in.

### Datový model

```ts
type ToastType = 'success' | 'error'
interface Toast {
  id: number          // inkrementální / Date.now()+counter
  type: ToastType
  message: string
}
```

### Veřejné rozhraní

```ts
// useToast.ts
interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}
function useToast(): ToastApi
```

Kontext interně vystaví `addToast(type, message)` a `removeToast(id)`;
`useToast` z toho poskládá `success`/`error`.

## 2. Chování

- **Přidání:** nový toast se přidá na začátek pole (newest-on-top). Container ho
  vykreslí nahoře. Každý toast dostane unikátní `id`.
- **Auto-dismiss:** pouze `success` — `ToastProvider` (nebo komponenta toastu)
  nastaví `setTimeout(() => removeToast(id), 3000)`. `error` se neplánuje.
- **Ruční zavření:** každý toast má tlačítko `×` → `removeToast(id)`.
- **Stohování:** víc toastů = sloupec pod sebou (flex column, gap), nejnovější nahoře.
- **Layout:** kontejner je `position: fixed` v portálu na `document.body` →
  nikdy neovlivní rozložení stránek.

## 3. Integrace

Ve stránkách s **feedbackem akcí** se odstraní lokální `error`/`success` state a
inline `<p>` a nahradí voláním `useToast()`:

- **Items.tsx** — `setSuccess('Záznam uložen')` → `toast.success('Záznam uložen')`;
  `setError(…)` (uložení, deaktivace, vytvoření, načítání) → `toast.error(…)`.
  Odstranit `success`/`error` state + inline `<p>`.
- **Categories.tsx**, **Bags.tsx** — `setError(…)` (uložení/přidání/mazání/409/načítání)
  → `toast.error(…)`. Odstranit `error` state + inline `<p>`.
- **Users.tsx** — `setError(…)` → `toast.error(…)`. (Pozn.: chyba u formuláře
  nového uživatele se dnes renderuje uvnitř formuláře — viz níže.)
- **Dashboard.tsx**, **Sales.tsx** — chyby načítání → `toast.error(…)`.
- **POS.tsx** — feedback dokončení prodeje / chyby operace → `toast.*`.

**Zůstává inline (nemění se):**
- **Login.tsx** — chyba přihlášení u formuláře.
- **CheckoutDialog.tsx** — validační hlášky u polí.
- **Users.tsx** — chybu **uvnitř formuláře** nového uživatele (validace jako
  „heslo min. 6 znaků") ponechat inline u formuláře; jen **operační** chyby
  (mazání) jdou do toastu. (Při implementaci rozhodnout per-hláška dle toho, zda
  jde o validaci formuláře, nebo feedback akce.)

Integrace je mechanická a po stránce; každá stránka je samostatný krok.

## 4. Datový tok

1. Stránka zavolá `const toast = useToast()`.
2. Po úspěšné/neúspěšné akci zavolá `toast.success(msg)` / `toast.error(msg)`.
3. `ToastProvider` přidá toast do pole; `ToastContainer` (portal) ho vykreslí.
4. `success` se po 3 s sám odstraní; `error` čeká na klik `×`.

## 5. Ošetření chyb / okrajové případy

- `useToast` mimo provider → vyhodí Error se srozumitelnou zprávou.
- Rychlé opakované akce → víc toastů se stohuje (žádné přepisování).
- Odmountování stránky během běžícího `setTimeout` (success) → provider žije nad
  routami, takže timeout doběhne bez chyby (toast patří provideru, ne stránce).

## 6. Testy

`frontend/src/components/toast/` (vitest + @testing-library/react):

- `ToastProvider.test.tsx` (přes testovací komponentu používající `useToast`):
  - `success` zobrazí zprávu a po 3 s zmizí (`vi.useFakeTimers`).
  - `error` zobrazí zprávu a **nezmizí** sám (po uplynutí času je pořád vidět).
  - klik na `×` u chyby ji odebere.
  - víc toastů se zobrazí současně (stohování).
  - `useToast` mimo provider vyhodí chybu.

Integrace stránek: stávající testy stránek, které ověřovaly inline hlášky
(`409 zobrazí chybu` v Categories/Bags), se upraví tak, aby ověřovaly toast —
buď renderem stránky obalené `ToastProvider` a hledáním textu hlášky kdekoli
v dokumentu, nebo zůstanou na úrovni „API bylo zavoláno". (Detail vyřeší plán.)

## Mimo rozsah

- `info`/`warning` typy toastů (zatím jen `success` a `error`).
- Fronta s limitem počtu / sbalování duplicit.
- Akční tlačítka uvnitř toastu (např. „Vrátit zpět").
- Změna validace formulářů (Login, Checkout zůstávají inline).
