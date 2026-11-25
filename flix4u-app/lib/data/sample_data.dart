import 'models/media_item.dart';

const List<MediaItem> kSampleMedia = <MediaItem>[
  MediaItem(
    id: 'sample:1',
    type: 'movie',
    title: 'Sample Movie',
    poster: '',
    backdrop: '',
    description: 'Connect your Flix4U backend to load real catalog data.',
    provider: 'sample',
    genres: <String>['Demo'],
    year: 2026,
    rating: 8.0,
  ),
  MediaItem(
    id: 'sample:2',
    type: 'tv',
    title: 'Sample Web Series',
    poster: '',
    backdrop: '',
    description: 'Movies, web series and anime will appear here.',
    provider: 'sample',
    genres: <String>['Demo'],
    year: 2026,
  ),
  MediaItem(
    id: 'sample:3',
    type: 'anime',
    title: 'Sample Anime',
    poster: '',
    backdrop: '',
    description: 'Anime sources are inherited from the existing resolver.',
    provider: 'sample',
    genres: <String>['Demo'],
    year: 2026,
  ),
];
