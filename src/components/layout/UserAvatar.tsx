'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  image?: string | null;
  size?: number;
}

export function UserAvatar({ name, image, size = 32 }: UserAvatarProps) {
  return (
    <Link href="/settings" className="block no-underline">
      <div
        className="rounded-full overflow-hidden flex items-center justify-center bg-accent-slate text-white text-11 font-semibold cursor-pointer hover:ring-2 hover:ring-accent-blue transition-all duration-120"
        style={{ width: size, height: size }}
      >
        {image ? (
          <Image src={image} alt={name} width={size} height={size} className="object-cover" />
        ) : (
          <span>{getInitials(name || 'U')}</span>
        )}
      </div>
    </Link>
  );
}
