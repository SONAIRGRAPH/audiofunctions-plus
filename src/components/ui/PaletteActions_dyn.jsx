import { useRegisterActions, Priority } from "kbar";
import { Volume2, VolumeX, MapPin, Eye, Play, SquareActivity, ChartSpline, CircleGauge, List, ZoomIn, ZoomOut,
  SwatchBook, Sun, Moon, SunMoon, Contrast, Plus, Edit,
  ChartArea, FileChartLine, Import, Share2, FileUp, FileDown, ListRestart, RotateCcw, Music, Ruler, HelpCircle, BookOpen, Info, Target } from "lucide-react"
import { useGraphContext } from "../../context/GraphContext";
import { getFunctionNameN, updateFunctionN, setFunctionInstrumentN, getFunctionInstrumentN, getActiveFunctions, getLandmarksN, findLandmarkByShortcut } from "../../utils/graphObjectOperations";
import { getScreenPosition, jumpToLandmarkWithToast, addLandmarkAtCursorPosition } from "../../utils/landmarkUtils";
import landmarkEarconManager from "../../utils/landmarkEarcons";
import { useDialog } from "../../context/DialogContext";
import { setTheme } from "../../utils/theme";
import { useZoomBoard, useCenterAtCursor } from "./KeyboardHandler";
import { useAnnouncement } from '../../context/AnnouncementContext';
import { useInfoToast } from '../../context/InfoToastContext';

