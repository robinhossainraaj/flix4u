<?php
require_once __DIR__ . '/config.php';

$page = max(1, (int)($_GET['p'] ?? 1));
$url = $page > 1 ? ANIMEWORLD_UPSTREAM_URL . "/series/page/{$page}/" : ANIMEWORLD_UPSTREAM_URL . '/series/';

$res = aw_fetch_html($url);
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$series = array_values(array_filter(aw_parse_cards($xpath), fn($c) => !empty($c['seriesId'])));
$pagination = aw_parse_pagination($xpath, $page);

aw_json_response(array_merge([
    'success' => true,
    'source' => ANIMEWORLD_UPSTREAM_URL . '/series',
    'total_results' => count($series),
    'series' => $series,
], $pagination));
