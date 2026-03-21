/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

export type TaskStatusData = {
  notStarted?: number;
  inProgress?: number;
  onHold?: number;
  completed?: number;
  blocked?: number;
  [key: string]: number | undefined;
};

export type TaskStatusRingProps = {
  data: TaskStatusData;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  onStatusClick?: (statusName: string) => void;
  className?: string;
};

const COLOR_MAP: Record<string, string> = {
  notStarted: '#9ca3af', // gray-400
  inProgress: '#3b82f6', // blue-500
  onHold: '#f59e0b',     // amber-500
  completed: '#10b981',  // green-500
  blocked: '#ef4444',    // red-500
};

const LABEL_MAP: Record<string, string> = {
  notStarted: 'Not Started',
  inProgress: 'In Progress',
  onHold: 'On Hold',
  completed: 'Completed',
  blocked: 'Blocked',
};

type ChartData = {
  id: string;
  value: number;
  label: string;
  color: string;
};

export function TaskStatusRing({
  data,
  size = 120,
  innerRadius = 44,
  outerRadius = 50,
  onStatusClick,
  className = '',
}: TaskStatusRingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const chartData: ChartData[] = useMemo(() => {
    return Object.entries(data)
      .filter(([_, value]) => value !== undefined && value > 0)
      .map(([key, value]) => ({
        id: key,
        value: value as number,
        label: LABEL_MAP[key] || key,
        color: COLOR_MAP[key] || '#cccccc',
      }));
  }, [JSON.stringify(data)]);

  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = size;
    const height = size;
    const centerPoint = `translate(${width / 2},${height / 2})`;

    // Setup definitions for gradients and filters
    let defs: any = svg.select('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
    }

    // Shadow filters
    let shadowFilter: any = defs.select('#ring-shadow');
    if (shadowFilter.empty()) {
      shadowFilter = defs.append('filter')
        .attr('id', 'ring-shadow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%')
        .attr('height', '140%');

      shadowFilter.append('feDropShadow')
        .attr('dx', '1')
        .attr('dy', '3')
        .attr('stdDeviation', '4')
        .attr('flood-color', '#000000')
        .attr('flood-opacity', '0.2');
    }

    let glowFilter: any = defs.select('#ring-glow');
    if (glowFilter.empty()) {
      glowFilter = defs.append('filter')
        .attr('id', 'ring-glow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

      glowFilter.append('feDropShadow')
        .attr('dx', '0')
        .attr('dy', '4')
        .attr('stdDeviation', '6')
        .attr('flood-color', '#000000')
        .attr('flood-opacity', '0.3');
    }

    // Dynamic gradients
    chartData.forEach(d => {
      let gradient: any = defs.select(`#gradient-${d.id}`);
      if (gradient.empty()) {
        gradient = defs.append('linearGradient')
          .attr('id', `gradient-${d.id}`)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '100%')
          .attr('y2', '100%');

        const baseColor = d3.color(d.color);
        if (baseColor) {
          const lighterColor = baseColor.brighter(0.4).formatHex();
          const darkerColor = baseColor.darker(0.3).formatHex();

          gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', lighterColor);
          gradient.append('stop')
            .attr('offset', '50%')
            .attr('stop-color', baseColor.formatHex());
          gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', darkerColor);
        }
      }
    });

    let g = svg.select<SVGGElement>('g.chart-group');
    if (g.empty()) {
      g = svg.append('g')
        .attr('class', 'chart-group')
        .attr('transform', centerPoint)
        .style('filter', 'url(#ring-shadow)');
    } else {
      g.transition().duration(500).attr('transform', centerPoint);
    }

    // Pie Layout
    const pie = d3.pie<ChartData>()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.04);

    // Arc Generators
    const arc = d3.arc<d3.PieArcDatum<ChartData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(6);

    const arcHover = d3.arc<d3.PieArcDatum<ChartData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 8)
      .cornerRadius(6);

    const arcsData = pie(chartData);

    // Bind Data
    const paths = g.selectAll<SVGPathElement, d3.PieArcDatum<ChartData>>('path')
      .data(arcsData, d => d.data.id);

    // Enter
    const pathsEnter = paths.enter()
      .append('path')
      .attr('class', 'ring-segment')
      .attr('fill', d => `url(#gradient-${d.data.id})`)
      .style('cursor', 'pointer')
      .each(function (d) {
        (this as any)._current = { ...d, startAngle: 0, endAngle: 0 };
      })
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .ease(d3.easeCubicOut)
          .attr('d', arcHover as any)
          .style('filter', 'url(#ring-glow)');

      })
      .on('mouseleave', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .ease(d3.easeCubicOut)
          .attr('d', arc as any)
          .style('filter', null);
      })
      .on('click', function (event, d) {
        if (onStatusClick) {
          onStatusClick(d.data.id);
        }
      });

    // Update + Enter Merge
    const pathsUpdate = pathsEnter.merge(paths);

    pathsUpdate.transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .attrTween('d', function (d) {
        const interpolate = d3.interpolate((this as any)._current, d);
        (this as any)._current = d;
        return function (t) {
          return arc(interpolate(t)) as string;
        };
      })
      .attr('fill', d => `url(#gradient-${d.data.id})`);

    // Exit
    paths.exit()
      .transition()
      .duration(500)
      .attrTween('d', function (d: any) {
        const interpolate = d3.interpolate(d, { ...d, startAngle: d.endAngle });
        return function (t) {
          return arc(interpolate(t)) as string;
        };
      })
      .remove();

  }, [chartData, innerRadius, outerRadius, size, total, onStatusClick]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {total === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 rounded-full border-4 border-dashed border-zinc-200 dark:border-zinc-700/50"
          style={{ width: outerRadius * 2, height: outerRadius * 2, margin: 'auto' }}
        >
          <span className="text-xs font-medium">No Tasks</span>
        </div>
      )}

      <svg
        ref={svgRef}
        width={size}
        height={size}
        className={`overflow-visible transition-opacity duration-300 ${total === 0 ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}

export default TaskStatusRing;
