import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Person } from '@dadei/ui/types/models.types';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { cn } from '@dadei/ui/lib/shared/cn';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useTutorialContext } from '@dadei/ui/contexts/TutorialContext';
import { useNeedsTutorial } from '@dadei/ui/lib/query/queryHooks';
import { isTutorialTestId } from '@dadei/ui/lib/tutorial/testData';

/** Below client tooltip (195); above main chrome. Raised during tutorial persons step. */
const PERSONS_DRAWER_Z = 170;
const PERSONS_DRAWER_TUTORIAL_Z = 10002;

interface PersonsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  excludeElement?: HTMLElement | null;
}

export default function PersonsPanel({ isOpen, onClose, excludeElement }: PersonsPanelProps) {
  const { showToast } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [armedPersonDeleteId, setArmedPersonDeleteId] = useState<string | null>(null);
  const {
    persons,
    personsLoading,
    renamePerson,
    isRenamingPerson,
    deletePerson,
    isDeletingPerson,
  } = useService();
  const { beginIntroduction } = useCommand();
  const tutorial = useTutorialContext();
  const needsTutorial = useNeedsTutorial();
  const tutorialEngaged = Boolean(needsTutorial && tutorial?.isActive);
  const displayPersons = useMemo(() => {
    const merged = [...(tutorialEngaged ? (tutorial?.tutorialPersons ?? []) : []), ...persons];
    const seen = new Set<string>();
    return merged.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [persons, tutorial?.tutorialPersons, tutorialEngaged, tutorial]);

  const loading = isOpen && personsLoading;

  const personIdToPosition = useMemo(() => {
    const sorted = [...displayPersons].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const m = new Map<string, number>();
    sorted.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [displayPersons]);

  const handleRename = async (personId: string) => {
    if (isTutorialTestId(personId)) return;
    if (!editName.trim()) return;

    try {
      await renamePerson(personId, editName.trim());
      setEditingId(null);
      setEditName('');
      showToast('Person renamed successfully', 'success');
    } catch (error) {
      console.error('Failed to rename person:', error);
      showToast('Failed to rename person', 'error');
    }
  };

  const handleRetrainVoice = async () => {
    onClose();
    const started = await beginIntroduction();
    if (!started) {
      showToast('Could not start voice retraining. Try again.', 'error');
    }
  };

  const handleDeletePerson = async (personId: string) => {
    if (isTutorialTestId(personId)) {
      tutorial?.removeTutorialPerson();
      showToast('Person deleted successfully', 'success');
      setArmedPersonDeleteId(null);
      return;
    }
    try {
      await deletePerson(personId);
      showToast('Person deleted successfully', 'success');
      setArmedPersonDeleteId(null);
    } catch (error) {
      console.error('Failed to delete person:', error);
      showToast(getUserErrorMessage(error, 'Could not delete that person.'), 'error');
      setArmedPersonDeleteId(null);
    }
  };

  useEffect(() => {
    if (!armedPersonDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedPersonDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmedPersonDeleteId(null);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedPersonDeleteId]);

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, personId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename(personId);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Close on outside click (exclude toggle button)
  useEffect(() => {
    if (!isOpen) return;
    if (tutorialEngaged && tutorial?.step.id === 'delete_person') return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Don't close if clicking the toggle button or inside panel
      if (
        (panelRef.current && panelRef.current.contains(target)) ||
        (excludeElement && excludeElement.contains(target))
      ) {
        return;
      }

      onClose();
    };

    // Small delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, excludeElement, tutorialEngaged, tutorial?.step.id]);

  const drawerZ =
    tutorialEngaged && tutorial?.step.id === 'delete_person'
      ? PERSONS_DRAWER_TUTORIAL_Z
      : PERSONS_DRAWER_Z;

  const tree = (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
            data-tutorial-target="persons-panel-root"
            className="fixed bottom-0 right-0 top-[calc(var(--assistant-titlebar-offset,0px)+var(--assistant-header-h,4.75rem))] flex min-h-0 w-full max-w-md flex-col border-l border-white/10 bg-zinc-950/95 shadow-[-10px_0_40px_rgba(0,0,0,0.4)] backdrop-blur-xl will-change-transform sm:w-1/3"
            style={{ zIndex: drawerZ }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <i className="fas fa-users text-emerald-400/90" />
                Persons
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* People List — min-h-0 so flex child can shrink and scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-none p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <i className="fas fa-spinner fa-spin text-2xl text-emerald-400/80" />
                </div>
              ) : displayPersons.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <i className="fas fa-user-friends mb-3 text-4xl text-zinc-600 opacity-40" />
                  <p className="text-sm font-medium text-zinc-400">No people yet</p>
                  <p className="mt-1 text-xs text-zinc-600 font-secondary">People will appear as they speak</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayPersons.map((person) => {
                    const isEditing = editingId === person.id;
                    const position = personIdToPosition.get(person.id) ?? 0;
                    const isYou = person.is_user;

                    return (
                      <div
                        key={person.id}
                        data-tutorial-target={
                          person.id === 'tutorial-test-person' ? 'tutorial-test-person' : undefined
                        }
                        className="group/person rounded-lg border border-white/10 bg-zinc-900/70 p-3 transition-[border-color,box-shadow] duration-200 hover:border-emerald-500/25 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${isYou ? 'bg-emerald-950/60 text-emerald-300 ring-emerald-500/25' : 'bg-zinc-800 text-zinc-300 ring-white/5'}`}
                          >
                            {person.name ? person.name[0].toUpperCase() : position}
                          </div>

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => handleNameKeyDown(e, person.id)}
                                disabled={isRenamingPerson}
                                className="w-full rounded-md border border-emerald-500/35 bg-zinc-950/80 px-2 py-1 font-primary text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                                autoFocus
                                placeholder="Enter name"
                              />
                            ) : (
                              <div>
                                <h3 className="truncate text-sm font-medium text-zinc-100 font-secondary">
                                  {person.name || (isYou ? 'You' : `Person ${position}`)}
                                  {isYou ? (
                                    <span className="ml-1.5 text-xs font-normal text-emerald-400/80">
                                      (you)
                                    </span>
                                  ) : null}
                                </h3>
                              </div>
                            )}
                          </div>

                          <div
                            className={cn(
                              'flex items-center gap-1 transition-opacity',
                              armedPersonDeleteId === person.id
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/person:opacity-100'
                            )}
                          >
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleRename(person.id)}
                                  disabled={isRenamingPerson}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-950/50 text-emerald-300 transition-colors hover:bg-emerald-950/80"
                                  title="Save"
                                >
                                  <i className="fas fa-check text-xs" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700"
                                  title="Cancel"
                                >
                                  <i className="fas fa-times text-xs" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(person)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
                                  title="Rename"
                                >
                                  <i className="fas fa-pencil-alt text-xs" />
                                </button>
                                {isYou ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleRetrainVoice()}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-400/80 transition-colors hover:bg-emerald-950/40 hover:text-emerald-300"
                                    title="Retrain your voice"
                                    aria-label="Retrain your voice"
                                  >
                                    <i className="fas fa-microphone-alt text-xs" />
                                  </button>
                                ) : (
                                  <SplitDeleteToolbar
                                    armed={armedPersonDeleteId === person.id}
                                    disabled={isDeletingPerson}
                                    onArm={() => setArmedPersonDeleteId(person.id)}
                                    onDisarm={() => setArmedPersonDeleteId(null)}
                                    onConfirm={() => {
                                      void handleDeletePerson(person.id);
                                    }}
                                    idleTitle="Delete person"
                                    idleAriaLabel="Delete person"
                                    containerClassName="h-7 self-auto"
                                    armedContainerClassName="gap-0.5"
                                    idleButtonClassName="opacity-100 rounded-md hover:bg-rose-950/35"
                                    confirmButtonClassName="h-7 w-7 rounded-md"
                                    cancelButtonClassName="h-7 w-7 rounded-md"
                                    idleWidthPx={28}
                                    armedWidthPx={58}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(tree, document.body);
}