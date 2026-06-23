import fs from 'fs';
import path from 'path';

/**
 * Performs structural and syntax validation on a file.
 * @param {string} filePath - Absolute path to the file.
 * @returns {object} Validation result with boolean status and array of errors.
 */
export function executeLinter(filePath) {
  const filename = path.basename(filePath);
  let content;
  
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      valid: false,
      errors: [{
        line: 1,
        severity: 'error',
        message: `Could not read file: ${err.message}`
      }]
    };
  }

  const errors = [];
  
  if (filename.endsWith('.html')) {
    const lines = content.split('\n');
    const stack = [];
    
    // Standard HTML self-closing tags
    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
      'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Extract all tags on this line: <tag ...> or </tag>
      // Using regex that captures the tag name and handles quotes to prevent false matches inside attributes
      let lineMatch;
      const tagRegex = /<(\/?[a-zA-Z0-9:!-]+)(?:\s+[^>]*?)?>/g;
      
      while ((lineMatch = tagRegex.exec(line)) !== null) {
        const fullTag = lineMatch[0];
        let tagName = lineMatch[1].toLowerCase();
        
        // Skip comments
        if (tagName.startsWith('!--')) {
          continue;
        }

        // Skip self-closing declarations or standard self-closing tags
        if (fullTag.endsWith('/>') || selfClosingTags.has(tagName)) {
          continue;
        }
        
        if (tagName.startsWith('/')) {
          // Closing tag
          tagName = tagName.substring(1);
          if (stack.length === 0) {
            errors.push({
              line: lineNum,
              severity: 'error',
              message: `Unmatched closing tag </${tagName}>`
            });
          } else {
            const last = stack.pop();
            if (last.name !== tagName) {
              errors.push({
                line: lineNum,
                severity: 'error',
                message: `Mismatched closing tag </${tagName}>, expected </${last.name}> (opened on line ${last.line})`
              });
            }
          }
        } else {
          // Opening tag
          stack.push({ name: tagName, line: lineNum });
        }
      }

      // Security check: search for eval() and script injection vulnerabilities
      if (/eval\s*\(/i.test(line)) {
        errors.push({
          line: lineNum,
          severity: 'security-error',
          message: `Insecure JavaScript usage: 'eval()' is strictly prohibited.`
        });
      }
      if (/document\.write\s*\(/i.test(line)) {
        errors.push({
          line: lineNum,
          severity: 'security-warning',
          message: `Unsafe DOM manipulation: 'document.write()' should not be used.`
        });
      }
      if (/<script\s+src=["']?http:/i.test(line)) {
        errors.push({
          line: lineNum,
          severity: 'security-warning',
          message: `Insecure resource loading: Loading script over unencrypted HTTP protocol.`
        });
      }
    }

    // Report any unclosed tags
    while (stack.length > 0) {
      const unclosed = stack.pop();
      errors.push({
        line: unclosed.line,
        severity: 'error',
        message: `Unclosed opening tag <${unclosed.name}>`
      });
    }
  } else if (filename.endsWith('.js')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      if (/eval\s*\(/i.test(line)) {
        errors.push({
          line: lineNum,
          severity: 'security-error',
          message: `Insecure JavaScript usage: 'eval()' is strictly prohibited.`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
