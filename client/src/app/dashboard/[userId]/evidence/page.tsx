"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, Search, FileText, Loader2, ArrowRight, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrimeBox } from "@/context/CrimeBoxContext";
import { useParams } from "next/navigation";

interface Evidence {
    id: string;
    caseId: string;
    type: string;
    description: string;
    status: string;
    collectionDate: string;
    collectedBy: { fullName: string };
    currentCustodian: { fullName: string };
}

export default function EvidenceListPage() {
    const { permission, activeBox } = useCrimeBox();
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const params = useParams();
    const userId = params.userId as string;

    useEffect(() => {
        const fetchEvidence = async () => {
            setLoading(true);
            try {
                const response = await axios.get("/api/v1/evidence", {
                    params: {
                        search: searchTerm,
                        page: pagination.page,
                        limit: 10,
                        caseId: activeBox?.caseId // Filter by active box
                    },
                });
                setEvidence(response.data.evidence);
                setPagination(response.data.pagination);
            } catch (error) {
                console.error("Failed to fetch evidence:", error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchEvidence();
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [searchTerm, pagination.page, activeBox?.caseId]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white uppercase tracking-tighter">Evidence Ledger</h1>
                    <p className="text-muted-foreground font-mono text-sm mt-1 mb-2">
                        SECURE CHAIN OF CUSTODY :: IMMUTABLE RECORDS
                    </p>
                    {activeBox && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-mono uppercase tracking-wider">
                            <Box className="h-3 w-3" />
                            Secure Vault: {activeBox.name} <span className="text-muted-foreground mx-1">|</span> {activeBox.caseId}
                        </div>
                    )}
                </div>
                {permission === 'read-write' && (
                    <Link
                        href={`/dashboard/${userId}/evidence/new`}
                        className="flex items-center justify-center bg-primary text-black px-6 py-2 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Log New Item
                    </Link>
                )}
            </div>

            <div className="flex items-center bg-black border border-white/20 px-4 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <Search className="mr-3 h-4 w-4 text-primary" />
                <input
                    type="text"
                    placeholder="SEARCH DATABASE BY CASE ID OR KEYWORD..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground focus:outline-none font-mono tracking-wide uppercase"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="border border-white/10 bg-black/40 backdrop-blur">
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-primary font-mono animate-pulse">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        ACCESSING SECURE LEDGER...
                    </div>
                ) : evidence.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground font-mono">
                        <FileText className="mb-4 h-12 w-12 opacity-20" />
                        <p>No records found in current sector.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-primary border-b border-primary/20 font-mono uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Case ID</th>
                                    <th className="px-6 py-4 font-bold">Type</th>
                                    <th className="px-6 py-4 font-bold">Description</th>
                                    <th className="px-6 py-4 font-bold">Status</th>
                                    <th className="px-6 py-4 font-bold">Custodian</th>
                                    <th className="px-6 py-4 font-bold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {evidence.map((item) => (
                                    <tr key={item.id} className="group hover:bg-primary/5 transition-colors font-mono">
                                        <td className="px-6 py-4 font-medium text-white">
                                            {item.caseId}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider border",
                                                item.type === "Physical" && "border-blue-500/50 text-blue-400 bg-blue-500/5",
                                                item.type === "Digital" && "border-purple-500/50 text-purple-400 bg-purple-500/5",
                                                item.type === "Testimonial" && "border-amber-500/50 text-amber-400 bg-amber-500/5"
                                            )}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate text-muted-foreground group-hover:text-white transition-colors" title={item.description}>
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="uppercase text-xs font-bold text-white">{item.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs uppercase">
                                            {item.currentCustodian?.fullName || "UNKNOWN"}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/dashboard/${userId}/evidence/${item.id}`}
                                                className="inline-flex items-center justify-center p-2 text-primary hover:bg-primary hover:text-black transition-colors"
                                            >
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase border-t border-white/10 pt-4">
                <span>Displaying Page {pagination.page} of {pagination.totalPages}</span>
                <div className="space-x-2">
                    <button
                        disabled={pagination.page <= 1}
                        onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                        className="px-4 py-2 border border-white/10 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                        className="px-4 py-2 border border-white/10 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div >
    );
}
