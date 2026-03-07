export function formatDuration(duration?: string | number): string {
  if (!duration) return '';
  
  // If it's already in HH:MM:SS format
  if (typeof duration === 'string' && duration.includes(':')) {
    const parts = duration.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes} min`;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      return `${minutes} min`;
    }
    return duration;
  }

  // If it's a number (seconds)
  const seconds = typeof duration === 'string' ? parseInt(duration, 10) : duration;
  if (isNaN(seconds)) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}
