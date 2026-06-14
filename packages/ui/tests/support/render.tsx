import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

type WrapperProps = { children: ReactNode };

export function renderWithUi(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { wrapper?: (props: WrapperProps) => ReactNode },
) {
  const Wrapper = options?.wrapper;
  return render(ui, {
    ...options,
    wrapper: Wrapper
      ? ({ children }) => <Wrapper>{children}</Wrapper>
      : undefined,
  });
}
