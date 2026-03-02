'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

/**
 * Ensures that if a code block is currently being streamed (odd number of ```),
 * we append a trailing ``` so that marked parses it as a complete block rather
 * than a broken paragraph or leaving the ``` raw.
 */
function fixPartialMarkdown(content: string) {
  const codeBlockMatches = content.match(/```/g) || [];
  if (codeBlockMatches.length % 2 !== 0) {
    return content + '\n```';
  }
  return content;
}

// Custom Renderer for Marked
const renderer = new marked.Renderer();

// Custom code block renderer
renderer.code = function ({ text, lang }: { text: string; lang?: string }): string {
  // `marked` typings can sometimes pass an object depending on version. We normalize it.
  if (!lang) lang = '';
  // Ensure language is clean
  const validLang = !!(lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
  let highlighted = text;

  if (validLang !== 'plaintext') {
    try {
      highlighted = hljs.highlight(text, { language: validLang }).value;
    } catch (err) {
      console.warn('Highlighting error', err);
    }
  } else {
    // Basic escaping if plaintext
    highlighted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // encode for easy extraction in the portal later
  const encodedCode = encodeURIComponent(text);

  // Format the output block using tailwind classes
  return `
    <div class="relative group my-4 rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
      <!-- Header bar for code block -->
      <div class="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
        <span class="text-xs font-mono text-slate-400 capitalize">${lang || 'text'}</span>
        <!-- Placeholder for React Portal Copy Button -->
        <span class="copy-button-placeholder" data-code="${encodedCode}"></span>
      </div>
      <!-- Scrollable content -->
      <div class="p-4 overflow-x-auto">
        <pre><code class="font-mono text-[13px] leading-relaxed hljs ${validLang}">${highlighted}</code></pre>
      </div>
    </div>
  `;
};

// Custom inline code renderer
renderer.codespan = function ({ text }: { text: string }): string {
  return `<code class="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[12px] font-mono text-emerald-700 dark:text-emerald-400">${text}</code>`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

// Configure DOMPurify to allow our injected classes and data attributes
const purifyConfig = {
  ALLOWED_TAGS: [
    'div', 'span', 'pre', 'code', 'p', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'br'
  ],
  ALLOWED_ATTR: ['class', 'data-code', 'href', 'target', 'rel'],
};

// --- Copy Button Portal Component ---
function CopyButton({ codeContent }: { codeContent: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(decodeURIComponent(codeContent));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${copied
        ? 'bg-emerald-500/20 text-emerald-400'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      aria-label="Copy code"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// --- Main Message Component ---
export function MarkdownMessage({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyButtonTargets, setCopyButtonTargets] = useState<{ node: HTMLElement; code: string }[]>([]);

  // 1. Process and sanitize HTML string
  const processedContent = fixPartialMarkdown(content);
  // Parse markdown synchronously
  const rawHtml = marked.parse(processedContent) as string;
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, purifyConfig);

  // 2. Finding copy placeholders after raw HTML mounts
  useEffect(() => {
    if (!containerRef.current) return;

    const placeholders = containerRef.current.querySelectorAll('.copy-button-placeholder');
    const targets: { node: HTMLElement; code: string }[] = [];

    placeholders.forEach((el) => {
      const code = el.getAttribute('data-code');
      if (code) {
        targets.push({ node: el as HTMLElement, code });
      }
    });

    setCopyButtonTargets(targets);
  }, [sanitizedHtml]);

  return (
    <div className="markdown-prose space-y-3">
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {/* 3. Render robust React copy buttons over the static HTML placeholders using portals */}
      {copyButtonTargets.map((target, i) =>
        createPortal(<CopyButton key={i} codeContent={target.code} />, target.node)
      )}
    </div>
  );
}
