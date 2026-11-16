import { MIXER_GROUPS, MIXER_CHANNELS } from "./mixerBus";
import { RELATIVE_RANGE, sourceRange } from "./fader";

/**
 * Every mixer channel that is not a function tone, with a readable label.
 *
 * These channels exist in every graph, so the mixer dialog lists them up
 * front and their settings are saved. Function channels (instrument:<id>)
 * come and go with the functions and are not part of this list.
 *
 * Sample names match audioSampleManager.getFilenameForSample().
 *
 * `baseDb` is the built-in level of the sound -- the one place it is set.
 * audioSampleManager.playSample() plays every sample at it, GraphSonification
 * sets the tick and noise synths to it, and the mixer slider starts there
 * (fader.js). Change a sound's loudness here, not at the call site.
 */
const sample = (name, baseDb, label, description) => ({
  id: MIXER_CHANNELS.sample(name),
  groupId: MIXER_GROUPS.earcons,
  label,
  description,
  baseDb,
});

export const MIXER_CATALOG = Object.freeze([
  {
    id: MIXER_CHANNELS.tick,
    groupId: MIXER_GROUPS.earcons,
    label: "Grid tick",
    description: "Click on every grid line while moving with Shift.",
    baseDb: -18,
  },
  sample("chart_border", -20, "Chart border", "The cursor reaches the left or right edge."),
  sample("chart_border_start", -15, "Playback start", "Batch playback leaves the start edge."),
  sample("no_y", -25, "No y value", "The function leaves the visible y range."),
  sample("y_axis_intersection", -12, "Y-axis crossing", "The cursor crosses x = 0."),
  sample("notification", -15, "Point of interest", "A point of interest while stepping."),
  sample("deny", -15, "Not possible", "A zoom or bounds change is not possible."),
  sample("wasd_keypress", -15, "Pan", "The visible chart moves with W, A, S or D."),
  sample("zoomin", -15, "Zoom in", "Zooming in."),
  sample("zoomout", -15, "Zoom out", "Zooming out."),
  sample("landmark_triangle", -12, "Landmark (triangle)", "Landmark with a triangle shape."),
  sample("landmark_square", -12, "Landmark (square)", "Landmark with a square shape."),
  sample("landmark_diamond", -12, "Landmark (diamond)", "Landmark with a diamond shape."),
  {
    id: MIXER_CHANNELS.pinkNoise,
    groupId: MIXER_GROUPS.noise,
    label: "Pink noise",
    description: "Background noise while y is negative.",
    baseDb: -36,
  },
]);

const CATALOG_BY_ID = new Map(MIXER_CATALOG.map((entry) => [entry.id, entry]));

/** Catalog entry for a channel id, or undefined (e.g. function channels). */
export const catalogEntry = (channelId) => CATALOG_BY_ID.get(channelId);

/** True for channels whose settings are saved across sessions. */
export const isPersistentChannel = (channelId) => CATALOG_BY_ID.has(channelId);

/** Readable label: the catalog label, else the label the bus knows. */
export const channelLabel = (channel) => catalogEntry(channel.id)?.label ?? channel.label;

/** Sample name of a sample:* channel, else null. */
export const sampleNameOf = (channelId) =>
  channelId.startsWith("sample:") ? channelId.slice("sample:".length) : null;

/**
 * Fader range of a channel: catalog sounds from their built-in level up to
 * 0 dB, function tones relative with headroom. Groups and the overall volume
 * use RELATIVE_RANGE directly.
 */
export const channelRange = (channelId) => {
  const entry = catalogEntry(channelId);
  return entry ? sourceRange(entry.baseDb) : RELATIVE_RANGE;
};

/** Built-in level of a catalog channel in dB, or undefined (function tones). */
export const builtInLevelDb = (channelId) => catalogEntry(channelId)?.baseDb;
