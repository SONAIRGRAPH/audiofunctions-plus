---
title: "Earcons"
toc: false
---



Audiofunctions uses several earcons (audio icons) to provide auditory feedback to the user. Below are the earcons used in the application:

## Navigation and Movement Sounds

**Chart Border Start**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/chart_border_start.mp3" type="audio/wav"/>
</audio>
Plays specifically when batch sonification begins and the cursor moves away from the left boundary of the chart. This indicates the start of a batch playback session.

**Chart Border**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/chart_border.mp3" type="audio/wav"/>
</audio>
Plays when the cursor reaches the edge of the visible chart area during navigation. This helps users understand when they've reached the boundaries of the current view.

## Function Analysis Sounds

**Y-Axis Intersection**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/y-axis-intersection.wav" type="audio/wav"/>
</audio>
Plays when a function crosses the y-axis (where x = 0). This helps users orient themselves within the graph by identifying when functions intersect the vertical axis.

**Negative Values**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/af_noise.mp3" type="audio/wav"/>
</audio>
Plays in background when the function value is negative (y < 0). This audio cue helps users identify when they are in the negative region of the graph below the x-axis.

**No Y Value**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/no_y.mp3" type="audio/wav"/>
</audio>
Plays when no functions are visible at the current cursor position, when functions go out of bounds, or when encountering discontinuities in functions (such as division by zero or undefined values).

## Landmark Sounds

**Triangle Landmark**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/landmark_triangle.mp3" type="audio/wav"/>
</audio>
Plays when the cursor encounters a triangle-shaped landmark that has been placed on the graph.

**Square Landmark**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/landmark_square.mp3" type="audio/wav"/>
</audio>
Plays when the cursor encounters a square-shaped landmark that has been placed on the graph.

**Diamond Landmark**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/landmark_diamond.mp3" type="audio/wav"/>
</audio>
Plays when the cursor encounters a diamond-shaped landmark that has been placed on the graph.

## Interaction Feedback Sounds

**Notification**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/notification.mp3" type="audio/wav"/>
</audio>
Plays when the cursor passes over points of interest while navigating in discrete mode with arrow keys. This alerts users to important locations on functions that would otherwise be missed due to the step size in discrete navigation.

**Deny**
<audio controls style="display: block; margin: auto;"> 
  <source src="earcons/deny.wav" type="audio/wav"/>
</audio>
Plays when the user attempts to zoom or pan beyond the allowable limits of the chart view. This indicates that further navigation in that direction is not possible.

---

These earcons work together with the continuous tone sonification to provide a comprehensive audio experience that helps users navigate and understand mathematical functions through sound.
