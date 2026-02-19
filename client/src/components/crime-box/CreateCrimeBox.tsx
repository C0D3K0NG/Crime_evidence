"use client";

import { useState } from "react";
import { useCrimeBox } from "@/context/CrimeBoxContext";
import { Plus, Key, Copy, Check } from "lucide-react";

interface CreateCrimeBoxProps {
  onCreateSuccess?: () => void;
}

export default function CreateCrimeBox({ onCreateSuccess }: CreateCrimeBoxProps) {
  const { createBox } = useCrimeBox();
  const [name, setName] = useState("");
  const [caseId, setCaseId] = useState("");
  const [keys, setKeys] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const newKeys = await createBox(name, caseId);
    if (newKeys) {
      setKeys(newKeys);
      setName("");
      setCaseId("");
    }
  };

  const copyToClipboard = (text: string, isPrivate: boolean) => {
    navigator.clipboard.writeText(text);
    if (isPrivate) {
      setCopiedPrivate(true);
      setTimeout(() => setCopiedPrivate(false), 2000);
    } else {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    }
  };

  return (
    <div className="border border-white/10 bg-black/50 p-6 backdrop-blur relative overflow-hidden group">
      {/* Tech Accents */}
      <div className="absolute top-0 left-0 w-2 h-2 bg-primary"></div>
      <div className="absolute top-0 right-0 w-2 h-2 bg-primary"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 bg-primary"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 bg-primary"></div>

      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
        <div className="p-2 bg-primary/10 text-primary">
          <Plus className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Initialize New Crime Box</h2>
      </div>

      {!keys ? (
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="text-xs font-mono text-primary uppercase tracking-wider">Operation / Box Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OP-BLUEBIRD-EVIDENCE"
              className="w-full mt-2 bg-black border border-white/20 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none font-mono tracking-wide"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-primary uppercase tracking-wider">Case ID Reference</label>
            <input
              type="text"
              required
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="e.g. CASE-2024-001-X"
              className="w-full mt-2 bg-black border border-white/20 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none font-mono tracking-wide"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-black py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary/90 transition-all border border-transparent hover:border-primary hover:shadow-[0_0_15px_rgba(0,255,65,0.3)]"
          >
            Generate Keys &amp; Initialize
          </button>
        </form>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-primary/5 p-4 border border-primary text-primary">
            <p className="font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
              <Check className="h-5 w-5" /> Box Initialized Successfully. Share these keys.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 p-4 border border-white/10 space-y-2">
              <label className="text-xs font-mono text-primary flex items-center gap-2 uppercase">
                <Key className="h-3 w-3" /> Private Key (Read/Write - Officers)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black p-3 text-sm font-mono border border-white/20 text-white truncate shadow-inner">
                  {keys.privateKey}
                </code>
                <button
                  onClick={() => copyToClipboard(keys.privateKey, true)}
                  className="p-3 bg-white/5 hover:bg-primary hover:text-black border border-white/20 hover:border-primary transition-colors text-white"
                  title="Copy Private Key"
                >
                  {copiedPrivate ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="bg-white/5 p-4 border border-white/10 space-y-2">
              <label className="text-xs font-mono text-white flex items-center gap-2 uppercase">
                <Key className="h-3 w-3" /> Public Key (Read Only - Legal)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black p-3 text-sm font-mono border border-white/20 text-muted-foreground truncate shadow-inner">
                  {keys.publicKey}
                </code>
                <button
                  onClick={() => copyToClipboard(keys.publicKey, false)}
                  className="p-3 bg-white/5 hover:bg-white/20 border border-white/20 transition-colors text-white"
                  title="Copy Public Key"
                >
                  {copiedPublic ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setKeys(null)}
              className="flex-1 text-xs text-muted-foreground hover:text-primary uppercase tracking-widest hover:underline pt-2"
            >
              Create Another
            </button>
            {onCreateSuccess && (
              <button
                onClick={onCreateSuccess}
                className="flex-1 bg-primary text-black py-2 text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all"
              >
                Go to Evidence Vault →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
