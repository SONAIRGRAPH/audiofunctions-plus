import { useRegisterActions, Priority } from "kbar";
import { Volume2, VolumeX, MapPin, Eye, Play, SquareActivity, ChartSpline, CircleGauge, List, ZoomIn, ZoomOut,
  SwatchBook, Sun, Moon, SunMoon, Contrast, Plus, Edit,
  ChartArea, FileChartLine, Import, Share2, FileUp, FileDown, ListRestart, RotateCcw, Music, Ruler, HelpCircle, BookOpen, Info, Target, Move } from "lucide-react"
import { useGraphContext } from "../../context/GraphContext";
import { getFunctionNameN, updateFunctionN, setFunctionInstrumentN, getFunctionInstrumentN, getActiveFunctions, getLandmarksN, findLandmarkByShortcut } from "../../utils/graphObjectOperations";
import { getScreenPosition, jumpToLandmarkWithToast, addLandmarkAtCursorPosition } from "../../utils/landmarkUtils";
import landmarkEarconManager from "../../utils/landmarkEarcons";
import { useDialog } from "../../context/DialogContext";
import { setTheme } from "../../utils/theme";
import { useZoomBoard, useCenterAtCursor } from "./KeyboardHandler";
import { useAnnouncement } from '../../context/AnnouncementContext';
import { useInfoToast } from '../../context/InfoToastContext';
import { useLanguage } from "./MultiLanguage";

