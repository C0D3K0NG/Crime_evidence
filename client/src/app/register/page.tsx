"use client";

import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, User, Mail, Shield, Lock, Loader2, CheckCircle2, ArrowRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        fullName: "",
        role: "officer", // Default role
        password: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Fake delay for animation demo
            await new Promise(resolve => setTimeout(resolve, 800));

            const response = await axios.post("/api/v1/auth/register", formData);

            if (response.data.success) {
                setSuccess(true);
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            setError(
                err.response?.data?.error || "Registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    // Staggered animation variants for form fields
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { x: -20, opacity: 0 },
        visible: { x: 0, opacity: 1 }
    };

    const roles = [
        { id: 'officer', label: 'Officer', icon: Shield },
        { id: 'head_officer', label: 'Head Officer', icon: Activity },
        { id: 'lawyer', label: 'Lawyer', icon: User },
        { id: 'judge', label: 'Judge', icon: CheckCircle2 },
    ];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 font-sans relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 2 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-lg relative z-10"
            >
                {/* Card Container */}
                <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    {/* Glowing Border Effect */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="p-8 sm:p-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 shadow-[0_0_15px_rgba(255,0,60,0.15)] mb-6"
                            >
                                <UserPlus className="h-8 w-8 text-primary" />
                            </motion.div>

                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-2xl font-bold tracking-tight text-white mb-2 uppercase"
                            >
                                Registration
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-sm text-gray-400 font-mono"
                            >
                                JOIN THE NETWORK.
                            </motion.p>
                        </div>

                        {/* Form */}
                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center space-y-4 rounded-xl bg-green-500/10 border border-green-500/20 p-8 text-center"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", delay: 0.2 }}
                                    >
                                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                                    </motion.div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wide">Approved</h3>
                                    <p className="text-sm text-green-400 font-mono">Redirecting...</p>
                                </motion.div>
                            ) : (
                                <motion.form
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-5"
                                    onSubmit={handleSubmit}
                                >
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <motion.div variants={itemVariants}>
                                            <label className="block text-xs font-mono text-primary uppercase tracking-wider mb-2">Username</label>
                                            <div className="relative group/input">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within/input:text-primary text-gray-500">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <input
                                                    name="username"
                                                    type="text"
                                                    required
                                                    value={formData.username}
                                                    onChange={handleChange}
                                                    className="block w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:border-primary focus:bg-white/10 focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono text-sm"
                                                    placeholder="jdoe"
                                                />
                                            </div>
                                        </motion.div>
                                        <motion.div variants={itemVariants}>
                                            <label className="block text-xs font-mono text-primary uppercase tracking-wider mb-2">Full Name</label>
                                            <input
                                                name="fullName"
                                                type="text"
                                                required
                                                value={formData.fullName}
                                                onChange={handleChange}
                                                className="block w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-gray-600 focus:border-primary focus:bg-white/10 focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono text-sm"
                                                placeholder="John Doe"
                                            />
                                        </motion.div>
                                    </div>

                                    <motion.div variants={itemVariants}>
                                        <label className="block text-xs font-mono text-primary uppercase tracking-wider mb-2">Email</label>
                                        <div className="relative group/input">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within/input:text-primary text-gray-500">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <input
                                                name="email"
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={handleChange}
                                                className="block w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:border-primary focus:bg-white/10 focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono text-sm"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <label className="block text-xs font-mono text-primary uppercase tracking-wider mb-2">Role</label>
                                        <div className="relative group/input">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within/input:text-primary text-gray-500">
                                                <Shield className="h-4 w-4" />
                                            </div>
                                            <select
                                                name="role"
                                                value={formData.role}
                                                onChange={handleChange}
                                                className="block w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-white focus:border-primary focus:bg-white/10 focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono text-sm appearance-none"
                                            >
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.id} className="bg-black text-white">{role.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <label className="block text-xs font-mono text-primary uppercase tracking-wider mb-2">Password</label>
                                        <div className="relative group/input">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within/input:text-primary text-gray-500">
                                                <Lock className="h-4 w-4" />
                                            </div>
                                            <input
                                                name="password"
                                                type="password"
                                                required
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="block w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-gray-600 focus:border-primary focus:bg-white/10 focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono text-sm"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </motion.div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 font-mono">
                                                <Activity className="h-4 w-4 shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        </motion.div>
                                    )}

                                    <motion.button
                                        variants={itemVariants}
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(255,0,60,0.3)" }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={loading}
                                        className={cn(
                                            "relative w-full overflow-hidden rounded-lg bg-primary py-3.5 text-sm font-bold uppercase tracking-widest text-black shadow-lg transition-all hover:bg-white hover:text-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group/btn",
                                            loading && "cursor-wait"
                                        )}
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    PROCESSING...
                                                </>
                                            ) : (
                                                <>
                                                    SUBMIT CREDENTIALS <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                                </>
                                            )}
                                        </span>
                                    </motion.button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="bg-white/5 p-4 text-center border-t border-white/5">
                        <Link
                            href="/login"
                            className="text-xs font-mono text-gray-500 hover:text-white transition-colors"
                        >
                            {"<"} RETURN TO LOGIN
                        </Link>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 2 }}
                className="absolute bottom-8 text-[10px] text-gray-600 font-mono tracking-[0.2em] select-none"
            >
                SECURE CONNECTION ESTABLISHED :: DFX PROTOCOL V2.4
            </motion.div>
        </div>
    );
}
