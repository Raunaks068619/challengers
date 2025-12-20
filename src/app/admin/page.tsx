"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, setDoc, addDoc } from "firebase/firestore";
import { toast } from "sonner";
import AuthGuard from "@/components/AuthGuard";
import { Trash2, RefreshCw, Plus, CheckSquare, Square } from "lucide-react";
import Loader from "@/components/Loader";


const COLLECTIONS = [
    "profiles",
    "challenges",
    "challenge_participants",
    "daily_logs"
];

export default function AdminPage() {
    const [selectedCollection, setSelectedCollection] = useState(COLLECTIONS[0]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [jsonInput, setJsonInput] = useState("");
    const [isJsonValid, setIsJsonValid] = useState(true);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [adminAuth, setAdminAuth] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, selectedCollection));
            const docs = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDocuments(docs);
            setSelectedIds(new Set()); // Clear selection on refresh
        } catch (error: any) {
            console.error("Error fetching documents:", error);
            toast.error("Failed to fetch documents: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [selectedCollection]);

    const handleSelectAll = () => {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(documents.map(d => d.id)));
        }
    };

    const handleSelectOne = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} documents?`)) return;

        setLoading(true);
        try {
            const deletePromises = Array.from(selectedIds).map(id =>
                deleteDoc(doc(db, selectedCollection, id))
            );
            await Promise.all(deletePromises);
            toast.success(`Deleted ${selectedIds.size} documents`);
            fetchDocuments();
        } catch (error: any) {
            console.error("Error deleting documents:", error);
            toast.error("Failed to delete: " + error.message);
            setLoading(false);
        }
    };

    const handleJsonInsert = async () => {
        if (!jsonInput.trim()) return;

        try {
            const data = JSON.parse(jsonInput);
            const items = Array.isArray(data) ? data : [data];

            setLoading(true);
            let count = 0;

            for (const item of items) {
                // If item has an 'id' field, use it as document ID
                if (item.id) {
                    const { id, ...rest } = item;
                    await setDoc(doc(db, selectedCollection, id), rest);
                } else {
                    await addDoc(collection(db, selectedCollection), item);
                }
                count++;
            }

            toast.success(`Inserted ${count} documents`);
            setJsonInput("");
            fetchDocuments();
        } catch (error: any) {
            console.error("Error inserting documents:", error);
            toast.error("Failed to insert: " + error.message);
            setLoading(false);
        }
    };

    const validateJson = (value: string) => {
        setJsonInput(value);
        if (!value.trim()) {
            setIsJsonValid(true);
            return;
        }
        try {
            JSON.parse(value);
            setIsJsonValid(true);
        } catch (e) {
            setIsJsonValid(false);
        }
    };

    const formatJson = () => {
        try {
            const jsonObject = JSON.parse(jsonInput);
            const prettyJson = JSON.stringify(jsonObject, null, 2);
            setJsonInput(prettyJson);
            setIsJsonValid(true);
        } catch (error: any) {
            toast.error('Invalid JSON: ' + error.message);
            setIsJsonValid(false);
        }
    };

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === "Raunak_chal@admin") {
            setAdminAuth(true);
            toast.success("Welcome Admin");
        } else {
            toast.error("Invalid Password");
        }
    };

    if (!adminAuth) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl">
                    <h1 className="text-2xl font-bold mb-6 text-center">Admin Access</h1>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Enter Admin Password"
                                className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            Access Dashboard
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground flex">
                {/* Sidebar */}
                <div className="w-64 border-r border-border p-4 flex flex-col gap-2 bg-card">
                    <h2 className="font-bold text-xl mb-4 px-2">Admin Playground</h2>
                    {COLLECTIONS.map(col => (
                        <button
                            key={col}
                            onClick={() => setSelectedCollection(col)}
                            className={`text-left px-4 py-2 rounded-lg transition-colors ${selectedCollection === col
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted text-muted-foreground"
                                }`}
                        >
                            {col}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col h-screen">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">{selectedCollection} <span className="text-muted-foreground text-sm font-normal">({documents.length} docs)</span></h1>

                        <div className="flex gap-2">
                            <button
                                onClick={fetchDocuments}
                                disabled={loading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            {loading && <Loader fullscreen={false} className="h-4 w-4 p-0" />}
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete ({selectedIds.size})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
                        {/* Data Table */}
                        <div className="col-span-2 border border-border rounded-xl overflow-hidden flex flex-col bg-card">
                            <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-3">
                                <button onClick={handleSelectAll} className="text-muted-foreground hover:text-foreground">
                                    {selectedIds.size === documents.length && documents.length > 0 ? (
                                        <CheckSquare className="w-5 h-5" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </button>
                                <span className="text-sm font-medium text-muted-foreground">Select All</span>
                            </div>
                            <div className="flex-1 overflow-auto p-0">
                                {documents.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        No documents found
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 w-10"></th>
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Data Preview</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.map((doc) => (
                                                <tr key={doc.id} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => handleSelectOne(doc.id)} className="text-muted-foreground hover:text-foreground block">
                                                            {selectedIds.has(doc.id) ? (
                                                                <CheckSquare className="w-4 h-4 text-primary" />
                                                            ) : (
                                                                <Square className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-primary">{doc.id}</td>
                                                    <td className="px-4 py-3 font-mono text-xs text-primary">{doc.date}</td>
                                                    <td className="px-4 py-3">
                                                        <pre className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                                                            {JSON.stringify(doc, null, 0)}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* JSON Insert */}
                        <div className="col-span-1 border border-border rounded-xl overflow-hidden flex flex-col bg-card">
                            <div className="p-3 border-b border-border bg-muted/30 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-sm">Insert JSON</h3>
                                    <p className="text-xs text-muted-foreground">Single object or Array</p>
                                </div>
                                <button
                                    onClick={formatJson}
                                    className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity"
                                >
                                    Format
                                </button>
                            </div>
                            <div className="flex-1 p-0 relative">
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => validateJson(e.target.value)}
                                    placeholder='e.g. { "name": "Test", "value": 123 } or [{...}, {...}]'
                                    className={`w-full h-full p-4 bg-background resize-none focus:outline-none font-mono text-xs ${!isJsonValid ? 'border-2 border-destructive' : ''}`}
                                />
                                {!isJsonValid && (
                                    <div className="absolute bottom-4 right-4 text-destructive text-xs bg-destructive/10 px-2 py-1 rounded">
                                        Invalid JSON
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-border bg-muted/30">
                                <button
                                    onClick={handleJsonInsert}
                                    disabled={loading || !jsonInput.trim() || !isJsonValid}
                                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Insert Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Modal */}
                {previewDoc && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                        <div className="bg-card w-full max-w-2xl max-h-[80vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                                <h3 className="font-bold">Document Preview</h3>
                                <button onClick={() => setPreviewDoc(null)} className="text-muted-foreground hover:text-foreground">
                                    ✕
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-background">
                                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                                    {JSON.stringify(previewDoc, null, 2)}
                                </pre>
                            </div>
                            <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
                                <button
                                    onClick={() => {
                                        setJsonInput(JSON.stringify(previewDoc, null, 2));
                                        setIsJsonValid(true);
                                        setPreviewDoc(null);
                                        toast.info("Document loaded into editor");
                                    }}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                                >
                                    Edit Document
                                </button>
                                <button onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(previewDoc, null, 2));
                                    toast.success("Copied to clipboard");
                                }} className="text-xs font-medium text-primary hover:underline">
                                    Copy JSON
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthGuard>
    );
}
