<?php
require_once __DIR__ . '/config.php';

$seasonId = trim((string)($_GET['seasonId'] ?? ''));
if ($seasonId === '') {
    aw_json_response(['success' => false, 'error' => 'Missing seasonId parameter'], 400);
}

$parseEpisodes = function(string $html): array {
    $xpath = aw_dom($html);
    $episodes = [];
    $seen = [];
    $cards = $xpath->query("//article[contains(@class,'tr-episode-card')]");
    if ($cards) {
        foreach ($cards as $card) {
            $link = $xpath->query(".//a[contains(@class,'tr-episode-link')]", $card)->item(0);
            $href = $link instanceof DOMElement ? $link->getAttribute('href') : '';
            $epId = aw_extract_slug($href, 'episode');
            if (!$epId || isset($seen[$epId])) continue;
            $seen[$epId] = true;

            $titleNode = $xpath->query(".//*[contains(@class,'tr-episode-title')] | .//h3 | .//h2", $card)->item(0);
            $numNode = $xpath->query(".//*[contains(@class,'tr-episode-number')]", $card)->item(0);
            $imgNode = $xpath->query('.//img', $card)->item(0);
            $imgSrc = $imgNode instanceof DOMElement ? ($imgNode->getAttribute('data-src') ?: $imgNode->getAttribute('src')) : null;

            $episodes[] = [
                'episodeId' => $epId,
                'title' => $titleNode ? trim($titleNode->textContent) : $epId,
                'episodeNumber' => $numNode ? trim($numNode->textContent) : '',
                'airDate' => null,
                'image' => aw_norm_img($imgSrc),
                'overview' => null,
            ];
        }
    }
    return $episodes;
};

if (preg_match('/^(.+?)__post-(\d+)__season-(\d+)$/', $seasonId, $m)) {
    [, $seriesSlug, $postId, $seasonNum] = $m;
    $ajaxUrl = ANIMEWORLD_UPSTREAM_URL . '/wp-admin/admin-ajax.php?action=action_select_season&season=' . urlencode($seasonNum) . '&post=' . urlencode($postId);
    $res = aw_fetch_html($ajaxUrl);
    if (!$res['ok']) {
        aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
    }
    $episodes = $parseEpisodes($res['html']);
    aw_json_response([
        'success' => true,
        'source' => ANIMEWORLD_UPSTREAM_URL . '/season',
        'season' => [
            'seasonId' => $seasonId,
            'animeTitle' => $seriesSlug,
            'seasonName' => "Season {$seasonNum}",
            'totalEpisodes' => (string)count($episodes),
        ],
        'episodes' => $episodes,
    ]);
}

if (preg_match('/^(.+?)(?:__|-)season-(\d+)$/i', $seasonId, $m)) {
    $seriesSlug = $m[1];
    $seasonNum = $m[2];
} else {
    $seriesSlug = $seasonId;
    $seasonNum = '1';
}

$seriesRes = aw_fetch_html(ANIMEWORLD_UPSTREAM_URL . '/series/' . urlencode($seriesSlug) . '/');
if (!$seriesRes['ok']) {
    aw_json_response(['success' => false, 'error' => $seriesRes['error']], $seriesRes['status']);
}

$xpath = aw_dom($seriesRes['html']);
$titleNode = $xpath->query("//h1[contains(@class,'hero-title') or contains(@class,'entry-title')]")->item(0);
$animeTitle = $titleNode ? trim($titleNode->textContent) : $seriesSlug;
$btnNode = $xpath->query("//a[contains(@class,'season-btn') and @data-season='{$seasonNum}']")->item(0);
$postId = $btnNode instanceof DOMElement ? $btnNode->getAttribute('data-post') : '';

if ($postId && $seasonNum !== '1') {
    $ajaxUrl = ANIMEWORLD_UPSTREAM_URL . '/wp-admin/admin-ajax.php?action=action_select_season&season=' . urlencode($seasonNum) . '&post=' . urlencode($postId);
    $ajaxRes = aw_fetch_html($ajaxUrl);
    $episodes = $ajaxRes['ok'] ? $parseEpisodes($ajaxRes['html']) : [];
} else {
    $episodes = $parseEpisodes($seriesRes['html']);
}

aw_json_response([
    'success' => true,
    'source' => ANIMEWORLD_UPSTREAM_URL . '/season',
    'season' => [
        'seasonId' => $seasonId,
        'animeTitle' => $animeTitle,
        'seasonName' => "Season {$seasonNum}",
        'totalEpisodes' => (string)count($episodes),
    ],
    'episodes' => $episodes,
]);
