'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { storage, generateId } from '@/lib/utils';
import { DASHBOARD_PAGES_STORAGE_KEY, FILE_SYSTEM_STORAGE_KEY } from '@/lib/storage-keys';

export type FileNodeType = 'file' | 'folder';

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileNodeType;
  parentId: string | null; // null for root nodes
  createdAt: string;
  updatedAt: string;
  content?: string; // only for files
}

export const ROOT_FOLDER_ID = 'root';

interface FileSystemContextValue {
  nodes: FileSystemNode[];
  isLoading: boolean;
  createFolder: (name: string, parentId?: string | null) => void;
  createFile: (name: string, content?: string, parentId?: string | null) => void;
  renameNode: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  deleteNode: (id: string) => void;
  getFolderChildren: (folderId: string | null) => FileSystemNode[];
  getNode: (id: string | null) => FileSystemNode | null;
  getBreadcrumbs: (id: string | null) => FileSystemNode[];
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

      // Create Root 'Notes' Folder if there are existing notes, or just to have it
      const notesFolderId = generateId();
      initialNodes.push({
        id: notesFolderId,
        name: 'Notes',
        type: 'folder',
        parentId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Migrate existing notes into this folder
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

  const createFolder = useCallback((name: string, parentId: string | null = null) => {
    const now = new Date().toISOString();
    setNodes(prev => [
      ...prev,
      {
        id: generateId(),
        name: name.trim() || 'New Folder',
        type: 'folder',
        parentId,
        createdAt: now,
        updatedAt: now,
      }
    ]);
  }, []);

  const createFile = useCallback((name: string, content: string = '', parentId: string | null = null) => {
    const now = new Date().toISOString();
    setNodes(prev => [
      ...prev,
      {
        id: generateId(),
        name: name.trim() || 'Untitled Document',
        type: 'file',
        parentId,
        createdAt: now,
        updatedAt: now,
        content,
      }
    ]);
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
  }), [nodes, isLoading, createFolder, createFile, renameNode, updateFileContent, deleteNode, getFolderChildren, getNode, getBreadcrumbs]);

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
}
