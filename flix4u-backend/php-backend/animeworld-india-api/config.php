<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('ANIMEWORLD_UPSTREAM_URL', rtrim(getenv('ANIMEWORLD_UPSTREAM_URL') ?: 'https://animesky.app', '/'));
define('ANIMEWORLD_HTTP_TIMEOUT', 15);
define('ANIMEWORLD_USER_AGENT', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

function aw_json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function aw_fetch_html(string $url): array {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => ANIMEWORLD_HTTP_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_ENCODING => '',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => [
            'User-Agent: ' . ANIMEWORLD_USER_AGENT,
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
            'Referer: ' . ANIMEWORLD_UPSTREAM_URL . '/',
        ],
    ]);

    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($body === false || $status >= 400 || $status === 0) {
        return [
            'ok' => false,
            'status' => $status ?: 502,
            'html' => '',
            'error' => $err ?: "Upstream returned HTTP {$status}",
        ];
    }

    return ['ok' => true, 'status' => $status, 'html' => $body, 'error' => null];
}

function aw_dom(string $html): DOMXPath {
    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOWARNING | LIBXML_NOERROR);
    libxml_clear_errors();
    return new DOMXPath($dom);
}

function aw_norm_img(?string $src): ?string {
    if (!$src) return null;
    $trimmed = trim($src);
    if ($trimmed === '' || str_starts_with($trimmed, 'data:image/svg')) return null;
    if (str_starts_with($trimmed, '//')) return 'https:' . $trimmed;
    return $trimmed;
}

function aw_extract_slug(string $href, string $segment): ?string {
    if (preg_match('#/' . preg_quote($segment, '#') . '/([^/?#]+)#i', $href, $m)) {
        return trim($m[1]);
    }
    return null;
}

function aw_parse_cards(DOMXPath $xpath): array {
    $items = [];
    $seen = [];
    $nodes = $xpath->query("//article[contains(@class, 'tr-movie-card')]");
    if ($nodes) {
        foreach ($nodes as $card) {
            $linkNode = $xpath->query(".//a[contains(@class, 'tr-movie-link')]", $card)->item(0);
            $href = $linkNode instanceof DOMElement ? $linkNode->getAttribute('href') : '';
            $seriesId = aw_extract_slug($href, 'series');
            $movieId = aw_extract_slug($href, 'movies') ?: aw_extract_slug($href, 'movie');
            $key = $seriesId ? "series:{$seriesId}" : ($movieId ? "movie:{$movieId}" : '');
            if ($key === '' || isset($seen[$key])) continue;
            $seen[$key] = true;

            $imgNode = $xpath->query('.//img', $card)->item(0);
            $imgSrc = $imgNode instanceof DOMElement ? ($imgNode->getAttribute('data-src') ?: $imgNode->getAttribute('src')) : null;
            $titleNode = $xpath->query(".//*[contains(@class, 'tr-movie-title')] | .//h3 | .//h2", $card)->item(0);
            $title = $titleNode ? trim($titleNode->textContent) : '';
            if ($title === '') continue;

            $yearNode = $xpath->query(".//*[contains(@class, 'year') or contains(@class, 'tr-year')]", $card)->item(0);
            $ratingNode = $xpath->query(".//*[contains(@class, 'vote') or contains(@class, 'tr-rating')]", $card)->item(0);

            $entry = [
                'title' => $title,
                'image' => aw_norm_img($imgSrc),
                'year' => $yearNode ? (trim($yearNode->textContent) ?: null) : null,
                'rating' => $ratingNode ? (trim($ratingNode->textContent) ?: null) : null,
                'type' => $seriesId ? 'series' : 'movie',
            ];
            if ($seriesId) $entry['seriesId'] = $seriesId;
            if ($movieId) $entry['movieId'] = $movieId;
            $items[] = $entry;
        }
    }
    return $items;
}

function aw_parse_pagination(DOMXPath $xpath, int $page): array {
    $pages = [];
    $hasNext = false;
    $links = $xpath->query("//nav[contains(@class, 'pagination')]//a | //*[contains(@class, 'pagination')]//a | //*[contains(@class, 'nav-links')]//a");
    if ($links) {
        foreach ($links as $a) {
            $txt = trim($a->textContent);
            if (ctype_digit($txt) && (int)$txt > 0) {
                $pages[] = (int)$txt;
            }
            if (preg_match('/next|›|»/i', $txt)) {
                $hasNext = true;
            }
        }
    }
    $pages = array_values(array_unique($pages));
    sort($pages);
    $totalPages = count($pages) > 0 ? max(max($pages), $page) : ($hasNext ? $page + 1 : $page);
    return [
        'current_page' => $page,
        'total_pages' => $totalPages,
        'has_next' => ($page < $totalPages) || $hasNext,
        'has_prev' => $page > 1,
        'pages' => $pages,
    ];
}
