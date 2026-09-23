import { Volume2, VolumeX, MapPin, Eye, Play, SquareActivity, ChartSpline, CircleGauge, List, ZoomIn, ZoomOut,
  SwatchBook, Sun, Moon, SunMoon, Contrast, Plus, Edit,
  ChartArea, FileChartLine, Import, Share2, FileUp, FileDown, ArrowRightFromLine, ArrowLeftFromLine, RotateCcw, Music, Ruler, HelpCircle, Info, Target, Move } from "lucide-react"
import { useGraphContext } from "../../context/GraphContext";
import { getFunctionNameN, getFunctionInstrumentN, getActiveFunctions, getLandmarksN } from "../../utils/graphObjectOperations";
import { useDialog } from "../../context/DialogContext";
import { THEMES, setTheme } from "../../utils/theme";
import { useAnnouncement } from '../../context/AnnouncementContext';
import { useCommands } from "./useCommands";
import { HOTKEYS, hotkeyFor, functionHotkey, landmarkHotkey } from "./hotkeys";

// Icon per theme. A new theme only needs one line here -- label, keywords and
// announcement live in the THEMES registry in utils/theme.js.
const THEME_ICONS = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
  "high-contrast": Contrast,
  "deuteranopia-protanopia-friendly": Eye,
};

// The palette expects a list of search aliases. Empty entries are dropped: several
// keyword lists are assembled from optional values (landmark label, shortcut).
const toKeywords = (keywords) => keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean);

/**
 * Fills in shortcut and hint from `hotkeys.js`, by id.
 *
 * An item may carry its own `shortcut` instead -- that wins, and `KeyboardHandler`
 * binds it as a global command. The table covers anything with a scope, several
 * combinations or no palette entry.
 */
const withHotkeys = (items) => items.map((item) => ({
  ...item,
  shortcut: item.shortcut ?? hotkeyFor(item.id),
  hint: item.hint ?? HOTKEYS[item.id]?.hint,
  ...(item.children ? { children: withHotkeys(item.children) } : null),
}));

/**
 * Every command of the application, as the item tree of
 * `components/ui/command-palette`.
 *
 * Structure, label, icon and keywords live here; what an entry does lives in
 * `useCommands`, and which key triggers it in `hotkeys.js`, all three joined by the
 * item id.
 *
 * Deliberately not memoised: the array is rebuilt on every render so that each
 * `perform` closes over the current graph state. A dependency list would have to
 * name every value read inside the callbacks, and forgetting one produces stale
 * bounds or a stale cursor. Rebuilding is cheap -- the palette only flattens and
 * filters the tree while it is open, and it suppresses announcements for item
 * changes that do not alter what the user sees.
 */
