'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { storage, generateId } from '@/lib/utils';
import { DASHBOARD_PAGES_STORAGE_KEY, FILE_SYSTEM_STORAGE_KEY } from '@/lib/storage-keys';

export type FileNodeType = 'file' | 'folder';
export type FolderMode = 'edit' | 'read-only';

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileNodeType;
  parentId: string | null; // null for root nodes
  createdAt: string;
  updatedAt: string;
  content?: string; // only for files
  folderMode?: FolderMode; // only for folders — inherited by children
}

export const ROOT_FOLDER_ID = 'root';

interface FileSystemContextValue {
  nodes: FileSystemNode[];
  isLoading: boolean;
  createFolder: (name: string, parentId?: string | null, folderMode?: FolderMode) => string;
  createFile: (name: string, content?: string, parentId?: string | null) => string;
  renameNode: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  deleteNode: (id: string) => void;
  getFolderChildren: (folderId: string | null) => FileSystemNode[];
  getNode: (id: string | null) => FileSystemNode | null;
  getBreadcrumbs: (id: string | null) => FileSystemNode[];
  getEffectiveMode: (nodeId: string | null) => FolderMode;
}

const FileSystemContext = createContext<FileSystemContextValue | null>(null);

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
}

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<FileSystemNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and run migration if needed
  useEffect(() => {
    let savedNodes = storage.get<FileSystemNode[]>(FILE_SYSTEM_STORAGE_KEY, []);

    // Migration logic
    if (!savedNodes || savedNodes.length === 0) {
      const existingNotes = storage.get<any[]>(DASHBOARD_PAGES_STORAGE_KEY, []);
      const now = new Date().toISOString();
      const initialNodes: FileSystemNode[] = [];

      // Seed folders with default modes
      const seedFolders: { name: string; mode: FolderMode }[] = [
        { name: 'Notes', mode: 'edit' },
        { name: 'Prompt Library', mode: 'read-only' },
        { name: 'Read-Only', mode: 'read-only' },
        { name: 'Recipes', mode: 'read-only' },
      ];

      const notesFolderId = generateId();
      seedFolders.forEach((sf, idx) => {
        initialNodes.push({
          id: idx === 0 ? notesFolderId : generateId(),
          name: sf.name,
          type: 'folder',
          parentId: null,
          createdAt: now,
          updatedAt: now,
          folderMode: sf.mode,
        });
      });

      // Migrate existing notes into the Notes folder
      if (Array.isArray(existingNotes) && existingNotes.length > 0) {
        existingNotes.forEach(note => {
          if (note && note.id) {
            initialNodes.push({
              id: note.id,
              name: note.title || 'Untitled Note',
              type: 'file',
              parentId: notesFolderId,
              createdAt: note.createdAt || now,
              updatedAt: note.updatedAt || now,
              content: note.content || '',
            });
          }
        });
      }

      savedNodes = initialNodes;
      storage.set(FILE_SYSTEM_STORAGE_KEY, savedNodes);
    } else {
      // Migration v2: ensure existing folders have folderMode set
      let migrated = false;
      const MODE_DEFAULTS: Record<string, FolderMode> = {
        'notes': 'edit',
        'prompt library': 'read-only',
        'read-only': 'read-only',
        'recipes': 'read-only',
      };
      savedNodes = savedNodes.map(n => {
        let newMode = n.folderMode as any;
        if (newMode === 'copy' || newMode === 'view') {
           newMode = 'read-only';
           migrated = true;
        }

        if (n.type === 'folder' && !newMode) {
          const defaultMode = MODE_DEFAULTS[n.name.toLowerCase()];
          if (defaultMode) {
            migrated = true;
            return { ...n, folderMode: defaultMode };
          }
        }
        
        if (newMode && newMode !== n.folderMode) {
          return { ...n, folderMode: newMode };
        }
        return n;
      });
      // Also ensure the four seed folders exist
      const existingNames = new Set(savedNodes.filter(n => n.type === 'folder' && n.parentId === null).map(n => n.name.toLowerCase()));
      const now = new Date().toISOString();
      for (const [name, mode] of Object.entries(MODE_DEFAULTS)) {
        if (!existingNames.has(name)) {
          savedNodes.push({
            id: generateId(),
            name: name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
            type: 'folder',
            parentId: null,
            createdAt: now,
            updatedAt: now,
            folderMode: mode,
          });
          migrated = true;
        }
      }
      if (migrated) storage.set(FILE_SYSTEM_STORAGE_KEY, savedNodes);
    }

    setNodes(savedNodes);
    setIsLoading(false);
  }, []);

  // Save to local storage whenever nodes change
  useEffect(() => {
    if (!isLoading) {
      storage.set(FILE_SYSTEM_STORAGE_KEY, nodes);
    }
  }, [nodes, isLoading]);

  const createFolder = useCallback((name: string, parentId: string | null = null, folderMode: FolderMode = 'edit') => {
    const id = generateId();
    const now = new Date().toISOString();
    setNodes(prev => [
      ...prev,
      {
        id,
        name: name.trim() || 'New Folder',
        type: 'folder',
        parentId,
        createdAt: now,
        updatedAt: now,
        folderMode,
      }
    ]);
    return id;
  }, []);

  const createFile = useCallback((name: string, content: string = '', parentId: string | null = null) => {
    const id = generateId();
    const now = new Date().toISOString();
    setNodes(prev => [
      ...prev,
      {
        id,
        name: name.trim() || 'Untitled Document',
        type: 'file',
        parentId,
        createdAt: now,
        updatedAt: now,
        content,
      }
    ]);
    return id;
  }, []);

  const renameNode = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();

    setNodes(prev => prev.map(node =>
      node.id === id ? { ...node, name: trimmed, updatedAt: now } : node
    ));
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    const now = new Date().toISOString();
    setNodes(prev => prev.map(node =>
      node.id === id && node.type === 'file' ? { ...node, content, updatedAt: now } : node
    ));
  }, []);

  const deleteNode = useCallback((id: string) => {
    // Delete the node and all its descendants recursively
    setNodes(prev => {
      const getDescendants = (parentId: string): string[] => {
        const children = prev.filter(n => n.parentId === parentId).map(n => n.id);
        return [...children, ...children.flatMap(getDescendants)];
      };

      const idsToDelete = [id, ...getDescendants(id)];
      return prev.filter(node => !idsToDelete.includes(node.id));
    });
  }, []);

  const getFolderChildren = useCallback((folderId: string | null) => {
    return nodes.filter(node => node.parentId === folderId).sort((a, b) => {
      // Folders first, then alphabetically
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [nodes]);

  const getNode = useCallback((id: string | null) => {
    if (!id) return null;
    return nodes.find(node => node.id === id) || null;
  }, [nodes]);

  const getBreadcrumbs = useCallback((id: string | null) => {
    if (!id) return [];
    const breadcrumbs: FileSystemNode[] = [];
    let current = getNode(id);

    while (current) {
      breadcrumbs.unshift(current);
      current = getNode(current.parentId);
    }

    return breadcrumbs;
  }, [getNode]);

  /** Walk up the parent chain to find the nearest folderMode; default to 'edit' */
  const getEffectiveMode = useCallback((nodeId: string | null): FolderMode => {
    if (!nodeId) return 'edit';
    let current = nodes.find(n => n.id === nodeId) || null;
    while (current) {
      if (current.type === 'folder' && current.folderMode) return current.folderMode;
      current = current.parentId ? nodes.find(n => n.id === current!.parentId) || null : null;
    }
    return 'edit';
  }, [nodes]);

  const value = useMemo(() => ({
    nodes,
    isLoading,
    createFolder,
    createFile,
    renameNode,
    updateFileContent,
    deleteNode,
    getFolderChildren,
    getNode,
    getBreadcrumbs,
    getEffectiveMode,
  }), [nodes, isLoading, createFolder, createFile, renameNode, updateFileContent, deleteNode, getFolderChildren, getNode, getBreadcrumbs, getEffectiveMode]);

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
}
