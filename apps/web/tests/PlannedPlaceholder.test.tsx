import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { PlannedPlaceholder } from '../src/components/PlannedPlaceholder';

beforeAll(() => {
  i18n.load('en', {});
  i18n.activate('en');
});

function wrap(node: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe('PlannedPlaceholder', () => {
  it('renders the PLANNED eyebrow and body', () => {
    wrap(<PlannedPlaceholder body="Coming later" />);
    expect(screen.getByText(/planned/i)).toBeInTheDocument();
    expect(screen.getByText('Coming later')).toBeInTheDocument();
  });
});
