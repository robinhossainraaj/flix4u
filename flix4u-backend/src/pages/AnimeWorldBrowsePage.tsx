import React from 'react';
import { AnimeWorldCatalogView } from '@/src/components/AnimeWorldCatalogView';

export const AnimeWorldBrowsePage: React.FC = () => {
  return <AnimeWorldCatalogView defaultTab="home" showBackHomeLink />;
};
