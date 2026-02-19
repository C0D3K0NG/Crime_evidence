"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    ArrowLeft,
    MapPin,
    Calendar,
    User,
    ShieldCheck,
    FileText,
    History,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EvidenceDetail {
    id: string;
    caseId: string;
    type: string;
    description: string;
    status: string;
    collectionDate: string;
    location: string;
    collectedBy: { fullName: string };
    currentCustodian: { fullName: string };
    locked?: boolean;
    custodyEvents?: unknown[];
    files?: { id: string; fileName: string; fileSize: number; mimeType: string }[];
    accessLogs?: unknown[]; // Placeholder for now
}

export default function EvidenceDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const userId = params.userId as string;
    const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Transfer Modal State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferReason, setTransferReason] = useState("");
    const [targetUserId, setTargetUserId] = useState("");
    const [transferLoading, setTransferLoading] = useState(false);

    const handleTransfer = async () => {
        if (!targetUserId || !transferReason) return;
        setTransferLoading(true);
        try {
            await axios.post(`/api/v1/custody/evidence/${id}/transfer`, {
                toUserId: targetUserId,
                reason: transferReason
            });
            setTransferModalOpen(false);
            // Refresh evidence
            const response = await axios.get(`/api/v1/evidence/${id}`);
            setEvidence(response.data.evidence);
            alert("Transfer initiated successfully!");
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            alert(err.response?.data?.error || "Transfer failed");
        } finally {
            setTransferLoading(false);
        }
    };

    useEffect(() => {
        const fetchEvidence = async () => {
            try {
                const response = await axios.get(`/api/v1/evidence/${id}`);
                setEvidence(response.data.evidence);
            } catch {
                setError("Failed to load evidence details.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchEvidence();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !evidence) {
        return (
            <div className="space-y-4 text-center">
                <p className="text-destructive">{error || "Evidence not found."}</p>
                <Link href={`/dashboard/${userId}/evidence`} className="text-primary hover:underline">
                    Return to Evidence Log
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative">
            {/* Transfer Modal */}
            {transferModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-foreground">Initiate Custody Transfer</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Transfer this evidence to another officer or custodian.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Recipient User ID or Username</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Enter Username or ID"
                                    value={targetUserId}
                                    onChange={e => setTargetUserId(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Reason for Transfer</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="e.g. Taking to forensic lab"
                                    value={transferReason}
                                    onChange={e => setTransferReason(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setTransferModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={transferLoading || !targetUserId}
                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                {transferLoading ? "Processing..." : "Confirm Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/dashboard/${userId}/evidence`}
                        className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{evidence.caseId}</h1>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                evidence.type === "Physical" && "bg-blue-500/10 text-blue-500",
                                evidence.type === "Digital" && "bg-purple-500/10 text-purple-500",
                                evidence.type === "Testimonial" && "bg-green-500/10 text-green-500"
                            )}>
                                {evidence.type}
                            </span>
                            <span>•</span>
                            <span>{evidence.status}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {/* Action Buttons */}
                    <button
                        onClick={() => setTransferModalOpen(true)}
                        disabled={!!evidence.locked}
                        className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {evidence.locked ? "Transfer Pending" : "Request Transfer"}
                    </button>
                    <button className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                        Generate Report
                    </button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center text-lg font-semibold">
                            <FileText className="mr-2 h-5 w-5 text-primary" />
                            Description & Context
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {evidence.description}
                        </p>
                    </div>

                    {/* Attachments Section */}
                    {evidence.files && evidence.files.length > 0 && (
                        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
                            <h3 className="mb-3 text-lg font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" /> Attached Files
                            </h3>
                            <div className="grid gap-2 md:grid-cols-2">
                                {evidence.files.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                                                <FileText className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="truncate">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {file.fileName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(file.fileSize / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <a
                                            href={`/api/v1/evidence/${evidence.id}/files/${file.id}/download`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-2 rounded-md p-2 text-primary hover:bg-primary/10 transition-colors"
                                            title="Download"
                                        >
                                            <ArrowLeft className="h-5 w-5 rotate-[-90deg]" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center text-lg font-semibold">
                            <History className="mr-2 h-5 w-5 text-primary" />
                            Chain of Custody Timeline
                        </h2>
                        <div className="border-l-2 border-border ml-2 space-y-6 pl-6 relative">
                            {/* Collection Event (Always first) */}
                            <div className="relative">
                                <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground ring-4 ring-background"></span>
                                <p className="text-sm font-medium text-foreground">Collection</p>
                                <p className="text-xs text-muted-foreground">
                                    Collected by {evidence.collectedBy?.fullName} on {new Date(evidence.collectionDate).toLocaleDateString()}
                                </p>
                            </div>

                            {/* Custody Events */}
                            {evidence.custodyEvents?.map((event: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <div key={event.id} className="relative">
                                    <span className={cn(
                                        "absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background",
                                        event.status === 'pending' ? "bg-yellow-500" : "bg-blue-500"
                                    )}></span>
                                    <p className="text-sm font-medium text-foreground capitalize">{event.eventType} ({event.status})</p>
                                    <p className="text-xs text-muted-foreground">
                                        From: {event.fromUser?.fullName} → To: {event.toUser?.fullName}
                                    </p>
                                    <p className="text-xs text-muted-foreground italic mt-0.5">&quot;{event.reason}&quot;</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            ))}

                            {/* Current Status */}
                            <div className="relative">
                                <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-green-500 ring-4 ring-background"></span>
                                <p className="text-sm font-medium text-foreground">Current Custodian</p>
                                <p className="text-xs text-muted-foreground">
                                    {evidence.currentCustodian?.fullName}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                        <h3 className="mb-4 font-semibold text-foreground">Metadata</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Collected Date</p>
                                    <p className="text-sm text-foreground">
                                        {new Date(evidence.collectionDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Location Found</p>
                                    <p className="text-sm text-foreground">{evidence.location || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Collected By</p>
                                    <p className="text-sm text-foreground">{evidence.collectedBy?.fullName || "Unknown"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Current Status</p>
                                    <p className="text-sm text-foreground">{evidence.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
