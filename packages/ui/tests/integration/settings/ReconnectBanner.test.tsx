import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReconnectBanner } from '@dadei/ui/components/settings/integrations/ReconnectBanner';

describe('ReconnectBanner', () => {
  it('renders nothing when providers is empty', () => {
    const { container } = render(
      <ReconnectBanner providers={[]} onReconnect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders reconnect buttons per provider', () => {
    const onReconnect = vi.fn();
    render(<ReconnectBanner providers={['google', 'microsoft']} onReconnect={onReconnect} />);

    fireEvent.click(screen.getByRole('button', { name: /reconnect microsoft/i }));
    expect(onReconnect).toHaveBeenCalledWith('microsoft');
  });
});
