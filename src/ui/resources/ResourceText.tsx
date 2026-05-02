// ResourceText — renders a free-text fragment (typically a tech card's
// per-color event line, or a tooltip describing a cost) and replaces
// inline `<n> <resource>` references with the canonical `<ResourceToken>`
// icon. Non-resource words (units, attack/defense modifiers, "this
// round", connective words like "and"/"or") are left as text.
//
// Examples:
//   "2 wood and 1 stone"        → [token 2W] and [token 1St]
//   "+1 happiness this round"   → [+1H] this round
//   "+1 attack splash unit"     → +1 attack splash unit (no resource match)
//
// We deliberately keep the parser tiny: a single regex over the resource
// names list. The aim is that *every* on-screen mention of a resource
// quantity becomes an icon — never a bare word — so the hover title is
// always the source of the resource's name (matching `ResourceToken`'s
// existing tooltip behaviour).

import { Fragment } from 'react';
import { Box } from '@mui/material';
import { RESOURCES } from '../../game/resources/types.ts';
import { ResourceToken } from './ResourceToken.tsx';
import type { CardSize } from '../cards/sizes.ts';

export interface ResourceTextProps {
  text: string;
  size?: CardSize;
}

// Build a single regex of the form `([+-]?)(\d+)\s+(gold|wood|...)\b` so
// we can walk the string in one pass and split it into alternating text
// and token chunks.
const RESOURCE_ALT = RESOURCES.join('|');
const RESOURCE_REGEX = new RegExp(
  String.raw`([+-]?)(\d+)\s+(${RESOURCE_ALT})\b`,
  'gi',
);

interface Chunk {
  kind: 'text' | 'token';
  text?: string;
  sign?: '+' | '-' | '';
  count?: number;
  resource?: string;
}

const parseChunks = (text: string): Chunk[] => {
  const chunks: Chunk[] = [];
  let lastIndex = 0;
  // Reset stateful regex before each parse — global regexes share state
  // across calls.
  RESOURCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RESOURCE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }
    const sign = (match[1] ?? '') as '+' | '-' | '';
    const count = Number(match[2]);
    const resource = match[3]!.toLowerCase();
    chunks.push({ kind: 'token', sign, count, resource });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    chunks.push({ kind: 'text', text: text.slice(lastIndex) });
  }
  return chunks;
};

export function ResourceText({ text, size = 'normal' }: ResourceTextProps) {
  const chunks = parseChunks(text);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.3,
        rowGap: 0.2,
        minWidth: 0,
      }}
    >
      {chunks.map((c, i) => {
        if (c.kind === 'token') {
          return (
            <ResourceToken
              key={`t-${i}`}
              resource={c.resource!}
              count={c.count}
              sign={c.sign}
              size={size}
            />
          );
        }
        return (
          <Fragment key={`s-${i}`}>
            <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>
              {c.text}
            </Box>
          </Fragment>
        );
      })}
    </Box>
  );
}

export default ResourceText;
