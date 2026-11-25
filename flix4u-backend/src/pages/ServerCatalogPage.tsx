import React from 'react';
import {
  AnimeWorldCatalogView,
  type AnimeWorldCatalogTab,
} from '@/src/components/AnimeWorldCatalogView';
import { ServerSelector } from '@/src/components/ServerSelector';
import { useServer } from '@/src/context/ServerContext';
import { CatalogPage } from '@/src/pages/CatalogPage';

interface ServerCatalogPageProps {
  animeWorldDefaultTab?: AnimeWorldCatalogTab;
  presetFormat?: 'MOVIE' | 'TV';
  heading: string;
  subheading: string;
}

export const ServerCatalogPage: React.FC<ServerCatalogPageProps> = ({
  animeWorldDefaultTab = 'home',
  presetFormat,
  heading,
  subheading,
}) => {
  const { isAnimeWorld } = useServer();

  if (isAnimeWorld) {
    return (
      <AnimeWorldCatalogView
        defaultTab={animeWorldDefaultTab}
        showServerSelector
      />
    );
  }

  return (
    <CatalogPage
      presetFormat={presetFormat}
      heading={heading}
      subheading={subheading}
      topSlot={<ServerSelector variant="compact" />}
    />
  );
};
