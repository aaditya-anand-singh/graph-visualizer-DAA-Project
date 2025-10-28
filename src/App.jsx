import React, { useEffect, useRef, useState, useCallback } from "react";

// Utility to convert **text** to <strong>text</strong> for HTML rendering
const formatLogLine = (line) => {
  // Regex to find content wrapped in **...** (but not empty) and replace with <strong> tags
  return line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

const getLabel = (i) => String.fromCharCode(65 + i);

const LogBox = React.memo(({ processLog, selectedAlgo }) => {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [processLog]);
  return (
    <section className="mt-6 bg-white border-2 border-slate-200 rounded-2xl w-full max-w-4xl p-6 shadow-2xl shadow-blue-100 transition duration-500">
      <h3 className="text-2xl font-extrabold text-gray-800 mb-4 border-b-4 border-blue-500/50 pb-2">
        {selectedAlgo ? `➡️ ${selectedAlgo} Execution Steps` : "Algorithm steps will appear here"}
      </h3>
      <div 
        ref={logRef} 
        className="bg-gray-50 rounded-xl p-4 h-60 overflow-y-auto text-sm text-gray-700 font-mono text-left shadow-inner shadow-slate-100 custom-scrollbar transition-all duration-300"
        style={{ scrollBehavior: 'smooth' }}
        role="log" 
        aria-live="polite" 
      >
        {processLog.map((line, idx) => (
          // Use dangerouslySetInnerHTML to allow bolding from algorithm logic
          <p 
            key={idx} 
            className="py-1 text-xs sm:text-sm leading-relaxed border-b border-gray-100 last:border-b-0" 
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
        {processLog.length === 0 && (
            <p className="text-gray-400 italic text-center pt-8">
                Start by rendering the graph, then select an algorithm to see the step-by-step logic here.
            </p>
        )}
      </div>
      {/* Custom Scrollbar and Toggle CSS */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #93c5fd; /* blue-300 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; /* slate-100 */
        }
        /* Custom Toggle Switch */
        .toggle-switch-container input[type="checkbox"] {
            appearance: none;
            position: relative;
            width: 48px;
            height: 24px;
            border-radius: 12px;
            background-color: #cbd5e1; /* slate-300 */
            cursor: pointer;
            transition: all 0.3s;
        }
        .toggle-switch-container input[type="checkbox"]:checked {
            background-color: #6366f1; /* indigo-500 */
        }
        .toggle-switch-container input[type="checkbox"]::before {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: white;
            transition: all 0.3s;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .toggle-switch-container input[type="checkbox"]:checked::before {
            transform: translateX(24px);
        }
        .toggle-switch-container input[type="checkbox"]:disabled {
             opacity: 0.5;
             cursor: not-allowed;
        }
        /* Custom Bolding for LogBox */
        .bg-gray-50 strong {
            color: #0c4a6e; /* Darker blue/cyan for contrast */
            font-weight: 800; /* Extra bold */
            padding: 0 2px;
            border-radius: 2px;
            background-color: #bfdbfe; /* Light blue background for emphasis */
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </section>
  );
});

// Utility to build the Adjacency List
const buildAdjacencyList = (currentEdges, count) => {
    const list = {};
    const vertices = Array.from({ length: count }, (_, i) => getLabel(i));
    vertices.forEach(v => list[v] = []);

    currentEdges.forEach(({ from, to, weight, directed }) => {
        // Directed edge: from -> to
        list[from]?.push({ node: to, weight, directed });
        
        // Undirected edge: to -> from
        if (!directed) {
            list[to]?.push({ node: from, weight, directed });
        }
    });

    return list;
}


export default function App() {
  const [vertexCount, setVertexCount] = useState(5);
  const [startNode, setStartNode] = useState("A"); 
  const [targetNode, setTargetNode] = useState(getLabel(4)); 
  const [edgesInput, setEdgesInput] = useState("A->B=4, B->C=2, C->D=3, D->A=5, A->E=10");
  const [edges, setEdges] = useState([]);
  const [selectedAlgo, setSelectedAlgo] = useState("");
  const [processLog, setProcessLog] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [finalPathEdges, setFinalPathEdges] = useState([]); 
  const [builtPathEdges, setBuiltPathEdges] = useState([]); 
  const [totalDistance, setTotalDistance] = useState(null); 
  const [animationSpeed, setAnimationSpeed] = useState(400); 
  const [adjacencyList, setAdjacencyList] = useState({}); 
  const [pathSummary, setPathSummary] = useState(null); 
  const [graphType, setGraphType] = useState('directed'); 
  const [isManualStepMode, setIsManualStepMode] = useState(false); // Only visual for now
  const [stepLog, setStepLog] = useState([]); 
  const [stepIndex, setStepIndex] = useState(0); 
  
  const canvasRef = useRef();
  
  // Custom delay function using animation speed state
  const delay = useCallback((ms) => new Promise((r) => setTimeout(r, ms === undefined ? animationSpeed : ms)), [animationSpeed]);

  // --- Utility Functions ---

  // Robust single-edge parser (Updated to respect graphType for neutral symbols)
  const parseEdgeToken = useCallback((token) => {
    if (!token) return null;
    const parts = token.split("=").map((s) => s.trim());
    const left = parts[0];
    const weightStr = parts[1];
    const weight = weightStr ? parseInt(weightStr, 10) : 1;
    
    // find arrow or dash (->, >, →, or -)
    const arrowMatch = left.match(/(.*?)(->|→|>|-)(.*)/);
    if (!arrowMatch) return null;
    const rawFrom = arrowMatch[1].trim();
    const rawOp = arrowMatch[2];
    const rawTo = arrowMatch[3].trim();
    
    if (!rawFrom || !rawTo) return null;
    
    const from = rawFrom.toUpperCase();
    const to = rawTo.toUpperCase();
    
    // Check for explicit directed symbol (->, >, →)
    const directedOverride = rawOp === "->" || rawOp === ">" || rawOp === "→"; 
    
    // The edge is directed if:
    // 1. An explicit directed symbol was used, OR
    // 2. The graphType is 'directed' and a neutral symbol (-) was used
    const directed = directedOverride || (graphType === 'directed' && rawOp === "-");
    
    return {
      from,
      to,
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      directed,
    };
  }, [graphType]); 

  // Parse all edges from input and begin visual creation
  const parseEdges = async () => {
    if (isAnimating) {
        setProcessLog((p) => [...p, formatLogLine("🛑 Animation in progress — wait until it finishes.")]);
        return;
    }

    const rawTokens = edgesInput.split(/[,\n]+/).map((t) => t.trim()).filter(Boolean);
    
    const parsed = rawTokens.map(t => parseEdgeToken(t)).filter(Boolean); 

    // Validation checks... 
    const startChar = startNode.charCodeAt(0);
    if (startChar < 65 || startChar - 65 >= vertexCount) {
        setProcessLog((p) => [...p, formatLogLine(`❌ Starting node ${startNode} is invalid for ${vertexCount} vertices.`)]);
        return;
    }
    const targetChar = targetNode.charCodeAt(0);
    if (targetChar < 65 || targetChar - 65 >= vertexCount) {
        setProcessLog((p) => [...p, formatLogLine(`❌ Target node ${targetNode} is invalid for ${vertexCount} vertices.`)]);
        return;
    }

    setEdges([]);
    setSelectedAlgo("");
    setProcessLog([formatLogLine("Parsing edges...")]);
    setFinalPathEdges([]); 
    setBuiltPathEdges([]); 
    setTotalDistance(null); 
    setPathSummary(null); 
    setStepLog([]); 
    setStepIndex(0); 
    
    await animateInputParsing(parsed);
    
    setEdges(parsed);
    setProcessLog((p) => [...p, formatLogLine(`✅ Parsed ${parsed.length} edges successfully. Ready to run algorithms.`)]);
  };

  // Animate edge creation one by one
  const animateInputParsing = async (parsedEdges) => {
    setIsAnimating(true);
    for (let i = 0; i < parsedEdges.length; i++) {
      const e = parsedEdges[i];
      setEdges((prev) => [...prev, e]);
      setProcessLog((prev) => [...prev, formatLogLine(`➕ Added edge ${e.from}${e.directed ? "→" : "–"}${e.to} (w=${e.weight})`)]);
      drawGraph([], [], parsedEdges.slice(0, i + 1), [], [], []); 
      // eslint-disable-next-line no-await-in-loop
      await delay(200); 
    }
    setIsAnimating(false);
  };
  
  // --- Canvas Drawing Logic (memoized with useCallback) ---
  const drawGraph = useCallback((highlighted = [], visited = [], tempEdges = edges, pathEdges = finalPathEdges, highlightedEdges = [], builtEdges = builtPathEdges) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) return;
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2.5; 

    // Calculate vertex positions in a circle
    const n = Math.max(1, Math.floor(Number(vertexCount) || 1));
    const vertices = Array.from({ length: n }, (_, i) => ({
      label: getLabel(i),
      x: cx + radius * Math.cos((2 * Math.PI * i) / n - (Math.PI / 2)),
      y: cy + radius * Math.sin((2 * Math.PI * i) / n - (Math.PI / 2)),
    }));

    // Draw Edges
    tempEdges.forEach(({ from, to, weight, directed }) => {
      const a = vertices.find((v) => v.label === from);
      const b = vertices.find((v) => v.label === to);
      if (!a || !b) return;

      const isPathEdge = pathEdges.some(
        (pe) => (pe.from === from && pe.to === to) || 
              (!directed && pe.from === to && pe.to === from) 
      );
      const isCurrentlyTraversed = highlightedEdges.some(
        (ce) => (ce.from === from && ce.to === to) || 
              (!directed && ce.from === to && ce.to === from)
      );
      const isBuiltPathEdge = builtEdges.some(
        (be) => (be.from === from && be.to === to) || 
              (!directed && be.from === to && be.to === from) 
      );

      // Edge Coloring Logic
      const edgeColor = isPathEdge
        ? "#ea580c" // Orange 700
        : (isCurrentlyTraversed
          ? "#10b981" // Emerald 500 (Bright Green)
          : (isBuiltPathEdge
            ? "#4f46e5" // Indigo 600
            : "#94a3b8")); // Slate Gray

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = isPathEdge ? 5 : (isCurrentlyTraversed || isBuiltPathEdge ? 3 : 2); 
      
      // Edge glow effect for path/highlighted edges
      if (isPathEdge || isCurrentlyTraversed || isBuiltPathEdge) {
          ctx.shadowColor = edgeColor;
          ctx.shadowBlur = isPathEdge ? 10 : 6; 
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Reset shadow after drawing the edge
      ctx.shadowBlur = 0; 

      // Arrow head for directed graph
      if (directed) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nodeRadius = 18;
        const arrowLength = 10;
        const arrowAngle = 0.35;
        
        // Calculate point just before the target node boundary
        const targetX = b.x - dx * (nodeRadius / dist);
        const targetY = b.y - dy * (nodeRadius / dist);

        ctx.beginPath();
        // Move to the point near the node
        ctx.moveTo(targetX, targetY);
        // Line back for one side of the arrow
        ctx.lineTo(targetX - arrowLength * Math.cos(angle - arrowAngle), targetY - arrowLength * Math.sin(angle - arrowAngle));
        // Line back for the other side of the arrow
        ctx.lineTo(targetX - arrowLength * Math.cos(angle + arrowAngle), targetY - arrowLength * Math.sin(angle + arrowAngle));
        ctx.closePath();
        ctx.fillStyle = edgeColor;
        ctx.fill();
      }

      // Weight label
      ctx.fillStyle = "#1e293b"; // Dark slate
      ctx.font = isPathEdge || isCurrentlyTraversed || isBuiltPathEdge ? "bold 15px Inter, sans-serif" : "bold 13px Inter, sans-serif";
      const offsetX = (b.y - a.y) / 20;
      const offsetY = (a.x - b.x) / 20;
      ctx.strokeStyle = "#fff"; 
      ctx.lineWidth = 4;
      ctx.strokeText(String(weight), (a.x + b.x) / 2 + offsetX, (a.y + b.y) / 2 + offsetY);
      ctx.fillText(String(weight), (a.x + b.x) / 2 + offsetX, (a.y + b.y) / 2 + offsetY);
    });

    // Draw Nodes
    vertices.forEach((v) => {
      ctx.beginPath();
      ctx.arc(v.x, v.y, 20, 0, Math.PI * 2); // Increased node size slightly
      
      let fillColor;
      let shadowColor;
      
      if (v.label === startNode && !visited.includes(v.label)) {
        fillColor = "#e11d48"; // Rose Red 600
        shadowColor = "#e11d48";
      } else if (v.label === targetNode && !visited.includes(v.label)) {
        fillColor = "#f97316"; // Orange 600
        shadowColor = "#f97316";
      } else if (visited.includes(v.label)) {
        fillColor = "#059669"; // Emerald 600 (Visited/Final)
        shadowColor = "#059669";
      } else if (highlighted.includes(v.label)) {
        fillColor = "#f59e0b"; // Amber 500 (Currently Selected)
        shadowColor = "#f59e0b";
      } else {
        fillColor = "#0ea5e9"; // Sky Blue 500 (Default)
        shadowColor = "#0ea5e9";
      }

      ctx.fillStyle = fillColor;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 18; // Increased shadow blur for glow
      ctx.fill();
      ctx.shadowBlur = 0; // Turn off shadow for text

      // Draw Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.label, v.x, v.y);
    });

    return vertices;
  }, [edges, finalPathEdges, builtPathEdges, vertexCount, startNode, targetNode]);


  // --- Reset Function ---
  const resetState = () => {
    if (isAnimating) {
        setProcessLog((p) => [...p, formatLogLine("🛑 Animation in progress — cannot reset now.")]);
        return;
    }
    setVertexCount(5);
    setStartNode("A");
    setTargetNode(getLabel(4));
    setEdgesInput("A->B=4, B->C=2, C->D=3, D->A=5, A->E=10");
    setEdges([]);
    setSelectedAlgo("");
    setProcessLog([formatLogLine("Application state reset. Define a new graph to begin.")]);
    setIsAnimating(false);
    setFinalPathEdges([]);
    setBuiltPathEdges([]);
    setTotalDistance(null);
    setAdjacencyList({});
    setPathSummary(null);
    setStepLog([]);
    setStepIndex(0);
    // Force a canvas clear on reset
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };


  // --- Algorithm Implementations ---
  
  // Dijkstra Algorithm (weighted shortest path)
  const runDijkstra = async () => {
    if (edges.length === 0) {
      setProcessLog((p) => [...p, formatLogLine("🛑 No edges defined. Please render the graph first.")]);
      return;
    }
    
    setFinalPathEdges([]); 
    setBuiltPathEdges([]); 
    setTotalDistance(null);
    setPathSummary(null);
    setStepLog([]);
    setStepIndex(0);

    setIsAnimating(true);
    setProcessLog([formatLogLine(`Running Dijkstra's Algorithm from starting node **${startNode}** to target node **${targetNode}**...`)]);

    const n = Math.max(1, Math.floor(Number(vertexCount) || 1));
    const vertices = Array.from({ length: n }, (_, i) => getLabel(i));
    const dist = {};
    const pred = {}; 
    const visited = [];
    let currentBuiltPathEdges = []; 

    vertices.forEach((v) => {
        dist[v] = Infinity;
        pred[v] = null;
    });
    
    const start = startNode; 
    const end = targetNode; 
    dist[start] = 0;

    // Initial draw
    drawGraph([start], visited, edges, [], [], currentBuiltPathEdges);
    await delay(); 

    while (visited.length < vertices.length) {
      // 1. Find unvisited vertex with smallest distance
      const unvisited = vertices.filter((v) => !visited.includes(v));
      if (unvisited.length === 0) break;
      
      let current = unvisited[0];
      unvisited.forEach((u) => {
        if (dist[u] < dist[current]) current = u;
      });

      if (dist[current] === Infinity) {
        setProcessLog((p) => [...p, formatLogLine(`No more reachable nodes from **${start}**. Algorithm terminates.`)]);
        break;
      }

      // 2. Mark current as visited and highlight
      visited.push(current);
      // Redraw showing the current node as selected (amber/yellow)
      drawGraph([current], visited.filter(v => v !== current), edges, finalPathEdges, [], currentBuiltPathEdges); 
      setProcessLog((prev) => [...prev, formatLogLine(`➡️ **SELECT**: Visiting **${current}**. This is the unvisited node with the smallest known distance (**${dist[current]}**).`)]);
      // eslint-disable-next-line no-await-in-loop
      await delay(animationSpeed * 1.5); // Slightly longer pause for the main step
      
      let pathEdgesChanged = false;

      // 3. Relax outgoing edges from current
      for (const e of edges) {
        const { from, to, weight, directed } = e;
        
        const attemptRelaxation = async (u, v, isDirectedEdge) => {
            const nextNode = v;
            const edgeHighlight = [{ from: u, to: v }];
            
            if (!visited.includes(nextNode)) {
                
                const newDist = dist[current] + weight;
                const isShorter = newDist < dist[nextNode];

                let logMessage = formatLogLine(`   ❌ Checking ${u}${e.directed ? "→" : "–"}${v} (w=${weight}). Path distance: ${dist[current]} + ${weight} is **not shorter** than current dist of ${v} (${dist[nextNode] === Infinity ? "∞" : dist[nextNode]}).`);

                if (isShorter) {
                  
                    // --- PATH UPDATE LOGIC (Remove old predecessor edge) ---
                    if (pred[nextNode]) {
                        const oldPred = pred[nextNode];
                        currentBuiltPathEdges = currentBuiltPathEdges.filter(be => 
                            !((be.from === oldPred && be.to === nextNode) || (!isDirectedEdge && be.from === nextNode && be.to === oldPred))
                        );
                    }

                    dist[nextNode] = newDist;
                    pred[nextNode] = current; 
                    pathEdgesChanged = true;

                    // --- PATH UPDATE LOGIC (Add new shortest path segment) ---
                    const newEdge = { from: current, to: nextNode, directed: isDirectedEdge };
                    if (isDirectedEdge || !currentBuiltPathEdges.some(be => (be.from === newEdge.from && be.to === newEdge.to) || (be.from === newEdge.to && be.to === newEdge.from))) {
                        currentBuiltPathEdges.push(newEdge);
                    }
                    
                    logMessage = formatLogLine(`   ✅ **RELAXED**: ${u}${e.directed ? "→" : "–"}${v} (w=${weight}). Path is shorter. Updated dist of **${v}** to **${dist[v]}**.`);
                } 

                // Draw with step highlight (bright green edge) and the updated currentBuiltPathEdges
                drawGraph([current, nextNode], visited.filter(v => v !== current), edges, finalPathEdges, edgeHighlight, currentBuiltPathEdges); 
                setProcessLog((p) => [...p, logMessage]);
                // eslint-disable-next-line no-await-in-loop
                return delay(animationSpeed * 0.75); // Shorter pause for sub-steps
            }
        }

        // Outgoing edge (from -> to)
        if (from === current) {
          // eslint-disable-next-line no-await-in-loop
          await attemptRelaxation(from, to, directed);
        }
        
        // Undirected edge (to <- from), if not already handled
        if (!directed && to === current) {
          // eslint-disable-next-line no-await-in-loop
          await attemptRelaxation(to, from, directed);
        }
      } // end edge loop
      
      // Final draw for the step: current node becomes permanently visited (green)
      if (pathEdgesChanged) {
          setBuiltPathEdges(currentBuiltPathEdges); 
      }
      drawGraph([], visited, edges, finalPathEdges, [], currentBuiltPathEdges); 
      // eslint-disable-next-line no-await-in-loop
      await delay(animationSpeed * 0.5); // Shortest pause to finalize step state

      // If we reached the target node, we can break early
      if (current === end) {
        setProcessLog((p) => [...p, formatLogLine(`🎉 Reached target node **${end}**. Path found.`)]);
        break;
      }

    } // end while loop

    // POST ALGORITHM PATH RECONSTRUCTION & HIGHLIGHTING
    let calculatedPathEdges = [];
    if (dist[end] === Infinity) {
        setProcessLog((p) => [...p, formatLogLine(`❌ Cannot reach node **${end}** from **${start}**.`)]);
    } else {
        let currentPathNode = end;
        let pathNodes = []; 
        while (currentPathNode && currentPathNode !== start) {
            const predecessor = pred[currentPathNode];
            if (predecessor) {
                // Find the actual edge in the graph to get its direction property
                const edgeInGraph = edges.find(e => 
                    (e.from === predecessor && e.to === currentPathNode) || 
                    (!e.directed && e.from === currentPathNode && e.to === predecessor)
                );
                calculatedPathEdges.unshift({ 
                    from: predecessor, 
                    to: currentPathNode, 
                    directed: edgeInGraph?.directed || false 
                });
                pathNodes.unshift(currentPathNode);
            }
            currentPathNode = predecessor;
        }

        const pathString = [start, ...pathNodes].join(" → ");
        setProcessLog((prev) => [...prev, formatLogLine(`Shortest Path: **${pathString}**`)]);
        setProcessLog((prev) => [...prev, formatLogLine(`🎉 Shortest Distance from **${start}** to **${end}** is **${dist[end]}**. Path highlighted.`)]);
        
        setTotalDistance(dist[end]); 
        setFinalPathEdges(calculatedPathEdges);

        // POST ALGORITHM SUMMARY GENERATION (NEW)
        const summary = {};
        vertices.forEach(v => {
            summary[v] = {
                distance: dist[v] === Infinity ? "∞" : dist[v],
                predecessor: pred[v] || "None",
                isTarget: v === end,
                isStart: v === start
            };
        });
        setPathSummary(summary);
        
        // Final visual state: All visited nodes green, final path edges orange
        drawGraph([], visited, edges, calculatedPathEdges, [], currentBuiltPathEdges);
    }

    setIsAnimating(false);
  };

  // Greedy Simulation (simple traversal starting from the selected node) - Kept mostly as is
  const runGreedy = async () => {
    if (edges.length === 0) {
      setProcessLog((p) => [...p, formatLogLine("🛑 No edges defined. Please render the graph first.")]);
      return;
    }
    
    setFinalPathEdges([]); 
    setBuiltPathEdges([]); 
    setTotalDistance(null);
    setPathSummary(null);
    setStepLog([]);
    setStepIndex(0);
    setIsAnimating(true);
    setProcessLog([formatLogLine(`Running Greedy Traversal Simulation from **${startNode}**...`)]);
    
    const start = startNode;
    const visited = [start];
    const queue = [start]; 
    let currentBuiltPathEdges = [];
    
    drawGraph([start], visited, edges, [], [], currentBuiltPathEdges);
    setProcessLog((p) => [...p, formatLogLine(`➡️ Starting at vertex **${start}**.`)]);
    await delay(); 

    while (queue.length > 0) {
        const current = queue.shift();
        
        // Find all unvisited neighbors
        const neighbors = edges
            .filter(e => e.from === current || (!e.directed && e.to === current))
            .map(e => ({
                node: e.from === current ? e.to : e.from,
                weight: e.weight,
                from: current,
                directed: e.directed
            }))
            .filter(n => !visited.includes(n.node));

        // Sort neighbors by weight (Greedy)
        neighbors.sort((a, b) => a.weight - b.weight); 

        // Current node moves from selected (yellow) to visited (green) for this step's start
        drawGraph([], visited, edges, finalPathEdges, [], currentBuiltPathEdges); 
        await delay(100);

        if (neighbors.length === 0) {
             setProcessLog((p) => [...p, formatLogLine(`   🛑 **${current}** has no unvisited neighbors. Backtracking/Terminating path.`)]);
        }


        for (const { node: next, weight, from, directed } of neighbors) {
            if (!visited.includes(next)) {
                visited.push(next);
                queue.push(next);

                // --- PATH UPDATE LOGIC (Add the selected edge) ---
                const newBuiltEdge = { from: from, to: next, directed: directed };
                currentBuiltPathEdges.push(newBuiltEdge);
                setBuiltPathEdges(currentBuiltPathEdges); 

                const currentEdgeHighlight = [{ from: from, to: next }];
                drawGraph([current, next], visited.filter(v => v !== next), edges, finalPathEdges, currentEdgeHighlight, currentBuiltPathEdges);
                
                setProcessLog((p) => [...p, formatLogLine(`   Exploring from **${current}**: Greedily selected neighbor **${next}** (weight: **${weight}**).`)]);
                // eslint-disable-next-line no-await-in-loop
                await delay(animationSpeed * 0.75); 
                
                // Redraw with next node marked as visited (green) and edge as built (indigo)
                drawGraph([current], visited, edges, finalPathEdges, [], currentBuiltPathEdges); 
                // eslint-disable-next-line no-await-in-loop
                await delay(animationSpeed * 0.25);
            }
        }
        
        drawGraph([], visited, edges, finalPathEdges, [], currentBuiltPathEdges);
    }
    
    setProcessLog((p) => [...p, formatLogLine("✨ Greedy Traversal Simulation Completed! All reachable nodes visited.")]);
    setIsAnimating(false);
  };

  const handleAlgo = (algo) => {
    if (isAnimating) {
      setProcessLog((p) => [...p, formatLogLine("🛑 Animation in progress — wait until it finishes.")]);
      return;
    }
    setSelectedAlgo(algo);
    setFinalPathEdges([]); 
    setBuiltPathEdges([]);
    setTotalDistance(null); 
    setPathSummary(null);
    setStepLog([]);
    setStepIndex(0);

    drawGraph(); 
    if (algo === "Dijkstra") runDijkstra();
    if (algo === "Greedy") runGreedy();
  };

  // Initial draw and redraw when core graph data changes
  useEffect(() => {
    // Redraw using the current persistent states
    drawGraph([], [], edges, finalPathEdges, [], builtPathEdges);
    setAdjacencyList(buildAdjacencyList(edges, vertexCount)); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, vertexCount, finalPathEdges, builtPathEdges, drawGraph]); 
  
  // Responsive Canvas Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    const resizeCanvas = () => {
      // Scale based on the width of the container, keeping an aspect ratio around 7:5
      const size = Math.min(container.clientWidth, 700);
      canvas.width = size;
      canvas.height = size * (5/7); 
      drawGraph(); 
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawGraph]); 

  // --- JSX RENDER ---
  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center font-sans bg-gradient-to-br from-slate-50 to-blue-100/50">
      <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-2 mt-4 tracking-tight text-center">
        Interactive Graph Algorithm Visualizer 🧠
      </h1>
      <p className="text-lg text-gray-600 mb-10 max-w-xl text-center leading-relaxed">
        Define your <b>weighted graph </b>and observe the step-by-step process of <b>shortest path</b> algorithms.
      </p>

      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-10">
        
        {/* Left Column: Controls & Methods */}
        <section className="flex flex-col gap-10 lg:w-1/3">
            
            {/* Controls Section */}
            <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-6 shadow-2xl shadow-blue-200/50 border-t-8 border-blue-600 transition-all duration-500 hover:shadow-3xl">
                <h2 className="text-2xl font-extrabold text-blue-800 self-start border-b-2 border-blue-100 pb-2 w-full">1. Graph Definition</h2>
                
                {/* Vertex Count & Graph Type */}
                <div className="w-full flex justify-between items-end gap-4">
                    <div className="w-2/3">
                        <label htmlFor="vertex-count" className="font-semibold text-gray-700 block mb-1 text-sm">
                            Number of Vertices (Nodes):
                        </label>
                        <input
                            id="vertex-count" 
                            type="number"
                            min="1"
                            max="26"
                            value={vertexCount}
                            className="w-full border-2 border-slate-300 rounded-lg p-3 text-base bg-slate-50 transition-all duration-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-blue-400 disabled:opacity-70"
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                const newV = Number.isFinite(v) && v > 0 && v <= 26 ? v : 1;
                                setVertexCount(newV);
                                const targetChar = targetNode.charCodeAt(0);
                                if (targetChar - 65 >= newV) {
                                    setTargetNode(getLabel(newV - 1));
                                }
                            }}
                            disabled={isAnimating}
                        />
                        <p className="text-xs text-gray-500 mt-1">Nodes: A to {getLabel(vertexCount - 1)}.</p>
                    </div>
                    
                    {/* Graph Type Toggle (NEW) */}
                    <div className="w-1/3 text-right">
                        <span className="font-semibold text-gray-700 text-sm block mb-1">Type:</span>
                        <button 
                            onClick={() => setGraphType(graphType === 'directed' ? 'undirected' : 'directed')}
                            className={`px-3 py-1.5 rounded-full font-bold text-xs shadow-lg transition-all duration-300 transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed w-full ${
                                graphType === 'directed' 
                                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-300' 
                                : 'bg-green-600 text-white hover:bg-green-700 shadow-green-300'
                            }`}
                            disabled={isAnimating}
                        >
                            {graphType === 'directed' ? 'DIRECTED' : 'UNDIRECTED'}
                        </button>
                    </div>
                </div>

                {/* Edges Input */}
                <div className="w-full">
                    <label htmlFor="edges-input" className="font-semibold text-gray-700 block mb-1 text-sm">
                        Edges with Weight (e.g. A-B=4, C&rarr;D=2):
                    </label>
                    <textarea
                        id="edges-input" 
                        value={edgesInput}
                        rows="4"
                        placeholder="A->B=4, B-C=2, C->D=3"
                        className="w-full border-2 border-slate-300 rounded-lg p-3 text-base bg-slate-50 resize-y font-mono transition-all duration-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none hover:border-blue-400 disabled:opacity-70"
                        onChange={(e) => setEdgesInput(e.target.value)}
                        disabled={isAnimating}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use '→' or '-&gt;' for directed, '-' for {graphType} edges.</p>
                </div>

                {/* START and TARGET Node Inputs */}
                <div className="w-full flex gap-4">
                    <div className="w-1/2">
                        <label htmlFor="start-node" className="font-semibold text-gray-700 block mb-1 text-sm">
                            Starting Node:
                        </label>
                        <input
                            id="start-node" 
                            type="text"
                            maxLength="1"
                            value={startNode}
                            className="w-full border-2 border-slate-300 rounded-lg p-3 text-base bg-slate-50 uppercase font-extrabold text-center transition-all duration-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100 focus:outline-none hover:border-rose-400 disabled:opacity-70"
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                if (val.match(/[A-Z]/) && val.charCodeAt(0) - 65 < vertexCount) {
                                    setStartNode(val);
                                } else if (val === "") {
                                    setStartNode("A"); 
                                }
                            }}
                            disabled={isAnimating}
                        />
                        <p className="text-xs text-center font-semibold text-rose-500 mt-1">Start (Rose Red)</p>
                    </div>

                    <div className="w-1/2">
                        <label htmlFor="target-node" className="font-semibold text-gray-700 block mb-1 text-sm">
                            Target Node:
                        </label>
                        <input
                            id="target-node" 
                            type="text"
                            maxLength="1"
                            value={targetNode}
                            className="w-full border-2 border-slate-300 rounded-lg p-3 text-base bg-slate-50 uppercase font-extrabold text-center transition-all duration-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 focus:outline-none hover:border-orange-400 disabled:opacity-70"
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                if (val.match(/[A-Z]/) && val.charCodeAt(0) - 65 < vertexCount) {
                                    setTargetNode(val);
                                } else if (val === "") {
                                    setTargetNode(getLabel(vertexCount - 1));
                                }
                            }}
                            disabled={isAnimating}
                        />
                        <p className="text-xs text-center font-semibold text-orange-600 mt-1">Target (Orange)</p>
                    </div>
                </div>

                <div className="w-full flex gap-3 mt-2">
                    <button 
                        onClick={parseEdges}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-sky-700 text-white font-extrabold py-3.5 px-6 rounded-xl text-lg shadow-xl shadow-blue-300/80 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isAnimating}
                    >
                        {edges.length === 0 ? "2. Render Graph" : "2. Re-render Graph"}
                    </button>
                    <button
                        onClick={resetState}
                        className="w-1/3 bg-slate-400 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg transition-all duration-300 hover:bg-slate-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isAnimating}
                    >
                        Reset All 🔄
                    </button>
                </div>

                {/* Adjacency List (NEW) */}
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-inner w-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1 text-blue-700">
                        Adjacency List (Input Data Structure)
                    </h3>
                    <div className="text-sm text-gray-700 font-mono max-h-40 overflow-y-auto custom-scrollbar">
                        {Object.entries(adjacencyList).map(([node, neighbors]) => (
                            <p key={node} className="py-0.5">
                                <span className="font-bold text-rose-500">{node}</span>: {
                                    neighbors.length > 0
                                        ? neighbors.map(n => 
                                            `${n.node}(w=${n.weight}${n.directed ? '→' : '–'})`
                                        ).join(", ")
                                        : "No outgoing edges"
                                }
                            </p>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Method Buttons Section */}
            <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-200/50 border-t-8 border-emerald-600 transition-all duration-500 hover:shadow-3xl">
                <h2 className="text-2xl font-extrabold text-emerald-800 mb-6 border-b-2 border-emerald-100 pb-2 w-full">3. Run Simulation</h2>
                
                {/* Animation Speed Slider (NEW) */}
                <div className="w-full mb-6">
                    <label htmlFor="speed-slider" className="font-semibold text-gray-700 block mb-2 text-sm">
                        Animation Speed: **{animationSpeed} ms** delay per step
                    </label>
                    <input
                        id="speed-slider"
                        type="range"
                        min="100"
                        max="1000"
                        step="100"
                        value={animationSpeed}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-70 transition-all duration-300"
                        onChange={(e) => setAnimationSpeed(parseInt(e.target.value, 10))}
                        disabled={isAnimating}
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                        onClick={() => handleAlgo("Greedy")}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-700 text-white font-extrabold py-3.5 px-5 rounded-xl text-lg shadow-lg shadow-green-300/80 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isAnimating || edges.length === 0}
                    >
                        Greedy Traversal
                    </button>
                    <button 
                        onClick={() => handleAlgo("Dijkstra")}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-extrabold py-3.5 px-5 rounded-xl text-lg shadow-lg shadow-indigo-300/80 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isAnimating || edges.length === 0}
                    >
                        Dijkstra's Algorithm
                    </button>
                </div>
                
                {/* Step-by-Step Toggle (Custom CSS Applied) */}
                <div className="mt-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center text-sm font-semibold text-indigo-700 shadow-inner toggle-switch-container">
                    <label className="flex items-center justify-between space-x-3 cursor-pointer">
                        <span className="text-base">Enable Manual Step-by-Step Mode (Disabled in current logic)</span>
                        <input
                            type="checkbox"
                            checked={isManualStepMode}
                            onChange={() => setIsManualStepMode(!isManualStepMode)}
                            className="toggle-checkbox"
                            disabled={isAnimating || true} 
                        />
                    </label>
                </div>


                {/* New: Total Distance Display */}
                <div className="mt-8 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-center shadow-inner">
                    <p className="text-sm text-gray-600 mb-2 font-medium">
                        Shortest distance from <span className="font-bold text-rose-600">{startNode}</span> to <span className="font-bold text-orange-600">{targetNode}</span>:
                    </p>
                    <div className="h-6">
                        {selectedAlgo === "Dijkstra" && totalDistance !== null && (
                            <p className="text-2xl font-black text-orange-600 animate-pulse">
                                **{totalDistance}**
                            </p>
                        )}
                        {selectedAlgo === "Dijkstra" && totalDistance === null && !isAnimating && edges.length > 0 && (
                            <p className="text-xl font-bold text-gray-400">
                                Path Not Found
                            </p>
                        )}
                    </div>
                </div>

                {/* Path Summary Table (NEW) */}
                {pathSummary && selectedAlgo === "Dijkstra" && (
                    <div className="mt-6 p-4 bg-white border-2 border-indigo-100 rounded-xl shadow-lg w-full">
                        <h3 className="text-xl font-bold text-indigo-700 mb-3 border-b-2 border-indigo-100 pb-2">
                            Final Path Distances (Dijkstra)
                        </h3>
                        <div className="overflow-x-auto max-h-60 custom-scrollbar">
                            <table className="min-w-full text-sm text-left text-gray-700">
                                <thead className="text-xs text-gray-900 uppercase bg-indigo-100/70 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th scope="col" className="px-3 py-2">Node</th>
                                        <th scope="col" className="px-3 py-2">Shortest Dist</th>
                                        <th scope="col" className="px-3 py-2">Previous Node</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(pathSummary).map(([node, data]) => (
                                        <tr 
                                            key={node} 
                                            className={`border-b border-gray-100 transition-all duration-200 ${data.isTarget ? 'bg-orange-50 font-extrabold text-orange-700' : (data.isStart ? 'bg-rose-50 font-bold text-rose-700' : 'bg-white hover:bg-gray-50')}`}
                                        >
                                            <td className="px-3 py-2 font-extrabold">{node}</td>
                                            <td className="px-3 py-2">{data.distance}</td>
                                            <td className="px-3 py-2">{data.predecessor}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </section>

        {/* Right Column: Canvas & Log */}
        <section className="lg:w-2/3">
            {/* Canvas Container */}
            <div className="canvas-container bg-white border-4 border-slate-300 rounded-3xl shadow-3xl shadow-slate-300/50 overflow-hidden mb-6">
                <canvas 
                    ref={canvasRef} 
                    width="700" 
                    height="500"
                    role="img"
                    aria-label="Interactive visualization of the graph algorithm" 
                    className="w-full h-auto transition-all duration-500"
                />
            </div>
            
            {/* Legend Bar (IMPROVED) */}
            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-wrap justify-around text-center text-xs sm:text-sm font-semibold text-gray-700 gap-y-2">
                <LegendItem color="#e11d48" label="Start Node" />
                <LegendItem color="#f97316" label="Target Node" />
                <LegendItem color="#f59e0b" label="Current/Selected Node" />
                <LegendItem color="#059669" label="Visited/Final Node" />
                <LegendItem color="#ea580c" type="edge" label="Final Path Edge" />
                <LegendItem color="#4f46e5" type="edge" label="Built Path Tree Edge" />
                <LegendItem color="#10b981" type="edge" label="Currently Relaxing Edge" />
            </div>

            {/* Log Section */}
            <LogBox processLog={processLog} selectedAlgo={selectedAlgo} />
        </section>
      </main>
    </div>
  );
}

// Helper component for the Legend Bar
const LegendItem = ({ color, label, type = 'node' }) => (
    <div className="flex items-center gap-2 m-1 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-sm">
        {type === 'node' ? (
            <span className="w-3.5 h-3.5 rounded-full block shadow-md" style={{ backgroundColor: color }}></span>
        ) : (
            <span className="w-4 h-0.5 rounded-sm block shadow-md" style={{ backgroundColor: color }}></span>
        )}
        <span className="text-gray-800">{label}</span>
    </div>
);