const BOUNDS_ANNOUNCE_DELAY_MS = 700;
let boundsAnnounceTimeoutId = null;

const formatBoundsAnnouncement = ({ xMin, xMax, yMin, yMax }) => {
  const format = (value) => Number(value).toFixed(2);
  return `Visible bounds: x from ${format(xMin)} to ${format(xMax)}, y from ${format(yMin)} to ${format(yMax)}`;
};

export const cancelBoundsAnnouncement = () => {
  if (boundsAnnounceTimeoutId) {
    clearTimeout(boundsAnnounceTimeoutId);
    boundsAnnounceTimeoutId = null;
  }
};

export const scheduleBoundsAnnouncement = (announce, getBounds) => {
  cancelBoundsAnnouncement();
  boundsAnnounceTimeoutId = setTimeout(() => {
    boundsAnnounceTimeoutId = null;
    const bounds = getBounds?.();
    if (!bounds || !announce) return;
    announce(formatBoundsAnnouncement(bounds));
  }, BOUNDS_ANNOUNCE_DELAY_MS);
};
