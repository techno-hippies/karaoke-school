import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Formats large numbers into readable strings with K/M suffixes
 * @param count - The number to format
 * @returns Formatted string (e.g., 1234 -> "1.2K", 1234567 -> "1.2M")
 */
export function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}