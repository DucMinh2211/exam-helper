import React, { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Book, FileText, LayoutDashboard, FileCog, Settings } from 'lucide-react';

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

      <div className="flex flex-1 container mx-auto py-6 gap-6 relative">
        {/* Sidebar Space Holder */}
        <div className={`shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`} />

        {/* Floating Sidebar */}
        <aside 
          className={`absolute left-0 top-6 h-[calc(100%-3rem)] bg-white shadow-xl rounded-r-xl transition-all duration-300 ease-in-out z-10 overflow-hidden border border-gray-100 flex flex-col justify-between ${
            isSidebarOpen ? 'w-64' : 'w-20'
          }`}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => setIsSidebarOpen(false)}
        >
          <div className={`flex flex-col gap-2 p-3 ${!isSidebarOpen && 'items-center'}`}>
            <NavLink to="/" className={getNavLinkClass} end>
              <LayoutDashboard size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                Trang Chủ
              </span>
            </NavLink>

            <NavLink to="/seeds" className={getNavLinkClass}>
              <FileCog size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                Mẫu đề thi
              </span>
            </NavLink>

            <NavLink to="/exams" className={getNavLinkClass}>
              <FileText size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                Đề thi
              </span>
            </NavLink>
          </div>

          <div className={`p-3 border-t ${!isSidebarOpen && 'items-center flex flex-col'}`}>
            <NavLink to="/settings" className={getNavLinkClass}>
              <Settings size={24} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                Cài đặt & Dữ liệu
              </span>
            </NavLink>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
