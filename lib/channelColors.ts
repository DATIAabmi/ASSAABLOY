const CHANNEL_COLORS: Record<string, string> = {
  Email:    "#4F86D9",
  LinkedIn: "#2FA7A0",
  Facebook: "#E46F61",
  Offsite:  "#8A70C9",
};

const FALLBACK_COLORS = ["#509EE3", "#88BF4D", "#F9D45C", "#A989C5", "#98D9D9"];

export function channelColor(name: string, fallbackIndex = 0): string {
  return CHANNEL_COLORS[name] ?? FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}