export const useDynamicKBarActions = () => {
  const { isAudioEnabled, setIsAudioEnabled, cursorCoords, functionDefinitions, setFunctionDefinitions, setPlayFunction, graphSettings, graphBounds, setGraphBounds, updateCursor, focusChart } = useGraphContext();
  const { openDialog } = useDialog();
  const { announce } = useAnnouncement();
  const { showInfoToast, showLandmarkToast } = useInfoToast();

  // Function to jump to landmark using utility
  const jumpToLandmark = (landmark) => {
    jumpToLandmarkWithToast(landmark, updateCursor, graphBounds, announce, showLandmarkToast);
  };

  // Function to jump to landmark by shortcut using utility
  const jumpToLandmarkByShortcut = (shortcut) => {
    const activeFunctions = getActiveFunctions(functionDefinitions);
    if (activeFunctions.length === 0) return;

    const activeFunction = activeFunctions[0];
    const activeFunctionIndex = functionDefinitions.findIndex(f => f.id === activeFunction.id);

    const landmark = findLandmarkByShortcut(functionDefinitions, activeFunctionIndex, shortcut);
    if (landmark) {
      jumpToLandmark(landmark);
    }
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
    const updatedDefinitions = functionDefinitions.map((func, index) =>
      setFunctionInstrumentN([func], 0, newInstrument)[0]
    );

    setFunctionDefinitions(updatedDefinitions);

    announce(`Sonification type changed to ${sonificationType}`);
    showInfoToast(`Sonification type: ${sonificationType}`, 1500);

    // console.log(`Sonification type changed to ${sonificationType} (${newInstrument}) for all functions`);
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

  useRegisterActions([

    // quick options
    {
      id: "quick-options",
      name: "Quick Options",
      shortcut: ["q"],
      keywords: "quick, quickoptions",
      icon: <List className="size-5 shrink-0 opacity-70" />,
    },


    {
      id: "toggle-audio",
      name: isAudioEnabled ? "Stop Audio" : "Start Audio",
      shortcut: ["p"],
      keywords: "audio, sound, enable, disable, start, stop, toggle, sonify, sonification, music, tone, mute, unmute, volume, hearing",
      parent: "quick-options",
      perform: () => {setIsAudioEnabled(prev => !prev); setTimeout(() => focusChart(), 100);},
      icon: isAudioEnabled
        ? <VolumeX className="size-5 shrink-0 opacity-70" />
        : <Volume2 className="size-5 shrink-0 opacity-70" />,
    },

  {
    id: "show-coordinates",
    name: "Show Current Coordinates",
    shortcut: ["c"],
    keywords: "coordinates, position, location, cursor, point, x, y, current, where, place",
    parent: "quick-options",
    perform: () => {showCoordinates(); setTimeout(() => focusChart(), 100);},
    icon: <MapPin className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "show-view-bounds",
    name: "Show current view bounds",
    shortcut: ["v"],
    keywords: "bound, view, range, axis, limits, window, viewport, boundaries, min, max, xmin, xmax, ymin, ymax, scale, zoom",
    parent: "quick-options",
    perform: () => {showViewBounds(); setTimeout(() => focusChart(), 100);},
    icon: <Ruler className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "center-at-cursor",
    name: "Center View at Cursor",
    shortcut: ["ctrl+z"],
    keywords: "center, cursor, view, middle, position, focus, centering, navigate, jump, move",
    parent: "quick-options",
    perform: () => {centerAtCursor(); setTimeout(() => focusChart(), 100);},
    icon: <Target className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "zoom-in",
    name: "Zoom In",
    shortcut: ["z (may hold)"],
    keywords: "zoom, in, closer, magnify, enlarge, scale, view, detail",
    parent: "quick-options",
    perform: () => {ZoomBoard(false);; setTimeout(() => focusChart(), 100);},
    icon: <ZoomIn className="size-5 shrink-0 opacity-70" />
  },

  {
    id: "zoom-out",
    name: "Zoom Out",
    shortcut: ["shift+z (may hold)"],
    keywords: "zoom, out, farther, shrink, reduce, scale, view, overview",
    parent: "quick-options",
    perform: () => {ZoomBoard(true);; setTimeout(() => focusChart(), 100);},
    icon: <ZoomOut className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "next-function",
    name: "Next Function",
    shortcut: ["n"],
    keywords: "switch, function, next, rotate, cycle, change, active, select, navigate, iterate, loop",
    parent: "quick-options",
    perform: () => {switchToNextFunction(); setTimeout(() => focusChart(), 100);},
    icon: <ListRestart className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "play-function",
    name: "Play Function",
    shortcut: ["b"],
    keywords: "play, run, complete, automatic, auto, autoplay, batch, sonify, listen, hear, full, entire, whole",
    parent: "quick-options",
    perform: () => {setPlayFunction(prev => ({ ...prev, source: "play", active: !prev.active })); setTimeout(() => focusChart(), 100);},
    icon: <Play className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "toggle-sonification-type",
    name: `Change Sonification-Instrument to ${currentSonificationType === 'discrete' ? 'Continuous' : 'Discrete'}`,
    shortcut: ["i"],
    keywords: "sonification, instrument, discrete, continuous, guitar, clarinet, toggle, sound, type, mode, timbre",
    parent: "quick-options",
    perform: () => {toggleSonificationType(); setTimeout(() => focusChart(), 100);},
    icon: <Music className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "reset-view",
    name: "Reset View",
    shortcut: ["r"],
    keywords: "reset, restore, standard, default, original, initial, revert, back",
    parent: "quick-options",
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
    icon: <RotateCcw className="size-5 shrink-0 opacity-70" />,
  },

  //landmarks
  {
    id: "landmarks",
    name: "Landmarks",
    keywords: "landmark, bookmarks, markers, points, navigation, jump, goto, position, coordinates",
    icon: <MapPin className="size-5 shrink-0 opacity-70" />,
  },


  // Individual landmark actions (jump/navigate)
  ...landmarks.map((landmark, index) => ({
    id: `jump-to-landmark-${index}`,
    name: `${landmark.label || `Landmark ${index + 1}`} (${landmark.x.toFixed(2)}, ${landmark.y.toFixed(2)})`,
    shortcut: landmark.shortcut ? [`ctrl+${landmark.shortcut}`] : undefined,
    keywords: `landmark, jump, goto, navigate, ${landmark.label || ''}, ${landmark.shortcut ? `l${landmark.shortcut}` : ''}`,
    parent: "landmarks",
    priority: Priority.HIGH,
    perform: () => {
      jumpToLandmark(landmark);
      setTimeout(() => focusChart(), 100);
    },
    icon: <MapPin className="size-5 shrink-0 opacity-70" />,
  })),

  // Edit landmarks parent - only show if there are landmarks
  ...(landmarks.length > 0 ? [{
    id: "edit-landmarks",
    name: "Edit Landmarks",
    keywords: "edit, modify, change, landmarks, manage, update, configure",
    parent: "landmarks",
    icon: <Edit className="size-5 shrink-0 opacity-70" />,
  }] : []),

  // Edit landmark actions
  ...landmarks.map((landmark, index) => ({
    id: `edit-landmark-${index}`,
    name: `Edit ${landmark.label || `Landmark ${index + 1}`}`,
    keywords: `edit, modify, change, landmark, ${landmark.label || ''}, ${landmark.shortcut ? `e${landmark.shortcut}` : ''}`,
    parent: "edit-landmarks",
    priority: Priority.LOW,
    perform: () => {
      openDialog("edit-landmark", {
        landmarkData: {
          functionIndex: activeFunctionIndex,
          landmarkIndex: index,
          landmark: landmark
        }
      });
    },
    icon: <Edit className="size-5 shrink-0 opacity-70" />,
  })),

  {
    id: "add-landmark",
    name: "Add Landmark at Cursor",
    shortcut: ["ctrl+b"],
    keywords: "add, create, new, landmark, bookmark, marker, current, position, cursor",
    parent: "landmarks",
    perform: () => {
      addLandmarkAtCursor();
      setTimeout(() => focusChart(), 100);
    },
    icon: <Plus className="size-5 shrink-0 opacity-70" />,
  },

  // // Function selection section
  // {
  //   id: "select-function",
  //   name: "Switch active Function",
  //   shortcut: [""],
  //   keywords: "function, select, show, display, choose, pick, activate, change, switch, browse",
  //   icon: <SquareActivity className="size-5 shrink-0 opacity-70" />,
  // },

  // Function Options
  {
    id: "function-options",
    name: "Functions",
    keywords: "function, options, settings, configure, manage, edit, change",
    icon: <SquareActivity className="size-5 shrink-0 opacity-70" />,
  },

  // Individual function selection actions
  ...(functionDefinitions || []).map((func, index) => {
    const functionName = getFunctionNameN(functionDefinitions, index) || `Function ${index + 1}`;

    return {
      id: `show-function-${func.id}`,
      name: `Show ${functionName}`,
      shortcut: index < 9 ? [(index + 1).toString()] : undefined,
      keywords: `function, show, display, activate, select, switch, ${functionName}, graph, plot, f${index + 1}`,
      parent: "function-options",
      priority: Priority.HIGH,
      perform: () => {showOnlyFunction(index); setTimeout(() => focusChart(), 100);},
      icon: <Eye className="size-5 shrink-0 opacity-70" />,
    };
  }),

  // Edit functions - only show if not in full-restriction mode
  ...(!isFullyRestricted ? [
    {
      id: "change-function",
      name: isReadOnly ? "View Functions" : "Edit Functions",
      shortcut: ["f"],
      parent: "function-options",
      priority: Priority.HIGH,
      keywords: isReadOnly
        ? "function, view, read, inspect, examine, look, display, show, formula, equation, math"
        : "function, change, edit, modify, create, add, insert, remove, delete, formula, equation, math, input, type, write",
      perform: () => {openDialog("edit-function");},
      icon: <ChartSpline className="size-5 shrink-0 opacity-70" />,
    }
  ] : []),

  // Diagram Options
  {
    id: "diagram-options",
    name: "Diagram Options",
    keywords: "diagram, graph, chart, plot, options, settings, configuration, view, display, visual",
    icon: <FileChartLine className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "set-view",
    name: "Set View",
    keywords: "view, bounds, range, limits, window, axis, xmin, xmax, ymin, ymax, zoom, scale, viewport, boundaries, change, set, configure",
    parent: "diagram-options",
    perform: () => openDialog("change-graph-bound"),
    icon: <ChartArea className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "movement-adjustments",
    name: "Movement Adjustments",
    shortcut: ["m"],
    keywords: "movement, speed, step, navigation, adjustments, cursor, motion, velocity, increment, stepsize, keyboard, arrow, smooth, stepwise",
    parent: "diagram-options",
    perform: () => openDialog("movement-adjustments"),
    icon: <CircleGauge className="size-5 shrink-0 opacity-70" />,
  },

  // Import/Export - only show if not in read-only or full-restriction mode
  ...(!isReadOnly && !isFullyRestricted ? [
    {
      id: "import-export",
      name: "Import/Export",
      keywords: "import, export, json, file, save, load, share, backup, restore, transfer, exchange",
      icon: <Import className="size-5 shrink-0 opacity-70" />,
      priority: Priority.LOW
    },
    {
      id: "share",
      name: "Share",
      keywords: "share, export, link, url, collaborate, send, distribute, publish, online",
      parent: "import-export",
      perform: () => openDialog("share"),
      icon: <Share2 className="size-5 shrink-0 opacity-70" />,
    },
    {
      id: "import-json",
      name: "Import from file",
      keywords: "import, json, upload, file, load, open, restore, read, backup",
      parent: "import-export",
      perform: () => openDialog("import-json"),
      icon: <FileUp className="size-5 shrink-0 opacity-70" />,
    },
    {
      id: "export-json",
      name: "Export as file",
      keywords: "export, json, download, save, file, backup, store, preserve",
      parent: "import-export",
      perform: () => openDialog("export-json"),
      icon: <FileDown className="size-5 shrink-0 opacity-70" />,
    }
  ] : []),

  // Only Import if in read-only or fully restricted mode
  ...(isReadOnly || isFullyRestricted ? [
    {
      id: "import-json",
      name: "Import from file",
      keywords: "import, json, upload, file, load, open, restore, read, backup",
      perform: () => openDialog("import-json"),
      icon: <FileUp className="size-5 shrink-0 opacity-70" />,
      priority: Priority.LOW
    }
  ] : []),

  // Change theme
  {
    id: "change-theme",
    name: "Change Theme",
    keywords: "theme, appearance, color, style, visual, dark, light, contrast, accessibility, colorblind",
    icon: <SwatchBook className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "system-theme",
    name: "Use System Theme",
    keywords: "theme, system, automatic, os, operating, preference, default, follow",
    parent: "change-theme",
    perform: () => {setTheme("system"); announce("Theme set to system preference");},
    icon: <SunMoon className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "light-theme",
    name: "Light Theme",
    keywords: "theme, light, bright, white, day, normal, standard",
    parent: "change-theme",
    perform: () => {setTheme("light"); announce("Theme set to light mode");},
    icon: <Sun className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "dark-theme",
    name: "Dark Theme",
    keywords: "theme, dark, night, black, low, light, eyes",
    parent: "change-theme",
    perform: () => {setTheme("dark"); announce("Theme set to dark mode");},
    icon: <Moon className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "high-contrast-theme",
    name: "High Contrast Theme",
    keywords: "theme, contrast, high, accessibility, vision, impaired, clear, sharp, bold",
    parent: "change-theme",
    perform: () => {setTheme("high-contrast"); announce("Theme set to high contrast mode");},
    icon: <Contrast className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "deuteranopia-protanopia-friendly-theme",
    name: "Deuteranopia/Protanopia Friendly Theme",
    keywords: "theme, deuteranopia, protanopia, colorblind, accessibility, vision, friendly, color, blind, impaired, green, red",
    parent: "change-theme",
    perform: () => {setTheme("deuteranopia-protanopia-friendly"); announce("Theme set to deuteranopia/protanopia friendly mode");},
    icon: <Eye className="size-5 shrink-0 opacity-70" />,
  },

  // Help section
  {
    id: "help",
    name: "Help",
    keywords: "help, tutorial, guide, welcome, introduction, getting, started, how, to, use, learn, documentation, manual, instructions",
    shortcut: ["F1"],
    perform: () => openDialog("welcome"),
    icon: <HelpCircle className="size-5 shrink-0 opacity-70" />,
    priority: Priority.LOW,
  },

  {
    id: "about",
    name: "About AudioFunctions+",
    keywords: "about, info, information, copyright, license, developers, version, team, credits, acknowledgments, universities, funding, eu, project",
    perform: () => openDialog("about"),
    icon: <Info className="size-5 shrink-0 opacity-70" />,
    priority: Priority.LOW,
  },


], [isAudioEnabled, cursorCoords, functionDefinitions, isReadOnly, focusChart, landmarks, activeFunction, activeFunctionIndex]);

  return null;
};

// wrapper for easy usage
export const PaletteActions = () => {
  useDynamicKBarActions();
  return null;
};
