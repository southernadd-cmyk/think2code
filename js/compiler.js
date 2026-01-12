
window.FlowCode = window.FlowCode || {};

/**
 * Enhanced Loop Classifier - Phase 1.5: Advanced loop pattern detection
 */
class LoopClassifier {
    constructor(nodes, connections, outgoingMap, incomingMap, dominators = null) {
        this.nodes = nodes;
        this.connections = connections;
        this.outgoingMap = outgoingMap;
        this.incomingMap = incomingMap;
        this.dominators = dominators;
        
        // Loop patterns cache
        this.loopPatterns = new Map();
    }
    
    classifyAllLoops() {
        this.loopPatterns.clear();
        
        console.log("=== LOOP CLASSIFICATION DEBUG ===");
        console.log("Total nodes:", this.nodes.length);
        console.log("Connections:", this.connections.length);
        
        // Use cycle detection only (like old compiler)
        // Disable dominator analysis for now - it was causing issues with complex flowcharts
        const cycleHeaders = this.findCycleHeaders();
        console.log("Cycle headers found:", Array.from(cycleHeaders));

        const allHeaders = cycleHeaders;

        // Allow all headers for classification (like old compiler)
        // Decision nodes can be while/for loops, non-decision nodes can be while-true loops
        const allHeadersFinal = allHeaders;
        console.log("All headers (decision + implicit):", Array.from(allHeadersFinal));

        // Store empty join point map for now
        this.joinPointMap = new Map();

        // Classify each header
        for (const headerId of allHeadersFinal) {
            const headerNode = this.nodes.find(n => n.id === headerId);
            if (!headerNode) continue;
            
            console.log(`\nClassifying header: ${headerId} (${headerNode.type})`);
            
            let loopType = null;

            // Try for-loop first (only for decision nodes)
            if (headerNode.type === 'decision') {
                console.log("Trying for-loop classification...");
                loopType = this.classifyForLoop(headerId);
                if (!loopType) {
                    console.log(`For-loop classification failed for ${headerId}`);
                    const condition = headerNode.text || '';
                    const varMatch = condition.match(/^\s*(\w+)\s*([<>=!]+)\s*(\S+)/);
                    if (varMatch) {
                        const varName = varMatch[1];
                        const initNode = this.findInitialization(headerId, varName);
                        const updateNode = this.findUpdateInLoop(headerId, varName);
                        console.log(`  Variable: ${varName}, Init: ${initNode ? initNode.id : 'null'}, Update: ${updateNode ? updateNode.id : 'null'}`);
                        if (initNode && updateNode) {
                            const isValid = this.validateForLoopPattern(headerId, initNode.id, updateNode.id);
                            console.log(`  Validation: ${isValid}`);
                        }
                    }
                }
                console.log("For-loop result:", loopType ? loopType.type : "null");
            }

            // Try while-loop (only for decision nodes)
            if (!loopType && headerNode.type === 'decision') {
                console.log("Trying while-loop classification...");
                loopType = this.classifyWhileLoop(headerId);
                console.log("While-loop result:", loopType ? loopType.type : "null");
            }

            // Try while-true for all node types
            if (!loopType) {
                console.log("Trying while-true classification...");
                loopType = this.classifyWhileTrueLoop(headerId);
                console.log("While-true result:", loopType ? loopType.type : "null");
            }
            
            if (loopType) {
                this.loopPatterns.set(headerId, loopType);


                if (loopType.type === 'for') {
                    console.log(`✓ Classified as ${loopType.type}: ${loopType.variable} from ${loopType.startValue} to ${loopType.endValue}`);
                    console.log(`  bodyNodes: ${JSON.stringify(loopType.bodyNodes)}, updateNodeId: ${loopType.updateNodeId}`);
                } else {
                console.log(`✓ Classified as ${loopType.type}: ${loopType.condition}`);
                }
            } else {
                console.log(`✗ Could not classify ${headerId}`);
            }
        }
        
        console.log("=== END DEBUG ===");
        console.log("Final loop patterns:", Array.from(this.loopPatterns.entries()));
        
        return this.loopPatterns;
    }

    /**
     * Find decision nodes that are loop headers
     */
    findDecisionCycleHeaders() {
        const headers = new Set();
        const visited = new Set();
        const recursionStack = new Set();
        
        // Find all start nodes
        const startNodes = this.nodes.filter(n => n.type === 'start');
        for (const startNode of startNodes) {
            this.detectDecisionCyclesDFS(startNode.id, visited, recursionStack, headers);
        }
        
        return headers;
    }

    detectDecisionCyclesDFS(nodeId, visited, recursionStack, decisionHeaders) {
        if (recursionStack.has(nodeId)) {
            // Found a cycle
            // Check if nodeId is a decision node
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'decision') {
                decisionHeaders.add(nodeId);
            }
            return;
        }
        
        if (visited.has(nodeId)) return;
        
        visited.add(nodeId);
        recursionStack.add(nodeId);
        
        const outgoing = this.outgoingMap.get(nodeId) || [];
        for (const edge of outgoing) {
            this.detectDecisionCyclesDFS(edge.to, visited, recursionStack, decisionHeaders);
        }
        
