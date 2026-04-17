import { useState } from 'react';
import { storage } from '@/lib/utils';

// Maps region types to a specific key in localStorage
export type RegionType = 'world' | 'usa' | 'india';

const STORAGE_KEY = 'life-os-visited-regions';

type RegionState = {
  visited: string[];
  current: string | null;
};

type PersistedVisitedRegions = Record<RegionType, RegionState | string[]>;

// Initial default data if nothing is in localStorage.
// Region names must match the map file properties exactly.
const initialVisitedRegions: Record<RegionType, RegionState> = {
  world: {
    visited: ['United States of America', 'India', 'United Kingdom', 'France', 'Japan'],
    current: null,
  },
  usa: {
    visited: ['California', 'New York', 'Texas', 'Washington', 'Illinois'],
    current: null,
  },
  india: {
    visited: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat'],
    current: null,
  },
};

function normalizeRegionState(value: RegionState | string[] | undefined, fallback: RegionState): RegionState {
  if (Array.isArray(value)) {
    return {
      visited: value,
      current: null,
    };
  }

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  return {
    visited: Array.isArray(value.visited) ? value.visited : fallback.visited,
    current: typeof value.current === 'string' && value.current.trim().length > 0 ? value.current : null,
  };
}

function readAllRegions(): Record<RegionType, RegionState> {
  const stored = storage.get<PersistedVisitedRegions | null>(STORAGE_KEY, null);

  const normalized: Record<RegionType, RegionState> = {
    world: normalizeRegionState(stored?.world, initialVisitedRegions.world),
    usa: normalizeRegionState(stored?.usa, initialVisitedRegions.usa),
    india: normalizeRegionState(stored?.india, initialVisitedRegions.india),
  };

  storage.set(STORAGE_KEY, normalized);
  return normalized;
}

export const useVisitedRegions = (type: RegionType) => {
  const [allRegions, setAllRegions] = useState<Record<RegionType, RegionState>>(() => {
    try {
      return readAllRegions();
    } catch (error) {
      console.error('Error loading visited regions from localStorage:', error);
      return initialVisitedRegions;
    }
  });

  const regionState = allRegions[type];

  const updateRegionState = (updater: (current: RegionState) => RegionState) => {
    setAllRegions((currentAllRegions) => {
      const nextState = updater(currentAllRegions[type]);
      const nextAllRegions = {
        ...currentAllRegions,
        [type]: nextState,
      };

      try {
        storage.set(STORAGE_KEY, nextAllRegions);
      } catch (error) {
        console.error('Error saving visited region state:', error);
      }

      return nextAllRegions;
    });
  };

  // Toggle a region's visited state.
  const toggleRegion = (regionName: string) => {
    updateRegionState((current) => {
      const isCurrentlyVisited = current.visited.includes(regionName);
      return {
        ...current,
        visited: isCurrentlyVisited
          ? current.visited.filter((region) => region !== regionName)
          : [...current.visited, regionName],
      };
    });
  };

  const setCurrentRegion = (regionName: string | null) => {
    updateRegionState((current) => ({
      ...current,
      current: regionName && regionName.trim().length > 0 ? regionName : null,
    }));
  };

  const cycleRegion = (regionName: string) => {
    updateRegionState((current) => {
      const isCurrent = current.current === regionName;
      const isVisited = current.visited.includes(regionName);

      if (isCurrent) {
        return {
          visited: current.visited.filter((region) => region !== regionName),
          current: null,
        };
      }

      if (isVisited) {
        return {
          ...current,
          current: regionName,
        };
      }

      return {
        ...current,
        visited: [...current.visited, regionName],
      };
    });
  };

  return {
    visited: regionState.visited,
    currentRegion: regionState.current,
    toggleRegion,
    setCurrentRegion,
    cycleRegion,
    isLoaded: true,
    visitedCount: regionState.visited.length,
  };
};
