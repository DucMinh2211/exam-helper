import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './ui/layouts/MainLayout';
import Dashboard from './ui/pages/Dashboard/Dashboard';
import BankEditor from './ui/pages/BankEditor/BankEditor';
import ExamSeedList from './ui/pages/ExamSeed/ExamSeedList';
import ExamSeedEditor from './ui/pages/ExamSeed/ExamSeedEditor';
import ExamList from './ui/pages/Exam/ExamList';
import ExamDetail from './ui/pages/Exam/ExamDetail';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="bank/:id" element={<BankEditor />} />
          
          <Route path="seeds" element={<ExamSeedList />} />
          <Route path="seeds/:id" element={<ExamSeedEditor />} />

          <Route path="exams" element={<ExamList />} />
          <Route path="exams/:id" element={<ExamDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