        recursionStack.delete(nodeId);
    }
    
    findCycleHeaders() {
        const headers = new Set();
        const visited = new Set();
        const recursionStack = new Set();
        
        // Find all start nodes
        const startNodes = this.nodes.filter(n => n.type === 'start');
        for (const startNode of startNodes) {
            this.detectCyclesDFS(startNode.id, visited, recursionStack, headers);
        }
        
        return headers;
    }

    detectCyclesDFS(nodeId, visited, recursionStack, cycleHeaders) {
        if (visited.has(nodeId)) return;
        
        visited.add(nodeId);
        recursionStack.add(nodeId);
        
        const outgoing = this.outgoingMap.get(nodeId) || [];
        for (const edge of outgoing) {
            if (recursionStack.has(edge.to)) {
                // Found a back edge from nodeId to edge.to (which is in recursion stack)
                // The CURRENT node (nodeId) is the one making the back edge
                // If nodeId is a decision or process node, IT is the loop header
                const currentNode = this.nodes.find(n => n.id === nodeId);
                if (currentNode && (currentNode.type === 'decision' || currentNode.type === 'process')) {
                    cycleHeaders.add(nodeId);
                    console.log(`Cycle: ${currentNode.type} ${nodeId} has back edge to ${edge.to}`);
                }

                // Also add any process nodes in the recursion stack as potential implicit loop headers
                for (const stackNodeId of recursionStack) {
                    const stackNode = this.nodes.find(n => n.id === stackNodeId);
                    if (stackNode && stackNode.type === 'process') {
                        cycleHeaders.add(stackNodeId);
                        console.log(`Cycle: implicit process header ${stackNodeId} in cycle`);
                    }
                }

                // Otherwise, find the decision or process node on the path to the back edge target
                    const targetNode = this.nodes.find(n => n.id === edge.to);
                if (targetNode && (targetNode.type === 'decision' || targetNode.type === 'process')) {
                        cycleHeaders.add(edge.to);
                    console.log(`Cycle: back edge to ${targetNode.type} ${edge.to}`);
                    } else {
                    // Walk back through recursion stack to find the controlling decision/process
                        // Add the target anyway - will be filtered later
                        cycleHeaders.add(edge.to);
                    console.log(`Cycle: back edge to ${targetNode?.type || 'unknown'} ${edge.to} (will filter)`);
                }
            } else {
            this.detectCyclesDFS(edge.to, visited, recursionStack, cycleHeaders);
            }
        }
        
        recursionStack.delete(nodeId);
    }
    
    /**
     * Classify as For Loop Pattern
     * Pattern: [init] -> decision -> body -> update -> back to decision
     */
    classifyForLoop(headerId) {
        const headerNode = this.nodes.find(n => n.id === headerId);
        if (!headerNode || headerNode.type !== 'decision') {
            return null;
        }
        
        // Extract variable from condition
        const condition = headerNode.text || '';
        // Match patterns like: x < 10, i <= 5, count > 0
        const varMatch = condition.match(/^\s*(\w+)\s*([<>=!]+)\s*(\S+)/);
        if (!varMatch) {
            return null;
        }
        
        const varName = varMatch[1];
        const operator = varMatch[2];
        const endValue = varMatch[3];
        
        // Find initialization before the loop
        const initNode = this.findInitialization(headerId, varName);
        if (!initNode) {
            return null;
        }
        
        // Extract start value from initialization
        const startValue = this.extractStartValue(initNode.text || '', varName);
        if (startValue === null) {
            return null;
        }
        
        // Find increment/decrement in loop body
        const updateNode = this.findUpdateInLoop(headerId, varName);
        if (!updateNode) {
            return null;
        }
        
        // Parse step and direction from update
        const stepInfo = this.parseUpdateStep(updateNode.text, varName);
        if (!stepInfo) {
            return null;
        }
        
        // Find loop body (nodes between header and update)
        const bodyNodes = this.findLoopBodyNodes(headerId, updateNode.id);
        
        // Find exit node
        const exitNodes = this.findLoopExitNodes(headerId);
        
        // Determine if it's a valid for-loop pattern
        const isValidForLoop = this.validateForLoopPattern(headerId, initNode.id, updateNode.id);
        if (!isValidForLoop) {
            return null;
        }

        // Check for early exits - for-loops shouldn't have branches that exit early
        // (except through the normal exit condition)
        if (this.hasEarlyLoopExits(headerId, bodyNodes)) {
            return null;
        }
        
        // IMPORTANT: Use the old compiler's sophisticated integer adjustment logic
        const adjustedEnd = this.adjustEndValueForRange(endValue, operator, stepInfo.step, stepInfo.direction);
        
        return {
            type: 'for',
            headerId: headerId,
            initNodeId: initNode.id,
            updateNodeId: updateNode.id,
            variable: varName,
            startValue: startValue,
            endValue: adjustedEnd.finalEnd,
            operator: operator,
            step: adjustedEnd.finalStep,
            direction: stepInfo.direction,
            bodyNodes: bodyNodes,
            exitNodes: exitNodes,
            metadata: {
                condition: condition,
                initialization: initNode.text,
                update: updateNode.text,
                originalEnd: endValue,
                comparisonOp: operator,
                isLiteralInteger: adjustedEnd.isLiteralInteger
            }
        };
    }
    
    /**
     * Find variable initialization before loop
     */
    findInitialization(headerId, varName) {
        // Look for nodes that come before the header and assign to varName
        const candidateNodes = this.nodes.filter(node => {
            if (node.type !== 'process' && node.type !== 'var' && node.type !== 'list') return false;
            const text = node.text || '';
            
            // Match patterns like: x = 0, i = 1, count = start
            const assignmentPattern = new RegExp(`^\\s*${varName}\\s*=\\s*(.+?)\\s*$`);
            return assignmentPattern.test(text);
        });
        
        // Find which initialization node reaches the header
        for (const node of candidateNodes) {
            // Allow initialization as long as it reaches the header.
            // Previously we rejected nodes that were reachable from the header
            // (i.e., inside another loop cycle), which blocked detection for
            // nested loops where the initializer is run each outer iteration.
            if (this.pathExists(node.id, headerId)) {
                return node;
            }
        }
        
        return null;
    }
    
    /**
     * Extract start value from initialization text
     */
    extractStartValue(text, varName) {
        const match = text.match(new RegExp(`^\\s*${varName}\\s*=\\s*(.+?)\\s*$`));
        return match ? match[1].trim() : null;
    }
    
    /**
     * Find update (increment/decrement) in loop
     */
    findUpdateInLoop(headerId, varName) {
        // Get the "true" branch (loop body entry)
        const loopEntry = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
        if (!loopEntry) return null;
        
        // BFS to find update node
        const queue = [loopEntry];
        const visited = new Set([headerId]);
        
        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            
            const node = this.nodes.find(n => n.id === nodeId);
            if (!node) continue;
            
            // Check for update patterns
            if (node.type === 'process' || node.type === 'var') {
                const text = node.text || '';
                
                // Check for common update patterns
                const patterns = [
                    // i = i + 1, i = i - 1
                    new RegExp(`^\\s*${varName}\\s*=\\s*${varName}\\s*([+-])\\s*(\\d+)\\s*$`),
                    // i += 1, i -= 1
                    new RegExp(`^\\s*${varName}\\s*([+-])=\\s*(\\d+)\\s*$`),
                    // i = i + step, i = i - step
                    new RegExp(`^\\s*${varName}\\s*=\\s*${varName}\\s*([+-])\\s*(\\w+)\\s*$`)
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                        // Check if this update leads back to header
                        const hasBackEdge = this.hasDirectBackEdgeTo(nodeId, headerId) || 
                                          this.hasAnyBackEdgeTo(nodeId, headerId, new Set());
                        
                        if (hasBackEdge) {
                            return node;
                        }
                    }
                }
            }
            
            // Add successors (but stop if we exit the loop)
            const successors = this.getAllSuccessors(nodeId);
            for (const succ of successors) {
                if (!visited.has(succ.nodeId)) {
                    queue.push(succ.nodeId);
                }
            }
        }
        
        return null;
    }
    
    /**
     * Check if node has a direct back edge to header
     */
    hasDirectBackEdgeTo(nodeId, headerId) {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        return outgoing.some(edge => edge.to === headerId);
    }
    
    /**
     * Check if node has any path back to header
     */
    hasAnyBackEdgeTo(nodeId, headerId, visited = new Set()) {
        if (nodeId === headerId) return true;
        if (visited.has(nodeId)) return false;
        
        visited.add(nodeId);
        
        const outgoing = this.outgoingMap.get(nodeId) || [];
        for (const edge of outgoing) {
            if (this.hasAnyBackEdgeTo(edge.to, headerId, new Set([...visited]))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Parse step value from update expression
     */
    parseUpdateStep(updateText, varName) {
        const patterns = [
            // i = i + 1
            new RegExp(`${varName}\\s*=\\s*${varName}\\s*([+-])\\s*(\\d+)`),
            // i += 1
            new RegExp(`${varName}\\s*([+-])=\\s*(\\d+)`),
            // i = i + step (variable)
            new RegExp(`${varName}\\s*=\\s*${varName}\\s*([+-])\\s*(\\w+)`)
        ];
        
        for (const pattern of patterns) {
            const match = updateText.match(pattern);
            if (match) {
                let step = 1;
                let direction = 'increment';
                
                if (match[2]) {
                    // Has a step value
                    const stepValue = match[2];
                    if (!isNaN(parseInt(stepValue))) {
                        step = parseInt(stepValue);
                    } else {
                        step = stepValue;
                    }
                }
                
                if (match[1] === '-') {
                    direction = 'decrement';
                    if (typeof step === 'number') {
                        step = -step;
                    }
                }
                
                return { step, direction };
            }
        }
        
        return null;
    }
    
    /**
     * IMPORTANT: Use the old compiler's sophisticated integer adjustment logic
     * This handles: i < 10, i <= 10, i > 0, i >= 1, etc.
     * For literals: adjusts by +1 or +2 to match flowchart logic
     * For variables: keeps bounds-safe to prevent IndexError
     */
    adjustEndValueForRange(endValue, operator, step, direction) {
        const stepNum = typeof step === 'number' ? step : 1;
        const isLiteralInteger = /^\d+$/.test(String(endValue).trim());
        
        let finalStep = stepNum;
        let finalEnd = endValue;
        
        // --- INCREASING LOOPS (UPWARD) ---
        if (direction === 'increment' || stepNum > 0) {
            // ensure positive step
            finalStep = Math.abs(stepNum);
            
            if (operator === '<') {
                // For literal integers: add +1 for exact flowchart logic
                // For variables: keep bounds-safe to prevent IndexError
                finalEnd = isLiteralInteger ? `${parseInt(endValue) + 1}` : endValue;
            } else if (operator === '<=') {
                // For literal integers: add +2 for exact flowchart logic
                // For variables: add +1 (bounds-safe)
                finalEnd = isLiteralInteger ? `${parseInt(endValue) + 2}` : `(${endValue}) + 1`;
            }
        } 
        // --- DECREASING LOOPS (DOWNWARD) ---
        else if (direction === 'decrement' || stepNum < 0) {
            // force negative step
            finalStep = -Math.abs(stepNum);
            
            if (operator === '>') {
                // For literal integers: subtract 1 for exact flowchart logic
                // For variables: keep bounds-safe to prevent IndexError
                finalEnd = isLiteralInteger ? `${parseInt(endValue) - 1}` : endValue;
            } else if (operator === '>=') {
                // For literal integers: subtract 2 for exact flowchart logic
                // For variables: subtract 1 (bounds-safe)
                finalEnd = isLiteralInteger ? `${parseInt(endValue) - 2}` : `(${endValue}) - 1`;
            }
        }
        
        return {
            finalEnd,
            finalStep,
            isLiteralInteger
        };
    }
    
    /**
     * Check if node is inside the loop
     */
    inLoop(nodeId, headerId) {
        // Simple check: if node can reach header and header can reach node
        return this.pathExists(nodeId, headerId) && this.pathExists(headerId, nodeId);
    }

    /**
     * Check if the loop body has early exits (paths to END that don't go through the loop header)
     * For-loops shouldn't have early exits - they should only exit through the header condition
     */
    hasEarlyLoopExits(headerId, bodyNodes) {
        for (const nodeId of bodyNodes) {
            // Check if this node can reach END without going through the loop header
            if (this.canReachEndWithoutHeader(nodeId, headerId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a node can reach END without passing through the loop header
     */
    canReachEndWithoutHeader(startId, headerId) {
        const visited = new Set();
        const stack = [startId];

        while (stack.length > 0) {
            const currentId = stack.pop();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // If we reach END, that's an early exit
            const node = this.nodes.find(n => n.id === currentId);
            if (node && node.type === 'end') {
                return true;
            }

            // Don't go through the loop header
            if (currentId === headerId) continue;

            // Add successors
            const successors = [];
            if (node) {
                if (node.type === 'decision') {
                    const outgoing = this.outgoingMap.get(currentId) || [];
                    for (const edge of outgoing) {
                        if (edge.port === 'yes' || edge.port === 'true' || edge.port === 'no' || edge.port === 'false') {
                            successors.push(edge.to);
                        }
                    }
                } else {
                    const outgoing = this.outgoingMap.get(currentId) || [];
                    const nextEdge = outgoing.find(e => e.port === 'next');
                    if (nextEdge) {
                        successors.push(nextEdge.to);
                    }
                }
            }

            for (const succId of successors) {
                if (succId && !visited.has(succId)) {
                    stack.push(succId);
                }
            }
        }

        return false;
    }

    /**
     * Find loop headers using dominator analysis (more accurate than cycle detection)
     */
    findDominatorBasedHeaders() {
        const headers = new Set();

        // Find back edges: edges from A->B where B dominates A
        for (const node of this.nodes) {
            const outgoing = this.outgoingMap.get(node.id) || [];

            for (const edge of outgoing) {
                const fromId = node.id;
                const toId = edge.to;

                // Check if 'toId' dominates 'fromId'
                const fromDoms = this.dominators.get(fromId);
                if (fromDoms && fromDoms.has(toId)) {
                    // Only decision nodes can be loop headers
                    const toNode = this.nodes.find(n => n.id === toId);
                    if (toNode && toNode.type === 'decision') {
                        headers.add(toId);
                        console.log(`Back edge found: ${fromId} → ${toId} (${edge.port}), Loop header: ${toId}`);
                    }
                }
            }
        }

        return headers;
    }
    
    /**
     * Validate for-loop pattern
     */
    validateForLoopPattern(headerId, initNodeId, updateNodeId) {
        // Check that initialization can reach the header
        // Note: For nested loops, the init may be inside an outer loop, which is valid
        if (!this.pathExists(initNodeId, headerId)) {
            return false;
        }
        
        // Check that update is reachable from the loop entry
        const loopEntry = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
        if (!loopEntry) {
            return false;
        }
        
        if (!this.pathExists(loopEntry, updateNodeId)) {
            return false;
        }
        
        // Check that update has a back edge to header
        return this.hasDirectBackEdgeTo(updateNodeId, headerId) || 
               this.hasAnyBackEdgeTo(updateNodeId, headerId, new Set());
    }
    
    /**
     * Classify as While Loop Pattern
     */
    classifyWhileLoop(headerId) {
        const headerNode = this.nodes.find(n => n.id === headerId);
        if (!headerNode || headerNode.type !== 'decision') return null;
        
        // Get both branches
        const yesId = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
        const noId = this.getSuccessor(headerId, 'no') || this.getSuccessor(headerId, 'false');
        
        // Check which branch forms the loop (can reach back to header)
        const yesLoops = yesId && this.pathExists(yesId, headerId);
        const noLoops = noId && this.pathExists(noId, headerId);
        
        // Determine loop entry and exit based on which branch loops
        let loopEntry = null;
        let exitNode = null;
        let useNoBranch = false;
        let condition = headerNode.text || '';
        
        if (yesLoops && !noLoops) {
            // YES branch is loop body (normal case)
            loopEntry = yesId;
            exitNode = noId;
            useNoBranch = false;
        } else if (noLoops && !yesLoops) {
            // NO branch is loop body - need to negate condition
            loopEntry = noId;
            exitNode = yesId;
            useNoBranch = true;
            // Negate the condition for while loop
            condition = `not (${condition})`;
        } else if (yesLoops && noLoops) {
            // Both branches loop back - unusual, prefer YES branch
            loopEntry = yesId;
            exitNode = noId;
            useNoBranch = false;
        } else {
            // Neither branch loops back - not a while loop
            return null;
        }
        
        if (!loopEntry) return null;
        
        // Collect ALL nodes in the loop body (including those that might branch)
        // IMPORTANT: Exclude END nodes and nodes that lead directly to END (break paths)
        const bodyNodes = new Set();
        const stack = [loopEntry];
        const visited = new Set([headerId]);
        
        while (stack.length > 0) {
            const nodeId = stack.pop();
            
            if (visited.has(nodeId) || nodeId === headerId) continue;
            visited.add(nodeId);
            
            // Skip END nodes - they're not part of the loop body
            const currentNode = this.nodes.find(n => n.id === nodeId);
            if (currentNode && currentNode.type === 'end') continue;
            
            // Add to body nodes
            bodyNodes.add(nodeId);
            
            // Get all successors
            const successors = this.outgoingMap.get(nodeId) || [];
            
            for (const edge of successors) {
                const nextId = edge.to;
                
                // Skip if it's the header (back edge)
                if (nextId === headerId) continue;
                
                // Skip if it leads to exit
                if (nextId === exitNode) continue;
                
                // Skip if already in body nodes
                if (bodyNodes.has(nextId)) continue;
                
                // Skip if it's an END node
                const nextNode = this.nodes.find(n => n.id === nextId);
                if (nextNode && nextNode.type === 'end') continue;
                
                stack.push(nextId);
            }
        }
        
        // Check if this header was promoted from a join point
        // Include the join point in body nodes but DON'T simplify - we need the full body
        // for if-statements with break paths to work correctly
        const joinPoint = this.joinPointMap ? this.joinPointMap.get(headerId) : null;
        if (joinPoint) {
            // Ensure the join point is in the body
            bodyNodes.add(joinPoint);
            // Use the join point as the loop entry
            loopEntry = joinPoint;
            console.log(`classifyWhileLoop(${headerId}): promoted from join point ${joinPoint}, bodyNodes=${JSON.stringify(Array.from(bodyNodes))}`);
        }

        // Check if body has decisions that exit to DIFFERENT paths than the normal exit
        // If so, this should be a while-true loop instead (multiple distinct exit paths)
        if (this.hasDistinctExitPaths(headerId, bodyNodes, exitNode)) {
            console.log(`classifyWhileLoop(${headerId}): has distinct exit paths, rejecting for while-true`);
            return null;
        }
        
        console.log(`classifyWhileLoop(${headerId}): loopEntry=${loopEntry}, exitNode=${exitNode}, useNoBranch=${useNoBranch}, bodyNodes=${JSON.stringify(Array.from(bodyNodes))}`);
        return {
            type: 'while',
            headerId: headerId,
            condition: condition,
            loopEntry: loopEntry,
            bodyNodes: Array.from(bodyNodes),
            exitNodes: exitNode ? [exitNode] : [],
            useNoBranch: useNoBranch,
            metadata: {
                hasComplexBody: this.hasComplexBody(Array.from(bodyNodes)),
                originalCondition: headerNode.text || ''
            }
        };
    }
    
    /**
     * Classify as While True Loop Pattern
     */
    classifyWhileTrueLoop(headerId) {
        const headerNode = this.nodes.find(n => n.id === headerId);
        
        // Case 1: Implicit loop (no decision node as header)
        if (headerNode.type !== 'decision') {
            const nextNode = this.getSuccessor(headerId, 'next');
            if (!nextNode) return null;
            
            const bodyNodes = this.collectLoopBodyNodes(headerId, nextNode);

            // Check if this process node has multiple distinct exit paths
            const exitNodes = this.findProcessExitNodes(headerId, bodyNodes);
            const hasMultiExits = exitNodes.length > 1 || this.hasDistinctExitPathsFromProcess(headerId, bodyNodes);

            return {
                type: 'while_true',
                headerId: headerId,
                condition: 'True',
                bodyNodes: bodyNodes,
                exitNodes: exitNodes,
                metadata: {
                    isImplicit: true,
                    isMultiExit: hasMultiExits
                }
            };
        }
        
        // Case 2: Decision with always-true condition
        const condition = headerNode.text || '';
        if (this.isAlwaysTrueCondition(condition)) {
            const loopEntry = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
            const exitNode = this.getSuccessor(headerId, 'no') || this.getSuccessor(headerId, 'false');
            
            if (!loopEntry) return null;
            
            const bodyNodes = this.collectLoopBodyNodes(headerId, loopEntry);
            
            return {
                type: 'while_true',
                headerId: headerId,
                condition: 'True',
                bodyNodes: bodyNodes,
                exitNodes: exitNode ? [exitNode] : [],
                metadata: { 
                    isImplicit: false,
                    originalCondition: condition 
                }
            };
        }
        
        return null;
    }

    /**
     * Check if the loop body has decisions that exit to different paths than the normal exit
     */
    hasDistinctExitPaths(headerId, bodyNodes, normalExitNode) {
        for (const nodeId of bodyNodes) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'decision') {
                const yesBranch = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
                const noBranch = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');

                for (const branch of [yesBranch, noBranch]) {
                    if (branch && branch !== headerId) {
                        // Check if this branch leads to End without going through the header
                        // This is a distinct exit if it's different from the normal exit
                        if (branch !== normalExitNode && this.canReachEndWithoutHeader(branch, headerId)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check if a node can reach End without going through the loop header
     */
    canReachEndWithoutHeader(startId, headerId) {
        const visited = new Set();
        const stack = [startId];

        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (visited.has(nodeId)) continue;
            if (nodeId === headerId) continue;  // Don't go through header
            visited.add(nodeId);

            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'end') return true;

            const outgoing = this.outgoingMap.get(nodeId) || [];
            for (const edge of outgoing) {
                stack.push(edge.to);
            }
        }
        return false;
    }

    /**
     * Find exit nodes for a process node header
     */
    findProcessExitNodes(headerId, bodyNodes) {
        const exits = [];
        // Convert to Set if it's an Array
        const bodyNodesSet = bodyNodes instanceof Set ? bodyNodes : new Set(bodyNodes);
        
        for (const nodeId of bodyNodes) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'decision') {
                const yesBranch = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
                const noBranch = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');

                for (const branch of [yesBranch, noBranch]) {
                    if (branch && branch !== headerId && !bodyNodesSet.has(branch)) {
                        if (this.canReachEnd(branch)) {
                            exits.push(branch);
                        }
                    }
                }
            }
        }
        return exits;
    }

    /**
     * Check if a process node has distinct exit paths through decisions
     */
    hasDistinctExitPathsFromProcess(headerId, bodyNodes) {
        return this.findProcessExitNodes(headerId, bodyNodes).length > 1;
    }

    /**
     * Collect body nodes for a while-true loop with multiple exit paths
     */
    collectWhileTrueBodyNodes(headerId, loopEntry) {
        const bodyNodes = [];
        const visited = new Set();
        const stack = [loopEntry];

        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            const node = this.nodes.find(n => n.id === nodeId);
            if (!node) continue;

            // Skip End nodes
            if (node.type === 'end') continue;

            bodyNodes.push(nodeId);

            // Get successors
            const outgoing = this.outgoingMap.get(nodeId) || [];
            for (const edge of outgoing) {
                const nextId = edge.to;
                // Follow back to header (include it)
                if (nextId === headerId) {
                    if (!visited.has(headerId)) {
                        stack.push(headerId);
                    }
                    continue;
                }
                // Follow other paths that stay in the loop
                if (this.pathExists(nextId, headerId)) {
                    stack.push(nextId);
                }
            }
        }

        return bodyNodes;
    }
    
    /**
     * Helper methods
     */
    getSuccessor(nodeId, port) {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        const edge = outgoing.find(e => e.port === port);
        return edge ? edge.to : null;
    }
    
    getAllSuccessors(nodeId) {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        return outgoing.map(e => ({ nodeId: e.to, port: e.port }));
    }
    
    /**
     * Check if a path exists from fromId to toId (iterative to prevent stack overflow)
     * @param fromId - Starting node ID
     * @param toId - Target node ID
     * @param avoidSet - Optional set of node IDs to avoid (e.g., loop headers)
     */
    pathExists(fromId, toId, avoidSet = new Set()) {
        if (fromId === toId) return true;
        if (!fromId) return false;
        
        const visited = new Set();
        const stack = [fromId];
        
        while (stack.length > 0) {
            const current = stack.pop();
            
            if (current === toId) return true;
            if (visited.has(current)) continue;
            if (avoidSet.has(current)) continue;
            
            visited.add(current);
            
            const outgoing = this.outgoingMap.get(current) || [];
        for (const edge of outgoing) {
                if (!visited.has(edge.to) && !avoidSet.has(edge.to)) {
                    stack.push(edge.to);
                }
            }
        }
        
        return false;
    }
    
    findLoopBodyNodes(headerId, stopBeforeId) {
        const bodyNodes = new Set();
        const queue = [];
        
        // Add initial successors of header (excluding exit)
        const outgoing = this.outgoingMap.get(headerId) || [];
        for (const edge of outgoing) {
            if (edge.port === 'yes' || edge.port === 'true') {
                queue.push(edge.to);
            }
        }
        
        // BFS to collect body nodes
        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (nodeId === headerId || bodyNodes.has(nodeId)) {
                continue;
            }
            
            bodyNodes.add(nodeId);
            
            // Add successors (don't exclude nodes with exit paths - they might still be part of the loop body)
            const succOutgoing = this.outgoingMap.get(nodeId) || [];
            for (const edge of succOutgoing) {
                if (edge.to !== headerId && !bodyNodes.has(edge.to)) {
                    queue.push(edge.to);
                }
            }
        }
        
        return Array.from(bodyNodes);
    }
    
    findLoopExitNodes(headerId) {
        const exitNodes = new Set();
        const outgoing = this.outgoingMap.get(headerId) || [];
        
        for (const edge of outgoing) {
            if (edge.port === 'no' || edge.port === 'false') {
                exitNodes.add(edge.to);
            }
        }
        
        return Array.from(exitNodes);
    }
    
    isExitPath(nodeId, headerId, visited = new Set()) {
        if (nodeId === headerId) return false;
        if (visited.has(nodeId)) return false;
        
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return false;
        
        // Found an END node (definitely exits)
        if (node.type === 'end') return true;
        
        visited.add(nodeId);
        
        const outgoing = this.outgoingMap.get(nodeId) || [];
        for (const edge of outgoing) {
            if (this.isExitPath(edge.to, headerId, new Set([...visited]))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Collect all nodes in a loop body using natural loop computation
     * Natural loop = header + all nodes that can reach the back edge without going through header
     * Uses iterative BFS to prevent stack overflow on complex graphs
     */
    collectLoopBodyNodes(headerId, startId) {
        if (!startId || startId === headerId) return [];
        
        const bodyNodes = new Set();
        const visited = new Set([headerId]); // Don't traverse through header
        const stack = [startId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            // Skip END nodes - they're never part of the loop body
            const node = this.nodes.find(n => n.id === currentId);
            if (node && node.type === 'end') continue;
            
            bodyNodes.add(currentId);
            
            // Add all successors that aren't the header
            const outgoing = this.outgoingMap.get(currentId) || [];
        for (const edge of outgoing) {
                // Only follow edges that:
                // 1. Don't go back to header (that would be the back edge)
                // 2. Haven't been visited
                if (edge.to !== headerId && !visited.has(edge.to)) {
                    stack.push(edge.to);
                }
            }
        }
        
        return Array.from(bodyNodes);
    }
    
    /**
     * Find the controlling decision for a non-decision loop header (join point)
     * The controlling decision is a decision node reachable from the join point
     * where one branch loops back to the join point and one branch exits
     * For spaghetti loops, this finds the decision with "cleanest" branches
     */
    findControllingDecision(joinPointId) {
        // BFS from join point to find all reachable decision nodes
        const visited = new Set();
        const queue = [joinPointId];
        const candidateDecisions = [];
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;
            
            // If we hit a decision, check if it controls exit from this loop
            if (node.type === 'decision') {
                const yesId = this.getSuccessor(currentId, 'yes') || this.getSuccessor(currentId, 'true');
                const noId = this.getSuccessor(currentId, 'no') || this.getSuccessor(currentId, 'false');
                
                // Check if branches loop back or exit
                const yesLoopsBack = yesId && this.canReachNode(yesId, joinPointId, new Set([currentId]));
                const noLoopsBack = noId && this.canReachNode(noId, joinPointId, new Set([currentId]));
                const yesExits = yesId && this.reachesEndWithoutReturningToHeader(yesId, joinPointId);
                const noExits = noId && this.reachesEndWithoutReturningToHeader(noId, joinPointId);
                
                // Prefer "clean" decisions where branches are exclusive:
                // - One branch ONLY loops (and doesn't exit)
                // - One branch ONLY exits (and doesn't loop back)
                const yesOnlyLoops = yesLoopsBack && !yesExits;
                const yesOnlyExits = yesExits && !yesLoopsBack;
                const noOnlyLoops = noLoopsBack && !noExits;
                const noOnlyExits = noExits && !noLoopsBack;
                
                // Priority 1: Clean branches (one only loops, one only exits)
                // Priority 2: Standard while pattern (YES loops, NO exits)
                // Priority 3: Inverted pattern (NO loops, YES exits)
                // Priority 4: Mixed (both can do both, but one is dominant)
                
                if ((yesOnlyLoops && noOnlyExits) || (noOnlyLoops && yesOnlyExits)) {
                    // Clean controlling decision
                    candidateDecisions.push({
                        id: currentId,
                        priority: noOnlyExits ? 1 : 2, // Prefer standard while pattern
                        isClean: true
                    });
                } else if ((yesLoopsBack && noExits) || (noLoopsBack && yesExits)) {
                    // Less clean but still valid (one branch can do both)
                    candidateDecisions.push({
                        id: currentId,
                        priority: noExits ? 3 : 4,
                        isClean: false
                    });
                }
                
                // Continue exploring through the decision's branches
                if (yesId && !visited.has(yesId)) queue.push(yesId);
                if (noId && !visited.has(noId)) queue.push(noId);
            } else if (node.type !== 'end') {
                // For non-decision, non-end nodes, continue exploring
                const outgoing = this.outgoingMap.get(currentId) || [];
                for (const edge of outgoing) {
                    if (!visited.has(edge.to)) {
                        queue.push(edge.to);
                    }
                }
            }
        }
        
        // Return the best candidate (prefer clean branches, then NO-exits pattern)
        if (candidateDecisions.length > 0) {
            candidateDecisions.sort((a, b) => a.priority - b.priority);
            return candidateDecisions[0].id;
        }
        
        return null;
    }
    
    /**
     * Check if we can reach targetId from startId without going through avoidIds
     */
    canReachNode(startId, targetId, avoidIds = new Set()) {
        if (startId === targetId) return true;
        
        const visited = new Set(avoidIds);
        const queue = [startId];
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (currentId === targetId) return true;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                if (!visited.has(edge.to)) {
                    queue.push(edge.to);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if a path from startId reaches END without returning to the loop header
     * Uses iterative BFS to prevent stack overflow on complex graphs
     * Used to detect when a branch inside a loop should have a break statement
     * (Ported from old compiler)
     */
    reachesEndWithoutReturningToHeader(fromId, headerId) {
        if (!fromId) return false;
        if (fromId === headerId) return false;
        
        const visited = new Set();
        const stack = [fromId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            // If we come back to the header → not an exit (it's a back edge)
            if (currentId === headerId) continue;
            
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;

            // If we reach END → success (exits the loop)
            if (node.type === 'end') return true;
            
            // Follow all successors depending on node type
            if (node.type === 'decision') {
                const y = this.getSuccessor(currentId, 'yes');
                const n = this.getSuccessor(currentId, 'no');
                if (y && !visited.has(y)) stack.push(y);
                if (n && !visited.has(n)) stack.push(n);
            } else {
                const next = this.getSuccessor(currentId, 'next');
                if (next && !visited.has(next)) stack.push(next);
            }
        }

        return false;
    }
    
    /**
     * Check if ALL paths from a node exit the loop
     * Used to determine if a break should be added at the end of a branch
     */
    allPathsExitLoop(startId, headerId, visited = new Set()) {
        if (!startId) return false;
        if (startId === headerId) return false; // Back edge - doesn't exit
        
        if (visited.has(startId)) return true; // Already checked this path
        visited.add(startId);

        const node = this.nodes.find(n => n.id === startId);
        if (!node) return false;

        // If we reach END → this path exits
        if (node.type === 'end') return true;
        
        // Get all successors
        const succs = [];
        if (node.type === 'decision') {
            const y = this.getSuccessor(startId, 'yes');
            const n = this.getSuccessor(startId, 'no');
            if (y) succs.push(y);
            if (n) succs.push(n);
        } else {
            const next = this.getSuccessor(startId, 'next');
            if (next) succs.push(next);
        }

        // If no successors, this path doesn't exit
        if (succs.length === 0) return false;

        // ALL paths must exit for this to return true
        for (const s of succs) {
            if (!this.allPathsExitLoop(s, headerId, new Set([...visited]))) {
                return false;
            }
        }

        return true;
    }
    
    isPotentialForLoop(headerId) {
        const headerNode = this.nodes.find(n => n.id === headerId);
        if (!headerNode || headerNode.type !== 'decision') return false;
        
        const condition = headerNode.text || '';
        const varMatch = condition.match(/^\s*(\w+)\s*[<>=!]/);
        if (!varMatch) return false;
        
        const varName = varMatch[1];
        const initNode = this.findInitialization(headerId, varName);
        
        // Only return true if we have BOTH an initialization AND an update
        if (!initNode) return false;
        
        // Also check for update in the loop
        const updateNode = this.findUpdateInLoop(headerId, varName);
        return updateNode !== null;  // Need both init and update for for-loop
    }
    
    isActualLoop(headerId, loopEntry) {
        return this.pathExists(loopEntry, headerId, new Set([headerId]));
    }
    
    hasComplexBody(bodyNodes) {
        return bodyNodes.length > 3 || 
               bodyNodes.some(id => {
                   const node = this.nodes.find(n => n.id === id);
                   return node && node.type === 'decision';
               });
    }
    
    isAlwaysTrueCondition(condition) {
        const trimmed = condition.trim();

        // Check for explicit true values
        if (['True', 'true', '1'].includes(trimmed)) {
            return true;
        }

        // Check for tautologies like "x == x" (same variable on both sides)
        const eqMatch = trimmed.match(/^\s*(\w+)\s*==\s*(\w+)\s*$/);
        if (eqMatch && eqMatch[1] === eqMatch[2]) {
            return true;  // e.g., "x == x"
        }

        // "x != x" is always false, not true, so don't include it
        
        return false;
    }
}

/**
 * FlowAnalyzer - Phase 1: Complete flowchart analysis
 */
class FlowAnalyzer {
    constructor(nodes, connections) {
        this.nodes = nodes;
        this.connections = connections;

        this.loopAnalysis = new Map();
        this.exitAnalysis = new Map();
        this.nestingAnalysis = new Map();
        this.breakAnalysis = new Map();

        this.outgoingMap = new Map();
        this.incomingMap = new Map();
        this.dominators = new Map();
        this.backEdges = [];
        this.loopHeaders = new Set();

        this.buildMaps();
        this.computeDominators();
        this.identifyLoopHeaders(); 
    }
    
    identifyLoopHeaders() {
        for (const [from, edges] of this.outgoingMap.entries()) {
            for (const edge of edges) {
                const to = edge.to;
                const doms = this.dominators.get(from);
                if (doms && doms.has(to)) {
                    this.loopHeaders.add(to);
                }
            }
        }
    }
    
    buildMaps() {
        this.nodes.forEach(node => {
            this.outgoingMap.set(node.id, []);
            this.incomingMap.set(node.id, []);
        });

        // Port normalization map for different flowchart formats
        const portMap = {
            "true": "yes",
            "false": "no",
            "y": "yes",
            "n": "no",
            "": "next",
            "null": "next",
            "undefined": "next"
        };

        const normPort = (p) => {
            const key = (p ?? "next").toString().trim().toLowerCase();
            return portMap.hasOwnProperty(key) ? portMap[key] : key;
        };

        this.connections.forEach(conn => {
            // Handle different connection field names from various flowchart formats
            const from = conn.from ?? conn.fromId ?? conn.sourceId ?? conn.source;
            const to = conn.to ?? conn.targetId ?? conn.toId ?? conn.target;

            if (!from || !to) return;

            const port = normPort(conn.port ?? conn.fromPort ?? conn.label);

            if (this.outgoingMap.has(from)) {
                this.outgoingMap.get(from).push({ to, port });
            }
            if (this.incomingMap.has(to)) {
                this.incomingMap.get(to).push({ from, port });
            }
        });
    }

    computeDominators() {
        const startNode = this.nodes.find(n => n.type === 'start');
        if (!startNode) return;

        this.nodes.forEach(node => {
            this.dominators.set(node.id, new Set(this.nodes.map(n => n.id)));
        });
        this.dominators.get(startNode.id).clear();
        this.dominators.get(startNode.id).add(startNode.id);

        let changed = true;
        while (changed) {
            changed = false;
            for (const node of this.nodes) {
                if (node.id === startNode.id) continue;

                const predecessors = this.incomingMap.get(node.id) || [];
                if (predecessors.length === 0) continue;

                const predDominators = predecessors.map(pred =>
                    this.dominators.get(pred.from)
                ).filter(d => d);

                if (predDominators.length === 0) continue;

                let newDom = new Set(predDominators[0]);
                for (let i = 1; i < predDominators.length; i++) {
                    newDom = new Set([...newDom].filter(x => predDominators[i].has(x)));
                }
                newDom.add(node.id);

                const oldDom = this.dominators.get(node.id);
                if (!this.setsEqual(newDom, oldDom)) {
                    this.dominators.set(node.id, newDom);
                    changed = true;
                }
            }
        }
    }

    analyze() {
        const analysis = {
            loops: new Map(),
            exits: new Map(),
            breaks: new Map(),
            nesting: new Map()
        };

        for (const headerId of this.loopHeaders) {
            analysis.loops.set(headerId, this.analyzeLoop(headerId));
        }

        this.analyzeExitsAndBreaks(analysis);

        return analysis;
    }

    analyzeLoop(headerId) {
        const loopInfo = {
            headerId,
            bodyNodes: new Set(),
            exitNodes: new Set(),
            exitConditions: [],
            nestedLoops: new Set(),
            hasBreaks: false,
            recommendedType: 'simple_while'
        };

        this.findLoopNodes(headerId, loopInfo);
        loopInfo.hasNestedLoops = this.detectNestedLoops(loopInfo);
        this.analyzeLoopExits(headerId, loopInfo);
        loopInfo.recommendedType = this.determineLoopType(loopInfo);

        return loopInfo;
    }

    findLoopNodes(headerId, loopInfo) {
        const visited = new Set();
        const stack = [headerId];

        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            loopInfo.bodyNodes.add(nodeId);

            const successors = this.outgoingMap.get(nodeId) || [];
            for (const succ of successors) {
                if (this.canReach(succ.to, headerId, new Set())) {
                    stack.push(succ.to);
                }
            }
        }
    }

    detectNestedLoops(loopInfo) {
        for (const nodeId of loopInfo.bodyNodes) {
            if (this.loopHeaders.has(nodeId) && nodeId !== loopInfo.headerId) {
                return true;
            }
        }
        return false;
    }

    analyzeLoopExits(headerId, loopInfo) {
        const header = this.nodes.find(n => n.id === headerId);
        if (!header || header.type !== 'decision') return;

        const yesSuccessors = this.outgoingMap.get(headerId)?.filter(conn => conn.port === 'yes') || [];
        const noSuccessors = this.outgoingMap.get(headerId)?.filter(conn => conn.port === 'no') || [];

        for (const succ of yesSuccessors) {
            if (!loopInfo.bodyNodes.has(succ.to)) {
                loopInfo.exitNodes.add(succ.to);
                loopInfo.exitConditions.push({condition: header.text, branch: 'yes', exitNode: succ.to});
            }
        }

        for (const succ of noSuccessors) {
            if (!loopInfo.bodyNodes.has(succ.to)) {
                loopInfo.exitNodes.add(succ.to);
                loopInfo.exitConditions.push({condition: `not (${header.text})`, branch: 'no', exitNode: succ.to});
            }
        }
    }

    determineLoopType(loopInfo) {
        if (loopInfo.exitConditions.length > 1) {
            return 'while_true_with_breaks';
        }

        if (loopInfo.hasNestedLoops) {
            for (const exit of loopInfo.exitNodes) {
                const exitNode = this.nodes.find(n => n.id === exit);
                if (exitNode && ['process', 'output', 'var', 'input'].includes(exitNode.type)) {
                    return 'while_true_with_breaks';
                }
            }
        }

        for (const exit of loopInfo.exitNodes) {
            const exitNode = this.nodes.find(n => n.id === exit);
            if (exitNode && ['process', 'var', 'input'].includes(exitNode.type)) {
                return 'while_true_with_breaks';
            }
        }

        return 'simple_while';
    }

    analyzeExitsAndBreaks(analysis) {
        const endNodes = this.nodes.filter(n => n.type === 'end');
        const breakPaths = new Map();

        for (const endNode of endNodes) {
            const pathsToEnd = this.findPathsToNode(endNode.id);
            breakPaths.set(endNode.id, pathsToEnd);
        }

        analysis.breaks = breakPaths;
    }

    findPathsToNode(targetId, maxDepth = 10) {
        const paths = [];
        const visited = new Set();

        function dfs(currentId, path, depth) {
            if (depth > maxDepth) return;
            if (visited.has(currentId)) return;
            visited.add(currentId);

            path.push(currentId);
            if (currentId === targetId) {
                paths.push([...path]);
            } else {
                const successors = this.outgoingMap.get(currentId) || [];
                for (const succ of successors) {
                    dfs.call(this, succ.to, path, depth + 1);
                }
            }
            path.pop();
            visited.delete(currentId);
        }

        for (const node of this.nodes) {
            if (node.id !== targetId) {
                dfs.call(this, node.id, [], 0);
            }
        }

        return paths;
    }

    canReach(startId, targetId, avoidSet = new Set()) {
        if (startId === targetId) return true;

        const visited = new Set();
        const stack = [startId];

        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current) || avoidSet.has(current)) continue;
            visited.add(current);

            if (current === targetId) return true;

            const outgoing = this.outgoingMap.get(current) || [];
            for (const edge of outgoing) {
                stack.push(edge.to);
            }
        }

        return false;
    }

    setsEqual(setA, setB) {
        if (setA.size !== setB.size) return false;
        for (const item of setA) {
            if (!setB.has(item)) return false;
        }
        return true;
    }
}

/**
 * Enhanced FlowAnalyzer with loop classification
 */
class EnhancedFlowAnalyzer extends FlowAnalyzer {
    constructor(nodes, connections) {
        super(nodes, connections);
        this.loopClassifier = new LoopClassifier(nodes, connections, this.outgoingMap, this.incomingMap, this.dominators);
        this.loopClassifications = new Map();
    }
    
    analyze() {
        const basicAnalysis = super.analyze();
        this.loopClassifications = this.loopClassifier.classifyAllLoops();
    
        return {
            ...basicAnalysis,
            loopClassifications: this.loopClassifications
            // DO NOT overwrite basicAnalysis.loops
        };
    }
    
    
    getLoopClassification(headerId) {
        return this.loopClassifications.get(headerId);
    }
}

// IR Node Types
class IRNode {
    constructor(type, id) {
        this.type = type;
        this.id = id;
        this.metadata = {};
    }
}

class IRProgram {
    constructor() {
        this.statements = [];
        this.metadata = {};
    }

    addStatement(stmt) {
        this.statements.push(stmt);
    }
}

class IRStatement extends IRNode {
    constructor(id, statementType, content) {
        super('statement', id);
        this.statementType = statementType;
        this.content = content;
    }
}

class IRIf extends IRNode {
    constructor(id, condition) {
        super('if', id);
        this.condition = condition;
        this.thenBranch = null;
        this.elseBranch = null;
    }
}

class IRWhile extends IRNode {
    constructor(id, condition, loopType = 'while') {
        super('while', id);
        this.condition = condition;
        this.loopType = loopType;
        this.body = null;
        this.elseBranch = null; // For while-else Python construct
    }
}

class IRFor extends IRNode {
    constructor(id, variable, start, end, step = 1, incrementNodeId = null, initNodeId = null) {
        super('for', id);
        this.variable = variable;
        this.start = start;
        this.end = end;
        this.step = step;
        this.incrementNodeId = incrementNodeId;
        this.initNodeId = initNodeId;
        this.body = null;
    }
}

class IRBreak extends IRNode {
    constructor(id) {
        super('break', id);
    }
}

class IRContinue extends IRNode {
    constructor(id) {
        super('continue', id);
    }
}

class IRHighlight extends IRNode {
    constructor(nodeId) {
        super('highlight', nodeId);
    }
}

// IR Builder
class IRBuilder {
    constructor(nodes, connections, flowAnalysis) {
        this.nodes = nodes;
        this.connections = connections;
        this.flowAnalysis = flowAnalysis;

        this.outgoingMap = new Map();
        nodes.forEach(n => this.outgoingMap.set(n.id, []));
        connections.forEach(c => {
            if (this.outgoingMap.has(c.from)) {
                this.outgoingMap.get(c.from).push(c);
            }
        });
    }
    
    /**
     * Build Python input statement from node properties (varName, prompt, dtype)
     * Used when node.text is empty but properties are set
     */
    buildInputPython(node) {
        const varName = (node.varName && String(node.varName).trim()) ? String(node.varName).trim() : "value";
        const prompt = (node.prompt !== undefined && node.prompt !== null) ? String(node.prompt) : "";
        const dtype = (node.dtype || "").toLowerCase().trim();

        const promptLit = JSON.stringify(prompt); // safe quoting
        let rhs = prompt.length ? `input(${promptLit})` : `input()`;

        if (dtype === "int") rhs = `int(${rhs})`;
        else if (dtype === "float") rhs = `float(${rhs})`;
        // else: string/no cast

        return `${varName} = ${rhs}`;
    }

    buildProgram(startNodeId) {
        const program = new IRProgram();
        const stmt = this.buildNode(startNodeId, new Set(), null, 0, new Set());
        if (stmt) {
            this.flattenChain(stmt, program);
        }
        return program;
    }

    findNode(nodeId) {
        return this.nodes.find(n => n.id === nodeId) || null;
    }
    
    getSuccessor(nodeId, port = 'next') {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        const edge = outgoing.find(e => e.port === port);
        return edge ? edge.to : null;
    }
    
    getSuccessors(nodeId) {
        const node = this.findNode(nodeId);
        if (!node) return [];
        
        if (node.type === 'decision') {
            const yesId = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
            const noId = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');
            return [yesId, noId].filter(Boolean);
        }
        
        const nextId = this.getSuccessor(nodeId, 'next');
        return nextId ? [nextId] : [];
    }
    
    findConvergenceNode(decisionId) {
        // Use the simpler approach for now - can be enhanced later
        const trueNext = this.getSuccessor(decisionId, 'yes') || this.getSuccessor(decisionId, 'true');
        const falseNext = this.getSuccessor(decisionId, 'no') || this.getSuccessor(decisionId, 'false');
    
        if (!trueNext || !falseNext) return null;
    
        const visited = new Set();
        const queue = [trueNext, falseNext];
        const seen = new Map();
    
        while (queue.length) {
            const node = queue.shift();
            seen.set(node, (seen.get(node) || 0) + 1);
    
            if (seen.get(node) === 2) {
                return node;
            }
    
            const outgoing = this.outgoingMap.get(node) || [];
            for (const e of outgoing) {
                if (!visited.has(e.to)) {
                    visited.add(e.to);
                    queue.push(e.to);
                }
            }
        }
    
        return null;
    }
    
    /**
     * Find common convergence point (adapted from old compiler)
     * More sophisticated than findConvergenceNode - handles elif chains
     */
    findCommonConvergencePoint(decisionId, yesId, noId) {
        // Collect all non-decision nodes reachable from each branch
        // Use iterative BFS instead of recursive DFS to prevent stack overflow
        const collectNonDecisions = (startId) => {
            const results = new Set();
            if (!startId) return results;
            
            const visited = new Set();
            const queue = [{ id: startId, depth: 0 }];
            const maxDepth = 20;
            
            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                
                // Skip if already visited or too deep
                if (visited.has(id) || depth > maxDepth) continue;
                visited.add(id);
        
                const node = this.findNode(id);
                if (!node) continue;

                // If we hit a decision node, stop traversing (it's a branch point)
                // We only want to collect non-decision nodes, so we stop at decision nodes
                if (node.type === 'decision') {
                    continue;
                }

                // Collect this non-decision node
                results.add(id);

                // Continue traversing if not too deep
                if (depth < maxDepth - 1) {
                    const successors = this.getSuccessors(id);
                    for (const succId of successors) {
                        if (succId && !visited.has(succId)) {
                            queue.push({ id: succId, depth: depth + 1 });
                        }
                    }
                }
            }

            return results;
        };

        // Use separate visited sets for each branch to allow finding common nodes
        const yesNodes = collectNonDecisions(yesId, new Set());
        const noNodes = collectNonDecisions(noId, new Set());

        // Find common nodes
        const commonNodes = new Set();
        for (const nodeId of yesNodes) {
            if (noNodes.has(nodeId)) {
                commonNodes.add(nodeId);
            }
        }

        // Return the first common node (prefer output nodes)
        // Cache node lookups to avoid repeated findNode calls in sort comparator
        if (commonNodes.size > 0) {
            const nodeCache = new Map();
            const getNode = (id) => {
                if (!nodeCache.has(id)) {
                    nodeCache.set(id, this.findNode(id));
                }
                return nodeCache.get(id);
            };
            
            const sortedCommon = Array.from(commonNodes).sort((a, b) => {
                const nodeA = getNode(a);
                const nodeB = getNode(b);
                if (!nodeA || !nodeB) return 0;
                if (nodeA.type === 'end' && nodeB.type !== 'end') return -1;
                if (nodeB.type === 'end' && nodeA.type !== 'end') return 1;
                if (nodeA.type === 'output' && nodeB.type !== 'output') return -1;
                if (nodeB.type === 'output' && nodeA.type !== 'output') return 1;
                return 0;
            });
            return sortedCommon[0];
        }

        // If no direct common target, check if NO branch is another decision (elif chain)
        // But prevent infinite recursion by checking if we've seen this decision before
        const noNode = this.findNode(noId);
        if (noNode && noNode.type === 'decision' && noId !== decisionId) {
            // Recursively check the elif chain, but limit depth to prevent infinite recursion
            const noYesId = this.getSuccessor(noId, 'yes') || this.getSuccessor(noId, 'true');
            const noNoId = this.getSuccessor(noId, 'no') || this.getSuccessor(noId, 'false');
            // Use a visited set to track decisions we've already checked
            const decisionVisited = new Set([decisionId]);
            return this.findCommonConvergencePointWithVisited(noId, noYesId, noNoId, decisionVisited);
        }
        
        return null;
    }
    
    findCommonConvergencePointWithVisited(decisionId, yesId, noId, decisionVisited) {
        // Prevent infinite recursion by tracking decisions we've already checked
        if (decisionVisited.has(decisionId)) {
            return null;
        }
        decisionVisited.add(decisionId);
        
        // Collect all non-decision nodes reachable from each branch
        // Use iterative BFS instead of recursive DFS to prevent stack overflow
        const collectNonDecisions = (startId) => {
            const results = new Set();
            if (!startId) return results;
            
            const visited = new Set();
            const queue = [{ id: startId, depth: 0 }];
            const maxDepth = 20;
            
            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                
                // Skip if already visited or too deep
                if (visited.has(id) || depth > maxDepth) continue;
                visited.add(id);
        
                const node = this.findNode(id);
                if (!node) continue;

                // If we hit a decision node, stop traversing (it's a branch point)
                if (node.type === 'decision') {
                    continue;
                }

                // Collect this non-decision node
                results.add(id);

                // Continue traversing if not too deep
                if (depth < maxDepth - 1) {
                    const successors = this.getSuccessors(id);
                    for (const succId of successors) {
                        if (succId && !visited.has(succId)) {
                            queue.push({ id: succId, depth: depth + 1 });
                        }
                    }
                }
            }

            return results;
        };

        // Use separate traversals for each branch to allow finding common nodes
        const yesNodes = collectNonDecisions(yesId);
        const noNodes = collectNonDecisions(noId);

        // Find common nodes
        const commonNodes = new Set();
        for (const nodeId of yesNodes) {
            if (noNodes.has(nodeId)) {
                commonNodes.add(nodeId);
            }
        }

        // Return the first common node (prefer output nodes)
        // Cache node lookups to avoid repeated findNode calls in sort comparator
        if (commonNodes.size > 0) {
            const nodeCache = new Map();
            const getNode = (id) => {
                if (!nodeCache.has(id)) {
                    nodeCache.set(id, this.findNode(id));
                }
                return nodeCache.get(id);
            };
            
            const sortedCommon = Array.from(commonNodes).sort((a, b) => {
                const nodeA = getNode(a);
                const nodeB = getNode(b);
                if (!nodeA || !nodeB) return 0;
                if (nodeA.type === 'end' && nodeB.type !== 'end') return -1;
                if (nodeB.type === 'end' && nodeA.type !== 'end') return 1;
                if (nodeA.type === 'output' && nodeB.type !== 'output') return -1;
                if (nodeB.type === 'output' && nodeA.type !== 'output') return 1;
                return 0;
            });
            return sortedCommon[0];
        }

        // If no direct common target, check if NO branch is another decision (elif chain)
        // Add depth limit to prevent infinite recursion
        const maxElifDepth = 10;
        if (decisionVisited.size >= maxElifDepth) {
            return null; // Prevent infinite recursion in deep elif chains
        }
        
        const noNode = this.findNode(noId);
        if (noNode && noNode.type === 'decision' && !decisionVisited.has(noId)) {
            // Recursively check the elif chain
            const noYesId = this.getSuccessor(noId, 'yes') || this.getSuccessor(noId, 'true');
            const noNoId = this.getSuccessor(noId, 'no') || this.getSuccessor(noId, 'false');
            return this.findCommonConvergencePointWithVisited(noId, noYesId, noNoId, decisionVisited);
        }
        
        return null;
    }
    
    /**
     * Check if decisions form a linear chain (for elif detection)
     * Adapted from old compiler
     */
    isLinearDecisionChain(startDecisionId, parentDecisionId) {
        let currentId = startDecisionId;
        const visited = new Set();
        
        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            
            const node = this.findNode(currentId);
            if (!node || node.type !== 'decision') return false;
            
            // Check if YES branch goes back to parent or is a decision
            const yesId = this.getSuccessor(currentId, 'yes') || this.getSuccessor(currentId, 'true');
            if (yesId === parentDecisionId) {
                // This is a loop back, not a linear chain
                return false;
            }
            
            const yesNode = yesId ? this.findNode(yesId) : null;
            if (yesNode && yesNode.type === 'decision') {
                // YES branch is a decision → nested, not linear
                return false;
            }
            
            // Move to NO branch
            const noId = this.getSuccessor(currentId, 'no') || this.getSuccessor(currentId, 'false');
            if (!noId) break;
            
            const noNode = this.findNode(noId);
            if (!noNode) break;
            
            if (noNode.type === 'decision') {
                currentId = noId;
            } else {
                break;
            }
        }
        
        return true;
    }
    
    /**
     * Build a node chain up to (but not including) a stop node
     * Similar to compileNodeUntil in old compiler
     */
    buildNodeUntil(startId, stopId, visited, allowedIds = null, activeLoops = new Set(), excludeNodeId = null) {
        if (!startId || startId === stopId) return null;
        
        // Skip excluded nodes (like increment nodes in for loops)
        if (excludeNodeId && startId === excludeNodeId) {
            // Skip this node but continue with its successor
            const next = this.getSuccessor(startId, 'next');
            if (next && next !== stopId) {
                return this.buildNodeUntil(next, stopId, visited, allowedIds, activeLoops, excludeNodeId);
            }
            return null;
        }
        
        // Prevent cycles - but allow revisiting if not in visited yet
        if (visited.has(startId)) return null;
        
        // If we're in a constrained context, check if startId is allowed
        if (allowedIds && !allowedIds.has(startId)) return null;
        
        // CRITICAL: If this node is a loop header that's currently being built,
        // stop immediately to prevent infinite recursion
        if (activeLoops.has(startId)) {
            return null;
        }
        
        visited.add(startId);
        
        // Build the current node
        const node = this.findNode(startId);
        if (!node) return null;
        
        // If this is a decision that's a loop, handle it specially
        const loopInfo = this.flowAnalysis?.loopClassifier?.loopPatterns?.get(startId);
        if (loopInfo) {
            // It's a loop - build it as a loop
            return this.buildLoopFromClassification(startId, loopInfo, visited, allowedIds, activeLoops);
        }
        
        // If this is a decision that's not a loop, build as if statement
        if (node.type === 'decision') {
            return this.buildIfStatement(startId, node, visited, allowedIds, null, activeLoops, new Set());
        }
        
        // Build as regular node (but don't follow next chain here - we'll do it below)
        let stmt = null;
        switch (node.type) {
            case 'process':
            case 'var':
            case 'list':
                stmt = new IRStatement(node.id, 'assignment', node.text || '');
                break;
            case 'output':
                stmt = new IRStatement(node.id, 'print', node.text || '');
                break;
            case 'input':
                {
                    const raw = (node.text || '').trim();
                    const compiled = raw.length > 0 ? raw : this.buildInputStatement(node);
                    stmt = new IRStatement(node.id, 'input', compiled);
                }
                break;
            default:
                return null;
        }
        
        if (!stmt) return null;
        
        // Follow next chain, but stop at stopId
        const next = this.getSuccessor(startId, 'next');
        if (next && next !== stopId) {
            // Check if next is allowed (if we're in a constrained context)
            if (!allowedIds || allowedIds.has(next)) {
                // Don't check visited here - buildNodeUntil will check it
                const nextStmt = this.buildNodeUntil(next, stopId, visited, allowedIds, activeLoops, excludeNodeId);
                if (nextStmt) {
                    stmt.next = nextStmt;
                }
            }
        }
        
        return stmt;
    }
    
    buildNode(nodeId, visited) {
        if (!nodeId || visited.has(nodeId)) return null;
        visited.add(nodeId);
    
        const node = this.findNode(nodeId);
        if (!node) return null;

        if (this.flowAnalysis.loops.has(nodeId)) {
            return this.buildWhileLoop(nodeId, visited);
        }
        
        if (node.type === 'start') {
            const outgoing = this.outgoingMap.get(nodeId) || [];
            if (outgoing.length === 0) return null;
            return this.buildNode(outgoing[0].to, visited);
        }
        
        if (node.type === 'end') {
            return null;
        }
    
        if (node.type === 'process' || node.type === 'var') {
            const stmt = new IRStatement(nodeId, 'assignment', node.text || '');
            const next = this.getSuccessor(nodeId);
            if (next) {
                stmt.next = this.buildNode(next, visited);
            }
            return stmt;
        }
    
        if (node.type === 'output') {
            const stmt = new IRStatement(nodeId, 'print', node.text || '');
            const next = this.getSuccessor(nodeId);
            if (next) {
                stmt.next = this.buildNode(next, visited);
            }
            return stmt;
        }

        if (node.type === 'input') {
            // Use node.text if provided, otherwise build from varName/prompt/dtype
            const py = (node.text && String(node.text).trim())
                ? String(node.text).trim()
                : this.buildInputPython(node);
            
            const stmt = new IRStatement(nodeId, 'input', py);
            const next = this.getSuccessor(nodeId);
            if (next) {
                stmt.next = this.buildNode(next, visited);
            }
            return stmt;
        }
        
        if (node.type === 'decision') {
            const condition = node.text || '';
            const trueNext = this.getSuccessor(nodeId, 'yes');
            const falseNext = this.getSuccessor(nodeId, 'no');
            const converge = this.findConvergenceNode(nodeId);
        
            const ifNode = new IRIf(nodeId, condition);
            ifNode.thenBranch = trueNext
                ? this.buildNode(trueNext, new Set(visited))
                : null;
            ifNode.elseBranch = falseNext
                ? this.buildNode(falseNext, new Set(visited))
                : null;
        
            if (converge) {
                ifNode.next = this.buildNode(converge, visited);
            }
        
            return ifNode;
        }
        
        return null;
    }

    buildWhileLoop(headerId, visited) {
        const headerNode = this.findNode(headerId);
        const condition = headerNode?.text || '';
        
        const loopInfo = this.flowAnalysis.loops?.get(headerId);
        let loopType = 'while';
        
        if (loopInfo && loopInfo.recommendedType === 'while_true_with_breaks') {
            loopType = 'while_true';
        }
    
        const bodyEntry = this.getSuccessor(headerId, 'yes') ?? this.getSuccessor(headerId, 'true');
        const exitNode = this.getSuccessor(headerId, 'no') ?? this.getSuccessor(headerId, 'false');
    
        const loop = new IRWhile(headerId, condition, loopType);
        
        if (bodyEntry) {
            const bodyProgram = new IRProgram();
            const bodyNodes = this.traverseLoopBody(bodyEntry, headerId, new Set());
            
            for (const bodyNode of bodyNodes) {
                const nodeIR = this.buildNode(bodyNode, new Set(visited));
                if (nodeIR) {
                    bodyProgram.addStatement(nodeIR);
                }
            }
            
            loop.body = bodyProgram;
        }
        
        if (exitNode && !visited.has(exitNode)) {
            loop.next = this.buildNode(exitNode, visited);
        }
    
        return loop;
    }
    
    /**
     * Traverse loop body and collect all node IDs
     * Uses iterative BFS to prevent stack overflow
     */
    traverseLoopBody(startId, loopHeaderId) {
        if (!startId || startId === loopHeaderId) {
            return [];
        }
        
        const result = [];
        const visited = new Set();
        const stack = [startId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            if (visited.has(currentId) || currentId === loopHeaderId) continue;
            visited.add(currentId);
            
            result.push(currentId);
            
            const node = this.findNode(currentId);
            if (!node) continue;
            
        if (node.type === 'decision') {
                const yesId = this.getSuccessor(currentId, 'yes');
                const noId = this.getSuccessor(currentId, 'no');
                if (yesId && !visited.has(yesId)) stack.push(yesId);
                if (noId && !visited.has(noId)) stack.push(noId);
        } else {
                const nextId = this.getSuccessor(currentId, 'next');
                if (nextId && !visited.has(nextId)) stack.push(nextId);
        }
        }
        
        return result;
    }
    
    flattenChain(stmt, program) {
        let current = stmt;
        while (current) {
            program.addStatement(current);
            current = current.next;
        }
    }
    
    /**
     * Check if a path from startId reaches END without returning to the loop header
     * Uses iterative BFS to prevent stack overflow on complex graphs
     * Used to detect when a branch inside a loop should have a break statement
     * (Ported from old compiler - added to IRBuilder for access from buildIfStatement)
     */
    reachesEndWithoutReturningToHeader(fromId, headerId) {
        if (!fromId) return false;
        if (fromId === headerId) return false;
        
        const visited = new Set();
        const stack = [fromId];
        let foundHeader = false;
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            // If we come back to the header → not an exit (it's a back edge)
            if (currentId === headerId) {
                foundHeader = true;
                continue; // Skip the header, but mark that we found it
            }
            
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const node = this.findNode(currentId);
            if (!node) continue;

            // If we reach END → success (exits the loop)
            // BUT: only if we haven't encountered the header first
            if (node.type === 'end') {
                // If we found the header before reaching END, this is not an exit
                return !foundHeader;
            }
            
            // Follow all successors depending on node type
            if (node.type === 'decision') {
                const y = this.getSuccessor(currentId, 'yes') || this.getSuccessor(currentId, 'true');
                const n = this.getSuccessor(currentId, 'no') || this.getSuccessor(currentId, 'false');
                if (y && !visited.has(y) && y !== headerId) stack.push(y);
                if (n && !visited.has(n) && n !== headerId) stack.push(n);
            } else {
                const next = this.getSuccessor(currentId, 'next');
                if (next && !visited.has(next) && next !== headerId) stack.push(next);
            }
        }

        // If we found the header but never reached END, this is not an exit
        return false;
    }

    /**
     * Check if ALL paths from a node exit the loop
     * Used to determine if a break should be added at the end of a branch
     */
    allPathsExitLoop(startId, headerId, visited = new Set()) {
        if (!startId) return false;
        if (startId === headerId) return false; // Back edge - doesn't exit
        
        // If we've visited this node, we're in a cycle
        // If the cycle doesn't include the header, we can't determine if it exits
        // Return false to be conservative (don't assume it exits)
        if (visited.has(startId)) return false;
        visited.add(startId);
        
        const node = this.findNode(startId);
        if (!node) return false;
        
        // If we reach END → this path exits
        if (node.type === 'end') return true;
        
        // Get all successors
        const succs = [];
        if (node.type === 'decision') {
            const y = this.getSuccessor(startId, 'yes') || this.getSuccessor(startId, 'true');
            const n = this.getSuccessor(startId, 'no') || this.getSuccessor(startId, 'false');
            if (y) succs.push(y);
            if (n) succs.push(n);
        } else {
            const next = this.getSuccessor(startId, 'next');
            if (next) succs.push(next);
        }
        
        // If no successors, this path doesn't exit
        if (succs.length === 0) return false;
        
        // ALL paths must exit for this to return true
        for (const s of succs) {
            if (!this.allPathsExitLoop(s, headerId, new Set([...visited]))) {
                return false;
            }
        }
        
        return true;
    }
}

