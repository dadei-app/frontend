import {

  createContext,

  useCallback,

  useContext,

  useLayoutEffect,

  useMemo,

  useRef,

  useState,

  type PointerEvent as ReactPointerEvent,

  type ReactNode,

} from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';



/** Fixed chrome strip height — must match MobileInteractionChrome layout. */

/** Peek strip height — matches `--assistant-header-h` (4.75rem). */
export const MOBILE_SHEET_PEEK_PX = 76;
/** Lift peek bar slightly above the viewport bottom edge. */
export const MOBILE_SHEET_LIFT_PX = 8;



const EXPANDED_VH = 0.78;

const VIEWPORT_TOP_RESERVE_PX = 80;

const CONTENT_REVEAL_PX = 16;

const DRAG_CLICK_SLOP_PX = 6;

const SNAP_VELOCITY_PX_S = 380;



const SHEET_SPRING = {

  type: 'spring' as const,

  stiffness: 320,

  damping: 32,

  mass: 0.95,

  restDelta: 0.5,

  restSpeed: 0.5,

};



type SheetSnap = 'peek' | 'expanded';



export type MobileInteractionsSheetContextValue = {

  /** Fully expanded (snapped open). */

  open: boolean;

  /** Content region visible — true while dragging partway up for quick looks. */

  contentVisible: boolean;

  snap: SheetSnap;

  setSnap: (snap: SheetSnap) => void;

  toggle: () => void;

  bindDragHandle: () => {

    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;

    style: { touchAction: 'none' };

  };

};



const MobileInteractionsSheetContext =

  createContext<MobileInteractionsSheetContextValue | null>(null);



export function useMobileInteractionsSheet(): MobileInteractionsSheetContextValue {

  const ctx = useContext(MobileInteractionsSheetContext);

  if (!ctx) {

    throw new Error('useMobileInteractionsSheet must be used within MobileInteractionsSheet');

  }

  return ctx;

}



export function useMobileInteractionsSheetOptional(): MobileInteractionsSheetContextValue | null {

  return useContext(MobileInteractionsSheetContext);

}



type MobileInteractionsSheetProps = {

  children: ReactNode;

};



function expandedSheetHeight(): number {

  if (typeof window === 'undefined') return 520;

  const maxByViewport = window.innerHeight - VIEWPORT_TOP_RESERVE_PX;

  const target = window.innerHeight * EXPANDED_VH;

  return Math.max(MOBILE_SHEET_PEEK_PX + 160, Math.min(target, maxByViewport));

}



function clamp(value: number, min: number, max: number): number {

  return Math.min(max, Math.max(min, value));

}



