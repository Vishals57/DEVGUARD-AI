/**
 * Lightweight, regex-based syntax highlighter for Java and Git Diff format.
 */
export function highlightCode(text: string, isDiff: boolean): string {
  if (!text) return "";

  // Escape HTML characters to prevent rendering/XSS issues
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const escaped = escapeHtml(text);

  if (isDiff) {
    const lines = escaped.split("\n");
    const highlightedLines = lines.map(line => {
      // Avoid highlighting empty lines
      if (line === "") return "";

      // Diff headers
      if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("similarity index")) {
        return `<span class="text-indigo-400 font-bold font-mono">${line}</span>`;
      }
      if (line.startsWith("---") || line.startsWith("+++")) {
        return `<span class="text-indigo-300 font-semibold font-mono">${line}</span>`;
      }
      // Chunk headers (e.g. @@ -1,4 +1,5 @@)
      if (line.startsWith("@@")) {
        return `<span class="text-cyan-400 font-mono bg-cyan-950/20 px-1 rounded">${line}</span>`;
      }
      // Added lines
      if (line.startsWith("+")) {
        return `<span class="text-emerald-400 bg-emerald-500/5 block min-w-full pl-1 border-l-2 border-emerald-500/30">${line}</span>`;
      }
      // Removed lines
      if (line.startsWith("-")) {
        return `<span class="text-rose-400 bg-rose-500/5 block min-w-full pl-1 border-l-2 border-rose-500/30">${line}</span>`;
      }
      // Context lines
      return `<span class="text-white/60 block pl-1.5">${line}</span>`;
    });
    return highlightedLines.join("\n");
  } else {
    // Java highlighting using regex replacement of tokens
    // We replace strings and comments first to protect them from keyword highlighting
    const placeholders: string[] = [];
    let currentText = escaped;

    // 1. Strings (double quotes and single quotes)
    currentText = currentText.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
      const id = `___STR_PLACEHOLDER_${placeholders.length}___`;
      placeholders.push(`<span class="text-emerald-400 font-medium">${match}</span>`);
      return id;
    });

    // 2. Comments (block first, then line)
    currentText = currentText.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      const id = `___CMT_PLACEHOLDER_${placeholders.length}___`;
      placeholders.push(`<span class="text-white/35 italic">${match}</span>`);
      return id;
    });

    currentText = currentText.replace(/\/\/.*/g, (match) => {
      const id = `___CMT_PLACEHOLDER_${placeholders.length}___`;
      placeholders.push(`<span class="text-white/35 italic">${match}</span>`);
      return id;
    });

    // 3. Annotations (@Override, @Autowired, @GetMapping, etc)
    currentText = currentText.replace(/@\w+/g, (match) => {
      return `<span class="text-amber-400/90 font-semibold">${match}</span>`;
    });

    // 4. Java Keywords
    const keywords = [
      "class", "interface", "public", "private", "protected", "void", "int", "double", 
      "float", "boolean", "char", "long", "short", "byte", "import", "package", 
      "return", "if", "else", "for", "while", "do", "switch", "case", "break", 
      "continue", "new", "this", "super", "try", "catch", "finally", "throw", 
      "throws", "extends", "implements", "static", "final", "synchronized", 
      "volatile", "transient", "native", "strictfp", "enum", "null", "true", 
      "false", "instanceof"
    ];
    
    // Replace word boundaries
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, "g");
      currentText = currentText.replace(regex, `<span class="text-indigo-400 font-semibold">${keyword}</span>`);
    });

    // 5. Common Type Classes (String, Object, Exception, Exception classes, custom uppercase types)
    // Avoid double matching inside pre-existing HTML tags or placeholders by checking boundary
    currentText = currentText.replace(/\b([A-Z]\w*)\b/g, (match) => {
      if (match.startsWith("___")) return match; // preserve placeholders
      return `<span class="text-violet-400">${match}</span>`;
    });

    // 6. Method calls: word followed by (
    currentText = currentText.replace(/\b(\w+)(?=\()/g, '<span class="text-sky-400">$1</span>');

    // 7. Numbers (avoiding numbers inside placeholder IDs)
    currentText = currentText.replace(/\b(\d+)\b/g, (match, num, offset) => {
      // Check if this number is part of our placeholder format ___STR_PLACEHOLDER_x___
      const surrounding = currentText.substring(Math.max(0, offset - 20), offset + 20);
      if (surrounding.includes("PLACEHOLDER")) {
        return match;
      }
      return `<span class="text-amber-500/95">${match}</span>`;
    });

    // 8. Restore comments and strings (reverse order to handle nested replacements properly)
    for (let i = placeholders.length - 1; i >= 0; i--) {
      currentText = currentText.replace(`___STR_PLACEHOLDER_${i}___`, placeholders[i]);
      currentText = currentText.replace(`___CMT_PLACEHOLDER_${i}___`, placeholders[i]);
    }

    return currentText;
  }
}
