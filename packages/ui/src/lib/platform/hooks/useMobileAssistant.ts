import { useLayoutEffect, useState } from 'react';

/** Viewports below `lg` use the dedicated mobile assistant shell (bottom sheet, no hotkey chrome). */
const MOBILE_ASSISTANT_MQ = '(max-width: 1023px)';

export function useMobileAssistant(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_ASSISTANT_MQ).matches : false,
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_ASSISTANT_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
