import { Volume2, VolumeX, MapPin, Eye, Play, SquareActivity, ChartSpline, CircleGauge, List, ZoomIn, ZoomOut,
  SwatchBook, Sun, Moon, SunMoon, Contrast, Plus, Edit,
  ChartArea, FileChartLine, Import, Share2, FileUp, FileDown, ListRestart, RotateCcw, Music, Ruler, HelpCircle, Info, Target, Move } from "lucide-react"
import { useGraphContext } from "../../context/GraphContext";
import { getFunctionNameN, setFunctionInstrumentN, getFunctionInstrumentN, getActiveFunctions, getLandmarksN } from "../../utils/graphObjectOperations";
import { jumpToLandmarkWithToast, addLandmarkAtCursorPosition } from "../../utils/landmarkUtils";
import { useDialog } from "../../context/DialogContext";
import { THEMES, setTheme } from "../../utils/theme";
import { useZoomBoard, useCenterAtCursor } from "./KeyboardHandler";
import { useAnnouncement } from '../../context/AnnouncementContext';
import { useInfoToast } from '../../context/InfoToastContext';

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
 * Every command of the application, as the item tree of
 * `components/ui/command-palette`.
 *
 * Deliberately not memoised: the array is rebuilt on every render so that each
 * `perform` closes over the current graph state. A dependency list would have to
 * name every value read inside the callbacks, and forgetting one produces stale
 * bounds or a stale cursor. Rebuilding is cheap -- the palette only flattens and
 * filters the tree while it is open, and it suppresses announcements for item
 * changes that do not alter what the user sees.
 */
