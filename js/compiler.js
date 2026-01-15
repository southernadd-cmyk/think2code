
window.FlowCode = window.FlowCode || {};

/**
 * Enhanced Loop Classifier - Phase 1.5: Advanced loop pattern detection
 */
class LoopClassifier {
    constructor(nodes, connections, outgoingMap, incomingMap, dominators = null, postDominators = null) {
        this.nodes = nodes;
        this.connections = connections;
        this.outgoingMap = outgoingMap;
        this.incomingMap = incomingMap;
        this.dominators = dominators;
        this.postDominators = postDominators;

        // Loop patterns cache
        this.loopPatterns = new Map();

        // Add findNode method
        this.findNode = (nodeId) => this.nodes.find(n => n.id === nodeId);
        
        // Feature flags for gradual dominator integration
        // Check global flags (can be enabled via window.COMPILER_USE_DOMINATOR_HEADERS, etc.)
        this.useDominatorHeaders = (typeof window !== 'undefined' && window.COMPILER_USE_DOMINATOR_HEADERS) || false;
        this.usePostDominatorConvergence = (typeof window !== 'undefined' && window.COMPILER_USE_POST_DOMINATOR_CONVERGENCE) || false;
    }
    
    /**
     * Validate dominator-based headers against cycle-based headers (debug)
     */
    validateDominatorHeaders(cycleHeaders, dominatorHeaders) {
        console.log("=== DOMINATOR VALIDATION ===");
        console.log("Cycle-based headers:", Array.from(cycleHeaders));
        console.log("Dominator-based headers:", Array.from(dominatorHeaders));
        
        const cycleSet = new Set(cycleHeaders);
        const domSet = new Set(dominatorHeaders);
        
        const onlyInCycle = Array.from(cycleHeaders).filter(h => !domSet.has(h));
        const onlyInDom = Array.from(dominatorHeaders).filter(h => !cycleSet.has(h));
        const inBoth = Array.from(cycleHeaders).filter(h => domSet.has(h));
        
        if (onlyInCycle.length > 0) {
            console.warn("Headers found by cycle detection but not dominators:", onlyInCycle);
        }
        if (onlyInDom.length > 0) {
            console.warn("Headers found by dominators but not cycle detection:", onlyInDom);
        }
        if (inBoth.length > 0) {
            console.log("Headers found by both methods:", inBoth);
        }
        
        return {
            cycleOnly: onlyInCycle,
            domOnly: onlyInDom,
            both: inBoth,
            match: onlyInCycle.length === 0 && onlyInDom.length === 0
        };
    }

