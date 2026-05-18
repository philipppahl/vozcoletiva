import type { LinguiConfig } from '@lingui/conf';

const config: LinguiConfig = {
  locales: ['en', 'pt'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/i18n/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: 'po',
  formatOptions: {
    origins: true,
    lineNumbers: false,
  },
};

export default config;
