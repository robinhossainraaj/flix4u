<?php
require_once __DIR__ . '/config.php';

$rawLetter = strtoupper(trim((string)($_GET['letter'] ?? 'A')));
$letter = ($rawLetter === '0-9' || preg_match('/^[A-Z]$/', $rawLetter)) ? $rawLetter : 'A';
$page = max(1, (int)($_GET['p'] ?? 1));

$url = $page > 1
    ? ANIMEWORLD_UPSTREAM_URL . '/letter/' . urlencode($letter) . "/page/{$page}/"
    : ANIMEWORLD_UPSTREAM_URL . '/letter/' . urlencode($letter) . '/';

$res = aw_fetch_html($url);
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$results = aw_parse_cards($xpath);
$pagination = aw_parse_pagination($xpath, $page);

aw_json_response(array_merge([
    'success' => true,
    'letter' => $letter,
    'source' => ANIMEWORLD_UPSTREAM_URL . "/letter/{$letter}",
    'total_results' => count($results),
    'results' => $results,
], $pagination));
