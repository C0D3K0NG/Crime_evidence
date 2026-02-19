"use client";

import { useState } from "react";
import { useCrimeBox } from "@/context/CrimeBoxContext";
import { LogIn, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface JoinCrimeBoxProps {
  onJoinSuccess?: () => void;
}

export default function JoinCrimeBox({ onJoinSuccess }: JoinCrimeBoxProps) {
  const { joinBox } = useCrimeBox();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await joinBox(key.trim());
    if (!success) {
      setError("Invalid Key or Insufficient Permissions.");
    } else {
      setKey("");
      onJoinSuccess?.(); // Navigate away after success
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col justify-center border border-white/10 bg-black/50 p-6 backdrop-blur relative overflow-hidden">
      {/* Tech Accents */}
      <div className="absolute top-0 right-0 w-8 h-1 bg-primary"></div>
      <div className="absolute bottom-0 left-0 w-8 h-1 bg-primary"></div>

      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
        <div className="p-2 bg-primary/10 text-primary">
          <LogIn className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Access Secured Vault</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6 font-mono">
        Enter your secure cryptographic key to decrypt and access the evidence ledger.
      </p>

      <form onSubmit={handleJoin} className="space-y-6">
        <div>
          <input
            type="text"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ENTER PRIVATE OR PUBLIC KEY"
            className="w-full bg-black border border-white/20 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none font-mono tracking-wide"
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/50 text-destructive text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="h-3 w-3" /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !key}
          className={cn(
            "w-full flex items-center justify-center gap-2 bg-primary text-black py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            loading && "cursor-wait"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Decrypt &amp; Enter <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
