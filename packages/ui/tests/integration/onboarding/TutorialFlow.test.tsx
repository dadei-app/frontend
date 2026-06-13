import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Card from '@dadei/ui/components/tutorial/Card';
import { buildTutorialSteps } from '@dadei/ui/lib/onboarding/tutorial/constants';

describe('Tutorial Card', () => {
  it('renders step content and advances via Next', async () => {
    const steps = buildTutorialSteps(false);
    const onNext = vi.fn();
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(
      <Card
        step={steps[0]}
        canBack={false}
        canNext
        onBack={onBack}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: steps[0].title }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(steps[0].body).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('calls onBack when Back is enabled', async () => {
    const steps = buildTutorialSteps(false);
    const onNext = vi.fn();
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(
      <Card
        step={steps[1]}
        canBack
        canNext
        onBack={onBack}
        onNext={onNext}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
