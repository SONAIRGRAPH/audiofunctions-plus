# Mixer UI guide (internal)

Internal developer guide for building a mixer panel. Not part of the published docs site.

You do **not** need Tone.js or audio-engine knowledge. Use the React hook `useMixer()`; the audio graph updates by itself.

Related files:

- React API: [`MixerContext.jsx`](./MixerContext.jsx)
- Mute controller: [`SonificationMuteController.jsx`](./SonificationMuteController.jsx)
- Audio engine (do not import from UI): [`../audio/mixerBus.js`](../audio/mixerBus.js)
- Provider is already wrapped in [`../App.jsx`](../App.jsx)

There is **no mixer panel in the app yet**. The API is ready and already wired to sonification.

---

## Mental model

Treat the mixer like a volume desk with folders:

1. **Sources** make sound (function tones, earcons, pink noise).
2. Each source plugs into a **channel** (one fader + mute).
3. Channels sit in a **group** (Instruments / Earcons / Noise).
4. Groups go to a shared **master output**. Master mute is part of `useMixer()` (`isAudioEnabled`, `isOutputOpen`, `audioModality`).

```
source  →  channel fader  →  group fader  →  master (P / AUTO idle / overlays)  →  speakers
```

Everyday analogy:

- **Group** = “all guitars” / “all vocals” / “all FX”
- **Channel** = “Guitar 1”, “Guitar 2”, “snare click”, “applause sample”

Muting the **Instruments** group silences every function tone. Muting only `instrument:f1` leaves Function 2 playing.

---

## Audio modality (AUTO / MANUAL)

The mixer also owns how the **whole** sonification is armed and muted. The two modalities are mutually exclusive; default is **AUTO**.

```js
import { useMixer, AUDIO_MODALITIES } from "../context/MixerContext";

const { audioModality, setAudioModality, AUDIO_MODALITIES } = useMixer();

setAudioModality(AUDIO_MODALITIES.AUTO);    // default
setAudioModality(AUDIO_MODALITIES.MANUAL);
// also accepts "auto" / "manual" (any case)
```

| | AUTO (default) | MANUAL |
|---|---|---|
| On page load | Sonification is off. Cursor can move with no sound. | Same: off until **P**. |
| First enable | First cursor-move key (←/→, J/L, **B**, Space) arms audio as if **P** was pressed. Only once per page load. | Only **P** / header / skip link. |
| After that | **P** (and header) toggle on/off. | Same as today. |
| Idle | After 4s without keyboard/pointer activity, master mutes (clarinet no longer drones). Fade-out starts at 3.5s so the stop is gradual. Activity unmutes without needing **P**. Batch / held-arrow playback is not treated as idle. | Sound stays on until **P**. |
| Overlays | Command palette and dialogs still mute while open. | Same. |

`isAudioEnabled` is the user’s mute/unmute choice — drive the speaker icon from this. AUTO idle mute is temporary and does not change `isAudioEnabled` or the icon; chart activity resumes sound. `isOutputOpen` is whether sound actually reaches the speakers.

Related files:

- Mute policy: [`SonificationMuteController.jsx`](./SonificationMuteController.jsx)
- Idle window: `AUDIO_IDLE_MUTE_MS` (4s) / `AUDIO_IDLE_FADE_START_MS` (3.5s) in [`MixerContext.jsx`](./MixerContext.jsx). Bounds announcements still use the shorter `USER_IDLE_DELAY_MS` in [`../utils/boundsAnnouncement.js`](../utils/boundsAnnouncement.js).

---

## Groups vs channels

| | Group | Channel |
|---|---|---|
| What it is | A category of sound | One specific source |
| How many | Fixed: **3** | Dynamic: created when something starts making sound |
| Controls | All sounds of that type at once | Only that one source |
| Example | “Turn all instruments down” | “Mute Function 1 only” |

### The three groups

| Group id (`MIXER_GROUPS`) | Label | What it controls |
|---|---|---|
| `instruments` | Instruments | Musical tones of the plotted functions |
| `earcons` | Earcons | Short cues (borders, landmarks, ticks, notifications) |
| `noise` | Noise | Pink noise when y is negative |

Groups always exist from app start. Build three group faders first; add a channel list later.

### Channel examples

**Under Instruments**

- `instrument:f1` — tone for function id `f1`
- `instrument:f2` — tone for function `f2`
- One channel per function that has an instrument

**Under Earcons**

- `tick` — grid tick while Shift+moving
- `sample:chart_border` — hit left/right chart edge
- `sample:chart_border_start` — batch playback leaving the start edge
- `sample:no_y` — function leaves visible y range
- `sample:y_axis_intersection` — crossing x = 0
- `sample:notification` — point of interest while stepping
- `sample:deny` — invalid zoom/bounds
- `sample:wasd_keypress` — W/A/S/D pan of the visible chart
- `sample:zoomin` — zoom in (Z)
- `sample:zoomout` — zoom out (Shift+Z)
- `sample:landmark_triangle` / `landmark_square` / `landmark_diamond`

**Under Noise**

