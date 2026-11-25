import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flix4u.rorax',
  appName: 'Flix4U',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.vercel.app',
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.googleusercontent.com',
      'accounts.google.com',
      'graphql.anilist.co',
      'api.ani.zip',
      'api.aniskip.com',
      'animesky.app',
      '*.animesky.app',
      'animesalt.cx',
      '*.animesalt.cx',
      'ravok.buzz',
      '*.ravok.buzz',
      'abyssplayer.com',
      '*.abyssplayer.com',
      'image.tmdb.org',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 150,
      launchAutoHide: true,
      launchFadeOutDuration: 150,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#08090d',
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#08090d',
  },
};

export default config;
