'use client';

import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useFileSystem, FileSystemNode, FolderMode } from '@/lib/file-system-context';

interface FileSystemDrawerProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function FileSystemDrawer({ isOpen, setIsOpen }: FileSystemDrawerProps) {
  const {
    nodes,
    createFolder,
    createFile,
    renameNode,
    deleteNode,
    updateFileContent,
    getFolderChildren,
    getBreadcrumbs,
    getNode,
    getEffectiveMode,
  } = useFileSystem();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [unlockedFileIds, setUnlockedFileIds] = useState<Set<string>>(new Set());

  const currentFolderChildren = getFolderChildren(currentFolderId);
  const breadcrumbs = getBreadcrumbs(currentFolderId);
  const activeFile = getNode(activeFileId);
  const currentFolderMode: FolderMode = currentFolderId ? getEffectiveMode(currentFolderId) : 'edit';
  const activeFileMode: FolderMode = (activeFileId && unlockedFileIds.has(activeFileId))
    ? 'edit'
    : (activeFileId ? getEffectiveMode(activeFileId) : 'edit');
  const canEditFolder = currentFolderMode === 'edit';

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFile && editorRef.current) {
      if (editorRef.current.getAttribute('data-file-id') !== activeFile.id) {
        editorRef.current.innerHTML = activeFile.content || '<p><br></p>';
        editorRef.current.setAttribute('data-file-id', activeFile.id);
      }
    }
  }, [activeFile?.id]);

  // When a file is selected, if its content hasn't been saved correctly, typing will trigger onInput
  const handleContentChange = (content: string) => {
    if (activeFileId) {
      updateFileContent(activeFileId, content);
    }
  };

  const handleApplyCommand = (command: string) => {
    document.execCommand(command);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    if (html) {
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'blockquote', 'code', 'pre'],
        FORBID_ATTR: ['style', 'class', 'id', 'dir', 'width', 'height'],
      });
      document.execCommand('insertHTML', false, cleanHtml);
    } else {
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  };

  const startRename = (node: FileSystemNode) => {
    setEditingNodeId(node.id);
    setEditNameValue(node.name);
  };

  const handleCreateFolder = (mode: FolderMode) => {
    const id = createFolder('New Folder', currentFolderId, mode);
    setEditingNodeId(id);
    setEditNameValue('New Folder');
    setIsFolderMenuOpen(false);
  };

  const handleCreateFile = () => {
    const id = createFile('Untitled Document', '', currentFolderId);
    setEditingNodeId(id);
    setEditNameValue('Untitled Document');
    setUnlockedFileIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const confirmRename = () => {
    if (editingNodeId) {
      renameNode(editingNodeId, editNameValue);
    }
    setEditingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, onConfirm: () => void) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      setEditingNodeId(null);
    }
  };

  // If a file is active, it opens the right pane Editor
  const showEditor = !!activeFile;

  const closeActiveFile = () => {
    if (activeFileId && unlockedFileIds.has(activeFileId)) {
      setUnlockedFileIds(prev => {
        const next = new Set(prev);
        next.delete(activeFileId);
        return next;
      });
    }
    setActiveFileId(null);
  };

  return (
    <>
      {/* LEFT PANE: Directory Tree (Drawer) */}
      <aside
        data-files-drawer
        data-open={isOpen ? 'true' : 'false'}
        className={`hidden xl:block fixed right-0 top-[73px] bottom-0 z-30 transition-[width] duration-200 ${isOpen ? 'w-[330px]' : 'w-[56px]'
          }`}
      >
        <div className="h-full w-full rounded-l-2xl border-l border-t border-b border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-sm flex flex-col">
          {!isOpen ? (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-slate-100"
              aria-label="Open file system drawer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.22em] [writing-mode:vertical-rl] rotate-180">
                Files
              </span>
            </button>
          ) : (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">FILES</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Always allow creating folders and files */}
                    <>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                          className="p-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                          title="New Folder"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                        {isFolderMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsFolderMenuOpen(false)}
                            />
                            <div className="absolute top-full left-0 md:left-auto md:right-0 mt-1 w-40 bg-slate-900 border border-slate-700 rounded-md shadow-xl z-50 overflow-hidden">
                              <button
                                onClick={() => handleCreateFolder('edit')}
                                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Default (Edit)
                              </button>
                              <button
                                onClick={() => handleCreateFolder('read-only')}
                                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                                Read-Only
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateFile}
                        className="p-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                        title="New File"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                      aria-label="Collapse files drawer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 text-xs text-slate-400 overflow-x-auto whitespace-nowrap pb-1 no-scrollbar">
                  <button onClick={() => setCurrentFolderId(null)} className="hover:text-slate-100 transition-colors">
                    Root
                  </button>
                  {breadcrumbs.map(b => (
                    <React.Fragment key={b.id}>
                      <span className="text-slate-600">/</span>
                      <button onClick={() => setCurrentFolderId(b.id)} className="hover:text-slate-100 transition-colors max-w-[80px] truncate">
                        {b.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Tree / List view */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {currentFolderChildren.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Empty folder
                  </div>
                ) : (
                  currentFolderChildren.map(node => (
                    <div
                      key={node.id}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${node.id === activeFileId ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                        }`}
                      onClick={() => {
                        if (activeFileId && activeFileId !== node.id && unlockedFileIds.has(activeFileId)) {
                          setUnlockedFileIds(prev => {
                            const next = new Set(prev);
                            next.delete(activeFileId);
                            return next;
                          });
                        }
                        if (node.type === 'folder') {
                          setCurrentFolderId(node.id);
                          closeActiveFile();
                        } else {
                          setActiveFileId(node.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <span className="text-slate-500 shrink-0">
                          {node.type === 'folder' ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                        </span>

                        {editingNodeId === node.id ? (
                          <input
                            autoFocus
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => handleKeyDown(e, confirmRename)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-sm text-white w-full focus:outline-none focus:border-slate-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`text-sm truncate select-none ${node.id === activeFileId ? 'text-white' : 'text-slate-300'}`}>
                              {node.name}
                            </span>
                            {/* Folder mode badge */}
                            {node.type === 'folder' && node.folderMode === 'read-only' && (
                              <span className="shrink-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                                Read-Only
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {getEffectiveMode(node.id) === 'edit' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(node); }}
                            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${node.name}?`)) {
                              deleteNode(node.id);
                              if (activeFileId === node.id) closeActiveFile();
                            }
                          }}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 ml-0.5"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT PANE: File Editor Modal/Overlay */}
      {showEditor && activeFile && isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8 xl:pr-[370px]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeActiveFile}
          />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 shrink-0">
              {activeFileMode === 'edit' ? (
                <input
                  value={activeFile.name}
                  onChange={(e) => renameNode(activeFile.id, e.target.value)}
                  className="flex-1 bg-transparent text-lg font-semibold text-slate-900 dark:text-white focus:outline-none border-b border-transparent focus:border-slate-200 dark:focus:border-slate-700 pb-1 px-1 transition-colors"
                />
              ) : (
                <h2 className="flex-1 text-lg font-semibold text-slate-900 dark:text-white pb-1 px-1">
                  {activeFile.name}
                </h2>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                {activeFileMode === 'read-only' && (
                  <button
                    type="button"
                    onClick={() => {
                      const text = editorRef.current?.innerText || activeFile.content || '';
                      navigator.clipboard.writeText(text);
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
                    title="Copy to clipboard"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </button>
                )}
                <button
                  onClick={closeActiveFile}
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {activeFileMode === 'edit' && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApplyCommand('bold')}
                  className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCommand('italic')}
                  className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm italic font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCommand('insertUnorderedList')}
                  className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  •
                </button>
              </div>
            )}

            <div
              ref={editorRef}
              contentEditable={activeFileMode === 'edit'}
              suppressContentEditableWarning
              onInput={activeFileMode === 'edit' ? (e => handleContentChange(e.currentTarget.innerHTML)) : undefined}
              onPaste={activeFileMode === 'edit' ? handlePaste : undefined}
              className={`flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none ${
                activeFileMode === 'edit'
                  ? 'focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700'
                  : 'cursor-default select-text'
              }`}
              style={{ minHeight: '300px' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
