<?php
require_once __DIR__ . '/config.php';

$res = aw_fetch_html(ANIMEWORLD_UPSTREAM_URL . '/');
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$cards = aw_parse_cards($xpath);

$latestSeries = array_values(array_filter($cards, fn($c) => $c['type'] === 'series'));
$latestMovies = array_values(array_filter($cards, fn($c) => $c['type'] === 'movie'));

aw_json_response([
    'success' => true,
    'source' => ANIMEWORLD_UPSTREAM_URL,
    'latest_series' => $latestSeries,
    'latest_movies' => $latestMovies,
]);
