import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface Teacher {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export const TeacherManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeacher, setNewTeacher] = useState({ email: '', password: '', fullName: '' });

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-teachers', {
      body: { action: 'list' }
    });
    
    if (!error && data?.teachers) {
      setTeachers(data.teachers);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.functions.invoke('manage-teachers', {
      body: { action: 'create', userData: newTeacher }
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setNewTeacher({ email: '', password: '', fullName: '' });
      fetchTeachers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this teacher?')) return;
    
    const { error } = await supabase.functions.invoke('manage-teachers', {
      body: { action: 'delete', userId: id }
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      fetchTeachers();
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Manage Teacher Accounts</h2>
      
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h3 className="text-lg font-medium mb-4">Add New Teacher</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Full Name"
            className="border p-2 rounded"
            value={newTeacher.fullName}
            onChange={(e) => setNewTeacher({...newTeacher, fullName: e.target.value})}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="border p-2 rounded"
            value={newTeacher.email}
            onChange={(e) => setNewTeacher({...newTeacher, email: e.target.value})}
            required
          />
          <input
            type="password"
            placeholder="Initial Password"
            className="border p-2 rounded"
            value={newTeacher.password}
            onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
            required
          />
          <button type="submit" className="md:col-span-3 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Create Account
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? <tr><td colSpan={3} className="p-4 text-center">Loading...</td></tr> : 
              teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{teacher.user_metadata?.full_name ?? 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{teacher.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handleDelete(teacher.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};