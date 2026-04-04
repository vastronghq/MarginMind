import { useState, useCallback } from "react";

export const useMessageSelection = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);

  const toggleSelected = useCallback(
    (id: string) =>
      setSelectedIDs((curr) =>
        curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
      ),
    [],
  );

  const toggleSelectionWithAnyClick = useCallback(
    (id: string) => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedIDs([id]);
        return;
      }
      toggleSelected(id);
    },
    [isSelectionMode, toggleSelected],
  );

  const clearSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIDs([]);
  }, []);

  return {
    isSelectionMode,
    selectedIDs,
    toggleSelected,
    toggleSelectionWithAnyClick,
    clearSelectionMode,
  };
};