- `pinkNoise` — currently the only noise channel (muting the group or this channel is the same in practice)

---

## How channels are named

Use `id` for controls and `label` for display.

| Kind | Id pattern | Example |
|---|---|---|
| Instrument | `instrument:<functionId>` | `instrument:f1` |
| Sample earcon | `sample:<sampleName>` | `sample:chart_border` |
| Tick | `tick` | `tick` |
| Pink noise | `pinkNoise` | `pinkNoise` |

Helpers on `MIXER_CHANNELS`:

```js
MIXER_CHANNELS.tick                         // "tick"
MIXER_CHANNELS.pinkNoise                    // "pinkNoise"
MIXER_CHANNELS.instrument("f1")             // "instrument:f1"
MIXER_CHANNELS.sample("chart_border")       // "sample:chart_border"
```

### Labels today

| Channel id | Label |
|---|---|
| `instrument:f1` | Function name, else instrument name, else `"Instrument f1"` |
| `tick` | `"Tick"` |
| `pinkNoise` | `"Pink noise"` |
| `sample:*` | Raw sample name (`"chart_border"`, `"landmark_triangle"`, …) |

Sample labels are technical. You may map them to friendlier copy in the UI.

### Channel object shape

```js
{
  id: "instrument:f1",      // pass this to setChannelVolume / setChannelMuted
  label: "Function 1",      // show this to the user
  groupId: "instruments",   // which group section this belongs under
  muted: false,
  volume: 1                 // linear 0..1 (1 = full, 0 = silent)
}
```

Group objects look the same, except `groupId` is unused/null.

---

## React API: `useMixer()`

Must be used under `MixerProvider` (already wrapping the app in `App.jsx`).

```js
import { useMixer } from "../context/MixerContext";

const {
  mixerState,          // full snapshot { groups, channels }
  groups,              // same as mixerState.groups
  channels,            // same as mixerState.channels
  setGroupVolume,      // (groupId, 0..1) => void
  setGroupMuted,       // (groupId, true|false) => void
  setChannelVolume,    // (channelId, 0..1) => void
  setChannelMuted,     // (channelId, true|false) => void
  MIXER_GROUPS,        // { earcons, instruments, noise }
  MIXER_GROUP_LABELS,  // { earcons: "Earcons", ... }
  MIXER_CHANNELS,      // { tick, pinkNoise, sample(name), instrument(id) }
  AUDIO_MODALITIES,    // { AUTO: "auto", MANUAL: "manual" }
  audioModality,       // "auto" | "manual"
  setAudioModality,    // (modality) => void
  isAudioEnabled,      // user's mute/unmute choice — drive the speaker icon from this
  setIsAudioEnabled,   // (bool | fn) => void
  toggleAudio,         // P / header: toggle isAudioEnabled
  isOutputOpen,        // true when sound should actually play
} = useMixer();
```

### Does the UI update automatically?

Yes. `MixerProvider` subscribes to the mixer bus. When groups/channels are created, removed, or have volume/mute changed, `groups` and `channels` update and React re-renders.

---

## Boundaries (what not to do)

1. **Mute/volume only.** Do not start/stop sonification, landmarks, or navigation from the mixer.
2. **Master vs faders.** `setAudioModality` / `setIsAudioEnabled` are the master gate. Mixer faders are per group/channel and do not replace **P**.
3. **Volumes are 0–1**, not dB. Values outside that range are clamped.
4. **No Tone.js in UI.** Do not import `mixerBus` or create Gain nodes. Call the setters.
5. **Channels come and go.** Prefer group controls for a first UI. Key lists on `ch.id`, not array index.
6. **Mute/volume can survive** a temporary audio rebuild. A channel may disappear from the live graph and reappear later with the same settings.
7. **Modalities are exclusive.** There is one `audioModality` value, never AUTO and MANUAL at once.

---

## Code examples

### 1. Three group faders (recommended first UI)

```jsx
import { useMixer } from "../context/MixerContext";

export function MixerGroups() {
  const {
    groups,
    setGroupVolume,
    setGroupMuted,
    MIXER_GROUPS,
    MIXER_GROUP_LABELS,
  } = useMixer();

  return (
    <section>
      <h2>Mixer</h2>
      {Object.values(MIXER_GROUPS).map((groupId) => {
        const group = groups[groupId];

        return (
          <div key={groupId}>
            <label>{MIXER_GROUP_LABELS[groupId]}</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={group.volume}
              onChange={(e) =>
                setGroupVolume(groupId, Number(e.target.value))
              }
              aria-label={`${MIXER_GROUP_LABELS[groupId]} volume`}
            />
            <span>{Math.round(group.volume * 100)}%</span>
            <button
              type="button"
              onClick={() => setGroupMuted(groupId, !group.muted)}
              aria-pressed={group.muted}
            >
              {group.muted ? "Unmute" : "Mute"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
```

### 2. Dynamic channel list under each group

