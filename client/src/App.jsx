import React, { useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

function App() {
    const [status, setStatus] = useState('Disconnected');
    const [requests, setRequests] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    useEffect(() => {
        socket.on('connect', () => setStatus('Connected'));
        socket.on('disconnect', () => setStatus('Disconnected'));

        socket.on('request', (data) => {
            setRequests(prev => [data, ...prev]);
        });

        socket.on('response', (data) => {
            setRequests(prev => prev.map(req =>
                req.id === data.id ? { ...req, ...data, status: data.statusCode } : req
            ));
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('request');
            socket.off('response');
        };
    }, []);

    // Group requests by domain for the Tree View
    const groupedRequests = useMemo(() => {
        const groups = {};
        requests.forEach(req => {
            try {
                const url = new URL(req.url);
                const domain = url.hostname;
                if (!groups[domain]) groups[domain] = [];
                groups[domain].push(req);
            } catch (e) {
                const domain = 'unknown';
                if (!groups[domain]) groups[domain] = [];
                groups[domain].push(req);
            }
        });
        return groups;
    }, [requests]);

    const toggleDomain = (domain) => {
        const newSet = new Set(expandedDomains);
        if (newSet.has(domain)) newSet.delete(domain);
        else newSet.add(domain);
        setExpandedDomains(newSet);
    };

    const selectedRequest = useMemo(() =>
        requests.find(r => r.id === selectedId),
        [requests, selectedId]);

    const clearRequests = () => {
        setRequests([]);
        setSelectedId(null);
    };

    return (
        <div className="flex flex-col h-screen bg-charles-bg text-charles-text overflow-hidden select-none">
            {/* Toolbar */}
            <div className="h-10 bg-charles-toolbar border-b border-charles-border flex items-center px-4 gap-4 flex-shrink-0">
                <div className="flex items-center gap-1">
                    <div className="text-white font-bold text-sm mr-4">CYBERPROXY</div>
                    <div className="toolbar-btn" onClick={clearRequests} title="Clear Session">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                </div>

                <div className="h-4 w-px bg-charles-border mx-2"></div>

                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                    <span className="text-[11px] font-medium uppercase tracking-wider">{status}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Structure View) */}
                <div className="w-80 bg-charles-sidebar border-r border-charles-border flex flex-col">
                    <div className="p-2 border-b border-charles-border text-[11px] uppercase tracking-widest font-bold opacity-50">Structure</div>
                    <div className="flex-1 overflow-y-auto py-1">
                        {Object.entries(groupedRequests).map(([domain, reqs]) => (
                            <div key={domain}>
                                <div
                                    className="tree-item flex items-center gap-1"
                                    onClick={() => toggleDomain(domain)}
                                >
                                    <span className="text-[10px] w-3 opacity-60">
                                        {expandedDomains.has(domain) ? '▼' : '▶'}
                                    </span>
                                    <span className="truncate flex-1">{domain}</span>
                                </div>
                                {expandedDomains.has(domain) && reqs.map(req => (
                                    <div
                                        key={req.id}
                                        className={`tree-item ml-4 ${selectedId === req.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedId(req.id)}
                                    >
                                        <span className={`text-[10px] font-bold w-10 ${req.method === 'GET' ? 'text-blue-400' : 'text-green-400'
                                            }`}>{req.method}</span>
                                        <span className="truncate opacity-80">{new URL(req.url).pathname}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inspector Area */}
                <div className="flex-1 flex flex-col bg-charles-bg overflow-hidden">
                    {selectedRequest ? (
                        <>
                            <div className="p-4 border-b border-charles-border">
                                <div className="text-[11px] font-mono opacity-50 mb-1">{selectedRequest.method} {selectedRequest.url}</div>
                                <div className="text-xl font-semibold text-charles-text-bright">
                                    {selectedRequest.status || 'Pending...'}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-charles-toolbar border-b border-charles-border px-2">
                                {['Overview', 'Contents', 'Headers', 'SSL'].map(tab => (
                                    <div
                                        key={tab}
                                        className={`px-4 py-2 text-[12px] cursor-pointer border-b-2 transition-colors ${activeTab === tab
                                                ? 'border-charles-accent text-charles-text-bright'
                                                : 'border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        {tab}
                                    </div>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                                {activeTab === 'Overview' && (
                                    <div className="space-y-4">
                                        <Section title="Request Detail">
                                            <Row label="URL" value={selectedRequest.url} />
                                            <Row label="Method" value={selectedRequest.method} />
                                            <Row label="Protocol" value={selectedRequest.protocol} />
                                            <Row label="Status" value={selectedRequest.status || 'Waiting...'} />
                                            <Row label="Time" value={new Date(selectedRequest.timestamp).toLocaleString()} />
                                        </Section>
                                    </div>
                                )}
                                {activeTab === 'Headers' && (
                                    <Section title="Request Headers">
                                        {Object.entries(selectedRequest.headers).map(([k, v]) => (
                                            <Row key={k} label={k} value={v} />
                                        ))}
                                    </Section>
                                )}
                                {activeTab === 'Contents' && (
                                    <div className="opacity-50 italic">Body content capturing coming soon...</div>
                                )}
                                {activeTab === 'SSL' && (
                                    <div className="opacity-50 italic">SSL Handshake details not captured yet.</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-charles-text opacity-30 select-none">
                            <div className="text-center">
                                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <div className="text-lg">Select a request to view details</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-charles-toolbar border-t border-charles-border px-3 flex items-center justify-between text-[10px] opacity-60">
                <div className="flex gap-4">
                    <span>Recording started</span>
                    <span>{requests.length} requests captured</span>
                </div>
                <div>Proxy: localhost:8080</div>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="mb-6">
            <div className="text-[11px] uppercase tracking-wider font-bold mb-3 text-charles-accent opacity-80">{title}</div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex border-b border-white border-opacity-5 py-1">
            <div className="w-40 flex-shrink-0 opacity-50 truncate pr-2">{label}:</div>
            <div className="flex-1 break-all text-charles-text-bright">{value}</div>
        </div>
    );
}

export default App;
