import type { EmailBodyProps } from './types';
import { strArg } from './shared';

export default function EmailBody({ toolArgs, title }: EmailBodyProps) {
  const to = strArg(toolArgs, 'to');
  const subject = strArg(toolArgs, 'subject') ?? title;
  const body = strArg(toolArgs, 'body');
  const cc = strArg(toolArgs, 'cc');
  const bcc = strArg(toolArgs, 'bcc');

  const recipientRows: Array<[string, string]> = [];
  if (to) recipientRows.push(['To', to]);
  if (cc) recipientRows.push(['Cc', cc]);
  if (bcc) recipientRows.push(['Bcc', bcc]);

  return (
    <div className="mt-1 min-w-0">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{subject}</p>
      {recipientRows.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {recipientRows.map(([label, value]) => (
            <p key={label} className="min-w-0 truncate text-xs text-zinc-400 font-secondary">
              <span className="text-zinc-500">{label}</span>{' '}
              <span className="text-zinc-300">{value}</span>
            </p>
          ))}
        </div>
      ) : null}
      {body ? (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-relaxed whitespace-pre-wrap text-zinc-400 font-secondary">
          {body}
        </p>
      ) : (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs italic text-zinc-500 font-secondary">
          No message body
        </p>
      )}
    </div>
  );
}
