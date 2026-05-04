"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Position, Handle, Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BrainCircuit, ShieldCheck, Box } from "lucide-react";

type RequestStatus = string;
type NodeState = "pending" | "active" | "completed" | "error";

interface WorkflowData {
  request: {
    status: RequestStatus;
    aiTriageRisk?: string | null;
  };
}

function WorkflowNode({ data }: { data: { label: string; icon: React.ElementType; state: NodeState } }) {
  const Icon = data.icon;
  
  let bg = "bg-white dark:bg-zinc-900";
  let border = "border-zinc-200 dark:border-zinc-800";
  let text = "text-zinc-500 dark:text-zinc-400";
  let iconColor = "text-zinc-400";

  if (data.state === "completed") {
    border = "border-emerald-500/50";
    bg = "bg-emerald-50/50 dark:bg-emerald-950/20";
    text = "text-emerald-700 dark:text-emerald-300";
    iconColor = "text-emerald-500";
  } else if (data.state === "active") {
    border = "border-blue-500 ring-2 ring-blue-500/20";
    bg = "bg-blue-50/50 dark:bg-blue-950/20";
    text = "text-blue-700 dark:text-blue-300 font-medium";
    iconColor = "text-blue-500";
  } else if (data.state === "error") {
    border = "border-red-500/50";
    bg = "bg-red-50/50 dark:bg-red-950/20";
    text = "text-red-700 dark:text-red-300";
    iconColor = "text-red-500";
  }

  return (
    <div className={`px-4 py-3 rounded-xl border shadow-sm flex items-center gap-3 w-[200px] transition-colors ${bg} ${border}`}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className={`p-1.5 rounded-md bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800 ${iconColor}`}>
        <Icon size={16} />
      </div>
      <div className={`text-sm tracking-tight ${text}`}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  custom: WorkflowNode,
};

export function WorkflowVisualizer({ request }: WorkflowData) {
  const { status } = request;

  const getStates = () => {
    let triage: NodeState = "pending";
    let policy: NodeState = "pending";
    let fulfillment: NodeState = "pending";

    // Triage is completed when it has moved to any of the next stages
    triage = "completed"; 

    if (status === "pending_approval" || status === "needs_info") {
      policy = "active";
    } else if (status === "approved") {
      policy = "completed";
      fulfillment = "active";
    } else if (status === "denied" || status === "canceled") {
      policy = "error";
    } else if (status === "fulfilled") {
      policy = "completed";
      fulfillment = "completed";
    } else if (status === "failed") {
      policy = "completed";
      fulfillment = "error";
    }

    return { triage, policy, fulfillment };
  };

  const states = getStates();

  const nodes: Node[] = useMemo(() => [
    {
      id: "triage",
      type: "custom",
      position: { x: 0, y: 50 },
      data: { label: "AI Triage", icon: BrainCircuit, state: states.triage },
    },
    {
      id: "policy",
      type: "custom",
      position: { x: 280, y: 50 },
      data: { label: "Policy & Approval", icon: ShieldCheck, state: states.policy },
    },
    {
      id: "fulfillment",
      type: "custom",
      position: { x: 560, y: 50 },
      data: { label: "Fulfillment", icon: Box, state: states.fulfillment },
    },
  ], [states.triage, states.policy, states.fulfillment]);

  const edges: Edge[] = useMemo(() => [
    {
      id: "e-triage-policy",
      source: "triage",
      target: "policy",
      animated: states.policy === "active",
      style: { stroke: states.policy === "active" ? "#3b82f6" : "#e4e4e7" },
    },
    {
      id: "e-policy-fulfillment",
      source: "policy",
      target: "fulfillment",
      animated: states.fulfillment === "active",
      style: { stroke: states.fulfillment === "active" ? "#3b82f6" : "#e4e4e7" },
    },
  ], [states.policy, states.fulfillment]);

  return (
    <div className="h-[180px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={12} size={1} className="opacity-40" />
      </ReactFlow>
    </div>
  );
}
