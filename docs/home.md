---
title: "Welcome to Audiofunctions++"
lang: en
toc: false
---

Audiofunctions+ is a web application designed to facilitate visually impaired users' learning of mathematical functions. By converting function graphs into audio, Audiofunctions+ allows users to interpret the shape of a function's graph by listening to its sonification and explore mathematical relationships through hearing.

## What You Can Do

- **Explore functions with sound**: Move through graphs and hear how functions change
- **Navigate easily**: Use simple keyboard shortcuts to control everything
- **Work with multiple functions**: Define and compare different mathematical expressions
- **Set landmarks**: Mark important points for quick navigation


## How Function Sonification Works

Audiofunctions+ converts mathematical functions into sound using **pitch** and **stereo positioning**. As you move along a function, the **pitch (frequency)** represents the Y-value - higher function values produce higher tones, lower values produce lower tones. **Stereo panning** indicates your X-position - sounds move from left speaker (negative X) to right speaker (positive X).

The application supports two sonification modes:
- **Continuous sonification**: Smooth, flowing tones that change pitch gradually as you navigate
- **Discrete sonification**: Individual musical notes from a predefined scale that are triggered when the function value changes significantly

Here's how a sine function sounds with both sonification modes:

**Continuous sonification**: 

<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/af_continuous.mp3" type="audio/mp3"/>
</audio>

**Discrete sonification**: 

<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/af_discrete.mp3" type="audio/mp3"/>
</audio>

Notice how the discrete version plays notes at different speeds - faster during steep sections of the curve and slower where the function is nearly flat, while the continuous version maintains steady movement throughout. Additionally, background noise indicates when the y-value is negative (< 0).

You can interactively explore the functions from these examples at the following link: [Sinus example](https://audiofunctions-plus.netlify.app/#import=eyJmdW5jdGlvbnMiOlt7ImlkIjoiZjEiLCJmdW5jdGlvbk5hbWUiOiJGdW5jdGlvbiAxIiwidHlwZSI6ImZ1bmN0aW9uIiwiZnVuY3Rpb25EZWYiOiJzaW4oeCkiLCJpc0FjdGl2ZSI6dHJ1ZSwiaW5zdHJ1bWVudCI6ImNsYXJpbmV0IiwicG9pbnRPZkludGVyZXN0cyI6W10sImxhbmRtYXJrcyI6W119XSwiZ3JhcGhTZXR0aW5ncyI6eyJkZWZhdWx0VmlldyI6Wy0xMCwxMCwzLC0zXSwibWluQm91bmREaWZmZXJlbmNlIjowLjEsIm1heEJvdW5kRGlmZmVyZW5jZSI6MTAwLCJzaG93R3JpZCI6dHJ1ZSwic2hvd0F4ZXMiOnRydWUsImdyaWRDb2xvciI6IiNDQ0NDQ0MiLCJyZXN0cmljdGlvbk1vZGUiOiJub25lIn19)



## Getting Started

To start exploring, all functions except the basic navigation are accessible through the command palette. Here are the essential controls to get you started:

### Basic Controls

1. **Open command palette**: `Ctrl+K` (`Cmd+K` on Mac)
2. **Basic navigation**:
   - Move cursor: Arrow keys or `J`/`L`
   - Move view: `W`, `A`, `S`, `D`
   - Show coordinates: `C`
3. **Manage functions**:
   - New function: Press `F` and use function editor
   - Switch between functions: `N` or number keys `1`-`9`
4. **Audio controls**:
   - Sonification on/off: `P`
   - Play entire function: `B`
   - Switch sonification type: `I`


### Advanced Navigation

Take full control of your navigation with these advanced movement options:

- **Fluid movement**: `Shift+Arrow keys` for smooth movement
- **Zoom/Scale controls**: `Z` and `Shift+Z` to enlarge/shrink the view around its center
- **Axis-specific zooming/scaling**: `X+Z` and `Shift+X+Z` for X-axis, `Y+Z` and `Shift+Y+Z` for Y-axis
- **Center cursor**: `Ctrl+Z` to reorientate the view, that the cursor is in the center
- **Show current view bounds**: `V` to display the current viewing area coordinates

- **Mouse movement with volume feedback**: Move your mouse across the graph to hear function values through volume changes - louder sounds indicate higher values, quieter sounds indicate lower values


### Landmarks System

Create interactive markers at important points on your functions - landmarks help you quickly navigate to specific coordinates and understand key features of mathematical graphs:

- **Create/edit landmark**: `Ctrl+B` (`Cmd+B` on Mac) at desired position
- **Jump between landmarks**: `Ctrl+Arrow keys` or `J` and `L` (`Cmd+Arrow keys` on Mac)
- **Jump to specific landmark**: `Ctrl+Number key` (`Cmd+Number key` on Mac)



## Learn More

Explore these detailed guides to master all features of Audiofunctions+.

### [Keyboard Shortcuts](shortcuts.md)
Complete list of all keyboard controls for navigating and using Audiofunctions+.

### [Audio Signals](earcons.md)
Learn about the different sounds that guide you through the application.

### [Sharing](sharing.md)
Share your set of functions with others and control how they can interact with them.

### [Export/Import Functions](json.md)
How to export and import your function definitions and settings.



## Need Help?

**First time using Audiofunctions+?** Start by pressing `Ctrl+K` (or `Cmd+K` on Mac) to open the command menu - it will guide you through available actions. You can also press `F1` at any time to open the help menu.


**Having issues or suggestions?** We'd love to hear from you! You can reach out to the development team or share your feedback to help us improve the application for everyone.

<div style="display: flex; gap: 1rem; margin: 1rem 0;">
  <a href="https://github.com/SONAIRGRAPH/audiofunctions-plus/issues" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background-color: #24292e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
    Report issues or request features
  </a>
  <a href="mailto:feedbackaudiofunctionsplus@unito.it" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background-color: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
    </svg>
    Send feedback via email
  </a>
</div>





<br />
<br />


---

*This project is supported by the SONification for Accessible and Inclusive Representation of GRAPHs in Education ([SONAIRGRAPH](https://sonairgraph.unito.it/)) project, which is an Erasmus+ key action 2 (project number 2024-1-IT02-KA220-HED-000244481), funded by the European Union. Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or the European Education and Culture Executive Agency (EACEA). Neither the European Union nor EACEA can be held responsible for them.*