export default function MobileInteractionsSheet({ children }: MobileInteractionsSheetProps) {

  const [snap, setSnap] = useState<SheetSnap>('peek');

  const [expandedH, setExpandedH] = useState(expandedSheetHeight);

  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const reduceMotion = useReducedMotion();



  const snapRef = useRef(snap);

  const expandedHRef = useRef(expandedH);

  const dragRef = useRef<{

    pointerId: number;

    startY: number;

    startHeight: number;

    lastY: number;

    lastT: number;

    velocity: number;

    moved: boolean;

  } | null>(null);



  snapRef.current = snap;

  expandedHRef.current = expandedH;



  const restingHeight = snap === 'expanded' ? expandedH : MOBILE_SHEET_PEEK_PX;

  const displayHeight = dragHeight ?? restingHeight;

  const open = snap === 'expanded';

  const contentVisible = displayHeight > MOBILE_SHEET_PEEK_PX + CONTENT_REVEAL_PX;

  const scrimProgress = clamp(

    (displayHeight - MOBILE_SHEET_PEEK_PX) / Math.max(expandedH - MOBILE_SHEET_PEEK_PX, 1),

    0,

    1,

  );



  const toggle = useCallback(() => {

    setSnap(prev => (prev === 'expanded' ? 'peek' : 'expanded'));

  }, []);



  const finishDrag = useCallback(() => {

    const drag = dragRef.current;

    dragRef.current = null;

    setDragHeight(null);



    if (!drag) return;



    const maxH = expandedHRef.current;

    const mid = (MOBILE_SHEET_PEEK_PX + maxH) / 2;

    const current = clamp(drag.startHeight + (drag.startY - drag.lastY), MOBILE_SHEET_PEEK_PX, maxH);



    let next: SheetSnap = 'peek';

    if (drag.velocity > SNAP_VELOCITY_PX_S) {

      next = 'expanded';

    } else if (drag.velocity < -SNAP_VELOCITY_PX_S) {

      next = 'peek';

    } else if (current > mid) {

      next = 'expanded';

    }



    setSnap(next);

  }, []);



  const bindDragHandle = useCallback(() => {

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {

      if (event.button !== 0) return;



      const target = event.currentTarget;

      target.setPointerCapture(event.pointerId);



      dragRef.current = {

        pointerId: event.pointerId,

        startY: event.clientY,

        startHeight:

          dragHeight ??

          (snapRef.current === 'expanded' ? expandedHRef.current : MOBILE_SHEET_PEEK_PX),

        lastY: event.clientY,

        lastT: event.timeStamp,

        velocity: 0,

        moved: false,

      };



      const onPointerMove = (moveEvent: PointerEvent) => {

        const drag = dragRef.current;

        if (!drag || moveEvent.pointerId !== drag.pointerId) return;



        const deltaY = drag.startY - moveEvent.clientY;

        if (Math.abs(deltaY) > DRAG_CLICK_SLOP_PX) drag.moved = true;



        const dt = Math.max(moveEvent.timeStamp - drag.lastT, 1);

        drag.velocity = ((drag.lastY - moveEvent.clientY) / dt) * 1000;

        drag.lastY = moveEvent.clientY;

        drag.lastT = moveEvent.timeStamp;



        setDragHeight(

          clamp(drag.startHeight + deltaY, MOBILE_SHEET_PEEK_PX, expandedHRef.current),

        );

      };



      const onPointerEnd = (endEvent: PointerEvent) => {

        if (dragRef.current?.pointerId !== endEvent.pointerId) return;



        target.removeEventListener('pointermove', onPointerMove);

        target.removeEventListener('pointerup', onPointerEnd);

        target.removeEventListener('pointercancel', onPointerEnd);



        try {

          target.releasePointerCapture(endEvent.pointerId);

        } catch {

          /* capture may already be released */

        }



        const wasTap = dragRef.current != null && !dragRef.current.moved;

        if (wasTap) {
          dragRef.current = null;
          setDragHeight(null);
          setSnap(prev => (prev === 'expanded' ? 'peek' : 'expanded'));
        } else {
          finishDrag();
        }

      };



      target.addEventListener('pointermove', onPointerMove);

      target.addEventListener('pointerup', onPointerEnd);

      target.addEventListener('pointercancel', onPointerEnd);

    };



    return { onPointerDown, style: { touchAction: 'none' } as const };

  }, [dragHeight, finishDrag]);



  const contextValue = useMemo(

    () => ({

      open,

      contentVisible,

      snap,

      setSnap,

      toggle,

      bindDragHandle,

    }),

    [open, contentVisible, snap, toggle, bindDragHandle],

  );



  useLayoutEffect(() => {

    const sync = () => setExpandedH(expandedSheetHeight());

    sync();

    window.addEventListener('resize', sync);

    return () => window.removeEventListener('resize', sync);

  }, []);



  useLayoutEffect(() => {

    document.documentElement.style.setProperty(
      '--assistant-mobile-sheet-peek',
      `${MOBILE_SHEET_PEEK_PX}px`,
    );
    document.documentElement.style.setProperty(
      '--assistant-mobile-sheet-lift',
      `${MOBILE_SHEET_LIFT_PX}px`,
    );
    return () => {
      document.documentElement.style.removeProperty('--assistant-mobile-sheet-peek');
      document.documentElement.style.removeProperty('--assistant-mobile-sheet-lift');
    };

  }, []);



  const isDragging = dragHeight != null;

  const transition = reduceMotion ? { duration: 0 } : SHEET_SPRING;



  return (

    <MobileInteractionsSheetContext.Provider value={contextValue}>

      <AnimatePresence>

        {scrimProgress > 0.04 ? (

          <motion.button

            key="interactions-scrim"

            type="button"

            initial={{ opacity: 0 }}

            animate={{ opacity: scrimProgress * 0.42 }}

            exit={{ opacity: 0 }}

            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}

            className="fixed inset-0 z-40 bg-zinc-950 lg:hidden"

            style={{ opacity: isDragging ? scrimProgress * 0.42 : undefined }}

            aria-label="Close interactions"

            onClick={() => setSnap('peek')}

          />

        ) : null}

      </AnimatePresence>



      <div

        className="assistant-mobile-sheet pointer-events-none fixed inset-x-0 z-50 flex flex-col lg:hidden"

      >

        <motion.div

          className="pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-t-2xl bg-zinc-950 shadow-[0_-8px_32px_rgba(0,0,0,0.4)]"

          initial={false}

          animate={isDragging ? undefined : { height: restingHeight }}

          style={{ height: isDragging ? displayHeight : undefined }}

          transition={isDragging ? { duration: 0 } : transition}

        >

          <div className="flex h-full min-h-0 flex-col">{children}</div>

        </motion.div>

      </div>

    </MobileInteractionsSheetContext.Provider>

  );

}


