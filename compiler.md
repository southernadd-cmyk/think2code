# Think2Code Compiler

This document describes how the Think2Code compiler works, what it guarantees, and what it deliberately refuses to do.

It reflects the compiler as implemented in the Think2Code web application, not an idealised or aspirational design.

---

## Overview

Think2Code compiles flowchart diagrams into real, executable Python code. The compiler is designed for educational use and prioritises:

- semantic correctness
- readable generated code
- conservative control-flow reconstruction
- explainable behaviour

The compiler runs entirely in the browser and is used for:

- live Python preview
- visual step-by-step execution
- automated challenge submission testing

---

## High-Level Architecture

The compiler uses a multi-phase pipeline:

1. Control-flow analysis
2. Structured reconstruction (IR building)
3. Python code generation
4. Optional validation and fallback

If structured compilation fails, the compiler falls back to a more general backend that preserves correctness but may produce less structured code.

---

## Source Language (Flowcharts)

The compiler operates on flowcharts produced by the Think2Code editor.

### Node Types

The following node types are supported:

- start
- end
- process
- var
- list
- input
- output
- decision

Each node contains a textual payload (usually stored in `text`) representing the semantic content of the step (for example, an assignment or expression).

### Connections

Control flow is expressed using directed connections:

- next for linear flow
- yes and no for decision branches

The editor enforces:
- exactly one Start node
- exactly one End node

All other structural properties are handled by the compiler.

---

## Compilation Entry Point

Compilation is initiated via the function:

compileWithPipeline(nodes, connections, useHighlighting, debugMode)

Two forms of output are typically generated:

- plain Python code for preview and export
- instrumented Python code with node-highlighting calls for execution

---

## Phase 1: Control-Flow Analysis

The compiler first constructs a control-flow graph (CFG) from the flowchart.

This phase computes:

- outgoing and incoming edge maps
- reachability information
- dominator sets
- immediate dominators
- back edges
- natural loops
- loop headers

The analysis is graph-based and does not assume structured input.

---

## Phase 2: Structured Reconstruction

Using the results of control-flow analysis, the compiler attempts to reconstruct structured control flow.

This phase determines whether regions of the graph can be safely represented as:

- if / else
- while
- for
- break

### Conservative Rule

The compiler will not duplicate code or restructure the graph in order to force structured output.

If semantic equivalence cannot be guaranteed, the structured construct is rejected and a more general representation is used instead.

---

## Phase 3: Python Code Generation

An intermediate representation (IR) is linearised into Python source code.

Features of code generation include:

- correct indentation
- optional execution highlighting
- loop context tracking
- safe break emission
- prevention of infinite recursion
- readable output suitable for learners

The generated Python code is executed directly using Skulpt.

---

## Structured Construct Guarantees

### Linear Statements

Assignments, input, output, and general processing steps are always emitted when reachable.

---

### If / Else

An if / else structure is emitted only when:

- both yes and no branches exist
- branches reconverge at a single node
- the reconvergence node post-dominates the decision
- no branch escapes the enclosing context unexpectedly

If these conditions are not met, control flow is linearised instead.

---

### While Loops

A while loop is emitted when:

- a decision node dominates a cycle
- exactly one branch leads back to the decision
- a clear loop exit exists

Both standard and inverted while patterns are supported.

---

### For Loops (Counted Loops)

For loops are intentionally conservative.

A for loop is emitted only when all of the following hold:

- a single induction variable exists
- the variable is initialised exactly once
- the loop condition references that variable
- the variable is incremented exactly once per iteration
- the increment dominates the loop back-edge
- no execution paths skip the increment
- no early exits occur inside the loop body

If any condition fails, the loop is compiled as a while loop instead.

---

### Implicit / Infinite Loops

Cycles without a usable loop condition are compiled as:

while True:
    ...

Loop exits are handled separately.

---

### Break Statements

A break statement is emitted only when:

- the node lies inside a loop
- all paths from that node exit the loop
- no path returns to the loop header

If these conditions are not met, break is not emitted.

---

## Fallback Compiler

If structured compilation throws an error, the compiler falls back to a program-counter-based backend.

This backend:

- preserves execution correctness
- supports all diagrams
- does not attempt structured reconstruction

---

## Design Philosophy

The compiler prioritises:

1. Correctness over prettiness
2. Semantic equivalence over pattern matching
3. Conservative rejection over incorrect lowering

Behaviour-based checking is preferred over structural enforcement in challenges, allowing multiple valid solutions.

---

## Summary

The Think2Code compiler is a real CFG-based compiler designed for education.

It reconstructs structured Python where possible, falls back safely when necessary, and always prioritises correctness and clarity.