/**
 * Enhanced IR Builder with loop type handling
 */
class EnhancedIRBuilder extends IRBuilder {
    constructor(nodes, connections, flowAnalysis) {
        super(nodes, connections, flowAnalysis);
        this.loopClassifications = flowAnalysis.loopClassifications || new Map();
        
        // Initialize BreakManager for centralized break detection
        this.breakManager = new BreakManager(
            this.nodes,
            this.connections,
            flowAnalysis,
            this.outgoingMap,
            new Map() // incomingMap not needed for IR Builder
        );
    }
    
    /**
     * Get loop type for a given loop header ID
     */
    getLoopType(loopHeaderId) {
        if (!loopHeaderId) return null;
        
        // Check if it's a for loop
        const forInfo = this.detectForLoopPattern(loopHeaderId);
        if (forInfo) {
            return 'for';
        }
        
        // Check loop classification from flowAnalysis
        const loopInfo = this.flowAnalysis?.loopClassifier?.loopPatterns?.get(loopHeaderId);
        if (loopInfo) {
            switch (loopInfo.type) {
                case 'for': return 'for';
                case 'while': return 'while';
                case 'while_true': return 'while_true';
                default: return 'while';
            }
        }
        
        // Default to simple while
        return 'while';
    }
    
    buildProgram(startNodeId) {
        const program = new IRProgram();
        const seenIds = new Set();
        const visited = new Set();
        const stmt = this.buildNode(startNodeId, visited, null, 0, new Set());
        if (stmt) {
            this.addChainToProgram(stmt, program, seenIds, visited, null);
        }
        return program;
    }
    
    addChainToProgram(nodeIR, program, seenIds, visited, allowedIds = null) {
        let cur = nodeIR;
        while (cur) {
            const id = cur.id || null;
    
            // Stop duplicates / accidental cycles
            if (id && seenIds.has(id)) break;
            
            // If we're in a constrained context, stop if we leave the allowed set
            if (allowedIds && id && !allowedIds.has(id)) break;
    
            program.addStatement(cur);
    
            if (id) {
                seenIds.add(id);
                if (visited) visited.add(id);
            }
    
            // Follow next chain - this works for statements, loops, and if statements
            cur = cur.next || null;
            
            // Also check if next node would be outside allowed set
            if (allowedIds && cur && cur.id && !allowedIds.has(cur.id)) {
                break;
            }
        }
    }
    
    buildNode(nodeId, visited, allowedIds = null, depth = 0, activeLoops = new Set(), excludeNodeId = null) {
        // Prevent infinite recursion with depth limit
        if (depth > 100) {
            console.warn(`buildNode: Maximum depth reached for node ${nodeId}`);
            return null;
        }
        
        // Skip excluded nodes (like increment nodes in for loops)
        if (excludeNodeId && nodeId === excludeNodeId) {
            // Skip this node but continue with its successor
            const next = this.getSuccessor(nodeId, 'next');
            if (next) {
                return this.buildNode(next, visited, allowedIds, depth + 1, activeLoops, excludeNodeId);
            }
            return null;
        }
        
        if (!nodeId || visited.has(nodeId)) return null;
        if (allowedIds && !allowedIds.has(nodeId)) return null;
        
        // CRITICAL: If this node is a loop header that's currently being built,
        // stop immediately to prevent infinite recursion
        // This handles the case where we reach a loop header through a branch path
        if (activeLoops.has(nodeId)) {
            return null;
        }
        
        visited.add(nodeId);
        
        const node = this.findNode(nodeId);
        if (!node) return null;
        
        // Check if this is a classified loop header
        const loopInfo = this.loopClassifications.get(nodeId);
        if (loopInfo) {
            return this.buildLoopFromClassification(nodeId, loopInfo, visited, allowedIds, activeLoops);
        }

        // Check if it's a loop header from basic analysis (fallback)
        if (this.flowAnalysis.loops && this.flowAnalysis.loops.has(nodeId)) {
            return this.buildWhileLoop(nodeId, visited, allowedIds);
        }
        
        // Ignore structural nodes
        if (node.type === 'start') {
            const outgoing = this.outgoingMap.get(nodeId) || [];
            if (outgoing.length === 0) return null;
            return this.buildNode(outgoing[0].to, visited, allowedIds, depth + 1, activeLoops, excludeNodeId);
        }
        
        if (node.type === 'end') {
            return null;
        }
        
        // Handle decision nodes (if statements) that are not loops
        if (node.type === 'decision') {
            return this.buildIfStatement(nodeId, node, visited, allowedIds, null, activeLoops, new Set(), excludeNodeId);
        }
        
        // Process regular nodes
        return this.buildRegularNode(node, visited, allowedIds, depth, activeLoops);
    }
    
