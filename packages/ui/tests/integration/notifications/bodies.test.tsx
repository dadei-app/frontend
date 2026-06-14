import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ConversationDeleteBody,
  InteractionDeleteBody,
  PersonDeleteBody,
} from '@dadei/ui/components/notifications/bodies';

describe('notification bodies', () => {
  it('renders conversation delete details when expanded', () => {
    render(
      <ConversationDeleteBody
        title="Getting started with dadei"
        toolArgs={{
          topic_summary: 'Getting started with dadei',
          interaction_count: 4,
        }}
      />,
    );

    expect(screen.getByText('Getting started with dadei')).toBeInTheDocument();
    expect(screen.getByText(/conversation and its interactions will be removed/i)).toBeInTheDocument();
    expect(screen.getByText('4 interactions')).toBeInTheDocument();
  });

  it('renders interaction delete details when expanded', () => {
    render(
      <InteractionDeleteBody
        title="Hey, this is dadei."
        toolArgs={{ text: 'Hey, this is dadei.', topic_summary: 'Getting started with dadei' }}
      />,
    );

    expect(screen.getByText('Hey, this is dadei.')).toBeInTheDocument();
    expect(screen.getByText(/interaction will be removed/i)).toBeInTheDocument();
    expect(screen.getByText(/Getting started with dadei/)).toBeInTheDocument();
  });

  it('renders person delete details when expanded', () => {
    render(
      <PersonDeleteBody title="dadei" toolArgs={{ name: 'dadei' }} />,
    );

    expect(screen.getByText('dadei')).toBeInTheDocument();
    expect(screen.getByText(/person and their interactions will be removed/i)).toBeInTheDocument();
  });

  it('truncates side-effect titles when compact', () => {
    render(
      <ConversationDeleteBody
        title="Getting started with dadei"
        compact
      />,
    );

    expect(screen.getByText('Getting started with dadei')).toHaveClass('truncate');
    expect(screen.queryByText(/will be removed/i)).not.toBeInTheDocument();
  });
});