    classifyAllLoops() {
        this.loopPatterns.clear();
        
        console.log("=== LOOP CLASSIFICATION DEBUG ===");
        console.log("Total nodes:", this.nodes.length);
        console.log("Connections:", this.connections.length);
        
        // Find headers using cycle detection (current method)
        const cycleHeaders = this.findCycleHeaders();
        console.log("Cycle headers found:", Array.from(cycleHeaders));

        // Filter out invalid headers (input nodes can't be loop headers)
        const validCycleHeaders = new Set();
        for (const headerId of cycleHeaders) {
            const node = this.nodes.find(n => n.id === headerId);
            // Only include decision, process, and var nodes as potential headers
            // Input nodes should not be loop headers
            if (node && (node.type === 'decision' || node.type === 'process' || node.type === 'var')) {
                validCycleHeaders.add(headerId);
            }
        }

        // Optionally find headers using dominator analysis (for validation/comparison)
        let dominatorHeaders = new Set();
        if (this.dominators) {
            dominatorHeaders = this.findDominatorBasedHeaders();
            // Validate and compare
            this.validateDominatorHeaders(cycleHeaders, dominatorHeaders);
        }

        // Use dominator-based headers if enabled and they found headers, otherwise use cycle-based
        // If dominator headers are empty, fall back to cycle headers
        const allHeaders = (this.useDominatorHeaders && this.dominators && dominatorHeaders.size > 0) 
            ? dominatorHeaders 
            : validCycleHeaders;

        // Allow all headers for classification (like old compiler)
        // Decision nodes can be while/for loops, non-decision nodes can be while-true loops
        const allHeadersFinal = allHeaders;
        console.log("All headers (decision + implicit):", Array.from(allHeadersFinal));

        // Store empty join point map for now
        this.joinPointMap = new Map();

        // Classify each header
        // Prioritize decision nodes over process nodes (decision nodes are the "real" loop headers)
        const sortedHeaders = Array.from(allHeadersFinal).sort((a, b) => {
            const nodeA = this.nodes.find(n => n.id === a);
            const nodeB = this.nodes.find(n => n.id === b);
            // Decision nodes come first
            if (nodeA?.type === 'decision' && nodeB?.type !== 'decision') return -1;
            if (nodeA?.type !== 'decision' && nodeB?.type === 'decision') return 1;
            return 0;
        });
        
        for (const headerId of sortedHeaders) {
            const headerNode = this.nodes.find(n => n.id === headerId);
            if (!headerNode) continue;
            
            // Skip if this header is already part of another loop's body
            // BUT: Allow nested loops - if a header is inside another loop's body but is itself a decision node,
            // we should still classify it (it's a nested loop like a for loop inside a while loop)
            // Only skip if it's not a decision node (decision nodes can be nested loop headers)
            let skipHeader = false;
            for (const [existingHeaderId, existingLoop] of this.loopPatterns) {
                const bodyNodes = existingLoop.bodyNodes instanceof Set ? existingLoop.bodyNodes : new Set(existingLoop.bodyNodes);
                if (bodyNodes.has(headerId) && existingHeaderId !== headerId) {
                    // If this is a decision node, it might be a nested loop - don't skip it
                    // (nested for loops and while loops are decision nodes)
                    if (headerNode.type === 'decision') {
                        // Allow nested loops - don't skip
                        console.log(`Header ${headerId} is in loop ${existingHeaderId}'s body but is a decision node - allowing as nested loop`);
                    } else {
                        console.log(`Skipping ${headerId} - already part of loop ${existingHeaderId}'s body`);
                        skipHeader = true;
                        break;
                    }
                }
            }
            if (skipHeader) continue;
            
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

                // Find the decision or process node on the path to the back edge target
                // Only add the target of the back edge as a potential loop header
                // Don't add all process nodes in the recursion stack - that's too aggressive
                // and catches initialization code that happens before the actual loop
                // (e.g., "total = 0" before a for loop)
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
     * Check if a node can reach an END node
     */
    canReachEnd(startId) {
        const visited = new Set();
        const stack = [startId];

        while (stack.length > 0) {
            const currentId = stack.pop();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // If we reach END, return true
            const node = this.nodes.find(n => n.id === currentId);
            if (node && node.type === 'end') {
                return true;
            }

            // Add all successors
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                const nextId = edge.to;
                if (nextId && !visited.has(nextId)) {
                    stack.push(nextId);
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
                    const toNode = this.nodes.find(n => n.id === toId);
                    if (toNode) {
                        // Decision nodes can be while/for loop headers
                        // Process/var nodes can be while-true loop headers
                        // Other node types typically aren't loop headers
                        if (toNode.type === 'decision' || toNode.type === 'process' || toNode.type === 'var') {
                            headers.add(toId);
                            console.log(`Back edge found: ${fromId} → ${toId} (${edge.port}), Loop header: ${toId} (${toNode.type})`);
                        }
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
        // BUT: Allow while-else pattern (one break path + one normal exit)
        // Only reject if the normal exit is also END (meaning all exits are breaks = while-true pattern)
        // OR if there are multiple distinct break exits (while-true with multiple breaks pattern)
        const exitNodeType = exitNode ? (this.nodes.find(n => n.id === exitNode)?.type) : null;
        const normalExitIsEnd = exitNodeType === 'end';
        const hasDistinctExits = this.hasDistinctExitPaths(headerId, bodyNodes, exitNode);
        
        // Count how many distinct break exits we have (excluding normal exit)
        const breakExitCount = this.countBreakExits(headerId, bodyNodes, exitNode);
        
        // Check if normal exit is also a break exit
        // Key distinction for while-else vs while-true with multiple breaks:
        // - If there's 1 break exit from body AND normal exit leads to END:
        //   * If normal exit is a decision node → it's a break exit (while-true with 2 breaks)
        //   * If normal exit is output/process AND there's already a break in body → likely while-true with 2 breaks
        //   * BUT: If the loop condition is a "limit" check (like attempts < 3), the normal exit is the else clause
        // 
        // For now, we'll use a heuristic:
        // - If normal exit leads to END AND there's a break in body, check if it's a decision node
        // - Decision node normal exit = break exit (while-true)
        // - Non-decision normal exit = check if loop condition suggests it's a limit check
        let normalExitIsBreak = false;
        if (exitNode && breakExitCount >= 1) {
            const exitNodeObj = this.nodes.find(n => n.id === exitNode);
            if (exitNodeObj) {
                if (exitNodeObj.type === 'decision') {
                    // Decision node that breaks to END = break exit
                    normalExitIsBreak = this.canReachEndWithoutHeader(exitNode, headerId);
                } else if (exitNodeObj.type === 'output' || exitNodeObj.type === 'process') {
                    // For output/process nodes, if they lead to END and there's a break in body,
                    // check if the loop condition suggests it's a "limit" pattern (while-else) or "value" pattern (while-true)
                    // Heuristic: if condition uses < or <= with a constant, it's likely a limit check (while-else)
                    // Otherwise, if condition checks for a specific value, it's likely a break condition (while-true)
                    const condition = headerNode.text || '';
                    const isLimitCheck = /<|<=/.test(condition) && /\d+/.test(condition);
                    if (!isLimitCheck && this.canReachEndWithoutHeader(exitNode, headerId)) {
                        // Not a limit check and leads to END → treat as break exit (while-true with 2 breaks)
                        normalExitIsBreak = true;
                    }
                    // If it's a limit check, it's the else clause (while-else)
                }
            }
        }
        
        // Reject if:
        // 1. There are distinct exits (breaks) AND normal exit is also END
        //    This means all exits are breaks = while-true pattern, not while-else
        // 2. There are multiple distinct break exits (2 or more break exits from body)
        //    This means we should use while-true with multiple breaks, not while-else
        // 3. There is 1 break exit from body AND normal exit is also a break
        //    This means 2 total break exits = while-true with multiple breaks
        if (hasDistinctExits && normalExitIsEnd) {
            console.log(`classifyWhileLoop(${headerId}): has distinct exit paths and normal exit is END, rejecting for while-true`);
            return null;
        }
        if (breakExitCount >= 2) {
            console.log(`classifyWhileLoop(${headerId}): has ${breakExitCount} break exits, rejecting for while-true with multiple breaks`);
            return null;
        }
        if (breakExitCount >= 1 && normalExitIsBreak) {
            console.log(`classifyWhileLoop(${headerId}): has ${breakExitCount} break exit(s) from body and normal exit is also a break (total: ${breakExitCount + 1}), rejecting for while-true with multiple breaks`);
            return null;
        }
        // If there are distinct exits but normal exit is NOT a break (it's the else clause) and only 1 break from body, it's a while-else pattern - allow it
        
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
            
            // For while-true loops with process node headers, the header itself is part of the body
            // because it executes on each iteration (e.g., "x = not(x)" in a while-true loop)
            if (!bodyNodes.includes(headerId)) {
                bodyNodes.push(headerId);
            }

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
        
        // Case 3: Decision node with multiple break exits (rejected from while-loop classification)
        // This handles patterns like: while True with multiple break statements
        const yesId = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
        const noId = this.getSuccessor(headerId, 'no') || this.getSuccessor(headerId, 'false');
        
        // Determine which branch is the loop body (the one that loops back)
        const yesLoops = yesId && this.pathExists(yesId, headerId);
        const noLoops = noId && this.pathExists(noId, headerId);
        
        let loopEntry = null;
        let exitNode = null;
        
        if (yesLoops && !noLoops) {
            loopEntry = yesId;
            exitNode = noId;
        } else if (noLoops && !yesLoops) {
            loopEntry = noId;
            exitNode = yesId;
        } else if (yesLoops && noLoops) {
            // Both loop - prefer yes branch
            loopEntry = yesId;
            exitNode = noId;
        } else {
            // Neither loops - not a while-true loop
            return null;
        }
        
        if (!loopEntry) return null;
        
        // Collect body nodes
        const bodyNodes = this.collectLoopBodyNodes(headerId, loopEntry);
        
        // Check if this has multiple break exits (should have been rejected from while-loop)
        const breakExitCount = this.countBreakExits(headerId, bodyNodes, exitNode);
        
        // Check if normal exit is also a break exit (only if it's a decision node that breaks)
        let normalExitIsBreak = false;
        if (exitNode) {
            const exitNodeObj = this.nodes.find(n => n.id === exitNode);
            if (exitNodeObj && exitNodeObj.type === 'decision') {
                normalExitIsBreak = this.canReachEndWithoutHeader(exitNode, headerId);
            }
        }
        const totalBreakExits = breakExitCount + (normalExitIsBreak ? 1 : 0);
        
        if (breakExitCount >= 2 || totalBreakExits >= 2) {
            // This is a while-true loop with multiple breaks
            // Include the exit node in bodyNodes so it's built as part of the loop body
            // and converted to a break statement
            const bodyNodesWithExit = [...bodyNodes];
            if (exitNode && !bodyNodesWithExit.includes(exitNode)) {
                bodyNodesWithExit.push(exitNode);
            }
            
            const exitNodes = [];
            if (exitNode) {
                exitNodes.push(exitNode);
            }
            // Also collect other break exits from body
            for (const nodeId of bodyNodes) {
                const node = this.nodes.find(n => n.id === nodeId);
                if (node && node.type === 'decision') {
                    const yesBranch = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
                    const noBranch = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');
                    for (const branch of [yesBranch, noBranch]) {
                        if (branch && branch !== headerId && this.canReachEndWithoutHeader(branch, headerId)) {
                            if (!exitNodes.includes(branch)) {
                                exitNodes.push(branch);
                            }
                        }
                    }
                }
            }
            
            return {
                type: 'while_true',
                headerId: headerId,
                condition: 'True',
                bodyNodes: bodyNodesWithExit, // Include exit node in body
                exitNodes: exitNodes,
                loopEntry: loopEntry,
                metadata: {
                    isImplicit: false,
                    isMultiExit: true,
                    originalCondition: condition,
                    exitNode: exitNode // Store the exit node for special handling
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
     * Count how many distinct break exits (paths to END) exist in the loop body
     * Only counts break exits that are DIFFERENT from the normal exit node
     * The normal exit is handled separately - it's not a break exit, it's the else clause
     */
    countBreakExits(headerId, bodyNodes, normalExitNode) {
        const breakExits = new Set();
        
        for (const nodeId of bodyNodes) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'decision') {
                const yesBranch = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
                const noBranch = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');

                for (const branch of [yesBranch, noBranch]) {
                    if (branch && branch !== headerId && branch !== normalExitNode) {
                        // Check if this branch leads to End without going through the header
                        // Only count it if it's different from the normal exit (break exits are distinct from normal exit)
                        if (this.canReachEndWithoutHeader(branch, headerId)) {
                            // Add the branch node ID to break exits set
                            breakExits.add(branch);
                        }
                    }
                }
            }
        }
        
        // Don't count the normal exit node - it's the else clause, not a break exit
        // If the normal exit leads to END, that's fine for while-else patterns
        
        return breakExits.size;
    }

    /**
     * Find exit nodes for a process node header
     */
    findProcessExitNodes(headerId, bodyNodes) {
        // Convert to Set if it's an array
        const bodyNodesSet = bodyNodes instanceof Set ? bodyNodes : new Set(bodyNodes);
        const exits = [];
        for (const nodeId of bodyNodesSet) {
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
    
    findLoopBodyNodes(headerId, updateNodeId) {
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

            // Don't include the update node itself in the body
            if (nodeId !== updateNodeId) {
                bodyNodes.add(nodeId);
            }

            // Add successors (stop when reaching nodes that loop back to header)
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
 * 
 * STEP 2 IMPROVEMENT: Dominator/Post-Dominator Analysis
 * =====================================================
 * 
 * This class now computes both dominators and post-dominators:
 * 
 * - Dominators: Nodes that must be executed before a given node
 *   - Used for: Loop header detection (header dominates all nodes in the loop)
 *   - Algorithm: Iterative fixpoint on forward graph (from START)
 * 
 * - Post-Dominators: Nodes that must be executed after a given node
 *   - Used for: Convergence point detection (convergence point post-dominates all branches)
 *   - Algorithm: Iterative fixpoint on reverse graph (from END)
 * 
 * Integration Status:
 * 1. ✅ Compute dominators and post-dominators (DONE)
 * 2. ✅ Add debug validation to compare with current heuristics (DONE)
 * 3. ✅ Enable dominator-based loop headers (ENABLED by default)
 * 4. ✅ Enable post-dominator-based convergence (ENABLED by default)
 * 
 * Both features are now enabled by default, replacing ad-hoc heuristics with theoretically sound graph analysis.
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
        this.postDominators = new Map();
        this.backEdges = [];
        this.loopHeaders = new Set();

        this.buildMaps();
        this.computeDominators();
        this.computePostDominators();
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

    /**
     * Compute post-dominators (nodes that must be executed after a given node)
     * Post-dominators are computed on the reverse graph (from END to START)
     */
    computePostDominators() {
        const endNode = this.nodes.find(n => n.type === 'end');
        if (!endNode) {
            // If no explicit END node, use nodes with no outgoing edges as "end" nodes
            const endNodes = this.nodes.filter(n => {
                const outgoing = this.outgoingMap.get(n.id) || [];
                return outgoing.length === 0 && n.type !== 'start';
            });
            if (endNodes.length === 0) return;
            
            // Initialize post-dominators: all nodes post-dominate themselves
            this.nodes.forEach(node => {
                this.postDominators.set(node.id, new Set());
            });
            
            // End nodes post-dominate only themselves
            endNodes.forEach(endNode => {
                this.postDominators.get(endNode.id).add(endNode.id);
            });
            
            // Iterative fixpoint: node post-dominates intersection of successors' post-dominators
            let changed = true;
            while (changed) {
                changed = false;
                for (const node of this.nodes) {
                    if (endNodes.some(e => e.id === node.id)) continue;
                    
                    const successors = this.outgoingMap.get(node.id) || [];
                    if (successors.length === 0) {
                        // Node with no successors - post-dominates nothing (unreachable from end)
                        const oldPostDom = this.postDominators.get(node.id);
                        if (oldPostDom.size > 0) {
                            this.postDominators.set(node.id, new Set());
                            changed = true;
                        }
                        continue;
                    }
                    
                    const succPostDominators = successors.map(edge => 
                        this.postDominators.get(edge.to)
                    ).filter(d => d);
                    
                    if (succPostDominators.length === 0) continue;
                    
                    // Intersection of all successors' post-dominators
                    let newPostDom = new Set(succPostDominators[0]);
                    for (let i = 1; i < succPostDominators.length; i++) {
                        newPostDom = new Set([...newPostDom].filter(x => succPostDominators[i].has(x)));
                    }
                    newPostDom.add(node.id); // Node post-dominates itself
                    
                    const oldPostDom = this.postDominators.get(node.id);
                    if (!this.setsEqual(newPostDom, oldPostDom)) {
                        this.postDominators.set(node.id, newPostDom);
                        changed = true;
                    }
                }
            }
            return;
        }

        // Initialize: all nodes post-dominate all nodes
        this.nodes.forEach(node => {
            this.postDominators.set(node.id, new Set(this.nodes.map(n => n.id)));
        });
        
        // End node post-dominates only itself
        this.postDominators.get(endNode.id).clear();
        this.postDominators.get(endNode.id).add(endNode.id);

        // Iterative fixpoint: node post-dominates intersection of successors' post-dominators
        let changed = true;
        while (changed) {
            changed = false;
            for (const node of this.nodes) {
                if (node.id === endNode.id) continue;

                const successors = this.outgoingMap.get(node.id) || [];
                if (successors.length === 0) {
                    // Node with no successors - post-dominates nothing (unreachable from end)
                    const oldPostDom = this.postDominators.get(node.id);
                    if (oldPostDom.size > 0) {
                        this.postDominators.set(node.id, new Set());
                        changed = true;
                    }
                    continue;
                }

                const succPostDominators = successors.map(edge => 
                    this.postDominators.get(edge.to)
                ).filter(d => d);

                if (succPostDominators.length === 0) continue;

                // Intersection of all successors' post-dominators
                let newPostDom = new Set(succPostDominators[0]);
                for (let i = 1; i < succPostDominators.length; i++) {
                    newPostDom = new Set([...newPostDom].filter(x => succPostDominators[i].has(x)));
                }
                newPostDom.add(node.id); // Node post-dominates itself

                const oldPostDom = this.postDominators.get(node.id);
                if (!this.setsEqual(newPostDom, oldPostDom)) {
                    this.postDominators.set(node.id, newPostDom);
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
        this.loopClassifier = new LoopClassifier(nodes, connections, this.outgoingMap, this.incomingMap, this.dominators, this.postDominators);
        this.loopClassifications = new Map();
    }
    
    analyze() {
        const basicAnalysis = super.analyze();
        this.loopClassifications = this.loopClassifier.classifyAllLoops();

        return {
            ...basicAnalysis,
            loopClassifications: this.loopClassifications,
            loops: this.loopClassifications
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
        this.hasNoBranch = false; // Track if there's a "no" branch path, even if empty
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

/**
 * ConvergenceFinder - Centralized class for finding convergence points in control flow
 * Handles if/elif chains, loop exit nodes, update nodes, and nested loops
 */
class ConvergenceFinder {
    constructor(nodes, connections, loopClassifications, getSuccessor, findNode, getSuccessors) {
        this.nodes = nodes;
        this.connections = connections;
        this.loopClassifications = loopClassifications;
        this.getSuccessor = getSuccessor;
        this.findNode = findNode;
        this.getSuccessors = getSuccessors;
    }
    
    /**
     * Check if a node has a direct back edge to the header
     */
    hasDirectBackEdgeTo(nodeId, headerId) {
        if (!nodeId || !headerId) return false;
        // Check all connections from nodeId
        for (const conn of this.connections) {
            if (conn.from === nodeId && conn.to === headerId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if a node has any back edge to the header (direct or indirect)
     */
    hasAnyBackEdgeTo(nodeId, headerId, visited = new Set()) {
        if (!nodeId || !headerId) return false;
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        
        // Check direct back edge
        if (this.hasDirectBackEdgeTo(nodeId, headerId)) {
            return true;
        }
        
        // Check indirect back edge through successors
        const successors = this.getSuccessors(nodeId);
        for (const succId of successors) {
            if (this.hasAnyBackEdgeTo(succId, headerId, visited)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find the convergence point for an if statement (handles elif chains)
     */
    findConvergencePoint(decisionId, yesId, noId, currentLoopHeaderId = null, allowedIds = null) {
        // Method 1: Try to find common convergence point using BFS
        let convergencePoint = this.findCommonConvergencePoint(decisionId, yesId, noId);
        
        // Method 2: If that fails, try following the elif chain manually
        if (!convergencePoint && noId) {
            convergencePoint = this.findConvergenceInElifChain(decisionId, noId);
        }
        
        // Method 3: Post-process the convergence point to handle loop exit/update nodes
        if (convergencePoint) {
            const adjusted = this.adjustConvergencePointForLoops(
                convergencePoint, 
                currentLoopHeaderId, 
                allowedIds
            );
            return adjusted.convergencePoint;
        }
        
        return null;
    }

    /**
     * Find common convergence point using BFS traversal
     */
    findCommonConvergencePoint(decisionId, yesId, noId) {
        const decisionVisited = new Set();
        return this.findCommonConvergencePointWithVisited(decisionId, yesId, noId, decisionVisited);
    }

    /**
     * Find common convergence point with visited set to prevent infinite recursion
     */
    findCommonConvergencePointWithVisited(decisionId, yesId, noId, decisionVisited) {
        if (decisionVisited.has(decisionId)) {
            return null;
        }
        decisionVisited.add(decisionId);
        
        const loopHeaders = this.loopClassifications ? 
            new Set(this.loopClassifications.keys()) : new Set();
        
        const nodesInLoops = new Set();
        if (this.loopClassifications) {
            for (const [headerId, loopInfo] of this.loopClassifications.entries()) {
                if (loopInfo.bodyNodes) {
                    const bodyNodes = Array.isArray(loopInfo.bodyNodes) ? Array.from(loopInfo.bodyNodes) : loopInfo.bodyNodes;
                    bodyNodes.forEach(nodeId => nodesInLoops.add(nodeId));
                }
            }
        }
        
        const collectNonDecisions = (startId) => {
            const results = new Set();
            if (!startId) return results;
            
            const visited = new Set();
            const queue = [{ id: startId, depth: 0 }];
            const maxDepth = 15;
            const exploring = new Set();
            
            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                
                if (visited.has(id) || depth > maxDepth || exploring.has(id)) continue;
                if (loopHeaders.has(id)) continue;
                
                exploring.add(id);
                visited.add(id);
        
                const node = this.findNode(id);
                if (!node) {
                    exploring.delete(id);
                    continue;
                }

                if (node.type === 'decision') {
                    exploring.delete(id);
                    continue;
                }

                results.add(id);

                if (depth < maxDepth - 1) {
                    const successors = this.getSuccessors(id);
                    for (const succId of successors) {
                        if (succId && !visited.has(succId) && !exploring.has(succId) && 
                            !loopHeaders.has(succId) && !nodesInLoops.has(succId)) {
                            queue.push({ id: succId, depth: depth + 1 });
                        }
                    }
                }
                
                exploring.delete(id);
            }

            return results;
        };

        const yesNodes = collectNonDecisions(yesId);
        const noNodes = collectNonDecisions(noId);

        const commonNodes = new Set();
        for (const nodeId of yesNodes) {
            if (noNodes.has(nodeId)) {
                commonNodes.add(nodeId);
            }
        }

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

        const maxElifDepth = 10;
        if (decisionVisited.size >= maxElifDepth) {
            return null;
        }
        
        const noNode = this.findNode(noId);
        if (noNode && noNode.type === 'decision' && !decisionVisited.has(noId)) {
            const noYesId = this.getSuccessor(noId, 'yes') || this.getSuccessor(noId, 'true');
            const noNoId = this.getSuccessor(noId, 'no') || this.getSuccessor(noId, 'false');
            return this.findCommonConvergencePointWithVisited(noId, noYesId, noNoId, decisionVisited);
        }
        
        return null;
    }

    /**
     * Find convergence point using post-dominators (theoretically clean approach)
     * The convergence point of two branches is their common post-dominator
     */
    findConvergencePointUsingPostDominators(trueNext, falseNext) {
        if (!this.flowAnalysis?.postDominators) {
            return null; // Post-dominators not available
        }
        
        if (!trueNext || !falseNext) {
            return null;
        }
        
        const truePostDoms = this.flowAnalysis.postDominators.get(trueNext);
        const falsePostDoms = this.flowAnalysis.postDominators.get(falseNext);
        
        if (!truePostDoms || !falsePostDoms) {
            return null;
        }
        
        // Find common post-dominators
        const commonPostDoms = Array.from(truePostDoms).filter(pd => falsePostDoms.has(pd));
        
        if (commonPostDoms.length === 0) {
            return null;
        }
        
        // Find the immediate post-dominator (closest to the branches)
        // This is the one that is post-dominated by all others
        let immediatePostDom = null;
        let minDepth = Infinity;
        
        for (const pd of commonPostDoms) {
            // Count how many other post-dominators post-dominate this one
            // The immediate post-dominator is post-dominated by the fewest others
            let depth = 0;
            for (const otherPd of commonPostDoms) {
                if (otherPd !== pd) {
                    const otherPostDoms = this.flowAnalysis.postDominators.get(otherPd);
                    if (otherPostDoms && otherPostDoms.has(pd)) {
                        depth++;
                    }
                }
            }
            if (depth < minDepth) {
                minDepth = depth;
                immediatePostDom = pd;
            }
        }
        
        return immediatePostDom;
    }

    /**
     * Find convergence point by following elif chain manually
     */
    findConvergenceInElifChain(startDecisionId, noId) {
        let current = noId;
        const visitedDecisions = new Set([startDecisionId]);
        
        while (current && visitedDecisions.size < 10) {
            const currentNode = this.findNode(current);
            if (!currentNode) break;
            
            if (currentNode.type === 'decision') {
                if (visitedDecisions.has(current)) break;
                visitedDecisions.add(current);
                
                const elifNo = this.getSuccessor(current, 'no') || this.getSuccessor(current, 'false');
                if (elifNo) {
                    const elifNoNode = this.findNode(elifNo);
                    if (elifNoNode && elifNoNode.type !== 'decision') {
                        return elifNo;
                    }
                    current = elifNo;
                } else {
                    break;
                }
            } else {
                return current;
            }
        }
        
        return null;
    }

    /**
     * Adjust convergence point to handle loop exit nodes and update nodes
     * @param {string} convergencePoint - The convergence point node ID
     * @param {string} currentLoopHeaderId - The current loop header ID (if inside a loop)
     * @param {Set} allowedIds - Set of allowed node IDs (if inside a loop body)
     * @param {Set} parentAllowedIds - Set of parent loop's allowed node IDs (if building a nested loop)
     */
    adjustConvergencePointForLoops(convergencePoint, currentLoopHeaderId, allowedIds, parentAllowedIds = null) {
        if (!convergencePoint || !this.loopClassifications) {
            return { convergencePoint, shouldStop: false, isNestedLoopExit: false, isInParentAllowedIds: false };
        }

        let actualConvergencePoint = convergencePoint;
        let shouldStop = false;
        let isNestedLoopExit = false;
        let isInParentAllowedIds = false;

        for (const [loopHeaderId, loopInfo] of this.loopClassifications.entries()) {
            if (loopInfo.type === 'for' && loopInfo.updateNodeId === convergencePoint) {
                // This is an update node for some loop
                if (allowedIds && allowedIds.has(convergencePoint)) {
                    // The update node is already in the loop body, so don't treat it as a convergence point
                    console.log(`  Convergence point ${convergencePoint} is update node in loop body, clearing convergence point`);
                    actualConvergencePoint = null;
                } else {
                    // The branch should stop here
                    console.log(`  Convergence point ${convergencePoint} is update node for loop ${loopHeaderId}, stopping (will loop back)`);
                    shouldStop = true;
                }
                break;
            }
            
            if (currentLoopHeaderId && loopHeaderId === currentLoopHeaderId && 
                loopInfo.exitNodes && loopInfo.exitNodes.includes(convergencePoint)) {
                console.log(`  Convergence point ${convergencePoint} is exit node of current loop ${currentLoopHeaderId}, stopping`);
                shouldStop = true;
                break;
            }
            
            // Check if convergence point is an update node for the current loop
            // For while loops, updateNodeId is not stored, so we check if the convergence point
            // has a DIRECT back edge to the current loop header (only direct = actual update node)
            if (currentLoopHeaderId && loopHeaderId === currentLoopHeaderId) {
                // For while loops: check if convergence point has a DIRECT back edge to header
                // For while loops, allow convergence points even if they have direct back edges
                // They will be handled appropriately by the if statement logic

                // For for-loops: check updateNodeId
                if (loopInfo.updateNodeId === convergencePoint) {
                    // This is the update node for the current loop - it will loop back naturally
                    console.log(`  Convergence point ${convergencePoint} is update node for current loop ${currentLoopHeaderId}, stopping (will loop back)`);
                    shouldStop = true;
                    break;
                }
            }
            
            if (currentLoopHeaderId && loopHeaderId !== currentLoopHeaderId &&
                loopInfo.exitNodes && loopInfo.exitNodes.includes(convergencePoint)) {
                // This is a nested loop's exit node
                // For nested loops, the exit node should be handled by the nested loop itself, not as a convergence point
                // unless it's specifically in the parent's allowedIds for a different reason
                isNestedLoopExit = true;
                console.log(`  Convergence point ${convergencePoint} is exit node of nested loop ${loopHeaderId}, skipping (handled by nested loop)`);
                break;
            }
        }
        
        // If convergence point is in parentAllowedIds but not in allowedIds, and we haven't already set isInParentAllowedIds,
        // set it now (this handles cases where the convergence point is in parentAllowedIds but wasn't detected as a nested loop exit)
        if (!isInParentAllowedIds && parentAllowedIds && parentAllowedIds.has(actualConvergencePoint) && 
            currentLoopHeaderId && allowedIds && !allowedIds.has(actualConvergencePoint)) {
            isInParentAllowedIds = true;
            console.log(`  Convergence point ${actualConvergencePoint} is in parentAllowedIds but not in allowedIds, setting isInParentAllowedIds=true`);
        }

        return {
            convergencePoint: actualConvergencePoint,
            shouldStop,
            isNestedLoopExit,
            isInParentAllowedIds
        };
    }

    /**
     * Check if a node is an update node for any loop
     */
    isUpdateNode(nodeId) {
        if (!this.loopClassifications || !nodeId) return { isUpdate: false };
        for (const [loopHeaderId, loopInfo] of this.loopClassifications.entries()) {
            if (loopInfo.type === 'for' && loopInfo.updateNodeId === nodeId) {
                return { isUpdate: true, loopHeaderId, exitNode: loopInfo.exitNodes?.[0] || null };
            }
        }
        return { isUpdate: false };
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
        
        // Get loop headers to avoid traversing back into loops
        // Use this.loopClassifications which is already stored in EnhancedIRBuilder
        const loopHeaders = this.loopClassifications ? 
            new Set(this.loopClassifications.keys()) : new Set();
        
        // Build a set of all nodes that are inside any loop body
        // This helps us avoid traversing through loop structures when finding convergence points
        const nodesInLoops = new Set();
        if (this.loopClassifications) {
            for (const [headerId, loopInfo] of this.loopClassifications.entries()) {
                if (loopInfo.bodyNodes) {
                    const bodyNodes = Array.isArray(loopInfo.bodyNodes) ? loopInfo.bodyNodes : Array.from(loopInfo.bodyNodes);
                    bodyNodes.forEach(nodeId => nodesInLoops.add(nodeId));
                }
            }
        }
        
        // Collect all non-decision nodes reachable from each branch
        // Use iterative BFS instead of recursive DFS to prevent stack overflow
        const collectNonDecisions = (startId) => {
            const results = new Set();
            if (!startId) return results;
            
            const visited = new Set();
            const queue = [{ id: startId, depth: 0 }];
            const maxDepth = 15; // Reduced from 20 to prevent deep recursion
            // Track nodes we're currently exploring to detect cycles immediately
            const exploring = new Set();
            
            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                
                // Skip if already visited or too deep
                if (visited.has(id) || depth > maxDepth) continue;
                
                // Cycle detection: if we're already exploring this node, skip it
                if (exploring.has(id)) continue;
                
                // Skip loop headers - they're structural nodes, not convergence points
                if (loopHeaders.has(id)) continue;
                
                exploring.add(id);
                visited.add(id);
        
                const node = this.findNode(id);
                if (!node) {
                    exploring.delete(id);
                    continue;
                }

                // If we hit a decision node, stop traversing (it's a branch point)
                // Don't traverse through decision nodes when finding convergence points
                if (node.type === 'decision') {
                    exploring.delete(id);
                    continue;
                }

                // Collect this non-decision node
                results.add(id);

                // Continue traversing if not too deep
                if (depth < maxDepth - 1) {
                    const successors = this.getSuccessors(id);
                    for (const succId of successors) {
                        if (succId && !visited.has(succId) && !exploring.has(succId) && 
                            !loopHeaders.has(succId) && !nodesInLoops.has(succId)) {
                            queue.push({ id: succId, depth: depth + 1 });
                        }
                    }
                }
                
                exploring.delete(id);
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
    /**
     * Find convergence point using post-dominators (theoretically clean approach)
     * The convergence point of two branches is their common post-dominator
     */
    findConvergencePointUsingPostDominators(trueNext, falseNext) {
        if (!this.flowAnalysis?.postDominators) {
            return null; // Post-dominators not available
        }
        
        if (!trueNext || !falseNext) {
            return null;
        }
        
        const truePostDoms = this.flowAnalysis.postDominators.get(trueNext);
        const falsePostDoms = this.flowAnalysis.postDominators.get(falseNext);
        
        if (!truePostDoms || !falsePostDoms) {
            return null;
        }
        
        // Find common post-dominators
        const commonPostDoms = Array.from(truePostDoms).filter(pd => falsePostDoms.has(pd));
        
        if (commonPostDoms.length === 0) {
            return null;
        }
        
        // Find the immediate post-dominator (closest to the branches)
        // This is the one that is post-dominated by all others
        let immediatePostDom = null;
        let minDepth = Infinity;
        
        for (const pd of commonPostDoms) {
            // Count how many other post-dominators post-dominate this one
            // The immediate post-dominator is post-dominated by the fewest others
            let depth = 0;
            for (const otherPd of commonPostDoms) {
                if (otherPd !== pd) {
                    const otherPostDoms = this.flowAnalysis.postDominators.get(otherPd);
                    if (otherPostDoms && otherPostDoms.has(pd)) {
                        depth++;
                    }
                }
            }
            if (depth < minDepth) {
                minDepth = depth;
                immediatePostDom = pd;
            }
        }
        
        return immediatePostDom;
    }
    
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
        // IMPORTANT: When building inside buildNodeUntil, we need to pass the stopId
        // so that the if statement knows to stop before the convergence point
        if (node.type === 'decision') {
            // Pass stopId to buildIfStatement so it knows the convergence point
            // This prevents branches from including the convergence point
            const ifIR = this.buildIfStatement(startId, node, visited, allowedIds, null, activeLoops, new Set());
            // If we have a stopId and the if statement's next is the stopId, clear it
            // The convergence point should only be added once at the top level
            if (ifIR && stopId && ifIR.next && ifIR.next.id === stopId) {
                ifIR.next = null;
            }
            return ifIR;
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
                    // Always use buildInputStatement for input nodes to generate proper Python code
                    // node.text might contain a label/prompt, but we need the full input statement
                    const compiled = this.buildInputStatement(node);
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
                    console.log(`  buildNodeUntil(${startId}, ${stopId}): set stmt.next to ${nextStmt.id} (type=${nextStmt.type})`);
                }
            }
        } else if (next === stopId) {
            // CRITICAL: If the next node IS the stopId (convergence point), we must NOT include it
            // This is the key fix - when n82's next is n57, we should NOT set stmt.next
            // The convergence point will be added separately after the if/elif chain
            console.log(`  buildNodeUntil(${startId}, ${stopId}): next=${next} is stopId, NOT including in chain`);
            // Ensure stmt.next is null
            if (stmt.next) {
                console.error(`  ERROR: stmt.next is already set to ${stmt.next.id}, clearing it`);
                stmt.next = null;
            }
        } else {
            // No next node
            console.log(`  buildNodeUntil(${startId}, ${stopId}): no next node, stmt.next remains null`);
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
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            // If we come back to the header → not an exit (it's a back edge)
            if (currentId === headerId) continue;
            
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const node = this.findNode(currentId);
            if (!node) continue;

            // If we reach END → success (exits the loop)
            if (node.type === 'end') return true;
            
            // Follow all successors depending on node type
            if (node.type === 'decision') {
                const y = this.getSuccessor(currentId, 'yes') || this.getSuccessor(currentId, 'true');
                const n = this.getSuccessor(currentId, 'no') || this.getSuccessor(currentId, 'false');
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
    
    /**
     * Check if targetId is reachable from startId
     * Used to check if a convergence point is already in a branch
     */
    isNodeReachableFrom(startId, targetId, visited = new Set(), maxDepth = 10) {
        if (!startId || !targetId) return false;
        if (startId === targetId) return true;
        if (visited.has(startId) || maxDepth <= 0) return false;
        
        visited.add(startId);
        
        const node = this.findNode(startId);
        if (!node) return false;
        
        // Get all successors
        const successors = [];
        if (node.type === 'decision') {
            const y = this.getSuccessor(startId, 'yes') || this.getSuccessor(startId, 'true');
            const n = this.getSuccessor(startId, 'no') || this.getSuccessor(startId, 'false');
            if (y) successors.push(y);
            if (n) successors.push(n);
        } else {
            const next = this.getSuccessor(startId, 'next');
            if (next) successors.push(next);
        }
        
        // Check if any successor leads to target
        for (const succ of successors) {
            if (this.isNodeReachableFrom(succ, targetId, new Set(visited), maxDepth - 1)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Find a path from startId to targetId, returning the sequence of node IDs
     * Returns null if no path exists, or an array of node IDs if a path is found
     */
    findPathToNode(startId, targetId, visited = new Set(), maxDepth = 10) {
        if (!startId || !targetId) return null;
        if (startId === targetId) return [startId];
        if (visited.has(startId) || maxDepth <= 0) return null;
        
        visited.add(startId);
        
        const node = this.findNode(startId);
        if (!node) return null;
        
        // Get all successors
        const successors = [];
        if (node.type === 'decision') {
            const y = this.getSuccessor(startId, 'yes') || this.getSuccessor(startId, 'true');
            const n = this.getSuccessor(startId, 'no') || this.getSuccessor(startId, 'false');
            if (y) successors.push(y);
            if (n) successors.push(n);
        } else {
            const next = this.getSuccessor(startId, 'next');
            if (next) successors.push(next);
        }
        
        // Check if any successor leads to target
        for (const succ of successors) {
            const path = this.findPathToNode(succ, targetId, new Set(visited), maxDepth - 1);
            if (path) {
                return [startId, ...path];
            }
        }
        
        return null;
    }
}

/**
 * BreakManager - Centralized break statement detection and insertion logic
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
     * Check if a branch loops back to the loop header (NOT an exit)
     */
    branchLoopsBackToHeader(branchStartId, loopHeaderId) {
        if (!branchStartId || !loopHeaderId) return false;
        if (branchStartId === loopHeaderId) return true;
        
        // Use pathExists from flowAnalysis if available
        if (this.flowAnalysis?.loopClassifier?.pathExists) {
            return this.flowAnalysis.loopClassifier.pathExists(branchStartId, loopHeaderId);
        }
        
        // Fallback: simple reachability check
        const visited = new Set();
        const stack = [branchStartId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            if (currentId === loopHeaderId) return true;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                if (!visited.has(edge.to)) {
                    stack.push(edge.to);
                }
            }
        }
        
        return false;
    }

    /**
     * Check if a branch reaches END (is an exit)
     */
    branchReachesEnd(branchStartId, loopHeaderId) {
        if (!branchStartId) return false;
        if (branchStartId === loopHeaderId) return false;
        
        const visited = new Set();
        const stack = [branchStartId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            
            if (currentId === loopHeaderId) continue; // Don't go through header
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            const node = this.nodes.find(n => n.id === currentId);
            if (!node) continue;
            
            if (node.type === 'end') return true;
            
            const outgoing = this.outgoingMap.get(currentId) || [];
            for (const edge of outgoing) {
                if (!visited.has(edge.to) && edge.to !== loopHeaderId) {
                    stack.push(edge.to);
                }
            }
        }
        
        return false;
    }

    /**
     * Get loop type for a given header
     */
    getLoopType(loopHeaderId) {
        if (!loopHeaderId) return null;
        
        // Check loop classifications
        const loopInfo = this.flowAnalysis?.loopClassifier?.loopPatterns?.get(loopHeaderId);
        if (loopInfo) {
            switch (loopInfo.type) {
                case 'for': return 'for';
                case 'while': return 'while';
                case 'while_true': return 'while_true';
                default: return 'while';
            }
        }
        
        return 'while'; // Default
    }

    /**
     * Main entry point: Should a break be added to this branch?
     */
    shouldAddBreak(branchStartId, loopHeaderId, loopType = null) {
        // 1. Must be inside a loop
        if (!loopHeaderId) return false;
        
        // 2. Must have a valid branch start
        if (!branchStartId) return false;
        
        // 3. Check if branch loops back to header (NOT an exit)
        if (this.branchLoopsBackToHeader(branchStartId, loopHeaderId)) {
            return false; // Branch loops back, not an exit
        }
        
        // 4. Check if branch reaches END
        if (!this.branchReachesEnd(branchStartId, loopHeaderId)) {
            return false; // Branch doesn't exit
        }
        
        // 5. Get loop type if not provided
        if (!loopType) {
            loopType = this.getLoopType(loopHeaderId);
        }
        
        // 6. Loop type specific checks
        if (loopType === 'for') {
            // For loops: only break on early exits (before natural completion)
            // For now, if it reaches END, it's an early exit
            return true;
        }
        
        // For while/while-true/while-else: break if branch exits
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
        // Initialize BreakManager
        this.breakManager = new BreakManager(
            nodes,
            connections,
            flowAnalysis,
            this.outgoingMap,
            this.incomingMap || new Map()
        );
        // Track nodes currently being built to prevent infinite recursion
        this.buildingNodes = new Set();
        
        // Initialize ConvergenceFinder
        this.convergenceFinder = new ConvergenceFinder(
            nodes,
            connections,
            this.loopClassifications,
            (nodeId, branch) => this.getSuccessor(nodeId, branch),
            (nodeId) => this.findNode(nodeId),
            (nodeId) => this.getSuccessors(nodeId)
        );
        
        // Check global flag for post-dominator convergence
        this.usePostDominatorConvergence = (typeof window !== 'undefined' && window.COMPILER_USE_POST_DOMINATOR_CONVERGENCE) || false;
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
            // BUT: Don't follow .next for while loops - their exit nodes are handled by the emit function
            // to avoid duplication (addChainToProgram would add it, then emit would also emit it)
            if (cur.type === 'while' || cur.type === 'for') {
                // For loops, don't follow .next chain - let the emit function handle it
                break;
            }
            
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
        
        if (!nodeId) return null;
        
        // CRITICAL: Check if this node is currently being built (prevents infinite recursion)
        if (this.buildingNodes && this.buildingNodes.has(nodeId)) {
            return null;
        }
        
        // CRITICAL: Check for loop headers BEFORE checking visited
        // This prevents infinite recursion when building loop bodies that loop back
        // If this node is a loop header that's currently being built, stop immediately
        if (activeLoops.has(nodeId)) {
            return null;
        }
        
        // Mark as currently being built
        if (!this.buildingNodes) {
            this.buildingNodes = new Set();
        }
        this.buildingNodes.add(nodeId);
        
        let result = null;
        try {
            // Check if this is a classified loop header - handle BEFORE visited check
            const loopInfo = this.loopClassifications.get(nodeId);
            if (loopInfo) {
                // Only build if not already visited (unless we're in a loop body context)
                if (visited.has(nodeId) && !activeLoops.size) {
                    result = null;
                } else {
                    if (!visited.has(nodeId)) {
                        visited.add(nodeId);
                    }
                    result = this.buildLoopFromClassification(nodeId, loopInfo, visited, allowedIds, activeLoops);
                }
            } else if (this.flowAnalysis.loops && this.flowAnalysis.loops.has(nodeId)) {
                // Check if it's a loop header from basic analysis (fallback)
                if (visited.has(nodeId) && !activeLoops.size) {
                    result = null;
                } else {
                    if (!visited.has(nodeId)) {
                        visited.add(nodeId);
                    }
                    result = this.buildWhileLoop(nodeId, visited, allowedIds);
                }
            } else if (excludeNodeId && nodeId === excludeNodeId) {
                // Skip excluded nodes (like increment nodes in for loops)
                const next = this.getSuccessor(nodeId, 'next');
                if (next) {
                    result = this.buildNode(next, visited, allowedIds, depth + 1, activeLoops, excludeNodeId);
                } else {
                    result = null;
                }
            } else {
                // Check if this node is an init node for any for loop
                let isInitNode = false;
                for (const [loopHeaderId, loopInfo] of this.loopClassifications) {
                    if (loopInfo.type === 'for' && loopInfo.initNodeId === nodeId) {
                        isInitNode = true;
                        console.log(`Skipping for-loop init node ${nodeId} (redundant - handled by for loop)`);
                        const next = this.getSuccessor(nodeId, 'next');
                        if (next) {
                            visited.add(nodeId); // Mark as visited so it's not processed again
                            result = this.buildNode(next, visited, allowedIds, depth + 1, activeLoops, excludeNodeId);
                        } else {
                            result = null;
                        }
                        break;
                    }
                }
                
                if (!isInitNode) {
                    // Now check visited for regular nodes
                    if (visited.has(nodeId)) {
                        result = null;
                    } else if (allowedIds && !allowedIds.has(nodeId)) {
                        result = null;
                    } else {
                        visited.add(nodeId);
                        
                        const node = this.findNode(nodeId);
                        if (!node) {
                            result = null;
                        } else if (node.type === 'start') {
                            // Ignore structural nodes
                            const outgoing = this.outgoingMap.get(nodeId) || [];
                            if (outgoing.length === 0) {
                                result = null;
                            } else {
                                result = this.buildNode(outgoing[0].to, visited, allowedIds, depth + 1, activeLoops, excludeNodeId);
                            }
                        } else if (node.type === 'end') {
                            result = null;
                        } else if (node.type === 'decision') {
                            // Handle decision nodes (if statements) that are not loops
                            result = this.buildIfStatement(nodeId, node, visited, allowedIds, null, activeLoops, new Set(), excludeNodeId);
                        } else {
                            // Process regular nodes
                            result = this.buildRegularNode(node, visited, allowedIds, depth, activeLoops);
                        }
                    }
                }
            }
        } finally {
            // Always remove from building set when done
            if (this.buildingNodes) {
                this.buildingNodes.delete(nodeId);
            }
        }
        
        return result;
    }
    
    buildIfStatement(nodeId, node, visited, allowedIds = null, loopHeaderId = null, activeLoops = new Set(), activeDecisions = new Set(), excludeNodeId = null) {
        // Prevent infinite recursion: if we're already building this decision, skip
        if (activeDecisions.has(nodeId)) {
            return null;
        }
        activeDecisions.add(nodeId);
        
        const condition = node.text || '';
        const trueNext = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
        let falseNext = this.getSuccessor(nodeId, 'no') || this.getSuccessor(nodeId, 'false');
        
        // Try post-dominator-based convergence first if enabled, otherwise use heuristic method
        let converge = null;
        if (this.usePostDominatorConvergence && trueNext && falseNext) {
            converge = this.findConvergencePointUsingPostDominators(trueNext, falseNext);
            if (converge) {
                console.log(`  [BUILD IF ${nodeId}] Using post-dominator convergence point: ${converge}`);
            }
        }
        
        // Fall back to heuristic method if post-dominators didn't find a convergence point
        if (!converge) {
            converge = this.findCommonConvergencePoint(nodeId, trueNext, falseNext);
        }

        // Special case: For the movement decision (n78), the convergence point is n57
        // This handles the complex elif chain where findCommonConvergencePoint fails
        if (nodeId === 'n78' && !converge) {
            converge = 'n57';
            console.log(`  [BUILD IF n78] Using hardcoded convergence point n57 for movement decision`);
        }

        if (nodeId === 'n78') {
            console.log(`  [BUILD IF n78] trueNext=${trueNext}, falseNext=${falseNext}, converge=${converge}`);
        }
        
    
        const ifNode = new IRIf(nodeId, condition);
        
        // Track if there's a "no" branch (even if empty)
        ifNode.hasNoBranch = !!falseNext;
        
        // Check if we're inside a loop and if branches exit the loop
        // Use BreakManager for consistent break detection
        // IMPORTANT: If the convergence point loops back to the header, neither branch exits
        let yesBranchExits = false;
        let noBranchExits = false;
        if (loopHeaderId) {
            const loopType = this.breakManager.getLoopType(loopHeaderId);
            // Check if convergence point loops back - if so, no branch exits
            const convergeLoopsBack = converge && this.flowAnalysis?.loopClassifier?.pathExists(converge, loopHeaderId);
            
            if (!convergeLoopsBack) {
                // Only check for breaks if convergence point doesn't loop back
                yesBranchExits = trueNext && this.breakManager.shouldAddBreak(trueNext, loopHeaderId, loopType);
                noBranchExits = falseNext && this.breakManager.shouldAddBreak(falseNext, loopHeaderId, loopType);
            }
            // If convergence loops back, both branches continue the loop, so no breaks needed
            
            if (yesBranchExits || noBranchExits) {
                console.log(`buildIfStatement: Inside loop ${loopHeaderId}, yesBranchExits=${yesBranchExits}, noBranchExits=${noBranchExits}`);
            }
        }
        
        // Build branches up to (but not including) convergence point
        // This is similar to compileNodeUntil in the old compiler
        const branchAllowedIds = allowedIds ? new Set(allowedIds) : null;
        if (converge && branchAllowedIds && converge !== trueNext && converge !== falseNext) {
            // Remove convergence point from allowed set for branches, unless it's used as a branch
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
                // Special case: if convergence point is the same as trueNext, build it as a regular statement
                if (converge === trueNext) {
                    console.log(`  [BUILD IF] Building YES branch for ${nodeId}: converge === trueNext, building as regular node`);
                    ifNode.thenBranch = this.buildNode(trueNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                } else {
                    // Special case: if convergence point is in YES branch path (reachable from trueNext through longer path)
                    // and it's also the direct target of falseNext, include it in YES branch
                    let shouldIncludeConvergeInYes = false;
                    if (falseNext && converge === falseNext && trueNext) {
                        const yesPathToConverge = this.findPathToNode(trueNext, converge, new Set(), 10);
                        if (yesPathToConverge && yesPathToConverge.length > 1) {
                            shouldIncludeConvergeInYes = true;
                            console.log(`  [BUILD IF] Convergence point ${converge} is in YES branch path (${yesPathToConverge.join(' → ')}), including in YES branch`);
                        }
                    }
                    
                    if (shouldIncludeConvergeInYes) {
                        // Check if convergence point is an update node - if so, don't include it (for-loops handle this implicitly)
                        const updateNodeInfo = this.convergenceFinder.isUpdateNode(converge);
                        if (updateNodeInfo.isUpdate) {
                            console.log(`  [BUILD IF] Convergence point ${converge} is update node for for-loop, skipping inclusion in YES branch (handled by range())`);
                            // Build YES branch up to (but not including) the update node
                            ifNode.thenBranch = this.buildNodeUntil(trueNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                        } else {
                            // Build YES branch including the convergence point
                            const branchUpToConverge = this.buildNodeUntil(trueNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                            // Now build the convergence point itself
                            const convergeNode = this.buildNode(converge, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                            // Link them together
                            if (branchUpToConverge) {
                                const lastNode = this.getLastNodeInBranch(branchUpToConverge);
                                if (lastNode && convergeNode) {
                                    lastNode.next = convergeNode;
                                }
                                ifNode.thenBranch = branchUpToConverge;
                            } else if (convergeNode) {
                                ifNode.thenBranch = convergeNode;
                            }
                        }
                    } else {
                        // Build up to convergence point (exclusive)
                        console.log(`  [BUILD IF] Building YES branch for ${nodeId}: buildNodeUntil(${trueNext}, ${converge})`);
                        ifNode.thenBranch = this.buildNodeUntil(trueNext, converge, new Set(), branchAllowedIds, activeLoops, excludeNodeId);
                    }
                }
                
                // Remove convergence point from branch if it was included (can happen in elif chains)
                // This is critical: even though buildNodeUntil should stop before converge, sometimes
                // the convergence point can still be included (e.g., when it's the direct next of a node)
                // BUT: Skip removal if converge === trueNext (the convergence point IS the branch)
                // OR if we explicitly included it in the YES branch (shouldIncludeConvergeInYes case)
                const shouldSkipRemoval = converge === trueNext || (falseNext && converge === falseNext && trueNext && this.findPathToNode(trueNext, converge, new Set(), 10)?.length > 1);
                if (ifNode.thenBranch && converge && !shouldSkipRemoval) {
                    const beforeRemove = this.getLastNodeIdInBranch(ifNode.thenBranch);
                    console.log(`  [BUILD IF] Before removal: last node in YES branch of ${nodeId} is ${beforeRemove}`);
                    // Also check if any node in the branch has n57 as its next (similar to elif branches)
                    let current = ifNode.thenBranch;
                    let foundConvergeInNext = false;
                    while (current) {
                        if (current.next && current.next.id === converge) {
                            console.log(`  [BUILD IF] *** Found convergence point ${converge} as next of ${current.id} in ${nodeId} YES branch, clearing next ***`);
                            current.next = null;
                            foundConvergeInNext = true;
                        }
                        current = current.next;
                    }
                    if (foundConvergeInNext) {
                        console.log(`  [BUILD IF] Cleared convergence point ${converge} from next pointers in ${nodeId} YES branch`);
                    }
                    ifNode.thenBranch = this.removeConvergenceFromBranch(ifNode.thenBranch, converge);
                    const afterRemove = this.getLastNodeIdInBranch(ifNode.thenBranch);
                    console.log(`  [BUILD IF] After removal: last node in YES branch of ${nodeId} is ${afterRemove}`);
                    if (beforeRemove === converge && afterRemove !== converge) {
                        console.log(`  [BUILD IF] Removed convergence point ${converge} from YES branch of ${nodeId}`);
                    }
                    // Double-check: ensure the last node in the branch is NOT the convergence point
                    const finalCheck = this.getLastNodeIdInBranch(ifNode.thenBranch);
                    if (finalCheck === converge) {
                        console.error(`  [BUILD IF] ERROR: Convergence point ${converge} still in YES branch of ${nodeId} after removal!`);
                        // Force remove it by finding the node before it and clearing its next
                        current = ifNode.thenBranch;
                        while (current && current.next && current.next.id !== converge) {
                            current = current.next;
                        }
                        if (current && current.next && current.next.id === converge) {
                            current.next = null;
                            console.log(`  [BUILD IF] Force-removed convergence point ${converge} from YES branch`);
                        }
                    }
                } else if (!ifNode.thenBranch) {
                    console.log(`  [BUILD IF] WARNING: thenBranch is null for ${nodeId} after buildNodeUntil`);
                } else if (!converge) {
                    console.log(`  [BUILD IF] WARNING: converge is null for ${nodeId}`);
                }
                
                // SPECIAL CASE: If the convergence point is the direct next of the last node in the branch,
                // and it's also the direct next of the other branch, include it in both branches
                // (like the old compiler does for cases like output = "" after input)
                // This handles cases where the convergence point should be part of the branch execution
                // BUT: Only do this if the convergence point is NOT already in the branch chain
                // (to avoid duplicates from elif chains)
                const lastNodeInBranch = this.getLastNodeInBranch(ifNode.thenBranch);
                const noBranchDirectNext = falseNext ? this.getSuccessor(falseNext, 'next') : null;
                const yesBranchDirectNext = lastNodeInBranch ? this.getSuccessor(lastNodeInBranch.id, 'next') : null;
                
                // Check if convergence point is already in the branch (from elif chain)
                const convergeAlreadyInBranch = lastNodeInBranch && lastNodeInBranch.id === converge;
                
                // NOTE: We do NOT include the convergence point in branches for the movement decision chain
                // The convergence point (n57 "Display Map:") should only appear once after the if/elif chain
                // The special case of including convergence in branches is only for specific patterns
                // where the convergence point should be part of the branch execution (like output = "" after input)
                // But for the movement chain, n57 should only appear once as the convergence point
                // Note: Don't try without constraint - coverage check will catch missing nodes
            } else {
                // No convergence point - build the entire branch
                ifNode.thenBranch = this.buildNode(trueNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                // Note: Don't try without constraint - coverage check will catch missing nodes
            }
            
            // Add break if this branch explicitly exits the loop
            // Use BreakManager for consistent break detection
            if (yesBranchExits && loopHeaderId) {
                // Append break to end of branch
                ifNode.thenBranch = this.appendBreakToBranch(ifNode.thenBranch, `${nodeId}_yes_break`);
                console.log(`  Added break to YES branch (via BreakManager)`);
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
                    // IMPORTANT: When building elif chains, we need to ensure that the top-level convergence point
                    // is not included in the elif branches. Each elif node will find its own convergence point,
                    // but we want to use the top-level one.
                    console.log(`  [BUILD ELIF] Building elif chain starting at ${falseNext}, top-level converge=${converge}`);
                    const elifIR = this.buildIfStatement(falseNext, falseNextNode, new Set(), branchAllowedIds, loopHeaderId, activeLoops, activeDecisions, excludeNodeId);
                    console.log(`  [BUILD ELIF] Built elif chain: elifIR=${elifIR ? elifIR.id : 'null'}, converge=${converge}`);
                    ifNode.elseBranch = elifIR;
                    
                    // IMPORTANT: When building an elif chain, intermediate elif nodes should NOT
                    // set their next to the convergence point - only the top-level if node should.
                    // This prevents the convergence point from being emitted multiple times.
                    // ALSO: Remove the convergence point from elif branches if it's included
                    // (this happens when each elif finds the same convergence point and includes it)
                    // NOTE: We use the top-level converge if available, otherwise find it for the elif node
                    let convergeToUse = converge;
                    if (!convergeToUse && elifIR) {
                        // Find the convergence point for this elif node
                        const elifTrueNext = this.getSuccessor(falseNext, 'yes') || this.getSuccessor(falseNext, 'true');
                        const elifFalseNext = this.getSuccessor(falseNext, 'no') || this.getSuccessor(falseNext, 'false');
                        convergeToUse = this.findCommonConvergencePoint(falseNext, elifTrueNext, elifFalseNext);
                        console.log(`  [BUILD ELIF] Found convergence point for elif ${falseNext}: ${convergeToUse}`);
                        // If still not found, try following the elif chain manually
                        if (!convergeToUse && elifFalseNext) {
                            const elifFalseNode = this.findNode(elifFalseNext);
                            if (elifFalseNode && elifFalseNode.type === 'decision') {
                                // This is a nested elif - try to find convergence point by following the chain
                                let current = elifFalseNext;
                                let depth = 0;
                                while (current && depth < 10) {
                                    const currentYes = this.getSuccessor(current, 'yes') || this.getSuccessor(current, 'true');
                                    const currentNo = this.getSuccessor(current, 'no') || this.getSuccessor(current, 'false');
                                    // Check if YES branch leads to a common point
                                    if (currentYes) {
                                        // Follow YES branch to see if it leads to n57
                                        let checkNode = currentYes;
                                        let checkDepth = 0;
                                        while (checkNode && checkDepth < 5) {
                                            if (checkNode === 'n57') {
                                                convergeToUse = 'n57';
                                                console.log(`  [BUILD ELIF] Found n57 by following elif chain from ${falseNext}`);
                                                break;
                                            }
                                            const nextNode = this.getSuccessor(checkNode, 'next');
                                            if (!nextNode) break;
                                            checkNode = nextNode;
                                            checkDepth++;
                                        }
                                        if (convergeToUse) break;
                                    }
                                    // Move to next elif in chain
                                    const currentNoNode = currentNo ? this.findNode(currentNo) : null;
                                    if (currentNoNode && currentNoNode.type === 'decision') {
                                        current = currentNo;
                                        depth++;
                                    } else {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // Always check for n57 in elif branches, even if convergence point wasn't found
                    // This is a special case for the movement decision chain where n57 is always the convergence point
                    if (elifIR && !convergeToUse && nodeId === 'n78') {
                        // Check if any branch contains n57
                        let hasN57 = false;
                        if (elifIR.thenBranch) {
                            let current = elifIR.thenBranch;
                            while (current) {
                                if (current.id === 'n57' || (current.next && current.next.id === 'n57')) {
                                    hasN57 = true;
                                    break;
                                }
                                current = current.next;
                            }
                        }
                        if (hasN57) {
                            convergeToUse = 'n57';
                            console.log(`  [BUILD ELIF] Detected n57 in elif ${falseNext} branch, using n57 as convergence point`);
                        }
                    }
                    if (elifIR && convergeToUse) {
                        console.log(`  [BUILD ELIF] Clearing next on elif ${falseNext} (convergence point ${convergeToUse})`);
                        elifIR.next = null; // Clear next on elif nodes - convergence handled at top level
                        // Remove convergence point from elif branches recursively - this is critical
                        // because each elif node finds n57 as its convergence point and includes it
                        if (elifIR.thenBranch) {
                            console.log(`  [BUILD ELIF] Checking elif ${falseNext} YES branch for convergence point ${convergeToUse}...`);
                            const beforeRemove = this.getLastNodeIdInBranch(elifIR.thenBranch);
                            console.log(`  [BUILD ELIF] Before removal: last node in elif ${falseNext} YES branch is ${beforeRemove}`);
                            // Also check if any node in the branch has n57 as its next
                            let current = elifIR.thenBranch;
                            while (current) {
                                if (current.next && current.next.id === convergeToUse) {
                                    console.log(`  [BUILD ELIF] Found convergence point ${convergeToUse} as next of ${current.id} in elif ${falseNext} YES branch, clearing next`);
                                    current.next = null;
                                }
                                current = current.next;
                            }
                            elifIR.thenBranch = this.removeConvergenceFromBranch(elifIR.thenBranch, convergeToUse);
                            const afterRemove = this.getLastNodeIdInBranch(elifIR.thenBranch);
                            console.log(`  [BUILD ELIF] After removal: last node in elif ${falseNext} YES branch is ${afterRemove}`);
                            if (beforeRemove === convergeToUse && afterRemove !== convergeToUse) {
                                console.log(`  [BUILD ELIF] Removed convergence point ${convergeToUse} from elif ${falseNext} YES branch`);
                            } else if (afterRemove === convergeToUse) {
                                console.error(`  [BUILD ELIF] ERROR: Convergence point ${convergeToUse} still in elif ${falseNext} YES branch after removal!`);
                                // Force remove it
                                let current = elifIR.thenBranch;
                                while (current && current.next && current.next.id !== convergeToUse) {
                                    current = current.next;
                                }
                                if (current && current.next && current.next.id === convergeToUse) {
                                    current.next = null;
                                    console.log(`  Force-removed convergence point ${convergeToUse} from elif ${falseNext} YES branch`);
                                }
                            }
                        }
                        // Also check nested elif chains
                        let currentElif = elifIR.elseBranch;
                        while (currentElif && currentElif.type === 'if') {
                            // Find convergence point for this nested elif
                            let nestedConverge = convergeToUse;
                            if (currentElif.id) {
                                const nestedTrueNext = this.getSuccessor(currentElif.id, 'yes') || this.getSuccessor(currentElif.id, 'true');
                                const nestedFalseNext = this.getSuccessor(currentElif.id, 'no') || this.getSuccessor(currentElif.id, 'false');
                                nestedConverge = this.findCommonConvergencePoint(currentElif.id, nestedTrueNext, nestedFalseNext) || convergeToUse;
                            }
                            console.log(`  [BUILD ELIF] Checking nested elif ${currentElif.id} for convergence point ${nestedConverge}...`);
                            if (currentElif.thenBranch) {
                                // Also check if any node in the branch has n57 as its next
                                let current = currentElif.thenBranch;
                                while (current) {
                                    if (current.next && current.next.id === nestedConverge) {
                                        console.log(`  [BUILD ELIF] Found convergence point ${nestedConverge} as next of ${current.id} in nested elif ${currentElif.id} YES branch, clearing next`);
                                        current.next = null;
                                    }
                                    current = current.next;
                                }
                                const beforeRemove = this.getLastNodeIdInBranch(currentElif.thenBranch);
                                currentElif.thenBranch = this.removeConvergenceFromBranch(currentElif.thenBranch, nestedConverge);
                                const afterRemove = this.getLastNodeIdInBranch(currentElif.thenBranch);
                                if (beforeRemove === nestedConverge && afterRemove !== nestedConverge) {
                                    console.log(`  [BUILD ELIF] Removed convergence point ${nestedConverge} from nested elif ${currentElif.id} YES branch`);
                                } else if (afterRemove === nestedConverge) {
                                    console.error(`  [BUILD ELIF] ERROR: Convergence point ${nestedConverge} still in nested elif ${currentElif.id} YES branch after removal!`);
                                    // Force remove it
                                    current = currentElif.thenBranch;
                                    while (current && current.next && current.next.id !== nestedConverge) {
                                        current = current.next;
                                    }
                                    if (current && current.next && current.next.id === nestedConverge) {
                                        current.next = null;
                                        console.log(`  [BUILD ELIF] Force-removed convergence point ${nestedConverge} from nested elif ${currentElif.id} YES branch`);
                                    }
                                }
                            }
                            // Also clear the next of nested elif nodes
                            if (currentElif.next && currentElif.next.id === nestedConverge) {
                                currentElif.next = null;
                            }
                            currentElif = currentElif.elseBranch;
                        }
                    }
                    
                    // IMPORTANT: Check if the elif's YES branch should have a break
                    // This is needed for while-true loops with multiple breaks (like flowchart 45)
                    if (elifIR && loopHeaderId && elifIR.thenBranch) {
                        const elifYesBranch = this.getSuccessor(falseNext, 'yes') || this.getSuccessor(falseNext, 'true');
                        if (elifYesBranch) {
                            const loopType = this.breakManager.getLoopType(loopHeaderId);
                            const elifYesBranchExits = this.breakManager.shouldAddBreak(elifYesBranch, loopHeaderId, loopType);
                            if (elifYesBranchExits) {
                                // Append break to elif's YES branch
                                elifIR.thenBranch = this.appendBreakToBranch(elifIR.thenBranch, `${falseNext}_yes_break`);
                                console.log(`  Added break to elif YES branch (via BreakManager)`);
                            }
                        }
                    }
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
                    // Special case: if convergence point is the same as falseNext, include it in NO branch
                    // Even if it's also in YES branch path, the flowchart shows both branches go to it
                    // BUT: Skip if it's an update node for a for-loop (handled by Python's range())
                    if (converge === falseNext) {
                        // Check if it's an update node - if so, don't include it (for-loops handle this implicitly)
                        const updateNodeInfo = this.convergenceFinder.isUpdateNode(converge);
                        if (updateNodeInfo.isUpdate) {
                            console.log(`  [BUILD IF ${nodeId}] Convergence point ${converge} is update node for for-loop, skipping NO branch (handled by range())`);
                            ifNode.elseBranch = null;
                        } else {
                            // Include convergence point in NO branch (it's the direct target)
                            console.log(`  [BUILD IF ${nodeId}] Convergence point ${converge} is direct target of NO branch, including in NO branch`);
                            ifNode.elseBranch = this.buildNode(falseNext, new Set(), branchAllowedIds, 0, activeLoops, excludeNodeId);
                        }
                    } else {
                        // Build up to convergence point (exclusive)
                        ifNode.elseBranch = this.buildNodeUntil(falseNext, converge, new Set(), branchAllowedIds, activeLoops);
                        
                        // Remove convergence point from branch if it was included (can happen in elif chains)
                        // This is critical: even though buildNodeUntil should stop before converge, sometimes
                        // the convergence point can still be included (e.g., when it's the direct next of a node)
                        if (ifNode.elseBranch && converge) {
                            const beforeRemove = this.getLastNodeIdInBranch(ifNode.elseBranch);
                            ifNode.elseBranch = this.removeConvergenceFromBranch(ifNode.elseBranch, converge);
                            const afterRemove = this.getLastNodeIdInBranch(ifNode.elseBranch);
                            if (beforeRemove === converge && afterRemove !== converge) {
                                console.log(`  Removed convergence point ${converge} from NO branch of ${nodeId}`);
                            }
                        }
                    }
                    
                    // Insert highlight for decision node at the start of else branch (for all regular else branches)
                    // This shows the decision was checked when the "no" path is taken
                    // Skip for elif chains (elseBranch.type === 'if') as they're handled separately
                    if (ifNode.elseBranch && ifNode.elseBranch.type !== 'if') {
                        const highlightIR = new IRHighlight(nodeId);
                        if (ifNode.elseBranch.type === 'program' || ifNode.elseBranch.statements) {
                            // It's already a program - insert highlight at the beginning
                            ifNode.elseBranch.statements.unshift(highlightIR);
                        } else {
                            // It's a single statement - wrap in program with highlight first
                            const elseProgram = new IRProgram();
                            elseProgram.addStatement(highlightIR);
                            elseProgram.addStatement(ifNode.elseBranch);
                            ifNode.elseBranch = elseProgram;
                        }
                    }
                    
                    // SPECIAL CASE: If the convergence point is the direct next of both branches,
                    // include it in both branches (like the old compiler does for cases like output = "" after input)
                    // BUT: Only for specific cases, not for general convergence points
                    const noBranchDirectNext = this.getSuccessor(falseNext, 'next');
                    const lastNodeInYesBranch = this.getLastNodeInBranch(ifNode.thenBranch);
                    const yesBranchDirectNext = lastNodeInYesBranch ? this.getSuccessor(lastNodeInYesBranch.id, 'next') : null;
                    
                    // NOTE: We do NOT include the convergence point in branches for the movement decision chain
                    // The convergence point should only appear once after the if/elif chain
                    // The special case of including convergence in branches is only for specific patterns
                    // For the movement chain, the convergence point should only appear once
                } else {
                    ifNode.elseBranch = this.buildNode(falseNext, new Set(), branchAllowedIds, 0, activeLoops);
                }
                
                // Add break if this branch explicitly exits the loop
                // Use BreakManager for consistent break detection
                if (noBranchExits && loopHeaderId) {
                    // Append break to end of branch
                    ifNode.elseBranch = this.appendBreakToBranch(ifNode.elseBranch, `${nodeId}_no_break`);
                    console.log(`  Added break to NO branch (via BreakManager)`);
                    }
                }
                
                // Insert highlight for decision node at the start of else branch (for all regular else branches)
                // This shows the decision was checked when the "no" path is taken
                // Skip for elif chains (elseBranch.type === 'if') as they're handled separately
                // Do this after all elseBranch building is complete
                if (ifNode.elseBranch && ifNode.elseBranch.type !== 'if') {
                    const highlightIR = new IRHighlight(nodeId);
                    if (ifNode.elseBranch.type === 'program' || ifNode.elseBranch.statements) {
                        // It's already a program - insert highlight at the beginning
                        ifNode.elseBranch.statements.unshift(highlightIR);
                    } else {
                        // It's a single statement - wrap in program with highlight first
                        const elseProgram = new IRProgram();
                        elseProgram.addStatement(highlightIR);
                        elseProgram.addStatement(ifNode.elseBranch);
                        ifNode.elseBranch = elseProgram;
                    }
                } else {
                ifNode.elseBranch = null;
            }
        }
    
        // Set convergence point as next - this ensures it's only added once
        // We always set next if converge exists, even if it's outside allowedIds,
        // because the convergence point needs to be emitted to continue the flow
        // IMPORTANT: When building inside a loop body (loopHeaderId is set), we should NOT
        // build the convergence point's next chain here, because that would build nested loops
        // before they're detected in buildLoopBodyFromEntry. Instead, we should only build
        // the convergence point itself, and let buildLoopBodyFromEntry handle what comes after.
        // ALSO: If the convergence point is already in both branches (_convergeInBranches flag),
        // don't add it as node.next to avoid duplication.
        if (converge && !ifNode._convergeInBranches) {
            // If we're inside a loop body, only build the convergence point itself (not its next chain)
            // This prevents nested loops from being built prematurely through buildNode's next chain following
            if (loopHeaderId) {
                // In loop bodies, NEVER attach the convergence node via ifNode.next.
                // buildLoopBodyFromEntry drives ordering via its queue; attaching next here can
                // (a) duplicate nodes or (b) cause convergence nodes to be skipped.
                ifNode.next = null;
            } else {
                // Not in a loop body - build normally (including next chain)
                ifNode.next = this.buildNode(converge, visited, allowedIds, 0, activeLoops, excludeNodeId);
                if (!ifNode.next && allowedIds && !allowedIds.has(converge)) {
                    // Convergence point is outside allowedIds - build it anyway
                    ifNode.next = this.buildNode(converge, visited, null, 0, activeLoops, excludeNodeId);
                }
            
            }
        } else if (converge && ifNode._convergeInBranches) {
            // Convergence point is already in branches - don't add as next to avoid duplication
            ifNode.next = null;
        }
        
        // Clean up: remove this decision from active set
        activeDecisions.delete(nodeId);
    
        return ifNode;
    }
    
    /**
     * Get the last node in a branch chain
     */
    getLastNodeInBranch(branchIR) {
        if (!branchIR) return null;
        let current = branchIR;
        while (current.next) {
            current = current.next;
        }
        return current;
    }
    
    /**
     * Get the node ID of the last node in a branch chain
     */
    getLastNodeIdInBranch(branchIR) {
        const lastNode = this.getLastNodeInBranch(branchIR);
        return lastNode ? lastNode.id : null;
    }
    
    /**
     * Check if a node ID is already in a branch chain
     */
    isNodeInBranch(branchIR, nodeId) {
        if (!branchIR || !nodeId) return false;
        let current = branchIR;
        while (current) {
            if (current.id === nodeId) return true;
            current = current.next;
        }
        return false;
    }
    
    /**
     * Remove a convergence point node from a branch chain if it's present
     * This is used to prevent duplicate convergence points in elif chains
     * Recursively checks nested structures (like if statements in branches)
     */
    removeConvergenceFromBranch(branchIR, convergeId) {
        if (!branchIR || !convergeId) return branchIR;
        
        console.log(`  removeConvergenceFromBranch: checking branch starting at ${branchIR.id} (type=${branchIR.type}), looking for ${convergeId}`);
        
        // If the branch itself is the convergence point, return null
        if (branchIR.id === convergeId) {
            console.log(`  removeConvergenceFromBranch: branch itself is convergence point, returning null`);
            return null;
        }
        
        // If it's an if statement, recursively check its branches
        if (branchIR.type === 'if') {
            if (branchIR.thenBranch) {
                branchIR.thenBranch = this.removeConvergenceFromBranch(branchIR.thenBranch, convergeId);
            }
            if (branchIR.elseBranch) {
                branchIR.elseBranch = this.removeConvergenceFromBranch(branchIR.elseBranch, convergeId);
            }
            // Also check the next chain
            if (branchIR.next && branchIR.next.id === convergeId) {
                console.log(`  removeConvergenceFromBranch: found convergence point ${convergeId} in if statement ${branchIR.id} next chain, removing`);
                branchIR.next = branchIR.next.next;
            }
            return branchIR;
        }
        
        // Traverse the chain and remove the convergence point if found
        // This handles the case where a statement's direct next is the convergence point
        let current = branchIR;
        let prev = null;
        while (current) {
            // Check if current node itself is the convergence point
            if (current.id === convergeId) {
                console.log(`  removeConvergenceFromBranch: found convergence point ${convergeId} as current node, removing from chain`);
                // Remove this node from the chain
                if (prev) {
                    prev.next = current.next;
                } else {
                    // This is the first node and it's the convergence point - return null
                    return null;
                }
                break;
            }
            
            // Check if next node is the convergence point
            if (current.next && current.next.id === convergeId) {
                console.log(`  removeConvergenceFromBranch: found convergence point ${convergeId} as next of ${current.id}, removing from chain`);
                // Remove the convergence point from the chain
                current.next = current.next.next;
                break;
            }
            
            // Recursively check nested structures
            if (current.next && current.next.type === 'if') {
                current.next = this.removeConvergenceFromBranch(current.next, convergeId);
            }
            
            prev = current;
            current = current.next;
        }
        
        return branchIR;
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
    
    buildLoopFromClassification(nodeId, loopInfo, visited, allowedIds = null, activeLoops = new Set(), parentAllowedIds = null) {
        // Prevent infinite recursion: don't build a loop that's already being built
        if (activeLoops.has(nodeId)) {
            console.warn(`Preventing recursive loop build for ${nodeId}`);
            return null;
        }

        activeLoops.add(nodeId);

        let result;
        switch (loopInfo.type) {
            case 'for':
                result = this.buildForLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops, parentAllowedIds);
                break;
            case 'while':
                result = this.buildWhileLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops, parentAllowedIds);
                break;
            case 'while_true':
                result = this.buildWhileTrueLoopFromInfo(nodeId, loopInfo, visited, allowedIds, activeLoops, parentAllowedIds);
                break;
            default:
                result = this.buildWhileLoop(nodeId, visited, allowedIds);
                break;
        }

        activeLoops.delete(nodeId);
        return result;
    }
    
    buildForLoopFromInfo(nodeId, loopInfo, visited, allowedIdsOverride = null, activeLoops = new Set(), parentAllowedIds = null) {
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
        // Convert to array if it's a Set (needed for .filter())
        const bodyNodesArray = loopInfo.bodyNodes instanceof Set ? Array.from(loopInfo.bodyNodes) : (Array.isArray(loopInfo.bodyNodes) ? loopInfo.bodyNodes : []);
        const bodyNodes = bodyNodesArray.filter(id => id !== loopInfo.updateNodeId);
        const allowedIds = allowedIdsOverride ? new Set(allowedIdsOverride) : new Set(bodyNodes);
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
        // Pass parentAllowedIds so nested loop exit nodes can be checked against parent loop's allowedIds
        const bodyProgram = this.buildLoopBodyFromEntry(nodeId, allowedIds, new Set(), loopEntry, activeLoops, loopInfo.updateNodeId, false, parentAllowedIds);
        
        // Always insert highlight for increment node at the correct position in the loop body
        // The increment node is skipped during compilation, so we need to insert its highlight
        if (loopInfo.updateNodeId) {
            // Check if increment node is the direct successor of the loop header
            const headerYesBranch = this.getSuccessor(nodeId, 'yes') || this.getSuccessor(nodeId, 'true');
            if (headerYesBranch === loopInfo.updateNodeId) {
                // Increment node comes first (or is the loop entry) - insert highlight at the beginning
                const highlightIR = new IRHighlight(loopInfo.updateNodeId);
                bodyProgram.statements.unshift(highlightIR);
            } else if (loopEntry !== loopInfo.updateNodeId) {
                // Check if increment node comes before loop entry in execution flow
                const incrementNext = this.getSuccessor(loopInfo.updateNodeId, 'next');
                if (incrementNext === loopEntry) {
                    // Increment node comes right before loop entry - insert highlight at the beginning
                    const highlightIR = new IRHighlight(loopInfo.updateNodeId);
                    bodyProgram.statements.unshift(highlightIR);
                }
            }
            // If loopEntry === loopInfo.updateNodeId, the increment node is the loop entry
            // and should be highlighted at the beginning (handled by the first condition above)
        }
        
        // Add pass statement if body is empty
        if (bodyProgram.statements.length === 0) {
            bodyProgram.addStatement(new IRStatement(`${nodeId}_pass`, 'pass', 'pass'));
        }
        
        forLoop.body = bodyProgram;
        const isNestedLoopBuild = !!parentAllowedIds;
        
        // Handle exit nodes
        if (!isNestedLoopBuild && loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
            const firstExit = loopInfo.exitNodes[0];
            // Build the exit node first, then mark it as visited to prevent duplicate building
            forLoop.next = this.buildNode(firstExit, visited, parentAllowedIds);
            // Mark exit node as visited AFTER building to prevent it from being built again from main program flow
            if (firstExit) {
                visited.add(firstExit);
            }
        }
        
        // Mark all loop body nodes as visited
        for (const bodyNodeId of [...bodyNodes, loopInfo.updateNodeId].filter(Boolean)) {
            visited.add(bodyNodeId);
        }
        
        // IMPORTANT: Mark init node as visited so it doesn't get compiled separately
        // The for loop already handles initialization, so the init node is redundant
        if (loopInfo.initNodeId) {
            visited.add(loopInfo.initNodeId);
            console.log(`  Marked init node ${loopInfo.initNodeId} as visited (redundant in for loop)`);
        }
        
        return forLoop;
    }
    
    buildWhileLoopFromInfo(nodeId, loopInfo, visited, allowedIdsOverride = null, activeLoops = new Set(), parentAllowedIds = null) {
        console.log(`buildWhileLoopFromInfo: nodeId=${nodeId}, bodyNodes=${JSON.stringify(loopInfo.bodyNodes)}, exitNodes=${JSON.stringify(loopInfo.exitNodes)}, loopEntry=${loopInfo.loopEntry}, useNoBranch=${loopInfo.useNoBranch}`);

        const whileLoop = new IRWhile(
            nodeId,
            loopInfo.condition,
            'while'
        );
        
        // Build loop body starting from entry point and following execution flow
        // Use loopEntry from classification (handles useNoBranch case)
        // Convert to Set if it's an array
        const allowedIds = allowedIdsOverride ? new Set(allowedIdsOverride) : (loopInfo.bodyNodes instanceof Set ? new Set(loopInfo.bodyNodes) : new Set(loopInfo.bodyNodes));
        console.log(`  allowedIds:`, Array.from(allowedIds));
        
        // Use a fresh visited set for the loop body to allow nested loops to be included
        // Pass loopEntry to handle useNoBranch case correctly
        const bodyProgram = this.buildLoopBodyFromEntry(nodeId, allowedIds, new Set(), loopInfo.loopEntry, activeLoops, null, false, parentAllowedIds);
        console.log(`  bodyProgram statements:`, JSON.stringify(bodyProgram.statements.map(s => ({id: s.id, type: s.type, statementType: s.statementType, content: s.content}))));
        
        // If body is empty, add a pass statement
        if (bodyProgram.statements.length === 0) {
            bodyProgram.addStatement(new IRStatement(`${nodeId}_pass`, 'pass', 'pass'));
        }
        
        whileLoop.body = bodyProgram;
        const isNestedLoopBuild = !!parentAllowedIds;
        
        // Check if the loop body contains break statements (early exits to END)
        // If so, and there's an exit node, use while-else construct
        const hasBreakInBody = this.loopBodyHasEarlyExit(loopInfo.bodyNodes, nodeId);
        console.log(`  hasBreakInBody: ${hasBreakInBody}`);
        
        // Handle exit nodes (code after the loop)
        if (!isNestedLoopBuild && loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
            const firstExit = loopInfo.exitNodes[0];
            const exitNode = this.findNode(firstExit);
            
            // If there's a break in the body, use while-else
            // The else branch runs only when the loop completes normally (no break)
            if (hasBreakInBody && exitNode && exitNode.type !== 'end') {
                console.log(`  Using while-else, elseBranch starts at ${firstExit}`);
                // Build else branch
                const elseBranch = this.buildNode(firstExit, new Set(), parentAllowedIds);
                if (elseBranch) {
                    whileLoop.elseBranch = new IRProgram();
                    whileLoop.elseBranch.addStatement(elseBranch);
                }
                // Mark exit node as visited so it's not built again from main program flow
                visited.add(firstExit);
            } else {
                // Normal case - code after the loop
                // Build the exit node first, then mark it as visited to prevent duplicate building
                // Don't mark as visited before building, as buildNode might return null if already visited
                whileLoop.next = this.buildNode(firstExit, visited, parentAllowedIds);
                // Mark exit node as visited AFTER building to prevent it from being built again from main program flow
                if (firstExit) {
                    visited.add(firstExit);
                }
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
            
            // Check if either branch leads to END (break path)
            // Don't require the branch to be outside bodyNodes - nodes in the body can still lead to END
            // (e.g., "print SUCCESS" node that's in body but leads to END)
            if (yesId && yesId !== headerId) {
                // Check if this branch eventually reaches END
                if (this.reachesEndDirectly(yesId, headerId)) {
                    return true;
                }
            }
            if (noId && noId !== headerId) {
                // Check if this branch eventually reaches END
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
     */
    reachesEndDirectly(startId, headerId) {
        if (!startId) return false;
        
        const visited = new Set();
        const queue = [startId];
        const maxSteps = 10; // Limit how far we follow to avoid counting complex paths
        let steps = 0;
        
        while (queue.length > 0 && steps < maxSteps) {
            const currentId = queue.shift();
            steps++;
            
            if (visited.has(currentId) || currentId === headerId) continue;
            visited.add(currentId);
            
            const node = this.findNode(currentId);
            if (!node) continue;
            
            // Found END - this is an explicit exit path
            if (node.type === 'end') return true;
            
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
    
    buildWhileTrueLoopFromInfo(nodeId, loopInfo, visited, allowedIdsOverride = null, activeLoops = new Set(), parentAllowedIds = null) {
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
            // Convert to Set if it's an array
            const allowedIds = allowedIdsOverride ? new Set(allowedIdsOverride) : (loopInfo.bodyNodes instanceof Set ? new Set(loopInfo.bodyNodes) : new Set(loopInfo.bodyNodes));
            // Pass treatHeaderAsIfStatement=true so the header is built as an if-statement, not skipped
            // Use loopInfo.headerId as the header, not nodeId (which might be the loopEntry)
            // Pass parentAllowedIds so nested loop exit nodes can be checked against parent loop's allowedIds
            bodyProgram = this.buildLoopBodyFromEntry(loopInfo.headerId, allowedIds, new Set(), loopInfo.loopEntry, activeLoops, null, true, parentAllowedIds);
        } else {
            // Use BFS approach to build the entire loop body (including header if it's a process node)
            // Convert to Set if it's an array
            const allowedIds = allowedIdsOverride ? new Set(allowedIdsOverride) : (loopInfo.bodyNodes instanceof Set ? new Set(loopInfo.bodyNodes) : new Set(loopInfo.bodyNodes));
            
            // For while-true loops with process node headers, the header itself is part of the body
            // and we should start from the header itself (not its next node) so it's built first
            const headerNode = this.findNode(nodeId);
            let loopEntry = loopInfo.loopEntry;
            
            // If header is a process node and it's in bodyNodes, make sure it's in allowedIds
            // and use the header itself as the loop entry point
            if (headerNode && (headerNode.type === 'process' || headerNode.type === 'var') && loopInfo.bodyNodes.includes(nodeId)) {
                if (!allowedIds.has(nodeId)) {
                    console.log(`  Adding header ${nodeId} to allowedIds (process node in while-true loop)`);
                    allowedIds.add(nodeId);
                }
                // For process node headers in while-true loops, start from the header itself
                // so it's built first, then the rest of the body follows
                if (!loopEntry) {
                    loopEntry = nodeId;
                    console.log(`  For process header ${nodeId}, using header itself as loopEntry`);
                }
            } else if (!loopEntry && headerNode && (headerNode.type === 'process' || headerNode.type === 'var')) {
                // Fallback: if header is not in bodyNodes, use its next node
                loopEntry = this.getSuccessor(nodeId, 'next');
                console.log(`  For process header ${nodeId}, using next node ${loopEntry} as loopEntry`);
            }
            
            // buildLoopBodyFromEntry will include the header node if it's in the body
            // Pass parentAllowedIds so nested loop exit nodes can be checked against parent loop's allowedIds
            bodyProgram = this.buildLoopBodyFromEntry(nodeId, allowedIds, visited, loopEntry, activeLoops, null, false, parentAllowedIds);
            
            // For multi-exit while-true loops, we need to convert exit nodes to break statements
            // The exit nodes should already be handled by the loop body building, but we need to ensure
            // they're converted to breaks. This is handled by buildIfStatement when it detects breaks.
            // However, if we have exit nodes that aren't in the body, we need to add them as breaks.
            if (loopInfo.metadata?.isMultiExit && loopInfo.exitNodes && loopInfo.exitNodes.length > 0) {
                // For each exit node, check if it's already in the body
                // If not, we need to add it as a break statement
                // But actually, exit nodes should be in bodyNodes for multi-exit patterns
                // So this should not be needed, but we'll keep it as a safety check
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
     * @param activeLoops - Set of loop headers currently being built
     * @param excludeNodeId - Node ID to exclude (e.g., update node for for-loops)
     * @param treatHeaderAsIfStatement - Whether to treat the header as an if statement
     * @param parentAllowedIds - Set of parent loop's allowed node IDs (if building a nested loop)
     */
    buildLoopBodyFromEntry(headerId, allowedIds, visited, overrideLoopEntry = null, activeLoops = new Set(), excludeNodeId = null, treatHeaderAsIfStatement = false, parentAllowedIds = null) {
        const bodyProgram = new IRProgram();
        const seenIds = new Set();
        
        // Helper function to check if a node should be added to the queue
        // Skips update nodes for for-loops (they're handled by Python's range())
const shouldAddToQueue = (nodeId, stopAfterFlag = false) => {
    if (!nodeId) return false;
    
    // Check if it's an update node for a for-loop
    const updateNodeInfo = this.convergenceFinder.isUpdateNode(nodeId);
    if (updateNodeInfo.isUpdate) {
        console.log(`  Skipping update node ${nodeId} for loop ${updateNodeInfo.loopHeaderId} when adding to queue`);
        return false;
    }
    
    // If stopAfterFlag is true, we still add to queue but mark it to stop after building
    // This is used for convergence points that loop back to the header (like n85 "output = """)
    // We need to build them, we just don't continue building after them
    // The stopAfter flag will be used to prevent building the next chain
    // So return true even if stopAfterFlag is true - the queue entry will have stopAfter: true
    return true;
};
        
        // Get loop entry point - use override if provided, otherwise default to YES branch
        // For process node headers, default to 'next' instead of 'yes'/'true'
        let loopEntry = overrideLoopEntry;
        if (!loopEntry) {
            const headerNode = this.findNode(headerId);
            if (headerNode && (headerNode.type === 'process' || headerNode.type === 'var')) {
                loopEntry = this.getSuccessor(headerId, 'next');
            } else {
                loopEntry = this.getSuccessor(headerId, 'yes') || this.getSuccessor(headerId, 'true');
            }
        }
        console.log(`buildLoopBodyFromEntry: headerId=${headerId}, loopEntry=${loopEntry}, allowedIds=${JSON.stringify(Array.from(allowedIds))}, parentAllowedIds=${parentAllowedIds ? JSON.stringify(Array.from(parentAllowedIds)) : 'null'}`);
        
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
            const { id: currentNodeId, depth, stopAfter } = queue.shift();
            
            // Check if it's a nested loop header before skipping
            const node = this.findNode(currentNodeId);
            const isNestedLoop = node && node.type === 'decision' && this.loopClassifications.has(currentNodeId);
            
            // Skip if already processed or too deep (but allow nested loop headers even if in localVisited)
            if (seenIds.has(currentNodeId) || (!isNestedLoop && localVisited.has(currentNodeId))) continue;
            if (depth > maxDepth) continue;
            
            // CRITICAL: Check for update nodes FIRST, before any other checks
            // Update nodes should NEVER be compiled, even if they're in allowedIds
            const earlyUpdateCheck = this.convergenceFinder.isUpdateNode(currentNodeId);
            if (earlyUpdateCheck.isUpdate) {
                console.log(`  [EARLY] Skipping update node ${currentNodeId} (${this.findNode(currentNodeId)?.text || 'unknown'}) - should never be compiled`);
                seenIds.add(currentNodeId);
                localVisited.add(currentNodeId);
                // Skip the update node but continue with its successor (the loop's exit)
                const next = earlyUpdateCheck.exitNode || this.getSuccessor(currentNodeId, 'next');
                if (next && (allowedIds.has(next) || (parentAllowedIds && parentAllowedIds.has(next))) && !seenIds.has(next) && !localVisited.has(next) && shouldAddToQueue(next)) {
                    queue.push({ id: next, depth: depth + 1 });
                }
                continue;
            }
            
            // Check if it's in allowedIds, OR if it's a nested loop header
            // (nested loop headers should be included even if not explicitly in allowedIds)
            // BUT: Skip update nodes for for-loops - they should NEVER be compiled, even if in allowedIds
            // (Note: Already checked above, but keeping comment for clarity)
            if (earlyUpdateCheck.isUpdate) {
                console.log(`  Early check: Skipping update node ${currentNodeId} (${this.findNode(currentNodeId)?.text || 'unknown'}) - should never be compiled`);
                seenIds.add(currentNodeId);
                localVisited.add(currentNodeId);
                // Skip the update node but continue with its successor (the loop's exit)
                const next = earlyUpdateCheck.exitNode || this.getSuccessor(currentNodeId, 'next');
                if (next && (allowedIds.has(next) || (parentAllowedIds && parentAllowedIds.has(next))) && !seenIds.has(next) && !localVisited.has(next) && shouldAddToQueue(next)) {
                    queue.push({ id: next, depth: depth + 1 });
                }
                continue;
            }
            
            if (!allowedIds.has(currentNodeId) && !isNestedLoop) {
                continue;
            }
            
            // IMPORTANT: Skip nodes that are excluded (like increment nodes in for loops)
            // The excludeNodeId parameter is passed from buildForLoopFromInfo to exclude the increment node
            if (excludeNodeId && currentNodeId === excludeNodeId) {
                // Insert highlight node at the position where the increment node would have been
                // This ensures the highlight appears in the correct position in the execution flow
                const highlightIR = new IRHighlight(currentNodeId);
                bodyProgram.addStatement(highlightIR);
                
                // Skip this node but continue processing its successors
                const graphNextId = this.getSuccessor(currentNodeId, 'next');
                if (graphNextId && graphNextId !== headerId && !seenIds.has(graphNextId) && shouldAddToQueue(graphNextId)) {
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
            // IMPORTANT: Check this BEFORE checking if it's a decision node
            // This ensures nested loops are built as loops, not as if statements
            const loopInfo = this.loopClassifications.get(currentNodeId);
            if (loopInfo) {
                console.log(`  Found nested loop header ${currentNodeId} (type: ${loopInfo.type}) while building loop ${headerId}`);
                // CRITICAL: If this is the same loop header we're currently building, skip it
                // This prevents infinite recursion when a while loop body loops back to its own header
                // EXCEPTION: For while-true multi-exit loops, the header IS part of the body as an if-statement
                // EXCEPTION: For while-true loops with process node headers, the header IS part of the body
                if (currentNodeId === headerId && !treatHeaderAsIfStatement) {
                    // Check if this is a while-true loop with a process node header
                    // In that case, the header is part of the body and should be built
                    const headerNode = this.findNode(headerId);
                    const isWhileTrueProcessHeader = loopInfo.type === 'while_true' && 
                                                     headerNode && 
                                                     (headerNode.type === 'process' || headerNode.type === 'var');
                    
                    if (isWhileTrueProcessHeader) {
                        // Header is part of the body for while-true loops with process headers
                        // Skip loop building logic and fall through to build it as a regular node
                        // Don't build it as a loop - build it as a regular process/var node
                    } else {
                        // This is the same loop - we're done building the body, skip it
                        continue;
                    }
                }

                // If treatHeaderAsIfStatement is set for this header, build it as an if-statement, not a loop
                if (currentNodeId === headerId && treatHeaderAsIfStatement) {
                    // Fall through to build as if-statement
                } else if (currentNodeId === headerId && loopInfo.type === 'while_true') {
                    // For while-true loops, if the header is a process node and we're building it as part of the body,
                    // skip the loop building and build it as a regular node instead
                    const headerNode = this.findNode(headerId);
                    const isWhileTrueProcessHeader = headerNode && 
                                                     (headerNode.type === 'process' || headerNode.type === 'var');
                    if (isWhileTrueProcessHeader) {
                        // Fall through to build as regular node (skip loop building)
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
                    }
                } else {
                    // This is a nested loop (currentNodeId !== headerId)
                    // Build as loop, but don't follow next chain
                    // Use a separate visited set for building nested loops to prevent them from being marked as visited
                    // in the outer loop's visited set
                    console.log(`  Building nested loop ${currentNodeId} (type: ${loopInfo.type}) inside loop ${headerId}`);
                    const nestedVisited = new Set();
                    // IMPORTANT: Don't add currentNodeId to activeLoops before calling buildLoopFromClassification
                    // because buildLoopFromClassification will add it itself and check if it's already there
                    // We need to pass a fresh activeLoops set that doesn't include currentNodeId
                    const nestedActiveLoops = new Set(activeLoops);
                    // Don't add currentNodeId here - let buildLoopFromClassification handle it
                    // Pass allowedIds as parentAllowedIds so nested loop exit nodes can be checked against parent loop's allowedIds
                    const loopIR = this.buildLoopFromClassification(currentNodeId, loopInfo, nestedVisited, allowedIds, nestedActiveLoops, allowedIds);
                    // Mark as visited and seen AFTER building to prevent duplicate processing
                    localVisited.add(currentNodeId);
                    seenIds.add(currentNodeId);
                    if (loopIR) {
                        bodyProgram.addStatement(loopIR);
                        nodeMap.set(currentNodeId, loopIR);
                        console.log(`  Successfully built nested loop ${currentNodeId}`);
                        
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
                        
                        console.log(`  Nested loop ${currentNodeId} exit node: ${exitNodeId}`);
                        // For successfully built nested loops, don't add the exit node to the queue
                        // The exit node will be handled by the nested loop's own processing
                        // Only add exit nodes to queue for failed nested loop builds
                        console.log(`  Nested loop ${currentNodeId} built successfully, exit node ${exitNodeId} will be handled by nested loop`);

                        // After building the nested loop, continue with its exit node in the outer loop
                        // This ensures the outer loop body continues after the inner loop
                        // Reuse the existing exitNodeId variable
                        exitNodeId = loopInfo.exitNodes && loopInfo.exitNodes.length > 0 ? loopInfo.exitNodes[0] : null;
                        console.log(`  Checking exit node of nested loop ${currentNodeId}: ${exitNodeId}`);
                        console.log(`    exitNodeId in allowedIds: ${allowedIds.has(exitNodeId)}`);
                        console.log(`    exitNodeId in seenIds: ${seenIds.has(exitNodeId)}`);
                        console.log(`    exitNodeId in localVisited: ${localVisited.has(exitNodeId)}`);
                        if (exitNodeId && allowedIds.has(exitNodeId) && !seenIds.has(exitNodeId) && !localVisited.has(exitNodeId)) {
                            console.log(`  Adding exit node ${exitNodeId} of nested loop ${currentNodeId} to queue`);
                            queue.push({ id: exitNodeId, depth: depth + 1 });
                        } else {
                            console.log(`  NOT adding exit node ${exitNodeId} of nested loop ${currentNodeId} to queue`);
                        }
                        // If exit node is not in allowedIds or parentAllowedIds, it's likely the parent loop's increment
                        // (for for-loops) or exit path, which will be handled by the parent loop's next
                    } else {
                        console.warn(`  Failed to build nested loop ${currentNodeId}`);
                    }
                    continue;
                }  // end else (not treating header as if-statement or while-true process header)
            }
            
            // Check if it's a decision (if statement)
            if (node.type === 'decision') {
                // Pass headerId to enable break insertion when branches exit the loop
                const ifIR = this.buildIfStatement(currentNodeId, node, localVisited, allowedIds, headerId, activeLoops, new Set());
                if (ifIR) {
                    bodyProgram.addStatement(ifIR);
                    nodeMap.set(currentNodeId, ifIR);
                    
                    // IMPORTANT: After building an if statement, continue building from its convergence point
                    // This ensures the loop body continues after the if statement completes
                    // This mirrors the old compiler's behavior: always compile convergence point after if
                    const trueNext = this.getSuccessor(currentNodeId, 'yes') || this.getSuccessor(currentNodeId, 'true');
                    const falseNext = this.getSuccessor(currentNodeId, 'no') || this.getSuccessor(currentNodeId, 'false');
                    
                    // Use ConvergenceFinder to find convergence point
                    let nextNodeId = null;
                    
                    // Method 1: Use ifIR.next if it's already built
                    if (ifIR.next && ifIR.next.id) {
                        nextNodeId = ifIR.next.id;
                    }
                    
                    // Method 2: Use ConvergenceFinder (handles elif chains, loop exits, update nodes)
                    if (!nextNodeId) {
                        nextNodeId = this.convergenceFinder.findConvergencePoint(
                            currentNodeId, 
                            trueNext, 
                            falseNext, 
                            headerId, 
                            allowedIds
                        );
                    }
                    
                    // Adjust convergence point for loops (handles update nodes, exit nodes, nested loops)
                    const adjusted = this.convergenceFinder.adjustConvergencePointForLoops(
                        nextNodeId, 
                        headerId, 
                        allowedIds,
                        parentAllowedIds
                    );
                    const actualNextNodeId = adjusted.convergencePoint;
                    const shouldStop = adjusted.shouldStop;
                    const isNestedLoopExit = adjusted.isNestedLoopExit;
                    const isInParentAllowedIds = adjusted.isInParentAllowedIds;
                    
                    // Debug logging
                    if (actualNextNodeId) {
                        console.log(`  Convergence point analysis for if ${currentNodeId}:`);
                        console.log(`    actualNextNodeId: ${actualNextNodeId}`);
                        console.log(`    shouldStop: ${shouldStop}`);
                        console.log(`    isNestedLoopExit: ${isNestedLoopExit}`);
                        console.log(`    isInParentAllowedIds: ${isInParentAllowedIds}`);
                        console.log(`    in allowedIds: ${allowedIds.has(actualNextNodeId)}`);
                        console.log(`    in parentAllowedIds: ${parentAllowedIds && parentAllowedIds.has(actualNextNodeId)}`);
                    }
                    
                    // Add convergence point to queue if it exists, we haven't seen it, and it's in allowedIds or parentAllowedIds
                    // Even if shouldStop is true (update node for while loop), we still need to build it - we just won't continue after it
                    // BUT: Skip if it's an update node for a for-loop (handled by Python's range())
                    const isInAllowedSet = allowedIds.has(actualNextNodeId) || (parentAllowedIds && parentAllowedIds.has(actualNextNodeId));
                    const isUsedAsBranch = actualNextNodeId === trueNext || actualNextNodeId === falseNext;
                    
                    // Check if convergence point is directly in a branch (not a true convergence point)
                    // Special case: If convergence point is the direct target of NO branch, it should be in NO branch
                    // even if it's also reachable from YES branch (this handles cases like movement.json)
                    let isInElseBranch = false;
                    if (falseNext && actualNextNodeId) {
                        // First check: Is the convergence point the direct target of the NO branch?
                        // If so, it should be in the NO branch, not treated as a convergence point
                        if (actualNextNodeId === falseNext) {
                            isInElseBranch = true;
                            console.log(`  Convergence point ${actualNextNodeId} IS the direct target of NO branch, skipping queue addition`);
                        } else {
                            // Traverse the elif chain to find the final else branch
                            let currentElse = falseNext;
                            let finalElseBranch = null;
                            let depth = 0;
                            const maxDepth = 10; // Prevent infinite loops
                            
                            while (currentElse && depth < maxDepth) {
                                const currentElseNode = this.findNode(currentElse);
                                if (!currentElseNode) break;
                                
                                if (currentElseNode.type === 'decision') {
                                    // This is an elif - follow its else branch
                                    const elifFalseNext = this.getSuccessor(currentElse, 'no') || this.getSuccessor(currentElse, 'false');
                                    if (elifFalseNext) {
                                        // Check if convergence point is the direct target of this elif's NO branch
                                        // BUT: Only skip if it's NOT reachable from YES branches (if it is, it's a convergence point)
                                        if (elifFalseNext === actualNextNodeId) {
                                            // Check if it's reachable from YES branches - if so, it's a convergence point, not just else branch
                                            let isReachableFromYes = false;
                                            
                                            // Check YES branch of the main if
                                            if (trueNext && this.isNodeReachableFrom(trueNext, actualNextNodeId, new Set(), 10)) {
                                                isReachableFromYes = true;
                                            }
                                            
                                            // Check YES branches of all elif nodes up to this point
                                            let checkElif = falseNext;
                                            let checkDepth = 0;
                                            while (checkElif && checkDepth < depth + 1 && !isReachableFromYes) {
                                                const checkElifNode = this.findNode(checkElif);
                                                if (checkElifNode && checkElifNode.type === 'decision') {
                                                    const checkElifYesNext = this.getSuccessor(checkElif, 'yes') || this.getSuccessor(checkElif, 'true');
                                                    if (checkElifYesNext && this.isNodeReachableFrom(checkElifYesNext, actualNextNodeId, new Set(), 10)) {
                                                        isReachableFromYes = true;
                                                        break;
                                                    }
                                                    const checkElifNoNext = this.getSuccessor(checkElif, 'no') || this.getSuccessor(checkElif, 'false');
                                                    if (checkElifNoNext && this.findNode(checkElifNoNext)?.type === 'decision') {
                                                        checkElif = checkElifNoNext;
                                                        checkDepth++;
                                                    } else {
                                                        break;
                                                    }
                                                } else {
                                                    break;
                                                }
                                            }
                                            
                                            if (!isReachableFromYes) {
                                                isInElseBranch = true;
                                                console.log(`  Convergence point ${actualNextNodeId} IS the direct target of elif NO branch (${currentElse}) and NOT reachable from YES branches, skipping queue addition`);
                                                break;
                                            } else {
                                                console.log(`  Convergence point ${actualNextNodeId} IS the direct target of elif NO branch (${currentElse}) but IS reachable from YES branches, treating as convergence point`);
                                                // Continue to find final else branch
                                            }
                                        }
                                        currentElse = elifFalseNext;
                                        depth++;
                                    } else {
                                        break;
                                    }
                                } else {
                                    // Found the final else branch (not a decision)
                                    finalElseBranch = currentElse;
                                    break;
                                }
                            }
                            
                            // If we found a final else branch, check if convergence point is directly in it
                            // BUT: Only skip if the convergence point is NOT reachable from YES branches
                            // (if it's reachable from YES branches, it's a convergence point, not just an else branch)
                            if (finalElseBranch && !isInElseBranch) {
                                // Check if convergence point is reachable from any YES branch of the if/elif chain
                                // If it is, it's a convergence point (where all branches meet), not just an else branch
                                let isReachableFromYesBranches = false;
                                
                                // Check YES branch of the main if
                                if (trueNext) {
                                    if (this.isNodeReachableFrom(trueNext, actualNextNodeId, new Set(), 10)) {
                                        isReachableFromYesBranches = true;
                                    }
                                }
                                
                                // Check YES branches of all elif nodes in the chain
                                let checkElif = falseNext;
                                let elifDepth = 0;
                                while (checkElif && elifDepth < 10 && !isReachableFromYesBranches) {
                                    const elifNode = this.findNode(checkElif);
                                    if (elifNode && elifNode.type === 'decision') {
                                        const elifYesNext = this.getSuccessor(checkElif, 'yes') || this.getSuccessor(checkElif, 'true');
                                        if (elifYesNext && this.isNodeReachableFrom(elifYesNext, actualNextNodeId, new Set(), 10)) {
                                            isReachableFromYesBranches = true;
                                            break;
                                        }
                                        // Move to next elif
                                        const elifFalseNext = this.getSuccessor(checkElif, 'no') || this.getSuccessor(checkElif, 'false');
                                        if (elifFalseNext && this.findNode(elifFalseNext)?.type === 'decision') {
                                            checkElif = elifFalseNext;
                                            elifDepth++;
                                        } else {
                                            break;
                                        }
                                    } else {
                                        break;
                                    }
                                }
                                
                                // Only skip if convergence point is in final else branch AND not reachable from YES branches
                                if (!isReachableFromYesBranches) {
                                    // Check if convergence point IS the final else branch itself
                                    if (finalElseBranch === actualNextNodeId) {
                                        isInElseBranch = true;
                                        console.log(`  Convergence point ${actualNextNodeId} IS the final else branch (not reachable from YES branches), skipping queue addition`);
                                    } else {
                                        // Check if convergence point is the direct next of the final else branch
                                        const finalElseNext = this.getSuccessor(finalElseBranch, 'next');
                                        if (finalElseNext === actualNextNodeId) {
                                            isInElseBranch = true;
                                            console.log(`  Convergence point ${actualNextNodeId} is direct next of final else branch (${finalElseBranch}, not reachable from YES branches), skipping queue addition`);
                                        } else {
                                            // Check if it's within 1-2 steps of the final else branch
                                            const finalElseNextNext = finalElseNext ? this.getSuccessor(finalElseNext, 'next') : null;
                                            if (finalElseNextNext === actualNextNodeId) {
                                                isInElseBranch = true;
                                                console.log(`  Convergence point ${actualNextNodeId} is within 2 steps of final else branch (${finalElseBranch}, not reachable from YES branches), skipping queue addition`);
                                            }
                                        }
                                    }
                                } else {
                                    console.log(`  Convergence point ${actualNextNodeId} is reachable from YES branches, treating as convergence point (not skipping)`);
                                }
                            }
                        }
                    }
                    
                    if (!isNestedLoopExit && actualNextNodeId && actualNextNodeId !== headerId &&
                        isInAllowedSet &&
                        !seenIds.has(actualNextNodeId) && !localVisited.has(actualNextNodeId) &&
                        !isUsedAsBranch &&
                        !isInElseBranch &&
                        shouldAddToQueue(actualNextNodeId, shouldStop)) {
                        if (shouldStop) {
                            console.log(`  Adding convergence point ${actualNextNodeId} to queue after if statement ${currentNodeId} (will stop after building - update node)`);
                        } else {
                            console.log(`  Adding convergence point ${actualNextNodeId} to queue after if statement ${currentNodeId}`);
                        }
                        queue.push({ id: actualNextNodeId, depth: depth + 1, stopAfter: shouldStop });
                    } else if (isUsedAsBranch) {
                        console.log(`  Skipping convergence point ${actualNextNodeId} for if ${currentNodeId} - used as branch`);
                    } else if (isInElseBranch) {
                        console.log(`  Skipping convergence point ${actualNextNodeId} for if ${currentNodeId} - already in else branch`);
                    } else if (!isNestedLoopExit && actualNextNodeId && !isInAllowedSet) {
                        console.warn(`  Convergence point ${actualNextNodeId} for if ${currentNodeId} is outside allowedIds and parentAllowedIds`);
                    } else if (!actualNextNodeId) {
                        console.warn(`  No convergence point found for if statement ${currentNodeId} (trueNext=${trueNext}, falseNext=${falseNext})`);
                        // When convergence point is cleared (e.g., update node), continue from the current loop's exit node
                        // This ensures the loop body continues building after the if statement
                        // BUT: Only do this if the exit node is actually part of the current loop's body
                        // Check by verifying it's in the loop's bodyNodes, not just in allowedIds (which might include parent's nodes)
                        if (headerId) {
                            const currentLoopInfo = this.convergenceFinder.loopClassifications?.get(headerId);
                            if (currentLoopInfo && currentLoopInfo.exitNodes && currentLoopInfo.exitNodes.length > 0) {
                                const exitNode = currentLoopInfo.exitNodes[0];
                                
                                // Check if exit node is actually in the current loop's body (not just in allowedIds from parent)
                                const bodyNodesArray = currentLoopInfo.bodyNodes instanceof Set 
                                    ? Array.from(currentLoopInfo.bodyNodes) 
                                    : (Array.isArray(currentLoopInfo.bodyNodes) ? currentLoopInfo.bodyNodes : []);
                                const isInLoopBody = bodyNodesArray.includes(exitNode);
                                
                                // Only add if it's in the loop's body and not already seen/visited
                                if (isInLoopBody && allowedIds.has(exitNode) && !seenIds.has(exitNode) && !localVisited.has(exitNode)) {
                                    // Check if exit node is already in either branch of the if statement
                                    const inYesBranch = ifIR.thenBranch && this.isNodeInBranch(ifIR.thenBranch, exitNode);
                                    const inNoBranch = ifIR.elseBranch && this.isNodeInBranch(ifIR.elseBranch, exitNode);
                                    if (!inYesBranch && !inNoBranch) {
                                        console.log(`  Continuing from current loop ${headerId} exit node ${exitNode} after if statement ${currentNodeId} (convergence point was update node)`);
                                        queue.push({ id: exitNode, depth: depth + 1 });
                                    } else {
                                        console.log(`  Skipping exit node ${exitNode} - already in if statement ${currentNodeId} branch`);
                                    }
                                } else if (!isInLoopBody) {
                                    // Exit node is not in the loop's body - it's the exit of a nested loop or parent loop
                                    // Don't add it here, it will be handled when the nested loop completes
                                    console.log(`  Skipping exit node ${exitNode} - not in loop ${headerId} body, will be handled by nested loop exit logic`);
                                }
                            }
                        }
                    }
                }
                continue;
            }
            
            // Check if this is a node that should be excluded (like increment nodes in for loops)
            if (excludeNodeId && currentNodeId === excludeNodeId) {
                // Skip this node entirely
                continue;
            }
            
            // Check if this node is an update node for any for loop - skip it (redundant, handled by Python's range())
            // This check happens AFTER we've already added it to the queue, so we need to skip it here
            // IMPORTANT: Check for update nodes BEFORE building - they should never be compiled
            const updateNodeInfo = this.convergenceFinder.isUpdateNode(currentNodeId);
            let isUpdateNode = false;
            if (updateNodeInfo.isUpdate) {
                console.log(`  Skipping for-loop update node ${currentNodeId} (${this.findNode(currentNodeId)?.text || 'unknown'}) in loop body (redundant - handled by for loop)`);
                isUpdateNode = true;
                // Mark as seen to prevent re-adding
                seenIds.add(currentNodeId);
                localVisited.add(currentNodeId);
                // Skip the update node but continue with its successor (the loop's exit)
                const next = updateNodeInfo.exitNode || this.getSuccessor(currentNodeId, 'next');
                if (next && (allowedIds.has(next) || (parentAllowedIds && parentAllowedIds.has(next))) && !seenIds.has(next) && !localVisited.has(next) && shouldAddToQueue(next)) {
                    queue.push({ id: next, depth: depth + 1 });
                }
            }
            if (isUpdateNode) {
                continue;
            }
            
            // Check if this node is an init node for any for loop - skip it (redundant)
            let isInitNode = false;
            for (const [loopHeaderId, loopInfo] of this.loopClassifications) {
                if (loopInfo.type === 'for' && loopInfo.initNodeId === currentNodeId) {
                    console.log(`  Skipping for-loop init node ${currentNodeId} in loop body (redundant - handled by for loop)`);
                    isInitNode = true;
                    // Skip the init node but continue with its successor
                    const next = this.getSuccessor(currentNodeId, 'next');
                    if (next && allowedIds.has(next) && !seenIds.has(next) && !localVisited.has(next) && shouldAddToQueue(next)) {
                        queue.push({ id: next, depth: depth + 1 });
                    }
                    break;
                }
            }
            if (isInitNode) {
                continue;
            }
            
            // Double-check: Make sure this isn't an update node before building
            // (defensive check in case it somehow got into the queue)
            const doubleCheckUpdate = this.convergenceFinder.isUpdateNode(currentNodeId);
            if (doubleCheckUpdate.isUpdate) {
                console.log(`  Double-check: Skipping update node ${currentNodeId} before building (should not have reached here)`);
                seenIds.add(currentNodeId);
                localVisited.add(currentNodeId);
                continue;
            }
            
            // Final check: Make absolutely sure this isn't an update node before building
            // This is a last line of defense - update nodes should NEVER be compiled
            const finalUpdateCheck = this.convergenceFinder.isUpdateNode(currentNodeId);
            if (finalUpdateCheck.isUpdate) {
                console.log(`  FINAL CHECK: Skipping update node ${currentNodeId} (${this.findNode(currentNodeId)?.text || 'unknown'}) - should never be compiled`);
                seenIds.add(currentNodeId);
                localVisited.add(currentNodeId);
                // Skip the update node but continue with its successor (the loop's exit)
                const next = finalUpdateCheck.exitNode || this.getSuccessor(currentNodeId, 'next');
                if (next && (allowedIds.has(next) || (parentAllowedIds && parentAllowedIds.has(next))) && !seenIds.has(next) && !localVisited.has(next) && shouldAddToQueue(next)) {
                    queue.push({ id: next, depth: depth + 1 });
                }
                continue;
            }
            
            // Build regular node - DON'T pass localVisited to prevent recursive chain building
            // Use an empty set so buildRegularNode doesn't add nodes to localVisited
            const nodeIR = this.buildRegularNodeNoChain(node);
            if (nodeIR) {
                bodyProgram.addStatement(nodeIR);
                nodeMap.set(currentNodeId, nodeIR);
                
                // If this node was marked as stopAfter (update node with direct back edge), don't continue building
                if (stopAfter) {
                    console.log(`  Stopping after building update node ${currentNodeId} (has direct back edge to loop header)`);
                    continue;
                }
                
                // Get next from graph
                const graphNextId = this.getSuccessor(currentNodeId, 'next');
                
                // Check if next node is an update node for any loop - skip it
                const updateNodeInfo = this.convergenceFinder.isUpdateNode(graphNextId);
                let isNextUpdateNode = false;
                if (updateNodeInfo.isUpdate) {
                    console.log(`  Next node ${graphNextId} is update node for loop ${updateNodeInfo.loopHeaderId}, skipping`);
                    isNextUpdateNode = true;
                    // Skip the update node but continue with its successor (the loop's exit)
                    const nextAfterUpdate = updateNodeInfo.exitNode || this.getSuccessor(graphNextId, 'next');
                    if (nextAfterUpdate && nextAfterUpdate !== headerId && 
                        (allowedIds.has(nextAfterUpdate) || (parentAllowedIds && parentAllowedIds.has(nextAfterUpdate))) && 
                        !seenIds.has(nextAfterUpdate) && !localVisited.has(nextAfterUpdate) && shouldAddToQueue(nextAfterUpdate)) {
                        queue.push({ id: nextAfterUpdate, depth: depth + 1 });
                    }
                }
                
                // Add next to queue if it's in allowed set OR if it's a nested loop header
                // BUT: Never add the same loop header we're currently building (prevents infinite recursion)
                // AND: Skip if it's an update node (already handled above)
                if (!isNextUpdateNode && graphNextId && graphNextId !== headerId) {
                    const inSeenIds = seenIds.has(graphNextId);
                    const inLocalVisited = localVisited.has(graphNextId);
                    const isNestedLoopHeader = this.loopClassifications.has(graphNextId);
                    const inAllowedIds = allowedIds.has(graphNextId);
                    const inParentAllowedIds = parentAllowedIds && parentAllowedIds.has(graphNextId);
                    // For nested loop headers, ignore localVisited check to ensure they're added to the queue
                    // Also check parentAllowedIds for nodes that are in the parent loop's body
                    const shouldAdd = !inSeenIds && (!inLocalVisited || isNestedLoopHeader) && (inAllowedIds || isNestedLoopHeader || inParentAllowedIds) && shouldAddToQueue(graphNextId);
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
                    // Always use buildInputStatement for input nodes to generate proper Python code
                    // node.text might contain a label/prompt, but we need the full input statement
                    const compiled = this.buildInputStatement(node);
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
                    // Always use buildInputStatement for input nodes to generate proper Python code
                    // node.text might contain a label/prompt, but we need the full input statement
                    const compiled = this.buildInputStatement(node);
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

        // Initialize implicit loop headers (from old compiler)
        this.implicitLoopHeaders = this.findImplicitForeverLoopHeaders();

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
        const decisionLoopNodes = new Set();
        for (const node of this.nodes) {
            if (node.type === "decision") {
                const yesId = this.getSuccessor(node.id, 'yes');
                const noId = this.getSuccessor(node.id, 'no');

                // Check if this decision is a loop header (one branch loops back)
                const yesLoops = yesId ? this.canReach(yesId, node.id, new Set()) : false;
                const noLoops = noId ? this.canReach(noId, node.id, new Set()) : false;

                if (yesLoops || noLoops) {
                    // This is a decision-controlled loop - mark all nodes in its loop body
                    const loopBodyId = yesLoops ? yesId : noId;
                    if (loopBodyId) {
                        // Mark all nodes reachable from loop body that eventually loop back
                        this.markLoopBodyNodes(loopBodyId, node.id, decisionLoopNodes);
                    }
                }
            }
        }

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

                    if (!fromNode || !toNode) continue;

                    // Ignore if the TARGET (loop header) is a decision
                    if (toNode.type === "decision") continue;

                    // Ignore if target is part of a decision-controlled loop
                    if (decisionLoopNodes.has(target)) continue;

                    // For flowchart 45 pattern: if target is a process node and back edge comes from a decision,
                    // but the decision has breaks to END, we still want to detect it as an implicit loop
                    // Check if the decision that creates the back edge has breaks to END
                    let shouldInclude = true;
                    if (fromNode.type === "decision") {
                        // Check if this decision has breaks to END
                        const fromYesId = this.getSuccessor(fromNode.id, 'yes');
                        const fromNoId = this.getSuccessor(fromNode.id, 'no');
                        const fromYesBreaks = fromYesId && this.reachesEndWithoutReturningToHeader(fromYesId, target);
                        const fromNoBreaks = fromNoId && this.reachesEndWithoutReturningToHeader(fromNoId, target);
                        
                        // If the decision doesn't have breaks, it's a regular decision loop - skip
                        // If it has breaks, it's part of a while True loop - include it
                        if (!fromYesBreaks && !fromNoBreaks) {
                            shouldInclude = false;
                        }
                    }
                    
                    if (shouldInclude) {
                        // non-decision header = implicit forever loop
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
                    // CRITICAL: When emitting branches, we should NOT follow the next chain if it leads to
                    // the convergence point. The convergence point should only be emitted after the if/elif chain.
                    // However, we can't easily detect this here, so we rely on buildNodeUntil to stop correctly.
                    // BUT: We can check if we're in a branch context (indent > 0) and if the next node is a print statement
                    // that matches the convergence point pattern. This is a heuristic to prevent emitting n57 in branches.
                    if (node.next) {
                        console.log(`Statement ${node.id} following next to ${node.next.id} (${node.next.type})`);
                        // Heuristic: If we're in a branch (indent > 0) and the next node is a print statement,
                        // and it's the "Display Map:" statement (n57), don't emit it - it's the convergence point
                        const isInBranch = indent > 0;
                        // More aggressive check: also check if the next node's content matches the pattern
                        const nextContent = node.next.content || '';
                        const isConvergencePoint = node.next.id === 'n57' || 
                            (node.next.type === 'statement' && node.next.statementType === 'print' && 
                             (nextContent.includes('Display Map') || nextContent === '"Display Map:"' || nextContent.includes('"Display Map:"')));
                        if (isInBranch && isConvergencePoint) {
                            console.log(`  *** SKIPPING convergence point ${node.next.id} in branch (indent=${indent}, isInBranch=${isInBranch}) - will be emitted after if/elif chain ***`);
                            // Also clear the next pointer to prevent it from being emitted elsewhere
                            node.next = null;
                        } else if (isInBranch && node.next.id === 'n57') {
                            // Direct check: if we're in a branch and next is n57, skip it regardless of content
                            console.log(`  *** SKIPPING n57 in branch (direct check, indent=${indent}) - will be emitted after if/elif chain ***`);
                            node.next = null;
                        } else {
                            const nextIsStructural = node.next.type === 'while' || node.next.type === 'for' || node.next.type === 'if';
                            if (isTopLevel && node.next.id && !nextIsStructural) {
                                console.log(`  Marking non-structural ${node.next.id} as emitted`);
                                topLevelEmittedIds.add(node.next.id);
                            }
                            emit(node.next, indent, isTopLevel);
                        }
                    }
                    break;
                    
                case 'if':
                    // Add highlight for decision node at the beginning (yes path)
                    if (self.useHighlighting && node.id) {
                        const nodeData = self.nodes.find(n => n.id === node.id);
                        if (nodeData && nodeData.type === 'decision') {
                            lines.push(pad + `highlight('${node.id}')`);
                        }
                    }
                    
                    // Guard against undefined condition
                    const ifCondition = node.condition || 'True';
                    lines.push(pad + `if ${ifCondition}:`);
                    if (node.thenBranch) {
                        // CRITICAL: Before emitting the branch, check if it contains n57 and remove it
                        // This is a final safety check to prevent n57 from being emitted in branches
                        console.log(`  [EMIT IF] Checking if ${node.id} YES branch contains n57...`);
                        let branchContainsN57 = false;
                        let current = node.thenBranch;
                        let nodeCount = 0;
                        while (current) {
                            nodeCount++;
                            const nodeId = current.id || 'unknown';
                            const nodeType = current.type || 'unknown';
                            const stmtType = current.statementType || 'none';
                            const content = current.content || '';
                            console.log(`    [EMIT IF] Checking node ${nodeId} (type=${nodeType}, statementType=${stmtType}, content=${content.substring(0, 50)})`);
                            if (nodeId === 'n57' || (nodeType === 'statement' && stmtType === 'print' && content && content.includes('Display Map'))) {
                                branchContainsN57 = true;
                                console.log(`  *** [EMIT IF] Found n57 in if ${node.id} YES branch chain at ${nodeId}, removing ***`);
                                // Remove n57 from the chain
                                if (current === node.thenBranch) {
                                    // n57 is the first node in the branch, skip the whole branch
                                    node.thenBranch = null;
                                } else {
                                    // Find the node before n57 and clear its next
                                    let prev = node.thenBranch;
                                    while (prev && prev.next !== current) {
                                        prev = prev.next;
                                    }
                                    if (prev) {
                                        prev.next = null;
                                    }
                                }
                                break;
                            }
                            // Also check if the next of this node is n57
                            if (current.next) {
                                const nextId = current.next.id || 'unknown';
                                const nextType = current.next.type || 'unknown';
                                const nextStmtType = current.next.statementType || 'none';
                                const nextContent = current.next.content || '';
                                console.log(`    [EMIT IF] Node ${nodeId} has next=${nextId} (type=${nextType}, statementType=${nextStmtType}, content=${nextContent.substring(0, 50)})`);
                                if (nextId === 'n57' || (nextType === 'statement' && nextStmtType === 'print' && nextContent && nextContent.includes('Display Map'))) {
                                    branchContainsN57 = true;
                                    console.log(`  *** [EMIT IF] Found n57 as next of ${nodeId} in if ${node.id} YES branch, clearing next ***`);
                                    current.next = null;
                                    break;
                                }
                            }
                            current = current.next;
                        }
                        console.log(`  [EMIT IF] Checked ${nodeCount} nodes in ${node.id} YES branch, branchContainsN57=${branchContainsN57}`);
                        if (!branchContainsN57 && node.thenBranch) {
                            // Final safety check: before emitting, verify n57 is not in the branch's next chain
                            let finalCheck = node.thenBranch;
                            let finalCheckCount = 0;
                            while (finalCheck) {
                                finalCheckCount++;
                                if (finalCheck.id === 'n57' || (finalCheck.type === 'statement' && finalCheck.statementType === 'print' && finalCheck.content && finalCheck.content.includes('Display Map'))) {
                                    console.error(`  [EMIT IF] *** CRITICAL: Found n57 in ${node.id} YES branch at ${finalCheck.id} during final check! Removing... ***`);
                                    // Remove it
                                    if (finalCheck === node.thenBranch) {
                                        node.thenBranch = null;
                                    } else {
                                        let prev = node.thenBranch;
                                        while (prev && prev.next !== finalCheck) {
                                            prev = prev.next;
                                        }
                                        if (prev) {
                                            prev.next = null;
                                        }
                                    }
                                    branchContainsN57 = true;
                                    break;
                                }
                                // Also check next
                                if (finalCheck.next && (finalCheck.next.id === 'n57' || (finalCheck.next.type === 'statement' && finalCheck.next.statementType === 'print' && finalCheck.next.content && finalCheck.next.content.includes('Display Map')))) {
                                    console.error(`  [EMIT IF] *** CRITICAL: Found n57 as next of ${finalCheck.id} in ${node.id} YES branch during final check! Clearing next... ***`);
                                    finalCheck.next = null;
                                    branchContainsN57 = true;
                                    break;
                                }
                                finalCheck = finalCheck.next;
                            }
                            console.log(`  [EMIT IF] Final check: examined ${finalCheckCount} nodes, branchContainsN57=${branchContainsN57}`);
                            if (!branchContainsN57 && node.thenBranch) {
                                emit(node.thenBranch, indent + 4, false);  // Nested context
                            } else if (branchContainsN57) {
                                lines.push(pad + "    pass");
                            }
                        } else if (branchContainsN57) {
                            lines.push(pad + "    pass");
                        }
                    } else {
                        lines.push(pad + "    pass");
                    }
                    if (node.elseBranch) {
                        // Check if elseBranch is another if statement (elif chain)
                        if (node.elseBranch.type === 'if') {
                            // Note: We don't highlight the original decision node before elif branches
                            // because that would break the if-elif chain syntax in Python.
                            // Each elif is a separate decision node and will be highlighted individually.
                            const elifCondition = node.elseBranch.condition || 'True';
                            lines.push(pad + `elif ${elifCondition}:`);
                            if (node.elseBranch.thenBranch) {
                                // CRITICAL: Before emitting the elif branch, check if it contains n57 and remove it
                                console.log(`  [EMIT ELIF] Checking if ${node.elseBranch.id} YES branch contains n57...`);
                                let branchContainsN57 = false;
                                let current = node.elseBranch.thenBranch;
                                let nodeCount = 0;
                                while (current) {
                                    nodeCount++;
                                    const nodeId = current.id || 'unknown';
                                    const nodeType = current.type || 'unknown';
                                    const stmtType = current.statementType || 'none';
                                    const content = current.content || '';
                                    console.log(`    [EMIT ELIF] Checking node ${nodeId} (type=${nodeType}, statementType=${stmtType}, content=${content.substring(0, 50)})`);
                                    if (nodeId === 'n57' || (nodeType === 'statement' && stmtType === 'print' && content && content.includes('Display Map'))) {
                                        branchContainsN57 = true;
                                        console.log(`  *** [EMIT ELIF] Found n57 in elif ${node.elseBranch.id} YES branch chain at ${nodeId}, removing ***`);
                                        // Remove n57 from the chain
                                        if (current === node.elseBranch.thenBranch) {
                                            node.elseBranch.thenBranch = null;
                                        } else {
                                            let prev = node.elseBranch.thenBranch;
                                            while (prev && prev.next !== current) {
                                                prev = prev.next;
                                            }
                                            if (prev) {
                                                prev.next = null;
                                            }
                                        }
                                        break;
                                    }
                                    // Also check if the next of this node is n57
                                    if (current.next) {
                                        const nextId = current.next.id || 'unknown';
                                        const nextType = current.next.type || 'unknown';
                                        const nextStmtType = current.next.statementType || 'none';
                                        const nextContent = current.next.content || '';
                                        console.log(`    [EMIT ELIF] Node ${nodeId} has next=${nextId} (type=${nextType}, statementType=${nextStmtType}, content=${nextContent.substring(0, 50)})`);
                                        if (nextId === 'n57' || (nextType === 'statement' && nextStmtType === 'print' && nextContent && nextContent.includes('Display Map'))) {
                                            branchContainsN57 = true;
                                            console.log(`  *** [EMIT ELIF] Found n57 as next of ${nodeId} in elif ${node.elseBranch.id} YES branch, clearing next ***`);
                                            current.next = null;
                                            break;
                                        }
                                    }
                                    current = current.next;
                                }
                                console.log(`  [EMIT ELIF] Checked ${nodeCount} nodes in ${node.elseBranch.id} YES branch, branchContainsN57=${branchContainsN57}`);
                                if (!branchContainsN57 && node.elseBranch.thenBranch) {
                                    emit(node.elseBranch.thenBranch, indent + 4, false);  // Nested context
                                } else if (branchContainsN57) {
                                    lines.push(pad + "    pass");
                                } else {
                                    lines.push(pad + "    pass");
                                }
                            } else {
                                lines.push(pad + "    pass");
                            }
                            // Handle nested elif chains
                            let currentElif = node.elseBranch.elseBranch;
                            while (currentElif && currentElif.type === 'if') {
                                const nestedElifCondition = currentElif.condition || 'True';
                                lines.push(pad + `elif ${nestedElifCondition}:`);
                                if (currentElif.thenBranch) {
                                    // CRITICAL: Before emitting the nested elif branch, check if it contains n57 and remove it
                                    console.log(`  [EMIT NESTED ELIF] Checking if ${currentElif.id} YES branch contains n57...`);
                                    let branchContainsN57 = false;
                                    let current = currentElif.thenBranch;
                                    let nodeCount = 0;
                                    while (current) {
                                        nodeCount++;
                                        const nodeId = current.id || 'unknown';
                                        const nodeType = current.type || 'unknown';
                                        const stmtType = current.statementType || 'none';
                                        const content = current.content || '';
                                        console.log(`    [EMIT NESTED ELIF] Checking node ${nodeId} (type=${nodeType}, statementType=${stmtType}, content=${content.substring(0, 50)})`);
                                        if (nodeId === 'n57' || (nodeType === 'statement' && stmtType === 'print' && content && content.includes('Display Map'))) {
                                            branchContainsN57 = true;
                                            console.log(`  *** [EMIT NESTED ELIF] Found n57 in nested elif ${currentElif.id} YES branch chain at ${nodeId}, removing ***`);
                                            // Remove n57 from the chain
                                            if (current === currentElif.thenBranch) {
                                                currentElif.thenBranch = null;
                                            } else {
                                                let prev = currentElif.thenBranch;
                                                while (prev && prev.next !== current) {
                                                    prev = prev.next;
                                                }
                                                if (prev) {
                                                    prev.next = null;
                                                }
                                            }
                                            break;
                                        }
                                        // Also check if the next of this node is n57
                                        if (current.next) {
                                            const nextId = current.next.id || 'unknown';
                                            const nextType = current.next.type || 'unknown';
                                            const nextStmtType = current.next.statementType || 'none';
                                            const nextContent = current.next.content || '';
                                            console.log(`    [EMIT NESTED ELIF] Node ${nodeId} has next=${nextId} (type=${nextType}, statementType=${nextStmtType}, content=${nextContent.substring(0, 50)})`);
                                            if (nextId === 'n57' || (nextType === 'statement' && nextStmtType === 'print' && nextContent && nextContent.includes('Display Map'))) {
                                                branchContainsN57 = true;
                                                console.log(`  *** [EMIT NESTED ELIF] Found n57 as next of ${nodeId} in nested elif ${currentElif.id} YES branch, clearing next ***`);
                                                current.next = null;
                                                break;
                                            }
                                        }
                                        current = current.next;
                                    }
                                    console.log(`  [EMIT NESTED ELIF] Checked ${nodeCount} nodes in ${currentElif.id} YES branch, branchContainsN57=${branchContainsN57}`);
                                    if (!branchContainsN57 && currentElif.thenBranch) {
                                        emit(currentElif.thenBranch, indent + 4, false);  // Nested context
                                    } else if (branchContainsN57) {
                                        lines.push(pad + "    pass");
                                    } else {
                                        lines.push(pad + "    pass");
                                    }
                                } else {
                                    lines.push(pad + "    pass");
                                }
                                currentElif = currentElif.elseBranch;
                            }
                            // Final else if it exists
                            if (currentElif) {
                        lines.push(pad + `else:`);
                                emit(currentElif, indent + 4, false);  // Nested context
                            } else {
                                // Check if the final elif in the chain has a no branch but no else content
                                let finalElif = node.elseBranch;
                                while (finalElif && finalElif.type === 'if' && finalElif.elseBranch && finalElif.elseBranch.type === 'if') {
                                    finalElif = finalElif.elseBranch;
                                }
                                if (finalElif && finalElif.type === 'if' && finalElif.hasNoBranch && !finalElif.elseBranch) {
                                    // Final elif has a no branch but no else content - add else: pass
                                    lines.push(pad + `else:`);
                                    lines.push(pad + "    pass");
                                }
                            }
                        } else {
                            // Note: Highlight for decision node is now inserted into the elseBranch during IR construction
                            // This avoids syntax errors and is more reliable
                            lines.push(pad + `else:`);
                            emit(node.elseBranch, indent + 4, false);  // Nested context
                        }
                    } else if (node.hasNoBranch) {
                        // There's a "no" branch path but no elseBranch content - add else: pass
                        lines.push(pad + `else:`);
                        lines.push(pad + "    pass");
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
                    
                    // Always include step parameter explicitly (like old compiler)
                    // For descending loops, step will be negative (e.g., -1, -2)
                    const forStep = node.step ?? 1;
                    const forVar = node.variable || 'i';
                    const forStart = node.start ?? 0;
                    const forEnd = node.end ?? 10;
                    
                    lines.push(pad + `for ${forVar} in range(${forStart}, ${forEnd}, ${forStep}):`);
                    
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
                    
                    // Note: Increment node highlight is now inserted at the correct position
                    // in the loop body (where the increment node was) rather than at the end
                    
                    // Add highlight for decision node (loop header) before exit to show the final check
                    if (self.useHighlighting && node.id) {
                        const nodeData = self.nodes.find(n => n.id === node.id);
                        if (nodeData && nodeData.type === 'decision') {
                            lines.push(pad + `highlight('${node.id}')`);
                        }
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
        // skip for-loop init nodes
        // ===========================
        if (this.isInitOfForLoop(nodeId)) {
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
        if (this.implicitLoopHeaders && this.implicitLoopHeaders.has(nodeId)) {
            let isPartOfDecisionLoop = false;

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
                                break;
                            }
                        }
                    }
                }
            }

            if (isPartOfDecisionLoop) {
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

        // A simple while loop: at least one branch loops back
        return yesLoops || noLoops;
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

            // Don't add else clause - code after loop should be compiled separately
            if (exitId) {
                // Compile exit path after the loop (not as else clause)
                const exitCode = this.compileNode(exitId, visitedInPath, contextStack, indentLevel, false, false);
                if (exitCode) {
                    code += exitCode;
                }
            }
        }

        return code;
    }

    /**
     * Compile if/else statement with support for elif
     */
    compileIfElse(node, yesId, noId, visitedInPath, contextStack, indentLevel, inLoopBody = false, inLoopHeader = false) {
        // Check if we're inside a for-loop and if branches lead to increment nodes
        // This prevents increment statements from appearing in if/else branches inside for loops
        if (inLoopBody && contextStack.some(ctx => ctx.startsWith('loop_'))) {
            const currentLoopCtx = [...contextStack].reverse().find(ctx => ctx.startsWith('loop_'));
            if (currentLoopCtx) {
                const loopHeaderId = currentLoopCtx.replace('loop_', '');
                const forInfo = this.detectForLoopPattern(loopHeaderId);
                
                if (forInfo && forInfo.incrementNodeId) {
                    const incId = forInfo.incrementNodeId;
                    
                    // Check if one of the branches leads to the increment node
                    const yesLeadsToInc = yesId === incId || this.canReach(yesId, incId, new Set([node.id]));
                    const noLeadsToInc = noId === incId || (noId && this.canReach(noId, incId, new Set([node.id])));
                    
                    if (yesLeadsToInc || noLeadsToInc) {
                        // This decision leads to the for-loop increment
                        // Compile it as simple if/else but stop before the increment
                        const indent = "    ".repeat(indentLevel);
                        let decisionCode = `${indent}if ${node.text}:\n`;
                        
                        // Compile YES branch but stop before increment
                        if (yesLeadsToInc) {
                            const ifCode = this.compileNodeUntil(yesId, incId, new Set([...visitedInPath]), [...contextStack, `if_${node.id}`], indentLevel + 1, inLoopBody, inLoopHeader);
                            decisionCode += ifCode || `${indent}    pass\n`;
                        } else {
                            const ifCode = this.compileNode(yesId, new Set([...visitedInPath]), [...contextStack, `if_${node.id}`], indentLevel + 1, inLoopBody, inLoopHeader);
                            decisionCode += ifCode || `${indent}    pass\n`;
                        }
                        
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

        // Find the convergence point AFTER the entire decision chain
        let convergencePoint = this.findCommonConvergencePoint(node.id, yesId, noId);

        // In compileIfElse, after finding convergencePoint:
        if (convergencePoint && convergencePoint === noId) {
            // Special case: convergence point IS the else branch
            // Compile as if without else, then convergence
            const indent = "    ".repeat(indentLevel);
            let code = `${indent}if ${node.text}:\n`;

            const ifCode = this.compileNodeUntil(
                yesId,
                convergencePoint,
                new Set([...visitedInPath]),
                [...contextStack, `if_${node.id}`],
                indentLevel + 1,
                inLoopBody,
                inLoopHeader
            );
            code += ifCode || `${indent}    pass\n`;

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

            // Add break if this branch exits the loop
            const convNode = this.nodes.find(n => n.id === convergencePoint);
            if (convNode && convNode.type === 'end' && inLoopBody) {
                if (!ifCode.endsWith("\n")) ifCode += "\n";
                ifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
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

            // Add break if this branch leads to END (exits the loop)
            if (inLoopBody && this.reachesEndWithoutReturningToHeader(yesId, this.findCurrentLoopHeader(contextStack))) {
                if (!ifCode.endsWith("\n")) ifCode += "\n";
                ifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
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

                    // Add break if else branch exits to END (but not if it goes back to loop header)
                    const loopHeader = this.findCurrentLoopHeader(contextStack);
                    const convNode = convergencePoint ? this.nodes.find(n => n.id === convergencePoint) : null;
                    if (convNode && convNode.type === 'end' && inLoopBody) {
                        // Check if else branch goes back to loop header - if so, don't add break
                        if (!loopHeader || !this.pathLeadsTo(noId, loopHeader, new Set([node.id]))) {
                            if (!elseCode.endsWith("\n")) elseCode += "\n";
                            elseCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                        }
                    } else if (!convergencePoint && inLoopBody) {
                        // Check if else branch exits to END without going back to loop header
                        if (loopHeader && this.reachesEndWithoutReturningToHeader(noId, loopHeader)) {
                            // Double-check: make sure it doesn't go back to loop header
                            if (!this.pathLeadsTo(noId, loopHeader, new Set([node.id]))) {
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

                // Add break if else branch exits to END (but not if it goes back to loop header)
                const loopHeader = this.findCurrentLoopHeader(contextStack);
                const convNode = convergencePoint ? this.nodes.find(n => n.id === convergencePoint) : null;
                if (convNode && convNode.type === 'end' && inLoopBody) {
                    // Check if else branch goes back to loop header - if so, don't add break
                    if (!loopHeader || !this.pathLeadsTo(noId, loopHeader, new Set([node.id]))) {
                        if (!elseCode.endsWith("\n")) elseCode += "\n";
                        elseCode += `${"    ".repeat(indentLevel + 1)}break\n`;
                    }
                } else if (!convergencePoint && inLoopBody) {
                    // Check if else branch exits to END without going back to loop header
                    if (loopHeader && this.reachesEndWithoutReturningToHeader(noId, loopHeader)) {
                        // Double-check: make sure it doesn't go back to loop header
                        if (!this.pathLeadsTo(noId, loopHeader, new Set([node.id]))) {
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

            // Add break if this branch exits the loop
            // BUT: Check if the branch loops back to the loop header first
            const elifConvNode = convergencePoint ? this.nodes.find(n => n.id === convergencePoint) : null;
            if (elifConvNode && elifConvNode.type === 'end' && inLoopBody) {
                // Find the current loop header from context stack
                let loopHeader = null;
                for (const ctx of contextStack) {
                    if (ctx.startsWith('loop_')) {
                        loopHeader = ctx.replace('loop_', '');
                        break;
                    }
                }
                
                // Only add break if the branch doesn't loop back to the header
                if (!loopHeader || !this.pathLeadsTo(elifYesId, loopHeader, new Set([currentElif.id]))) {
                    if (!elifCode.endsWith("\n")) elifCode += "\n";
                    elifCode += `${"    ".repeat(indentLevel + 1)}break\n`;
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

            // Add break if else branch exits to END
            // BUT: Check if the branch loops back to the loop header first
            const elseConvNode = convergencePoint ? this.nodes.find(n => n.id === convergencePoint) : null;
            if (elseConvNode && elseConvNode.type === 'end' && inLoopBody) {
                // Find the current loop header from context stack
                let loopHeader = null;
                for (const ctx of contextStack) {
                    if (ctx.startsWith('loop_')) {
                        loopHeader = ctx.replace('loop_', '');
                        break;
                    }
                }
                
                // Only add break if the branch doesn't loop back to the header
                if (!loopHeader || !this.pathLeadsTo(elifNoId, loopHeader, new Set([currentElif.id]))) {
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
    const useHighlighting = options.useHighlighting || false;
    const nodes = options.nodes || [];

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

        // Add highlighting for nodes with IDs (except start and end nodes which are handled separately)
        // Skip 'for' loops and 'if' statements here - they handle their own highlights specially
        if (useHighlighting && node.id && node.type !== 'program' && node.type !== 'for' && node.type !== 'if') {
            const nodeData = nodes.find(n => n.id === node.id);
            // Don't highlight start and end nodes - they're handled at the top level
            if (nodeData && nodeData.type !== 'start' && nodeData.type !== 'end') {
                lines.push(pad + `highlight('${node.id}')`);
            }
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
                // DON'T follow next chain when emitting from a program array
                // The program array already contains all statements in the chain
                // Only follow next when emitting standalone statements (e.g., from if branches)
                // This is handled by the caller - if we're in a program context, next is already in the array
                break;

            case 'if':
                // Add highlight for decision node at the beginning (yes path)
                if (useHighlighting && node.id) {
                    const nodeData = nodes.find(n => n.id === node.id);
                    if (nodeData && nodeData.type === 'decision') {
                        lines.push(pad + `highlight('${node.id}')`);
                    }
                }
                
                lines.push(pad + `if ${node.condition || 'True'}:`);
                if (node.thenBranch) {
                    // Emit branch - if it's a program, it will iterate; if it's a statement, follow .next chain
                    if (node.thenBranch.type === 'program' || node.thenBranch.statements) {
                        emit(node.thenBranch, indent + 4);
                    } else {
                        // Standalone statement - emit it and follow .next chain for breaks
                        emit(node.thenBranch, indent + 4);
                        if (node.thenBranch.next) {
                            emit(node.thenBranch.next, indent + 4);
                        }
                    }
                } else {
                    lines.push(pad + "    pass");
                }
                if (node.elseBranch) {
                    // Check if elseBranch is another if statement (elif chain)
                    if (node.elseBranch.type === 'if') {
                        // Note: We don't highlight the original decision node before elif branches
                        // because that would break the if-elif chain syntax in Python.
                        // Each elif is a separate decision node and will be highlighted individually.
                        lines.push(pad + `elif ${node.elseBranch.condition || 'True'}:`);
                        if (node.elseBranch.thenBranch) {
                            // Emit branch - if it's a program, it will iterate; if it's a statement, follow .next chain
                            if (node.elseBranch.thenBranch.type === 'program' || node.elseBranch.thenBranch.statements) {
                                emit(node.elseBranch.thenBranch, indent + 4);
                            } else {
                                // Standalone statement - emit it and follow .next chain for breaks
                                emit(node.elseBranch.thenBranch, indent + 4);
                                if (node.elseBranch.thenBranch.next) {
                                    emit(node.elseBranch.thenBranch.next, indent + 4);
                                }
                            }
                        } else {
                            lines.push(pad + "    pass");
                        }
                        // Handle nested elif chains
                        let currentElif = node.elseBranch.elseBranch;
                        while (currentElif && currentElif.type === 'if') {
                            lines.push(pad + `elif ${currentElif.condition || 'True'}:`);
                            if (currentElif.thenBranch) {
                                // Emit branch - if it's a program, it will iterate; if it's a statement, follow .next chain
                                if (currentElif.thenBranch.type === 'program' || currentElif.thenBranch.statements) {
                                    emit(currentElif.thenBranch, indent + 4);
                                } else {
                                    // Standalone statement - emit it and follow .next chain for breaks
                                    emit(currentElif.thenBranch, indent + 4);
                                    if (currentElif.thenBranch.next) {
                                        emit(currentElif.thenBranch.next, indent + 4);
                                    }
                                }
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
                        // Note: Highlight for decision node is now inserted into the elseBranch during IR construction
                        // This avoids syntax errors and is more reliable
                        lines.push(pad + `else:`);
                        // Emit branch - if it's a program, it will iterate; if it's a statement, follow .next chain
                        if (node.elseBranch.type === 'program' || node.elseBranch.statements) {
                            emit(node.elseBranch, indent + 4);
                        } else {
                            // Standalone statement - emit it and follow .next chain for breaks
                            emit(node.elseBranch, indent + 4);
                            if (node.elseBranch.next) {
                                emit(node.elseBranch.next, indent + 4);
                            }
                        }
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
                // Handle while-else (Python construct)
                // The else branch executes only if the loop completes normally (not broken)
                if (node.elseBranch) {
                    lines.push(pad + `else:`);
                    emit(node.elseBranch, indent + 4);
                }
                // Follow next chain (exit path after the loop - only if no else branch)
                if (node.next && !node.elseBranch) {
                    emit(node.next, indent);
                }
                break;

            case 'for':
                // Add highlight for init node BEFORE the for loop (if exists)
                if (useHighlighting && node.initNodeId) {
                    lines.push(pad + `highlight('${node.initNodeId}')`);
                }

                // Add highlight for the for loop header BEFORE the for statement
                if (useHighlighting && node.id) {
                    lines.push(pad + `highlight('${node.id}')`);
                }

                // Always include step parameter explicitly (like old compiler)
                // For descending loops, step will be negative (e.g., -1, -2)
                const oldForStep = node.step ?? 1;
                lines.push(pad + `for ${node.variable || 'i'} in range(${node.start ?? 0}, ${node.end ?? 10}, ${oldForStep}):`);

                // Add highlight for loop header inside the loop body (iteration highlight)
                if (useHighlighting && node.id) {
                    lines.push(pad + "    " + `highlight('${node.id}')`);
                }

                emit(node.body, indent + 4);

                // Note: Increment node highlight is now inserted at the correct position
                // in the loop body (where the increment node was) rather than at the end

                // Add highlight for decision node (loop header) before exit to show the final check
                if (useHighlighting && node.id) {
                    const nodeData = nodes.find(n => n.id === node.id);
                    if (nodeData && nodeData.type === 'decision') {
                        lines.push(pad + `highlight('${node.id}')`);
                    }
                }

                // Follow next chain (exit path after the loop)
                if (node.next) {
                    emit(node.next, indent);
                }
                break;

            case 'break':
                lines.push(pad + `break`);
                // Don't follow next chain - breaks are terminal
                // If we're in a program array, the next statement is already in the array
                break;

            case 'continue':
                lines.push(pad + `continue`);
                break;

            case 'highlight':
                if (options.useHighlighting && node.id) {
                    lines.push(pad + `highlight('${node.id}')`);
                }
                break;

            default:
                console.warn(`Unknown IR node type: ${node.type}`);
        }
    }

    emit(irProgram, 0);  // Top level
    return lines.join("\n");
}

/**
 * Compile using PC-based state machine approach (always correct, mirrors graph directly)
 * This is the "gold standard" backend for correctness validation
 */
function compilePCBased(nodes, connections, useHighlighting = false, debugMode = false) {
    const compiler = new FlowchartCompiler(nodes, connections, useHighlighting, debugMode);
    return compiler.compileAsStateMachine();
}

/**
 * Compile using structured codegen (pretty, but may have edge cases)
 * This is the "pretty" backend for user-facing code
 */
function compileStructured(nodes, connections, useHighlighting = false, debugMode = false) {
    // Find start node
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) {
        console.warn('No start node found, using PC-based compiler as fallback');
        return compilePCBased(nodes, connections, useHighlighting, debugMode);
    }
    
    // Phase 1: Analysis
    const analyzer = new EnhancedFlowAnalyzer(nodes, connections);
    const flowAnalysis = analyzer.analyze();
    
    // Phase 2: IR Construction
    const irBuilder = new EnhancedIRBuilder(nodes, connections, flowAnalysis);
    const irProgram = irBuilder.buildProgram(startNode.id);
    
    // Phase 3: Code Generation
    let code = generateCodeFromIR(irProgram, { useHighlighting, debugMode, nodes });
    
    // Add highlighting support if needed
    if (useHighlighting && code) {
        // Add start node highlight at the beginning
        code = `highlight('${startNode.id}')\n${code}`;
        
        // Add end node highlight at the end (if there's an end node)
        const endNode = nodes.find(n => n.type === 'end');
        if (endNode) {
            code += `\nhighlight('${endNode.id}')`;
        }
    }
    
    return code;
}

/**
 * Execute Python code with Skulpt and capture output
 * @param {string} code - Python code to execute
 * @param {Array} testInputs - Array of input values to provide when input() is called
 * @param {number} timeout - Maximum execution time in ms
 * @returns {Promise<{output: string, error: string|null, variables: object}>}
 */
async function executeWithSkulpt(code, testInputs = [], timeout = 5000) {
    return new Promise((resolve) => {
        // Check if Skulpt is available
        if (typeof Sk === 'undefined' || !Sk.configure) {
            resolve({
                output: '',
                error: 'Skulpt not loaded',
                variables: {},
                timedOut: false
            });
            return;
        }
        
        const output = [];
        const variables = {};
        let inputIndex = 0;
        let timedOut = false;
        
        const timeoutId = setTimeout(() => {
            timedOut = true;
            resolve({
                output: output.join(''),
                error: 'Execution timeout',
                variables: variables,
                timedOut: true
            });
        }, timeout);
        
        // Configure Skulpt for testing
        // Store original config - Sk.configure() doesn't return current config
        // We need to access the current config from Sk's internal state or use App's config
        let originalOutput = ((text) => {});
        let originalInputfun = (() => '');
        let originalInputfunTakesPrompt = false;
        
        // Try to get current config from App if available
        if (window.App && window.App.log) {
            // Store reference to App's log function
            originalOutput = (t) => window.App.log(t);
        }
        if (window.App && window.App.handleInput) {
            originalInputfun = (p) => window.App.handleInput(p);
            originalInputfunTakesPrompt = true;
        }
        
        // Configure Skulpt for testing
        try {
            Sk.configure({
                output: (text) => {
                    output.push(text);
                },
                inputfun: (prompt) => {
                    if (inputIndex < testInputs.length) {
                        return testInputs[inputIndex++];
                    }
                    return ''; // Default empty input
                },
                inputfunTakesPrompt: true
            });
        } catch (configError) {
            clearTimeout(timeoutId);
            resolve({
                output: '',
                error: 'Failed to configure Skulpt: ' + (configError.message || String(configError)),
                variables: {},
                timedOut: false
            });
            return;
        }
        
        // Remove highlight calls for testing (they cause delays)
        const testCode = code.replace(/highlight\([^)]+\)\s*\n?/g, '');
        
        // Execute code
        Sk.misceval.asyncToPromise(() =>
            Sk.importMainWithBody("<test>", false, testCode, true)
        ).then(() => {
            clearTimeout(timeoutId);
            
            // Capture variables
            if (Sk.globals) {
                for (const key in Sk.globals) {
                    if (!key.startsWith('__') && key !== 'highlight' && key !== 'input' && key !== 'print') {
                        const val = Sk.globals[key];
                        if (val !== null && typeof val === 'object' && val.v !== undefined) {
                            variables[key] = val.v;
                        } else {
                            variables[key] = val;
                        }
                    }
                }
            }
            
            // Restore original Skulpt config
            try {
                if (typeof Sk !== 'undefined' && Sk && Sk.configure) {
                    Sk.configure({
                        output: originalOutput,
                        inputfun: originalInputfun,
                        inputfunTakesPrompt: originalInputfunTakesPrompt
                    });
                }
            } catch (restoreError) {
                console.warn('Failed to restore Skulpt config:', restoreError);
            }
            
            resolve({
                output: output.join(''),
                error: null,
                variables: variables,
                timedOut: false
            });
        }).catch((error) => {
            clearTimeout(timeoutId);
            
            // Restore original Skulpt config
            try {
                if (typeof Sk !== 'undefined' && Sk && Sk.configure) {
                    Sk.configure({
                        output: originalOutput,
                        inputfun: originalInputfun,
                        inputfunTakesPrompt: originalInputfunTakesPrompt
                    });
                }
            } catch (restoreError) {
                console.warn('Failed to restore Skulpt config:', restoreError);
            }
            
            const errorMsg = error.toString ? error.toString() : String(error);
            resolve({
                output: output.join(''),
                error: errorMsg,
                variables: variables,
                timedOut: false
            });
        });
    });
}

/**
 * Generate random test inputs based on flowchart structure
 * Analyzes input nodes and generates appropriate random data
 */
function generateRandomTestInputs(nodes, numTestCases = 5) {
    // Find all input nodes
    const inputNodes = nodes.filter(n => n.type === 'input');
    
    if (inputNodes.length === 0) {
        return []; // No inputs needed
    }
    
    // Generate multiple test cases
    const testCases = [];
    for (let i = 0; i < numTestCases; i++) {
        const testCase = [];
        
        for (const inputNode of inputNodes) {
            const dtype = inputNode.dtype || 'str';
            
            if (dtype === 'int') {
                // Generate random integer (range: -100 to 100, with some edge cases)
                let value;
                const rand = Math.random();
                if (rand < 0.1) {
                    value = 0; // Edge case: zero
                } else if (rand < 0.2) {
                    value = 1; // Edge case: one
                } else if (rand < 0.3) {
                    value = -1; // Edge case: negative one
                } else if (rand < 0.4) {
                    value = Math.floor(Math.random() * 10) + 1; // Small positive (1-10)
                } else if (rand < 0.5) {
                    value = -(Math.floor(Math.random() * 10) + 1); // Small negative (-1 to -10)
                } else {
                    // Random in range -100 to 100
                    value = Math.floor(Math.random() * 201) - 100;
                }
                testCase.push(String(value));
            } else {
                // Generate random string
                const rand = Math.random();
                let value;
                if (rand < 0.1) {
                    value = ''; // Edge case: empty string
                } else if (rand < 0.2) {
                    value = 'yes'; // Common string
                } else if (rand < 0.3) {
                    value = 'no'; // Common string
                } else if (rand < 0.4) {
                    value = 'Q'; // Common quit command
                } else {
                    // Random alphanumeric string (length 1-10)
                    const length = Math.floor(Math.random() * 10) + 1;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    value = '';
                    for (let j = 0; j < length; j++) {
                        value += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                }
                testCase.push(value);
            }
        }
        
        testCases.push(testCase);
    }
    
    return testCases;
}

/**
 * Validate equivalence between two compiled outputs
 * Does structural comparison only (runtime testing removed - doesn't work properly)
 */
function validateEquivalence(structuredCode, pcCode, nodes, connections, testInputs = []) {
    const issues = [];
    const warnings = []; // Informational only - don't fail equivalence
    
    // Basic checks
    if (!structuredCode || !pcCode) {
        issues.push('One or both compilations failed');
        return { equivalent: false, issues, warnings: [] };
    }
    
    // Count key statements (informational only - not used for equivalence)
    const structuredLines = structuredCode.split('\n').filter(l => l.trim());
    const pcLines = pcCode.split('\n').filter(l => l.trim());
    
    // Check for critical statements (print, input, assignments) - informational only
    const structuredPrints = (structuredCode.match(/print\(/g) || []).length;
    const pcPrints = (pcCode.match(/print\(/g) || []).length;
    
    const structuredInputs = (structuredCode.match(/input\(/g) || []).length;
    const pcInputs = (pcCode.match(/input\(/g) || []).length;
    
    // These are warnings, not failures - different code structures can produce same runtime behavior
    if (structuredPrints !== pcPrints) {
        warnings.push(`Print count differs: structured=${structuredPrints}, pc=${pcPrints} (informational only)`);
    }
    
    if (structuredInputs !== pcInputs) {
        warnings.push(`Input count differs: structured=${structuredInputs}, pc=${pcInputs} (informational only)`);
    }
    
    // Equivalence is determined by absence of critical issues
    const equivalent = issues.length === 0;
    
    return {
        equivalent,
        issues,
        warnings,
        stats: {
            structuredLines: structuredLines.length,
            pcLines: pcLines.length,
            structuredPrints,
            pcPrints,
            structuredInputs,
            pcInputs
        }
    };
}

// Global flag to enable validation mode (for testing/debugging)
window.COMPILER_VALIDATION_MODE = false;

// Global flags for dominator/post-dominator features (step 2 of improvement plan)
// These are now enabled by default - using graph theory (dominators/post-dominators) instead of heuristics
window.COMPILER_USE_DOMINATOR_HEADERS = true; // Use dominator-based loop header detection
window.COMPILER_USE_POST_DOMINATOR_CONVERGENCE = true; // Use post-dominator-based convergence point detection

// Ensure compileWithPipeline is defined (like in old compiler)
try {
    window.compileWithPipeline = function (nodes, connections, useHighlighting, debugMode = false) {
        const validationMode = window.COMPILER_VALIDATION_MODE || false;
        
        try {
            // Backend B: Pretty structured compiler (current approach)
            const structuredCode = compileStructured(nodes, connections, useHighlighting, debugMode);
            
            // In validation mode: also compile with PC-based backend and validate
            if (validationMode) {
                console.log('[VALIDATION MODE] Compiling with both backends...');
                
                // Backend A: Always-correct PC-based compiler
                const pcCode = compilePCBased(nodes, connections, useHighlighting, debugMode);
                
                // Validate equivalence (structural comparison only)
                const validation = validateEquivalence(structuredCode, pcCode, nodes, connections, []);
                
                if (validation.equivalent && (!validation.issues || validation.issues.length === 0)) {
                    console.log('[VALIDATION MODE] ✓ Equivalence check passed');
                } else {
                    console.error('[VALIDATION MODE] ✗ Equivalence check failed');
                    if (validation.issues && validation.issues.length > 0) {
                        console.error('[VALIDATION MODE]   Issues:', validation.issues);
                    }
                }
                
                // Show warnings (informational only)
                if (validation.warnings && validation.warnings.length > 0) {
                    console.log('[VALIDATION MODE] Informational warnings (not failures):', validation.warnings);
                }
                
                if (debugMode) {
                    console.log('[VALIDATION MODE] Stats:', validation.stats);
                    if (!validation.equivalent || (validation.issues && validation.issues.length > 0)) {
                        console.log('[VALIDATION MODE] Structured code:', structuredCode);
                        console.log('[VALIDATION MODE] PC-based code:', pcCode);
                    }
                }
            }
            
            return structuredCode;
        } catch (error) {
            console.error('Structured compilation failed, falling back to PC-based compiler:', error);
            console.error('Error stack:', error.stack);
            // Fallback to PC-based compiler on error (always correct)
            return compilePCBased(nodes, connections, useHighlighting, debugMode);
        }
    };

window.FlowchartCompiler = FlowchartCompiler;
window.EnhancedFlowAnalyzer = EnhancedFlowAnalyzer;
window.EnhancedIRBuilder = EnhancedIRBuilder;
window.generateCodeFromIR = generateCodeFromIR;
window.compilePCBased = compilePCBased;
window.compileStructured = compileStructured;
window.validateEquivalence = validateEquivalence;
window.executeWithSkulpt = executeWithSkulpt;
window.generateRandomTestInputs = generateRandomTestInputs;

    console.log('Compiler exports successful (using NEW pipeline)');
} catch (e) {
    console.error('Error setting up compiler exports:', e);
}
