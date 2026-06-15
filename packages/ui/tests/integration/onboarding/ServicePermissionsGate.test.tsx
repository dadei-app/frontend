import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicePermissionsGate } from '@dadei/ui/components/permissions/ServicePermissionsGate';

const mockComplete = vi.fn();
const mockUseService = vi.fn();

vi.mock('@dadei/ui/contexts/ServiceContext', () => ({
  useService: () => mockUseService(),
}));

vi.mock('@dadei/ui/components/permissions/PermissionsPrompt', () => ({
  PermissionsPrompt: ({
    onRequiredGrantedChange,
    onAllGrantedChange,
  }: {
    onRequiredGrantedChange: (granted: boolean) => void;
    onAllGrantedChange?: (granted: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onRequiredGrantedChange(false)}>
        Mark not granted
      </button>
      <button type="button" onClick={() => onRequiredGrantedChange(true)}>
        Mark granted
      </button>
      <button type="button" onClick={() => onAllGrantedChange?.(true)}>
        Mark all granted
      </button>
    </div>
  ),
}));

describe('ServicePermissionsGate', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    vi.useRealTimers();
  });

  it('renders nothing when the gate is closed', () => {
    mockUseService.mockReturnValue({
      permissionsGateOpen: false,
      permissionsGateIntent: null,
      completePermissionsGate: mockComplete,
    });

    const { container } = render(<ServicePermissionsGate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('blocks the confirm checkmark until required permissions are granted', async () => {
    mockUseService.mockReturnValue({
      permissionsGateOpen: true,
      permissionsGateIntent: 'enable',
      completePermissionsGate: mockComplete,
    });

    const user = userEvent.setup();
    render(<ServicePermissionsGate />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Turn on listening' });
    expect(confirmBtn).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Mark granted' }));
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it('auto-completes when all permissions are granted', async () => {
    vi.useFakeTimers();

    mockUseService.mockReturnValue({
      permissionsGateOpen: true,
      permissionsGateIntent: 'active-service',
      completePermissionsGate: mockComplete,
    });

    render(<ServicePermissionsGate />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark granted' }));
      fireEvent.click(screen.getByRole('button', { name: 'Mark all granted' }));
    });

    expect(mockComplete).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(480);
    });

    expect(mockComplete).toHaveBeenCalledOnce();
  });
});