export const usePaletteItems = () => {
  const { isAudioEnabled, setIsAudioEnabled, cursorCoords, functionDefinitions, setFunctionDefinitions, setPlayFunction, graphSettings, graphBounds, setGraphBounds, updateCursor, focusChart } = useGraphContext();
  const { openDialog } = useDialog();
  const { announce } = useAnnouncement();
  const { showInfoToast, showLandmarkToast } = useInfoToast();

  // Function to jump to landmark using utility
  const jumpToLandmark = (landmark) => {
    jumpToLandmarkWithToast(landmark, updateCursor, graphBounds, announce, showLandmarkToast);
  };

  // Check if in read-only or full-restriction mode
  const isReadOnly = graphSettings?.restrictionMode === "read-only";
  const isFullyRestricted = graphSettings?.restrictionMode === "full-restriction";

  const ZoomBoard = useZoomBoard();
  const centerAtCursor = useCenterAtCursor();

  const showCoordinates = () => {
    if (!cursorCoords || cursorCoords.length === 0) {
        announce("No cursor position available");
        return;
    }

    const messages = cursorCoords.map(coord => {
        const functionIndex = functionDefinitions.findIndex(f => f.id === coord.functionId);
        const functionName = getFunctionNameN(functionDefinitions, functionIndex) || `Function ${functionIndex + 1}`;
        const roundedX = Number(coord.x).toFixed(2);
        const roundedY = Number(coord.y).toFixed(2);

        // Check if there's a landmark at the current position
        const landmarks = getLandmarksN(functionDefinitions, functionIndex);
        const epsilon = 0.01; // Small tolerance for floating point comparison
        const landmarkAtPosition = landmarks.find(landmark =>
            Math.abs(landmark.x - coord.x) < epsilon &&
            Math.abs(landmark.y - coord.y) < epsilon
        );

        let message = `${functionName}: `;
        if (landmarkAtPosition) {
            message += `"${landmarkAtPosition.label}" at \n`;
        }
        message += `x = ${roundedX}, y = ${roundedY}`;

        return message;
    });

    const message = messages.join('\n');
    announce(`Current Coordinates:\n\n${message}`);
    showInfoToast(`Current Coordinates:\n\n${message}`);
  };


  const showViewBounds = () => {
    const { xMin, xMax, yMin, yMax } = graphBounds;
    const roundedXMin = Number(xMin).toFixed(2);
    const roundedXMax = Number(xMax).toFixed(2);
    const roundedYMin = Number(yMin).toFixed(2);
    const roundedYMax = Number(yMax).toFixed(2);
    const message = `Current View Bounds:\n\nX: [${roundedXMin}, ${roundedXMax}]\nY: [${roundedYMin}, ${roundedYMax}]`;
    announce(message);
    showInfoToast(message);
  }

  // Switch to next active function
  const switchToNextFunction = () => {
    if (!functionDefinitions || functionDefinitions.length === 0) return;

    // Find currently active function
    const currentActiveIndex = functionDefinitions.findIndex(func => func.isActive);

    // If no function is active, activate the first one
    if (currentActiveIndex === -1) {
      if (functionDefinitions.length > 0) {
        const updatedDefinitions = functionDefinitions.map((func, index) => ({
          ...func,
          isActive: index === 0
        }));
        setFunctionDefinitions(updatedDefinitions);
      }
      return;
    }

    // Find next function index (rotate through the list)
    const nextIndex = (currentActiveIndex + 1) % functionDefinitions.length;

    // Deactivate all functions and activate the next one
    const updatedDefinitions = functionDefinitions.map((func, index) => ({
      ...func,
      isActive: index === nextIndex
    }));

    setFunctionDefinitions(updatedDefinitions);

    // Announce the switch
    const functionName = getFunctionNameN(functionDefinitions, nextIndex) || `Function ${nextIndex + 1}`;
    announce(`Switched to ${functionName}`);
    showInfoToast(`${functionName}`, 1500);
  };

  // Show specific function and hide all others
  const showOnlyFunction = (targetIndex) => {
    if (!functionDefinitions || targetIndex < 0 || targetIndex >= functionDefinitions.length) return;

    const updatedDefinitions = functionDefinitions.map((func, index) => ({
      ...func,
      isActive: index === targetIndex
    }));

    setFunctionDefinitions(updatedDefinitions);

    // Announce the switch
    const functionName = getFunctionNameN(functionDefinitions, targetIndex) || `Function ${targetIndex + 1}`;
    announce(`Switched to ${functionName}`);
    showInfoToast(`${functionName}`, 1500);
  };

  // Toggle sonification type for active function and apply to all functions
  const toggleSonificationType = () => {
    if (!functionDefinitions || functionDefinitions.length === 0) return;

    // Find currently active function
    const activeIndex = functionDefinitions.findIndex(func => func.isActive);
    if (activeIndex === -1) return;

    const currentInstrument = getFunctionInstrumentN(functionDefinitions, activeIndex);

    // Toggle between discrete (guitar) and continuous (clarinet) sonification
    const newInstrument = currentInstrument === 'guitar' ? 'clarinet' : 'guitar';
    const sonificationType = newInstrument === 'guitar' ? 'discrete' : 'continuous';

    // Apply the new instrument to ALL functions
    const updatedDefinitions = functionDefinitions.map((func) =>
      setFunctionInstrumentN([func], 0, newInstrument)[0]
    );

    setFunctionDefinitions(updatedDefinitions);

    announce(`Sonification type changed to ${sonificationType}`);
    showInfoToast(`Sonification type: ${sonificationType}`, 1500);
  };

  // Get current sonification type for active function
  const getCurrentSonificationType = () => {
    if (!functionDefinitions || functionDefinitions.length === 0) return 'continuous';

    const activeIndex = functionDefinitions.findIndex(func => func.isActive);
    if (activeIndex === -1) return 'continuous';

    const currentInstrument = getFunctionInstrumentN(functionDefinitions, activeIndex);
    return currentInstrument === 'guitar' ? 'discrete' : 'continuous';
  };

  const currentSonificationType = getCurrentSonificationType();

  // Get active function and its landmarks
  const activeFunctions = getActiveFunctions(functionDefinitions);
  const activeFunction = activeFunctions.length > 0 ? activeFunctions[0] : null;
  const activeFunctionIndex = activeFunction ? functionDefinitions.findIndex(f => f.id === activeFunction.id) : -1;
  const landmarks = activeFunction ? getLandmarksN(functionDefinitions, activeFunctionIndex) : [];

  // Function to add landmark at current cursor position using utility
  const addLandmarkAtCursor = () => {
    addLandmarkAtCursorPosition(
      functionDefinitions,
      cursorCoords,
      setFunctionDefinitions,
      announce,
      showInfoToast,
      openDialog
    );
  };

  return [

    // quick options
    {
      id: "quick-options",
      label: "Quick Options",
      shortcut: ["Q"],
      keywords: toKeywords("quick, quickoptions"),
      icon: <List />,
      children: [

        {
          id: "toggle-audio",
          label: isAudioEnabled ? "Disable Sound" : "Enable Sound",
          shortcut: ["P"],
          keywords: toKeywords("audio, sound, enable, disable, start, stop, toggle, sonify, sonification, music, tone, mute, unmute, volume, hearing"),
          perform: () => {setIsAudioEnabled(prev => !prev); setTimeout(() => focusChart(), 100);},
          icon: isAudioEnabled
            ? <VolumeX />
            : <Volume2 />,
        },

        {
          id: "play-function",
          label: "Play Function",
          shortcut: ["B"],
          keywords: toKeywords("play, run, complete, automatic, auto, autoplay, batch, sonify, listen, hear, full, entire, whole"),
          perform: () => {setPlayFunction(prev => ({ ...prev, source: "play", active: !prev.active })); setTimeout(() => focusChart(), 100);},
          icon: <Play />,
        },

        {
          id: "next-function",
          label: "Next Function",
          shortcut: ["N"],
          keywords: toKeywords("switch, function, next, rotate, cycle, change, active, select, navigate, iterate, loop"),
          perform: () => {switchToNextFunction(); setTimeout(() => focusChart(), 100);},
          icon: <ListRestart />,
        },

        {
          id: "toggle-sonification-type",
          label: `Change Sonification-Instrument to ${currentSonificationType === 'discrete' ? 'Continuous' : 'Discrete'}`,
          shortcut: ["I"],
          keywords: toKeywords("sonification, instrument, discrete, continuous, guitar, clarinet, toggle, sound, type, mode, timbre"),
          perform: () => {toggleSonificationType(); setTimeout(() => focusChart(), 100);},
          icon: <Music />,
        },

        {
          id: "show-coordinates",
          label: "Show Current Coordinates",
          shortcut: ["C"],
          keywords: toKeywords("coordinates, position, location, cursor, point, x, y, current, where, place"),
          perform: () => {showCoordinates(); setTimeout(() => focusChart(), 100);},
          icon: <MapPin />,
        },

        {
          id: "show-view-bounds",
          label: "Show current view bounds",
          shortcut: ["V"],
          keywords: toKeywords("bound, view, range, axis, limits, window, viewport, boundaries, min, max, xmin, xmax, ymin, ymax, scale, zoom"),
          perform: () => {showViewBounds(); setTimeout(() => focusChart(), 100);},
          icon: <Ruler />,
        },

        {
          id: "center-at-cursor",
          label: "Center View at Cursor",
          shortcut: ["Mod", "Z"],
          keywords: toKeywords("center, cursor, view, middle, position, focus, centering, navigate, jump, move"),
          perform: () => {centerAtCursor(); setTimeout(() => focusChart(), 100);},
          icon: <Target />,
        },

        {
          id: "zoom-in",
          label: "Zoom In",
          shortcut: ["Z"],
          hint: "may hold",
          keywords: toKeywords("zoom, in, closer, magnify, enlarge, scale, view, detail"),
          perform: () => {ZoomBoard(false); setTimeout(() => focusChart(), 100);},
          icon: <ZoomIn />,
        },

        {
          id: "zoom-out",
          label: "Zoom Out",
          shortcut: ["Shift", "Z"],
          hint: "may hold",
          keywords: toKeywords("zoom, out, farther, shrink, reduce, scale, view, overview"),
          perform: () => {ZoomBoard(true); setTimeout(() => focusChart(), 100);},
          icon: <ZoomOut />,
        },

        {
          id: "reset-view",
          label: "Reset View",
          shortcut: ["R"],
          keywords: toKeywords("reset, restore, standard, default, original, initial, revert, back"),
          perform: () => {
            const defaultView = graphSettings?.defaultView;
            if (defaultView && Array.isArray(defaultView) && defaultView.length === 4) {
                const [xMin, xMax, yMax, yMin] = defaultView;
                setGraphBounds({ xMin, xMax, yMin, yMax });
              } else {
                setGraphBounds({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
              }
              updateCursor(0);

              announce("View reset to default values");
              showInfoToast("Default view", 1500);

              setTimeout(() => focusChart(), 100);
          },
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
        shortcut: landmark.shortcut ? ["Ctrl", landmark.shortcut] : undefined,
        keywords: toKeywords(`landmark, jump, goto, navigate, ${landmark.label || ''}, ${landmark.shortcut ? `l${landmark.shortcut}` : ''}`),
        perform: () => {
          jumpToLandmark(landmark);
          setTimeout(() => focusChart(), 100);
        },
        icon: <MapPin />,
      })),

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
        shortcut: ["Mod", "B"],
        keywords: toKeywords("add, create, new, landmark, bookmark, marker, current, position, cursor"),
        perform: () => {
          addLandmarkAtCursor();
          setTimeout(() => focusChart(), 100);
        },
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
          shortcut: index < 9 ? [(index + 1).toString()] : undefined,
          keywords: toKeywords(`function, show, display, activate, select, switch, ${functionName}, graph, plot, f${index + 1}, Choose ${functionName}, Choose ${index + 1}`),
          perform: () => {showOnlyFunction(index); setTimeout(() => focusChart(), 100);},
          icon: <Eye />,
        };
      }),

      // Edit functions - only show if not in full-restriction mode
      ...(!isFullyRestricted ? [
        {
          id: "change-function",
          label: isReadOnly ? "View Functions" : "Edit Functions",
          shortcut: ["F"],
          keywords: isReadOnly
            ? toKeywords("function, view, read, inspect, examine, look, display, show, formula, equation, math")
            : toKeywords("function, change, edit, modify, create, add, insert, remove, delete, formula, equation, math, input, type, write"),
          perform: () => {openDialog("edit-function");},
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
        shortcut: ["M"],
        keywords: toKeywords("movement, speed, step, navigation, adjustments, cursor, motion, velocity, increment, stepsize, keyboard, arrow, smooth, stepwise"),
        perform: () => openDialog("movement-adjustments"),
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
        shortcut: ["F1"],
        keywords: toKeywords("help, tutorial, guide, welcome, introduction, getting, started, how, to, use, learn, documentation, manual, instructions"),
        perform: () => openDialog("welcome"),
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

  ];
};