export const useDynamicKBarActions = () => {
  const { isAudioEnabled, setIsAudioEnabled, cursorCoords, functionDefinitions, setFunctionDefinitions, setPlayFunction, graphSettings, graphBounds, setGraphBounds, updateCursor, focusChart } = useGraphContext();
  const { openDialog } = useDialog();
  const { announce } = useAnnouncement();
  const { showInfoToast, showLandmarkToast } = useInfoToast();
  const { trn } = useLanguage();

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
      name: trn("quick-options"),
      shortcut: ["q"],
      keywords: trn("quick-options-key"),
      icon: <List className="size-5 shrink-0 opacity-70" />,
    },


    {
      id: "toggle-audio",
      name: isAudioEnabled ? trn("disableAudio") : trn("enableAudio"),
      shortcut: ["p"],
      keywords: trn("toggle-audio-key"),
      parent: "quick-options",
      perform: () => {setIsAudioEnabled(prev => !prev); setTimeout(() => focusChart(), 100);},
      icon: isAudioEnabled
        ? <VolumeX className="size-5 shrink-0 opacity-70" />
        : <Volume2 className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "play-function",
      name: trn("play-function"), 
      shortcut: ["b"],
      keywords: trn("play-function-key"),
      parent: "quick-options",
      perform: () => {setPlayFunction(prev => ({ ...prev, source: "play", active: !prev.active })); setTimeout(() => focusChart(), 100);},
      icon: <Play className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "next-function",
      name: trn("next-function"),
      shortcut: ["n"],
      keywords: trn("next-function-key"),
      parent: "quick-options",
      perform: () => {switchToNextFunction(); setTimeout(() => focusChart(), 100);},
      icon: <ListRestart className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "toggle-sonification-type",
      name: `Change Sonification-Instrument to ${currentSonificationType === 'discrete' ? trn("continuous") : trn("discrete")}`,
      shortcut: ["i"],
      keywords: trn("toggle-sonification-type-key"),
      parent: "quick-options",
      perform: () => {toggleSonificationType(); setTimeout(() => focusChart(), 100);},
      icon: <Music className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "show-coordinates",
      name: trn("show-coordinates"),
      shortcut: ["c"],
      keywords: trn("show-coordinates-key"),
      parent: "quick-options",
      perform: () => {showCoordinates(); setTimeout(() => focusChart(), 100);},
      icon: <MapPin className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "show-view-bounds",
      name: trn("show-view-bounds"),
      shortcut: ["v"],
      keywords: trn("show-view-bounds-key"),
      parent: "quick-options",
      perform: () => {showViewBounds(); setTimeout(() => focusChart(), 100);},
      icon: <Ruler className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "center-at-cursor",
      name: trn("center-at-cursor"),
      shortcut: ["ctrl+z"],
      keywords: trn("center-at-cursor-key"),
      parent: "quick-options",
      perform: () => {centerAtCursor(); setTimeout(() => focusChart(), 100);},
      icon: <Target className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "zoom-in",
      name: trn("zoom-in"),
      shortcut: ["z (may hold)"],
      keywords: trn("zoom-in-key"),
      parent: "quick-options",
      perform: () => {ZoomBoard(false);; setTimeout(() => focusChart(), 100);},
      icon: <ZoomIn className="size-5 shrink-0 opacity-70" />
    },

    {
      id: "zoom-out",
      name: trn("zoom-out"),
      shortcut: ["shift+z (may hold)"],
      keywords: trn("zoom-out-key"),
      parent: "quick-options",
      perform: () => {ZoomBoard(true);; setTimeout(() => focusChart(), 100);},
      icon: <ZoomOut className="size-5 shrink-0 opacity-70" />,
    },

    {
      id: "reset-view",
      name: trn("reset-view"),
      shortcut: ["r"],
      keywords: trn("reset-view-key"),
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
    name: trn("landmarks"),
    keywords: trn("landmarks-key"),
    icon: <MapPin className="size-5 shrink-0 opacity-70" />,
  },


  // Individual landmark actions (jump/navigate)
  ...landmarks.map((landmark, index) => ({
    id: `jump-to-landmark-${index}`,
    name: `${landmark.label || `${trn("landmark")} ${index + 1}`} (${landmark.x.toFixed(2)}, ${landmark.y.toFixed(2)})`,
    shortcut: landmark.shortcut ? [`ctrl+${landmark.shortcut}`] : undefined,
    keywords: `${trn("landmark-key")}, ${landmark.label || ''}, ${landmark.shortcut ? `l${landmark.shortcut}` : ''}`,
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
    name: trn("edit-landmarks"),
    keywords: trn("edit-landmarks-key"),
    parent: "landmarks",
    icon: <Edit className="size-5 shrink-0 opacity-70" />,
  }] : []),

  // Edit landmark actions
  ...landmarks.map((landmark, index) => ({
    id: `edit-landmark-${index}`,
    name: `${trn("edit")} ${landmark.label || `${trn("landmark")} ${index + 1}`}`,
    keywords: `${trn("edit-landmark-key")}, ${landmark.label || ''}, ${landmark.shortcut ? `e${landmark.shortcut}` : ''}`,
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
    name: trn("add-landmark"),
    shortcut: ["ctrl+b"],
    keywords: trn("add-landmark-key"),
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
    name: trn("function-options"),
    keywords: trn("function-options-key"),
    icon: <SquareActivity className="size-5 shrink-0 opacity-70" />,
  },

  // Individual function selection actions
  ...(functionDefinitions || []).map((func, index) => {
    const functionName = getFunctionNameN(functionDefinitions, index) || `Function ${index + 1}`;

    return {
      id: `show-function-${func.id}`,
      name: `${trn("show")} ${functionName}`,
      shortcut: index < 9 ? [(index + 1).toString()] : undefined,
      keywords: `${trn("show-function-key")}, ${functionName}, f${index + 1}, Choose ${functionName}, Choose ${index + 1}`,
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
      name: isReadOnly ? trn("view-functions") : trn("edit-functions"),
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
    name: trn("diagram-options"),
    keywords: trn("diagram-options-key"),
    icon: <FileChartLine className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "set-view",
    name: trn("set-view"),
    keywords: trn("set-view-key"),
    parent: "diagram-options",
    perform: () => openDialog("change-graph-bound"),
    icon: <ChartArea className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "movement-adjustments",
    name: trn("movement-adjustments"),
    shortcut: ["m"],
    keywords: trn("movement-adjustments-key"),
    parent: "diagram-options",
    perform: () => openDialog("movement-adjustments"),
    icon: <CircleGauge className="size-5 shrink-0 opacity-70" />,
    },


    {
      id: "navigation-help",
      name: trn("navigation-help"),
      keywords: trn("navigation-help-key"),
      // parent: "help-section",
      perform: () => openDialog("navigation-help"),
      icon: <Move className="size-5 shrink-0 opacity-70" />,
      priority: Priority.NORMAL,
    },

  // Import/Export - only show if not in read-only or full-restriction mode
  ...(!isReadOnly && !isFullyRestricted ? [
    {
      id: "import-export",
      name: trn("import-export"),
      keywords: trn("import-export-key"),
      icon: <Import className="size-5 shrink-0 opacity-70" />,
      priority: Priority.LOW
    },
    {
      id: "share",
      name: trn("share"),
      keywords: trn("share-key"),
      parent: "import-export",
      perform: () => openDialog("share"),
      icon: <Share2 className="size-5 shrink-0 opacity-70" />,
    },
    {
      id: "import-json",
      name: trn("import-json"),
      keywords: trn("import-json-key"),
      parent: "import-export",
      perform: () => openDialog("import-json"),
      icon: <FileUp className="size-5 shrink-0 opacity-70" />,
    },
    {
      id: "export-json",
      name: trn("export-json"),
      keywords: trn("export-json-key"),
      parent: "import-export",
      perform: () => openDialog("export-json"),
      icon: <FileDown className="size-5 shrink-0 opacity-70" />,
    }
  ] : []),

  // Only Import if in read-only or fully restricted mode
  ...(isReadOnly || isFullyRestricted ? [
    {
      id: "import-json",
      name: trn("import-json"),
      keywords: trn("import-json-key"),
      perform: () => openDialog("import-json"),
      icon: <FileUp className="size-5 shrink-0 opacity-70" />,
      priority: Priority.LOW
    }
  ] : []),

  // Change theme
  {
    id: "change-theme",
    name: trn("change-theme"),
    keywords: trn("change-theme-key"),
    icon: <SwatchBook className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "system-theme",
    name: trn("system-theme"),
    keywords: trn("system-theme-key"),
    parent: "change-theme",
    perform: () => {setTheme("system"); announce("Theme set to system preference");},
    icon: <SunMoon className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "light-theme",
    name: trn("light-theme"),
    keywords: trn("light-theme-key"),
    parent: "change-theme",
    perform: () => {setTheme("light"); announce("Theme set to light mode");},
    icon: <Sun className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "dark-theme",
    name: trn("dark-theme"),
    keywords: trn("dark-theme-key"),
    parent: "change-theme",
    perform: () => {setTheme("dark"); announce("Theme set to dark mode");},
    icon: <Moon className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "high-contrast-theme",
    name: trn("high-contrast-theme"),
    keywords: trn("high-contrast-theme-key"),
    parent: "change-theme",
    perform: () => {setTheme("high-contrast"); announce("Theme set to high contrast mode");},
    icon: <Contrast className="size-5 shrink-0 opacity-70" />,
  },

  {
    id: "deuteranopia-protanopia-friendly-theme",
    name: trn("deuteranopia-protanopia-friendly-theme"),
    keywords: trn("deuteranopia-protanopia-friendly-theme-key"),
    parent: "change-theme",
    perform: () => {setTheme("deuteranopia-protanopia-friendly"); announce("Theme set to deuteranopia/protanopia friendly mode");},
    icon: <Eye className="size-5 shrink-0 opacity-70" />,
  },

  // Help section
  {
    id: "help-section",
    name: trn("help-section"),
    keywords: trn("help-section-key"),
    icon: <HelpCircle className="size-5 shrink-0 opacity-70" />,
    priority: Priority.LOW,
  },

  {
    id: "help",
    name: trn("help"),
    keywords: trn("help-key"),
    shortcut: ["F1"],
    parent: "help-section",
    perform: () => openDialog("welcome"),
    icon: <HelpCircle className="size-5 shrink-0 opacity-70" />,
    priority: Priority.NORMAL,
  },

  {
    id: "about",
    name: trn("about"),
    keywords: trn("about-key"),
    parent: "help-section",
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
