import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProviderColumn } from '@dadei/ui/components/settings/integrations/ProviderColumn';
import type { ProviderHealth } from '@dadei/ui/types/integrations.types';

const baseHealth: ProviderHealth = {
  provider: 'google',
  connected: false,
  needs_reauth: false,
  reauth_reason: null,
  account_identifier: null,
  services: [
    { id: 'gmail', name: 'Gmail', status: 'disconnected', read: false, write: false },
  ],
};

const baseProps = {
  networkEmail: 'me@example.com',
  hasPassword: false,
  connectedProviderCount: 0,
  connecting: false,
  disconnecting: false,
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
};

describe('ProviderColumn', () => {
  it('shows connect CTA when disconnected', () => {
    render(<ProviderColumn health={baseHealth} {...baseProps} />);
    expect(screen.getByRole('button', { name: /connect google/i })).toBeEnabled();
  });

  it('shows reconnect CTA when needs reauth', () => {
    const health: ProviderHealth = {
      ...baseHealth,
      connected: true,
      needs_reauth: true,
      services: [{ id: 'gmail', name: 'Gmail', status: 'needs_reauth', read: false, write: false }],
    };
    render(<ProviderColumn health={health} {...baseProps} connectedProviderCount={1} />);
    expect(screen.getByRole('button', { name: /reconnect google/i })).toBeEnabled();
  });

  it('shows connected email label when account email differs from network email', () => {
    const health: ProviderHealth = {
      ...baseHealth,
      connected: true,
      account_identifier: 'work@company.com',
      services: [{ id: 'gmail', name: 'Gmail', status: 'connected', read: true, write: true }],
    };
    render(
      <ProviderColumn
        health={health}
        {...baseProps}
        connectedProviderCount={2}
        hasPassword={false}
      />,
    );
    expect(screen.getByRole('button', { name: /connected to work@company\.com/i })).toBeEnabled();
  });

  it('opens disconnect flow when connected with another provider available', () => {
    const onDisconnect = vi.fn();
    const health: ProviderHealth = {
      ...baseHealth,
      connected: true,
      account_identifier: 'work@company.com',
      services: [{ id: 'gmail', name: 'Gmail', status: 'connected', read: true, write: true }],
    };
    render(
      <ProviderColumn
        health={health}
        {...baseProps}
        connectedProviderCount={2}
        onDisconnect={onDisconnect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /connected to work@company\.com/i }));
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('shows set password hover label when last provider and no password', () => {
    const health: ProviderHealth = {
      ...baseHealth,
      connected: true,
      services: [{ id: 'gmail', name: 'Gmail', status: 'connected', read: true, write: true }],
    };
    render(
      <ProviderColumn health={health} {...baseProps} connectedProviderCount={1} hasPassword={false} />,
    );
    const button = screen.getByRole('button', { name: /connected/i });
    expect(button).toHaveClass('group');
    expect(button).toHaveTextContent('Set password');
  });

  it('shows a coming soon overlay for Apple', () => {
    const health: ProviderHealth = {
      ...baseHealth,
      provider: 'apple',
      services: [{ id: 'mail', name: 'Mail', status: 'disconnected', read: false, write: false }],
    };
    render(<ProviderColumn health={health} {...baseProps} />);

    expect(screen.getByLabelText('Apple — coming soon')).toBeInTheDocument();
    expect(screen.getByText(/icloud mail, calendar & contacts/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect apple/i })).not.toBeInTheDocument();
  });
});
