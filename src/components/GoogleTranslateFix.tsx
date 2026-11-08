'use client';

import { useEffect } from 'react';

export function GoogleTranslateFix() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prevent Google Translate / browser translation extensions from crashing React
    // when modifying or replacing DOM text nodes with <font> tags.
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        if (child.parentNode) {
          try {
            return originalRemoveChild.call(child.parentNode, child) as T;
          } catch {
            return child;
          }
        }
        return child;
      }
      return originalRemoveChild.apply(this, [child]) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (referenceNode.parentNode) {
          try {
            return originalInsertBefore.call(referenceNode.parentNode, newNode, referenceNode) as T;
          } catch {
            return newNode;
          }
        }
        return newNode;
      }
      return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
    };
  }, []);

  return null;
}
