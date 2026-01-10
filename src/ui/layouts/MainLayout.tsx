import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Book, FileText, LayoutDashboard } from 'lucide-react';

const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-blue-600 text-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold flex items-center gap-2">
            <Book size={28} />
            <span>Exam Helper</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto py-6 gap-6">
        <aside className="w-64 flex flex-col gap-2">
          <Link 
            to="/" 
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link 
            to="/exams" 
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <FileText size={20} />
            <span>Đề thi</span>
          </Link>
        </aside>

        <main className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
