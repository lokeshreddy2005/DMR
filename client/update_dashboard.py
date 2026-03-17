import os

file_path = 'src/components/Dashboard.jsx'

with open(file_path, 'r') as f:
    content = f.read()

idx = content.find("            {/* Storage Summary (auth only) */}")
if idx == -1:
    print("Could not find the split point!")
    exit(1)

top_half = content[:idx]

bottom_half = """            {/* Storage Summary (auth only) */}
            {!publicOnly && storage && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span>🌐</span> Public Space</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg tracking-wide">{storage.public.percentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${storage.public.percentage}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">USED: <span className="font-bold text-gray-700 dark:text-gray-300">{formatSize(storage.public.used)}</span> / {formatSize(storage.public.limit)}</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span>🔒</span> Private Space</span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg tracking-wide">{storage.private.percentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${storage.private.percentage}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">USED: <span className="font-bold text-gray-700 dark:text-gray-300">{formatSize(storage.private.used)}</span> / {formatSize(storage.private.limit)}</p>
                    </div>

                    {storage.organizations?.slice(0, 1).map((org) => (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" key={org.orgId}>
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 truncate pr-2"><span>🏢</span> {org.orgName}</span>
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg tracking-wide">{org.percentage}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mb-3">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${org.percentage}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">USED: <span className="font-bold text-gray-700 dark:text-gray-300">{formatSize(org.used)}</span> / {formatSize(org.limit)}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Space Tabs (auth only) */}
            {!publicOnly && (
                <div className="inline-flex flex-wrap gap-2 p-1.5 mb-8 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/80 rounded-2xl shadow-sm w-full sm:w-auto">
                    {[
                        { key: 'public', icon: '🌐', label: 'Public', count: stats.public?.count || 0 },
                        { key: 'private', icon: '🔒', label: 'Private', count: stats.private?.count || 0 },
                        { key: 'organization', icon: '🏢', label: 'Organizations', count: stats.organization?.count || 0 },
                    ].map((s) => (
                        <button key={s.key}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                                activeSpace === s.key 
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700/50 scale-[1.02]' 
                                : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                            onClick={() => { setActiveSpace(s.key); setSelectedOrg(null); setSearchQuery(''); }}
                        >
                            <span className="text-lg opacity-80">{s.icon}</span>
                            <span>{s.label}</span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-black tracking-wide ${
                                activeSpace === s.key 
                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>{s.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Organization view */}
            {!publicOnly && activeSpace === 'organization' && (
                <div className="space-y-6 mb-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Your Organizations</h3>
                            <button 
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${showOrgForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'}`}
                                onClick={() => setShowOrgForm(!showOrgForm)}
                            >
                                {showOrgForm ? 'Cancel' : '+ New Organization'}
                            </button>
                        </div>

                        {showOrgForm && (
                            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row gap-4 animate-fade-in-up">
                                <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-shadow font-medium" placeholder="Organization name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                                <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-shadow font-medium" placeholder="Description (optional)" value={newOrgDesc} onChange={(e) => setNewOrgDesc(e.target.value)} />
                                <button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors whitespace-nowrap" onClick={handleCreateOrg}>Create</button>
                            </div>
                        )}

                        {orgs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {orgs.map((org) => (
                                    <button 
                                        key={org._id} 
                                        className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left ${
                                            selectedOrg?._id === org._id 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500' 
                                            : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-blue-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'
                                        }`} 
                                        onClick={() => setSelectedOrg(org)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl text-white font-black flex items-center justify-center text-lg shadow-sm transition-transform group-hover:scale-105`} style={{ backgroundColor: org.avatarColor || '#3b82f6' }}>
                                                {org.name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1">{org.name}</p>
                                                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                                    {org.members?.length || 0} members
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            !showOrgForm && (
                                <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <span className="text-5xl opacity-80 block mb-4 drop-shadow-sm">🏢</span>
                                    <h4 className="text-gray-900 dark:text-white font-extrabold text-lg mb-2">No Organizations Yet</h4>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">Create an organization to start collaborating with your team and sharing documents securely.</p>
                                </div>
                            )
                        )}
                    </div>

                    {selectedOrg && (
                        <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm animate-fade-in-up">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700/50">
                                <div>
                                    <h4 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                        Team Members
                                        <span className="text-xs font-black px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg tracking-wide">{selectedOrg.name}</span>
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage access and roles for this organization.</p>
                                </div>
                                <button 
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${showAddMember ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={() => setShowAddMember(!showAddMember)}
                                >
                                    {showAddMember ? 'Cancel' : '+ Add Member'}
                                </button>
                            </div>

                            {showAddMember && (
                                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col sm:flex-row gap-4 animate-fade-in">
                                    <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 text-sm font-medium" placeholder="User email address" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                                    <select className="px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm font-bold" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    <button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm" onClick={handleAddMember}>Add</button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedOrg.members?.map((m) => (
                                    <div key={m._id} className="group flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: m.user?.avatarColor || '#6b7280' }}>
                                                {m.user?.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white mb-0.5">{m.user?.name || m.user?.email}</p>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                    m.role === 'admin' ? 'text-purple-600 dark:text-purple-400' :
                                                    m.role === 'member' ? 'text-blue-600 dark:text-blue-400' :
                                                    'text-gray-500 dark:text-gray-400'
                                                }`}>{m.role}</p>
                                            </div>
                                        </div>
                                        {m.role !== 'admin' && (
                                            <button className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2.5 rounded-xl transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => handleRemoveMember(m.user?._id)} title="Remove Member">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Documents Grid */}
            {(publicOnly || activeSpace !== 'organization' || (activeSpace === 'organization' && selectedOrg)) && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                            {publicOnly ? 'Public Collection' :
                                activeSpace === 'organization' && selectedOrg ? `${selectedOrg.name} Documents` :
                                    `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Files`}
                        </h3>
                        <div className="bg-gray-100 dark:bg-gray-800 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 shadow-inner">
                            {documents.length} files
                        </div>
                    </div>

                    {documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-6 bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-3xl animate-fade-in text-center shadow-sm">
                            <span className="text-7xl mb-6 inline-block transform hover:scale-110 transition-transform duration-300 drop-shadow-md">📂</span>
                            <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">No documents {searchQuery ? 'matching your search' : 'found here'}</h4>
                            <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mb-8 leading-relaxed">
                                {searchQuery ? 'Try adjusting your keywords or clearing the search filter.' : 
                                publicOnly ? 'There are no public documents available at the moment.' : 
                                'This space is empty. Upload your first document to get started and organize your work.'}
                            </p>
                            {!publicOnly && !searchQuery && (
                                <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2" onClick={() => setShowUpload(true)}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Upload First Document
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in-up">
                            {documents.map((doc) => (
                                <div 
                                    key={doc._id} 
                                    className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden h-full" 
                                    onClick={() => handleViewDetail(doc._id)}
                                >
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-sm border border-blue-100/50 dark:border-blue-800/30">
                                            📄
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleDownload(doc._id); }} title="Download">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </button>
                                            {!publicOnly && doc.space === 'private' && (
                                                <button className="w-9 h-9 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleMakePublic(doc._id); }} title="Publish to Public">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                                </button>
                                            )}
                                            {!publicOnly && (
                                                <button className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc._id); }} title="Delete File">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={doc.fileName}>{doc.fileName}</h4>
                                    
                                    <div className="flex items-center gap-2.5 mb-5 text-[11px] font-black tracking-wider uppercase">
                                        <span className={`px-2.5 py-1 rounded-lg shadow-sm ${
                                            doc.space === 'public' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                            doc.space === 'private' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                            'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                                        }`}>{doc.space}</span>
                                        <span className="text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">{formatSize(doc.fileSize)}</span>
                                    </div>
                                    
                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1.5 mb-2.5">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                            {formatDate(doc.uploadDate)}
                                            <span className="mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                                            {doc.uploadedBy?.name?.split(' ')[0]}
                                        </p>
                                        
                                        {/* Tags preview */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {doc.isTagged && doc.metadata?.primaryDomain && (
                                                <span className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-lg uppercase tracking-wider border border-indigo-100/50 dark:border-indigo-800/30 truncate max-w-[100px]" title={doc.metadata.primaryDomain}>
                                                    {doc.metadata.primaryDomain}
                                                </span>
                                            )}
                                            {doc.tags?.slice(0, doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2).map((t, i) => (
                                                <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-lg truncate max-w-[80px]">
                                                    {t}
                                                </span>
                                            ))}
                                            {doc.tags?.length > (doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2) && (
                                                <span className="px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[10px] font-bold rounded-lg border border-gray-200 dark:border-gray-700">
                                                    +{doc.tags.length - (doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
"""

with open(file_path, 'w') as f:
    f.write(top_half + bottom_half)
    
print("Successfully updated Dashboard.jsx!")