    buildIfStatement(nodeId, node, visited, allowedIds = null, loopHeaderId = null, activeLoops = new Set(), activeDecisions = new Set(), excludeNodeId = null) {
        // Prevent infinite recursion: if we're already building this decision, skip
        if (activeDecisions.has(nodeId)) {
            return null;
        }
        activeDecisions.add(nodeId);
        
        const condition = node.text || '';
        const trueNext = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
        const falseNext = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');
        
        // Use findCommonConvergencePoint (more sophisticated, handles elif chains)
        const converge = this.findCommonConvergencePoint(nodeId, trueNext, falseNext);
    
        const ifNode = new IRIf(nodeId, condition);
        
        // Check if we're inside a loop and if branches exit the loop
        // This is used to add break statements (ported from old compiler)
        let yesBranchExits = false;
        let noBranchExits = false;
        if (loopHeaderId) {
            // First check: if a branch can reach the header, it's NOT an exit (it loops back)
            // This must be checked FIRST, before checking if it reaches END
            if (trueNext) {
                const loopsBackToHeader = this.canReach(trueNext, loopHeaderId, new Set());
                if (!loopsBackToHeader) {
                    // Only check for exit if it doesn't loop back to header
                    yesBranchExits = this.reachesEndWithoutReturningToHeader(trueNext, loopHeaderId);
                } else {
                    console.log(`buildIfStatement: YES branch ${trueNext} loops back to header ${loopHeaderId}, not an exit`);
                }
            }
            if (falseNext) {
                const loopsBackToHeader = this.canReach(falseNext, loopHeaderId, new Set());
                if (!loopsBackToHeader) {
                    // Only check for exit if it doesn't loop back to header
                    noBranchExits = this.reachesEndWithoutReturningToHeader(falseNext, loopHeaderId);
                } else {
                    console.log(`buildIfStatement: NO branch ${falseNext} loops back to header ${loopHeaderId}, not an exit`);
                }
            }
            
            if (yesBranchExits || noBranchExits) {
                console.log(`buildIfStatement: Inside loop ${loopHeaderId}, yesBranchExits=${yesBranchExits}, noBranchExits=${noBranchExits}`);
            }
        }
        
        // Build branches up to (but not including) convergence point
        // This is similar to compileNodeUntil in the old compiler
        const branchAllowedIds = allowedIds ? new Set(allowedIds) : null;
        if (converge && branchAllowedIds) {
            // Remove convergence point from allowed set for branches
            branchAllowedIds.delete(converge);
        }
        
        // Build YES branch up to convergence point
        // Use a fresh visited set for each branch to allow nodes to be built in branches
        // even if they were visited in the parent context
        // For branches, we're more lenient with allowedIds - if branchAllowedIds is provided,
        // we still allow building nodes that are reachable from the branch start, even if
        // they're not explicitly in the allowed set (they might be in nested structures)
        if (trueNext) {
            // If this branch jumps directly back to the current loop header, treat as "no-op" branch.
            // This is common inside loop bodies and MUST NOT be compiled as an elif/loop,
            // otherwise we can recurse back into the loop and blow the stack.
            if (loopHeaderId && trueNext === loopHeaderId) {
                ifNode.thenBranch = null;
            } else if (loopHeaderId && activeLoops.has(trueNext)) {
                ifNode.thenBranch = null;
            } else
            if (converge) {
                // Build up to convergence point
                ifNode.thenBranch = this.buildNodeUntil(trueNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                // Note: Don't try without constraint - coverage check will catch missing nodes
            } else {
                // No convergence point - build the entire branch
                ifNode.thenBranch = this.buildNode(trueNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                // Note: Don't try without constraint - coverage check will catch missing nodes
            }
            
            // Use BreakManager to determine if break should be added
            if (loopHeaderId) {
                const loopType = this.getLoopType(loopHeaderId);
                // Create contextStack from loopHeaderId (IR Builder doesn't have full contextStack)
                const contextStack = loopHeaderId ? [`loop_${loopHeaderId}`] : [];
                const shouldBreak = this.breakManager.shouldAddBreak(
                    trueNext,
                    loopHeaderId,
                    contextStack,
                    loopType,
                    converge
                );
                if (shouldBreak) {
                    // Append break to end of branch
                    ifNode.thenBranch = this.appendBreakToBranch(ifNode.thenBranch, `${nodeId}_yes_break`);
                    console.log(`  Added break to YES branch (via BreakManager)`);
                }
            }
        } else {
            ifNode.thenBranch = null;
        }
        
        // Handle NO branch - check if it's a decision (elif chain)
        const falseNextNode = falseNext ? this.findNode(falseNext) : null;
        if (falseNextNode && falseNextNode.type === 'decision') {
            // If this branch jumps directly back to the current loop header, treat as "no-op" branch.
            // This prevents compiling loop headers as elif chains inside loop bodies.
            if (loopHeaderId && falseNext === loopHeaderId) {
                ifNode.elseBranch = null;
            } else if (loopHeaderId && activeLoops.has(falseNext)) {
                ifNode.elseBranch = null;
            } else if (loopHeaderId && this.flowAnalysis?.loopClassifier?.pathExists(falseNext, loopHeaderId)) {
                // Else branch loops back to the header - don't build it (implicit continue)
                ifNode.elseBranch = null;
            } else {
            // Check if it's a loop header (classified)
            const isLoopHeader = this.loopClassifications && this.loopClassifications.has(falseNext);
            
            if (!isLoopHeader) {
                // Check if it forms a linear chain (elif)
                const isLinearChain = this.isLinearDecisionChain(falseNext, nodeId);
                
                if (isLinearChain) {
                    // Build as elif chain - recursively build the decision as an if statement
                    // Pass loopHeaderId to enable break insertion in elif chains inside loops
                    // Pass activeDecisions to prevent infinite recursion on spaghetti decision chains
                    ifNode.elseBranch = this.buildIfStatement(falseNext, falseNextNode, new Set(), branchAllowedIds, loopHeaderId, activeLoops, activeDecisions, excludeNodeId);
                } else {
                    // Nested decision - build normally but stop at convergence
                    if (converge) {
                        ifNode.elseBranch = this.buildNodeUntil(falseNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                    } else {
                        ifNode.elseBranch = this.buildNode(falseNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                    }
                }
            } else {
                // It's a loop header, build normally (will be handled as a loop)
                if (converge) {
                    ifNode.elseBranch = this.buildNodeUntil(falseNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                } else {
                    ifNode.elseBranch = this.buildNode(falseNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                }
            }
            }
        } else {
            // Regular else branch - build up to convergence point
            if (falseNext) {
                // Check if else branch loops back to header (implicit continue in while-true)
                if (loopHeaderId && this.flowAnalysis?.loopClassifier?.pathExists(falseNext, loopHeaderId)) {
                    ifNode.elseBranch = null;
                } else if (converge) {
                ifNode.elseBranch = this.buildNodeUntil(falseNext, converge, new Set(), branchAllowedIds, activeLoops);
            } else {
                    ifNode.elseBranch = this.buildNode(falseNext, new Set(), branchAllowedIds, 0, activeLoops);
                }
                
                // Use BreakManager to determine if break should be added
                if (loopHeaderId) {
                    const loopType = this.getLoopType(loopHeaderId);
                    // Create contextStack from loopHeaderId (IR Builder doesn't have full contextStack)
                    const contextStack = loopHeaderId ? [`loop_${loopHeaderId}`] : [];
                    const shouldBreak = this.breakManager.shouldAddBreak(
                        falseNext,
                        loopHeaderId,
                        contextStack,
                        loopType,
                        converge
                    );
                    if (shouldBreak) {
                        // Append break to end of branch
                        ifNode.elseBranch = this.appendBreakToBranch(ifNode.elseBranch, `${nodeId}_no_break`);
                        console.log(`  Added break to NO branch (via BreakManager)`);
                    }
                }
            } else {
                ifNode.elseBranch = null;
            }
        }
    
        // Set convergence point as next - this ensures it's only added once
        // We always set next if converge exists, even if it's outside allowedIds,
        // because the convergence point needs to be emitted to continue the flow
        if (converge) {
            // Try building with allowedIds first, but if that fails, try without constraint
            // This handles cases where the convergence point is outside the current scope
            ifNode.next = this.buildNode(converge, visited, allowedIds, 0, activeLoops, excludeNodeId);
            if (!ifNode.next && allowedIds && !allowedIds.has(converge)) {
                // Convergence point is outside allowedIds - build it anyway
                ifNode.next = this.buildNode(converge, visited, null, 0, activeLoops, excludeNodeId);
            }
        }
        
        // Clean up: remove this decision from active set
        activeDecisions.delete(nodeId);
    
        return ifNode;
    }
    
    /**
     * Append a break statement to the end of a branch
     * Creates a simple IR chain: branch → break
     */
    appendBreakToBranch(branchIR, breakId) {
        if (!branchIR) {
            // No branch content - just return a break statement
            return new IRBreak(breakId);
        }
        
        // Find the end of the branch chain and append break
        let current = branchIR;
        while (current.next) {
            current = current.next;
        }
        current.next = new IRBreak(breakId);
        
        return branchIR;
    }
    
    buildLoopFromClassification(nodeId, loopInfo, visited, allowedIds = null, activeLoops = new Set()) {
        // Prevent infinite recursion: don't build a loop that's already being built
        if (activeLoops.has(nodeId)) {
            console.warn(`Preventing recursive loop build for ${nodeId}`);
            return null;
        }

        activeLoops.add(nodeId);

        let result;
        switch (loopInfo.type) {
            case 'for':
                result = this.buildForLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops);
                break;
            case 'while':
                result = this.buildWhileLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops);
                break;
            case 'while_true':
                result = this.buildWhileTrueLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops);
                break;
            default:
                result = this.buildWhileLoop(nodeId, visited, allowedIds);
                break;
        }

        activeLoops.delete(nodeId);
        return result;
    }
    
    buildForLoopFromInfo(nodeId, loopInfo, visited, parentAllowedIds = null, activeLoops = new Set()) {
        console.log(`buildForLoopFromInfo: nodeId=${nodeId}, bodyNodes=${JSON.stringify(loopInfo.bodyNodes)}, exitNodes=${JSON.stringify(loopInfo.exitNodes)}, updateNodeId=${loopInfo.updateNodeId}`);
        
        const forLoop = new IRFor(
            nodeId,
            loopInfo.variable,
            loopInfo.startValue,
            loopInfo.endValue,
            loopInfo.step,
            loopInfo.updateNodeId,
            loopInfo.initNodeId
        );
        
        // Build loop body (exclude the increment node)
        // BUT: if we're building a nested loop, we might need to include nodes
        // that come after nested loops (like the parent's increment)
        const bodyNodes = loopInfo.bodyNodes.filter(id => id !== loopInfo.updateNodeId);
        const allowedIds = new Set(bodyNodes);
        console.log(`  bodyNodes (after filter): ${JSON.stringify(bodyNodes)}, allowedIds: ${JSON.stringify([...allowedIds])}`);
        
        // IMPORTANT: The loopEntry should be in allowedIds for the body to be built
        // BUT: Don't add the update node - it's handled by Python's range()
        let loopEntry = loopInfo.loopEntry || this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');

        // If the loopEntry is the update node, use the first body node instead
        if (loopEntry === loopInfo.updateNodeId && bodyNodes.length > 0) {
            loopEntry = bodyNodes[0];
        }

        if (loopEntry && !allowedIds.has(loopEntry) && loopEntry !== loopInfo.updateNodeId) {
            console.log(`  Adding loopEntry ${loopEntry} to allowedIds`);
            allowedIds.add(loopEntry);
        }
        
        
        // Also include any nested loop headers that are in the body
        // (they might not be in bodyNodes if they're classified as loops)
        for (const bodyNodeId of bodyNodes) {
            const node = this.findNode(bodyNodeId);
            if (node && node.type === 'decision') {
                const nestedLoopInfo = this.loopClassifications.get(bodyNodeId);
                if (nestedLoopInfo) {
                    // This is a nested loop header - include it in allowedIds
                    allowedIds.add(bodyNodeId);
                }
            }
        }
        // IMPORTANT:
        // Do NOT add the loop's exit node (or any parent nodes) into this loop's allowedIds.
        // For nested loops, the *outer* loop body builder is responsible for continuing after the inner loop exits.
        // If we include the exit node here, the inner loop body can “escape” into the outer loop and recurse forever.
        
        // Build loop body starting from entry point and following execution flow
        // Use a fresh visited set for the loop body to allow nested loops to be included
        // (nested loop headers might be in the parent visited set, but we need to process them)
        const bodyProgram = this.buildLoopBodyFromEntry(nodeId, allowedIds, new Set(), loopEntry, activeLoops, loopInfo.updateNodeId);
        
        // Add pass statement if body is empty
        if (bodyProgram.statements.length === 0) {
            bodyProgram.addStatement(new IRStatement(`${nodeId}_pass`, 'pass', 'pass'));
        }
        
        forLoop.body = bodyProgram;
        
        // Handle exit nodes
        if (loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
            const firstExit = loopInfo.exitNodes[0];
            forLoop.next = this.buildNode(firstExit, visited, parentAllowedIds);
        }
        
        // Mark all loop body nodes as visited
        for (const bodyNodeId of [...bodyNodes, loopInfo.updateNodeId].filter(Boolean)) {
            visited.add(bodyNodeId);
        }
        
        return forLoop;
    }
    
    buildWhileLoopFromInfo(nodeId, loopInfo, visited, parentAllowedIds = null, activeLoops = new Set()) {
        console.log(`buildWhileLoopFromInfo: nodeId=${nodeId}, bodyNodes=${JSON.stringify(loopInfo.bodyNodes)}, exitNodes=${JSON.stringify(loopInfo.exitNodes)}, loopEntry=${loopInfo.loopEntry}, useNoBranch=${loopInfo.useNoBranch}`);

        const whileLoop = new IRWhile(
            nodeId,
            loopInfo.condition,
            'while'
        );
        
        // Build loop body starting from entry point and following execution flow
        // Use loopEntry from classification (handles useNoBranch case)
        const allowedIds = new Set(loopInfo.bodyNodes);
        console.log(`  allowedIds:`, Array.from(allowedIds));
        
        // Use a fresh visited set for the loop body to allow nested loops to be included
        // Pass loopEntry to handle useNoBranch case correctly
        const bodyProgram = this.buildLoopBodyFromEntry(nodeId, allowedIds, new Set(), loopInfo.loopEntry, activeLoops);
        console.log(`  bodyProgram statements:`, JSON.stringify(bodyProgram.statements.map(s => ({id: s.id, type: s.type, statementType: s.statementType, content: s.content}))));
        
        // If body is empty, add a pass statement
        if (bodyProgram.statements.length === 0) {
            bodyProgram.addStatement(new IRStatement(`${nodeId}_pass`, 'pass', 'pass'));
        }
        
        whileLoop.body = bodyProgram;
        
        // Check if the loop body contains break statements (early exits to END)
        // If so, and there's an exit node, use while-else construct
        const hasBreakInBody = this.loopBodyHasEarlyExit(loopInfo.bodyNodes, nodeId);
        console.log(`  hasBreakInBody: ${hasBreakInBody}`);
        
        // Handle exit nodes (code after the loop)
        if (loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
            const firstExit = loopInfo.exitNodes[0];
            const exitNode = this.findNode(firstExit);
            
            // If there's a break in the body, use while-else
            // The else branch runs only when the loop completes normally (no break)
            // TODO: While-else disabled
            if (false && hasBreakInBody && exitNode && exitNode.type !== 'end') {
                console.log(`  Using while-else, elseBranch starts at ${firstExit}`);
                // Build else branch
                const elseBranch = this.buildNode(firstExit, new Set(), parentAllowedIds);
                if (elseBranch) {
                    whileLoop.elseBranch = new IRProgram();
                    whileLoop.elseBranch.addStatement(elseBranch);
                }
            } else {
                // Normal case - code after the loop
                whileLoop.next = this.buildNode(firstExit, visited, parentAllowedIds);
            }
        }
        
        // Mark all loop body nodes as visited so they're not processed again
        for (const bodyNodeId of loopInfo.bodyNodes) {
            visited.add(bodyNodeId);
        }
        
        return whileLoop;
    }
    
    /**
     * Check if a loop body has any EXPLICIT early exits (decision branches that lead to END)
     * Only returns true if there's a decision node with a branch that:
     * 1. Leads directly to END or through non-loop nodes to END
     * 2. Doesn't go through the loop header
     * This is used to determine if while-else construct is appropriate
     */
    loopBodyHasEarlyExit(bodyNodes, headerId) {
        // Convert to Set for O(1) lookup
        const bodyNodeSet = new Set(bodyNodes);
        
        for (const nodeId of bodyNodes) {
            const node = this.findNode(nodeId);
            if (!node) continue;
            
            // Only check decision nodes - they're the only ones that can have explicit break paths
            if (node.type !== 'decision') continue;
            
            const yesId = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
            const noId = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');
            
            // Check if either branch leads OUTSIDE the loop body AND reaches END
            // This indicates an explicit break path
            if (yesId && !bodyNodeSet.has(yesId) && yesId !== headerId) {
                // YES branch exits the loop body - check if it leads to END
                if (this.reachesEndDirectly(yesId, headerId)) {
                    return true;
                }
            }
            if (noId && !bodyNodeSet.has(noId) && noId !== headerId) {
                // NO branch exits the loop body - check if it leads to END
                if (this.reachesEndDirectly(noId, headerId)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Check if a node leads directly to END (without complex paths back into loops)
     * More conservative than reachesEndWithoutReturningToHeader
     * Returns true only if the path reaches END WITHOUT going through the header first
     */
    reachesEndDirectly(startId, headerId) {
        if (!startId) return false;
        
        const visited = new Set();
        const queue = [startId];
        const maxSteps = 10; // Limit how far we follow to avoid counting complex paths
        let steps = 0;
        let foundHeader = false;
        
        while (queue.length > 0 && steps < maxSteps) {
            const currentId = queue.shift();
            steps++;
            
            if (visited.has(currentId)) continue;
            
            // If we encounter the header, mark it but don't follow it
            // If we've seen the header, any subsequent END is not a direct exit
            if (currentId === headerId) {
                foundHeader = true;
                continue;
            }
            
            visited.add(currentId);
            
            const node = this.findNode(currentId);
            if (!node) continue;
            
            // Found END - but only return true if we haven't seen the header first
            if (node.type === 'end') {
                return !foundHeader; // Only direct exit if header wasn't encountered first
            }
            
            // If we hit another decision, don't follow it (too complex)
            if (node.type === 'decision') continue;
            
            // Follow next pointer for simple nodes
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                if (!visited.has(edge.to) && edge.to !== headerId) {
                    queue.push(edge.to);
                }
            }
        }
        
        return false;
    }
    
    buildWhileTrueLoopFromInfo(nodeId, loopInfo, visited, parentAllowedIds = null, activeLoops = new Set()) {
        console.log(`buildWhileTrueLoopFromInfo: nodeId=${nodeId}, bodyNodes=${JSON.stringify(loopInfo.bodyNodes)}, isMultiExit=${loopInfo.metadata?.isMultiExit}`);
        
        const whileLoop = new IRWhile(
            nodeId,
            'True',
            'while_true'
        );
    
        let bodyProgram;

        // Handle multi-exit pattern (from classifyWhileTrueLoop Case 3)
        if (loopInfo.metadata?.isMultiExit && loopInfo.loopEntry) {
            console.log(`  Using multi-exit pattern, loopEntry=${loopInfo.loopEntry}, headerId=${loopInfo.headerId}`);
            const allowedIds = new Set(loopInfo.bodyNodes);
            // Pass treatHeaderAsIfStatement=true so the header is built as an if-statement, not skipped
            // Use loopInfo.headerId as the header, not nodeId (which might be the loopEntry)
            bodyProgram = this.buildLoopBodyFromEntry(loopInfo.headerId, allowedIds, new Set(), loopInfo.loopEntry, activeLoops, null, true);
        } else {
            bodyProgram = new IRProgram();
    
        // IMPORTANT: in while-true loops where the header is a PROCESS node (e.g. "x = not(x)"),
        // the header node itself is part of the loop body and must be emitted.
        const headerNode = this.findNode(nodeId);
        console.log(`  headerNode: ${headerNode?.id}, type=${headerNode?.type}, text=${headerNode?.text}`);
        if (headerNode) {
            let headerStmt = null;
    
            if (headerNode.type === 'process' || headerNode.type === 'var') {
                headerStmt = new IRStatement(nodeId, 'assignment', headerNode.text || '');
            } else if (headerNode.type === 'output') {
                headerStmt = new IRStatement(nodeId, 'print', headerNode.text || '');
            } else if (headerNode.type === 'input') {
                const raw = (headerNode.text || '').trim();
                const compiled = raw.length > 0 ? raw : this.buildInputStatement(headerNode);
                headerStmt = new IRStatement(nodeId, 'input', compiled);
            }
    
            // Only add if it contains real code
            if (headerStmt && (headerStmt.content || '').trim().length > 0) {
                bodyProgram.addStatement(headerStmt);
            }
        }
    
        // Now add the rest of the loop body nodes.
        const allowedIds = new Set(loopInfo.bodyNodes);

        for (const bodyNodeId of loopInfo.bodyNodes) {
            if (bodyNodeId === nodeId) continue;
    
            const nodeIR = this.buildNode(
                bodyNodeId,
                new Set([...visited]),
                allowedIds
            );
    
            if (nodeIR) {
                bodyProgram.addStatement(nodeIR);
            }
        }
    
        // Optional: if you treat exitNodes as "break points" for while_true, keep your current behavior
        if (loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
            bodyProgram.addStatement(new IRBreak(`${nodeId}_break`));
            }
        }

        // If still empty, make it a valid Python block
        if (!bodyProgram.statements || bodyProgram.statements.length === 0) {
            bodyProgram.addStatement(new IRStatement(`${nodeId}_pass`, 'pass', ''));
        }
    
        console.log(`  Final bodyProgram statements:`, JSON.stringify(bodyProgram.statements.map(s => ({id: s.id, type: s.type, statementType: s.statementType, content: s.content}))));
        whileLoop.body = bodyProgram;
    
        // Mark body nodes as visited so they aren't emitted again outside the loop
        for (const bodyNodeId of loopInfo.bodyNodes) {
            visited.add(bodyNodeId);
        }
    
        return whileLoop;
    }
    
    /**
     * Build loop body by starting from entry point and following execution flow
     * This traverses the loop body until we hit back edges to the header
     * @param headerId - The loop header node ID
     * @param allowedIds - Set of node IDs that are part of the loop body
     * @param visited - Set of already visited nodes
     * @param overrideLoopEntry - Optional: explicitly specify the loop entry point (for useNoBranch)
     */
    buildLoopBodyFromEntry(headerId, allowedIds, visited, overrideLoopEntry = null, activeLoops = new Set(), excludeNodeId = null, treatHeaderAsIfStatement = false) {
        const bodyProgram = new IRProgram();
        const seenIds = new Set();
        
        // Get loop entry point - use override if provided, otherwise default to YES branch
        const loopEntry = overrideLoopEntry || this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
        console.log(`buildLoopBodyFromEntry: headerId=${headerId}, loopEntry=${loopEntry}, allowedIds=${JSON.stringify(Array.from(allowedIds))}`);
        
        if (!loopEntry) {
            console.log(`  Early return: loopEntry=null/undefined`);
            return bodyProgram;
        }
        
        // If classification forgot to include the entry, recover instead of returning empty
        // But don't add it if it's the node we want to exclude (e.g., update node in for loops)
        if (!allowedIds.has(loopEntry) && loopEntry !== excludeNodeId) {
            console.warn(`  loopEntry ${loopEntry} missing from allowedIds; auto-adding to prevent empty body`);
            allowedIds.add(loopEntry);
        }
        
        // Use iterative BFS approach to build loop body (similar to old compiler)
        // This prevents infinite recursion from cycles by using a queue instead of recursion
        const queue = [{ id: loopEntry, depth: 0 }];
        // Use a fresh visited set - don't copy from visited parameter to allow nested loops
        const localVisited = new Set();
        const maxDepth = 50; // Safety limit for depth
        const nodeMap = new Map(); // Map nodeId -> nodeIR for linking
        
        while (queue.length > 0) {
            const { id: currentNodeId, depth } = queue.shift();
            
            // Check if it's a nested loop header before skipping
            const node = this.findNode(currentNodeId);
            const isNestedLoop = node && node.type === 'decision' && this.loopClassifications.has(currentNodeId);
            
            // Skip if already processed or too deep (but allow nested loop headers even if in localVisited)
            if (seenIds.has(currentNodeId) || (!isNestedLoop && localVisited.has(currentNodeId))) continue;
            if (depth > maxDepth) continue;
            
            // Check if it's in allowedIds, OR if it's a nested loop header
            // (nested loop headers should be included even if not explicitly in allowedIds)
            if (!allowedIds.has(currentNodeId) && !isNestedLoop) {
                continue;
            }
            
            // IMPORTANT: Skip nodes that are excluded (like increment nodes in for loops)
            // The excludeNodeId parameter is passed from buildForLoopFromInfo to exclude the increment node
            if (excludeNodeId && currentNodeId === excludeNodeId) {
                // Skip this node but continue processing its successors
                const graphNextId = this.getSuccessor(currentNodeId, 'next');
                if (graphNextId && graphNextId !== headerId && !seenIds.has(graphNextId)) {
                    if (allowedIds.has(graphNextId) || this.loopClassifications.has(graphNextId)) {
                        queue.push({ id: graphNextId, depth: depth + 1 });
                    }
                }
                continue;
            }
            
            localVisited.add(currentNodeId);
            seenIds.add(currentNodeId);
            
            // Build the current node without following its next chain recursively
            // We'll handle linking manually
            if (!node) continue;
            
            // Check if it's a loop header (should be handled separately)
            const loopInfo = this.loopClassifications.get(currentNodeId);
            if (loopInfo) {
                // CRITICAL: If this is the same loop header we're currently building, skip it
                // This prevents infinite recursion when a while loop body loops back to its own header
                // EXCEPTION: For while-true multi-exit loops, the header IS part of the body as an if-statement
                if (currentNodeId === headerId && !treatHeaderAsIfStatement) {
                    // This is the same loop - we're done building the body, skip it
                    continue;
                }

                // If treatHeaderAsIfStatement is set for this header, build it as an if-statement, not a loop
                if (currentNodeId === headerId && treatHeaderAsIfStatement) {
                    // Fall through to build as if-statement
                } else {
                
                // Build as loop, but don't follow next chain
                // Use a separate visited set for building nested loops to prevent them from being marked as visited
                // in the outer loop's visited set
                const nestedVisited = new Set();
                const loopIR = this.buildLoopFromClassification(currentNodeId, loopInfo, nestedVisited, allowedIds, activeLoops);
                // Mark as visited and seen AFTER building to prevent duplicate processing
                localVisited.add(currentNodeId);
                seenIds.add(currentNodeId);
                if (loopIR) {
                    bodyProgram.addStatement(loopIR);
                    nodeMap.set(currentNodeId, loopIR);
                    
                    // For nested loops, we need to continue building the outer loop body
                    // after the inner loop completes. Get the loop's exit node.
                    // For for-loops, the exit is in loopInfo.exitNodes
                    // For while-loops, it's the "no" branch
                    let exitNodeId = null;
                    if (loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
                        exitNodeId = loopInfo.exitNodes[0];
                    } else {
                        exitNodeId = this.getSuccessor(currentNodeId, 'no') || this.getSuccessor(currentNodeId, 'false');
                    }
                    
                    // Add exit node to queue if it exists, we haven't seen it, and it's in allowedIds
                    // Note: For for-loops, the increment node is excluded from allowedIds,
                    // so if the exit is the increment, we stop here (the increment is implicit in for-loops)
                    if (exitNodeId && allowedIds.has(exitNodeId) && !seenIds.has(exitNodeId) && !localVisited.has(exitNodeId)) {
                        queue.push({ id: exitNodeId, depth: depth + 1 });
                    }
                    // If exit node is not in allowedIds, it's likely the parent loop's increment
                    // (for for-loops) or exit path, which will be handled by the parent loop's next
                }
                continue;
                }  // end else (not treating header as if-statement)
            }
            
            // Check if it's a decision (if statement)
            if (node.type === 'decision') {
                // Pass headerId to enable break insertion when branches exit the loop
                const ifIR = this.buildIfStatement(currentNodeId, node, localVisited, allowedIds, headerId, activeLoops, new Set());
                if (ifIR) {
                    bodyProgram.addStatement(ifIR);
                    nodeMap.set(currentNodeId, ifIR);
                }
                continue;
            }
            
            // Check if this is a node that should be excluded (like increment nodes in for loops)
            if (excludeNodeId && currentNodeId === excludeNodeId) {
                // Skip this node entirely
                continue;
            }
            
            // Build regular node - DON'T pass localVisited to prevent recursive chain building
            // Use an empty set so buildRegularNode doesn't add nodes to localVisited
            const nodeIR = this.buildRegularNodeNoChain(node);
            if (nodeIR) {
                bodyProgram.addStatement(nodeIR);
                nodeMap.set(currentNodeId, nodeIR);
                
                // Get next from graph
                const graphNextId = this.getSuccessor(currentNodeId, 'next');
                
                // Add next to queue if it's in allowed set OR if it's a nested loop header
                // BUT: Never add the same loop header we're currently building (prevents infinite recursion)
                if (graphNextId && graphNextId !== headerId) {
                    const inSeenIds = seenIds.has(graphNextId);
                    const inLocalVisited = localVisited.has(graphNextId);
                    const isNestedLoopHeader = this.loopClassifications.has(graphNextId);
                    const inAllowedIds = allowedIds.has(graphNextId);
                    // For nested loop headers, ignore localVisited check to ensure they're added to the queue
                    const shouldAdd = !inSeenIds && (!inLocalVisited || isNestedLoopHeader) && (inAllowedIds || isNestedLoopHeader);
                    if (shouldAdd) {
                        queue.push({ id: graphNextId, depth: depth + 1 });
                    }
                }
            }
        }
        
        return bodyProgram;
    }
    
    buildInputStatement(node) {
        const varName = (node.varName || node.var || '').trim() || 'x';
        const dtype = (node.dtype || 'str').trim();

        // Prompt can be stored either as a quoted Python string (e.g. "\"Enter value\"")
        // or as raw text (e.g. Enter value). Support both.
        let prompt = (node.prompt ?? '').toString().trim();

        let promptExpr = '';
        if (prompt.length > 0) {
            const isQuoted =
                (prompt.startsWith('"') && prompt.endsWith('"')) ||
                (prompt.startsWith("'") && prompt.endsWith("'"));

            promptExpr = isQuoted ? prompt : JSON.stringify(prompt);
        }

        const inputCall = promptExpr ? `input(${promptExpr})` : 'input()';

        if (dtype === 'int') return `${varName} = int(${inputCall})`;
        return `${varName} = ${inputCall}`;
    }

    /**
     * Build a regular node WITHOUT following the next chain
     * This is used for BFS-based loop body building where we manually manage the queue
     */
    buildRegularNodeNoChain(node) {
        if (!node) return null;
        
        switch (node.type) {
            case 'process':
            case 'var':
            case 'list':
                return new IRStatement(node.id, 'assignment', node.text || '');
            case 'output':
                return new IRStatement(node.id, 'print', node.text || '');
            case 'input':
                {
                    const raw = (node.text || '').trim();
                    const compiled = raw.length > 0 ? raw : this.buildInputStatement(node);
                    return new IRStatement(node.id, 'input', compiled);
                }
            default:
                return null;
        }
    }


    buildRegularNode(node, visited, allowedIds = null, depth = 0, activeLoops = new Set()) {
        if (!node) return null;
        
        let stmt = null;
        
        switch (node.type) {
            case 'process':
            case 'var':
            case 'list':
                stmt = new IRStatement(node.id, 'assignment', node.text || '');
                break;
            case 'output':
                stmt = new IRStatement(node.id, 'print', node.text || '');
                break;
            case 'input':
                {
                    const raw = (node.text || '').trim();
                    const compiled = raw.length > 0 ? raw : this.buildInputStatement(node);
                    stmt = new IRStatement(node.id, 'input', compiled);
                }
                break;
            default:
                return null;
        }
        
        // Add next connection - but only if next is in allowed set (for loop bodies)
        if (stmt) {
            const next = this.getSuccessor(node.id, 'next');
            if (next && !visited.has(next)) {
                // If we're in a constrained context (loop body), only follow next if it's allowed
                // BUT: for statements that are part of if branches, we want to build them
                // completely even if they lead outside the allowed set (they'll be truncated by addChainToProgram)
                if (allowedIds === null || allowedIds.has(next)) {
                    stmt.next = this.buildNode(next, visited, allowedIds, depth + 1, activeLoops);
                } else {
                    // If next is outside allowedIds, we still want to build it if we're building
                    // a branch of an if statement, because the branch should be complete
                    // But we'll stop following chains when we leave the allowed set
                    // Actually, let's not do this - it will cause issues. Only build if in allowed set.
                }
            }
        }
        
        return stmt;
    }
}

/**
 * BreakManager - Centralized break statement detection and management
 * 
 * This class provides a single source of truth for determining when break
 * statements should be added to loop bodies. It handles all loop types,
 * nested loops, and edge cases consistently.
 */
class BreakManager {
    constructor(nodes, connections, flowAnalysis, outgoingMap, incomingMap) {
        this.nodes = nodes;
        this.connections = connections;
        this.flowAnalysis = flowAnalysis;
        this.outgoingMap = outgoingMap;
        this.incomingMap = incomingMap;
    }
    
    /**
     * Main entry point: Should a break be added to this branch?
     * 
     * @param {string} branchStartId - Node ID where the branch starts
     * @param {string} loopHeaderId - Loop header node ID (null if not in loop)
     * @param {Array<string>} contextStack - Current context stack (for nested loops)
     * @param {string} loopType - Type of loop: 'for', 'while', 'while_true', 'while_else'
     * @param {string} convergencePoint - Convergence point ID (if any)
     * @returns {boolean} - True if break should be added
     */
    shouldAddBreak(branchStartId, loopHeaderId, contextStack, loopType, convergencePoint = null) {
        console.log(`BreakManager.shouldAddBreak(${branchStartId}, ${loopHeaderId}, contextStack=`, contextStack, `, loopType=${loopType}, convergencePoint=${convergencePoint})`);
        // Step 1: Basic checks
        if (!loopHeaderId) {
            console.log(`  Step 1: No loopHeaderId, returning false`);
            return false;      // Must be inside a loop
        }
        if (!branchStartId) {
            console.log(`  Step 1: No branchStartId, returning false`);
            return false;     // Must have a valid branch
        }
    
        // IMPORTANT CHANGE:
        // We NO LONGER veto just because the branch *can* reach the header.
        // Instead we rely on branchReachesEnd, which already ignores paths
        // that return to the header (reachesEndWithoutReturningToHeader).
    
        // Step 2: Does any path from this branch reach END
        // without returning to the loop header?
        const reachesEnd = this.branchReachesEnd(branchStartId, loopHeaderId);
        console.log(`  Step 2: branchReachesEnd(${branchStartId}, ${loopHeaderId}) = ${reachesEnd}`);
        if (!reachesEnd) {
            // No exit path → no break
            console.log(`  Step 2: No exit path, returning false`);
            return false;
        }
    
        // Step 3: Loop-type specific tweaks (keep as a hook)
        if (loopType === 'for') {
            // For loops: "normal" completion falls out via condition,
            // but an early path to END still counts as a valid break.
            // (Nothing extra needed here right now.)
        }
    
        // Step 4: Nested loops — ensure we're not accidentally
        // breaking an outer loop instead of the current one.
        const targetLoop = this.findTargetLoopLevel(branchStartId, contextStack);
        console.log(`  Step 4: findTargetLoopLevel(${branchStartId}) = ${targetLoop}`);
        if (targetLoop && targetLoop !== loopHeaderId) {
            console.log(`  Step 4: Target loop ${targetLoop} !== loopHeaderId ${loopHeaderId}, returning false`);
            return false;
        }
    
        // Step 5: Convergence point check
        if (convergencePoint) {
            const convNode = this.nodes.find(n => n.id === convergencePoint);
            console.log(`  Step 5: convergencePoint=${convergencePoint}, convNode.type=${convNode?.type}`);
            if (convNode && convNode.type === "end") {
                // Convergence IS END → this is clearly an exit
                console.log(`  Step 5: Convergence is END, returning true`);
                return true;
            }
            // Otherwise, fall back to the exit check we already did
            console.log(`  Step 5: Convergence not END, returning branchReachesEnd=${reachesEnd}`);
            return reachesEnd;
        }
    
        // Step 6: All checks passed → add break
        console.log(`  Step 6: All checks passed, returning true`);
        return true;
    }
    
    
    /**
     * Check if branch loops back to header (NOT an exit)
     */
    branchLoopsBackToHeader(branchStartId, loopHeaderId) {
        if (!branchStartId || !loopHeaderId) return false;
        return this.canReach(branchStartId, loopHeaderId, new Set());
    }
    
    /**
     * Check if branch reaches END (is an exit)
     */
    branchReachesEnd(branchStartId, loopHeaderId) {
        if (!branchStartId) return false;
        return this.reachesEndWithoutReturningToHeader(branchStartId, loopHeaderId);
    }
    
    /**
     * Find which loop level this break should exit
     */
    findTargetLoopLevel(branchStartId, contextStack) {
        if (!contextStack || contextStack.length === 0) return null;
        
        // Find all loops in context stack (innermost first)
        const loopHeaders = [];
        for (let i = contextStack.length - 1; i >= 0; i--) {
            const ctx = contextStack[i];
            if (ctx.startsWith('loop_')) {
                loopHeaders.push(ctx.replace('loop_', ''));
            }
        }
        
        // Check which loop this branch actually exits
        // Start from innermost and work outward
        for (const headerId of loopHeaders) {
            // Check if branch exits this loop (reaches END without returning)
            if (this.branchReachesEnd(branchStartId, headerId)) {
                // Check if it loops back to this header
                if (!this.branchLoopsBackToHeader(branchStartId, headerId)) {
                    return headerId; // This is the loop we exit
                }
            }
        }
        
        // No loop found - might exit all loops or not exit any
        return null;
    }
    
    /**
     * Helper: Check if one node can reach another
     */
    canReach(startId, targetId, avoidSet = new Set()) {
        if (startId === targetId) return true;
        
        const visited = new Set();
        const stack = [startId];
        
        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current) || avoidSet.has(current)) continue;
            visited.add(current);
            
            if (current === targetId) return true;
            
            const outgoing = this.outgoingMap.get(current) || [];
            for (const edge of outgoing) {
                stack.push(edge.to);
            }
        }
        
        return false;
    }
    
    /**
     * Helper: Check if path reaches END without returning to header
     */
    reachesEndWithoutReturningToHeader(fromId, headerId) {
        if (!fromId) return false;
        if (fromId === headerId) return false;
        
        const visited = new Set();
        const stack = [fromId];
        let foundHeader = false;
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            // If we come back to the header → not an exit (it's a back edge)
            if (currentId === headerId) {
                foundHeader = true;
                continue; // Skip the header, but mark that we found it
            }
            
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;
            
            // If we reach END → success (exits the loop)
            // BUT: only if we haven't encountered the header first
            if (node.type === 'end') {
                return !foundHeader; // Only exit if header wasn't encountered first
            }
            
            // Follow all successors depending on node type
            if (node.type === 'decision') {
                const y = this.getSuccessor(currentId, 'yes') || this.getSuccessor(currentId, 'true');
                const n = this.getSuccessor(currentId, 'no') || this.getSuccessor(currentId, 'false');
                if (y && !visited.has(y) && y !== headerId) stack.push(y);
                if (n && !visited.has(n) && n !== headerId) stack.push(n);
            } else {
                const next = this.getSuccessor(currentId, 'next');
                if (next && !visited.has(next) && next !== headerId) stack.push(next);
            }
        }
        
        return false;
    }
    
    /**
     * Helper: Get successor node
     */
    getSuccessor(nodeId, port) {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        const edge = outgoing.find(e => e.port === port);
        return edge ? edge.to : null;
    }
}

class FlowchartCompiler {
    constructor(nodes, connections, useHighlighting = false, debugMode = false) {
        this.nodes = nodes;
        this.connections = connections;
        this.useHighlighting = useHighlighting;
        this.debugMode = debugMode;
        
        if (this.debugMode) {
            console.log("[Compiler Debug] Initializing compiler in debug mode");
        }

        // Initialize maps and analysis structures
        this.outgoingMap = new Map();
        this.incomingMap = new Map();
        this.dominators = new Map();
        this.immediateDominator = new Map();
        this.backEdges = [];
        this.loopHeaders = new Set();
        this.naturalLoops = new Map();

        // Skip nodes and for-loop tracking
        this.nodesToSkip = new Set();
        this.forPatternCache = new Map();
        this.forPatternInProgress = new Set();
        this.insertedBreak = false;
        this.loweredImplicitLoops = new Set();
        
        this.buildMaps();
        this.computeDominators();
        this.findBackEdgesAndLoops();

        // Initialize BreakManager for centralized break detection
        this.breakManager = new BreakManager(
            this.nodes,
            this.connections,
            null, // flowAnalysis will be set later if needed
            this.outgoingMap,
            this.incomingMap
        );

        // Initialize implicit loop headers (from old compiler)
        this.implicitLoopHeaders = this.findImplicitForeverLoopHeaders();
        console.log(`FlowchartCompiler: Found ${this.implicitLoopHeaders.size} implicit loop headers:`, Array.from(this.implicitLoopHeaders));

        // Run for-loop detection on all decision nodes
        this.nodes
            .filter(n => n.type === "decision")
            .forEach(dec => {
                const info = this.detectForLoopPattern(dec.id);
                if (info && info.initNodeId) {
                    // Mark init node for skipping if it directly precedes header
                    const incoming = this.incomingMap.get(dec.id) || [];
                    const direct = incoming.some(c => c.sourceId === info.initNodeId);
                    if (direct) this.nodesToSkip.add(info.initNodeId);
                }
            });
    }
    
    buildMaps() {
        this.nodes.forEach(node => {
            this.outgoingMap.set(node.id, []);
            this.incomingMap.set(node.id, []);
        });

        // Port normalization map for different flowchart formats
        const portMap = {
            "true": "yes",
            "false": "no",
            "y": "yes",
            "n": "no",
            "": "next",
            "null": "next",
            "undefined": "next"
        };

        const normPort = (p) => {
            const key = (p ?? "next").toString().trim().toLowerCase();
            return portMap.hasOwnProperty(key) ? portMap[key] : key;
        };

        this.connections.forEach(conn => {
            // Handle different connection field names from various flowchart formats
            const from = conn.from ?? conn.fromId ?? conn.sourceId ?? conn.source;
            const to = conn.to ?? conn.targetId ?? conn.toId ?? conn.target;

            if (!from || !to) return;

            const port = normPort(conn.port ?? conn.fromPort ?? conn.label);

            if (this.outgoingMap.has(from)) {
                this.outgoingMap.get(from).push({ to, port });
            }
            if (this.incomingMap.has(to)) {
                this.incomingMap.get(to).push({ from, port });
            }
        });
    }

    /**
     * Compute dominators using iterative dataflow analysis
     * Node D dominates node N if every path from Start to N must go through D
     */
    computeDominators() {
        const startNode = this.nodes.find(n => n.type === 'start');
        if (!startNode) return;

        const allNodeIds = this.nodes.map(n => n.id);
        const startId = startNode.id;

        // Initialize dominator sets
        this.dominators.clear();

        // All nodes except start: dominated by all nodes initially
        const allNodesSet = new Set(allNodeIds);
        for (const nodeId of allNodeIds) {
            if (nodeId === startId) {
                this.dominators.set(nodeId, new Set([startId])); // Start dominates only itself
            } else {
                this.dominators.set(nodeId, new Set(allNodesSet)); // All nodes initially
            }
        }

        // Iterative fixed-point algorithm
        let changed = true;
        while (changed) {
            changed = false;

            // Process nodes in reverse post-order would be better, but simple iteration works
            for (const nodeId of allNodeIds) {
                if (nodeId === startId) continue;

                const predecessors = (this.incomingMap.get(nodeId) || []).map(conn => conn.from || conn.sourceId);
                if (predecessors.length === 0) continue;

                // Intersection of dominators of all predecessors
                let newDomSet = null;
                for (const pred of predecessors) {
                    const predDoms = this.dominators.get(pred);
                    if (!predDoms) continue;

                    if (newDomSet === null) {
                        newDomSet = new Set(predDoms);
                    } else {
                        // Intersection: keep only nodes in both sets
                        for (const dom of newDomSet) {
                            if (!predDoms.has(dom)) {
                                newDomSet.delete(dom);
                            }
                        }
                    }
                }

                if (newDomSet) {
                    // Node always dominates itself
                    newDomSet.add(nodeId);

                    // Check if changed
                    const oldDomSet = this.dominators.get(nodeId);
                    if (!this.setsEqual(oldDomSet, newDomSet)) {
                        this.dominators.set(nodeId, newDomSet);
                        changed = true;
                    }
                }
            }
        }

        // Compute immediate dominators
        this.computeImmediateDominators(startId);
    }

    /**
     * Helper to compare two sets
     */
    setsEqual(setA, setB) {
        if (setA.size !== setB.size) return false;
        for (const item of setA) {
            if (!setB.has(item)) return false;
        }
        return true;
    }

    /**
     * Compute immediate dominator (the unique dominator that is closest to the node)
     */
    computeImmediateDominators(startId) {
        this.immediateDominator.clear();

        // Start node has no immediate dominator
        this.immediateDominator.set(startId, null);

        for (const [nodeId, domSet] of this.dominators) {
            if (nodeId === startId) continue;

            // Get strict dominators (excluding self)
            const strictDoms = new Set(domSet);
            strictDoms.delete(nodeId);

            if (strictDoms.size === 0) {
                this.immediateDominator.set(nodeId, null);
                continue;
            }

            // Find immediate dominator:
            // The strict dominator that is not dominated by any other strict dominator
            let idom = null;
            const strictDomArray = Array.from(strictDoms);

            for (let i = 0; i < strictDomArray.length; i++) {
                const candidate = strictDomArray[i];
                let isIDom = true;

                for (let j = 0; j < strictDomArray.length; j++) {
                    if (i === j) continue;
                    const other = strictDomArray[j];
                    const otherDoms = this.dominators.get(other);
                    if (otherDoms && otherDoms.has(candidate)) {
                        // 'candidate' is dominated by 'other', so not immediate
                        isIDom = false;
                        break;
                    }
                }

                if (isIDom) {
                    idom = candidate;
                    break;
                }
            }

            this.immediateDominator.set(nodeId, idom);
        }
    }

    /**
     * Find back edges and identify natural loops
     * Back edge definition: edge X → Y where Y dominates X
     * Loop header: The target of a back edge (Y)
     */
    findBackEdgesAndLoops() {
        this.backEdges = [];
        this.loopHeaders.clear();
        this.naturalLoops.clear();

        // Find all back edges
        for (const node of this.nodes) {
            const outgoing = this.outgoingMap.get(node.id) || [];

            for (const edge of outgoing) {
                const fromId = node.id;
                const toId = edge.to;

                // Check if 'toId' dominates 'fromId'
                const fromDoms = this.dominators.get(fromId);
                if (fromDoms && fromDoms.has(toId)) {
                    // ✅ ADD: Don't mark non-decision nodes as loop headers
                    const toNode = this.nodes.find(n => n.id === toId);
                    if (toNode && toNode.type !== "decision") {
                        continue; // Skip - only decision nodes can be loop headers
                    }

                    // Back edge found: fromId → toId where toId dominates fromId
                    this.backEdges.push({from: fromId, to: toId, port: edge.port});
                    this.loopHeaders.add(toId);

                    console.log(`Back edge: ${fromId} → ${toId} (${edge.port}), Loop header: ${toId}`);
                }
            }
        }

        // Compute natural loop for each back edge
        for (const backEdge of this.backEdges) {
            const loopNodes = this.computeNaturalLoop(backEdge.from, backEdge.to);
            this.naturalLoops.set(backEdge.to, loopNodes);
            console.log(`Loop header ${backEdge.to} contains: ${Array.from(loopNodes).join(', ')}`);
        }
    }

    /**
     * Compute natural loop for a back edge X → Y
     * The loop consists of Y plus all nodes that can reach X without passing through Y
     */
    computeNaturalLoop(backEdgeFrom, backEdgeTo) {
        const loopNodes = new Set([backEdgeTo, backEdgeFrom]);
        const stack = [backEdgeFrom];
        const visited = new Set([backEdgeTo]); // Don't pass through header

        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current)) continue;
            visited.add(current);

            loopNodes.add(current);

            // Add predecessors (except the header)
            const predecessors = (this.incomingMap.get(current) || []).map(conn => conn.from || conn.sourceId);
            for (const pred of predecessors) {
                if (pred !== backEdgeTo && !visited.has(pred)) {
                    stack.push(pred);
                }
            }
        }

