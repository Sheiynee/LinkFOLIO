import { memo } from "react";
import { ExternalLink } from "lucide-react";
import {
  type Theme,
  buttonRadiusClass,
  buttonExtraStyle,
} from "@/lib/themes";
import {
  type Element,
  sortElementsForPaint,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "@/lib/elements";
import { MOBILE_CANVAS_WIDTH, placementsForMobile } from "@/lib/canvas-mobile";
import type { WidgetData } from "@/lib/widgets/types";
import {
  styleForRole,
  readBlockTypographyOverride,
  resolveElementTypography,
  userFontFaceCss,
  type UserFontRecord,
} from "@/lib/typography";
import { BackgroundLayers } from "./background-layers";
import { StickerGlyph } from "./sticker-glyph";
import { ButtonIconGlyph } from "./button-icon";
import {
  blobPath,
  imageMaskClipPath,
  readButtonMeta,
  readImageMeta,
  readRegionMeta,
  readShapeMeta,
  readStickerMeta,
} from "@/lib/visual-elements";
import { WidgetRenderer } from "./widget-renderer";
import type { ProfileRenderData } from "./profile-render";

export interface ProfileCanvasRenderProps {
  profile: ProfileRenderData;
  elements: Element[];
  theme: Theme;
  preview?: boolean;
  widgetData?: Record<string, WidgetData | undefined>;
  userFonts?: UserFontRecord[];
  /** Overlay rendered above elements (e.g. selection handles in the editor). */
  overlay?: React.ReactNode;
  /** Called when the canvas surface (not an element) is clicked. */
  onSurfaceClick?: () => void;
  /** Render the mobile-reflowed canvas instead of the desktop one. */
  view?: "desktop" | "mobile";
}

export function ProfileCanvasRender({
  profile,
  elements,
  theme,
  preview = false,
  widgetData = {},
  userFonts = [],
  overlay,
  onSurfaceClick,
  view = "desktop",
}: ProfileCanvasRenderProps) {
  const name = profile.display_name ?? profile.username;

  const bodyStyle = styleForRole(theme.typography.body, userFonts);
  const displayStyle = styleForRole(theme.typography.display, userFonts);
  const monoStyle = styleForRole(theme.typography.mono, userFonts);

  const fontFaceCss = userFontFaceCss(userFonts);

  const isMobile = view === "mobile";
  const canvasWidth = isMobile ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;

  // Compute the placement each element uses for this view.
  const placements = isMobile ? placementsForMobile(elements) : null;
  const placed = elements.map((e) => {
    if (placements) {
      const p = placements[e.id];
      return { ...e, x: p.x, y: p.y, w: p.w, h: p.h, rotation: 0 };
    }
    return e;
  });

  const tallestY = placed.reduce((acc, e) => Math.max(acc, e.y + e.h), 0);
  const canvasHeight = Math.max(CANVAS_HEIGHT, tallestY + 80);

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center py-12 px-4 isolate"
      style={{ color: theme.text_color, ...bodyStyle }}
    >
      {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}
      <BackgroundLayers layers={theme.background.layers} />

      <div
        data-canvas-root
        className="relative max-w-full"
        style={{ width: canvasWidth, height: canvasHeight }}
        {...(onSurfaceClick
          ? {
              onClick: (e: React.MouseEvent<HTMLDivElement>) => {
                if (e.currentTarget === e.target) onSurfaceClick();
              },
            }
          : {})}
      >
        {/* Header — avatar, name, bio. Sits at the top of the canvas. */}
        <div
          className="absolute flex flex-col items-center text-center pointer-events-none"
          style={{ left: 0, right: 0, top: 24 }}
        >
          <div
            className="h-24 w-24 mb-3 rounded-full overflow-hidden ring-4"
            style={{ borderColor: theme.accent_color, boxShadow: `0 0 0 4px ${theme.accent_color}40` }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full flex items-center justify-center text-3xl font-bold"
                style={{ backgroundColor: theme.accent_color, color: theme.button_text }}
              >
                {name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold" style={displayStyle}>{name}</h1>
          <p className="mt-0.5 text-sm" style={{ ...monoStyle, color: theme.muted_color }}>
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-2 max-w-sm text-sm" style={{ color: theme.muted_color }}>
              {profile.bio}
            </p>
          )}
        </div>

        {/* Positioned elements */}
        {sortElementsForPaint(placed).map((el) => (
          <ElementBox
            key={el.id}
            element={el}
            theme={theme}
            preview={preview}
            widgetData={widgetData}
            userFonts={userFonts}
            username={profile.username}
          />
        ))}

        {overlay}
      </div>

      <p className="mt-8 text-xs" style={{ color: theme.muted_color }}>
        Powered by{" "}
        <a
          href={preview ? "#" : "/"}
          onClick={preview ? (e) => e.preventDefault() : undefined}
          className="hover:underline font-medium"
          style={{ color: theme.accent_color }}
        >
          LinkFolio
        </a>
      </p>
    </div>
  );
}

