import { Link } from 'react-router-dom';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';

/** Post-tutorial subscription placeholder (billing ships separately). */
export default function SubscribePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <h1 className="font-primary text-2xl font-semibold tracking-tight">Subscription</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400 font-secondary">
        You have finished the tutorial. Subscription plans are coming soon — you can use Dadei from
        the assistant while we finish billing.
      </p>
      <Link
        to={ASSISTANT_PATH}
        className="mt-8 rounded-lg border border-emerald-500/35 bg-emerald-950/50 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50"
      >
        Go to assistant
      </Link>
    </div>
  );
}