        return loopNodes;
    }

    /**
     * Normalize graph structure (rebuild maps and recompute dominators)
     */
    normalizeGraph() {
        this.buildMaps();

        // CRITICAL: loop analysis must match the edited graph
        this.computeDominators();
        this.findBackEdgesAndLoops();
    }

    /**
     * Find implicit forever loop headers (non-decision nodes that are loop headers)
     */
    findImplicitForeverLoopHeaders() {
        const headers = new Set();
        const visited = new Set();
        const onStack = new Set();

        // First, identify all decision-controlled loops to exclude their nodes
        // BUT: Skip decisions that have breaks to END (they're part of while-true loops, not decision loops)
        const decisionLoopNodes = new Set();
        console.log(`findImplicitForeverLoopHeaders: Checking decision-controlled loops...`);
        for (const node of this.nodes) {
            if (node.type === "decision") {
                const yesId = this.getSuccessor(node.id, 'yes');
                const noId = this.getSuccessor(node.id, 'no');

                // Check if this decision is a loop header (one branch loops back)
                const yesLoops = yesId ? this.canReach(yesId, node.id, new Set()) : false;
                const noLoops = noId ? this.canReach(noId, node.id, new Set()) : false;

                if (yesLoops || noLoops) {
                    console.log(`findImplicitForeverLoopHeaders: Decision ${node.id} has loop: yesLoops=${yesLoops}, noLoops=${noLoops}`);
                    // Check if the looping branch has breaks to END
                    // If it does, this is part of a while-true loop, not a decision-controlled loop
                    const loopingBranchId = yesLoops ? yesId : noId;
                    const exitBranchId = yesLoops ? noId : yesId;
                    
                    // Find what node the back edge goes to
                    const avoidSet = new Set([node.id]);
                    const backEdgeTarget = this.findNodeInCycle(loopingBranchId, node.id, avoidSet);
                    console.log(`findImplicitForeverLoopHeaders: Decision ${node.id} back edge target: ${backEdgeTarget}`);
                    
                    // If back edge goes to a process/var node and decision has breaks, it's a while-true loop
                    let hasBreaksToEnd = false;
                    if (backEdgeTarget) {
                        const targetNode = this.nodes.find(n => n.id === backEdgeTarget);
                        if (targetNode && (targetNode.type === 'process' || targetNode.type === 'var')) {
                            // Check if decision has breaks to END - use pathLeadsTo to check if branches reach END
                            const endNode = this.nodes.find(n => n.type === 'end');
                            const endNodeId = endNode ? endNode.id : null;
                            const yesBreaks = yesId && endNodeId && this.pathLeadsTo(yesId, endNodeId);
                            const noBreaks = noId && endNodeId && this.pathLeadsTo(noId, endNodeId);
                            hasBreaksToEnd = yesBreaks || noBreaks;
                            console.log(`findImplicitForeverLoopHeaders: Decision ${node.id} has breaks: yesBreaks=${yesBreaks}, noBreaks=${noBreaks}, hasBreaksToEnd=${hasBreaksToEnd}`);
                        }
                    }
                    
                    // Only mark as decision-controlled loop if it doesn't have breaks to END
                    // (If it has breaks, it's a while-true loop with the process node as header)
                    if (!hasBreaksToEnd) {
                        console.log(`findImplicitForeverLoopHeaders: Decision ${node.id} marked as decision-controlled loop`);
                        // This is a decision-controlled loop - mark all nodes in its loop body
                        const loopBodyId = yesLoops ? yesId : noId;
                        if (loopBodyId) {
                            // Mark all nodes reachable from loop body that eventually loop back
                            this.markLoopBodyNodes(loopBodyId, node.id, decisionLoopNodes);
                        }
                    } else {
                        console.log(`findImplicitForeverLoopHeaders: Decision ${node.id} has breaks, NOT marking as decision-controlled loop`);
                    }
                }
            }
        }
        console.log(`findImplicitForeverLoopHeaders: Decision-controlled loop nodes:`, Array.from(decisionLoopNodes));

        const dfs = (nodeId) => {
            visited.add(nodeId);
            onStack.add(nodeId);

            const outgoing = this.outgoingMap.get(nodeId) || [];

            for (const edge of outgoing) {
                const target = edge.to;

                if (!visited.has(target)) {
                    dfs(target);
                } else if (onStack.has(target)) {
                    // BACK EDGE detected: nodeId -> target
                    const fromNode = this.nodes.find(n => n.id === nodeId);
                    const toNode = this.nodes.find(n => n.id === target);

                    if (!fromNode || !toNode) {
                        console.log(`findImplicitForeverLoopHeaders: Back edge ${nodeId} -> ${target}, but nodes not found`);
                        continue;
                    }

                    console.log(`findImplicitForeverLoopHeaders: Back edge detected ${nodeId} (${fromNode.type}) -> ${target} (${toNode.type})`);

                    // Ignore if the TARGET (loop header) is a decision
                    if (toNode.type === "decision") {
                        console.log(`findImplicitForeverLoopHeaders: Target ${target} is a decision, skipping`);
                        continue;
                    }

                    // Ignore if target is part of a decision-controlled loop
                    if (decisionLoopNodes.has(target)) {
                        console.log(`findImplicitForeverLoopHeaders: Target ${target} is part of decision-controlled loop, skipping`);
                        continue;
                    }

                    // For flowchart 45 pattern: if target is a process node and back edge comes from a decision,
                    // but the decision has breaks to END, we still want to detect it as an implicit loop
                    // Check if the decision that creates the back edge has breaks to END
                    let shouldInclude = true;
                    if (fromNode.type === "decision") {
                        // Check if this decision has breaks to END
                        // We check if either branch reaches END (not checking for return to target, since target is the loop header, not the decision)
                        const fromYesId = this.getSuccessor(fromNode.id, 'yes');
                        const fromNoId = this.getSuccessor(fromNode.id, 'no');
                        
                        // Check if branches reach END (simple check - does the branch eventually reach an END node?)
                        // Find END node ID first
                        const endNode = this.nodes.find(n => n.type === 'end');
                        const endNodeId = endNode ? endNode.id : null;
                        const fromYesBreaks = fromYesId && endNodeId && this.pathLeadsTo(fromYesId, endNodeId);
                        const fromNoBreaks = fromNoId && endNodeId && this.pathLeadsTo(fromNoId, endNodeId);
                        
                        console.log(`findImplicitForeverLoopHeaders: Back edge ${fromNode.id} -> ${target}, fromYesBreaks=${fromYesBreaks}, fromNoBreaks=${fromNoBreaks}`);
                        
                        // If the decision doesn't have breaks, it's a regular decision loop - skip
                        // If it has breaks, it's part of a while True loop - include it
                        if (!fromYesBreaks && !fromNoBreaks) {
                            shouldInclude = false;
                            console.log(`findImplicitForeverLoopHeaders: Decision ${fromNode.id} has no breaks, skipping implicit loop at ${target}`);
                        } else {
                            console.log(`findImplicitForeverLoopHeaders: Decision ${fromNode.id} has breaks, including implicit loop at ${target}`);
                        }
                    }
                    
                    if (shouldInclude) {
                        // non-decision header = implicit forever loop
                        console.log(`findImplicitForeverLoopHeaders: Adding ${target} as implicit loop header`);
                        headers.add(target);
                    }
                }
            }

            onStack.delete(nodeId);
        };

        const start = this.nodes.find(n => n.type === "start");
        if (start) dfs(start.id);

        return headers;
    }

    /**
     * Mark all nodes in a decision-controlled loop body
     */
    markLoopBodyNodes(startId, loopHeaderId, markedSet, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return;

        visited.add(startId);
        markedSet.add(startId);

        const outgoing = this.outgoingMap.get(startId) || [];
        for (const edge of outgoing) {
            // If this edge goes back to the loop header, stop here
            if (edge.to === loopHeaderId) continue;

            // Otherwise, continue marking
            this.markLoopBodyNodes(edge.to, loopHeaderId, markedSet, new Set([...visited]));
        }
    }

    /**
     * Check if a path exists from startId to targetId without passing through avoidSet
     */
    canReach(startId, targetId, avoidSet = new Set()) {
        if (startId === targetId) return true;

        const visited = new Set();
        const stack = [startId];

        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current) || avoidSet.has(current)) continue;
            visited.add(current);

            if (current === targetId) return true;

            const outgoing = this.outgoingMap.get(current) || [];
            for (const edge of outgoing) {
                stack.push(edge.to);
            }
        }

        return false;
    }

    /**
     * Check if a path exists from startId to targetId
     */
    pathExists(startId, targetId, visited = new Set()) {
        if (startId === targetId) return true;
        if (visited.has(startId)) return false;
        visited.add(startId);

        const outgoing = this.outgoingMap.get(startId) || [];
        for (const edge of outgoing) {
            if (this.pathExists(edge.to, targetId, visited)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a path from startId eventually leads to targetId
     * @param startId - Starting node ID
     * @param targetId - Target node ID
     * @param visited - Set of visited nodes (to prevent cycles)
     */
    pathLeadsTo(startId, targetId, visited = new Set()) {
        if (!startId || visited.has(startId)) return false;
        if (startId === targetId) return true;
        
        visited.add(startId);
        
        const outgoing = this.outgoingMap.get(startId) || [];
        for (const edge of outgoing) {
            if (this.pathLeadsTo(edge.to, targetId, new Set(visited))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Detect for loop pattern (increasing and decreasing)
     * Supports: i = 0 / i < end / i = i + k patterns
     */
    detectForLoopPattern(decisionId) {
        // cache already computed answers
        if (this.forPatternCache.has(decisionId)) {
            return this.forPatternCache.get(decisionId);
        }

        // prevent re-entry recursion explosions
        if (this.forPatternInProgress.has(decisionId)) {
            return null;
        }

        this.forPatternInProgress.add(decisionId);

        const decisionNode = this.nodes.find(n => n.id === decisionId);
        if (!decisionNode || !decisionNode.text) {
            this.forPatternInProgress.delete(decisionId);
            return null;
        }

        // Extract variable name from decision condition
        let varName = null;
        const condMatch = decisionNode.text.match(/^\s*(\w+)\s*[<>=!]/);
        if (!condMatch) {
            this.forPatternInProgress.delete(decisionId);
            return null;
        }
        varName = condMatch[1];

        let initNode = null;
        let startValue = null;

        // Search for initialization
        for (const node of this.nodes) {
            if (node.type === "var" || node.type === "process") {
                const m = node.text?.match(new RegExp(`^\\s*${varName}\\s*=\\s*([\\w\\d_]+)\\s*$`));
                if (m) {
                    if (this.pathExists(node.id, decisionId, new Set())) {
                        initNode = node;
                        startValue = m[1];
                        break;
                    }
                }
            }
        }

        if (!initNode || !startValue) {
            this.forPatternInProgress.delete(decisionId);
            this.forPatternCache.set(decisionId, null);
            return null;
        }

        // Parse loop condition
        const condition = decisionNode.text.trim();
        let endValue = null;
        let comparisonOp = null;

        const condPatterns = [
            { re: new RegExp(`${varName}\\s*<\\s*([\\w\\d_]+)`), op: '<'  },
            { re: new RegExp(`${varName}\\s*<=\\s*([\\w\\d_]+)`), op: '<=' },
            { re: new RegExp(`${varName}\\s*>\\s*([\\w\\d_]+)`), op: '>'  },
            { re: new RegExp(`${varName}\\s*>=\\s*([\\w\\d_]+)`), op: '>=' },
        ];

        for (const p of condPatterns) {
            const m = condition.match(p.re);
            if (m) {
                endValue = m[1];
                comparisonOp = p.op;
                break;
            }
        }

        if (!endValue) {
            this.forPatternInProgress.delete(decisionId);
            this.forPatternCache.set(decisionId, null);
            return null;
        }

        // Find increment in loop body
        const yesId = this.getSuccessor(decisionId, 'yes');
        const incrementInfo = this.findIncrementNodeBFS(yesId, decisionId, varName);

        if (!incrementInfo) {
            this.forPatternInProgress.delete(decisionId);
            this.forPatternCache.set(decisionId, null);
            return null;
        }

        let step = incrementInfo.step || 1;
        const incId = incrementInfo.node.id;

        // Check if increment is on main path
        const loopBodyId = this.getSuccessor(decisionId, 'yes');
        const mainPath = this.findMainExecutionPath(loopBodyId, decisionId);
        if (!mainPath || !mainPath.includes(incId)) {
            this.forPatternInProgress.delete(decisionId);
            this.forPatternCache.set(decisionId, null);
            return null;
        }

        // Handle increasing vs decreasing loops
        let finalStart = startValue;
        let finalEnd = endValue;
        let finalStep = step;

        if (comparisonOp === '>' || comparisonOp === '>=') {
            finalStep = -Math.abs(step);
            const isLiteralInteger = /^\d+$/.test(endValue.trim());
            if (comparisonOp === '>') {
                finalEnd = isLiteralInteger ? `${parseInt(endValue) - 1}` : endValue;
            } else if (comparisonOp === '>=') {
                finalEnd = isLiteralInteger ? `${parseInt(endValue) - 2}` : `(${endValue}) - 1`;
            }
        } else {
            finalStep = Math.abs(step);
            const isLiteralInteger = /^\d+$/.test(endValue.trim());
            if (comparisonOp === '<') {
                finalEnd = isLiteralInteger ? `${parseInt(endValue) + 1}` : endValue;
            } else if (comparisonOp === '<=') {
                finalEnd = isLiteralInteger ? `${parseInt(endValue) + 2}` : `(${endValue}) + 1`;
            }
        }

        this.forPatternInProgress.delete(decisionId);

        const result = {
            variable: varName,
            start: finalStart,
            end: finalEnd,
            step: finalStep,
            incrementNodeId: incId,
            initNodeId: initNode?.id ?? null
        };

        this.forPatternCache.set(decisionId, result);
        return result;
    }
    
    /**
     * Get loop type for a given loop header ID
     */
    getLoopType(loopHeaderId) {
        if (!loopHeaderId) return null;
        
        // Check if it's a for loop
        const forInfo = this.detectForLoopPattern(loopHeaderId);
        if (forInfo) {
            return 'for';
        }
        
        // Check loop analysis (from analyzeLoopStructure)
        // This is called during compileLoop, so we might not have it yet
        // For now, check if loop has breaks to determine while-else
        const hasBreaks = this.checkForBreakToEnd(this.getLoopBodyId(loopHeaderId), loopHeaderId);
        const exitId = this.getLoopExitId(loopHeaderId);
        
        if (hasBreaks && exitId) {
            const isNormalExit = this.isNormalExitPath(exitId, loopHeaderId);
            if (isNormalExit) {
                return 'while_else'; // Has breaks and normal exit -> while-else
            }
        }
        
        // Check if it's a while-true loop (from loop analysis)
        // For now, default to simple while
        // TODO: Integrate with loop analysis when available
        return 'while';
    }
    
    /**
     * Helper: Get loop body ID for a loop header
     */
    getLoopBodyId(loopHeaderId) {
        const loopInfo = this.getLoopInfo(loopHeaderId);
        return loopInfo ? loopInfo.bodyId : null;
    }
    
    /**
     * Helper: Get loop exit ID for a loop header
     */
    getLoopExitId(loopHeaderId) {
        const loopInfo = this.getLoopInfo(loopHeaderId);
        return loopInfo ? loopInfo.exitId : null;
    }

    /**
     * Find increment node using BFS
     */
    findIncrementNodeBFS(startId, stopId, varName) {
        const queue = [{ nodeId: startId, visited: new Set() }];

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.nodeId === stopId || current.visited.has(current.nodeId)) {
                continue;
            }

            current.visited.add(current.nodeId);

            const node = this.nodes.find(n => n.id === current.nodeId);
            if (node) {
                let incrementMatch = node.text.match(new RegExp(`^\\s*${varName}\\s*=\\s*${varName}\\s*([+-])\\s*(\\d+)\\s*$`));
                if (incrementMatch && (node.type === 'process' || node.type === 'var')) {
                    const op = incrementMatch[1];
                    const step = parseInt(incrementMatch[2]);
                    return {
                        node: node,
                        step: step,
                        isDecrement: op === '-'
                    };
                }

                incrementMatch = node.text.match(new RegExp(`^\\s*${varName}\\s*([+-])=\\s*(\\d+)\\s*$`));
                if (incrementMatch && (node.type === 'process' || node.type === 'var')) {
                    const op = incrementMatch[1];
                    const step = parseInt(incrementMatch[2]);
                    return {
                        node: node,
                        step: step,
                        isDecrement: op === '-'
                    };
                }
            }

            const nextId = this.getSuccessor(current.nodeId, 'next');
            if (nextId && !current.visited.has(nextId)) {
                queue.push({
                    nodeId: nextId,
                    visited: new Set([...current.visited])
                });
            }

            if (node && node.type === 'decision') {
                const yesId = this.getSuccessor(current.nodeId, 'yes');
                if (yesId && !current.visited.has(yesId)) {
                    queue.push({
                        nodeId: yesId,
                        visited: new Set([...current.visited])
                    });
                }
                const noId = this.getSuccessor(current.nodeId, 'no');
                if (noId && !current.visited.has(noId)) {
                    queue.push({
                        nodeId: noId,
                        visited: new Set([...current.visited])
                    });
                }
            }
        }

        return null;
    }

    /**
     * Find the main execution path (DFS, prefer straight line over branches)
     */
    findMainExecutionPath(startId, targetId, visited = new Set()) {
        if (!startId || visited.has(startId)) return null;
        if (startId === targetId) return [startId];

        visited.add(startId);

        const outgoing = this.outgoingMap.get(startId) || [];

        // First try "next" connections
        for (const edge of outgoing) {
            if (edge.port === 'next') {
                const path = this.findMainExecutionPath(edge.to, targetId, new Set([...visited]));
                if (path) {
                    return [startId, ...path];
                }
            }
        }

        // Then try other connections
        for (const edge of outgoing) {
            if (edge.port !== 'next') {
                const path = this.findMainExecutionPath(edge.to, targetId, new Set([...visited]));
                if (path) {
                    return [startId, ...path];
                }
            }
        }

        return null;
    }

    /**
     * Find alternative paths within loop body only (ignore exit paths)
     */
    findAlternativePathsWithinLoopBody(startId, targetId, mustIncludeId, exitId, visited = new Set(), currentPath = []) {
        if (!startId || visited.has(startId)) return [];

        if (startId === exitId) {
            return [];
        }

        if (startId === targetId) {
            if (!currentPath.includes(mustIncludeId) && !currentPath.includes(targetId)) {
                return [[...currentPath, startId]];
            }
            return [];
        }

        visited.add(startId);
        const newPath = [...currentPath, startId];
        const alternatives = [];

        const outgoing = this.outgoingMap.get(startId) || [];
        for (const edge of outgoing) {
            if (edge.to === exitId) continue;

            const paths = this.findAlternativePathsWithinLoopBody(edge.to, targetId, mustIncludeId, exitId, new Set([...visited]), newPath);
            alternatives.push(...paths);
        }

        return alternatives;
    }

    /**
     * Find early exits (paths that go to END without returning to loop header)
     */
    findEarlyExits(startId, loopHeaderId) {
        const exits = [];
        const stack = [{ nodeId: startId, path: [] }];
        const visited = new Set();

        while (stack.length > 0) {
            const current = stack.pop();
            const nodeId = current.nodeId;

            if (visited.has(nodeId) || nodeId === loopHeaderId) continue;
            visited.add(nodeId);

            const node = this.nodes.find(n => n.id === nodeId);
            if (!node) continue;

            if (node.type === 'end') {
                exits.push([...current.path, nodeId]);
                continue;
            }

            const outgoing = this.outgoingMap.get(nodeId) || [];
            for (const edge of outgoing) {
                stack.push({
                    nodeId: edge.to,
                    path: [...current.path, nodeId]
                });
            }
        }

        return exits;
    }
    
    getSuccessor(nodeId, port = 'next') {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        const conn = outgoing.find(c => c.port === port);
        return conn ? conn.to : null;
    }
    
    /**
     * Get all successors of a node
     */
    getAllSuccessors(nodeId) {
        const outgoing = this.outgoingMap.get(nodeId) || [];
        return outgoing.map(e => ({ nodeId: e.to, port: e.port }));
    }

    /**
     * Check if node is a loop header
     */
    isLoopHeader(nodeId) {
        return this.loopHeaders.has(nodeId);
    }

    /**
     * Get loop information for a loop header
     */
    getLoopInfo(headerId) {
        // Find back edges to this header
        const backEdges = this.backEdges.filter(edge => edge.to === headerId);
        if (backEdges.length === 0) return null;

        const backEdge = backEdges[0];
        const yesId = this.getSuccessor(headerId, 'yes');
        const noId = this.getSuccessor(headerId, 'no');

        let loopBodyId = null;
        let exitId = null;
        let useNoBranch = false;

        // Check which branch contains the back edge
        if (yesId && this.canReach(yesId, backEdge.from, new Set([headerId]))) {
            loopBodyId = yesId;
            exitId = noId;
            useNoBranch = false;
        } else if (noId && this.canReach(noId, backEdge.from, new Set([headerId]))) {
            loopBodyId = noId;
            exitId = yesId;
            useNoBranch = true;
        }

        if (loopBodyId) {
            return {
                bodyId: loopBodyId,
                exitId: exitId,
                useNoBranch: useNoBranch,
                backEdgeFrom: backEdge.from
            };
        }

        return null;
    }

    /**
     * Analyze loop structure to determine compilation strategy
     */
    analyzeLoopStructure(headerId, bodyId, exitId, useNoBranch) {
        const analysis = {
            recommendedType: 'simple_while', // default
            complexity: 'simple',
            hasMultipleExits: false,
            hasNestedLoops: false,
            exitConditionCount: 0
        };

        // Check if loop body contains break-to-END exits
        const hasBreakToEnd = this.checkForBreakToEnd(bodyId, headerId);

        // Count decision nodes in loop body (complexity indicator)
        const bodyDecisions = this.countDecisionsInLoop(bodyId, headerId);

        // Check for nested loops
        analysis.hasNestedLoops = this.detectNestedLoopsInBody(bodyId, headerId);

        // Count potential exit conditions
        analysis.exitConditionCount = this.countExitConditions(bodyId, headerId);

        // Analyze exit path complexity
        if (exitId) {
            const exitComplexity = this.analyzePathComplexity(exitId, headerId);
            analysis.exitComplexity = exitComplexity;
        }

        // Decision logic: 
        // Key distinction: while-else vs while True with breaks
        // - while-else: Has breaks inside loop body, but exitId is a NORMAL exit (else clause)
        // - while True with breaks: Has breaks, and exitId is ALSO a break path (decision that breaks)
        // 
        // Examples:
        // - atm.json: breaks inside (guess == pin), but exitId (n35) is normal exit -> while-else
        // - flowchart 45: breaks inside (count == 5), and exitId (n5) is another decision that breaks -> while True

        if (!exitId && !hasBreakToEnd) {
            // No exit condition at all - must be infinite
            analysis.recommendedType = 'while_true_simple';
            analysis.complexity = 'simple';
        } else if (hasBreakToEnd && exitId) {
            // Check if exitId is a normal exit (while-else) or a break path (while True)
            const isNormalExit = this.isNormalExitPath(exitId, headerId);
            
            if (isNormalExit) {
                // Loop has breaks AND a normal exit path (else clause) - use while-else pattern
                // This is the correct pattern for loops like atm.json
                analysis.recommendedType = 'simple_while';
                analysis.complexity = 'simple';
            } else {
                // Loop has breaks, and exitId is also a break path (decision that breaks)
                // This is the correct pattern for multi-exit loops like flowchart 45
                analysis.recommendedType = 'while_true_with_breaks';
                analysis.complexity = 'complex';
            }
        } else if (hasBreakToEnd && !exitId) {
            // Loop body has paths that break to END but no exit path - use while True with breaks
            // This is the correct pattern for multi-exit loops like flowchart 45
            analysis.recommendedType = 'while_true_with_breaks';
            analysis.complexity = 'complex';
        } else if (analysis.hasNestedLoops && analysis.exitConditionCount > 4) {
            // Very complex nested structure with many exit points
            analysis.recommendedType = 'while_true_with_breaks';
            analysis.complexity = 'complex';
        } else {
            // Use the flowchart's loop condition - it's there for a reason!
            analysis.recommendedType = 'simple_while';
            analysis.complexity = 'simple';
        }

        console.log(`Loop analysis for ${headerId}:`, analysis);
        return analysis;
    }

    /**
     * Check if loop body contains any paths that break to END
     */
    checkForBreakToEnd(startId, loopHeaderId) {
        const stack = [startId];
        const visited = new Set();

        while (stack.length > 0) {
            const currentId = stack.pop();
            if (visited.has(currentId) || currentId === loopHeaderId) continue;
            visited.add(currentId);

            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;

            // Check if this node goes directly to END
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                const targetNode = this.nodes.find(n => n.id === edge.to);
                if (targetNode && targetNode.type === 'end') {
                    return true;
                }
                stack.push(edge.to);
            }
        }

        return false;
    }

    /**
     * Check if exitId is a normal exit path (leads to END but is the else clause)
     * vs a break path (decision that also breaks to END)
     * Returns true if exitId is a normal exit (not a break), false if it's a break path
     * 
     * Key distinction:
     * - Normal exit: exitId is a non-decision node (output/process) that leads to END (else clause)
     * - Break path: exitId is a decision node where at least one branch breaks to END
     */
    isNormalExitPath(exitId, loopHeaderId) {
        if (!exitId) return false;
        
        const exitNode = this.nodes.find(n => n.id === exitId);
        if (!exitNode) return false;
        
        // If exitId is a decision node, check if it also breaks to END
        // If it does, it's not a normal exit - it's part of the break pattern
        if (exitNode.type === 'decision') {
            // Check if this decision's branches also break to END
            const yesId = this.getSuccessor(exitId, 'yes');
            const noId = this.getSuccessor(exitId, 'no');
            const yesBreaks = yesId && this.reachesEndWithoutReturningToHeader(yesId, loopHeaderId);
            const noBreaks = noId && this.reachesEndWithoutReturningToHeader(noId, loopHeaderId);
            
            // If at least one branch breaks to END, it's part of the break pattern, not a normal exit
            // This handles flowchart 45 where exitId (n5) is a decision that breaks
            if (yesBreaks || noBreaks) {
                return false; // This is a break path, not a normal exit
            }
        }
        
        // If exitId is not a decision, or is a decision where no branches break,
        // and it leads to END, it's a normal exit (else clause)
        // This handles atm.json where exitId (n35) is an output node -> END
        return this.reachesEndWithoutReturningToHeader(exitId, loopHeaderId);
    }

    /**
     * Count decision nodes within a loop body
     */
    countDecisionsInLoop(startId, loopHeaderId, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return 0;

        visited.add(startId);
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return 0;

        let count = node.type === 'decision' ? 1 : 0;

        const successors = this.getSuccessors(startId);
        for (const succId of successors) {
            count += this.countDecisionsInLoop(succId, loopHeaderId, new Set([...visited]));
        }

        return count;
    }

    /**
     * Detect if loop body contains nested loops
     */
    detectNestedLoopsInBody(startId, loopHeaderId, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return false;

        visited.add(startId);
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return false;

        // Check if this node is a loop header (but not the current one)
        if (this.loopHeaders.has(startId) && startId !== loopHeaderId) {
            return true;
        }

        const successors = this.getSuccessors(startId);
        for (const succId of successors) {
            if (this.detectNestedLoopsInBody(succId, loopHeaderId, new Set([...visited]))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Count potential exit conditions in loop body
     */
    countExitConditions(startId, loopHeaderId, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return 0;

        visited.add(startId);
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return 0;

        let count = 0;

        // Count nodes that lead to END (potential exits)
        if (this.leadsToEnd(startId, loopHeaderId, new Set())) {
            count++;
        }

        const successors = this.getSuccessors(startId);
        for (const succId of successors) {
            count += this.countExitConditions(succId, loopHeaderId, new Set([...visited]));
        }

        return count;
    }

    /**
     * Check if a path leads to END without returning to loop header
     */
    leadsToEnd(startId, loopHeaderId, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return false;

        visited.add(startId);
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return false;

        if (node.type === 'end') return true;

        const successors = this.getSuccessors(startId);
        for (const succId of successors) {
            if (this.leadsToEnd(succId, loopHeaderId, new Set([...visited]))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Analyze complexity of a path
     */
    analyzePathComplexity(startId, loopHeaderId, visited = new Set()) {
        if (!startId || visited.has(startId) || startId === loopHeaderId) return 'simple';

        visited.add(startId);
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return 'simple';

        let complexity = 'simple';
        const successors = this.getSuccessors(startId);

        if (successors.length > 1) complexity = 'branching';
        if (node.type === 'decision') complexity = 'complex';

        for (const succId of successors) {
            const subComplexity = this.analyzePathComplexity(succId, loopHeaderId, new Set([...visited]));
            if (subComplexity === 'complex' ||
                (subComplexity === 'branching' && complexity === 'simple')) {
                complexity = 'complex';
            } else if (subComplexity === 'branching' && complexity === 'simple') {
                complexity = 'branching';
            }
        }

        return complexity;
    }

    /**
     * Get all successors of a node (returns array of node IDs)
     */
    getSuccessors(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return [];

        if (node.type === "decision") {
            return [this.getSuccessor(nodeId, "yes"), this.getSuccessor(nodeId, "no")].filter(Boolean);
        }
        return [this.getSuccessor(nodeId, "next")].filter(Boolean);
    }

    /**
     * Check if a path reaches END without returning to loop header
     */
    reachesEndWithoutReturningToHeader(fromId, headerId) {
        if (!fromId) return false;
        if (fromId === headerId) return false;

        const visited = new Set();
        const stack = [fromId];

        while (stack.length > 0) {
            const currentId = stack.pop();

            // If we come back to the header → not an exit (it's a back edge)
            if (currentId === headerId) continue;

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;

            // If we reach END → success (exits the loop)
            if (node.type === 'end') return true;

            // Follow all successors
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                if (edge.to && !visited.has(edge.to)) {
                    stack.push(edge.to);
                }
            }
        }

        return false;
    }

    /**
     * Find the current loop header from context stack
     */
    findCurrentLoopHeader(contextStack) {
        for (let i = contextStack.length - 1; i >= 0; i--) {
            const ctx = contextStack[i];
            if (ctx.startsWith('loop_')) {
                return ctx.replace('loop_', '');
            }
        }
        return null;
    }

    /**
     * Find the common convergence point after all branches of a decision
     */
    findCommonConvergencePoint(decisionId, yesId, noId) {
        // Collect all non-decision nodes reachable from each branch
        const collectNonDecisions = (startId, visited = new Set(), depth = 0) => {
            const results = new Set();
            if (!startId || visited.has(startId) || depth > 8) return results;
            visited.add(startId);

            const node = this.nodes.find(n => n.id === startId);
            if (!node) return results;

            // Collect non-decision nodes
            if (node.type !== 'decision') {
                results.add(startId);
            }

            // Continue traversing if not too deep
            if (depth < 6) {
                const successors = this.getSuccessors(startId);
                for (const succId of successors) {
                    const subResults = collectNonDecisions(succId, new Set([...visited]), depth + 1);
                    subResults.forEach(id => results.add(id));
                }
            }

            return results;
        };

        const yesNodes = collectNonDecisions(yesId);
        const noNodes = collectNonDecisions(noId);

        // Find common nodes
        const commonNodes = new Set();
        for (const nodeId of yesNodes) {
            if (noNodes.has(nodeId)) {
                commonNodes.add(nodeId);
            }
        }

        // Return the first common node (prefer output nodes)
        if (commonNodes.size > 0) {
            const sortedCommon = Array.from(commonNodes).sort((a, b) => {
                const nodeA = this.nodes.find(n => n.id === a);
                const nodeB = this.nodes.find(n => n.id === b);
                if (nodeA.type === 'end' && nodeB.type !== 'end') return -1;
                if (nodeB.type === 'end' && nodeA.type !== 'end') return 1;
                if (nodeA.type === 'output' && nodeB.type !== 'output') return -1;
                if (nodeB.type === 'output' && nodeA.type !== 'output') return 1;
                return 0;
            });
            return sortedCommon[0];
        }

        // If no direct common target, check if NO branch is another decision (elif chain)
        const noNode = this.nodes.find(n => n.id === noId);
        if (noNode && noNode.type === 'decision') {
            // Recursively check the elif chain
            const noYesId = this.getSuccessor(noId, 'yes');
            const noNoId = this.getSuccessor(noId, 'no');
            return this.findCommonConvergencePoint(noId, noYesId, noNoId);
        }

        return null;
    }

    /**
     * Recursively collect all node IDs referenced in the IR tree
     */
    collectIdsFromIR(ir) {
        const ids = new Set();
        if (!ir) return ids;

        const collect = (node) => {
            if (!node) return;

            // Add this node's ID if it exists and looks like a real node ID (not synthetic)
            if (node.id && !node.id.includes('_pass') && !node.id.includes('_break')) {
                ids.add(node.id);
            }

            // Handle different IR node types
            if (node.statements && Array.isArray(node.statements)) {
                for (const stmt of node.statements) {
                    collect(stmt);
                }
            }
            if (node.body) {
                collect(node.body);
            }
            if (node.thenBranch) {
                collect(node.thenBranch);
            }
            if (node.elseBranch) {
                collect(node.elseBranch);
            }
            if (node.next) {
                collect(node.next);
            }

            // For for-loops, also include the init and increment node IDs
            if (node.initNodeId) {
                ids.add(node.initNodeId);
            }
            if (node.incrementNodeId) {
                ids.add(node.incrementNodeId);
            }
        };

        collect(ir);
        return ids;
    }

    /**
     * Main compilation entry point - using working logic from old compiler
     */
    compile() {
        this.forPatternCache.clear();
        this.normalizeGraph();

        this.insertedBreak = false;
        this.forPatternInProgress.clear();
        const startNode = this.nodes.find(n => n.type === 'start');
        if (!startNode) return "# Add a Start node.";
        
        // Validate connections point to existing nodes
        const nodeIds = new Set(this.nodes.map(n => n.id));
        const brokenConnections = this.connections.filter(conn =>
            !nodeIds.has(conn.from) || !nodeIds.has(conn.to)
        );
        if (brokenConnections.length > 0) {
            console.warn(`Warning: ${brokenConnections.length} connection(s) point to non-existent nodes`);
        }

        // Check for END node (warn if missing, but don't fail)
        const endNode = this.nodes.find(n => n.type === 'end');
        if (!endNode) {
            // Suppressed: Warning about missing END node (too noisy, code generation handles it)
            // console.warn("Warning: No END node found. Generated code may be incomplete.");
        }

        this.buildMaps(); // Ensure maps are up to date
        this.implicitLoopHeaders = this.findImplicitForeverLoopHeaders();

        this.nodes
            .filter(n => n.type === "decision")
            .forEach(dec => {
                const info = this.detectForLoopPattern(dec.id);
                if (info && info.initNodeId) {

                }
            });

        // Use iterative compilation with manual stack management
        let code = this.compileNode(startNode.id, new Set(), [], 0, false, false);

        // Add END node highlight as the very last line if we're in highlighting mode
        if (this.useHighlighting) {
            const endNode = this.nodes.find(n => n.type === 'end');
            if (endNode) {
                code += `highlight('${endNode.id}')\n`;
            }
        }

        // Phase 3: Post-compilation optimization
        code = this.optimizeGeneratedCode(code);

        return code;
    }
    
    /**
     * Collect all node IDs covered by the IR
     */
    /**
     * State machine fallback compiler - can compile ANY directed graph
     * Used when structured compilation fails to cover all nodes
     */
    compileAsStateMachine() {
        const startNode = this.nodes.find(n => n.type === 'start');
        if (!startNode) return "# Add a Start node.";

        const END = "__END__";
        const q = (s) => JSON.stringify(String(s ?? "")); // python string literal

        const inputLine = (node) => {
            const varName = (node.varName && String(node.varName).trim()) ? String(node.varName).trim() : "value";
            const prompt = (node.prompt !== undefined && node.prompt !== null) ? String(node.prompt) : "";
            const dtype = (node.dtype || "").toLowerCase().trim();

            let rhs = prompt.length ? `input(${q(prompt)})` : `input()`;
            if (dtype === "int") rhs = `int(${rhs})`;
            else if (dtype === "float") rhs = `float(${rhs})`;

            return `${varName} = ${rhs}`;
        };

        const nextOf = (id, port = "next") => this.getSuccessor(id, port);

        const lines = [];
        
        // Add START highlight if enabled
        if (this.useHighlighting) {
            lines.push(`highlight(${q(startNode.id)})`);
        }
        
        lines.push(`pc = ${q(startNode.id)}`);
        lines.push(`while True:`);
        lines.push(`    if pc == ${q(END)}:`);
        lines.push(`        break`);

        for (const node of this.nodes) {
            if (!node.id) continue;

            // Skip increment nodes that are part of for-loops
            if (node.text) {
                const incrementPattern = /^(\w+)\s*=\s*\1\s*[+-]\s*\d+/;
                if (incrementPattern.test(node.text.trim())) {
                    // Skip this node - it's handled by for-loop range
                    continue;
                }
            }

            lines.push(`    elif pc == ${q(node.id)}:`);

            if (this.useHighlighting && node.type !== "start") {
                lines.push(`        highlight(${q(node.id)})`);
            }

            // START: just jump to next
            if (node.type === "start") {
                const nx = nextOf(node.id, "next") || END;
                lines.push(`        pc = ${q(nx)}`);
                lines.push(`        continue`);
                continue;
            }

            // END: terminate
            if (node.type === "end") {
                lines.push(`        pc = ${q(END)}`);
                lines.push(`        continue`);
                continue;
            }

            // DECISION: choose yes/no
            if (node.type === "decision") {
                const cond = (node.text && String(node.text).trim()) ? String(node.text).trim() : "True";
                const yesId = nextOf(node.id, "yes") || nextOf(node.id, "true") || END;
                const noId  = nextOf(node.id, "no")  || nextOf(node.id, "false") || END;

                lines.push(`        if ${cond}:`);
                lines.push(`            pc = ${q(yesId)}`);
                lines.push(`        else:`);
                lines.push(`            pc = ${q(noId)}`);
                lines.push(`        continue`);
                continue;
            }

            // INPUT
            if (node.type === "input") {
                const py = (node.text && String(node.text).trim())
                    ? String(node.text).trim()
                    : inputLine(node);
                lines.push(`        ${py}`);
            }

            // OUTPUT
            if (node.type === "output") {
                const expr = (node.text && String(node.text).trim()) ? String(node.text).trim() : q("");
                lines.push(`        print(${expr})`);
            }

            // PROCESS / VAR (treat as raw python lines)
            if (node.type === "process" || node.type === "var") {
                const raw = (node.text && String(node.text).trim()) ? String(node.text).trim() : "";
                if (raw) {
                    for (const ln of raw.split("\n")) {
                        const t = ln.trim();
                        if (t) lines.push(`        ${t}`);
                    }
                } else {
                    lines.push(`        pass`);
                }
            }

            // default successor
            const nx = nextOf(node.id, "next") || END;
            lines.push(`        pc = ${q(nx)}`);
            lines.push(`        continue`);
        }

        // safety: unknown pc
        lines.push(`    else:`);
        lines.push(`        print("Unknown state:", pc)`);
        lines.push(`        break`);

        return lines.join("\n");
    }
    
    generateCodeFromEnhancedIR(ir) {
        const lines = [];
        const self = this;
        const topLevelEmittedIds = new Set(); // Track emitted nodes at TOP LEVEL ONLY
        
        // Add START node highlight as the very first line
        if (this.useHighlighting) {
            const startNode = this.nodes.find(n => n.type === 'start');
            if (startNode) {
                lines.push(`highlight('${startNode.id}')`);
            }
        }
        
        // isTopLevel: true for top-level program statements, false for nested programs (loop bodies, if branches)
        function emit(node, indent = 0, isTopLevel = false) {
            if (!node) return;
            
            // Prevent duplicate emission for structural nodes (loops, if statements)
            // ONLY at top level - nested emission (loop bodies, if branches) should not be affected
            const isStructuralNode = node.type === 'while' || node.type === 'for' || node.type === 'if';
            if (isTopLevel && isStructuralNode && node.id && topLevelEmittedIds.has(node.id)) {
                console.log(`Skipping duplicate structural node ${node.id} (type=${node.type}), topLevelEmittedIds=${JSON.stringify([...topLevelEmittedIds])}`);
                return;
            }
            if (isTopLevel && isStructuralNode && node.id) {
                console.log(`Adding structural node ${node.id} to topLevelEmittedIds`);
                topLevelEmittedIds.add(node.id);
            }
            
            const pad = " ".repeat(indent);
            
            if (node.type === 'program' || node.statements) {
                const statements = node.statements || [];
                console.log(`Emitting program with ${statements.length} statements:`, statements.map(s => s ? `${s.id}(${s.type})` : 'null'));
                
                for (let i = 0; i < statements.length; i++) {
                    const stmt = statements[i];
                    if (!stmt) {
                        continue;
                    }
                    
                    // Only skip duplicates at TOP LEVEL (not in loop bodies where re-emission is expected)
                    if (isTopLevel && stmt.id && topLevelEmittedIds.has(stmt.id)) {
                        continue;
                    }
                    
                    // Skip redundant initialization: if this is an assignment that initializes
                    // a variable to the same value as the next for loop's start value, skip it
                    let shouldSkip = false;
                    if (stmt.type === 'statement' && stmt.statementType === 'assignment' && stmt.content) {
                        const nextStmt = i + 1 < statements.length ? statements[i + 1] : null;
                        if (nextStmt && nextStmt.type === 'for' && 
                            typeof nextStmt.variable === 'string' && 
                            nextStmt.hasOwnProperty('start')) {
                            try {
                                const assignmentMatch = String(stmt.content).match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
                                if (assignmentMatch) {
                                    const varName = assignmentMatch[1];
                                    const varValue = String(assignmentMatch[2]).trim();
                                    const startValue = String(nextStmt.start).trim();
                                    // Check if variable matches and value matches start value
                                    if (nextStmt.variable === varName && varValue === startValue) {
                                        // Skip this redundant initialization
                                        shouldSkip = true;
                                    }
                                }
                            } catch (e) {
                                // If there's any error in the check, just emit the statement normally
                            }
                        }
                    }
                    
                    if (shouldSkip) {
                        // Even when skipping redundant init, emit a highlight for the node
                        // (The for loop will handle showing this node's visual feedback)
                        // We skip the actual statement but the for loop's initNodeId highlight will cover it
                    } else {
                        // Mark non-structural nodes as emitted to prevent double emission from next chain
                        // Structural nodes (while/for/if) have their own duplicate check inside emit()
                        const stmtIsStructural = stmt.type === 'while' || stmt.type === 'for' || stmt.type === 'if';
                        if (isTopLevel && stmt.id && !stmtIsStructural) {
                            topLevelEmittedIds.add(stmt.id);
                        }
                        emit(stmt, indent, isTopLevel);
                    }
                }
                return;
            }
            
            // Add highlight for the node if we're in highlighting mode and it has an ID
            // Skip 'for' loops here - they handle their own highlights specially (initNodeId, etc.)
            if (self.useHighlighting && node.id && node.type !== 'highlight' && node.type !== 'for') {
                lines.push(pad + `highlight('${node.id}')`);
            }
            
            switch (node.type) {
                case 'statement':
                    console.log(`Emit statement: id=${node.id}, statementType=${node.statementType}, content=${node.content}, indent=${indent}`);
                    if (node.statementType === 'assignment') {
                        if (node.content) {
                        lines.push(pad + node.content);
                        }
                    } else if (node.statementType === 'print') {
                        if (node.content !== undefined) {
                        lines.push(pad + `print(${node.content})`);
                        }
                    } else if (node.statementType === 'input') {
                        if (node.content) {
                            console.log(`  Pushing input line: "${pad + node.content}"`);
                        lines.push(pad + node.content);
                        }
                    } else if (node.statementType === 'pass') {
                        lines.push(pad + 'pass');
                    }
                    // Follow next chain - mark non-structural nodes as emitted
                    // Structural nodes (while/for/if) have their own duplicate check
                    if (node.next) {
                        console.log(`Statement ${node.id} following next to ${node.next.id} (${node.next.type})`);
                        const nextIsStructural = node.next.type === 'while' || node.next.type === 'for' || node.next.type === 'if';
                        if (isTopLevel && node.next.id && !nextIsStructural) {
                            console.log(`  Marking non-structural ${node.next.id} as emitted`);
                            topLevelEmittedIds.add(node.next.id);
                        }
                        emit(node.next, indent, isTopLevel);
                    }
                    break;
                    
                case 'if':
                    // Guard against undefined condition
                    const ifCondition = node.condition || 'True';
                    lines.push(pad + `if ${ifCondition}:`);
                    if (node.thenBranch) {
                        emit(node.thenBranch, indent + 4, false);  // Nested context
                    } else {
                        lines.push(pad + "    pass");
                    }
                    if (node.elseBranch) {
                        // Check if elseBranch is another if statement (elif chain)
                        if (node.elseBranch.type === 'if') {
                            const elifCondition = node.elseBranch.condition || 'True';
                            lines.push(pad + `elif ${elifCondition}:`);
                            if (node.elseBranch.thenBranch) {
                                emit(node.elseBranch.thenBranch, indent + 4, false);  // Nested context
                            } else {
                                lines.push(pad + "    pass");
                            }
                            // Handle nested elif chains
                            let currentElif = node.elseBranch.elseBranch;
                            while (currentElif && currentElif.type === 'if') {
                                const nestedElifCondition = currentElif.condition || 'True';
                                lines.push(pad + `elif ${nestedElifCondition}:`);
                                if (currentElif.thenBranch) {
                                    emit(currentElif.thenBranch, indent + 4, false);  // Nested context
                                } else {
                                    lines.push(pad + "    pass");
                                }
                                currentElif = currentElif.elseBranch;
                            }
                            // Final else if it exists
                            if (currentElif) {
                        lines.push(pad + `else:`);
                                emit(currentElif, indent + 4, false);  // Nested context
                            }
                        } else {
                            lines.push(pad + `else:`);
                            emit(node.elseBranch, indent + 4, false);  // Nested context
                        }
                    }
                    // Emit code after the if statement (convergence point)
                    if (node.next) {
                        const nextIsStructural = node.next.type === 'while' || node.next.type === 'for' || node.next.type === 'if';
                        if (isTopLevel && node.next.id && !nextIsStructural) {
                            topLevelEmittedIds.add(node.next.id);
                        }
                        emit(node.next, indent, isTopLevel);
                    }
                    break;
                    
                case 'while':
                    if (node.loopType === 'while_true') {
                        lines.push(pad + `while True:`);
                    } else {
                        // Guard against undefined or empty condition
                        const whileCondition = node.condition || 'True';
                        lines.push(pad + `while ${whileCondition}:`);
                    }
                    
                    // Add highlight for loop header inside the loop body
                    if (self.useHighlighting && node.id) {
                        lines.push(pad + "    " + `highlight('${node.id}')`);
                    }
                    
                    // DEBUG: Log body contents
                    console.log(`While loop ${node.id} body:`, JSON.stringify(node.body?.statements?.map(s => ({id: s.id, type: s.type, statementType: s.statementType, content: s.content}))));
                    console.log(`  body type: ${node.body?.type}, has statements: ${!!node.body?.statements}, length: ${node.body?.statements?.length}`);
                    
                    if (node.body && node.body.statements && node.body.statements.length > 0) {
                        console.log(`  Emitting body with indent ${indent + 4}`);
                        emit(node.body, indent + 4, false);  // Nested context - allow re-emission
                        console.log(`  After emit, lines count: ${lines.length}`);
                    } else {
                        console.log(`  Body is empty, adding pass`);
                        lines.push(pad + "    pass");
                    }
                    
                    // Handle while-else (Python construct)
                    // The else branch executes only if the loop completes normally (not broken)
                    if (node.elseBranch) {
                        lines.push(pad + "else:");
                        emit(node.elseBranch, indent + 4, false);
                    }
                    
                    // Follow next chain (exit path after the loop - only if no else branch)
                    // If we have an else branch, the exit is handled by it
                    if (node.next && !node.elseBranch) {
                        // Only mark non-structural nodes - structural have their own duplicate check
                        const nextIsStructural = node.next.type === 'while' || node.next.type === 'for' || node.next.type === 'if';
                        if (isTopLevel && node.next.id && !nextIsStructural) {
                            topLevelEmittedIds.add(node.next.id);
                        }
                        emit(node.next, indent, isTopLevel);
                    }
                    break;
                    
                case 'for':
                    // Add highlight for init node BEFORE the for loop (if exists)
                    if (self.useHighlighting && node.initNodeId) {
                        lines.push(pad + `highlight('${node.initNodeId}')`);
                    }
                    
                    // Add highlight for the for loop header BEFORE the for statement
                    if (self.useHighlighting && node.id) {
                        lines.push(pad + `highlight('${node.id}')`);
                    }
                    
                    // Include step parameter if it's not the default (1 for ascending)
                    // For descending loops, step will be negative (e.g., -1, -2) and must be included
                    const forStep = node.step ?? 1;
                    const forStepStr = forStep !== 1 ? `, ${forStep}` : '';
                    const forVar = node.variable || 'i';
                    const forStart = node.start ?? 0;
                    const forEnd = node.end ?? 10;
                    
                    lines.push(pad + `for ${forVar} in range(${forStart}, ${forEnd}${forStepStr}):`);
                    
                    // Add highlight for loop header inside the loop body (iteration highlight)
                    if (self.useHighlighting && node.id) {
                        lines.push(pad + "    " + `highlight('${node.id}')`);
                    }
                    
                    if (node.body && node.body.statements && node.body.statements.length > 0) {
                        // Emit loop body - nested context allows re-emission
                        emit(node.body, indent + 4, false);
                    } else {
                        // Empty body - add highlight for pass
                        if (self.useHighlighting && node.id) {
                            lines.push(pad + "    " + `highlight('${node.id}_pass')`);
                        }
                        lines.push(pad + "    pass");
                    }
                    
                    // Add highlight for increment node at the end of loop body (if exists)
                    if (self.useHighlighting && node.incrementNodeId) {
                        lines.push(pad + "    " + `highlight('${node.incrementNodeId}')`);
                    }
                    
                    // Follow next chain (code after the loop)
                    if (node.next) {
                        const nextIsStructural = node.next.type === 'while' || node.next.type === 'for' || node.next.type === 'if';
                        if (isTopLevel && node.next.id && !nextIsStructural) {
                            topLevelEmittedIds.add(node.next.id);
                        }
                        emit(node.next, indent, isTopLevel);
                    }
                    break;
                    
                case 'break':
                    lines.push(pad + `break`);
                    break;
                    
                case 'continue':
                    lines.push(pad + `continue`);
                    break;
                    
                case 'highlight':
                    // Direct highlight node
                    lines.push(pad + `highlight('${node.id}')`);
                    break;
                    
                default:
                    console.warn(`Unknown IR node type: ${node.type}`);
            }
        }
        
        emit(ir, 0, true);  // Top level - track emitted IDs to prevent duplicates
        return lines.join("\n");
    }
    
    optimizeGeneratedCode(code) {
        // Simplify mathematical expressions
        code = code.replace(/\b(\d+)\s*\+\s*1\b/g, (match, num) => {
            return (parseInt(num) + 1).toString();
        });
        
        code = code.replace(/\b(\d+)\s*-\s*1\b/g, (match, num) => {
            return (parseInt(num) - 1).toString();
        });
        
        // Remove unnecessary parentheses in simple expressions
        code = code.replace(/\((\d+)\)/g, '$1');
        
        return code;
    }

    // ==================== WORKING METHODS FROM OLD COMPILER ====================

    /**
     * Compile a node with context tracking
     */
    compileNode(nodeId, visitedInPath, contextStack, indentLevel, inLoopBody = false, inLoopHeader = false) {

        if (!nodeId) return "";

        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return "";

        // Are we currently inside a loop whose header is a decision node?
        const inDecisionControlledLoop = contextStack.some(ctx => {
            if (!ctx.startsWith("loop_")) return false;
            const headerId = ctx.replace("loop_", "");
            const headerNode = this.nodes.find(n => n.id === headerId);
            return headerNode && headerNode.type === "decision";
        });

        // ✅ END NODE: no per-visit highlight, no children
        if (node.type === "end") {
            // Do not emit highlight here – the END is highlighted once in compile()
            return "";
        }

        // ============================================
        // ✅ Check if this node is a loop header (back edge detection)
        // ============================================
        // Check early, before compiling node code, to prevent recompiling loop headers
        if (contextStack.some(ctx => ctx.startsWith("loop_") || ctx.startsWith("implicit_"))) {
            for (const ctx of contextStack) {
                if (ctx.startsWith("loop_") || ctx.startsWith("implicit_")) {
                    const hdr = ctx.startsWith("loop_")
                        ? ctx.replace("loop_", "")
                        : ctx.replace("implicit_", "");

                    // If this node IS the loop header, it's a back edge - don't recompile it
                    if (nodeId === hdr) {
                        console.log(`Node ${nodeId} is the loop header - stopping (back edge, don't recompile)`);
                        return ""; // Return empty - the loop header code was already compiled at loop start
                    }
                }
            }
        }

        // ✅ everyone else gets highlighted on entry
        let code = "";
        code += this.emitHighlight(nodeId, indentLevel);

        // ===========================
        // cycle protection - prevent infinite loops
        // ===========================
        if (visitedInPath.has(nodeId)) {
            console.log(`Skipping already visited node: ${nodeId}`);
            return "";
        }
        visitedInPath.add(nodeId);

        // ===========================
        // skip for-loop init nodes (only if we're actually compiling a for-loop)
        // ===========================
        if (this.isInitOfForLoop(nodeId)) {
            // Only skip if we're actually in a for-loop context (not a while loop)
            const inForLoopContext = contextStack.some(ctx => {
                if (!ctx.startsWith('loop_')) return false;
                const headerId = ctx.replace('loop_', '');
                const forInfo = this.detectForLoopPattern(headerId);
                // Check if this loop is actually being compiled as a for-loop
                // (not converted to while-else)
                return forInfo && forInfo.initNodeId === nodeId;
            });
            
            if (inForLoopContext) {
                console.log(`Skipping for-loop init node: ${nodeId}`);
                // Add highlight for skipped init nodes
                if (this.useHighlighting) {
                    code += this.emitHighlight(nodeId, indentLevel);
                }
                const succ = this.getAllSuccessors(nodeId);
                for (const { nodeId: nxt } of succ) {
                    code += this.compileNode(nxt, visitedInPath, [...contextStack], indentLevel, inLoopBody, inLoopHeader);
                }
                return code;
            }
        }

        // ===========================
        // skip nodes marked in nodesToSkip
        // ===========================
        if (this.nodesToSkip && this.nodesToSkip.has(nodeId)) {
            // Add highlight for skipped nodes (important for increment nodes in for-loops)
            if (this.useHighlighting) {
                code += this.emitHighlight(nodeId, indentLevel);
            }
            // transparent skip - don't compile this node or its successors
            return code;
        }

        // ===========================
        // Skip increment nodes in for-loops
        // ===========================
        if (node.type === 'process' && node.text) {
            const incrementPattern = /^(\w+)\s*=\s*\1\s*[+-]\s*\d+/;
            if (incrementPattern.test(node.text)) {
                // Check if we're in a for-loop context
                const inForLoop = contextStack.some(ctx => ctx.startsWith('loop_'));
                if (inForLoop) {
                    if (this.useHighlighting) {
                        code += this.emitHighlight(nodeId, indentLevel);
                    }
                    // transparent skip - don't compile this node or its successors
                    return code;
                }
            }
        }

        // Check for implicit loops ONLY if this node is not part of a decision-controlled loop
        // (Decision loops are handled in compileDecision, which runs before we get here for decision nodes)
        // BUT: If the decision loop has breaks to END, prioritize the implicit loop (while-true pattern)
        if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(nodeId)) {
            console.log(`compileNode: ${nodeId} is an implicit loop header`);
            let isPartOfDecisionLoop = false;
            let decisionLoopHasBreaks = false;

            // Check if any decision node is a loop header AND this node is in its loop body
            for (const dec of this.nodes.filter(n => n.type === "decision")) {
                const yesId = this.getSuccessor(dec.id, 'yes');
                const noId = this.getSuccessor(dec.id, 'no');

                const yesLoops = yesId ? this.canReach(yesId, dec.id, new Set()) : false;
                const noLoops = noId ? this.canReach(noId, dec.id, new Set()) : false;

                if (yesLoops || noLoops) {
                    const loopBodyId = yesLoops ? yesId : noId;
                    if (nodeId !== dec.id && loopBodyId) {
                        const reachableFromLoopBody = (loopBodyId === nodeId) ||
                            this.canReach(loopBodyId, nodeId, new Set([dec.id]));

                        const canReachBackToDecision = this.canReach(nodeId, dec.id, new Set());

                        if (reachableFromLoopBody && canReachBackToDecision) {
                            const hasBackEdgeToSelf = this.backEdges.some(edge =>
                                edge.to === nodeId && edge.from !== nodeId
                            );

                            if (!hasBackEdgeToSelf) {
                                isPartOfDecisionLoop = true;
                                
                                // Check if this decision loop has breaks to END (while-true pattern)
                                // If it does, prioritize the implicit loop over the decision loop
                                const yesBreaks = yesId && this.reachesEndWithoutReturningToHeader(yesId, nodeId);
                                const noBreaks = noId && this.reachesEndWithoutReturningToHeader(noId, nodeId);
                                decisionLoopHasBreaks = yesBreaks || noBreaks;
                                
                                break;
                            }
                        }
                    }
                }
            }

            // If node is part of a decision loop BUT the decision loop has breaks to END,
            // prioritize the implicit loop (while-true pattern like flowchart45)
            if (isPartOfDecisionLoop && !decisionLoopHasBreaks) {
                // Skip implicit loop detection, continue normal compilation
            } else if (this.loweredImplicitLoops.has(nodeId)) {
                const next = this.getSuccessor(nodeId, "next");
                return code + this.compileNode(next, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader);
            } else {
                this.loweredImplicitLoops.add(nodeId);

                return code + this.compileImplicitForeverLoop(
                    nodeId,
                    visitedInPath,
                    contextStack,
                    indentLevel,
                    inLoopBody,
                    inLoopHeader
                );
            }
        }

        // ===========================
        // emit real code for node (AFTER highlight)
        // ===========================
        const indent = "    ".repeat(indentLevel);

        switch (node.type) {

            case "decision":
                return code + this.compileDecision(node, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader);

            case "output":
                code += `${indent}print(${node.text || '""'})\n`;
                break;

            case "input": {
                const wrap = node.dtype === "int" ? "int(input(" : "input(";
                const varName = node.varName || "x";
                const prompt = node.prompt || '""';
                code += `${indent}${varName} = ${wrap}${prompt})\n`;
                if (node.dtype === "int") code = code.trimEnd() + ")\n";
                break;
            }

            case "process":
            case "var":
            case "list":
                if (node.text) {
                    const lines = node.text.split('\n');
                    for (const line of lines) {
                        if (line.trim()) {
                            code += `${indent}${line}\n`;
                        }
                    }
                }
                break;

            case "start":
            default:
                break;
        }

        // ===========================
        // follow next unless it's a loop back edge
        // ===========================
        const nextNodeId = this.getSuccessor(nodeId, "next");

        // Normal loop back edge check - SIMPLIFIED
        if (contextStack.some(ctx => ctx.startsWith("loop_") || ctx.startsWith("implicit_"))) {
            for (const ctx of contextStack) {
                if (ctx.startsWith("loop_") || ctx.startsWith("implicit_")) {
                    const hdr = ctx.startsWith("loop_")
                        ? ctx.replace("loop_", "")
                        : ctx.replace("implicit_", "");

                    if (nodeId === hdr) {
                        console.log(`Node ${nodeId} is the loop header - stopping (back edge detected)`);
                        return "";
                    }

                    if (nextNodeId === hdr) {
                        console.log(`Next node ${nextNodeId} is the loop header ${hdr} - stopping`);
                        return code;
                    }

                    const outgoing = this.outgoingMap.get(nodeId) || [];
                    const goesToHeader = outgoing.some(edge => edge.targetId === hdr);

                    if (goesToHeader) {
                        console.log(`Node ${nodeId} has back edge to loop header ${hdr} - stopping`);
                        return code;
                    }
                }
            }
        }

        if (nextNodeId) {
            return code + this.compileNode(nextNodeId, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader);
        } else {
            return code;
        }
    }

    emitHighlight(nodeId, indentLevel) {
        if (!this.useHighlighting) return "";
        const indent = "    ".repeat(indentLevel);
        return `${indent}highlight('${nodeId}')\n`;
    }

    // Returns true if this node is the init assignment of a detected for-loop
    isInitOfForLoop(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || (node.type !== "var" && node.type !== "process")) return false;

        // Look at EVERY decision node to see if it's a for-loop header
        for (const dec of this.nodes.filter(n => n.type === "decision")) {
            const info = this.detectForLoopPattern(dec.id);
            if (!info || !info.initNodeId) continue;

            // Check if this node is the init for ANY for-loop
            if (info.initNodeId === nodeId) {
                console.log(`Node ${nodeId} is init for for-loop at ${dec.id}`);
                return true;
            }
        }

        return false;
    }

    compileImplicitForeverLoop(nodeId, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader) {
        console.log(`compileImplicitForeverLoop: Compiling implicit loop starting at ${nodeId}`);
        const indent = "    ".repeat(indentLevel);
        let code = "";

        // Find the node that's the implicit loop header
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return "";

        // Add while True: header
        code += `${indent}while True:\n`;

        // Add highlight for the header if needed
        if (this.useHighlighting) {
            code += `${indent}    highlight('${nodeId}')\n`;
        }

        // Compile the node's code (inside the loop)
        const nodeCode = this.compileSingleNode(nodeId, indentLevel + 1);
        if (nodeCode) {
            code += nodeCode;
        }

        // Compile the loop body (everything reachable until we hit back to nodeId)
        const nextId = this.getSuccessor(nodeId, 'next');
        console.log(`compileImplicitForeverLoop: ${nodeId} nextId=${nextId}`);
        if (nextId) {
            const bodyCode = this.compileNodeUntil(
                nextId,
                nodeId, // Stop when we reach the loop header again
                new Set(),
                [...contextStack, `implicit_${nodeId}`],
                indentLevel + 1,
                true,  // inLoopBody = true (we're inside the implicit loop)
                false  // inLoopHeader = false (we're past the header)
            );

            if (bodyCode.trim()) {
                code += bodyCode;
            } else {
                // Empty loop body
                code += `${indent}    pass\n`;
            }
        } else {
            code += `${indent}    pass\n`;
        }

        return code;
    }

    compileSingleNode(nodeId, indentLevel) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return "";

        const indent = "    ".repeat(indentLevel);
        let code = "";

        // Add highlight if enabled
        if (this.useHighlighting) {
            code += `${indent}highlight('${node.id}')\n`;
        }

        switch (node.type) {
            case "output":
                code += `${indent}print(${node.text || '""'})\n`;
                break;

            case "input": {
                const wrap = node.dtype === "int" ? "int(input(" : "input(";
                const varName = node.varName || "x";
                const prompt = node.prompt || '""';
                code += `${indent}${varName} = ${wrap}${prompt})\n`;
                if (node.dtype === "int") code = code.trimEnd() + ")\n";
                break;
            }

            case "decision":
                // decision itself is handled elsewhere – treat as no-op here
                break;

            case "start":
            case "end":
                break;

            default:
                if (node.text) code += `${indent}${node.text}\n`;
        }

        return code;
    }

    /**
     * Compile decision node using dominator-based loop detection
     */
    compileDecision(node, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader) {
        // If we're already compiling this decision as a loop, skip it
        if (contextStack.some(ctx => ctx === `loop_${node.id}`)) {
            console.log(`Skipping ${node.id} - already in loop context`);
            return "";
        }

        const yesId = this.getSuccessor(node.id, 'yes');
        const noId = this.getSuccessor(node.id, 'no');

        console.log(`=== compileDecision(${node.id}: ${node.text}) ===`);
        console.log(`yesId: ${yesId}, noId: ${noId}`);
        console.log(`isSimpleWhileLoop: ${this.isSimpleWhileLoop(node.id)}`);
        console.log(`isLoopHeader: ${this.isLoopHeader(node.id)}`);

        // ============================================
        // 0) Check if this decision is inside an implicit while True loop
        // This handles flowchart 45 where n4 and n5 are decisions inside a loop starting at n3
        // ============================================
        // Check if any predecessor is an implicit loop header and this decision has breaks
        const incoming = this.incomingMap.get(node.id) || [];
        for (const edge of incoming) {
            const predId = edge.from;
            if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(predId)) {
                // Check if this decision has breaks to END
                const yesBreaks = yesId && this.reachesEndWithoutReturningToHeader(yesId, predId);
                const noBreaks = noId && this.reachesEndWithoutReturningToHeader(noId, predId);
                
                // If this decision has breaks and is reachable from an implicit loop header,
                // we should compile the implicit loop starting from predId
                if ((yesBreaks || noBreaks) && this.canReach(predId, node.id, new Set())) {
                    // Check if we're already inside this implicit loop
                    const alreadyInLoop = contextStack.some(ctx => ctx === `implicit_${predId}`);
                    if (!alreadyInLoop) {
                        console.log(`Decision ${node.id} is inside implicit loop starting at ${predId} - compiling implicit loop first`);
                        // Compile the implicit loop starting from predId
                        return this.compileImplicitForeverLoop(
                            predId,
                            visitedInPath,
                            contextStack,
                            indentLevel,
                            inLoopBody,
                            inLoopHeader
                        );
                    }
                }
            }
        }

        // ============================================
        // 1) FIRST: Check for SIMPLE WHILE-LOOP pattern
        // BUT: Skip if this decision has breaks to END (should be while True with breaks)
        // ============================================
        if (this.isSimpleWhileLoop(node.id)) {
            // First, determine which branches loop
            const yesLoops = yesId ? this.canReach(yesId, node.id, new Set()) : false;
            const noLoops = noId ? this.canReach(noId, node.id, new Set()) : false;
            
            // Only treat as a loop if exactly one branch loops back (proper while loop pattern)
            // This prevents false positives for regular if/else statements where both branches might loop
            const isProperLoop = (yesLoops && !noLoops) || (!yesLoops && noLoops);
            
            if (!isProperLoop) {
                // Both branches loop or neither loops - not a proper while loop, treat as if/else
                console.log(`Decision ${node.id} is not a proper loop (both or neither branch loops) - treating as if/else`);
                return this.compileIfElse(
                    node, yesId, noId,
                    visitedInPath, contextStack, indentLevel,
                    inLoopBody, inLoopHeader
                );
            }
            
            // Now that we know it's a proper loop, check if it has breaks to END
            // This handles flowchart 45 where decisions break to END instead of being simple while loops
            const yesBreaks = yesId && this.reachesEndWithoutReturningToHeader(yesId, node.id);
            const noBreaks = noId && this.reachesEndWithoutReturningToHeader(noId, node.id);
            
            let exitId = null;
            if (yesLoops && !noLoops) {
                exitId = noId; // NO branch is exit
            } else if (!yesLoops && noLoops) {
                exitId = yesId; // YES branch is exit
            }
            
            // For a simple while loop, the exit branch reaching END is normal (not a break)
            // We should only check if the LOOPING branch has breaks to END (early exits)
            // For flowchart 45: the looping branch contains decisions that break to END
            
            // Determine which branch is the looping branch
            const loopingBranchId = yesLoops ? yesId : (noLoops ? noId : null);
            
            // Check if the looping branch has breaks to END (early exits within the loop body)
            let loopingBranchHasBreaks = false;
            if (loopingBranchId) {
                // Check if the looping branch has paths that break to END
                // This is the key: if the loop body has breaks, it's not a simple while
                loopingBranchHasBreaks = this.checkForBreakToEnd(loopingBranchId, node.id);
            }
            
            // Also check if the exit branch is a decision that breaks (like flowchart 45)
            // For flowchart 45: n4 no -> n5 (decision that breaks), so exitId is a break path
            let exitIsBreakPath = false;
            if (exitId) {
                const exitNode = this.nodes.find(n => n.id === exitId);
                if (exitNode && exitNode.type === 'decision') {
                    // Exit is a decision - check if it breaks (like flowchart 45 where n5 breaks)
                    exitIsBreakPath = !this.isNormalExitPath(exitId, node.id);
                }
                // If exit is not a decision, it's a normal exit (like whileloop.json where exit is output -> END)
                // Don't treat normal exits as breaks
            }
            
            // Only skip simple while if:
            // 1. The looping branch has breaks to END (early exits in loop body), OR
            // 2. The exit branch is a decision that breaks (like flowchart 45)
            if (loopingBranchHasBreaks || exitIsBreakPath) {
                console.log(`Decision ${node.id} has breaks to END - skipping simple while, will use while True`);
                // Fall through to dominator-based detection
            } else {
                console.log(`Simple while-loop pattern detected at ${node.id}: ${node.text}`);

                console.log(`yesLoops: ${yesLoops}, noLoops: ${noLoops}`);

                let loopBodyId = null;
                let useNoBranch = false;

                // Prefer yes branch as body if it loops back, otherwise no branch
                if (yesLoops) {
                    loopBodyId = yesId;
                    exitId = noId;
                    useNoBranch = false;
                } else if (noLoops) {
                    loopBodyId = noId;
                    exitId = yesId;
                    useNoBranch = true;
                }

                if (loopBodyId) {
                    console.log(`Compiling as while loop: body=${loopBodyId}, exit=${exitId}, useNoBranch=${useNoBranch}`);
                    return this.compileLoop(
                        node,
                        loopBodyId,
                        exitId,
                        visitedInPath,
                        contextStack,
                        indentLevel,
                        useNoBranch,
                        inLoopBody,
                        inLoopHeader
                    );
                }
            }
        }

        // ============================================
        // 2) THEN: Check for DOMINATOR-BASED loop header
        // ============================================
        if (this.isLoopHeader(node.id)) {
            // If we're already in a loop body, check if this decision is a nested loop or just a decision with breaks
            // Key distinction: nested loops have proper loop structure, decisions with breaks exit to END
            if (inLoopBody || contextStack.some(ctx => ctx.startsWith('loop_') || ctx.startsWith('implicit_'))) {
                const outerLoopHeaders = [];
                for (const ctx of contextStack) {
                    if (ctx.startsWith('loop_') || ctx.startsWith('implicit_')) {
                        const hdr = ctx.startsWith('loop_') ? ctx.replace('loop_', '') : ctx.replace('implicit_', '');
                        outerLoopHeaders.push(hdr);
                    }
                }
                
                // Check if this decision's branches exit to END (decision with breaks) vs form a proper loop (nested loop)
                const loopInfo = this.getLoopInfo(node.id);
                if (loopInfo && loopInfo.backEdgeFrom) {
                    const backEdgeTarget = loopInfo.backEdgeFrom;
                    let shouldTreatAsDecision = false;
                    
                    // Check if branches exit DIRECTLY to END (not through outer loop)
                    // For nested loops, branches that go back to outer loop are NOT exits to END
                    const checkExitsToEnd = (branchId) => {
                        if (!branchId) return false;
                        // First check if branch goes directly to an outer loop header
                        for (const outerHeader of outerLoopHeaders) {
                            if (this.pathLeadsTo(branchId, outerHeader, new Set([node.id]))) {
                                // Branch goes to outer loop - not an exit to END
                                return false;
                            }
                        }
                        // If it doesn't go to outer loop, check if it exits to END
                        return this.reachesEndWithoutReturningToHeader(branchId, node.id);
                    };
                    
                    const yesExitsToEnd = checkExitsToEnd(yesId);
                    const noExitsToEnd = checkExitsToEnd(noId);
                    
                    console.log(`Checking decision ${node.id}: yesExitsToEnd=${yesExitsToEnd}, noExitsToEnd=${noExitsToEnd}`);
                    
                    // If both branches exit to END (and not through outer loop), it's a decision with breaks
                    if (yesExitsToEnd && noExitsToEnd) {
                        shouldTreatAsDecision = true;
                        console.log(`Decision ${node.id}: Both branches exit to END - treating as decision with breaks`);
                    } else if (yesExitsToEnd || noExitsToEnd) {
                        // If at least one branch exits to END, check if back edge is in outer loop's body
                        // This handles flowchart 45 case where decision is inside loop and exits to END
                        for (const outerHeader of outerLoopHeaders) {
                            if (backEdgeTarget !== outerHeader) {
                                const outerLoopNodes = this.naturalLoops.get(outerHeader);
                                if (outerLoopNodes && outerLoopNodes.has(backEdgeTarget)) {
                                    // The back edge is in the outer loop's body AND a branch exits to END
                                    // This is a decision with breaks (like flowchart 45)
                                    shouldTreatAsDecision = true;
                                    console.log(`Decision ${node.id}: Branch exits to END and back edge in outer loop - treating as decision with breaks`);
                                    break;
                                }
                            }
                        }
                    }
                    // If neither branch exits to END (or they go to outer loop), it's a proper nested loop (like 2loops.json)
                    // shouldTreatAsDecision remains false, so it will be compiled as a loop
                    
                    if (shouldTreatAsDecision) {
                        console.log(`Decision ${node.id} exits to END - treating as decision with breaks, not nested loop`);
                        // Compile as regular if/else with break detection
                        return this.compileIfElse(
                            node, yesId, noId,
                            visitedInPath, contextStack, indentLevel,
                            inLoopBody, inLoopHeader
                        );
                    }
                }
            }
            
            console.log(`Dominator-based loop header detected at ${node.id}: ${node.text}`);
            const loopInfo = this.getLoopInfo(node.id);
            console.log(`Loop info for ${node.id}:`, loopInfo);
            if (loopInfo) {
                return this.compileLoop(
                    node,
                    loopInfo.bodyId,
                    loopInfo.exitId,
                    visitedInPath,
                    contextStack,
                    indentLevel,
                    loopInfo.useNoBranch,
                    inLoopBody,
                    inLoopHeader
                );
            } else {
                console.log(`No loop info found for loop header ${node.id}`);
            }
        }

        // ============================================
        // 3) OTHERWISE: compile as regular if/else
        // ============================================
        return this.compileIfElse(
            node, yesId, noId,
            visitedInPath, contextStack, indentLevel,
            inLoopBody, inLoopHeader
        );
    }

    isSimpleWhileLoop(decisionId) {
        const yesId = this.getSuccessor(decisionId, 'yes');
        const noId = this.getSuccessor(decisionId, 'no');

        // Avoid loop header decisions to prevent false positives from complex control flow
        const avoidSet = new Set(this.loopHeaders);

        // Check if a branch loops back to the decision without going through other decisions
        const yesLoops = yesId ? this.canReach(yesId, decisionId, avoidSet) : false;
        const noLoops = noId ? this.canReach(noId, decisionId, avoidSet) : false;

        console.log(`isSimpleWhileLoop(${decisionId}): yes=${yesId}, no=${noId}, yesLoops=${yesLoops}, noLoops=${noLoops}`);

        // Special case: flowchart45 pattern - if a branch loops back to a process/var node that precedes
        // the decision in the execution flow, treat it as sequential code (if-elif-else), not a loop
        if (yesLoops || noLoops) {
            const loopingBranchId = yesLoops ? yesId : noId;
            // Find what node the back edge goes to by tracing the path
            const backEdgeTarget = this.findNodeInCycle(loopingBranchId, decisionId, avoidSet);
            if (backEdgeTarget) {
                const targetNode = this.nodes.find(n => n.id === backEdgeTarget);
                // If back edge goes to a process/var node (not a decision), check if it precedes the decision
                if (targetNode && (targetNode.type === 'process' || targetNode.type === 'var')) {
                    // Check if this process node comes before the decision in execution flow
                    if (this.precedesInExecutionFlow(backEdgeTarget, decisionId)) {
                        console.log(`Decision ${decisionId}: back edge to process node ${backEdgeTarget} that precedes it - treating as sequential code, not loop`);
                        return false; // Treat as sequential code, not a loop
                    }
                }
            }
        }

        // A simple while loop: at least one branch loops back
        return yesLoops || noLoops;
    }
    
    /**
     * Find a node in the cycle that the branch creates (the node the back edge goes to)
     * In flowchart45: n5 no -> n3, so we want to find n3
     */
    findNodeInCycle(startId, targetDecisionId, avoidSet = new Set(), visited = new Set()) {
        if (!startId || visited.has(startId)) return null;
        if (startId === targetDecisionId) return null;
        
        visited.add(startId);
        
        const node = this.nodes.find(n => n.id === startId);
        if (!node) return null;
        
        // If this is a process/var node, check if it connects back to targetDecisionId
        if (node.type === 'process' || node.type === 'var') {
            const next = this.getSuccessor(startId, 'next');
            // Don't avoid the target decision when checking if we can reach it (that's what we're looking for!)
            const reachAvoidSet = new Set(avoidSet);
            reachAvoidSet.delete(targetDecisionId);
            if (next === targetDecisionId || this.canReach(next, targetDecisionId, reachAvoidSet)) {
                return startId; // Found the process node that creates the back edge
            }
        }
        
        // If this is a decision, check its branches
        if (node.type === 'decision') {
            const yesId = this.getSuccessor(startId, 'yes');
            const noId = this.getSuccessor(startId, 'no');
            const yesResult = yesId ? this.findNodeInCycle(yesId, targetDecisionId, avoidSet, new Set(visited)) : null;
            if (yesResult) return yesResult;
            return noId ? this.findNodeInCycle(noId, targetDecisionId, avoidSet, new Set(visited)) : null;
        }
        
        // Follow next pointer
        const next = this.getSuccessor(startId, 'next');
        if (next && !avoidSet.has(next)) {
            return this.findNodeInCycle(next, targetDecisionId, avoidSet, visited);
        }
        
        return null;
    }
    
    /**
     * Check if nodeA comes before nodeB in execution flow (by following 'next' connections)
     */
    precedesInExecutionFlow(nodeAId, nodeBId, visited = new Set()) {
        if (!nodeAId || !nodeBId) return false;
        if (nodeAId === nodeBId) return false;
        if (visited.has(nodeAId)) return false;
        
        visited.add(nodeAId);
        
        // Check if nodeA's next connections lead to nodeB
        const outgoing = this.outgoingMap.get(nodeAId) || [];
        for (const edge of outgoing) {
            if (edge.port === 'next') {
                if (edge.to === nodeBId) {
                    return true; // Direct path found
                }
                // Recursively check if this node precedes nodeB
                if (this.precedesInExecutionFlow(edge.to, nodeBId, new Set(visited))) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Compile loop structure (while or for)
     */
    compileLoop(node, loopBodyId, exitId, visitedInPath, contextStack, indentLevel, useNoBranch = false, inLoopBody = false, inLoopHeader = false) {
        const indent = "    ".repeat(indentLevel);
        let code = "";

        // -------------------------------
        // 1) Try COUNTED FOR loop lowering
        // -------------------------------

        let forInfo = this.detectForLoopPattern(node.id);

        if (forInfo) {
            // Check if loop body has breaks to END - if so, use while-else instead of for loop
            // This handles cases like atm.json where the loop can exit early
            const hasBreakToEnd = this.checkForBreakToEnd(loopBodyId, node.id);
            if (hasBreakToEnd) {
                console.log(`Loop ${node.id} has break to END - using while-else instead of for loop`);
                // Don't compile as for loop - fall through to while loop compilation below
                // Set forInfo to null so we don't use for loop
                forInfo = null;
            } else {
                // mark this decision node as the active loop header
                this.loopHeaderId = node.id;

                // -------------------------------
                // create a local skip set
                // -------------------------------
                const savedSkip = this.nodesToSkip;
                const localSkips = new Set();

                // For for loops, skip increment as it's implicit in range
                if (forInfo.incrementNodeId) {
                    localSkips.add(forInfo.incrementNodeId);
                }

                const incrementPatterns = [
                    new RegExp(`^\\s*${forInfo.variable}\\s*=\\s*${forInfo.variable}\\s*[+-]\\s*\\d+`),
                    new RegExp(`^\\s*${forInfo.variable}\\s*[+-]=\\s*\\d+`)
                ];

                for (const n of this.nodes) {
                    if (n.text && incrementPatterns.some(pattern => pattern.test(n.text))) {
                        localSkips.add(n.id);
                        console.log(`Marked ${n.id} (${n.text}) as increment to skip`);
                    }
                }

                // optionally skip init if it directly precedes header
                if (forInfo.initNodeId) {
                    const incoming = this.incomingMap.get(node.id) || [];
                    const direct = incoming.some(c => c.sourceId === forInfo.initNodeId);
                    if (direct) localSkips.add(forInfo.initNodeId);
                }

                // MOST IMPORTANT: the loop header itself must not emit AND must not follow both branches
                localSkips.add(node.id);

                this.nodesToSkip = localSkips;

                // -------------------------------
                // Generate for loop with flowchart-correct range
                // -------------------------------
                let step = forInfo.step;
                if (!step) {
                    step = (parseInt(forInfo.start) <= parseInt(forInfo.end)) ? 1 : -1;
                }

                const rangeStr = `range(${forInfo.start}, ${forInfo.end}, ${step})`;
                code += `${indent}for ${forInfo.variable} in ${rangeStr}:\n`;

                if (this.useHighlighting) {
                    code += `${indent}    highlight('${node.id}')\n`;
                }

                // -------------------------------
                // compile loop body ONLY along loop branch
                // -------------------------------
                const loopCtx = [...contextStack, `loop_${node.id}`];

                const yesId = this.getSuccessor(node.id, "yes");
                const noId  = this.getSuccessor(node.id, "no");

                const incId = forInfo.incrementNodeId;

                const yesReachesInc = yesId ? this.canReach(yesId, incId, new Set([node.id])) : false;
                const noReachesInc  = noId  ? this.canReach(noId,  incId, new Set([node.id])) : false;

                let realBodyId = loopBodyId;
                if (yesReachesInc && !noReachesInc) realBodyId = yesId;
                else if (!yesReachesInc && noReachesInc) realBodyId = noId;

                if (realBodyId === incId) {
                    const stepOff = this.getSuccessor(realBodyId, "next");
                    if (stepOff) realBodyId = stepOff;
                }

                const bodyCode = this.compileNode(
                    realBodyId,
                    new Set(),
                    loopCtx,
                    indentLevel + 1,
                    true,
                    true
                );

                code += bodyCode.trim() ? bodyCode : `${indent}    pass\n`;

                if (this.useHighlighting && forInfo.incrementNodeId) {
                    code += `${indent}    highlight('${forInfo.incrementNodeId}')\n`;
                }

                // -------------------------------
                // compile exit path AFTER loop
                // -------------------------------
                this.nodesToSkip = savedSkip;

                if (exitId) {
                    console.log(`Checking exit for loop ${node.id}, exitId: ${exitId}, inLoopBody: ${inLoopBody}, contextStack:`, contextStack);

                    let leadsToLoopHeader = false;

                    for (const ctx of contextStack) {
                        if (ctx.startsWith('loop_')) {
                            const outerLoopHeaderId = ctx.replace('loop_', '');
                            const leads = this.pathLeadsTo(exitId, outerLoopHeaderId, new Set([node.id]));
                            console.log(`  Does ${exitId} lead to outer loop ${outerLoopHeaderId}? ${leads}`);
                            if (leads) {
                                leadsToLoopHeader = true;
                                break;
                            }
                        }
                    }

                    console.log(`  leadsToLoopHeader: ${leadsToLoopHeader}`);

                    // If exit leads to an outer loop header, compile it as part of the outer loop body
                    // (not as a separate exit, but as continuation of the outer loop)
                    if (inLoopBody && leadsToLoopHeader) {
                        console.log(`  COMPILING exit path as part of outer loop body`);
                        // Compile the exit path, but keep it in the outer loop body context
                        // Don't add loop_${node.id} to context since we're continuing in outer loop
                        code += this.compileNode(
                            exitId,
                            visitedInPath,
                            contextStack,  // Keep outer loop context, don't add inner loop context
                            indentLevel,
                            true,  // Still in loop body (outer loop)
                            false
                        );
                        return code;
                    }

                    if (inLoopBody && !leadsToLoopHeader) {
                        console.log(`  SKIPPING exit path - nested loop exit to END`);
                        return code;
                    }

                    console.log(`  COMPILING exit path`);

                    if (this.useHighlighting && !inLoopBody) {
                        code += `${indent}highlight('${node.id}')\n`;
                    }

                    const exitContext = [...contextStack, `loop_${node.id}`];
                    code += this.compileNode(
                        exitId,
                        visitedInPath,
                        exitContext,
                        indentLevel,
                        false,
                        false
                    );
                }
                return code;
            }
        }

        // -------------------------------
        // 2) OTHERWISE → WHILE LOOP
        // -------------------------------

        // Analyze loop structure and choose optimal compilation strategy
        const loopAnalysis = this.analyzeLoopStructure(node.id, loopBodyId, exitId, useNoBranch);
        const loopType = loopAnalysis.recommendedType;

        let condition = node.text;
        if (useNoBranch) condition = `not (${condition})`;

        if (loopType === 'while_true_with_breaks') {
            code += `${indent}while True:\n`;

            if (this.useHighlighting) {
                code += `${indent}    highlight('${node.id}')\n`;
            }

            const whileCtx = [...contextStack, `loop_${node.id}`];
            const bodyCode = this.compileNode(loopBodyId, new Set(), whileCtx, indentLevel + 1, true, true);
            code += bodyCode.trim() ? bodyCode : `${indent}    pass\n`;

            code += `${indent}    if not (${condition}):\n`;
            const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel + 2, false, false);
            code += exitCode || `${indent}        pass\n`;
            code += `${indent}        break\n`;
        } else if (loopType === 'while_true_simple') {
            code += `${indent}while True:\n`;

            if (this.useHighlighting) {
                code += `${indent}    highlight('${node.id}')\n`;
            }

            const whileCtx = [...contextStack, `loop_${node.id}`];
            const bodyCode = this.compileNode(loopBodyId, new Set(), whileCtx, indentLevel + 1, true, true);
            code += bodyCode.trim() ? bodyCode : `${indent}    pass\n`;
            
            // Don't add else clause - code after loop should be compiled separately
            if (exitId) {
                // Compile exit path after the loop (not as else clause)
                const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel, false, false);
                if (exitCode) {
                    code += exitCode;
                }
            }
        } else {
            code += `${indent}while ${condition}:\n`;

            if (this.useHighlighting) {
                code += `${indent}    highlight('${node.id}')\n`;
            }

            const whileCtx = [...contextStack, `loop_${node.id}`];
            const bodyCode = this.compileNode(loopBodyId, new Set(), whileCtx, indentLevel + 1, true, true);
            code += bodyCode.trim() ? bodyCode : `${indent}    pass\n`;

            // Check if loop body has breaks to END - if so, use while-else pattern
            // The else clause only runs when the loop completes normally (no break)
            const hasBreakToEnd = this.checkForBreakToEnd(loopBodyId, node.id);
            if (hasBreakToEnd && exitId) {
                // Use while-else: exit path is compiled as else clause
                const exitNode = this.nodes.find(n => n.id === exitId);
                if (exitNode && exitNode.type !== 'end') {
                    code += `${indent}else:\n`;
                    const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel + 1, false, false);
                    code += exitCode || `${indent}    pass\n`;
                    console.log(`Using while-else pattern for loop ${node.id}: exit path ${exitId} compiled as else clause`);
                } else {
                    // Exit is END node - compile after loop
                    const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel, false, false);
                    if (exitCode) {
                        code += exitCode;
                    }
                }
            } else {
                // No breaks in body - compile exit path after the loop (not as else clause)
                if (exitId) {
                    const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel, false, false);
                    if (exitCode) {
                        code += exitCode;
                    }
                }
            }
        }

        return code;
    }

    /**
     * Compile if/else statement with support for elif
     */
    compileIfElse(node, yesId, noId, visitedInPath, contextStack, indentLevel, inLoopBody = false, inLoopHeader = false) {
        console.log(`compileIfElse called for ${node.id}: inLoopBody=${inLoopBody}, contextStack=`, contextStack);
        // Check if we're inside a for-loop and if branches lead to increment nodes
        // This prevents increment statements from appearing in if/else branches inside for loops
        if (inLoopBody && contextStack.some(ctx => ctx.startsWith('loop_'))) {
            const currentLoopCtx = [...contextStack].reverse().find(ctx => ctx.startsWith('loop_'));
            if (currentLoopCtx) {
                const loopHeaderId = currentLoopCtx.replace('loop_', '');
                const forInfo = this.detectForLoopPattern(loopHeaderId);
                console.log(`compileIfElse ${node.id}: checking for-loop pattern, loopHeaderId=${loopHeaderId}, forInfo=`, forInfo);
                
                if (forInfo && forInfo.incrementNodeId) {
                    console.log(`compileIfElse ${node.id}: for-loop increment check, incrementNodeId=${forInfo.incrementNodeId}`);
                    const incId = forInfo.incrementNodeId;
                    
                    // Check if one of the branches leads to the increment node
                    const yesLeadsToInc = yesId === incId || this.canReach(yesId, incId, new Set([node.id]));
                    const noLeadsToInc = noId === incId || (noId && this.canReach(noId, incId, new Set([node.id])));
                    
                    if (yesLeadsToInc || noLeadsToInc) {
                        // This decision leads to the for-loop increment
                        // Compile it as simple if/else but stop before the increment
                        const indent = "    ".repeat(indentLevel);
                        let decisionCode = `${indent}if ${node.text}:\n`;
                        
                        const ifContext = [...contextStack, `if_${node.id}`];
                        // Compile YES branch but stop before increment
                        let ifCode = "";
                        if (yesLeadsToInc) {
                            ifCode = this.compileNodeUntil(yesId, incId, new Set([...visitedInPath]), ifContext, indentLevel + 1, inLoopBody, inLoopHeader);
                        } else {
                            ifCode = this.compileNode(yesId, new Set([...visitedInPath]), ifContext, indentLevel + 1, inLoopBody, inLoopHeader);
                        }
                        
                        // Check if break should be added to YES branch (even though we're stopping before increment)
                        const loopHeaderId = this.findCurrentLoopHeader(ifContext);
                        console.log(`compileIfElse YES branch (for-loop increment path) for ${node.id}: inLoopBody=${inLoopBody}, loopHeaderId=${loopHeaderId}, ifContext=`, ifContext);
                        if (inLoopBody || loopHeaderId) {
                            if (loopHeaderId) {
                                let loopType = this.getLoopType(loopHeaderId);
                                if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                                    loopType = 'while_true_with_breaks';
                                }

                                let shouldBreak = this.breakManager.shouldAddBreak(
                                    yesId,
                                    loopHeaderId,
                                    ifContext,
                                    loopType,
                                    null
                                );
                                console.log(`BreakManager.shouldAddBreak(${yesId}, ${loopHeaderId}) [for-loop increment path]: ${shouldBreak}`);

                                if (!shouldBreak) {
                                    const exits = this.breakManager.branchReachesEnd(yesId, loopHeaderId);
                                    const loopsBack = this.breakManager.branchLoopsBackToHeader(yesId, loopHeaderId);
                                    console.log(`Fallback check [for-loop increment path]: exits=${exits}, loopsBack=${loopsBack}`);
                                    if (exits && !loopsBack) {
                                        shouldBreak = true;
                                    }
                                }

                                if (shouldBreak) {
                                    console.log(`Adding break after YES branch (for-loop increment path) of ${node.id}`);
                                    if (!ifCode.endsWith("\n")) ifCode += "\n";
                                    ifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                                }
                            }
                        }
                        
                        decisionCode += ifCode || `${indent}    pass\n`;
                        
                        if (noId) {
                            decisionCode += `${indent}else:\n`;
                            // Compile NO branch but stop before increment
                            if (noLeadsToInc) {
                                const elseCode = this.compileNodeUntil(noId, incId, new Set([...visitedInPath]), [...contextStack, `else_${node.id}`], indentLevel + 1, inLoopBody, inLoopHeader);
                                decisionCode += elseCode || `${indent}    pass\n`;
                            } else {
                                const elseCode = this.compileNode(noId, new Set([...visitedInPath]), [...contextStack, `else_${node.id}`], indentLevel + 1, inLoopBody, inLoopHeader);
                                decisionCode += elseCode || `${indent}    pass\n`;
                            }
                        }
                        
                        return decisionCode;
                    }
                }
            }
        }

        console.log(`compileIfElse ${node.id}: past for-loop check, about to find convergence point`);
        // Find the convergence point AFTER the entire decision chain
        let convergencePoint = this.findCommonConvergencePoint(node.id, yesId, noId);
        console.log(`compileIfElse ${node.id}: convergencePoint=${convergencePoint}, yesId=${yesId}, noId=${noId}`);

        // In compileIfElse, after finding convergencePoint:
        if (convergencePoint && convergencePoint === noId) {
            // Special case: convergence point IS the else branch
            // Compile as if without else, then convergence
            const indent = "    ".repeat(indentLevel);
            let code = `${indent}if ${node.text}:\n`;

            const ifContext = [...contextStack, `if_${node.id}`];
            const ifCode = this.compileNodeUntil(
                yesId,
                convergencePoint,
                new Set([...visitedInPath]),
                ifContext,
                indentLevel + 1,
                inLoopBody,
                inLoopHeader
            );
            let finalIfCode = ifCode || `${indent}    pass\n`;

            // Check if break should be added to YES branch
            const loopHeaderId = this.findCurrentLoopHeader(ifContext);
            console.log(`compileIfElse YES branch (convergence=noId) for ${node.id}: inLoopBody=${inLoopBody}, loopHeaderId=${loopHeaderId}, ifContext=`, ifContext);
            if (inLoopBody || loopHeaderId) {
                if (loopHeaderId) {
                    let loopType = this.getLoopType(loopHeaderId);
                    if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                        loopType = 'while_true_with_breaks';
                    }

                    let shouldBreak = this.breakManager.shouldAddBreak(
                        yesId,
                        loopHeaderId,
                        ifContext,
                        loopType,
                        convergencePoint
                    );
                    console.log(`BreakManager.shouldAddBreak(${yesId}, ${loopHeaderId}) [convergence=noId]: ${shouldBreak}`);

                    if (!shouldBreak) {
                        const exits = this.breakManager.branchReachesEnd(yesId, loopHeaderId);
                        const loopsBack = this.breakManager.branchLoopsBackToHeader(yesId, loopHeaderId);
                        console.log(`Fallback check [convergence=noId]: exits=${exits}, loopsBack=${loopsBack}`);
                        if (exits && !loopsBack) {
                            shouldBreak = true;
                        }
                    }

                    if (shouldBreak) {
                        console.log(`Adding break after YES branch (convergence=noId) of ${node.id}`);
                        if (!finalIfCode.endsWith("\n")) finalIfCode += "\n";
                        finalIfCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                    }
                }
            }

            code += finalIfCode;

            // Compile convergence point AFTER if
            if (!code.endsWith("\n")) code += "\n";
            code += this.compileNode(
                convergencePoint,
                visitedInPath,
                contextStack,
                indentLevel,
                inLoopBody,
                inLoopHeader
            );

            return code;
        }

        const indent = "    ".repeat(indentLevel);
        let code = `${indent}if ${node.text}:\n`;

        // Compile YES branch BUT STOP at convergence point
        const ifContext = [...contextStack, `if_${node.id}`];
        const ifVisited = new Set([...visitedInPath]);

        let ifCode = "";
        if (convergencePoint) {
            ifCode = this.compileNodeUntil(
                yesId,
                convergencePoint,
                ifVisited,
                ifContext,
                indentLevel + 1,
                inLoopBody,
                inLoopHeader
            );

            // Use BreakManager to determine if break should be added
            // Check both inLoopBody flag and contextStack for loop context
            const loopHeaderId = this.findCurrentLoopHeader(ifContext);
            console.log(`compileIfElse YES branch for ${node.id}: inLoopBody=${inLoopBody}, loopHeaderId=${loopHeaderId}, ifContext=`, ifContext);
            if (inLoopBody || loopHeaderId) {
                if (loopHeaderId) {
                    // Check if it's an implicit loop - if so, use while_true_with_breaks
                    let loopType = this.getLoopType(loopHeaderId);
                    if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                        loopType = 'while_true_with_breaks';
                    }

                    // Primary decision: BreakManager
                    let shouldBreak = this.breakManager.shouldAddBreak(
                        yesId,
                        loopHeaderId,
                        ifContext,
                        loopType,
                        convergencePoint
                    );
                    console.log(`BreakManager.shouldAddBreak(${yesId}, ${loopHeaderId}): ${shouldBreak}`);

                    // Fallback: simple structural check
                    // "Does this YES branch reach END without ever returning to the loop header?"
                    if (!shouldBreak) {
                        const exits = this.breakManager.branchReachesEnd(yesId, loopHeaderId);
                        const loopsBack = this.breakManager.branchLoopsBackToHeader(yesId, loopHeaderId);
                        console.log(`Fallback check: exits=${exits}, loopsBack=${loopsBack}`);
                        if (exits && !loopsBack) {
                            shouldBreak = true;
                        }
                    }

                    if (shouldBreak) {
                        console.log(`Adding break after YES branch of ${node.id}`);
                        if (!ifCode.endsWith("\n")) ifCode += "\n";
                        ifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                    }
                } else {
                    console.log(`No loop header found in ifContext for ${node.id}`);
                }
            } else {
                console.log(`Not in loop body and no loop header found for ${node.id}`);
            }

        } else {
            ifCode = this.compileNode(
                yesId,
                ifVisited,
                ifContext,
                indentLevel + 1,
                inLoopBody,
                inLoopHeader
            );

            // Use BreakManager to determine if break should be added
            // Check both inLoopBody flag and contextStack for loop context
            const loopHeaderId = this.findCurrentLoopHeader(ifContext);
            console.log(`compileIfElse YES branch (no convergence) for ${node.id}: inLoopBody=${inLoopBody}, loopHeaderId=${loopHeaderId}, ifContext=`, ifContext);
            if (inLoopBody || loopHeaderId) {
                if (loopHeaderId) {
                    // Check if it's an implicit loop - if so, use while_true_with_breaks
                    let loopType = this.getLoopType(loopHeaderId);
                    if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                        loopType = 'while_true_with_breaks';
                    }

                    // Primary decision: BreakManager
                    let shouldBreak = this.breakManager.shouldAddBreak(
                        yesId,
                        loopHeaderId,
                        ifContext,
                        loopType,
                        convergencePoint
                    );
                    console.log(`BreakManager.shouldAddBreak(${yesId}, ${loopHeaderId}) [no convergence]: ${shouldBreak}`);

                    // Fallback: simple structural check
                    // "Does this YES branch reach END without ever returning to the loop header?"
                    if (!shouldBreak) {
                        const exits = this.breakManager.branchReachesEnd(yesId, loopHeaderId);
                        const loopsBack = this.breakManager.branchLoopsBackToHeader(yesId, loopHeaderId);
                        console.log(`Fallback check [no convergence]: exits=${exits}, loopsBack=${loopsBack}`);
                        if (exits && !loopsBack) {
                            shouldBreak = true;
                        }
                    }

                    if (shouldBreak) {
                        console.log(`Adding break after YES branch (no convergence) of ${node.id}`);
                        if (!ifCode.endsWith("\n")) ifCode += "\n";
                        ifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                    }
                } else {
                    console.log(`No loop header found in ifContext (no convergence) for ${node.id}`);
                }
            } else {
                console.log(`Not in loop body and no loop header found (no convergence) for ${node.id}`);
            }

        }

        code += ifCode || `${indent}    pass\n`;

        // Handle else/elif
        if (noId) {
            const noNode = this.nodes.find(n => n.id === noId);

            if (noNode && noNode.type === 'decision') {
                // Check if this is a LINEAR chain of decisions (elif)
                const isLinearChain = this.isLinearDecisionChain(noId, node.id);

                if (isLinearChain) {
                    // Compile as elif chain
                    const elifVisited = new Set([...visitedInPath]);
                    const elifResult = this.compileElifChainUntil(
                        noNode,
                        convergencePoint,
                        elifVisited,
                        contextStack,
                        indentLevel,
                        inLoopBody,
                        inLoopHeader
                    );

                    code += elifResult.code || "";
                } else {
                    // Regular else with nested decision
                    if (!code.endsWith("\n")) code += "\n";
                    code += `${indent}else:\n`;

                    let elseCode = "";
                    if (convergencePoint) {
                        const elseVisited = new Set([...visitedInPath]);
                        elseCode = this.compileNodeUntil(
                            noId,
                            convergencePoint,
                            elseVisited,
                            [...contextStack, `else_${node.id}`],
                            indentLevel + 1,
                            inLoopBody,
                            inLoopHeader
                        );

                    } else {
                        elseCode = this.compileNode(
                            noId,
                            visitedInPath,
                            [...contextStack, `else_${node.id}`],
                            indentLevel + 1,
                            inLoopBody,
                            inLoopHeader
                        );
                    }

                    // Use BreakManager to determine if break should be added
                    // Check both inLoopBody flag and contextStack for loop context
                    const elseContext = [...contextStack, `else_${node.id}`];
                    const loopHeader = this.findCurrentLoopHeader(elseContext);
                    if (inLoopBody || loopHeader) {
                        if (loopHeader) {
                            // Check if it's an implicit loop - if so, use while_true_with_breaks
                            let loopType = this.getLoopType(loopHeader);
                            if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeader)) {
                                loopType = 'while_true_with_breaks';
                            }

                            // Primary decision: BreakManager
                            let shouldBreak = this.breakManager.shouldAddBreak(
                                noId,
                                loopHeader,
                                elseContext,
                                loopType,
                                convergencePoint
                            );

                            // Fallback: structural check for "exit to END"
                            if (!shouldBreak) {
                                const exits = this.breakManager.branchReachesEnd(noId, loopHeader);
                                const loopsBack = this.breakManager.branchLoopsBackToHeader(noId, loopHeader);
                                if (exits && !loopsBack) {
                                    shouldBreak = true;
                                }
                            }

                            if (shouldBreak) {
                                if (!elseCode.endsWith("\n")) elseCode += "\n";
                                elseCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                            }
                        }
                    }


                    code += elseCode || `${indent}    pass\n`;
                }
            } else {
                // Simple else branch
                if (!code.endsWith("\n")) code += "\n";
                code += `${indent}else:\n`;

                let elseCode = "";
                if (convergencePoint) {
                    const elseVisited = new Set([...visitedInPath]);
                    elseCode = this.compileNodeUntil(
                        noId,
                        convergencePoint,
                        elseVisited,
                        [...contextStack, `else_${node.id}`],
                        indentLevel + 1,
                        inLoopBody,
                        inLoopHeader
                    );

                } else {
                    elseCode = this.compileNode(
                        noId,
                        visitedInPath,
                        [...contextStack, `else_${node.id}`],
                        indentLevel + 1,
                        inLoopBody,
                        inLoopHeader
                    );
                }

                // Use BreakManager to determine if break should be added
                // Check both inLoopBody flag and contextStack for loop context
                const elseContext = [...contextStack, `else_${node.id}`];
                const loopHeader = this.findCurrentLoopHeader(elseContext);
                if (inLoopBody || loopHeader) {
                    if (loopHeader) {
                        // Check if it's an implicit loop - if so, use while_true_with_breaks
                        let loopType = this.getLoopType(loopHeader);
                        if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeader)) {
                            loopType = 'while_true_with_breaks';
                        }

                        // Primary decision: BreakManager
                        let shouldBreak = this.breakManager.shouldAddBreak(
                            noId,
                            loopHeader,
                            elseContext,
                            loopType,
                            convergencePoint
                        );

                        // Fallback: structural check for "exit to END"
                        if (!shouldBreak) {
                            const exits = this.breakManager.branchReachesEnd(noId, loopHeader);
                            const loopsBack = this.breakManager.branchLoopsBackToHeader(noId, loopHeader);
                            if (exits && !loopsBack) {
                                shouldBreak = true;
                            }
                        }

                        if (shouldBreak) {
                            if (!elseCode.endsWith("\n")) elseCode += "\n";
                            elseCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                        }
                    }
                }

                code += elseCode || `${indent}    pass\n`;
            }
        }

        // AFTER the if / elif / else chain: Compile the convergence point
        if (convergencePoint) {
            if (!code.endsWith("\n")) code += "\n";
            code += this.compileNode(
                convergencePoint,
                visitedInPath,
                contextStack,
                indentLevel,
                inLoopBody,
                inLoopHeader
            );
        }

        return code;
    }

    /**
     * Find the current loop header from context stack
     */
    findCurrentLoopHeader(contextStack) {
        for (const ctx of contextStack) {
            if (ctx.startsWith('loop_')) {
                return ctx.replace('loop_', '');
            }
            if (ctx.startsWith('implicit_')) {
                return ctx.replace('implicit_', '');
            }
        }
        return null;
    }

    /**
     * Compile a node until reaching a stop point (exclusive)
     */
    compileNodeUntil(startId, stopId, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader) {
        if (!startId || startId === stopId) return "";

        // DO NOT compile loop headers inside decision branches
        const n = this.nodes.find(n => n.id === startId);
        if (n && n.type === "decision" && this.isLoopHeader(startId)) {
            const inImplicitLoop = contextStack.some(ctx => ctx.startsWith('implicit_'));
            if (!inImplicitLoop) {
                return "";
            }
        }

        const node = this.nodes.find(n => n.id === startId);
        if (!node) return "";

        // Prevent infinite recursion
        if (visitedInPath.has(startId)) return "";
        visitedInPath.add(startId);

        const indent = "    ".repeat(indentLevel);
        let code = "";

        // Add highlight
        if (this.useHighlighting) {
            code += this.emitHighlight(startId, indentLevel);
        }

        // Compile the node
        switch (node.type) {
            case "output":
                code += `${indent}print(${node.text})\n`;
                break;
            case "input": {
                const wrap = node.dtype === "int" ? "int(input(" : "input(";
                const varName = node.varName || "x";
                const prompt = node.prompt || '""';
                code += `${indent}${varName} = ${wrap}${prompt})\n`;
                if (node.dtype === "int") code = code.trimEnd() + ")\n";
                break;
            }
            case "decision":
                // Decisions inside a "compile until convergence" segment must compile as a full decision
                code += this.compileDecision(
                    node,
                    visitedInPath,
                    contextStack,
                    indentLevel,
                    inLoopBody,
                    inLoopHeader
                );
                return code; // decision compilation includes its own branch handling

            default:
                if (node.text) {
                    const lines = node.text.split('\n');
                    for (const line of lines) {
                        if (line.trim()) {
                            code += `${indent}${line}\n`;
                        }
                    }
                }
                break;
        }

        const nextId = this.getSuccessor(startId, 'next');

        // If we're inside a loop context, never walk back to a loop header.
        if (nextId && contextStack.some(ctx => ctx.startsWith("loop_") || ctx.startsWith("implicit_"))) {
            for (const ctx of contextStack) {
                const hdr = ctx.startsWith("loop_") ? ctx.replace("loop_", "") : ctx.replace("implicit_", "");
                if (nextId === hdr) {
                    return code; // stop before the back edge
                }
            }
        }

        if (nextId && nextId !== stopId) {
            code += this.compileNodeUntil(nextId, stopId, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader);
        }

        return code;
    }

    /**
     * Compile elif chain stopping at convergence point
     */
    compileElifChainUntil(elifNode, convergencePoint, visitedInPath, contextStack, indentLevel, inLoopBody, inLoopHeader) {
        let code = "";
        const indent = "    ".repeat(indentLevel);

        let currentElif = elifNode;
        const seen = new Set();

        while (currentElif && currentElif.type === 'decision') {
            if (seen.has(currentElif.id)) break;
            seen.add(currentElif.id);

            const elifYesId = this.getSuccessor(currentElif.id, 'yes');
            const elifNoId = this.getSuccessor(currentElif.id, 'no');

            code += `${indent}elif ${currentElif.text}:\n`;

            const elifContext = [...contextStack, `elif_${currentElif.id}`];
            const elifVisited = new Set([...visitedInPath]);

            // Compile YES branch up to convergence point
            let elifCode = this.compileNodeUntil(elifYesId, convergencePoint, elifVisited, elifContext, indentLevel + 1, inLoopBody, inLoopHeader);

            // Use BreakManager to determine if break should be added
            if (inLoopBody) {
                const loopHeaderId = this.findCurrentLoopHeader(contextStack);
                if (loopHeaderId) {
                    // Check if it's an implicit loop - if so, use while_true_with_breaks
                    let loopType = this.getLoopType(loopHeaderId);
                    if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                        loopType = 'while_true_with_breaks';
                    }
                    const shouldBreak = this.breakManager.shouldAddBreak(
                        elifYesId,
                        loopHeaderId,
                        contextStack,
                        loopType,
                        convergencePoint
                    );
                    if (shouldBreak) {
                        if (!elifCode.endsWith("\n")) elifCode += "\n";
                        elifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                    }
                }
            }

            code += elifCode || `${indent}    pass\n`;

            if (!elifNoId) break;

            const nextNode = this.nodes.find(n => n.id === elifNoId);

            // Another elif in the chain?
            if (nextNode && nextNode.type === 'decision') {
                currentElif = nextNode;
                continue;
            }

            // Final else clause
            if (!code.endsWith("\n")) code += "\n";
            code += `${indent}else:\n`;
            const elseVisited = new Set([...visitedInPath]);
            const elseCode = this.compileNodeUntil(
                elifNoId,
                convergencePoint,
                elseVisited,
                contextStack,
                indentLevel + 1,
                inLoopBody,
                inLoopHeader
            );

            // Use BreakManager to determine if break should be added
            if (inLoopBody) {
                const loopHeaderId = this.findCurrentLoopHeader(contextStack);
                if (loopHeaderId) {
                    // Check if it's an implicit loop - if so, use while_true_with_breaks
                    let loopType = this.getLoopType(loopHeaderId);
                    if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(loopHeaderId)) {
                        loopType = 'while_true_with_breaks';
                    }
                    const shouldBreak = this.breakManager.shouldAddBreak(
                        elifNoId,
                        loopHeaderId,
                        contextStack,
                        loopType,
                        convergencePoint
                    );
                    if (shouldBreak) {
                        if (!elseCode.endsWith("\n")) {
                            code += elseCode + "\n";
                        } else {
                            code += elseCode;
                        }
                        code += `${"    ".repeat(indentLevel + 1)}break\n`;
                    } else {
                        code += elseCode || `${indent}    pass\n`;
                    }
                } else {
                    code += elseCode || `${indent}    pass\n`;
                }
            } else {
                code += elseCode || `${indent}    pass\n`;
            }

            break;
        }

        return { code };
    }

    /**
     * Check if decisions form a linear chain (for elif)
     */
    isLinearDecisionChain(startDecisionId, parentDecisionId) {
        let currentId = startDecisionId;
        const visited = new Set();

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);

            const node = this.nodes.find(n => n.id === currentId);
            if (!node || node.type !== 'decision') return false;

            // Check if YES branch goes back to parent or is a decision
            const yesId = this.getSuccessor(currentId, 'yes');
            if (yesId === parentDecisionId) {
                return false;
            }

            const yesNode = yesId ? this.nodes.find(n => n.id === yesId) : null;
            if (yesNode && yesNode.type === 'decision') {
                return false;
            }

            // Move to NO branch
            const noId = this.getSuccessor(currentId, 'no');
            if (!noId) break;

            const noNode = this.nodes.find(n => n.id === noId);
            if (!noNode) break;

            if (noNode.type === 'decision') {
                currentId = noId;
            } else {
                break;
            }
        }

        return true;
    }
}

