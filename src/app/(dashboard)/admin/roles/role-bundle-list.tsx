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
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createRoleBundleAction(fd.get("name") as string, fd.get("description") as string);
      showToast("Role bundle created", "success");
      setShowCreate(false);
      window.location.reload(); 
    } catch (err) {
      showToast("Failed to create bundle", "error");
    }
  }

  async function handleAddType(bundleId: string, typeId: string) {
     try {
       await addTypeToBundleAction(bundleId, typeId);
       showToast("Request type added to bundle", "success");
       window.location.reload();
     } catch (err) {
       showToast("Failed to add type", "error");
     }
  }

  async function handleApply(bundleId: string, userId: string) {
    if (!userId) {
      showToast("Please select a user first", "error");
      return;
    }
    setApplying(bundleId);
    try {
      const results = await applyBundleToUserAction(userId, bundleId);
      const successCount = results.filter(r => r.ok).length;
      showToast(`Triggered ${successCount} requests for user.`, "success");
    } catch (err) {
      showToast("Failed to apply bundle", "error");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-end">
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" /> New Bundle
          </button>
       </div>

       {showCreate && (
         <form onSubmit={handleCreate} className="p-6 rounded-xl border border-zinc-200 bg-white space-y-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Bundle Name</label>
              <input name="name" placeholder="e.g. Engineering" required className="w-full rounded-md border border-zinc-200 p-2 text-sm bg-transparent dark:border-zinc-700" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Description</label>
              <input name="description" placeholder="Standard access for all engineers" className="w-full rounded-md border border-zinc-200 p-2 text-sm bg-transparent dark:border-zinc-700" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-blue-500 transition-colors shadow-sm">
              Create Role Bundle
            </button>
         </form>
       )}

       <div className="grid gap-6">
          {initialBundles.map(bundle => (
            <div key={bundle.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
               <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/30 dark:bg-zinc-800/30">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{bundle.name}</h3>
                    <p className="text-xs text-zinc-500">{bundle.description || "No description provided"}</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure?")) {
                        deleteRoleBundleAction(bundle.id).then(() => window.location.reload());
                      }
                    }} 
                    className="text-zinc-400 hover:text-red-500 transition-colors p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
               </div>
               
               <div className="p-5 grid md:grid-cols-2 gap-8">
                  {/* Types in bundle */}
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5" /> Bundle Contents
                     </h4>
                     <div className="space-y-2">
                        {bundle.requestTypes.map((bt: any) => (
                          <div key={bt.id} className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3 py-2.5 text-sm shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                             <span className="font-medium">{bt.requestType.title}</span>
                             <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500 dark:bg-zinc-700">/{bt.requestType.slug}</span>
                          </div>
                        ))}
                        {bundle.requestTypes.length === 0 && (
                          <div className="text-xs text-zinc-400 italic py-4 text-center border border-dashed border-zinc-100 rounded-lg dark:border-zinc-800">
                            No apps added to this bundle.
                          </div>
                        )}
                        
                        <div className="pt-2">
                           <select 
                             className="w-full text-xs rounded-md border border-zinc-200 p-2 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
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
                  <div className="space-y-4 border-l border-zinc-100 pl-8 dark:border-zinc-800">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> Manual Trigger (Joiner/Mover)
                     </h4>
                     <div className="space-y-4">
                        <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                          Selecting a user below will trigger individual provisioning requests for every application in this bundle.
                        </p>
                        <div className="flex flex-col gap-3">
                           <select 
                             id={`user-select-${bundle.id}`}
                             className="w-full text-xs rounded-md border border-zinc-200 p-2 dark:bg-zinc-800 dark:border-zinc-700"
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
                             className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
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
            <div className="text-center py-16 border border-dashed border-zinc-200 rounded-xl dark:border-zinc-800 bg-zinc-50/20">
               <ShieldCheck className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
               <p className="text-zinc-500 text-sm font-medium">No role bundles defined yet.</p>
               <p className="text-xs text-zinc-400 mt-1">Start by creating a bundle for Engineering or Sales.</p>
            </div>
          )}
       </div>
    </div>
  );
}
