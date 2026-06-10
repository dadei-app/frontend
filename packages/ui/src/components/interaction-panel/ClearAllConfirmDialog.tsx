import * as AlertDialog from '@radix-ui/react-alert-dialog';

import { Trash2 } from 'lucide-react';

import { cn } from '@dadei/ui/lib/shared/cn';



type ClearAllConfirmDialogProps = {

  open: boolean;

  onOpenChange: (open: boolean) => void;

  onConfirm: () => void | Promise<void>;

  confirming?: boolean;

  conversationCount: number;

};



export function ClearAllConfirmDialog({

  open,

  onOpenChange,

  onConfirm,

  confirming = false,

  conversationCount,

}: ClearAllConfirmDialogProps) {

  const countLabel =

    conversationCount === 1 ? '1 conversation' : `${conversationCount} conversations`;



  return (

    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>

      <AlertDialog.Portal>

        <AlertDialog.Overlay className="fixed inset-0 z-[260] bg-zinc-950/70 backdrop-blur-[2px]" />

        <AlertDialog.Content className="fixed inset-0 z-[261] flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none">

          <div className="glass-panel w-[min(92vw,24rem)] rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/40">

            <div className="flex items-start gap-3">

              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10">

                <Trash2 className="h-5 w-5 text-rose-300" aria-hidden />

              </span>

              <div className="min-w-0 flex-1">

                <AlertDialog.Title className="text-lg font-semibold tracking-tight text-zinc-50">

                  Clear all interactions?

                </AlertDialog.Title>

                <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-zinc-400 font-secondary">

                  This permanently removes {countLabel} and their history. This cannot be undone.

                </AlertDialog.Description>

              </div>

            </div>



            <div className="mt-6 flex justify-end gap-2.5">

              <AlertDialog.Cancel asChild>

                <button

                  type="button"

                  className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800/80"

                >

                  Cancel

                </button>

              </AlertDialog.Cancel>

              <button

                type="button"

                disabled={confirming}

                onClick={() => void onConfirm()}

                className={cn(

                  'rounded-lg border border-rose-500/40 bg-rose-600/90 px-4 py-2.5 text-sm font-semibold text-white transition',

                  'hover:border-rose-400/50 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50',

                )}

              >

                {confirming ? 'Clearing…' : 'Clear all'}

              </button>

            </div>

          </div>

        </AlertDialog.Content>

      </AlertDialog.Portal>

    </AlertDialog.Root>

  );

}


