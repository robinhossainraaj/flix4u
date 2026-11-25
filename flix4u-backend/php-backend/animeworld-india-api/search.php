<?php
require_once __DIR__ . '/config.php';

$query = trim((string)($_GET['query'] ?? ''));
$page = max(1, (int)($_GET['p'] ?? 1));
if ($query === '') {
    aw_json_response(['success' => false, 'error' => 'Missing query parameter'], 400);
}

$url = $page > 1
    ? ANIMEWORLD_UPSTREAM_URL . "/page/{$page}/?s=" . urlencode($query)
    : ANIMEWORLD_UPSTREAM_URL . '/?s=' . urlencode($query);

$res = aw_fetch_html($url);
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$results = aw_parse_cards($xpath);
$pagination = aw_parse_pagination($xpath, $page);

aw_json_response(array_merge([
    'success' => true,
    'query' => $query,
    'currentPage' => $page,
    'source' => ANIMEWORLD_UPSTREAM_URL . '/search',
    'total_results' => count($results),
    'results' => $results,
], $pagination));
