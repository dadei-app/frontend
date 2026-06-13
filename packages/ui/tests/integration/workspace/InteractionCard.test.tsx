import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InteractionCard from '@dadei/ui/components/interaction-panel/InteractionCard';
import { sampleInteraction } from '../../support/fixtures/interactions';

vi.mock('@dadei/ui/contexts/TutorialContext', () => ({
  useTutorialTargetInteractive: () => true,
}));

vi.mock('@dadei/ui/lib/platform/hooks/useMobileAssistant', () => ({
  useMobileAssistant: () => false,
}));

describe('InteractionCard', () => {
  it('renders interaction text and speaker label', () => {
    render(
      <InteractionCard
        interaction={sampleInteraction()}
        getPersonDisplay={() => ({ label: 'You', position: 0, isUser: true })}
        armedInteractionDeleteId={null}
        setArmedInteractionDeleteId={vi.fn()}
        setArmedConversationDeleteId={vi.fn()}
        handleDeleteInteraction={vi.fn()}
      />,
    );

    expect(screen.getByText('Hello from the interaction panel')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('arms delete and confirms removal', async () => {
    const setArmed = vi.fn();
    const handleDelete = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <InteractionCard
        interaction={sampleInteraction()}
        getPersonDisplay={() => ({ label: 'Alex', position: 1, isUser: false })}
        armedInteractionDeleteId={null}
        setArmedInteractionDeleteId={setArmed}
        setArmedConversationDeleteId={vi.fn()}
        handleDeleteInteraction={handleDelete}
      />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete interaction' });
    await user.click(deleteButtons[0]!);
    expect(setArmed).toHaveBeenCalledWith('int-1');

    rerender(
      <InteractionCard
        interaction={sampleInteraction()}
        getPersonDisplay={() => ({ label: 'Alex', position: 1, isUser: false })}
        armedInteractionDeleteId="int-1"
        setArmedInteractionDeleteId={setArmed}
        setArmedConversationDeleteId={vi.fn()}
        handleDeleteInteraction={handleDelete}
      />,
    );

    const confirm = await screen.findByRole('button', { name: 'Confirm delete' });
    await user.click(confirm);
    expect(handleDelete).toHaveBeenCalledWith('int-1');
  });
});
