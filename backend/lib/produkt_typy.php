<?php
// Whitelist produktových řad → název DB tabulky. Používá se všude, kde by
// se jinak název tabulky skládal z uživatelského vstupu (query param,
// tělo POST requestu) — nikdy nepoužívat vstup přímo v SQL identifikátoru.
const PRODUKT_TABULKY = [
    'caje'     => '01_caje',
    'nadobi'   => '02_nadobi',
    'etnoshop' => '03_etnoshop',
];
