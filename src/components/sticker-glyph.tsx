import {
  Star, Heart, Sparkles, Flame, Zap, Sun, Moon, Cloud,
  Music, Gamepad2, Camera, Mic, Headphones, Tv,
  ThumbsUp, PartyPopper, Trophy, Crown, Gem, Rocket,
  Smile, Eye, Coffee, Pizza,
  type LucideIcon,
} from "lucide-react";
import type { StickerIcon } from "@/lib/visual-elements";

/**
 * Static import map keeps tree-shaking working — only the curated sticker set
 * gets bundled, not all of lucide. Adding a sticker to STICKER_ICONS in
 * `lib/visual-elements.ts` also requires adding the import + map entry here.
 */
const STICKER_MAP: Record<StickerIcon, LucideIcon> = {
  Star, Heart, Sparkles, Flame, Zap, Sun, Moon, Cloud,
  Music, Gamepad2, Camera, Mic, Headphones, Tv,
  ThumbsUp, PartyPopper, Trophy, Crown, Gem, Rocket,
  Smile, Eye, Coffee, Pizza,
};

export function StickerGlyph({
  icon,
  color,
  className,
}: {
  icon: StickerIcon;
  color: string;
  className?: string;
}) {
  const Icon = STICKER_MAP[icon] ?? Sparkles;
  return (
    <Icon
      className={className}
      style={{ color, width: "100%", height: "100%" }}
      strokeWidth={1.75}
    />
  );
}
