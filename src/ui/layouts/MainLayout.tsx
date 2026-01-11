import React, { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { Book, FileText, LayoutDashboard } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = "flex items-center gap-3 p-3 rounded-lg transition-colors w-full whitespace-nowrap";
    const activeClass = "bg-blue-100 text-blue-700 font-medium";
    const inactiveClass = "text-gray-700 hover:bg-blue-50 hover:text-blue-600";
    
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-blue-600 text-white shadow-md p-4 z-20">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold flex items-center gap-2">
            <Book size={28} />
            <span>Exam Helper</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto py-6 relative">
        {/* Sidebar Placeholder to reserve space in flow */}
        <div className="w-20 shrink-0" />

        {/* Floating Sidebar */}
        <aside 
          className={`absolute left-0 top-6 h-[calc(100%-3rem)] flex flex-col gap-2 bg-white shadow-xl rounded-r-xl transition-all duration-300 ease-in-out z-10 overflow-hidden ${
            isSidebarOpen ? 'w-64' : 'w-20 bg-transparent shadow-none'
          }`}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => setIsSidebarOpen(false)}
          onClick={() => setIsSidebarOpen(true)}
        >
          <div className={`flex flex-col gap-2 ${isSidebarOpen ? 'p-3' : 'py-3 items-center'}`}>
            <NavLink 
              to="/" 
              className={getNavLinkClass}
              end
            >
              <LayoutDashboard size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                Dashboard
              </span>
            </NavLink>
            <NavLink 
              to="/exams" 
              className={getNavLinkClass}
            >
              <FileText size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                Đề thi
              </span>
            </NavLink>
          </div>
        </aside>

        <main className="flex-1 bg-white rounded-xl shadow-sm p-6 ml-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