/**
 * Memoized per-element box: in the editor every pointer-move frame calls
 * setElements, but unchanged elements keep reference identity (state updaters
 * only spread the moving elements), so memo skips re-rendering the other N-1
 * boxes. On the server-rendered public page memo is a no-op.
 */
const ElementBox = memo(function ElementBox({
  element,
  theme,
  preview,
  widgetData,
  userFonts,
  username,
}: {
  element: Element;
  theme: Theme;
  preview: boolean;
  widgetData: Record<string, WidgetData | undefined>;
  userFonts: UserFontRecord[];
  username: string;
}) {
  const wrapperStyle: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.z,
  };

  return (
    <div
      data-element-id={element.id}
      className="absolute"
      style={wrapperStyle}
    >
      <ElementContent
        element={element}
        theme={theme}
        preview={preview}
        widgetData={widgetData}
        userFonts={userFonts}
        username={username}
      />
    </div>
  );
});

function ElementContent({
  element,
  theme,
  preview,
  widgetData,
  userFonts,
  username,
}: {
  element: Element;
  theme: Theme;
  preview: boolean;
  widgetData: Record<string, WidgetData | undefined>;
  userFonts: UserFontRecord[];
  username: string;
}) {
  const override = readBlockTypographyOverride(element.meta);
  const radiusClass = buttonRadiusClass(theme.button_shape);
  const extraButtonStyle = buttonExtraStyle(theme.button_style);

  if (element.type === "heading") {
    return (
      <h2
        className="w-full h-full flex items-center justify-center text-xl font-bold text-center"
        style={{
          color: theme.text_color,
          ...resolveElementTypography(theme.typography, "heading", override, userFonts),
        }}
      >
        {element.content}
      </h2>
    );
  }
  if (element.type === "text") {
    return (
      <p
        className="w-full h-full whitespace-pre-wrap text-center text-sm leading-relaxed"
        style={{
          color: theme.muted_color,
          ...resolveElementTypography(theme.typography, "body", override, userFonts),
        }}
      >
        {element.content}
      </p>
    );
  }
  if (element.type === "divider") {
    return (
      <hr
        className="w-full border-0 h-px"
        style={{ backgroundColor: theme.muted_color, opacity: 0.3, marginTop: (element.h - 1) / 2 }}
      />
    );
  }
  if (element.type === "link") {
    if (!element.url || !element.title) return null;
    const btn = readButtonMeta(element.meta);
    const variantStyle: React.CSSProperties = (() => {
      switch (btn.variant) {
        case "outline":
          return { background: "transparent", borderColor: theme.accent_color, color: theme.text_color };
        case "ghost":
          return { background: "transparent", borderColor: "transparent", color: theme.text_color };
        case "pill":
          return { backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border, borderRadius: 9999 };
        case "solid":
        default:
          return { backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border };
      }
    })();
    return (
      <a
        href={preview ? "#" : `/r/${element.id}`}
        target={preview ? undefined : "_blank"}
        rel={preview ? undefined : "noopener noreferrer"}
        onClick={preview ? (e) => e.preventDefault() : undefined}
        className={`w-full h-full flex items-center justify-center gap-2 border px-5 transition hover:opacity-90 ${btn.variant === "pill" ? "" : radiusClass}`}
        style={{
          ...variantStyle,
          ...resolveElementTypography(theme.typography, "ui", override, userFonts),
          ...extraButtonStyle,
        }}
      >
        {btn.icon && <ButtonIconGlyph icon={btn.icon} className="h-4 w-4 shrink-0" />}
        <span className="font-medium truncate">{element.title}</span>
        {!btn.icon && <ExternalLink className="h-4 w-4 opacity-60 shrink-0" />}
      </a>
    );
  }
  if (element.type === "widget") {
    return (
      <WidgetRenderer
        id={element.id}
        kind={element.widget_kind}
        meta={element.meta as Record<string, unknown> | null}
        title={element.title}
        theme={theme}
        preview={preview}
        widgetData={widgetData}
        username={username}
      />
    );
  }
  if (element.type === "shape") {
    return <ShapeElement element={element} />;
  }
  if (element.type === "sticker") {
    return <StickerElement element={element} />;
  }
  if (element.type === "image") {
    return <ImageElement element={element} />;
  }
  if (element.type === "region") {
    return <RegionElement element={element} />;
  }
  return null;
}

