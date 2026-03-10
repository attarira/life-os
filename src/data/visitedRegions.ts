import { useState, useEffect } from 'react';

// Maps region types to a specific key in localStorage
export type RegionType = 'world' | 'usa' | 'india';

const STORAGE_KEY = 'life-os-visited-regions';

// Initial default data if nothing is in localStorage
// Using precise keys matching TopoJSON properties
const initialVisitedRegions: Record<RegionType, string[]> = {
  world: ['United States of America', 'India', 'United Kingdom', 'France', 'Japan'],
  usa: ['California', 'New York', 'Texas', 'Washington', 'Illinois'],
  india: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat'],
};

export const useVisitedRegions = (type: RegionType) => {
  const [visited, setVisited] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[type]) {
          setVisited(parsed[type]);
        } else {
          // Backward compatibility or missing key
          setVisited(initialVisitedRegions[type]);
        }
      } else {
        // First time load
        setVisited(initialVisitedRegions[type]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialVisitedRegions));
      }
    } catch (error) {
      console.error('Error loading visited regions from localStorage:', error);
      setVisited(initialVisitedRegions[type]);
    }
    setIsLoaded(true);
  }, [type]);

  // Toggle a region's visited state
  const toggleRegion = (regionName: string) => {
    setVisited((prev) => {
      const isCurrentlyVisited = prev.includes(regionName);
      const updatedRegions = isCurrentlyVisited
        ? prev.filter((r) => r !== regionName)
        : [...prev, regionName];

      // Save to localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const allRegions = stored ? JSON.parse(stored) : initialVisitedRegions;
        allRegions[type] = updatedRegions;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allRegions));
      } catch (error) {
        console.error('Error saving visited region to localStorage:', error);
      }

      return updatedRegions;
    });
  };

  return {
    visited,
    toggleRegion,
    isLoaded,
    visitedCount: visited.length,
  };
};
