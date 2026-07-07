<?php
// Zkopíruj tento soubor na config/sheets.php a vyplň hodnoty.
// config/sheets.php NESMÍ být v gitu (je v .gitignore).
return [
    // Sdílené tajemství mezi Apps Script a serverem.
    // Nastav stejnou hodnotu v Apps Script Project Settings → Script Properties → SYNC_TOKEN.
    'sync_token' => 'REPLACE_WITH_RANDOM_SECRET',

    // URL jednotlivých záložek publikovaných jako CSV.
    // Google Sheets → Soubor → Sdílet → Publikovat na webu → záložka → CSV → Publikovat.
    'caje_csv_url'     => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
    'nadobi_csv_url'   => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
    'etnoshop_csv_url' => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
];
