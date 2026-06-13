import { useState, type RefObject } from 'react';

import { Trash2 } from 'lucide-react';

import { cn } from '@dadei/ui/lib/platform/shared/cn';

import { useMobileInteractionsSheetOptional } from '@dadei/ui/components/MobileInteractionsSheet';

import { useInteractionPanel } from './useInteractionPanel';

import ConversationCard from './ConversationCard';

import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';

import { ToolbarButton } from '@dadei/ui/components/ui/Toolbar';

import { ClearAllConfirmDialog } from './ClearAllConfirmDialog';

import { MobileInteractionChrome } from './MobileInteractionChrome';

import type { ConversationGroupView } from './types';



type PanelBodyProps = {

  containerRef: RefObject<HTMLDivElement | null>;

  panelLoadError: string | null;

  retryPanelLoad: () => void;

  loading: boolean;

  displayGroups: ConversationGroupView[];

  prefersReducedMotion: boolean;

  armedConversationDeleteId: string | null;

  armedInteractionDeleteId: string | null;

  setArmedConversationDeleteId: (id: string | null) => void;

  setArmedInteractionDeleteId: (id: string | null) => void;

  toggleConversation: (index: number) => void;

  handleDeleteConversation: (id: string) => void;

  handleDeleteInteraction: (id: string) => void;

  getPersonDisplay: (personId: string) => { label: string; position: number; isUser: boolean };

  emptyMinHeight?: boolean;

};



function InteractionPanelBody({

  containerRef,

  panelLoadError,

  retryPanelLoad,

  loading,

  displayGroups,

  prefersReducedMotion,

  armedConversationDeleteId,

  armedInteractionDeleteId,

  setArmedConversationDeleteId,

  setArmedInteractionDeleteId,

  toggleConversation,

  handleDeleteConversation,

  handleDeleteInteraction,

  getPersonDisplay,

  emptyMinHeight = false,

}: PanelBodyProps) {

  return (

    <>

      {panelLoadError ? (

        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">

          <p className="max-w-sm text-sm text-rose-200/90">{panelLoadError}</p>

          <button

            type="button"

            onClick={() => retryPanelLoad()}

            className="rounded-lg border border-white/10 bg-zinc-800/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/90"

          >

            Try again

          </button>

        </div>

      ) : loading ? (

        <div className="flex h-full items-center justify-center">

          <i className="fas fa-spinner fa-spin text-3xl text-emerald-400/80" />

        </div>

      ) : displayGroups.length === 0 ? (

        <div

          className={cn(

            'flex h-full flex-col items-center justify-center text-center',

            emptyMinHeight && 'min-h-[12rem]',

          )}

        >

          <i className="fas fa-robot mb-4 text-5xl text-zinc-600 opacity-50" />

          <p className="mb-2 text-lg font-medium text-zinc-500">No interactions yet</p>

          <small className="text-sm text-zinc-600 opacity-90 font-secondary">

            Start speaking to interact with your AI assistant

          </small>

        </div>

      ) : (

        displayGroups.map((group, groupIndex) => (

          <div key={group.conversation?.id || `orphan-${groupIndex}`} className="min-w-0 space-y-2">

            <ConversationCard

              group={group}

              groupIndex={groupIndex}

              prefersReducedMotion={!!prefersReducedMotion}

              armedConversationDeleteId={armedConversationDeleteId}

              armedInteractionDeleteId={armedInteractionDeleteId}

              setArmedConversationDeleteId={setArmedConversationDeleteId}

              setArmedInteractionDeleteId={setArmedInteractionDeleteId}

              toggleConversation={toggleConversation}

              handleDeleteConversation={handleDeleteConversation}

              handleDeleteInteraction={handleDeleteInteraction}

              getPersonDisplay={getPersonDisplay}

            />

          </div>

        ))

      )}

    </>

  );

}



export default function InteractionPanel({ embedded = false }: { embedded?: boolean }) {

  const mobileSheet = useMobileInteractionsSheetOptional();

  const isMobileEmbedded = embedded && mobileSheet != null;

  const sheetContentVisible = mobileSheet?.contentVisible ?? false;



  const panel = useInteractionPanel();

  const {

    containerRef,

    loading,

    panelLoadError,

    retryPanelLoad,

    conversationGroups,

    displayGroups,

    prefersReducedMotion,

    armedInteractionDeleteId,

    armedConversationDeleteId,

    setArmedInteractionDeleteId,

    setArmedConversationDeleteId,

    toggleConversation,

    handleDeleteInteraction,

    handleDeleteConversation,

    handleClearAll,

    getPersonDisplay,

  } = panel;



  const tutorialEngaged = useTutorialEngaged();

  const chromeInteractive = !tutorialEngaged;



  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);

  const [clearingAll, setClearingAll] = useState(false);



  const clearAllDisabled =

    conversationGroups.length === 0 || loading || !chromeInteractive;



  const requestClearAll = () => {

    if (clearAllDisabled) return;

    setClearAllConfirmOpen(true);

  };



  const confirmClearAll = async () => {

    setClearingAll(true);

    try {

      await handleClearAll();

      setClearAllConfirmOpen(false);

    } finally {

      setClearingAll(false);

    }

  };



  const bodyProps: PanelBodyProps = {

    containerRef,

    panelLoadError,

    retryPanelLoad,

    loading,

    displayGroups,

    prefersReducedMotion: prefersReducedMotion ?? false,

    armedConversationDeleteId,

    armedInteractionDeleteId,

    setArmedConversationDeleteId,

    setArmedInteractionDeleteId,

    toggleConversation,

    handleDeleteConversation,

    handleDeleteInteraction,

    getPersonDisplay,

  };



  return (

    <>

      <div

        data-tutorial-target="interaction-panel-root"

        className={cn(

          'flex h-full min-h-0 flex-col overflow-hidden rounded-none',

          embedded ? 'bg-zinc-950' : 'bg-zinc-950/30',

        )}

      >

        {!isMobileEmbedded ? (

          <div className="assistant-interactions-header flex items-center justify-between gap-4 border-b border-white/6 bg-zinc-950/95 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-sm">

            <div className="min-w-0">

              <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Interactions</h2>

              <p className="text-xs leading-relaxed text-zinc-500 font-secondary">

                Conversations and interactions captured by dadei

              </p>

            </div>

            <ToolbarButton

              variant="destructive"

              icon={Trash2}

              label="Clear all"

              disabled={clearAllDisabled}

              onClick={requestClearAll}

            />

          </div>

        ) : null}



        {isMobileEmbedded ? (
          <>
            <MobileInteractionChrome
              clearAllDisabled={clearAllDisabled}
              onClearAllRequest={requestClearAll}
            />
            {sheetContentVisible ? (
              <div
                id="assistant-mobile-interactions-panel"
                ref={containerRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-none border-t border-white/8 px-4 py-4 sm:px-6 sm:py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
              >
                <InteractionPanelBody {...bodyProps} emptyMinHeight />
              </div>
            ) : null}
          </>
        ) : (

          <div

            ref={containerRef}

            className="flex-1 space-y-3 overflow-y-auto overscroll-none px-4 py-4 sm:px-6 sm:py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"

          >

            <InteractionPanelBody {...bodyProps} />

          </div>

        )}



      </div>



      <ClearAllConfirmDialog

        open={clearAllConfirmOpen}

        onOpenChange={setClearAllConfirmOpen}

        onConfirm={confirmClearAll}

        confirming={clearingAll}

        conversationCount={conversationGroups.length}

      />

    </>

  );

}


