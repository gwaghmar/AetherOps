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
  
  const stateStyles = {
    pending: {
      borderColor: "var(--line)",
      background: "var(--surface)",
      color: "var(--ink-3)",
      iconColor: "var(--ink-3)",
    },
    completed: {
      borderColor: "color-mix(in srgb, var(--status-approved) 40%, transparent)",
      background: "color-mix(in srgb, var(--status-approved) 6%, transparent)",
      color: "var(--status-approved)",
      iconColor: "var(--status-approved)",
    },
    active: {
      borderColor: "var(--accent)",
      background: "color-mix(in srgb, var(--accent) 6%, transparent)",
      color: "var(--accent)",
      iconColor: "var(--accent)",
    },
    error: {
      borderColor: "color-mix(in srgb, var(--status-denied) 40%, transparent)",
      background: "color-mix(in srgb, var(--status-denied) 6%, transparent)",
      color: "var(--status-denied)",
      iconColor: "var(--status-denied)",
    },
  };

  const s = stateStyles[data.state];

  return (
    <div
      className="px-4 py-3 rounded-xl border shadow-sm flex items-center gap-3 w-[200px] transition-colors"
      style={{ borderColor: s.borderColor, background: s.background }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="p-1.5 rounded-md shadow-sm border" style={{ background: "var(--surface)", borderColor: "var(--line)", color: s.iconColor }}>
        <Icon size={16} />
      </div>
      <div className="text-sm tracking-tight" style={{ color: s.color }}>
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
      style: { stroke: states.policy === "active" ? "var(--accent)" : "var(--line)" },
    },
    {
      id: "e-policy-fulfillment",
      source: "policy",
      target: "fulfillment",
      animated: states.fulfillment === "active",
      style: { stroke: states.fulfillment === "active" ? "var(--accent)" : "var(--line)" },
    },
  ], [states.policy, states.fulfillment]);

  return (
    <div className="h-[180px] w-full rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--subtle)" }}>
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
