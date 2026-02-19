"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useCrimeBox } from "@/context/CrimeBoxContext";
import CreateCrimeBox from "@/components/crime-box/CreateCrimeBox";
import JoinCrimeBox from "@/components/crime-box/JoinCrimeBox";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Key, Copy, Check, Eye, EyeOff } from "lucide-react";

// ── Head-Officer-only component to reveal stored box keys ─────────────────────
function ViewBoxKeys({ keys }: { keys: { privateKey: string; publicKey: string } }) {
    const [revealed, setRevealed] = useState(false);
    const [copiedPri, setCopiedPri] = useState(false);
    const [copiedPub, setCopiedPub] = useState(false);

    const copy = (text: string, isPrivate: boolean) => {
        navigator.clipboard.writeText(text);
        if (isPrivate) { setCopiedPri(true); setTimeout(() => setCopiedPri(false), 2000); }
        else { setCopiedPub(true); setTimeout(() => setCopiedPub(false), 2000); }
    };

    return (
        <div className="p-6 border border-yellow-500/30 bg-yellow-500/5 flex flex-col justify-between">
            <div>
                <h3 className="font-semibold text-yellow-400 uppercase tracking-wide text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" /> Box Access Keys
                </h3>
                <p className="text-xs text-muted-foreground mt-2">Visible only to you (Head Officer). Share with your team.</p>
            </div>
            <div className="mt-4 space-y-3">
                {!revealed ? (
                    <button
                        onClick={() => setRevealed(true)}
                        className="w-full flex items-center justify-center gap-2 border border-yellow-500/40 text-yellow-400 py-2 text-xs font-bold uppercase tracking-widest hover:bg-yellow-500/10 transition-colors"
                    >
                        <Eye className="h-3 w-3" /> Reveal Keys
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-primary uppercase w-16 shrink-0">Private</span>
                            <code className="flex-1 bg-black px-2 py-1.5 text-xs font-mono border border-white/10 text-white truncate">{keys.privateKey}</code>
                            <button onClick={() => copy(keys.privateKey, true)} className="p-1.5 border border-white/10 hover:border-primary hover:text-primary text-muted-foreground transition-colors">
                                {copiedPri ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase w-16 shrink-0">Public</span>
                            <code className="flex-1 bg-black px-2 py-1.5 text-xs font-mono border border-white/10 text-muted-foreground truncate">{keys.publicKey}</code>
                            <button onClick={() => copy(keys.publicKey, false)} className="p-1.5 border border-white/10 hover:border-white/40 text-muted-foreground transition-colors">
                                {copiedPub ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                        <button onClick={() => setRevealed(false)} className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary pt-1">
                            <EyeOff className="h-3 w-3" /> Hide
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


export default function DashboardPage() {
    const { user } = useAuth();
    const { activeBox, permission, leaveBox } = useCrimeBox();
    const [stats, setStats] = useState({
        totalEvidence: 0,
        pendingTransfers: 0,
    });
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Mock stats if API fails or for demo
                const res = await axios.get("/api/v1/stats").catch(() => ({
                    data: { totalEvidence: 12, pendingTransfers: 3 }
                }));
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (activeBox) {
        // Read stored keys (only available if this user created the box in this session)
        const storedKeysRaw = typeof window !== "undefined"
            ? sessionStorage.getItem("active_crime_box_keys")
            : null;
        const storedKeys: { privateKey: string; publicKey: string } | null = storedKeysRaw
            ? JSON.parse(storedKeysRaw)
            : null;

        return (
            <div className="space-y-6">
                {/* Box Header */}
                <div className="flex items-center justify-between border border-white/10 bg-black/50 backdrop-blur p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
                    <div>
                        <p className="text-xs font-mono text-primary uppercase tracking-widest mb-1">Active Crime Box</p>
                        <h1 className="text-2xl font-bold text-white">{activeBox.name}</h1>
                        <p className="text-muted-foreground flex items-center gap-2 mt-1">
                            Case ID: <span className="font-mono text-primary">{activeBox.caseId}</span>
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 uppercase font-mono">
                                {permission}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={leaveBox}
                        className="rounded-none border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition-colors uppercase tracking-wider"
                    >
                        Exit Box
                    </button>
                </div>

                {/* Action Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {permission === "read-write" && (
                        <div className="p-6 border border-primary/20 bg-primary/5 flex flex-col justify-between">
                            <div>
                                <h3 className="font-semibold text-primary uppercase tracking-wide text-sm">Log New Evidence</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Register physical or digital evidence to this case.
                                </p>
                            </div>
                            <Link
                                href={`/dashboard/${userId}/evidence/new`}
                                className="mt-4 block w-full text-center bg-primary text-black py-2 text-sm font-bold uppercase tracking-widest hover:bg-primary/90 transition-all"
                            >
                                Register Evidence
                            </Link>
                        </div>
                    )}

                    <div className="p-6 border border-white/10 bg-card flex flex-col justify-between">
                        <div>
                            <h3 className="font-medium text-white uppercase tracking-wide text-sm">View Evidence Vault</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                Browse all shared evidence in this box.
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${userId}/evidence`}
                            className="mt-4 block w-full text-center border border-white/20 text-white py-2 text-sm font-bold uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
                        >
                            Open Vault →
                        </Link>
                    </div>

                    {/* HEAD OFFICER ONLY: View Box Keys */}
                    {user?.role === "head_officer" && storedKeys && (
                        <ViewBoxKeys keys={storedKeys} />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-foreground">
                    Welcome back, {user?.fullName?.split(" ")[0]}
                </h1>
                <p className="text-muted-foreground">
                    Join a Crime Box to access evidence or create a new one.
                </p>
                <div className="mt-2 inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground capitalize">
                    Role: {user?.role?.replace("_", " ")}
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Left Column: Actions */}
                <div className="space-y-6">
                    {user?.role === "head_officer" && (
                        <CreateCrimeBox onCreateSuccess={() => router.push(`/dashboard/${userId}/evidence`)} />
                    )}
                    <JoinCrimeBox onJoinSuccess={() => router.push(`/dashboard/${userId}/evidence`)} />
                </div>

                {/* Right Column: Stats & Overview */}
                <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                            <h3 className="font-medium text-foreground">Pending Transfers</h3>
                            <p className="text-3xl font-bold text-primary mt-2">
                                {loading ? "..." : stats.pendingTransfers}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Requiring action</p>
                        </div>
                        <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                            <h3 className="font-medium text-foreground">Total Evidence</h3>
                            <p className="text-3xl font-bold text-secondary mt-2">
                                {loading ? "..." : stats.totalEvidence}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">System-wide</p>
                        </div>
                    </div>

                    {/* Placeholder for Recent Activity */}
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <h3 className="font-medium text-foreground mb-4">Recent System Activity</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-start gap-3 text-sm">
                                    <div className="mt-0.5 h-2 w-2 rounded-full bg-muted-foreground/50" />
                                    <p className="text-muted-foreground">
                                        <span className="font-medium text-foreground">Officer Chen</span> transferred Case #2024-{100 + i} to <span className="font-medium text-foreground">Storage B</span>.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
