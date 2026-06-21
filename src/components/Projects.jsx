import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data);
    }
    setLoading(false);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;

    const { error } = await supabase
      .from('projects')
      .insert([{
        user_id: user.id,
        name: newProjectName,
        description: newProjectDesc
      }]);

    if (error) {
      console.error('Error creating project:', error);
    } else {
      setNewProjectName('');
      setNewProjectDesc('');
      setShowNewForm(false);
      fetchProjects();
    }
  };

  const handleDeleteProject = async (id) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
    } else {
      fetchProjects();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c875]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/50 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">My Projects</h2>
          <p className="text-sm text-gray-500">Manage your saved models, reports, and AI interactions.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-[#0f2e24] hover:bg-[#0a1914] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {showNewForm ? 'Cancel' : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </>
          )}
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreateProject} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold mb-4 text-gray-800">Create New Project</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c875] focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c875] focus:border-transparent outline-none"
                rows="3"
              />
            </div>
            <button
              type="submit"
              className="bg-[#00c875] hover:bg-[#00a862] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Save Project
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 && !showNewForm ? (
        <div className="text-center py-12 bg-white/30 rounded-xl border border-dashed border-gray-300">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
          <p className="text-gray-500 mb-4">Get started by creating a new project to save your work.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="text-[#00c875] font-medium hover:underline"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete project"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00c875]/10 flex items-center justify-center text-[#00c875]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 truncate pr-8">{project.name}</h3>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {project.description || 'No description provided.'}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3">
                <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                <button className="text-[#00c875] font-medium hover:underline">Open</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;