function RegionElement({ element }: { element: Element }) {
  const meta = readRegionMeta(element.meta);
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ borderRadius: meta.radius }}
    >
      <BackgroundLayers layers={meta.layers} />
    </div>
  );
}

function ShapeElement({ element }: { element: Element }) {
  const meta = readShapeMeta(element.meta);
  const strokeProps = meta.stroke
    ? { stroke: meta.stroke, strokeWidth: meta.strokeWidth }
    : undefined;

  if (meta.kind === "rect") {
    return (
      <div
        className="w-full h-full"
        style={{
          backgroundColor: meta.fill,
          borderRadius: `${meta.radius}%`,
          border: meta.stroke ? `${meta.strokeWidth}px solid ${meta.stroke}` : undefined,
        }}
      />
    );
  }
  if (meta.kind === "circle") {
    return (
      <div
        className="w-full h-full"
        style={{
          backgroundColor: meta.fill,
          borderRadius: "50%",
          border: meta.stroke ? `${meta.strokeWidth}px solid ${meta.stroke}` : undefined,
        }}
      />
    );
  }
  if (meta.kind === "blob") {
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
        <path d={blobPath(meta.seed)} fill={meta.fill} {...strokeProps} />
      </svg>
    );
  }
  if (meta.kind === "triangle") {
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
        <polygon points="50,5 95,95 5,95" fill={meta.fill} {...strokeProps} />
      </svg>
    );
  }
  return null;
}

function StickerElement({ element }: { element: Element }) {
  const meta = readStickerMeta(element.meta);
  return (
    <div className="w-full h-full flex items-center justify-center">
      <StickerGlyph icon={meta.icon} color={meta.color} />
    </div>
  );
}

function ImageElement({ element }: { element: Element }) {
  const meta = readImageMeta(element.meta);
  if (!meta) return null;
  const clipPath = imageMaskClipPath(meta.mask, element.id.charCodeAt(0) + element.id.charCodeAt(1));
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        borderRadius: meta.mask === "rounded" ? 16 : undefined,
        clipPath: clipPath ?? undefined,
        WebkitClipPath: clipPath ?? undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meta.url}
        alt=""
        className="w-full h-full"
        style={{
          objectFit: meta.fit,
          filter: meta.blur > 0 ? `blur(${meta.blur}px)` : undefined,
        }}
      />
    </div>
  );
}