function generateCodeFromIR(irProgram, options = {}) {
    if (!irProgram || !irProgram.statements) {
        return "";
    }

    const lines = [];

    function emit(node, indent = 0) {
        if (!node) return;

        const pad = " ".repeat(indent);

        if (node.type === 'program' || node.statements) {
            const statements = node.statements || node.body?.statements || [];
            for (const stmt of statements) {
                emit(stmt, indent);
            }
            return;
        }

        switch (node.type) {
            case 'statement':
                if (node.statementType === 'assignment') {
                    if (node.content) lines.push(pad + node.content);
                } else if (node.statementType === 'print') {
                    if (node.content !== undefined) lines.push(pad + `print(${node.content})`);
                } else if (node.statementType === 'input') {
                    if (node.content) lines.push(pad + node.content);
                } else if (node.statementType === 'pass') {
                    lines.push(pad + 'pass');
                } else {
                    if (node.content) lines.push(pad + node.content);
                }
                break;

            case 'if':
                lines.push(pad + `if ${node.condition || 'True'}:`);
                if (node.thenBranch) {
                emit(node.thenBranch, indent + 4);
                } else {
                    lines.push(pad + "    pass");
                }
                if (node.elseBranch) {
                    // Check if elseBranch is another if statement (elif chain)
                    if (node.elseBranch.type === 'if') {
                        lines.push(pad + `elif ${node.elseBranch.condition || 'True'}:`);
                        if (node.elseBranch.thenBranch) {
                            emit(node.elseBranch.thenBranch, indent + 4);
                        } else {
                            lines.push(pad + "    pass");
                        }
                        // Handle nested elif chains
                        let currentElif = node.elseBranch.elseBranch;
                        while (currentElif && currentElif.type === 'if') {
                            lines.push(pad + `elif ${currentElif.condition || 'True'}:`);
                            if (currentElif.thenBranch) {
                                emit(currentElif.thenBranch, indent + 4);
                            } else {
                                lines.push(pad + "    pass");
                            }
                            currentElif = currentElif.elseBranch;
                        }
                        // Final else if it exists
                        if (currentElif) {
                            lines.push(pad + `else:`);
                            emit(currentElif, indent + 4);
                        }
                    } else {
                    lines.push(pad + `else:`);
                    emit(node.elseBranch, indent + 4);
                    }
                }
                // Emit code after the if statement (convergence point)
                if (node.next) {
                    emit(node.next, indent);
                }
                break;

            case 'while':
                if (node.loopType === 'while_true') {
                    lines.push(pad + `while True:`);
                } else {
                    lines.push(pad + `while ${node.condition || 'True'}:`);
                }
                emit(node.body, indent + 4);
                break;

            case 'for':
                // Include step parameter if it's not the default (1 for ascending)
                // For descending loops, step will be negative (e.g., -1, -2) and must be included
                const oldForStep = node.step ?? 1;
                const oldStepStr = oldForStep !== 1 ? `, ${oldForStep}` : '';
                lines.push(pad + `for ${node.variable || 'i'} in range(${node.start ?? 0}, ${node.end ?? 10}${oldStepStr}):`);
                emit(node.body, indent + 4);
                break;

            case 'break':
                lines.push(pad + `break`);
                break;

            case 'continue':
                lines.push(pad + `continue`);
                break;

            default:
                console.warn(`Unknown IR node type: ${node.type}`);
        }
    }

    emit(irProgram, 0, true);  // Top level - track emitted IDs to prevent duplicates
    return lines.join("\n");
}

// Ensure compileWithPipeline is defined (like in old compiler)
try {
    window.compileWithPipeline = function (nodes, connections, useHighlighting, debugMode = false) {
        // Use the old FlowchartCompiler which has all the latest fixes
        // (implicit loop detection, break management, etc.)
        const compiler = new FlowchartCompiler(nodes, connections, useHighlighting, debugMode);
        return compiler.compile();
    };

window.FlowchartCompiler = FlowchartCompiler;

    console.log('Compiler exports successful');
} catch (e) {
    console.error('Error setting up compiler exports:', e);
}
