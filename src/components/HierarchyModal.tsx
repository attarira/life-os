'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Task } from '@/lib/types';

interface HierarchyNode extends Task {
  children?: HierarchyNode[];
}

interface HierarchyModalProps {
  area: Task | null;
  tasks: Task[];
  onClose: () => void;
}

export function HierarchyModal({ area, tasks, onClose }: HierarchyModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }
    
    // Simple resize observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const rootNode = useMemo(() => {
    if (!area) return null;

    const buildTree = (task: Task): HierarchyNode => {
      const children = tasks.filter(t => t.parentId === task.id && !t.calendarOnly);
      const node: HierarchyNode = { ...task };
      if (children.length > 0) {
        node.children = children.map(buildTree);
      }
      return node;
    };

    return buildTree(area);
  }, [area, tasks]);

  useEffect(() => {
    if (!rootNode || !svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const hierarchy = d3.hierarchy<HierarchyNode>(rootNode);
    
    // We'll use a standard tree layout.
    // We swap x and y to make it horizontal (left-to-right)
    const treeLayout = d3.tree<HierarchyNode>()
      .nodeSize([40, 250]); // height per node, width per level
      
    const root = treeLayout(hierarchy);

    // Calculate bounding box of the tree
    let x0 = Infinity;
    let x1 = -x0;
    let y0 = Infinity;
    let y1 = -y0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
      if (d.y > y1) y1 = d.y;
      if (d.y < y0) y0 = d.y;
    });

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [y0 - 50, x0 - 50, (y1 - y0) + 350, (x1 - x0) + 100].join(' '))
      .style('width', '100%')
      .style('height', '100%')
      .style('cursor', 'grab');

    const g = svg.append('g');

    // Add zoom capabilities
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
      
    svg.call(zoom);
    
    // Initial center if the tree is small
    const initialTransform = d3.zoomIdentity.translate(50, (dimensions.height / 2) - ((x0 + x1) / 2));
    svg.call(zoom.transform, initialTransform);

    // Links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#475569') // slate-600
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkHorizontal<d3.HierarchyLink<HierarchyNode>, d3.HierarchyPointNode<HierarchyNode>>()
          .x(d => d.y)
          .y(d => d.x)
      );

    // Nodes
    const node = g.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3)
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Node circles/rectangles
    node.append('circle')
      .attr('fill', d => d.children ? '#0f172a' : '#0f172a') // slate-900
      .attr('stroke', d => {
        if (d.data.status === 'COMPLETED') return '#10b981'; // emerald-500
        if (d.data.status === 'IN_PROGRESS') return '#3b82f6'; // blue-500
        return '#64748b'; // slate-500
      })
      .attr('stroke-width', 2)
      .attr('r', 5);

    // Node text
    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -8 : 8)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.title)
      .attr('fill', d => d.data.status === 'COMPLETED' ? '#64748b' : '#e2e8f0') // slate-500 : slate-200
      .style('font-size', '13px')
      .style('font-family', 'sans-serif')
      .style('text-decoration', d => d.data.status === 'COMPLETED' ? 'line-through' : 'none')
      .clone(true).lower()
      .attr('stroke', '#020617') // slate-950 background stroke for legibility
      .attr('stroke-width', 3);

  }, [rootNode, dimensions]);

  if (!area) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-6xl max-h-[85vh] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 leading-tight">Hierarchy: {area.title}</h2>
              <p className="text-[13px] text-slate-400 leading-snug">Visualizing tasks and subtasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div ref={containerRef} className="flex-1 w-full bg-slate-950/30 overflow-hidden relative cursor-grab active:cursor-grabbing">
          <svg ref={svgRef} className="w-full h-full" />
          
          <div className="absolute bottom-4 left-4 flex gap-4 text-[11px] px-3 py-2 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-slate-900" />
              Completed
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-slate-900" />
              In Progress
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-500 bg-slate-900" />
              Other
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
