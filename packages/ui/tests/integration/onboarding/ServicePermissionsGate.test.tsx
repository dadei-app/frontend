import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicePermissionsGate } from '@dadei/ui/components/permissions/ServicePermissionsGate';

const mockComplete = vi.fn();
const mockDismiss = vi.fn();
const mockUseService = vi.fn();

vi.mock('@dadei/ui/contexts/ServiceContext', () => ({
  useService: () => mockUseService(),
}));

vi.mock('@dadei/ui/components/permissions/PermissionsPrompt', () => ({
  PermissionsPrompt: ({
    onRequiredGrantedChange,
  }: {
    onRequiredGrantedChange: (granted: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onRequiredGrantedChange(false)}>
        Mark not granted
      </button>
      <button type="button" onClick={() => onRequiredGrantedChange(true)}>
        Mark granted
      </button>
    </div>
  ),
}));

describe('ServicePermissionsGate', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockDismiss.mockReset();
  });

  it('renders nothing when the gate is closed', () => {
    mockUseService.mockReturnValue({
      permissionsGateOpen: false,
      permissionsGateIntent: null,
      completePermissionsGate: mockComplete,
      dismissPermissionsGate: mockDismiss,
    });

    const { container } = render(<ServicePermissionsGate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows enable copy and blocks Continue until required permissions are granted', async () => {
    mockUseService.mockReturnValue({
      permissionsGateOpen: true,
      permissionsGateIntent: 'enable',
      completePermissionsGate: mockComplete,
      dismissPermissionsGate: mockDismiss,
    });

    const user = userEvent.setup();
    render(<ServicePermissionsGate />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Enable the assistant')).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: 'Turn on' });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Mark granted' }));
    expect(continueBtn).toBeEnabled();

    await user.click(continueBtn);
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it('calls dismiss when Not now is clicked', async () => {
    mockUseService.mockReturnValue({
      permissionsGateOpen: true,
      permissionsGateIntent: 'mic',
      completePermissionsGate: mockComplete,
      dismissPermissionsGate: mockDismiss,
    });

    const user = userEvent.setup();
    render(<ServicePermissionsGate />);

    expect(screen.getByText('Microphone access needed')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });
});
