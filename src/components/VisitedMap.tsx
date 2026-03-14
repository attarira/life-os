import React, { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import { useVisitedRegions, RegionType } from '../data/visitedRegions';

interface VisitedMapProps {
  type: RegionType;
}

const mapConfig = {
  world: {
    geoUrl: '/maps/world-50m.json',
    title: 'Countries visited',
    getRegionName: (geo: any) => geo.properties.name,
    projection: 'geoMercator',
    projectionConfig: { scale: 120 },
    viewBox: '0 0 800 400',
  },
  usa: {
    geoUrl: '/maps/usa-states-10m.json',
    title: 'US states visited',
    getRegionName: (geo: any) => geo.properties.name,
    projection: 'geoAlbersUsa',
    projectionConfig: { scale: 1000 },
    viewBox: '0 0 800 600',
  },
  india: {
    geoUrl: '/maps/india-states.json',
    title: 'Indian states visited',
    getRegionName: (geo: any) => geo.properties.st_nm || geo.properties.ST_NM,
    projection: 'geoMercator',
    projectionConfig: {
      scale: 1000,
      center: [82.5, 23.0] as [number, number], // Center on India
    },
    viewBox: '0 0 800 600',
  },
};

export const VisitedMap: React.FC<VisitedMapProps> = ({ type }) => {
  const { visited, toggleRegion, isLoaded, visitedCount } = useVisitedRegions(type);
  const config = mapConfig[type];

  // Colors
  const defaultColor = '#e2e8f0'; // slate-200
  const defaultColorDark = '#334155'; // slate-700
  const highlightColor = '#f97316'; // orange-500 (matching recreation theme)
  const hoverHighlightColor = '#fdba74'; // orange-300
  const hoverDefaultColor = '#cbd5e1'; // slate-300
  const hoverDefaultColorDark = '#475569'; // slate-600
  const strokeColor = '#ffffff'; // white borders between regions
  const strokeColorDark = '#1e293b';

  if (!isLoaded) return <div className="h-48 w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl"></div>;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-2 px-1">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {config.title}
        </h4>
        <span className="text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 px-2 py-0.5 rounded-full">
          {visitedCount}
        </span>
      </div>
      
      <div className="flex-1 relative bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <ComposableMap
          projection={config.projection as any}
          projectionConfig={config.projectionConfig}
          viewBox={config.viewBox}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={config.geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const regionName = config.getRegionName(geo);
                  const isVisited = visited.includes(regionName);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => toggleRegion(regionName)}
                      data-tooltip-id={`tooltip-${type}`}
                      data-tooltip-content={regionName}
                      style={{
                        default: {
                          fill: isVisited ? highlightColor : 'var(--map-default-color, #e2e8f0)',
                          stroke: 'var(--map-stroke-color, #ffffff)',
                          strokeWidth: 0.5,
                          outline: 'none',
                          transition: 'all 250ms',
                        },
                        hover: {
                          fill: isVisited ? hoverHighlightColor : 'var(--map-hover-color, #cbd5e1)',
                          stroke: 'var(--map-stroke-color, #ffffff)',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'all 250ms',
                        },
                        pressed: {
                          fill: highlightColor,
                          stroke: 'var(--map-stroke-color, #ffffff)',
                          strokeWidth: 0.5,
                          outline: 'none',
                        },
                      }}
                      className={
                        /* Use simple classes to control theme variables passed to inline styles */
                        "fill-[var(--map-default-color)] hover:fill-[var(--map-hover-color)] transition-colors"
                      }
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
        
        {/* Tooltip for hover */}
        <Tooltip id={`tooltip-${type}`} place="top" className="z-50 !bg-slate-800 !text-white !text-xs !py-1 !px-2 !rounded-md" />
      </div>
      
      {/* 
        A clean way to pass Tailwind's dark mode to react-simple-maps inline styles. 
        Hidden div that sets CSS variables based on parent classes and media queries.
      */}
      <style>{`
        :root {
          --map-default-color: ${defaultColor};
          --map-hover-color: ${hoverDefaultColor};
          --map-stroke-color: ${strokeColor};
        }
        .dark {
          --map-default-color: ${defaultColorDark};
          --map-hover-color: ${hoverDefaultColorDark};
          --map-stroke-color: ${strokeColorDark};
        }
      `}</style>
    </div>
  );
};