export const usePaletteItems = () => {
  const { isAudioEnabled, functionDefinitions, graphSettings, focusChart } = useGraphContext();
  const { openDialog } = useDialog();
  const { announce } = useAnnouncement();
  const commands = useCommands();

  // Hands focus back to the chart afterwards. Dialogs manage their own focus and use
  // `openDialog` directly instead.
  const run = (commandId, ...args) => () => {
    commands[commandId](...args);
    setTimeout(() => focusChart(), 100);
  };

  // Check if in read-only or full-restriction mode
  const isReadOnly = graphSettings?.restrictionMode === "read-only";
  const isFullyRestricted = graphSettings?.restrictionMode === "full-restriction";

  // Get current sonification type for active function
  const getCurrentSonificationType = () => {
    if (!functionDefinitions || functionDefinitions.length === 0) return 'continuous';

    const activeIndex = functionDefinitions.findIndex(func => func.isActive);
    if (activeIndex === -1) return 'continuous';

    return getFunctionInstrumentN(functionDefinitions, activeIndex) === 'guitar' ? 'discrete' : 'continuous';
  };

  const currentSonificationType = getCurrentSonificationType();

  // Get active function and its landmarks
  const activeFunctions = getActiveFunctions(functionDefinitions);
  const activeFunction = activeFunctions.length > 0 ? activeFunctions[0] : null;
  const activeFunctionIndex = activeFunction ? functionDefinitions.findIndex(f => f.id === activeFunction.id) : -1;
  const landmarks = activeFunction ? getLandmarksN(functionDefinitions, activeFunctionIndex) : [];

  return withHotkeys([

    // quick options
    {
      id: "quick-options",
      label: "Quick Options",
      keywords: toKeywords("quick, quickoptions"),
      icon: <List />,
      children: [

        {
          id: "toggle-audio",
          label: isAudioEnabled ? "Disable Sound" : "Enable Sound",
          keywords: toKeywords("audio, sound, enable, disable, start, stop, toggle, sonify, sonification, music, tone, mute, unmute, volume, hearing"),
          perform: run("toggle-audio"),
          icon: isAudioEnabled
            ? <VolumeX />
            : <Volume2 />,
        },

        {
          id: "play-function",
          label: "Play Function",
          keywords: toKeywords("play, run, complete, automatic, auto, autoplay, batch, sonify, listen, hear, full, entire, whole"),
          perform: run("play-function"),
          icon: <Play />,
        },

        {
          id: "next-function",
          label: "Next Function",
          keywords: toKeywords("switch, function, next, rotate, cycle, change, active, select, navigate, iterate, loop"),
          perform: run("next-function"),
          icon: <ArrowRightFromLine />,
        },

        {
          id: "prev-function",
          label: "Previous Function",
          keywords: toKeywords("switch, function, previous, prior, back, rotate, cycle, change, active, select, navigate"),
          perform: run("prev-function"),
          icon: <ArrowLeftFromLine />,
        },

        {
          id: "toggle-sonification-type",
          label: `Change Sonification-Instrument to ${currentSonificationType === 'discrete' ? 'Continuous' : 'Discrete'}`,
          keywords: toKeywords("sonification, instrument, discrete, continuous, guitar, clarinet, toggle, sound, type, mode, timbre"),
          perform: run("toggle-sonification-type"),
          icon: <Music />,
        },

        {
          id: "show-coordinates",
          label: "Show Current Coordinates",
          keywords: toKeywords("coordinates, position, location, cursor, point, x, y, current, where, place"),
          perform: run("show-coordinates"),
          icon: <MapPin />,
        },

        {
          id: "show-view-bounds",
          label: "Show current view bounds",
          keywords: toKeywords("bound, view, range, axis, limits, window, viewport, boundaries, min, max, xmin, xmax, ymin, ymax, scale, zoom"),
          perform: run("show-view-bounds"),
          icon: <Ruler />,
        },

        {
          id: "center-at-cursor",
          label: "Center View at Cursor",
          keywords: toKeywords("center, cursor, view, middle, position, focus, centering, navigate, jump, move"),
          perform: run("center-at-cursor"),
          icon: <Target />,
        },

        {
          id: "zoom-in",
          label: "Zoom In",
          keywords: toKeywords("zoom, in, closer, magnify, enlarge, scale, view, detail"),
          perform: run("zoom-in"),
          icon: <ZoomIn />,
        },

        {
          id: "zoom-out",
          label: "Zoom Out",
          keywords: toKeywords("zoom, out, farther, shrink, reduce, scale, view, overview"),
          perform: run("zoom-out"),
          icon: <ZoomOut />,
        },

        {
          id: "reset-view",
          label: "Reset View",
          keywords: toKeywords("reset, restore, standard, default, original, initial, revert, back"),
          perform: run("reset-view"),
          icon: <RotateCcw />,
        },

      ],
    },



  //landmarks
  {
    id: "landmarks",
    label: "Landmarks",
    keywords: toKeywords("landmark, bookmarks, markers, points, navigation, jump, goto, position, coordinates"),
    icon: <MapPin />,
    children: [

      // Individual landmark actions (jump/navigate)
      ...landmarks.map((landmark, index) => ({
        id: `jump-to-landmark-${index}`,
        label: `${landmark.label || `Landmark ${index + 1}`} (${landmark.x.toFixed(2)}, ${landmark.y.toFixed(2)})`,
        ...(landmark.shortcut ? landmarkHotkey(landmark.shortcut) : null),
        keywords: toKeywords(`landmark, jump, goto, navigate, ${landmark.label || ''}, ${landmark.shortcut ? `l${landmark.shortcut}` : ''}`),
        perform: run("jump-to-landmark-object", landmark),
        icon: <MapPin />,
      })),

      {
        id: "prev-landmark",
        label: "Previous Landmark",
        keywords: toKeywords("landmark, previous, back, left, jump, navigate, boundary, edge"),
        perform: run("prev-landmark"),
        icon: <MapPin />,
      },

      {
        id: "next-landmark",
        label: "Next Landmark",
        keywords: toKeywords("landmark, next, forward, right, jump, navigate, boundary, edge"),
        perform: run("next-landmark"),
        icon: <MapPin />,
      },

      // Edit landmarks parent - only show if there are landmarks
      ...(landmarks.length > 0 ? [{
        id: "edit-landmarks",
        label: "Edit Landmarks",
        keywords: toKeywords("edit, modify, change, landmarks, manage, update, configure"),
        icon: <Edit />,
        children: landmarks.map((landmark, index) => ({
          id: `edit-landmark-${index}`,
          label: `Edit ${landmark.label || `Landmark ${index + 1}`}`,
          keywords: toKeywords(`edit, modify, change, landmark, ${landmark.label || ''}, ${landmark.shortcut ? `e${landmark.shortcut}` : ''}`),
          perform: () => {
            openDialog("edit-landmark", {
              landmarkData: {
                functionIndex: activeFunctionIndex,
                landmarkIndex: index,
                landmark: landmark
              }
            });
          },
          icon: <Edit />,
        })),
      }] : []),

      {
        id: "add-landmark",
        label: "Add Landmark at Cursor",
        keywords: toKeywords("add, create, new, landmark, bookmark, marker, current, position, cursor"),
        perform: run("add-landmark"),
        icon: <Plus />,
      },

    ],
  },

  // Function Options
  {
    id: "function-options",
    label: "Functions",
    keywords: toKeywords("function, options, settings, configure, manage, edit, change"),
    icon: <SquareActivity />,
    children: [

      // Individual function selection actions
      ...(functionDefinitions || []).map((func, index) => {
        const functionName = getFunctionNameN(functionDefinitions, index) || `Function ${index + 1}`;

        return {
          id: `show-function-${index}`,
          label: `Show ${functionName}`,
          ...functionHotkey(index),
          keywords: toKeywords(`function, show, display, activate, select, switch, ${functionName}, graph, plot, f${index + 1}, Choose ${functionName}, Choose ${index + 1}`),
          perform: run("show-function", index),
          icon: <Eye />,
        };
      }),

      // Edit functions - only show if not in full-restriction mode
      ...(!isFullyRestricted ? [
        {
          id: "functions-menu",
          label: isReadOnly ? "View Functions" : "Edit Functions",
          keywords: isReadOnly
            ? toKeywords("function, view, read, inspect, examine, look, display, show, formula, equation, math")
            : toKeywords("function, change, edit, modify, create, add, insert, remove, delete, formula, equation, math, input, type, write"),
          perform: () => commands["functions-menu"](),
          icon: <ChartSpline />,
        }
      ] : []),

    ],
  },

  // Diagram Options
  {
    id: "diagram-options",
    label: "Diagram Options",
    keywords: toKeywords("diagram, graph, chart, plot, options, settings, configuration, view, display, visual"),
    icon: <FileChartLine />,
    children: [

      {
        id: "set-view",
        label: "Set View",
        keywords: toKeywords("view, bounds, range, limits, window, axis, xmin, xmax, ymin, ymax, zoom, scale, viewport, boundaries, change, set, configure"),
        perform: () => openDialog("change-graph-bound"),
        icon: <ChartArea />,
      },

      {
        id: "movement-adjustments",
        label: "Movement Adjustments",
        keywords: toKeywords("movement, speed, step, navigation, adjustments, cursor, motion, velocity, increment, stepsize, keyboard, arrow, smooth, stepwise"),
        perform: () => commands["movement-adjustments"](),
        icon: <CircleGauge />,
      },

    ],
  },

  {
    id: "navigation-help",
    label: "Navigation Help",
    keywords: toKeywords("navigation, shortcuts, keyboard, controls, help, guide, movement, cursor, zoom, pan, audio, instructions"),
    perform: () => openDialog("navigation-help"),
    icon: <Move />,
  },

  // Change theme
  {
    id: "change-theme",
    label: "Change Theme",
    keywords: toKeywords("theme, appearance, color, style, visual, dark, light, contrast, accessibility, colorblind"),
    icon: <SwatchBook />,
    children: THEMES.map((theme) => {
      const Icon = THEME_ICONS[theme.id] ?? SwatchBook;
      return {
        id: `${theme.id}-theme`,
        label: theme.label,
        keywords: toKeywords(theme.keywords),
        perform: () => { setTheme(theme.id); announce(theme.announcement); },
        icon: <Icon />,
      };
    }),
  },

  // Import/Export - only show if not in read-only or full-restriction mode
  ...(!isReadOnly && !isFullyRestricted ? [
    {
      id: "import-export",
      label: "Import/Export",
      keywords: toKeywords("import, export, json, file, save, load, share, backup, restore, transfer, exchange"),
      icon: <Import />,
      children: [
        {
          id: "share",
          label: "Share",
          keywords: toKeywords("share, export, link, url, collaborate, send, distribute, publish, online"),
          perform: () => openDialog("share"),
          icon: <Share2 />,
        },
        {
          id: "import-json",
          label: "Import from file",
          keywords: toKeywords("import, json, upload, file, load, open, restore, read, backup"),
          perform: () => openDialog("import-json"),
          icon: <FileUp />,
        },
        {
          id: "export-json",
          label: "Export as file",
          keywords: toKeywords("export, json, download, save, file, backup, store, preserve"),
          perform: () => openDialog("export-json"),
          icon: <FileDown />,
        }
      ],
    }
  ] : []),

  // Only Import if in read-only or fully restricted mode
  ...(isReadOnly || isFullyRestricted ? [
    {
      id: "import-json",
      label: "Import from file",
      keywords: toKeywords("import, json, upload, file, load, open, restore, read, backup"),
      perform: () => openDialog("import-json"),
      icon: <FileUp />,
    }
  ] : []),

  // Help section
  {
    id: "help-section",
    label: "Help & Information",
    keywords: toKeywords("help, information, about, tutorial, guide, documentation, manual, instructions, support"),
    icon: <HelpCircle />,
    children: [

      {
        id: "help",
        label: "Help",
        keywords: toKeywords("help, tutorial, guide, welcome, introduction, getting, started, how, to, use, learn, documentation, manual, instructions"),
        perform: () => commands["help"](),
        icon: <HelpCircle />,
      },

      {
        id: "about",
        label: "About AudioFunctions+",
        keywords: toKeywords("about, info, information, copyright, license, developers, version, team, credits, acknowledgments, universities, funding, eu, project"),
        perform: () => openDialog("about"),
        icon: <Info />,
      },

    ],
  },

  ]);
};
