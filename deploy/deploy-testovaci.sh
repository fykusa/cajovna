#!/usr/bin/env bash
# Nahraje frontend/dist + backend/ na Forpsi FTP do /testovaci/.
# frontend/dist/.htaccess (generovaný z frontend/public/.htaccess) obsahuje
# CGIPassAuth On a je identický se živým souborem na serveru — nahrává se.
# Před nahráním dist/ smaže staré soubory ve vzdáleném assets/ (Vite hashuje
# jména při každém buildu, jinak by se tam hromadily zastaralé buildy).
#
# DŮLEŽITÉ: živý server má PLOCHOU strukturu — api/, lib/, config/, config.php,
# db.php atd. přímo v kořeni /testovaci/, ŽÁDNÝ "backend/" podadresář.
# .htaccess rewrite (^api/([^/]+)... -> api/$1.php) je relativní ke kořeni,
# takže cokoli nahrané do .../testovaci/backend/ je mrtvý, web-přístupný
# balast (přesně tahle chyba se stala 2026-07-08 — celý nádobí/etnoshop
# backend nahraný do neexistujícího/nepoužívaného "backend/" podadresáře,
# živý provoz běžel dál na staré verzi bez podpory ?sheet=, proto sync
# nádobí/etnoshopu tiše přesynchronizovával čaje). backend/ se proto
# nahrává přes WHITELIST (api/, lib/, db.php, middleware.php,
# config/.htaccess) PŘÍMO do kořene FTP_REMOTE_PATH, NE do žádného
# podadresáře. backend/index.php se NENAHRÁVÁ — je to mrtvý placeholder
# (echo "jedeme ..."), nic ho nepoužívá, a v kořeni webrootu by mohl
# podle DirectoryIndex kolidovat s index.html z frontend buildu. Repo obsahuje spoustu
# jednorázových/CLI dev skriptů bez auth ochrany (seed*, db_reset.php,
# install.php, dbtest.php, export/import.php, tools/test_*.php) i
# per-prostředí soubory (config.php, config_Forpsi.php, backend/.htaccess) —
# ty všechny NESMÍ na web-přístupný live server, buď protože by je mohl
# kdokoli spustit přes URL (viz incident 2026-07-08 — db_reset.php i
# tools/test_sheets_upsert.php mažou produkční data bez jakékoli autentizace,
# install.php/migrate_kasa.php mají jen předstíranou kontrolu hesla), nebo
# protože obsahují ostrá DB hesla určená jen pro danou instanci.
# Při přidání nového legitimního souboru do backend/ (mimo api/ nebo lib/)
# je nutné WHITELIST níže ručně rozšířit.
#
# Použití: ./deploy/deploy-testovaci.sh
# Vyžaduje deploy/.env.deploy (zkopíruj z .env.deploy.example a vyplň).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

if [ ! -f "$ENV_FILE" ]; then
  echo "Chybí $ENV_FILE — zkopíruj deploy/.env.deploy.example a vyplň FTP údaje." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${FTP_HOST:?FTP_HOST není nastaven v .env.deploy}"
: "${FTP_USER:?FTP_USER není nastaven v .env.deploy}"
: "${FTP_PASS:?FTP_PASS není nastaven v .env.deploy}"
: "${FTP_REMOTE_PATH:?FTP_REMOTE_PATH není nastaven v .env.deploy}"

# bez koncového lomítka, ať se dá spolehlivě skládat "$FTP_REMOTE_PATH/subpath"
FTP_REMOTE_PATH="${FTP_REMOTE_PATH%/}"

# curl provádí -Q (quote) příkazy PŘED přechodem do adresáře z URL — DELE
# proto musí dostat absolutní cestu a cílit na kořen FTP, jinak maže v "/".
clean_remote_dir() {
  local abs_dir="$1"   # absolutní cesta na FTP serveru, např. "${FTP_REMOTE_PATH}/assets"

  local listing
  listing="$(curl --silent --list-only -u "${FTP_USER}:${FTP_PASS}" "ftp://${FTP_HOST}${abs_dir}/" || true)"
  if [ -z "$listing" ]; then
    echo "  (vzdálený adresář je prázdný nebo zatím neexistuje, není co mazat)"
    return
  fi
  while IFS= read -r name; do
    name="${name%$'\r'}"
    [ -z "$name" ] && continue
    [ "$name" = "." ] && continue
    [ "$name" = ".." ] && continue
    echo "  MAŽU: $name"
    curl --silent --show-error -o /dev/null -u "${FTP_USER}:${FTP_PASS}" \
      -Q "DELE ${abs_dir}/${name}" \
      "ftp://${FTP_HOST}/"
  done <<< "$listing"
}

upload_dir() {
  local local_dir="$1"
  local remote_base="$2"

  if [ ! -d "$local_dir" ]; then
    echo "Přeskakuji — neexistuje: $local_dir" >&2
    return
  fi

  while IFS= read -r -d '' file; do
    local rel="${file#"$local_dir"/}"
    echo "NAHRÁVÁM: $rel"
    curl --fail --silent --show-error --ftp-create-dirs \
      -u "${FTP_USER}:${FTP_PASS}" \
      -T "$file" \
      "ftp://${FTP_HOST}${remote_base}/${rel}"
  done < <(find "$local_dir" -type f -print0)
}

upload_file() {
  local local_file="$1"
  local remote_path="$2"

  if [ ! -f "$local_file" ]; then
    echo "Přeskakuji — neexistuje: $local_file" >&2
    return
  fi

  echo "NAHRÁVÁM: ${local_file#"$REPO_ROOT"/}"
  curl --fail --silent --show-error --ftp-create-dirs \
    -u "${FTP_USER}:${FTP_PASS}" \
    -T "$local_file" \
    "ftp://${FTP_HOST}${remote_path}"
}

if [ ! -d "$REPO_ROOT/frontend/dist" ]; then
  echo "frontend/dist neexistuje — nejdřív spusť 'npm run build' ve frontend/." >&2
  exit 1
fi

echo "== Čistím staré hashované soubory ve vzdáleném ${FTP_REMOTE_PATH}/assets =="
clean_remote_dir "${FTP_REMOTE_PATH}/assets"

echo "== Nahrávám frontend/dist -> ${FTP_REMOTE_PATH} =="
upload_dir "$REPO_ROOT/frontend/dist" "$FTP_REMOTE_PATH"

echo "== Nahrávám backend/ -> ${FTP_REMOTE_PATH} (PLOCHO, whitelist, viz komentář nahoře) =="
upload_dir "$REPO_ROOT/backend/api" "${FTP_REMOTE_PATH}/api"
upload_dir "$REPO_ROOT/backend/lib" "${FTP_REMOTE_PATH}/lib"
upload_file "$REPO_ROOT/backend/db.php" "${FTP_REMOTE_PATH}/db.php"
upload_file "$REPO_ROOT/backend/middleware.php" "${FTP_REMOTE_PATH}/middleware.php"
upload_file "$REPO_ROOT/backend/config/.htaccess" "${FTP_REMOTE_PATH}/config/.htaccess"

echo "Hotovo."
