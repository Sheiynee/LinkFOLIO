import type {
  BgLayer,
  GradientLayer,
  MeshLayer,
  PatternLayer,
  PatternKind,
} from "./themes";

// ── Gradient ────────────────────────────────────────────────
export function gradientCss(g: GradientLayer): string {
  const stops = [...g.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

export function gradientLayerStyle(g: GradientLayer): React.CSSProperties {
  return { background: gradientCss(g) };
}

// ── Mesh (multiple absolutely-positioned radial blurs) ──────
export function meshLayerStyle(m: MeshLayer): React.CSSProperties {
  // Each blob is a radial-gradient. We stack them as a single layered
  // background, separated by commas (CSS supports multiple backgrounds).
  if (m.blobs.length === 0) return {};
  const layers = m.blobs.map((b) => {
    const radius = Math.max(10, Math.min(120, b.size));
    return `radial-gradient(circle at ${b.x}% ${b.y}%, ${b.color} 0%, transparent ${radius}%)`;
  });
  return {
    background: layers.join(", "),
    filter: m.blobs[0].blur ? `blur(${Math.min(120, m.blobs[0].blur)}px)` : undefined,
  };
}

// ── Patterns (inline SVG → data: URL) ───────────────────────
export interface PatternDef {
  id: PatternKind;
  label: string;
  defaultScale: number;
  /** Build the SVG string. color is hex, scale is tile px. */
  svg: (color: string, scale: number) => string;
}

// SVG patterns are written as a single tile that repeats. URL-encoded
// at use site. Color is interpolated as-is — only valid hex/rgba allowed
// from the editor input.
export const PATTERNS: Record<PatternKind, PatternDef> = {
  dots: {
    id: "dots",
    label: "Dot grid",
    defaultScale: 20,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${Math.max(1, s / 16)}" fill="${c}"/></svg>`,
  },
  lines_h: {
    id: "lines_h",
    label: "Horizontal lines",
    defaultScale: 16,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><line x1="0" y1="${s / 2}" x2="${s}" y2="${s / 2}" stroke="${c}" stroke-width="1"/></svg>`,
  },
  lines_d: {
    id: "lines_d",
    label: "Diagonal lines",
    defaultScale: 16,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${c}" stroke-width="1"/></svg>`,
  },
  grid: {
    id: "grid",
    label: "Grid",
    defaultScale: 24,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${c}" stroke-width="1"/></svg>`,
  },
  grid_paper: {
    id: "grid_paper",
    label: "Grid paper",
    defaultScale: 24,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${c}" stroke-width="1"/><path d="M ${s / 2} 0 L ${s / 2} ${s} M 0 ${s / 2} L ${s} ${s / 2}" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.5"/></svg>`,
  },
  topographic: {
    id: "topographic",
    label: "Topographic",
    defaultScale: 60,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g fill="none" stroke="${c}" stroke-width="0.8"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 4}"/><circle cx="${s / 2}" cy="${s / 2}" r="${s / 3}"/><circle cx="${s / 2}" cy="${s / 2}" r="${(s / 2.4)}"/></g></svg>`,
  },
  isometric: {
    id: "isometric",
    label: "Isometric",
    defaultScale: 32,
    svg: (c, s) => {
      const h = s * 0.866;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${h}"><g fill="none" stroke="${c}" stroke-width="1"><path d="M0 0 L${s / 2} ${h / 2} L${s} 0 M0 ${h} L${s / 2} ${h / 2} L${s} ${h}"/></g></svg>`;
    },
  },
  hexagons: {
    id: "hexagons",
    label: "Hexagons",
    defaultScale: 28,
    svg: (c, s) => {
      const a = s / 2;
      const h = a * Math.sqrt(3);
      const w = a * 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h * 2}"><g fill="none" stroke="${c}" stroke-width="1"><path d="M${a} 0 L${w} ${h / 2} L${w} ${h * 1.5} L${a} ${h * 2} L0 ${h * 1.5} L0 ${h / 2} Z"/></g></svg>`;
    },
  },
  checks: {
    id: "checks",
    label: "Checks",
    defaultScale: 24,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s / 2}" height="${s / 2}" fill="${c}"/><rect x="${s / 2}" y="${s / 2}" width="${s / 2}" height="${s / 2}" fill="${c}"/></svg>`,
  },
  crosshatch: {
    id: "crosshatch",
    label: "Crosshatch",
    defaultScale: 16,
    svg: (c, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g stroke="${c}" stroke-width="0.6"><line x1="0" y1="${s}" x2="${s}" y2="0"/><line x1="0" y1="0" x2="${s}" y2="${s}"/></g></svg>`,
  },
};

export const PATTERN_LIST: PatternDef[] = Object.values(PATTERNS);

/** Build a CSS `background-image` data URL for a pattern layer. */
export function patternBackgroundImage(p: PatternLayer): string {
  const def = PATTERNS[p.kind] ?? PATTERNS.dots;
  const scale = Math.max(4, Math.min(200, p.scale || def.defaultScale));
  // Pattern color must be encoded as #rrggbb or rgba(). For #, encode the hash.
  const svg = def.svg(p.color, scale);
  const encoded = svg
    .replace(/"/g, "'")
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/\s+/g, " ");
  return `url("data:image/svg+xml;utf8,${encoded}")`;
}

export function patternLayerStyle(p: PatternLayer): React.CSSProperties {
  return {
    backgroundImage: patternBackgroundImage(p),
    backgroundRepeat: "repeat",
    opacity: Math.max(0, Math.min(1, p.opacity)),
  };
}

// ── Per-layer style dispatch ────────────────────────────────
export function layerStyle(layer: BgLayer): React.CSSProperties {
  switch (layer.type) {
    case "gradient": return gradientLayerStyle(layer);
    case "mesh":     return meshLayerStyle(layer);
    case "pattern":  return patternLayerStyle(layer);
  }
}

/** Short human label for editor list rows. */
export function layerLabel(layer: BgLayer): string {
  switch (layer.type) {
    case "gradient": return `Gradient · ${layer.stops.length} stops`;
    case "mesh":     return `Mesh · ${layer.blobs.length} blobs`;
    case "pattern":  return `Pattern · ${PATTERNS[layer.kind]?.label ?? layer.kind}`;
  }
}