```jsx
import { useMixer } from "../context/MixerContext";

export function MixerChannels() {
  const {
    channels,
    setChannelVolume,
    setChannelMuted,
    MIXER_GROUPS,
    MIXER_GROUP_LABELS,
  } = useMixer();

  const byGroup = Object.values(channels).reduce((acc, ch) => {
    (acc[ch.groupId] ??= []).push(ch);
    return acc;
  }, {});

  return (
    <>
      {Object.values(MIXER_GROUPS).map((groupId) => (
        <section key={groupId}>
          <h3>{MIXER_GROUP_LABELS[groupId]}</h3>
          {(byGroup[groupId] ?? []).map((ch) => (
            <div key={ch.id}>
              <span title={ch.id}>{ch.label}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ch.volume}
                onChange={(e) =>
                  setChannelVolume(ch.id, Number(e.target.value))
                }
                aria-label={`${ch.label} volume`}
              />
              <button
                type="button"
                onClick={() => setChannelMuted(ch.id, !ch.muted)}
              >
                {ch.muted ? "Unmute" : "Mute"}
              </button>
            </div>
          ))}
          {(byGroup[groupId] ?? []).length === 0 && (
            <p>No channels yet</p>
          )}
        </section>
      ))}
    </>
  );
}
```

### 3. Look up a known channel by convention

Channels may not exist until sonification has created them. Check before controlling.

```jsx
import { useMixer } from "../context/MixerContext";

export function KnownChannelButtons() {
  const {
    channels,
    setChannelVolume,
    setChannelMuted,
    setGroupVolume,
    MIXER_GROUPS,
    MIXER_CHANNELS,
  } = useMixer();

  const tick = channels[MIXER_CHANNELS.tick];
  const f1 = channels[MIXER_CHANNELS.instrument("f1")];
  const border = channels[MIXER_CHANNELS.sample("chart_border")];

  return (
    <div>
      <button
        type="button"
        disabled={!tick}
        onClick={() => setChannelVolume(MIXER_CHANNELS.tick, 0.5)}
      >
        Tick → 50%
      </button>

      <button
        type="button"
        disabled={!f1}
        onClick={() =>
          setChannelVolume(MIXER_CHANNELS.instrument("f1"), 0.8)
        }
      >
        Function 1 → 80%
      </button>

      <button
        type="button"
        disabled={!border}
        onClick={() =>
          setChannelMuted(MIXER_CHANNELS.sample("chart_border"), true)
        }
      >
        Mute chart border
      </button>

      <button
        type="button"
        onClick={() => setGroupVolume(MIXER_GROUPS.earcons, 0.3)}
      >
        Earcons group → 30%
      </button>
    </div>
  );
}
```

### 4. Optional prettier labels for `sample:*` channels

```js
const SAMPLE_LABELS = {
  chart_border: "Chart border",
  chart_border_start: "Chart border start",
  no_y: "No Y value",
  y_axis_intersection: "Y-axis intersection",
  notification: "Notification",
  deny: "Denied",
  wasd_keypress: "WASD pan",
  zoomin: "Zoom in",
  zoomout: "Zoom out",
  landmark_triangle: "Landmark (triangle)",
  landmark_square: "Landmark (square)",
  landmark_diamond: "Landmark (diamond)",
};

function displayLabel(channel) {
  if (channel.id.startsWith("sample:")) {
    const name = channel.id.slice("sample:".length);
    return SAMPLE_LABELS[name] ?? channel.label;
  }
  return channel.label;
}
```

### 5. AUTO / MANUAL modality toggle

```jsx
import { useMixer } from "../context/MixerContext";

export function MixerModality() {
  const { audioModality, setAudioModality, AUDIO_MODALITIES } = useMixer();

  return (
    <fieldset>
      <legend>Audio modality</legend>
      <label>
        <input
          type="radio"
          name="audio-modality"
          checked={audioModality === AUDIO_MODALITIES.AUTO}
          onChange={() => setAudioModality(AUDIO_MODALITIES.AUTO)}
        />
        Auto
      </label>
      <label>
        <input
          type="radio"
          name="audio-modality"
          checked={audioModality === AUDIO_MODALITIES.MANUAL}
          onChange={() => setAudioModality(AUDIO_MODALITIES.MANUAL)}
        />
        Manual
      </label>
    </fieldset>
  );
}
```

---

## How to test without a finished panel

1. Enable audio with **P**.
2. Explore the chart so instruments (and maybe ticks/noise) are sounding.
3. Temporarily render one of the examples above, or call setters from a button:
   - `setGroupVolume(MIXER_GROUPS.instruments, 0.2)` — function tones get quieter
   - `setGroupMuted(MIXER_GROUPS.earcons, true)` — landmarks/borders/ticks silent
   - `setChannelMuted(MIXER_CHANNELS.pinkNoise, true)` — no pink noise
4. Confirm **P** still mutes everything regardless of mixer faders.
5. Confirm AUTO (default): leave the clarinet ringing, wait ~3.5s for a fade then mute at 4s; move again and it returns. First ←/→ or **B** after a reload should arm audio without **P**.
6. Confirm MANUAL: `setAudioModality(AUDIO_MODALITIES.MANUAL)` — idle no longer ducks, and cursor keys do not auto-enable.
