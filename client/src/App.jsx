import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
    const [status, setStatus] = useState('Disconnected');
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        socket.on('connect', () => setStatus('Connected'));
        socket.on('disconnect', () => setStatus('Disconnected'));

        socket.on('request', (data) => {
            setRequests(prev => [data, ...prev]);
        });

        socket.on('response', (data) => {
            // Update the request with response data
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

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">CyberProxy</h1>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${status === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-gray-600 font-medium">{status}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg run-flow-root overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm whitespace-nowrap">
                            <thead className="uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 font-semibold text-gray-700">Method</th>
                                    <th scope="col" className="px-6 py-4 font-semibold text-gray-700">URL</th>
                                    <th scope="col" className="px-6 py-4 font-semibold text-gray-700">Status</th>
                                    <th scope="col" className="px-6 py-4 font-semibold text-gray-700">Time</th>
                                    <th scope="col" className="px-6 py-4 font-semibold text-gray-700">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${req.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                                                    req.method === 'POST' ? 'bg-green-100 text-green-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {req.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 truncate max-w-md" title={req.url}>{req.url}</td>
                                        <td className="px-6 py-4">
                                            {req.status ? (
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${req.status >= 200 && req.status < 300 ? 'bg-green-100 text-green-700' :
                                                        req.status >= 400 ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {req.status}
                                                </span>
                                            ) : <span className="text-gray-400">Pending...</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(req.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {req.duration ? `${req.duration}ms` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {requests.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                No requests captured yet. Configure your browser/system to use proxy <b>localhost:8080</b>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
