import {
  ArrowRight, ExternalLink, Download, Mail,
  Twitch, Youtube, Github, Twitter,
  Music, Heart, Star, Send,
  type LucideIcon,
} from "lucide-react";
import type { ButtonIcon } from "@/lib/visual-elements";

const ICON_MAP: Record<ButtonIcon, LucideIcon> = {
  ArrowRight, ExternalLink, Download, Mail,
  Twitch, Youtube, Github, Twitter,
  Music, Heart, Star, Send,
};

export function ButtonIconGlyph({ icon, className }: { icon: ButtonIcon; className?: string }) {
  const Icon = ICON_MAP[icon] ?? ArrowRight;
  return <Icon className={className} />;
}
