import Image from "next/image";
import { MeetingPlatform } from "@prisma/client";

const platformLogoMap: Record<MeetingPlatform, string> = {
  [MeetingPlatform.ZOOM]: "/logos/zoom.svg",
  [MeetingPlatform.GOOGLE_MEET]: "/logos/google-meet.svg",
  [MeetingPlatform.MICROSOFT_TEAMS]: "/logos/teams.svg",
  [MeetingPlatform.OTHER]: "", // No logo for other
};

export function getPlatformLogo(platform: MeetingPlatform): string | null {
  return platformLogoMap[platform] || null;
}

export function PlatformLogo({
  platform,
  size = 20,
  className,
}: {
  platform: MeetingPlatform;
  size?: number;
  className?: string;
}) {
  const logoPath = getPlatformLogo(platform);
  if (!logoPath) return null;

  return (
    <Image
      src={logoPath}
      alt={platform.toLowerCase()}
      width={size}
      height={size}
      className={className}
    />
  );
}

