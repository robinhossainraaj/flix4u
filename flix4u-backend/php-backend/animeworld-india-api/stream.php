<?php
require_once __DIR__ . '/config.php';

$episodeId = trim((string)($_GET['episodeId'] ?? ''));
$movieId = trim((string)($_GET['movieId'] ?? ''));
$lang = strtolower(trim((string)($_GET['lang'] ?? 'hindi')));

if ($episodeId === '' && $movieId === '') {
    aw_json_response(['success' => false, 'error' => 'Missing episodeId or movieId'], 400);
}

$type = $episodeId !== '' ? 'episode' : 'movie';
$targetUrl = $episodeId !== ''
    ? ANIMEWORLD_UPSTREAM_URL . '/episode/' . urlencode($episodeId) . '/'
    : ANIMEWORLD_UPSTREAM_URL . '/movies/' . urlencode($movieId) . '/';

$res = aw_fetch_html($targetUrl);
if (!$res['ok']) {
    aw_json_response(['success' => false, 'error' => $res['error']], $res['status']);
}

$xpath = aw_dom($res['html']);
$titleNode = $xpath->query("//h1[contains(@class,'hero-title') or contains(@class,'episode-title') or contains(@class,'entry-title')]")->item(0);
$title = $titleNode ? trim($titleNode->textContent) : ($episodeId ?: $movieId);
$posterNode = $xpath->query("//*[contains(@class,'hero-poster')]//img | //*[contains(@class,'post-thumbnail')]//img")->item(0);
$poster = $posterNode instanceof DOMElement ? aw_norm_img($posterNode->getAttribute('data-src') ?: $posterNode->getAttribute('src')) : null;
$descNode = $xpath->query("//*[@id='overview-text']//p | //*[contains(@class,'description')]//p")->item(0);
$description = $descNode ? trim($descNode->textContent) : null;

$classifyType = function(string $u): string {
    $l = strtolower($u);
    if (str_contains($l, '.m3u8')) return 'hls';
    if (preg_match('/\.(mp4|webm|mkv)(\?|$)/i', $l)) return 'mp4';
    return 'embed';
};

$iframes = [];
$iframeNodes = $xpath->query("//*[@id='aa-options']//iframe | //*[contains(@class,'video-player')]//iframe | //*[contains(@class,'video-embed')]//iframe");
if ($iframeNodes) {
    foreach ($iframeNodes as $if) {
        if (!($if instanceof DOMElement)) continue;
        $src = trim($if->getAttribute('src') ?: $if->getAttribute('data-src'));
        if ($src !== '' && str_starts_with($src, 'http') && !in_array($src, $iframes, true)) {
            $iframes[] = $src;
        }
    }
}

$streams = [];
$audioLanguages = [];
$hasHindiAudio = false;
$hindiLink = null;

foreach ($iframes as $src) {
    if (str_contains($src, 'multi-lang-plyr.php') && str_contains($src, 'data=')) {
        $parts = parse_url($src);
        parse_str($parts['query'] ?? '', $q);
        if (!empty($q['data'])) {
            $decoded = json_decode(base64_decode($q['data'], true) ?: '', true);
            if (is_array($decoded)) {
                foreach ($decoded as $entry) {
                    $entryLang = trim((string)($entry['language'] ?? ''));
                    $entryUrl = trim((string)($entry['link'] ?? ''));
                    if ($entryLang === '' || $entryUrl === '') continue;
                    if (!in_array($entryLang, $audioLanguages, true)) $audioLanguages[] = $entryLang;
                    if (strtolower($entryLang) === 'hindi' || strtolower($entryLang) === 'hin') {
                        $hasHindiAudio = true;
                        if (!$hindiLink) $hindiLink = $entryUrl;
                    }
                    $streams[] = [
                        'language' => $entryLang,
                        'url' => $entryUrl,
                        'type' => $classifyType($entryUrl),
                        'label' => "AnimeWorld India · {$entryLang} Audio",
                    ];
                }
            }
        }
    }
}

foreach ($iframes as $src) {
    if (str_contains($src, 'multi-lang-plyr.php')) continue;
    $streams[] = [
        'language' => str_contains($src, 'ravok.buzz') ? 'Multi-Audio' : 'Default',
        'url' => $src,
        'type' => $classifyType($src),
        'label' => str_contains($src, 'ravok.buzz') ? 'AnimeWorld India · Multi-Audio' : 'AnimeWorld India · Mirror',
    ];
}

$primaryLink = $hindiLink ?: ($streams[0]['url'] ?? null);
if (!$primaryLink) {
    aw_json_response(['success' => false, 'error' => 'AnimeWorld India returned no playable streamLink.'], 404);
}

aw_json_response([
    'success' => true,
    'type' => $type,
    'source' => $targetUrl,
    'title' => $title,
    'poster' => $poster,
    'banner' => null,
    'year' => null,
    'rating' => null,
    'description' => $description,
    'hasHindiAudio' => $hasHindiAudio,
    'audioLanguages' => $audioLanguages,
    'stream' => [
        'streamLink' => $primaryLink,
        'file' => null,
        'type' => $classifyType($primaryLink),
    ],
    'streams' => $streams,
]);
