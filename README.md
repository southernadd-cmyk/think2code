# Think2Code

**Think2Code** is a browser-based web app that lets learners build **real, executable flowcharts** and automatically generate **real Python code** from them.

Unlike many visual tools, Think2Code does not simulate execution.  
The Python code it generates is **actually executed** (via Skulpt), and each running step is visually highlighted back on the flowchart.

The goal is to bridge:
- flowcharts
- pseudocode
- real Python

in a way that is faithful, inspectable, and suitable for teaching.

---

## What Think2Code Is

Think2Code is:

- a **flowchart editor**
- a **Python code generator**
- a **step-by-step visual executor**
- a **teaching tool for algorithms and control flow**

It is designed primarily for:
- KS3 / KS4 Computing
- BTEC / T-Level IT
- FE / introductory HE programming

---

## Core Features

### Flowchart Editor
Students build programs using standard flowchart blocks:

- Start / End
- Process
- Input / Output
- Decision (Yes / No)
- Variable and List blocks

Features include:
- drag-and-drop placement
- auto-routed connections
- editable node text
- zoom and pan
- visual node highlighting during execution

---

### Real Python Generation

Every flowchart is compiled into **actual Python**, not pseudocode.

The compiler supports:
- linear sequence
- selection (`if / else`)
- `while` loops
- **auto-detected `for` loops**
- implicit / infinite loops
- nested control structures
- `break` statements where semantically valid

The generated Python can be:
- previewed
- exported
- executed step-by-step with visual feedback

---

### Visual Execution

When a program runs:

- Python is executed in-browser using Skulpt
- the currently executing node is highlighted
- output appears in a console panel
- `input()` nodes trigger a modal input dialog
- execution speed can be adjusted

This makes control flow *visible*, not abstract.

---

### Challenges Mode

Think2Code includes a built-in challenges system with scaffolded tasks and **automatic submission checking**.

Each challenge provides:
- a title and difficulty level
- a problem description
- supporting pseudocode
- success criteria
- skill focus

Students work directly in the flowchart editor to solve the challenge.

---

### Submit and Test

Challenges include a **Submit and Test** feature that allows students to check their solution.

When submitted:
- the student’s flowchart is compiled into Python
- the generated program is executed against predefined tests
- the submission is marked as **correct** or **incorrect**
- feedback is returned immediately in the interface

This allows students to:
- verify correctness independently
- iterate on solutions
- develop debugging and problem-solving skills

Teachers can use this feature to:
- support self-paced learning
- reduce reliance on manual checking
- focus attention on students who need support

The testing process evaluates **program behaviour**, not diagram shape, allowing multiple valid solutions.

---

## Export Options

Students can export:

- Python source code
- Flowchart JSON files
- PNG images of their diagrams

This supports:
- submission via VLE
- sharing work
- continuing work across sessions
- assessment of both diagram and code

---

## Technology

Think2Code is entirely client-side:

- Vanilla JavaScript
- HTML5 / CSS3 / SVG
- Bootstrap 5
- Skulpt (Python execution)
- html2canvas (PNG export)

No server, no database, no login required.  
It works offline once loaded.

---

## Educational Design

Think2Code was built specifically for teaching:

- Flowcharts map directly to Python
- Generated code is readable and inspectable
- Execution highlights support weaker readers and SEN learners
- Pseudocode links align with UK specifications
- Teachers can demonstrate algorithms live

---

## Installation

There is no build step.

To run locally:
1. Download the repository
2. Open `index.html` in a modern browser

To deploy:
- GitHub Pages
- school web hosting
- VLE static hosting
- local network share

---

## Status

Think2Code is actively developed and used in teaching contexts.

Feedback, bug reports, and classroom testing insights are very welcome.

---

## License

MIT License — free to use, modify, and share.
