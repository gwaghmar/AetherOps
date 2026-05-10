"use client";

import { useState } from "react";
import { 
  createRoleBundleAction, 
  deleteRoleBundleAction, 
  addTypeToBundleAction,
  applyBundleToUserAction 
} from "@/app/actions/roles";
import { useToast } from "@/components/toast";
import { Plus, Trash2, UserPlus, ShieldCheck, Box } from "lucide-react";

export function RoleBundleList({ 
  initialBundles, 
  availableTypes, 
  allUsers 
}: { 
  initialBundles: any[], 
  availableTypes: any[], 
  allUsers: any[] 
}) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createRoleBundleAction(fd.get("name") as string, fd.get("description") as string);
      toast("Role bundle created", "success");
      setShowCreate(false);
      window.location.reload(); 
    } catch (err) {
      toast("Failed to create bundle", "error");
    }
  }

  async function handleAddType(bundleId: string, typeId: string) {
     try {
       await addTypeToBundleAction(bundleId, typeId);
       toast("Request type added to bundle", "success");
       window.location.reload();
     } catch (err) {
       toast("Failed to add type", "error");
     }
  }

  async function handleApply(bundleId: string, userId: string) {
    if (!userId) {
      toast("Please select a user first", "error");
      return;
    }
    setApplying(bundleId);
    try {
      const results = await applyBundleToUserAction(userId, bundleId);
      const successCount = results.filter(r => r.ok).length;
      toast(`Triggered ${successCount} requests for user.`, "success");
    } catch (err) {
      toast("Failed to apply bundle", "error");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-end">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
          >
            <Plus className="h-4 w-4" /> New Bundle
          </button>
       </div>

       {showCreate && (
         <form onSubmit={handleCreate} className="p-6 rounded-xl border space-y-4 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--ink-3)" }}>Bundle Name</label>
              <input name="name" placeholder="e.g. Engineering" required className="w-full rounded-md border p-2 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--ink-3)" }}>Description</label>
              <input name="description" placeholder="Standard access for all engineers" className="w-full rounded-md border p-2 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
            </div>
            <button type="submit" className="w-full rounded-md py-2 text-sm font-semibold transition-colors" style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}>
              Create Role Bundle
            </button>
         </form>
       )}

       <div className="grid gap-6">
          {initialBundles.map(bundle => (
            <div key={bundle.id} className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
               <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: "var(--line)", background: "var(--subtle)" }}>
                  <div>
                    <h3 className="font-bold" style={{ color: "var(--ink)" }}>{bundle.name}</h3>
                    <p className="text-xs" style={{ color: "var(--ink-3)" }}>{bundle.description || "No description provided"}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure?")) {
                        deleteRoleBundleAction(bundle.id).then(() => window.location.reload());
                      }
                    }}
                    className="transition-colors p-2"
                    style={{ color: "var(--ink-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--status-denied)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
               </div>
               
               <div className="p-5 grid md:grid-cols-2 gap-8">
                  {/* Types in bundle */}
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
                        <Box className="h-3.5 w-3.5" /> Bundle Contents
                     </h4>
                     <div className="space-y-2">
                        {bundle.requestTypes.map((bt: any) => (
                          <div key={bt.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                             <span className="font-medium">{bt.requestType.title}</span>
                             <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--subtle)", color: "var(--ink-3)" }}>/{bt.requestType.slug}</span>
                          </div>
                        ))}
                        {bundle.requestTypes.length === 0 && (
                          <div className="text-xs italic py-4 text-center border border-dashed rounded-lg" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
                            No apps added to this bundle.
                          </div>
                        )}

                        <div className="pt-2">
                           <select
                             className="w-full text-xs rounded-md border p-2"
                             style={{ background: "var(--subtle)", borderColor: "var(--line)", color: "var(--ink)" }}
                             value=""
                             onChange={(e) => {
                                if (e.target.value) handleAddType(bundle.id, e.target.value);
                             }}
                           >
                              <option value="" disabled>+ Add App/Type to Bundle</option>
                              {availableTypes
                                .filter(t => !bundle.requestTypes.find((bt: any) => bt.requestTypeId === t.id))
                                .map(t => (
                                  <option key={t.id} value={t.id}>{t.title}</option>
                                ))
                              }
                           </select>
                        </div>
                     </div>
                  </div>

                  {/* Manual trigger for JML */}
                  <div className="space-y-4 border-l pl-8" style={{ borderColor: "var(--line)" }}>
                     <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
                        <UserPlus className="h-3.5 w-3.5" /> Manual Trigger (Joiner/Mover)
                     </h4>
                     <div className="space-y-4">
                        <p className="text-[11px] leading-relaxed italic" style={{ color: "var(--ink-3)" }}>
                          Selecting a user below will trigger individual provisioning requests for every application in this bundle.
                        </p>
                        <div className="flex flex-col gap-3">
                           <select
                             id={`user-select-${bundle.id}`}
                             className="w-full text-xs rounded-md border p-2"
                             style={{ background: "var(--surface)", borderColor: "var(--line)" }}
                           >
                              <option value="">Select User...</option>
                              {allUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                              ))}
                           </select>
                           <button 
                             disabled={applying === bundle.id}
                             onClick={() => {
                                const select = document.getElementById(`user-select-${bundle.id}`) as HTMLSelectElement;
                                handleApply(bundle.id, select.value);
                             }}
                             className="w-full px-4 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                             style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
                           >
                             {applying === bundle.id ? "Applying Bundle..." : "Trigger Bulk Provisioning"}
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          ))}
          {initialBundles.length === 0 && (
            <div className="text-center py-16 border border-dashed rounded-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--subtle) 50%, transparent)" }}>
               <ShieldCheck className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--ink-3)" }} />
               <p className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>No role bundles defined yet.</p>
               <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>Start by creating a bundle for Engineering or Sales.</p>
            </div>
          )}
       </div>
    </div>
  );
}
