import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PrimaryProviderSelector } from '@dadei/ui/components/settings/integrations/PrimaryProviderSelector';

describe('PrimaryProviderSelector', () => {
  it('is hidden when fewer than two providers are connected', () => {
    const { container } = render(
      <PrimaryProviderSelector
        domain="mail"
        connectedProviders={['google']}
        value="google"
        saving={false}
        onChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onChange with a provider when a different option is selected', () => {
    const onChange = vi.fn();
    render(
      <PrimaryProviderSelector
        domain="calendar"
        connectedProviders={['google', 'microsoft']}
        value="google"
        saving={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^microsoft$/i }));
    expect(onChange).toHaveBeenCalledWith('microsoft');
  });

  it('calls onChange with null when the selected option is clicked again', () => {
    const onChange = vi.fn();
    render(
      <PrimaryProviderSelector
        domain="mail"
        connectedProviders={['google', 'microsoft']}
        value="google"
        saving={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^google$/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
