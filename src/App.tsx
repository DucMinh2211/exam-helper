import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './ui/layouts/MainLayout';
import Dashboard from './ui/pages/Dashboard/Dashboard';
import BankEditor from './ui/pages/BankEditor/BankEditor';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="bank/:id" element={<BankEditor />} />
          <Route path="exams" element={<div className="p-8 text-center text-gray-500">Chức năng Đề thi đang được phát triển...</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;