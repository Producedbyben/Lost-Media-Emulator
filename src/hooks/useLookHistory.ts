import { useRef, useCallback, useEffect, useState } from "react";
import type { CRTParams } from "@/hooks/useCRTRenderer";

export interface LookSnapshot {
  params: CRTParams;
  timestamp: number;
}

const MAX_HISTORY = 80;

export function useLookHistory(initialParams: CRTParams) {
  const historyRef = useRef<LookSnapshot[]>([{ params: { ...initialParams }, timestamp: Date.now() }]);
  const indexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateButtons = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const commit = useCallback((params: CRTParams) => {
    const current = historyRef.current[indexRef.current];
    // Skip if identical
    if (current && JSON.stringify(current.params) === JSON.stringify(params)) return;

    // Truncate future
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current.splice(indexRef.current + 1);
    }

    historyRef.current.push({ params: { ...params }, timestamp: Date.now() });

    // Cap history
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }

    updateButtons();
  }, [updateButtons]);

  const undo = useCallback((): CRTParams | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    updateButtons();
    return { ...historyRef.current[indexRef.current].params };
  }, [updateButtons]);

  const redo = useCallback((): CRTParams | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current++;
    updateButtons();
    return { ...historyRef.current[indexRef.current].params };
  }, [updateButtons]);

  return { commit, undo, redo, canUndo, canRedo };
}
