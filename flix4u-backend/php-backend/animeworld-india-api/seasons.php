<?php
require_once __DIR__ . '/config.php';

$seriesID = trim((string)($_GET['seriesID'] ?? $_GET['seriesId'] ?? ''));
if ($seriesID === '') {
    aw_json_response(['success' => false, 'error' => 'Missing seriesID parameter'], 400);
}

$res = aw_fetch_html(ANIMEWORLD_UPSTREAM_URL . '/series/' . urlencode($seriesID) . '/');
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$titleNode = $xpath->query("//h1[contains(@class,'hero-title') or contains(@class,'entry-title')]")->item(0);
$title = $titleNode ? trim($titleNode->textContent) : $seriesID;

$posterNode = $xpath->query("//*[contains(@class,'hero-poster')]//img | //*[contains(@class,'post-thumbnail')]//img")->item(0);
$poster = $posterNode instanceof DOMElement ? aw_norm_img($posterNode->getAttribute('data-src') ?: $posterNode->getAttribute('src')) : null;

$descNode = $xpath->query("//*[@id='overview-text']//p | //*[contains(@class,'description')]//p")->item(0);
$description = $descNode ? trim($descNode->textContent) : null;

$badges = [];
$badgeNodes = $xpath->query("//*[contains(@class,'hero-badge')]");
if ($badgeNodes) {
    foreach ($badgeNodes as $b) {
        $txt = trim($b->textContent);
        if ($txt !== '') $badges[] = $txt;
    }
}
$year = null;
$totalEpisodes = 0;
foreach ($badges as $b) {
    if (preg_match('/^\d{4}$/', $b)) $year = $b;
    if (preg_match('/(\d+)\s*Eps?/i', $b, $m)) $totalEpisodes = (int)$m[1];
}

$languages = [];
$langNodes = $xpath->query("//a[contains(@class,'language-tag')]");
if ($langNodes) {
    foreach ($langNodes as $ln) {
        $l = trim($ln->textContent);
        if ($l !== '' && !in_array($l, $languages, true)) $languages[] = $l;
    }
}

$seasons = [];
$sumEps = 0;
$seasonNodes = $xpath->query("//a[contains(@class,'season-btn') and contains(@class,'sel-temp')]");
if ($seasonNodes) {
    foreach ($seasonNodes as $btn) {
        if (!($btn instanceof DOMElement)) continue;
        $postId = $btn->getAttribute('data-post');
        $seasonNum = $btn->getAttribute('data-season') ?: '1';
        $labelNode = $xpath->query(".//*[contains(@class,'season-label')]", $btn)->item(0);
        $epsNode = $xpath->query(".//*[contains(@class,'season-episodes')]", $btn)->item(0);
        $seasonName = $labelNode ? trim($labelNode->textContent) : "Season {$seasonNum}";
        $episodesText = $epsNode ? trim($epsNode->textContent) : '';
        if (preg_match('/\((\d+)\)/', $episodesText, $m) || preg_match('/^(\d+)/', $episodesText, $m)) {
            $sumEps += (int)$m[1];
        }
        $seasons[] = [
            'seasonNumber' => $seasonNum,
            'seasonName' => $seasonName,
            'episodes' => $episodesText,
            'seasonId' => $postId ? "{$seriesID}__post-{$postId}__season-{$seasonNum}" : "{$seriesID}-season-{$seasonNum}",
            'postId' => $postId,
            'isSubOnly' => str_contains($btn->getAttribute('class'), 'non-regional'),
        ];
    }
}

if (count($seasons) === 0) {
    $epNodes = $xpath->query("//article[contains(@class,'tr-episode-card')]");
    $cnt = $epNodes ? $epNodes->length : 0;
    $sumEps = $cnt;
    $seasons[] = [
        'seasonNumber' => '1',
        'seasonName' => 'Season 1',
        'episodes' => "{$cnt} Episodes",
        'seasonId' => "{$seriesID}__season-1",
        'isSubOnly' => false,
    ];
}

if ($totalEpisodes === 0) $totalEpisodes = $sumEps;

aw_json_response([
    'success' => true,
    'source' => ANIMEWORLD_UPSTREAM_URL . '/series',
    'series' => [
        'seriesId' => $seriesID,
        'title' => $title,
        'poster' => $poster,
        'banner' => null,
        'year' => $year,
        'rating' => null,
        'totalSeasons' => (string)count($seasons),
        'totalEpisodes' => (string)$totalEpisodes,
        'languages' => $languages,
        'description' => $description,
    ],
    'seasons' => $seasons,
]);
